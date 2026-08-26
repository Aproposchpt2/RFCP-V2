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

  const memberLogin = '<a class="nav-cta" href="/onboarding">Member Login →</a>';
  const agencyLogin = `<div class="rfcp-home-nav-actions">
    <button type="button" class="rfcp-home-agency-btn" id="rfcp-home-agency-open">AGENCY LOGIN</button>
    ${memberLogin}
  </div>`;
  html = html.replace(memberLogin, agencyLogin);

  const css = `
<style id="rfcp-agency-homepage-css">
.rfcp-home-nav-actions{display:flex;align-items:center;gap:8px;flex-shrink:0}
.rfcp-home-agency-btn{display:inline-flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#D5AA4D,#E8C982);color:#0F2A6A;border:none;border-radius:4px;padding:.55rem 1.05rem;font-family:var(--body);font-size:.68rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;white-space:nowrap;transition:.2s}
.rfcp-home-agency-btn:hover{filter:brightness(1.08);transform:translateY(-1px)}
#rfcp-agency-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.68);z-index:1200;align-items:center;justify-content:center;padding:20px}
#rfcp-agency-overlay.open{display:flex}
.rfcp-agency-card{width:min(540px,100%);max-height:92vh;overflow:auto;background:#071a38;border:1px solid rgba(213,170,77,.34);border-radius:16px;padding:30px;box-shadow:0 32px 90px rgba(0,0,0,.55);position:relative}
.rfcp-agency-close{position:absolute;top:14px;right:14px;width:34px;height:34px;border-radius:8px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:#fff;cursor:pointer}
.rfcp-agency-eye{font-size:.62rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#D5AA4D;margin-bottom:8px}
.rfcp-agency-title{font-family:var(--disp);font-size:1.8rem;font-weight:400;line-height:1.15;color:#fff;margin:0 42px 8px 0}
.rfcp-agency-sub{font-size:.86rem;color:rgba(255,255,255,.56);line-height:1.65;margin-bottom:20px}
.rfcp-agency-field{margin-bottom:14px}
.rfcp-agency-field label{display:block;font-size:.62rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.46);margin-bottom:6px}
.rfcp-agency-field input{width:100%;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16);border-radius:8px;color:#fff;padding:11px 12px;font-family:var(--body);font-size:.9rem;outline:none}
.rfcp-agency-field input:focus{border-color:#D5AA4D}
.rfcp-agency-submit{width:100%;margin-top:4px;background:linear-gradient(135deg,#D5AA4D,#E8C982);color:#0F2A6A;border:none;border-radius:8px;padding:12px 16px;font-family:var(--body);font-size:.76rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;cursor:pointer}
.rfcp-agency-submit:disabled{opacity:.55;cursor:wait}
#rfcp-agency-msg{min-height:20px;margin-top:11px;font-size:.82rem;text-align:center;color:rgba(255,255,255,.52)}
#rfcp-agency-msg.ok{color:#3EE391}
#rfcp-agency-msg.err{color:#ff8a8a}
@media(max-width:620px){.top-in{gap:10px}.rfcp-home-nav-actions{gap:5px}.rfcp-home-agency-btn,.rfcp-home-nav-actions .nav-cta{padding:.48rem .7rem;font-size:.58rem;letter-spacing:.08em}.logo-sub{display:none}.rfcp-agency-card{padding:26px 20px}}
</style>`;

  const modal = `
<div id="rfcp-agency-overlay" role="dialog" aria-modal="true" aria-labelledby="rfcp-agency-title">
  <div class="rfcp-agency-card">
    <button type="button" class="rfcp-agency-close" id="rfcp-agency-close" aria-label="Close agency login">✕</button>
    <div class="rfcp-agency-eye">RFCP Agency Access</div>
    <h2 class="rfcp-agency-title" id="rfcp-agency-title">Agency Login</h2>
    <p class="rfcp-agency-sub">Enter the agency and business information associated with your access request.</p>
    <form id="rfcp-agency-form" novalidate>
      <div class="rfcp-agency-field"><label for="rfcp-agency-name">Name</label><input id="rfcp-agency-name" type="text" autocomplete="name" required></div>
      <div class="rfcp-agency-field"><label for="rfcp-agency-agency">Agency Name</label><input id="rfcp-agency-agency" type="text" autocomplete="organization" required></div>
      <div class="rfcp-agency-field"><label for="rfcp-agency-business">Business Name</label><input id="rfcp-agency-business" type="text" autocomplete="organization" required></div>
      <div class="rfcp-agency-field"><label for="rfcp-agency-email">Business Email</label><input id="rfcp-agency-email" type="email" autocomplete="email" required></div>
      <div class="rfcp-agency-field"><label for="rfcp-agency-promo">Promo Code</label><input id="rfcp-agency-promo" type="text" value="AGENCY 30" autocomplete="off" required></div>
      <button class="rfcp-agency-submit" type="submit" id="rfcp-agency-submit">Submit Agency Access</button>
      <div id="rfcp-agency-msg" aria-live="polite"></div>
    </form>
  </div>
</div>`;

  const script = `
<script id="rfcp-agency-homepage-script">
(function(){
  'use strict';
  var openBtn=document.getElementById('rfcp-home-agency-open');
  var overlay=document.getElementById('rfcp-agency-overlay');
  var closeBtn=document.getElementById('rfcp-agency-close');
  var form=document.getElementById('rfcp-agency-form');
  function openAgency(){if(overlay)overlay.classList.add('open');}
  function closeAgency(){if(overlay)overlay.classList.remove('open');}
  if(openBtn)openBtn.addEventListener('click',openAgency);
  if(closeBtn)closeBtn.addEventListener('click',closeAgency);
  if(overlay)overlay.addEventListener('click',function(e){if(e.target===overlay)closeAgency();});
  document.addEventListener('keydown',function(e){if(e.key==='Escape')closeAgency();});
  if(!form)return;
  form.addEventListener('submit',function(e){
    e.preventDefault();
    var msg=document.getElementById('rfcp-agency-msg');
    var submit=document.getElementById('rfcp-agency-submit');
    var payload={
      name:document.getElementById('rfcp-agency-name').value.trim(),
      agency_name:document.getElementById('rfcp-agency-agency').value.trim(),
      business_name:document.getElementById('rfcp-agency-business').value.trim(),
      business_email:document.getElementById('rfcp-agency-email').value.trim().toLowerCase(),
      promo_code:document.getElementById('rfcp-agency-promo').value.trim()
    };
    msg.className='';msg.textContent='';
    if(!payload.name||!payload.agency_name||!payload.business_name||!payload.business_email||!payload.promo_code){msg.className='err';msg.textContent='Complete all fields.';return;}
    submit.disabled=true;submit.textContent='Submitting…';
    fetch('/.netlify/functions/agency-access-intake',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
      .then(function(r){return r.json().then(function(j){return {ok:r.ok,j:j};});})
      .then(function(res){if(!res.ok)throw new Error((res.j&&res.j.error)||'Agency access request failed.');msg.className='ok';msg.textContent='Agency access request received.';})
      .catch(function(err){msg.className='err';msg.textContent=err.message;})
      .finally(function(){submit.disabled=false;submit.textContent='Submit Agency Access';});
  });
})();
</script>`;

  html = html.replace('</head>', css + '\n</head>');
  html = html.replace('</body>', modal + script + '\n</body>');

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
};

export const config = {
  path: '/',
};
