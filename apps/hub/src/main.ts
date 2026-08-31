const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('hub root missing');

const tools = [
  { href: '/combat/', title: 'Combat Lab', desc: 'Hitboxes, frame data, replay, remapping, shields, throws, items and matchup testing.' },
  { href: '/movement/', title: 'Movement Lab', desc: 'Tune deterministic movement, jumps, fastfall, ledges, dodges and platform behavior.' },
  { href: '/stage/', title: 'Stage Lab', desc: 'Author and inspect geometry, ledges, moving platforms and hazard timing.' },
  { href: '/shell/', title: 'Shell Lab', desc: 'Character select, stage/rules flow, teams, session setup and results routing.' },
  { href: '/asset/', title: 'Real Asset Pilot', desc: 'Riven rig/model proof driven by authoritative platform-fighter simulation.' },
];

app.innerHTML = `
  <main class="wrap">
    <header>
      <div class="eyebrow">SLU DEVELOPMENT</div>
      <h1>Platform Fighter Studio</h1>
      <p class="lede">The browser-facing front door for the deterministic fighter foundation. Choose a lab below; production asset import, Blender audits and roster certification remain repo/CLI workflows.</p>
      <div class="status"><span></span> Foundation complete · character production active</div>
    </header>
    <section class="grid">
      ${tools.map((tool, i) => `<a class="card" href="${tool.href}"><div class="number">0${i + 1}</div><h2>${tool.title}</h2><p>${tool.desc}</p><div class="open">OPEN →</div></a>`).join('')}
    </section>
    <footer>slu-platform-fighter · deterministic simulation · rollback/replay certified</footer>
  </main>
`;

const style = document.createElement('style');
style.textContent = `
  :root { color-scheme: dark; }
  body { min-height:100vh; background:radial-gradient(circle at 75% 5%,#162034 0,transparent 34%),#080a0f; }
  .wrap { width:min(1180px,calc(100% - 40px)); margin:0 auto; padding:72px 0 48px; }
  header { max-width:820px; margin-bottom:48px; }
  .eyebrow { font-size:12px; letter-spacing:.22em; font-weight:800; color:#8da7cd; margin-bottom:14px; }
  h1 { font-size:clamp(44px,7vw,82px); line-height:.94; letter-spacing:-.055em; margin:0 0 24px; font-weight:850; }
  .lede { color:#aeb8c8; line-height:1.7; font-size:17px; max-width:760px; }
  .status { margin-top:22px; display:inline-flex; gap:9px; align-items:center; border:1px solid #27344a; border-radius:999px; padding:9px 13px; color:#bac9dd; font-size:13px; background:#0e1420aa; }
  .status span { width:8px; height:8px; border-radius:50%; background:#70e6a1; box-shadow:0 0 14px #70e6a1; }
  .grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; }
  .card { position:relative; min-height:240px; padding:26px; border:1px solid #222d3e; border-radius:18px; background:linear-gradient(145deg,#111722e8,#0b0f16e8); color:inherit; text-decoration:none; transition:.18s ease; overflow:hidden; }
  .card:hover { transform:translateY(-3px); border-color:#4f6d99; background:linear-gradient(145deg,#151e2c,#0d131d); }
  .number { position:absolute; right:22px; top:18px; color:#334057; font-size:38px; font-weight:800; letter-spacing:-.06em; }
  h2 { margin:42px 0 12px; font-size:27px; letter-spacing:-.025em; }
  .card p { color:#99a7ba; line-height:1.55; max-width:470px; }
  .open { position:absolute; left:26px; bottom:24px; color:#dce8fb; font-size:12px; font-weight:800; letter-spacing:.14em; }
  footer { margin-top:34px; color:#59667a; font-size:12px; }
  @media (max-width:720px) { .wrap{padding-top:44px}.grid{grid-template-columns:1fr}.card{min-height:210px} }
`;
document.head.appendChild(style);
