// Opens every screen of the app build on its own (YK_APP=1, via run-app.sh) and reports runtime errors,
// console problems and anything that leaves the 390 by 844 frame; saves a screenshot of each (out/app-<level>-<screen>.png).
// usage: bash run-app.sh screens-app.js            YK_LEVEL=N1 bash run-app.sh screens-app.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { openBoard, inspect, out } = require('./rt-check.js');

const LEVEL = process.env.YK_LEVEL || 'N2';
const enc = (o) => encodeURIComponent(JSON.stringify(o));
// each screen in the state a learner meets it in, plus the later states the click-throughs pass quickly
const SCREENS = [
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

(async () => {
  const browser = await chromium.launch();
  let bad = 0;
  for (const [screen, q] of SCREENS) {
    const { page, logs } = await openBoard(browser, 'TShell.dc.html?screen=' + screen + q, '');
    const info = await inspect(page);
    const name = screen + (q ? '-' + q.replace(/[^a-z0-9]+/gi, '').slice(0, 12) : '');
    await page.screenshot({ path: path.join(out, 'app-' + LEVEL + '-' + name + '.png') });
    const noisy = logs.filter((l) => !/Download the React DevTools/.test(l));
    const flag = info.errors.length || info.issues.length || info.unresolved || noisy.length;
    if (flag) bad += 1;
    console.log(`${name}: root=${info.rootH}` + (flag ? ' PROBLEMS ' + JSON.stringify({ e: info.errors, i: info.issues, u: info.unresolved, c: noisy.slice(0, 4) }) : ''));
    await page.close();
  }
  console.log(bad ? `SCREENS ${LEVEL}: ${bad} problem(s)` : `SCREENS ${LEVEL} PASS`);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
