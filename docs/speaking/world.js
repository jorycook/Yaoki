/*
 * Yaoki Speaking's places (景色), drawn for a phone held upright: the picture under the graph paper, the things that
 * fall in Falling and the ledges of Climb, in flat, pale, cut-paper shapes like Yaoki Typing's scenes.
 *
 * Four places, each with its falling things and its climb:
 *   山 Mountain           rocks come down the crevice; Climb goes up its rock ledges to the summit and its flag
 *   団地 Apartment block   boxes, rubbish bags and flowerpots dropped from the windows; Climb goes up the fire ladder
 *                          to the roof and its water tank
 *   神社 Shrine            hail from a storm over the torii; Climb goes up the stone steps, through torii, to the shrine
 *                          and its bell
 *   森 Forest              acorns, pears and persimmons from a great tree; Climb goes up its branches to a nest
 *
 * Everything is pale and soft, a picture pasted into a notebook, so it stays behind the game's cards and its red daruma;
 * the falling things and the ledges, which the game puts its words on, have an ink outline and stay pale in the dark
 * too, so the words on them read the same. The sky follows the round (towards evening, or towards the summit), the
 * season shows in the trees, and dark mode is night. With reduced motion everything is still.
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
 *   colors(place, n, dark)            the fill and line of thing n, for its pieces
 *   ledge(ctx, o)                     a ledge whose top is at (x, y): o = { place, n, x, y, w, side, dark, pal, W }
 *   summit(ctx, o)                    the top of the climb at y: o = { place, W, y, dark, pal, t, reached }
 * }
 * All in the game's logical units, on a context already scaled. No images and no libraries. Each function catches
 * its own errors: a place that cannot be drawn leaves the plain paper.
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

  // ---------- the places' colours ----------

  const COL = {
    yama: {
      light: { sky: '#D9E8F5', low: '#F2F4F8', eve: '#F9E2CB', far: '#D8DEEA', snow: '#F4F6FA', cliff: '#E4DFD6', cliff2: '#D9D3C8', strata: '#CEC7BA', ground: '#E8E2D6', pebble: '#D5CDC0', ledge: '#DCD5C9', plant: '#C9D9BE', cloud: '#FFFFFF' },
      dark: { sky: '#121933', low: '#1B2341', eve: '#2B2340', far: '#202945', snow: '#2E3857', cliff: '#252B44', cliff2: '#1F243B', strata: '#2E3553', ground: '#21273E', pebble: '#2B3250', ledge: '#3A4262', plant: '#24333A', cloud: '#2A3352' },
    },
    danchi: {
      light: { sky: '#DCE9F6', low: '#F1F4F8', eve: '#F7DCC9', wall: '#EEE9E1', wall2: '#E5DFD5', line: '#DDD5C9', glass: '#DCE6F1', frame: '#CBD2DD', rail: '#D2CABD', street: '#E2DED7', curb: '#CFC9BF', ladder: '#B9C0CC', lit: '#F6DE96' },
      dark: { sky: '#131A33', low: '#1A2240', eve: '#28223F', wall: '#1E2441', wall2: '#1A203A', line: '#272E4E', glass: '#283157', frame: '#333C62', rail: '#2E3658', street: '#20263F', curb: '#2B3250', ladder: '#4A5378', lit: '#F3D47E' },
    },
    jinja: {
      light: { sky: '#E7E5F0', low: '#F3F2F7', eve: '#F1DCD8', storm: '#D7D4E4', torii: '#F2B6A7', torii2: '#E9A08E', cedar: '#D4DED3', cedar2: '#C8D4C7', trunk: '#D2C5B4', stone: '#E6E3DC', stone2: '#D6D1C7', lantern: '#DCD7CE', moss: '#D3DFC7', hail: '#FFFFFF' },
      dark: { sky: '#151A30', low: '#1B2139', eve: '#2A2038', storm: '#222844', torii: '#5B2F39', torii2: '#4A2630', cedar: '#1C292D', cedar2: '#18242A', trunk: '#2A2A33', stone: '#252A40', stone2: '#20253A', lantern: '#2C3149', moss: '#21302F', hail: '#C9D6EE' },
    },
    mori: {
      light: { sky: '#E3F0EA', low: '#F2F6F3', eve: '#F6E2CC', trunk: '#CDB495', bark: '#B99F80', grass: '#DCE8D1', ground: '#E4E7D8', cloud: '#FFFFFF', far: '#D3E2D2' },
      dark: { sky: '#111D24', low: '#16242B', eve: '#26202F', trunk: '#3A3329', bark: '#2E2820', grass: '#1C2A26', ground: '#1E2826', cloud: '#22323A', far: '#1A2A2C' },
    },
  };
  // the great tree's leaves, by the season
  const LEAVES = {
    spring: { light: ['#D9EBCB', '#CDE3BD', '#F6D3DD'], dark: ['#21352A', '#1D2F25', '#4A3340'] },
    summer: { light: ['#C9E2B8', '#BCD9A9', '#D7EBC6'], dark: ['#1E3326', '#1A2D21', '#234030'] },
    autumn: { light: ['#F3D4A7', '#EDC08E', '#E8A98B'], dark: ['#3E3122', '#3A2A1E', '#43282A'] },
    winter: { light: ['#E2E8E5', '#D7DFDB', '#F7FAFC'], dark: ['#22302E', '#1E2A28', '#34404A'] },
  };
  const colOf = (place, dark) => (COL[place] || COL.yama)[dark ? 'dark' : 'light'];

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
  function forStage(key) {
    if (OWN[key]) return OWN[key];
    let h = 0;
    for (const ch of String(key || '')) h = (Math.imul(h, 31) + ch.codePointAt(0)) | 0;
    return IDS[(h >>> 0) % IDS.length];
  }

  // Climb: where each ledge is. The crevice's ledges keep to its walls, the ladder's rungs are in the middle, the steps
  // turn back and forth up the hill, and the branches come off the trunk on either side.
  function layout(place, n, W) {
    if (place === 'danchi') return { x: W / 2, side: 0 };
    if (place === 'jinja') return { x: W * [0.34, 0.5, 0.66, 0.5][wrap(n, 4)], side: 0 };
    const side = n % 2 ? 1 : -1;
    if (place === 'mori') return { x: W / 2 + side * Math.min(W * 0.26, 70), side };
    return { x: side < 0 ? W * 0.3 : W * 0.7, side };
  }

  // ---------- 山: the mountain ----------

  const yama = {
    fallStill(g, o, C) {
      const { W, ground } = o;
      // far peaks with snow on them
      const R = rng(11);
      g.beginPath();
      g.moveTo(0, ground);
      const peaks = [];
      for (let x = 0; x <= W + 20; x += 20) {
        const y = ground * (0.36 + 0.14 * noise(3, x / 70) + 0.06 * noise(5, x / 23));
        g.lineTo(x, y);
        peaks.push([x, y]);
      }
      g.lineTo(W, ground);
      g.closePath();
      g.fillStyle = C.far;
      g.fill();
      g.fillStyle = C.snow;
      for (let i = 1; i < peaks.length - 1; i++) {
        const [x, y] = peaks[i];
        if (y < peaks[i - 1][1] && y < peaks[i + 1][1] && y < ground * 0.43) {
          g.beginPath();
          g.moveTo(x - 9, y + 7);
          g.lineTo(x, y);
          g.lineTo(x + 9, y + 7);
          g.lineTo(x + 3, y + 5);
          g.lineTo(x - 2, y + 8);
          g.closePath();
          g.fill();
        }
      }
      // the crevice's walls, with their layers of rock
      for (const side of [-1, 1]) {
        g.beginPath();
        const edge = (y) => W * 0.13 + 12 * noise(side > 0 ? 21 : 22, y / 50) + 5 * noise(23, y / 17);
        const x0 = side < 0 ? 0 : W;
        g.moveTo(x0, -2);
        for (let y = -2; y <= ground + 4; y += 8) g.lineTo(side < 0 ? edge(y) : W - edge(y), y);
        g.lineTo(x0, ground + 4);
        g.closePath();
        g.fillStyle = C.cliff;
        g.fill();
        g.strokeStyle = C.strata;
        g.lineWidth = 1.5;
        g.lineCap = 'round';
        g.beginPath();
        for (let y = 18; y < ground; y += 26 + 8 * R()) {
          const e = edge(y);
          const len = e * (0.4 + 0.4 * R());
          const a = side < 0 ? e - len - 4 : W - e + 4;
          g.moveTo(a, y);
          g.lineTo(a + len, y + (R() - 0.5) * 4);
        }
        g.stroke();
        // a tuft here and there
        g.fillStyle = C.plant;
        for (let k = 0; k < 3; k++) {
          const y = ground * (0.25 + 0.25 * k) + R() * 20;
          const x = side < 0 ? edge(y) - 2 : W - edge(y) + 2;
          g.beginPath();
          g.ellipse(x, y, 6, 3.5, side * 0.4, 0, TAU);
          g.fill();
        }
      }
      // the path
      g.fillStyle = C.ground;
      g.fillRect(0, ground, W, o.H - ground);
      g.fillStyle = C.pebble;
      for (let k = 0; k < 14; k++) {
        g.beginPath();
        g.ellipse(R() * W, ground + 10 + R() * (o.H - ground - 14), 2 + R() * 3, 1.5 + R() * 1.5, 0, 0, TAU);
        g.fill();
      }
    },
    fall(ctx, o, C) {
      const { W, ground, t } = o;
      skyFill(ctx, W, 0, ground, mix(C.sky, C.eve, o.progress * 0.7), C.low);
      // clouds drift between the walls, behind the peaks
      ctx.fillStyle = rgba(C.cloud === '#FFFFFF' ? '#FFFFFF' : C.cloud, o.dark ? 0.7 : 0.85);
      for (let k = 0; k < 3; k++) {
        const w = 60 + 20 * k;
        const x = wrap(k * 97 + t * (4 + 2 * k), W + w * 2) - w;
        fillPath(ctx, ctx.fillStyle, () => puff(ctx, x, ground * (0.12 + 0.1 * k), w, 18 + 4 * k, 40 + k, 4));
      }
      if (o.dark) stars(ctx, W, ground * 0.4, 31, 16);
      cachedLayer(ctx, 'yama' + o.dark, W, o.H, (g) => yama.fallStill(g, o, C));
    },
    climb(ctx, o, C) {
      const { W, H, y0, top } = o;
      const up = clamp(-y0 / Math.max(1, -top), 0, 1);
      skyFill(ctx, W, 0, H, mix(mix(C.sky, C.low, 0.3), C.eve, smooth(0.75, 1, up) * 0.8), mix(C.cliff2, C.low, 0.4 + 0.6 * up));
      // the far side of the crevice, slower
      const far = (y) => W * 0.24 + 10 * noise(31, y / 70);
      for (const side of [-1, 1]) {
        ctx.beginPath();
        const x0 = side < 0 ? 0 : W;
        ctx.moveTo(x0, -4);
        for (let sy = -4; sy <= H + 8; sy += 10) {
          const wy = y0 * 0.6 + sy;
          ctx.lineTo(side < 0 ? far(wy) : W - far(wy + 300), sy);
        }
        ctx.lineTo(x0, H + 8);
        ctx.closePath();
        ctx.fillStyle = C.cliff2;
        ctx.fill();
      }
      // birds across the gap now and then
      if (!o.still) {
        ctx.strokeStyle = rgba(INK, o.dark ? 0.35 : 0.25);
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        for (let k = 0; k < 2; k++) {
          const x = wrap(o.t * (14 + 5 * k) + k * 120, W + 40) - 20;
          const y = H * (0.22 + 0.3 * k) + 6 * Math.sin(o.t * 2 + k);
          const f = 3 * Math.sin(o.t * 8 + k);
          ctx.moveTo(x - 5, y - f);
          ctx.quadraticCurveTo(x - 2, y - 2, x, y);
          ctx.quadraticCurveTo(x + 2, y - 2, x + 5, y - f);
        }
        ctx.stroke();
      }
      // the near walls
      const edge = (y, s) => W * 0.13 + 14 * noise(s, y / 60) + 6 * noise(s + 5, y / 21);
      for (const side of [-1, 1]) {
        const s = side < 0 ? 41 : 42;
        ctx.beginPath();
        const x0 = side < 0 ? 0 : W;
        ctx.moveTo(x0, -4);
        for (let sy = -4; sy <= H + 8; sy += 8) {
          const e = edge(y0 + sy, s);
          ctx.lineTo(side < 0 ? e : W - e, sy);
        }
        ctx.lineTo(x0, H + 8);
        ctx.closePath();
        ctx.fillStyle = C.cliff;
        ctx.fill();
        // its layers, every so often (by the world's height, so they stay put)
        ctx.strokeStyle = C.strata;
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        const first = Math.floor((y0 - 10) / 30);
        for (let b = first; b * 30 < y0 + H + 10; b++) {
          const wy = b * 30 + 10 * hash(s, b);
          const e = edge(wy, s);
          const len = e * (0.35 + 0.4 * hash(s + 1, b));
          const sy = wy - y0;
          const a = side < 0 ? e - len - 4 : W - e + 4;
          ctx.moveTo(a, sy);
          ctx.lineTo(a + len, sy + (hash(s + 2, b) - 0.5) * 4);
        }
        ctx.stroke();
        ctx.fillStyle = C.plant;
        const p0 = Math.floor(y0 / 110);
        for (let b = p0; b * 110 < y0 + H + 20; b++) {
          if (hash(s + 3, b) < 0.5) continue;
          const wy = b * 110 + 40 * hash(s + 4, b);
          const e = edge(wy, s);
          ctx.beginPath();
          ctx.ellipse(side < 0 ? e - 1 : W - e + 1, wy - y0, 7, 4, side * 0.5, 0, TAU);
          ctx.fill();
        }
      }
      // the ground at the bottom
      if (-y0 < H) {
        ctx.fillStyle = C.ground;
        ctx.fillRect(0, -y0, W, H + y0 + 4);
      }
    },
    ledge(ctx, o, C, pal) {
      const { x, y, w, side, W } = o;
      const R = rng(500 + o.n);
      const inner = side < 0 ? x + w / 2 + 6 : x - w / 2 - 6;
      const wall = side < 0 ? -6 : W + 6;
      ctx.beginPath();
      ctx.moveTo(wall, y);
      ctx.lineTo(inner - side * 6, y);
      ctx.quadraticCurveTo(inner, y, inner, y + 6);
      const n = 6;
      for (let k = 1; k <= n; k++) {
        const kx = inner + (wall - inner) * (k / n);
        ctx.lineTo(kx, y + 10 + 6 * R() + 10 * (k / n));
      }
      ctx.closePath();
      ctx.fillStyle = C.ledge;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = pal.outline;
      ctx.stroke();
      ctx.strokeStyle = C.strata;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(inner - side * 10, y + 5);
      ctx.lineTo(inner - side * (24 + 14 * R()), y + 5);
      ctx.stroke();
    },
    summit(ctx, o, C, pal) {
      const { W, y, t } = o;
      // the morning sun behind the top
      ctx.fillStyle = o.dark ? 'rgba(243,212,126,0.18)' : 'rgba(255,228,180,0.8)';
      ctx.beginPath();
      ctx.arc(W * 0.3, y - 50, 26, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-4, y + 46);
      ctx.lineTo(-4, y + 4);
      for (let x = 0; x <= W; x += 16) ctx.lineTo(x, y + (x > W * 0.15 && x < W * 0.85 ? 0 : 6 * noise(7, x / 20)));
      ctx.lineTo(W + 4, y + 4);
      ctx.lineTo(W + 4, y + 46);
      for (let x = W; x >= 0; x -= 14) ctx.lineTo(x, y + 30 + 14 * noise(9, x / 18));
      ctx.closePath();
      ctx.fillStyle = C.ledge;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = pal.outline;
      ctx.stroke();
      // the flag
      const fx = W * 0.74;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(fx, y);
      ctx.lineTo(fx, y - 54);
      ctx.stroke();
      const wave = o.still ? 0 : Math.sin(t * 4) * 3;
      ctx.beginPath();
      ctx.moveTo(fx, y - 54);
      ctx.quadraticCurveTo(fx + 14, y - 58 + wave, fx + 28, y - 50 + wave);
      ctx.lineTo(fx, y - 38);
      ctx.closePath();
      ctx.fillStyle = '#E2452B';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.stroke();
    },
  };

  // ---------- 団地: the apartment block ----------

  const danchi = {
    // one window and its balcony, with what hangs there
    window(g, x, y, C, seed, lit) {
      const R = rng(seed);
      g.fillStyle = C.frame;
      g.fillRect(x - 24, y - 2, 48, 32);
      g.fillStyle = lit ? C.lit : C.glass;
      g.fillRect(x - 22, y, 44, 28);
      g.fillStyle = C.frame;
      g.fillRect(x - 1, y, 2, 28);
      // the balcony's rail under it
      g.strokeStyle = C.rail;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x - 30, y + 34);
      g.lineTo(x + 30, y + 34);
      g.moveTo(x - 30, y + 44);
      g.lineTo(x + 30, y + 44);
      for (let k = -3; k <= 3; k++) {
        g.moveTo(x + k * 9, y + 34);
        g.lineTo(x + k * 9, y + 44);
      }
      g.stroke();
      const what = R();
      if (what < 0.32) {
        // washing on the line
        const cols = ['#F6C9C2', '#CFE3F2', '#F7E4A9', '#D5EBCF', '#E6D5F2'];
        g.strokeStyle = C.frame;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x - 22, y + 8);
        g.lineTo(x + 22, y + 8);
        g.stroke();
        for (let k = 0; k < 3; k++) {
          g.fillStyle = cols[Math.floor(R() * cols.length)];
          g.fillRect(x - 18 + k * 13, y + 8, 9, 12 + R() * 6);
        }
      } else if (what < 0.5) {
        // a futon over the rail
        g.fillStyle = '#F2D7C8';
        g.fillRect(x - 20, y + 30, 40, 18);
        g.fillStyle = '#E8BFAA';
        for (let k = 0; k < 4; k++) g.fillRect(x - 20 + k * 11, y + 30, 4, 18);
      } else if (what < 0.68) {
        // pot plants
        g.fillStyle = '#C9DDBE';
        g.beginPath();
        g.arc(x - 16, y + 28, 6, 0, TAU);
        g.arc(x + 14, y + 27, 7, 0, TAU);
        g.fill();
      }
    },
    fallStill(g, o, C) {
      const { W, ground } = o;
      g.fillStyle = C.wall;
      g.fillRect(0, 0, W, ground);
      // floors
      g.fillStyle = C.wall2;
      for (let y = 58; y < ground; y += 64) g.fillRect(0, y, W, 3);
      const cols = [W * 0.17, W * 0.5, W * 0.83];
      let row = 0;
      for (let y = 6; y + 46 < ground - 10; y += 64, row++) {
        cols.forEach((x, i) => {
          // the middle window at the top is open: that is where it all comes from
          if (row === 0 && i === 1) {
            g.fillStyle = C.frame;
            g.fillRect(x - 24, y - 2, 48, 32);
            g.fillStyle = o.dark ? '#0E1226' : '#9FA9BC';
            g.fillRect(x - 22, y, 44, 28);
            g.fillStyle = '#F2C6BD';
            g.beginPath();
            g.moveTo(x - 22, y);
            g.quadraticCurveTo(x - 12, y + 14, x - 20, y + 28);
            g.lineTo(x - 22, y + 28);
            g.closePath();
            g.fill();
            return;
          }
          danchi.window(g, x, y, C, row * 7 + i + 3, false);
        });
      }
      // the street and its kerb
      g.fillStyle = C.street;
      g.fillRect(0, ground, W, o.H - ground);
      g.fillStyle = C.curb;
      g.fillRect(0, ground + 12, W, 3);
      g.beginPath();
      g.ellipse(W * 0.78, ground + 22, 11, 3.5, 0, 0, TAU);
      g.fill();
    },
    fall(ctx, o, C) {
      cachedLayer(ctx, 'danchi' + o.dark, o.W, o.H, (g) => danchi.fallStill(g, o, C));
      // as the round goes on, evening comes and windows light up
      const k = o.dark ? 0.6 : smooth(0.4, 1, o.progress) * 0.7;
      if (k > 0) {
        const cols = [o.W * 0.17, o.W * 0.5, o.W * 0.83];
        let row = 0;
        for (let y = 6; y + 46 < o.ground - 10; y += 64, row++) {
          cols.forEach((x, i) => {
            if ((row === 0 && i === 1) || hash(row, i + 9) > k) return;
            ctx.fillStyle = rgba(C.lit, 0.55);
            ctx.fillRect(x - 22, y, 21, 28);
            ctx.fillRect(x + 1, y, 21, 28);
          });
        }
      }
    },
    climb(ctx, o, C) {
      const { W, H, y0, top } = o;
      ctx.fillStyle = C.wall;
      ctx.fillRect(0, 0, W, H);
      // above the roof: the sky
      const roof = top - y0;
      if (roof > 0) skyFill(ctx, W, 0, roof, mix(C.sky, C.eve, 0.5), C.low);
      // floors, with a number by the ladder, and windows either side of it
      const FLOOR = 90;
      const f0 = Math.floor(y0 / FLOOR) - 1;
      for (let f = f0; f * FLOOR < y0 + H + FLOOR; f++) {
        const wy = f * FLOOR;
        if (wy < top) continue;
        const sy = wy - y0;
        ctx.fillStyle = C.wall2;
        ctx.fillRect(0, sy, W, 3);
        const floor = -f;
        if (floor >= 1) {
          for (const x of [W * 0.16, W * 0.84]) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, Math.max(0, roof), W, H);
            ctx.clip();
            danchi.window(ctx, x, sy + 14, C, f * 13 + (x < W / 2 ? 1 : 2), o.dark && hash(f, x < W / 2 ? 1 : 2) < 0.5);
            ctx.restore();
          }
          ctx.fillStyle = o.dark ? '#2E3658' : '#FFFFFF';
          ctx.fillRect(W / 2 + 54, sy + 8, 20, 12);
          ctx.fillStyle = o.dark ? '#A6AECA' : '#5A6382';
          ctx.font = '800 8px ' + UI;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(floor + 'F', W / 2 + 64, sy + 14.5);
        }
      }
      // the fire ladder: its rails, small rungs between the ones with words, and its cage
      const rails = [W / 2 - 46, W / 2 + 46];
      const yTop = Math.max(0, roof);
      ctx.strokeStyle = C.ladder;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let wy = Math.floor(y0 / 32) * 32; wy < y0 + H; wy += 32) {
        const sy = wy - y0;
        if (sy < yTop || wy > -10) continue;
        ctx.moveTo(rails[0], sy);
        ctx.lineTo(rails[1], sy);
      }
      ctx.stroke();
      ctx.strokeStyle = rgba(C.ladder.length === 7 ? C.ladder : '#B9C0CC', 0.5);
      ctx.beginPath();
      for (let wy = Math.floor(y0 / 48) * 48; wy < y0 + H; wy += 48) {
        const sy = wy - y0;
        if (sy < yTop || wy > -60) continue;
        ctx.moveTo(rails[0] - 4, sy);
        ctx.quadraticCurveTo(W / 2, sy - 22, rails[1] + 4, sy);
      }
      ctx.stroke();
      ctx.strokeStyle = C.ladder;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (const x of rails) {
        ctx.moveTo(x, yTop);
        ctx.lineTo(x, Math.min(H, -y0));
      }
      ctx.stroke();
      // the street at the bottom
      if (-y0 < H) {
        ctx.fillStyle = C.street;
        ctx.fillRect(0, -y0, W, H + y0 + 4);
      }
    },
    ledge(ctx, o, C, pal) {
      const { x, y, W } = o;
      const a = Math.max(6, x - 48);
      const b = Math.min(W - 6, x + 48);
      ctx.beginPath();
      rr(ctx, a, y, b - a, 7, 3.5);
      ctx.fillStyle = o.dark ? '#5A6488' : '#C3CAD6';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = pal.outline;
      ctx.stroke();
    },
    summit(ctx, o, C, pal) {
      const { W, y, t } = o;
      // the roof's edge, its rail, a water tank and an aerial
      ctx.fillStyle = o.dark ? '#2A3152' : '#DCD5CA';
      ctx.fillRect(-4, y, W + 8, 40);
      ctx.strokeStyle = pal.outline;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-4, y);
      ctx.lineTo(W + 4, y);
      ctx.stroke();
      ctx.strokeStyle = C.ladder;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-4, y - 16);
      ctx.lineTo(W + 4, y - 16);
      for (let x = 8; x < W; x += 16) {
        ctx.moveTo(x, y - 16);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      const tx = W * 0.2;
      ctx.fillStyle = o.dark ? '#39416A' : '#E9EEF5';
      ctx.beginPath();
      rr(ctx, tx - 22, y - 58, 44, 34, 8);
      ctx.fill();
      ctx.strokeStyle = pal.outline;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(tx - 16, y - 24);
      ctx.lineTo(tx - 18, y);
      ctx.moveTo(tx + 16, y - 24);
      ctx.lineTo(tx + 18, y);
      ctx.stroke();
      const ax = W * 0.82;
      ctx.beginPath();
      ctx.moveTo(ax, y);
      ctx.lineTo(ax, y - 56);
      for (const k of [0, 1, 2]) {
        ctx.moveTo(ax - 12 + k * 3, y - 50 + k * 10);
        ctx.lineTo(ax + 12 - k * 3, y - 50 + k * 10);
      }
      ctx.stroke();
      if (o.reached && !o.still) {
        // fireworks over the town
        for (let k = 0; k < 2; k++) {
          const u = wrap(t * 0.7 + k * 0.5, 1);
          const cx = W * (0.35 + 0.35 * k);
          const cy = y - 90 - 20 * k;
          ctx.strokeStyle = rgba(k ? '#F2B43A' : '#E2452B', 1 - u);
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * TAU;
            ctx.moveTo(cx + Math.cos(a) * 18 * u, cy + Math.sin(a) * 18 * u);
            ctx.lineTo(cx + Math.cos(a) * 26 * u, cy + Math.sin(a) * 26 * u);
          }
          ctx.stroke();
        }
      }
    },
  };

  // ---------- 神社: the shrine ----------

  // a torii: posts at cx ± half, its top beam at y
  function torii(ctx, cx, half, y, bottom, C) {
    ctx.fillStyle = C.torii;
    ctx.fillRect(cx - half - 4, y + 10, 8, bottom - y - 10);
    ctx.fillRect(cx + half - 4, y + 10, 8, bottom - y - 10);
    ctx.fillRect(cx - half - 10, y + 22, 2 * half + 20, 6);
    ctx.beginPath();
    ctx.moveTo(cx - half - 22, y - 2);
    ctx.quadraticCurveTo(cx, y + 6, cx + half + 22, y - 2);
    ctx.lineTo(cx + half + 18, y + 8);
    ctx.quadraticCurveTo(cx, y + 14, cx - half - 18, y + 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = C.torii2;
    ctx.fillRect(cx - 6, y + 10, 12, 14);
  }
  function lantern(ctx, x, base, s, C) {
    ctx.fillStyle = C.lantern;
    ctx.fillRect(x - 7 * s, base - 8 * s, 14 * s, 8 * s);
    ctx.fillRect(x - 3 * s, base - 22 * s, 6 * s, 14 * s);
    ctx.fillRect(x - 8 * s, base - 32 * s, 16 * s, 10 * s);
    ctx.beginPath();
    ctx.moveTo(x - 12 * s, base - 32 * s);
    ctx.lineTo(x, base - 40 * s);
    ctx.lineTo(x + 12 * s, base - 32 * s);
    ctx.closePath();
    ctx.fill();
  }
  function cedar(ctx, x, base, h, C, k) {
    ctx.fillStyle = C.trunk;
    ctx.fillRect(x - 3, base - h * 0.3, 6, h * 0.3);
    ctx.fillStyle = k ? C.cedar2 : C.cedar;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const y = base - h * (0.25 + i * 0.2);
      const w = 22 - i * 4;
      ctx.moveTo(x - w, y + 10);
      ctx.lineTo(x, y - h * 0.25);
      ctx.lineTo(x + w, y + 10);
      ctx.closePath();
    }
    ctx.fill();
  }

  const jinja = {
    fallStill(g, o, C) {
      const { W, ground } = o;
      const R = rng(71);
      for (let k = 0; k < 4; k++) cedar(g, k < 2 ? W * (0.05 + 0.1 * k) : W * (0.85 + 0.1 * (k - 2)), ground, 150 + 30 * R(), C, k % 2);
      torii(g, W / 2, Math.min(W * 0.3, 80), ground - 150, ground, C);
      lantern(g, W * 0.12, ground, 1, C);
      lantern(g, W * 0.88, ground, 1, C);
      g.fillStyle = C.stone;
      g.fillRect(0, ground, W, o.H - ground);
      g.strokeStyle = C.stone2;
      g.lineWidth = 1;
      g.beginPath();
      for (let x = 10; x < W; x += 34) {
        g.moveTo(x, ground + 4);
        g.lineTo(x - 6, o.H);
      }
      g.moveTo(0, ground + 16);
      g.lineTo(W, ground + 16);
      g.stroke();
    },
    fall(ctx, o, C) {
      const { W, ground, t } = o;
      skyFill(ctx, W, 0, ground, mix(C.storm, C.eve, o.progress * 0.5), C.low);
      cachedLayer(ctx, 'jinja' + o.dark, W, o.H, (g) => jinja.fallStill(g, o, C));
      // the storm the hail comes from, and hail far off
      ctx.fillStyle = o.dark ? '#262C48' : '#DCD9E8';
      for (let k = 0; k < 4; k++) {
        const w = 90;
        const x = wrap(k * 70 + t * 5, W + w) - w / 2;
        fillPath(ctx, ctx.fillStyle, () => puff(ctx, x - w / 2, -8 + 6 * (k % 2), w, 30, 90 + k, 5));
      }
      if (!o.still) {
        ctx.fillStyle = rgba(C.hail, o.dark ? 0.5 : 0.9);
        const n = 10 + Math.round(16 * o.progress);
        for (let k = 0; k < n; k++) {
          const x = (hash(k, 3) * W + t * 12) % W;
          const y = wrap(hash(k, 4) * ground + t * (140 + 60 * hash(k, 5)), ground);
          ctx.beginPath();
          ctx.arc(x, y, 1.2 + hash(k, 6), 0, TAU);
          ctx.fill();
        }
      }
    },
    climb(ctx, o, C) {
      const { W, H, y0, top } = o;
      const up = clamp(-y0 / Math.max(1, -top), 0, 1);
      skyFill(ctx, W, 0, H, mix(C.sky, C.eve, smooth(0.7, 1, up) * 0.7), mix(C.cedar2, C.low, 0.5));
      // cedars up the hillside either side, slower than the steps
      const CY = 150;
      const f0 = Math.floor((y0 * 0.7) / CY) - 1;
      for (let b = f0; b * CY < y0 * 0.7 + H + CY; b++) {
        const base = b * CY - y0 * 0.7 + 60;
        cedar(ctx, W * (0.06 + 0.06 * hash(b, 1)), base, 120, C, b % 2);
        cedar(ctx, W * (0.94 - 0.06 * hash(b, 2)), base + 50, 130, C, (b + 1) % 2);
      }
      // the stone path up the hill
      ctx.fillStyle = C.stone;
      ctx.fillRect(W * 0.2, 0, W * 0.6, H);
      ctx.strokeStyle = C.stone2;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let wy = Math.floor(y0 / 22) * 22; wy < y0 + H; wy += 22) {
        if (wy > 0) continue;
        ctx.moveTo(W * 0.2, wy - y0);
        ctx.lineTo(W * 0.8, wy - y0);
      }
      ctx.stroke();
      // torii over the steps, one after another, and lanterns by them
      const TY = 300;
      for (let b = Math.floor(y0 / TY) - 1; b * TY < y0 + H + TY; b++) {
        const wy = b * TY + 140;
        if (wy > -60 || wy < top + 60) continue;
        torii(ctx, W / 2, W * 0.33, wy - 150 - y0, wy - y0, C);
        lantern(ctx, W * 0.14, wy - y0, 0.8, C);
        lantern(ctx, W * 0.86, wy - y0, 0.8, C);
      }
      if (-y0 < H) {
        ctx.fillStyle = C.stone;
        ctx.fillRect(0, -y0, W, H + y0 + 4);
      }
    },
    ledge(ctx, o, C, pal) {
      const { x, y } = o;
      const w = 108;
      ctx.beginPath();
      rr(ctx, x - w / 2, y, w, 12, 3);
      ctx.fillStyle = o.dark ? '#3A4160' : '#EEEBE4';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = pal.outline;
      ctx.stroke();
      ctx.fillStyle = o.dark ? '#2E3450' : '#DCD7CD';
      ctx.fillRect(x - w / 2 + 2, y + 6, w - 4, 4);
      ctx.fillStyle = C.moss;
      ctx.beginPath();
      ctx.ellipse(x - w / 2 + 12, y + 2, 7, 2.5, 0, 0, TAU);
      ctx.fill();
    },
    summit(ctx, o, C, pal) {
      const { W, y, t } = o;
      // the stone terrace, and the hall with its bell
      ctx.fillStyle = o.dark ? '#2A3048' : '#E9E6DF';
      ctx.fillRect(-4, y, W + 8, 44);
      ctx.strokeStyle = pal.outline;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-4, y);
      ctx.lineTo(W + 4, y);
      ctx.stroke();
      const cx = W / 2;
      const hw = Math.min(W * 0.42, 110);
      ctx.fillStyle = o.dark ? '#4A2630' : '#E9A08E';
      ctx.fillRect(cx - hw + 12, y - 70, 8, 70);
      ctx.fillRect(cx + hw - 20, y - 70, 8, 70);
      ctx.fillStyle = o.dark ? '#2C3350' : '#D8DCE6';
      ctx.beginPath();
      ctx.moveTo(cx - hw - 16, y - 66);
      ctx.quadraticCurveTo(cx - hw * 0.4, y - 74, cx, y - 108);
      ctx.quadraticCurveTo(cx + hw * 0.4, y - 74, cx + hw + 16, y - 66);
      ctx.lineTo(cx + hw - 4, y - 74);
      ctx.lineTo(cx - hw + 4, y - 74);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = pal.outline;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      // the bell rope swings once he is there
      const swing = o.reached && !o.still ? Math.sin(t * 5) * 0.12 : 0;
      ctx.save();
      ctx.translate(cx, y - 74);
      ctx.rotate(swing);
      ctx.fillStyle = '#F2B43A';
      ctx.beginPath();
      ctx.arc(0, 10, 7, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.strokeStyle = '#E2452B';
      ctx.lineWidth = 3;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(0, 17);
      ctx.lineTo(0, 54);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      ctx.fillStyle = o.dark ? '#3A2A22' : '#C9A27C';
      ctx.fillRect(cx - 18, y - 16, 36, 16);
      ctx.strokeStyle = pal.outline;
      ctx.lineWidth = 1.4;
      ctx.strokeRect(cx - 18, y - 16, 36, 16);
    },
  };

  // ---------- 森: the great tree ----------

  const mori = {
    leaves(o) {
      return LEAVES[o.season] ? LEAVES[o.season][o.dark ? 'dark' : 'light'] : LEAVES.summer[o.dark ? 'dark' : 'light'];
    },
    fallStill(g, o, C) {
      const { W, ground } = o;
      const L = mori.leaves(o);
      // the trunk, at the side, up into its leaves
      g.fillStyle = C.trunk;
      g.beginPath();
      g.moveTo(W * 0.02, ground + 2);
      g.quadraticCurveTo(W * 0.1, ground * 0.6, W * 0.06, ground * 0.18);
      g.lineTo(W * 0.2, ground * 0.18);
      g.quadraticCurveTo(W * 0.2, ground * 0.6, W * 0.26, ground + 2);
      g.closePath();
      g.fill();
      g.strokeStyle = C.bark;
      g.lineWidth = 1.4;
      g.beginPath();
      for (let k = 0; k < 6; k++) {
        const y = ground * (0.3 + 0.11 * k);
        g.moveTo(W * 0.1, y);
        g.quadraticCurveTo(W * 0.14, y + 8, W * 0.12, y + 18);
      }
      g.stroke();
      // a branch across the top, and the leaves
      g.lineWidth = 8;
      g.strokeStyle = C.trunk;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(W * 0.12, ground * 0.22);
      g.quadraticCurveTo(W * 0.5, ground * 0.06, W * 0.92, ground * 0.12);
      g.stroke();
      for (let k = 0; k < 3; k++) {
        g.fillStyle = L[k % 2];
        g.beginPath();
        puff(g, -20 + k * (W / 2.4), -18 + 10 * (k % 2), W / 1.8, ground * 0.32, 150 + k, 5);
        g.fill();
      }
      // blossom, fruit or snow on them
      const R = rng(160);
      g.fillStyle = L[2];
      for (let k = 0; k < 18; k++) {
        g.beginPath();
        g.arc(R() * W, R() * ground * 0.26, 2 + R() * 2, 0, TAU);
        g.fill();
      }
      g.fillStyle = C.grass;
      g.fillRect(0, ground, W, o.H - ground);
      g.fillStyle = L[1];
      for (let k = 0; k < 10; k++) {
        g.beginPath();
        g.ellipse(R() * W, ground + 8 + R() * (o.H - ground - 12), 3, 1.6, R() * 3, 0, TAU);
        g.fill();
      }
    },
    fall(ctx, o, C) {
      const { W, ground, t } = o;
      skyFill(ctx, W, 0, ground, mix(C.sky, C.eve, o.progress * 0.6), C.low);
      ctx.fillStyle = rgba(C.far.length === 7 ? C.far : '#D3E2D2', 1);
      fillPath(ctx, C.far, () => {
        for (let k = 0; k < 4; k++) puff(ctx, k * W / 3 - 30, ground - 60, W / 2.5, 60, 170 + k, 4);
      });
      cachedLayer(ctx, 'mori' + o.dark + o.season, W, o.H, (g) => mori.fallStill(g, o, C));
      // leaves or petals drifting down
      if (!o.still) {
        const L = mori.leaves(o);
        ctx.fillStyle = L[o.season === 'spring' || o.season === 'winter' ? 2 : 1];
        for (let k = 0; k < 7; k++) {
          const y = wrap(hash(k, 1) * ground + t * (16 + 8 * hash(k, 2)), ground);
          const x = wrap(hash(k, 3) * W + 14 * Math.sin(t * 1.3 + k), W);
          ctx.beginPath();
          ctx.ellipse(x, y, 3, 1.8, t * 2 + k, 0, TAU);
          ctx.fill();
        }
      }
    },
    climb(ctx, o, C) {
      const { W, H, y0, top } = o;
      const up = clamp(-y0 / Math.max(1, -top), 0, 1);
      skyFill(ctx, W, 0, H, mix(mix(C.sky, C.low, 0.2), C.eve, smooth(0.75, 1, up) * 0.6), C.low);
      const L = mori.leaves(o);
      // clouds, far behind
      ctx.fillStyle = C.cloud;
      for (let b = Math.floor((y0 * 0.3) / 160) - 1; b * 160 < y0 * 0.3 + H + 160; b++) {
        const x = wrap(hash(b, 7) * W + (o.still ? 0 : o.t * 3), W + 80) - 40;
        fillPath(ctx, ctx.fillStyle, () => puff(ctx, x - 30, b * 160 - y0 * 0.3, 70, 20, 200 + b, 4));
      }
      // other trees' leaves, slower
      ctx.fillStyle = C.far;
      for (let b = Math.floor((y0 * 0.6) / 120) - 1; b * 120 < y0 * 0.6 + H + 120; b++) {
        const sy = b * 120 - y0 * 0.6;
        const side = b % 2 ? 1 : -1;
        fillPath(ctx, C.far, () => puff(ctx, side < 0 ? -40 : W - 60, sy, 100, 60, 300 + b, 4));
      }
      // the trunk, up the middle, with its bark
      const tx = W / 2;
      ctx.fillStyle = C.trunk;
      ctx.fillRect(tx - 22, Math.max(0, top + 40 - y0), 44, H);
      ctx.strokeStyle = C.bark;
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let b = Math.floor(y0 / 26); b * 26 < y0 + H; b++) {
        const sy = b * 26 - y0 + 8 * hash(b, 11);
        if (b * 26 < top + 40) continue;
        const x = tx - 14 + 28 * hash(b, 12);
        ctx.moveTo(x, sy);
        ctx.quadraticCurveTo(x + 4, sy + 7, x + 1, sy + 14);
      }
      ctx.stroke();
      // leaves on the trunk
      for (let b = Math.floor(y0 / 170) - 1; b * 170 < y0 + H + 100; b++) {
        const wy = b * 170 + 60;
        if (wy > -40 || wy < top + 30) continue;
        ctx.fillStyle = L[b % 2];
        fillPath(ctx, ctx.fillStyle, () => puff(ctx, tx + (b % 2 ? 8 : -46), wy - y0, 38, 22, 400 + b, 3));
      }
      if (-y0 < H) {
        ctx.fillStyle = C.grass;
        ctx.fillRect(0, -y0, W, H + y0 + 4);
      }
    },
    ledge(ctx, o, C, pal) {
      const { x, y, side, W } = o;
      const L = mori.leaves(o);
      const from = W / 2 - side * 10;
      const tip = x + side * 46;
      ctx.beginPath();
      ctx.moveTo(from, y - 2);
      ctx.quadraticCurveTo((from + tip) / 2, y - 6, tip, y);
      ctx.lineTo(tip, y + 5);
      ctx.quadraticCurveTo((from + tip) / 2, y + 14, from, y + 16);
      ctx.closePath();
      ctx.fillStyle = C.trunk;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = pal.outline;
      ctx.stroke();
      ctx.fillStyle = L[0];
      ctx.beginPath();
      puff(ctx, tip - 14 + side * 6, y - 18, 30, 20, 600 + o.n, 3);
      ctx.fill();
      ctx.fillStyle = L[2];
      ctx.beginPath();
      ctx.arc(tip + side * 4, y - 12, 2.5, 0, TAU);
      ctx.fill();
    },
    summit(ctx, o, C, pal) {
      const { W, y, t } = o;
      const L = mori.leaves(o);
      // the tree's crown, and a nest at the very top
      ctx.fillStyle = L[0];
      fillPath(ctx, L[0], () => puff(ctx, W * 0.05, y - 20, W * 0.9, 70, 700, 6));
      ctx.fillStyle = L[1];
      fillPath(ctx, L[1], () => puff(ctx, W * 0.2, y + 10, W * 0.6, 40, 701, 4));
      ctx.fillStyle = C.trunk;
      ctx.fillRect(-4, y, W + 8, 10);
      const cx = W * 0.72;
      ctx.beginPath();
      ctx.ellipse(cx, y - 6, 26, 10, 0, 0, TAU);
      ctx.fillStyle = o.dark ? '#5A4A36' : '#C9A77C';
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = pal.outline;
      ctx.stroke();
      for (let k = 0; k < 3; k++) {
        const bob = o.still ? 0 : Math.sin(t * 6 + k * 2) * (o.reached ? 3 : 1);
        const bx = cx - 12 + k * 12;
        const by = y - 16 + bob;
        ctx.fillStyle = '#FFE08A';
        ctx.beginPath();
        ctx.arc(bx, by, 6, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.fillStyle = '#F2A23A';
        ctx.beginPath();
        ctx.moveTo(bx - 2, by + 1);
        ctx.lineTo(bx + 2, by + 1);
        ctx.lineTo(bx, by + 5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.arc(bx - 2, by - 1.5, 0.9, 0, TAU);
        ctx.arc(bx + 2, by - 1.5, 0.9, 0, TAU);
        ctx.fill();
      }
    },
  };

  const UI = "'M PLUS Rounded 1c', 'Hiragino Maru Gothic ProN', 'Yu Gothic', sans-serif";
  const BY = { yama, danchi, jinja, mori };

  function stars(ctx, W, h, seed, n) {
    ctx.fillStyle = 'rgba(232,235,246,0.6)';
    for (let k = 0; k < n; k++) {
      ctx.beginPath();
      ctx.arc(hash(seed, k) * W, hash(seed + 1, k) * h, 0.6 + hash(seed + 2, k), 0, TAU);
      ctx.fill();
    }
  }

  // ---------- the falling things ----------
  // Each is drawn round the box of its word, a little larger: pale where the word is, so it reads in both themes.

  const KINDS = { yama: ['rock'], danchi: ['box', 'bag', 'pot'], jinja: ['hail'], mori: ['acorn', 'pear', 'kaki'] };
  const FILLS = {
    rock: ['#E6E2DA', '#B9B1A4'], box: ['#EBD3A6', '#C8A673'], bag: ['#F3F6FA', '#B8C4D4'], pot: ['#F0B796', '#C9805C'],
    hail: ['#EEF7FD', '#A9C7DD'], acorn: ['#EDD6AA', '#A97E52'], pear: ['#EFDDA7', '#C2A56A'], kaki: ['#F8C487', '#D98C49'],
  };
  const kindOf = (place, n) => {
    const list = KINDS[place] || KINDS.yama;
    return list[wrap(n, list.length)];
  };

  function colors(place, n) {
    const f = FILLS[kindOf(place, n)];
    return { fill: f[0], line: f[1] };
  }

  function thing(ctx, o) {
    const { x, y, w, h, n } = o;
    const kind = kindOf(o.place, n);
    const [fill, shade] = FILLS[kind];
    const pal = o.pal || {};
    const line = o.flash ? pal.bad || '#C7361E' : o.target ? pal.outline || INK : o.dark ? '#7B86B4' : '#8C93A8';
    const lw = o.target || o.flash ? 2.5 : 1.8;
    const R = rng(1000 + n * 7);
    const cx = x + w / 2;
    const cy = y + h / 2;
    const shape = (dy) => {
      ctx.beginPath();
      if (kind === 'rock') {
        const pts = [];
        const m = 11;
        for (let i = 0; i < m; i++) {
          const a = (i / m) * TAU;
          const jit = 1 + (R() - 0.5) * 0.12;
          pts.push([cx + Math.cos(a) * (w / 2 + 9) * jit, cy + dy + Math.sin(a) * (h / 2 + 9) * jit]);
        }
        roundPoly(ctx, pts, 8);
      } else if (kind === 'hail') {
        const m = 14;
        const pts = [];
        for (let i = 0; i < m; i++) {
          const a = (i / m) * TAU;
          const k = 1 + (i % 2 ? 0.05 : -0.02) + (R() - 0.5) * 0.06;
          pts.push([cx + Math.cos(a) * (w / 2 + 10) * k, cy + dy + Math.sin(a) * (h / 2 + 10) * k]);
        }
        roundPoly(ctx, pts, 0);
      } else if (kind === 'box') {
        rr(ctx, x - 6, y - 6 + dy, w + 12, h + 12, 3);
      } else if (kind === 'bag') {
        ctx.moveTo(cx - 8, y - 10 + dy);
        ctx.quadraticCurveTo(x - 10, y - 2 + dy, x - 8, cy + dy);
        ctx.quadraticCurveTo(x - 8, y + h + 10 + dy, cx, y + h + 10 + dy);
        ctx.quadraticCurveTo(x + w + 8, y + h + 10 + dy, x + w + 8, cy + dy);
        ctx.quadraticCurveTo(x + w + 10, y - 2 + dy, cx + 8, y - 10 + dy);
        ctx.closePath();
      } else if (kind === 'pot') {
        ctx.moveTo(x - 8, y - 4 + dy);
        ctx.lineTo(x + w + 8, y - 4 + dy);
        ctx.lineTo(x + w + 2, y + h + 8 + dy);
        ctx.lineTo(x - 2, y + h + 8 + dy);
        ctx.closePath();
      } else {
        // acorn, pear and persimmon: round
        ctx.ellipse(cx, cy + dy + 2, w / 2 + 10, h / 2 + 10, 0, 0, TAU);
      }
    };
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
    // what makes it what it is
    ctx.lineCap = 'round';
    if (kind === 'rock') {
      ctx.strokeStyle = shade;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      const a = x + w * (0.1 + 0.2 * R());
      ctx.moveTo(a, y - 4);
      ctx.lineTo(a + 6, y + 4);
      ctx.lineTo(a + 3, y + 10);
      const b = x + w * (0.7 + 0.2 * R());
      ctx.moveTo(b, y + h + 4);
      ctx.lineTo(b - 5, y + h - 3);
      ctx.stroke();
      ctx.fillStyle = shade;
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.arc(x + R() * w, k % 2 ? y - 3 : y + h + 3, 1.3, 0, TAU);
        ctx.fill();
      }
    } else if (kind === 'hail') {
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.min(w, h) / 2 + 4, Math.PI * 1.1, Math.PI * 1.4);
      ctx.stroke();
      ctx.fillStyle = 'rgba(169,199,221,0.5)';
      ctx.beginPath();
      ctx.arc(x + w - 4, y + h + 2, 3, 0, TAU);
      ctx.fill();
    } else if (kind === 'box') {
      ctx.fillStyle = shade;
      ctx.globalAlpha = 0.45;
      ctx.fillRect(cx - 10, y - 6, 20, 5);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = shade;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x - 6, y - 1);
      ctx.lineTo(x + w + 6, y - 1);
      ctx.moveTo(x + w - 4, y + h + 2);
      ctx.lineTo(x + w - 4, y + h - 4);
      ctx.moveTo(x + w - 7, y + h - 1);
      ctx.lineTo(x + w - 4, y + h - 4);
      ctx.lineTo(x + w - 1, y + h - 1);
      ctx.stroke();
    } else if (kind === 'bag') {
      // its knot
      ctx.fillStyle = fill;
      ctx.strokeStyle = line;
      ctx.lineWidth = lw * 0.8;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(cx + s * 7, y - 14, 6, 4, s * 0.6, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
      ctx.strokeStyle = shade;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - 2, y + h * 0.3);
      ctx.quadraticCurveTo(x + 4, y + h * 0.6, x + 2, y + h);
      ctx.stroke();
    } else if (kind === 'pot') {
      // its rim and the plant in it
      ctx.fillStyle = shade;
      ctx.fillRect(x - 10, y - 9, w + 20, 6);
      ctx.strokeStyle = line;
      ctx.lineWidth = lw * 0.8;
      ctx.strokeRect(x - 10, y - 9, w + 20, 6);
      ctx.fillStyle = '#9ED37E';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(cx + s * 7, y - 16, 7, 4, s * 0.7, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#FFFDF6';
      ctx.globalAlpha = 0.65;
      ctx.beginPath();
      rr(ctx, x + 2, y + 2, w - 4, h - 4, 8);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (kind === 'acorn') {
      ctx.fillStyle = '#A97E52';
      ctx.beginPath();
      ctx.ellipse(cx, y - 6, w / 2 + 4, 9, 0, Math.PI, TAU);
      ctx.fill();
      ctx.strokeStyle = line;
      ctx.lineWidth = lw * 0.8;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, y - 15);
      ctx.lineTo(cx + 2, y - 21);
      ctx.stroke();
    } else {
      // pear and persimmon: a stem and a leaf
      ctx.strokeStyle = '#7A5A3A';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, y - 7);
      ctx.lineTo(cx + 2, y - 14);
      ctx.stroke();
      ctx.fillStyle = kind === 'kaki' ? '#86B85F' : '#9ED37E';
      ctx.beginPath();
      if (kind === 'kaki') {
        for (let k = 0; k < 4; k++) {
          const a = -Math.PI / 2 + (k - 1.5) * 0.7;
          ctx.moveTo(cx, y - 6);
          ctx.ellipse(cx + Math.cos(a) * 9, y - 6 + Math.sin(a) * 4 + 4, 7, 3, a, 0, TAU);
        }
      } else {
        ctx.ellipse(cx + 9, y - 13, 8, 3.5, -0.5, 0, TAU);
      }
      ctx.fill();
      if (kind === 'pear') {
        ctx.fillStyle = shade;
        for (let k = 0; k < 6; k++) {
          ctx.beginPath();
          ctx.arc(x + R() * w, y + (k % 2 ? -4 : h + 4), 1, 0, TAU);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  // ---------- drawing, safely ----------

  function back(ctx, o) {
    const p = BY[o.place] || yama;
    const C = colOf(o.place, o.dark);
    ctx.save();
    try {
      if (o.style === 'climb') p.climb(ctx, o, C);
      else p.fall(ctx, o, C);
    } finally {
      ctx.restore();
    }
  }
  function ledge(ctx, o) {
    const p = BY[o.place] || yama;
    ctx.save();
    try {
      p.ledge(ctx, o, colOf(o.place, o.dark), o.pal || {});
    } finally {
      ctx.restore();
    }
  }
  function summit(ctx, o) {
    const p = BY[o.place] || yama;
    ctx.save();
    try {
      p.summit(ctx, o, colOf(o.place, o.dark), o.pal || {});
    } finally {
      ctx.restore();
    }
  }

  window.SpeakingWorld = { PLACES, forStage, layout, back, thing, colors, ledge, summit };
})();
