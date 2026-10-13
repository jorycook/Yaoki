// Checks that belong to the installable app only: saved progress, the menu, the Add to Home Screen page,
// fitting the design to different phones, working offline and picking up a new build.
// usage: bash run-app.sh app-test.js      (expects the test build of the app served on localhost:8765)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium, devices } = require('playwright');
// the level the app was built for (YK_LEVEL=N1 for the N1 app): its name, its menu chip and a few words of its lessons
const LV = require('./level.js');

const BASE = 'http://localhost:8765/';
const out = path.join(__dirname, 'out');
const APPDIR = path.join(__dirname, '..', 'yaoki-app');
const TESTDIR = path.join(APPDIR, 'dist-test');
// saved progress is kept under the folder the app is served from
const KEY = 'yaoki.v1:/';
const SCREENS = ['Goal', 'Main', 'Today', 'Teach', 'Compare', 'Drill', 'Star', 'Exam', 'Scene', 'Reading', 'WeekTest', 'Notebook', 'Review', 'Mock', 'MockRun', 'Readiness', 'Listening'];
let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails += 1; console.log('  FAIL: ' + msg); } };
const note = (msg) => console.log(msg);
const rebuild = (env) => execFileSync('node', ['build.mjs'], { cwd: APPDIR, env: { ...process.env, NODE_PATH: '/opt/npm-tools/node_modules', YK_OUT: 'dist-test', ...env }, stdio: 'ignore' });

async function ready(page) {
  await page.waitForSelector('#yk-stage > .sc-host', { timeout: 10000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350);
}
const text = async (page) => ((await page.locator('#yk-stage').textContent()) || '').replace(/\s+/g, ' ');
const click = async (page, sel, wait = 450) => { await page.locator(sel).first().click({ timeout: 5000 }); await page.waitForTimeout(wait); };
const saved = async (page) => JSON.parse((await page.evaluate((k) => localStorage.getItem(k), KEY)) || 'null');
const watch = (page, logs) => {
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text().slice(0, 200)); });
  page.on('pageerror', (e) => logs.push('pageerror: ' + String(e).slice(0, 200)));
};
// where the design sits on the screen, and the highest thing in it that a learner can see
const placed = (page) => page.evaluate(() => {
  const stage = document.querySelector('#yk-stage');
  const b = stage.getBoundingClientRect();
  const nav = stage.querySelector('nav');
  let top = Infinity;
  let what = '';
  const walker = document.createTreeWalker(stage, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.nodeValue.trim()) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) if (r.width && r.height && r.top < top) { top = r.top; what = n.nodeValue.trim().slice(0, 20); }
  }
  for (const el of stage.querySelectorAll('button, a, svg')) {
    const r = el.getBoundingClientRect();
    if (r.width && r.height && r.top < top) { top = r.top; what = el.tagName.toLowerCase() + ' ' + (el.getAttribute('aria-label') || ''); }
  }
  const cls = document.documentElement.classList;
  return { x: b.x, y: b.y, w: b.width, h: b.height, bottom: b.bottom, navBottom: nav ? nav.getBoundingClientRect().bottom : null, top, what, boxed: cls.contains('yk-boxed'), sideways: cls.contains('yk-sideways') };
});

(async () => {
  const browser = await chromium.launch();

  // ---------- 1. progress is saved and comes back ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const logs = [];
    watch(page, logs);
    await page.addInitScript(() => {
      window.__audio = [];
      const P = window.AudioBufferSourceNode && window.AudioBufferSourceNode.prototype;
      if (P) { const start = P.start; P.start = function (...a) { window.__audio.push(this.buffer ? Math.round(this.buffer.duration * 1000) : 0); return start.apply(this, a); }; }
      window.__locks = [];
      if (navigator.wakeLock && navigator.wakeLock.request) {
        const req = navigator.wakeLock.request.bind(navigator.wakeLock);
        navigator.wakeLock.request = (t) => { window.__locks.push(t); return req(t); };
      }
    });
    await page.goto(BASE);
    await ready(page);
    ok((await text(page)).includes('目標を決めよう'), 'first visit should open on the goal screen');
    ok((await saved(page)) === null, 'nothing should be saved before the first tap');
    ok((await page.evaluate(() => Object.keys(localStorage))).length === 0, 'nothing at all should be left in storage before the first tap, got ' + JSON.stringify(await page.evaluate(() => Object.keys(localStorage))));
    await click(page, 'button:has-text("Paint the first eye")');
    await click(page, 'a:has-text("Start")', 700);
    ok((await text(page)).includes('原因・理由'), 'Start should lead to the week path');
    await click(page, 'a:has-text("はじめる")', 700);
    await click(page, 'a:has-text("Start with the teach page")', 700);
    await click(page, 'a:has-text("Next")', 700);
    await click(page, 'a:has-text("Start the drill")', 700);
    await click(page, 'button:has-text("' + LV.drillWrong + '")');
    await click(page, 'button:has-text("Check")', 600);
    ok((await text(page)).includes('Saved to your mistake notebook'), 'the drill should record the mistake');
    const s1 = await saved(page);
    ok(s1 && s1.started === true && s1.mistakes.length === 1 && s1.mistakes[0].src === 'drill', 'saved state should hold the goal and one mistake, got ' + JSON.stringify(s1).slice(0, 200));
    await page.reload();
    await ready(page);
    ok((await text(page)).includes('原因・理由') && !(await text(page)).includes('目標を決めよう'), 'after closing and reopening, the app should open on the week path');
    await click(page, 'nav a:has-text("Notebook")', 600);
    ok((await text(page)).includes(LV.drillLine) && (await text(page)).includes(LV.drillWrong), 'the saved mistake should be in the notebook after reopening');
    await page.screenshot({ path: path.join(out, 'app-notebook-restored.png') });

    // ---------- 2. the menu ----------
    await click(page, 'nav a:has-text("Path")', 600);
    await click(page, 'button[aria-label^="Level ' + LV.LEVEL + '"]', 500);
    ok((await text(page)).includes('メニュー') && (await text(page)).includes('Sound check'), 'the level chip should open the menu');
    ok((await text(page)).includes('saved on this device only'), 'the menu should say where progress is kept');
    ok(!(await text(page)).includes('offline'), 'with no offline copy asked for, the menu should not talk about offline use');
    await page.screenshot({ path: path.join(out, 'app-menu.png') });
    await click(page, 'button[aria-label="Play the test sound"]', 400);
    ok((await page.evaluate(() => window.__audio)).some((d) => Math.abs(d - 3540) < 120), 'the menu sound check should play the test clip, got ' + JSON.stringify(await page.evaluate(() => window.__audio)));
    await page.waitForTimeout(3900);
    ok((await text(page)).includes('check the silent switch'), 'after the test sound the note should say what to check');
    await click(page, 'button:has-text("Start over")', 400);
    ok((await text(page)).includes('最初からやり直しますか'), 'Start over should ask first');
    await page.screenshot({ path: path.join(out, 'app-menu-confirm.png') });
    await click(page, 'button:has-text("Cancel")', 300);
    ok((await text(page)).includes('Sound check'), 'Cancel should return to the menu');
    await click(page, 'button:has-text("Start over")', 300);
    await click(page, 'button:has-text("Start over")', 600);
    ok((await text(page)).includes('目標を決めよう') && !(await text(page)).includes('メニュー'), 'Start over should return to the goal screen');
    await page.reload();
    await ready(page);
    ok((await text(page)).includes('目標を決めよう'), 'after Start over, reopening should show the goal screen');
    const after = await saved(page);
    ok(!after || after.started === false, 'Start over should leave no started state saved, got ' + JSON.stringify(after));

    // ---------- 3. the screen stays awake in the mock ----------
    await click(page, 'button:has-text("Paint the first eye")');
    await click(page, 'a:has-text("Start")', 700);
    await click(page, 'nav a:has-text("Mock exam")', 600);
    ok((await page.evaluate(() => window.__locks.length)) === 0, 'no wake lock outside listening screens');
    await click(page, 'a:has-text("Start")', 600);
    ok((await page.evaluate(() => window.__locks.length)) >= 1, 'the mock should ask to keep the screen awake');
    const tint = () => page.evaluate(() => document.querySelector('meta[name="theme-color"]').getAttribute('content'));
    ok((await tint()) === '#1B2440', 'in the mock the status-bar strip should take the ink of the band, got ' + (await tint()));
    await click(page, 'a[aria-label="Back to the mock exam tab"]', 600);
    ok((await tint()) === '#F4F5F9', 'outside the mock the status-bar strip should be the ground colour, got ' + (await tint()));
    ok(page.url() === BASE, 'the app should never leave its address, at ' + page.url());
    ok(logs.length === 0, 'console problems: ' + JSON.stringify(logs.slice(0, 5)));
    await ctx.close();
    note('saved progress, menu, wake lock: checked');
  }

  // ---------- 4. the Add to Home Screen page on an iPhone ----------
  {
    const ctx = await browser.newContext({ ...devices['iPhone 14'] });
    const page = await ctx.newPage();
    const logs = [];
    watch(page, logs);
    await page.goto(BASE);
    await ready(page);
    const t = await text(page);
    ok(t.includes('Add ' + LV.appName + ' to your Home Screen') && t.includes('Tap Share'), 'Safari on an iPhone should get the Add to Home Screen page');
    ok(t.includes('on this iPhone'), 'the install page should name the device');
    const box = await page.evaluate(() => { const r = document.querySelector('#yk-stage').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), vw: innerWidth, vh: innerHeight, sh: document.querySelector('#yk-stage > .sc-host > div').scrollHeight, ch: document.querySelector('#yk-stage > .sc-host > div').clientHeight }; });
    ok(box.w === box.vw && Math.abs(box.h - box.vh) <= 1, 'the install page should fill the browser, got ' + JSON.stringify(box));
    ok(box.sh <= box.ch + 1, 'the install page should fit without scrolling on an iPhone 14 in Safari, got ' + JSON.stringify(box));
    await page.screenshot({ path: path.join(out, 'app-install-iphone14.png') });
    await click(page, 'button:has-text("Continue in the browser")', 600);
    ok((await text(page)).includes('目標を決めよう'), 'Continue in the browser should open the app');
    await page.screenshot({ path: path.join(out, 'app-browser-iphone14.png') });
    await page.reload();
    await ready(page);
    ok((await text(page)).includes('目標を決めよう'), 'the install page should not come back in the same visit');
    ok(logs.length === 0, 'console problems on iPhone: ' + JSON.stringify(logs.slice(0, 5)));
    await ctx.close();

    // from the Home Screen icon there is no install page
    const ctx2 = await browser.newContext({ ...devices['iPhone 14'], viewport: { width: 390, height: 844 } });
    const page2 = await ctx2.newPage();
    await page2.addInitScript(() => { Object.defineProperty(navigator, 'standalone', { get: () => true }); });
    await page2.goto(BASE);
    await ready(page2);
    ok((await text(page2)).includes('目標を決めよう'), 'opened from the Home Screen, the app should start at once');
    await page2.screenshot({ path: path.join(out, 'app-standalone-iphone14.png') });
    await ctx2.close();

    // a short phone: the install page scrolls instead of squeezing
    const ctx3 = await browser.newContext({ ...devices['iPhone SE'] });
    const page3 = await ctx3.newPage();
    await page3.goto(BASE);
    await ready(page3);
    await page3.screenshot({ path: path.join(out, 'app-install-se.png') });
    ok((await text(page3)).includes('Continue in the browser'), 'install page on a short phone');
    await ctx3.close();

    // an iPad says iPad
    const ctx4 = await browser.newContext({ ...devices['iPad (gen 7)'] });
    const page4 = await ctx4.newPage();
    await page4.goto(BASE);
    await ready(page4);
    ok((await text(page4)).includes('on this iPad'), 'the install page on an iPad should say iPad');
    await ctx4.close();
    note('Add to Home Screen page: checked');
  }

  // ---------- 5. the design fills every recent iPhone ----------
  {
    const phone = (w, h) => browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    const sizes = [['iPhone 13 mini', 375, 812], ['iPhone 14', 390, 844], ['iPhone 15/16', 393, 852], ['iPhone 16 Pro', 402, 874], ['iPhone 11', 414, 896], ['iPhone 14 Plus', 428, 926], ['iPhone 15 Pro Max', 430, 932], ['iPhone 16 Pro Max', 440, 956]];
    for (const [name, w, h] of sizes) {
      const ctx = await phone(w, h);
      const page = await ctx.newPage();
      await page.goto(BASE + '?yktest&screen=Main');
      await ready(page);
      const r = await placed(page);
      ok(Math.abs(r.x) < 0.5 && Math.abs(r.y) < 0.5 && Math.abs(r.w - w) < 0.5 && Math.abs(r.h - h) < 0.5, `${name} ${w}x${h}: the design should fill the screen exactly, got ${JSON.stringify(r)}`);
      ok(Math.abs(r.navBottom - h) < 0.6, `${name}: the tab bar should end at the bottom edge, got ${r.navBottom}`);
      if (w === 402 || w === 440 || w === 375) await page.screenshot({ path: path.join(out, `app-fit-${w}x${h}.png`) });
      await ctx.close();
    }

    // when the system keeps a strip for the status bar, the design gives up its own empty top zone instead of shrinking
    const strips = [['iPhone 13 mini', 375, 812, 50], ['iPhone 14', 390, 844, 47], ['iPhone 15/16', 393, 852, 59], ['iPhone 16 Pro', 402, 874, 62], ['iPhone Air', 420, 912, 68], ['iPhone 14 Plus', 428, 926, 47], ['iPhone 15 Pro Max', 430, 932, 59], ['iPhone 16 Pro Max', 440, 956, 62]];
    for (const [name, w, full, bar] of strips) {
      const h = full - bar;
      const ctx = await phone(w, h);
      const page = await ctx.newPage();
      await page.goto(BASE + '?yktest&screen=Main');
      await ready(page);
      const r = await placed(page);
      const squeeze = (r.h / 844) / (r.w / 390);
      ok(Math.abs(r.x) < 0.5 && Math.abs(r.w - w) < 0.5, `${name} under a ${bar} px status bar: the design should keep the full width, got ${JSON.stringify(r)}`);
      ok(Math.abs(r.bottom - h) < 0.6 && Math.abs(r.navBottom - h) < 0.6, `${name} under a status bar: the tab bar should end at the bottom edge, got ${JSON.stringify(r)}`);
      ok(r.y < 0 && r.y >= -42 * (w / 390) - 0.5, `${name} under a status bar: only the empty top zone may be left out, got y=${r.y}`);
      ok(squeeze > 0.9695 && squeeze < 1.0005, `${name} under a status bar: proportions should stay within 3%, got ${squeeze.toFixed(4)}`);
      ok(r.top >= 0, `${name} under a status bar: nothing a learner sees may be cut off at the top, "${r.what}" is at ${r.top}`);
      ok(!r.boxed && !r.sideways, `${name} under a status bar: no frame and no sideways note`);
      if (w === 393 || w === 375 || w === 420) await page.screenshot({ path: path.join(out, `app-strip-${w}x${h}.png`) });
      await ctx.close();
    }
    // every screen keeps its content clear of the top edge at the tightest of those sizes
    {
      const ctx = await phone(393, 793);
      const page = await ctx.newPage();
      for (const name of SCREENS) {
        await page.goto(BASE + '?yktest&screen=' + name);
        await ready(page);
        const r = await placed(page);
        ok(r.top >= 0, `${name} at 393x793: "${r.what}" is cut off at the top (${r.top.toFixed(1)})`);
        ok(Math.abs(r.bottom - 793) < 0.6, `${name} at 393x793: the design should end at the bottom edge, got ${r.bottom}`);
      }
      await ctx.close();
    }

    // much shorter screens (an older phone, Safari with its bars): the empty top zone is left out and the rest is as large as the height allows
    for (const [name, w, h] of [['iPhone SE from the Home Screen', 375, 647], ['iPhone SE in Safari', 375, 553], ['Safari tab on iPhone 14', 390, 664], ['a small old phone', 320, 548]]) {
      const ctx = await phone(w, h);
      const page = await ctx.newPage();
      await page.goto(BASE + '?yktest&screen=Main');
      await ready(page);
      const r = await placed(page);
      const k = r.w / 390;
      ok(Math.abs(r.w / r.h - 390 / 844) < 0.002, `${name}: proportions should be kept, got ${JSON.stringify(r)}`);
      ok(Math.abs(k - h / 802) < 0.002, `${name}: the design without its top zone should be as tall as the screen, scale ${k.toFixed(4)} against ${(h / 802).toFixed(4)}`);
      ok(Math.abs(r.bottom - h) < 0.6 && Math.abs(r.navBottom - h) < 0.6 && Math.abs(r.y + 42 * k) < 0.6, `${name}: only the empty top zone may be left out, and the tab bar should end at the bottom edge, got ${JSON.stringify(r)}`);
      ok(r.x >= -0.5 && Math.abs((r.x * 2 + r.w) - w) < 1, `${name}: the design should be centred sideways, got ${JSON.stringify(r)}`);
      ok(r.top >= 0, `${name}: nothing a learner sees may be cut off at the top, "${r.what}" is at ${r.top}`);
      ok(!r.boxed && !r.sideways, `${name}: no frame and no sideways note`);
      if (w === 375 && h === 647) await page.screenshot({ path: path.join(out, `app-fit-${w}x${h}.png`) });
      await page.locator('nav a:has-text("Notebook")').first().tap({ timeout: 4000 });
      await page.waitForTimeout(500);
      ok((await text(page)).includes('間違いノート'), `${name}: a tap on the tab bar should work at this size`);
      await ctx.close();
    }

    // wide windows show the whole design in proportion, centred, in a phone frame
    for (const [name, w, h] of [['laptop', 1280, 800], ['wide window', 844, 390], ['tablet upright', 810, 1080]]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      await page.goto(BASE + '?yktest&screen=Main');
      await ready(page);
      const r = await placed(page);
      ok(Math.abs(r.w / r.h - 390 / 844) < 0.002, `${name}: proportions should be kept, got ${JSON.stringify(r)}`);
      ok(r.x >= -0.5 && r.y >= -0.5 && r.x + r.w <= w + 0.5 && r.y + r.h <= h + 0.5, `${name}: the design should be inside the window, got ${JSON.stringify(r)}`);
      ok(Math.abs((r.x * 2 + r.w) - w) < 1 && Math.abs((r.y * 2 + r.h) - h) < 1, `${name}: the design should be centred, got ${JSON.stringify(r)}`);
      ok(r.boxed, `${name}: phone frame expected`);
      ok(!r.sideways, `${name}: no sideways note without a touch screen`);
      if (name === 'laptop') await page.screenshot({ path: path.join(out, `app-fit-${w}x${h}.png`) });
      // taps still land where they should when the design is scaled
      await page.locator('nav a:has-text("Notebook")').first().click({ timeout: 4000 });
      await page.waitForTimeout(500);
      ok((await text(page)).includes('間違いノート'), `${name}: a click on the tab bar should work at this size`);
      await ctx.close();
    }

    // a phone held sideways gets a note, and the app comes back when it is turned upright
    {
      const ctx = await phone(844, 390);
      const page = await ctx.newPage();
      await page.goto(BASE + '?yktest&screen=Main');
      await ready(page);
      const side = await page.evaluate(() => ({ cls: document.documentElement.classList.contains('yk-sideways'), card: getComputedStyle(document.querySelector('#yk-sideways')).display, text: document.querySelector('#yk-sideways').textContent, view: getComputedStyle(document.querySelector('#yk-view')).visibility }));
      ok(side.cls && side.card === 'flex' && side.view === 'hidden' && side.text.includes('Turn the phone upright'), 'a phone held sideways should show the note, got ' + JSON.stringify(side));
      await page.screenshot({ path: path.join(out, 'app-sideways.png') });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(500);
      const up = await placed(page);
      ok(!up.sideways && Math.abs(up.w - 390) < 0.5 && Math.abs(up.h - 844) < 0.5 && Math.abs(up.y) < 0.5, 'turned upright again, the app should fill the screen, got ' + JSON.stringify(up));
      ok((await page.evaluate(() => getComputedStyle(document.querySelector('#yk-sideways')).display)) === 'none', 'turned upright again, the note should go');
      await ctx.close();
    }
    note('screen sizes: checked');
  }

  // ---------- 6. offline, and picking up a new build ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const logs = [];
    watch(page, logs);
    await page.goto(BASE + '?sw');
    await ready(page);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });
    const stored = await page.evaluate(async () => { const keys = await caches.keys(); const c = await caches.open(keys[0]); return { keys, urls: (await c.keys()).map((r) => r.url) }; });
    const sw = fs.readFileSync(path.join(TESTDIR, 'sw.js'), 'utf8');
    const listed = JSON.parse(sw.match(/const FILES = (\[[\s\S]*?\]);/)[1]).length;
    const version = sw.match(/const VERSION = '([0-9a-f]+)'/)[1];
    ok(stored.keys.length === 1 && stored.keys[0] === 'yaoki:/:' + version, 'the offline copy should be one store named after the folder and the version, got ' + JSON.stringify(stored.keys));
    ok(stored.urls.length === listed, `the offline copy should hold all ${listed} files, got ${stored.urls.length}`);
    ok(stored.urls.every((u) => u.includes('v=' + version)), 'every stored file should have been asked for under this version, got ' + JSON.stringify(stored.urls.filter((u) => !u.includes('v=' + version)).slice(0, 3)));
    const v1 = await page.evaluate(() => window.__ykBuild);
    // an address in the app's own folder opens the app; one in a folder below it is left to whatever lives there
    {
      const other = await ctx.newPage();
      const inside = await other.goto(BASE + 'anything-here');
      ok(inside.status() === 200 && (await other.locator('#yk-stage').count()) === 1, 'an unknown address in the app folder should open the app, got ' + inside.status());
      const below = await other.goto(BASE + 'n1/');
      ok(below.status() === 404, 'an address in a folder below the app should not be answered with the app page, got ' + below.status());
      await other.close();
    }
    await click(page, 'button:has-text("Paint the first eye")');
    await click(page, 'a:has-text("Start")', 700);
    await click(page, 'button[aria-label^="Level ' + LV.LEVEL + '"]', 500);
    ok((await text(page)).includes('The app is stored for offline use.'), 'once the offline copy is in, the menu should say so');
    await click(page, 'button:has-text("Close")', 400);
    await ctx.setOffline(true);
    await page.reload();
    await ready(page);
    ok((await text(page)).includes('原因・理由'), 'offline, the app should still open (on the week path, since the goal was set)');
    // a typeface is fetched the first time a screen uses it: ask for all five cuts while offline
    const fontsOk = await page.evaluate(async () => {
      const wants = ["500 16px 'M PLUS Rounded 1c'", "700 16px 'M PLUS Rounded 1c'", "800 16px 'M PLUS Rounded 1c'", "400 16px 'Klee One'", "600 16px 'Klee One'"];
      const got = [];
      for (const w of wants) { try { const faces = await document.fonts.load(w, '原因と理由'); got.push(faces.length === 1 && faces[0].status === 'loaded'); } catch (e) { got.push(false); } }
      return got;
    });
    ok(fontsOk.every(Boolean), 'offline, all five font files should load from the stored copy, got ' + JSON.stringify(fontsOk));
    await click(page, 'a:has-text("はじめる")', 700);
    await click(page, 'a:has-text("Start with the teach page")', 700);
    const played = await page.evaluate(async () => { const s = window.ykSound; s.unlock(); const okPlay = s.play('t_ex1'); await new Promise((r) => setTimeout(r, 900)); return okPlay && s.on(); });
    ok(played, 'offline, a clip should still play');
    await page.screenshot({ path: path.join(out, 'app-offline-teach.png') });
    ok(logs.filter((l) => !/Failed to load resource/.test(l)).length === 0, 'console problems offline: ' + JSON.stringify(logs.slice(0, 5)));
    await ctx.setOffline(false);

    // a new build: the stored copy is replaced and the app restarts into it at a quiet moment
    rebuild({ YK_APP_VERSION: '0.1-test-update', YK_BUILD_DATE: 'update test' });
    await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update()));
    await page.waitForTimeout(2500);
    // still on the teach page: no restart in the middle of a lesson
    ok((await page.evaluate(() => window.__ykBuild)) === v1, 'a new build should not restart the app in the middle of a lesson');
    ok((await text(page)).includes(LV.teachTitle), 'the lesson should still be up while the new build waits');
    await click(page, 'a[aria-label="Close lesson"]', 600);
    await click(page, 'a[aria-label="Back to the week path"]', 600);
    await page.waitForFunction((old) => window.__ykBuild && window.__ykBuild !== old, v1, { timeout: 15000 }).catch(() => {});
    await ready(page);
    const v2 = await page.evaluate(() => window.__ykBuild);
    ok(v2 !== v1 && /0\.1-test-update/.test(v2), `back on the week path the app should restart into the new build, was "${v1}", now "${v2}"`);
    ok((await text(page)).includes('原因・理由'), 'after the restart the app should be on the week path with progress kept');
    const caches2 = await page.evaluate(() => caches.keys());
    ok(caches2.length === 1 && caches2[0] !== stored.keys[0], 'the old stored copy should be removed, got ' + JSON.stringify(caches2));

    // a newer build found just as the app opens, before anything is tapped, is switched to at once
    rebuild({ YK_APP_VERSION: '0.1-test-update-2', YK_BUILD_DATE: 'update test' });
    await page.reload();
    await page.waitForFunction((old) => window.__ykBuild && window.__ykBuild !== old, v2, { timeout: 15000 }).catch(() => {});
    await ready(page);
    const v3 = await page.evaluate(() => window.__ykBuild);
    ok(/0\.1-test-update-2/.test(v3), `opened with a newer build waiting, the app should switch to it before the first tap, was "${v2}", now "${v3}"`);
    ok((await text(page)).includes('原因・理由'), 'after that switch the app should still be on the week path');

    // another app kept in a different folder of the same site must not lose its store when this one updates
    await page.evaluate(() => caches.open('yaoki:/n1/:abc').then((c) => c.put('/n1/x', new Response('x'))));
    rebuild({ YK_APP_VERSION: '0.1-test-update-3', YK_BUILD_DATE: 'update test' });
    await page.reload();
    await page.waitForFunction((old) => window.__ykBuild && window.__ykBuild !== old, v3, { timeout: 15000 }).catch(() => {});
    await ready(page);
    const caches3 = await page.evaluate(() => caches.keys());
    ok(caches3.includes('yaoki:/n1/:abc') && caches3.filter((k) => k.startsWith('yaoki:/:')).length === 1, 'an update should replace only its own store, got ' + JSON.stringify(caches3));
    ok(logs.filter((l) => !/Failed to load resource/.test(l)).length === 0, 'console problems during updates: ' + JSON.stringify(logs.slice(0, 5)));
    await ctx.close();
    // put the normal test build back
    rebuild({ YK_BUILD_DATE: 'test build' });
    note('offline and update: checked');
  }

  await browser.close();
  console.log(fails ? `APP TEST: ${fails} problem(s)` : 'APP TEST PASS');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
