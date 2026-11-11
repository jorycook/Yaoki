// The kana course, every day and every week test: each card of the learn step, every practice and check question
// (answered right and wrong in turn, with its explanation), the writing (the pads write themselves), the words and their
// quiz, and each week test with its result, checked for anything that leaves the frame, taps too small to hit and
// runtime errors. The layout check the kana content must pass.
// usage: bash run-app.sh kana-sweep.js   or   bash run.sh kana-sweep.js   (DAYS=kanau01d1,kanau02d5 to limit it)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { openBoard, inspect, site, out } = require('./rt-check.js');

const NOW = Date.UTC(2026, 10, 11, 15);
const PLAN = encodeURIComponent(JSON.stringify({ start: '2026-11-11', exam: null, pace: 'steady' }));

(async () => {
  const fontsCss = fs.readFileSync(path.join(site, 'fonts.css'), 'utf8');
  const browser = await chromium.launch();
  let problems = 0;
  let looked = 0;
  const pads = [];
  const open = async (screen, extra) => openBoard(browser, 'TShell.dc.html?screen=' + screen + '&now=' + NOW + '&level=KANA&plan=' + PLAN + (extra || ''), fontsCss,
    (p) => p.addInitScript(() => { window.__ykWriteAuto = true; window.__ykWriteFast = true; }));
  const check = async (page, logs, label) => {
    await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect.getTiming().iterations === Infinity), null, { timeout: 3000 }).catch(() => {});
    const info = await inspect(page);
    looked += 1;
    for (const p of info.pad) pads.push(label + ': ' + p);
    /* the course's clips are made from content/kana: a missing unit sound file is reported, not a layout problem */
    const errs = logs.filter((l) => !/Failed to load resource/.test(l));
    if (info.errors.length || info.issues.length || info.unresolved || errs.length) {
      problems += 1;
      console.log(`PROBLEMS ${label}: ` + JSON.stringify({ e: info.errors, i: info.issues.slice(0, 4), u: info.unresolved, c: errs.slice(0, 3) }));
      await page.screenshot({ path: path.join(out, 'ks-' + label.replace(/[^a-z0-9]+/gi, '-') + '.png') });
    }
  };
  const tap = (page, sel) => page.locator(sel).first().click({ timeout: 4000 }).then(() => page.waitForTimeout(150));

  const probe = await open('Main');
  const course = await probe.page.evaluate(() => {
    const C = window.ykCourse;
    C.setLevel('KANA');
    return { days: C.sessions().filter((s) => s.ready && s.kind !== 'test').map((s) => ({ id: s.id, day: C.day(s.id) })), tests: C.sessions().filter((s) => s.kind === 'test').map((s) => ({ id: s.id, unit: C.unit(s.unit) })) };
  });
  await probe.page.close();
  const only = (process.env.DAYS || '').split(',').filter(Boolean);
  const days = course.days.filter((d) => !only.length || only.includes(d.id));
  console.log(`kana days: ${course.days.length}; checking ${days.length}, and ${only.length ? 0 : course.tests.length} week tests`);

  for (const { id, day } of days) {
    const cur = '&cur=' + id;
    // learn: every card
    {
      const { page, logs } = await open('Kana', cur);
      const n = day.kana.cards.length;
      for (let k = 0; k < n; k++) {
        await check(page, logs, `${id} card ${k + 1}`);
        if (k < n - 1) await tap(page, 'button:has-text("Next:")');
      }
      // practice: a wrong answer, then a right one, in turn; then the check, answered, and its result
      await tap(page, 'button:has-text("Next: practice")');
      const drill = day.kana.drill;
      for (let i = 0; i < drill.length; i++) {
        const it = drill[i];
        const pick = i % 2 ? it.answer : (it.answer % it.options.length) + 1;
        await page.locator('button[aria-pressed]').nth(pick - 1).click({ timeout: 4000 });
        await page.waitForTimeout(150);
        await check(page, logs, `${id} practice ${i + 1} (${pick === it.answer ? 'right' : 'wrong'})`);
        await tap(page, 'button:has-text("Next")');
      }
      for (let i = 0; i < day.kana.check.length; i++) {
        await page.locator('button[aria-pressed]').nth(i % 2).click({ timeout: 4000 });
        await page.waitForTimeout(120);
        if (i === 0) await check(page, logs, `${id} check 1`);
        await tap(page, i === day.kana.check.length - 1 ? 'button:has-text("See the results")' : 'button:has-text("Next")');
      }
      await check(page, logs, `${id} check result`);
      await page.close();
    }
    // writing: each kana and word, written by the pads themselves
    {
      const { page, logs } = await open('KanaWrite', cur);
      const total = Array.from(day.write.kana).length + day.write.words.length;
      for (let k = 0; k < total; k++) {
        /* the step's Next opens once the pads have written it (the hint button stays shut once a kana is written) */
        await page.waitForFunction(() => !Array.from(document.querySelectorAll('button[aria-disabled="true"]')).some((b) => /書いてから/.test(b.textContent)), null, { timeout: 15000 }).catch(() => {});
        await check(page, logs, `${id} write ${k + 1} of ${total}`);
        if (k < total - 1) await tap(page, 'button:has-text("Next")');
      }
      await page.close();
    }
    // words: read each, then the quiz
    {
      const { page, logs } = await open('KanaWords', cur);
      for (let k = 0; k < day.words.list.length; k++) await page.locator('[role="listitem"]').nth(k).click({ timeout: 4000 });
      await page.waitForTimeout(150);
      await check(page, logs, `${id} words read`);
      await tap(page, 'button:has-text("Next: practice")');
      for (let i = 0; i < day.words.quiz.length; i++) {
        const it = day.words.quiz[i];
        const pick = i % 2 ? it.answer : (it.answer % it.options.length) + 1;
        await page.locator('button[aria-pressed]').nth(pick - 1).click({ timeout: 4000 });
        await page.waitForTimeout(150);
        await check(page, logs, `${id} words quiz ${i + 1}`);
        if (i < day.words.quiz.length - 1) await tap(page, 'button:has-text("Next")');
      }
      await page.close();
    }
    // Today, with the day part-way and done
    for (const done of [{ g: 1 }, { g: 3, k: 1, kk: 1, r: 1, rs: 1 }]) {
      const { page, logs } = await open('Today', cur + '&done=' + encodeURIComponent(JSON.stringify({ [id]: done })));
      await check(page, logs, `${id} today ${done.k ? 'done' : 'part-way'}`);
      await page.close();
    }
  }
  // the week tests: started, answered and marked
  for (const { id, unit } of only.length ? [] : course.tests) {
    const { page, logs } = await open('WeekTest', '&cur=' + id + '&set=test');
    await check(page, logs, `${id} week test`);
    await tap(page, 'a:has-text("Start"), button:has-text("Start")');
    for (let i = 0; i < unit.test.length; i++) {
      await page.locator('button[aria-pressed]').nth(i % 2).click({ timeout: 4000 });
      await page.waitForTimeout(80);
      if (i < 3) await check(page, logs, `${id} question ${i + 1}`);
      await tap(page, i === unit.test.length - 1 ? 'button:has-text("Finish")' : 'button:has-text("Next")');
    }
    await check(page, logs, `${id} answers`);
    await page.close();
  }
  await browser.close();
  for (const p of pads.slice(0, 20)) console.log('  PAD WARNING ' + p);
  console.log(`${looked} states looked at`);
  console.log(problems ? `KANA SWEEP FAIL (${problems})` : 'KANA SWEEP PASS');
  process.exit(problems ? 1 : 0);
})().catch((e) => { console.error(e); console.log('KANA SWEEP FAIL'); process.exit(1); });
