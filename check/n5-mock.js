// The N5 mini mock inside the prototype frame: the hub shows only the mini mock, a full run with sound (or
// its stand-in timing with NOSOUND=1), the result and the answers.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { openBoard, inspect, site, out } = require('./rt-check.js');

(async () => {
  const fontsCss = fs.readFileSync(path.join(site, 'fonts.css'), 'utf8');
  const browser = await chromium.launch();
  const { page, logs } = await openBoard(browser, 'TShell.dc.html?screen=Mock&level=N5&cur=n5u01d1', fontsCss);
  let fails = 0;
  const ok = (cond, msg) => { if (!cond) { fails += 1; console.log('  FAIL: ' + msg); } };
  const click = async (sel, wait = 400) => { await page.locator(sel).first().click({ timeout: 5000 }); await page.waitForTimeout(wait); };
  const body = async () => ((await page.locator('body').textContent()) || '').replace(/\s+/g, ' ');
  const has = async (text) => (await body()).includes(text);
  const until = (text, ms) => page.waitForFunction((t) => document.body.textContent.includes(t), text, { timeout: ms });
  const at = async (name) => {
    const info = await inspect(page);
    await page.screenshot({ path: path.join(out, 'n5mk-' + name + '.png') });
    const bad = info.errors.length || info.issues.length || info.unresolved;
    console.log(`${name}: root=${info.rootH}` + (bad ? ' PROBLEMS ' + JSON.stringify({ e: info.errors, i: info.issues.slice(0, 4), u: info.unresolved }) : ''));
    ok(!bad, name + ': layout or runtime problems');
  };
  const pickOpt = (n) => click(`button[aria-pressed] >> nth=${n - 1}`, 150);
  const SOUND = !process.env.NOSOUND;
  const mini = await page.evaluate(() => { const C = window.ykCourse; const a = []; for (let n = 1; C.item('n5mock' + n); n++) a.push(C.item('n5mock' + n)); return a.map((x) => ({ type: x.type, answer: x.answer })); });
  ok(mini.length === 12, 'twelve N5 mini mock items expected, got ' + mini.length);

  await at('01-hub');
  ok(await has('Mock exam · N5'), 'hub: the level should be N5');
  ok(await has('ミニ模試'), 'hub: mini mock card missing');
  ok(!(await has('101問')), 'hub: the N2 full papers should not be listed at N5');
  await click('a:has-text("Start")', 600);
  await at('02-briefing');
  ok(await has('Mini mock · N5'), 'briefing: level missing');
  await click('button:has-text("Start section 1")', 500);
  // section 1: every question, all right except question 3
  for (let n = 1; n <= 9; n++) {
    ok(await has(mini[n - 1].type.replace(/^読解・/, '')), `s1: question ${n} should be ${mini[n - 1].type}`);
    const pick = n === 3 ? (mini[2].answer === 1 ? 2 : 1) : mini[n - 1].answer;
    await pickOpt(pick);
    if (n === 1 || n === 7 || n === 8 || n === 9) await at('03-s1-q' + n);
    if (n < 9) await click('button:has-text("Next")');
  }
  await click('button[aria-label="Open the answer sheet"]', 400);
  ok(await has('9 / 9 answered'), 'sheet: should count 9 answered');
  await click('button:has-text("Submit")', 600);
  await at('04-break');
  ok(await has('Start section 2'), 'break: next section button missing');
  const l0 = Date.now();
  await click('button:has-text("Start section 2")', 300);
  await at('05-l1');
  ok(await has('課題理解'), 'listening: first item should be 課題理解');
  await page.waitForTimeout(1500);
  await pickOpt(mini[9].answer);
  await until('ポイント理解', 120000);
  await page.waitForTimeout(300);
  await at('06-l2');
  await pickOpt(mini[10].answer);
  await until('即時応答', 120000);
  await page.waitForTimeout(300);
  await at('07-l3');
  ok((await page.locator('button[aria-label^="Reply"]').count()) === 3, 'listening: 即時応答 should offer three replies');
  await pickOpt(mini[11].answer);
  await until('Correct answers', 60000);
  await page.waitForTimeout(400);
  console.log('   listening section took ' + Math.round((Date.now() - l0) / 1000) + ' s');
  if (SOUND) {
    const starts = await page.evaluate(() => (window.__audio || []).filter((a) => a.ev === 'start').length);
    ok(starts >= 8, 'listening: the N5 clips should have played (' + starts + ' started)');
  }
  await at('08-result');
  ok(await has('11'), 'result: 11 of 12 right expected');
  await click('button:has-text("Answers and reasons")', 500);
  await at('09-answers');
  ok((await page.locator('[role=tab]').count()) === 4, 'answers: four areas expected');
  ok(logs.filter((l) => !/Failed to load resource/.test(l)).length === 0, 'console problems: ' + JSON.stringify(logs.slice(0, 5)));
  await browser.close();
  console.log(fails ? `N5 MOCK FAIL (${fails} failed checks)` : 'N5 MOCK PASS');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('N5 MOCK CRASH', e); process.exit(1); });
