// Finger writing for the checks: strokes drawn on a writing pad with touch input, as a phone sends it.
// strokeOn(page, cdp, pad, c, i, how): draws stroke i of kanji c on the pad (an element handle or selector of the pad's
// box), along the stroke itself or, with how = 'backwards' | 'next' | 'scribble', a wrong one.
async function padBox(page, pad) {
  const el = typeof pad === 'string' ? await page.$(pad) : pad;
  const svg = await el.$('svg');
  return (svg || el).boundingBox();
}
async function touchLine(cdp, pts) {
  const at = (p) => [{ x: Math.round(p.x), y: Math.round(p.y), radiusX: 4, radiusY: 4, force: 0.5, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(pts[0]) });
  for (let k = 1; k < pts.length; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(pts[k]) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
async function strokeOn(page, cdp, pad, c, i, how) {
  const box = await padBox(page, pad);
  let pts = await page.evaluate(([c, i, how]) => {
    const W = window.ykWrite;
    if (how === 'scribble') return [{ x: 20, y: 90 }, { x: 90, y: 20 }, { x: 25, y: 30 }, { x: 85, y: 85 }];
    const p = W.points(c, how === 'next' ? i + 1 : i);
    return how === 'backwards' ? p.reverse() : p;
  }, [c, i, how || '']);
  // a finger reports a point every few pixels
  pts = pts.filter((_, k) => k % 3 === 0 || k === pts.length - 1).map((p) => ({ x: box.x + p.x / 109 * box.width, y: box.y + p.y / 109 * box.height }));
  await touchLine(cdp, pts);
}
module.exports = { strokeOn, touchLine, padBox };
/* where the pad stands: { c, mode, at (strokes in), n, done } */
async function padState(page) {
  return page.evaluate(() => {
    const svg = document.querySelector('[data-yk-pad] svg');
    if (!svg) return null;
    return { c: svg.getAttribute('data-char'), mode: svg.getAttribute('data-mode'), at: +svg.getAttribute('data-at'), n: +svg.getAttribute('data-n'), done: svg.getAttribute('data-done') === '1' };
  });
}
/* the kanji on the pad written out from where it stands, stroke by stroke, then a wait until the pad has moved on
   (a new time, the next kanji of the word) or the panel is done */
async function writeOut(page, cdp, opts = {}) {
  const p = await padState(page);
  if (!p || p.done) return p;
  for (let i = p.at; i < p.n; i++) { await strokeOn(page, cdp, '[data-yk-pad]', p.c, i); await page.waitForTimeout(opts.gap || 40); }
  await page.waitForFunction(([c, mode]) => {
    const svg = document.querySelector('[data-yk-pad] svg');
    if (!svg) return true;
    return svg.getAttribute('data-char') !== c || svg.getAttribute('data-mode') !== mode || svg.getAttribute('data-at') === '0' || (svg.getAttribute('data-done') === '1' && !!document.querySelector('[data-yk-write] [aria-live]') && /Written three times|is written\./.test(document.querySelector('[data-yk-write] [aria-live]').textContent));
  }, [p.c, p.mode], { timeout: 8000 });
  await page.waitForTimeout(opts.settle || 100);
  return p;
}
/* the strokes written on the pad (in ink) and how much of each can be seen; and whether the panel shows the stroke order
   as playing (its button lit), with the line under the pad */
async function inkState(page) {
  return page.evaluate(() => {
    const svg = document.querySelector('[data-yk-pad] svg');
    const button = document.querySelector('[data-yk-write] button[aria-label="Play the stroke order"]');
    const line = document.querySelector('[data-yk-write] [aria-live]');
    if (!svg) return null;
    const seen = (el) => { let o = 1; for (let e = el; e && e !== svg.parentNode; e = e.parentNode) o *= +getComputedStyle(e).opacity; return Math.round(o * 100) / 100; };
    return { c: svg.getAttribute('data-char'), mode: svg.getAttribute('data-mode'), at: +svg.getAttribute('data-at'), n: +svg.getAttribute('data-n'), ink: [...svg.querySelectorAll('path[stroke="#1B2440"]')].map(seen), playing: !!button && button.getAttribute('aria-pressed') === 'true', line: line ? line.textContent.trim() : '' };
  });
}
/* the stroke order cut short, both ways a learner can: played again and started over part-way (もう一度), and played in
   the moment after a time is written, so that the next time starts while it plays. Either way the strokes written next
   must be seen, and the panel must not be left showing the stroke order as playing (its button lit, and dead).
   Run on a pad at its first time (traced, a character of two strokes or more) with no stroke in; it writes that time out
   and the first stroke of the second, at the app's own speed. Returns what went wrong, one line each. */
async function replayCut(page, cdp) {
  const fast = await page.evaluate(() => { const was = !!window.__ykWriteFast; window.__ykWriteFast = false; return was; });
  try { return await cutShort(page, cdp); } finally { await page.evaluate((f) => { window.__ykWriteFast = f; }, fast); }
}
async function cutShort(page, cdp) {
  const bad = [];
  const PLAY = '[data-yk-write] button[aria-label="Play the stroke order"]';
  /* the stroke order that opens a first time has played out */
  await page.waitForFunction(() => { const b = document.querySelector('[data-yk-write] button[aria-label="Play the stroke order"]'); return b && b.getAttribute('aria-pressed') === 'false'; }, null, { timeout: 8000 }).catch(() => {});
  const p = await inkState(page);
  if (!p || p.mode !== 'trace' || p.at !== 0 || p.n < 2) return ['the pad is not at a first time with no stroke in: ' + JSON.stringify(p)];
  // started over part-way through the stroke order
  await page.locator(PLAY).click();
  await page.waitForTimeout(150);
  if (!(await inkState(page)).playing) bad.push('the stroke order does not play');
  await page.locator('[data-yk-write] button[aria-label="Start this one again"]').click();
  await page.waitForTimeout(150);
  await strokeOn(page, cdp, '[data-yk-pad]', p.c, 0);
  await page.waitForTimeout(400);
  let s = await inkState(page);
  if (s.at !== 1 || s.ink.length !== 1 || s.ink[0] !== 1) bad.push(`started over part-way through the stroke order, the stroke written next is not seen (${s.at} in, seen ${JSON.stringify(s.ink)})`);
  if (s.playing) bad.push('started over part-way through the stroke order, the panel still shows it playing');
  // the stroke order played in the moment after the first time is written: the second time starts while it plays
  for (let i = 1; i < p.n; i++) { await strokeOn(page, cdp, '[data-yk-pad]', p.c, i); if (i < p.n - 1) await page.waitForTimeout(250); }
  await page.locator(PLAY).click();
  await page.waitForTimeout(150);
  if (!(await inkState(page)).playing) bad.push('the stroke order does not play once the time is written');
  await page.waitForFunction(() => { const svg = document.querySelector('[data-yk-pad] svg'); return svg && svg.getAttribute('data-mode') === 'faint'; }, null, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(150);
  s = await inkState(page);
  if (s.mode !== 'faint') bad.push('the second time did not start (mode ' + s.mode + ')');
  if (s.playing || /^書き順/.test(s.line)) bad.push(`the second time started while the stroke order played, and the panel still shows it playing ("${s.line}")`);
  await strokeOn(page, cdp, '[data-yk-pad]', p.c, 0);
  await page.waitForTimeout(400);
  s = await inkState(page);
  if (s.at !== 1 || s.ink.length !== 1 || s.ink[0] !== 1) bad.push(`the second time started while the stroke order played, and the stroke written is not seen (${s.at} in, seen ${JSON.stringify(s.ink)})`);
  return bad;
}
module.exports.padState = padState;
module.exports.writeOut = writeOut;
module.exports.inkState = inkState;
module.exports.replayCut = replayCut;
