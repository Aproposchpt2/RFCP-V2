export default async (request, context) => {
  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  let html = await response.text();
  if (!html.includes('<title>NGCC — Member Access</title>')) {
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }

  const script = `
<script id="rfcp-onboarding-email-prefill-script">
(function(){
  try{
    var email=new URLSearchParams(window.location.search).get('email')||'';
    if(!email)return;
    var input=document.getElementById('email');
    if(input){input.value=email.trim().toLowerCase();input.focus();}
  }catch(e){}
})();
</script>`;

  html = html.replace('</body>', script + '\n</body>');
  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
};

export const config = {
  path: ['/onboarding','/onboarding.html'],
};
