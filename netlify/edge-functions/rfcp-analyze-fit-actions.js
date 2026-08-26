export default async (request, context) => {
  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  let html = await response.text();

  const proposalCta = `<a href="https://gcpdc.aproposgroupllc.com/develop-proposal.html?opportunity_id=${encodeURIComponent('${noticeId}')}`;

  // Work against the source template literal rather than runtime DOM so the
  // Analyze Fit engine and report data contract remain untouched.
  html = html.replace(
    /<a href="https:\/\/gcpdc\.aproposgroupllc\.com\/develop-proposal\.html\?opportunity_id=\$\{encodeURIComponent\(noticeId\)\}" style="background:linear-gradient\(135deg,#C9A84C,#e8c96a\);color:#0F2A6A;font-family:'Jost',sans-serif;font-weight:800;font-size:\.82rem;padding:11px 24px;border-radius:8px;text-decoration:none;letter-spacing:\.02em">Develop My Proposal →<\/a>/g,
    `<a href="https://sam.gov/opp/\${encodeURIComponent(noticeId)}/view" target="_blank" rel="noopener" style="background:linear-gradient(135deg,#C9A84C,#e8c96a);color:#0F2A6A;font-family:'Jost',sans-serif;font-weight:800;font-size:.82rem;padding:11px 24px;border-radius:8px;text-decoration:none;letter-spacing:.02em">Download Solicitation ↓</a>`
  );

  html = html.replace(
    /\$\{!s2 && \(rec === 'BID' \|\| rec === 'CONDITIONAL'\) \? '' :\s*rec !== 'BID' && rec !== 'CONDITIONAL' \? `<button class="btn-stage2" onclick="requestDeep\(\)">Run Full Analysis →<\/button>` : ''\}/g,
    ''
  );

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
};
