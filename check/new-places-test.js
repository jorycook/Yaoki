// A place or a screen the app gains before the website is written for it (yk-app.js mirrorTabs, the title's fallback, and the
// rule build.mjs generates at the end of desk.css): on a desktop the app's own tab bar is hidden and the sidebar stands in for it,
// so a tab the sidebar's list (index.html) does not have must get an item of its own, in the tab bar's order, that opens it; the
// browser's tab is named after it; and a screen with no landscape layout of its own is drawn as the phone draws it (390 px wide,
// at most the phone's height, in the middle of the pane, the page scrolling when the window is shorter than the phone), not
// stretched across the pane. The check takes places the website knows out of the page it loads (the sidebar's item, the title's
// name, the screen's layout file) and sees the app find them again from the tab bar; a tab the page never listed is checked the
// same way, as it is.
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
  // the generated rule spares exactly the screens that have a layout file (the files' names, as build.mjs writes them into
  // desk.css), and nothing else: a screen of the build with no file is drawn in the phone's frame (listed below as a note)
  const screensJs = fs.readFileSync(path.join(DIST, 'assets', 'screens.js'), 'utf8');
  const desk = fs.readFileSync(path.join(DIST, 'assets', 'desk.css'), 'utf8');
  const files = [...desk.matchAll(/^\/\* ---------- ([A-Za-z0-9]+)\.css ---------- \*\/$/gm)].map((m) => m[1]);
  const gen = desk.slice(desk.indexOf('generated: the screens with no file here'));
  const rule = (gen.match(/\[data-yk\]:where\(((?::not\(\[data-yk="[A-Za-z0-9]+"\]\))*)\)\s*\{\s*max-width: 390px/) || [])[1] || '';
  const spared = [...rule.matchAll(/\[data-yk="([A-Za-z0-9]+)"\]/g)].map((m) => m[1]);
  ok(files.length > 10 && spared.length === files.length && files.every((n) => spared.includes(n)), `the generated rule spares the screens with a layout file, and only those (${files.length} files, ${spared.length} spared)`);
  ok(/#yk-view:has\(> #yk-stage \.yk-screen > \.sc-host > \[data-yk\]:where\(/.test(gen) && /min-height: 792px/.test(gen), 'and gives the pane the phone\'s height while such a screen is up');
  // the screens (a template whose root fills the screen gets data-yk) the build defines with no layout file
  const screens = [...screensJs.matchAll(/YK\.define\("([A-Za-z0-9]+)", "<div data-yk=\\"([A-Za-z0-9]+)\\"/g)].map((m) => m[1]).filter((n) => n !== 'Shell' && n !== 'Install');
  const unlaid = screens.filter((n) => !files.includes(n));
  console.log('note: ' + (unlaid.length ? 'drawn in the phone\'s frame for want of a layout file: ' + unlaid.join(', ') : 'every screen of the build has a layout file'));

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1536, height: 730 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  // what the page loads, with places the website knows taken out of it; `taken` records what the page as served lacks
  let drop = { item: '', title: '', layout: '' };
  const taken = new Set();
  await page.route(/\/(\?|$)|\/index\.html|\/assets\/(yk-app\.js|desk\.css)/, async (r) => {
    const url = r.request().url();
    const res = await r.fetch();
    let body = await res.text();
    if (/desk\.css/.test(url)) {
      if (drop.layout) {
        body = body.split(`:not([data-yk="${drop.layout}"])`).join('');
        if (!body.includes(`:not([data-yk="${drop.layout}"])`)) taken.add('layout');
      }
    } else if (/yk-app\.js/.test(url)) {
      if (drop.title) {
        body = body.replace(/var TITLES = \{[^}]*\}/, (lit) => lit.replace(new RegExp(`\\b${drop.title}: '[^']*'(, )?`), ''));
        const lit = (body.match(/var TITLES = \{[^}]*\}/) || [''])[0];
        if (lit && !new RegExp(`\\b${drop.title}:`).test(lit)) taken.add('title');
      }
    } else if (drop.item) {
      body = body.replace(new RegExp(`<button type="button" data-tab="${drop.item}">[\\s\\S]*?</button>\\n?`), '');
      if (!body.includes(`data-tab="${drop.item}"`)) taken.add('item');
    }
    await r.fulfill({ response: res, body });
  });
  const open = async (screen) => { await page.goto(`http://127.0.0.1:${PORT}/?yktest&now=1761955200000${N1 ? '&plan=demo&day=2' : '&level=N2&cur=u02d2'}&screen=${screen}`); await page.waitForSelector('#yk-stage > .sc-host'); await page.waitForTimeout(700); };
  const side = () => page.evaluate(() => [...document.querySelectorAll('.app-nav [data-tab]')].map((b) => ({ tab: b.getAttribute('data-tab'), label: (b.textContent || '').trim(), icon: !!b.querySelector('svg'), off: b.getAttribute('aria-disabled') === 'true', here: b.getAttribute('aria-current') === 'page', h: Math.round(b.getBoundingClientRect().height) })));
  const tabBar = () => page.evaluate(() => [...document.querySelectorAll('#yk-stage nav[aria-label="Main"] a[href$=".dc.html"]')].map((a) => ({ tab: a.getAttribute('href').replace('.dc.html', ''), label: (a.textContent || '').trim(), off: a.getAttribute('aria-disabled') === 'true' })));
  const screen = () => page.evaluate(() => { const r = document.querySelector('.yk-screen [data-yk]'); return r ? r.getAttribute('data-yk') : null; });

  // as written: the sidebar lists the tab bar's places, in its order (and the page's own list, index.html, which of them)
  await open('Main');
  const bar = await tabBar();
  const before = await side();
  const listed = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  const isListed = (t) => listed.includes(`data-tab="${t}"`);
  const itemHeight = (before.find((s) => isListed(s.tab)) || {}).h;
  ok(bar.length >= 4 && bar.every((t, i) => before[i] && before[i].tab === t.tab), `as served, the sidebar has the tab bar's places in its order (${before.map((s) => s.tab).join(', ')})`);

  // a place in the middle and the last place the page lists, each taken out of the page; and every tab the page never listed
  const listedTabs = bar.filter((t) => isListed(t.tab)).map((t) => t.tab);
  const cases = [...new Set(['Notebook', listedTabs[listedTabs.length - 1]])].map((t) => ({ tab: t, dropped: true }))
    .concat(bar.filter((t) => !isListed(t.tab)).map((t) => ({ tab: t.tab, dropped: false })));
  let opened = 0;
  for (const c of cases) {
    const name = c.tab;
    const hadTitle = c.dropped && new RegExp(`var TITLES = \\{[^}]*\\b${name}:`).test(fs.readFileSync(path.join(DIST, 'assets', 'yk-app.js'), 'utf8'));
    drop = c.dropped ? { item: name, title: name, layout: '' } : { item: '', title: '', layout: '' };
    taken.clear();
    await open('Main');
    if (c.dropped) ok(taken.has('item') && (!hadTitle || taken.has('title')), `${name}: the page loaded without its sidebar item${hadTitle ? ' and its name for the tab' : ''} (${[...taken].join(', ')})`);
    const items = await side();
    const tab = (await tabBar()).find((t) => t.tab === name);
    const made = items.find((s) => s.tab === name);
    ok(items.map((s) => s.tab).join() === bar.map((t) => t.tab).join(), `${name}${c.dropped ? ' left out of the page' : ' (never listed)'}: the sidebar has it, in the tab bar's order (${items.map((s) => s.tab).join(', ')})`);
    ok(made && tab && made.label === tab.label && made.icon && (!itemHeight || made.h === itemHeight), `…with the tab's label "${made && made.label}", its icon, and the size of the other items`);
    const menuLast = await page.evaluate(() => { const kids = [...document.querySelectorAll('.app-nav button')]; return kids[kids.length - 1].hasAttribute('data-app-menu'); });
    ok(menuLast, '…and the Menu item stays last');
    ok(made && tab && made.off === tab.off, `…and it is ${tab && tab.off ? 'not open yet' : 'open'}, as the pane's tab is (its item: ${made ? (made.off ? 'off' : 'open') : 'missing'})`);
    if (tab && !tab.off) {
      opened++;
      await page.click(`.app-nav [data-tab="${name}"]`);
      await page.waitForTimeout(800);
      const now = await side();
      ok(await screen() === name && (now.find((s) => s.tab === name) || {}).here, `a click on it opens ${name}, and the item is the current one (${await screen()})`);
      // the browser's tab: with the website's own name for the place taken out (or never there), it is named after the tab
      const title = await page.title();
      if (!c.dropped && /^[^·]+ · /.test(title)) ok(true, `the browser's tab is named "${title}"`);
      else ok(title === `${tab.label} · ${APP}`, `the browser's tab is named after the tab: "${title}"`);
      ok((await side()).filter((s) => s.tab === name).length === 1, '…and the sidebar has it once, after the screens changed');
    }
  }
  ok(opened >= 1, `at least one of these places was open and was opened from its item (${opened})`);

  // a screen with no landscape layout of its own: the phone's frame in the middle of the pane, the page scrolling to show it all
  drop = { item: '', title: '', layout: '' };
  await open('Notebook');
  const wide = await page.evaluate(() => { const r = document.querySelector('.yk-screen [data-yk]').getBoundingClientRect(); const p = document.querySelector('#yk-view').getBoundingClientRect(); return { w: Math.round(r.width), pane: Math.round(p.width), ph: Math.round(p.height) }; });
  ok(wide.w > 800 && wide.ph < 792, `with its layout, the notebook uses the pane's width and the window's height (${wide.w} of ${wide.pane} px, ${wide.ph} px tall)`);
  drop = { item: '', title: '', layout: 'Notebook' };
  taken.clear();
  await open('Notebook');
  ok(taken.has('layout'), 'the page loaded with the notebook left out of the screens that have a layout');
  const col = await page.evaluate(() => {
    const r = document.querySelector('.yk-screen [data-yk]').getBoundingClientRect();
    const p = document.querySelector('#yk-view').getBoundingClientRect();
    const m = document.querySelector('.app-main');
    return { w: Math.round(r.width), h: Math.round(r.height), left: Math.round(r.left - p.left), right: Math.round(p.right - r.right), ph: Math.round(p.height), scrolls: m.scrollHeight > m.clientHeight };
  });
  ok(col.w === 390 && Math.abs(col.left - col.right) <= 2, `without one, it is the phone's 390 px in the middle of the pane (${col.w} px, ${col.left} px either side)`);
  ok(col.ph >= 792 && col.h <= 844 && col.scrolls, `…the phone's height, the page scrolling to show it all in a 730 px window (pane ${col.ph} px, screen ${col.h} px)`);

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
