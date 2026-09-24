export default async function handler(request, context) {
  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  let html = await response.text();
  if (!html.includes('<title>Opportunity Pipeline — Federal Contract Portal</title>')) {
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
  .rfcp-extra-filter{min-width:135px}
  .rfcp-date-input{width:145px;min-width:130px}
  .rfcp-sortable{cursor:pointer;user-select:none;transition:.15s}
  .rfcp-sortable:hover{color:var(--cyan);background:rgba(91,211,255,.07)}
  .rfcp-sort-arrow{color:var(--cyan);margin-left:4px;font-size:.7rem}
  .rfcp-state-chip{display:inline-block;padding:2px 8px;border-radius:4px;font-size:.66rem;font-weight:700;background:rgba(52,211,153,.1);border:1px solid rgba(52,211,153,.22);color:#6ee7b7}
  @media(max-width:700px){.rfcp-date-input{width:100%;min-width:0}.rfcp-extra-filter{min-width:0;flex:1}.controls>.ctrl-select,.controls>.ctrl-input{flex:1 1 150px}}
</style>`;

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
  html = html.replace('</body>', script + '\n</body>');

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}
