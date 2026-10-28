/*
 * Yaoki Typing's scenery (景色): the picture under the graph paper while a round runs.
 *
 * Twelve places in flat, cut-paper shapes: an old town, a bamboo grove, the sea, Mt Fuji,
 * a neon city, rice terraces, a snow country village, space, under the sea, a summer
 * festival, a train line and a castle town. Each is a few layers that slide past at their
 * own speed as the route moves (far hills slowly, the street nearly as fast as the cards),
 * a sky that changes as the round goes on, small things that move by themselves (clouds,
 * waves, lanterns, a train, smoke), the season's petals, fireflies, leaves or snow, and a
 * finishing touch as the round ends: the teacher's はなまる drawn round the sun or the
 * moon, and in some places more (Diamond Fuji, a snow daruma, the station called やおき).
 *
 * The game draws the graph paper, the route, Yaoki and the cards over it, so everything
 * here is pale and soft, a picture pasted into a notebook: it stays behind white cards and
 * a red daruma, and the band under the route, where the romaji is typed, is a flat tint.
 * With reduced motion a scene is one fixed frame.
 *
 * window.TypingScenes = { SCENES, forStage(key), draw(ctx, o) } (see the end of the file).
 * No images and no libraries: the world is cut into tiles, each made once from a seed and
 * kept as Path2D, so a place always looks the same and nothing is made per frame once its
 * tiles exist. draw() never throws: with anything odd it paints the plain ground.
 */
(function () {
  'use strict';

  const H = 240;
  const G = 168;                 // the route: every scene is built on this ground line
  const TAU = Math.PI * 2;
  const RING = 64;               // tiles kept per layer (a power of two)
  const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
  const DEFAULT = 'shitamachi';
  const UI = "'M PLUS Rounded 1c', 'Hiragino Maru Gothic ProN', 'Yu Gothic', sans-serif";
  const NONE = [];
  const FONT_SIGN = '800 8.5px ' + UI;
  const FONT_STALL = '700 8.5px ' + UI;
  const FONT_STATION = '800 11px ' + UI;
  const FONT_SMALL = '700 5px ' + UI;

  // ---------- seeded numbers: the same place every time ----------

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
  // Smooth value noise, 0..1, the same at the same x in every tile.
  function noise(seed, x) {
    const i = Math.floor(x);
    const f = x - i;
    const a = hash(seed, i);
    return a + (hash(seed, i + 1) - a) * f * f * (3 - 2 * f);
  }
  const hills = (seed, x, scale) => 0.68 * noise(seed, x / scale) + 0.32 * noise(seed + 101, x / (scale * 0.38));
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = (a, b, x) => {
    const k = clamp((x - a) / (b - a), 0, 1);
    return k * k * (3 - 2 * k);
  };
  const wrap = (v, m) => ((v % m) + m) % m;
  const lerp = (a, b, k) => a + (b - a) * k;
  const ease = (k) => 1 - Math.pow(1 - clamp(k, 0, 1), 3);

  // ---------- the frame being drawn (one object, reused) ----------

  const F = {
    W: 600, top: 0, bottom: H, scroll: 0, t: 0, p: 0, pj: 0.5, fin: 0, still: false, dark: false,
    season: 'spring', pal: null, S: null, C: null, A: null, K: null,
  };

  // ---------- shapes into a Path2D ----------

  function circ(p, x, y, r) {
    p.moveTo(x + r, y);
    p.arc(x, y, r, 0, TAU);
  }
  function ell(p, x, y, rx, ry) {
    p.moveTo(x + rx, y);
    p.ellipse(x, y, rx, ry, 0, 0, TAU);
  }
  function rr(p, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    p.moveTo(x + r, y);
    p.arcTo(x + w, y, x + w, y + h, r);
    p.arcTo(x + w, y + h, x, y + h, r);
    p.arcTo(x, y + h, x, y, r);
    p.arcTo(x, y, x + w, y, r);
    p.closePath();
  }
  function quad(p, x1, y1, x2, y2, x3, y3, x4, y4) {
    p.moveTo(x1, y1);
    p.lineTo(x2, y2);
    p.lineTo(x3, y3);
    p.lineTo(x4, y4);
    p.closePath();
  }
  function tri(p, x1, y1, x2, y2, x3, y3) {
    p.moveTo(x1, y1);
    p.lineTo(x2, y2);
    p.lineTo(x3, y3);
    p.closePath();
  }
  function line(p, x1, y1, x2, y2) {
    p.moveTo(x1, y1);
    p.lineTo(x2, y2);
  }
  // A narrow leaf from (x, y), pointing at angle ang.
  function leaf(p, x, y, len, ang, wid) {
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const mx = x + c * len * 0.45;
    const my = y + s * len * 0.45;
    p.moveTo(x, y);
    p.quadraticCurveTo(mx - s * wid, my + c * wid, x + c * len, y + s * len);
    p.quadraticCurveTo(mx + s * wid, my - c * wid, x, y);
    p.closePath();
  }
  // A continuous skyline of hills across a tile (the same height where two tiles meet;
  // drawn 1 unit into the next tile so no seam shows).
  function ridge(p, i, tw, seed, base, amp, scale, step) {
    const x0 = i * tw;
    p.moveTo(0, G + 2);
    for (let x = 0; x <= tw + 1; x += step) p.lineTo(x, base - amp * hills(seed, x0 + x, scale));
    p.lineTo(tw + 1, base - amp * hills(seed, x0 + tw + 1, scale));
    p.lineTo(tw + 1, G + 2);
    p.closePath();
  }
  const ridgeY = (i, tw, x, seed, base, amp, scale) => base - amp * hills(seed, i * tw + x, scale);
  // A flat-bottomed cut-paper cloud sitting on y.
  function cloud(p, x, y, w, R) {
    const h = w * 0.3;
    rr(p, x, y - h * 0.5, w, h * 0.5, h * 0.25);
    const n = 3 + Math.floor(R() * 2);
    for (let k = 0; k < n; k++) {
      const r = h * (0.38 + R() * 0.32) * (k === 1 ? 1.3 : 1);
      circ(p, x + w * (0.2 + (0.6 * (k + 0.5)) / n) + (R() - 0.5) * 6, y - r, r);
    }
  }

  // ---------- layers that repeat forever ----------

  // A layer is cut into tiles tw wide; a tile is made once from its own seed and kept as one
  // Path2D per colour (roles: a colour key, or [key, line width] for lines). Shapes may hang
  // up to m past their tile. items are things drawn per frame by anim (they move).
  function layer(seed, tw, m, roles, gen, anim) {
    const L = { seed, tw, m, gen, anim: anim || null, rc: [], rs: [], ring: new Array(RING) };
    for (const r of roles) {
      L.rc.push(typeof r === 'string' ? r : r[0]);
      L.rs.push(typeof r === 'string' ? 0 : r[1]);
    }
    return L;
  }
  function tileOf(L, i) {
    const slot = i & (RING - 1);
    const old = L.ring[slot];
    if (old && old.i === i) return old;
    const T = { i, p: [], items: [] };
    for (let r = 0; r < L.rc.length; r++) T.p.push(new Path2D());
    L.gen(T.p, rng(Math.floor(hash(L.seed, i) * 4294967296)), i, T.items, L.tw);
    L.ring[slot] = T;
    return T;
  }
  function drawLayer(ctx, L, off) {
    const C = F.C;
    const A = F.A;
    const tw = L.tw;
    const n = L.rc.length;
    const a = Math.floor((off - L.m) / tw);
    const b = Math.floor((off + F.W + L.m) / tw);
    for (let i = a; i <= b; i++) {
      const T = tileOf(L, i);
      const x = i * tw - off;
      ctx.translate(x, 0);
      for (let r = 0; r < n; r++) {
        const key = L.rc[r];
        const col = C[key];
        if (!col) continue;            // a colour a mode leaves out is not drawn
        ctx.globalAlpha = A[key] || 1;
        if (L.rs[r]) {
          ctx.lineWidth = L.rs[r];
          ctx.strokeStyle = col;
          ctx.stroke(T.p[r]);
        } else {
          ctx.fillStyle = col;
          ctx.fill(T.p[r]);
        }
      }
      ctx.globalAlpha = 1;
      if (L.anim && T.items.length) L.anim(ctx, T.items, x, L);
      ctx.translate(-x, 0);
    }
  }

  // ---------- paint, gradients and glows (made once per palette) ----------

  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function setFill(ctx, key) {
    const col = F.C[key];
    if (!col) return false;
    ctx.fillStyle = col;
    ctx.globalAlpha = F.A[key] || 1;
    return true;
  }
  function fillP(ctx, key, path) {
    if (setFill(ctx, key)) ctx.fill(path);
    ctx.globalAlpha = 1;
  }
  function skyFill(ctx, key, alpha) {
    const P = F.K;
    let g = P.grad[key];
    if (!g) {
      const stops = P.stops[key];
      if (!stops) return;
      g = ctx.createLinearGradient(0, 0, 0, G);
      for (let k = 0; k < stops.length; k++) g.addColorStop(k / (stops.length - 1), stops[k]);
      P.grad[key] = g;
    }
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.fillStyle = g;
    ctx.fillRect(-1, F.top - 1, F.W + 2, G - F.top + 3);
    ctx.globalAlpha = 1;
  }
  // A soft round glow of colour key, made once at radius 1 and scaled.
  function glow(ctx, x, y, r, key, alpha) {
    const P = F.K;
    let g = P.glow[key];
    if (g === undefined) {
      const col = F.C[key];
      if (!col || col[0] !== '#') {
        P.glow[key] = null;
        return;
      }
      g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, rgba(col, 1));
      g.addColorStop(0.35, rgba(col, 0.55));
      g.addColorStop(1, rgba(col, 0));
      P.glow[key] = g;
    }
    if (!g || r <= 0) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(r, r);
    ctx.globalAlpha = (F.A[key] || 1) * alpha;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  function ground(ctx, edge) {
    ctx.fillStyle = F.C.ground;
    ctx.fillRect(-1, G, F.W + 2, F.bottom - G + 1);
    if (edge && F.C[edge]) {
      ctx.fillStyle = F.C[edge];
      ctx.fillRect(-1, G, F.W + 2, 5);
    }
  }
  function rect(ctx, key, x, y, w, h) {
    if (!setFill(ctx, key)) return;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
  }

  // A beam of light from (x, y) towards dir (1 right, -1 left), fading with distance.
  function glowWedge(ctx, x, y, dir, len, half, key) {
    glow(ctx, 0, 0, 0, key, 0);   // makes the gradient
    const g = F.K.glow[key];
    if (!g) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(len * dir, len);
    ctx.globalAlpha = F.A[key] || 1;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -0.01);
    ctx.lineTo(1, -half / len);
    ctx.lineTo(1, half / len);
    ctx.lineTo(0, 0.01);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ---------- unit drawings, made on the first frame ----------

  const U = {};
  function hanamaruPath(R, n) {
    const p = new Path2D();
    const step = TAU / n;
    const a = R * Math.sin(step / 2);
    for (let i = 0; i < n; i++) {
      const t0 = i * step - Math.PI / 2;
      const t1 = t0 + step;
      if (!i) p.moveTo(R * Math.cos(t0), R * Math.sin(t0));
      // each scallop is a half circle on the chord between two points of the ring
      const mx = (R * Math.cos(t0) + R * Math.cos(t1)) / 2;
      const my = (R * Math.sin(t0) + R * Math.sin(t1)) / 2;
      const ang = Math.atan2(R * Math.sin(t0) - my, R * Math.cos(t0) - mx);
      p.arc(mx, my, a, ang, ang + Math.PI, false);
    }
    p.closePath();
    return p;
  }
  // Fuji at unit size: base 2 wide, about 0.52 high; its snow cap; the shaded east side.
  function fujiPaths() {
    const bez = (p0, c, p1, s) => (1 - s) * (1 - s) * p0 + 2 * (1 - s) * s * c + s * s * p1;
    const L = [-1, 0.02, -0.42, -0.14, -0.12, -0.5];
    const body = new Path2D();
    body.moveTo(-1, 0.02);
    body.quadraticCurveTo(-0.42, -0.14, -0.12, -0.5);
    body.lineTo(-0.06, -0.515);
    body.lineTo(-0.02, -0.502);
    body.lineTo(0.03, -0.516);
    body.lineTo(0.12, -0.5);
    body.quadraticCurveTo(0.42, -0.14, 1, 0.02);
    body.closePath();
    const shade = new Path2D();
    shade.moveTo(0.03, -0.516);
    shade.lineTo(0.12, -0.5);
    shade.quadraticCurveTo(0.42, -0.14, 1, 0.02);
    shade.lineTo(0.3, 0.02);
    shade.quadraticCurveTo(0.12, -0.2, 0.03, -0.516);
    shade.closePath();
    const cap = (from) => {
      const p = new Path2D();
      const n = 12;
      p.moveTo(bez(L[0], L[2], L[4], from), bez(L[1], L[3], L[5], from));
      for (let k = 1; k <= n; k++) {
        const s = from + ((1 - from) * k) / n;
        p.lineTo(bez(L[0], L[2], L[4], s), bez(L[1], L[3], L[5], s));
      }
      p.lineTo(-0.06, -0.515);
      p.lineTo(-0.02, -0.502);
      p.lineTo(0.03, -0.516);
      for (let k = 0; k <= n; k++) {
        const s = 1 - ((1 - from) * k) / n;
        p.lineTo(-bez(L[0], L[2], L[4], s), bez(L[1], L[3], L[5], s));
      }
      // the ragged hem: gullies of snow reaching down
      const xr = -bez(L[0], L[2], L[4], from);
      const xl = bez(L[0], L[2], L[4], from);
      const y = bez(L[1], L[3], L[5], from);
      // streaks of snow of different lengths down the gullies
      const n2 = 9;
      const w = (xl - xr) / n2;
      for (let k = 0; k < n2; k++) {
        const x = xr + k * w;
        const deep = 0.03 + 0.08 * hash(k, 77) * (1 - Math.abs(k - (n2 - 1) / 2) / n2);
        const notch = -0.012 - 0.018 * hash(k, 78);
        const tip = x + w * (0.4 + 0.2 * hash(k, 79));
        p.lineTo(x + w * 0.18, y + notch);
        p.quadraticCurveTo(tip - w * 0.12, y + deep * 0.5, tip, y + deep);
        p.quadraticCurveTo(tip + w * 0.1, y + deep * 0.4, x + w * 0.85, y + notch * 0.6);
      }
      p.closePath();
      return p;
    };
    return { body, shade, cap: cap(0.66), capWinter: cap(0.5) };
  }
  function init() {
    U.hana = hanamaruPath(20, 9);
    U.hanaLen = 9 * Math.PI * 20 * Math.sin(Math.PI / 9);
    U.hanaDash = [U.hanaLen + 2, U.hanaLen + 2];
    U.dots = [0.01, 6.2];
    U.fuji = fujiPaths();
    // a maple leaf (紅葉): five lobes, the lower two smaller, and its stalk
    U.maple = new Path2D();
    const lobes = [[-90, 1], [-62, 0.36], [-32, 0.92], [-3, 0.34], [24, 0.64], [90, 0.26], [156, 0.64], [183, 0.34], [212, 0.92], [242, 0.36]];
    lobes.forEach(([deg, r], k) => {
      const a = (deg * Math.PI) / 180;
      if (!k) U.maple.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else U.maple.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    });
    U.maple.closePath();
    U.maple.rect(-0.06, 0.2, 0.12, 0.62);
    U.fish = new Path2D('M-.5 0Q-.1-.34 .3-.05L.52-.25 .46 0 .52.25 .3.05Q-.1.34-.5 0Z');
    U.fishBelly = new Path2D('M-.44 .05Q-.1.24 .26.05Q-.1.12-.44.05Z');
    U.hull = new Path2D('M-11 0H11L7.5 3.5H-8Z');
    U.sail = new Path2D('M0-1V-17L9-2Z');
    U.jib = new Path2D('M-1.5-1V-13L-8-2Z');
    // a paper lantern hanging from (0, 0)
    U.lantern = new Path2D();
    ell(U.lantern, 0, 9.5, 5.6, 7);
    U.lanternCap = new Path2D();
    rr(U.lanternCap, -3.2, 0.6, 6.4, 2.4, 0.8);
    rr(U.lanternCap, -3.2, 16.4, 6.4, 2.4, 0.8);
    U.lanternRib = new Path2D();
    for (const y of [5.5, 9.5, 13.5]) {
      const hw = 5.6 * Math.sqrt(1 - Math.pow((y - 9.5) / 7, 2));
      line(U.lanternRib, -hw + 0.6, y, hw - 0.6, y);
    }
    U.ready = true;
  }

  // ---------- sky things ----------

  // The sun (by day) or the moon (by night), and at the end of the round the teacher's
  // はなまる drawn round it, a stroke at a time.
  function celestial(ctx, x, y, r) {
    if (F.dark) {
      glow(ctx, x, y, r * 3.2, 'moonGlow', 1);
      ctx.fillStyle = F.C.moon;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = F.C.moonShade;
      ctx.beginPath();
      ctx.arc(x - r * 0.3, y - r * 0.2, r * 0.22, 0, TAU);
      ctx.arc(x + r * 0.32, y + r * 0.25, r * 0.15, 0, TAU);
      ctx.moveTo(x + r * 0.15 + r * 0.1, y - r * 0.42);
      ctx.arc(x + r * 0.15, y - r * 0.42, r * 0.1, 0, TAU);
      ctx.fill();
    } else {
      glow(ctx, x, y, r * 3.4, 'sunGlow', 1);
      ctx.fillStyle = F.C.sun;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }
  }
  function hanamaru(ctx, x, y, r, k) {
    if (k <= 0) return;
    // the scallops reach about 1.3 r from the centre: keep them inside the top of the scene
    r = Math.max(8, Math.min(r, (y - F.top - 2) / 1.3));
    const s = r / 20;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.16);
    ctx.scale(s, s);
    ctx.lineWidth = 2.2 / s;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = (F.pal && F.pal.stamp) || '#C7361E';
    ctx.globalAlpha = F.dark ? 0.6 : 0.5;
    ctx.setLineDash(U.hanaDash);
    ctx.lineDashOffset = (U.hanaLen + 2) * (1 - k);
    ctx.stroke(U.hana);
    ctx.restore();
  }
  // Stars that twinkle (a few of them) on a layer that hardly moves.
  function starLayer(seed, n, y0, y1) {
    return layer(seed, 300, 6, ['star', 'star2'], (P, R, i, items) => {
      for (let k = 0; k < n; k++) {
        const x = R() * 300;
        const y = y0 + Math.pow(R(), 1.4) * (y1 - y0);
        const r = 0.5 + R() * 0.8;
        if (R() < 0.22) items.push({ x, y, r: r + 0.3, ph: R() * TAU, sp: 0.8 + R() * 1.6 });
        else circ(P[R() < 0.8 ? 0 : 1], x, y, r);
      }
    }, (ctx, items) => {
      if (!setFill(ctx, 'star')) return;
      const a = ctx.globalAlpha;
      for (let q = 0; q < items.length; q++) {
        const s = items[q];
        ctx.globalAlpha = a * (0.35 + 0.65 * Math.abs(Math.sin(F.t * s.sp + s.ph)));
        ctx.beginPath();
        ctx.moveTo(s.x, s.y - s.r * 2.6);
        ctx.quadraticCurveTo(s.x, s.y, s.x + s.r * 2.6, s.y);
        ctx.quadraticCurveTo(s.x, s.y, s.x, s.y + s.r * 2.6);
        ctx.quadraticCurveTo(s.x, s.y, s.x - s.r * 2.6, s.y);
        ctx.quadraticCurveTo(s.x, s.y, s.x, s.y - s.r * 2.6);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    });
  }
  function cloudLayer(seed, tw, y0, y1, w0, w1) {
    return layer(seed, tw, w1 + 10, ['cloud'], (P, R) => {
      const n = R() < 0.55 ? 1 : 2;
      for (let k = 0; k < n; k++) cloud(P[0], ((k + R() * 0.8) * tw) / n, y0 + R() * (y1 - y0), w0 + R() * (w1 - w0), R);
    });
  }
  // A flight of birds (gulls or cranes) that crosses the sky on its own.
  function birds(ctx, key, n, speed, period, y, size, seed) {
    if (!F.C[key]) return;
    const span = F.W + 200;
    const base = wrap(-F.t * speed - F.scroll * 0.25 + hash(seed, 1) * span, span) - 100;
    ctx.strokeStyle = F.C[key];
    ctx.globalAlpha = F.A[key] || 1;
    ctx.lineWidth = size > 1.4 ? 1.6 : 1.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let k = 0; k < n; k++) {
      const bx = base + k * 14 * size + (k % 2) * 4;
      const by = y + (k % 2 ? 6 : -2) * size + Math.sin(F.t * 0.7 + k) * 2;
      const flap = Math.sin(F.t * period + k * 1.7) * 2.4 * size;
      const w = 6 * size;
      ctx.moveTo(bx - w, by - flap);
      ctx.quadraticCurveTo(bx - w * 0.45, by - 2.6 * size - flap * 0.3, bx, by);
      ctx.quadraticCurveTo(bx + w * 0.45, by - 2.6 * size - flap * 0.3, bx + w, by - flap);
      if (size > 1.4) {
        // a crane: long neck forward (to the left) and legs trailing
        ctx.moveTo(bx, by);
        ctx.lineTo(bx - w * 0.9, by + 1);
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + w * 1.1, by + 1.6);
      }
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // ---------- the season's particles: at most 20, small, slow and faint ----------

  function seasonal(ctx, scale) {
    const k = scale === undefined ? 1 : scale;
    switch (F.season) {
      case 'spring': return particles(ctx, 'petal', Math.round(14 * k));
      case 'summer': return F.dark ? particles(ctx, 'fly', Math.round(14 * k)) : particles(ctx, 'dfly', Math.round(4 * k));
      case 'autumn': return particles(ctx, 'leaf', Math.round(11 * k));
      default: return particles(ctx, 'snow', Math.round(20 * k));
    }
  }
  function particles(ctx, kind, n) {
    const C = F.C;
    const A = F.A;
    const t = F.t;
    const span = F.W + 80;
    const par = F.scroll * 0.5;
    const yTop = Math.max(F.top, -40);
    const yBot = G - 4;
    const hh = yBot - yTop;
    n = Math.min(n, 20);
    for (let k = 0; k < n; k++) {
      const a = hash(k, 501);
      const b = hash(k, 502);
      const c = hash(k, 503);
      if (kind === 'fly' || kind === 'dfly') {
        // fireflies wander low over the grass; dragonflies dart and hover higher up
        const fly = kind === 'fly';
        const x = wrap(a * span - par * 0.6 + Math.sin(t * (0.21 + 0.1 * c) + a * 9) * 40 + (fly ? 0 : t * 6 * (c - 0.5)), span) - 40;
        const y = fly ? 92 + b * 70 + Math.sin(t * (0.5 + c * 0.4) + b * 7) * 8 : 36 + b * 80 + Math.sin(t * 0.9 + b * 5) * 6;
        if (fly) {
          const pulse = Math.pow(0.5 + 0.5 * Math.sin(t * (1.4 + c) + a * 20), 2);
          ctx.fillStyle = C.fly;
          ctx.globalAlpha = (A.fly || 0.5) * pulse * 0.35;
          ctx.beginPath();
          ctx.arc(x, y, 3.6, 0, TAU);
          ctx.fill();
          ctx.globalAlpha = (A.fly || 0.5) * (0.25 + 0.75 * pulse);
          ctx.beginPath();
          ctx.arc(x, y, 1.1, 0, TAU);
          ctx.fill();
        } else {
          const ang = Math.sin(t * 0.5 + a * 11) * 0.5 + (c > 0.5 ? Math.PI : 0);
          dragonfly(ctx, x, y, ang, C.dfly, A.dfly || 0.45);
        }
        continue;
      }
      if (kind === 'bubble') {
        const x = wrap(a * span - par * 0.4, span) - 40 + Math.sin(t * (1 + c) + a * 30) * 3;
        const y = yBot - wrap(b * hh + t * (8 + 8 * c), hh);
        const r = 1.2 + c * 2.4;
        ctx.strokeStyle = C.bubble;
        ctx.globalAlpha = (A.bubble || 0.5) * smooth(yTop + 4, yTop + 30, y) * smooth(yBot, yBot - 10, y);
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.stroke();
        continue;
      }
      const snow = kind === 'snow';
      const vy = snow ? 6 + 6 * c : kind === 'leaf' ? 8 + 5 * c : 7 + 6 * c;
      const vx = snow ? -2 - 2 * c : -5 - 5 * c;
      const y = yTop + wrap(b * hh + t * vy, hh);
      const x = wrap(a * span + t * vx - par, span) - 40 + Math.sin(t * (0.5 + c) + a * 20) * (snow ? 5 : 9);
      const fade = smooth(yTop, yTop + 14, y) * smooth(yBot, yBot - 18, y);
      if (snow) {
        ctx.fillStyle = C.snow;
        ctx.globalAlpha = (A.snow || 0.5) * fade;
        ctx.beginPath();
        ctx.arc(x, y, 0.9 + c * 1.3, 0, TAU);
        ctx.fill();
      } else if (kind === 'petal') {
        ctx.fillStyle = C.petal;
        ctx.globalAlpha = (A.petal || 0.5) * fade;
        ctx.beginPath();
        ctx.ellipse(x, y, 2.6, 1.5 + Math.sin(t * 2 + a * 9) * 0.5, t * (0.6 + c) + a * 6, 0, TAU);
        ctx.fill();
      } else {
        const key = c < 0.34 ? 'leaf1' : c < 0.67 ? 'leaf2' : 'leaf3';
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t * (0.5 + c * 0.6) + a * 6);
        ctx.scale(3.6, 3.6 * (0.6 + 0.4 * Math.abs(Math.sin(t * 1.3 + b * 8))));
        ctx.fillStyle = C[key];
        ctx.globalAlpha = (A[key] || 0.45) * fade;
        ctx.fill(U.maple);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }
  function dragonfly(ctx, x, y, ang, col, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.globalAlpha = alpha * 0.7;
    ctx.fillStyle = col;
    const flick = 0.7 + 0.3 * Math.abs(Math.sin(F.t * 30 + x));
    ctx.beginPath();
    ctx.ellipse(-1, -3 * flick, 1.3, 3.4 * flick, -0.25, 0, TAU);
    ctx.ellipse(-1, 3 * flick, 1.3, 3.4 * flick, 0.25, 0, TAU);
    ctx.ellipse(1.6, -2.6 * flick, 1.1, 2.8 * flick, 0.3, 0, TAU);
    ctx.ellipse(1.6, 2.6 * flick, 1.1, 2.8 * flick, -0.3, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = alpha;
    ctx.fillRect(-3, -0.6, 10, 1.2);
    ctx.beginPath();
    ctx.arc(-3.4, 0, 1.2, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // ---------- Fuji, used by several places ----------

  function fuji(ctx, cx, base, hw) {
    ctx.save();
    ctx.translate(cx, base);
    ctx.scale(hw, hw);
    fillP(ctx, 'fuji', U.fuji.body);
    fillP(ctx, 'fujiShade', U.fuji.shade);
    fillP(ctx, 'cap', F.season === 'winter' ? U.fuji.capWinter : U.fuji.cap);
    ctx.restore();
  }

  // ---------- the scenes ----------

  // Colours shared by every scene, under its own.
  const BASE = {
    light: {
      sun: '#FCE7C9', sunGlow: ['#FFF1D8', 0.9], moon: '#F3EEDF', moonShade: '#E6DEC8', moonGlow: ['#FFFFFF', 0.5],
      star: ['#B9B4DA', 0.7], star2: ['#E8CF8E', 0.6], cloud: ['#FFFFFF', 0.72],
      petal: ['#EFAFC4', 0.5], leaf1: ['#E9A97E', 0.48], leaf2: ['#E3BD6E', 0.48], leaf3: ['#DD9886', 0.45],
      snow: ['#FFFFFF', 0.5], fly: ['#E3EC8C', 0.5], dfly: ['#8FA5C2', 0.45], bubble: ['#FFFFFF', 0.5],
    },
    dark: {
      sun: '#E9E1C8', sunGlow: ['#8E9CD0', 0.22], moon: '#E4DCC4', moonShade: '#CFC6AC', moonGlow: ['#8C9BD6', 0.24],
      star: ['#E8EBF6', 0.72], star2: ['#F2D9A0', 0.6], cloud: ['#222B47', 0.7],
      petal: ['#D7A0B6', 0.42], leaf1: ['#C9875F', 0.42], leaf2: ['#C7A25A', 0.42], leaf3: ['#B97A6C', 0.4],
      snow: ['#E8EDF8', 0.45], fly: ['#E9F59A', 0.5], dfly: ['#6E7FA6', 0.4], bubble: ['#8FD1E0', 0.32],
    },
  };

  const DEFS = [];
  const scene = (d) => DEFS.push(d);

  // ----- 下町: the old town, tiled roofs and noren under power lines, Fuji far away -----
  scene({
    id: 'shitamachi', ja: '下町', en: 'Old town', stillT: 18,
    sky: { light: ['#D8E5F3', '#E8EEF3', '#F6EFE2'], dark: ['#0D1326', '#131A31', '#1B2340'] },
    light: {
      fuji: '#CBD6E9', fujiShade: '#C2CDE3', cap: '#F3F6FB', far: '#D7DEEB', chimney: '#CDD5E5',
      wall: '#EAE4D8', wood: '#DDD1BD', roof: '#C0CADC', roofLine: '#B3BDD1', win: '#D6DFEC', winOff: '#D6DFEC',
      noren: '#C7D2EA', noren2: '#E8D3C9', woodLine: ['#CDBFA8', 0.8], plant: '#C3D5BD', vend: '#D4E0EF', vendLit: '#F2EFE4',
      pole: '#C0C8D7', wire: '#B4BCCD', ground: '#F0EFE9',
    },
    dark: {
      fuji: '#19213B', fujiShade: '#161D35', cap: '#2A3454', far: '#121830', chimney: '#141A32',
      wall: '#171D33', wood: '#131A2D', roof: '#10162A', roofLine: '#1D2540', win: ['#F0C46B', 0.4], winOff: '#1D2440',
      noren: '#27325C', noren2: '#3B2C40', woodLine: '#1D2439', plant: '#15233A', vend: '#1D2B47', vendLit: ['#BFE6F2', 0.5],
      pole: '#0D1226', wire: '#2A3250', ground: '#141A2D', blink: ['#F0C46B', 0.4],
    },
    make() {
      return {
        stars: starLayer(11, 9, -60, 110),
        cloud: cloudLayer(12, 420, 26, 70, 46, 96),
        far: layer(13, 252, 40, ['far', 'chimney'], (P, R, i) => {
          for (let k = 0; k < 9; k++) {
            const g = i * 9 + k;
            const x = k * 28;
            const h = 16 + hash(13, g) * 22;
            P[0].rect(x, G - h, 28.6, h + 2);
            if (hash(14, g) < 0.6) tri(P[0], x - 3, G - h + 0.5, x + 14, G - h - 8, x + 31, G - h + 0.5);
            // now and then the tall chimney of a public bath (銭湯)
            if (hash(15, g) < 0.07) P[1].rect(x + 12, G - h - 44, 4.5, 46);
          }
        }),
        street: layer(14, 240, 16, ['wall', 'wood', 'roof', 'win', 'winOff', 'noren', 'noren2', 'plant', 'vend', 'vendLit', ['roofLine', 0.8], ['woodLine', 1]],
          (P, R, i, items, tw) => {
            let x = 4;
            while (x < tw - 44) {
              let w = 58 + R() * 46;
              if (x + w > tw - 4 || tw - 4 - (x + w) < 44) w = tw - 4 - x;
              machiya(P, R, x, w, items);
              x += w + 4;
            }
          }, (ctx, items) => {
            // by night a window or two goes on and off
            if (!F.dark || !setFill(ctx, 'blink')) return;
            for (let q = 0; q < items.length; q++) {
              const it = items[q];
              if (hash(it.s, Math.floor(F.t / it.per)) < 0.5) ctx.fillRect(it.x, it.y, it.w, it.h);
            }
            ctx.globalAlpha = 1;
          }),
        poles: layer(15, 300, 300, ['pole', ['wire', 0.8]], (P, R, i, items, tw) => {
          const px = (j) => 40 + hash(15, j) * 200;
          const x = px(i);
          const nx = tw + px(i + 1);
          P[0].rect(x - 2.2, 34, 4.4, G - 32);
          P[0].rect(x - 15, 44, 30, 2.6);
          if (hash(16, i) < 0.4) rr(P[0], x + 3, 58, 8, 11, 2);
          for (const dx of [-13, 0, 13]) {
            P[1].moveTo(x + dx, 45);
            P[1].quadraticCurveTo((x + nx) / 2 + dx, 45 + 26, nx + dx, 45);
          }
        }),
      };
    },
    paint(ctx, f, L) {
      skyFill(ctx, 'sky');
      if (f.dark) drawLayer(ctx, L.stars, f.scroll * 0.02);
      const sx = f.W * (0.24 + 0.52 * f.pj);
      const sy = 56 - 30 * Math.sin(Math.PI * f.pj);
      celestial(ctx, sx, sy, 13);
      fuji(ctx, f.W * (0.76 - 0.1 * f.pj), 150, Math.min(240, f.W * 0.2) * (1 + 0.3 * f.pj));
      drawLayer(ctx, L.cloud, f.scroll * 0.05 + f.t * 2.5);
      drawLayer(ctx, L.far, f.scroll * 0.18);
      drawLayer(ctx, L.street, f.scroll * 0.45);
      drawLayer(ctx, L.poles, f.scroll * 0.95);
      ground(ctx);
      seasonal(ctx);
      hanamaru(ctx, sx, sy, 22, f.fin);
    },
  });
  // A machiya: two storeys (or one), a tiled roof and a lower eave, a slatted window above,
  // a lattice and a door with noren below; sometimes a vending machine or a potted plant.
  function machiya(P, R, x, w, items) {
    const two = R() < 0.75;
    const h = two ? 52 + R() * 22 : 36 + R() * 6;
    const top = G - h;
    P[0].rect(x, top + 8, w, h - 6);
    quad(P[2], x - 4, top + 10, x + w + 4, top + 10, x + w - 3, top, x + 3, top);
    P[2].rect(x + 3, top - 2.5, w - 6, 3);
    for (let k = x; k < x + w; k += 4) line(P[10], k, top + 1, k - 0.6, top + 9.5);
    let floor = top + 12;
    if (two) {
      const ye = G - 34;
      quad(P[2], x - 5, ye + 7, x + w + 5, ye + 7, x + w, ye, x, ye);
      for (let k = x; k < x + w; k += 4) line(P[10], k, ye + 1, k - 0.6, ye + 6.5);
      const wx = x + w * 0.18;
      const ww = w * 0.64;
      const wy = top + 16;
      const wh = Math.max(8, ye - wy - 5);
      P[R() < 0.7 ? 3 : 4].rect(wx, wy, ww, wh);
      for (let k = wx + 3; k < wx + ww; k += 3.2) line(P[11], k, wy, k, wy + wh);
      if (R() < 0.6) items.push({ x: wx, y: wy, w: ww, h: wh, s: Math.floor(R() * 1e6), per: 5 + R() * 9 });
      floor = ye + 7;
    }
    const dw = 18 + R() * 5;
    const dx = x + 6 + R() * (w * 0.5 - 12);
    P[1].rect(dx, floor + 4, dw, G - floor - 2);
    const nk = R() < 0.6 ? 5 : 6;
    for (let k = 0; k < 3; k++) P[nk].rect(dx - 1 + (k * (dw + 2)) / 3, floor + 3, (dw + 2) / 3 - 0.9, 13);
    const lx = dx + dw + 6;
    const lw = x + w - 6 - lx;
    if (lw > 12) {
      P[1].rect(lx, floor + 7, lw, G - floor - 13);
      for (let k = lx + 2.5; k < lx + lw; k += 3) line(P[11], k, floor + 7, k, G - 6);
    }
    if (R() < 0.22 && w > 70) {
      const vx = x + w - 16;
      rr(P[8], vx, G - 31, 13, 32, 1.5);
      P[9].rect(vx + 2, G - 28, 9, 11);
    } else if (R() < 0.5) {
      const px = dx - 9;
      P[1].rect(px - 3, G - 6, 6, 7);
      circ(P[7], px, G - 10, 5);
      circ(P[7], px + 3, G - 14, 3.5);
    }
  }

  // ----- 竹林: a bamboo grove, light falling between the stalks -----
  scene({
    id: 'chikurin', ja: '竹林', en: 'Bamboo grove', stillT: 6,
    sky: { light: ['#E5EFE3', '#ECF2E8', '#F3F4EA'], dark: ['#0C1622', '#0F1D27', '#12222B'] },
    light: {
      b1: '#D7E5D3', n1: '#CCDCC8', l1: '#D0E0CB', b2: '#C8DBC3', n2: '#B9CFB4', l2: '#C2D7BC',
      b3: '#BCD2B6', n3: '#AAC4A4', l3: '#B6CEB0', shaft: ['#FFFFFF', 0.45], glowGold: ['#F7DE8C', 0.75], gold: '#EBD9A0',
      ground: '#EDF0E6', groundEdge: '#E2E8D8',
    },
    dark: {
      b1: '#1A2C33', n1: '#20343A', l1: '#1A2D31', b2: '#15262D', n2: '#1D3238', l2: '#16292D',
      b3: '#0E1B21', n3: '#16282D', l3: '#0F1E23', shaft: ['#A8D8CF', 0.07], glowGold: ['#F4D27A', 0.6], gold: '#8C7E4E',
      ground: '#111A23', groundEdge: '#13202A',
    },
    make() {
      const grove = (seed, tw, n, w, bk, nk, lk, lean, leafy) => layer(seed, tw, 40, [bk, nk, lk], (P, R) => {
        for (let k = 0; k < n; k++) {
          if (R() < 0.15) continue;
          stalk(P, R, ((k + 0.2 + R() * 0.6) * tw) / n, w * (0.85 + R() * 0.3), (R() - 0.5) * lean, leafy);
        }
      });
      return {
        stars: starLayer(21, 6, -60, 60),
        b1: grove(22, 150, 5, 3.4, 'b1', 'n1', 'l1', 10, 0.9),
        shafts: layer(23, 260, 160, [], (P, R, i, items) => {
          items.push({ x: R() * 260, w: 14 + R() * 16, ph: R() * TAU });
        }, (ctx, items) => {
          if (!F.C.shaft) return;
          ctx.fillStyle = F.C.shaft;
          for (let q = 0; q < items.length; q++) {
            const s = items[q];
            ctx.globalAlpha = F.A.shaft * (0.55 + 0.45 * Math.sin(F.t * 0.35 + s.ph));
            ctx.beginPath();
            ctx.moveTo(s.x, F.top - 4);
            ctx.lineTo(s.x + s.w, F.top - 4);
            ctx.lineTo(s.x + s.w * 2.4 + 70, G);
            ctx.lineTo(s.x + 70, G);
            ctx.closePath();
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        }),
        b2: grove(24, 170, 3, 7, 'b2', 'n2', 'l2', 14, 0.7),
        b3: grove(25, 300, 1, 12, 'b3', 'n3', 'l3', 18, 0.5),
      };
    },
    paint(ctx, f, L) {
      skyFill(ctx, 'sky');
      if (f.dark) drawLayer(ctx, L.stars, f.scroll * 0.02);
      const sx = f.W * (0.3 + 0.45 * f.pj);
      const sy = 30 - 10 * Math.sin(Math.PI * f.pj);
      celestial(ctx, sx, sy, 12);
      drawLayer(ctx, L.b1, f.scroll * 0.12);
      drawLayer(ctx, L.shafts, f.scroll * 0.25);
      drawLayer(ctx, L.b2, f.scroll * 0.42);
      // the finishing touch: one stalk that glows from inside, as in the tale of Kaguya-hime
      if (f.fin > 0) {
        const kx = f.W * (1.06 - 0.24 * f.fin);
        glow(ctx, kx, 134, 34, 'glowGold', f.fin);
        rect(ctx, 'b2', kx - 3.6, F.top - 2, 7.2, G - F.top + 3);
        rect(ctx, 'n2', kx - 4, 102, 8, 1.6);
        rect(ctx, 'gold', kx - 3.4, 104, 6.8, 40);
        glow(ctx, kx, 124, 12, 'glowGold', f.fin);
      }
      drawLayer(ctx, L.b3, f.scroll * 0.95);
      ground(ctx, 'groundEdge');
      seasonal(ctx);
      hanamaru(ctx, sx, sy, 21, f.fin);
    },
  });
  // A bamboo stalk from the ground up out of the picture, with its rings and sprays of leaves.
  function stalk(P, R, x, w, lean, leafy) {
    const top = -100;
    const at = (y) => x + (lean * (G - y)) / (G - top);
    P[0].moveTo(x - w / 2, G + 1);
    P[0].lineTo(at(top) - w * 0.42, top);
    P[0].lineTo(at(top) + w * 0.42, top);
    P[0].lineTo(x + w / 2, G + 1);
    P[0].closePath();
    let y = G - 14 - R() * 22;
    while (y > top + 8) {
      const cx = at(y);
      P[1].rect(cx - w * 0.6, y, w * 1.2, Math.max(1.2, w * 0.18));
      if (y < 70 && R() < leafy) {
        const side = R() < 0.5 ? -1 : 1;
        const n = 3 + Math.floor(R() * 3);
        for (let k = 0; k < n; k++) {
          const ang = (side > 0 ? 0.35 : Math.PI - 0.35) + side * (k * 0.32 - 0.2) + (R() - 0.5) * 0.3;
          leaf(P[2], cx + side * w * 0.4, y + 1, 9 + R() * 7 + w * 0.6, ang, 1.4 + w * 0.12);
        }
      }
      y -= 24 + R() * 14;
    }
  }

  // ----- 海: the sea, Hokusai's waves, sails and gulls, a lighthouse ahead -----
  const HZ = 114;   // the sea's horizon
  scene({
    id: 'umi', ja: '海', en: 'The sea', stillT: 9,
    sky: { light: ['#D5EAF3', '#E5F0F2', '#F7F0E2'], dark: ['#0B1226', '#111A33', '#19243F'] },
    light: {
      sea: '#CDE2EC', seaFar: '#D9EAF0', foamNear: ['#EDF5F8', 0.9], island: '#CCDAE6', wave: '#BCD5E4', waveIn: '#C8DEEA', waveLine: ['#F5FAFC', 0.8],
      swell: '#C3DAE7', foam: '#F4F9FB', spray: ['#FFFFFF', 0.8], hull: '#C6D1E1', sail: '#FAF6EC', gull: ['#8E9DB8', 0.7],
      lh: '#F6F4EF', lhBand: '#EEC9BE', lhRoof: '#C3CDDF', glint: ['#FFFFFF', 0.7], ground: '#F3EEE1', groundEdge: '#E9E1CF',
    },
    dark: {
      sea: '#101A31', seaFar: '#141F38', island: '#121A30', wave: '#17223D', waveIn: '#1A2643', waveLine: ['#3A4A72', 0.6],
      swell: '#152039', foam: '#2E3C60', spray: ['#3A4A72', 0.6], hull: '#1A2238', sail: '#2C3656', gull: ['#4A5678', 0.7],
      lh: '#2B3556', lhBand: '#3E3550', lhRoof: '#1A2240', beam: ['#FFE7A8', 0.35], lamp: ['#FFE3A0', 0.9], glint: ['#E8DFC4', 0.45], foamNear: ['#26334F', 0.9],
      ground: '#141A2C', groundEdge: '#171E33',
    },
    make() {
      return {
        stars: starLayer(31, 9, -60, 100),
        cloud: cloudLayer(32, 460, 30, 76, 50, 110),
        islands: layer(33, 520, 120, ['island'], (P, R) => {
          if (R() < 0.6) {
            const x = R() * 400;
            const w = 40 + R() * 90;
            P[0].moveTo(x, HZ + 1);
            P[0].quadraticCurveTo(x + w * 0.3, HZ - 8 - R() * 8, x + w * 0.55, HZ - 6);
            P[0].quadraticCurveTo(x + w * 0.8, HZ - 4, x + w, HZ + 1);
            P[0].closePath();
          }
        }),
        boats: layer(34, 380, 30, [], (P, R, i, items) => {
          if (R() < 0.7) items.push({ x: R() * 380, y: HZ + 6 + R() * 8, s: 0.55 + R() * 0.25, ph: R() * TAU });
        }, (ctx, items) => {
          for (let q = 0; q < items.length; q++) {
            const b = items[q];
            ctx.save();
            ctx.translate(b.x, b.y + Math.sin(F.t * 1.2 + b.ph) * 0.8);
            ctx.rotate(Math.sin(F.t * 0.9 + b.ph) * 0.05);
            ctx.scale(b.s, b.s);
            fillP(ctx, 'hull', U.hull);
            fillP(ctx, 'sail', U.sail);
            fillP(ctx, 'sail', U.jib);
            ctx.restore();
          }
        }),
        crests: layer(35, 300, 20, ['foam'], (P, R) => {
          for (let k = 0; k < 7; k++) {
            const y = HZ + 8 + R() * 22;
            const w = 4 + (y - HZ) * 0.35 * (0.6 + R());
            ell(P[0], R() * 300, y, w, 0.7);
          }
        }),
        waves: layer(36, 460, 140, ['swell', 'wave', 'waveIn', ['waveLine', 1.1], 'foam', 'spray'], (P, R, i, items, tw) => {
          ridge(P[0], i, tw, 36, 152, 10, 120, 10);
          if (R() < 0.75) bigWave(P, R, 80 + R() * 300, 0.75 + R() * 0.35);
          if (R() < 0.6) bigWave(P, R, R() * 460, 0.4 + R() * 0.2);
        }),
        near: layer(37, 340, 30, ['wave', 'foamNear'], (P, R, i, items, tw) => {
          ridge(P[0], i, tw, 37, 166, 8, 70, 8);
          // a ribbon of foam along the near swell, in small scallops
          const y = (x) => ridgeY(i, tw, x, 37, 166, 8, 70);
          P[1].moveTo(0, y(0) + 0.5);
          for (let x = 0; x < tw + 1; x += 9) P[1].quadraticCurveTo(x + 4.5, y(x + 4.5) - 2.6, x + 9, y(x + 9) + 0.5);
          for (let x = Math.ceil((tw + 1) / 9) * 9; x >= 0; x -= 9) P[1].lineTo(x, y(x) + 2.4);
          P[1].closePath();
        }),
      };
    },
    paint(ctx, f, L) {
      skyFill(ctx, 'sky');
      if (f.dark) drawLayer(ctx, L.stars, f.scroll * 0.02);
      // the sun goes down over the round and touches the sea at its end
      const sx = f.W * (0.3 + 0.48 * f.pj);
      const sy = 38 + 62 * f.pj * f.pj;
      celestial(ctx, sx, sy, 13);
      drawLayer(ctx, L.cloud, f.scroll * 0.04 + f.t * 2);
      rect(ctx, 'sea', -1, HZ, f.W + 2, G - HZ + 2);
      rect(ctx, 'seaFar', -1, HZ, f.W + 2, 7);
      drawLayer(ctx, L.islands, f.scroll * 0.03);
      lighthouse(ctx, f.W * (1.1 - 0.4 * f.pj), HZ + 2, 0.85 + 0.4 * f.pj);
      // the sun's (or moon's) path on the water
      if (setFill(ctx, 'glint')) {
        const a = ctx.globalAlpha;
        for (let k = 0; k < 7; k++) {
          const y = HZ + 3 + k * 4.2;
          const w = (5 + k * 2.4) * (0.6 + 0.4 * Math.abs(Math.sin(f.t * 1.4 + k * 1.9)));
          ctx.globalAlpha = a * (1 - k / 8);
          ctx.fillRect(sx - w / 2 + Math.sin(f.t + k) * 2, y, w, 1.2);
        }
        ctx.globalAlpha = 1;
      }
      drawLayer(ctx, L.boats, f.scroll * 0.12);
      drawLayer(ctx, L.crests, f.scroll * 0.22);
      birds(ctx, 'gull', 3, 9, 5, 64, 1, 30);
      drawLayer(ctx, L.waves, f.scroll * 0.5);
      drawLayer(ctx, L.near, f.scroll * 0.85);
      ground(ctx, 'groundEdge');
      seasonal(ctx, 0.7);
      hanamaru(ctx, sx, sy, 22, f.fin);
    },
  });
  // A great wave in Hokusai's manner, curling over to the left, its lip in claws of foam.
  function bigWave(P, R, x, s) {
    const base = 156;
    const h = 40 * s;
    const w = 120 * s;
    const top = base - h;
    const body = P[1];
    body.moveTo(x + w * 0.75, base + 6);
    body.quadraticCurveTo(x + w * 0.35, base - h * 0.2, x + w * 0.12, top + h * 0.08);
    body.bezierCurveTo(x + w * 0.02, top - h * 0.12, x - w * 0.24, top - h * 0.1, x - w * 0.3, top + h * 0.32);
    body.quadraticCurveTo(x - w * 0.31, top + h * 0.52, x - w * 0.18, top + h * 0.5);
    body.quadraticCurveTo(x - w * 0.08, top + h * 0.48, x - w * 0.09, top + h * 0.7);
    body.quadraticCurveTo(x - w * 0.12, base - 2, x - w * 0.55, base + 6);
    body.closePath();
    // the inner band of the wave
    const inn = P[2];
    inn.moveTo(x + w * 0.5, base + 6);
    inn.quadraticCurveTo(x + w * 0.22, base - h * 0.3, x + w * 0.05, top + h * 0.3);
    inn.quadraticCurveTo(x - w * 0.02, top + h * 0.55, x - w * 0.04, base + 6);
    inn.closePath();
    // lines along the slope
    for (let k = 0; k < 3; k++) {
      const o = 0.18 + k * 0.17;
      P[3].moveTo(x + w * (0.66 - o * 0.4), base + 2);
      P[3].quadraticCurveTo(x + w * (0.34 - o * 0.3), base - h * (0.25 + o * 0.2), x + w * (0.1 - o * 0.1), top + h * (0.15 + o * 0.5));
    }
    // the claws: scallops along the lip and fingers hanging from it
    const n = 9;
    for (let k = 0; k <= n; k++) {
      const u = k / n;
      // along the lip from the crest (right) to the tip (left)
      const px = lerp(x + w * 0.1, x - w * 0.29, u);
      const py = top + h * (0.06 - 0.14 * Math.sin(Math.PI * u) + 0.3 * u * u);
      circ(P[4], px, py, (2.6 + 1.4 * Math.sin(Math.PI * u)) * s * 1.3);
      if (u > 0.45) leaf(P[4], px, py + 2, 5 + 6 * u * s, Math.PI * 0.5 + 0.5 - u * 0.6, 1.3);
    }
    for (let k = 0; k < 6; k++) circ(P[5], x - w * (0.35 + R() * 0.25), top + h * (0.1 + R() * 0.5), 0.8 + R() * 1.2);
  }
  function lighthouse(ctx, x, base, s) {
    ctx.save();
    ctx.translate(x, base);
    ctx.scale(s, s);
    if (setFill(ctx, 'island')) {
      ctx.beginPath();
      ctx.moveTo(-46, 0);
      ctx.quadraticCurveTo(-30, -14, -6, -14);
      ctx.quadraticCurveTo(22, -14, 40, 0);
      ctx.closePath();
      ctx.fill();
    }
    if (F.dark) {
      // the beam turns: a wedge of light that fades with distance
      const a = F.t * 0.9;
      const spread = Math.abs(Math.cos(a));
      glow(ctx, 0, -43, 10, 'lamp', 0.5);
      if (spread > 0.05 && F.C.beam) {
        glowWedge(ctx, 0, -43, Math.cos(a) > 0 ? 1 : -1, 150, 16 * spread, 'beam');
      }
    }
    if (setFill(ctx, 'lh')) {
      ctx.beginPath();
      ctx.moveTo(-6, -13);
      ctx.lineTo(-4, -40);
      ctx.lineTo(4, -40);
      ctx.lineTo(6, -13);
      ctx.closePath();
      ctx.fill();
    }
    rect(ctx, 'lhBand', -5.4, -24, 10.8, 4.5);
    rect(ctx, 'lhBand', -4.7, -34, 9.4, 4);
    rect(ctx, 'lh', -3.4, -46, 6.8, 6);
    if (F.dark) rect(ctx, 'lamp', -2.4, -45, 4.8, 4);
    if (setFill(ctx, 'lhRoof')) {
      ctx.beginPath();
      ctx.moveTo(-4.6, -46);
      ctx.lineTo(0, -51);
      ctx.lineTo(4.6, -46);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ----- 富士: Mt Fuji over a lake; the sun sets onto its summit (Diamond Fuji) -----
  scene({
    id: 'fuji', ja: '富士', en: 'Mt Fuji', stillT: 4,
    sky: { light: ['#D9E6F4', '#E8EEF4', '#F6F0E6'], dark: ['#0B1127', '#111933', '#1A2341'], dusk: ['#E3DCEE', '#F2E1DE', '#FAE6D2'] },
    light: {
      fuji: '#C1CDE5', fujiShade: '#B5C2DD', cap: '#F7F8FC', fujiRef: ['#B8C6DE', 0.35], cloud: ['#FFFFFF', 0.65],
      r1: '#CDD8E8', r2: '#C3D3DF', lake: '#D9E6EF', lakeLine: ['#F6F9FB', 0.9], pine: '#BACCC8', pine2: '#B0C4C1', trunk: '#C9BFB3',
      crane: ['#8F9AB4', 0.7], ray: ['#FFF4D8', 0.8], ground: '#F0EFE7', groundEdge: '#E6E5DA',
    },
    dark: {
      fuji: '#1A223E', fujiShade: '#161D36', cap: '#2D3759', fujiRef: ['#2D3759', 0.3], cloud: ['#1F2846', 0.6],
      r1: '#141B33', r2: '#11182D', lake: '#131B32', lakeLine: ['#2E3A5E', 0.8], pine: '#0E1528', pine2: '#0C1224', trunk: '#141A2E',
      crane: ['#4C587C', 0.7], ray: ['#F0E6C8', 0.5], ground: '#141A2D', groundEdge: '#161D33',
    },
    make() {
      return {
        stars: starLayer(41, 10, -60, 110),
        streaks: layer(42, 520, 120, ['cloud'], (P, R) => {
          for (let k = 0; k < 2; k++) {
            const x = R() * 520;
            const y = 30 + R() * 60;
            const w = 60 + R() * 80;
            ell(P[0], x, y, w / 2, 2.2 + R() * 1.6);
            ell(P[0], x + w * 0.2, y - 3, w / 3, 1.8);
          }
        }),
        r1: layer(43, 400, 4, ['r1'], (P, R, i, items, tw) => ridge(P[0], i, tw, 43, 146, 20, 160, 10)),
        lakeLines: layer(44, 260, 30, ['lakeLine'], (P, R) => {
          for (let k = 0; k < 6; k++) ell(P[0], R() * 260, 152 + R() * 14, 6 + R() * 14, 0.6);
        }),
        shore: layer(45, 520, 60, ['trunk', 'pine2', 'pine'], (P, R) => {
          if (R() < 0.55) pine(P, R, 60 + R() * 400, G, 0.8 + R() * 0.4);
          if (R() < 0.3) pine(P, R, 60 + R() * 400, G, 0.6 + R() * 0.3);
        }),
      };
    },
    paint(ctx, f, L) {
      skyFill(ctx, 'sky');
      if (!f.dark) skyFill(ctx, 'dusk', 0.9 * smooth(0.3, 1, f.pj));
      if (f.dark) drawLayer(ctx, L.stars, f.scroll * 0.02);
      const hw = Math.min(205, f.W * 0.28) * (0.9 + 0.14 * f.pj);
      const fx = f.W * 0.6;
      const base = 148;
      const summit = base - 0.512 * hw;
      // the sun (or the full moon) comes down onto the summit at the end of the round
      const k = ease(f.pj);
      const sx = lerp(f.W * 0.16, fx, k);
      const sy = lerp(36, summit - 1, f.pj) - 22 * Math.sin(Math.PI * f.pj);
      celestial(ctx, sx, sy, 12);
      drawLayer(ctx, L.streaks, f.scroll * 0.03 + f.t * 1.5);
      fuji(ctx, fx, base, hw);
      if (f.fin > 0) {
        // Diamond Fuji (or Pearl Fuji by night): rays from the summit
        if (setFill(ctx, 'ray')) {
          ctx.globalAlpha *= f.fin;
          const turn = f.still ? 0 : f.t * 0.15;
          ctx.beginPath();
          for (let r = 0; r < 4; r++) {
            const a = turn + (r * Math.PI) / 4;
            const c = Math.cos(a);
            const s = Math.sin(a);
            const len = r % 2 ? 22 : 34;
            ctx.moveTo(sx + c * len, sy + s * len);
            ctx.lineTo(sx - s * 1.4, sy + c * 1.4);
            ctx.lineTo(sx - c * len, sy - s * len);
            ctx.lineTo(sx + s * 1.4, sy - c * 1.4);
            ctx.closePath();
          }
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
      birds(ctx, 'crane', 3, 6, 3, 78, 1.6, 40);
      drawLayer(ctx, L.r1, f.scroll * 0.06);
      rect(ctx, 'lake', -1, 148, f.W + 2, G - 146);
      // Fuji upside down in the lake
      ctx.save();
      ctx.beginPath();
      ctx.rect(-1, 148, f.W + 2, G - 148);
      ctx.clip();
      ctx.translate(fx, 148);
      ctx.scale(hw, -hw * 0.5);
      fillP(ctx, 'fujiRef', U.fuji.body);
      ctx.restore();
      drawLayer(ctx, L.lakeLines, f.scroll * 0.3 + f.t * 1.2);
      drawLayer(ctx, L.shore, f.scroll * 0.9);
      ground(ctx, 'groundEdge');
      seasonal(ctx, 0.8);
      hanamaru(ctx, sx, sy, 24, f.fin);
    },
  });
  // A pine (matsu): a leaning trunk and flat layers of needles like clouds.
  function pine(P, R, x, base, s) {
    const lean = (R() - 0.5) * 16 * s;
    const h = 46 * s;
    P[0].moveTo(x - 2.4 * s, base + 1);
    P[0].quadraticCurveTo(x + lean * 0.2, base - h * 0.5, x + lean, base - h);
    P[0].lineTo(x + lean + 2.4 * s, base - h);
    P[0].quadraticCurveTo(x + lean * 0.2 + 3 * s, base - h * 0.5, x + 2.4 * s, base + 1);
    P[0].closePath();
    const n = 3 + Math.floor(R() * 2);
    for (let k = 0; k < n; k++) {
      const u = k / (n - 1);
      const cx = x + lean * (0.45 + 0.55 * u) + (k % 2 ? 9 : -9) * s * (1 - u * 0.5);
      const cy = base - h * (0.45 + 0.55 * u);
      const w = (24 - 10 * u) * s;
      ell(P[2], cx, cy, w / 2, 4.5 * s);
      ell(P[1], cx + 1.5 * s, cy + 2.4 * s, w / 2 - 1, 3 * s);
    }
  }

  // ----- 夜の街: a city with katakana signs, neon by night, a tower ahead -----
  const SIGN_WORDS = ['ラーメン', 'カフェ', 'パン', 'ケーキ', 'カラオケ', 'ホテル', 'スーパー', 'カメラ', 'ドーナツ', 'ギョーザ', 'アイス', 'ソーダ', 'ピザ', 'カレー', 'ミルク', 'タクシー', 'ジム', 'パフェ', 'メガネ', 'ピアノ'];
  scene({
    id: 'machi', ja: '夜の街', en: 'Neon city', stillT: 3,
    sky: { light: ['#E3E0F2', '#ECE5F0', '#F8E9DE'], dark: ['#0C0D22', '#131532', '#1F1C3E'] },
    light: {
      far: '#DEDCEC', farWin: '', mid: '#D7D9EA', side: '#CDD0E4', win: '#E3E6F2', winOff: '#DDE0EE', roofThing: '#CBCEE2',
      s1: '#F2D6E2', s2: '#D2ECE5', s3: '#F5EAC6', s4: '#D9E1F6', t1: '#C99AB0', t2: '#8FB8AD', t3: '#C4AE73', t4: '#9AA8D0',
      tower: '#F0CDBF', towerW: '#F7F3EE', towerLine: ['#E2B8A8', 1], post: '#C3C8DA', lamp: '#EEF0F6',
      ground: '#EEEEF3', groundEdge: '#E3E2EC',
    },
    dark: {
      far: '#141732', farWin: ['#F3D47E', 0.2], mid: '#10132A', side: '#0C0F23', win: ['#F3D47E', 0.32], winOff: '#151931', roofThing: '#0E1127',
      s1: '#1A1B36', s2: '#1A1B36', s3: '#1A1B36', s4: '#1A1B36', t1: '#FF9CC8', t2: '#7DE0CF', t3: '#FFD27A', t4: '#A6B6FF',
      tower: '#2D2342', towerW: '#3A2E4E', towerLine: ['#FFC48A', 0.55], towerLit: ['#FFC48A', 0.5], post: '#0D1024', lamp: '#FFE3A8',
      lampGlow: ['#FFD98E', 0.3], ground: '#121428', groundEdge: '#151830',
    },
    make() {
      return {
        stars: starLayer(51, 5, -60, 60),
        far: layer(52, 300, 10, ['far', 'farWin'], (P, R, i, items, tw) => {
          let x = 0;
          while (x < tw) {
            const w = Math.min(18 + R() * 30, tw - x);
            const h = 50 + R() * 50;
            P[0].rect(x, G - h, w + 0.6, h + 2);
            if (R() < 0.3) P[0].rect(x + w / 2 - 0.6, G - h - 14, 1.2, 14);
            for (let y = G - h + 6; y < G - 20; y += 9) for (let wx = x + 4; wx < x + w - 4; wx += 6) if (R() < 0.25) P[1].rect(wx, y, 2, 2.6);
            x += w;
          }
        }),
        mid: layer(53, 260, 30, ['side', 'mid', 'winOff', 'win', 'roofThing', 's1', 's2', 's3', 's4'], (P, R, i, items, tw) => {
          let x = 4;
          while (x < tw - 40) {
            let w = 46 + R() * 40;
            if (x + w > tw - 4 || tw - 4 - (x + w) < 40) w = tw - 4 - x;
            const h = 68 + R() * 46;
            const top = G - h;
            P[0].rect(x + w - 6, top + 3, 6, h);
            P[1].rect(x, top, w - 6, h + 2);
            for (let y = top + 8; y < G - 14; y += 11) {
              for (let wx = x + 5; wx < x + w - 14; wx += 9) P[R() < 0.45 ? 3 : 2].rect(wx, y, 5, 6);
            }
            if (R() < 0.5) {
              rr(P[4], x + 8, top - 9, 12, 9, 2);
              P[4].rect(x + 10, top - 2, 1.4, 3);
            }
            // a sign: on the side of the building, read downwards, or on its roof
            const col = Math.floor(R() * 4);
            const word = SIGN_WORDS[Math.floor(R() * SIGN_WORDS.length)];
            const n = Array.from(word).length;
            if (n <= 4 && R() < 0.65) {
              const sh = n * 10 + 6;
              const sx = x + w - 22;
              const sy = Math.min(top + 10, 102 - sh);
              rr(P[5 + col], sx, sy, 13, sh, 2);
              // read downwards, the long-vowel mark stands upright
              items.push({ v: 1, x: sx + 6.5, y: sy + 8, word: Array.from(word.replace(/ー/g, '｜')), col: col + 1, ph: R() * 50 });
            } else {
              const sw = n * 9 + 10;
              const sx = x + Math.max(2, (w - 6 - sw) / 2);
              rr(P[5 + col], sx, top - 15, sw, 13, 2);
              items.push({ v: 0, x: sx + sw / 2, y: top - 8.2, word, col: col + 1, ph: R() * 50 });
            }
            x += w + 2;
          }
        }, (ctx, items) => {
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = FONT_SIGN;
          for (let q = 0; q < items.length; q++) {
            const s = items[q];
            const key = TEXT_KEYS[s.col];
            if (!setFill(ctx, key)) continue;
            let a = F.dark ? 0.9 : 0.85;
            // one sign in a while flickers, as old neon does
            if (F.dark && hash(Math.floor(s.ph), Math.floor(F.t * 0.4 + s.ph)) < 0.12) a *= hash(7, Math.floor(F.t * 12)) < 0.5 ? 0.25 : 1;
            if (F.dark) {
              ctx.strokeStyle = F.C[key];
              ctx.lineWidth = 3.2;
              ctx.globalAlpha = 0.16 * a;
              if (s.v) for (let k = 0; k < s.word.length; k++) ctx.strokeText(s.word[k], s.x, s.y + k * 10);
              else ctx.strokeText(s.word, s.x, s.y);
            }
            ctx.globalAlpha = a;
            if (s.v) for (let k = 0; k < s.word.length; k++) ctx.fillText(s.word[k], s.x, s.y + k * 10);
            else ctx.fillText(s.word, s.x, s.y);
          }
          ctx.globalAlpha = 1;
        }),
        lamps: layer(54, 380, 30, ['post', 'lamp'], (P, R, i, items) => {
          const x = 40 + R() * 300;
          P[0].rect(x - 1.2, 112, 2.4, G - 110);
          P[0].moveTo(x, 113);
          P[0].quadraticCurveTo(x, 106, x + 8, 106);
          P[0].lineTo(x + 8, 108);
          P[0].quadraticCurveTo(x + 2, 108, x + 1.2, 113);
          P[0].closePath();
          rr(P[1], x + 5, 106.5, 9, 3, 1.4);
          items.push({ x: x + 9.5, y: 110 });
        }, (ctx, items) => {
          if (!F.dark) return;
          for (let q = 0; q < items.length; q++) glow(ctx, items[q].x, items[q].y, 22, 'lampGlow', 1);
        }),
      };
    },
    paint(ctx, f, L) {
      skyFill(ctx, 'sky');
      if (f.dark) drawLayer(ctx, L.stars, f.scroll * 0.02);
      const sx = f.W * (0.18 + 0.3 * f.pj);
      const sy = 30 - 6 * Math.sin(Math.PI * f.pj);
      celestial(ctx, sx, sy, 11);
      drawLayer(ctx, L.far, f.scroll * 0.08);
      tower(ctx, f.W * (1.06 - 0.32 * f.pj), 150, 0.85 + 0.3 * f.pj);
      drawLayer(ctx, L.mid, f.scroll * 0.4);
      drawLayer(ctx, L.lamps, f.scroll * 0.9);
      ground(ctx, 'groundEdge');
      seasonal(ctx, 0.6);
      hanamaru(ctx, sx, sy, 20, f.fin);
    },
  });
  const TEXT_KEYS = ['', 't1', 't2', 't3', 't4'];
  const TOWER_H = 128;
  const towerHalf = (y) => 4 + 26 * Math.pow(y / TOWER_H, 1.6);   // half width at y from the top
  // A lattice broadcast tower with two decks, lit up by night (more of it as the round goes on).
  function tower(ctx, x, base, s) {
    ctx.save();
    ctx.translate(x, base);
    ctx.scale(s, s);
    const h = TOWER_H;
    const at = towerHalf;
    if (setFill(ctx, 'tower')) {
      ctx.beginPath();
      ctx.moveTo(-at(h), 0);
      for (let y = h; y >= 0; y -= 16) ctx.lineTo(-at(y), y - h);
      ctx.lineTo(at(0), -h);
      for (let y = 0; y <= h; y += 16) ctx.lineTo(at(y), y - h);
      ctx.lineTo(at(h) - 7, 0);
      ctx.quadraticCurveTo(0, -36, -at(h) + 7, 0);
      ctx.closePath();
      ctx.fill();
    }
    // white bands, as the real ones are painted
    for (let k = 0; k < 4; k++) {
      const y = h * (0.2 + k * 0.18);
      rect(ctx, 'towerW', -at(y), y - h, at(y) * 2, 6);
    }
    rect(ctx, 'tower', -at(h * 0.55) - 4, h * 0.55 - h - 2, at(h * 0.55) * 2 + 8, 9);
    rect(ctx, 'tower', -at(h * 0.25) - 3, h * 0.25 - h - 2, at(h * 0.25) * 2 + 6, 6);
    rect(ctx, 'tower', -1, -h - 22, 2, 23);
    if (F.C.towerLine) {
      ctx.strokeStyle = F.C.towerLine;
      ctx.globalAlpha = F.A.towerLine || 1;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      for (let y = 8; y < h; y += 14) {
        ctx.moveTo(-at(y), y - h);
        ctx.lineTo(at(y + 14), y + 14 - h);
        ctx.moveTo(at(y), y - h);
        ctx.lineTo(-at(y + 14), y + 14 - h);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (F.dark) glow(ctx, 0, -h - 22, 6 + 6 * F.fin, 'towerLit', 0.6 + F.fin);
    ctx.restore();
  }

  // ----- 田んぼ: rice terraces stepping down a hillside, a farmhouse, a scarecrow -----
  const TERR = 5;
  // The terraces follow one hill, like contour lines: the top edge of band b at world x.
  const terrY = (b, gx) => 141 + b * 6 - 32 * (1 - b * 0.2) * hills(65, gx, 150);
  scene({
    id: 'tanbo', ja: '田んぼ', en: 'Rice terraces', stillT: 7,
    sky: { light: ['#DBEBF3', '#E9F1F0', '#F6F2E3'], dark: ['#0C1325', '#111A30', '#18223A'] },
    light: {
      m1: '#D3DDE9', m2: '#C9D9D7', pad1: '#D3E6C4', pad2: '#CBE0BA', pad3: '#D9EACB', pad4: '#CFE3BE', riser: '#BED2AC',
      sprout: ['#AFCB9A', 0.9], thatch: '#DBCFB0', thatchDark: '#CDC09F', fwall: '#EFEAE0', fwood: '#D9CCB5', tree: '#C3D9B5', trunk: '#CDBFAA',
      pole: '#C9BBA0', hat: '#E5D5AC', cloth: '#D1DBEE', cloth2: '#EBD1C7', face: '#F5EEDF', ground: '#F0EFE5', groundEdge: '#E4E6D6',
    },
    dark: {
      m1: '#151C33', m2: '#121A2E', pad1: '#141D32', pad2: '#121A2E', pad3: '#162036', pad4: '#131B2F', riser: '#1C2740',
      sprout: ['#1E2D3C', 0.9], thatch: '#1A2034', thatchDark: '#151B2D', fwall: '#181E33', fwood: '#141A2D', lit: ['#F0C46B', 0.5],
      tree: '#111A2C', trunk: '#141A2C', fruit: '',
      pole: '#1B2033', hat: '#232A40', cloth: '#1E2742', cloth2: '#2A2438', face: '#262C40', ground: '#131A2C', groundEdge: '#151D30',
    },
    seasons: {
      spring: { light: { pad1: '#DCE8EF', pad2: '#D4E3EA', pad3: '#E2ECF1', pad4: '#D7E5EC', riser: '#C4D4BC', sprout: ['#B0CB9F', 0.9], tree: '#F0D3DC' } },
      autumn: { light: { pad1: '#EEDFAF', pad2: '#E7D6A1', pad3: '#F1E5BD', pad4: '#EADAA6', riser: '#D6C28E', sprout: ['#D4BA78', 0.9], tree: '#E8CDA6', fruit: ['#E7A974', 0.8] } },
      winter: { light: { pad1: '#E8ECEE', pad2: '#E2E7EA', pad3: '#EDF0F2', pad4: '#E4E8EC', riser: '#D3D9DF', sprout: ['#CDD3D8', 0.9], tree: '#E1E6E9' } },
    },
    make() {
      const roles = [];
      for (let b = 0; b < TERR; b++) {
        roles.push(b === TERR - 1 ? 'pad3' : b % 2 ? 'pad2' : 'pad1', 'riser');
        if (b === 0) roles.push('trunk', 'tree', 'fruit', 'thatch', 'thatchDark', 'fwall', 'fwood', 'lit');
      }
      roles.push('sprout');
      const SP = roles.length - 1;
      return {
        stars: starLayer(61, 9, -60, 100),
        cloud: cloudLayer(62, 440, 24, 64, 44, 92),
        m1: layer(63, 400, 4, ['m1'], (P, R, i, items, tw) => ridge(P[0], i, tw, 63, 120, 52, 120, 8)),
        m2: layer(64, 360, 8, ['m2'], (P, R, i, items, tw) => {
          ridge(P[0], i, tw, 64, 134, 20, 90, 8);
          // a fringe of treetops along the hills
          for (let x = 3; x < tw; x += 6) circ(P[0], x, ridgeY(i, tw, x, 64, 134, 20, 90) + 1, 3.4 + hash(i * 97 + x, 64) * 2);
        }),
        terr: layer(65, 320, 40, roles, (P, R, i, items, tw) => {
          const x0 = i * tw;
          let k = 0;
          for (let b = 0; b < TERR; b++) {
            const s = P[k++];
            const r = P[k++];
            s.moveTo(0, G + 2);
            for (let x = 0; x <= tw + 1; x += 8) s.lineTo(x, terrY(b, x0 + x));
            s.lineTo(tw + 1, terrY(b, x0 + tw + 1));
            s.lineTo(tw + 1, G + 2);
            s.closePath();
            // the earth wall of the terrace above, along the top edge
            r.moveTo(0, terrY(b, x0));
            for (let x = 8; x <= tw + 1; x += 8) r.lineTo(x, terrY(b, x0 + x));
            r.lineTo(tw + 1, terrY(b, x0 + tw + 1));
            for (let x = Math.floor((tw + 1) / 8) * 8; x >= 0; x -= 8) r.lineTo(x, terrY(b, x0 + x) + 2.6);
            r.closePath();
            if (b === 0) {
              // on the top terrace: a thatched farmhouse and a tree or two
              const [trunk, tree, fruit, thatch, thatchDark, fwall, fwood, lit] = P.slice(k, k + 8);
              k += 8;
              if (R() < 0.45) {
                const hx = 30 + R() * 220;
                const y = Math.max(terrY(0, x0 + hx), terrY(0, x0 + hx + 44)) + 3;
                fwall.rect(hx, y - 13, 44, 14);
                quad(thatch, hx - 7, y - 12, hx + 51, y - 12, hx + 41, y - 32, hx + 3, y - 32);
                rr(thatchDark, hx + 2, y - 35, 40, 4.5, 2);
                fwood.rect(hx + 6, y - 10, 9, 11);
                fwood.rect(hx - 2, y - 2, 48, 2);
                lit.rect(hx + 24, y - 9, 12, 6);
              }
              const nt = R() < 0.6 ? 1 + Math.floor(R() * 2) : 0;
              for (let t = 0; t < nt; t++) {
                const tx = R() * tw;
                const y = terrY(0, x0 + tx) + 3;
                const h = 16 + R() * 8;
                trunk.rect(tx - 1.2, y - h * 0.6, 2.4, h * 0.6);
                circ(tree, tx, y - h * 0.75, h * 0.32);
                circ(tree, tx - h * 0.25, y - h * 0.58, h * 0.24);
                circ(tree, tx + h * 0.25, y - h * 0.6, h * 0.25);
                for (let d = 0; d < 6; d++) circ(fruit, tx + (R() - 0.5) * h * 0.7, y - h * (0.5 + R() * 0.45), 1);
              }
            }
            // rows of rice on the lower terraces
            if (b >= 2) {
              for (let x = 2 + (b % 2) * 3; x < tw; x += 6) {
                const y = terrY(b, x0 + x);
                const room = (b < TERR - 1 ? terrY(b + 1, x0 + x) : G) - y;
                for (let rI = 5; rI < room - 2; rI += 3.6) P[SP].rect(x, y + rI, 1.1, 1.8);
              }
            }
          }
        }),
        near: layer(67, 300, 40, ['pad4', 'riser', 'sprout', 'pole', 'cloth', 'cloth2', 'hat', 'face'], (P, R, i, items, tw) => {
          ridge(P[0], i, tw, 67, 164, 3, 70, 8);
          P[1].moveTo(0, ridgeY(i, tw, 0, 67, 164, 3, 70));
          for (let x = 8; x <= tw + 1; x += 8) P[1].lineTo(x, ridgeY(i, tw, x, 67, 164, 3, 70));
          for (let x = Math.floor((tw + 1) / 8) * 8; x >= 0; x -= 8) P[1].lineTo(x, ridgeY(i, tw, x, 67, 164, 3, 70) + 2);
          P[1].closePath();
          for (let x = 4; x < tw; x += 9) P[2].rect(x, ridgeY(i, tw, x, 67, 164, 3, 70) - 3.5, 1.3, 3.5);
          if (R() < 0.35) scarecrow(P, 40 + R() * 220, G, R);
        }),
      };
    },
    paint(ctx, f, L) {
      skyFill(ctx, 'sky');
      if (f.dark) drawLayer(ctx, L.stars, f.scroll * 0.02);
      const sx = f.W * (0.22 + 0.56 * f.pj);
      const sy = 50 - 24 * Math.sin(Math.PI * f.pj);
      celestial(ctx, sx, sy, 13);
      drawLayer(ctx, L.cloud, f.scroll * 0.04 + f.t * 2.2);
      drawLayer(ctx, L.m1, f.scroll * 0.04);
      drawLayer(ctx, L.m2, f.scroll * 0.1);
      drawLayer(ctx, L.terr, f.scroll * 0.24);
      drawLayer(ctx, L.near, f.scroll * 0.6);
      ground(ctx, 'groundEdge');
      seasonal(ctx);
      if (!f.dark && f.season === 'autumn') particles(ctx, 'dfly', 3);
      hanamaru(ctx, sx, sy, 22, f.fin);
    },
  });
  // A scarecrow (かかし): a straw hat, a shirt on a cross of poles.
  function scarecrow(P, x, base, R) {
    P[3].rect(x - 1.2, base - 46, 2.4, 47);
    P[3].rect(x - 16, base - 36, 32, 2.2);
    quad(P[4 + (R() < 0.5 ? 0 : 1)], x - 12, base - 37, x + 12, base - 37, x + 8, base - 20, x - 8, base - 20);
    circ(P[7], x, base - 42, 4.6);
    ell(P[6], x, base - 46, 10, 2.4);
    ell(P[6], x, base - 48.5, 5, 3);
  }

  // ----- 雪国: a snow country village of steep thatched roofs, smoke from the hearths -----
  scene({
    id: 'yukiguni', ja: '雪国', en: 'Snow country', stillT: 11,
    sky: { light: ['#DCE4F0', '#E7ECF4', '#F1F3F8'], dark: ['#0C1328', '#121A33', '#1A2340'] },
    light: {
      mSnow: '#E2E8F1', mRock: '#CDD6E3', m2: '#D5DEEA', cf: '#CFD9E1', snowTip: '#F4F7FB', thatch: '#D6CAB2', snowRoof: '#F8FAFD',
      snowShade: '#E5EAF2', gwall: '#E4DED2', beam: '#CDC2AE', gwin: '#CDD6E4', smoke: ['#FFFFFF', 0.7],
      cedar: '#C6D3D6', cedarSnow: '#F2F5FA', body: '#F8FAFD', bodyShade: '#E4E9F1', eye: '#8C96B0', ground: '#F0F3F8', groundEdge: '#E7EBF2',
    },
    dark: {
      mSnow: '#1F2846', mRock: '#18203A', m2: '#151D36', cf: '#121A30', snowTip: '#222B49', thatch: '#1A2038', snowRoof: '#2A3352',
      snowShade: '#212A47', gwall: '#141B30', beam: '#11172A', gwin: ['#F2C66E', 0.6], smoke: ['#3A4566', 0.5],
      cedar: '#0E1428', cedarSnow: '#222B48', body: '#2E3858', bodyShade: '#252E4C', eye: '#C9CFE6', ground: '#151B2F', groundEdge: '#181F35',
    },
    make() {
      return {
        stars: starLayer(71, 9, -60, 100),
        m1: layer(72, 420, 4, ['mSnow', 'mRock'], (P, R, i, items, tw) => {
          ridge(P[0], i, tw, 72, 122, 52, 150, 8);
          // dark streaks of rock where the slopes are too steep for snow
          for (let x = 4; x < tw; x += 8) {
            const y0 = ridgeY(i, tw, x, 72, 122, 52, 150);
            const y1 = ridgeY(i, tw, x + 8, 72, 122, 52, 150);
            if (Math.abs(y1 - y0) > 2.4 && hash(i * 131 + x, 72) < 0.7) {
              const len = 8 + hash(i * 131 + x, 73) * 14;
              tri(P[1], x + 2, Math.max(y0, y1) + 4, x + 5, Math.max(y0, y1) + 4 + len, x + 7, Math.max(y0, y1) + 3);
            }
          }
        }),
        m2: layer(73, 360, 4, ['m2'], (P, R, i, items, tw) => ridge(P[0], i, tw, 73, 136, 14, 90, 10)),
        cf: layer(74, 200, 12, ['cf', 'snowTip'], (P, R, i, items, tw) => {
          for (let x = 4; x < tw; x += 7 + R() * 8) cedar(P, x, 146, 0.45 + R() * 0.25);
        }),
        houses: layer(75, 300, 70, ['snowRoof', 'snowShade', 'thatch', 'gwall', 'beam', 'gwin'], (P, R, i, items) => {
          // one house to a stretch, now and then a small storehouse (蔵) beside it
          if (R() < 0.8) {
            const w = 50 + R() * 34;
            const x = 20 + R() * (250 - w);
            gassho(P, x, w, items, R);
            if (R() < 0.4) kura(P, x + w + 14, R);
          } else kura(P, 60 + R() * 160, R);
        }, (ctx, items) => {
          if (!setFill(ctx, 'smoke')) return;
          const a = ctx.globalAlpha;
          for (let q = 0; q < items.length; q++) {
            const s = items[q];
            for (let k = 0; k < 5; k++) {
              const age = wrap(F.t * 0.12 + k / 5 + s.ph, 1);
              ctx.globalAlpha = a * (1 - age) * Math.min(1, age * 6);
              ctx.beginPath();
              ctx.arc(s.x + age * 14 + Math.sin(age * 5 + s.ph * 9) * 3, s.y - age * 46, 2.2 + age * 6, 0, TAU);
              ctx.fill();
            }
          }
          ctx.globalAlpha = 1;
        }),
        cedars: layer(76, 360, 30, ['cedar', 'cedarSnow'], (P, R, i, items, tw) => {
          if (R() < 0.45) return;
          const x = 30 + R() * 280;
          const n = 1 + Math.floor(R() * 3);
          for (let k = 0; k < n; k++) cedar(P, x + k * 15 + R() * 6, G + 1, 1 + R() * 0.4 - k * 0.15);
        }),
      };
    },
    paint(ctx, f, L) {
      skyFill(ctx, 'sky');
      if (f.dark) drawLayer(ctx, L.stars, f.scroll * 0.02);
      const sx = f.W * (0.3 + 0.44 * f.pj);
      const sy = 52 - 16 * Math.sin(Math.PI * f.pj);
      celestial(ctx, sx, sy, 12);
      drawLayer(ctx, L.m1, f.scroll * 0.03);
      drawLayer(ctx, L.m2, f.scroll * 0.08);
      drawLayer(ctx, L.cf, f.scroll * 0.16);
      drawLayer(ctx, L.houses, f.scroll * 0.4);
      drawLayer(ctx, L.cedars, f.scroll * 0.85);
      // the finishing touch: a snow daruma by the road, one eye painted, like Yaoki
      if (f.fin > 0) yukidaruma(ctx, f.W * (1.1 - 0.24 * f.fin), G, 1.25);
      ground(ctx, 'groundEdge');
      particles(ctx, 'snow', 20);
      hanamaru(ctx, sx, sy, 21, f.fin);
    },
  });
  function cedar(P, x, base, s) {
    const h = 44 * s;
    for (let k = 0; k < 3; k++) {
      const y = base - h * (0.3 + k * 0.25);
      const w = (13 - k * 3.4) * s;
      tri(P[0], x - w, y + h * 0.26, x, y - h * 0.24, x + w, y + h * 0.26);
      tri(P[1], x - w * 0.55, y - h * 0.24 + h * 0.5 * 0.45 * 0.55, x, y - h * 0.24, x + w * 0.55, y - h * 0.24 + h * 0.5 * 0.45 * 0.55);
    }
    P[0].rect(x - 1.2 * s, base - h * 0.1, 2.4 * s, h * 0.1 + 1);
  }
  // A gassho house (合掌造り), seen from its gable end: a steep thatched roof deep in snow,
  // the gable face with rows of small windows, smoke from the hearth.
  function gassho(P, x, w, items, R) {
    const eave = G - 20;
    const cx = x + w / 2;
    const apex = eave - w * 0.92;
    // the snow on the roof (with a soft lip along the eaves), the thatch showing under it
    tri(P[0], x - 10, eave + 1, cx, apex - 5, x + w + 10, eave + 1);
    quad(P[1], cx, apex - 5, x + w + 10, eave + 1, x + w + 4, eave + 1, cx, apex + 3);
    rr(P[0], x - 12, eave - 2, w + 24, 6, 3);
    tri(P[2], x - 2, eave, cx, apex + 4, x + w + 2, eave);
    // the gable face and the ground floor
    tri(P[3], x + 5, eave - 1, cx, apex + 12, x + w - 5, eave - 1);
    P[3].rect(x + 3, eave + 3, w - 6, G - eave - 2);
    for (let r = 0; r < 3; r++) {
      const y = eave - 12 - r * 13;
      const half = ((y - apex - 12) / (eave - apex - 13)) * (w / 2 - 5);
      if (half < 8) break;
      P[4].rect(cx - half + 1, y + 9, half * 2 - 2, 1.4);
      const n = Math.max(1, Math.floor((half * 2 - 8) / 9));
      for (let k = 0; k < n; k++) P[5].rect(cx - (n * 9) / 2 + k * 9 + 1.5, y, 6, 6.5);
    }
    P[4].rect(x + 3, eave + 3, w - 6, 1.6);
    for (let k = 0; k < 2; k++) P[5].rect(x + 8 + k * (w - 26), eave + 8, 10, 7);
    items.push({ x: cx + 2, y: apex - 2, ph: R() });
  }
  // A small white storehouse with a snowy roof.
  function kura(P, x, R) {
    const w = 22 + R() * 6;
    const h = 24;
    P[3].rect(x, G - h, w, h + 1);
    P[4].rect(x, G - h * 0.35, w, 1.4);
    P[5].rect(x + w / 2 - 3, G - h + 7, 6, 6);
    quad(P[2], x - 5, G - h + 1, x + w + 5, G - h + 1, x + w - 1, G - h - 6, x + 1, G - h - 6);
    rr(P[0], x - 6, G - h - 9, w + 12, 6, 3);
  }
  function yukidaruma(ctx, x, base, s) {
    ctx.save();
    ctx.translate(x, base);
    ctx.scale(s, s);
    if (setFill(ctx, 'bodyShade')) {
      ctx.beginPath();
      ctx.ellipse(1.5, -9, 14, 11, 0, 0, TAU);
      ctx.ellipse(1, -27, 9.5, 9, 0, 0, TAU);
      ctx.fill();
    }
    if (setFill(ctx, 'body')) {
      ctx.beginPath();
      ctx.ellipse(0, -10, 13, 10.5, 0, 0, TAU);
      ctx.moveTo(9, -28);
      ctx.ellipse(0, -28, 9, 8.5, 0, 0, TAU);
      ctx.fill();
    }
    if (F.C.eye) {
      ctx.strokeStyle = F.C.eye;
      ctx.fillStyle = F.C.eye;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(-3, -29, 2.2, 0, TAU);
      ctx.moveTo(5.2, -29);
      ctx.arc(3, -29, 2.2, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(3, -29, 1.1, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  // ----- 宇宙: space, where the moon's rabbit pounds mochi and planets look like dango -----
  scene({
    id: 'uchuu', ja: '宇宙', en: 'Space', stillT: 2.2,
    sky: { light: ['#DFDCF2', '#E8E4F3', '#F1ECF4'], dark: ['#0A0E20', '#0F1430', '#171C3A'] },
    light: {
      star: ['#A8A1D4', 0.8], star2: ['#E0C27E', 0.75], moon: '#F4EDDB', moonShade: '#E8DEC6', moonGlow: ['#FFFFFF', 0.6],
      rabbit: '#D7CAAC', mochi: '#FBF8F0', d1: '#F3CBD5', d2: '#F8F3EA', d3: '#CDE3C7', skewer: ['#C9C0E3', 1],
      ringed: '#D6CEEE', ring: ['#C0B6E4', 1], earth: '#CBDDF2', land: '#D3E7CB', hill: '#E1DDEC', crater: '#D6D1E5',
      neb1: ['#EED8EC', 0.5], neb2: ['#D6E0F4', 0.55], rocket: '#F7F4EE', fin: '#CFC6EA', porthole: '#C3D5EE', flame: ['#F4C892', 0.9], trail: ['#C9C0E3', 0.9],
      shoot: ['#FFFFFF', 0.9], ground: '#F0EDF5', groundEdge: '#E2DEEC',
    },
    dark: {
      star: ['#E8EBF6', 0.75], star2: ['#F2D9A0', 0.65], moon: '#DCD3B9', moonShade: '#C9BF9F', moonGlow: ['#8C9BD6', 0.25],
      rabbit: '#B8AA88', mochi: '#ECE6D6', d1: '#5A4256', d2: '#4F4E5A', d3: '#3E5246', skewer: ['#3A4064', 1],
      ringed: '#2E2E52', ring: ['#4A4A7A', 1], earth: '#2E4C78', land: '#3E6250', hill: '#161B34', crater: '#121731',
      neb1: ['#2A1F45', 0.45], neb2: ['#17284A', 0.5], rocket: '#3A4266', fin: '#4E4A7A', porthole: ['#9FB4FF', 0.7], flame: ['#FFC48A', 0.8], trail: ['#4A4F7A', 0.9],
      shoot: ['#E8EBF6', 0.8], ground: '#12162B', groundEdge: '#141931',
    },
    make() {
      return {
        stars: starLayer(81, 24, -70, 140),
        nebula: layer(84, 520, 140, ['neb1', 'neb2'], (P, R) => {
          for (let k = 0; k < 2; k++) {
            const x = R() * 520;
            const y = 20 + R() * 80;
            const c = R() < 0.5 ? 0 : 1;
            for (let b = 0; b < 4; b++) ell(P[c], x + (R() - 0.5) * 70, y + (R() - 0.5) * 16, 24 + R() * 30, 8 + R() * 8);
          }
        }),
        planets: layer(82, 460, 60, [['skewer', 1.6], 'd1', 'd2', 'd3', ['ring', 2.2], 'ringed', ['ring', 2.2]], (P, R) => {
          if (R() < 0.1) return;
          const x = 40 + R() * 380;
          const y = 22 + R() * 60;
          if (R() < 0.55) {
            // three planets on one orbit, like dango on a stick
            const r = 7 + R() * 4;
            const a = -0.5 + R() * 0.3;
            const c = Math.cos(a);
            const s = Math.sin(a);
            line(P[0], x - c * r * 4, y - s * r * 4, x + c * r * 4, y + s * r * 4);
            for (let k = 0; k < 3; k++) circ(P[1 + k], x + c * r * 2 * (k - 1), y + s * r * 2 * (k - 1), r);
          } else {
            const r = 8 + R() * 6;
            // a ringed planet: the ring behind it, the planet, the near half of the ring
            P[4].ellipse(x, y, r * 1.9, r * 0.42, -0.25, Math.PI, TAU);
            circ(P[5], x, y, r);
            P[6].ellipse(x, y, r * 1.9, r * 0.42, -0.25, 0, Math.PI);
          }
        }),
        hills: layer(83, 300, 16, ['hill', 'crater'], (P, R, i, items, tw) => {
          ridge(P[0], i, tw, 83, 150, 16, 100, 8);
          for (let k = 0; k < 3; k++) {
            const x = R() * tw;
            const y = ridgeY(i, tw, x, 83, 150, 16, 100) + 6 + R() * 8;
            ell(P[1], x, y, 5 + R() * 6, 1.6 + R() * 1.2);
          }
        }),
      };
    },
    paint(ctx, f, L) {
      skyFill(ctx, 'sky');
      drawLayer(ctx, L.nebula, f.scroll * 0.015);
      drawLayer(ctx, L.stars, f.scroll * 0.03);
      shootingStar(ctx);
      drawLayer(ctx, L.planets, f.scroll * 0.06);
      rocket(ctx);
      const mx = f.W * (0.84 - 0.18 * f.pj);
      const my = 50 + 6 * f.pj;
      const mr = 28 + 4 * f.pj;
      moonRabbit(ctx, mx, my, mr);
      // the finishing touch: the Earth rises over the hills
      if (f.fin > 0) {
        const ex = f.W * 0.6;
        const ey = 162 - 50 * ease(f.fin);
        if (setFill(ctx, 'earth')) {
          ctx.beginPath();
          ctx.arc(ex, ey, 15, 0, TAU);
          ctx.fill();
        }
        if (setFill(ctx, 'land')) {
          ctx.beginPath();
          ctx.ellipse(ex - 5, ey - 4, 6, 4, 0.5, 0, TAU);
          ctx.ellipse(ex + 6, ey + 5, 4, 5, -0.3, 0, TAU);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      drawLayer(ctx, L.hills, f.scroll * 0.4);
      ground(ctx, 'groundEdge');
      hanamaru(ctx, mx, my, mr + 9, f.fin);
    },
  });
  // Now and then a little rocket crosses the sky, leaving a dotted trail.
  function rocket(ctx) {
    const span = F.W + 700;
    const x = wrap(F.t * 26 - F.scroll * 0.08 + 260, span) - 200;
    if (x < -40 || x > F.W + 40) return;
    const y = 74 + Math.sin(x * 0.012) * 16;
    const ang = Math.atan(Math.cos(x * 0.012) * 16 * 0.012) ;
    if (F.C.trail) {
      ctx.save();
      ctx.strokeStyle = F.C.trail;
      ctx.globalAlpha = F.A.trail || 1;
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.setLineDash(U.dots);
      ctx.lineDashOffset = -x;
      ctx.beginPath();
      for (let k = 0; k <= 12; k++) {
        const px = x - 14 - k * 8;
        const py = 74 + Math.sin(px * 0.012) * 16;
        if (!k) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    const flick = F.still ? 0 : Math.sin(F.t * 30) * 1.2;
    if (setFill(ctx, 'flame')) {
      ctx.beginPath();
      ctx.moveTo(-8, -2.2);
      ctx.lineTo(-15 - flick, 0);
      ctx.lineTo(-8, 2.2);
      ctx.closePath();
      ctx.fill();
    }
    if (setFill(ctx, 'fin')) {
      ctx.beginPath();
      ctx.moveTo(-8, -3);
      ctx.lineTo(-12, -7.5);
      ctx.lineTo(-3, -3);
      ctx.moveTo(-8, 3);
      ctx.lineTo(-12, 7.5);
      ctx.lineTo(-3, 3);
      ctx.fill();
    }
    if (setFill(ctx, 'rocket')) {
      ctx.beginPath();
      ctx.moveTo(-9, -3.6);
      ctx.lineTo(3, -3.6);
      ctx.quadraticCurveTo(10, -3.2, 13, 0);
      ctx.quadraticCurveTo(10, 3.2, 3, 3.6);
      ctx.lineTo(-9, 3.6);
      ctx.closePath();
      ctx.fill();
    }
    if (setFill(ctx, 'porthole')) {
      ctx.beginPath();
      ctx.arc(2.5, 0, 1.8, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  function shootingStar(ctx) {
    if (F.still || !F.C.shoot) return;
    const per = 7;
    const k = Math.floor(F.t / per);
    const age = F.t - k * per;
    if (age > 0.9 || hash(k, 90) < 0.3) return;
    const x = F.W * (0.2 + 0.7 * hash(k, 91));
    const y = 14 + 40 * hash(k, 92);
    const u = age / 0.9;
    const hx = x - 70 * u;
    const hy = y + 30 * u;
    ctx.strokeStyle = F.C.shoot;
    ctx.globalAlpha = F.A.shoot * Math.sin(Math.PI * u);
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx + 22, hy - 9.5);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // The moon, and on it the rabbit pounding mochi in its mortar (月のうさぎ).
  function moonRabbit(ctx, x, y, r) {
    glow(ctx, x, y, r * 2.4, 'moonGlow', 1);
    ctx.fillStyle = F.C.moon;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(r / 40, r / 40);
    if (setFill(ctx, 'moonShade')) {
      ctx.beginPath();
      ctx.arc(-22, -18, 6, 0, TAU);
      ctx.moveTo(30, 12);
      ctx.arc(26, 12, 4, 0, TAU);
      ctx.moveTo(-18, 26);
      ctx.arc(-22, 26, 4, 0, TAU);
      ctx.fill();
    }
    // the pounding: the mallet lifts and falls
    const beat = F.still ? 0.6 : Math.abs(Math.sin(F.t * 2.2));
    if (setFill(ctx, 'rabbit')) {
      ctx.beginPath();
      // the mortar
      ctx.moveTo(4, 18);
      ctx.lineTo(24, 18);
      ctx.lineTo(21, 30);
      ctx.lineTo(7, 30);
      ctx.closePath();
      ctx.rect(10, 30, 8, 4);
      // the rabbit, sitting up, ears back
      ctx.moveTo(-2, 22);
      ctx.ellipse(-12, 22, 10, 12, -0.2, 0, TAU);
      ctx.moveTo(-6, 6);
      ctx.ellipse(-11, 6, 6.5, 6, 0, 0, TAU);
      ctx.moveTo(-12, 2);
      ctx.ellipse(-15, -6, 2.4, 9, -0.35, 0, TAU);
      ctx.moveTo(-7, 1);
      ctx.ellipse(-9, -7, 2.2, 8.5, -0.1, 0, TAU);
      ctx.fill();
      // the mallet (杵), held out to the mortar
      ctx.save();
      ctx.translate(-4, 16);
      ctx.rotate(-0.95 + 0.75 * (1 - beat));
      ctx.fillRect(0, -1.2, 22, 2.4);
      ctx.beginPath();
      ctx.ellipse(23, 0, 3.5, 6.5, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    if (setFill(ctx, 'mochi')) {
      ctx.beginPath();
      ctx.ellipse(14, 18, 8, 3.2, 0, Math.PI, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ----- 海の中: under the sea, kelp, fish and a whale passing over -----
  scene({
    id: 'uminaka', ja: '海の中', en: 'Under the sea', stillT: 5,
    sky: { light: ['#D1EAF0', '#D9EDEC', '#DFEDE6'], dark: ['#0A1828', '#0C1D2D', '#0F212E'] },
    light: {
      surface: '#E6F5F6', ray: ['#FFFFFF', 0.32], rock: '#BED6D9', rockFar: '#C8DEE1', rock2: '#BDD5D6', kelp: '#B8D6C4', kelp2: '#ADCDBB',
      c1: '#F0D2CF', c2: '#E1D3EB', c3: '#F0E0C1', f1: '#F2CDB5', f2: '#C8DBF0', f3: '#EFE1B5', fin2: '#FBF6EE', jelly: ['#F2D8EA', 0.85], star5: '#F0CFB8',
      whale: '#C2D8E0', whaleBelly: '#D2E4EA', eye: '#9AAAC0', ground: '#F2EFE4', groundEdge: '#E6E1CF',
    },
    dark: {
      surface: '#13293A', ray: ['#7CC3D2', 0.07], rock: '#0D1B28', rock2: '#0B1823', kelp: '#0F2629', kelp2: '#0C2024',
      rockFar: '#0C1A26', c1: '#2A2436', c2: '#22253A', c3: '#2A2A30', f1: '#2A3C52', f2: '#25384E', f3: '#2E3D50', fin2: '#3A4A60',
      jelly: ['#A8E6FF', 0.4], jellyGlow: ['#7FD8F0', 0.22], star5: '#2E2A38', fly: ['#9FE8F2', 0.5],
      whale: '#10232F', whaleBelly: '#132A38', eye: '#4A6278', ground: '#111A26', groundEdge: '#131E2B',
    },
    make() {
      return {
        rays: layer(91, 240, 160, [], (P, R, i, items) => {
          if (R() < 0.8) items.push({ x: R() * 240, w: 10 + R() * 16, ph: R() * TAU });
        }, (ctx, items) => {
          if (!F.C.ray) return;
          ctx.fillStyle = F.C.ray;
          for (let q = 0; q < items.length; q++) {
            const s = items[q];
            ctx.globalAlpha = F.A.ray * (0.5 + 0.5 * Math.sin(F.t * 0.4 + s.ph));
            ctx.beginPath();
            ctx.moveTo(s.x, F.top - 2);
            ctx.lineTo(s.x + s.w, F.top - 2);
            ctx.lineTo(s.x + s.w * 2 + 50, G);
            ctx.lineTo(s.x + 50, G);
            ctx.closePath();
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        }),
        rocksFar: layer(97, 460, 4, ['rockFar'], (P, R, i, items, tw) => ridge(P[0], i, tw, 97, 140, 36, 140, 8)),
        rocks: layer(92, 380, 40, ['rock'], (P, R, i, items, tw) => {
          ridge(P[0], i, tw, 92, 158, 22, 80, 8);
          // a tall rock with an arch through it
          if (R() < 0.45) {
            const x = 40 + R() * 280;
            const h = 50 + R() * 30;
            const p = P[0];
            p.moveTo(x - 24, G + 2);
            p.quadraticCurveTo(x - 26, G - h * 0.7, x - 10, G - h);
            p.quadraticCurveTo(x + 6, G - h - 6, x + 22, G - h * 0.8);
            p.quadraticCurveTo(x + 34, G - h * 0.4, x + 30, G + 2);
            p.lineTo(x + 12, G + 2);
            p.arc(x + 2, G + 2, 10, 0, Math.PI, true);
            p.closePath();
          }
        }),
        jelly: layer(93, 460, 30, [], (P, R, i, items) => {
          if (R() < 0.6) items.push({ x: R() * 460, y: 40 + R() * 50, s: 0.8 + R() * 0.5, ph: R() * TAU });
        }, (ctx, items) => {
          if (!setFill(ctx, 'jelly')) return;
          const a = ctx.globalAlpha;
          ctx.strokeStyle = F.C.jelly;
          ctx.lineWidth = 0.9;
          for (let q = 0; q < items.length; q++) {
            const j = items[q];
            const pulse = Math.sin(F.t * 1.6 + j.ph);
            const y = j.y + Math.sin(F.t * 0.5 + j.ph) * 6;
            if (F.dark) {
              glow(ctx, j.x, y, 16 * j.s, 'jellyGlow', 0.8 + 0.2 * pulse);
              ctx.fillStyle = F.C.jelly;
            }
            const w = 7 * j.s * (1 + 0.1 * pulse);
            ctx.globalAlpha = a;
            ctx.beginPath();
            ctx.ellipse(j.x, y, w, 5.5 * j.s * (1 - 0.08 * pulse), 0, Math.PI, TAU);
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = a * 0.8;
            ctx.beginPath();
            for (let k = -2; k <= 2; k++) {
              ctx.moveTo(j.x + k * w * 0.32, y);
              ctx.quadraticCurveTo(j.x + k * w * 0.32 + Math.sin(F.t * 2 + k + j.ph) * 2.4, y + 7 * j.s, j.x + k * w * 0.3, y + 13 * j.s);
            }
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }),
        fish: layer(94, 380, 60, [], (P, R, i, items) => {
          if (R() < 0.15) return;
          const cx = R() * 380;
          const cy = 40 + R() * 70;
          const big = R() < 0.3;
          const n = big ? 1 : 3 + Math.floor(R() * 4);
          const col = big ? 1 : 1 + Math.floor(R() * 3);
          for (let k = 0; k < n; k++) items.push({ x: cx + (R() - 0.5) * 60, y: cy + (R() - 0.5) * 26, s: big ? 22 + R() * 6 : 10 + R() * 4, col, ph: R() * TAU });
        }, (ctx, items) => {
          for (let q = 0; q < items.length; q++) {
            const fi = items[q];
            const key = FISH_KEYS[fi.col];
            if (!setFill(ctx, key)) continue;
            ctx.save();
            ctx.translate(fi.x + Math.sin(F.t * 0.8 + fi.ph) * 3, fi.y + Math.sin(F.t * 1.1 + fi.ph) * 2);
            ctx.scale(fi.s, fi.s * (0.92 + 0.08 * Math.sin(F.t * 6 + fi.ph)));
            ctx.fill(U.fish);
            if (setFill(ctx, 'fin2')) ctx.fill(U.fishBelly);
            ctx.restore();
          }
          ctx.globalAlpha = 1;
        }),
        kelp: layer(95, 170, 30, [], (P, R, i, items) => {
          const n = 1 + Math.floor(R() * 2);
          for (let k = 0; k < n; k++) {
            const x = R() * 170;
            const key = R() < 0.5 ? 'kelp' : 'kelp2';
            for (let b = 0; b < 3; b++) items.push({ x: x + b * 4 - 4, h: (40 + R() * 60) * (b === 1 ? 1 : 0.7), w: 3 + R() * 2.5, ph: R() * TAU, key });
          }
        }, (ctx, items) => {
          // ribbons of kelp that sway, each a long tapering leaf
          for (let q = 0; q < items.length; q++) {
            const k = items[q];
            if (!setFill(ctx, k.key)) continue;
            const sway = Math.sin(F.t * 0.7 + k.ph) * 9;
            const x = k.x;
            const h = k.h;
            const w = k.w;
            ctx.beginPath();
            ctx.moveTo(x - w / 2, G + 1);
            ctx.bezierCurveTo(x - w - 5 + sway * 0.2, G - h * 0.35, x - w + 5 + sway * 0.6, G - h * 0.7, x + sway, G - h);
            ctx.bezierCurveTo(x + w + 5 + sway * 0.6, G - h * 0.7, x + w - 5 + sway * 0.2, G - h * 0.35, x + w / 2, G + 1);
            ctx.closePath();
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        }),
        coral: layer(96, 280, 30, ['c1', 'c2', 'c3', 'rock2', 'star5'], (P, R) => {
          for (let k = 0; k < 2; k++) {
            if (R() < 0.3) continue;
            const x = R() * 280;
            const c = Math.floor(R() * 3);
            if (R() < 0.5) {
              for (let b = 0; b < 5; b++) {
                const a = -Math.PI / 2 + (b - 2) * 0.38;
                const len = 8 + R() * 10;
                rr(P[c], x + Math.cos(a) * len * 0.5 - 1.6, G - 2 + Math.sin(a) * len - 1.6, 3.2, len, 1.6);
                circ(P[c], x + Math.cos(a) * len * 0.5, G - 2 + Math.sin(a) * len, 2.4);
              }
            } else {
              ell(P[c], x, G - 4, 9, 7);
              ell(P[c], x + 7, G - 2, 6, 5);
            }
            ell(P[3], x + 14, G, 8, 4);
          }
          if (R() < 0.35) {
            const x = R() * 280;
            for (let a = 0; a < 5; a++) {
              const ang = -Math.PI / 2 + (a * TAU) / 5;
              leaf(P[4], x, G - 5, 5.5, ang, 1.6);
            }
          }
        }),
      };
    },
    paint(ctx, f, L) {
      skyFill(ctx, 'sky');
      // the surface, far above, rippling
      if (setFill(ctx, 'surface')) {
        ctx.beginPath();
        ctx.moveTo(-2, F.top - 2);
        for (let x = -2; x <= f.W + 12; x += 12) ctx.lineTo(x, 4 + Math.sin(x * 0.05 + f.t * 0.9) * 2.4 + Math.sin(x * 0.13 - f.t * 0.6) * 1.2);
        ctx.lineTo(f.W + 12, F.top - 2);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      drawLayer(ctx, L.rays, f.scroll * 0.12);
      whale(ctx, f.W * (1.2 - 0.8 * f.pj), 66, 1);
      drawLayer(ctx, L.rocksFar, f.scroll * 0.06);
      drawLayer(ctx, L.jelly, f.scroll * 0.18);
      drawLayer(ctx, L.rocks, f.scroll * 0.2);
      drawLayer(ctx, L.fish, f.scroll * 0.3 + f.t * 7);
      drawLayer(ctx, L.kelp, f.scroll * 0.5);
      drawLayer(ctx, L.coral, f.scroll * 0.85);
      ground(ctx, 'groundEdge');
      particles(ctx, 'bubble', 14);
      if (f.dark) particles(ctx, 'fly', 6);
      // the finishing touch: a ring of bubbles in the shape of a はなまる, floating up
      if (f.fin > 0 && F.C.bubble) {
        const s = 1.4;
        ctx.save();
        ctx.translate(f.W * 0.72, 84 - (f.still ? 0 : 20 * f.fin));
        ctx.scale(s, s);
        ctx.strokeStyle = F.C.bubble;
        ctx.globalAlpha = (F.A.bubble || 0.5) * f.fin;
        ctx.lineWidth = 2.6 / s;
        ctx.lineCap = 'round';
        ctx.setLineDash(U.dots);
        ctx.stroke(U.hana);
        ctx.restore();
      }
    },
  });
  const FISH_KEYS = ['', 'f1', 'f2', 'f3'];
  function whale(ctx, x, y, s) {
    if (!setFill(ctx, 'whale')) return;
    const tail = F.still ? 0 : Math.sin(F.t * 0.8) * 4;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.beginPath();
    ctx.moveTo(-58, 0);
    ctx.bezierCurveTo(-56, -20, -10, -24, 26, -10);
    ctx.quadraticCurveTo(44, -4, 58, -6 + tail);
    ctx.lineTo(70, -16 + tail);
    ctx.quadraticCurveTo(68, -4 + tail, 72, 6 + tail);
    ctx.lineTo(58, 0 + tail);
    ctx.quadraticCurveTo(40, 8, 20, 12);
    ctx.bezierCurveTo(-10, 18, -52, 16, -58, 0);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    if (setFill(ctx, 'whaleBelly')) {
      ctx.beginPath();
      ctx.moveTo(-54, 6);
      ctx.bezierCurveTo(-40, 16, -6, 16, 18, 10);
      ctx.quadraticCurveTo(-10, 10, -54, 6);
      ctx.fill();
    }
    if (setFill(ctx, 'eye')) {
      ctx.beginPath();
      ctx.arc(-44, 2, 1.6, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ----- 夏祭り: a summer festival, lanterns on strings, stalls and fireworks -----
  const STALLS = ['わたあめ', 'かき氷', 'たこ焼き', 'やきそば', 'りんごあめ', 'ヨーヨー', 'きんぎょ', 'お面', 'ラムネ', 'チョコバナナ'];
  scene({
    id: 'matsuri', ja: '夏祭り', en: 'Summer festival', stillT: 3.9,
    sky: { light: ['#DCDAEF', '#EAE2EF', '#FAE7DA'], dark: ['#0C0F25', '#14163A', '#211C3E'] },
    light: {
      far: '#D9D6E8', frame: '#D6CBBA', counter: '#E7DECF', aw1: '#F1D2CC', aw2: '#FAF3EA', aw3: '#D3DDF0', noren: '#E3E8F4',
      norenText: '#9AA3BF', string: ['#BDB7CA', 1], pole: '#CDC4D4', lantern: '#FBEBCB', lanternCap: '#D9C4A2', lanternRib: ['#E6D3AE', 1],
      fw1: ['#F0B4C4', 0.6], fw2: ['#9FD3DD', 0.6], fw3: ['#F0CF84', 0.65], fw4: ['#BDB1EA', 0.6], ground: '#F1EEE9', groundEdge: '#E5E0DA',
    },
    dark: {
      far: '#13162E', frame: '#1C1F35', counter: '#22253D', aw1: '#3A2A3E', aw2: '#2A2D46', aw3: '#22305A', noren: '#262E50',
      norenText: '#8E98BC', string: ['#2E3352', 1], pole: '#191C32', lantern: ['#FFDDA6', 0.92], lanternCap: '#6E5A44', lanternRib: ['#E8B978', 0.6],
      lanternGlow: ['#FFC870', 0.26], counterLit: ['#FFD98E', 0.2],
      fw1: ['#FF9EC0', 0.75], fw2: ['#8CE3D6', 0.75], fw3: ['#FFD37A', 0.8], fw4: ['#B4A6FF', 0.75], ground: '#151829', groundEdge: '#181B2F',
    },
    make() {
      return {
        stars: starLayer(101, 7, -60, 70),
        far: layer(102, 252, 40, ['far'], (P, R, i) => {
          for (let k = 0; k < 9; k++) {
            const g = i * 9 + k;
            const h = 14 + hash(102, g) * 16;
            P[0].rect(k * 28, G - h - 12, 28.6, h + 14);
            if (hash(103, g) < 0.6) tri(P[0], k * 28 - 3, G - h - 11.5, k * 28 + 14, G - h - 19, k * 28 + 31, G - h - 11.5);
          }
        }),
        stalls: layer(104, 230, 20, ['frame', 'counter', 'aw2', 'aw1', 'aw3', 'noren', 'counterLit'], (P, R, i, items) => {
          const w = 128 + R() * 40;
          const x = (230 - w) / 2 + (R() - 0.5) * 20;
          const top = 112;
          P[0].rect(x + 2, top, 3, G - top);
          P[0].rect(x + w - 5, top, 3, G - top);
          P[1].rect(x - 2, G - 24, w + 4, 25);
          P[0].rect(x - 2, G - 25, w + 4, 2.5);
          const stripe = R() < 0.6 ? 3 : 4;
          const n = Math.round(w / 10);
          for (let k = 0; k < n; k++) {
            const sx = x - 4 + (k * (w + 8)) / n;
            const sw = (w + 8) / n;
            P[k % 2 ? 2 : stripe].moveTo(sx, top - 12);
            P[k % 2 ? 2 : stripe].lineTo(sx + sw + 0.4, top - 12);
            P[k % 2 ? 2 : stripe].lineTo(sx + sw + 0.4, top + 1);
            P[k % 2 ? 2 : stripe].arc(sx + sw / 2, top + 1, sw / 2 + 0.2, 0, Math.PI, false);
            P[k % 2 ? 2 : stripe].closePath();
          }
          const word = STALLS[Math.floor(R() * STALLS.length)];
          const nw = Math.min(w - 20, Array.from(word).length * 10 + 14);
          rr(P[5], x + (w - nw) / 2, top + 5, nw, 13, 2);
          P[6].rect(x + 2, G - 24, w - 4, 6);
          items.push({ x: x + w / 2, y: top + 11.8, word });
        }, (ctx, items) => {
          if (!setFill(ctx, 'norenText')) return;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = FONT_STALL;
          for (let q = 0; q < items.length; q++) ctx.fillText(items[q].word, items[q].x, items[q].y);
          ctx.globalAlpha = 1;
        }),
        lanterns: layer(105, 280, 300, ['pole', ['string', 0.9]], (P, R, i, items, tw) => {
          const px = (j) => 30 + hash(105, j) * 200;
          const x = px(i);
          const nx = tw + px(i + 1);
          P[0].rect(x - 1.6, 58, 3.2, G - 56);
          const y0 = 64;
          const sag = 16;
          P[1].moveTo(x, y0);
          P[1].quadraticCurveTo((x + nx) / 2, y0 + sag * 2, nx, y0);
          const n = Math.max(3, Math.floor((nx - x) / 24));
          for (let k = 1; k < n; k++) {
            const u = k / n;
            const lx = lerp(x, nx, u);
            const ly = y0 + sag * 4 * u * (1 - u);
            items.push({ x: lx, y: ly, ph: R() * TAU });
          }
        }, (ctx, items) => {
          const t = F.t;
          const lit = F.dark && F.C.lanternGlow;
          for (let q = 0; q < items.length; q++) {
            const it = items[q];
            if (lit) glow(ctx, it.x, it.y + 10, 16, 'lanternGlow', 1);
            ctx.save();
            ctx.translate(it.x, it.y);
            ctx.rotate(Math.sin(t * 1.3 + it.ph) * 0.09);
            fillP(ctx, 'lantern', U.lantern);
            fillP(ctx, 'lanternCap', U.lanternCap);
            if (F.C.lanternRib) {
              ctx.strokeStyle = F.C.lanternRib;
              ctx.globalAlpha = F.A.lanternRib || 1;
              ctx.lineWidth = 0.7;
              ctx.stroke(U.lanternRib);
              ctx.globalAlpha = 1;
            }
            ctx.restore();
          }
        }),
      };
    },
    paint(ctx, f, L) {
      skyFill(ctx, 'sky');
      if (f.dark) drawLayer(ctx, L.stars, f.scroll * 0.02);
      const sx = f.W * (0.2 + 0.2 * f.pj);
      const sy = 34;
      if (f.dark) celestial(ctx, sx, sy, 11);
      fireworks(ctx);
      drawLayer(ctx, L.far, f.scroll * 0.08);
      drawLayer(ctx, L.stalls, f.scroll * 0.42);
      drawLayer(ctx, L.lanterns, f.scroll * 0.7);
      ground(ctx, 'groundEdge');
      seasonal(ctx, 0.6);
      if (f.dark) hanamaru(ctx, sx, sy, 19, f.fin);
    },
  });
  // Fireworks (花火): three launchers in turn, more often as the round goes on; at the end
  // one opens as a はなまる.
  function fireworks(ctx) {
    const W = F.W;
    const rate = 0.45 + 0.55 * F.fin;
    for (let j = 0; j < 3; j++) {
      const per = 2.9 + j * 0.8;
      const t = F.t + j * 1.3;
      const k = Math.floor(t / per);
      const age = t - k * per;
      if (age > 1.7 || hash(j * 977 + k, 110) > rate + 0.25) continue;
      const x = W * (0.3 + 0.62 * hash(k, 111 + j));
      const y = 22 + 44 * hash(k, 114 + j);
      const R = 14 + 16 * hash(k, 117 + j);
      const key = FW_KEYS[Math.floor(hash(k, 120 + j) * 4)];
      const key2 = FW_KEYS[Math.floor(hash(k, 123 + j) * 4)];
      const grow = ease(age / 0.8);
      const fade = 1 - smooth(0.7, 1.7, age);
      const droop = age * age * 3;
      if (F.fin > 0.5 && j === 0) {
        // the はなまる firework
        ctx.save();
        ctx.translate(x, y + droop);
        ctx.scale((R / 20) * grow * 1.2, (R / 20) * grow * 1.2);
        ctx.strokeStyle = F.C[key];
        ctx.globalAlpha = (F.A[key] || 0.6) * fade;
        ctx.lineCap = 'round';
        ctx.lineWidth = 2.4 / ((R / 20) * Math.max(0.2, grow) * 1.2);
        ctx.setLineDash(U.dots);
        ctx.stroke(U.hana);
        ctx.restore();
        continue;
      }
      if (!setFill(ctx, key)) continue;
      ctx.globalAlpha *= fade;
      ctx.beginPath();
      for (let d = 0; d < 16; d++) {
        const a = (d * TAU) / 16 + k;
        const px = x + Math.cos(a) * R * grow;
        const py = y + Math.sin(a) * R * grow + droop;
        ctx.moveTo(px + 1.4, py);
        ctx.arc(px, py, 1.4, 0, TAU);
      }
      ctx.fill();
      if (setFill(ctx, key2)) {
        ctx.globalAlpha *= fade;
        ctx.beginPath();
        for (let d = 0; d < 9; d++) {
          const a = (d * TAU) / 9 + k * 2;
          const px = x + Math.cos(a) * R * 0.5 * grow;
          const py = y + Math.sin(a) * R * 0.5 * grow + droop * 0.7;
          ctx.moveTo(px + 1, py);
          ctx.arc(px, py, 1, 0, TAU);
        }
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
  const FW_KEYS = ['fw1', 'fw2', 'fw3', 'fw4'];

  // ----- 電車: a little train on a viaduct, fields and a level crossing; the station やおき -----
  const VY = 108;   // the viaduct's deck
  scene({
    id: 'densha', ja: '電車', en: 'Train line', stillT: 6,
    sky: { light: ['#DAE8F5', '#E7EFF2', '#F6F0E3'], dark: ['#0C1326', '#121A32', '#1A2340'] },
    light: {
      m1: '#D2DCE9', deck: '#C6CEDC', pier: '#D0D7E3', hill: '#CDDFD2', hill2: '#C3D8C8', roof: '#C9D2E4', hwall: '#EEEAE2',
      field: '#DCE8CF', row: ['#CCDCBD', 0.7], pole: '#C6CCDA', wire: ['#BAC1D1', 1], body: '#F6F3EB', stripe: '#BCD1EC', stripe2: '#EED5A6',
      twin: '#D0DAEA', xpost: '#CDD2DE', xboard: '#EBDDAE', xboard2: '#C9CEDA', sign: '#FBFAF6', signLine: '#BCD1EC', signText: '#7D87A6',
      ground: '#F0EFE8', groundEdge: '#E5E4DA',
    },
    dark: {
      m1: '#151C34', deck: '#1E263E', pier: '#182036', hill: '#121A2E', hill2: '#10172A', roof: '#10162A', hwall: '#161D32', hlit: ['#F0C46B', 0.5],
      field: '#131B2E', row: ['#18223A', 1], pole: '#0E1327', wire: ['#2A3250', 1], body: '#2A3350', stripe: '#3B4E78', stripe2: '#5A4C3A',
      twin: ['#F6D58A', 0.8], xpost: '#1A2036', xboard: '#4A4430', xboard2: '#232A40', xlamp: ['#FF9C7A', 0.75], xglow: ['#FF9C7A', 0.28],
      sign: '#2A3350', signLine: '#3B4E78', signText: '#C9D0E8', ground: '#141A2D', groundEdge: '#171E33',
    },
    seasons: {
      autumn: { light: { field: '#EADFB8', row: ['#DDCD9C', 0.7] } },
      winter: { light: { field: '#E8ECEF', row: ['#D8DDE2', 0.7] } },
    },
    make() {
      return {
        stars: starLayer(121, 9, -60, 100),
        cloud: cloudLayer(122, 460, 26, 70, 46, 96),
        m1: layer(123, 420, 4, ['m1'], (P, R, i, items, tw) => ridge(P[0], i, tw, 123, 120, 54, 110, 8)),
        viaduct: layer(124, 240, 4, ['pier', 'deck'], (P, R) => {
          P[1].rect(0, VY, 241, 4.5);
          P[1].rect(0, VY - 1.6, 241, 0.9);
          // a row of arches under the deck
          for (let x = 0; x < 240; x += 30) {
            P[0].moveTo(x, VY + 4);
            P[0].lineTo(x + 30.5, VY + 4);
            P[0].lineTo(x + 30.5, VY + 40);
            P[0].lineTo(x + 26, VY + 40);
            P[0].lineTo(x + 26, VY + 20);
            P[0].arc(x + 15, VY + 20, 11, 0, Math.PI, true);
            P[0].lineTo(x + 4, VY + 40);
            P[0].lineTo(x, VY + 40);
            P[0].closePath();
          }
        }),
        hills: layer(125, 360, 30, ['hill', 'hill2', 'hwall', 'roof', 'hlit'], (P, R, i, items, tw) => {
          ridge(P[0], i, tw, 125, 150, 12, 110, 8);
          ridge(P[1], i, tw, 126, 158, 5, 70, 8);
          for (let k = 0; k < 3; k++) {
            if (R() < 0.4) continue;
            const x = R() * (tw - 30);
            const y = ridgeY(i, tw, x + 10, 125, 150, 12, 110) + 4;
            P[2].rect(x, y - 9, 20, 10);
            quad(P[3], x - 3, y - 8, x + 23, y - 8, x + 18, y - 15, x + 2, y - 15);
            P[4].rect(x + 12, y - 6, 4, 3);
          }
        }),
        fields: layer(127, 320, 320, ['field', ['row', 1], 'pole', ['wire', 0.8], 'xpost', 'xboard', 'xboard2'], (P, R, i, items, tw) => {
          P[0].rect(0, 158, tw + 1, 11);
          for (let x = 2; x < tw; x += 9) line(P[1], x, 160, x - 2.5, 167);
          const px = (j) => 40 + hash(127, j) * 220;
          const x = px(i);
          const nx = tw + px(i + 1);
          P[2].rect(x - 1.6, 84, 3.2, G - 82);
          P[2].rect(x - 10, 92, 20, 2);
          for (const dx of [-9, 9]) {
            P[3].moveTo(x + dx, 93);
            P[3].quadraticCurveTo((x + nx) / 2 + dx, 93 + 20, nx + dx, 93);
          }
          if (R() < 0.3) {
            // a level crossing (踏切)
            const cx = x + 60 + R() * 60;
            P[4].rect(cx - 1.4, 126, 2.8, G - 124);
            for (const s of [-1, 1]) {
              P[5].moveTo(cx - 10, 128 + s * 4);
              P[5].lineTo(cx + 10, 128 - s * 4);
              P[5].lineTo(cx + 10, 128 - s * 4 + 3);
              P[5].lineTo(cx - 10, 128 + s * 4 + 3);
              P[5].closePath();
            }
            P[6].rect(cx - 9, 136, 18, 5);
            items.push({ x: cx });
          }
        }, (ctx, items) => {
          // by night the crossing lights blink in turn
          if (!F.dark || !F.C.xlamp) return;
          const on = Math.floor(F.t * 1.6) % 2;
          for (let q = 0; q < items.length; q++) {
            const it = items[q];
            const lx = it.x + (on ? -6 : 6);
            glow(ctx, lx, 138.5, 9, 'xglow', 1);
            rect(ctx, 'xlamp', lx - 2, 136.5, 4, 4);
          }
        }),
      };
    },
    paint(ctx, f, L) {
      skyFill(ctx, 'sky');
      if (f.dark) drawLayer(ctx, L.stars, f.scroll * 0.02);
      const sx = f.W * (0.24 + 0.52 * f.pj);
      const sy = 52 - 24 * Math.sin(Math.PI * f.pj);
      celestial(ctx, sx, sy, 12);
      drawLayer(ctx, L.cloud, f.scroll * 0.04 + f.t * 2.4);
      drawLayer(ctx, L.m1, f.scroll * 0.04);
      drawLayer(ctx, L.viaduct, f.scroll * 0.12);
      train(ctx);
      drawLayer(ctx, L.hills, f.scroll * 0.22);
      // the finishing touch: the station sign of やおき, the stop after ななころび
      drawLayer(ctx, L.fields, f.scroll * 0.55);
      if (f.fin > 0) stationSign(ctx, f.W * (1.12 - 0.3 * f.fin), 148);
      ground(ctx, 'groundEdge');
      seasonal(ctx);
      hanamaru(ctx, sx, sy, 21, f.fin);
    },
  });
  // The little train runs along the viaduct now and then, its windows lit by night.
  function train(ctx) {
    const span = F.W + 900;
    const x = wrap(F.t * 55 - F.scroll * 0.12 + 300, span) - 300;
    if (x > F.W + 10 || x < -140) return;
    const y = VY - 1.5;
    for (let c = 0; c < 3; c++) {
      const cx = x + c * 41;
      if (setFill(ctx, 'body')) {
        ctx.beginPath();
        if (c === 2) {
          ctx.moveTo(cx, y);
          ctx.lineTo(cx, y - 12);
          ctx.lineTo(cx + 33, y - 12);
          ctx.quadraticCurveTo(cx + 40, y - 11, cx + 40, y - 4);
          ctx.lineTo(cx + 40, y);
          ctx.closePath();
        } else ctx.rect(cx, y - 12, 39.5, 12);
        ctx.fill();
      }
      rect(ctx, 'stripe', cx, y - 4.5, c === 2 ? 40 : 39.5, 2);
      rect(ctx, 'stripe2', cx, y - 2.5, c === 2 ? 40 : 39.5, 1);
      if (setFill(ctx, 'twin')) {
        for (let w = 0; w < 4; w++) ctx.fillRect(cx + 3 + w * 8, y - 10, 5, 4);
        ctx.globalAlpha = 1;
      }
    }
    ctx.globalAlpha = 1;
  }
  function stationSign(ctx, x, base) {
    ctx.save();
    ctx.translate(x, base);
    rect(ctx, 'xpost', -24, -26, 2.4, 26);
    rect(ctx, 'xpost', 22, -26, 2.4, 26);
    if (setFill(ctx, 'sign')) {
      ctx.beginPath();
      ctx.rect(-34, -56, 68, 32);
      ctx.fill();
    }
    rect(ctx, 'signLine', -34, -38, 68, 3.5);
    if (setFill(ctx, 'signText')) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = FONT_STATION;
      ctx.fillText('やおき', 0, -50);
      ctx.font = FONT_SMALL;
      ctx.fillText('YAOKI', 0, -41);
      ctx.textAlign = 'left';
      ctx.fillText('ななころび', -32, -30);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  // ----- 城下町: a castle town, white walls and pines, koi in the moat, the castle ahead -----
  scene({
    id: 'joka', ja: '城下町', en: 'Castle town', stillT: 8,
    sky: { light: ['#DAE7F4', '#E8EFF3', '#F6F0E3'], dark: ['#0C1326', '#121A32', '#1B2340'] },
    light: {
      hill: '#CEDAE2', stone: '#D9D3C7', stoneLine: ['#CBC4B6', 1], cwall: '#F4F2EC', croof: '#B6C1D7', croofEdge: '#A7B3CC', cwin: '#C9D2E2', gold: '#E9D49A',
      far: '#D6DDEA', wall: '#E8E3D7', wroof: '#C0C9DB', namako: ['#D6D9E1', 0.7], pine: '#BDCFC5', pine2: '#B1C5BB', trunk: '#CDBFAD',
      moat: '#D4E4EB', ripple: ['#F2F7FA', 0.9], k1: '#F4CFB5', k2: '#FBF6EE', ground: '#F0EFE9', groundEdge: '#E5E2D9',
    },
    dark: {
      hill: '#141B32', stone: '#1A2036', stoneLine: ['#232A42', 1], cwall: '#2C3554', croof: '#141A2E', croofEdge: '#1D2440', cwin: ['#F0C46B', 0.55], gold: '#8C7A4C',
      far: '#121830', wall: '#1A2036', wroof: '#10162A', namako: ['#232A42', 1], pine: '#0F1A26', pine2: '#0D1622', trunk: '#141A2C',
      moat: '#121A30', ripple: ['#2C3858', 0.8], k1: '#4A3C44', k2: '#3E4258', ground: '#141A2D', groundEdge: '#171E33', castleGlow: ['#7F8CC4', 0.18],
    },
    make() {
      return {
        stars: starLayer(131, 9, -60, 100),
        cloud: cloudLayer(132, 440, 24, 66, 46, 96),
        hill: layer(133, 420, 4, ['hill'], (P, R, i, items, tw) => ridge(P[0], i, tw, 133, 140, 16, 160, 10)),
        far: layer(134, 252, 40, ['far'], (P, R, i) => {
          for (let k = 0; k < 9; k++) {
            const g = i * 9 + k;
            const h = 12 + hash(134, g) * 14;
            P[0].rect(k * 28, G - h - 16, 28.6, h + 18);
            if (hash(135, g) < 0.7) tri(P[0], k * 28 - 3, G - h - 15.5, k * 28 + 14, G - h - 23, k * 28 + 31, G - h - 15.5);
          }
        }),
        pines: layer(136, 300, 60, ['trunk', 'pine2', 'pine'], (P, R) => {
          if (R() < 0.75) pine(P, R, 40 + R() * 100, 142, 0.9 + R() * 0.4);
          if (R() < 0.4) pine(P, R, 170 + R() * 90, 142, 0.7 + R() * 0.3);
        }),
        wall: layer(137, 260, 40, ['wall', 'wroof', ['namako', 0.8], 'moat'], (P, R, i, items, tw) => {
          P[0].rect(0, 141, tw + 1, 15);
          quad(P[1], -1, 142, tw + 2, 142, tw + 2, 137, -1, 137);
          P[1].rect(-1, 135.6, tw + 2, 1.6);
          for (let x = 0; x < tw; x += 8) {
            line(P[2], x, 147, x + 8, 155);
            line(P[2], x + 8, 147, x, 155);
          }
          P[3].rect(0, 156, tw + 1, 13);
          if (R() < 0.7) items.push({ x: R() * tw, y: 160 + R() * 5, k: R() < 0.5 ? 'k1' : 'k2', ph: R() * TAU, s: 6 + R() * 2 });
          if (R() < 0.5) items.push({ x: R() * tw, y: 160 + R() * 5, k: 'k2', ph: R() * TAU, s: 5 + R() * 2 });
        }, (ctx, items) => {
          for (let q = 0; q < items.length; q++) {
            const k = items[q];
            if (!setFill(ctx, k.k)) continue;
            const dx = Math.sin(F.t * 0.25 + k.ph) * 30;
            const dir = Math.cos(F.t * 0.25 + k.ph) > 0 ? -1 : 1;
            ctx.save();
            ctx.translate(k.x + dx, k.y + Math.sin(F.t * 0.6 + k.ph) * 1.2);
            ctx.scale(-dir * k.s, k.s * 0.8);
            ctx.fill(U.fish);
            ctx.restore();
          }
          ctx.globalAlpha = 1;
        }),
        ripples: layer(138, 220, 30, ['ripple'], (P, R) => {
          for (let k = 0; k < 4; k++) ell(P[0], R() * 220, 158 + R() * 9, 4 + R() * 8, 0.6);
        }),
      };
    },
    paint(ctx, f, L) {
      skyFill(ctx, 'sky');
      if (f.dark) drawLayer(ctx, L.stars, f.scroll * 0.02);
      const sx = f.W * (0.22 + 0.4 * f.pj);
      const sy = 50 - 22 * Math.sin(Math.PI * f.pj);
      celestial(ctx, sx, sy, 12);
      drawLayer(ctx, L.cloud, f.scroll * 0.04 + f.t * 2);
      castle(ctx, f.W * (0.92 - 0.24 * f.pj), 138, 0.8 + 0.35 * f.pj);
      drawLayer(ctx, L.hill, f.scroll * 0.05);
      drawLayer(ctx, L.far, f.scroll * 0.2);
      drawLayer(ctx, L.pines, f.scroll * 0.5);
      drawLayer(ctx, L.wall, f.scroll * 0.6);
      drawLayer(ctx, L.ripples, f.scroll * 0.6 + f.t * 1.5);
      ground(ctx, 'groundEdge');
      seasonal(ctx);
      hanamaru(ctx, sx, sy, 21, f.fin);
    },
  });
  const TIERS = [-28, -26, 56, 18, -21, -48, 42, 14, -14, -66, 28, 12];
  // The castle keep (天守): stone walls with curved sides, white storeys and grey roofs
  // whose eaves turn up at the ends, gold dolphins on the top ridge.
  function castle(ctx, x, base, s) {
    ctx.save();
    ctx.translate(x, base);
    ctx.scale(s, s);
    if (F.dark) glow(ctx, 0, -50, 70, 'castleGlow', 1);
    if (setFill(ctx, 'stone')) {
      ctx.beginPath();
      ctx.moveTo(-46, 0);
      ctx.quadraticCurveTo(-36, -8, -34, -26);
      ctx.lineTo(34, -26);
      ctx.quadraticCurveTo(36, -8, 46, 0);
      ctx.closePath();
      ctx.fill();
    }
    if (F.C.stoneLine) {
      ctx.strokeStyle = F.C.stoneLine;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      for (let y = -21; y < 0; y += 5) {
        ctx.moveTo(-40 - y * 0.25, y);
        ctx.lineTo(40 + y * 0.25, y);
      }
      ctx.stroke();
    }
    for (let k = 0; k < 3; k++) {
      const tx = TIERS[k * 4];
      const ty = TIERS[k * 4 + 1];
      const tw = TIERS[k * 4 + 2];
      const th = TIERS[k * 4 + 3];
      rect(ctx, 'cwall', tx, ty - th, tw, th);
      if (setFill(ctx, 'cwin')) {
        for (let wx = tx + 5; wx < tx + tw - 6; wx += 8) ctx.fillRect(wx, ty - th * 0.62, 4, 4);
      }
      // the roof over this storey, eaves turned up
      if (setFill(ctx, 'croof')) {
        const rx = tx - 7;
        const rw = tw + 14;
        const ry = ty - th;
        ctx.beginPath();
        ctx.moveTo(rx - 2, ry - 1);
        ctx.quadraticCurveTo(rx + 6, ry - 2, rx + 10, ry - 8);
        ctx.lineTo(rx + rw - 10, ry - 8);
        ctx.quadraticCurveTo(rx + rw - 6, ry - 2, rx + rw + 2, ry - 1);
        ctx.lineTo(rx + rw - 4, ry + 1.5);
        ctx.lineTo(rx + 4, ry + 1.5);
        ctx.closePath();
        ctx.fill();
        if (k < 2) {
          // a little gable (千鳥破風) on the roof
          ctx.beginPath();
          ctx.moveTo(-9, ry - 7);
          ctx.lineTo(0, ry - 14);
          ctx.lineTo(9, ry - 7);
          ctx.closePath();
          ctx.fill();
        }
      }
      rect(ctx, 'croofEdge', tx - 5, ty - th - 1, tw + 10, 1.4);
    }
    // the top roof and its gold shachihoko
    if (setFill(ctx, 'croof')) {
      ctx.beginPath();
      ctx.moveTo(-22, -77);
      ctx.quadraticCurveTo(-14, -79, -10, -86);
      ctx.lineTo(10, -86);
      ctx.quadraticCurveTo(14, -79, 22, -77);
      ctx.closePath();
      ctx.fill();
    }
    if (setFill(ctx, 'gold')) {
      // the shachihoko: two little gold fish on the ridge, tails up
      ctx.beginPath();
      for (let d = -1; d <= 1; d += 2) {
        ctx.moveTo(d * 10, -86);
        ctx.quadraticCurveTo(d * 8, -89, d * 9.5, -91.5);
        ctx.lineTo(d * 11, -90);
        ctx.quadraticCurveTo(d * 11.5, -88, d * 12, -86);
        ctx.closePath();
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ---------- which place for which stage ----------

  // Course weeks go round the places in this order, each level starting further on, so
  // neighbouring weeks are always somewhere different.
  const ORDER = ['shitamachi', 'umi', 'chikurin', 'machi', 'tanbo', 'uchuu', 'joka', 'uminaka', 'fuji', 'matsuri', 'yukiguni', 'densha'];
  // lookups on objects without a prototype, so a key such as 'constructor' finds nothing
  const table = (o) => Object.assign(Object.create(null), o);
  const LEVEL_START = table({ N5: 0, N4: 3, N3: 6, N2: 9, N1: 1 });
  const STAGE = table({
    'romaji:basic': 'shitamachi', 'romaji:voiced': 'chikurin', 'romaji:katakana': 'machi', 'romaji:words': 'matsuri', 'romaji:phrases': 'densha',
    'symbol:plain': 'uchuu', 'symbol:shifted': 'uminaka', 'symbol:punct': 'fuji', 'symbol:all': 'umi',
    'keys:home': 'tanbo', 'keys:top': 'yukiguni', 'keys:bottom': 'joka', 'keys:number': 'umi', 'keys:shift': 'chikurin', 'keys:all': 'fuji',
    'kanji:single': 'fuji', 'kanji:jukugo': 'joka', 'kanji:advanced': 'yukiguni', 'kanji:yoji': 'chikurin', 'kanji:sentences': 'densha',
    'keys-kanji:single': 'machi', 'keys-kanji:jukugo': 'uminaka', 'keys-kanji:advanced': 'uchuu', 'keys-kanji:yoji': 'shitamachi', 'keys-kanji:sentences': 'matsuri',
  });
  const MODE_DEFAULT = table({
    romaji: 'shitamachi', symbol: 'uchuu', keys: 'tanbo', course: 'shitamachi', kanji: 'fuji', 'keys-course': 'tanbo', 'keys-kanji': 'machi',
  });

  function forStage(key) {
    const k = typeof key === 'string' ? key : '';
    if (STAGE[k]) return STAGE[k];
    const m = /^(?:keys-)?course:(N\d)u(\d+)$/.exec(k);
    if (m) {
      const start = LEVEL_START[m[1]] !== undefined ? LEVEL_START[m[1]] : 0;
      return ORDER[(start + Math.max(0, parseInt(m[2], 10) - 1)) % ORDER.length];
    }
    const mode = k.split(':')[0];
    if (MODE_DEFAULT[mode] && k.indexOf(':') > 0) {
      // an unknown stage of a known mode: the same place every time for the same key
      let h = 0;
      for (let i = 0; i < k.length; i++) h = (Math.imul(h, 31) + k.charCodeAt(i)) | 0;
      return ORDER[(h >>> 0) % ORDER.length];
    }
    return MODE_DEFAULT[mode] || DEFAULT;
  }

  // ---------- drawing a frame ----------

  const BY_ID = Object.create(null);
  for (const d of DEFS) BY_ID[d.id] = d;

  // The colours of a scene for a mode and season, with its sky's stops, made once.
  function paletteOf(S, dark, season) {
    const mode = dark ? 'dark' : 'light';
    if (!S.pals) S.pals = [[], []];
    const si = SEASONS.indexOf(season);
    const got = S.pals[dark ? 1 : 0][si];
    if (got) return got;
    const C = {};
    const A = {};
    const put = (src) => {
      if (!src) return;
      for (const k in src) {
        const v = src[k];
        if (Array.isArray(v)) {
          C[k] = v[0];
          A[k] = v[1];
        } else {
          C[k] = v;
          delete A[k];
        }
      }
    };
    put(BASE[mode]);
    put(S[mode]);
    put(S.seasons && S.seasons[season] && S.seasons[season][mode]);
    const stops = {};
    for (const k in S.sky) if (k === mode || (k !== 'light' && k !== 'dark' && !dark)) stops[k === mode ? 'sky' : k] = S.sky[k];
    return (S.pals[dark ? 1 : 0][si] = { C, A, stops, grad: {}, glow: {} });
  }

  // Progress, eased: a landmark comes closer smoothly even when the round's progress moves in steps.
  const SM = { id: '', p: 0, t: 0 };

  // The season by the calendar, when the game passes none (worked out once a page visit).
  let seasonCache = '';
  function seasonNow() {
    if (!seasonCache) {
      const m = new Date().getMonth();
      seasonCache = m >= 2 && m <= 4 ? 'spring' : m >= 5 && m <= 7 ? 'summer' : m >= 8 && m <= 10 ? 'autumn' : 'winter';
    }
    return seasonCache;
  }
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);

  function draw(ctx, o) {
    if (!ctx || typeof ctx.fillRect !== 'function') return;
    o = o || {};
    let saved = false;
    try {
      if (typeof Path2D !== 'function') throw new Error('no Path2D');
      if (!U.ready) init();
      const S = (typeof o.scene === 'string' && BY_ID[o.scene]) || BY_ID[DEFAULT];
      const dy = num(o.ground, G) - G;
      F.W = clamp(num(o.W, 600), 0, 4000);
      F.top = num(o.top, 0) - dy;
      F.bottom = Math.max(F.top, num(o.bottom, H) - dy);
      F.still = !!o.still;
      F.dark = !!o.dark;
      F.season = SEASONS.indexOf(o.season) >= 0 ? o.season : seasonNow();
      F.pal = o.pal && typeof o.pal === 'object' ? o.pal : null;
      F.scroll = F.still ? 0 : clamp(num(o.scroll, 0), -1e7, 1e7);
      F.t = F.still ? S.stillT : clamp(num(o.t, 0), -1e6, 1e6);
      const p = clamp(num(o.progress, 0), 0, 1);
      if (F.still) {
        SM.p = p;
        F.pj = 0.5;
        F.fin = p >= 0.9 ? 1 : 0;
      } else {
        const dt = F.t - SM.t;
        if (SM.id !== S.id || dt < 0 || dt > 1 || p < SM.p - 0.25) SM.p = p;
        else SM.p += (p - SM.p) * Math.min(1, dt * 2.5);
        F.pj = SM.p;
        F.fin = smooth(0.86, 1, SM.p);
      }
      SM.id = S.id;
      SM.t = F.t;
      const K = paletteOf(S, F.dark, F.season);
      F.S = S;
      F.K = K;
      F.C = K.C;
      F.A = K.A;
      if (!S.L) S.L = S.make();
      ctx.save();
      saved = true;
      if (dy) ctx.translate(0, dy);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.setLineDash(NONE);
      S.paint(ctx, F, S.L);
      ctx.restore();
      saved = false;
    } catch (e) {
      try {
        if (saved) ctx.restore();
        ctx.fillStyle = (o.pal && o.pal.ground) || (o.dark ? '#12172A' : '#F4F5F9');
        ctx.fillRect(0, num(o.top, 0), num(o.W, 600), num(o.bottom, H) - num(o.top, 0));
      } catch (e2) { /* nothing more to do */ }
      if (!draw.warned) {
        draw.warned = true;
        if (window.console) console.warn('TypingScenes:', e);
      }
    }
  }

  // SCENES: [{ id, ja, en }]. forStage(key): the scene id for a stage key ('romaji:basic',
  // 'keys:home', 'course:N5u3', 'keys-kanji:yoji' …), the same every time. draw(ctx, o) paints
  // the whole background of a frame, in logical units on a context already scaled, with
  // o = { scene, W, top, bottom, ground, scroll, progress, t, still, dark, season, pal }:
  // the visible box x 0..W, y top..bottom; the route at y ground (168); scroll, the distance
  // travelled this round; progress 0..1 through it; t, seconds; still, reduced motion (one
  // fixed frame); dark, the night version; season 'spring' | 'summer' | 'autumn' | 'winter';
  // pal, the page's colour tokens (only pal.stamp, for the はなまる, and pal.ground are read).
  window.TypingScenes = {
    SCENES: DEFS.map((d) => ({ id: d.id, ja: d.ja, en: d.en })),
    forStage,
    draw,
  };
})();
