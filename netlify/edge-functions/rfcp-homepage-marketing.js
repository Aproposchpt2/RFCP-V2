export default async (request, context) => {
  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  let html = await response.text();
  if (!html.includes('<!-- TWO PATH SECTION -->') || !html.includes('<!-- PROOF STRIP -->')) {
    return new Response(html, { status: response.status, statusText: response.statusText, headers: response.headers });
  }

  // Search-intent SEO: keep Federal Contract Portal as the product identity while
  // surfacing the language federal contractors and small businesses actually search.
  html = html.replace(
    '<title>Federal Contract Portal — Apropos Group LLC</title>',
    '<title>Federal Contract Portal | Federal Contract Opportunities for Small Businesses | Apropos Group LLC</title>'
  );
  html = html.replace(
    '<title>National Government Contract Center — Federal · Nevada · California</title>',
    '<title>Federal Contract Portal | Federal Contract Opportunities for Small Businesses | Apropos Group LLC</title>'
  );
  html = html.replace(
    '<meta name="description" content="Apropos Group LLC Federal Contract Portal — supporting economic growth by helping businesses participate more effectively in the government marketplace.">',
    '<meta name="description" content="Federal Contract Portal helps federal contractors and small businesses discover government contract opportunities matched to their capabilities, evaluate fit, and focus on opportunities they are positioned to pursue.">'
  );
  html = html.replace(
    '<meta name="description" content="Your command center for government contract intelligence. Personalized opportunity dashboards for registered federal contractors and state contract seekers. Powered by AG ENGINEERING OS™.">',
    '<meta name="description" content="Federal Contract Portal helps federal contractors and small businesses discover government contract opportunities matched to their capabilities, evaluate fit, and focus on opportunities they are positioned to pursue.">'
  );

  const start = html.indexOf('<!-- TWO PATH SECTION -->');
  const end = html.indexOf('<!-- PROOF STRIP -->');

  const marketing = `<!-- RFCP MARKETING STORY -->
<section class="rfcp-story" id="why-rfcp">
  <div class="wrap rfcp-story-intro">
    <div class="rfcp-kicker">A BETTER PATH TO FEDERAL OPPORTUNITY</div>
    <h2>Government opportunity should be easier to <em>find, understand and pursue.</em></h2>
    <p class="rfcp-lede">Federal contractors do not need another endless list of solicitations. They need a clearer way to recognize the opportunities that fit their business. Federal Contract Portal brings business capability and contract intelligence together so companies can spend less time searching and more time evaluating the work they are positioned to perform.</p>
  </div>

  <div class="wrap rfcp-process" aria-label="How Federal Contract Portal works">
    <div class="rfcp-process-line">
      <div class="rfcp-process-no">01</div>
      <div class="rfcp-process-copy">
        <div class="rfcp-process-label">KNOW THE BUSINESS</div>
        <h3>Your capabilities become the starting point.</h3>
        <p>The portal uses the business profile, including relevant NAICS information and capability evidence, to establish what the company actually does before presenting federal contract opportunities.</p>
      </div>
    </div>
    <div class="rfcp-process-line">
      <div class="rfcp-process-no">02</div>
      <div class="rfcp-process-copy">
        <div class="rfcp-process-label">MATCH THE OPPORTUNITY</div>
        <h3>Relevant contracts rise above the noise.</h3>
        <p>Instead of asking a business to search the entire federal marketplace, the dashboard concentrates attention on opportunities aligned with its profile—giving federal contractors a more focused place to begin.</p>
      </div>
    </div>
    <div class="rfcp-process-line">
      <div class="rfcp-process-no">03</div>
      <div class="rfcp-process-copy">
        <div class="rfcp-process-label">ANALYZE FIT</div>
        <h3>Move from discovery to informed pursuit.</h3>
        <p>Analyze Fit evaluates the opportunity against the business profile and produces practical bid/no-bid intelligence. The goal is not to encourage every pursuit. It is to help businesses recognize where their time, attention and resources are best applied.</p>
      </div>
    </div>
  </div>
</section>

<section class="rfcp-impact">
  <div class="wrap rfcp-impact-grid">
    <div class="rfcp-impact-statement">
      <div class="rfcp-kicker">WHY THIS MATTERS</div>
      <h2>A contract is more than an award.</h2>
      <p>For a qualified business, a government contract can become capacity, experience, revenue and momentum. It can support the hiring of people, the development of new capabilities, and the confidence to pursue the next opportunity.</p>
      <p>That is why Apropos Group LLC sees contract access as part of a larger economic-development mission. When more capable businesses can identify and pursue relevant opportunities efficiently, the benefits can extend far beyond the transaction itself.</p>
    </div>
    <div class="rfcp-impact-chain" aria-label="Economic impact chain">
      <div><span>Opportunity</span><b>creates a path to</b></div>
      <div><span>Business Growth</span><b>creates capacity for</b></div>
      <div><span>Jobs & Advancement</span><b>strengthen</b></div>
      <div><span>Families & Communities</span></div>
    </div>
  </div>
</section>

<section class="rfcp-agencies">
  <div class="wrap rfcp-agency-grid">
    <div>
      <div class="rfcp-kicker">FOR BUSINESS DEVELOPMENT CENTERS & COMMUNITY PARTNERS</div>
      <h2>Extend the service you already provide.</h2>
    </div>
    <div class="rfcp-agency-body">
      <p>Business Development Centers, economic-development organizations and community business-support agencies already help entrepreneurs prepare, compete and grow. Federal Contract Portal can extend that work by giving appropriate businesses a direct pathway from capability to relevant federal opportunity.</p>
      <p>The platform is designed to complement—not replace—the trusted guidance these organizations provide. Partner access creates another practical resource agencies can introduce to businesses that are ready to explore the federal marketplace.</p>
      <button type="button" class="rfcp-agency-story-cta" id="rfcp-story-agency-open">AGENCY ACCESS <span aria-hidden="true">→</span></button>
    </div>
  </div>
</section>

<section class="rfcp-close">
  <div class="wrap rfcp-close-inner">
    <div class="rfcp-kicker">FEDERAL CONTRACT OPPORTUNITIES. MATCHED TO BUSINESS.</div>
    <h2>Find the opportunities that deserve your attention.</h2>
    <p>Start with your business. See a focused opportunity dashboard. Use Analyze Fit when you need deeper pursuit intelligence.</p>
    <div class="rfcp-close-actions">
      <a href="/onboarding" class="rfcp-close-primary">START FREE 14 DAY TRIAL <span aria-hidden="true">→</span></a>
      <a href="/onboarding" class="rfcp-close-secondary">MEMBER LOGIN</a>
    </div>
  </div>
</section>

`;

  html = html.slice(0, start) + marketing + html.slice(end);

  const css = `
<style id="rfcp-homepage-marketing-css">
.rfcp-story{padding:clamp(5rem,9vw,8rem) 0;background:linear-gradient(180deg,#020b17 0%,#06162f 100%);border-top:1px solid rgba(255,255,255,.07)}
.rfcp-story-intro{max-width:1000px;text-align:center}
.rfcp-kicker{font-size:.62rem;letter-spacing:.24em;text-transform:uppercase;font-weight:700;color:#D5AA4D;margin-bottom:1rem}
.rfcp-story h2,.rfcp-impact h2,.rfcp-agencies h2,.rfcp-close h2{font-family:var(--disp);font-size:clamp(2.15rem,4.6vw,4rem);font-weight:400;line-height:1.03;letter-spacing:-.025em;color:#fff}
.rfcp-story h2 em{font-style:italic;color:rgba(255,255,255,.48)}
.rfcp-lede{max-width:850px;margin:1.8rem auto 0;font-size:clamp(.98rem,1.35vw,1.12rem);line-height:1.85;color:rgba(255,255,255,.62)}
.rfcp-process{margin-top:clamp(4rem,7vw,6.5rem);max-width:1050px}
.rfcp-process-line{display:grid;grid-template-columns:110px 1fr;gap:clamp(1.5rem,4vw,4rem);padding:2.5rem 0;border-top:1px solid rgba(255,255,255,.12)}
.rfcp-process-line:last-child{border-bottom:1px solid rgba(255,255,255,.12)}
.rfcp-process-no{font-family:var(--disp);font-style:italic;font-size:3rem;line-height:1;color:rgba(213,170,77,.45)}
.rfcp-process-label{font-size:.58rem;letter-spacing:.2em;text-transform:uppercase;color:rgba(213,170,77,.72);font-weight:700;margin-bottom:.45rem}
.rfcp-process-copy h3{font-family:var(--disp);font-size:clamp(1.45rem,2.6vw,2.25rem);font-weight:400;color:#fff;margin-bottom:.65rem;line-height:1.15}
.rfcp-process-copy p{font-size:.94rem;line-height:1.8;color:rgba(255,255,255,.56);max-width:780px}
.rfcp-impact{padding:clamp(5rem,9vw,8rem) 0;background:#0F2A6A;border-top:1px solid rgba(255,255,255,.09);border-bottom:1px solid rgba(255,255,255,.09)}
.rfcp-impact-grid{display:grid;grid-template-columns:1.12fr .88fr;gap:clamp(3rem,7vw,7rem);align-items:center}
.rfcp-impact-statement p{font-size:.98rem;line-height:1.82;color:rgba(255,255,255,.67);margin-top:1.25rem;max-width:650px}
.rfcp-impact-chain{border-left:1px solid rgba(213,170,77,.45);padding-left:clamp(1.8rem,4vw,3rem)}
.rfcp-impact-chain div{padding:1.15rem 0;border-bottom:1px solid rgba(255,255,255,.1);display:flex;flex-direction:column;gap:.15rem}
.rfcp-impact-chain span{font-family:var(--disp);font-size:clamp(1.45rem,2.8vw,2.25rem);color:#fff}
.rfcp-impact-chain b{font-size:.58rem;letter-spacing:.16em;text-transform:uppercase;color:#E8C982;font-weight:600}
.rfcp-agencies{padding:clamp(5rem,9vw,8rem) 0;background:#020b17}
.rfcp-agency-grid{display:grid;grid-template-columns:.9fr 1.1fr;gap:clamp(3rem,8vw,8rem);align-items:start}
.rfcp-agency-body{padding-top:.5rem}
.rfcp-agency-body p{font-size:1rem;line-height:1.84;color:rgba(255,255,255,.62);margin-bottom:1.15rem}
.rfcp-agency-story-cta{margin-top:1rem;border:1px solid rgba(213,170,77,.55);background:rgba(213,170,77,.08);color:#E8C982;border-radius:999px;padding:.82rem 1.5rem;font-family:var(--body);font-size:.7rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;cursor:pointer;transition:.2s}
.rfcp-agency-story-cta:hover{background:rgba(213,170,77,.16);transform:translateY(-2px)}
.rfcp-close{padding:clamp(5rem,9vw,7rem) 0;background:linear-gradient(120deg,#06162f 0%,#0F2A6A 100%);border-top:1px solid rgba(213,170,77,.2);text-align:center}
.rfcp-close-inner{max-width:900px}
.rfcp-close p{max-width:700px;margin:1.25rem auto 0;color:rgba(255,255,255,.62);font-size:1rem;line-height:1.8}
.rfcp-close-actions{margin-top:2rem;display:flex;justify-content:center;align-items:center;gap:12px;flex-wrap:wrap}
.rfcp-close-primary,.rfcp-close-secondary{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;padding:.88rem 1.55rem;font-size:.7rem;font-weight:800;letter-spacing:.13em;text-transform:uppercase;text-decoration:none;transition:.2s}
.rfcp-close-primary{background:#fff;color:#0F2A6A;gap:.7rem}.rfcp-close-primary:hover{transform:translateY(-2px);background:#C3D0E8}
.rfcp-close-secondary{border:1px solid rgba(255,255,255,.26);color:#fff;background:rgba(255,255,255,.04)}.rfcp-close-secondary:hover{background:rgba(255,255,255,.09)}
@media(max-width:780px){.rfcp-process-line{grid-template-columns:58px 1fr;gap:1.2rem}.rfcp-process-no{font-size:2rem}.rfcp-impact-grid,.rfcp-agency-grid{grid-template-columns:1fr}.rfcp-impact-chain{margin-top:1rem}.rfcp-story,.rfcp-impact,.rfcp-agencies,.rfcp-close{padding:4.5rem 0}}
@media(max-width:520px){.rfcp-process-line{grid-template-columns:1fr}.rfcp-process-no{font-size:1.55rem}.rfcp-close-actions{flex-direction:column}.rfcp-close-primary,.rfcp-close-secondary{width:100%;max-width:320px}}
</style>`;

  html = html.replace('</head>', css + '\n</head>');

  // Reuse the existing agency-access modal from the homepage enhancement.
  const bridge = `
<script id="rfcp-homepage-marketing-script">
document.addEventListener('DOMContentLoaded',function(){
  var story=document.getElementById('rfcp-story-agency-open');
  var primary=document.getElementById('rfcp-home-agency-open');
  if(story&&primary)story.addEventListener('click',function(){primary.click();});
});
</script>`;
  html = html.replace('</body>', bridge + '\n</body>');

  return new Response(html, { status: response.status, statusText: response.statusText, headers: response.headers });
};

export const config = { path: '/' };
