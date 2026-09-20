'use strict';
// POST { email, code } → verifies OTP, creates server-side session, returns session data.

const crypto = require('crypto');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ANON_KEY     = process.env.SUPABASE_ANON_KEY || SERVICE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const email = (body.email || '').trim().toLowerCase();
  const code  = (body.code  || '').trim();

  if (!email || !code) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email and code required.' }) };

  // Look up the OTP
  const otpRes = await fetch(
    `${SUPABASE_URL}/rest/v1/pipeline_otp?email=eq.${encodeURIComponent(email)}&code=eq.${encodeURIComponent(code)}&used=eq.false&order=created_at.desc&limit=1`,
    { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } }
  );
  const rows = await otpRes.json();

  if (!Array.isArray(rows) || !rows.length) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Incorrect code. Please try again.' }) };
  }

  const row = rows[0];
  if (new Date(row.expires_at) < new Date()) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Code expired. Request a new one.' }) };
  }

  // Mark OTP used
  await fetch(`${SUPABASE_URL}/rest/v1/pipeline_otp?id=eq.${row.id}`, {
    method: 'PATCH',
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ used: true }),
  });

  const lookupKey = SERVICE_KEY || ANON_KEY;

  // Bridge Stripe entitlement -> RFCP profile record on first verified login.
  // This lets the Claim Your Vendor Name funnel use the existing first-run
  // entity claim/profile workflow without creating a parallel account system.
  let entitlement = null;
  try {
    const entRes = await fetch(
      `${SUPABASE_URL}/rest/v1/product_entitlements?customer_email=eq.${encodeURIComponent(email)}&product_code=eq.ngcc&status=in.(trialing,active)&select=*&order=updated_at.desc&limit=1`,
      { headers: { apikey: lookupKey, Authorization: `Bearer ${lookupKey}` } }
    );
    const ents = await entRes.json();
    entitlement = Array.isArray(ents) && ents[0] ? ents[0] : null;
  } catch(e) { /* non-fatal */ }

  let profileRow = null;
  try {
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/capgen_subscriptions?email=eq.${encodeURIComponent(email)}&select=*&limit=1`,
      { headers: { apikey: lookupKey, Authorization: `Bearer ${lookupKey}` } }
    );
    const profiles = await profileRes.json();
    profileRow = Array.isArray(profiles) && profiles[0] ? profiles[0] : null;
  } catch(e) { /* non-fatal */ }

  if (!profileRow && entitlement) {
    const nameParts = String(entitlement.customer_name || '').trim().split(/\s+/).filter(Boolean);
    const bootstrap = {
      email,
      first_name: nameParts[0] || null,
      last_name: nameParts.length > 1 ? nameParts.slice(1).join(' ') : null,
      business_name: entitlement.business_name || null,
      plan_type: 'rfcp_trial',
      status: 'active',
      stripe_customer_id: entitlement.stripe_customer_id || null,
      stripe_subscription_id: entitlement.stripe_subscription_id || null,
      trial_ends_at: entitlement.trial_end || null,
      trial_end: entitlement.trial_end || null,
      current_period_start: entitlement.current_period_start || null,
      current_period_end: entitlement.current_period_end || null,
      onboarding_state: 'entity_pending',
      payment_type: 'stripe',
      updated_at: new Date().toISOString()
    };
    try {
      const createRes = await fetch(`${SUPABASE_URL}/rest/v1/capgen_subscriptions`, {
        method:'POST',
        headers:{ apikey:lookupKey, Authorization:`Bearer ${lookupKey}`, 'Content-Type':'application/json', Prefer:'return=representation' },
        body:JSON.stringify(bootstrap)
      });
      const created = await createRes.json();
      if (createRes.ok && Array.isArray(created) && created[0]) profileRow = created[0];
    } catch(e) { console.error('[verify] profile bootstrap failed:', e.message); }
  }

  // Resolve current RFCP access/profile state.
  let isSubscriber = Boolean(profileRow || entitlement);
  let viewToken    = profileRow?.demo_token || null;
  let accountType  = entitlement ? 'rfcp_claim' : 'subscriber';
  let onboardingState = profileRow?.onboarding_state || (entitlement ? 'entity_pending' : 'complete');

  // Look up snapshot for view_token + business identity
  let uei = profileRow?.uei || '', bizName = profileRow?.business_name || entitlement?.business_name || '';
  try {
    const snapRes = await fetch(
      `${SUPABASE_URL}/rest/v1/demo_snapshots?requester_email=eq.${encodeURIComponent(email)}&order=created_at.desc&limit=1&select=view_token,business_name,entity_uei,profile`,
      { headers: { apikey: lookupKey, Authorization: `Bearer ${lookupKey}` } }
    );
    const snaps = await snapRes.json();
    if (Array.isArray(snaps) && snaps[0]) {
      const snap = snaps[0];
      if (!viewToken && snap.view_token) viewToken = snap.view_token;
      bizName = snap.business_name || (snap.profile && snap.profile.legal_name) || '';
      uei     = snap.entity_uei   || (snap.profile && snap.profile.uei)        || '';
    }
  } catch(e) { /* non-fatal */ }

  // Create server-side session in client_sessions (7-day expiry)
  const sessionToken = crypto.randomUUID();
  const expiresAt    = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    await fetch(`${SUPABASE_URL}/rest/v1/client_sessions`, {
      method: 'POST',
      headers: { apikey: lookupKey, Authorization: `Bearer ${lookupKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        session_token: sessionToken,
        email,
        uei,
        business_name: bizName,
        account_type:  accountType,
        expires_at:    expiresAt,
      }),
    });
  } catch(e) { console.error('[verify] session insert failed:', e.message); }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      ok:               true,
      session_token:    sessionToken,
      email,
      uei,
      business_name:    bizName,
      onboarding_state: onboardingState,
      account_type:     accountType,
      view_token:       viewToken,
      is_subscriber:    isSubscriber,
    }),
  };
};
