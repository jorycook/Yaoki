// The writing pad's stroke matching, run against every kanji of both apps without a browser; then the pad's stroke
// order, ended every way it can end, on each app's copy of the pad (with a few lines of stand-in DOM).
// usage: node write-engine-test.js            (the main app's kanji, then the N1 app's)
// For each kanji it draws every stroke the way a careful finger would (the stroke itself, shaken a little and set off a
// little) and expects it to count; then the next stroke drawn in its place, the stroke drawn backwards and a scribble,
// and expects none of those to count; then the whole kanji written a little smaller and off-centre from memory, which
// should count.
// The stroke order, however it ends (played out, stopped, the learner writing, started over part-way, the next time or a
// new kanji while it plays, the pad going), must tell the screen it stopped (onPlay(false) once after each onPlay(true)),
// leave no numbered stroke behind, and leave the strokes written from then on in sight.
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

/* ---------- the pad's stroke order, ended every way it can end ----------
   The pad (yk-write.js) run on a stand-in for the few DOM calls it makes; a stroke is written by sending the pad's own
   pointer handlers the points of the stroke, as a finger would */
function standIn() {
  class El {
    constructor(tag) { this.tagName = tag; this.attrs = {}; this.childNodes = []; this.parentNode = null; this.style = {}; this.on = {}; this.textContent = ''; }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
    removeAttribute(k) { delete this.attrs[k]; }
    appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.childNodes.push(c); return c; }
    removeChild(c) { const i = this.childNodes.indexOf(c); if (i >= 0) this.childNodes.splice(i, 1); c.parentNode = null; return c; }
    get firstChild() { return this.childNodes[0] || null; }
    addEventListener(t, f) { (this.on[t] = this.on[t] || []).push(f); }
    removeEventListener(t, f) { this.on[t] = (this.on[t] || []).filter((x) => x !== f); }
    /* the pad's box is 109 units across, so a point in the box is the same point on the page */
    getBoundingClientRect() { return { left: 0, top: 0, width: 109, height: 109 }; }
    setPointerCapture() {}
  }
  return { El, createElementNS: (ns, tag) => new El(tag) };
}
function loadPad(dir) {
  const document = standIn();
  const ctx = { window: {}, document, Math, JSON, parseFloat, setTimeout, clearTimeout };
  ctx.window.window = ctx.window;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, dir, 'strokes.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, dir, 'yk-write.js'), 'utf8'), ctx);
  return { w: ctx.window, El: document.El };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function padRun(label, dir) {
  const { w, El } = loadPad(dir);
  const W = w.ykWrite;
  const [c1, c2] = Object.keys(w.__ykStrokes).filter((c) => W.count(c) >= 3);
  const fails = [];
  /* a pad that opens with its stroke order playing; calls: what onPlay was told, in order */
  const open = () => {
    const host = new El('div');
    const calls = [];
    const pad = W.pad(host, { char: c1, mode: 'trace', played: true, onPlay: (p) => calls.push(p) });
    return { host, pad, calls, svg: host.childNodes[0] };
  };
  const fire = (t, type, p) => (t.svg.on[type] || []).forEach((f) => f({ type, pointerId: 1, button: 0, clientX: p ? p.x : 0, clientY: p ? p.y : 0, preventDefault() {} }));
  const write = (t, c, i) => {
    const pts = W.points(c, i).filter((_, k, all) => k % 3 === 0 || k === all.length - 1);
    fire(t, 'pointerdown', pts[0]);
    pts.slice(1).forEach((p) => fire(t, 'pointermove', p));
    fire(t, 'pointerup', pts[pts.length - 1]);
  };
  /* the strokes in ink on the pad, and whether each can be seen (nothing over it at opacity 0) */
  const ink = (t) => {
    const out = [];
    const walk = (el, hidden) => {
      const h = hidden || el.getAttribute('opacity') === '0';
      if (el.tagName === 'path' && el.getAttribute('stroke') === '#1B2440') out.push(!h);
      el.childNodes.forEach((x) => walk(x, h));
    };
    walk(t.svg, false);
    return out;
  };
  const numbers = (t) => { let n = 0; const walk = (el) => { if (el.tagName === 'text' && /^\d+$/.test(el.textContent)) n++; el.childNodes.forEach(walk); }; walk(t.svg); return n; };
  /* each way it ends: [name, what ends it, the kanji on the pad after, whether that already wrote the first stroke] */
  const cases = [
    ['played to the end', async (t) => { w.__ykWriteFast = true; for (let k = 0; k < 300 && t.calls.length < 2; k++) await sleep(10); w.__ykWriteFast = false; }, c1],
    ['stopped part-way', async (t) => t.pad.stopPlay(), c1],
    ['the learner writes part-way', async (t) => write(t, c1, 0), c1, true],
    ['started over part-way (restart)', async (t) => t.pad.restart(), c1],
    ['the next time started part-way', async (t) => t.pad.set({ mode: 'faint', played: false, done: 0, restart: true }), c1],
    ['a new kanji part-way', async (t) => t.pad.set({ char: c2, mode: 'memory', played: false, done: 0 }), c2],
  ];
  for (const [name, end, c, wrote] of cases) {
    const t = open();
    await sleep(30);
    if (!t.pad.state().playing || t.calls.join() !== 'true') { fails.push(`${name}: the stroke order did not start (${t.calls.join()})`); continue; }
    await end(t);
    if (t.calls.join() !== 'true,false') fails.push(`${name}: the screen was told ${JSON.stringify(t.calls)}, not that it started and then stopped`);
    if (t.pad.state().playing) fails.push(`${name}: the pad is left playing`);
    if (numbers(t)) fails.push(`${name}: ${numbers(t)} numbered strokes left on the pad`);
    if (!wrote) write(t, c, 0);
    await sleep(400);
    const seen = ink(t);
    if (t.pad.state().i !== 1 || seen.length !== 1 || !seen[0]) fails.push(`${name}: the stroke written next is ${t.pad.state().i !== 1 ? 'not taken' : seen.length !== 1 ? 'drawn ' + seen.length + ' times' : 'not seen'}`);
    t.pad.destroy();
  }
  /* a new start that plays the stroke order again: the first one ends, the second plays out, and the writing is seen */
  {
    const t = open();
    await sleep(30);
    t.pad.set({ char: c2, mode: 'trace', played: true, done: 0 });
    w.__ykWriteFast = true;
    for (let k = 0; k < 300 && t.calls.length < 4; k++) await sleep(10);
    w.__ykWriteFast = false;
    if (t.calls.join() !== 'true,false,true,false') fails.push(`a new kanji with its own stroke order: the screen was told ${JSON.stringify(t.calls)}`);
    write(t, c2, 0);
    await sleep(400);
    const seen = ink(t);
    if (seen.length !== 1 || !seen[0]) fails.push('a new kanji with its own stroke order: the stroke written next is not seen');
    t.pad.destroy();
  }
  /* the pad going while it plays: the screen is told once, and nothing is said after */
  {
    const t = open();
    await sleep(30);
    t.pad.destroy();
    const told = t.calls.join();
    await sleep(600);
    if (told !== 'true,false' || t.calls.join() !== told) fails.push(`the pad going while it plays: the screen was told ${JSON.stringify(t.calls)}`);
    if (t.pad.state().playing) fails.push('the pad going while it plays: it is left playing');
  }
  console.log(`${label}: the stroke order ended ${cases.length + 2} ways (${c1}, ${c2})${fails.length ? '' : ', each time told and the writing seen'}`);
  for (const f of fails) console.log('  FAIL ' + f);
  return fails;
}

const a = run('main app', path.join(ROOT, 'yaoki/project/strokes.js'));
const b = run('N1 app', path.join(ROOT, 'yaoki-n1/project/strokes.js'));
(async () => {
  const pa = await padRun('main app pad', 'yaoki/project');
  const pb = await padRun('N1 app pad', 'yaoki-n1/project');
  /* what has to hold: every stroke drawn right counts, nothing backwards or scribbled does, and a stroke drawn in the
     place of another is caught almost always (a few kanji have two strokes that are the same in all but name) */
  /* a few short strokes sit closer to a later stroke than a touch on them can tell apart: almost all is enough there */
  const bad = [a, b].some((t) => t.missedRight.length > 0 || t.dotTaps < t.dots * 0.99 || t.tapsElsewhere.length > 0 || t.acceptedBack.length > 0 || t.acceptedScribble.length > 0 ||
    t.acceptedNext.length > t.wrongNext * 0.02 || t.memory < t.kanji * 0.97) || pa.length > 0 || pb.length > 0;
  console.log(bad ? 'WRITE ENGINE FAIL' : 'WRITE ENGINE PASS');
  process.exit(bad ? 1 : 0);
})();
