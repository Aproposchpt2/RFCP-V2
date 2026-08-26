'use strict';
// agency-access-intake.js
// Public intake boundary for approved agency partners. A valid AGENCY30 promo
// creates or refreshes a 30-day RFCP access record for the submitted business
// email. Dashboard access still uses the existing secure OTP flow.

const RESEND_KEY = process.env.RESEND_API_KEY || '';
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Apropos Group LLC <alerts@aproposgroupllc.com>';
const TO_EMAIL = process.env.RESEND_TO_EMAIL || 'jmitchell@aproposgroupllc.com';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
const PROMO_CODE = canonicalCode(process.env.AGENCY_ACCESS_PROMO_CODE || 'AGENCY30');

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function reply(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

function clean(value, max = 180) {
  return String(value || '').trim().slice(0, max);
}

function canonicalCode(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function esc(value) {
  return clean(value, 500).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

function sbHeaders(extra = {}) {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function grantAgencyAccess({ name, businessName, businessEmail }) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error('RFCP access storage is not configured.');
  }

  const now = new Date().toISOString();
  const record = {
    email: businessEmail,
    first_name: name,
    last_name: '',
    business_name: businessName,
    plan_type: 'agency_30',
    plan_amount: 0,
    status: 'active',
    updated_at: now,
  };

  const lookup = await fetch(
    `${SUPABASE_URL}/rest/v1/capgen_subscriptions?email=eq.${encodeURIComponent(businessEmail)}&select=email&limit=1`,
    { headers: sbHeaders() }
  );
  if (!lookup.ok) throw new Error('Could not verify RFCP access record.');
  const rows = await lookup.json();

  const exists = Array.isArray(rows) && rows.length > 0;
  const url = exists
    ? `${SUPABASE_URL}/rest/v1/capgen_subscriptions?email=eq.${encodeURIComponent(businessEmail)}`
    : `${SUPABASE_URL}/rest/v1/capgen_subscriptions`;

  const save = await fetch(url, {
    method: exists ? 'PATCH' : 'POST',
    headers: sbHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify(record),
  });

  if (!save.ok) {
    const detail = await save.text().catch(() => '');
    console.error('[agency-access-intake] access grant failed', save.status, detail);
    throw new Error('Could not activate RFCP agency access.');
  }

  return now;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return reply(405, { error: 'POST only' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return reply(400, { error: 'Invalid request.' }); }

  const name = clean(body.name);
  const agencyName = clean(body.agency_name);
  const businessName = clean(body.business_name);
  const businessEmail = clean(body.business_email).toLowerCase();
  const promoCode = canonicalCode(body.promo_code);

  if (!name || !agencyName || !businessName || !businessEmail || !promoCode) {
    return reply(400, { error: 'Name, agency name, business name, business email, and promo code are required.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(businessEmail)) {
    return reply(400, { error: 'Enter a valid business email.' });
  }
  if (promoCode !== PROMO_CODE) {
    return reply(403, { error: 'Promo code not recognized.' });
  }

  let activatedAt;
  try {
    activatedAt = await grantAgencyAccess({ name, businessName, businessEmail });
  } catch (err) {
    console.error('[agency-access-intake] activation error', err);
    return reply(500, { error: err.message || 'Could not activate agency access.' });
  }

  // Intake notification is secondary to access activation. If email delivery is
  // unavailable, access remains valid and the user can continue to secure login.
  if (RESEND_KEY) {
    const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;background:#0A1A3A;padding:28px;color:#f0f6ff">
      <div style="max-width:620px;margin:auto;background:#0f2244;border:1px solid rgba(91,211,255,.25);border-radius:14px;padding:26px">
        <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#5BD3FF;font-weight:700;margin-bottom:8px">RFCP Agency Access Intake</div>
        <h2 style="margin:0 0 20px">New AGENCY30 activation</h2>
        <table style="width:100%;border-collapse:collapse;color:#dcecff">
          <tr><td style="padding:8px 0;color:#8facd0;width:170px">Name</td><td>${esc(name)}</td></tr>
          <tr><td style="padding:8px 0;color:#8facd0">Agency Name</td><td>${esc(agencyName)}</td></tr>
          <tr><td style="padding:8px 0;color:#8facd0">Business Name</td><td>${esc(businessName)}</td></tr>
          <tr><td style="padding:8px 0;color:#8facd0">Business Email</td><td>${esc(businessEmail)}</td></tr>
          <tr><td style="padding:8px 0;color:#8facd0">Promo Code</td><td>AGENCY30</td></tr>
          <tr><td style="padding:8px 0;color:#8facd0">Activated</td><td>${esc(activatedAt)}</td></tr>
          <tr><td style="padding:8px 0;color:#8facd0">Access Window</td><td>30 days</td></tr>
        </table>
      </div>
    </div>`;

    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [TO_EMAIL],
        subject: `RFCP Agency Access — ${agencyName} / ${businessName}`,
        html,
      }),
    }).catch(err => console.error('[agency-access-intake] notification error', err));
  }

  return reply(200, {
    ok: true,
    access_granted: true,
    access_days: 30,
    business_email: businessEmail,
    login_url: `/onboarding?email=${encodeURIComponent(businessEmail)}`,
    message: 'Agency access activated. Continue to secure login.',
  });
};
