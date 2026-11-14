// Screenshots one screen of a built Yaoki app on a desktop, at landscape window sizes, in its known states and after scripted steps,
// to look at a landscape layout (yaoki-app/src/desk/). Build first, a quick build is enough (see yaoki-app/src/desk/README.md).
// usage: NODE_PATH=/opt/npm-tools/node_modules node desk-shots.js --dist <app build dir> --port <free port> --screen <Name> --out <dir>
//          [--level N2|N1]   every state of the screen listed in screen-states.js (address and taps), each screenshotted as
//                            "<label>"; without --level the screen opens once as "open" (add --query for N1: &plan=demo)
//          [--query '&plan=demo'] [--only <state label,...>] [--sizes 1366x657,1920x1080] [--scheme light|dark]
//          [--steps '<json list>']   steps run after each opening: {"click": "<css>", "nth": 0} · {"key": "Enter"} · {"wait": 500}
//                                    · {"eval": "<js>"} · {"shot": "<name>"} (a screenshot "<label>-<name>")
// For each screenshot it prints the pane and screen boxes and the problems it can measure: page errors, the page scrolling sideways,
// and elements of the screen that stick out of the pane or of the screen's own box (inside scroll areas excepted).
const fs = require('fs'), path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const DIST = arg('dist'), PORT = arg('port', '8900'), SCREEN = arg('screen'), OUT = arg('out'), Q = arg('query', ''), LEVEL = arg('level');
const SIZES = arg('sizes', '1366x657,1920x1080').split(',').map((s) => s.split('x').map(Number));
const STEPS = JSON.parse(arg('steps', '[]')), SCHEME = arg('scheme', 'light'), ONLY = arg('only') ? arg('only').split(',') : null;
if (!DIST || !SCREEN || !OUT) { console.error('need --dist, --screen and --out'); process.exit(2); }
let STATES = [{ q: Q, label: 'open', taps: [] }];
if (LEVEL) {
  process.env.YK_LEVEL = LEVEL;
  STATES = require('./screen-states.js')(LEVEL).filter((s) => s[0] === SCREEN).map(([screen, q, label, taps]) => ({ screen, q: q + Q, label: label || 'default', taps: taps || [] }));
  if (ONLY) STATES = STATES.filter((s) => ONLY.includes(s.label));
  if (!STATES.length) STATES = [{ q: Q + (LEVEL === 'N1' ? '&plan=demo' : ''), label: 'open', taps: [] }];
}
fs.mkdirSync(OUT, { recursive: true });
const srv = spawn('python3', ['-m', 'http.server', PORT, '--bind', '127.0.0.1', '--directory', DIST], { stdio: 'ignore' });
const measure = () => {
  const pane = document.querySelector('#yk-view').getBoundingClientRect();
  const root = [...document.querySelectorAll('#yk-stage [data-yk]')].filter((e) => e.getAttribute('data-yk') !== 'Shell')[0];
  const rb = root ? root.getBoundingClientRect() : null;
  const scrolls = (el) => { for (let p = el.parentElement; p && p !== root; p = p.parentElement) { const o = getComputedStyle(p); if (/(auto|scroll|hidden)/.test(o.overflowY + o.overflowX)) return true; } return false; };
  const out = [];
  if (root) for (const el of root.querySelectorAll('*')) {
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.position === 'fixed') continue;
    const sticks = r.left < rb.left - 1 || r.right > rb.right + 1 || r.bottom > rb.bottom + 1 || r.right > pane.right + 1 || r.left < pane.left - 1;
    if (sticks && !scrolls(el)) out.push(`${el.tagName.toLowerCase()}${el.getAttribute('data-d') ? '[' + el.getAttribute('data-d') + ']' : ''} "${(el.textContent || '').trim().slice(0, 18)}" l${Math.round(r.left - rb.left)} r${Math.round(r.right - rb.right)} b${Math.round(r.bottom - rb.bottom)}`);
  }
  const f = (b) => b ? [b.x, b.y, b.width, b.height].map(Math.round).join(',') : null;
  return { desk: document.documentElement.classList.contains('yk-desk'), pane: f(pane), screen: root ? root.getAttribute('data-yk') + '@' + f(rb) : 'none', sideways: document.documentElement.scrollWidth > innerWidth + 1, sticks: out.slice(0, 8), more: Math.max(0, out.length - 8) };
};
(async () => {
  await new Promise((r) => setTimeout(r, 900));
  const browser = await chromium.launch();
  for (const [w, h] of SIZES) for (const st of STATES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: SCHEME });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
    page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
    try {
      await page.goto(`http://127.0.0.1:${PORT}/?yktest&screen=${st.screen || SCREEN}&now=1761955200000${st.q}`);
      await page.waitForSelector('#yk-stage > .sc-host', { timeout: 15000 });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(500);
      for (const sel of st.taps || []) { await page.locator(sel).first().click({ timeout: 4000 }); await page.waitForTimeout(400); }
    } catch (e) { console.log(`${w}x${h} ${st.label}: could not open or tap: ${String(e).split('\n')[0]}`); await ctx.close(); continue; }
    const snap = async (name) => {
      await page.waitForTimeout(350);
      const file = path.join(OUT, `${SCREEN}-${name}-${w}x${h}.png`);
      await page.screenshot({ path: file });
      const m = await page.evaluate(measure);
      console.log(`${w}x${h} ${name}: ${file}\n   pane=${m.pane} screen=${m.screen}${m.desk ? '' : ' NOT-DESK'}${m.sideways ? ' PAGE-SCROLLS-SIDEWAYS' : ''}${m.sticks.length ? '\n   sticks out: ' + m.sticks.join(' | ') + (m.more ? ` (+${m.more})` : '') : ''}${errs.length ? '\n   ERRORS: ' + errs.splice(0).join(' | ') : ''}`);
    };
    await snap(st.label);
    for (const s of STEPS) {
      try {
        if (s.click) await page.locator(s.click).nth(s.nth || 0).click({ timeout: 4000 });
        else if (s.key) await page.keyboard.press(s.key);
        else if (s.wait) await page.waitForTimeout(s.wait);
        else if (s.eval) await page.evaluate(s.eval);
        else if (s.shot) await snap(st.label + '-' + s.shot);
      } catch (e) { console.log(`   step ${JSON.stringify(s)} failed: ${String(e).split('\n')[0]}`); }
    }
    await ctx.close();
  }
  await browser.close(); srv.kill();
})().catch((e) => { console.error(e); srv.kill(); process.exit(1); });
