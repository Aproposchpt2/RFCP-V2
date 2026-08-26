export default async (request, context) => {
  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  let html = await response.text();

  // Public-facing brand cleanup only. Keep legacy internal identifiers,
  // storage keys, function names, and routes untouched for compatibility.
  const replacements = [
    ['<title>NGCC — Member Access</title>', '<title>Federal Contract Portal — Member Access</title>'],
    ['<title>Welcome — NGCC Member Hub</title>', '<title>Welcome — Federal Contract Portal</title>'],
    ['<title>Opportunity Pipeline — NGCC</title>', '<title>Opportunity Pipeline — Federal Contract Portal</title>'],
    ['<div class="brand">NGCC</div>', '<div class="brand">Federal Contract Portal</div>'],
    ['<div class="eyebrow">National Government Contract Center</div>', '<div class="eyebrow">Federal Contract Portal</div>'],
    ['<div class="auth-brand">NGCC</div>', '<div class="auth-brand">Federal Contract Portal</div>'],
    ['<div class="auth-eye">National Government Contract Center</div>', '<div class="auth-eye">Apropos Group LLC</div>'],
    ['<div class="brand-sub">Federal Contract Pipeline · NGCC</div>', '<div class="brand-sub">Federal Contract Portal · Opportunity Pipeline</div>']
  ];

  for (const [from, to] of replacements) html = html.split(from).join(to);

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
};
