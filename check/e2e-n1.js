// Full click-through of the N1 course in the app (YK_LEVEL=N1 bash run-app.sh e2e-n1.js), on 14 Oct 2026:
// a plan made on the goal screen (a session and a pace), the week path, the first day's cards, and every part of that
// day (teach, compare, drill, ★, exam-style, kanji and words, reading, listening) until the day is stamped; then the
// week test opened early from the path, the notebook, and a new plan from the menu. The answers come from the content
// bank (window.ykN1), so the check follows the course as it is written.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { openBoard, inspect, site, out } = require('./rt-check.js');
const { clips } = require('./level.js');

const TODAY = '2026-10-14';

(async () => {
  const fontsCss = fs.readFileSync(path.join(site, 'fonts.css'), 'utf8');
  const browser = await chromium.launch();
  const { page, logs } = await openBoard(browser, 'App.dc.html?ykdate=' + TODAY, fontsCss);
  const startUrl = page.url();
  let fails = 0;
  let pads = 0;
  const ok = (cond, msg) => { if (!cond) { fails += 1; console.log('  FAIL: ' + msg); } };
  const click = async (sel, wait = 450) => { await page.locator(sel).first().click({ timeout: 5000 }); await page.waitForTimeout(wait); };
  const h1 = async () => ((await page.locator('h1').first().textContent()) || '').replace(/\s+/g, ' ').trim();
  const body = async () => ((await page.locator('#yk-stage').textContent()) || '').replace(/\s+/g, ' ');
  const has = async (text) => (await body()).includes(text);
  // SOUND: the clips really play (default). With NOSOUND=1, HELDBACK=1 or BADCLIPS=1 the screens must fall back to their silent stand-in.
  const SOUND = !process.env.NOSOUND && !process.env.HELDBACK && !process.env.BADCLIPS;
  const played = async () => (await page.evaluate(() => window.__audio)).filter((a) => a.ev === 'start').map((a) => a.d);
  const near = (list, ms) => list.some((d) => Math.abs(d - ms) < 120);
  // the n-th option (1 to 4) of the question on screen: the buttons that hold an answer are the pressable ones
  const pick = (n, wait = 300) => click(`button[aria-pressed] >> nth=${n - 1}`, wait);
  // a wrong option for a question with this answer
  const other = (answer, of = 4) => (answer % of) + 1;
  // a button whose words (furigana left out) are these
  const tapText = async (text, sel = 'button', wait = 300) => {
    const found = await page.evaluate(([text, sel]) => {
      document.querySelectorAll('[data-yk-tap]').forEach((e) => e.removeAttribute('data-yk-tap'));
      const words = (el) => { const c = el.cloneNode(true); c.querySelectorAll('rt').forEach((r) => r.remove()); return c.textContent.replace(/\s+/g, ''); };
      const b = [...document.querySelectorAll(sel)].find((el) => words(el) === text.replace(/\s+/g, ''));
      if (b) b.setAttribute('data-yk-tap', '1');
      return !!b;
    }, [text, sel]);
    ok(found, 'no button "' + text + '" to tap');
    if (found) await click('[data-yk-tap="1"]', wait);
  };
  const at = async (name, expectH1) => {
    const t = await page.locator('h1').count() ? await h1() : '(no h1)';
    const info = await inspect(page);
    await page.screenshot({ path: path.join(out, 'e2e-n1-' + name + '.png') });
    const bad = info.errors.length || info.issues.length || info.unresolved;
    console.log(`${name}: h1="${t}" root=${info.rootH}` + (bad ? ' PROBLEMS ' + JSON.stringify({ e: info.errors, i: info.issues, u: info.unresolved }) : '') + (info.pad.length ? ' PAD WARNING ' + JSON.stringify(info.pad) : ''));
    pads += info.pad.length;
    if (expectH1) ok(t.includes(expectH1), `${name}: expected h1 to include "${expectH1}", got "${t}"`);
    ok(!bad, name + ': layout or runtime problems');
    ok(page.url() === startUrl, name + ': the frame navigated away to ' + page.url());
  };

  // ---------- the goal: the July 2027 session, 60 minutes a day ----------
  await at('01-goal', '目標を決めよう');
  ok((await page.locator('button:has-text("N2")').count()) === 0, 'goal: N5 to N2 belong to their own app and should not be offered');
  ok(await has('N5〜N2は別のアプリです'), 'goal: the note about the other app is missing');
  const sessions = await page.evaluate(() => window.ykN1.sessions());
  ok(sessions.length === 3 && sessions[0].date === '2026-12-06', 'goal: three sessions from December 2026 expected, got ' + JSON.stringify(sessions.map((s) => s.date)));
  ok(await has('あと53日'), 'goal: the December session should be 53 days away');
  await click('button[aria-haspopup="dialog"]', 500);
  await at('02-goal-sessions');
  ok((await page.locator('[role=dialog] button[aria-pressed]').count()) === 3, 'goal: the sheet should offer three sessions');
  await click('[role=dialog] button[aria-pressed] >> nth=1', 300);
  await click('[role=dialog] button:has-text("Confirm")', 500);
  ok(await has('2027年7月4日'), 'goal: the July 2027 session should be chosen');
  await click('button:has-text("30分")', 300);
  const card30 = await body();
  await click('button:has-text("60分")', 300);
  const card60 = await body();
  ok(card30 !== card60, 'goal: the plan card should change with the daily time');
  ok(card60.includes('Everything is taught by week'), 'goal: at 60 minutes to July everything should be taught, got ' + card60.slice(card60.indexOf('プラン'), card60.indexOf('プラン') + 160));
  await click('button:has-text("Paint the first eye")');
  await at('03-goal-painted', '目標を決めよう');
  ok(await has('One eye in'), 'goal: the painted line is missing');
  await click('a:has-text("Start")', 700);

  // the plan the app has just made, worked out again from the same choices
  const EXAM = sessions[1].date;
  const day = await page.evaluate(([today, exam]) => {
    const N = window.ykN1;
    const plan = N.make({ start: today, exam, pace: 60 });
    const v = N.view(plan, 0);
    const l = v.grammar;
    /* the quiz of the kanji and words step, as Scene builds it */
    const tidy = (q) => {
      if (!q || !Array.isArray(q.options)) return null;
      const keep = q.options.map((o, k) => ({ o, k: k + 1 })).filter((x) => x.o != null && x.o !== '');
      const answer = keep.findIndex((x) => x.k === q.answer) + 1;
      return answer > 0 && keep.length >= 2 ? { src: q.src, answer, n: keep.length } : null;
    };
    const quiz = N.kanjiQuiz(plan, 0, 8).concat(v.wi.map((wi) => N.wordQ(wi))).map(tidy).filter(Boolean);
    const week = N.testFor(plan, 6).map(tidy).filter(Boolean);
    const at = N.words[v.wi[0]];
    const t = l.listening;
    const chars = N.plain(t.line).length + t.replies.slice(0, 3).reduce((a, x) => a + N.plain(x).length + 3, 0);
    return {
      weeks: Math.ceil(plan.days.length / 7), kinds: plan.days.slice(0, 7).map((x) => x.t), title: N.titleOf(v.gi), unit: v.unit.ja, id: l.id,
      pats: l.grammar.patterns.map((p) => p.p), check: l.grammar.compare.check.answer,
      drills: l.grammar.drills.map((d) => ({ answer: d.answer, wrong: N.plain(d.options[d.answer % 4]), line: N.plain(d.ja) })),
      star: l.grammar.star.tiles.map((x) => N.plain(x)),
      exam: [0, 1, 2].map((n) => { const q = N.grammarQ(v.gi, 'x' + n); return { answer: q.answer, src: q.src, line: N.plain(q.ja || q.pre) }; }),
      K: v.kanji.length, W: v.words.length, kanji: v.kanji.map((k) => k.c), word: at ? 'w.' + N.lessons[at.li].id + '.' + at.i : '',
      quiz, week, reading: l.reading.answer, readingAsk: N.plain(l.reading.ask), short: (l.reading.short || [])[l.reading.answer % 4],
      listening: t.answer, standIn: 150 * chars + 600 + 1000 * 3,
    };
  }, [TODAY, EXAM]);
  ok(day.kinds.join('') === '0000001', 'plan: the first week should be six study days and a week test, got ' + day.kinds.join(''));
  ok(day.K > 0 && day.W > 0 && day.quiz.length > 0 && day.week.length >= 6, 'plan: the first day should hold kanji, words and a quiz, and the week a test: ' + JSON.stringify({ K: day.K, W: day.W, q: day.quiz.length, w: day.week.length }));

  // ---------- the week path: the first day is today ----------
  await at('04-main');
  ok(await has(day.unit), 'main: the week banner should name the first unit, ' + day.unit);
  ok(await has('Week 1 of ' + day.weeks), 'main: expected week 1 of ' + day.weeks);
  ok(await has('あと263日'), 'main: the days to the exam are missing');
  ok((await page.locator('[aria-label="0 days stamped"]').count()) === 1, 'main: nothing should be stamped yet');
  ok(await has('今日') && await has('TODAY'), 'main: the callout should mark the first day as today');
  await click('a:has-text("はじめる")', 700);

  // ---------- today: the four cards ----------
  await at('05-today-fresh', day.pats[0]);
  ok((await h1()).replace(/\s/g, '') === day.title.replace(/\s/g, ''), 'today: the title should be the lesson, ' + day.title);
  ok(await has('第1週 · 1日目'), 'today: the day is not named');
  ok((await page.locator('a[aria-label^="Grammar:"]').count()) === 1, 'today: the grammar card is missing');
  ok((await page.locator('a[aria-label^="Kanji and words:"]').count()) === 1, 'today: the kanji and words card is missing');
  ok((await page.locator('a[aria-label^="Reading:"]').count()) === 1, 'today: the reading card is missing');
  ok((await page.locator('a[aria-label^="Listening:"]').count()) === 1, 'today: the listening card is missing');
  ok(await has('Finish all four parts to stamp day 1'), 'today: the stamp note is missing');
  await click('a:has-text("Start with the teach page")', 700);

  // ---------- teach: three pages ----------
  await at('06-teach-1', day.pats[0]);
  ok((await page.locator('button[aria-label="Play example 2"]').count()) === 1, 'teach: two examples expected');
  await click('button[aria-label="Play example 2"]', 500);
  const key = 'g.' + day.id + '.0.1';
  if (SOUND) {
    await page.waitForTimeout(400);
    ok(near(await played(), clips[key]), `teach: example 2 (${key}, ${clips[key]} ms) should have played, got ` + JSON.stringify(await played()));
  }
  ok((await page.locator('button[aria-label="Play example 2"][aria-pressed="true"]').count()) === 1, 'teach: the example button should be lit while it plays');
  await click('button:has-text("Next")', 600);
  await at('07-teach-2', day.pats[1]);
  await click('button[aria-label^="Back to"]', 500);
  ok((await h1()).includes(day.pats[0]), 'teach: the back button should return to page 1');
  await click('button:has-text("Next")', 500);
  await click('button:has-text("Next")', 600);
  await at('08-teach-3', day.pats[2]);
  await click('a:has-text("Next: compare the three")', 700);

  // ---------- compare: the quick check ----------
  await at('09-compare', 'どれを使う');
  ok((await page.locator('button[aria-pressed]').count()) === 3, 'compare: three options expected');
  await pick(day.check, 500);
  ok(await has('せいかい'), 'compare: the right answer should be explained');
  await at('10-compare-checked');
  await click('a:has-text("Start the drill")', 700);

  // ---------- drill: three questions, the first answered wrong ----------
  await at('11-drill-1');
  ok(await has('1 / 3'), 'drill: the count should start at 1 / 3');
  ok((await page.locator('button[disabled]').count()) === 1, 'drill: Check should start disabled');
  await pick(other(day.drills[0].answer));
  await click('button:has-text("Check")', 600);
  await at('12-drill-1-wrong');
  ok(await has('Saved to your mistake notebook'), 'drill: the saved line is missing');
  ok(await has('your pick'), 'drill: the explanation should mark the pick');
  await click('button:has-text("Next drill")', 500);
  ok(await has('2 / 3'), 'drill: question 2 expected');
  await pick(day.drills[1].answer);
  await click('button:has-text("Check")', 600);
  ok(await has('せいかい'), 'drill: question 2 should be right');
  await click('button:has-text("Next drill")', 500);
  await pick(day.drills[2].answer);
  await click('button:has-text("Check")', 600);
  await at('13-drill-3-right');
  await click('a:has-text("Next: the ★ question")', 700);

  // ---------- the ★ question: the tiles in order ----------
  await at('14-star', '★に入るのはどれ');
  ok((await page.locator('button[disabled]').count()) === 1, 'star: Check should start disabled');
  await click('button:has-text("Show a hint")', 300);
  for (const tile of day.star) await tapText(tile, 'button:not([aria-label])', 250);
  await click('button:has-text("Check")', 600);
  await at('15-star-right', '★に入るのはどれ');
  ok(await has('せいかい'), 'star: the right order should be marked correct');
  await click('a:has-text("Back to today")', 700);
  await at('16-today-exam-open', day.pats[0]);
  ok(await has('Start exam-style'), 'today: after the drill and ★ the next step is exam-style');
  ok((await page.locator('a[aria-label^="Grammar:"][aria-label$="Done"]').count()) === 0, 'today: grammar is not done before the exam-style step');

  // ---------- exam-style: three questions on a clock, the second wrong ----------
  await click('a:has-text("Start exam-style")', 700);
  await at('17-exam-1');
  ok(await has('EXAM-STYLE'), 'exam: strip missing');
  ok((await page.locator('button[disabled]').count()) === 1, 'exam: Next should start disabled');
  const clock0 = await page.locator('[role=timer]').first().textContent();
  await page.waitForTimeout(1300);
  const clock1 = await page.locator('[role=timer]').first().textContent();
  ok(clock0 !== clock1, `exam: the clock should count down (${clock0} -> ${clock1})`);
  await pick(day.exam[0].answer);
  await click('button:has-text("Next")', 500);
  await pick(other(day.exam[1].answer));
  await click('button:has-text("Next")', 500);
  await at('18-exam-3');
  await pick(day.exam[2].answer);
  await click('button:has-text("Finish")', 700);
  await at('19-exam-result', '2');
  ok(await has('1 mistake saved to your notebook'), 'exam: the saved line is missing');
  ok(await has('あなたの答え'), 'exam: the wrong answer should be shown');
  await click('a:has-text("Next")', 700);
  await at('20-today-grammar-done', day.pats[0]);
  ok((await page.locator('a[aria-label^="Grammar:"][aria-label$="Done"]').count()) === 1, 'today: grammar should be done');

  // ---------- kanji and words: the kanji, the words, the quiz with one slip ----------
  await click('a[aria-label^="Kanji and words:"]', 700);
  await at('21-scene-kanji');
  ok(await has(day.K + ' kanji') && await has('0 of ' + day.K + ' seen'), 'scene: the kanji count is missing');
  ok((await page.locator('[role=list] button').count()) === day.K, 'scene: one tile per kanji expected');
  await click('[role=list] button >> nth=0', 500);
  await at('22-scene-kanji-sheet');
  ok((await page.locator('[role=dialog][aria-label="Kanji ' + day.kanji[0] + '"]').count()) === 1, 'scene: the sheet should show the first kanji');
  await click('[role=dialog] button:has-text("Next kanji")', 400);
  ok((await page.locator('[role=dialog][aria-label="Kanji ' + day.kanji[1] + '"]').count()) === 1, 'scene: Next kanji should show the second');
  await click('[role=dialog] button[aria-label="Close"]', 400);
  ok(await has('2 of ' + day.K + ' seen'), 'scene: two kanji should count as seen');
  await click('button:has-text("Next: words")', 600);
  await at('23-scene-words');
  ok(await has(day.W === 1 ? '1 word' : day.W + ' words'), 'scene: the word count is missing');
  await click('[role=list] button[aria-pressed] >> nth=0', 500);
  if (SOUND) {
    await page.waitForTimeout(400);
    ok(near(await played(), clips[day.word]), `scene: the first word (${day.word}, ${clips[day.word]} ms) should have played, got ` + JSON.stringify(await played()));
  }
  await click('button:has-text("Next: the quiz")', 600);
  await at('24-scene-quiz');
  ok(await has('1 / ' + day.quiz.length), 'scene: the quiz count should start at 1 / ' + day.quiz.length);
  for (let n = 0; n < day.quiz.length; n++) {
    const q = day.quiz[n];
    await pick(n === 0 ? other(q.answer, q.n) : q.answer, 250);
    await click('button:has-text("Check")', 400);
    if (n === 0) {
      await at('25-scene-quiz-wrong');
      ok(await has('Saved to your mistake notebook'), 'scene: a wrong answer should be saved');
    }
    await click(n === day.quiz.length - 1 ? 'button:has-text("See your score")' : 'button:has-text("Next question")', 400);
  }
  await at('26-scene-score');
  ok(await has('Quiz done') && (await page.locator(`[role=img][aria-label="${day.quiz.length - 1} of ${day.quiz.length} right first time"]`).count()) === 1, 'scene: the score should be all but one');
  ok(await has('To look at again'), 'scene: the missed word should be listed');
  await click('a:has-text("Done")', 700);
  await at('27-today-two-done', day.pats[0]);
  ok((await page.locator('a[aria-label^="Kanji and words:"][aria-label$="Done"]').count()) === 1, 'today: kanji and words should be done');

  // ---------- reading: answered wrong ----------
  await click('a[aria-label^="Reading:"]', 700);
  await at('28-reading', day.readingAsk);
  ok((await page.locator('button[disabled]').count()) === 1, 'reading: Check should start disabled');
  await pick(other(day.reading));
  await click('button:has-text("Check")', 600);
  await at('29-reading-wrong');
  ok(await has('Why each option') && await has('your pick'), 'reading: the explanation should cover each option');
  ok(await has('Saved to your mistake notebook'), 'reading: the saved line is missing');
  await click('a:has-text("Next")', 700);

  // ---------- listening: the clip, then the right reply ----------
  await click('a[aria-label^="Listening:"]', 700);
  await at('30-listening', 'いちばんいい返事は');
  ok(await has('Listen first'), 'listening: the replies should wait for the audio');
  const lkey = 'l.' + day.id;
  const t0 = Date.now();
  await click('button[aria-label="Play audio"]', 300);
  await page.waitForFunction(() => [...document.querySelectorAll('button[aria-label^="Reply"]')].filter((b) => b.getAttribute('aria-disabled') !== 'true').length === 3, null, { timeout: 60000 });
  const took = Date.now() - t0;
  console.log('   listening clip took ' + took + ' ms' + (SOUND ? ` (clip ${clips[lkey]} ms)` : ` (stand-in ${day.standIn} ms)`));
  if (SOUND) ok(near(await played(), clips[lkey]) && took > clips[lkey] - 490 && took < clips[lkey] + 2500, 'listening: the clip should have played in full');
  else ok(took > day.standIn - 1500 && took < day.standIn + 2500, `listening: without sound the stand-in should take about ${day.standIn} ms, took ${took}`);
  await pick(day.listening, 600);
  await at('31-listening-right', 'いちばんいい返事は');
  ok(await has('せいかい') && await has('Script'), 'listening: the script should open on a right answer');
  await click('a:has-text("Next")', 800);

  // ---------- the day is stamped ----------
  await at('32-today-all-done', day.pats[0]);
  ok(await has('1日目 完了'), 'today: the day-done banner is missing');
  ok(await has('Day 1 is stamped on your card'), 'today: the stamp line is missing');
  await click('a:has-text("もどる")', 900);
  await at('33-main-day-done');
  ok((await page.locator('[aria-label="1 day stamped"]').count()) === 1, 'main: one day should be stamped');
  ok((await page.locator('a[aria-label="Day 1 of week 1, done. Open it again"]').count()) === 1, 'main: day 1 should be stamped on the path');
  ok(await has('Opens tomorrow'), 'main: day 2 is tomorrow and should ask before it opens');

  // ---------- the week test, opened early from the path ----------
  await click('button[aria-label="Day 7 of week 1, week test, locked. Open early"]', 500);
  await at('34-main-open-early');
  ok((await page.locator('[role=dialog][aria-label="Open day 7 early?"]').count()) === 1, 'main: the open-early sheet is missing');
  await click('[role=dialog] a:has-text("Open")', 800);
  await at('35-weektest-intro');
  ok(await has('第1週 · 週テスト') && await has(day.week.length + '問'), 'week test: the intro should name the week and its ' + day.week.length + ' questions');
  await click('button:has-text("Start the test")', 600);
  await at('36-weektest-q1');
  ok(await has('1 / ' + day.week.length), 'week test: the count should start at 1 / ' + day.week.length);
  for (let n = 0; n < day.week.length; n++) {
    const q = day.week[n];
    await pick(n % 5 === 1 ? other(q.answer, q.n) : q.answer, 200);
    await click(n === day.week.length - 1 ? 'button:has-text("Finish")' : 'button:has-text("Next")', 300);
  }
  const slips = day.week.filter((q, n) => n % 5 === 1).length;
  await page.waitForTimeout(500);
  await at('37-weektest-result');
  ok((await h1()) === String(day.week.length - slips), `week test: expected ${day.week.length - slips} right, got ${await h1()}`);
  ok(await has('Week 1: 2 of 7'), 'week test: the stamp card should show two days of week 1');
  ok(await has(slips + ' mistakes went into your notebook'), 'week test: the saved line is missing');
  await click('a:has-text("Close")', 800);
  await at('38-main-after-test');
  ok((await page.locator('[aria-label="2 days stamped"]').count()) === 1, 'main: two days should be stamped');
  ok((await page.locator('a[aria-label="Day 7 of week 1, week test, done. Open it again"]').count()) === 1, 'main: the week test should be stamped');

  // ---------- the notebook holds the day's mistakes ----------
  await click('nav a:has-text("Notebook")', 700);
  await at('39-notebook', '間違いノート');
  const nb = await body();
  ok(nb.includes(day.drills[0].wrong), 'notebook: the drill mistake is missing');
  ok(nb.includes('文の文法1'), 'notebook: the exam-style mistake is missing');
  ok(nb.includes('読解') && (!day.short || nb.includes(day.short)), 'notebook: the reading mistake is missing');
  ok(nb.includes('back tomorrow') && nb.includes('all caught up'), 'notebook: new mistakes should come back tomorrow, none due today');

  // ---------- readiness counts the day ----------
  await click('nav a:has-text("Readiness")', 700);
  await at('40-readiness');
  ok(await has('Readiness · N1'), 'readiness: heading missing');

  // ---------- a new plan from the menu: December 2027, 30 minutes a day ----------
  await click('nav a:has-text("Path")', 700);
  await click('button[aria-label="Level N1, change level"]', 500);
  await at('41-menu');
  await click('button:has-text("Change the plan")', 700);
  await at('42-replan', 'プランを変える');
  ok(await has('Done so far: 1 of 48 lessons and ' + day.K + ' of 1,113 kanji'), 'replan: the card should count what is done');
  await click('button[aria-haspopup="dialog"]', 500);
  await click('[role=dialog] button[aria-pressed] >> nth=2', 300);
  await click('[role=dialog] button:has-text("Confirm")', 500);
  await click('button:has-text("30分")', 400);
  await at('43-replan-chosen', 'プランを変える');
  ok(await has('2027年12月5日'), 'replan: the December 2027 session should be chosen');
  await click('a:has-text("Update the plan")', 800);
  await at('44-main-replanned');
  const weeks2 = await page.evaluate((exam) => Math.ceil(window.ykN1.diff(window.ykN1.today(), exam) / 7), sessions[2].date);
  ok(await has('Week 1 of ' + weeks2), 'replan: the path should now run to December 2027, week 1 of ' + weeks2);
  ok((await page.locator('[aria-label="2 days stamped"]').count()) === 1, 'replan: the days done should keep their stamps');
  ok((await page.locator('a[aria-label="Day 1 of week 1, done. Open it again"]').count()) === 1, 'replan: day 1 should stay stamped');
  await click('button[aria-label="Level N1, change level"]', 500);
  await click('button:has-text("Change the plan")', 700);
  ok(await has('Each week: 6 study days') && await has('2027年12月5日') && (await page.locator('button[aria-pressed="true"]:has-text("30分")').count()) === 1, 'replan: the goal screen should open on the plan as it now is');
  await click('button[aria-label^="Back to the week path"]', 700);
  await at('45-main-kept');
  ok(await has('Week 1 of ' + weeks2), 'replan: going back should keep the plan');

  const noisy = logs.filter((l) => !/Download the React DevTools/.test(l));
  console.log('clips started (ms): ' + JSON.stringify(await played()));
  if (!SOUND) ok((await played()).length === 0, 'no clip should start when sound is off');
  console.log('console problems: ' + JSON.stringify(noisy.slice(0, 10)));
  if (pads) console.log(`PAD WARNINGS: ${pads} (content in the bottom 34 px)`);
  console.log((SOUND ? 'with sound: ' : 'silent fallback: ') + (fails === 0 && noisy.length === 0 ? 'E2E PASS' : `E2E FAIL (${fails} failed checks, ${noisy.length} console problems)`));
  await browser.close();
})().catch((e) => { console.error('E2E CRASH', e); process.exit(1); });
