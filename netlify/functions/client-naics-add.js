// client-naics-add.js
// Adds one NAICS code to a client's monitored list, persisted so it survives
// future dashboard loads.
//
// Does NOT infer the table from the id's shape (bc:/cg:/raw UEI) -- tried
// that first and it's wrong: fetchDirectCapGenCustomer() in client-pipeline.js
// returns client.uei as a *raw*, unprefixed UEI whenever the capgen_customers
// row has a real one on file, which is indistinguishable by shape from a row
// actually living in capgen_subscriptions (reached via a plain ?uei= request).
// Confirmed live 2026-08-27: a real account resolved through capgen_customers
// with UEI YVNXN3XBUSD5 -- prefix-based routing sent the write to
// capgen_subscriptions instead, which happened to have an unrelated row with
// the same UEI, so the call "succeeded" while silently updating the wrong
// record. The caller now sends the exact `source` client-pipeline.js already
// resolved (capgen_customers / capgen_subscriptions / biz_center_members),
// and this matches each source the same way client-pipeline.js queried it.
'use strict';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://judislfknmhofcgzyozc.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';

const sbHeaders = (extra) => Object.assign({
  apikey: SUPABASE_KEY,
  Authorization: 'Bearer ' + SUPABASE_KEY,
  'Content-Type': 'application/json',
}, extra || {});
const uniq = arr => [...new Set((arr || []).map(String).map(s => s.trim()).filter(Boolean))];

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
  if (!SUPABASE_URL || !SUPABASE_KEY) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Database is not configured.' }) };

  let payload;
  try { payload = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request.' }) }; }

  const source = String(payload.source || '').trim();
  const email = String(payload.email || '').trim().toLowerCase();
  const uei = String(payload.uei || '').trim();
  const code = String(payload.naics || '').trim();
  if (!/^\d{6}$/.test(code)) return { statusCode: 400, headers, body: JSON.stringify({ error: 'NAICS code must be exactly 6 digits.' }) };

  // Matches each source exactly how client-pipeline.js itself queries it:
  // capgen_customers and biz_center_members by email, capgen_subscriptions by uei.
  let table, matchColumn, matchValue;
  if (source === 'capgen_customers') { table = 'capgen_customers'; matchColumn = 'email'; matchValue = email; }
  else if (source === 'bc_member' || source === 'biz_center_members') { table = 'biz_center_members'; matchColumn = 'email'; matchValue = email; }
  else if (source === 'capgen_subscriptions' || source === 'capgen_subscriber') { table = 'capgen_subscriptions'; matchColumn = 'uei'; matchValue = uei; }
  else return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unrecognized client source.' }) };
  if (!matchValue) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing client identifier for that source.' }) };

  try {
    const getRes = await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?${matchColumn}=eq.${encodeURIComponent(matchValue)}&select=naics&limit=1`,
      { headers: sbHeaders() },
    );
    if (!getRes.ok) throw new Error('lookup failed: ' + getRes.status);
    const rows = await getRes.json();
    if (!Array.isArray(rows) || !rows.length) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Client profile not found.' }) };

    const current = uniq(rows[0].naics);
    if (current.includes(code)) return { statusCode: 200, headers, body: JSON.stringify({ ok: true, naics: current, added: false }) };
    const updated = uniq([...current, code]);

    const patchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?${matchColumn}=eq.${encodeURIComponent(matchValue)}`,
      { method: 'PATCH', headers: sbHeaders({ Prefer: 'return=minimal' }), body: JSON.stringify({ naics: updated }) },
    );
    if (!patchRes.ok) throw new Error('update failed: ' + patchRes.status);

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, naics: updated, added: true }) };
  } catch (e) {
    console.error('[client-naics-add]', e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Could not save that NAICS code. Please try again.' }) };
  }
};
