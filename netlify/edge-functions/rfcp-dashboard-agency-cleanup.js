export default async (request, context) => {
  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  let html = await response.text();
  if (!html.includes('<title>Opportunity Pipeline — NGCC</title>')) {
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }

  const cleanup = `
<style id="rfcp-dashboard-agency-cleanup-css">
#agency-login-header,#agency-auth-cta,#rfcp-agency-overlay{display:none!important}
</style>
<script id="rfcp-dashboard-agency-cleanup-script">
(function(){
  function removeAgencyUi(){
    ['agency-login-header','agency-auth-cta','rfcp-agency-overlay'].forEach(function(id){
      var el=document.getElementById(id);if(el)el.remove();
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',removeAgencyUi);
  else removeAgencyUi();
  setTimeout(removeAgencyUi,0);
})();
</script>`;

  html = html.replace('</body>', cleanup + '\n</body>');

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
};
