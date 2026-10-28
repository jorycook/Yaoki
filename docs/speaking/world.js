/*
 * Yaoki Speaking's places (景色), drawn for a phone held upright: the picture behind the round, the things that fall
 * in Falling and the ledges of Climb.
 *
 * Four places, each in its own file (places/<id>.js), each with its falling things and its climb:
 *   山 Mountain (yama)           rocks come down the crevice; Climb goes up its rock ledges to the summit and its flag
 *   団地 Apartment block (danchi) boxes, rubbish bags and flowerpots dropped from the windows; Climb goes up the fire
 *                                ladder to the roof and its water tank
 *   神社 Shrine (jinja)          hail from a storm over the torii; Climb goes up the stone steps, through torii, to the
 *                                shrine and its bell
 *   森 Forest (mori)             acorns, pears and persimmons from a great tree; Climb goes up its branches to a nest
 *
 * This file holds what they share: the helpers they draw with (kit), the list of places, which stage is played where,
 * and the drawing done safely. A place file registers itself with define(id, place). The falling things and the ledges,
 * which the game puts its words on, stay pale where the word is, so the words read the same in both themes. The sky
 * follows the round (towards evening, or towards the summit), the season shows in the trees, and dark mode is night.
 * With reduced motion everything is still.
 *
 * window.SpeakingWorld = {
 *   PLACES: [{ id, ja, en, song }],
 *   forStage(key)                     the place for a stage key ('kana:words', 'course:N5u3' …), the same every time
 *   layout(place, n, W)               Climb: where ledge n is, { x, side } (side -1 left wall, 1 right, 0 middle)
 *   back(ctx, o)                      the whole background: o = { place, style 'fall'|'climb', W, H, y0 (Climb: the
 *                                     world's y at the top of the view; the ground is y 0 and up is negative), ground
 *                                     (Falling: the ground's y), top (Climb: the summit's y), t, progress, still, dark,
 *                                     season, pal }
 *   thing(ctx, o)                     a falling thing round its word's box: o = { place, n, x, y, w, h, target, flash,
 *                                     dark, pal, t }
 *   colors(place, n)                  the fill and line of thing n, for its pieces
 *   ledge(ctx, o)                     a ledge whose top is at (x, y): o = { place, n, x, y, w, side, dark, pal, W }
 *   summit(ctx, o)                    the top of the climb at y: o = { place, W, y, dark, pal, t, reached }
 *   define(id, place)                 a place file registers its drawing (see places/yama.js)
 *   kit                               the helpers the places draw with
 * }
 * All in the game's logical units, on a context already scaled. No images and no libraries. back, thing, ledge and
 * summit put the context back as it was and pass an error on; game.js catches it, and a place that cannot be drawn
 * leaves the plain paper.
 */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const INK = '#1B2440';

  // ---------- numbers that are the same every time ----------

  function hash(a, b) {
    let h = (Math.imul(a | 0, 0x9E3779B1) ^ Math.imul((b | 0) + 0x7F4A7C15, 0x85EBCA77)) | 0;
    h ^= h >>> 16;
    h = Math.imul(h, 0x85EBCA6B);
    h ^= h >>> 13;
    h = Math.imul(h, 0xC2B2AE35);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function rng(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function noise(seed, x) {
    const i = Math.floor(x);
    const f = x - i;
    const a = hash(seed, i);
    return a + (hash(seed, i + 1) - a) * f * f * (3 - 2 * f);
  }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = (a, b, x) => {
    const k = clamp((x - a) / (b - a), 0, 1);
    return k * k * (3 - 2 * k);
  };
  const wrap = (v, m) => ((v % m) + m) % m;

  // colours: #rrggbb (or what mix() makes, rgb(r,g,b)) mixed, and with an alpha
  const RGB = new Map();
  function rgb(c) {
    let v = RGB.get(c);
    if (!v) {
      const m = /^rgb\((\d+),(\d+),(\d+)\)$/.exec(c);
      if (m) v = [+m[1], +m[2], +m[3]];
      else {
        const n = parseInt(c.slice(1), 16);
        v = [n >> 16, (n >> 8) & 255, n & 255];
      }
      if (RGB.size > 400) RGB.clear();
      RGB.set(c, v);
    }
    return v;
  }
  function mix(a, b, k) {
    const x = rgb(a);
    const y = rgb(b);
    k = clamp(k, 0, 1);
    return 'rgb(' + Math.round(x[0] + (y[0] - x[0]) * k) + ',' + Math.round(x[1] + (y[1] - x[1]) * k) + ',' + Math.round(x[2] + (y[2] - x[2]) * k) + ')';
  }
  function rgba(hex, a) {
    const x = rgb(hex);
    return 'rgba(' + x[0] + ',' + x[1] + ',' + x[2] + ',' + a + ')';
  }

  // ---------- shapes ----------

  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  // a closed shape through points, its corners rounded (a pebble, a rock)
  function roundPoly(ctx, pts, r) {
    const n = pts.length;
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const m0 = mid(pts[n - 1], pts[0]);
    ctx.moveTo(m0[0], m0[1]);
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const q = mid(p, pts[(i + 1) % n]);
      if (r) ctx.arcTo(p[0], p[1], q[0], q[1], r);
      else ctx.quadraticCurveTo(p[0], p[1], q[0], q[1]);
    }
    ctx.closePath();
  }
  // a soft cluster of circles: clouds, leaves
  function puff(ctx, x, y, w, h, seed, n) {
    const R = rng(seed);
    for (let i = 0; i < n; i++) {
      const k = n === 1 ? 0.5 : i / (n - 1);
      const cx = x + w * (0.12 + 0.76 * k) + (R() - 0.5) * w * 0.08;
      const rad = h * (0.36 + 0.3 * Math.sin(Math.PI * k) + 0.1 * R());
      const cy = y + h - rad * 0.95;
      ctx.moveTo(cx + rad, cy);
      ctx.arc(cx, cy, rad, 0, TAU);
    }
  }
  function fillPath(ctx, color, build) {
    ctx.beginPath();
    build();
    ctx.fillStyle = color;
    ctx.fill();
  }
  function skyFill(ctx, W, top, bottom, a, b) {
    const g = ctx.createLinearGradient(0, top, 0, bottom);
    g.addColorStop(0, a);
    g.addColorStop(1, b);
    ctx.fillStyle = g;
    ctx.fillRect(0, top, W, bottom - top);
  }

  // The static parts of a Falling background, kept as a picture at the size they are shown at.
  const still = { key: '', canvas: null };
  function cachedLayer(ctx, key, W, H, paint) {
    let sc = 1;
    try {
      const m = ctx.getTransform();
      sc = Math.max(1, Math.min(4, Math.hypot(m.a, m.b)));
    } catch (err) {
      sc = 2;
    }
    const k = key + '|' + Math.round(W) + 'x' + Math.round(H) + '@' + sc.toFixed(2);
    if (still.key !== k || !still.canvas) {
      const c = still.canvas || document.createElement('canvas');
      c.width = Math.max(1, Math.ceil(W * sc));
      c.height = Math.max(1, Math.ceil(H * sc));
      const g = c.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, c.width, c.height);
      g.setTransform(sc, 0, 0, sc, 0, 0);
      paint(g);
      still.key = k;
      still.canvas = c;
    }
    ctx.drawImage(still.canvas, 0, 0, W, H);
  }

  const UI = "'M PLUS Rounded 1c', 'Hiragino Maru Gothic ProN', 'Yu Gothic', sans-serif";

  function stars(ctx, W, h, seed, n) {
    ctx.fillStyle = 'rgba(232,235,246,0.6)';
    for (let k = 0; k < n; k++) {
      ctx.beginPath();
      ctx.arc(hash(seed, k) * W, hash(seed + 1, k) * h, 0.6 + hash(seed + 2, k), 0, TAU);
      ctx.fill();
    }
  }

  // A falling thing round the box of its word: shape(dy) makes its outline (dy: drawn lower, for its shadow), a hard
  // shadow when it is the card being said, its fill and line, and then details(line, lw), what makes it what it is.
  function thingFrame(ctx, o, fill, shape, details) {
    const pal = o.pal || {};
    const line = o.flash ? pal.bad || '#C7361E' : o.target ? pal.outline || INK : o.dark ? '#7B86B4' : '#8C93A8';
    const lw = o.target || o.flash ? 2.5 : 1.8;
    ctx.save();
    if (o.target) {
      shape(4);
      ctx.fillStyle = pal.hard || INK;
      ctx.fill();
    }
    shape(0);
    ctx.fillStyle = o.flash ? '#FDEBE6' : fill;
    ctx.fill();
    ctx.lineWidth = lw;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = line;
    ctx.stroke();
    ctx.lineCap = 'round';
    details(line, lw);
    ctx.restore();
  }

  // ---------- the places ----------

  const PLACES = [
    { id: 'yama', ja: '山', en: 'Mountain', song: 'yuki' },
    { id: 'danchi', ja: '団地', en: 'Apartment block', song: 'yoru' },
    { id: 'jinja', ja: '神社', en: 'Shrine', song: 'matsuri' },
    { id: 'mori', ja: '森', en: 'Forest', song: 'take' },
  ];
  const IDS = PLACES.map((p) => p.id);

  // the game's own stages are spread over the places; a course week takes one by its name
  const OWN = {
    'kana:basic': 'jinja', 'kana:voiced': 'mori', 'kana:katakana': 'danchi', 'kana:words': 'yama', 'kana:pairs': 'jinja',
    'kanji:single': 'yama', 'kanji:jukugo': 'mori', 'kanji:advanced': 'danchi', 'kanji:yoji': 'jinja', 'kanji:sentences': 'yama',
    'phrase:greet': 'danchi', 'phrase:phrases': 'mori', 'phrase:twister': 'jinja',
  };
  // the first steps' lessons go round the places, one after another
  const LESSON_PLACES = ['jinja', 'mori', 'yama', 'danchi'];
  function forStage(key) {
    if (OWN[key]) return OWN[key];
    const lesson = /^start:[a-z]+(\d+)$/.exec(String(key || ''));
    if (lesson) return LESSON_PLACES[(Number(lesson[1]) - 1) % LESSON_PLACES.length];
    let h = 0;
    for (const ch of String(key || '')) h = (Math.imul(h, 31) + ch.codePointAt(0)) | 0;
    return IDS[(h >>> 0) % IDS.length];
  }

  // The places' drawings, each from its own file (places/*.js), registered with define(). A place that did not load
  // cannot be drawn: game.js then keeps to the plain paper.
  const BY = {};
  function define(id, place) {
    BY[id] = place;
  }
  function placeOf(id) {
    const p = BY[id];
    if (!p) throw new Error('No drawing for the place ' + id);
    return p;
  }
  const colOf = (id, dark) => placeOf(id).palette[dark ? 'dark' : 'light'];

  // Climb: where each ledge is, as each place lays its ledges out.
  function layout(place, n, W) {
    return placeOf(place).layout(n, W);
  }

  // ---------- drawing, safely ----------

  function back(ctx, o) {
    const p = placeOf(o.place);
    const C = colOf(o.place, o.dark);
    ctx.save();
    try {
      if (o.style === 'climb') p.climb(ctx, o, C);
      else p.fall(ctx, o, C);
    } finally {
      ctx.restore();
    }
  }
  function thing(ctx, o) {
    const p = placeOf(o.place);
    ctx.save();
    try {
      p.thing(ctx, o, colOf(o.place, o.dark));
    } finally {
      ctx.restore();
    }
  }
  function colors(place, n) {
    return placeOf(place).colors(n);
  }
  function ledge(ctx, o) {
    const p = placeOf(o.place);
    ctx.save();
    try {
      p.ledge(ctx, o, colOf(o.place, o.dark), o.pal || {});
    } finally {
      ctx.restore();
    }
  }
  function summit(ctx, o) {
    const p = placeOf(o.place);
    ctx.save();
    try {
      p.summit(ctx, o, colOf(o.place, o.dark), o.pal || {});
    } finally {
      ctx.restore();
    }
  }

  window.SpeakingWorld = {
    PLACES, forStage, layout, back, thing, colors, ledge, summit, define,
    kit: { TAU, INK, UI, hash, rng, noise, clamp, smooth, wrap, rgb, mix, rgba, rr, roundPoly, puff, fillPath, skyFill, cachedLayer, stars, thingFrame },
  };
})();
