export default async (request, context) => {
  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  let html = await response.text();

  // This function is scoped to the homepage by its config below. Do not gate
  // execution on the legacy page title: another homepage Edge Function may
  // update SEO metadata before this function receives the response.

  // Remove legacy NGCC identity/navigation from the homepage navbar only.
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

  const memberLogin = '<a class="nav-cta" href="/onboarding">Member Login →</a>';
  const agencyLogin = `<div class="rfcp-home-nav-actions">
    <button type="button" class="rfcp-home-agency-btn" id="rfcp-home-agency-open">AGENCY LOGIN</button>
    ${memberLogin}
  </div>`;
  if (!html.includes('id="rfcp-home-agency-open"')) html = html.replace(memberLogin, agencyLogin);

  // Homepage mission messaging.
  html = html.replace(
    '<title>National Government Contract Center — Federal · Nevada · California</title>',
    '<title>Federal Contract Portal — Apropos Group LLC</title>'
  );
  html = html.replace(
    '<meta name="description" content="Your command center for government contract intelligence. Personalized opportunity dashboards for registered federal contractors and state contract seekers. Powered by AG ENGINEERING OS™.">',
    '<meta name="description" content="Apropos Group LLC Federal Contract Portal — supporting economic growth by helping businesses participate more effectively in the government marketplace.">'
  );

  const oldHero = `<div class="hero-content">
      <div class="hero-eye">
        <div class="eye-line"></div>
        <span class="eye-text">Apropos Group LLC · Government Contract Intelligence</span>
      </div>
      <h1 class="hero-h1">
        National Government<br>Contract Center
        <em>Federal. Nevada. California.</em>
      </h1>
      <div class="hero-sub">Your command center for government contract intelligence.</div>
      <p class="hero-copy">
        Every open government contract opportunity — matched to your business, scored for fit, delivered in a personalized dashboard. Pursue only the contracts your business can actually win.
      </p>
      <div class="hero-ctas">
        <a href="/onboarding" class="hero-cta-pill hero-cta-primary">
          <span class="hcp-dot"></span>
          Registered Federal Government Contractors
          <span class="hcp-arrow">→</span>
        </a>
        <a href="#state-options" class="hero-cta-pill hero-cta-secondary" id="stateHeroCta">
          <span class="hcp-dot hcp-dot-state"></span>
          All State Licensed Businesses
          <span class="hcp-arrow">→</span>
        </a>
      </div>
    </div>`;

  const newHero = `<div class="hero-content rfcp-mission-hero">
      <div class="hero-eye">
        <div class="eye-line"></div>
        <span class="eye-text">APROPOS GROUP LLC</span>
      </div>
      <h1 class="hero-h1">Federal Contract Portal</h1>
      <div class="hero-sub rfcp-mission-tagline">Opportunity Builds Business. Business Builds Community.</div>
      <div class="rfcp-mission-copy">
        <p>Apropos Group LLC is committed to supporting economic growth by helping businesses participate more effectively in the government marketplace.</p>
        <p>When government contracts are fulfilled by qualified businesses, those businesses have an opportunity to grow, strengthen their capabilities, create jobs, and contribute to the economic vitality of the communities they serve.</p>
        <p>When people gain access to meaningful employment, greater financial stability, and new opportunities for advancement, families become stronger and communities become more resilient.</p>
        <p class="rfcp-mission-close">Businesses grow. People prosper. Communities become stronger.</p>
      </div>
      <div class="rfcp-hero-start">
        <div class="rfcp-hero-start-label">GET STARTED</div>
        <a href="/onboarding" class="rfcp-trial-pill">FREE 14 DAY TRIAL <span aria-hidden="true">→</span></a>
      </div>
    </div>`;

  html = html.replace(oldHero, newHero);

  const css = `
<style id="rfcp-agency-homepage-css">
.top-in{justify-content:flex-end}
.rfcp-home-nav-actions{display:flex;align-items:center;gap:8px;flex-shrink:0}
.rfcp-home-agency-btn{display:inline-flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#D5AA4D,#E8C982);color:#0F2A6A;border:none;border-radius:4px;padding:.55rem 1.05rem;font-family:var(--body);font-size:.68rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;white-space:nowrap;transition:.2s}
.rfcp-home-agency-btn:hover{filter:brightness(1.08);transform:translateY(-1px)}
.rfcp-mission-hero{max-width:760px}
.rfcp-mission-hero .hero-h1{max-width:760px;margin-bottom:.7rem}
.rfcp-mission-tagline{color:rgba(232,201,130,.92);font-style:normal;font-weight:500;letter-spacing:.015em;margin-bottom:1.3rem}
.rfcp-mission-copy{max-width:690px;color:rgba(255,255,255,.72);font-size:clamp(.9rem,1.1vw,1rem);line-height:1.68}
.rfcp-mission-copy p{margin:0 0 .85rem}
.rfcp-mission-copy .rfcp-mission-close{font-family:var(--sub);font-size:clamp(1.15rem,1.8vw,1.45rem);font-style:italic;color:#fff;margin-top:1.2rem;margin-bottom:0}
.rfcp-hero-start{margin-top:1.65rem;display:flex;flex-direction:column;align-items:flex-start;gap:.55rem}
.rfcp-hero-start-label{font-size:.6rem;letter-spacing:.22em;text-transform:uppercase;color:rgba(232,201,130,.78);font-weight:700}
.rfcp-trial-pill{display:inline-flex;align-items:center;justify-content:center;gap:.75rem;padding:.82rem 1.55rem;border-radius:999px;background:var(--white);color:var(--ink);font-family:var(--body);font-size:.76rem;font-weight:800;letter-spacing:.13em;text-transform:uppercase;text-decoration:none;box-shadow:0 10px 30px rgba(0,0,0,.25);transition:transform .2s,box-shadow .2s,background .2s}
.rfcp-trial-pill:hover{transform:translateY(-2px);background:var(--mist);box-shadow:0 14px 34px rgba(0,0,0,.32)}
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
.rfcp-agency-url{display:flex;align-items:stretch;border:1px solid rgba(255,255,255,.16);border-radius:8px;background:rgba(255,255,255,.06);overflow:hidden}
.rfcp-agency-url:focus-within{border-color:#D5AA4D}
.rfcp-agency-url span{display:flex;align-items:center;padding:0 0 0 12px;color:rgba(255,255,255,.5);font-size:.9rem;white-space:nowrap}
.rfcp-agency-url input{min-width:0;border:0;border-radius:0;background:transparent;padding:11px 12px 11px 4px}
.rfcp-agency-url input:focus{border:0;box-shadow:none}
.rfcp-agency-submit{width:100%;margin-top:4px;background:linear-gradient(135deg,#D5AA4D,#E8C982);color:#0F2A6A;border:none;border-radius:8px;padding:12px 16px;font-family:var(--body);font-size:.76rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;cursor:pointer}
.rfcp-agency-submit:disabled{opacity:.55;cursor:wait}
.rfcp-agency-separator{margin:18px 0 14px;padding-top:16px;border-top:1px solid rgba(255,255,255,.14);font-size:.62rem;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#D5AA4D;text-align:center}
#rfcp-agency-msg{min-height:20px;margin-top:11px;font-size:.82rem;text-align:center;color:rgba(255,255,255,.52)}
#rfcp-agency-msg.ok{color:#3EE391}
#rfcp-agency-msg.err{color:#ff8a8a}
#rfcp-agency-picker{display:none;margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,.14)}
#rfcp-agency-picker.on{display:block}
.rfcp-agency-candidate{display:flex;justify-content:space-between;align-items:center;gap:12px;width:100%;text-align:left;border:1px solid rgba(255,255,255,.16);border-radius:8px;background:rgba(255,255,255,.06);color:#fff;padding:.75rem .95rem;cursor:pointer;margin-bottom:8px;font-family:var(--body)}
.rfcp-agency-candidate:hover{border-color:#D5AA4D}
.rfcp-agency-candidate b{font-weight:700;font-size:.86rem}
.rfcp-agency-candidate span{color:rgba(255,255,255,.5);font-size:.74rem;white-space:nowrap}
@media(max-width:620px){.top-in{gap:10px}.rfcp-home-nav-actions{gap:5px}.rfcp-home-agency-btn,.rfcp-home-nav-actions .nav-cta{padding:.48rem .7rem;font-size:.58rem;letter-spacing:.08em}.rfcp-agency-card{padding:26px 20px}.rfcp-mission-copy{font-size:.9rem;line-height:1.6}.rfcp-mission-copy p{margin-bottom:.7rem}.rfcp-mission-tagline{font-size:1.05rem}.rfcp-trial-pill{font-size:.68rem;padding:.75rem 1.25rem}}
</style>`;

  const modal = `
<div id="rfcp-agency-overlay" role="dialog" aria-modal="true" aria-labelledby="rfcp-agency-title">
  <div class="rfcp-agency-card">
    <button type="button" class="rfcp-agency-close" id="rfcp-agency-close" aria-label="Close agency login">✕</button>
    <div class="rfcp-agency-eye">RFCP Agency Access</div>
    <h2 class="rfcp-agency-title" id="rfcp-agency-title">Agency Login</h2>
    <p class="rfcp-agency-sub">Enter the agency and business information associated with your access request.</p>
    <form id="rfcp-agency-form" novalidate>
      <div class="rfcp-agency-field"><label for="rfcp-agency-name">Advisor Name</label><input id="rfcp-agency-name" type="text" autocomplete="name" required></div>
      <div class="rfcp-agency-field"><label for="rfcp-agency-agency">Agency Name</label><input id="rfcp-agency-agency" type="text" autocomplete="organization" required></div>
      <div class="rfcp-agency-field"><label for="rfcp-agency-promo">Promo Code</label><input id="rfcp-agency-promo" type="text" autocomplete="off" placeholder="Enter your promo code" required></div>
      <div class="rfcp-agency-separator">Clients Business Info</div>
      <div class="rfcp-agency-field"><label for="rfcp-agency-business">Client's Business Name</label><input id="rfcp-agency-business" type="text" autocomplete="organization" required></div>
      <div class="rfcp-agency-field"><label for="rfcp-agency-website">Business Website URL</label><div class="rfcp-agency-url"><span>https://</span><input id="rfcp-agency-website" type="text" inputmode="url" autocomplete="url" autocapitalize="none" spellcheck="false" placeholder="www.acme.com" required></div></div>
      <button class="rfcp-agency-submit" type="submit" id="rfcp-agency-submit">Submit Agency Access</button>
      <div id="rfcp-agency-msg" aria-live="polite"></div>
      <div id="rfcp-agency-picker"></div>
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
  // The dashboard's own "AGENCY LOGIN" buttons redirect here with ?agency=1
  // instead of keeping a second copy of this modal in sync forever (see
  // rfcp-dashboard-enhancements.js) -- auto-open so the click-through still
  // feels seamless.
  try{if(new URLSearchParams(location.search).get('agency')==='1')openAgency();}catch(e){}
  if(!form)return;
  var msg=document.getElementById('rfcp-agency-msg');
  var submit=document.getElementById('rfcp-agency-submit');
  var picker=document.getElementById('rfcp-agency-picker');

  // Fresh session every time -- an agency lookup never inherits a previous
  // client's dashboard state on a shared browser. Cleared the moment the
  // modal is opened, before any submission, not just before a new success.
  function clearPriorSession(){
    try{
      localStorage.removeItem('capgen_email');
      localStorage.removeItem('capgen_session');
      localStorage.removeItem('pipeline_session');
      sessionStorage.removeItem('pipeline_session');
    }catch(e){}
  }
  if(openBtn)openBtn.addEventListener('click',clearPriorSession);

  function landOnDashboard(email,sessionToken){
    clearPriorSession();
    try{
      localStorage.setItem('capgen_email',email);
      sessionStorage.setItem('pipeline_session',sessionToken);
    }catch(e){}
    window.location.assign('/apropos');
  }

  function renderPicker(candidates,basePayload){
    picker.classList.add('on');
    picker.innerHTML=candidates.map(function(c,i){
      return '<button type="button" class="rfcp-agency-candidate" data-i="'+i+'"><b>'+(c.legal_name||'Unknown business')+'</b><span>'+[c.city,c.state].filter(Boolean).join(', ')+'</span></button>';
    }).join('')+'<p style="color:rgba(255,255,255,.5);font-size:.76rem;text-align:center;margin:6px 0 0">Federal Contract Portal found more than one active registration under that name. Which one is this?</p>';
    Array.prototype.forEach.call(picker.querySelectorAll('.rfcp-agency-candidate'),function(el,i){
      el.addEventListener('click',function(){
        Array.prototype.forEach.call(picker.querySelectorAll('.rfcp-agency-candidate'),function(b){b.disabled=true;});
        msg.className='';msg.textContent='';
        var selectPayload={name:basePayload.name,agency_name:basePayload.agency_name,business_name:basePayload.business_name,promo_code:basePayload.promo_code,website:basePayload.website,uei:candidates[i].uei};
        fetch('/.netlify/functions/agency-access-intake',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(selectPayload)})
          .then(function(r){return r.json().then(function(j){return {ok:r.ok,j:j};});})
          .then(function(res){
            if(!res.ok)throw new Error((res.j&&res.j.error)||'That request could not be completed.');
            picker.classList.remove('on');picker.innerHTML='';
            msg.className='ok';msg.textContent=res.j.message||'Access activated.';
            if(res.j.email&&res.j.session_token)setTimeout(function(){landOnDashboard(res.j.email,res.j.session_token);},500);
          })
          .catch(function(err){
            msg.className='err';msg.textContent=err.message;
            Array.prototype.forEach.call(picker.querySelectorAll('.rfcp-agency-candidate'),function(b){b.disabled=false;});
          });
      });
    });
  }

  var websiteInput=document.getElementById('rfcp-agency-website');
  if(websiteInput)websiteInput.addEventListener('input',function(){var cleaned=websiteInput.value.replace(/^\s*https?:\/\//i,'').replace(/^\/+/,'');if(cleaned!==websiteInput.value)websiteInput.value=cleaned;});
  function websiteUrl(value){return 'https://'+String(value||'').trim().replace(/^https?:\/\//i,'').replace(/^\/+/,'');}

  form.addEventListener('submit',function(e){
    e.preventDefault();
    msg.className='';msg.textContent='';
    picker.classList.remove('on');picker.innerHTML='';
    var payload={
      name:document.getElementById('rfcp-agency-name').value.trim(),
      agency_name:document.getElementById('rfcp-agency-agency').value.trim(),
      business_name:document.getElementById('rfcp-agency-business').value.trim(),
      promo_code:document.getElementById('rfcp-agency-promo').value.trim()
    };
    if(!payload.name||!payload.agency_name||!payload.business_name||!payload.promo_code){msg.className='err';msg.textContent='Complete all fields.';return;}
    var parsedWebsite;
    try{parsedWebsite=new URL(websiteUrl(websiteInput?websiteInput.value:''))}catch(err){msg.className='err';msg.textContent='Enter a valid business website name.';return}
    if(parsedWebsite.protocol!=='https:'||!parsedWebsite.hostname||!parsedWebsite.hostname.includes('.')){msg.className='err';msg.textContent='Enter a valid business website name.';return}
    payload.website=parsedWebsite.href;
    submit.disabled=true;submit.textContent='Submitting…';
    fetch('/.netlify/functions/agency-access-intake',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
      .then(function(r){return r.json().then(function(j){return {ok:r.ok,j:j};});})
      .then(function(res){
        if(!res.ok)throw new Error((res.j&&res.j.error)||'Agency access request failed.');
        if(res.j.matched==='multiple'){renderPicker(res.j.candidates,payload);return;}
        msg.className='ok';
        msg.textContent=res.j.message||'Agency access activated.';
        if(res.j.matched==='single'&&res.j.email&&res.j.session_token){
          setTimeout(function(){landOnDashboard(res.j.email,res.j.session_token);},500);
        }else if(res.j.matched==='none'){
          msg.className='err';
        }
      })
      .catch(function(err){msg.className='err';msg.textContent=err.message;})
      .finally(function(){submit.disabled=false;submit.textContent='Submit Agency Access';});
  });
})();
</script>`;

  if (!html.includes('id="rfcp-agency-homepage-css"')) html = html.replace('</head>', css + '\n</head>');
  if (!html.includes('id="rfcp-agency-overlay"')) html = html.replace('</body>', modal + script + '\n</body>');

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
};

export const config = {
  path: '/',
};
