export default async function handler(request, context) {
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

  // Preserve the restored dashboard source and redirect only its data call to
  // the state-enriched wrapper. The original client-pipeline remains untouched.
  html = html.replace(
    "fetch('/.netlify/functions/client-pipeline?bc_email=' + encodeURIComponent(getEmail())",
    "fetch('/.netlify/functions/client-pipeline-v2?bc_email=' + encodeURIComponent(getEmail())"
  );

  const css = `
<style id="rfcp-dashboard-enhancement-css">
  .agency-login-btn{background:linear-gradient(135deg,#d9a45b,#f0cf79);color:#081a38;border:none;border-radius:8px;padding:8px 14px;font-size:.72rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;white-space:nowrap;box-shadow:0 0 0 1px rgba(217,164,91,.2)}
  .agency-login-btn:hover{filter:brightness(1.06)}
  #agency-auth-cta{position:fixed;top:18px;right:18px;z-index:1002}
  .rfcp-extra-filter{min-width:135px}
  .rfcp-date-input{width:145px;min-width:130px}
  .rfcp-sortable{cursor:pointer;user-select:none;transition:.15s}
  .rfcp-sortable:hover{color:var(--cyan);background:rgba(91,211,255,.07)}
  .rfcp-sort-arrow{color:var(--cyan);margin-left:4px;font-size:.7rem}
  .rfcp-state-chip{display:inline-block;padding:2px 8px;border-radius:4px;font-size:.66rem;font-weight:700;background:rgba(52,211,153,.1);border:1px solid rgba(52,211,153,.22);color:#6ee7b7}
  #rfcp-agency-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.62);z-index:1100;align-items:center;justify-content:center;padding:20px}
  #rfcp-agency-overlay.open{display:flex}
  .rfcp-agency-card{width:min(540px,100%);max-height:92vh;overflow:auto;background:#0f2244;border:1px solid rgba(91,211,255,.24);border-radius:18px;padding:28px;box-shadow:0 32px 90px rgba(0,0,0,.5);position:relative}
  .rfcp-agency-close{position:absolute;top:14px;right:14px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);color:#fff;border-radius:8px;width:34px;height:34px;cursor:pointer}
  .rfcp-agency-eye{font-size:.62rem;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:var(--cyan);margin-bottom:8px}
  .rfcp-agency-title{font-family:'Bodoni Moda',serif;font-size:1.7rem;color:#fff;font-weight:500;line-height:1.15;margin:0 36px 8px 0}
  .rfcp-agency-sub{font-size:.84rem;color:var(--muted);margin-bottom:20px;line-height:1.6}
  .rfcp-agency-field{margin-bottom:13px}
  .rfcp-agency-field label{display:block;font-size:.62rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--soft);margin-bottom:5px}
  .rfcp-agency-field input{width:100%;background:rgba(255,255,255,.06);border:1px solid var(--line2);border-radius:9px;color:#fff;padding:11px 12px;font:inherit;outline:none}
  .rfcp-agency-field input:focus{border-color:var(--cyan)}
  .rfcp-agency-submit{width:100%;margin-top:4px;background:var(--cyan);color:#06172f;border:none;border-radius:9px;padding:12px 16px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;cursor:pointer}
  .rfcp-agency-submit:disabled{opacity:.55;cursor:wait}
  #rfcp-agency-msg{min-height:20px;margin-top:11px;font-size:.82rem;text-align:center;color:var(--muted)}
  #rfcp-agency-msg.ok{color:var(--green)}
  #rfcp-agency-msg.err{color:#ff8a8a}
  @media(max-width:700px){#agency-auth-cta{top:10px;right:10px}.agency-login-btn{padding:7px 10px;font-size:.65rem}.rfcp-date-input{width:100%;min-width:0}.rfcp-extra-filter{min-width:0;flex:1}.controls>.ctrl-select,.controls>.ctrl-input{flex:1 1 150px}}
</style>`;

  const modal = `
<div id="rfcp-agency-overlay" role="dialog" aria-modal="true" aria-labelledby="rfcp-agency-title">
  <div class="rfcp-agency-card">
    <button type="button" class="rfcp-agency-close" id="rfcp-agency-close" aria-label="Close agency login">✕</button>
    <div class="rfcp-agency-eye">RFCP Agency Access</div>
    <h2 class="rfcp-agency-title" id="rfcp-agency-title">Agency Login</h2>
    <p class="rfcp-agency-sub">Enter the agency and business information associated with your access request.</p>
    <form id="rfcp-agency-form" novalidate>
      <div class="rfcp-agency-field"><label for="rfcp-agency-name">Name</label><input id="rfcp-agency-name" name="name" type="text" autocomplete="name" required></div>
      <div class="rfcp-agency-field"><label for="rfcp-agency-agency">Agency Name</label><input id="rfcp-agency-agency" name="agency_name" type="text" autocomplete="organization" required></div>
      <div class="rfcp-agency-field"><label for="rfcp-agency-business">Business Name</label><input id="rfcp-agency-business" name="business_name" type="text" required></div>
      <div class="rfcp-agency-field"><label for="rfcp-agency-email">Business Email</label><input id="rfcp-agency-email" name="business_email" type="email" autocomplete="email" required></div>
      <div class="rfcp-agency-field"><label for="rfcp-agency-promo">Promo Code</label><input id="rfcp-agency-promo" name="promo_code" type="text" autocomplete="off" placeholder="Enter your promo code" required></div>
      <button class="rfcp-agency-submit" type="submit" id="rfcp-agency-submit">Submit Agency Access</button>
      <div id="rfcp-agency-msg" aria-live="polite"></div>
    </form>
  </div>
</div>`;

  const script = `
<script id="rfcp-dashboard-enhancement-script">
(function(){
  'use strict';
  if (window.__rfcpDashboardEnhanced) return;
  window.__rfcpDashboardEnhanced = true;

  var STATES = [
    ['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],['CA','California'],['CO','Colorado'],['CT','Connecticut'],['DE','Delaware'],['DC','District of Columbia'],['FL','Florida'],['GA','Georgia'],['HI','Hawaii'],['ID','Idaho'],['IL','Illinois'],['IN','Indiana'],['IA','Iowa'],['KS','Kansas'],['KY','Kentucky'],['LA','Louisiana'],['ME','Maine'],['MD','Maryland'],['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],['MS','Mississippi'],['MO','Missouri'],['MT','Montana'],['NE','Nebraska'],['NV','Nevada'],['NH','New Hampshire'],['NJ','New Jersey'],['NM','New Mexico'],['NY','New York'],['NC','North Carolina'],['ND','North Dakota'],['OH','Ohio'],['OK','Oklahoma'],['OR','Oregon'],['PA','Pennsylvania'],['RI','Rhode Island'],['SC','South Carolina'],['SD','South Dakota'],['TN','Tennessee'],['TX','Texas'],['UT','Utah'],['VT','Vermont'],['VA','Virginia'],['WA','Washington'],['WV','West Virginia'],['WI','Wisconsin'],['WY','Wyoming'],['PR','Puerto Rico'],['GU','Guam'],['VI','U.S. Virgin Islands'],['AS','American Samoa'],['MP','Northern Mariana Islands']
  ];

  var sortKey = 'deadline';
  var sortDir = 'asc';
  var lastSignature = '';

  function $(id){ return document.getElementById(id); }
  function value(o, key){
    if (key === 'title') return o.title || '';
    if (key === 'agency') return o.agency || '';
    if (key === 'type') return o.type || '';
    if (key === 'set_aside') return o.set_aside || o.setAside || 'Unrestricted';
    if (key === 'naics') return o.naics || o.naicsCode || '';
    if (key === 'state') return o.state_name || o.state || '';
    if (key === 'deadline') return o.deadline || o.responseDeadline || '';
    return '';
  }
  function dateValue(v){ var d = v ? new Date(v) : null; return d && !isNaN(d.getTime()) ? d.getTime() : null; }
  function sortRows(rows){
    return rows.slice().sort(function(a,b){
      var av=value(a,sortKey), bv=value(b,sortKey);
      var cmp=0;
      if(sortKey==='deadline'){
        var ad=dateValue(av), bd=dateValue(bv);
        if(ad===null&&bd===null) cmp=0; else if(ad===null) cmp=1; else if(bd===null) cmp=-1; else cmp=ad-bd;
      }else{
        cmp=String(av).localeCompare(String(bv),undefined,{numeric:true,sensitivity:'base'});
      }
      return sortDir==='asc'?cmp:-cmp;
    });
  }

  // Remove the old Federal/Nevada/California state tabs. State is now a true
  // opportunity filter in the filter band.
  var tabs=document.querySelector('nav.mkt-tabs'); if(tabs) tabs.remove();
  var nv=$('panel-nevada'), ca=$('panel-california'); if(nv) nv.style.display='none'; if(ca) ca.style.display='none';
  var fed=$('panel-federal'); if(fed) fed.style.display='';

  // Agency login is available both before member authentication and in the
  // authenticated header. Promo submission never bypasses business auth.
  // Redirects to the homepage's own agency modal (?agency=1 auto-opens it)
  // instead of opening the local copy below -- that copy predates today's
  // SAM.gov rework (still sends business_email, no website field, no
  // picker, no session-landing) and would now always fail server-side
  // since website became a hard requirement. Rather than duplicate all of
  // that logic a second time here, forever, one real implementation.
  function openAgency(){ window.location.assign('/?agency=1'); }
  function closeAgency(){ var el=$('rfcp-agency-overlay'); if(el) el.classList.remove('open'); }
  var headerRight=document.querySelector('.header-right');
  if(headerRight && !$('agency-login-header')){
    var hb=document.createElement('button'); hb.type='button'; hb.id='agency-login-header'; hb.className='agency-login-btn'; hb.textContent='AGENCY LOGIN'; hb.addEventListener('click',openAgency); headerRight.insertBefore(hb,headerRight.firstChild);
  }
  var authGate=$('auth-gate');
  if(authGate && !$('agency-auth-cta')){
    var ab=document.createElement('button'); ab.type='button'; ab.id='agency-auth-cta'; ab.className='agency-login-btn'; ab.textContent='AGENCY LOGIN'; ab.addEventListener('click',openAgency); authGate.appendChild(ab);
  }
  var closeBtn=$('rfcp-agency-close'); if(closeBtn) closeBtn.addEventListener('click',closeAgency);
  var overlay=$('rfcp-agency-overlay'); if(overlay) overlay.addEventListener('click',function(e){if(e.target===overlay)closeAgency();});
  document.addEventListener('keydown',function(e){if(e.key==='Escape')closeAgency();});

  var agencyForm=$('rfcp-agency-form');
  if(agencyForm){ agencyForm.addEventListener('submit',function(e){
    e.preventDefault();
    var msg=$('rfcp-agency-msg'), submit=$('rfcp-agency-submit');
    msg.className=''; msg.textContent='';
    var payload={
      name:$('rfcp-agency-name').value.trim(), agency_name:$('rfcp-agency-agency').value.trim(),
      business_name:$('rfcp-agency-business').value.trim(), business_email:$('rfcp-agency-email').value.trim().toLowerCase(),
      promo_code:$('rfcp-agency-promo').value.trim()
    };
    if(!payload.name||!payload.agency_name||!payload.business_name||!payload.business_email||!payload.promo_code){msg.className='err';msg.textContent='Complete all fields.';return;}
    submit.disabled=true; submit.textContent='Submitting…';
    fetch('/.netlify/functions/agency-access-intake',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
      .then(function(r){return r.json().then(function(j){return {ok:r.ok,j:j};});})
      .then(function(res){if(!res.ok)throw new Error(res.j&&res.j.error||'Agency access request failed.');msg.className='ok';msg.textContent='Agency access request received.';})
      .catch(function(err){msg.className='err';msg.textContent=err.message;})
      .finally(function(){submit.disabled=false;submit.textContent='Submit Agency Access';});
  });}

  var controls=document.querySelector('#panel-federal .controls');
  var setAside=$('fed-setaside');
  if(controls && setAside && !$('rfcp-state')){
    setAside.insertAdjacentHTML('afterend',
      '<select class="ctrl-select rfcp-extra-filter" id="rfcp-state"><option value="">All States</option></select>'+
      '<select class="ctrl-select rfcp-extra-filter" id="rfcp-type"><option value="">All Notice Types</option></select>'+
      '<select class="ctrl-select rfcp-extra-filter" id="rfcp-posted-preset"><option value="90" selected>Posted: 90 Days</option><option value="60">Posted: 60 Days</option><option value="30">Posted: 30 Days</option><option value="custom">Posted: Custom</option></select>'+
      '<input class="ctrl-input rfcp-date-input" id="rfcp-posted-from" type="date" aria-label="Posted from">'+
      '<input class="ctrl-input rfcp-date-input" id="rfcp-posted-to" type="date" aria-label="Posted to">'
    );
    var state=$('rfcp-state');
    state.innerHTML='<option value="">All States</option>'+STATES.map(function(s){return '<option value="'+s[0]+'">'+s[1]+' ('+s[0]+')</option>';}).join('');
  }

  function formatDateInput(d){var y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return y+'-'+m+'-'+day;}
  function applyPostedPreset(){
    var preset=$('rfcp-posted-preset'), from=$('rfcp-posted-from'), to=$('rfcp-posted-to');
    if(!preset||!from||!to||preset.value==='custom')return;
    var days=parseInt(preset.value)||90, end=new Date(), start=new Date(end); start.setDate(start.getDate()-days);
    from.value=formatDateInput(start); to.value=formatDateInput(end);
  }
  applyPostedPreset();

  function populateDynamicOptions(){
    if(!Array.isArray(window.allOpps)) return;
    var type=$('rfcp-type'), sa=$('fed-setaside');
    if(type){var tv=type.value, types=[...new Set(window.allOpps.map(function(o){return String(o.type||'').trim();}).filter(Boolean))].sort();type.innerHTML='<option value="">All Notice Types</option>'+types.map(function(v){return '<option value="'+esc(v)+'">'+esc(v)+'</option>';}).join('');if(types.indexOf(tv)>=0)type.value=tv;}
    if(sa){var sv=sa.value, sas=[...new Set(window.allOpps.map(function(o){return String(o.set_aside||o.setAside||'Unrestricted').trim();}).filter(Boolean))].sort();sa.innerHTML='<option value="">All Set-Asides</option>'+sas.map(function(v){return '<option value="'+esc(v)+'">'+esc(v)+'</option>';}).join('');if(sas.indexOf(sv)>=0)sa.value=sv;}
  }

  function enhancedRender(opps){
    window.renderedOpps=opps;
    var tbody=$('fed-tbody'), cards=$('fed-cards');
    var head=document.querySelector('#panel-federal .tbl-wrap thead tr');
    if(head){head.innerHTML='<th class="rfcp-sortable" data-sort="title">Opportunity</th><th class="rfcp-sortable" data-sort="agency">Agency</th><th class="rfcp-sortable" data-sort="type">Type</th><th class="rfcp-sortable" data-sort="set_aside">Set-Aside</th><th class="rfcp-sortable" data-sort="naics">NAICS</th><th class="rfcp-sortable" data-sort="state">State</th><th class="rfcp-sortable" data-sort="deadline">Deadline</th><th></th>';}
    if(!opps.length){tbody.innerHTML='<tr><td colspan="8" class="empty-row">No contracts matched your current filters.</td></tr>';cards.innerHTML='';bindSortHeaders();return;}
    tbody.innerHTML=opps.map(function(o,i){
      var cb=analysisCache[o.notice_id||o.noticeId];
      var badge=cb?' <span class="fit-badge '+(cb.recommendation||'').toLowerCase().replace(' ','_')+'">'+esc(cb.recommendation)+' '+cb.fit_score+'</span>':'';
      var dl=o.deadline||o.responseDeadline;
      return '<tr>'+
        '<td><button class="t-title" onclick="openDetail('+i+')">'+esc(o.title||'Untitled')+'</button>'+badge+'</td>'+
        '<td style="font-size:.76rem;color:var(--muted)">'+esc(o.agency||'—')+'</td>'+
        '<td>'+typeChip(o.type)+'</td>'+
        '<td style="font-size:.75rem;color:var(--muted)">'+esc(o.set_aside||o.setAside||'Unrestricted')+'</td>'+
        '<td><span class="chip chip-naics">'+esc(o.naics||o.naicsCode||'—')+'</span></td>'+
        '<td><span class="rfcp-state-chip">'+esc(o.state||'—')+'</span></td>'+
        '<td>'+deadlineBadge(dl)+'</td>'+
        '<td><button class="analyze-btn" onclick="openFit('+i+')">★ Analyze Fit</button></td></tr>';
    }).join('');
    cards.innerHTML=opps.map(function(o,i){var dl=o.deadline||o.responseDeadline;return '<div class="opp-card"><button class="opp-card-title" onclick="openDetail('+i+')">'+esc(o.title||'Untitled')+'</button><div class="opp-card-agency">'+esc(o.agency||'—')+'</div><div class="opp-card-row"><div>'+typeChip(o.type)+' <span class="chip chip-naics">'+esc(o.naics||o.naicsCode||'')+'</span> <span class="rfcp-state-chip">'+esc(o.state||'—')+'</span></div>'+deadlineBadge(dl)+'</div><button class="analyze-btn" style="width:100%;padding:8px;margin-top:8px" onclick="openFit('+i+')">★ Analyze Fit</button></div>';}).join('');
    bindSortHeaders();
  }

  function bindSortHeaders(){
    document.querySelectorAll('#panel-federal th.rfcp-sortable').forEach(function(th){
      var key=th.dataset.sort, label=th.textContent.replace(/[▲▼↕]/g,'').trim();
      th.innerHTML=label+(sortKey===key?'<span class="rfcp-sort-arrow">'+(sortDir==='asc'?'▲':'▼')+'</span>':'<span class="rfcp-sort-arrow">↕</span>');
      th.onclick=function(){if(sortKey===key)sortDir=sortDir==='asc'?'desc':'asc';else{sortKey=key;sortDir=key==='deadline'?'asc':'asc';}enhancedApply();};
    });
  }

  function enhancedApply(){
    if(!Array.isArray(window.allOpps)) return;
    var q=(($('fed-search')&&$('fed-search').value)||'').toLowerCase();
    var sa=($('fed-setaside')&&$('fed-setaside').value)||'';
    var st=($('rfcp-state')&&$('rfcp-state').value)||'';
    var typ=($('rfcp-type')&&$('rfcp-type').value)||'';
    var from=($('rfcp-posted-from')&&$('rfcp-posted-from').value)||'';
    var to=($('rfcp-posted-to')&&$('rfcp-posted-to').value)||'';
    var rows=window.allOpps.filter(function(o){
      if(Array.isArray(window.activeNaics)&&window.activeNaics.length&&window.activeNaics.indexOf(o.naics||o.naicsCode||'')===-1)return false;
      if(q&&!(String(o.title||'').toLowerCase().includes(q)||String(o.agency||'').toLowerCase().includes(q)))return false;
      if(sa&&String(o.set_aside||o.setAside||'Unrestricted')!==sa)return false;
      if(st&&String(o.state||'').toUpperCase()!==st.toUpperCase())return false;
      if(typ&&String(o.type||'')!==typ)return false;
      if(Number(window.windowDays)>0){var left=daysLeft(o.deadline||o.responseDeadline);if(left===null||left<0||left>Number(window.windowDays))return false;}
      var posted=dateValue(o.posted_date||o.postedDate);
      if(from&&posted!==null&&posted<new Date(from+'T00:00:00').getTime())return false;
      if(to&&posted!==null&&posted>new Date(to+'T23:59:59').getTime())return false;
      return true;
    });
    rows=sortRows(rows);
    window.filteredOpps=rows;
    var hot=0,warm=0,ok=0;rows.forEach(function(o){var u=urgency(o.deadline||o.responseDeadline);if(u==='hot')hot++;else if(u==='warm')warm++;else ok++;});
    if($('stat-hot'))$('stat-hot').textContent=hot;if($('stat-warm'))$('stat-warm').textContent=warm;if($('stat-ok'))$('stat-ok').textContent=ok;if($('stat-total'))$('stat-total').textContent=rows.length;if($('tab-fed-count'))$('tab-fed-count').textContent=rows.length;if($('fed-count-lbl'))$('fed-count-lbl').textContent=rows.length+' contracts';
    enhancedRender(rows);
  }

  window.renderFedTable=enhancedRender;
  window.applyFedFilters=enhancedApply;

  ['fed-search','fed-setaside','rfcp-state','rfcp-type','rfcp-posted-from','rfcp-posted-to'].forEach(function(id){var el=$(id);if(el)el.addEventListener(id==='fed-search'?'input':'change',enhancedApply);});
  var preset=$('rfcp-posted-preset'); if(preset)preset.addEventListener('change',function(){if(preset.value!=='custom')applyPostedPreset();enhancedApply();});
  var fromEl=$('rfcp-posted-from'),toEl=$('rfcp-posted-to');[fromEl,toEl].forEach(function(el){if(el)el.addEventListener('change',function(){if(preset)preset.value='custom';enhancedApply();});});

  function sync(){
    if(!Array.isArray(window.allOpps))return;
    var sig=window.allOpps.length+'|'+(window.allOpps[0]&&(window.allOpps[0].notice_id||window.allOpps[0].noticeId)||'');
    if(sig!==lastSignature){lastSignature=sig;populateDynamicOptions();enhancedApply();}
  }
  var tries=0, timer=setInterval(function(){sync();tries++;if(tries>40)clearInterval(timer);},750);
  if(typeof window.loadFederal==='function'){
    var originalLoadFederal=window.loadFederal;
    window.loadFederal=function(){var out=originalLoadFederal.apply(this,arguments);lastSignature='';var n=0,t=setInterval(function(){sync();n++;if(n>24)clearInterval(t);},750);return out;};
  }
})();
</script>`;

  html = html.replace('</head>', css + '\n</head>');
  html = html.replace('</body>', modal + '\n' + script + '\n</body>');

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}
