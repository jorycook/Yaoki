// Every written day, every answer: opens each lesson screen of each written day, gives every possible answer,
// and checks that each explanation fits on the screen with nothing cut off and no runtime errors.
// Then the notebook and its review with every item in it. This is the layout check new content must pass.
// usage: bash run-app.sh content-sweep.js   or   bash run.sh content-sweep.js   (DAYS=u03d4,u03d5 to limit it)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { openBoard, inspect, site, out } = require('./rt-check.js');

const NOW = Date.UTC(2026, 9, 12, 15);
/* LEVEL=N5 sweeps another level's days (N2 by default) */
const LEVEL = process.env.LEVEL || 'N2';
/* ONLY=scene sweeps the kanji lessons alone (the scene, the writing and the question), and leaves out the notebook */
const SCENE = process.env.ONLY === 'scene';

(async () => {
  const fontsCss = fs.readFileSync(path.join(site, 'fonts.css'), 'utf8');
  const browser = await chromium.launch();
  let problems = 0;
  let shots = 0;
  /* write: the writing pads write themselves at once (window.__ykWriteAuto), as a sweep cannot wait for a finger */
  const open = async (screen, extra, write) => {
    const q = 'TShell.dc.html?screen=' + screen + '&now=' + NOW + '&level=' + LEVEL + (extra || '');
    return openBoard(browser, q, fontsCss, write ? (p) => p.addInitScript(() => { window.__ykWriteAuto = true; window.__ykWriteFast = true; }) : undefined);
  };
  const check = async (page, logs, label) => {
    /* a state is looked at once it has settled: a sheet that slides up (240 ms) can still be on its way on a busy
       machine, and on its way it reaches below the frame */
    await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect.getTiming().iterations === Infinity), null, { timeout: 3000 }).catch(() => {});
    const info = await inspect(page);
    shots += 1;
    const bad = info.errors.length || info.issues.length || info.unresolved || logs.length;
    if (bad) {
      problems += 1;
      console.log(`PROBLEMS ${label}: ` + JSON.stringify({ e: info.errors, i: info.issues.slice(0, 4), u: info.unresolved, c: logs.slice(0, 3) }));
      await page.screenshot({ path: path.join(out, 'cs-' + label.replace(/[^a-z0-9]+/gi, '-') + '.png') });
    }
  };
  const tap = (page, sel) => page.locator(sel).first().click({ timeout: 4000 }).then(() => page.waitForTimeout(250));
  /* a tile is found by its name: the tile's text without readings */
  const plainOf = (t) => t.replace(/\[([^|\]]*)\|[^\]]*\]/g, '$1').replace(/[{}_^]/g, '');
  const tile = (page, t) => page.locator(`button[aria-label="${plainOf(t)}"]`).first().click({ timeout: 4000 }).then(() => page.waitForTimeout(120));

  // the course as the app sees it
  const probe = await open('Main');
  const course = await probe.page.evaluate((lv) => {
    const C = window.ykCourse;
    C.setLevel(lv);
    return { days: C.sessions().filter((s) => s.ready && s.kind !== 'test').map((s) => ({ id: s.id, day: C.day(s.id) })), tests: C.sessions().filter((s) => s.ready && s.kind === 'test').map((s) => ({ id: s.id, unit: s.unit, test: C.unit(s.unit).test })) };
  }, LEVEL);
  await probe.page.close();
  const only = (process.env.DAYS || '').split(',').filter(Boolean);
  /* SKIPDAYS=1 goes straight to the notebook and its review */
  const days = process.env.SKIPDAYS ? [] : course.days.filter((d) => !only.length || only.includes(d.id));
  console.log(`written days: ${course.days.map((d) => d.id).join(', ')}; checking ${days.length}`);

  for (const { id, day } of days) {
    const cur = '&cur=' + id;
    if (!SCENE) {
    // teach pages and comparison
    for (const tp of day.grammar.points.length ? [0, 1] : []) {
      const { page, logs } = await open('Teach', cur + '&tp=' + tp);
      await check(page, logs, `${id} teach ${tp + 1}`);
      await page.close();
    }
    const cmp = day.grammar.compare;
    for (let k = 0; k < cmp.check.options.length; k++) {
      const { page, logs } = await open('Compare', cur);
      await tap(page, `button[aria-pressed] >> nth=${k}`);
      await check(page, logs, `${id} compare option ${k + 1}`);
      await page.close();
    }
    // drill: every option of every item; the items before it answered right to get there
    const drill = day.grammar.drill;
    const answerRight = async (page, it) => {
      if (it.kind === 'star') { for (const t of it.tiles) await tile(page, t); }
      else await tap(page, `button[aria-pressed] >> nth=${it.answer - 1}`);
      await tap(page, 'button:has-text("Check")');
    };
    for (let i = 0; i < drill.length; i++) {
      const it = drill[i];
      const variants = it.kind === 'star' ? ['right', 'reversed', 'star-only'] : it.options.map((_, k) => k);
      for (const v of variants) {
        const { page, logs } = await open('Drill', cur);
        for (let j = 0; j < i; j++) { await answerRight(page, drill[j]); await tap(page, 'a:has-text("Next")'); }
        if (it.kind === 'star') {
          let order = it.tiles.slice();
          if (v === 'reversed') order = order.reverse();
          if (v === 'star-only') { const t = order.slice(); [t[0], t[1]] = [t[1], t[0]]; order = t; }
          for (const t of order) await tile(page, t);
          await check(page, logs, `${id} drill ${i + 1} placed`);
        } else await tap(page, `button[aria-pressed] >> nth=${v}`);
        await tap(page, 'button:has-text("Check")');
        await check(page, logs, `${id} drill ${i + 1} ${v}`);
        await page.close();
      }
    }
    // exam-style: all wrong, then all right
    for (const mode of ['wrong', 'right']) {
      const { page, logs } = await open('Exam', cur + '&set=day');
      for (let i = 0; i < day.grammar.exam.length; i++) {
        const it = day.grammar.exam[i];
        const n = it.kind === 'star' ? it.bank.indexOf(it.star) + 1 : it.answer;
        const pick = mode === 'right' ? n : n === 1 ? 2 : 1;
        await tap(page, `button[aria-pressed] >> nth=${pick - 1}`);
        if (mode === 'wrong') await check(page, logs, `${id} exam question ${i + 1}`);
        await tap(page, i === day.grammar.exam.length - 1 ? 'button:has-text("Finish")' : 'button:has-text("Next")');
      }
      await check(page, logs, `${id} exam result ${mode}`);
      await page.close();
    }
    }
    // scene: every word card; then the writing, every kanji and word of it (written at once); then every option of its check
    {
      const { page, logs } = await open('Scene', cur);
      for (const w of day.scene.words) { await tap(page, `button[aria-pressed]:has-text("${w.word}")`); await check(page, logs, `${id} scene word ${w.id}`); }
      await page.close();
    }
    {
      const { page, logs } = await open('Scene', cur + '&done=' + encodeURIComponent(JSON.stringify({ [id]: { ks: 1 } })), true);
      for (let n = 0; n < 60; n++) {
        /* each kanji or word writes itself; Next opens once it is written, and the last one leads to the question */
        await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => /^つぎへ/.test(b.textContent.trim())), null, { timeout: 15000 });
        await check(page, logs, `${id} writing ${n + 1}`);
        const last = await page.locator('button:has-text("Next: the exam question")').count();
        await tap(page, 'button:has-text("つぎへ")');
        if (last) break;
      }
      if (!(await page.locator('h1:has-text("本番")').count())) { problems += 1; console.log(`PROBLEMS ${id} writing: the exam question did not follow the writing`); }
      await page.close();
    }
    for (let k = 0; k < day.scene.check.options.length; k++) {
      const { page, logs } = await open('Scene', cur + '&done=' + encodeURIComponent(JSON.stringify({ [id]: { ks: 1, kw: 1 } })));
      await tap(page, `button:has-text("${k + 1} ${day.scene.check.options[k]}")`);
      await check(page, logs, `${id} scene check ${k + 1}`);
      await page.close();
    }
    // reading or listening: every option (listening waits for its clip, or its stand-in time without sound)
    if (!SCENE && day.skill.kind === 'listening') {
      for (let k = 0; k < day.skill.item.options.length; k++) {
        const { page, logs } = await open('Listening', cur);
        if (k === 0) await check(page, logs, `${id} listening before`);
        await tap(page, 'button[aria-label="Play audio"]');
        await page.waitForFunction(() => !document.querySelector('button[aria-pressed][disabled]'), null, { timeout: 120000 });
        await tap(page, `button[aria-pressed] >> nth=${k}`);
        /* the answer sheet slides up; look once it has settled */
        await page.waitForTimeout(350);
        await check(page, logs, `${id} listening option ${k + 1}`);
        await page.close();
      }
    }
    if (!SCENE && day.skill.kind === 'reading') {
      for (let k = 0; k < day.skill.item.options.length; k++) {
        const { page, logs } = await open('Reading', cur);
        await tap(page, `button[aria-pressed] >> nth=${k}`);
        await tap(page, 'button:has-text("Check")');
        await check(page, logs, `${id} reading option ${k + 1}`);
        await page.close();
      }
    }
  }

  // the notebook and the review with every item due, each with its longest wrong answer
  const items = await (async () => {
    const { page } = await open('Main');
    const list = await page.evaluate((lv) => {
      const C = window.ykCourse;
      C.setLevel(lv);
      const all = [];
      C.sessions().filter((s) => s.ready).forEach((s) => {
        const d = C.day(s.id);
        const g = d ? d.grammar : null;
        const its = s.kind === 'test' ? C.unit(s.unit).test : [...g.drill, ...g.exam, d.scene.check, d.skill.item];
        its.forEach((it) => all.push(it));
      });
      if (lv === 'N2') for (let n = 1; n <= 12; n++) all.push(C.item('mock' + n));
      return all.map((it) => {
        let wrong = '';
        if (it.kind === 'star') wrong = it.tiles.filter((_, k) => k !== it.star).sort((a, b) => b.length - a.length)[0];
        else wrong = it.options.map((o, k) => (it.short && it.short[k]) || C.plain(o)).filter((_, k) => k + 1 !== it.answer).sort((a, b) => b.length - a.length)[0];
        return { src: it.id, wrong };
      });
    }, LEVEL);
    await page.close();
    return list;
  })();
  const today = '2026-10-12';
  /* with DAYS set, only those days' items; and the notebook is opened in batches, because the whole list
     no longer fits in one address (the test server refuses request lines over 64 KB) */
  const mine = SCENE ? [] : only.length ? items.filter((x) => only.some((d) => x.src.startsWith(d + '.'))) : items;
  const BATCH = 100;
  for (let b = 0; b < mine.length; b += BATCH) {
    const part = mine.slice(b, b + BATCH);
    const m = encodeURIComponent(JSON.stringify(part.map((x, k) => ({ ...x, at: NOW - k * 1000, step: k % 3, due: today }))));
    {
      const { page, logs } = await open('Notebook', '&m=' + m);
      await check(page, logs, `notebook with items ${b + 1} to ${b + part.length}`);
      await page.close();
    }
    {
      const { page, logs } = await open('Review', '&m=' + m);
      for (let k = 0; k < part.length; k++) {
        await check(page, logs, `review ${part[k].src} asked`);
        await tap(page, 'button[aria-pressed] >> nth=0');
        await check(page, logs, `review ${part[k].src} answered`);
        await tap(page, k === part.length - 1 ? 'button:has-text("Finish")' : 'button:has-text("Next")');
      }
      await check(page, logs, `review summary ${b + 1} to ${b + part.length}`);
      await page.close();
    }
  }

  await browser.close();
  console.log(`${shots} screens checked`);
  console.log(problems ? `CONTENT SWEEP: ${problems} problem(s)` : 'CONTENT SWEEP PASS');
  process.exit(problems ? 1 : 0);
})().catch((e) => { console.error('CONTENT SWEEP CRASH', e); process.exit(1); });
