// client-naics-add.js
// Adds one NAICS code to a client's monitored list, persisted so it survives
// future dashboard loads. Mirrors client-pipeline.js's client-identity
// resolution (bc:/cg:/raw UEI) so the same id used to load the dashboard is
// used to save into it.
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

  const id = String(payload.id || '').trim();
  const code = String(payload.naics || '').trim();
  if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing client id.' }) };
  if (!/^\d{6}$/.test(code)) return { statusCode: 400, headers, body: JSON.stringify({ error: 'NAICS code must be exactly 6 digits.' }) };

  let table, matchColumn, matchValue;
  if (id.startsWith('bc:')) { table = 'biz_center_members'; matchColumn = 'email'; matchValue = id.slice(3); }
  else if (id.startsWith('cg:')) { table = 'capgen_customers'; matchColumn = 'email'; matchValue = id.slice(3); }
  else { table = 'capgen_subscriptions'; matchColumn = 'uei'; matchValue = id; }

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
