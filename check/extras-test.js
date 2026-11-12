// The app's extras (おまけ): Yaoki Speaking and Yaoki Reader opened from the installed app, as optional practice.
// The app's test build is served at /Yaoki/ with the site's other pages beside it (docs/speaking, docs/reader and
// docs/typing, which the speaking game uses), as GitHub Pages serves them. Checks: the Extras tab on the week path; the
// two links, with the learner's place in the speaking game's address; the game opening at that place (an N5 week's
// words, the kana of a kana learner's day) with a Yaoki button that leads back; the reader likewise; and, with the
// offline worker running and the connection gone, a page that says so and leads back instead of the browser's error.
// usage: bash run-app.sh extras-test.js   (builds the test folder; this script serves it itself on EXTRAS_PORT, 8768 by default)
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const PORT = +(process.env.EXTRAS_PORT || 8768);
const BUILD = path.join(__dirname, '..', 'yaoki-app', process.env.YK_TESTDIR || 'dist-test');
const DOCS = path.join(__dirname, '..', 'docs');
const BASE = `http://localhost:${PORT}/Yaoki/`;
let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails += 1; console.log('  FAIL: ' + msg); } };

/* a site laid out as GitHub Pages serves it: the app's build at /Yaoki/, the other pages in folders beside it */
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'yk-extras-'));
fs.mkdirSync(path.join(root, 'Yaoki'));
for (const f of fs.readdirSync(BUILD)) fs.symlinkSync(path.join(BUILD, f), path.join(root, 'Yaoki', f));
for (const f of ['speaking', 'reader', 'typing']) fs.symlinkSync(path.join(DOCS, f), path.join(root, 'Yaoki', f));
let server = null;
const serve = async () => { server = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', root], { stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 800)); };
const stop = async () => { if (server) server.kill(); server = null; await new Promise((r) => setTimeout(r, 500)); };

(async () => {
  await serve();
  const browser = await chromium.launch();
  const logs = [];
  const fresh = async (query) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => logs.push('pageerror: ' + String(e).slice(0, 200)));
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.goto(BASE + (query || ''));
    return page;
  };
  const ready = async (page) => { await page.waitForSelector('#yk-stage > .sc-host', { timeout: 15000 }); await page.waitForTimeout(400); };
  const text = async (page) => ((await page.locator('#yk-stage').textContent()) || '').replace(/\s+/g, ' ');
  const click = async (page, sel, wait = 500) => { await page.locator(sel).first().click({ timeout: 5000 }); await page.waitForTimeout(wait); };
  /* a first start: the goal screen, a level picked, the first eye painted, the week path */
  const begin = async (page, level) => {
    await ready(page);
    if ((await text(page)).includes('Continue in the browser')) await click(page, 'a:has-text("Continue in the browser"), button:has-text("Continue in the browser")');
    await click(page, `button[aria-pressed]:has-text("${level}")`);
    await click(page, 'button:has-text("Paint the first eye")');
    await click(page, 'a:has-text("Start")', 800);
  };

  // an N5 learner: the tab, the screen, the links
  let page = await fresh();
  await begin(page, 'N5');
  ok(await page.locator('nav[aria-label="Main"] a').count() === 5 && await page.locator('nav[aria-label="Main"] a:has-text("Extras")').count() === 1, 'the week path has five tabs, the last Extras');
  await click(page, 'nav[aria-label="Main"] a:has-text("Extras")', 600);
  let t = await text(page);
  ok(t.includes('おまけ') && t.includes('Nothing here counts toward your stamps'), 'the Extras tab opens おまけ, which says it is outside the course');
  ok(t.includes('Opens at N5 · week 1') , 'the speaking card says where it opens: N5, week 1, got ' + t.slice(0, 400));
  const hrefs = await page.$$eval('a', (as) => as.map((a) => a.getAttribute('href')).filter((h) => /speaking|reader/.test(h || '')));
  ok(JSON.stringify(hrefs) === JSON.stringify(['speaking/?from=app&level=N5&unit=1', 'reader/?from=app']), 'the links carry the place, got ' + JSON.stringify(hrefs));
  ok(await page.locator('nav[aria-label="Main"] a[aria-current="page"]:has-text("Extras")').count() === 1, 'its tab is marked as the page you are on');

  // the speaking game, opened in the app's own window at the learner's week
  await click(page, 'a:has-text("Open Yaoki Speaking")', 300);
  await page.waitForURL(/\/Yaoki\/speaking\/\?from=app&level=N5&unit=1$/, { timeout: 10000 }).catch(() => {});
  ok(/\/Yaoki\/speaking\//.test(page.url()), 'Open Yaoki Speaking goes to the game in the same window, got ' + page.url());
  await page.waitForSelector('#to-app', { state: 'visible', timeout: 10000 }).catch(() => {});
  ok(await page.locator('#to-app').isVisible() && (await page.getAttribute('#to-app', 'href')) === '../', 'the game shows a Yaoki button that leads back to the app');
  ok((await page.textContent('#modes [aria-pressed="true"]')).includes('語彙'), 'the game opens at course words');
  const weekOk = await page.waitForFunction(() => /第1週/.test((document.querySelector('#units [aria-pressed="true"]') || {}).textContent || ''), null, { timeout: 10000 }).then(() => true, () => false);
  ok(weekOk, 'at the learner\'s week, N5 week 1, marked from the app');
  await click(page, '#to-app', 300);
  await page.waitForURL(BASE, { timeout: 10000 }).catch(() => {});
  await ready(page).catch(() => {});
  ok(page.url() === BASE && (await text(page)).includes('名詞の文'), 'the Yaoki button brings the app back, at its week path, got ' + page.url());

  // the reader likewise
  await click(page, 'nav[aria-label="Main"] a:has-text("Extras")', 600);
  await click(page, 'a:has-text("Open Yaoki Reader")', 300);
  await page.waitForURL(/\/Yaoki\/reader\/\?from=app$/, { timeout: 10000 }).catch(() => {});
  await page.waitForSelector('#texts .text-card', { timeout: 15000 }).catch(() => {});
  ok(/\/Yaoki\/reader\/\?from=app$/.test(page.url()) && await page.locator('#to-app').isVisible(), 'Open Yaoki Reader opens the reader, with its Yaoki button, got ' + page.url());
  await click(page, '#to-app', 300);
  await page.waitForURL(BASE, { timeout: 10000 }).catch(() => {});
  await ready(page).catch(() => {});
  ok(page.url() === BASE, 'and its Yaoki button brings the app back');
  await page.context().close();

  // a learner of the kana course: the game opens at the lesson of the day's kana
  page = await fresh();
  await begin(page, 'かな');
  await click(page, 'nav[aria-label="Main"] a:has-text("Extras")', 600);
  t = await text(page);
  ok(t.includes('Say the kana out loud') && t.includes('Opens at the kana あ'), 'for the kana course the speaking card offers the kana of the day, あ');
  await click(page, 'a:has-text("Open Yaoki Speaking")', 300);
  await page.waitForURL(/level=KANA&kana=/, { timeout: 10000 }).catch(() => {});
  await page.waitForSelector('#to-app', { state: 'visible', timeout: 10000 }).catch(() => {});
  ok((await page.textContent('#modes [aria-pressed="true"]').catch(() => '')).includes('あいうえお') && (await page.textContent('#lessons [aria-pressed="true"] .l-kana').catch(() => '')) === 'あ', 'the game opens at the first steps, at the lesson of あ');
  await page.context().close();

  // with the offline worker running and no connection: a page that says so, and leads back to the app
  page = await fresh('?sw');
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 60000 }).catch(async () => {
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 60000 });
  });
  await begin(page, 'N5');
  await click(page, 'nav[aria-label="Main"] a:has-text("Extras")', 600);
  await stop();
  await click(page, 'a:has-text("Open Yaoki Speaking")', 300);
  await page.waitForSelector('a:has-text("Back to Yaoki")', { timeout: 10000 }).catch(() => {});
  const body = await page.textContent('body').catch(() => '');
  ok(/Offline/.test(body) && /needs a connection/.test(body) && await page.locator('a:has-text("Back to Yaoki")').count() === 1, 'offline, the game\'s page says it needs a connection and offers the way back, got ' + body.slice(0, 160));
  await click(page, 'a:has-text("Back to Yaoki")', 300);
  await ready(page).catch(() => {});
  ok(page.url().startsWith(BASE) && (await text(page).catch(() => '')).includes('名詞の文'), 'and the way back opens the app from the phone, offline, got ' + page.url());
  await page.context().close();

  await browser.close();
  await stop();
  fs.rmSync(root, { recursive: true, force: true });
  const errs = logs.filter((l) => !/Failed to load resource|net::ERR/.test(l));
  ok(!errs.length, 'no script errors: ' + errs.slice(0, 3).join(' | '));
  console.log(fails ? `EXTRAS TEST FAIL (${fails})` : 'EXTRAS TEST PASS');
  process.exit(fails ? 1 : 0);
})().catch(async (e) => { console.error(e); await stop(); console.log('EXTRAS TEST FAIL'); process.exit(1); });
