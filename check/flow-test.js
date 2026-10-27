// One day of the course from the goal screen to the stamp, then the notebook and its review the next day.
// Runs against the app build (bash run-app.sh flow-test.js) or the canvas (bash run.sh flow-test.js).
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { openBoard, inspect, site, out, APP } = require('./rt-check.js');

const DAY1 = Date.UTC(2026, 9, 12, 15);   // Monday 12 October 2026, noon in Asunción

(async () => {
  const fontsCss = fs.readFileSync(path.join(site, 'fonts.css'), 'utf8');
  const browser = await chromium.launch();
  /* the kanji lesson's writing pads write themselves (window.__ykWriteAuto): this flow is about the day as a whole; the
     writing with a finger has checks of its own (write-flow.js) */
  const prep = (page) => page.addInitScript((t) => { window.__ykNow = t; window.__ykWriteAuto = true; window.__ykWriteFast = true; }, DAY1);
  // days 1 to 3 of unit 3 already done, so day 4 (the original sample day) is next
  const done = encodeURIComponent(JSON.stringify({ u03d1: { g: 3, k: 1, r: 1 }, u03d2: { g: 3, k: 1, r: 1 }, u03d3: { g: 3, k: 1, r: 1 } }));
  const { page, logs } = await openBoard(browser, 'TShell.dc.html?screen=Goal&done=' + done, fontsCss, prep);
  let fails = 0;
  const ok = (cond, msg) => { if (!cond) { fails += 1; console.log('  FAIL: ' + msg); } };
  const tile = async (t) => { await page.locator('button').filter({ hasText: new RegExp('^\\s*' + t + '\\s*$') }).first().click({ timeout: 5000 }); await page.waitForTimeout(150); };
  const click = async (sel, wait = 450) => { await page.locator(sel).first().click({ timeout: 5000 }); await page.waitForTimeout(wait); };
  const body = async () => ((await page.locator('body').textContent()) || '').replace(/\s+/g, ' ');
  const has = async (t) => (await body()).includes(t);
  const at = async (name, expect) => {
    const info = await inspect(page);
    await page.screenshot({ path: path.join(out, 'fl-' + name + '.png') });
    const bad = info.errors.length || info.issues.length || info.unresolved;
    console.log(`${name}: root=${info.rootH}` + (bad ? ' PROBLEMS ' + JSON.stringify({ e: info.errors, i: info.issues, u: info.unresolved }) : ''));
    ok(!bad, name + ': layout or runtime problems');
    if (expect) ok(await has(expect), `${name}: expected "${expect}"`);
  };

  // ---------- goal ----------
  await at('01-goal', '目標を決めよう');
  ok(await has('全部入れる') && await has('1日1回'), 'goal: with 8 weeks left the pace choice should be offered');
  ok(await has('some days have two'), 'goal: fit-it-all-in should be the default and say days double up');
  await click('button:has-text("1日1回")', 300);
  ok(await has('By the exam you reach unit'), 'goal: one-a-day should say how far it gets');
  await click('button:has-text("全部入れる")', 300);
  await click('button:has-text("Paint the first eye")');
  await at('02-goal-painted');
  await click('a:has-text("Start")', 700);

  // ---------- week path ----------
  await at('03-main', '原因・理由');
  ok(await has('〜ばかりに・〜あまり'), 'main: the written day should be today');
  ok((await page.locator('a[aria-label^="Day 3, done"]').count()) === 1, 'main: the days already done should be stamped');
  ok(await has('あと55日'), 'main: days left to the exam');
  await click('a:has-text("はじめる")', 700);

  // ---------- the day ----------
  await at('04-today', '第3週 · 4日目');
  await click('a:has-text("Start with the teach page")', 700);
  await at('05-teach-1', '〜ばかりに');
  ok(await has('just because'), 'teach: first pattern gloss');
  await click('a:has-text("Next: 〜あまり")', 600);
  await at('06-teach-2', '〜あまり');
  ok(await has('悔しさのあまり'), 'teach: the second pattern should replace the first');
  await click('a:has-text("Compare")', 700);
  await at('07-compare', 'どれを使う？');
  await click('button[aria-pressed]:has-text("ばかりに")', 400);
  ok(await has('おしい！'), 'compare: a wrong pick should be explained');
  await click('a:has-text("Start the drill")', 700);

  // drill: 6 items; get item 1 wrong, the star items right, the rest right
  await at('08-drill-1', '寝坊した');
  await click('button[aria-pressed]:has-text("あまり")', 200);
  await click('button:has-text("Check")', 500);
  await at('09-drill-1-wrong', 'おしい！');
  ok(await has('your pick'), 'drill: the wrong pick should be marked');
  await click('a:has-text("Next")', 500);
  await at('10-drill-2-star', '★に入るのはどれ？');
  for (const t of ['の', 'あまり', '自分の', '名前まで']) await tile(t);
  await click('button:has-text("Check")', 500);
  ok(await has('せいかい！'), 'drill: the star sentence in the right order should be right');
  await click('a:has-text("Next")', 500);
  const picks = { 3: 'あまり', 4: 'ばかりに', 5: 'あまり' };
  for (const n of [3, 4, 5]) {
    await click(`button[aria-pressed]:has-text("${picks[n]}") >> nth=0`, 200);
    await click('button:has-text("Check")', 500);
    ok(await has('せいかい！'), `drill ${n}: expected right`);
    if (n === 4) await at('11-drill-4');
    await click('a:has-text("Next")', 500);
  }
  await at('12-drill-6-star', '★に入るのはどれ？');
  for (const t of ['急ぐ', '大事な', 'あまり', '書類を']) await tile(t);
  await click('button:has-text("Check")', 500);
  ok(await has('おしい！') && await has('正解'), 'drill 6: the wrong order should be marked wrong');
  await at('13-drill-6-wrong');
  await click('a:has-text("Finish the drill")', 700);
  await at('14-today-drilled', '本番へ');

  // exam-style
  await click('a:has-text("Start exam-style")', 700);
  await at('15-exam', '本番');
  await click('button[aria-pressed]:has-text("ばかりに")', 200);
  await click('button:has-text("Next")', 300);
  await click('button[aria-pressed]:has-text("のあまり")', 200);
  await click('button:has-text("Next")', 300);
  await at('16-exam-star');
  await click('button[aria-pressed]:has-text("友人の")', 200);
  await click('button:has-text("Finish")', 600);
  await at('17-exam-result', '本番 おわり');
  ok((await page.locator('h1').first().textContent()).trim() === '3', 'exam: 3 of 3 expected');
  await click('a:has-text("Next")', 700);

  // scene
  await click('a[href="Scene.dc.html"]', 700);
  await at('18-scene', '市役所で');
  for (const w of ['証明書', '再発行', '番号札']) await click(`button:has-text("${w}")`, 200);
  ok(await has('4 of 8 found'), 'scene: count of words found');
  ok(await has('Next you write:'), 'scene: the writing to come is named');
  await click('button:has-text("Next: write")', 500);
  await at('19-scene-write', '書く');
  /* each kanji or word writes itself here; Next opens once it is written */
  for (let n = 0; n < 40; n++) {
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => /^つぎへ/.test(b.textContent.trim())), null, { timeout: 15000 });
    const last = await page.locator('button:has-text("Next: the exam question")').count();
    await click('button:has-text("つぎへ")', 250);
    if (last) break;
  }
  await at('19-scene-question', '本番');
  await click('button:has-text("2 復")', 400);
  await at('19-scene-wrong', '正解は 1 再');
  await click('a:has-text("Next")', 700);

  // reading
  await click('a[href="Reading.dc.html"]', 700);
  await at('20-reading', '筆者の考え');
  await click('button[aria-pressed]:has-text("身につく")', 200);
  await click('button:has-text("Check")', 500);
  await at('21-reading-right', 'せいかい！');
  await click('a:has-text("Next")', 700);
  await at('22-today-done', '4日目 完了！');
  await click('a:has-text("Back")', 700);
  await at('23-main-stamped');
  ok((await page.locator('a[aria-label^="Day 4, done"]').count()) === 1, 'main: day 4 should be stamped');
  ok(await has('18') || await has('1'), 'main: stamp count');

  // ---------- notebook today and tomorrow ----------
  await click('nav a:has-text("Notebook")', 700);
  await at('24-notebook', '間違いノート');
  const nb = await body();
  ok(nb.includes('In the notebook · 3'), 'notebook: drill 1, drill 6 and the scene should be in it, got ' + (nb.match(/In the notebook · \d+/) || [''])[0]);
  ok(nb.includes('back tomorrow') && nb.includes('all caught up'), 'notebook: nothing due today, all back tomorrow');
  // the next day
  await page.evaluate((t) => { window.__ykNow = t; }, DAY1 + 864e5);
  await click('nav a:has-text("Path")', 500);
  await click('nav a:has-text("Notebook")', 700);
  await at('25-notebook-next-day', 'Review now');
  await click('a:has-text("Review now")', 700);
  await at('26-review', '復習');
  let n = 0;
  while (n < 8 && !(await has('復習おわり'))) {
    const buttons = page.locator('button[aria-pressed]');
    const count = await buttons.count();
    // answer the first item right, the rest by the first option
    await buttons.nth(0).click();
    await page.waitForTimeout(300);
    if (n === 0) await at('27-review-answered');
    await click('button:has-text("Next"), button:has-text("Finish")', 400);
    n += 1;
  }
  await at('28-review-done', '復習おわり');
  await click('a:has-text("Back to the notebook")', 700);
  await at('29-notebook-after');
  ok(!(await has('Review now')), 'notebook: after the review nothing is due');

  const noisy = logs.filter((l) => !/Download the React DevTools/.test(l));
  console.log('console problems: ' + JSON.stringify(noisy.slice(0, 10)));
  console.log(fails === 0 && noisy.length === 0 ? 'FLOW TEST PASS' : `FLOW TEST FAIL (${fails} failed checks, ${noisy.length} console problems)`);
  await browser.close();
})().catch((e) => { console.error('FLOW TEST CRASH', e); process.exit(1); });
