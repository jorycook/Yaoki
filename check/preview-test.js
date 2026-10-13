// Smoke test of the preview variant (the app as a page inside Claude), wrapped in a stand-in for the host's page skeleton.
// usage: node preview-test.js   (serves ../yaoki-app/dist-test-preview itself on port 8766; PREVIEW_DIR names another build)
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');
// the level the app was built for (YK_LEVEL=N1 for the N1 app)
const LV = require('./level.js');
const DIR = path.join(__dirname, '..', 'yaoki-app', process.env.PREVIEW_DIR || 'dist-test-preview');
const PREACT = fs.readFileSync(path.join(__dirname, '..', 'yaoki-app', 'node_modules', 'preact', 'dist', 'preact.min.js'));
const fontsCss = fs.readFileSync(path.join(__dirname, 'site', 'fonts.css'), 'utf8');
const out = path.join(__dirname, 'out');
const TYPES = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.css': 'text/css' };
// the host wraps the page in a skeleton like this one: charset, a viewport with viewport-fit=cover, a small reset
const skeleton = (page) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${page}</body></html>`;
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') { res.writeHead(200, { 'content-type': TYPES['.html'] }); res.end(skeleton(fs.readFileSync(path.join(DIR, 'yaoki-app.html'), 'utf8'))); return; }
  const f = path.join(DIR, url);
  if (!f.startsWith(DIR) || !fs.existsSync(f)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  res.end(fs.readFileSync(f));
});
(async () => {
  await new Promise((r) => server.listen(8766, r));
  const browser = await chromium.launch();
  let fails = 0;
  const ok = (c, m) => { if (!c) { fails += 1; console.log('  FAIL: ' + m); } };
  for (const [name, w, h, ua] of [['phone', 390, 700, true], ['desktop', 1200, 820, false]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, ...(ua ? { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', hasTouch: true, isMobile: true } : {}) });
    const page = await ctx.newPage();
    const logs = [];
    const asked = [];
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.text().slice(0, 200)); });
    page.on('pageerror', (e) => logs.push('pageerror: ' + String(e).slice(0, 200)));
    page.on('request', (r) => asked.push(r.url()));
    await page.route('https://cdn.jsdelivr.net/**', (r) => r.fulfill({ contentType: 'text/javascript', body: PREACT }));
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ contentType: 'text/css', body: fontsCss }));
    // the stand-in font list points at the test harness's own font folder
    await page.route('http://localhost:8765/fonts/**', (r) => { const f = path.join(__dirname, 'node_modules', '@fontsource', new URL(r.request().url()).pathname.replace('/fonts/', '')); return fs.existsSync(f) ? r.fulfill({ contentType: 'font/woff2', body: fs.readFileSync(f) }) : r.abort(); });
    await page.goto('http://localhost:8766/');
    await page.waitForSelector('#yk-stage > .sc-host', { timeout: 10000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    const t = async () => ((await page.locator('#yk-stage').textContent()) || '').replace(/\s+/g, ' ');
    ok((await t()).includes('目標を決めよう'), name + ': should open on the goal screen, with no install page even on an iPhone');
    await page.locator('button:has-text("Paint the first eye")').first().click(); await page.waitForTimeout(400);
    await page.locator('a:has-text("Start")').first().click(); await page.waitForTimeout(700);
    ok((await t()).includes('原因・理由'), name + ': Start should reach the week path');
    await page.locator('button[aria-label^="Level ' + LV.LEVEL + '"]').first().click(); await page.waitForTimeout(500);
    ok((await t()).includes('preview'), name + ': the menu should show the preview build stamp');
    const r = await page.evaluate(() => { const b = document.querySelector('#yk-stage').getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), vw: innerWidth, vh: innerHeight, scroll: document.documentElement.scrollHeight, sw: !!navigator.serviceWorker && !!navigator.serviceWorker.controller }; });
    // on a short frame the design's empty top zone (42 of its 844 px) is left out above the frame; nothing else may stick out
    const topZone = Math.ceil(42 * r.w / 390) + 1;
    ok(r.x >= 0 && r.y >= -topZone && r.x + r.w <= r.vw && r.y + r.h <= r.vh + 1, name + ': the app should sit inside the frame, got ' + JSON.stringify(r));
    const top = await page.evaluate(() => Math.min(...[...document.querySelectorAll('#yk-stage button, #yk-stage h1, #yk-stage h2')].filter((e) => e.textContent.trim()).map((e) => e.getBoundingClientRect()).filter((b) => b.width && b.height).map((b) => b.top)));
    ok(top >= 0, name + ': nothing a learner sees may be cut off at the top, the highest control is at ' + top);
    ok(r.scroll <= r.vh + 1, name + ': the page should not scroll, got ' + JSON.stringify(r));
    ok(!asked.some((u) => /sw\.js/.test(u)), name + ': the preview should not ask for an offline worker');
    ok(logs.length === 0, name + ': console problems ' + JSON.stringify(logs.slice(0, 4)));
    await page.screenshot({ path: path.join(out, 'preview-' + name + '.png') });
    const outside = asked.filter((u) => !u.startsWith('http://localhost:8766/'));
    console.log(name + ': requests outside the page: ' + JSON.stringify([...new Set(outside.map((u) => new URL(u).host))]));
    await ctx.close();
  }
  await browser.close();
  server.close();
  console.log(fails ? 'PREVIEW TEST: ' + fails + ' problem(s)' : 'PREVIEW TEST PASS');
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
