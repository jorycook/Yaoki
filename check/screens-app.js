// Opens every screen of the app build on its own (YK_APP=1, via run-app.sh) and reports runtime errors,
// console problems and anything that leaves the 390 by 844 frame; saves a screenshot of each (out/app-<level>-<screen>.png).
// The N1 app has a screen for each state its plan can put it in: these are made from the course itself, on 14 Oct 2026.
// usage: bash run-app.sh screens-app.js            YK_LEVEL=N1 bash run-app.sh screens-app.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { openBoard, inspect, out } = require('./rt-check.js');

const LEVEL = process.env.YK_LEVEL || 'N2';
const enc = (o) => encodeURIComponent(JSON.stringify(o));
// each screen in the state a learner meets it in, plus the later states the click-throughs pass quickly
let SCREENS = [
  ['Goal', ''],
  ['Main', ''],
  ['Main', '&g=3&k=1&r=1'],
  ['Today', '&g=1'],
  ['Today', '&g=3&k=1&r=1'],
  ['Teach', ''],
  ['Compare', ''],
  ['Drill', ''],
  ['Star', ''],
  ['Exam', ''],
  ['Scene', ''],
  ['Reading', ''],
  ['Listening', ''],
  ['WeekTest', ''],
  ['Notebook', ''],
  ['Notebook', '&rev=' + enc({ at: 1, kanji: true, listen: true })],
  ['Review', ''],
  ['Mock', ''],
  ['MockRun', ''],
  ['Readiness', ''],
];

if (LEVEL === 'N1') {
  const { course } = require('./level.js');
  const TODAY = '2026-10-14';
  const N = course(TODAY);
  /* entries: [screen, address, name, taps before the look] */
  const at = (d) => '&ykdate=' + d;
  const plan = (p, open) => { const q = JSON.parse(JSON.stringify(p)); if (open != null) q.open = open; return '&plan=' + enc(q); };
  const demo = (day) => '&plan=demo&day=' + day + at(TODAY);
  const DEMO = N.demo();
  /* the sample plan with every day done; a plan made today for each session; one re-planned after three missed days */
  const allDone = JSON.parse(JSON.stringify(DEMO));
  allDone.days.forEach((x) => { x.p = x.t === 1 ? { t: 1 } : x.t === 2 ? { v: 1 } : { g: 3, k: 1, r: 1, l: 1 }; });
  const sessions = N.sessions(TODAY);
  const fresh45 = N.make({ start: TODAY, exam: sessions[0].date, pace: 45 });
  const fresh60 = N.make({ start: TODAY, exam: sessions[1].date, pace: 60 });
  const replanned = N.replan(DEMO, { exam: DEMO.exam, pace: 45 });
  const emptyDay = replanned.days.findIndex((x) => N.empty(x));
  /* a day of kanji and words only, and a plan whose first days hold no grammar at all */
  const kanjiDay = fresh60.days.findIndex((x) => x.t === 0 && x.g < 0 && x.k.length);
  const noGrammar = JSON.parse(JSON.stringify(fresh60));
  noGrammar.days.slice(0, 6).forEach((x) => { x.g = -1; x.r = -1; x.l = -1; });
  const wordsOnly = JSON.parse(JSON.stringify(fresh60));
  wordsOnly.days[0].k = [];
  const nothing = JSON.parse(JSON.stringify(fresh60));
  nothing.days.forEach((x) => { if (x.t !== 1) { x.g = -1; x.r = -1; x.l = -1; x.k = []; x.w = []; } });
  /* the sample plan part way through a day, with a week test and a mock taken */
  const midDay = JSON.parse(JSON.stringify(DEMO));
  midDay.days[17].p = { g: 2, k: 1 };
  midDay.tests = { 1: { score: 18, of: 22, at: '2026-09-30' }, 2: { score: 11, of: 22, at: '2026-10-07' } };
  midDay.mocks = { 1: { score: 9, of: 12, at: '2026-10-09', by: { v: { score: 3, of: 4 }, g: { score: 2, of: 3 }, r: { score: 2, of: 2 }, l: { score: 2, of: 3 } }, a: {}, used: [480] } };
  /* mistakes of every kind, due today and later, and one cleared */
  const T = Date.parse(N.add(TODAY, -2) + 'T09:00:00Z');
  const lid = N.lessons[15].id;
  const marks = [
    { src: 'k.' + DEMO.days[16].k[0] + '.0', wrong: 'さんぷ', at: T },
    { src: 'w.' + DEMO.days[16].w[0], wrong: 'いくぶん', at: T - 1000 },
    { src: 'g.' + lid + '.d0', wrong: 'とあれば', at: T - 2000 },
    { src: 'g.' + lid + '.s', wrong: '順番が違う', at: T - 3000 },
    { src: 'g.' + lid + '.x2', wrong: '紹介された', at: T - 4000, step: 1, next: N.add(TODAY, 2) },
    { src: 'r.' + lid, wrong: '回り道には必ず発見がある', at: T - 5000 },
    { src: 'l.' + lid, wrong: '手伝ってくれて助かった', at: T - 6000 },
    { src: 'm1.9', wrong: 'Bは教えるべきでないとする', at: T - 7000 },
    { src: 'm1.10', wrong: '会議室を予約し直す', at: T - 8000, step: 2, next: N.add(TODAY, 6) },
    { src: 'm2.12', wrong: '無解答', at: T - 9000 },
    { src: 'g.' + N.lessons[3].id + '.x0', wrong: 'ものを', at: T - 10000, step: 3, cleared: N.add(TODAY, -1) },
  ];
  const mockDone = { id: 1, done: true, score: 9, of: 12, at: TODAY, a: { 1: 1, 2: 1, 3: 3, 4: 3, 5: 3, 6: 3, 7: 2, 8: 2, 9: 2, 10: 3, 11: 4, 12: 3 }, used: [520] };
  SCREENS = [
    ['Goal', at(TODAY), 'first'],
    ['Goal', at(TODAY), 'first-sheet', ['button[aria-haspopup="dialog"]']],
    ['Goal', at(TODAY), 'first-short', ['button:has-text("30分")', 'button:has-text("Paint the first eye")']],
    ['Goal', demo(17), 'replan'],
    ['Goal', demo(17), 'replan-july', ['button[aria-haspopup="dialog"]', '[role=dialog] button[aria-pressed] >> nth=1', '[role=dialog] button:has-text("Confirm")']],
    ['Main', demo(17), 'demo'],
    ['Main', demo(17), 'open-early', ['button[aria-label="Next week"]', 'button[aria-label$="locked. Open early"] >> nth=0']],
    ['Main', demo(17), 'menu', ['button[aria-label^="Level N1"]']],
    ['Main', demo(17), 'menu-start-over', ['button[aria-label^="Level N1"]', 'button:has-text("Start over")']],
    ['Main', at(TODAY) + plan(fresh45, 0), 'fresh'],
    ['Main', at('2026-12-01') + plan(allDone), 'all-done'],
    ['Main', at('2026-12-06') + plan(DEMO), 'exam-day'],
    ['Main', at('2026-12-09') + plan(DEMO), 'exam-over'],
    ['Main', at(TODAY) + plan(replanned), 'replanned'],
    ['Today', demo(17), 'study'],
    ['Today', at(TODAY) + plan(midDay, 17), 'mid-day'],
    ['Today', demo(16), 'done'],
    ['Today', demo(20), 'week-test'],
    ['Today', at(TODAY) + plan(midDay, 13), 'week-test-done'],
    ['Today', demo(56), 'review-early'],
    ['Today', at('2026-11-20') + plan(DEMO, 57) + '&m=' + enc(marks), 'review-due'],
    ['Today', at(TODAY) + plan(replanned, emptyDay), 'empty'],
    ['Today', at(TODAY) + plan(fresh60, kanjiDay), 'kanji-day'],
    ['Teach', demo(17), 'demo'],
    ['Teach', demo(17), 'page-3', ['button:has-text("Next")', 'button:has-text("Next")']],
    ['Teach', at(TODAY) + plan(noGrammar, 2), 'none'],
    ['Teach', at(TODAY) + plan(fresh60, kanjiDay), 'earlier-lesson'],
    ['Compare', demo(17), 'demo'],
    ['Compare', at(TODAY) + plan(noGrammar, 2), 'none'],
    ['Drill', demo(17), 'demo'],
    ['Drill', at(TODAY) + plan(noGrammar, 2), 'none'],
    ['Star', demo(17), 'demo'],
    ['Star', at(TODAY) + plan(noGrammar, 2), 'none'],
    ['Exam', demo(17), 'demo'],
    ['Exam', at(TODAY) + plan(noGrammar, 2), 'none'],
    ['Scene', demo(17), 'kanji'],
    ['Scene', demo(17), 'words', ['button:has-text("Next: words")']],
    ['Scene', demo(17), 'quiz', ['button:has-text("Next: words")', 'button:has-text("Next: the quiz")']],
    ['Scene', at(TODAY) + plan(wordsOnly, 0), 'words-only'],
    ['Scene', at(TODAY) + plan(fresh60, kanjiDay), 'kanji-day'],
    ['Scene', demo(20), 'none-test-day'],
    ['Reading', demo(17), 'demo'],
    ['Reading', demo(20), 'none'],
    ['Listening', demo(17), 'demo'],
    ['Listening', demo(20), 'none'],
    ['WeekTest', demo(20), 'test'],
    ['WeekTest', at(TODAY) + plan(midDay, 13), 'test-again'],
    ['WeekTest', demo(56), 'review'],
    ['WeekTest', demo(62), 'mixed-test'],
    ['WeekTest', at(TODAY) + plan(nothing, 6), 'none'],
    ['Notebook', demo(17), 'empty'],
    ['Notebook', demo(17) + '&m=' + enc(marks), 'entries'],
    ['Notebook', demo(17) + '&m=' + enc(marks), 'cleared-open', ['button[aria-expanded]:has-text("Cleared")']],
    ['Notebook', demo(17) + '&m=' + enc(marks) + '&rev=' + enc({ at: Date.parse(TODAY + 'T08:00:00Z'), right: 5, of: 7 }), 'reviewed'],
    ['Review', demo(17), 'none'],
    ['Review', demo(17) + '&m=' + enc(marks), 'first'],
    ['Mock', demo(17), 'demo'],
    ['Mock', demo(17) + '&mock=' + enc(mockDone), 'taken'],
    ['Mock', at(TODAY) + plan(midDay, 17) + '&mock=' + enc({ ...mockDone, id: 2, a: {}, score: 4 }), 'two-taken'],
    ['MockRun', demo(17), 'briefing'],
    ['MockRun', demo(17) + '&mock=' + enc(mockDone), 'result'],
    ['MockRun', demo(17) + '&mock=' + enc(mockDone), 'answers', ['button:has-text("Answers and reasons")']],
    ['Readiness', demo(17), 'demo'],
    ['Readiness', at(TODAY) + plan(midDay, 17) + '&m=' + enc(marks), 'results'],
    ['Readiness', at(TODAY) + plan(fresh45, 0), 'fresh'],
    ['Readiness', at('2026-12-09') + plan(allDone), 'exam-over'],
  ];
}

(async () => {
  const browser = await chromium.launch();
  let bad = 0;
  let pads = 0;
  for (const [screen, q, label, taps] of SCREENS) {
    const { page, logs } = await openBoard(browser, 'TShell.dc.html?screen=' + screen + q, '');
    let failed = '';
    for (const sel of taps || []) {
      try { await page.locator(sel).first().click({ timeout: 4000 }); await page.waitForTimeout(450); } catch (e) { failed = sel; break; }
    }
    if (taps) await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect.getTiming().iterations === Infinity), null, { timeout: 3000 }).catch(() => {});
    const info = await inspect(page);
    const name = screen + (label ? '-' + label : q ? '-' + q.replace(/[^a-z0-9]+/gi, '').slice(0, 12) : '');
    await page.screenshot({ path: path.join(out, 'app-' + LEVEL + '-' + name + '.png') });
    const noisy = logs.filter((l) => !/Download the React DevTools/.test(l));
    const flag = info.errors.length || info.issues.length || info.unresolved || noisy.length || failed;
    if (flag) bad += 1;
    pads += info.pad.length;
    console.log(`${name}: root=${info.rootH}` + (flag ? ' PROBLEMS ' + JSON.stringify({ e: info.errors, i: info.issues, u: info.unresolved, c: noisy.slice(0, 4), tap: failed || undefined }) : '') + (info.pad.length ? ' PAD WARNING ' + JSON.stringify(info.pad) : ''));
    await page.close();
  }
  if (pads) console.log(`PAD WARNINGS: ${pads} (content in the bottom 34 px)`);
  console.log(bad ? `SCREENS ${LEVEL}: ${bad} problem(s)` : `SCREENS ${LEVEL} PASS`);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
