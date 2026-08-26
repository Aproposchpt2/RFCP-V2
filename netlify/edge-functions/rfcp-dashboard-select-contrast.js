export default async (request, context) => {
  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  let html = await response.text();
  const css = `
<style id="rfcp-dashboard-select-contrast">
/* Keep the closed dashboard controls in the RFCP navy treatment while
   forcing native browser option menus to use readable high contrast. */
#panel-federal select,
#panel-federal .ctrl-select {
  color: #f0f6ff !important;
  background-color: #0f2244 !important;
  color-scheme: dark;
}
#panel-federal select option,
#panel-federal .ctrl-select option,
#rfcp-state option,
#rfcp-type option,
#rfcp-posted-preset option,
#fed-setaside option {
  color: #0A1A3A !important;
  background-color: #ffffff !important;
}
#panel-federal select option:checked,
#panel-federal .ctrl-select option:checked {
  color: #0A1A3A !important;
  background-color: #dbeafe !important;
}
</style>`;

  if (!html.includes('id="rfcp-dashboard-select-contrast"')) {
    html = html.replace('</head>', css + '\n</head>');
  }

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
};
