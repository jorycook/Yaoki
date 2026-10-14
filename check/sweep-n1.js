// The N1 screens with all of the real content (YK_LEVEL=N1 NOSOUND=1 bash run-app.sh sweep-n1.js), on 14 Oct 2026:
// every lesson through every state its screens have (the three teach pages, compare, each drill and the ★ question
// answered wrong, the exam-style questions and their result, the kanji, words and quiz with each question explained,
// reading and listening answered wrong), every week test and some mixed reviews question by question, the four mini
// mocks from their briefing to the last script, every day of the sample plan on Today and every week of the path.
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
  return answer > 0 && keep.length >= 2 ? { src: q.src, answer, n: keep.length } : null;
};
/* the sample plan with nothing done yet, so every step of a day can be taken; and the sample plan as it is */
const fresh = (open) => { const p = N.demo(); p.days.forEach((x) => { x.p = {}; }); p.open = open; return p; };
const DEMO = N.demo();
const ONLY = process.argv[2] ? new RegExp(process.argv[2]) : null;
/* the jobs whose every state is kept as a screenshot */
const KEEP = /^(lesson-u1l1|lesson-u3l4|lesson-u8l6|week-6|week-62|mock-\d|main|today-(0|4|6|17|20|56)$)/;

const jobs = [];

/* ---------- every lesson, on its own day of the sample plan ---------- */
DEMO.days.forEach((x, i) => {
  if (x.t !== 0 || x.g < 0) return;
  const l = N.lessons[x.g];
  const plan = fresh(i);
  const v = N.view(plan, i);
  const quiz = N.kanjiQuiz(plan, i, 8).concat(v.wi.map((wi) => N.wordQ(wi))).map(tidy).filter(Boolean);
  /* the kanji whose sheet holds the most: the longest meaning, and the most readings */
  const most = (f) => v.kanji.reduce((b, k, n) => (f(k) > f(v.kanji[b]) ? n : b), 0);
  const sheets = [...new Set([most((k) => (k.en || []).join(', ').length), most((k) => (k.on || []).join('、').length + (k.kun || []).join('、').length)])];
  jobs.push({
    name: 'lesson-' + l.id,
    url: 'TShell.dc.html?screen=Teach&ykdate=' + TODAY + '&plan=' + enc(plan),
    clock: true,
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
          await t.click('[role=dialog] button[aria-label="Close"]');
        }
        await t.click(v.words.length ? 'button:has-text("Next: words")' : 'button:has-text("Next: the quiz")');
      }
      if (v.words.length) {
        await t.shot('words');
        await t.click('button:has-text("Next: the quiz")');
      }
      for (let n = 0; n < quiz.length; n++) {
        await t.pick(other(quiz[n].answer, quiz[n].n));
        await t.click('button:has-text("Check")');
        await t.shot('quiz-' + (n + 1) + '-' + quiz[n].src);
        await t.click(n === quiz.length - 1 ? 'button:has-text("See your score")' : 'button:has-text("Next question")');
      }
      await t.shot('quiz-score');
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
      await t.click(x.t === 1 ? 'button:has-text("Start the test")' : 'button:has-text("Start the review")');
      for (let n = 0; n < qs.length; n++) {
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
      const scripts = await t.page.locator('button:has-text("Show the script")').count();
      for (let k = 0; k < scripts; k++) {
        await t.click(`button:has-text("Show the script") >> nth=${k}`);
        await t.shot('script-' + (k + 1));
      }
    },
  });
});

/* ---------- every day of the sample plan on Today, and every week of the path ---------- */
DEMO.days.forEach((x, i) => {
  jobs.push({ name: 'today-' + i, url: `TShell.dc.html?screen=Today&plan=demo&day=${i}&ykdate=${TODAY}`, run: async (t) => { await t.shot('day'); } });
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
    const prep = job.clock ? (page) => page.clock.install() : undefined;
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
            if (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1) res.push(`CUT ${el.tagName.toLowerCase()} "${el.textContent.trim().replace(/\s+/g, ' ').slice(0, 30)}" ${el.scrollWidth}x${el.scrollHeight} in ${el.clientWidth}x${el.clientHeight}`);
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
    if (noisy.length) { problems++; lines.push('   console: ' + JSON.stringify(noisy.slice(0, 4))); }
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
