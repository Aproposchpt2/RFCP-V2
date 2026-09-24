export default async (request, context) => {
  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  let html = await response.text();

  // This function is scoped to the homepage by its config below. Do not gate
  // execution on the legacy page title: another homepage Edge Function may
  // update SEO metadata before this function receives the response.

  // Remove legacy NGCC identity/navigation from the homepage navbar only.
  // Safe no-op once index.html's own header markup no longer matches these
  // strings (the source now carries the real Federal Contract Portal brand).
  const legacyLogo = `<a class="logo" href="/">
      <div class="logo-mark">NG</div>
      <div>
        <div class="logo-name">NGCC</div>
        <div class="logo-sub">National Government Contract Center</div>
      </div>
    </a>`;
  const legacyNav = `<nav class="nav-links">
      <a href="/apropos">My Dashboard</a>
      <a href="/demo">Demo</a>
      <a href="#paths">Get Started</a>
    </nav>`;
  html = html.replace(legacyLogo, '');
  html = html.replace(legacyNav, '');

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
};

export const config = {
  path: '/',
};
