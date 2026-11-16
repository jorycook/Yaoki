// Proves a screen still looks the same on a phone: screenshots it in the pre-change build and in the new one at phone sizes, light
// and dark, at rest (animations off in both), in its known states or after scripted steps, and compares the images byte for byte.
// Every desktop layout must leave the phone exactly as it was: run this against a build made before the change (or any earlier
// release build) for each screen whose template or layout changed. The build stamp is masked in both, and a pair that differs is
// taken again, up to three times, so that only a real change is reported.
// usage: NODE_PATH=/opt/npm-tools/node_modules node desk-phone.js --a <earlier build> --b <new build> --screens Drill,Main --out <dir>
//          [--level N2|N1]   every state of each screen listed in screen-states.js, instead of one opening
//          [--query '&plan=demo'] [--steps '<json list as for deskshot.js>'] [--ports 8901,8902] [--sizes 390x844,375x812,640x800]
const fs = require('fs'), path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const A = arg('a'), B = arg('b'), OUT = arg('out'), Q = arg('query', ''), STEPS = JSON.parse(arg('steps', '[]')), LEVEL = arg('level');
const SCREENS = arg('screens', 'Main').split(','), [PA, PB] = arg('ports', '8901,8902').split(',');
const SIZES = arg('sizes', '390x844,375x812,640x800').split(',').map((s) => s.split('x').map(Number));
fs.mkdirSync(OUT, { recursive: true });
if (LEVEL) process.env.YK_LEVEL = LEVEL;
const ALL = LEVEL ? require('./screen-states.js')(LEVEL).map(([screen, q, label, taps]) => ({ screen, q, label: label || 'default', taps: taps || [] })) : null;
const serve = (dir, port) => spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1', '--directory', dir], { stdio: 'ignore' });
const sa = serve(A, PA), sb = serve(B, PB);
(async () => {
  await new Promise((r) => setTimeout(r, 900));
  const browser = await chromium.launch();
  let bad = 0, n = 0;
  for (const screen of SCREENS) {
    let states = ALL ? ALL.filter((s) => s.screen === screen).map((s) => ({ ...s, q: s.q + Q })) : [];
    if (!states.length) states = [{ label: 'open', q: Q + (LEVEL === 'N1' ? '&plan=demo' : ''), taps: [] }];
    for (const st of states) for (const [w, h] of SIZES) for (const scheme of ['light', 'dark']) {
      /* a pair that differs is taken again (up to three times): a real change differs every time, the noise of a busy machine does not */
      let shots = [];
      for (let attempt = 0; attempt < 3 && (attempt === 0 || !shots[0].equals(shots[1])); attempt++) {
      shots = [];
      for (const [port, tag] of [[PA, 'a'], [PB, 'b']]) {
        const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, reducedMotion: 'reduce', deviceScaleFactor: 1, hasTouch: w < 600, isMobile: w < 600 });
        await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
        /* the writing pad plays its stroke order with a script, not CSS: its quick mode (yk-write.js) lets it finish before the shot */
        await ctx.addInitScript(() => { window.__ykWriteFast = true; });
        const page = await ctx.newPage();
        await page.goto(`http://127.0.0.1:${port}/?yktest&screen=${screen}&now=1761955200000${st.q}`);
        await page.waitForSelector('#yk-stage > .sc-host', { timeout: 15000 });
        await page.evaluate(() => document.fonts.ready);
        /* no animation or transition in either build, so the two are compared at rest, not mid-frame */
        await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }' });
        await page.waitForTimeout(500);
        for (const sel of st.taps || []) { try { await page.locator(sel).first().click({ timeout: 4000 }); await page.waitForTimeout(300); } catch (e) { console.log(`   ${tag} ${screen}/${st.label}: tap ${sel} failed`); } }
        for (const s of STEPS) {
          try {
            if (s.click) await page.locator(s.click).nth(s.nth || 0).click({ timeout: 4000 });
            else if (s.key) await page.keyboard.press(s.key);
            else if (s.wait) await page.waitForTimeout(s.wait);
            else if (s.eval) await page.evaluate(s.eval);
          } catch (e) { console.log(`   ${tag}: step ${JSON.stringify(s)} failed: ${String(e).split('\n')[0]}`); }
        }
        await page.waitForTimeout(700);
        /* the build stamp (the app's menu shows it) differs between any two builds: both sides show the same words instead; then a
           full repaint, so that rounded edges are drawn afresh in both builds rather than left from an earlier frame */
        await page.evaluate(() => {
          const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          for (let n = w.nextNode(); n; n = w.nextNode()) if (/prototype \d+(\.\d+)* · /.test(n.nodeValue)) n.nodeValue = 'Yaoki build';
          document.body.style.display = 'none'; void document.body.offsetHeight; document.body.style.display = '';
        });
        await page.waitForTimeout(150);
        const f = path.join(OUT, `${screen}-${st.label}-${w}x${h}-${scheme}-${tag}.png`);
        await page.screenshot({ path: f });
        shots.push(fs.readFileSync(f));
        await ctx.close();
      }
      }
      n++;
      if (!shots[0].equals(shots[1])) { bad++; console.log(`DIFFERENT ${screen}/${st.label} ${w}x${h} ${scheme}: ${path.join(OUT, `${screen}-${st.label}-${w}x${h}-${scheme}-{a,b}.png`)}`); }
    }
  }
  await browser.close(); sa.kill(); sb.kill();
  console.log(bad ? `${bad} of ${n} DIFFERENT` : `all ${n} identical`);
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); sa.kill(); sb.kill(); process.exit(1); });
