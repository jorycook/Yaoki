// The kanji lesson's writing practice, end to end with a finger: N5 week 1, day 1. The scene; then every new kanji
// written three times (traced after its stroke order, over faint lines, from memory) and every word of two kanji or more
// written one kanji at a time, with Next shut until each is written; then the exam question, Today's card, and the
// lesson opened again with nothing left to write. Wrong strokes are tried on the way (the next stroke, a backwards one).
// usage: bash run.sh write-flow.js           (the design canvas's runtime)
//        bash run-app.sh write-flow.js       (the app build)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { openBoard, inspect, site } = require('./rt-check.js');
const { strokeOn, padState, writeOut } = require('./write-helpers.js');

const ROOT = path.join(__dirname, '..');
const KANJI = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3005]/;
const fail = [];
const ok = (cond, what) => { if (!cond) { fail.push(what); console.log('  FAIL ' + what); } };

/* what the lesson should ask for, worked out here from the content: each new kanji before the first word that has it,
   then the word when it has two kanji or more */
function expected(day) {
  const out = [];
  const seen = {};
  for (const w of day.scene.words) {
    const ks = [...w.word].filter((c) => KANJI.test(c));
    for (const c of ks) if (!seen[c]) { seen[c] = true; out.push({ kind: 'kanji', c }); }
    if (ks.length >= 2) out.push({ kind: 'word', w: w.word });
  }
  return out;
}

(async () => {
  const day = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/n5/u01.json'), 'utf8')).days['1'];
  const queue = expected(day);
  const K = queue.filter((x) => x.kind === 'kanji').length;
  const WD = queue.length - K;
  console.log(`N5 week 1 day 1: ${K} new kanji, ${WD} words to write`);
  const css = fs.readFileSync(path.join(site, 'fonts.css'), 'utf8');
  const b = await chromium.launch();
  const fast = async (p) => { await p.addInitScript(() => { window.__ykWriteFast = true; }); };
  const { page, logs } = await openBoard(b, 'TShell.dc.html?screen=Scene&level=N5&cur=n5u01d1', css, fast, { touch: true });
  const cdp = await page.context().newCDPSession(page);
  const text = async () => (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  const has = async (s) => (await text()).includes(s);
  const tap = async (sel, wait = 250) => { await page.locator(sel).first().click(); await page.waitForTimeout(wait); };

  // the scene: what is coming is said before it comes
  ok(await has('Next you write: ' + K + ' new kanji, three times each, and ' + WD + ' words, one kanji at a time.'), 'scene: the line about the writing to come');
  await tap('button:has-text("Next: write")', 400);
  ok(await has('書く'), 'writing step opens');

  for (let n = 0; n < queue.length; n++) {
    const it = queue[n];
    ok(await has((n + 1) + ' / ' + queue.length), `item ${n + 1}: its place (${n + 1} / ${queue.length})`);
    /* Next is shut until the item is written */
    const lockText = it.kind === 'kanji' ? 'Write it three times first' : 'Write the word first';
    ok(await has(lockText), `item ${n + 1}: Next is shut`);
    await page.locator('button:has-text("' + lockText + '")').click({ force: true });
    await page.waitForTimeout(150);
    ok(await has((n + 1) + ' / ' + queue.length), `item ${n + 1}: a shut Next does not move on`);
    if (it.kind === 'kanji') {
      const modes = [];
      for (let rep = 0; rep < 3; rep++) {
        const p = await padState(page);
        modes.push(p && p.mode);
        ok(p && p.c === it.c, `item ${n + 1}: the pad holds ${it.c} (has ${p && p.c})`);
        if (n === 0 && rep === 0) {
          /* wrong strokes on the way: the second stroke first, then the first one backwards */
          if (p.n > 1) {
            await strokeOn(page, cdp, '[data-yk-pad]', it.c, 0, 'next');
            await page.waitForTimeout(200);
            ok(/Not quite\. Try stroke 1 again\./.test(await text()), 'a stroke out of order is not taken');
          }
          await strokeOn(page, cdp, '[data-yk-pad]', it.c, 0, 'backwards');
          await page.waitForTimeout(200);
          ok(/goes the other way|Follow the yellow line/.test(await text()), 'a backwards stroke is named as such');
          ok((await padState(page)).at === 0, 'neither wrong stroke went in');
        }
        await writeOut(page, cdp);
      }
      ok(modes.join(',') === 'trace,faint,memory', `item ${n + 1}: traced, faint, from memory (was ${modes.join(',')})`);
      ok(await has('Written three times.'), `item ${n + 1}: written three times`);
    } else {
      const cells = [...it.w].filter((c) => KANJI.test(c));
      for (const c of cells) {
        const p = await padState(page);
        ok(p && p.c === c && p.mode === 'memory', `item ${n + 1} (${it.w}): ${c} from memory (pad has ${p && p.c}, ${p && p.mode})`);
        await writeOut(page, cdp);
      }
      ok(await has(it.w + ' is written.'), `item ${n + 1}: ${it.w} written`);
    }
    if (n === 0) {
      const info = await inspect(page);
      ok(!info.issues.length, 'writing step layout: ' + info.issues.join('; '));
      for (const s of info.pad) console.log('  PAD WARNING ' + s);
      await page.screenshot({ path: path.join(__dirname, 'out', 'write-flow-first.png') });
    }
    const next = queue[n + 1];
    const label = !next ? 'Next: the exam question' : next.kind === 'kanji' ? 'Next kanji: ' + next.c : 'Next: the word ' + next.w;
    ok(await has(label), `item ${n + 1}: Next names what comes (${label})`);
    await page.locator('button:has-text("' + label + '")').click();
    await page.waitForTimeout(350);
  }

  // the exam question, then Today
  ok(await has('本番'), 'the exam question comes after the writing');
  await tap(`button:has-text("${day.scene.check.answer} ${day.scene.check.options[day.scene.check.answer - 1]}")`, 300);
  ok(await has('せいかい'), 'the exam question answered');
  await tap('a:has-text("Next")', 700);
  const card = await page.locator('a[href="Scene.dc.html"]').first().innerText();
  ok(/書く Write/.test(card) && /本番 Exam-style/.test(card), "Today's kanji card names the writing step");
  ok(await page.locator('a[href="Scene.dc.html"] [aria-label="Lesson done"]').count() === 1, "Today's kanji card is stamped done");

  // opened again: nothing left to write, so the scene leads straight to the question (the writing step says so if opened)
  await tap('a[href="Scene.dc.html"]', 700);
  ok(await has('You have written every kanji and word here before.'), 'opened again, the scene says everything is written');
  await tap('button:has-text("Next: the exam question")', 400);
  ok(await has('本番') && await has('How the exam asks it'), 'opened again, Next goes straight to the question');
  await tap('button[aria-label="Writing"]', 400);
  ok(await has('ぜんぶ書きました'), 'opened again, the writing step says everything is written');

  for (const l of logs) console.log('  console: ' + l);
  ok(!logs.length, 'no console problems');
  await b.close();
  console.log(fail.length ? `WRITE FLOW FAIL (${fail.length})` : 'WRITE FLOW PASS');
  process.exit(fail.length ? 1 : 0);
})().catch((e) => { console.error(e); console.log('WRITE FLOW FAIL'); process.exit(1); });
