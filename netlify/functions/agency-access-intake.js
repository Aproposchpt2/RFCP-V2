'use strict';
// agency-access-intake.js
// Public intake boundary for approved agency partners. A valid AGENCY30 promo
// (advisor name + agency name + promo code) unlocks a client-business lookup
// by NAME ONLY -- no client email collected. The business is looked up
// against its real federal entity registration (same api.sam.gov Entity
// Management connector proven in sam-lookup.mjs / capgen-claim-entity.js),
// which returns its actual self-certified UEI/NAICS, not a guess.
//
// No OTP: the advisor never receives or enters a login code. A real
// client_sessions row is minted server-side (same table/shape
// pipeline-otp-verify.js already writes on a normal OTP login) and handed
// back so the front-end can seed localStorage and land the advisor straight
// on ag-dashboard.html -- confirmed correct 2026-08-27 per Jeff: "We don't
// need the OTP."
//
// Every submission -- matched, unmatched, or ambiguous -- is logged to
// rfcp_agency_pilot_logins (advisor_name, agency_name, business_name, uei,
// matched) so which advisor brought in which business is queryable later,
// per Jeff: "I want to track the agency and name of the advisor."

const crypto = require('crypto');

const RESEND_KEY = process.env.RESEND_API_KEY || '';
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Apropos Group LLC <alerts@aproposgroupllc.com>';
const TO_EMAIL = process.env.RESEND_TO_EMAIL || 'jmitchell@aproposgroupllc.com';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
const SAM_API_KEY = process.env.SAM_API_KEY || '';
const SAM_ENTITY_URL = 'https://api.sam.gov/entity-information/v3/entities';
const PROMO_CODE = canonicalCode(process.env.AGENCY_ACCESS_PROMO_CODE || 'AGENCY30');
// Short-lived on purpose: each agency lookup is meant to be a fresh session,
// not a standing account an advisor stays quietly logged into for a week
// (that's the OTP subscriber session's TTL, not this one). Per Jeff:
// "Each session should be a fresh new session. no saving browser state."
const SESSION_TTL_MS = 4 * 60 * 60 * 1000;

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function reply(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

function clean(value, max = 240) {
  return String(value || '').trim().slice(0, max);
}

function canonicalCode(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function esc(value) {
  return clean(value, 500).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function sbHeaders(extra = {}) {
  return { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', ...extra };
}

function slug(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'business';
}

// Per Jeff 2026-08-28: "add the Business URL to this intake form" -- the two
// sites use different search methods to build the services profile (NAT-CORP
// searches the business's own website; this SAM.gov entity lookup is
// name-based), but the URL is captured here too for the client record. Never
// trust client-side-only validation -- re-validated server-side, same shape
// NAT-CORP's normalizeWebsite() uses.
function normalizeWebsite(value) {
  let raw = clean(value, 700);
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  let url;
  try { url = new URL(raw); } catch { return null; }
  if (url.protocol !== 'https:' || !url.hostname || !url.hostname.includes('.')) return null;
  url.hash = '';
  return url.href;
}

async function samFetch(params) {
  if (!SAM_API_KEY) throw new Error('Federal registration lookup is not configured.');
  const url = new URL(SAM_ENTITY_URL);
  url.searchParams.set('api_key', SAM_API_KEY);
  for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Federal registration lookup failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

async function searchByName(name) {
  const data = await samFetch({ legalBusinessName: name, registrationStatus: 'A', includeSections: 'entityRegistration,coreData' });
  const rows = data.entityData || [];
  return rows.map(e => {
    const reg = e.entityRegistration || {};
    const addr = (e.coreData && e.coreData.physicalAddress) || {};
    return { uei: reg.ueiSAM, legal_name: reg.legalBusinessName, cage: reg.cageCode || null, city: addr.city || null, state: addr.stateOrProvinceCode || null };
  }).filter(c => c.uei);
}

async function fetchEntityRecord(uei) {
  const data = await samFetch({ ueiSAM: uei, includeSections: 'entityRegistration,coreData,assertions' });
  const e = (data.entityData || [])[0];
  if (!e) return null;
  const reg = e.entityRegistration || {};
  const core = e.coreData || {};
  const addr = core.physicalAddress || {};
  const gs = (e.assertions && e.assertions.goodsAndServices) || {};
  const bt = (core.businessTypes && core.businessTypes.sbaBusinessTypeList) || [];
  const naics = (gs.naicsList || []).map(n => n.naicsCode).filter(Boolean);
  const now = new Date();
  const certs = bt.filter(c => { const exit = c.certificationExitDate || c.exitDate; return !exit || new Date(exit) > now; })
    .map(c => c.sbaBusinessTypeDesc || c.sbaBusinessTypeDescription).filter(Boolean);
  return {
    uei: reg.ueiSAM || uei,
    legal_name: reg.legalBusinessName || '',
    cage: reg.cageCode || null,
    city: addr.city || null,
    state: addr.stateOrProvinceCode || null,
    naics,
    certifications: certs,
  };
}

async function logAttempt({ advisorName, agencyName, businessName, businessWebsite, uei, matched }) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/rfcp_agency_pilot_logins`, {
      method: 'POST',
      headers: sbHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify([{ advisor_name: advisorName, agency_name: agencyName, code_used: PROMO_CODE, business_name: businessName, business_website: businessWebsite || null, uei: uei || null, matched }]),
    });
  } catch (err) {
    console.error('[agency-access-intake] pilot-login logging failed', err);
  }
}

async function landClientOnDashboard({ businessName, businessWebsite, entity }) {
  const email = `agency+${slug(entity.legal_name || businessName)}-${entity.uei.toLowerCase()}@rfcp-v2.internal`;
  const now = new Date().toISOString();

  await fetch(`${SUPABASE_URL}/rest/v1/biz_center_members?email=eq.${encodeURIComponent(email)}`, {
    method: 'DELETE', headers: sbHeaders({ Prefer: 'return=minimal' }),
  }).catch(() => {});
  const bcInsert = await fetch(`${SUPABASE_URL}/rest/v1/biz_center_members`, {
    method: 'POST',
    headers: sbHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify([{
      email,
      full_name: entity.legal_name || businessName,
      business_name: entity.legal_name || businessName,
      website: businessWebsite || null,
      city: entity.city,
      state: entity.state,
      subscription_status: 'active',
      naics: entity.naics,
      agency_uei: entity.uei,
      agent_context: `Agency-partner intake. Registered federal contractor (UEI ${entity.uei}). Certifications: ${entity.certifications.join(', ') || 'none active'}.`,
    }]),
  });
  if (!bcInsert.ok) throw new Error('Could not create the client business record.');

  const sessionToken = crypto.randomUUID();
  const sessionInsert = await fetch(`${SUPABASE_URL}/rest/v1/client_sessions`, {
    method: 'POST',
    headers: sbHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify([{
      session_token: sessionToken,
      email,
      uei: entity.uei,
      business_name: entity.legal_name || businessName,
      account_type: 'agency_client',
      expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      revoked: false,
      created_at: now,
    }]),
  });
  if (!sessionInsert.ok) throw new Error('Could not open a dashboard session for this business.');

  return { email, sessionToken };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return reply(405, { error: 'POST only' });
  if (!SUPABASE_URL || !SERVICE_KEY) return reply(500, { error: 'RFCP access storage is not configured.' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return reply(400, { error: 'Invalid request.' }); }

  const advisorName = clean(body.name, 220);
  const agencyName = clean(body.agency_name, 220);
  const businessName = clean(body.business_name, 240);
  const promoCode = canonicalCode(body.promo_code);
  const selectedUei = clean(body.uei, 32);
  const businessWebsite = normalizeWebsite(body.website);

  if (!advisorName || !agencyName || !businessName || !promoCode) {
    return reply(400, { error: 'Advisor name, agency name, business name, and promo code are required.' });
  }
  if (!businessWebsite) {
    return reply(400, { error: 'Enter a valid business website URL.' });
  }
  if (promoCode !== PROMO_CODE) {
    return reply(403, { error: 'Promo code not recognized.' });
  }

  try {
    let uei = selectedUei;
    if (!uei) {
      const candidates = await searchByName(businessName);
      if (!candidates.length) {
        await logAttempt({ advisorName, agencyName, businessName, businessWebsite, uei: null, matched: 'none' });
        return reply(200, {
          ok: true,
          matched: 'none',
          message: `Federal Contract Portal could not find "${businessName}" as an active registered federal contractor. Only registered federal contractors have a dashboard here today -- double-check the legal business name, or have them complete federal registration first.`,
        });
      }
      if (candidates.length > 1) {
        await logAttempt({ advisorName, agencyName, businessName, businessWebsite, uei: null, matched: 'multiple' });
        return reply(200, { ok: true, matched: 'multiple', candidates });
      }
      uei = candidates[0].uei;
    }

    const entity = await fetchEntityRecord(uei);
    if (!entity) {
      await logAttempt({ advisorName, agencyName, businessName, businessWebsite, uei, matched: 'entity_not_found' });
      return reply(404, { error: 'That registration could not be retrieved. Try again.' });
    }

    const { email, sessionToken } = await landClientOnDashboard({ businessName, businessWebsite, entity });
    await logAttempt({ advisorName, agencyName, businessName: entity.legal_name || businessName, businessWebsite, uei: entity.uei, matched: 'single' });

    if (RESEND_KEY) {
      const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;background:#0A1A3A;padding:28px;color:#f0f6ff">
        <div style="max-width:620px;margin:auto;background:#0f2244;border:1px solid rgba(91,211,255,.25);border-radius:14px;padding:26px">
          <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#5BD3FF;font-weight:700;margin-bottom:8px">RFCP Agency Access Intake</div>
          <h2 style="margin:0 0 20px">New AGENCY30 client lookup</h2>
          <table style="width:100%;border-collapse:collapse;color:#dcecff">
            <tr><td style="padding:8px 0;color:#8facd0;width:170px">Advisor Name</td><td>${esc(advisorName)}</td></tr>
            <tr><td style="padding:8px 0;color:#8facd0">Agency Name</td><td>${esc(agencyName)}</td></tr>
            <tr><td style="padding:8px 0;color:#8facd0">Client Business</td><td>${esc(entity.legal_name || businessName)}</td></tr>
            <tr><td style="padding:8px 0;color:#8facd0">Business Website</td><td>${esc(businessWebsite)}</td></tr>
            <tr><td style="padding:8px 0;color:#8facd0">UEI</td><td>${esc(entity.uei)}</td></tr>
            <tr><td style="padding:8px 0;color:#8facd0">Activated</td><td>${esc(new Date().toISOString())}</td></tr>
          </table>
        </div>
      </div>`;
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM_EMAIL, to: [TO_EMAIL], subject: `RFCP Agency Access — ${agencyName} / ${entity.legal_name || businessName}`, html }),
      }).catch(err => console.error('[agency-access-intake] notification error', err));
    }

    return reply(200, {
      ok: true,
      matched: 'single',
      message: `Access activated. Opening ${entity.legal_name || businessName}'s dashboard…`,
      redirect: '/apropos',
      email,
      session_token: sessionToken,
    });
  } catch (err) {
    console.error('[agency-access-intake] error', err);
    return reply(500, { error: err.message || 'Could not complete this request.' });
  }
};
