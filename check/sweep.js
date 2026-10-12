// Visits the answer states the two click-throughs do not reach, and saves a screenshot of each (out/sw-<name>.png).
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { openBoard, inspect, site, out } = require('./rt-check.js');

const enc = (o) => encodeURIComponent(JSON.stringify(o));
const WRONG = { 1: 4, 2: 1, 3: 2, 4: 1, 5: 1, 6: 2, 7: 1, 8: 2, 9: 3, 10: 4, 11: 4, 12: 1 };
const RUNS = [
  ['TShell?screen=Compare', [['click', 'button:has-text("ばかりに") >> nth=-1'], ['shot', 'cmp-wrong1'], ['click', 'button:has-text("だけに") >> nth=-1'], ['shot', 'cmp-wrong3'], ['click', 'button:has-text("あまり") >> nth=-1'], ['shot', 'cmp-right']]],
  ['TShell?screen=Drill', [['click', 'button:has-text("だけあって")'], ['click', 'button:has-text("Check")'], ['shot', 'drill-3']]],
  ['TShell?screen=Drill', [['click', 'button:has-text("からには")'], ['click', 'button:has-text("Check")'], ['shot', 'drill-4']]],
  ['TShell?screen=Drill', [['click', 'button:has-text("ばかりに")'], ['click', 'button:has-text("Check")'], ['shot', 'drill-right']]],
  ['TShell?screen=Star', [['click', 'role=button[name=/^あまり$/]'], ['click', 'role=button[name=/^の$/]'], ['click', 'role=button[name=/^自分の$/]'], ['click', 'role=button[name=/^名前まで$/]'], ['click', 'button:has-text("Check")'], ['shot', 'star-wrong-order']]],
  ['TShell?screen=Star', [['click', 'role=button[name=/^の$/]'], ['click', 'role=button[name=/^あまり$/]'], ['click', 'role=button[name=/^名前まで$/]'], ['click', 'role=button[name=/^自分の$/]'], ['click', 'button:has-text("Check")'], ['shot', 'star-wrong-star']]],
  ['TShell?screen=Scene', [['click', 'role=button[name=/再発行/]'], ['click', 'button:has-text("2 復")'], ['shot', 'scene-quiz-wrong']]],
  ['TShell?screen=Reading', [['click', 'button[aria-pressed] >> nth=2'], ['click', 'button:has-text("Check")'], ['shot', 'read-3']]],
  ['TShell?screen=Reading', [['click', 'button[aria-pressed] >> nth=3'], ['click', 'button:has-text("Check")'], ['shot', 'read-4']]],
  ['TShell?screen=Reading', [['click', 'button[aria-pressed] >> nth=1'], ['click', 'button:has-text("Check")'], ['shot', 'read-right']]],
  ['TShell?screen=Listening', [['click', 'button[aria-label*="lay"] >> nth=0'], ['wait', 3600], ['click', 'button[aria-pressed] >> nth=1'], ['shot', 'lis-2']]],
  ['TShell?screen=Listening', [['click', 'button[aria-label*="lay"] >> nth=0'], ['wait', 3600], ['click', 'button[aria-pressed] >> nth=2'], ['shot', 'lis-3']]],
  ['TShell?screen=Review', [['click', 'button:has-text("せいらく")'], ['shot', 'rev-kanji-wrong'], ['click', 'button:has-text("Next")'], ['click', 'button[aria-label*="lay"] >> nth=0'], ['wait', 3600], ['click', 'button[aria-pressed] >> nth=0'], ['shot', 'rev-listen-wrong1'], ['click', 'button:has-text("Finish")'], ['shot', 'rev-summary-wrong'], ['click', 'a:has-text("Back to the notebook")'], ['shot', 'nb-after-wrong']]],
  ['TShell?screen=Review', [['click', 'button:has-text("しょうりゃく")'], ['click', 'button:has-text("Next")'], ['click', 'button[aria-label*="lay"] >> nth=0'], ['wait', 3600], ['click', 'button[aria-pressed] >> nth=2'], ['shot', 'rev-listen-wrong3']]],
  ['TShell?screen=MockRun&mock=' + enc({ a: WRONG, used: [600], done: true, score: 0 }), [['shot', 'mock-result-0'], ['click', 'button:has-text("Answers and reasons")'], ['shot', 'mock-ans-w1'], ['click', '[role=tab] >> nth=1'], ['shot', 'mock-ans-w2'], ['click', '[role=tab] >> nth=2'], ['shot', 'mock-ans-w3'], ['click', '[role=tab] >> nth=3'], ['shot', 'mock-ans-w4'], ['click', 'button:has-text("Show the script") >> nth=0'], ['shot', 'mock-ans-w4-script1'], ['click', 'button:has-text("Show the script") >> nth=-1'], ['shot', 'mock-ans-w4-script3']]],
  ['TShell?screen=MockRun&mock=' + enc({ a: {}, used: [600], done: true, score: 0 }), [['shot', 'mock-result-blank'], ['click', 'button:has-text("Answers and reasons")'], ['shot', 'mock-ans-b1'], ['click', '[role=tab] >> nth=2'], ['shot', 'mock-ans-b3'], ['click', '[role=tab] >> nth=3'], ['shot', 'mock-ans-b4']]],
  ['TShell?screen=MockRun', [['click', 'button:has-text("Start section 1")'], ['click', 'button:has-text("Next")'], ['shot', 'paper-q2'], ['click', 'button:has-text("Next")'], ['click', 'button:has-text("Next")'], ['shot', 'paper-q4'], ['click', 'button:has-text("Next")'], ['click', 'button:has-text("Next")'], ['shot', 'paper-q6'], ['click', 'button:has-text("Next")'], ['shot', 'paper-q7'], ['click', 'button[aria-pressed] >> nth=2'], ['shot', 'paper-q7-picked']]],
  ['TShell?screen=Notebook&m=' + enc([{ src: 'mock12', wrong: '無解答', at: 9 }, { src: 'exam3', wrong: '無解答', at: 8 }, { src: 'star', wrong: 'あまり', at: 7 }]), [['shot', 'nb-blank']]],
];
(async () => {
  const fontsCss = fs.readFileSync(path.join(site, 'fonts.css'), 'utf8');
  const browser = await chromium.launch();
  let bad = 0;
  for (const [board, steps] of RUNS) {
    const [b, q] = board.split('?');
    const { page, logs } = await openBoard(browser, b + '.dc.html' + (q ? '?' + q : ''), fontsCss);
    for (const [kind, arg] of steps) {
      try {
        if (kind === 'click') { await page.locator(arg).first().click({ timeout: 4000 }); await page.waitForTimeout(380); }
        else if (kind === 'wait') await page.waitForTimeout(arg);
        else if (kind === 'shot') {
          const info = await inspect(page);
          await page.screenshot({ path: path.join(out, 'sw-' + arg + '.png') });
          const flag = info.errors.length || info.issues.length || info.unresolved;
          if (flag) bad += 1;
          console.log(`shot ${arg}: root=${info.rootH}` + (flag ? ' PROBLEMS ' + JSON.stringify({ e: info.errors, i: info.issues, u: info.unresolved }) : ''));
        }
      } catch (e) { bad += 1; console.log(`STEP FAILED on ${board}: ${kind} ${arg}: ` + String(e).split('\n')[0]); }
    }
    const noisy = logs.filter((l) => !/Download the React DevTools/.test(l));
    if (noisy.length) { bad += 1; console.log('   console: ' + JSON.stringify(noisy.slice(0, 4))); }
    await page.close();
  }
  console.log(bad ? 'SWEEP: ' + bad + ' problem(s)' : 'SWEEP PASS');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
