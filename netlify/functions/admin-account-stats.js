// admin-account-stats.js
// Real RFCP account counts and onboarding health, deduped across the three
// tables a client can actually live in (capgen_subscriptions,
// capgen_customers, biz_center_members -- the same three client-pipeline.js
// resolves against). Built 2026-08-27 after UNLV SBDC's agency_30 signup
// (access granted, profile never completed) turned out to be invisible --
// nothing surfaced that gap until it was hand-queried.
'use strict';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://judislfknmhofcgzyozc.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
const ADMIN_KEY = process.env.ONBOARD_ADMIN_KEY || '';

const sbHeaders = () => ({ apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY });

async function fetchAll(table, select) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}`, { headers: sbHeaders() });
  if (!res.ok) throw new Error(table + ' fetch failed: ' + res.status);
  return res.json();
}

function hasNaics(row) {
  return Array.isArray(row.naics) && row.naics.length > 0;
}

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers, body: JSON.stringify({ error: 'GET only' }) };
  const reqKey = event.headers['x-admin-key'] || event.headers['X-Admin-Key'] || '';
  if (ADMIN_KEY && reqKey !== ADMIN_KEY) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid admin key.' }) };
  if (!SUPABASE_URL || !SERVICE_KEY) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Database is not configured.' }) };

  try {
    const [subs, customers, bcMembers] = await Promise.all([
      fetchAll('capgen_subscriptions', 'email,business_name,uei,naics,status,plan_type,onboarding_complete,created_at'),
      fetchAll('capgen_customers', 'email,business_name,uei,naics,status,access_activated,created_at'),
      fetchAll('biz_center_members', 'email,business_name,industry,naics,subscription_status,created_at'),
    ]);

    // One row per email across all three sources -- an account can legitimately
    // exist in more than one (e.g. an agency_30 subscription plus a direct
    // capgen_customers profile); the richest/most-complete row wins for
    // "does this account actually work" purposes.
    const byEmail = new Map();
    function upsert(email, source, businessName, active, complete, uei, naicsCount, createdAt) {
      const key = String(email || '').trim().toLowerCase();
      if (!key) return;
      const existing = byEmail.get(key);
      const candidate = { email: key, source, business_name: businessName, active, complete, uei, naics_count: naicsCount, created_at: createdAt };
      if (!existing || (!existing.complete && complete)) byEmail.set(key, candidate);
    }

    subs.forEach(r => upsert(
      r.email, 'capgen_subscriptions', r.business_name,
      String(r.status || '').toLowerCase() === 'active',
      hasNaics(r) && Boolean(r.uei),
      r.uei, (r.naics || []).length, r.created_at,
    ));
    customers.forEach(r => upsert(
      r.email, 'capgen_customers', r.business_name,
      String(r.status || '').toLowerCase() !== 'cancelled',
      hasNaics(r) && Boolean(r.uei),
      r.uei, (r.naics || []).length, r.created_at,
    ));
    bcMembers.forEach(r => upsert(
      r.email, 'biz_center_members', r.business_name,
      ['active', 'trialing', 'trial'].includes(String(r.subscription_status || '').toLowerCase()),
      hasNaics(r),
      null, (r.naics || []).length, r.created_at,
    ));

    const accounts = Array.from(byEmail.values()).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const active = accounts.filter(a => a.active);
    const incomplete = active.filter(a => !a.complete);

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        ok: true,
        total_accounts: accounts.length,
        active_accounts: active.length,
        complete_profiles: active.length - incomplete.length,
        incomplete_profiles: incomplete.length,
        incomplete: incomplete.map(a => ({
          email: a.email, business_name: a.business_name, source: a.source,
          has_uei: Boolean(a.uei), naics_count: a.naics_count, created_at: a.created_at,
        })),
      }),
    };
  } catch (e) {
    console.error('[admin-account-stats]', e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Could not load account stats.' }) };
  }
};
