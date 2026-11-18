// A place or a screen the app gains before the website is written for it (yk-app.js mirrorTabs, the title's fallback, and the
// rule build.mjs generates at the end of desk.css): on a desktop the app's own tab bar is hidden and the sidebar stands in for it,
// so a tab the sidebar's list (index.html) does not have must get an item of its own, in the tab bar's order, that opens it; the
// browser's tab is named after it; and a screen with no landscape layout of its own is drawn in a column in the middle of the
// pane, not stretched across it. The check takes places the website knows out of the page it loads (the sidebar's item, the
// title's name, the screen's layout) and sees the app find them again from the tab bar.
// usage: bash run-app.sh new-places-test.js            YK_LEVEL=N1 bash run-app.sh new-places-test.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const PORT = process.env.PORT || 8765;
const N1 = process.env.YK_LEVEL === 'N1';
const APP = N1 ? 'Yaoki N1' : 'Yaoki';
const DIST = path.join(__dirname, '..', 'yaoki-app', process.env.YK_TESTDIR || 'dist-test');
let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };

(async () => {
  // every screen the build defines has a layout of its own, so the generated rule leaves each of them as it is
  const defined = [...fs.readFileSync(path.join(DIST, 'assets', 'screens.js'), 'utf8').matchAll(/YK\.define\("([A-Za-z0-9]+)"/g)].map((m) => m[1]).filter((n) => n !== 'Shell' && n !== 'Install');
  const desk = fs.readFileSync(path.join(DIST, 'assets', 'desk.css'), 'utf8');
  const rule = (desk.match(/generated: the screens with no file here[\s\S]*?:where\(([^)]*(?:\)[^{]*?)*)\)\s*\{\s*max-width: 560px/) || [])[1] || '';
  const spared = [...rule.matchAll(/\[data-yk="([A-Za-z0-9]+)"\]/g)].map((m) => m[1]);
  ok(defined.length > 10 && defined.every((n) => spared.includes(n)), `the generated rule spares every screen of the build (${defined.length} defined, ${defined.filter((n) => !spared.includes(n)).join(', ') || 'none'} left out)`);

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1536, height: 730 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  // what the page loads, with places the website knows taken out of it
  let drop = { item: '', title: '', layout: '' };
  const taken = new Set();
  await page.route(/\/(\?|$)|\/index\.html|\/assets\/(yk-app\.js|desk\.css)/, async (r) => {
    const url = r.request().url();
    const res = await r.fetch();
    let body = await res.text();
    const was = body;
    if (/desk\.css/.test(url)) {
      if (drop.layout) { body = body.replace(`:not([data-yk="${drop.layout}"])`, ''); if (body !== was) taken.add('layout'); }
    } else if (/yk-app\.js/.test(url)) {
      if (drop.title) { body = body.replace(new RegExp(`\\b${drop.title}: '[^']*', `), ''); if (body !== was) taken.add('title'); }
    } else if (drop.item) {
      body = body.replace(new RegExp(`<button type="button" data-tab="${drop.item}">[\\s\\S]*?</button>\\n?`), '');
      if (body !== was && !body.includes(`data-tab="${drop.item}"`)) taken.add('item');
    }
    await r.fulfill({ response: res, body });
  });
  const open = async (screen) => { await page.goto(`http://127.0.0.1:${PORT}/?yktest&now=1761955200000${N1 ? '&plan=demo&day=2' : '&level=N2&cur=u02d2'}&screen=${screen}`); await page.waitForSelector('#yk-stage > .sc-host'); await page.waitForTimeout(700); };
  const side = () => page.evaluate(() => [...document.querySelectorAll('.app-nav [data-tab]')].map((b) => ({ tab: b.getAttribute('data-tab'), label: (b.textContent || '').trim(), icon: !!b.querySelector('svg'), off: b.getAttribute('aria-disabled') === 'true', here: b.getAttribute('aria-current') === 'page', h: Math.round(b.getBoundingClientRect().height) })));
  const tabBar = () => page.evaluate(() => [...document.querySelectorAll('#yk-stage nav[aria-label="Main"] a[href$=".dc.html"]')].map((a) => ({ tab: a.getAttribute('href').replace('.dc.html', ''), label: (a.textContent || '').trim() })));
  const screen = () => page.evaluate(() => { const r = document.querySelector('.yk-screen [data-yk]'); return r ? r.getAttribute('data-yk') : null; });

  // as written: the sidebar lists the tab bar's places, nothing added
  await open('Main');
  const bar = await tabBar();
  const before = await side();
  ok(bar.length >= 4 && bar.every((t, i) => before[i] && before[i].tab === t.tab), `as written, the sidebar has the tab bar's places in its order (${before.map((s) => s.tab).join(', ')})`);

  // a place in the middle and the last one, each taken out of the sidebar's list: the sidebar makes it again from the tab bar
  for (const name of ['Notebook', bar[bar.length - 1].tab]) {
    drop = { item: name, title: name, layout: '' };
    taken.clear();
    await open('Main');
    ok(taken.has('item') && taken.has('title'), `${name}: the page loaded without its sidebar item and its name for the tab (${[...taken].join(', ')})`);
    const items = await side();
    const want = bar.map((t) => t.tab);
    const made = items.find((s) => s.tab === name);
    const label = bar.find((t) => t.tab === name).label;
    ok(items.map((s) => s.tab).join() === want.join(), `${name} left out of the sidebar's list: the sidebar has it again, in the tab bar's order (${items.map((s) => s.tab).join(', ')})`);
    ok(made && made.label === label && made.icon && made.h === before.find((s) => s.tab === name).h, `…with the tab's label "${made && made.label}", its icon, and the size of the other items`);
    const menuLast = await page.evaluate(() => { const nav = document.querySelector('.app-nav'); const kids = [...nav.querySelectorAll('button')]; return kids[kids.length - 1].hasAttribute('data-app-menu'); });
    ok(menuLast, '…and the Menu item stays last');
    if (made && !made.off) {
      await page.click(`.app-nav [data-tab="${name}"]`);
      await page.waitForTimeout(800);
      const now = await side();
      ok(await screen() === name && now.find((s) => s.tab === name).here, `a click on it opens ${name}, and the item is the current one (${await screen()})`);
      // the browser's tab: the website's own name for the place is taken out too, so it is named after the tab
      const title = await page.title();
      ok(title === `${label} · ${APP}`, `the browser's tab is named after the tab: "${title}"`);
      ok((await side()).filter((s) => s.tab === name).length === 1, '…and the sidebar has it once, after the screens changed');
    } else {
      ok(made && made.off, `${name} is not open yet on this path, and its item says so (aria-disabled)`);
    }
  }

  // a screen with no landscape layout of its own: a column in the middle of the pane, not stretched across it
  drop = { item: '', title: '', layout: '' };
  await open('Notebook');
  const wide = await page.evaluate(() => { const r = document.querySelector('.yk-screen [data-yk]').getBoundingClientRect(); const p = document.querySelector('#yk-view').getBoundingClientRect(); return { w: Math.round(r.width), pane: Math.round(p.width) }; });
  ok(wide.w > 800, `with its layout, the notebook uses the pane's width (${wide.w} of ${wide.pane} px)`);
  drop = { item: '', title: '', layout: 'Notebook' };
  taken.clear();
  await open('Notebook');
  ok(taken.has('layout'), 'the page loaded with the notebook left out of the screens that have a layout');
  const col = await page.evaluate(() => { const r = document.querySelector('.yk-screen [data-yk]').getBoundingClientRect(); const p = document.querySelector('#yk-view').getBoundingClientRect(); return { w: Math.round(r.width), left: Math.round(r.left - p.left), right: Math.round(p.right - r.right) }; });
  ok(col.w <= 560 && col.w >= 500 && Math.abs(col.left - col.right) <= 2, `without one, it is a column of ${col.w} px in the middle of the pane (${col.left} px either side)`);

  // a pane too narrow for a landscape layout (the phone's single column, the sidebar beside it) is left as it was
  await page.setViewportSize({ width: 1024, height: 700 });
  await page.waitForTimeout(500);
  const narrow = await page.evaluate(() => { const r = document.querySelector('.yk-screen [data-yk]').getBoundingClientRect(); const p = document.querySelector('#yk-view').getBoundingClientRect(); return { w: Math.round(r.width), pane: Math.round(p.width) }; });
  ok(Math.abs(narrow.w - narrow.pane) <= 2, `in a narrow window the screen keeps the pane's width, as before (${narrow.w} of ${narrow.pane} px)`);

  ok(!errors.length, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  await browser.close();
  console.log(bad ? `NEW PLACES TEST: ${bad} FAILED` : 'NEW PLACES TEST PASS');
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
