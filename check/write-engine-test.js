// The writing pad's stroke matching, run against every kanji of both apps without a browser.
// usage: node write-engine-test.js            (the main app's kanji, then the N1 app's)
// For each kanji it draws every stroke the way a careful finger would (the stroke itself, shaken a little and set off a
// little) and expects it to count; then the next stroke drawn in its place, the stroke drawn backwards and a scribble,
// and expects none of those to count; then the whole kanji written a little smaller and off-centre from memory, which
// should count.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
function load(strokesFile) {
  const ctx = { window: {}, Math, JSON, parseFloat, setTimeout, clearTimeout };
  ctx.window.window = ctx.window;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(strokesFile, 'utf8').replace(/window\./g, 'window.'), ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'yaoki/project/yk-write.js'), 'utf8'), ctx);
  return ctx.window;
}

/* a seeded random, so a failure can be run again */
let seed = 12345;
const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const shake = (pts, amount, off) => pts.map((p) => ({ x: p.x + off.x + (rand() - 0.5) * amount, y: p.y + off.y + (rand() - 0.5) * amount }));
/* a finger reports a point every few pixels, not every 1.2 units: thin the line out */
const thin = (pts, every) => pts.filter((_, i) => i % every === 0 || i === pts.length - 1);

function run(label, strokesFile) {
  const w = load(strokesFile);
  const W = w.ykWrite;
  const all = Object.keys(w.__ykStrokes);
  const tally = { dots: 0, dotTaps: 0, tapsElsewhere: [], kanji: all.length, strokes: 0, right: 0, missedRight: [], wrongNext: 0, acceptedNext: [], backwards: 0, acceptedBack: [], backFlagged: 0, scribbles: 0, acceptedScribble: [], memory: 0, memoryFailed: [] };
  for (const c of all) {
    const n = W.count(c);
    for (let i = 0; i < n; i++) {
      tally.strokes++;
      const model = W.points(c, i);
      const drawn = thin(shake(model, 1.6, { x: (rand() - 0.5) * 4, y: (rand() - 0.5) * 4 }), 2);
      const r = W.match(drawn, c, i, { leniency: 1 });
      if (r.ok) tally.right++; else tally.missedRight.push(c + (i + 1));
      /* the next stroke instead of this one: it should not count (unless the two are the same stroke in all but name) */
      if (i + 1 < n) {
        const other = thin(shake(W.points(c, i + 1), 1.2, { x: 0, y: 0 }), 2);
        const near = W.match(other, c, i, { leniency: 1 });
        tally.wrongNext++;
        if (near.ok) tally.acceptedNext.push(c + (i + 1) + '/' + (i + 2));
      }
      /* backwards: it should not count, and should be recognised as backwards */
      const back = thin(model.slice().reverse(), 2);
      const rb = W.match(back, c, i, { leniency: 1 });
      tally.backwards++;
      if (rb.ok) tally.acceptedBack.push(c + (i + 1)); else if (rb.backwards) tally.backFlagged++;
      /* a dot touched rather than drawn counts on the dot, and nowhere else */
      if (W.points(c, i).length && model.length && (() => { let n = 0; for (let k = 1; k < model.length; k++) n += Math.hypot(model[k].x - model[k - 1].x, model[k].y - model[k - 1].y); return n; })() < 16) {
        tally.dots++;
        const mid = model[Math.floor(model.length / 2)];
        if (W.tap({ x: mid.x + 1, y: mid.y - 1 }, c, i)) tally.dotTaps++;
        if (W.tap({ x: mid.x + 30, y: mid.y + 30 }, c, i)) tally.tapsElsewhere.push(c + (i + 1));
        if (i + 1 < n) { const o = W.points(c, i + 1); const om = o[Math.floor(o.length / 2)]; if (W.tap(om, c, i) && Math.hypot(om.x - mid.x, om.y - mid.y) > 8) tally.tapsElsewhere.push(c + (i + 1) + '/' + (i + 2)); }
      }
      /* a scribble across the box */
      const scribble = [];
      for (let k = 0; k < 24; k++) scribble.push({ x: 15 + rand() * 80, y: 15 + rand() * 80 });
      tally.scribbles++;
      if (W.match(scribble, c, i, { leniency: 1 }).ok) tally.acceptedScribble.push(c + (i + 1));
    }
    /* from memory: the whole kanji 90% the size and off-centre by up to 3 units, the first stroke placed freely (each
       stroke written lands on the model, so the strokes after it are written against what is on the pad) */
    const k = 0.9, dx = (rand() - 0.5) * 6, dy = (rand() - 0.5) * 6;
    let fine = true;
    for (let i = 0; i < n; i++) {
      const model = W.points(c, i).map((p) => ({ x: 54.5 + (p.x - 54.5) * k + dx, y: 54.5 + (p.y - 54.5) * k + dy }));
      const r = W.match(thin(shake(model, 1.4, { x: 0, y: 0 }), 2), c, i, { leniency: 1.15, free: i === 0 });
      if (!r.ok) { fine = false; tally.memoryFailed.push(c + (i + 1)); break; }
    }
    if (fine) tally.memory++;
  }
  const pc = (a, b) => (100 * a / Math.max(1, b)).toFixed(1) + '%';
  console.log(`${label}: ${tally.kanji} kanji, ${tally.strokes} strokes`);
  console.log(`  drawn right, counted: ${tally.right} (${pc(tally.right, tally.strokes)})${tally.missedRight.length ? '  not counted: ' + tally.missedRight.slice(0, 30).join(' ') : ''}`);
  console.log(`  next stroke drawn instead, counted: ${tally.acceptedNext.length} of ${tally.wrongNext} (${pc(tally.acceptedNext.length, tally.wrongNext)})${tally.acceptedNext.length ? '  ' + tally.acceptedNext.slice(0, 30).join(' ') : ''}`);
  console.log(`  backwards, counted: ${tally.acceptedBack.length} of ${tally.backwards}; recognised as backwards: ${tally.backFlagged} (${pc(tally.backFlagged, tally.backwards)})${tally.acceptedBack.length ? '  ' + tally.acceptedBack.slice(0, 30).join(' ') : ''}`);
  console.log(`  scribbles, counted: ${tally.acceptedScribble.length} of ${tally.scribbles}${tally.acceptedScribble.length ? '  ' + tally.acceptedScribble.slice(0, 20).join(' ') : ''}`);
  console.log(`  dots touched: ${tally.dotTaps} of ${tally.dots} counted; touched off the dot (or on the next stroke), counted: ${tally.tapsElsewhere.length}${tally.tapsElsewhere.length ? '  ' + tally.tapsElsewhere.slice(0, 20).join(' ') : ''}`);
  console.log(`  written smaller and off-centre from memory, every stroke counted: ${tally.memory} of ${tally.kanji} (${pc(tally.memory, tally.kanji)})${tally.memoryFailed.length ? '  first stroke not counted: ' + tally.memoryFailed.slice(0, 30).join(' ') : ''}`);
  return tally;
}

const a = run('main app', path.join(ROOT, 'yaoki/project/strokes.js'));
const b = run('N1 app', path.join(ROOT, 'yaoki-n1/project/strokes.js'));
/* what has to hold: every stroke drawn right counts, nothing backwards or scribbled does, and a stroke drawn in the
   place of another is caught almost always (a few kanji have two strokes that are the same in all but name) */
/* a few short strokes sit closer to a later stroke than a touch on them can tell apart: almost all is enough there */
const bad = [a, b].some((t) => t.missedRight.length > 0 || t.dotTaps < t.dots * 0.99 || t.tapsElsewhere.length > 0 || t.acceptedBack.length > 0 || t.acceptedScribble.length > 0 ||
  t.acceptedNext.length > t.wrongNext * 0.02 || t.memory < t.kanji * 0.97);
console.log(bad ? 'WRITE ENGINE FAIL' : 'WRITE ENGINE PASS');
process.exit(bad ? 1 : 0);
