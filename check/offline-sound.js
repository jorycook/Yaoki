// The offline copy stores each level's unit sound only once that level is chosen (sw.js): the install holds no
// unit sound, the app's request for a level stores all of its units, other levels stay out, a stored unit
// plays offline, and a new build keeps unchanged sound files without fetching them again.
// YK_LEVEL=N1: the same for the N1 app's clips (assets/audio/*.mp3): none in the install, a clip played once is
// stored, the app's request (made once there is a plan) stores all of them, and offline a stored clip plays while
// one never stored does not load.
// usage: node offline-sound.js   (serves yaoki-app/dist itself on port 8767; for N1 yaoki-app/dist-n1.
// YK_DIST names another build folder in yaoki-app, OFFLINE_PORT another port)
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { chromium } = require('playwright');
const N1 = process.env.YK_LEVEL === 'N1';
const DIST = path.join(__dirname, '..', 'yaoki-app', process.env.YK_DIST || (N1 ? 'dist-n1' : 'dist'));
const PORT = +(process.env.OFFLINE_PORT || 8767);

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
    if (N1) {
      const clips = fs.readdirSync(path.join(DIST, 'assets', 'audio')).filter((f) => /\.mp3$/.test(f)).sort();
      const count = (urls) => urls.filter((u) => /\/assets\/audio\/[^/]+\.mp3\?h=/.test(u)).length;
      const load = (f) => page.evaluate((u) => fetch(u).then(async (r) => r.ok && (await r.arrayBuffer()).byteLength > 1000, () => false), './assets/audio/' + f);
      let urls = await list();
      ok(clips.length > 600 && count(urls) === 0 && urls.some((u) => /\/assets\/audio\/clips\.js/.test(u)), `the install should hold the list of clips and none of the ${clips.length} clips, got ${count(urls)}`);
      // a clip played once is stored
      ok(await load(clips[0]), 'online, a clip should load');
      urls = await list();
      ok(count(urls) === 1, 'a clip used once should be stored, got ' + count(urls));
      server.kill(); await new Promise((r) => setTimeout(r, 500));
      ok(await load(clips[0]), 'offline, the stored clip should load');
      ok(!(await load(clips[1])), 'offline, a clip that was never stored should not load');
      // the app's request, once there is a plan, stores all of them
      server = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', DIST], { stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 800));
      await page.evaluate(() => navigator.serviceWorker.controller.postMessage({ keepLevel: 'n1' }));
      for (let i = 0; i < 120 && count(urls) < clips.length; i++) { await page.waitForTimeout(500); urls = await list(); }
      ok(count(urls) === clips.length, `asking for N1 should store all ${clips.length} clips, got ${count(urls)}`);
      server.kill(); await new Promise((r) => setTimeout(r, 500));
      const some = [clips[1], clips[Math.floor(clips.length / 2)], clips[clips.length - 1]];
      const got = [];
      for (const f of some) got.push(await load(f));
      ok(got.every(Boolean), 'offline, clips stored in the background should load, got ' + JSON.stringify(got));
      console.log(`stored: ${count(urls)} of ${clips.length} clips`);
    } else {
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
    }
  } catch (e) { fails += 1; console.log('  CRASH ' + e.message); }
  await browser.close();
  server.kill();
  console.log(fails ? `OFFLINE SOUND FAIL (${fails})` : 'OFFLINE SOUND PASS');
  process.exit(fails ? 1 : 0);
})();
