'use strict';
// client-pipeline-v2.js
// Non-destructive wrapper around the restored client-pipeline endpoint.
// Preserves the original business/profile lookup and enriches returned SAM.gov
// opportunities with place-of-performance state for dashboard filtering.

const SAM_URL = 'https://api.sam.gov/opportunities/v2/search';
const SAM_API_KEY = process.env.SAM_API_KEY || '';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

function mmddyyyy(d) {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}/${dd}/${d.getFullYear()}`;
}

function extractState(opp) {
  const pop = opp?.placeOfPerformance || opp?.placeofPerformance || {};
  const state = pop?.state;
  if (typeof state === 'string') return { code: state, name: state };
  const code = state?.code || opp?.state || '';
  const name = state?.name || code || '';
  return { code: String(code || '').trim(), name: String(name || '').trim() };
}

async function fetchSamByNaics(naics, postedFrom, postedTo) {
  const url = new URL(SAM_URL);
  url.searchParams.set('api_key', SAM_API_KEY);
  url.searchParams.set('postedFrom', postedFrom);
  url.searchParams.set('postedTo', postedTo);
  url.searchParams.set('ncode', naics);
  url.searchParams.set('limit', '100');
  url.searchParams.set('offset', '0');
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`SAM opportunity enrichment ${res.status} (${naics})`);
  const data = await res.json();
  return Array.isArray(data?.opportunitiesData) ? data.opportunitiesData : [];
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers, body: JSON.stringify({ error: 'GET only' }) };

  const host = event.headers?.host;
  if (!host) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Host unavailable' }) };

  const params = new URLSearchParams(event.queryStringParameters || {});
  // The Ops reference supports a 90-day posted-date filter, so make the full
  // 90-day inventory available to the dashboard and filter client-side.
  params.set('days', '90');

  const authorization = event.headers?.authorization || event.headers?.Authorization || '';
  const baseUrl = `https://${host}/.netlify/functions/client-pipeline?${params.toString()}`;
  const baseRes = await fetch(baseUrl, {
    headers: authorization ? { Authorization: authorization } : {},
  });
  const baseText = await baseRes.text();
  let data;
  try { data = JSON.parse(baseText || '{}'); }
  catch { return { statusCode: baseRes.status, headers, body: baseText }; }

  if (!baseRes.ok || !Array.isArray(data?.opportunities) || !SAM_API_KEY) {
    return { statusCode: baseRes.status, headers, body: JSON.stringify(data) };
  }

  const naics = Array.isArray(data?.client?.naics) ? [...new Set(data.client.naics.map(String).filter(Boolean))] : [];
  if (!naics.length) return { statusCode: 200, headers, body: JSON.stringify(data) };

  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 90);
  const postedFrom = mmddyyyy(from);
  const postedTo = mmddyyyy(now);
  const stateByNotice = new Map();

  await Promise.all(naics.map(async code => {
    try {
      const rows = await fetchSamByNaics(code, postedFrom, postedTo);
      for (const row of rows) {
        if (!row?.noticeId) continue;
        const state = extractState(row);
        if (state.code || state.name) stateByNotice.set(row.noticeId, state);
      }
    } catch (error) {
      console.warn('[client-pipeline-v2]', error.message);
    }
  }));

  data.opportunities = data.opportunities.map(opp => {
    const state = stateByNotice.get(opp.notice_id || opp.noticeId) || { code: '', name: '' };
    return {
      ...opp,
      state: state.code || state.name || '',
      state_name: state.name || state.code || '',
    };
  });
  data.window_days = 90;

  return { statusCode: 200, headers, body: JSON.stringify(data) };
};
