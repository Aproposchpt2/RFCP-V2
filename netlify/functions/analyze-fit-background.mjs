// analyze-fit-background.mjs — Phase 2 (Netlify background function)
// Invoked by analyze-fit.mjs. Runs Stage 1 → stage1_complete, then Stage 2 → complete.
// OpenAI is primary; Anthropic is retained as an optional provider fallback.

const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_KEY    = process.env.OPENAI_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

const OPENAI_STAGE1_MODEL = process.env.OPENAI_ANALYZE_STAGE1_MODEL || 'gpt-5.4-mini';
const OPENAI_STAGE2_MODEL = process.env.OPENAI_ANALYZE_STAGE2_MODEL || 'gpt-5.4';
const ANTHROPIC_MODEL     = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
const ANTHROPIC_STAGE1    = process.env.ANALYZE_STAGE1_MODEL || 'claude-haiku-4-5';
const ANTHROPIC_STAGE2    = process.env.ANALYZE_STAGE2_MODEL || 'claude-sonnet-4-6';

// ── Supabase helpers ─────────────────────────────────────────────────────────

function sbH(extra = {}) {
  return { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', ...extra };
}

async function sbGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbH() });
  if (!res.ok) throw new Error(`Supabase GET: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function sbPatch(filter, update) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/opportunity_analyses?${filter}`, {
    method: 'PATCH',
    headers: sbH({ Prefer: 'return=minimal' }),
    body: JSON.stringify(update),
  });
  if (!res.ok) console.error('[bg] Supabase PATCH failed:', await res.text());
}

// ── AI provider layer ────────────────────────────────────────────────────────

function parseJsonText(text, usage = {}) {
  const clean = String(text || '').trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  try {
    return { parsed: JSON.parse(clean), usage };
  } catch {
    throw { retryable: true, raw: text, usage };
  }
}

function openAIOutputText(data) {
  if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  for (const item of data.output || []) {
    if (item?.type !== 'message') continue;
    for (const part of item.content || []) {
      if (part?.type === 'output_text' && typeof part.text === 'string') return part.text.trim();
    }
  }
  return '';
}

async function callOpenAI(system, user, maxTokens, model) {
  if (!OPENAI_KEY) throw new Error('OPENAI_API_KEY is not configured');
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    signal: AbortSignal.timeout(150000),
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model,
      instructions: system,
      input: user,
      max_output_tokens: maxTokens,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const usage = {
    input_tokens: data.usage?.input_tokens || 0,
    output_tokens: data.usage?.output_tokens || 0,
  };
  return parseJsonText(openAIOutputText(data), usage);
}

async function callAnthropic(system, user, maxTokens, model) {
  if (!ANTHROPIC_KEY) throw new Error('ANTHROPIC_API_KEY is not configured');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal: AbortSignal.timeout(150000),
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: model || ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return parseJsonText((data.content?.[0]?.text || '').trim(), data.usage || {});
}

async function callWithJsonRetry(call, system, user, maxTokens, model) {
  try {
    return await call(system, user, maxTokens, model);
  } catch (e) {
    if (e && e.retryable) {
      return await call(system, `${user}\n\nReturn ONLY valid JSON. No prose, no fences.`, maxTokens, model);
    }
    throw e;
  }
}

async function callAI(system, user, maxTokens, stage) {
  const openAIModel = stage === 1 ? OPENAI_STAGE1_MODEL : OPENAI_STAGE2_MODEL;
  const anthropicModel = stage === 1 ? ANTHROPIC_STAGE1 : ANTHROPIC_STAGE2;
  let openAIError;

  if (OPENAI_KEY) {
    try {
      console.log(`[bg] AI provider=OpenAI stage=${stage} model=${openAIModel}`);
      const result = await callWithJsonRetry(callOpenAI, system, user, maxTokens, openAIModel);
      return { ...result, provider: 'openai', model: openAIModel };
    } catch (err) {
      openAIError = err;
      console.error(`[bg] OpenAI stage ${stage} failed; trying Anthropic fallback:`, err?.message || err);
    }
  }

  if (ANTHROPIC_KEY) {
    try {
      console.log(`[bg] AI provider=Anthropic fallback stage=${stage} model=${anthropicModel}`);
      const result = await callWithJsonRetry(callAnthropic, system, user, maxTokens, anthropicModel);
      return { ...result, provider: 'anthropic', model: anthropicModel };
    } catch (anthropicError) {
      if (openAIError) {
        throw new Error(`All AI providers failed. OpenAI: ${openAIError?.message || openAIError}; Anthropic: ${anthropicError?.message || anthropicError}`);
      }
      throw anthropicError;
    }
  }

  if (openAIError) throw openAIError;
  throw new Error('No AI provider configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY.');
}

// ── Prompts ──────────────────────────────────────────────────────────────────

const STAGE1_SYSTEM = `You are RFCP's federal contract fit analyst. You assess whether a specific
small business contractor should pursue a specific federal opportunity.
Be direct and honest — a wrong BID recommendation costs the contractor weeks
of wasted proposal effort. NO_BID is a valid and often correct answer.

CRITICAL RULE — TRIBAL AND NATIVE SET-ASIDES:
For any set-aside requiring tribal ownership, Native American ownership, or
Native control (ISBEE, IEE, Buy Indian Act, tribal 8(a), etc.): if the
contractor does not already hold that status, your set_aside_detail MUST state
that this designation requires genuine Native American ownership and control —
it cannot be obtained or established for the purpose of pursuing a specific
opportunity. Do NOT suggest the contractor explore or verify obtaining it.

Respond with ONLY a single valid JSON object. No markdown, no code fences,
no commentary before or after the JSON.`;

const STAGE2_SYSTEM = `You are RFCP's federal contract pursuit strategist. The contractor has decided to
evaluate this opportunity seriously. Produce a concrete, actionable pursuit
package. Be specific to THIS opportunity and THIS contractor — no generic
boilerplate.

CRITICAL RULE — TRIBAL AND NATIVE SET-ASIDES:
If the opportunity has a tribal, Native American, or Indian-specific set-aside
(ISBEE, IEE, Buy Indian Act, tribal 8(a), etc.) and the contractor does NOT
already hold that status: do NOT include any item in staffing_delivery,
documents_needed, proposal_checklist, or questions_for_co suggesting the
contractor establish, verify, or pursue obtaining that designation. It requires
genuine Native American ownership and control and cannot be acquired to
qualify for a specific bid. Any mention of this set-aside should note only
that the contractor is ineligible and should not respond.

Respond with ONLY a single valid JSON object. No markdown, no code fences,
no commentary.`;

function buildProfileBlock(p) {
  return `CONTRACTOR PROFILE:
Company: ${p.business_name || 'Unknown'}
UEI: ${p.uei || 'N/A'} | CAGE: ${p.cage || 'N/A'}
NAICS codes: ${(p.naics || []).join(', ') || 'None listed'}
Set-aside statuses: ${(p.set_asides || []).join(', ') || 'None listed'}
Certifications: ${JSON.stringify(p.certifications || [])}
Team size: ${p.team_size || 'Not specified'}
Capabilities: ${p.capabilities || 'Not specified'}
Past performance: ${p.past_performance || 'Not specified'}
Keywords: ${(p.keywords || []).join(', ') || 'None'}`;
}

function buildOppBlock(o) {
  const raw  = o.raw || {};
  const desc = (raw.description || raw.fullParentPathName || '').toString().slice(0, 6000);
  const pop  = raw.placeOfPerformance?.city?.name
    ? `${raw.placeOfPerformance.city.name}, ${raw.placeOfPerformance.state?.code || ''}`
    : 'Not specified';
  return `OPPORTUNITY:
Title: ${o.title || 'Unknown'}
Agency: ${o.agency || 'Unknown'}
Notice ID: ${o.notice_id}
NAICS: ${o.naics_code || 'Not specified'}
Set-aside: ${o.set_aside || 'Unrestricted'}
Response deadline: ${o.response_deadline || 'Not specified'}
Place of performance: ${pop}
Description: ${desc || 'Not provided'}`;
}

const STAGE1_SCHEMA = `Return JSON matching exactly this schema:
{
  "opportunity_summary": "3-4 sentence plain-English summary of what the government is buying",
  "match": {
    "naics_match": true,
    "naics_detail": "1-2 sentences",
    "set_aside_eligible": true,
    "set_aside_detail": "1-2 sentences",
    "capability_alignment": "HIGH",
    "capability_detail": "2-3 sentences"
  },
  "recommendation": "BID",
  "fit_score": 85,
  "rationale": "3-5 sentences explaining the recommendation",
  "conditions": []
}`;

const STAGE2_SCHEMA = `Return JSON matching exactly this schema:
{
  "required_work": ["bullet list of actual work scope items"],
  "staffing_delivery": ["roles, certifications, clearances, delivery requirements"],
  "documents_needed": ["every document required to respond"],
  "proposal_checklist": [{"item": "...", "owner_hint": "...", "deadline_hint": "..."}],
  "draft_technical_approach": "4-6 paragraphs tailored to the contractor's capabilities",
  "pricing_considerations": ["contract type implications, competitive range, cost drivers"],
  "questions_for_co": ["specific, well-formed questions for the contracting officer"]
}`;

// ── Main handler ─────────────────────────────────────────────────────────────

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, body: '' };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: 'Invalid JSON' }; }

  const { rowId, accountEmail, opportunityId, profileVersion, isBeta = false, deep = false, skipStage1 = false, opportunity: inlineOpp } = body;
  if (!rowId) return { statusCode: 400, body: 'rowId required' };

  console.log(`[bg] Starting analysis rowId=${rowId} skipStage1=${skipStage1} deep=${deep}`);
  const markFilter = `id=eq.${rowId}`;

  try {
    let profile;
    if (isBeta) {
      const testers = await sbGet(`beta_testers?email=eq.${encodeURIComponent(accountEmail)}&limit=1`);
      if (!testers.length) {
        await sbPatch(markFilter, { status: 'failed', stage1: { error: 'Beta profile not found' } });
        return { statusCode: 200, body: 'no beta profile' };
      }
      const t = testers[0];
      profile = {
        business_name: t.company_name || '', uei: '', cage: t.cage_code || '',
        naics: [t.primary_naics, ...(t.additional_naics || [])].filter(Boolean),
        set_asides: [], certifications: [], capabilities: 'IT services, computer systems design',
        past_performance: 'Not specified', team_size: 'Not specified', keywords: [],
      };
    } else {
      const snaps = await sbGet(`demo_snapshots?requester_email=eq.${encodeURIComponent(accountEmail)}&order=created_at.desc&limit=1`);
      if (!snaps.length) {
        await sbPatch(markFilter, { status: 'failed', stage1: { error: 'Profile not found' } });
        return { statusCode: 200, body: 'no profile' };
      }
      const snap = snaps[0];
      const rawProf = snap.profile || {};
      profile = {
        business_name: rawProf.legal_name || snap.business_name || '',
        uei: rawProf.uei || '', cage: rawProf.cage || '',
        naics: (rawProf.naics || []).map(n => n.code || n),
        set_asides: rawProf.set_asides || [], certifications: rawProf.set_asides || [],
        capabilities: rawProf.capabilities || 'IT services, computer programming, systems design',
        past_performance: rawProf.past_performance || 'Not specified',
        team_size: rawProf.team_size || 'Not specified', keywords: rawProf.keywords || [],
      };
    }

    const existingRows = await sbGet(`opportunity_analyses?id=eq.${rowId}&limit=1`);
    const existingRow = existingRows[0] || {};

    let opp;
    const opps = await sbGet(`sam_opportunities?notice_id=eq.${encodeURIComponent(opportunityId)}&limit=1`);
    if (opps.length) {
      opp = opps[0];
    } else if (inlineOpp) {
      opp = {
        notice_id: opportunityId, title: inlineOpp.title || '', agency: inlineOpp.agency || '',
        naics_code: inlineOpp.naics || '', set_aside: inlineOpp.set_aside || '',
        response_deadline: inlineOpp.deadline || '', raw: {},
      };
    } else {
      await sbPatch(markFilter, { status: 'failed', stage1: { error: 'Opportunity not found' } });
      return { statusCode: 200, body: 'opp not found' };
    }

    const profileBlock = buildProfileBlock(profile);
    const oppBlock = buildOppBlock(opp);
    let stage1, recommendation, fitScore, s1Usage = {};

    if (skipStage1 && existingRow.stage1 && existingRow.recommendation !== 'PENDING') {
      stage1 = existingRow.stage1;
      recommendation = existingRow.recommendation;
      fitScore = existingRow.fit_score;
      console.log(`[bg] Skipping Stage 1 — using cached: ${recommendation} ${fitScore}`);
    } else {
      console.log('[bg] Running Stage 1…');
      const stage1User = `${profileBlock}\n\n${oppBlock}\n\n${STAGE1_SCHEMA}`;
      try {
        const r1 = await callAI(STAGE1_SYSTEM, stage1User, 1200, 1);
        stage1 = r1.parsed;
        s1Usage = r1.usage;
        recommendation = stage1.recommendation || 'NO_BID';
        fitScore = stage1.fit_score || 0;
        console.log(`[bg] Stage 1 complete via ${r1.provider}/${r1.model}: ${recommendation} ${fitScore} (${s1Usage.input_tokens || 0}in/${s1Usage.output_tokens || 0}out)`);
      } catch (err) {
        console.error('[bg] Stage 1 failed:', err.message || err);
        await sbPatch(markFilter, { status: 'failed', stage1: { error: String(err.message || err) } });
        return { statusCode: 200, body: 'stage1 failed' };
      }

      await sbPatch(markFilter, {
        stage1: Object.assign({ _title: opp.title || '', _agency: opp.agency || '', _naics: opp.naics_code || '', _set_aside: opp.set_aside || '', _deadline: opp.response_deadline || '' }, stage1),
        recommendation,
        fit_score: fitScore,
        input_tokens: s1Usage.input_tokens || 0,
        output_tokens: s1Usage.output_tokens || 0,
        status: 'stage1_complete',
      });
    }

    const runStage2 = deep || recommendation === 'BID' || recommendation === 'CONDITIONAL';
    if (!runStage2) {
      await sbPatch(markFilter, { status: 'complete' });
      console.log('[bg] Stage 2 skipped (NO_BID, deep=false). Done.');
      return { statusCode: 200, body: 'complete' };
    }

    console.log('[bg] Running Stage 2…');
    const stage2User = `${profileBlock}\n\n${oppBlock}\n\nSTAGE 1 ANALYSIS:\n${JSON.stringify(stage1, null, 2)}\n\n${STAGE2_SCHEMA}`;
    let stage2, s2Usage = {};
    try {
      const r2 = await callAI(STAGE2_SYSTEM, stage2User, 8000, 2);
      stage2 = r2.parsed;
      s2Usage = r2.usage;
      console.log(`[bg] Stage 2 complete via ${r2.provider}/${r2.model} (${s2Usage.input_tokens || 0}in/${s2Usage.output_tokens || 0}out)`);
    } catch (err) {
      console.error('[bg] Stage 2 failed (non-fatal):', err.message || err);
      await sbPatch(markFilter, {
        status: 'complete',
        input_tokens: existingRow.input_tokens || s1Usage.input_tokens || 0,
        output_tokens: existingRow.output_tokens || s1Usage.output_tokens || 0,
      });
      return { statusCode: 200, body: 'complete (stage2 failed)' };
    }

    await sbPatch(markFilter, {
      stage2,
      status: 'complete',
      input_tokens: (s1Usage.input_tokens || 0) + (s2Usage.input_tokens || 0),
      output_tokens: (s1Usage.output_tokens || 0) + (s2Usage.output_tokens || 0),
    });

    console.log(`[bg] All done. rowId=${rowId}`);
    return { statusCode: 200, body: 'complete' };
  } catch (err) {
    console.error('[bg] Fatal error:', err.message || err);
    try {
      await sbPatch(markFilter, { status: 'failed', stage1: { error: String(err.message || err) } });
    } catch { /* ignore secondary failure */ }
    return { statusCode: 200, body: 'failed' };
  }
};
