'use strict';
// pipeline-otp-send.js
// POST { email } → generates 6-digit code, stores in Supabase, emails via Resend.

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ANON_KEY     = process.env.SUPABASE_ANON_KEY || SERVICE_KEY;
const RESEND_KEY   = process.env.RESEND_API_KEY;
const FROM_EMAIL   = process.env.RESEND_FROM_EMAIL || 'alerts@aproposgroupllc.com';
const OTP_MINUTES  = 15;
const AGENCY_ACCESS_DAYS = 30;

async function getSubscription(email) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/capgen_subscriptions?email=eq.${encodeURIComponent(email)}&select=email,status,plan_type,updated_at&limit=1`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  } catch { return null; }
}

async function isAllowed(email) {
  const sub = await getSubscription(email);
  if (!sub) return false;
  if (String(sub.status || '').toLowerCase() !== 'active') return false;

  if (String(sub.plan_type || '').toLowerCase() === 'agency_30') {
    const start = sub.updated_at ? new Date(sub.updated_at).getTime() : NaN;
    if (!Number.isFinite(start)) return false;
    const expires = start + AGENCY_ACCESS_DAYS * 24 * 60 * 60 * 1000;
    return Date.now() < expires;
  }

  return true;
}

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('[pipeline-otp-send] Missing required env vars: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}
if (!RESEND_KEY) {
  console.error('[pipeline-otp-send] Missing RESEND_API_KEY — emails will fail');
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const email = (body.email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Valid email required.' }) };
  }

  const allowed = await isAllowed(email);
  if (!allowed) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'No active access record found for that email address.' }) };
  }

  const code = generateOTP();
  const expires = new Date(Date.now() + OTP_MINUTES * 60 * 1000).toISOString();

  await fetch(`${SUPABASE_URL}/rest/v1/pipeline_otp?email=eq.${encodeURIComponent(email)}&used=eq.false`, {
    method: 'DELETE',
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
  });

  const saveRes = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_otp`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ email, code, expires_at: expires }),
  });
  if (!saveRes.ok) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Could not generate code. Try again.' }) };

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [email],
      subject: 'Your RFCP Access Code',
      html: `
        <div style="font-family:Arial,sans-serif;background:#0A1A3A;padding:40px 20px;min-height:100vh;">
          <div style="max-width:440px;margin:0 auto;background:#0f2244;border:1px solid rgba(91,175,255,.25);border-radius:18px;padding:36px 32px;">
            <p style="margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:.14em;color:#5BD3FF;font-weight:700;">Registered Federal Contractors Portal</p>
            <h2 style="margin:0 0 16px;font-size:22px;color:#f0f6ff;">Your access code</h2>
            <p style="margin:0 0 24px;font-size:14px;color:#8facd0;line-height:1.7;">Enter this code on the login screen to access your opportunity pipeline.</p>
            <div style="background:#07111f;border:2px solid #5BD3FF;border-radius:14px;padding:28px;text-align:center;margin-bottom:24px;">
              <div style="font-size:11px;color:#5a7899;letter-spacing:.18em;text-transform:uppercase;margin-bottom:10px;font-family:monospace;">Access Code</div>
              <div style="font-size:3rem;font-weight:900;letter-spacing:.22em;color:#5BD3FF;font-family:monospace;">${code}</div>
            </div>
            <p style="margin:0;font-size:12px;color:#3a5470;line-height:1.6;">This code expires in ${OTP_MINUTES} minutes. If you didn't request this, ignore this email.</p>
          </div>
        </div>`,
    }),
  });

  if (!emailRes.ok) {
    const err = await emailRes.text();
    console.error('Resend error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Could not send code. Try again.' }) };
  }

  return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
};
