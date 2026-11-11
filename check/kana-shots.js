// Not a test: screenshots of the kana course's screens at moments the tests pass quickly (for a look by eye).
// usage: SHOTS=<dir> bash run.sh kana-shots.js   (or run-app.sh)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { openBoard, site } = require('./rt-check.js');
const OUT = process.env.SHOTS || path.join(__dirname, 'out');
const enc = (o) => encodeURIComponent(JSON.stringify(o));
const PLAN = '&level=KANA&plan=' + enc({ start: '2026-11-11', exam: null, pace: 'steady' }) + '&now=' + Date.UTC(2026, 10, 11, 15);
(async () => {
  const css = fs.readFileSync(path.join(site, 'fonts.css'), 'utf8');
  const b = await chromium.launch();
  const only = (process.env.ONLY || '').split(',').filter(Boolean);
  const shot = async (name, screen, q, taps) => {
    if (only.length && !only.some((o) => name.startsWith(o))) return;
    const { page } = await openBoard(b, 'TShell.dc.html?screen=' + screen + PLAN + (q || ''), css, (p) => p.addInitScript(() => { window.__ykWriteFast = true; }));
    for (const t of taps || []) { await page.locator(t).first().click({ timeout: 4000 }); await page.waitForTimeout(350); }
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, name + '.png') });
    await page.close();
  };
  const done = (id, p) => '&cur=' + id + '&done=' + enc({ [id]: p });
  await shot('k01-yoon-learn', 'Kana', '&cur=kanau02d4', ['button:has-text("Next:")']);
  await shot('k02-pairs-learn', 'Kana', '&cur=kanau01d6');
  await shot('k03-tsu-learn', 'Kana', '&cur=kanau02d3', ['button:has-text("Next:")']);
  await shot('k04-particle-practice', 'Kana', done('kanau02d5', { g: 1 }), ['button[aria-pressed] >> nth=1']);
  await shot('k05-hear-practice', 'Kana', done('kanau01d1', { g: 1 }), ['button:has-text("Next")'].slice(0, 0).concat(['button[aria-pressed] >> nth=0', 'button:has-text("Next")']));
  await shot('k06-write-kana', 'KanaWrite', '&cur=kanau02d4');
  await shot('k07-write-words', 'KanaWrite', '&cur=kanau01d6');
  await shot('k08-words-sentences', 'KanaWords', '&cur=kanau02d5', ['[role="listitem"] >> nth=0', '[role="listitem"] >> nth=2']);
  await shot('k09-words-quiz', 'KanaWords', done('kanau04d5', { rs: 1 }), ['button[aria-pressed] >> nth=0']);
  await shot('k10-today-day6', 'Today', done('kanau03d6', { g: 3, kk: 1 }));
  await shot('k11-week-test', 'WeekTest', '&cur=kanau02t&set=test', ['a:has-text("Start")', 'button[aria-pressed] >> nth=0', 'button:has-text("Next")', 'button[aria-pressed] >> nth=0', 'button:has-text("Next")']);
  await shot('k12-katakana-learn', 'Kana', '&cur=kanau04d3');
  await shot('k13-words-katakana', 'KanaWords', '&cur=kanau04d5', ['[role="listitem"] >> nth=0']);
  await shot('k14-today-particles', 'Today', '&cur=kanau02d5');
  await shot('k15-today-katakana-words', 'Today', '&cur=kanau04d5');
  await b.close();
  console.log('shots in ' + OUT);
})().catch((e) => { console.error(e); process.exit(1); });
