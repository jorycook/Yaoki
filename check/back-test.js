// The browser's Back button and the tab's title in the app on the website (yk-app.js, wayBack): Back goes back as the app's own
// controls do (the menu, a dialog or a docked panel closes; else the screen's own close or back button; else the sidebar's place
// before), and the tab names the screen. The feature is off in the checks' test mode unless the address asks for it (&ykback).
// usage: bash run-app.sh back-test.js            YK_LEVEL=N1 bash run-app.sh back-test.js
const { chromium } = require('playwright');
const PORT = process.env.PORT || 8765;
const N1 = process.env.YK_LEVEL === 'N1';
const APP = N1 ? 'Yaoki N1' : 'Yaoki';
let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1536, height: 730 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const screen = () => page.evaluate(() => { const r = document.querySelector('.yk-screen [data-yk]') || document.querySelector('.sc-host > [data-yk]:not([data-yk="Shell"])'); return r ? r.getAttribute('data-yk') : null; });
  const dialog = () => page.evaluate(() => !!document.querySelector('.yk-screen [role="dialog"][aria-modal="true"]'));
  const open = async (q) => { await page.goto(`http://127.0.0.1:${PORT}/?yktest&ykback&now=1761955200000${N1 ? '&plan=demo&day=2' : ''}${q}`); await page.waitForSelector('#yk-stage > .sc-host'); await page.waitForTimeout(600); };
  const back = async () => { await page.goBack({ waitUntil: 'commit' }).catch(() => {}); await page.waitForTimeout(700); };

  // the tabs: Notebook from the sidebar, then Back to the path; the path's own entry is the page's (nothing of the app's left)
  await open('&screen=Main');
  ok(await screen() === 'Main' && (await page.title()) === `Path · ${APP}`, `the path, its tab titled "${await page.title()}"`);
  await page.click('.app-nav [data-tab="Notebook"]');
  await page.waitForTimeout(700);
  ok(await screen() === 'Notebook' && (await page.title()) === `Notebook · ${APP}`, `the notebook from the sidebar, titled "${await page.title()}"`);
  await back();
  ok(await screen() === 'Main', `Back from the notebook: the path (${await screen()})`);
  ok(await page.evaluate(() => !(history.state && history.state.yk)), 'no history entry of the app left on the path');

  // a day and its lessons: each screen's own way back (a lesson to its day, the day to the path)
  await open('&screen=Today');
  await back();
  ok(await screen() === 'Main', `Back from the day: the path (${await screen()})`);
  for (const s of ['Teach', 'Compare', 'Drill', 'Exam', 'Scene', 'Reading', 'Listening']) {
    await open('&screen=' + s);
    const title = await page.title();
    await back();
    ok(await screen() === 'Today', `Back from ${s} ("${title}"): its day (${await screen()})`);
  }
  await open('&screen=Review');
  await back();
  ok(await screen() === 'Notebook', `Back from the review: the notebook (${await screen()})`);

  // the mock: before it starts, Back is its own Back to the mock tab; under way, Back asks first, and Back again keeps it going
  await open('&screen=MockRun');
  await back();
  ok(await screen() === 'Mock', `Back on the mock's first page: the mock tab (${await screen()})`);
  if (!N1) {
    await open('&screen=MockRun');
    await page.click('[data-k="go"]');
    await page.waitForTimeout(700);
    await back();
    ok(await screen() === 'MockRun' && await dialog(), 'Back in a mock under way: it asks first');
    await back();
    ok(await screen() === 'MockRun' && !(await dialog()), 'Back again: the question closes and the mock goes on');
  }

  // the games (the Study app): Back closes a game, to where it was opened from (today's spread or the Games tab), and the tab
  // names the game; under way, Back is the game's own Close too
  if (!N1) {
    const enc = (o) => encodeURIComponent(JSON.stringify(o));
    for (const [kind, scr, title] of [['match', 'GameMatch', 'Kanji match'], ['catch', 'GameCatch', 'Listening catch'], ['build', 'GameBuild', 'Sentence builder'], ['parts', 'GameParts', 'Kanji parts']]) {
      for (const from of ['Today', 'Extras']) {
        await open('&screen=' + scr + '&game=' + enc({ kind, level: 'N2', unit: 1, day: 1, from, seed: 5 }));
        const t = await page.title();
        await back();
        ok(await screen() === from && t === `${title} · ${APP}`, `Back from ${title} ("${t}") opened from ${from}: ${from === 'Extras' ? 'the Games tab' : 'its day'} (${await screen()})`);
      }
    }
    await open('&screen=GameMatch&game=' + enc({ kind: 'match', level: 'N2', unit: 1, day: 1, from: 'Extras', seed: 5 }));
    await page.click('button:has-text("Start")');
    await page.waitForTimeout(900);
    await back();
    ok(await screen() === 'Extras', `Back in a round under way: the game closes, to the Games tab (${await screen()})`);
  }

  // the menu closes on Back, and the page stays
  await open('&screen=Main');
  await page.click('.app-nav [data-app-menu]');
  await page.waitForTimeout(500);
  const menu = await page.evaluate(() => !!document.querySelector('.yk-scrim-close'));
  await back();
  ok(menu && await page.evaluate(() => !document.querySelector('.yk-scrim-close')) && await screen() === 'Main', 'Back with the menu open: the menu closes, the path stays');

  // off in the checks' own test mode: no entry of the app's
  await page.goto(`http://127.0.0.1:${PORT}/?yktest&now=1761955200000${N1 ? '&plan=demo&day=2' : ''}&screen=Drill`);
  await page.waitForSelector('#yk-stage > .sc-host');
  await page.waitForTimeout(600);
  ok(await page.evaluate(() => !(history.state && history.state.yk)), 'test mode without ykback: Back is the browser\'s own');

  ok(!errors.length, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log(bad ? `BACK TEST FAIL (${bad})` : 'BACK TEST PASS');
  process.exit(bad ? 1 : 0);
})();
