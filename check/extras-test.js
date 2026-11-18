// The app's extras on the Games tab (あそぶ): Yaoki Speaking and Yaoki Reader opened from the installed app, as optional practice.
// The app's test build is served at /Yaoki/study/, as on the website, with the site's other pages beside it (the home page and
// docs/site, docs/speaking, docs/reader and docs/typing, which the speaking game uses), as GitHub Pages serves them. Checks: the
// Games tab on the week path; the two links, found from the site's root, with the learner's place in the speaking game's
// address; the game opening at that place (an N5 week's words, the kana of a kana learner's day) with a Yaoki button that
// leads back to the app; the reader likewise; and, with no connection, the links giving way to a note that they need one (the
// app's offline worker keeps study/ only: the other pages of the site are not its to serve).
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
const APP = BASE + 'study/';
let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails += 1; console.log('  FAIL: ' + msg); } };

/* a site laid out as GitHub Pages serves it: the home page and the site's shared files at /Yaoki/, the app's build at
   /Yaoki/study/, the other pages in folders beside it */
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'yk-extras-'));
fs.mkdirSync(path.join(root, 'Yaoki', 'study'), { recursive: true });
for (const f of fs.readdirSync(BUILD)) fs.symlinkSync(path.join(BUILD, f), path.join(root, 'Yaoki', 'study', f));
for (const f of ['index.html', 'site', 'speaking', 'reader', 'typing']) fs.symlinkSync(path.join(DOCS, f), path.join(root, 'Yaoki', f));
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
    await page.goto(APP + (query || ''));
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
  ok(await page.locator('nav[aria-label="Main"] a').count() === 5 && await page.locator('nav[aria-label="Main"] a:has-text("Games")').count() === 1, 'the week path has five tabs, the last Games');
  await click(page, 'nav[aria-label="Main"] a:has-text("Games")', 600);
  let t = await text(page);
  ok(t.includes('あそぶ') && t.includes('Nothing here counts toward your stamps') && t.includes('Open Yaoki Speaking'), 'the Games tab opens あそぶ, with Speaking and Reader below the games, outside the course');
  ok(t.includes('Opens at N5 · week 1') , 'the speaking card says where it opens: N5, week 1, got ' + t.slice(0, 400));
  const hrefs = await page.$$eval('#yk-stage a', (as) => as.map((a) => a.getAttribute('href')).filter((h) => /speaking|reader/.test(h || '')));
  ok(JSON.stringify(hrefs) === JSON.stringify(['../speaking/?from=app&level=N5&unit=1', '../reader/?from=app']), 'the links carry the place, got ' + JSON.stringify(hrefs));
  ok(await page.locator('nav[aria-label="Main"] a[aria-current="page"]:has-text("Games")').count() === 1, 'its tab is marked as the page you are on');

  // the speaking game, opened in the app's own window at the learner's week
  await click(page, 'a:has-text("Open Yaoki Speaking")', 300);
  await page.waitForURL(/\/Yaoki\/speaking\/\?from=app&level=N5&unit=1$/, { timeout: 10000 }).catch(() => {});
  ok(/\/Yaoki\/speaking\//.test(page.url()), 'Open Yaoki Speaking goes to the game in the same window, got ' + page.url());
  await page.waitForSelector('#to-app', { state: 'visible', timeout: 10000 }).catch(() => {});
  ok(await page.locator('#to-app').isVisible() && (await page.getAttribute('#to-app', 'href')) === '../study/', 'the game shows a Yaoki button that leads back to the app');
  ok((await page.textContent('#modes [aria-pressed="true"]')).includes('語彙'), 'the game opens at course words');
  const weekOk = await page.waitForFunction(() => /第1週/.test((document.querySelector('#units [aria-pressed="true"]') || {}).textContent || ''), null, { timeout: 10000 }).then(() => true, () => false);
  ok(weekOk, 'at the learner\'s week, N5 week 1, marked from the app');
  await click(page, '#to-app', 300);
  await page.waitForURL(APP, { timeout: 10000 }).catch(() => {});
  await ready(page).catch(() => {});
  ok(page.url() === APP && (await text(page)).includes('名詞の文'), 'the Yaoki button brings the app back, at its week path, got ' + page.url());

  // the reader likewise
  await click(page, 'nav[aria-label="Main"] a:has-text("Games")', 600);
  await click(page, 'a:has-text("Open Yaoki Reader")', 300);
  await page.waitForURL(/\/Yaoki\/reader\/\?from=app$/, { timeout: 10000 }).catch(() => {});
  await page.waitForSelector('#texts .text-card', { timeout: 15000 }).catch(() => {});
  ok(/\/Yaoki\/reader\/\?from=app$/.test(page.url()) && await page.locator('#to-app').isVisible(), 'Open Yaoki Reader opens the reader, with its Yaoki button, got ' + page.url());
  await click(page, '#to-app', 300);
  await page.waitForURL(APP, { timeout: 10000 }).catch(() => {});
  await ready(page).catch(() => {});
  ok(page.url() === APP, 'and its Yaoki button brings the app back');
  await page.context().close();

  // a learner of the kana course: the game opens at the lesson of the day's kana
  page = await fresh();
  await begin(page, 'かな');
  await click(page, 'nav[aria-label="Main"] a:has-text("Games")', 600);
  t = await text(page);
  ok(t.includes('Say the kana out loud') && t.includes('Opens at the kana あ'), 'for the kana course the speaking card offers the kana of the day, あ');
  await click(page, 'a:has-text("Open Yaoki Speaking")', 300);
  await page.waitForURL(/level=KANA&kana=/, { timeout: 10000 }).catch(() => {});
  await page.waitForSelector('#to-app', { state: 'visible', timeout: 10000 }).catch(() => {});
  ok((await page.textContent('#modes [aria-pressed="true"]').catch(() => '')).includes('あいうえお') && (await page.textContent('#lessons [aria-pressed="true"] .l-kana').catch(() => '')) === 'あ', 'the game opens at the first steps, at the lesson of あ');
  await page.context().close();

  // with no connection: the two links give way to a note that each needs one
  page = await fresh();
  await begin(page, 'N5');
  await page.context().setOffline(true);
  await click(page, 'nav[aria-label="Main"] a:has-text("Games")', 600);
  t = await text(page);
  const offHrefs = await page.$$eval('#yk-stage a', (as) => as.map((a) => a.getAttribute('href')).filter((h) => /speaking|reader/.test(h || '')));
  ok(offHrefs.length === 0 && (t.match(/Needs a connection/g) || []).length === 2, 'offline, the Games tab says each page needs a connection instead of linking to it, got ' + JSON.stringify(offHrefs) + ' ' + t.slice(0, 200));
  await page.context().setOffline(false);
  await page.context().close();

  await browser.close();
  await stop();
  fs.rmSync(root, { recursive: true, force: true });
  const errs = logs.filter((l) => !/Failed to load resource|net::ERR/.test(l));
  ok(!errs.length, 'no script errors: ' + errs.slice(0, 3).join(' | '));
  console.log(fails ? `EXTRAS TEST FAIL (${fails})` : 'EXTRAS TEST PASS');
  process.exit(fails ? 1 : 0);
})().catch(async (e) => { console.error(e); await stop(); console.log('EXTRAS TEST FAIL'); process.exit(1); });
