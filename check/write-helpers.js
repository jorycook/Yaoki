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
module.exports.padState = padState;
module.exports.writeOut = writeOut;
