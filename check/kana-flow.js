// The kana course end to end: かな picked on the goal screen (a plan with no exam date), the week path, and day 1 of
// week 1 lesson by lesson: the new kana card by card, the practice (a miss goes to the notebook), the check and its
// result; every new kana written three times with a finger and the words written from what is heard (a stroke drawn
// backwards on the way, Next shut until each is written, the word's kana never shown before it is written); the words
// read and their quiz; the day stamped. Then the notebook and a review of a kana question, a sentence day (は, を, へ
// read and written right), week 1's test and its result by area, and the end of the course leading on to N5.
// usage: bash run.sh kana-flow.js           (the design canvas's runtime)
//        bash run-app.sh kana-flow.js       (the app build)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { openBoard, inspect, site, APP } = require('./rt-check.js');
const { strokeOn, padState, writeOut } = require('./write-helpers.js');

const ROOT = path.join(__dirname, '..');
const NOW = Date.UTC(2026, 10, 11, 15);
const PLAN = { start: '2026-11-11', exam: null, pace: 'steady' };
const fail = [];
const ok = (cond, what) => { if (!cond) { fail.push(what); console.log('  FAIL ' + what); } };
const unit = (n) => JSON.parse(fs.readFileSync(path.join(ROOT, 'content/kana/u0' + n + '.json'), 'utf8'));

(async () => {
  const css = fs.readFileSync(path.join(site, 'fonts.css'), 'utf8');
  const b = await chromium.launch();
  const fast = (auto) => async (p) => { await p.addInitScript((a) => { window.__ykWriteFast = true; if (a) window.__ykWriteAuto = true; }, auto); };
  const q = (screen, extra) => 'TShell.dc.html?screen=' + screen + '&now=' + NOW + (extra || '');
  const day1 = unit(1).days['1'];

  // ---------- the goal screen, the week path ----------
  let { page, logs } = await openBoard(b, q('Goal'), css, fast(false), { touch: true });
  const cdp = await page.context().newCDPSession(page);
  const text = async () => (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  const has = async (s) => (await text()).includes(s);
  const tap = async (sel, wait = 300) => { await page.locator(sel).first().click({ timeout: 5000 }); await page.waitForTimeout(wait); };
  ok(await page.locator('button[aria-label^="Kana"]').count() === 1, 'goal: かな is a level to pick');
  await tap('button[aria-label^="Kana"]');
  ok(await has('4週間') && await has('28 in all'), 'goal: the kana plan is four weeks, 28 sessions');
  ok(!(await has('試験日')), 'goal: the kana course asks for no exam date');
  await tap('button:has-text("Paint the first eye")');
  await tap('a:has-text("Start")', 700);
  ok(await has('ひらがな（１）') && await has('Week 1 of 4'), 'week path: hiragana week 1 of 4');
  ok(await page.locator('button[aria-label="Level かな, change level"]').count() === 1, 'week path: the level chip says かな');
  ok(!(await has('あと')), 'week path: no days counted down to an exam');
  ok(await has('模試 N5から') && await page.locator('a[aria-disabled="true"]:has-text("模試 N5から")').count() === 1, 'week path: no mock exam at this level, and it says so');
  if (APP) {
    await tap('button[aria-label="Level かな, change level"]', 400);
    ok(await page.locator('button[aria-label="Kana, hiragana and katakana, current level"]').count() === 1 && await page.locator('[role="dialog"] button[aria-pressed]').count() === 5, 'menu: five levels, かな the current one');
    await tap('button:has-text("Close")', 300);
  }

  // ---------- today, and the kana lesson ----------
  await tap('a:has-text("はじめる")', 600);
  ok(await has('第1週 · 1日目') && await has(day1.title), 'today: week 1, day 1, ' + day1.title);
  ok(await has('Start with the new kana') && await has('かな ×3'), 'today: the three kana lessons');
  await tap('a:has-text("Start with the new kana")', 600);
  const cards = day1.kana.cards;
  for (let k = 0; k < cards.length; k++) {
    const [kana, r] = cards[k].kana[0];
    ok(await has(r), `learn card ${k + 1}: ${kana} with its sound, ${r}`);
    if (k === 0) { const info = await inspect(page); ok(!info.issues.length, 'learn: layout ' + info.issues.join('; ')); }
    await tap(k < cards.length - 1 ? 'button:has-text("Next: ' + cards[k + 1].kana[0][0] + '")' : 'button:has-text("Next: practice")', 250);
  }
  ok(await has('練習') && await has('1 / ' + day1.kana.drill.length), 'practice: opens at its first question');
  let missed = null;
  for (let i = 0; i < day1.kana.drill.length; i++) {
    const it = day1.kana.drill[i];
    ok(await has('Pick an answer first'), `practice ${i + 1}: Next is shut until an answer is picked`);
    const pick = i === 0 ? (it.answer % it.options.length) + 1 : it.answer;
    if (i === 0) missed = it;
    await page.locator('button[aria-pressed]').nth(pick - 1).click();
    await page.waitForTimeout(200);
    ok(await has(pick === it.answer ? 'せいかい！' : 'おしい！'), `practice ${i + 1}: marked at once`);
    if (i === 0) ok(await has('Saved to your mistake notebook'), 'practice: a miss goes to the notebook');
    await tap(i === day1.kana.drill.length - 1 ? 'button:has-text("Next: the check")' : 'button:has-text("Next")', 200);
  }
  for (let i = 0; i < day1.kana.check.length; i++) {
    const it = day1.kana.check[i];
    const pick = i === 2 ? (it.answer % it.options.length) + 1 : it.answer;
    await page.locator('button[aria-pressed]').nth(pick - 1).click();
    await page.waitForTimeout(150);
    ok(!(await has('せいかい！')) && !(await has('おしい！')), `check ${i + 1}: not marked until the end`);
    await tap(i === day1.kana.check.length - 1 ? 'button:has-text("See the results")' : 'button:has-text("Next")', 200);
  }
  ok(await has('本番 おわり') && await has('/ 5') && await has('One to look at again'), 'check: the result, 4 of 5');
  await tap('a:has-text("Next")', 500);
  ok(await page.locator('[aria-label="Lesson done"]').count() === 1, 'today: the kana lesson is stamped done');

  // ---------- writing, with a finger ----------
  await tap('a:has-text("Each new kana three times")', 600);
  const kanaN = Array.from(day1.write.kana).length;
  const total = kanaN + day1.write.words.length;
  for (let n = 0; n < total; n++) {
    ok(await has((n + 1) + ' / ' + total), `write ${n + 1}: its place`);
    if (n < kanaN) {
      const c = Array.from(day1.write.kana)[n];
      ok(await has('Write it three times first'), `write ${n + 1}: Next is shut until ${c} is written`);
      const modes = [];
      for (let rep = 0; rep < 3; rep++) {
        const p = await padState(page);
        modes.push(p && p.mode);
        ok(p && p.c === c, `write ${n + 1}: the pad holds ${c} (has ${p && p.c})`);
        if (n === 0 && rep === 0) {
          /* a stroke drawn backwards does not count, and the line under the pad says so */
          await strokeOn(page, cdp, '[data-yk-pad]', c, 0, 'backwards');
          await page.waitForTimeout(200);
          ok(/goes the other way/.test(await text()) && (await padState(page)).at === 0, 'write: a backwards stroke is named and does not count');
        }
        await writeOut(page, cdp);
      }
      ok(modes.join(',') === 'trace,faint,memory', `write ${n + 1}: traced, faint, from memory (was ${modes.join(',')})`);
    } else {
      const w = day1.write.words[n - kanaN];
      ok(await has('Write the word first') && await has(w.r) && await has(w.gloss), `write ${n + 1}: ${w.r} (${w.gloss}) asked for`);
      ok(!(await has(w.w)), `write ${n + 1}: the word's kana are not shown before it is written`);
      for (let g = 0; g < 8; g++) { const p = await padState(page); if (!p || p.done) break; await writeOut(page, cdp); }
      ok(await has(w.w + ' is written'), `write ${n + 1}: ${w.w} written`);
    }
    await tap(n === total - 1 ? 'button:has-text("Next: the words")' : 'button:has-text("Next")', 300);
  }
  ok(await page.locator('[aria-label="Lesson done"]').count() === 2, 'today: the writing is stamped done');

  // ---------- the words ----------
  await tap('a:has-text("Read words made of the kana")', 600);
  ok(await has('0 of ' + day1.words.list.length + ' read'), 'words: none read yet');
  for (let k = 0; k < day1.words.list.length; k++) await page.locator('[role="listitem"]').nth(k).click();
  await page.waitForTimeout(200);
  ok(await has(day1.words.list.length + ' of ' + day1.words.list.length + ' read') && await has(day1.words.list[0].gloss), 'words: each read, with its meaning');
  await tap('button:has-text("Next: practice")', 300);
  for (let i = 0; i < day1.words.quiz.length; i++) {
    const it = day1.words.quiz[i];
    await page.locator('button[aria-pressed]').nth(it.answer - 1).click();
    await page.waitForTimeout(150);
    await tap(i === day1.words.quiz.length - 1 ? 'button:has-text("Finish the words")' : 'button:has-text("Next")', 200);
  }
  ok(await has('1日目 完了！'), 'today: day 1 is stamped');
  await tap('a:has-text("もどる")', 600);
  ok(await page.locator('a[aria-label="Day 1, done. Open it again"]').count() === 1 && await page.locator('a[aria-label="Day 2, today. Open the day"]').count() === 1, 'week path: day 1 stamped, day 2 next');
  for (const l of logs.filter((x) => !/Failed to load resource/.test(x))) console.log('  console: ' + l);
  ok(!logs.filter((x) => !/Failed to load resource/.test(x)).length, 'day 1: no console problems');
  await page.close();

  // ---------- the notebook and a review of a kana question ----------
  const plan = '&level=KANA&plan=' + encodeURIComponent(JSON.stringify(PLAN));
  const m = encodeURIComponent(JSON.stringify([{ src: missed.id, wrong: missed.options[(missed.answer % missed.options.length)], step: 0, due: '2026-11-11', at: NOW }]));
  ({ page, logs } = await openBoard(b, q('Notebook', plan + '&m=' + m), css));
  let t = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  ok(t.includes(missed.type) && t.includes('In the notebook · 1'), 'notebook: the kana question missed is there, under its kind');
  await page.locator('a:has-text("Review"), button:has-text("Review")').first().click();
  await page.waitForTimeout(500);
  const big = await page.evaluate((x) => [...document.querySelectorAll('[lang="ja"]')].some((e) => e.textContent.trim() === x && parseFloat(getComputedStyle(e).fontSize) >= 34), missed.big);
  ok(big, 'review: the kana asked about is shown large');
  await page.locator('button[aria-pressed]').nth(missed.answer - 1).click();
  await page.waitForTimeout(300);
  t = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  ok(/1 of 3 in a row|3 days/.test(t), 'review: answered right, it moves on a step');
  await page.close();

  // ---------- a sentence day: は, を and へ ----------
  const d5 = unit(2).days['5'];
  ({ page, logs } = await openBoard(b, q('Kana', plan + '&cur=kanau02d5&done=' + encodeURIComponent(JSON.stringify({ kanau02d5: { g: 1 } }))), css, fast(true)));
  const marked = await page.evaluate(() => [...document.querySelectorAll('span')].some((e) => getComputedStyle(e).backgroundColor === 'rgb(255, 233, 176)' && /^[はをへ]$/.test(e.textContent.trim())));
  ok(marked, 'sentence day: the practice marks the kana asked about (は, を or へ)');
  const p1 = d5.kana.drill[0];
  await page.locator('button[aria-pressed]').nth(p1.answer - 1).click();
  await page.waitForTimeout(200);
  ok((await page.locator('body').innerText()).includes('せいかい！'), 'sentence day: read right');
  await page.close();
  ({ page, logs } = await openBoard(b, q('KanaWords', plan + '&cur=kanau02d5'), css));
  t = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  ok(t.includes('Sentences') && t.includes(d5.words.list[0].w.replace(/　/g, ' ').split(' ')[0]), 'sentence day: the sentences to read');
  await page.close();

  // ---------- week 1's test ----------
  const test = unit(1).test;
  ({ page, logs } = await openBoard(b, q('WeekTest', plan + '&cur=kanau01t&set=test'), css));
  t = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  ok(t.includes('第1週 · 週テスト') && t.includes('かな') && t.includes('ことば'), 'week test: its intro, with its kana and words');
  await page.locator('a:has-text("Start")').first().click();
  await page.waitForTimeout(500);
  const first = await page.evaluate((x) => [...document.querySelectorAll('[lang="ja"]')].some((e) => e.textContent.trim() === x && parseFloat(getComputedStyle(e).fontSize) >= 36), test[0].big);
  ok(first, 'week test: the kana asked about is shown large');
  for (let i = 0; i < test.length; i++) {
    await page.locator('button[aria-pressed]').nth(i < 18 ? test[i].answer - 1 : test[i].answer % test[i].options.length).click();
    await page.waitForTimeout(60);
    await page.locator(i === test.length - 1 ? 'button:has-text("Finish")' : 'button:has-text("Next")').first().click();
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(300);
  t = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  ok(t.includes('18') && t.includes('/ 20'), 'week test: 18 of 20');
  await page.locator('a:has-text("Next"), a:has-text("つぎへ"), button:has-text("Next")').first().click().catch(() => {});
  await page.waitForTimeout(400);
  t = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  if (t.includes('Kana') && t.includes('Words')) ok(true, ''); else ok(false, 'week test result: by area, Kana and Words, got ' + t.slice(0, 200));
  await page.close();

  // ---------- the end of the course, on to N5 ----------
  const done = {};
  const tests = {};
  for (let u = 1; u <= 4; u++) { for (let d = 1; d <= 6; d++) done['kanau0' + u + 'd' + d] = { g: 3, k: 1, r: 1 }; tests['kanau0' + u + 't'] = { id: 'kanau0' + u + 't', score: 20, of: 20, used: 300, areas: {} }; }
  ({ page, logs } = await openBoard(b, q('Main', plan + '&done=' + encodeURIComponent(JSON.stringify(done)) + '&tests=' + encodeURIComponent(JSON.stringify(tests))), css));
  t = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  ok(t.includes('かな 完了！') && t.includes('カタカナ（２）'), 'the course done: its last week, and the card says so');
  await page.locator('button:has-text("N5へ")').click();
  await page.waitForTimeout(600);
  t = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  ok(t.includes('目標を決めよう') && await page.locator('button[aria-pressed="true"]:has-text("N5")').count() === 1, 'on to N5: its goal screen, N5 picked');
  await page.close();

  await b.close();
  console.log(fail.length ? `KANA FLOW FAIL (${fail.length})` : 'KANA FLOW PASS');
  process.exit(fail.length ? 1 : 0);
})().catch((e) => { console.error(e); console.log('KANA FLOW FAIL'); process.exit(1); });
