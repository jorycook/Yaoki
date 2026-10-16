// Full click-through of the N1 course in the app (YK_LEVEL=N1 bash run-app.sh e2e-n1.js), on 14 Oct 2026:
// a plan made on the goal screen (a session and a pace), the week path, the first day's cards, and every part of that
// day (teach, compare, drill, ★, exam-style, kanji and words with the two review questions of the earlier levels,
// reading, listening) until the day is stamped; then the second day opened early for its longer reading and listening
// (the bank's kinds), the week test opened early from the path with its 復習 section, the notebook, and a new plan from
// the menu. The answers come from the content bank (window.ykN1), so the check follows the course as it is written.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { openBoard, inspect, site, out } = require('./rt-check.js');
const { clips } = require('./level.js');

const TODAY = '2026-10-14';

(async () => {
  const fontsCss = fs.readFileSync(path.join(site, 'fonts.css'), 'utf8');
  const browser = await chromium.launch();
  // the page's own clock stands on that day too, so a mistake made now is made on it
  const { page, logs } = await openBoard(browser, 'App.dc.html?ykdate=' + TODAY, fontsCss, (pg) => pg.clock.install({ time: new Date(TODAY + 'T10:00:00') }));
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
    /* the quiz of the kanji and words step, as Scene builds it: the kanji readings, the words, then two questions of
       the earlier levels (q.review, with their level) */
    const tidy = (q) => {
      if (!q || !Array.isArray(q.options)) return null;
      const keep = q.options.map((o, k) => ({ o, k: k + 1 })).filter((x) => x.o != null && x.o !== '');
      const answer = keep.findIndex((x) => x.k === q.answer) + 1;
      return answer > 0 && keep.length >= 2 ? { src: q.src, answer, n: keep.length, review: !!q.review, level: q.level || '', type: q.type, wrong: N.plain(keep[answer % keep.length].o) } : null;
    };
    const quiz = N.kanjiQuiz(plan, 0, 8).concat(v.wi.map((wi) => N.wordQ(wi)), N.dayReview(plan, 0, 2)).map(tidy).filter(Boolean);
    const week = N.testFor(plan, 6).map(tidy).filter(Boolean);
    /* the first day of the week whose reading and listening are both the bank's longer kinds */
    let bi = -1;
    for (let j = 1; j < 6 && bi < 0; j++) { const b = N.view(plan, j); if (b.reading && b.reading.kind !== 'short' && b.listening && b.listening.kind !== 'quick') bi = j; }
    const bv = bi >= 0 ? N.view(plan, bi) : null;
    const br = bv && bv.reading.item, bl = bv && bv.listening.item;
    /* a bank listening item's parts: their clips, and the stand-in time each would take without sound */
    const parts = bl ? bl.audio.map((a, k) => ({ key: bv.listening.clips[k], ms: 600 + 150 * a.lines.reduce((n, l) => n + N.plain(l[1]).length, 0) })) : [];
    const bank = bv ? {
      i: bi, dow: bv.dow, rkind: bv.reading.kind, rsrc: bv.reading.src, rtype: br.type, rask: N.plain(br.ask), ranswer: br.answer, rparas: Array.isArray(br.passage) ? br.passage.length : 0,
      rshort: (br.short || [])[br.answer % 4], lkind: bv.listening.kind, lsrc: bv.listening.src, ltype: bl.type, lask: N.plain(bl.ask), lanswer: bl.answer, wait: bl.wait,
      lfirst: N.plain(bl.audio[0].lines[0][1]).slice(0, 12), parts,
    } : null;
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
      listening: t.answer, standIn: 150 * chars + 600 + 1000 * 3, bank,
    };
  }, [TODAY, EXAM]);
  ok(day.kinds.join('') === '0000001', 'plan: the first week should be six study days and a week test, got ' + day.kinds.join(''));
  ok(day.K > 0 && day.W > 0 && day.quiz.length > 0 && day.week.length >= 6, 'plan: the first day should hold kanji, words and a quiz, and the week a test: ' + JSON.stringify({ K: day.K, W: day.W, q: day.quiz.length, w: day.week.length }));
  const quizReview = day.quiz.filter((q) => q.review);
  ok(quizReview.length === 2 && day.quiz.slice(-2).every((q) => q.review), 'plan: the day quiz should end with two review questions of the earlier levels, got ' + JSON.stringify(quizReview));
  const weekReview = day.week.filter((q) => q.review);
  ok(weekReview.length === 4 && day.week.slice(-4).every((q) => q.review), 'plan: the week test should end with four review questions (復習), got ' + JSON.stringify(weekReview));
  ok(!!day.bank && day.bank.i === 1, 'plan: the second day should hold the bank\'s longer reading and listening, got ' + JSON.stringify(day.bank && { i: day.bank.i }));

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

  // ---------- kanji and words: the kanji, the words, the quiz with two slips (the first, and the last review question) ----------
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
  const lastQ = day.quiz.length - 1;
  for (let n = 0; n < day.quiz.length; n++) {
    const q = day.quiz[n];
    ok(await has((n + 1) + ' / ' + day.quiz.length), `scene: question ${n + 1} of ${day.quiz.length} expected`);
    /* a review question of the earlier levels says where it comes from */
    if (q.review) {
      ok(await has('復習 ' + q.level), `scene: review question ${n + 1} (${q.src}) should be marked 復習 ${q.level}`);
      if (n === lastQ - 1) await at('24b-scene-quiz-review');
    } else ok(!(await has('復習 N')), `scene: question ${n + 1} (${q.src}) is not a review question`);
    await pick(n === 0 || n === lastQ ? other(q.answer, q.n) : q.answer, 250);
    await click('button:has-text("Check")', 400);
    if (n === 0 || n === lastQ) {
      await at(n === 0 ? '25-scene-quiz-wrong' : '25b-scene-quiz-review-wrong');
      ok(await has('Saved to your mistake notebook'), 'scene: a wrong answer should be saved');
    }
    await click(n === lastQ ? 'button:has-text("See your score")' : 'button:has-text("Next question")', 400);
  }
  await at('26-scene-score');
  ok(await has('Quiz done') && (await page.locator(`[role=img][aria-label="${day.quiz.length - 2} of ${day.quiz.length} right first time"]`).count()) === 1, 'scene: the score should be all but two');
  ok(await has('To look at again'), 'scene: the missed word should be listed');
  ok(await has('and 2 review questions from N2 to N4'), 'scene: the score should count the two review questions');
  ok(await has(day.quiz[lastQ].level + ' review'), 'scene: the missed review question should be listed with its level');
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
  // the slower take starts first; a tap on the play button then starts the item again at full speed
  await click('button[aria-label^="Play slowly"]', 900);
  if (SOUND) ok(near(await played(), clips[lkey + '.slow']), `listening: the slow take (${lkey}.slow, ${clips[lkey + '.slow']} ms) should have started, got ` + JSON.stringify(await played()));
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

  // ---------- day 2, opened early: the bank's longer reading (answered wrong) and listening (answered right) ----------
  const B = day.bank || {};
  const RK = { mid: 'mid passage', info: 'information', pair: 'two texts' };
  const LE = { task: 'Task', point: 'Key point', gist: 'Main idea' };
  /* day 2 is the day to work on: its callout asks before it opens early */
  ok((await page.locator(`[aria-label="Day ${B.dow} of week 1, ahead of plan. Open early"]`).count()) === 1, 'main: day ' + B.dow + ' should be highlighted, ahead of plan');
  await click('button:has-text("Open early")', 500);
  ok((await page.locator(`[role=dialog][aria-label="Open day ${B.dow} early?"]`).count()) === 1, 'main: the open-early sheet for day ' + B.dow + ' is missing');
  await click('[role=dialog] a:has-text("Open")', 800);
  await at('33b-today-bank');
  ok(await has('第1週 · ' + B.dow + '日目'), 'today: day ' + B.dow + ' should be open');
  ok((await page.locator(`a[aria-label^="Reading: ${RK[B.rkind]}, "]`).count()) === 1 && await has('Reading · ' + RK[B.rkind]) && await has(B.rtype), `today: the reading card should name its kind (${RK[B.rkind]}, ${B.rtype})`);
  ok((await page.locator(`a[aria-label="Listening: ${LE[B.lkind].toLowerCase()}"]`).count()) === 1 && await has(B.ltype) && await has(LE[B.lkind]), `today: the listening card should name its kind (${B.ltype}, ${LE[B.lkind]})`);
  await click('a[aria-label^="Reading:"]', 700);
  await at('33c-reading-bank', B.rask);
  ok(await has(B.rtype), 'reading (bank): the tag should give the paper\'s name, ' + B.rtype);
  ok(await has('/ ' + ({ mid: '3:00', info: '2:30', pair: '3:00' })[B.rkind]), 'reading (bank): the clock should allow the longer item its time');
  if (B.rkind === 'mid') ok((await page.locator('[data-yk-passage] div[style*="text-indent: 1em"]').count()) === B.rparas, `reading (bank): the passage should be ${B.rparas} paragraphs`);
  ok((await page.locator('button[disabled]').count()) === 1, 'reading (bank): Check should start disabled');
  await pick(other(B.ranswer));
  await click('button:has-text("Check")', 600);
  await at('33d-reading-bank-wrong');
  ok(await has('Why each option') && await has('your pick') && await has('STRATEGY'), 'reading (bank): the explanation should cover each option and the strategy');
  ok(await has('Saved to your mistake notebook'), 'reading (bank): the saved line is missing');
  ok((await page.locator('[data-yk-mark="1"]').count()) > 0, 'reading (bank): the signposts should light up once checked');
  await click('a:has-text("Next")', 700);
  await click('a[aria-label^="Listening:"]', 700);
  await at('33e-listening-bank', B.lask);
  ok(await has(B.ltype) && await has('Listen first, then choose 1 to 4'), 'listening (bank): the type and the wait line are missing');
  ok((await page.locator('button[aria-label^="Option "][aria-disabled="true"]').count()) === 4, 'listening (bank): the four options should wait for the audio');
  ok((await page.locator('button[aria-label^="Play slowly"]').count()) === 0, 'listening (bank): the slow take belongs to the quick-response item only');
  const lt0 = Date.now();
  const before2 = (await played()).length;
  await click('button[aria-label^="Play the audio"]', 300);
  await page.waitForFunction(() => [...document.querySelectorAll('button[aria-label^="Option "]')].filter((b) => b.getAttribute('aria-disabled') !== 'true').length === 4, null, { timeout: 120000 });
  const ltook = Date.now() - lt0;
  const clipSum = B.parts.reduce((a, c) => a + (clips[c.key] || 0), 0) + 400 * (B.parts.length - 1);
  const standSum = B.parts.reduce((a, c) => a + c.ms, 0) + 400 * (B.parts.length - 1);
  /* a clip that plays, or one held back by the browser, runs for its own length; without the sound scripts, or with
     clips that cannot be decoded, the stand-in times run */
  const expect2 = SOUND || process.env.HELDBACK ? clipSum : standSum;
  console.log(`   bank listening (${B.parts.map((c) => c.key).join(', ')}) took ${ltook} ms (expected about ${expect2} ms)`);
  ok(B.parts.every((c) => clips[c.key] > 0), 'listening (bank): every part should have its clip: ' + JSON.stringify(B.parts.map((c) => [c.key, clips[c.key]])));
  if (SOUND) {
    const got = (await played()).slice(before2);
    ok(got.length === B.parts.length && B.parts.every((c, k) => Math.abs(got[k] - clips[c.key]) < 120), 'listening (bank): each part should have played in turn, got ' + JSON.stringify(got));
  }
  ok(ltook > expect2 - 1500 && ltook < expect2 + 3000, `listening (bank): the audio should take about ${expect2} ms, took ${ltook}`);
  ok(await has('解答 '), 'listening (bank): the answer time should count down once the audio is over');
  await pick(B.lanswer, 600);
  await at('33f-listening-bank-right', B.lask);
  ok(await has('せいかい') && await has('Script') && await has(B.lfirst), 'listening (bank): the script should open on a right answer');
  await click('a:has-text("Next")', 800);
  await at('33g-today-bank-two-done');
  ok((await page.locator('a[aria-label^="Reading:"][aria-label$="Done"]').count()) === 1 && (await page.locator('a[aria-label^="Listening:"][aria-label$="Done"]').count()) === 1, 'today: the bank reading and listening should be done');
  ok(!(await has(B.dow + '日目 完了')), 'today: day ' + B.dow + ' still has its other parts to do');
  await click('a[aria-label="Back to the week path"]', 900);
  await at('33h-main-day2-started');
  ok((await page.locator('[aria-label="1 day stamped"]').count()) === 1, 'main: day ' + B.dow + ' is not done, so one day stays stamped');

  // ---------- the week test, opened early from the path ----------
  await click('button[aria-label="Day 7 of week 1, week test, locked. Open early"]', 500);
  await at('34-main-open-early');
  ok((await page.locator('[role=dialog][aria-label="Open day 7 early?"]').count()) === 1, 'main: the open-early sheet is missing');
  await click('[role=dialog] a:has-text("Open")', 800);
  await at('35-weektest-intro');
  ok(await has('第1週 · 週テスト') && await has(day.week.length + '問'), 'week test: the intro should name the week and its ' + day.week.length + ' questions');
  /* its third section: the review of the earlier levels, four questions, counted by level */
  const byLevel = ['N2', 'N3', 'N4'].map((L) => [L, weekReview.filter((q) => q.level === L).length]).filter((x) => x[1]).map((x) => x[1] + ' from ' + x[0]).join(', ');
  ok(await has('復習') && await has(byLevel) && await has('then a few questions from N2 to N4'), 'week test: the intro should list the 復習 section (' + byLevel + ')');
  await click('button:has-text("Start the test")', 600);
  await at('36-weektest-q1');
  ok(await has('1 / ' + day.week.length), 'week test: the count should start at 1 / ' + day.week.length);
  /* every fifth question wrong, and the first review question */
  const firstReview = day.week.findIndex((q) => q.review);
  const slip = (n) => n % 5 === 1 || n === firstReview;
  for (let n = 0; n < day.week.length; n++) {
    const q = day.week[n];
    if (q.review) {
      ok(await has('復習 ' + q.level), `week test: question ${n + 1} (${q.src}) should be marked 復習 ${q.level}`);
      if (n === firstReview) await at('36b-weektest-review');
    }
    await pick(slip(n) ? other(q.answer, q.n) : q.answer, 200);
    await click(n === day.week.length - 1 ? 'button:has-text("Finish")' : 'button:has-text("Next")', 300);
  }
  const slips = day.week.filter((q, n) => slip(n)).length;
  await page.waitForTimeout(500);
  await at('37-weektest-result');
  ok((await h1()) === String(day.week.length - slips), `week test: expected ${day.week.length - slips} right, got ${await h1()}`);
  ok(await has('Week 1: 2 of 7'), 'week test: the stamp card should show two days of week 1');
  ok(await has(slips + ' mistakes went into your notebook'), 'week test: the saved line is missing');
  const revRight = day.week.filter((q, n) => q.review && !slip(n)).length;
  ok((await page.locator(`[aria-label^="Review of the earlier levels: ${revRight} of 4"]`).count()) === 1, `week test: the result should score the 復習 section ${revRight} of 4`);
  ok(await has((firstReview + 1) + ' · ' + day.week[firstReview].type + ' · ' + day.week[firstReview].level), 'week test: the missed review question should be listed with its level');
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
  ok(nb.includes(B.rtype) && (!B.rshort || nb.includes(B.rshort)), 'notebook: the bank reading mistake (' + B.rsrc + ') is missing');
  const qr = day.quiz[day.quiz.length - 1], wr = day.week[firstReview];
  ok(nb.includes('復習 ' + qr.level) && nb.includes('復習 ' + wr.level), 'notebook: the review mistakes should be marked with their level');
  /* (a long answer is cut to fit its row: its start is kept) */
  ok(nb.includes(qr.wrong.slice(0, 6)) && nb.includes(wr.wrong.slice(0, 6)), 'notebook: the review mistakes should keep the wrong answers given (' + qr.wrong + ', ' + wr.wrong + ')');
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
  /* day 2, opened early, keeps only what was done on it (its reading and listening): the new plan moves the rest on,
     so it is complete and stamped with day 1 and the week test */
  ok((await page.locator('[aria-label="3 days stamped"]').count()) === 1, 'replan: the days done should keep their stamps, and day ' + B.dow + ' keep only its reading and listening');
  ok((await page.locator(`a[aria-label="Day ${B.dow} of week 1, done. Open it again"]`).count()) === 1, 'replan: day ' + B.dow + ' should be stamped with what was done on it');
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
