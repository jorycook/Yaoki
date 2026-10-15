// The two apps side by side, as GitHub Pages serves them: docs/ at /Yaoki/ (N5 to N2) and docs/n1/ at /Yaoki/n1/.
// Each keeps its own saved progress and its own offline copy, and neither app's offline worker answers for the other.
// usage: node two-apps-test.js   (serves ../docs itself on port 8767; ?sw lets the offline workers run on localhost)
// YK_DOCS names another folder laid out as docs/ is (the N5 to N2 app, and the N1 app in n1/), TWO_APPS_PORT another port.
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');
// the N1 course: a new plan starts with its first unit and the first lesson of it
const N1 = require('./level.js').course();
const N1_THEME = N1.units[0].ja;
const N1_LESSON = N1.lessons[0].grammar.patterns[0].p;

const DOCS = path.resolve(process.env.YK_DOCS || path.join(__dirname, '..', 'docs'));
const PORT = +(process.env.TWO_APPS_PORT || 8767);
const BASE = 'http://localhost:' + PORT + '/Yaoki/';
const TYPES = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain' };
const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (!url.startsWith('/Yaoki/')) { res.writeHead(404); res.end(); return; }
  url = url.slice('/Yaoki'.length);
  if (url.endsWith('/')) url += 'index.html';
  const f = path.join(DOCS, url);
  if (!f.startsWith(DOCS) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  res.end(fs.readFileSync(f));
});

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  let fails = 0;
  const ok = (c, m) => { if (!c) { fails += 1; console.log('  FAIL: ' + m); } };
  const logs = [];
  const open = async (where) => {
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') logs.push(where + ': ' + m.text().slice(0, 200)); });
    page.on('pageerror', (e) => logs.push(where + ': ' + String(e).slice(0, 200)));
    await page.goto(BASE + where);
    await page.waitForSelector('#yk-stage > .sc-host', { timeout: 15000 });
    await page.waitForTimeout(500);
    return page;
  };
  const text = async (page) => ((await page.locator('#yk-stage').textContent()) || '').replace(/\s+/g, ' ');
  const click = async (page, sel, wait = 600) => { await page.locator(sel).first().click({ timeout: 5000 }); await page.waitForTimeout(wait); };
  // wait until this page's own offline worker has stored the app and is in charge of the page
  // (an app in a folder below another is first controlled by the other's worker, whose scope holds it, until its own takes over)
  // (an app in a folder below another is first controlled by the other's worker, whose scope holds it, until its own
  // takes over; the app then restarts into its own copy by itself, which a reload here must not cut across)
  const stored = async (page) => {
    await page.waitForFunction(() => { const c = navigator.serviceWorker.controller; return !!c && c.scriptURL.split('?')[0] === new URL('sw.js', location.href).href && window.ykApp.offline() === 'yes'; }, null, { timeout: 60000 });
    await page.waitForTimeout(1500);
    await page.reload().catch(() => page.waitForLoadState('load'));
    await page.waitForSelector('#yk-stage > .sc-host');
  };

  // the N5 to N2 app: set the goal, so it opens on the week path from now on
  const n2 = await open('?sw');
  await stored(n2);
  await click(n2, 'button:has-text("Paint the first eye")');
  await click(n2, 'a:has-text("Start")', 800);
  ok((await text(n2)).includes('〜ばかりに'), 'N2 app: the week path should show the N2 lesson');

  // the N1 app at its own address: a fresh start, not the N2 app's progress
  const n1 = await open('n1/?sw');
  ok((await text(n1)).includes('目標を決めよう') && (await text(n1)).includes('N5〜N2は別のアプリです'), 'N1 app: should open on its own goal screen, got ' + (await text(n1)).slice(0, 80));
  await stored(n1);
  const scope = await n1.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => new URL(r.scope).pathname));
  ok(scope === '/Yaoki/n1/', 'N1 app: its offline worker should be its own, for /Yaoki/n1/, got ' + scope);
  await click(n1, 'button:has-text("Paint the first eye")');
  await click(n1, 'a:has-text("Start")', 800);
  ok((await text(n1)).includes(N1_THEME) && (await text(n1)).includes(N1_LESSON), 'N1 app: the week path should show the first N1 unit and lesson, ' + N1_THEME + ' and ' + N1_LESSON);

  const keys = await n1.evaluate(() => Object.keys(localStorage).sort());
  ok(JSON.stringify(keys) === JSON.stringify(['yaoki.v1:/Yaoki/', 'yaoki.v1:/Yaoki/n1/']), 'each app should keep its own saved progress, got ' + JSON.stringify(keys));
  const stores = await n1.evaluate(() => caches.keys());
  ok(stores.length === 2 && stores.some((k) => k.startsWith('yaoki:/Yaoki/:')) && stores.some((k) => k.startsWith('yaoki:/Yaoki/n1/:')), 'each app should keep its own offline copy, got ' + JSON.stringify(stores));

  // offline, each address still opens its own app where it was left
  await ctx.setOffline(true);
  await n1.reload();
  await n1.waitForSelector('#yk-stage > .sc-host');
  await n1.waitForTimeout(500);
  ok((await text(n1)).includes(N1_LESSON), 'offline: the N1 app should open on its week path');
  await n2.reload();
  await n2.waitForSelector('#yk-stage > .sc-host');
  await n2.waitForTimeout(500);
  ok((await text(n2)).includes('〜ばかりに'), 'offline: the N5 to N2 app should open on its week path');
  ok((await n2.evaluate(() => window.__ykBuild)).startsWith('Yaoki prototype') && (await n1.evaluate(() => window.__ykBuild)).startsWith('Yaoki N1 prototype'), 'each address should have its own build');
  await ctx.setOffline(false);

  // starting over in one app leaves the other alone
  await click(n1, 'button[aria-label^="Level N1"]', 500);
  await click(n1, 'button:has-text("Start over")', 300);
  await click(n1, 'button:has-text("Start over")', 600);
  const left = await n1.evaluate(() => ({ n2: JSON.parse(localStorage.getItem('yaoki.v1:/Yaoki/') || 'null'), n1: JSON.parse(localStorage.getItem('yaoki.v1:/Yaoki/n1/') || 'null') }));
  ok(left.n2 && left.n2.started === true && (!left.n1 || left.n1.started === false), 'Start over in the N1 app should clear only its own progress, left ' + JSON.stringify(left).slice(0, 200));

  ok(logs.length === 0, 'console problems: ' + JSON.stringify(logs.slice(0, 5)));
  await browser.close();
  server.close();
  console.log(fails ? 'TWO APPS TEST: ' + fails + ' problem(s)' : 'TWO APPS TEST PASS');
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
