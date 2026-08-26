'use strict';
// agency-access-intake.js
// Public intake boundary for approved agency partners. The shared promo code
// authorizes intake submission only; it does not bypass business authentication.

const RESEND_KEY = process.env.RESEND_API_KEY || '';
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Apropos Group LLC <alerts@aproposgroupllc.com>';
const TO_EMAIL = process.env.RESEND_TO_EMAIL || 'jmitchell@aproposgroupllc.com';
const PROMO_CODE = String(process.env.AGENCY_ACCESS_PROMO_CODE || 'AGENCY 30').trim().toUpperCase();

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

function esc(value) {
  return clean(value, 500).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
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
  const promoCode = clean(body.promo_code, 60).toUpperCase().replace(/\s+/g, ' ');

  if (!name || !agencyName || !businessName || !businessEmail || !promoCode) {
    return reply(400, { error: 'Name, agency name, business name, business email, and promo code are required.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(businessEmail)) {
    return reply(400, { error: 'Enter a valid business email.' });
  }
  if (promoCode !== PROMO_CODE) {
    return reply(403, { error: 'Promo code not recognized.' });
  }
  if (!RESEND_KEY) {
    return reply(500, { error: 'Agency intake delivery is not configured.' });
  }

  const submittedAt = new Date().toISOString();
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#0A1A3A;padding:28px;color:#f0f6ff">
    <div style="max-width:620px;margin:auto;background:#0f2244;border:1px solid rgba(91,211,255,.25);border-radius:14px;padding:26px">
      <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#5BD3FF;font-weight:700;margin-bottom:8px">RFCP Agency Access Intake</div>
      <h2 style="margin:0 0 20px">New AGENCY 30 submission</h2>
      <table style="width:100%;border-collapse:collapse;color:#dcecff">
        <tr><td style="padding:8px 0;color:#8facd0;width:170px">Name</td><td>${esc(name)}</td></tr>
        <tr><td style="padding:8px 0;color:#8facd0">Agency Name</td><td>${esc(agencyName)}</td></tr>
        <tr><td style="padding:8px 0;color:#8facd0">Business Name</td><td>${esc(businessName)}</td></tr>
        <tr><td style="padding:8px 0;color:#8facd0">Business Email</td><td>${esc(businessEmail)}</td></tr>
        <tr><td style="padding:8px 0;color:#8facd0">Promo Code</td><td>${esc(promoCode)}</td></tr>
        <tr><td style="padding:8px 0;color:#8facd0">Submitted</td><td>${esc(submittedAt)}</td></tr>
      </table>
    </div>
  </div>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [TO_EMAIL],
      subject: `RFCP Agency Access — ${agencyName} / ${businessName}`,
      html,
    }),
  });

  const result = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('[agency-access-intake] Resend error', result);
    return reply(502, { error: 'Could not submit the agency access request. Please try again.' });
  }

  return reply(200, {
    ok: true,
    message: 'Agency access request received.',
    business_email: businessEmail,
  });
};
