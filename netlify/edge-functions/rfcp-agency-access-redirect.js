export default async (request, context) => {
  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  let html = await response.text();
  if (!html.includes('<title>National Government Contract Center')) {
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }

  const script = `
<script id="rfcp-agency-access-redirect-script">
(function(){
  if(window.__rfcpAgencyAccessRedirect)return;
  window.__rfcpAgencyAccessRedirect=true;
  var nativeFetch=window.fetch.bind(window);
  window.fetch=function(input,init){
    var url=typeof input==='string'?input:(input&&input.url)||'';
    return nativeFetch(input,init).then(function(response){
      if(url.indexOf('/.netlify/functions/agency-access-intake')!==-1 && response.ok){
        response.clone().json().then(function(data){
          if(data&&data.access_granted&&data.login_url){
            var msg=document.getElementById('rfcp-agency-msg');
            if(msg){msg.className='ok';msg.textContent='Access activated — opening secure login…';}
            setTimeout(function(){window.location.assign(data.login_url);},700);
          }
        }).catch(function(){});
      }
      return response;
    });
  };
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
  path: '/',
};
