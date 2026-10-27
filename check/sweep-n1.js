// The N1 screens with all of the real content (YK_LEVEL=N1 NOSOUND=1 bash run-app.sh sweep-n1.js), on 14 Oct 2026:
// every lesson through every state its screens have (the three teach pages, compare, each drill and the ★ question
// answered wrong, the exam-style questions and their result, the kanji, the lesson's twenty words and the quiz with
// each question explained, its two review questions of the earlier levels included, reading and listening answered
// wrong), every lesson's longer reading and listening of the banks answered wrong, every week test and some mixed
// reviews question by question, the four mini mocks from their briefing to the last script, every day of the sample
// plan on Today and every week of the path, and the first two weeks of new plans on Today.
// Each state is checked for runtime errors, anything leaving the frame or too small to tap (problems), text cut off
// by its own box (CUT, a problem too) and content in the bottom 34 px (PAD warnings).
// Screenshots: out/sw-n1-<job>-<state>.png for the sample jobs, and for any state with a problem.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { openBoard, inspect, site, out } = require('./rt-check.js');
const { course } = require('./level.js');

const TODAY = '2026-10-14';
const N = course(TODAY);
const enc = (o) => encodeURIComponent(JSON.stringify(o));
const other = (answer, of = 4) => (answer % of) + 1;
const tidy = (q) => {
  if (!q || !Array.isArray(q.options)) return null;
  const keep = q.options.map((o, k) => ({ o, k: k + 1 })).filter((x) => x.o != null && x.o !== '');
  const answer = keep.findIndex((x) => x.k === q.answer) + 1;
  return answer > 0 && keep.length >= 2 ? { src: q.src, answer, n: keep.length, review: !!q.review, level: q.level || '' } : null;
};
/* the word indices of a lesson: its five, then its bank's fifteen */
const lessonWords = (l) => N.words.map((x, wi) => (N.lessons[x.li] === l ? wi : -1)).filter((wi) => wi >= 0);
/* the sample plan with nothing done yet, so every step of a day can be taken; and the sample plan as it is */
const fresh = (open) => { const p = N.demo(); p.days.forEach((x) => { x.p = {}; }); p.open = open; return p; };
const DEMO = N.demo();
const ONLY = process.argv[2] ? new RegExp(process.argv[2]) : null;
/* the jobs whose every state is kept as a screenshot */
const KEEP = /^(lesson-u1l1|lesson-u3l4|lesson-u8l6|bank-u1l1|bank-u1l2|bank-u1l6|bank-u8l6|week-6|week-27|week-62|mock-\d|main|goal-|today-(0|4|6|17|20|56)$|today-p60-[01]$)/;

const jobs = [];

/* ---------- every lesson, on its own day of the sample plan ---------- */
DEMO.days.forEach((x, i) => {
  if (x.t !== 0 || x.g < 0) return;
  const l = N.lessons[x.g];
  const plan = fresh(i);
  /* the day holds all twenty of its lesson's words, the most the words step shows */
  plan.days[i].w = lessonWords(l);
  const v = N.view(plan, i);
  /* the quiz as Scene builds it: the kanji readings, the words, then two review questions of the earlier levels */
  const quiz = N.kanjiQuiz(plan, i, 8).concat(v.wi.map((wi) => N.wordQ(wi)), N.dayReview(plan, i, 2)).map(tidy).filter(Boolean);
  /* the kanji whose sheet holds the most: the longest meaning, and the most readings */
  const most = (f) => v.kanji.reduce((b, k, n) => (f(k) > f(v.kanji[b]) ? n : b), 0);
  const sheets = [...new Set([most((k) => (k.en || []).join(', ').length), most((k) => (k.on || []).join('、').length + (k.kun || []).join('、').length)])];
  /* the writing: the kanji of those two sheets are written there (by themselves, write: true), the day's others are
     written already; of its words of two kanji or more, the longest is written in the words' writing step */
  const KANJI = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3005]/;
  const wrote = v.kanji.filter((k, n) => !sheets.includes(n)).map((k) => k.c).join('');
  const compounds = v.wi.map((wi) => N.plain(N.word(wi).w)).filter((w) => [...w].filter((c) => KANJI.test(c)).length >= 2);
  const longest = compounds.reduce((b, w) => (w.length > b.length ? w : b), '');
  jobs.push({
    name: 'lesson-' + l.id,
    url: 'TShell.dc.html?screen=Teach&ykdate=' + TODAY + '&plan=' + enc(plan) + '&wrote=' + encodeURIComponent(wrote) + '&words=' + enc(compounds.filter((w) => w !== longest)),
    clock: true,
    write: true,
    run: async (t) => {
      const g = l.grammar;
      await t.shot('teach-1');
      await t.click('button:has-text("Next")');
      await t.shot('teach-2');
      await t.click('button:has-text("Next")');
      await t.shot('teach-3');
      await t.click('a:has-text("Next: compare the three")');
      await t.shot('compare');
      await t.pick(other(g.compare.check.answer, 3));
      await t.shot('compare-wrong');
      await t.click('a:has-text("Start the drill")');
      for (let k = 0; k < 3; k++) {
        await t.shot('drill-' + (k + 1));
        await t.pick(other(g.drills[k].answer));
        await t.click('button:has-text("Check")');
        await t.shot('drill-' + (k + 1) + '-wrong');
        await t.click(k < 2 ? 'button:has-text("Next drill")' : 'a:has-text("Next: the ★ question")');
      }
      await t.click('button:has-text("Show a hint")');
      await t.shot('star-hint');
      for (const tile of g.star.tiles.slice().reverse()) await t.tapText(N.plain(tile), 'button:not([aria-label])');
      await t.shot('star-full');
      await t.click('button:has-text("Check")');
      await t.shot('star-wrong');
      await t.click('a:has-text("Back to today")');
      await t.shot('today-g2');
      await t.click('a:has-text("Start exam-style")');
      for (let k = 0; k < 3; k++) {
        await t.shot('exam-' + (k + 1));
        await t.pick(other(N.grammarQ(x.g, 'x' + k).answer));
        await t.click(k < 2 ? 'button:has-text("Next")' : 'button:has-text("Finish")');
      }
      await t.shot('exam-result');
      await t.click('a:has-text("Next")');
      // the kanji and words of the day, and its quiz with every question answered wrong
      await t.click('a[aria-label^="Kanji and words:"]');
      if (v.kanji.length) {
        await t.shot('kanji');
        for (const n of sheets) {
          await t.click(`[role=list] button >> nth=${n}`);
          await t.shot('kanji-sheet-' + v.kanji[n].c);
          await t.until('Written three times.', 5000);
          await t.click('[role=dialog] button[aria-label="Close"]');
        }
        await t.click(v.words.length ? 'button:has-text("Next: words")' : longest ? 'button:has-text("Next: write the words")' : 'button:has-text("Next: the quiz")');
      }
      if (v.words.length) {
        t.expect(v.words.length === 20 && (await t.text()).includes('20 words'), 'the words step should show the lesson\'s 20 words');
        t.expect((await t.page.locator('[role=list] button[aria-pressed]').count()) === 20, 'the words step should have a play button for each of the 20 words');
        await t.shot('words');
        /* the list scrolls: its last word too */
        await t.page.locator('[role=list] button[aria-pressed] >> nth=-1').scrollIntoViewIfNeeded();
        await t.shot('words-end');
        await t.click(longest ? 'button:has-text("Next: write the words")' : 'button:has-text("Next: the quiz")');
      }
      if (longest) {
        /* the longest word, written one kanji at a time (by itself) */
        await t.until(longest + ' is written.', 5000);
        await t.shot('write-word');
        await t.click('button:has-text("Next: the quiz")');
      }
      t.expect(quiz.filter((q) => q.review).length === 2 && quiz.slice(-2).every((q) => q.review), 'the quiz should end with two review questions');
      for (let n = 0; n < quiz.length; n++) {
        if (quiz[n].review) t.expect((await t.text()).includes('復習 ' + quiz[n].level), `quiz ${n + 1} (${quiz[n].src}) should be marked 復習 ${quiz[n].level}`);
        await t.pick(other(quiz[n].answer, quiz[n].n));
        await t.click('button:has-text("Check")');
        await t.shot('quiz-' + (n + 1) + '-' + quiz[n].src);
        await t.click(n === quiz.length - 1 ? 'button:has-text("See your score")' : 'button:has-text("Next question")');
      }
      await t.shot('quiz-score');
      t.expect((await t.text()).includes('and 2 review questions from N2 to N4'), 'the score should count the two review questions');
      await t.click('a:has-text("Done")');
      // reading and listening, answered wrong
      await t.click('a[aria-label^="Reading:"]');
      await t.shot('reading');
      await t.pick(other(l.reading.answer));
      await t.click('button:has-text("Check")');
      await t.shot('reading-wrong');
      await t.click('a:has-text("Next")');
      await t.click('a[aria-label^="Listening:"]');
      await t.shot('listening');
      await t.click('button[aria-label="Play audio"]');
      await t.page.clock.fastForward(90000);
      await t.page.waitForFunction(() => [...document.querySelectorAll('button[aria-label^="Reply"]')].filter((b) => b.getAttribute('aria-disabled') !== 'true').length === 3, null, { timeout: 15000 });
      await t.pick(other(l.listening.answer, 3));
      await t.shot('listening-wrong');
      await t.click('a:has-text("Next")');
      await t.shot('today-done');
      t.expect((await t.text()).includes(v.dow + '日目 完了'), 'the day should be stamped at the end');
    },
  });
});

/* ---------- every lesson's longer reading and listening (BANKS.md), on its own day: each answered wrong ---------- */
const RK = { mid: 'mid passage', info: 'information', pair: 'two texts' };
const LE = { task: 'task', point: 'key point', gist: 'main idea' };
DEMO.days.forEach((x, i) => {
  if (x.t !== 0 || x.g < 0) return;
  const l = N.lessons[x.g];
  const ri = N.readings.findIndex((e) => e.src === 'r.' + l.id + '.2');
  const li = N.listenings.findIndex((e) => e.src === 'l.' + l.id + '.2');
  if (ri < 0 || li < 0) return;
  const plan = fresh(i);
  plan.days[i].r = ri;
  plan.days[i].l = li;
  const re = N.readings[ri], le = N.listenings[li];
  const r = re.item, it = le.item;
  /* the stand-in time of the audio's parts with a breath between them (the sweep runs without the sound scripts) */
  const audioMs = it.audio.reduce((a, p) => a + 600 + 150 * p.lines.reduce((n, ln) => n + N.plain(ln[1]).length, 0), 0) + 400 * (it.audio.length - 1);
  jobs.push({
    name: 'bank-' + l.id,
    url: 'TShell.dc.html?screen=Today&ykdate=' + TODAY + '&plan=' + enc(plan),
    clock: true,
    run: async (t) => {
      t.expect((await t.page.locator(`a[aria-label^="Reading: ${RK[re.kind]}, "]`).count()) === 1, `Today's reading card should name its kind, ${RK[re.kind]}`);
      t.expect((await t.page.locator(`a[aria-label="Listening: ${LE[le.kind]}"]`).count()) === 1, `Today's listening card should name its kind, ${LE[le.kind]}`);
      await t.shot('today');
      await t.click('a[aria-label^="Reading:"]');
      t.expect((await t.text()).includes(r.type), 'the reading should name its paper, ' + r.type);
      await t.shot('reading-' + re.kind);
      /* the passage scrolls inside its box: its end too */
      await t.page.evaluate(() => { const b = document.querySelector('[data-yk-passage]'); if (b) b.scrollTop = b.scrollHeight; });
      await t.shot('reading-end');
      await t.pick(other(r.answer));
      await t.click('button:has-text("Check")');
      t.expect((await t.text()).includes('your pick') && (await t.text()).includes('STRATEGY'), 'the reading should explain each option and give the strategy');
      await t.shot('reading-wrong');
      await t.click('a:has-text("Next")');
      await t.click('a[aria-label^="Listening:"]');
      t.expect((await t.text()).includes(it.type), 'the listening should name its paper, ' + it.type);
      t.expect((await t.page.locator('button[aria-label^="Option "]').count()) === 4, 'the listening should have four options');
      await t.shot('listening-' + le.kind);
      await t.click('button[aria-label^="Play the audio"]');
      await t.page.clock.fastForward(Math.round(audioMs / 2));
      await t.shot('listening-playing');
      /* a jump of the clock fires a timer once: the parts that follow are reached a few seconds at a time */
      const open4 = () => t.page.evaluate(() => [...document.querySelectorAll('button[aria-label^="Option "]')].filter((b) => b.getAttribute('aria-disabled') !== 'true').length === 4);
      for (let k = 0; k < 120 && !(await open4()); k++) await t.page.clock.fastForward(1000);
      await t.page.waitForFunction(() => [...document.querySelectorAll('button[aria-label^="Option "]')].filter((b) => b.getAttribute('aria-disabled') !== 'true').length === 4, null, { timeout: 15000 });
      t.expect((await t.text()).includes('解答 '), 'the answer time should count down once the audio is over');
      await t.shot('listening-answer-time');
      await t.pick(other(it.answer));
      t.expect((await t.text()).includes('Script'), 'the script should open once answered');
      await t.shot('listening-wrong');
      await t.page.evaluate(() => { document.querySelectorAll('#yk-stage div').forEach((d) => { if (getComputedStyle(d).overflowY === 'auto') d.scrollTop = d.scrollHeight; }); });
      await t.shot('listening-wrong-end');
      await t.click('a:has-text("Next")');
      t.expect((await t.page.locator('a[aria-label^="Reading:"][aria-label$="Done"]').count()) === 1 && (await t.page.locator('a[aria-label^="Listening:"][aria-label$="Done"]').count()) === 1, 'Today should mark the reading and listening done');
      await t.shot('today-after');
    },
  });
});

/* ---------- every week test, and the first mixed reviews ---------- */
let reviews = 0;
DEMO.days.forEach((x, i) => {
  if (x.t === 0 || (x.t === 2 && reviews++ >= 3)) return;
  const plan = fresh(i);
  const qs = N.testFor(plan, i).map(tidy).filter(Boolean);
  jobs.push({
    name: 'week-' + i,
    url: 'TShell.dc.html?screen=WeekTest&ykdate=' + TODAY + '&plan=' + enc(plan),
    run: async (t) => {
      await t.shot('intro');
      /* the intro lists its sections: the 復習 one with its four or six questions */
      const rv = qs.filter((q) => q.review);
      const byLevel = ['N2', 'N3', 'N4'].map((L) => [L, rv.filter((q) => q.level === L).length]).filter((p) => p[1]).map((p) => p[1] + ' from ' + p[0]).join(', ');
      t.expect((await t.text()).replace(/\s+/g, '').includes(('復習' + byLevel + rv.length + '問').replace(/\s+/g, '')), 'the intro should list the 復習 section: ' + byLevel + ', ' + rv.length + '問');
      await t.click(x.t === 1 ? 'button:has-text("Start the test")' : 'button:has-text("Start the review")');
      t.expect(qs.filter((q) => q.review).length === (x.t === 1 && N.weekTest(plan, Math.floor(i / 7) + 1).length >= 6 ? 4 : 6) && qs[qs.length - 1].review, 'the test should end with its review of the earlier levels (4 in a week test, 6 in a mixed review)');
      for (let n = 0; n < qs.length; n++) {
        if (qs[n].review) t.expect((await t.text()).includes('復習 ' + qs[n].level), `question ${n + 1} (${qs[n].src}) should be marked 復習 ${qs[n].level}`);
        await t.shot('q' + (n + 1) + '-' + qs[n].src);
        await t.pick(other(qs[n].answer, qs[n].n), 120);
        await t.click(n === qs.length - 1 ? 'button:has-text("Finish")' : 'button:has-text("Next")', 200);
      }
      await t.shot('result');
      t.expect((await t.text()).includes(qs.length + ' mistakes went into your notebook'), 'every wrong answer should be listed');
    },
  });
});

/* ---------- the four mini mocks: each question answered wrong (one left blank), then every answer and script ---------- */
N.mocks.forEach((m) => {
  const items = m.sections.reduce((a, s) => a.concat(s.items), []);
  const first = m.sections[0].items.length;
  jobs.push({
    name: 'mock-' + m.id,
    url: 'TShell.dc.html?screen=Mock&plan=demo&day=17&ykdate=' + TODAY,
    run: async (t) => {
      if (m.id !== N.mocks[0].id) await t.click(`button[aria-label^="${m.title}"]`);
      await t.click('a:has-text("Start")');
      await t.shot('briefing');
      await t.click('button:has-text("Start section 1")');
      for (let n = 0; n < first; n++) {
        await t.shot('paper-' + (n + 1));
        if (n !== 1) await t.pick(other(items[n].answer, items[n].options.length), 150);
        if (n === 2) { await t.click('button:has-text("Flag")', 150); await t.shot('paper-3-flagged'); }
        if (n < first - 1) await t.click('button:has-text("Next")', 250);
      }
      await t.click('button:has-text("Answer sheet")');
      await t.shot('sheet');
      await t.click('button:has-text("Submit")');
      await t.shot('break');
      await t.click('button:has-text("Start section 2")');
      for (let n = first; n < items.length; n++) {
        await t.until(items[n].type, 60000);
        await t.page.waitForTimeout(300);
        await t.shot('listening-' + (n + 1));
        await t.page.waitForFunction(() => [...document.querySelectorAll('button[aria-pressed]')].some((b) => b.getAttribute('aria-disabled') !== 'true' && !b.disabled), null, { timeout: 60000 }).catch(() => {});
        await t.pick(other(items[n].answer, items[n].options.length), 150);
        if (n < items.length - 1) await t.page.waitForFunction((ty) => !document.body.textContent.includes(ty), items[n].type, { timeout: 60000 }).catch(() => {});
      }
      await t.until('Correct answers', 60000);
      await t.page.waitForTimeout(400);
      await t.shot('result');
      await t.click('button:has-text("Answers and reasons")');
      for (let k = 0; k < 4; k++) {
        if (k) await t.click(`[role=tab] >> nth=${k}`);
        await t.shot('answers-' + (k + 1));
      }
      /* each script opened in turn: an open one's button says Hide */
      for (let k = 0; k < 3 && (await t.page.locator('button:has-text("Show the script")').count()); k++) {
        await t.click('button:has-text("Show the script") >> nth=0');
        await t.shot('script-' + (k + 1));
      }
    },
  });
});

/* ---------- the goal: every session at every daily time, for a first goal and for a new plan ---------- */
[['goal-first', `TShell.dc.html?screen=Goal&ykdate=${TODAY}`], ['goal-replan', `TShell.dc.html?screen=Goal&plan=demo&day=17&ykdate=${TODAY}`]].forEach(([name, url]) => {
  jobs.push({
    name,
    url,
    run: async (t) => {
      for (let k = 0; k < 3; k++) {
        await t.click('button[aria-haspopup="dialog"]', 400);
        if (k === 0) await t.shot('sessions');
        await t.click(`[role=dialog] button[aria-pressed] >> nth=${k}`, 200);
        await t.click('[role=dialog] button:has-text("Confirm")', 400);
        for (const pace of ['30分', '45分', '60分']) {
          await t.click(`button:has-text("${pace}")`, 250);
          await t.shot(`session-${k + 1}-${pace.replace('分', 'min')}`);
        }
      }
    },
  });
});

/* ---------- every day of the sample plan on Today, and every week of the path ---------- */
DEMO.days.forEach((x, i) => {
  jobs.push({ name: 'today-' + i, url: `TShell.dc.html?screen=Today&plan=demo&day=${i}&ykdate=${TODAY}`, run: async (t) => { await t.shot('day'); } });
});
/* the sample plan keeps each lesson's short items; a new plan lays out the banks' longer ones too: its first two weeks
   at each daily time, to the July session */
const JULY = N.sessions(TODAY)[1].date;
[30, 45, 60].forEach((pace) => {
  const p = N.make({ start: TODAY, exam: JULY, pace });
  p.days.slice(0, 14).forEach((x, i) => {
    jobs.push({ name: 'today-p' + pace + '-' + i, url: `TShell.dc.html?screen=Today&ykdate=${TODAY}&plan=` + enc({ ...p, open: i }), run: async (t) => { await t.shot('day'); } });
  });
});
jobs.push({
  name: 'main',
  url: `TShell.dc.html?screen=Main&plan=demo&day=17&ykdate=${TODAY}`,
  run: async (t) => {
    const weeks = Math.ceil(DEMO.days.length / 7);
    for (let k = 0; k < 2; k++) await t.click('button[aria-label="Previous week"]', 250);
    for (let wk = 1; wk <= weeks; wk++) {
      await t.shot('week-' + wk);
      if (await t.page.locator('button[aria-label$="locked. Open early"]').count()) {
        await t.click('button[aria-label$="locked. Open early"] >> nth=-1');
        await t.shot('week-' + wk + '-open-early');
        await t.click('[role=dialog] button:has-text("Cancel")');
      }
      if (wk < weeks) await t.click('button[aria-label="Next week"]', 250);
    }
  },
});

(async () => {
  const fontsCss = fs.readFileSync(path.join(site, 'fonts.css'), 'utf8');
  const browser = await chromium.launch();
  let bad = 0;
  let pads = 0;
  let shots = 0;
  const todo = jobs.filter((j) => !ONLY || ONLY.test(j.name));
  const runJob = async (job) => {
    /* write: the writing pads write themselves (window.__ykWriteAuto), as a sweep cannot wait for a finger */
    const prep = job.clock || job.write ? async (page) => {
      if (job.write) await page.addInitScript(() => { window.__ykWriteAuto = true; window.__ykWriteFast = true; });
      if (job.clock) await page.clock.install({ time: new Date(TODAY + 'T10:00:00') });
    } : undefined;
    const { page, logs } = await openBoard(browser, job.url, fontsCss, prep);
    const lines = [];
    let problems = 0;
    const keep = KEEP.test(job.name);
    const t = {
      page,
      text: async () => ((await page.locator('#yk-stage').textContent()) || '').replace(/\s+/g, ' '),
      click: async (sel, wait = 300) => { await page.locator(sel).first().click({ timeout: 5000 }); await page.waitForTimeout(wait); },
      pick: async (n, wait = 200) => { await page.locator(`button[aria-pressed] >> nth=${n - 1}`).first().click({ timeout: 5000 }); await page.waitForTimeout(wait); },
      until: (text, ms) => page.waitForFunction((x) => document.body.textContent.includes(x), text, { timeout: ms }),
      tapText: async (text, sel) => {
        const found = await page.evaluate(([text, sel]) => {
          document.querySelectorAll('[data-yk-tap]').forEach((e) => e.removeAttribute('data-yk-tap'));
          const words = (el) => { const c = el.cloneNode(true); c.querySelectorAll('rt').forEach((r) => r.remove()); return c.textContent.replace(/\s+/g, ''); };
          const b = [...document.querySelectorAll(sel)].find((el) => words(el) === text.replace(/\s+/g, ''));
          if (b) b.setAttribute('data-yk-tap', '1');
          return !!b;
        }, [text, sel]);
        if (!found) throw new Error('no tile ' + text);
        await page.locator('[data-yk-tap="1"]').click({ timeout: 4000 });
        await page.waitForTimeout(200);
      },
      expect: (cond, msg) => { if (!cond) { problems++; lines.push('   FAIL ' + msg); } },
      shot: async (state) => {
        shots++;
        /* a state is looked at once it has settled: a sheet that slides up, a stamp pressed in */
        await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect.getTiming().iterations === Infinity), null, { timeout: 3000 }).catch(() => {});
        const info = await inspect(page);
        /* text its own box cuts off: a box that hides what overflows it, holding more than it shows. A box that cuts on
           purpose (a one-line clamp, an ellipsis) or that only frames a bar or a picture is left out */
        const cut = await page.evaluate(() => {
          const res = [];
          for (const el of document.querySelectorAll('#yk-stage *')) {
            const cs = getComputedStyle(el);
            if (cs.overflowX !== 'hidden' && cs.overflowY !== 'hidden') continue;
            if (cs.webkitLineClamp !== 'none' || cs.textOverflow === 'ellipsis' || !el.textContent.trim()) continue;
            const r = el.getBoundingClientRect();
            if (!r.width || !r.height || r.width >= 389 || el.closest('svg')) continue;
            /* a list that scrolls one way may hide the other way only */
            if ((cs.overflowY === 'hidden' && el.scrollHeight > el.clientHeight + 1) || (cs.overflowX === 'hidden' && el.scrollWidth > el.clientWidth + 1)) res.push(`CUT ${el.tagName.toLowerCase()} "${el.textContent.trim().replace(/\s+/g, ' ').slice(0, 30)}" ${el.scrollWidth}x${el.scrollHeight} in ${el.clientWidth}x${el.clientHeight}`);
          }
          return res;
        });
        const flag = info.errors.length || info.issues.length || info.unresolved || cut.length;
        if (flag) { problems++; lines.push(`   ${state}: PROBLEMS ` + JSON.stringify({ e: info.errors, i: info.issues, u: info.unresolved, c: cut })); }
        if (info.pad.length) { pads += info.pad.length; lines.push(`   ${state}: PAD WARNING ` + JSON.stringify(info.pad)); }
        if (keep || flag || info.pad.length) await page.screenshot({ path: path.join(out, 'sw-n1-' + job.name + '-' + state.replace(/[^a-z0-9.-]+/gi, '_') + '.png') });
      },
    };
    try {
      await job.run(t);
    } catch (e) {
      problems++;
      lines.push('   STEP FAILED: ' + String(e).split('\n')[0]);
      await page.screenshot({ path: path.join(out, 'sw-n1-' + job.name + '-failed.png') }).catch(() => {});
    }
    const noisy = logs.filter((l) => !/Download the React DevTools/.test(l));
    if (noisy.length) { problems++; lines.push('   FAIL console problems: ' + JSON.stringify(noisy.slice(0, 4))); }
    bad += problems;
    if (lines.length || keep) console.log(job.name + (problems ? ': ' + problems + ' problem(s)' : ': ok') + (lines.length ? '\n' + lines.join('\n') : ''));
    await page.close();
  };
  /* four at a time */
  const queue = todo.slice();
  await Promise.all([0, 1, 2, 3].map(async () => { while (queue.length) await runJob(queue.shift()); }));
  console.log(`${todo.length} jobs, ${shots} states`);
  if (pads) console.log(`PAD WARNINGS: ${pads} (content in the bottom 34 px)`);
  console.log(bad ? 'SWEEP: ' + bad + ' problem(s)' : 'SWEEP PASS');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
