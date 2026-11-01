// The Yaoki website: the header, footer and theme the four pages share (docs/site/), served as GitHub Pages serves docs/.
// usage: bash run-reader.sh site-test.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const SITE = 'http://127.0.0.1:8766/Yaoki/';
const out = path.join(__dirname, 'out');
fs.mkdirSync(out, { recursive: true });
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  ok: ' : '  FAIL: ') + msg); if (!cond) fails += 1; };
const step = (msg) => console.log('-- ' + msg);

/* each page of the website: its address, its name in the nav, and the test state that opens the app pages straight on a screen */
const PAGES = [
  { name: 'Study', url: '', query: '?yktest&screen=Main', app: true },
  { name: 'N1', url: 'n1/', query: '?yktest&screen=Main', app: true },
  { name: 'Reader', url: 'reader/', query: '', app: false },
  { name: 'Typing', url: 'typing/', query: '', app: false },
];
const SIZES = [[390, 844], [810, 1080], [1280, 800]];

(async () => {
  const browser = await chromium.launch();
  for (const pg of PAGES) {
    for (const [w, h] of SIZES) {
      step(`${pg.name} at ${w}x${h}`);
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
      await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
      const logs = [];
      const page = await ctx.newPage();
      page.on('pageerror', (e) => logs.push('pageerror: ' + String(e).slice(0, 200)));
      page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|net::|ERR_FAILED/.test(m.text())) logs.push('console: ' + m.text().slice(0, 200)); });
      await page.goto(SITE + pg.url + pg.query);
      if (pg.app) await page.waitForSelector('#yk-stage > .sc-host', { timeout: 15000 });
      await page.waitForTimeout(600);
      const site = w >= 700 && h >= 560;
      const m = await page.evaluate(() => {
        const q = (s) => document.querySelector(s);
        const cs = (el, p) => el ? getComputedStyle(el).getPropertyValue(p).trim() : null;
        return {
          hasBar: !!q('.site-bar'), barDisplay: cs(q('.site-bar'), 'display'), hasFoot: !!q('.site-foot'),
          nav: [...document.querySelectorAll('.site-nav a')].map((a) => a.textContent).join('|'),
          current: (q('.site-nav [aria-current="page"]') || {}).textContent || '',
          footApps: [...document.querySelectorAll('.site-apps a')].map((a) => a.textContent).join('|'),
          brand: (q('.brand') || {}).textContent || '',
          themeKey: localStorage.getItem('yaoki.theme'), themeAttr: document.documentElement.getAttribute('data-theme'),
          ground: cs(document.documentElement, '--ground'),
          stageScheme: cs(q('#yk-stage'), 'color-scheme'),
          ykSite: document.documentElement.classList.contains('yk-desk'),
          scrollW: document.documentElement.scrollWidth, innerW: innerWidth,
          themeBtn: !!q('.site-theme'), licences: (q('.site-legal a') || {}).getAttribute ? q('.site-legal a').getAttribute('href') : null,
        };
      });
      ok(m.hasBar && m.hasFoot, 'the page has the site header and footer');
      ok(m.nav === 'Study|N1|Reader|Typing', 'the nav lists the four pages of the website, got ' + m.nav);
      ok(m.current === pg.name, 'the nav marks this page, got "' + m.current + '"');
      ok(m.footApps === 'Study|N1|Reader|Typing|Speaking', 'the footer lists all five apps, Speaking included, got ' + m.footApps);
      ok(m.scrollW <= m.innerW, 'no sideways scroll, got ' + m.scrollW + ' in ' + m.innerW);
      ok(m.themeKey === null, 'no theme is saved before the control is used');
      ok(m.licences && /licenses\.txt$/.test(m.licences), 'the footer links to the licences, got ' + m.licences);
      if (pg.app) {
        ok(m.ykSite === site, `the app page is laid out as the website only from 700 by 560, got yk-desk=${m.ykSite}`);
        ok(site ? m.barDisplay !== 'none' : m.barDisplay === 'none', 'the chrome is ' + (site ? 'shown' : 'hidden') + ', got display ' + m.barDisplay);
        if (site) ok(m.stageScheme === 'light', 'the design in its frame stays light, got ' + m.stageScheme);
      } else {
        ok(m.barDisplay !== 'none', 'the header shows on this page at every width');
        ok(/Yaoki (Reader|Typing)/.test(m.brand), 'the page keeps its own brand line, got "' + m.brand.trim() + '"');
      }
      if (site || !pg.app) {
        // the theme control: Auto, then Light, then Dark; the choice is saved and kept across a reload
        await page.click('.site-theme');
        await page.click('.site-theme');
        const dark = await page.evaluate(() => ({ attr: document.documentElement.getAttribute('data-theme'), key: localStorage.getItem('yaoki.theme'), ground: getComputedStyle(document.documentElement).getPropertyValue('--ground').trim(), label: document.querySelector('.site-theme').textContent.trim() }));
        ok(dark.attr === 'dark' && dark.key === 'dark' && dark.ground.toUpperCase() === '#12172A' && dark.label === 'Dark', 'two taps on the theme control give dark, saved, got ' + JSON.stringify(dark));
        await page.reload();
        if (pg.app) await page.waitForSelector('#yk-stage > .sc-host', { timeout: 15000 });
        await page.waitForTimeout(400);
        const kept = await page.evaluate(() => ({ attr: document.documentElement.getAttribute('data-theme'), ground: getComputedStyle(document.documentElement).getPropertyValue('--ground').trim(), stage: document.querySelector('#yk-stage') ? getComputedStyle(document.querySelector('#yk-stage')).colorScheme : 'light' }));
        ok(kept.attr === 'dark' && kept.ground.toUpperCase() === '#12172A', 'the dark theme is kept across a reload, got ' + JSON.stringify(kept));
        if (pg.app) ok(kept.stage === 'light', 'the design in its frame stays light in dark mode, got ' + kept.stage);
        await page.click('.site-theme');
        const auto = await page.evaluate(() => ({ attr: document.documentElement.getAttribute('data-theme'), key: localStorage.getItem('yaoki.theme') }));
        ok(auto.attr === null && auto.key === null, 'a third tap goes back to Auto and forgets the choice, got ' + JSON.stringify(auto));
        if (w === 1280) await page.screenshot({ path: path.join(out, `site-${pg.name.toLowerCase()}-${w}.png`), fullPage: true });
      }
      ok(logs.length === 0, 'no page errors: ' + logs.join(' | '));
      await ctx.close();
    }
  }
  await browser.close();
  console.log(fails ? `SITE TEST: ${fails} FAIL` : 'SITE TEST PASS');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
