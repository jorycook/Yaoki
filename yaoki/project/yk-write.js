/* Yaoki writing practice: the learner writes a kanji with a finger, one stroke at a time and in order.
 *
 * The strokes come from strokes.js (window.__ykStrokes, made from KanjiVG by tools/make-strokes.py): for each kanji, its
 * strokes in order as SVG path data in a 109 x 109 box.
 *
 * window.ykWrite
 *   has(c)                  whether c has strokes
 *   paths(c)                its strokes in order ([] when it has none)
 *   count(c)                how many strokes it has (0 when it has none)
 *   pad(el, opts)           a writing pad drawn into the element el, returning its controller (see Pad below)
 *   match(points, c, i, o)  whether a drawn stroke (a list of {x, y} in the box) is stroke i of c: { ok, backwards }.
 *                           The pad uses it; it is exposed for the checks.
 *
 * A drawn stroke counts as stroke i when it runs close to it, starts and ends near its two ends, goes the same way, has
 * its shape and roughly its length, and does not fit a later stroke better. This follows the stroke matching of Hanzi
 * Writer (MIT licence, Copyright (c) 2014 David Chanin), whose limits were tuned for fingers on phone screens; here they
 * are in the 109-unit box and measured against the whole stroke rather than a few points on it.
 *
 * Two switches exist for the automatic checks only, never set by the app: window.__ykWriteFast makes every animation
 * twenty times quicker, and window.__ykWriteAuto has a pad write itself out at once, so a sweep can pass the writing. */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var BOX = 109;
  var MID = BOX / 2;

  /* the look: navy ink on white, the model in greys, a miss in red, a hint in yellow */
  var INK = '#1B2440';
  var MISS = '#C7361E';
  var HINT = '#F2B43A';
  var DOT = '#C7361E';
  var GRID = '#DDE1EC';
  var NUM = '#5A6382';
  var MODEL = { trace: '#D3D8E5', faint: '#EBEDF3' };
  var NEXT = '#9EA9C8';
  var WIDTH = 4.2;

  /* how far off a stroke may be at leniency 1 (box units, the shape and length as ratios) */
  var LIMIT = { avg: 16, avgFree: 30, ends: 22, endsFree: 30, shape: 0.4, len: 0.35, lenPad: 2.7 };
  /* a miss twice running shows where the stroke goes; four times, the pad writes it for the learner and moves on */
  var HINT_AFTER = 2;
  var HELP_AFTER = 4;

  /* ---------- stroke data ---------- */
  var cache = {};
  function raw(c) {
    var all = window.__ykStrokes;
    var s = all && typeof all[c] === 'string' ? all[c] : '';
    return s ? s.split('|') : [];
  }
  function info(c) {
    if (cache[c]) return cache[c];
    var paths = raw(c);
    var strokes = paths.map(function (d) {
      var pts = resample(flatten(d), 1.2);
      return { d: d, pts: pts, len: length(pts) };
    });
    cache[c] = { c: c, paths: paths, strokes: strokes };
    return cache[c];
  }

  /* SVG path data into points along it: lines as they are, curves cut into short straight pieces */
  var TOKEN = /([MmLlHhVvCcSsQqTtZz])|(-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/g;
  function flatten(d) {
    var toks = [];
    var m;
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(d))) toks.push(m[1] ? m[1] : parseFloat(m[2]));
    var pts = [];
    var x = 0, y = 0, sx = 0, sy = 0;
    var px = null, py = null; /* the last control point of a cubic, for S */
    var qx = null, qy = null; /* the last control point of a quadratic, for T */
    var cmd = '';
    var i = 0;
    function num() { var v = toks[i++]; return typeof v === 'number' ? v : 0; }
    function cubic(x1, y1, x2, y2, x3, y3) {
      var x0 = x, y0 = y;
      for (var k = 1; k <= 16; k++) {
        var t = k / 16, u = 1 - t;
        pts.push({ x: u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3, y: u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3 });
      }
      px = x2; py = y2; qx = null; x = x3; y = y3;
    }
    function quad(x1, y1, x2, y2) {
      var x0 = x, y0 = y;
      for (var k = 1; k <= 12; k++) {
        var t = k / 12, u = 1 - t;
        pts.push({ x: u * u * x0 + 2 * u * t * x1 + t * t * x2, y: u * u * y0 + 2 * u * t * y1 + t * t * y2 });
      }
      qx = x1; qy = y1; px = null; x = x2; y = y2;
    }
    function line(x1, y1) { x = x1; y = y1; px = null; qx = null; pts.push({ x: x, y: y }); }
    while (i < toks.length) {
      if (typeof toks[i] === 'string') cmd = toks[i++];
      else if (!cmd) { i++; continue; }
      var x1, y1, x2, y2;
      switch (cmd) {
        case 'M': x = num(); y = num(); sx = x; sy = y; pts.push({ x: x, y: y }); px = qx = null; cmd = 'L'; break;
        case 'm': x += num(); y += num(); sx = x; sy = y; pts.push({ x: x, y: y }); px = qx = null; cmd = 'l'; break;
        case 'L': line(num(), num()); break;
        case 'l': x1 = x + num(); y1 = y + num(); line(x1, y1); break;
        case 'H': line(num(), y); break;
        case 'h': line(x + num(), y); break;
        case 'V': line(x, num()); break;
        case 'v': line(x, y + num()); break;
        case 'C': x1 = num(); y1 = num(); x2 = num(); y2 = num(); cubic(x1, y1, x2, y2, num(), num()); break;
        case 'c': x1 = x + num(); y1 = y + num(); x2 = x + num(); y2 = y + num(); cubic(x1, y1, x2, y2, x + num(), y + num()); break;
        case 'S': case 's': {
          var rx = px === null ? x : 2 * x - px;
          var ry = px === null ? y : 2 * y - py;
          if (cmd === 'S') { x2 = num(); y2 = num(); cubic(rx, ry, x2, y2, num(), num()); } else { x2 = x + num(); y2 = y + num(); cubic(rx, ry, x2, y2, x + num(), y + num()); }
          break;
        }
        case 'Q': x1 = num(); y1 = num(); quad(x1, y1, num(), num()); break;
        case 'q': x1 = x + num(); y1 = y + num(); quad(x1, y1, x + num(), y + num()); break;
        case 'T': case 't': {
          var tx = qx === null ? x : 2 * x - qx;
          var ty = qx === null ? y : 2 * y - qy;
          if (cmd === 'T') quad(tx, ty, num(), num()); else quad(tx, ty, x + num(), y + num());
          break;
        }
        case 'Z': case 'z': line(sx, sy); break;
        default: i++;
      }
    }
    return pts;
  }

  /* ---------- geometry ---------- */
  function dist(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }
  function length(pts) { var n = 0; for (var i = 1; i < pts.length; i++) n += dist(pts[i - 1], pts[i]); return n; }
  /* the same line with a point every step units (and its two ends) */
  function resample(pts, step) {
    if (pts.length < 2) return pts.slice();
    var out = [pts[0]];
    var carry = 0;
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i];
      var seg = dist(a, b);
      if (!seg) continue;
      var t = step - carry;
      while (t <= seg) {
        out.push({ x: a.x + (b.x - a.x) * t / seg, y: a.y + (b.y - a.y) * t / seg });
        t += step;
      }
      carry = seg - (t - step);
    }
    var last = pts[pts.length - 1];
    if (dist(out[out.length - 1], last) > step * 0.25) out.push(last);
    else out[out.length - 1] = last;
    return out;
  }
  /* the same line as n points, evenly spaced */
  function evenly(pts, n) {
    var len = length(pts);
    if (!len || pts.length < 2) return pts.slice(0, 1);
    var out = resample(pts, len / (n - 1));
    while (out.length > n) out.splice(out.length - 2, 1);
    return out;
  }
  /* the squared distance from p to the segment a-b */
  function toSegment2(p, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y;
    var l2 = dx * dx + dy * dy;
    var t = l2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    var x = a.x + t * dx - p.x, y = a.y + t * dy - p.y;
    return x * x + y * y;
  }
  function toLine(p, line) {
    if (line.length === 1) return dist(p, line[0]);
    var best = Infinity;
    for (var i = 1; i < line.length; i++) { var d = toSegment2(p, line[i - 1], line[i]); if (d < best) best = d; }
    return Math.sqrt(best);
  }
  function avgDistance(pts, line) {
    var n = 0;
    for (var i = 0; i < pts.length; i++) n += toLine(pts[i], line);
    return n / pts.length;
  }
  /* the way each piece of a line points, as unit vectors */
  function units(line) {
    var out = [];
    for (var j = 1; j < line.length; j++) {
      var x = line[j].x - line[j - 1].x, y = line[j].y - line[j - 1].y;
      var m = Math.sqrt(x * x + y * y);
      if (m) out.push({ x: x / m, y: y / m });
    }
    return out;
  }
  /* each drawn piece against the closest-running piece of the stroke: on average they must point the same way */
  function sameWay(pts, stroke) {
    var lv = stroke.units || (stroke.units = units(stroke.pts));
    var uv = units(pts);
    if (!uv.length || !lv.length) return -1;
    var sum = 0;
    for (var i = 0; i < uv.length; i++) {
      var best = -1;
      for (var k = 0; k < lv.length; k++) {
        var cos = uv[i].x * lv[k].x + uv[i].y * lv[k].y;
        if (cos > best) best = cos;
      }
      sum += best;
    }
    return sum / uv.length;
  }
  /* the shape alone: both lines moved to the same centre and size (as in Hanzi Writer), then compared point by point,
     turned a little either way */
  function normal(pts) {
    var c = evenly(pts, 30);
    var mx = 0, my = 0;
    c.forEach(function (p) { mx += p.x; my += p.y; });
    mx /= c.length; my /= c.length;
    var t = c.map(function (p) { return { x: p.x - mx, y: p.y - my }; });
    var a = t[0], b = t[t.length - 1];
    var scale = Math.sqrt(((a.x * a.x + a.y * a.y) + (b.x * b.x + b.y * b.y)) / 2) || 1;
    var s = t.map(function (p) { return { x: p.x / scale, y: p.y / scale }; });
    /* a point every 0.05, or 60 points in all when that is more (a stroke whose ends sit near its middle grows large) */
    return resample(s, Math.max(0.05, length(s) / 60));
  }
  function frechet(p, q) {
    var long = p.length >= q.length ? p : q, short = p.length >= q.length ? q : p;
    var prev = [];
    for (var i = 0; i < long.length; i++) {
      var cur = [];
      for (var j = 0; j < short.length; j++) {
        var d = dist(long[i], short[j]);
        if (i === 0 && j === 0) cur.push(d);
        else if (j === 0) cur.push(Math.max(prev[0], d));
        else if (i === 0) cur.push(Math.max(cur[j - 1], d));
        else cur.push(Math.max(Math.min(prev[j], prev[j - 1], cur[j - 1]), d));
      }
      prev = cur;
    }
    return prev[short.length - 1];
  }
  var TURNS = [Math.PI / 16, Math.PI / 32, 0, -Math.PI / 32, -Math.PI / 16];
  function shapeFits(pts, stroke, leniency) {
    var a = normal(pts);
    /* the stroke's own shape, turned each way, is worked out once */
    if (!stroke.turned) {
      var b = normal(stroke.pts);
      stroke.turned = TURNS.map(function (th) {
        var cos = Math.cos(th), sin = Math.sin(th);
        return b.map(function (p) { return { x: cos * p.x - sin * p.y, y: sin * p.x + cos * p.y }; });
      });
    }
    var room = LIMIT.shape * leniency;
    for (var k = 0; k < stroke.turned.length; k++) if (frechet(a, stroke.turned[k]) <= room) return true;
    return false;
  }

  /* one drawn stroke against one stroke of the kanji */
  function fits(pts, stroke, o, backwards) {
    var lin = o.leniency || 1;
    var free = !!o.free;
    var avg = avgDistance(pts, stroke.pts);
    var result = { ok: false, avg: avg, backwards: false };
    if (avg > (free ? LIMIT.avgFree : LIMIT.avg) * lin) return result;
    var ends = (free ? LIMIT.endsFree : LIMIT.ends) * lin;
    var line = stroke.pts;
    var ok = dist(pts[0], line[0]) <= ends && dist(pts[pts.length - 1], line[line.length - 1]) <= ends &&
      sameWay(pts, stroke) > 0 &&
      lin * (length(pts) + LIMIT.lenPad) / (stroke.len + LIMIT.lenPad) >= LIMIT.len &&
      shapeFits(pts, stroke, lin);
    result.ok = ok;
    if (!ok && backwards !== false) {
      var back = fits(pts.slice().reverse(), stroke, o, false);
      result.backwards = back.ok;
    }
    return result;
  }

  /* points: the drawn stroke in box units; i: the stroke expected. o: leniency (1 by default), free (the first stroke
     written from memory: nothing on the pad yet to place it by, so its place may be further off) */
  function match(points, c, i, o) {
    o = o || {};
    var k = info(c);
    var stroke = k.strokes[i];
    if (!stroke || !points || points.length < 2) return { ok: false, backwards: false };
    var len = length(points);
    if (len < 1) return { ok: false, backwards: false };
    var pts = evenly(points, Math.max(8, Math.min(40, Math.round(len / 2))));
    var r = fits(pts, stroke, o);
    if (!r.ok) return { ok: false, backwards: r.backwards };
    /* a stroke that runs closer to a later stroke than to this one was most likely meant as that one: it then has to
       fit this one more closely to count (between 0.3 and 0.6 of the usual room, the closer the other, the less) */
    var closest = r.avg;
    for (var j = i + 1; j < k.strokes.length; j++) {
      var other = fits(pts, k.strokes[j], { leniency: o.leniency, free: o.free }, false);
      if (other.ok && other.avg < closest) closest = other.avg;
    }
    if (closest < r.avg) {
      var adjust = 0.6 * (closest + r.avg) / (2 * r.avg);
      var again = fits(pts, stroke, { leniency: (o.leniency || 1) * adjust, free: o.free }, false);
      return { ok: again.ok, backwards: false };
    }
    return { ok: true, backwards: false };
  }

  /* ---------- drawing ---------- */
  function make(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function inkPath(d, color, width, parent) {
    return make('path', { d: d, fill: 'none', stroke: color, 'stroke-width': width || WIDTH, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, parent);
  }
  function lineOf(pts) {
    if (!pts.length) return '';
    var s = 'M' + pts[0].x.toFixed(1) + ',' + pts[0].y.toFixed(1);
    if (pts.length === 1) return s + 'l0,0';
    for (var i = 1; i < pts.length; i++) s += 'L' + pts[i].x.toFixed(1) + ',' + pts[i].y.toFixed(1);
    return s;
  }
  function speed() { return window.__ykWriteFast ? 0.05 : 1; }
  /* a value moving from a to b over ms, eased; step(v) each frame, then done() */
  function tween(ms, step, done) {
    ms *= speed();
    var t0 = null;
    var stopped = false;
    var raf = window.requestAnimationFrame || function (f) { return setTimeout(function () { f(Date.now()); }, 16); };
    var caf = window.cancelAnimationFrame || clearTimeout;
    var id = null;
    function frame(now) {
      if (stopped) return;
      if (t0 === null) t0 = now;
      var t = ms <= 0 ? 1 : Math.min(1, (now - t0) / ms);
      step(t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
      if (t < 1) id = raf(frame);
      else if (done) done();
    }
    id = raf(frame);
    return function () { stopped = true; if (id !== null) caf(id); };
  }
  /* a path drawn from its start to its end. Stopped part-way, it is left drawn in full */
  function drawIn(el, len, ms, done) {
    var L = len * 1.08 + 2;
    var whole = function () { el.removeAttribute('stroke-dasharray'); el.removeAttribute('stroke-dashoffset'); };
    el.setAttribute('stroke-dasharray', L + ' ' + L);
    el.setAttribute('stroke-dashoffset', L);
    var stop = tween(ms, function (v) { el.setAttribute('stroke-dashoffset', (L * (1 - v)).toFixed(2)); }, function () {
      whole();
      if (done) done();
    });
    return function () { stop(); whole(); };
  }
  /* a path that fades away and is removed. Stopped part-way, it goes at once */
  function fadeOut(el, ms) {
    var gone = function () { if (el.parentNode) el.parentNode.removeChild(el); };
    var stop = tween(ms, function (v) { el.setAttribute('opacity', (1 - v).toFixed(3)); }, gone);
    return function () { stop(); gone(); };
  }

  /* ---------- the pad ----------
     opts: char        the kanji
           mode        'trace' (its strokes in grey under the finger, the next one darker, with a red dot where it starts),
                       'faint' (its strokes very light), 'memory' (nothing but the grid), or 'show' (the kanji written out,
                       no writing)
           played      play the stroke order before the first stroke can be written
           done        the strokes already written (a moment shown on the design canvas)
           leniency    how far off a stroke may be (1 by default; from memory, 1.15)
           onStroke(i, {misses, helped})   stroke i was written (or written for the learner: helped)
           onMiss(i, {misses, backwards})  a stroke that did not fit stroke i (backwards: it fits the other way round)
           onDone({misses, helped})        the last stroke is in
           onPlay(playing)                 the stroke order started or stopped playing
     The controller: set(opts) (a new kanji, mode or start), play(), hint(), restart(), destroy(), and state():
     { i, n, misses, helped, playing, done } */
  function Pad(host, opts) {
    var self = this;
    this.host = host;
    this.o = {};
    this.stops = [];
    this.timers = [];
    var svg = this.svg = make('svg', { viewBox: '0 0 ' + BOX + ' ' + BOX, width: '100%', height: '100%', role: 'img', focusable: 'false' });
    svg.style.cssText = 'display:block;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;cursor:crosshair';
    var grid = make('g', { stroke: GRID, 'stroke-width': 0.6, 'stroke-dasharray': '2.2 2.2' }, svg);
    make('line', { x1: MID, y1: 3, x2: MID, y2: BOX - 3 }, grid);
    make('line', { x1: 3, y1: MID, x2: BOX - 3, y2: MID }, grid);
    this.gModel = make('g', {}, svg);
    this.gHint = make('g', {}, svg);
    this.gDone = make('g', {}, svg);
    this.gMarks = make('g', {}, svg);
    this.gInk = make('g', {}, svg);
    this.fallback = make('text', { x: MID, y: MID + 2, 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'font-size': 78, fill: MODEL.trace, 'font-family': "'Klee One', 'Hiragino Mincho ProN', serif" }, svg);
    host.appendChild(svg);

    this.pointer = null;
    this.drawn = [];
    this.inkEl = null;
    var point = function (e) {
      var r = svg.getBoundingClientRect();
      return { x: (e.clientX - r.left) / (r.width || 1) * BOX, y: (e.clientY - r.top) / (r.height || 1) * BOX };
    };
    this.onDown = function (e) {
      if (self.pointer !== null || (e.button != null && e.button > 0)) return;
      /* writing while the stroke order plays: the learner has seen enough, so it stops */
      if (self.playing) self.stopPlay();
      if (!self.writing()) return;
      e.preventDefault();
      self.pointer = e.pointerId;
      try { svg.setPointerCapture(e.pointerId); } catch (x) { /* capture is a nicety */ }
      self.drawn = [point(e)];
      self.inkEl = inkPath(lineOf(self.drawn), INK, WIDTH, self.gInk);
    };
    this.onMove = function (e) {
      if (e.pointerId !== self.pointer) return;
      e.preventDefault();
      var list = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
      (list && list.length ? list : [e]).forEach(function (x) {
        var p = point(x);
        var last = self.drawn[self.drawn.length - 1];
        if (!last || dist(p, last) >= 0.4) self.drawn.push(p);
      });
      if (self.inkEl) self.inkEl.setAttribute('d', lineOf(self.drawn));
    };
    this.onUp = function (e) {
      if (e.pointerId !== self.pointer) return;
      self.pointer = null;
      var pts = self.drawn;
      var el = self.inkEl;
      self.drawn = [];
      self.inkEl = null;
      /* a stroke cut short by the phone (a call, a gesture) is not held against the learner */
      if (e.type === 'pointercancel') { if (el && el.parentNode) el.parentNode.removeChild(el); return; }
      self.judge(pts, el);
    };
    /* no scrolling, zooming or text selection while a finger is on the pad */
    this.noScroll = function (e) { if (e.cancelable) e.preventDefault(); };
    svg.addEventListener('pointerdown', this.onDown);
    svg.addEventListener('pointermove', this.onMove);
    svg.addEventListener('pointerup', this.onUp);
    svg.addEventListener('pointercancel', this.onUp);
    svg.addEventListener('touchstart', this.noScroll, { passive: false });
    svg.addEventListener('touchmove', this.noScroll, { passive: false });
    this.set(opts || {}, true);
  }

  Pad.prototype.writing = function () {
    return !this.playing && !this.finished && this.k && this.k.strokes.length > 0 && this.o.mode !== 'show';
  };
  Pad.prototype.state = function () {
    return { i: this.i, n: this.k ? this.k.strokes.length : 0, misses: this.misses, helped: this.helped, playing: !!this.playing, done: !!this.finished };
  };
  Pad.prototype.stopAll = function () {
    this.stops.forEach(function (f) { f(); });
    this.stops = [];
    this.timers.forEach(function (t) { clearTimeout(t); });
    this.timers = [];
  };
  Pad.prototype.later = function (ms, f) {
    var t = setTimeout(f, ms * speed());
    this.timers.push(t);
  };
  Pad.prototype.set = function (opts, first) {
    var o = this.o;
    var fresh = first || opts.char !== undefined && opts.char !== o.char || opts.mode !== undefined && opts.mode !== o.mode || opts.restart;
    for (var key in opts) if (key !== 'restart') o[key] = opts[key];
    if (!fresh) return this;
    this.stopAll();
    /* a new start: anything the last one still had to say (its onDone) is not said */
    this.token = (this.token || 0) + 1;
    this.k = info(o.char || '');
    this.i = 0;
    this.misses = 0;
    this.strokeMisses = 0;
    this.helped = 0;
    this.finished = false;
    this.playing = false;
    this.pointer = null;
    this.drawn = [];
    this.inkEl = null;
    clear(this.gInk);
    clear(this.gDone);
    clear(this.gHint);
    clear(this.gMarks);
    var n = this.k.strokes.length;
    this.fallback.textContent = n ? '' : (o.char || '');
    /* a moment shown on the canvas: some strokes already in */
    var pre = Math.max(0, Math.min(n, o.done || 0));
    for (var s = 0; s < pre; s++) inkPath(this.k.strokes[s].d, INK, WIDTH, this.gDone);
    this.i = pre;
    if (o.mode === 'show') {
      for (var t = pre; t < n; t++) inkPath(this.k.strokes[t].d, INK, WIDTH, this.gDone);
      this.i = n;
    }
    this.model();
    this.label();
    var self = this;
    if (!n && o.mode !== 'show') {
      /* nothing to write it with: the kanji is shown and counts as written */
      this.finished = true;
      this.tell({ misses: 0, helped: 0, none: true }, 0);
      return this;
    }
    if (window.__ykWriteAuto && o.mode !== 'show') {
      this.later(30, function () { self.autoWrite(); });
      return this;
    }
    if (o.played && o.mode !== 'show' && pre === 0) this.play();
    return this;
  };
  Pad.prototype.label = function () {
    var n = this.k.strokes.length;
    var o = this.o;
    var svg = this.svg;
    svg.setAttribute('aria-label', o.mode === 'show' ? (o.char || '') + ', written out' : this.finished ? (o.char || '') + ', written' : 'Writing pad for ' + (o.char || '') + ': stroke ' + Math.min(this.i + 1, n) + ' of ' + n);
    /* where the pad stands, for the checks: the kanji, its mode, the strokes in, the strokes in all, and whether it is done */
    svg.setAttribute('data-char', o.char || '');
    svg.setAttribute('data-mode', o.mode || '');
    svg.setAttribute('data-at', String(this.i));
    svg.setAttribute('data-n', String(n));
    svg.setAttribute('data-done', this.finished ? '1' : '0');
  };
  function clear(g) { while (g.firstChild) g.removeChild(g.firstChild); }
  /* the strokes under the finger, as the mode shows them */
  Pad.prototype.model = function () {
    clear(this.gModel);
    clear(this.gMarks);
    var o = this.o;
    if (this.finished || o.mode === 'show' || this.playing) return;
    var strokes = this.k.strokes;
    var i = this.i;
    if (o.mode === 'trace' || o.mode === 'faint') {
      var self = this;
      strokes.forEach(function (s, j) {
        if (j < i) return;
        inkPath(s.d, o.mode === 'trace' && j === i ? NEXT : MODEL[o.mode], WIDTH, self.gModel);
      });
      if (o.mode === 'trace' && strokes[i]) {
        var p = strokes[i].pts[0];
        make('circle', { cx: p.x, cy: p.y, r: 2.5, fill: DOT }, this.gMarks);
      }
    }
  };
  /* a drawn stroke, judged */
  Pad.prototype.judge = function (pts, el) {
    var self = this;
    var o = this.o;
    if (!this.writing() || !el) { if (el && el.parentNode) el.parentNode.removeChild(el); return; }
    /* a tap is not a stroke */
    if (pts.length < 2 || length(pts) < 2) { if (el.parentNode) el.parentNode.removeChild(el); return; }
    var i = this.i;
    var free = o.mode === 'memory' && i === 0;
    var r = match(pts, o.char, i, { leniency: o.leniency || (o.mode === 'memory' ? 1.15 : 1), free: free });
    if (r.ok) {
      this.stops.push(fadeOut(el, 260));
      this.accept(false);
      return;
    }
    this.misses++;
    this.strokeMisses++;
    el.setAttribute('stroke', MISS);
    this.stops.push(fadeOut(el, 480));
    var m = this.strokeMisses;
    if (o.onMiss) o.onMiss(i, { misses: m, backwards: !!r.backwards });
    if (m >= HELP_AFTER) { this.later(420, function () { if (self.i === i && !self.finished) self.accept(true); }); return; }
    if (m >= HINT_AFTER) this.hint();
  };
  /* stroke i goes in: drawn in ink from start to end, and the next one is shown */
  Pad.prototype.accept = function (helped) {
    var o = this.o;
    var i = this.i;
    var s = this.k.strokes[i];
    if (!s) return;
    clear(this.gHint);
    var el = inkPath(s.d, INK, WIDTH, this.gDone);
    this.stops.push(drawIn(el, s.len, helped ? 420 : 180));
    if (helped) this.helped++;
    this.i = i + 1;
    this.strokeMisses = 0;
    var last = this.i >= this.k.strokes.length;
    if (last) this.finished = true;
    this.model();
    this.label();
    if (o.onStroke) o.onStroke(i, { misses: this.misses, helped: helped });
    if (last) this.tell({ misses: this.misses, helped: this.helped }, helped ? 460 : 240);
  };
  /* the kanji is written: onDone a moment later, once the last stroke has gone in. Playing the stroke order in that
     moment does not stop it; only a new start does */
  Pad.prototype.tell = function (res, ms) {
    var self = this;
    var token = this.token;
    setTimeout(function () { if (self.token === token && self.o.onDone) self.o.onDone(res); }, ms * speed());
  };
  /* where the next stroke goes: it is drawn in yellow from its start, and stays faintly until it is written */
  Pad.prototype.hint = function () {
    if (!this.writing()) return;
    var s = this.k.strokes[this.i];
    if (!s) return;
    clear(this.gHint);
    var el = inkPath(s.d, HINT, WIDTH + 1.4, this.gHint);
    var p = s.pts[0];
    make('circle', { cx: p.x, cy: p.y, r: 2.8, fill: DOT }, this.gHint);
    this.stops.push(drawIn(el, s.len, 520 + s.len * 6));
  };
  /* the stroke order: every stroke drawn in turn with its number, then back to where the writing was */
  Pad.prototype.play = function () {
    var self = this;
    var o = this.o;
    var strokes = this.k.strokes;
    if (!strokes.length || this.playing) return;
    this.stopAll();
    this.playing = true;
    this.pointer = null;
    this.drawn = [];
    this.inkEl = null;
    clear(this.gInk);
    clear(this.gHint);
    this.gDone.setAttribute('opacity', '0');
    this.model();
    var layer = make('g', {}, this.gMarks);
    var gLines = make('g', {}, layer);
    var gNums = make('g', {}, layer);
    if (o.onPlay) o.onPlay(true);
    var n = 0;
    var next = function () {
      if (n >= strokes.length) { self.later(450, finish); return; }
      var s = strokes[n];
      var el = inkPath(s.d, INK, WIDTH, gLines);
      var p = s.pts[0];
      var q = s.pts[Math.min(3, s.pts.length - 1)];
      /* the number sits just behind the start, away from the way the stroke goes */
      var dx = p.x - q.x, dy = p.y - q.y, dl = Math.sqrt(dx * dx + dy * dy) || 1;
      var tx = Math.max(4, Math.min(BOX - 4, p.x + dx / dl * 5.5 - 1));
      var ty = Math.max(6, Math.min(BOX - 2, p.y + dy / dl * 5.5 + 2));
      var label = make('text', { x: tx.toFixed(1), y: ty.toFixed(1), 'font-size': 6.2, 'font-weight': 700, fill: NUM, 'text-anchor': 'middle', 'font-family': "'M PLUS Rounded 1c', 'Hiragino Maru Gothic ProN', sans-serif" }, gNums);
      label.textContent = String(n + 1);
      n++;
      self.stops.push(drawIn(el, s.len, 260 + s.len * 8, function () { self.later(110, next); }));
    };
    var finish = function () {
      self.playing = false;
      if (layer.parentNode) layer.parentNode.removeChild(layer);
      self.gDone.setAttribute('opacity', '1');
      self.model();
      if (o.onPlay) o.onPlay(false);
    };
    this.finishPlay = finish;
    next();
  };
  /* stop the stroke order part-way (a new kanji, or the learner starts writing) */
  Pad.prototype.stopPlay = function () {
    if (!this.playing) return;
    this.stopAll();
    if (this.finishPlay) this.finishPlay();
  };
  Pad.prototype.restart = function () { return this.set({ restart: true, done: 0, played: false }); };
  /* the checks' sweep only: every stroke goes in at once */
  Pad.prototype.autoWrite = function () {
    while (!this.finished && this.k.strokes[this.i]) this.accept(false);
  };
  Pad.prototype.destroy = function () {
    this.stopAll();
    this.token = (this.token || 0) + 1;
    var svg = this.svg;
    svg.removeEventListener('pointerdown', this.onDown);
    svg.removeEventListener('pointermove', this.onMove);
    svg.removeEventListener('pointerup', this.onUp);
    svg.removeEventListener('pointercancel', this.onUp);
    svg.removeEventListener('touchstart', this.noScroll);
    svg.removeEventListener('touchmove', this.noScroll);
    if (svg.parentNode) svg.parentNode.removeChild(svg);
    this.o = {};
  };

  /* ---------- small pictures ----------
     Drawn into an element the screen leaves empty (its template has no children there), so the screen's own drawing
     never meets them. The element remembers what it holds, and is drawn again only when that changes. */
  function picture(strokes, size, width) {
    var svg = make('svg', { viewBox: '0 0 ' + BOX + ' ' + BOX, width: size, height: size, 'aria-hidden': 'true', focusable: 'false' });
    svg.style.display = 'block';
    strokes.forEach(function (s) { inkPath(s.d, s.ink || INK, width, svg); });
    return svg;
  }
  /* the kanji c written out, size pixels across */
  function draw(el, c, size) {
    if (!el) return;
    var want = c + '|' + size;
    if (el.getAttribute('data-yk-drawn') === want) return;
    el.setAttribute('data-yk-drawn', want);
    clear(el);
    if (c) el.appendChild(picture(raw(c).map(function (d) { return { d: d }; }), size, 5.5));
  }
  /* the stroke order of c: a picture for each stroke, the strokes before it in ink and the new one in red */
  function strip(el, c, size) {
    if (!el) return;
    var want = c + '|' + size;
    if (el.getAttribute('data-yk-drawn') === want) return;
    el.setAttribute('data-yk-drawn', want);
    clear(el);
    var paths = raw(c);
    paths.forEach(function (_, f) {
      var box = document.createElement('div');
      box.style.cssText = 'width:' + (size + 4) + 'px;height:' + (size + 4) + 'px;box-sizing:border-box;border-radius:8px;border:1.5px solid ' + GRID + ';background:#FFFFFF;display:flex;align-items:center;justify-content:center;flex-shrink:0';
      box.appendChild(picture(paths.slice(0, f + 1).map(function (d, j) { return { d: d, ink: j === f ? MISS : INK }; }), size, 6));
      el.appendChild(box);
    });
  }

  window.ykWrite = {
    has: function (c) { return raw(c).length > 0; },
    paths: function (c) { return raw(c); },
    count: function (c) { return raw(c).length; },
    pad: function (el, opts) { return new Pad(el, opts); },
    draw: draw,
    strip: strip,
    match: match,
    /* the points of stroke i of c, every 1.2 box units (the checks draw along them) */
    points: function (c, i) { var s = info(c).strokes[i]; return s ? s.pts.map(function (p) { return { x: p.x, y: p.y }; }) : []; },
    BOX: BOX
  };
})();
