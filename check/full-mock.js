// The N2 full mocks inside the prototype frame: the Mock tab's cards (mock 1 open and mock 2 locked, as the plan has
// it), a whole run of mock 1 (the 71 questions of section 1 answered one by one, the answer sheet, the ten-minute
// break, the 30 listening questions paced by their clips, or by stand-in timing with NOSOUND=1), its result (MockFull),
// the answers and reasons, and the card on the Mock tab afterwards. Then the same screens from a saved result.
// usage: bash run.sh full-mock.js        (MOCK=2 runs mock 2; YK_APP=1 bash run-app.sh full-mock.js for the app build)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { openBoard, inspect, site, out } = require('./rt-check.js');

const DAY = 86400000;
const N = +(process.env.MOCK || 1);
const NOW = Date.UTC(2026, 10, 17, 15);
/* a plan that started 60 days ago, one session a day: unit 6's week test (day 42) is past, unit 12's (day 84) 23 days away */
const START = new Date(NOW - 60 * DAY).toISOString().slice(0, 10);
const PLAN = encodeURIComponent(JSON.stringify({ start: START, exam: '2027-07-04', pace: 'fit' }));

(async () => {
  const fontsCss = fs.readFileSync(path.join(site, 'fonts.css'), 'utf8');
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  let fails = 0;
  const ok = (cond, msg) => { if (!cond) { fails += 1; console.log('  FAIL: ' + msg); } };
  let page;
  let logs;
  const click = async (sel, wait = 350) => { await page.locator(sel).first().click({ timeout: 5000 }); await page.waitForTimeout(wait); };
  const body = async () => ((await page.locator('body').textContent()) || '').replace(/\s+/g, ' ');
  const has = async (text) => (await body()).includes(text);
  const until = (text, ms) => page.waitForFunction((t) => document.body.textContent.replace(/\s+/g, ' ').includes(t), text, { timeout: ms }).then(() => true, () => false);
  const at = async (name) => {
    const info = await inspect(page);
    await page.screenshot({ path: path.join(out, 'full' + N + '-' + name + '.png') });
    const bad = info.errors.length || info.issues.length || info.unresolved;
    console.log(`${name}: root=${info.rootH}` + (bad ? ' PROBLEMS ' + JSON.stringify({ e: info.errors, i: info.issues.slice(0, 4), u: info.unresolved }) : ''));
    ok(!bad, name + ': layout or runtime problems');
  };
  const pick = (n) => page.locator('button[aria-pressed]').nth(n - 1).click({ timeout: 5000 });

  ({ page, logs } = await openBoard(browser, `TShell.dc.html?screen=Mock&level=N2&now=${NOW}&plan=${PLAN}`, fontsCss));
  const paper = await page.evaluate((n) => window.ykCourse.full(n).items.map((it) => ({ type: it.type, answer: it.answer, n: it.options.length, listen: it.listen || '' })), N);
  ok(paper.length === 101, 'mock ' + N + ' should have 101 questions, got ' + paper.length);

  // the Mock tab: the mini mock, mock 1 to start, mock 2 locked until unit 12's week test
  await at('01-hub');
  ok(await has('第1回 模試') && await has('第2回 模試'), 'hub: both full mocks listed');
  ok(await has('第12週が終わると受けられます') && await has('23日後'), 'hub: mock 2 locked until the week 12 test, 23 days away');
  ok(!(await has('第6週が終わると受けられます')), 'hub: mock 1 open, its week 6 test being past in the plan');
  ok(await has('合計 101問 · 155分'), 'hub: the timings of the paper on the mock to take');
  if (N === 2) {
    /* mock 2 opens with unit 12's test: a learner who has done it */
    await page.close();
    ({ page, logs } = await openBoard(browser, `TShell.dc.html?screen=Mock&level=N2&now=${NOW}&plan=${PLAN}&tests=${encodeURIComponent(JSON.stringify({ u12t: { id: 'u12t', score: 20, of: 24 } }))}`, fontsCss));
    ok(!(await has('第12週が終わると受けられます')), 'hub: mock 2 open once the week 12 test is done');
  }
  await page.locator('a:has-text("Start")').nth(N).click({ timeout: 5000 });
  await page.waitForTimeout(500);
  await at('02-briefing');
  ok(await has('本番と同じ101問') && await has('Mock ' + N + ' · N2'), 'briefing: the whole paper, mock ' + N);
  ok(await has('105分') && await has('休憩 10分'), 'briefing: 105 minutes for section 1 and a ten-minute break');
  await click('button:has-text("Start section 1")', 500);
  ok(await has('105:00') || await has('104:5'), 'section 1: its clock starts at 105 minutes');

  // section 1: every question, right but for four slips and one left blank
  const wrong = new Set([3, 20, 44, 60]);
  const blank = 70;
  const shots = { 1: 'kanji', 26: 'usage', 43: 'star', 48: 'text-grammar', 57: 'mid-passage', 65: 'pair', 67: 'long', 70: 'info' };
  for (let n = 1; n <= 71; n++) {
    const q = paper[n - 1];
    ok(await has(q.type), `s1 question ${n}: should show its type ${q.type}`);
    if (n !== blank) await pick(wrong.has(n) ? (q.answer % q.n) + 1 : q.answer);
    await page.waitForTimeout(80);
    if (shots[n]) await at('03-s1-' + String(n).padStart(2, '0') + '-' + shots[n]);
    if (n < 71) await click('button:has-text("Next")', 120);
  }
  await click('button:has-text("Answer sheet")', 400);
  await at('04-sheet');
  ok(await has('70 / 71 answered') && await has('未解答が1問あります。'), 'sheet: 70 of 71 answered, one blank');
  await click('button:has-text("Submit")', 600);
  await at('05-break');
  ok(await has('10:00') || await has('9:5'), 'break: ten minutes');
  await click('button:has-text("Start section 2")', 400);

  // listening: 30 questions in turn, all right but the third
  const t0 = Date.now();
  for (let k = 0; k < 30; k++) {
    const n = 72 + k;
    const q = paper[n - 1];
    const here = await until(`${k + 1} / 30`, 240000);
    ok(here, `listening ${k + 1}: never came`);
    if (!here) break;
    ok(await has(q.type), `listening ${k + 1}: should be ${q.type}`);
    if (k === 0 || k === 5 || k === 11 || k === 16 || k === 28) await at('06-l' + String(k + 1).padStart(2, '0') + '-' + q.listen);
    /* a tap in the first moments of a new question is ignored, as a tap meant for the one before */
    await page.waitForTimeout(500);
    await pick(k === 2 ? (q.answer % q.n) + 1 : q.answer);
    await page.waitForTimeout(80);
    ok(await page.locator('button[aria-pressed="true"]').count() === 1, `listening ${k + 1}: the answer should be marked`);
  }
  const done = await until('結果', 240000);
  console.log(`listening took ${Math.round((Date.now() - t0) / 1000)} s`);
  ok(done, 'the run should end at its result');
  await page.waitForTimeout(600);

  // the result: the expected score from the answers given
  const expect = await page.evaluate(({ n, wrongs, blank }) => {
    const C = window.ykCourse;
    const f = C.full(n);
    const a = {};
    f.items.forEach((it, k) => { const m = k + 1; if (m === blank) return; a[m] = wrongs.includes(m) ? (it.answer % it.options.length) + 1 : it.answer; });
    return C.fullScore(n, a);
  }, { n: N, wrongs: [...wrong, 74], blank });
  await at('07-result');
  /* the page's text is read with every run of spaces as one (the title's ideographic space too) */
  ok(await has(`第${N}回 模試 結果`), 'result: its title');
  ok(await has(`${expect.right} / 101 correct`), `result: ${expect.right} / 101 correct expected`);
  ok(await has(String(expect.total)) && await has('/ 180'), 'result: the total ' + expect.total + ' / 180');
  ok(await has(expect.pass ? '合格圏' : 'あと一歩'), 'result: the verdict');
  ok(await has('間違い ' + (101 - expect.right) + '問'), 'result: the mistakes saved to the notebook');
  ok(!(await has('時間切れ')), 'result: no time-up note, as section 1 was handed in');

  // the answers and reasons, then back to the result and to the Mock tab
  await click('a:has-text("Answers")', 600);
  await at('08-answers');
  ok(await has('解答と解説') && await has('文字・語彙'), 'answers: the four areas');
  await click('button[role="tab"]:has-text("聴解")', 400);
  await click('button:has-text("Show the script")', 300);
  await at('09-answers-listening');
  await click('button[aria-label="Back to the result"]', 500);
  ok(await has(`第${N}回 模試 結果`), 'answers: back to the result');
  await click('a[aria-label="Back to the mock exam tab"]', 500);
  await at('10-hub-after');
  ok(await has('前回の結果') && await has(String(expect.total)), 'hub: the card shows the last result');
  ok(await has('結果を見る') && await has('もう一度'), 'hub: Result and Again on the card');
  await page.close();

  // from a saved result: the card and the result screen
  const saved = await (async () => {
    const r = { a: { 1: 1 }, used: [6300, null], timeUp: [true], done: true, at: '2026-11-07' };
    ({ page, logs } = await openBoard(browser, `TShell.dc.html?screen=MockFull&level=N2&now=${NOW}&plan=${PLAN}&run=${N}&full=${encodeURIComponent(JSON.stringify({ [N]: r }))}`, fontsCss));
    await at('11-saved-result');
    ok(await has('時間切れ') && await has('70 questions left blank'), 'saved result: time ran out with 70 questions blank');
    ok(await has('11月7日（土）'), 'saved result: the date it was taken');
    return true;
  })();
  ok(saved, 'saved result opened');
  const errs = logs.filter((l) => !/Failed to load resource|favicon/.test(l));
  ok(!errs.length, 'no runtime errors: ' + errs.slice(0, 3).join(' | '));
  await browser.close();
  console.log(fails ? `FULL MOCK ${N} FAIL (${fails})` : `FULL MOCK ${N} PASS`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); console.log('FULL MOCK FAIL'); process.exit(1); });
