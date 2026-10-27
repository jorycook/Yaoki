// The N1 app's kanji and words lesson with its writing practice, end to end with a finger, on a day of the sample plan:
// each kanji written three times in its sheet before the next one opens and before the words; the words of two kanji or
// more written one kanji at a time before the quiz; then the lesson opened again with everything written.
// usage: YK_LEVEL=N1 bash run.sh write-flow-n1.js        (the design canvas's runtime)
//        YK_LEVEL=N1 bash run-app.sh write-flow-n1.js    (the app build)
// DAY=n takes another day of the sample plan (17 by default, a day with kanji and words).
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { openBoard, inspect, site } = require('./rt-check.js');
const { padState, writeOut } = require('./write-helpers.js');

const DAY = +(process.env.DAY || 17);
const fail = [];
const ok = (cond, what) => { if (!cond) { fail.push(what); console.log('  FAIL ' + what); } };

(async () => {
  const css = fs.readFileSync(path.join(site, 'fonts.css'), 'utf8');
  const b = await chromium.launch();
  const fast = async (p) => { await p.addInitScript(() => { window.__ykWriteFast = true; }); };
  const { page, logs } = await openBoard(b, `TShell.dc.html?screen=Scene&plan=demo&day=${DAY}`, css, fast, { touch: true });
  const cdp = await page.context().newCDPSession(page);
  const text = async () => (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  const has = async (s) => (await text()).includes(s);
  const day = await page.evaluate((d) => {
    const N = window.ykN1;
    const plan = N.demo();
    const v = N.view(plan, d);
    const KANJI = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3005]/;
    const words = v.wi.map((wi) => N.plain(N.word(wi).w));
    return { kanji: v.kanji.filter(Boolean).map((k) => k.c), words, compounds: words.filter((w) => [...w].filter((c) => KANJI.test(c) && window.ykWrite.has(c)).length >= 2) };
  }, DAY);
  console.log(`N1 sample plan, day ${DAY}: ${day.kanji.length} kanji (${day.kanji.join('')}), ${day.words.length} words, ${day.compounds.length} to write`);

  // the kanji: Next is shut until every one is written
  ok(await has(`0 of ${day.kanji.length} written.`), 'kanji step: none written yet');
  ok(await has(`Write each kanji first · 0 of ${day.kanji.length}`), 'kanji step: Next is shut');
  await page.locator(`button[aria-label^="${day.kanji[0]}:"]`).click();
  await page.waitForTimeout(400);
  for (let n = 0; n < day.kanji.length; n++) {
    const c = day.kanji[n];
    ok(await has(`${n + 1} of ${day.kanji.length}`), `sheet ${n + 1}: its place`);
    ok(await has('Write it three times first'), `sheet ${n + 1}: Next kanji is shut`);
    const modes = [];
    for (let rep = 0; rep < 3; rep++) {
      const p = await padState(page);
      modes.push(p && p.mode);
      ok(p && p.c === c, `sheet ${n + 1}: the pad holds ${c} (has ${p && p.c})`);
      await writeOut(page, cdp);
    }
    ok(modes.join(',') === 'trace,faint,memory', `sheet ${n + 1}: traced, faint, from memory (was ${modes.join(',')})`);
    if (n === 0) {
      const info = await inspect(page);
      ok(!info.issues.length, 'sheet layout: ' + info.issues.join('; '));
      for (const s of info.pad) console.log('  PAD WARNING ' + s);
      await page.screenshot({ path: path.join(__dirname, 'out', 'write-flow-n1-sheet.png') });
    }
    const last = n === day.kanji.length - 1;
    await page.locator(`button:has-text("${last ? 'Close' : 'Next kanji'}")`).click();
    await page.waitForTimeout(350);
  }
  ok(await has(`${day.kanji.length} of ${day.kanji.length} written.`), 'kanji step: all written');
  // a kanji opened again is shown written out, and its sheet lets the learner on at once
  await page.locator(`button[aria-label^="${day.kanji[0]}:"]`).click();
  await page.waitForTimeout(400);
  ok(await has('Written already.') && (await padState(page)).mode === 'show', 'a written kanji opens written out');
  await page.locator('button[aria-label="Close"]').click();
  await page.waitForTimeout(300);

  // the words, then writing them
  const toWords = day.words.length ? 'Next: words' : day.compounds.length ? 'Next: write the words' : 'Next: the quiz';
  await page.locator(`button:has-text("${toWords}")`).click();
  await page.waitForTimeout(400);
  if (day.words.length && day.compounds.length) {
    await page.locator('button:has-text("Next: write the words")').click();
    await page.waitForTimeout(400);
  }
  for (let n = 0; n < day.compounds.length; n++) {
    const w = day.compounds[n];
    ok(await has(`${n + 1} / ${day.compounds.length}`), `word ${n + 1}: its place`);
    ok(await has('Write the word first'), `word ${n + 1}: Next is shut`);
    for (let guard = 0; guard < 8; guard++) {
      const p = await padState(page);
      if (!p || p.done) break;
      await writeOut(page, cdp);
    }
    ok(await has(w + ' is written.'), `word ${n + 1}: ${w} written`);
    if (n === 0) await page.screenshot({ path: path.join(__dirname, 'out', 'write-flow-n1-word.png') });
    const last = n === day.compounds.length - 1;
    await page.locator(`button:has-text("${last ? 'Next: the quiz' : 'Next word'}")`).click();
    await page.waitForTimeout(350);
  }
  ok(await has('確認'), 'the quiz comes after the writing');
  for (const l of logs) console.log('  console: ' + l);
  ok(!logs.length, 'no console problems');
  await b.close();
  console.log(fail.length ? `WRITE FLOW N1 FAIL (${fail.length})` : 'WRITE FLOW N1 PASS');
  process.exit(fail.length ? 1 : 0);
})().catch((e) => { console.error(e); console.log('WRITE FLOW N1 FAIL'); process.exit(1); });
