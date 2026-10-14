// The offline copy stores each level's unit sound only once that level is chosen (sw.js): the install holds no
// unit sound, the app's request for a level stores all of its units, other levels stay out, a stored unit
// plays offline, and a new build keeps unchanged sound files without fetching them again.
// usage: node offline-sound.js   (serves yaoki-app/dist itself on port 8767)
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { chromium } = require('playwright');
const DIST = path.join(__dirname, '..', 'yaoki-app', 'dist');
const PORT = 8767;

(async () => {
  let server = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', DIST], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  let fails = 0;
  const ok = (c, m) => { if (!c) { fails += 1; console.log('  FAIL: ' + m); } };
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto(`http://localhost:${PORT}/?sw`);
    await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 60000 }).catch(async () => {
      await page.reload();
      await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 60000 });
    });
    const list = () => page.evaluate(async () => { const out = []; for (const k of await caches.keys()) { const c = await caches.open(k); (await c.keys()).forEach((r) => out.push(r.url)); } return out; });
    const units = (urls, lv) => urls.filter((u) => u.includes('sound-course-' + lv + '-u')).length;
    let urls = await list();
    ok(units(urls, 'n5') + units(urls, 'n4') + units(urls, 'n3') === 0, 'the install should hold no unit sound, got ' + (units(urls, 'n5') + units(urls, 'n4') + units(urls, 'n3')));
    await page.evaluate(() => navigator.serviceWorker.controller.postMessage({ keepLevel: 'n5' }));
    const want = fs.readdirSync(path.join(DIST, 'assets')).filter((f) => /^sound-course-n5-u\d+\.js$/.test(f)).length;
    for (let i = 0; i < 60 && units(urls, 'n5') < want; i++) { await page.waitForTimeout(500); urls = await list(); }
    ok(units(urls, 'n5') === want, `asking for N5 should store all ${want} N5 unit files, got ${units(urls, 'n5')}`);
    ok(units(urls, 'n4') === 0 && units(urls, 'n3') === 0, 'other levels should stay out of the store');
    /* offline: the server goes away (Playwright's offline switch does not reach a service worker's own fetches) */
    server.kill(); await new Promise((r) => setTimeout(r, 500));
    const got = await page.evaluate(async () => { const a = await fetch('./assets/sound-course-n5-u03.js'); const b = await fetch('./assets/sound-course-n4-u03.js').then((r) => r.ok, () => false); return { a: a.ok && (await a.text()).includes('__ykClips'), b }; });
    ok(got.a, 'offline, a stored N5 unit file should load');
    ok(!got.b, 'offline, an N4 unit file that was never stored should not load');
    server = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', DIST], { stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 800));
    // a used unit of another level is stored on first use
    await page.evaluate(() => fetch('./assets/sound-course-n4-u02.js').then((r) => r.text()));
    urls = await list();
    ok(units(urls, 'n4') === 1, 'a unit file used once should be stored, got ' + units(urls, 'n4'));
    console.log(`stored: n5 ${units(urls, 'n5')}, n4 ${units(urls, 'n4')}, n3 ${units(urls, 'n3')}`);
  } catch (e) { fails += 1; console.log('  CRASH ' + e.message); }
  await browser.close();
  server.kill();
  console.log(fails ? `OFFLINE SOUND FAIL (${fails})` : 'OFFLINE SOUND PASS');
  process.exit(fails ? 1 : 0);
})();
