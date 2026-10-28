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
 * The game draws a faint graph paper, the route, Yaoki and the cards over it. The scenes are
 * bold cut paper: saturated colours, far layers light and cool and near ones deep and rich,
 * a dramatic sky, and by night bright windows, lanterns and neon that glow. The cards and
 * Yaoki are inked stickers, so they stand out from it; the band under the route, where the
 * romaji is typed, stays a flat tint the hint text reads on. With reduced motion a scene is
 * one fixed frame.
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
      glow(ctx, x, y, r * 8, 'moonGlow', 0.35);
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
      glow(ctx, x, y, r * 8, 'sunGlow', 0.4);
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
    return layer(seed, tw, w1 + 10, ['cloudShade', 'cloud'], (P, R) => {
      const n = R() < 0.55 ? 1 : 2;
      for (let k = 0; k < n; k++) {
        const x = ((k + R() * 0.8) * tw) / n;
        const y = y0 + R() * (y1 - y0);
        const w = w0 + R() * (w1 - w0);
        // the cloud's shaded underside: the same shape, a little lower
        const s = Math.floor(R() * 4294967296);
        cloud(P[0], x, y + Math.max(2, w * 0.05), w, rng(s));
        cloud(P[1], x, y, w, rng(s));
      }
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
      sun: '#FFD45E', sunGlow: ['#FFE39A', 0.95], moon: '#FFF6DE', moonShade: '#EADFC0', moonGlow: ['#FFFFFF', 0.6],
      star: ['#8E86D8', 0.85], star2: ['#F2B43A', 0.85], cloud: ['#FFFFFF', 0.96], cloudShade: ['#C9DBF2', 0.9],
      petal: ['#F28DB2', 0.9], leaf1: ['#E8692F', 0.9], leaf2: ['#F2B43A', 0.9], leaf3: ['#D8433B', 0.85],
      snow: ['#FFFFFF', 0.95], fly: ['#D9EE3F', 0.95], dfly: ['#3F66D6', 0.8], bubble: ['#FFFFFF', 0.8],
    },
    dark: {
      sun: '#FFF1C8', sunGlow: ['#9DB2FF', 0.4], moon: '#FFF4D6', moonShade: '#E3D6AE', moonGlow: ['#B4C6FF', 0.5],
      star: ['#FFFFFF', 0.95], star2: ['#FFD27A', 0.9], cloud: ['#2A3266', 0.9], cloudShade: ['#1D2350', 0.9],
      petal: ['#F28DB2', 0.75], leaf1: ['#E8692F', 0.75], leaf2: ['#F2B43A', 0.75], leaf3: ['#D8433B', 0.7],
      snow: ['#F4F7FF', 0.9], fly: ['#EEFF7A', 1], dfly: ['#8FA8FF', 0.75], bubble: ['#9EE6F5', 0.65],
    },
  };

  const DEFS = [];
  const scene = (d) => DEFS.push(d);

  // ----- 下町: the old town, tiled roofs and noren under power lines, Fuji far away -----
  scene({
    id: 'shitamachi', ja: '下町', en: 'Old town', stillT: 18,
    sky: { light: ['#3F8FE0', '#86C1F0', '#FDE3B4'], dark: ['#060A22', '#171C4C', '#3A2862'] },
    light: {
      fuji: '#6F86CC', fujiShade: '#5B70B8', cap: '#FFFFFF', far: '#93A6DA', chimney: '#7C90C8',
      wall: '#F7E6C4', wood: '#A86B42', roof: '#3C4A7C', roofLine: '#28325A', win: '#BBD9F5', winOff: '#8EA7CF',
      noren: '#2F4FD0', noren2: '#E2452B', woodLine: ['#6E4426', 0.85], plant: '#2E9A5A', vend: '#EAF4FF', vendLit: '#FFFFFF',
      pole: '#3B4060', wire: '#2E3352', ground: '#F7F0E2',
    },
    dark: {
      fuji: '#2B3672', fujiShade: '#222B60', cap: '#C7D2F7', far: '#1C2354', chimney: '#161C46',
      wall: '#262D5E', wood: '#1C2148', roof: '#12163C', roofLine: '#2E3780', win: ['#FFC45A', 0.95], winOff: '#202758',
      noren: '#3F5DE6', noren2: '#E2452B', woodLine: '#2A3166', plant: '#1E4A48', vend: '#2B3C78', vendLit: ['#9FE9FF', 0.95],
      pole: '#080B22', wire: '#3A4488', ground: '#141A34', blink: ['#FFC45A', 0.95],
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
  // Stalks at three depths, pale and cool far off, emerald, then deep green close by, the nearer
  // ones lit down one side; bands of light (of mist by night) at the foot of the far ones, beams
  // of sun (of moonlight) slanting between them, bamboo grass and paper lanterns along the path.
  // In spring shoots come up and in winter snow lies on the leaves: parts of the tiles that only
  // those seasons give a colour to.
  const GROVE_FAR = [0, -1, -1, 1, -1, 2, 3, 4];
  const GROVE_MID = [0, -1, 1, 2, 3, 4, 5, 6];
  const GROVE_NEAR = [0, 1, 2, 3, 4, 5, 6, 7];
  scene({
    id: 'chikurin', ja: '竹林', en: 'Bamboo grove', stillT: 6,
    sky: { light: ['#0F8F6C', '#3DB883', '#B3E58C', '#FFF3BE'], dark: ['#010D11', '#032429', '#08413F', '#0F5C52'] },
    light: {
      fStalk: '#A2DCC4', fNode: '#8ACDB3', fLeaf: '#8FD2B3', fLeaf2: '#B4E6CB', mist: ['#FFF5C9', 0.3], shaft: ['#FFE48E', 0.34],
      mStalk: '#3DAE6B', mLit: '#93E27C', mNode: '#22784A', mRing: '#D3F3B6', mLeaf: '#2E9C5C', mLeaf2: '#5CC46F',
      sasa: '#2A8F55', sasaLit: '#62C26A',
      nStalk: '#15774A', nShade: '#0E5C39', nLit: '#86DA6C', nNode: '#0B4C30', nRing: '#BDEBA0', nLeaf: '#12683F', nLeaf2: '#2B8E50',
      nSasa: '#0F6340', nSasaLit: '#3FA35A', lamp: '#FFF6E2', lampFrame: '#1B2440',
      glowGold: ['#FFB21C', 0.75], gold: '#FFCF3A', goldCore: '#FFF8D6', spark: ['#F2A51F', 0.95],
      ground: '#F3F6E4', groundEdge: '#DCEBC4',
    },
    dark: {
      moonGlow: ['#9CF0DA', 0.45],
      fStalk: '#1E5F5B', fNode: '#184F4C', fLeaf: '#1A5552', fLeaf2: '#246E68', mist: ['#2A8C80', 0.22], shaft: ['#C4FFF1', 0.1],
      mStalk: '#0C3A3A', mLit: '#3A9A8C', mNode: '#06252A', mRing: '#2B7A70', mLeaf: '#0A3434', mLeaf2: '#10494A',
      sasa: '#082C2D', sasaLit: '#1D5E58',
      nStalk: '#052124', nShade: '#03171A', nLit: '#5FD3BF', nNode: '#021416', nRing: '#2A6E66', nLeaf: '#041C1F', nLeaf2: '#0A2D30',
      nSasa: '#031A1C', nSasaLit: '#145048', lamp: '#FFC45A', lampFrame: '#1E140C', lampGlow: ['#FFB347', 0.55],
      glowGold: ['#FFCF5A', 0.85], gold: '#FFE07A', goldCore: '#FFF9E0', spark: ['#FFF3C4', 0.95],
      ground: '#0A1A1C', groundEdge: '#0F2629',
    },
    seasons: {
      // in spring some sprays turn yellow-green (竹の秋, the bamboo's own autumn) and shoots come up
      spring: {
        light: { fLeaf2: '#D4ECA2', mLeaf2: '#A9D455', nLeaf2: '#8CBE45', shoot: '#8C5A3A', shootTip: '#C99A62' },
        dark: { shoot: '#2B1F18', shootTip: '#4C3826' },
      },
      autumn: { light: { shaft: ['#FFD27A', 0.36], mist: ['#FFE6B0', 0.32] } },
      winter: {
        light: { fSnow: '#FFFFFF', mSnow: '#FFFFFF', nSnow: '#FFFFFF', sasaSnow: '#FFFFFF', mist: ['#F4FAFF', 0.34], shaft: ['#FFF3C4', 0.32] },
        dark: { fSnow: '#6F9EA3', mSnow: '#B7DEE0', nSnow: '#D3EEEF', sasaSnow: '#B7DEE0' },
      },
    },
    make() {
      return {
        stars: starLayer(21, 6, -60, 60),
        b1: layer(22, 300, 40, ['fStalk', 'fNode', 'fLeaf', 'fLeaf2', 'fSnow'], (P, R, i, items, tw) => {
          for (let k = 0; k < 9; k++) {
            if (R() < 0.12) continue;
            stalk(P, R, ((k + 0.2 + R() * 0.6) * tw) / 9, 2.8 + R() * 1.6, (R() - 0.5) * 10, 0.35, GROVE_FAR);
          }
        }),
        // the light at the foot of the far stalks, in two bands like sheets of tracing paper
        mist: layer(26, 400, 4, ['mist', 'mist'], (P, R, i, items, tw) => {
          ridge(P[0], i, tw, 26, 132, 12, 90, 10);
          ridge(P[1], i, tw, 27, 152, 8, 70, 10);
        }),
        shafts: layer(23, 260, 170, [], (P, R, i, items) => {
          items.push({ x: R() * 260, w: 8 + R() * 9, ph: R() * TAU });
        }, (ctx, items) => {
          if (!setFill(ctx, 'shaft')) return;
          const a = ctx.globalAlpha;
          for (let q = 0; q < items.length; q++) {
            const s = items[q];
            const k = a * (0.6 + 0.4 * Math.sin(F.t * 0.35 + s.ph));
            // a wide faint beam round a brighter core
            ctx.globalAlpha = k * 0.5;
            groveBeam(ctx, s.x, s.w * 2.1);
            ctx.globalAlpha = k;
            groveBeam(ctx, s.x, s.w);
          }
          ctx.globalAlpha = 1;
        }),
        b2: layer(24, 336, 40, ['mStalk', 'mLit', 'mNode', 'mRing', 'mLeaf', 'mLeaf2', 'mSnow', 'sasa', 'sasaLit', 'sasaSnow'], (P, R, i, items, tw) => {
          for (let k = 0; k < 5; k++) {
            if (R() < 0.12) continue;
            stalk(P, R, ((k + 0.2 + R() * 0.6) * tw) / 5, 6.4 + R() * 2.4, (R() - 0.5) * 14, 0.6, GROVE_MID);
          }
          bambooGrass(P[7], P[8], P[9], i, tw, 24, 157, 6);
        }),
        b3: layer(25, 280, 60, ['nStalk', 'nShade', 'nLit', 'nNode', 'nRing', 'nLeaf', 'nLeaf2', 'nSnow', 'shoot', 'shootTip', 'nSasa', 'nSasaLit', 'lamp', 'lampFrame'],
          (P, R, i, items, tw) => {
            const x = 30 + R() * (tw - 60);
            stalk(P, R, x, 14 + R() * 4, (R() - 0.5) * 18, 0.75, GROVE_NEAR);
            if (R() < 0.4) stalk(P, R, wrap(x + 100 + R() * 80, tw), 9 + R() * 3, (R() - 0.5) * 14, 0.6, GROVE_NEAR);
            if (R() < 0.8) bambooShoot(P[8], P[9], x + (R() < 0.5 ? -1 : 1) * (14 + R() * 10), 10 + R() * 8);
            bambooClump(P[10], P[11], R, x);
            if (R() < 0.7) {
              const lx = wrap(x + 60 + R() * (tw - 120), tw);
              bambooAndon(P[12], P[13], lx);
              items.push({ x: lx, y: G - 21, ph: R() * TAU });
            }
          }, (ctx, items) => {
            // by night the lanterns glow, and flicker a little
            if (!F.dark) return;
            for (let q = 0; q < items.length; q++) {
              const it = items[q];
              glow(ctx, it.x, it.y, 24, 'lampGlow', 0.85 + 0.15 * Math.sin(F.t * 2.3 + it.ph));
            }
          }),
      };
    },
    paint(ctx, f, L) {
      skyFill(ctx, 'sky');
      if (f.dark) drawLayer(ctx, L.stars, f.scroll * 0.02);
      const sx = f.W * (0.3 + 0.45 * f.pj);
      const sy = 30 - 10 * Math.sin(Math.PI * f.pj);
      celestial(ctx, sx, sy, 12);
      drawLayer(ctx, L.b1, f.scroll * 0.12);
      drawLayer(ctx, L.mist, f.scroll * 0.2);
      drawLayer(ctx, L.shafts, f.scroll * 0.25);
      drawLayer(ctx, L.b2, f.scroll * 0.42);
      const kx = f.W * (1.06 - 0.24 * f.fin);
      if (f.fin > 0) kaguyaStalk(ctx, kx, f.fin);
      drawLayer(ctx, L.b3, f.scroll * 0.95);
      if (f.fin > 0) kaguyaLight(ctx, kx, f.fin, f.still);
      ground(ctx, 'groundEdge');
      seasonal(ctx);
      hanamaru(ctx, sx, sy, 21, f.fin);
    },
  });
  // A bamboo stalk from the ground up out of the picture: lit down its left side and shaded
  // down its right, its rings each with the pale bloom under it, and sprays of leaves.
  // I gives the role of each part: [stalk, shade, lit, ring, bloom, leaf, leaf2, snow], -1 for none.
  function stalk(P, R, x, w, lean, leafy, I) {
    const top = -100;
    const at = (y) => x + (lean * (G - y)) / (G - top);
    const strip = (p, a, b) => {
      p.moveTo(x + w * (a - 0.5), G + 1);
      p.lineTo(at(top) + w * 0.84 * (a - 0.5), top);
      p.lineTo(at(top) + w * 0.84 * (b - 0.5), top);
      p.lineTo(x + w * (b - 0.5), G + 1);
      p.closePath();
    };
    strip(P[I[0]], 0, 1);
    if (I[1] >= 0) strip(P[I[1]], 0.64, 1);
    if (I[2] >= 0) strip(P[I[2]], 0.12, 0.34);
    let y = G - 14 - R() * 22;
    while (y > top + 8) {
      const cx = at(y);
      const ww = w * (1 - (0.16 * (G - y)) / (G - top));
      const nh = Math.max(1.1, w * 0.13);
      P[I[3]].rect(cx - ww * 0.58, y, ww * 1.16, nh);
      if (I[4] >= 0) P[I[4]].rect(cx - ww * 0.5, y + nh, ww, Math.max(0.7, w * 0.07));
      if (y < 56 && y > -86 && R() < leafy) {
        const s = R() < 0.5 ? -1 : 1;
        const len = 6 + w * 1.4 + R() * 5;
        const ox = cx + s * ww * 0.45;
        bambooSpray(P[I[R() < 0.4 ? 6 : 5]], R, ox, y + 1, s, 3 + Math.floor(R() * 3), len);
        if (I[7] >= 0) {
          // a lump of snow lying on the top of the spray
          const ex = ox + s * len * 0.3;
          const ey = y + len * 0.1 - 1.2;
          const rx = len * 0.26;
          const rot = s * 0.38;
          P[I[7]].moveTo(ex + Math.cos(rot) * rx, ey + Math.sin(rot) * rx);
          P[I[7]].ellipse(ex, ey, rx, 1.5 + w * 0.1, rot, 0, TAU);
        }
      }
      y -= 24 + R() * 14;
    }
  }
  // A spray of bamboo leaves from (x, y) to the side s (1 right, -1 left), drooping, cut as one
  // shape: n narrow pointed leaves joined near the stalk.
  function bambooSpray(p, R, x, y, s, n, len) {
    const a0 = s > 0 ? 0.45 : Math.PI - 0.45;
    p.moveTo(x, y);
    for (let k = 0; k < n; k++) {
      const a = a0 + (k - (n - 1) / 2) * 0.32 + (R() - 0.5) * 0.12;
      const l = len * (0.8 + R() * 0.35);
      const b = l * 0.4;
      p.lineTo(x + Math.cos(a - 0.17) * b, y + Math.sin(a - 0.17) * b);
      p.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      p.lineTo(x + Math.cos(a + 0.17) * b, y + Math.sin(a + 0.17) * b);
    }
    p.closePath();
  }
  // Bamboo grass (笹) along the foot of the grove: a band whose top edge is a run of broad leaf
  // tips, the same where two tiles meet (tw a multiple of 12); some tips catch the light, and in
  // winter snow lies on some.
  function bambooGrass(p, lit, snow, i, tw, seed, base, amp) {
    const x0 = i * tw;
    p.moveTo(0, G + 2);
    let x = 0;
    for (; x <= tw; x += 12) {
      const y = base - amp * hills(seed, x0 + x, 46);
      const tip = y - 4 - 6 * hash(seed, x0 + x);
      const tx = x + 5 + 2 * hash(seed + 2, x0 + x);
      p.lineTo(x, y + 2);
      p.lineTo(tx, tip);
      const h = hash(seed + 1, x0 + x);
      if (h < 0.2) tri(lit, x + 1.5, y + 1.6, tx, tip, tx + 1.5, y + 1);
      if (h > 0.6) tri(snow, tx - 2.4, tip + 3.8, tx, tip - 0.4, tx + 2.2, tip + 4);
    }
    p.lineTo(x - 6, G + 2);
    p.closePath();
  }
  // A clump of bamboo grass at the foot of a stalk: leaves fanning up and out.
  function bambooClump(p, lit, R, x) {
    const n = 6 + Math.floor(R() * 3);
    for (let k = 0; k < n; k++) {
      const u = k / (n - 1);
      const ang = -Math.PI + 0.35 + u * (Math.PI - 0.7) + (R() - 0.5) * 0.2;
      const len = (13 + R() * 9) * (1 - 0.35 * Math.abs(u - 0.5));
      leaf(k % 3 === 1 ? lit : p, x + (u - 0.5) * 12, G + 1, len, ang, 2.6);
    }
  }
  // A bamboo shoot (筍) coming up: a cone of brown sheaths.
  function bambooShoot(p, tip, x, h) {
    tri(p, x - h * 0.34, G + 1, x + h * 0.04, G - h, x + h * 0.34, G + 1);
    tri(tip, x - h * 0.3, G - h * 0.12, x - h * 0.02, G - h * 0.78, x + h * 0.08, G - h * 0.2);
    tri(tip, x + h * 0.02, G + 1, x + h * 0.24, G - h * 0.42, x + h * 0.34, G + 1);
  }
  // A paper lantern (行灯) on a short post along the path, lit at night.
  function bambooAndon(paper, frame, x) {
    paper.rect(x - 4.6, G - 27.2, 9.2, 12);
    frame.rect(x - 1.3, G - 14, 2.6, 15);
    frame.rect(x - 5.2, G - 15.4, 10.4, 1.8);
    frame.rect(x - 6.2, G - 29.6, 12.4, 2.4);
    frame.rect(x - 0.45, G - 27.2, 0.9, 12);
  }
  // A beam of light slanting down through the grove from x at the top, hw half wide there.
  function groveBeam(ctx, x, hw) {
    const y0 = F.top - 4;
    ctx.beginPath();
    ctx.moveTo(x - hw, y0);
    ctx.lineTo(x + hw, y0);
    ctx.lineTo(x + 84 + hw * 2.2, G);
    ctx.lineTo(x + 84 - hw * 2.2, G);
    ctx.closePath();
    ctx.fill();
  }
  // The finishing touch: one stalk that glows from inside, as in the tale of Kaguya-hime, comes
  // in from the right among the middle stalks (k: how far the finale has come)...
  function kaguyaStalk(ctx, x, k) {
    glow(ctx, x, 124, 66, 'glowGold', 0.8 * k);
    rect(ctx, 'mStalk', x - 3.8, F.top - 2, 7.6, G - F.top + 3);
    rect(ctx, 'mLit', x - 2.8, F.top - 2, 1.7, G - F.top + 3);
    rect(ctx, 'mNode', x - 4.4, 98, 8.8, 2.4);
    rect(ctx, 'mNode', x - 4.4, 148, 8.8, 2.4);
    if (setFill(ctx, 'gold')) {
      ctx.globalAlpha *= k;
      ctx.fillRect(x - 3.8, 100.4, 7.6, 47.6);
    }
    if (setFill(ctx, 'goldCore')) {
      ctx.globalAlpha *= k;
      ctx.fillRect(x - 1.6, 106, 3.2, 36);
    }
    ctx.globalAlpha = 1;
  }
  // ...and its light, drawn over the near stalks: thin rays from the glowing joint and sparks
  // twinkling round it.
  function kaguyaLight(ctx, x, k, still) {
    const y = 124;
    if (setFill(ctx, 'spark')) {
      ctx.globalAlpha *= k;
      const turn = still ? 0 : F.t * 0.2;
      ctx.beginPath();
      for (let r = 0; r < 4; r++) {
        const a = turn + (r * Math.PI) / 4;
        const c = Math.cos(a);
        const s = Math.sin(a);
        const len = r % 2 ? 26 : 40;
        ctx.moveTo(x + c * len, y + s * len);
        ctx.lineTo(x - s * 1.3, y + c * 1.3);
        ctx.lineTo(x - c * len, y - s * len);
        ctx.lineTo(x + s * 1.3, y - c * 1.3);
        ctx.closePath();
      }
      for (let q = 0; q < 6; q++) {
        const ang = hash(q, 611) * TAU;
        const d = 16 + 18 * hash(q, 612);
        const tw = Math.abs(Math.sin(F.t * (1.2 + hash(q, 613)) + q * 2.1));
        const r = (2.4 + 2.4 * hash(q, 614)) * (0.4 + 0.6 * tw);
        const px = x + Math.cos(ang) * d;
        const py = y + Math.sin(ang) * d * 1.4;
        ctx.moveTo(px, py - r);
        ctx.quadraticCurveTo(px, py, px + r, py);
        ctx.quadraticCurveTo(px, py, px, py + r);
        ctx.quadraticCurveTo(px, py, px - r, py);
        ctx.quadraticCurveTo(px, py, px, py - r);
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    glow(ctx, x, y, 22, 'glowGold', k);
  }

  // ----- 海: the sea, Hokusai's waves, sails and gulls, a lighthouse ahead -----
  const HZ = 114;   // the sea's horizon
  scene({
    id: 'umi', ja: '海', en: 'The sea', stillT: 9,
    // a deep blue sky going warm and bright down to the horizon (y 112 is the fifth stop)
    sky: {
      light: ['#1A56CC', '#2F7EE2', '#58A8F0', '#9AD3F6', '#FFEDBE', '#FFD991', '#FFCB78'],
      dark: ['#02051C', '#070D3A', '#111654', '#231E68', '#462C78', '#5A3478', '#5A3478'],
    },
    light: {
      seaTop: '#1B4FB6', sea: '#22B4DA', seaMid: '#1E9BD4', seaDeep: '#1C80CE',
      island: '#7E90D6', island2: '#B3BDEA', crest: ['#FFFFFF', 0.85],
      swell: '#1A5EC0', swellRim: ['#8FD4FF', 0.9], wave: '#163C9C', waveIn: '#2A6BD0', waveLine: ['#CFEBFF', 0.9],
      foam: '#FFFFFF', spray: ['#FFFFFF', 0.9], near: '#122E84', foamNear: ['#FFFFFF', 0.95],
      hull: '#E2452B', sail: '#FFFFFF', jib: '#FFF1CC', gull: ['#1E2A66', 0.85],
      cape: '#3D55AC', capeTop: '#2E9A6A', lh: '#FFFFFF', lhShade: ['#2A3A86', 0.2], lhBand: '#E2452B', lhRoof: '#2A3A86', lhGlass: '#9ED8FF',
      glint: ['#FFFBEA', 0.95], glint2: ['#FFD45E', 0.95], ground: '#FAF4E6', groundEdge: '#EEDFC0',
    },
    dark: {
      seaTop: '#090D38', sea: '#28327F', seaMid: '#1F2A74', seaDeep: '#172268',
      island: '#25276A', island2: '#3A2F7A', crest: ['#A9B6FF', 0.7],
      swell: '#0E185A', swellRim: ['#5D74DA', 0.8], wave: '#0A124C', waveIn: '#16247C', waveLine: ['#6F86E8', 0.75],
      foam: '#C4CDFF', spray: ['#C4CDFF', 0.75], near: '#070B34', foamNear: ['#8B9BEA', 0.9],
      hull: '#10184A', sail: '#8E9CE0', jib: '#7D8BD2', lantern: ['#FFC45A', 0.95], gull: ['#C9D3FF', 0.7],
      cape: '#131A50', capeTop: '#172C58', lh: '#C3CBF0', lhShade: ['#0A1040', 0.35], lhBand: '#C2414A', lhRoof: '#232C74', lhGlass: '#FFE08A',
      beam: ['#FFE7A8', 0.42], lamp: ['#FFD36A', 0.95], glint: ['#FFF4D6', 0.95], glint2: ['#FFD27A', 0.9], ground: '#0F1630', groundEdge: '#18204A',
    },
    make() {
      return {
        stars: starLayer(31, 9, -60, 100),
        cloud: cloudLayer(32, 460, 30, 76, 50, 110),
        // islands on the horizon, and a long, paler coast further off behind them
        islands: layer(33, 520, 120, ['island2', 'island'], (P, R) => {
          if (R() < 0.5) {
            const x = R() * 300;
            const w = 140 + R() * 120;
            P[0].moveTo(x, HZ + 1);
            P[0].quadraticCurveTo(x + w * 0.2, HZ - 9 - R() * 5, x + w * 0.45, HZ - 7);
            P[0].quadraticCurveTo(x + w * 0.75, HZ - 5 - R() * 4, x + w, HZ + 1);
            P[0].closePath();
          }
          if (R() < 0.6) {
            const x = R() * 400;
            const w = 40 + R() * 90;
            P[1].moveTo(x, HZ + 1);
            P[1].quadraticCurveTo(x + w * 0.3, HZ - 8 - R() * 8, x + w * 0.55, HZ - 6);
            P[1].quadraticCurveTo(x + w * 0.8, HZ - 4, x + w, HZ + 1);
            P[1].closePath();
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
            fillP(ctx, 'jib', U.jib);
            // by night a lantern at the stern, and its light on the water
            if (F.dark) {
              glow(ctx, 9, -3, 11, 'lantern', 1);
              rect(ctx, 'lantern', 8, -4, 2, 2);
              rect(ctx, 'lantern', 8.5, 4.5, 1, 5);
            }
            ctx.restore();
          }
        }),
        // the sea in bands of colour, deeper as they come nearer, each with a gentle swell
        seaMid: layer(38, 420, 10, ['seaMid'], (P, R, i, items, tw) => ridge(P[0], i, tw, 38, 133, 4, 90, 14)),
        seaDeep: layer(39, 420, 10, ['seaDeep'], (P, R, i, items, tw) => ridge(P[0], i, tw, 39, 146, 5, 110, 14)),
        crests: layer(35, 300, 20, ['crest'], (P, R) => {
          for (let k = 0; k < 7; k++) {
            const y = HZ + 8 + R() * 22;
            const w = 4 + (y - HZ) * 0.35 * (0.6 + R());
            ell(P[0], R() * 300, y, w, 0.7);
          }
        }),
        waves: layer(36, 460, 140, ['swell', 'swellRim', 'wave', 'waveIn', ['waveLine', 1.1], 'foam', 'spray'], (P, R, i, items, tw) => {
          ridge(P[0], i, tw, 36, 152, 10, 120, 10);
          // the swell's back catches the light: a thin band along its top
          const y = (x) => ridgeY(i, tw, x, 36, 152, 10, 120);
          P[1].moveTo(0, y(0));
          for (let x = 10; x <= tw; x += 10) P[1].lineTo(x, y(x));
          for (let x = tw; x >= 0; x -= 10) P[1].lineTo(x, y(x) + 1.4);
          P[1].closePath();
          if (R() < 0.75) bigWave(P, R, 80 + R() * 300, 0.75 + R() * 0.35);
          if (R() < 0.6) bigWave(P, R, R() * 460, 0.4 + R() * 0.2);
        }),
        near: layer(37, 340, 30, ['near', 'foamNear'], (P, R, i, items, tw) => {
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
      // the sea: a dark line on the horizon, then turquoise going deep blue near
      rect(ctx, 'sea', -1, HZ, f.W + 2, G - HZ + 2);
      rect(ctx, 'seaTop', -1, HZ, f.W + 2, 3);
      drawLayer(ctx, L.seaMid, f.scroll * 0.08);
      drawLayer(ctx, L.seaDeep, f.scroll * 0.14);
      drawLayer(ctx, L.islands, f.scroll * 0.03);
      // the lighthouse comes closer, and stops short of where the sun goes down
      lighthouse(ctx, f.W * (1.1 - 0.48 * f.pj), HZ + 2, 0.85 + 0.4 * f.pj);
      umiGlints(ctx, f, sx);
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
  // The sun's (or the moon's) road on the water: glints, white and gold by turns, widening
  // towards us, the road growing longer and brighter as it goes down to the sea.
  function umiGlints(ctx, f, sx) {
    const k0 = f.pj;
    const n = 8 + Math.round(7 * k0);
    for (let k = 0; k < n; k++) {
      if (!setFill(ctx, k % 2 ? 'glint2' : 'glint')) continue;
      const y = HZ + 2.5 + k * 3.2;
      const w = (7 + k * (2.4 + 1.8 * k0)) * (0.55 + 0.45 * Math.abs(Math.sin(f.t * 1.4 + k * 1.9)));
      ctx.globalAlpha *= (0.7 + 0.3 * k0) * (1 - k / (n + 1));
      ctx.fillRect(sx - w / 2 + Math.sin(f.t + k) * 2, y, w, 1.6);
    }
    ctx.globalAlpha = 1;
  }
  // A great wave in Hokusai's manner, curling over to the left, its lip in claws of foam.
  // P[2..6]: its body, inner band, lines, claws and spray.
  function bigWave(P, R, x, s) {
    const base = 156;
    const h = 40 * s;
    const w = 120 * s;
    const top = base - h;
    const body = P[2];
    body.moveTo(x + w * 0.75, base + 6);
    body.quadraticCurveTo(x + w * 0.35, base - h * 0.2, x + w * 0.12, top + h * 0.08);
    body.bezierCurveTo(x + w * 0.02, top - h * 0.12, x - w * 0.24, top - h * 0.1, x - w * 0.3, top + h * 0.32);
    body.quadraticCurveTo(x - w * 0.31, top + h * 0.52, x - w * 0.18, top + h * 0.5);
    body.quadraticCurveTo(x - w * 0.08, top + h * 0.48, x - w * 0.09, top + h * 0.7);
    body.quadraticCurveTo(x - w * 0.12, base - 2, x - w * 0.55, base + 6);
    body.closePath();
    // the inner band of the wave
    const inn = P[3];
    inn.moveTo(x + w * 0.5, base + 6);
    inn.quadraticCurveTo(x + w * 0.22, base - h * 0.3, x + w * 0.05, top + h * 0.3);
    inn.quadraticCurveTo(x - w * 0.02, top + h * 0.55, x - w * 0.04, base + 6);
    inn.closePath();
    // lines along the slope
    for (let k = 0; k < 3; k++) {
      const o = 0.18 + k * 0.17;
      P[4].moveTo(x + w * (0.66 - o * 0.4), base + 2);
      P[4].quadraticCurveTo(x + w * (0.34 - o * 0.3), base - h * (0.25 + o * 0.2), x + w * (0.1 - o * 0.1), top + h * (0.15 + o * 0.5));
    }
    // the claws: scallops along the lip and fingers hanging from it
    const n = 9;
    for (let k = 0; k <= n; k++) {
      const u = k / n;
      // along the lip from the crest (right) to the tip (left)
      const px = lerp(x + w * 0.1, x - w * 0.29, u);
      const py = top + h * (0.06 - 0.14 * Math.sin(Math.PI * u) + 0.3 * u * u);
      circ(P[5], px, py, (2.6 + 1.4 * Math.sin(Math.PI * u)) * s * 1.3);
      if (u > 0.45) leaf(P[5], px, py + 2, 5 + 6 * u * s, Math.PI * 0.5 + 0.5 - u * 0.6, 1.3);
    }
    for (let k = 0; k < 6; k++) circ(P[6], x - w * (0.35 + R() * 0.25), top + h * (0.1 + R() * 0.5), 0.8 + R() * 1.2);
  }
  // The lighthouse on its green cape: a white tower in red bands, shaded on one side, and its
  // lamp room; by night the lamp burns and its beam turns.
  function lighthouse(ctx, x, base, s) {
    ctx.save();
    ctx.translate(x, base);
    ctx.scale(s, s);
    if (setFill(ctx, 'cape')) {
      ctx.beginPath();
      ctx.moveTo(-50, 0);
      ctx.quadraticCurveTo(-34, -15, -8, -15);
      ctx.quadraticCurveTo(22, -15, 44, 0);
      ctx.closePath();
      ctx.fill();
    }
    if (setFill(ctx, 'capeTop')) {
      ctx.beginPath();
      ctx.moveTo(-38, -8);
      ctx.quadraticCurveTo(-28, -15, -8, -15);
      ctx.quadraticCurveTo(16, -15, 32, -6);
      ctx.quadraticCurveTo(12, -11, -8, -11.5);
      ctx.quadraticCurveTo(-26, -11.5, -38, -8);
      ctx.fill();
    }
    if (F.dark) {
      // the beam turns: a wedge of light that fades with distance
      const a = F.t * 0.9;
      const spread = Math.abs(Math.cos(a));
      glow(ctx, 0, -44, 24, 'lamp', 0.6);
      if (spread > 0.05 && F.C.beam) {
        glowWedge(ctx, 0, -44, Math.cos(a) > 0 ? 1 : -1, 170, 18 * spread, 'beam');
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
    // the round tower's shaded side, over the bands too
    if (setFill(ctx, 'lhShade')) {
      ctx.beginPath();
      ctx.moveTo(1.8, -13);
      ctx.lineTo(1.2, -40);
      ctx.lineTo(4, -40);
      ctx.lineTo(6, -13);
      ctx.closePath();
      ctx.fill();
    }
    // the gallery, the lamp room and its roof
    rect(ctx, 'lhRoof', -5.8, -41.5, 11.6, 2);
    rect(ctx, 'lh', -3.6, -48, 7.2, 6.6);
    rect(ctx, 'lhGlass', -2.4, -47, 4.8, 4.6);
    if (setFill(ctx, 'lhRoof')) {
      ctx.beginPath();
      ctx.moveTo(-4.8, -48);
      ctx.lineTo(0, -53);
      ctx.lineTo(4.8, -48);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ----- 富士: Mt Fuji over a lake; the sun sets onto its summit (Diamond Fuji) -----
  // Fuji under a deep blue sky, lit down its west ridge, its snow shaded on the east; wooded
  // hills at its foot, a village on the far shore, the lake with Fuji upside down in it, and on
  // this side pines and a tree (a cherry in spring, gold in autumn, bare in winter). As the
  // round goes on the sky turns to sunset and the sun comes down onto the summit: Fuji darkens
  // against it, rimmed with gold, and the sun bursts into rays. By night the full moon comes
  // down onto it (Pearl Fuji) over the village's lit windows.
  const FUJI_UNIT = {};
  scene({
    id: 'fuji', ja: '富士', en: 'Mt Fuji', stillT: 4,
    sky: {
      light: ['#1E4FC4', '#4F8EE6', '#A6D3F6', '#FFF1D2'],
      dark: ['#030722', '#0B1550', '#22307E', '#4B3C8C'],
      dusk: ['#3B37A8', '#9558CC', '#FF8CA6', '#FFCF7E'],
    },
    light: {
      fuji: '#4C6BD1', fujiShade: '#3651B4', fujiLit: '#8FA8F0', cap: '#FFFFFF', capShade: '#C9D8F6',
      fujiDusk: ['#2E2A7C', 0.62], fujiGold: ['#FFE590', 0.95], fujiRef: ['#3D5BC4', 0.45], capRef: ['#FFFFFF', 0.55],
      cloud: ['#FFFFFF', 0.95], cloudShade: ['#B7CBF0', 0.9], r1: '#18695E', r1Lit: '#3E9A7C',
      wallT: '#F8F4EA', roofT: '#2C3A72', torii: '#E2452B', toriiRef: ['#E2452B', 0.4],
      lakeHi: '#A4D6F6', lake: '#4C94DF', lakeDuskHi: '#FFC98A', lakeDusk: '#8B66CC', lakeLine: ['#FFFFFF', 0.85], glint: ['#FFF3C6', 0.95],
      trunk: '#5B3A2A', pineDark: '#0C4A3B', pine: '#176450', pineLit: '#3C9A6C', crown: '#3A9F58', crownLit: '#6CC870',
      reed: '#13574A', reedLit: '#2E8A62', crane: ['#1B2440', 0.7], ray: ['#FFF7DA', 0.95], diamond: ['#FFF0A8', 0.9],
      ground: '#F4F5EA', groundEdge: '#DCE6D0',
    },
    dark: {
      fuji: '#27377F', fujiShade: '#1B2867', fujiLit: '#3A4E9E', cap: '#DCE6FF', capShade: '#9FB2EC',
      fujiGold: ['#FFE6A6', 0.85], fujiRef: ['#2B3C8C', 0.5], capRef: ['#C9D6FF', 0.42],
      cloud: ['#2B3572', 0.85], cloudShade: ['#1A2258', 0.85], r1: '#0F1946', r1Lit: '#22306E',
      wallT: '#1C2357', roofT: '#0C1234', winGlow: ['#FFB547', 0.28], winT: ['#FFD27A', 1], winRef: ['#FFB547', 0.6],
      torii: '#6A2A3E', toriiRef: ['#6A2A3E', 0.45],
      lakeHi: '#28398A', lake: '#0B1343', lakeLine: ['#5869BE', 0.6], glint: ['#FFE6A8', 0.85],
      trunk: '#080C22', pineDark: '#050820', pine: '#0A1131', pineLit: '#25336E', crown: '#0D1638', crownLit: '#22306A',
      reed: '#060A22', reedLit: '#18224E', crane: ['#AEBCF2', 0.55], ray: ['#FFF0C8', 0.8], diamond: ['#FFF0C0', 0.55],
      ground: '#0E1430', groundEdge: '#141C42',
    },
    seasons: {
      spring: { light: { crown: '#F5A3BF', crownLit: '#FFD3E1' }, dark: { crown: '#4E2F62', crownLit: '#7C4F8C' } },
      autumn: { light: { crown: '#E3A53A', crownLit: '#F7CF63', r1Lit: '#C8963A' }, dark: { crown: '#2A2140', crownLit: '#4A3A50' } },
      winter: {
        light: { crown: '', crownLit: '', boughSnow: '#FFFFFF', pineSnow: '#FFFFFF', r1Lit: '#F2F6FF', reedLit: '#E8F0FF' },
        dark: { crown: '', crownLit: '', boughSnow: '#C3D0F2', pineSnow: '#C3D0F2', r1Lit: '#7E8EC8' },
      },
    },
    make() {
      return {
        stars: starLayer(41, 10, -60, 120),
        streaks: layer(42, 520, 120, ['cloudShade', 'cloud'], (P, R) => {
          for (let k = 0; k < 2; k++) {
            const x = R() * 520;
            const y = 26 + R() * 56;
            const w = 60 + R() * 90;
            const h = 2.6 + R() * 1.8;
            fujiStreak(P[0], x + 3, y + h * 0.9, w, h);
            fujiStreak(P[1], x, y, w, h);
            fujiStreak(P[1], x + w * 0.16, y - h * 1.1, w * 0.62, h * 0.9);
          }
        }),
        r1: layer(43, 400, 4, ['r1', 'r1Lit'], (P, R, i, items, tw) => {
          ridge(P[0], i, tw, 43, 146, 20, 160, 16);
          // its sunlit crest, along the same line
          const y = (x) => ridgeY(i, tw, x, 43, 146, 20, 160);
          P[1].moveTo(0, y(0));
          for (let x = 16; x <= tw + 1; x += 16) P[1].lineTo(x, y(x));
          P[1].lineTo(tw + 1, y(tw + 1));
          for (let x = Math.floor((tw + 1) / 16) * 16; x >= 0; x -= 16) P[1].lineTo(x, y(x) + 1.8);
          P[1].closePath();
        }),
        town: layer(46, 460, 30, ['wallT', 'roofT', 'winGlow', 'winT', 'winRef', 'toriiRef', 'torii'], (P, R) => {
          const x = 30 + R() * 300;
          if (R() < 0.7) fujiTown(P, R, x, 3 + Math.floor(R() * 4));
          // now and then a torii standing in the water off the shore, and its reflection
          if (R() < 0.45) fujiTorii(P[6], P[5], x + 90 + R() * 40);
        }),
        lakeLines: layer(44, 260, 30, ['lakeLine'], (P, R) => {
          for (let k = 0; k < 6; k++) {
            const w = 6 + R() * 14;
            P[0].rect(R() * 260 - w, 152 + R() * 12, w * 2, 1.1);
          }
        }),
        shore: layer(45, 520, 60, ['trunk', 'boughSnow', 'crown', 'crownLit', 'pineDark', 'pine', 'pineLit', 'pineSnow', 'reed', 'reedLit'],
          (P, R, i, items, tw) => {
            if (R() < 0.55) fujiTree(P, R, 40 + R() * 440, 0.8 + R() * 0.35);
            if (R() < 0.6) fujiPine(P, R, 60 + R() * 400, 0.85 + R() * 0.4);
            if (R() < 0.3) fujiPine(P, R, 60 + R() * 400, 0.6 + R() * 0.3);
            fujiReeds(P[8], P[9], R, i, tw, 45);
          }),
      };
    },
    paint(ctx, f, L) {
      // the still frame of the finale has the sun already on the summit
      const pj = f.still && f.fin > 0 ? 1 : f.pj;
      const dusk = f.dark ? 0 : smooth(0.4, 1, pj);
      skyFill(ctx, 'sky');
      if (f.dark) drawLayer(ctx, L.stars, f.scroll * 0.02);
      drawLayer(ctx, L.streaks, f.scroll * 0.03 + f.t * 1.5);
      if (dusk > 0) skyFill(ctx, 'dusk', 0.9 * dusk);
      const hw = Math.min(205, f.W * 0.28) * (0.9 + 0.14 * pj);
      const fx = f.W * 0.6;
      const base = 148;
      const summit = base - 0.512 * hw;
      // the sun (or the full moon) comes down onto the summit at the end of the round
      const sx = lerp(f.W * 0.16, fx, ease(pj));
      const sy = lerp(36, summit - 1, pj) - 22 * Math.sin(Math.PI * pj);
      celestial(ctx, sx, sy, 12);
      fujiPeak(ctx, fx, base, hw, dusk, smooth(0.7, 1, pj));
      if (f.fin > 0) diamondFuji(ctx, f, sx, sy);
      birds(ctx, 'crane', 3, 6, 3, 78, 1.6, 40);
      drawLayer(ctx, L.r1, f.scroll * 0.06);
      fujiLake(ctx, f, fx, hw, sx, dusk);
      drawLayer(ctx, L.town, f.scroll * 0.07);
      drawLayer(ctx, L.lakeLines, f.scroll * 0.3 + f.t * 1.2);
      drawLayer(ctx, L.shore, f.scroll * 0.9);
      ground(ctx, 'groundEdge');
      seasonal(ctx, 0.8);
      hanamaru(ctx, sx, sy, 24, f.fin);
    },
  });
  // Fuji for its own place: its body lit down the west ridge, the snow cap shaded on its east
  // side; darkened against the sunset by dusk, and its summit rimmed with light at the end.
  function fujiPeak(ctx, cx, base, hw, dusk, rim) {
    if (!FUJI_UNIT.lit) fujiUnitPaths();
    const cap = F.season === 'winter' ? U.fuji.capWinter : U.fuji.cap;
    ctx.save();
    ctx.translate(cx, base);
    ctx.scale(hw, hw);
    fillP(ctx, 'fuji', U.fuji.body);
    fillP(ctx, 'fujiLit', FUJI_UNIT.lit);
    fillP(ctx, 'fujiShade', U.fuji.shade);
    fillP(ctx, 'cap', cap);
    fillP(ctx, 'capShade', F.season === 'winter' ? FUJI_UNIT.capShadeWinter : FUJI_UNIT.capShade);
    if (dusk > 0 && setFill(ctx, 'fujiDusk')) {
      ctx.globalAlpha *= dusk;
      ctx.fill(U.fuji.body);
      ctx.globalAlpha = 1;
    }
    if (rim > 0 && F.C.fujiGold) {
      ctx.strokeStyle = F.C.fujiGold;
      ctx.globalAlpha = (F.A.fujiGold || 1) * rim;
      ctx.lineWidth = 1.8 / hw;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke(FUJI_UNIT.crown);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
  // At unit size, like U.fuji: a lit band down the west ridge, the shaded east side of the snow
  // (kept above the cap's ragged hem: one for the cap, one for winter's longer one), and the
  // line of the summit and the top of both ridges for the rim of light.
  function fujiUnitPaths() {
    const lit = new Path2D();
    lit.moveTo(-1, 0.02);
    lit.quadraticCurveTo(-0.42, -0.14, -0.12, -0.5);
    lit.lineTo(-0.108, -0.49);
    lit.quadraticCurveTo(-0.412, -0.127, -0.996, 0.035);
    lit.closePath();
    const ridgeAt = (s) => [(1 - s) * (1 - s) * -1 + 2 * (1 - s) * s * -0.42 + s * s * -0.12, (1 - s) * (1 - s) * 0.02 + 2 * (1 - s) * s * -0.14 + s * s * -0.5];
    const crown = new Path2D();
    let q = ridgeAt(0.72);
    crown.moveTo(q[0], q[1]);
    for (let k = 1; k <= 6; k++) {
      q = ridgeAt(0.72 + (0.28 * k) / 6);
      crown.lineTo(q[0], q[1]);
    }
    crown.lineTo(-0.06, -0.515);
    crown.lineTo(-0.02, -0.502);
    crown.lineTo(0.03, -0.516);
    for (let k = 6; k >= 0; k--) {
      q = ridgeAt(0.72 + (0.28 * k) / 6);
      crown.lineTo(-q[0], q[1]);
    }
    // the inner edge of U.fuji.shade, from its foot (t 0) to the summit (t 1)
    const inner = (t) => [(1 - t) * (1 - t) * 0.3 + 2 * (1 - t) * t * 0.12 + t * t * 0.03, (1 - t) * (1 - t) * 0.02 + 2 * (1 - t) * t * -0.2 + t * t * -0.516];
    const capShade = (sEnd) => {
      const p = new Path2D();
      p.moveTo(0.03, -0.516);
      p.lineTo(0.12, -0.5);
      for (let k = 1; k <= 6; k++) {
        const r = ridgeAt(1 - ((1 - sEnd) * k) / 6);
        p.lineTo(-r[0], r[1]);
      }
      const e = ridgeAt(sEnd);
      let tb = 1;
      while (tb > 0 && inner(tb - 0.01)[1] < e[1]) tb -= 0.01;
      const xi = inner(tb)[0];
      // a ragged lower edge across to the shade's inner edge, then up it
      for (let k = 1; k <= 4; k++) p.lineTo(-e[0] + ((xi + e[0]) * k) / 5, e[1] + (k % 2 ? 0.012 : -0.004));
      for (let k = 0; k <= 5; k++) {
        const r = inner(tb + ((1 - tb) * k) / 5);
        p.lineTo(r[0], r[1]);
      }
      p.closePath();
      return p;
    };
    FUJI_UNIT.lit = lit;
    FUJI_UNIT.crown = crown;
    FUJI_UNIT.capShade = capShade(0.74);
    FUJI_UNIT.capShadeWinter = capShade(0.6);
  }
  // A band of cloud cut from paper, long, flat and tapered, centred on (x, y).
  function fujiStreak(p, x, y, w, h) {
    const a = w / 2;
    p.moveTo(x - a, y + h * 0.2);
    p.lineTo(x - a * 0.8, y - h * 0.7);
    p.lineTo(x - a * 0.45, y - h);
    p.lineTo(x + a * 0.5, y - h);
    p.lineTo(x + a * 0.85, y - h * 0.6);
    p.lineTo(x + a, y + h * 0.2);
    p.lineTo(x + a * 0.75, y + h);
    p.lineTo(x - a * 0.7, y + h);
    p.closePath();
  }
  // Diamond Fuji (Pearl Fuji by night): the sun on the summit bursts into rays.
  function diamondFuji(ctx, f, sx, sy) {
    const k = f.fin;
    glow(ctx, sx, sy, 64 * k, 'diamond', k);
    if (!setFill(ctx, 'ray')) return;
    ctx.globalAlpha *= k;
    const turn = f.still ? 0 : f.t * 0.15;
    ctx.beginPath();
    for (let r = 0; r < 6; r++) {
      const a = turn + (r * Math.PI) / 6;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const len = (r % 3 === 0 ? 52 : r % 3 === 1 ? 26 : 36) * (0.7 + 0.3 * k);
      const wid = r % 3 === 0 ? 2 : 1.4;
      ctx.moveTo(sx + c * len, sy + s * len);
      ctx.lineTo(sx - s * wid, sy + c * wid);
      ctx.lineTo(sx - c * len, sy - s * len);
      ctx.lineTo(sx + s * wid, sy - c * wid);
      ctx.closePath();
    }
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  // The lake: lighter towards the far shore, the sunset on it as the round ends, Fuji upside
  // down in it, and the path of light under the sun as it sets (under the moon by night).
  function fujiLake(ctx, f, fx, hw, sx, dusk) {
    const top = 148;
    const K = F.K;
    // its two gradients (by day and at sunset), made once per palette
    const grad = (key, hi, lo) => {
      if (K.grad[key] === undefined) {
        K.grad[key] = null;
        if (F.C[hi] && F.C[lo]) {
          const g = ctx.createLinearGradient(0, top, 0, G);
          g.addColorStop(0, F.C[hi]);
          g.addColorStop(1, F.C[lo]);
          K.grad[key] = g;
        }
      }
      return K.grad[key];
    };
    ctx.fillStyle = grad('fujiLake', 'lakeHi', 'lake') || F.C.lake || F.C.ground;
    ctx.fillRect(-1, top, f.W + 2, G - top + 2);
    const sunset = dusk > 0 && grad('fujiLakeDusk', 'lakeDuskHi', 'lakeDusk');
    if (sunset) {
      ctx.globalAlpha = 0.9 * dusk;
      ctx.fillStyle = sunset;
      ctx.fillRect(-1, top, f.W + 2, G - top + 2);
      ctx.globalAlpha = 1;
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(-1, top, f.W + 2, G - top);
    ctx.clip();
    ctx.translate(fx, top);
    ctx.scale(hw, -hw * 0.15);
    fillP(ctx, 'fujiRef', U.fuji.body);
    fillP(ctx, 'capRef', F.season === 'winter' ? U.fuji.capWinter : U.fuji.cap);
    ctx.restore();
    const a = f.dark ? 1 : dusk;
    if (a > 0 && setFill(ctx, 'glint')) {
      const a0 = ctx.globalAlpha * a;
      for (let k = 0; k < 5; k++) {
        const w = (6 + k * 3.4) * (0.6 + 0.4 * Math.abs(Math.sin(f.t * 1.4 + k * 1.9)));
        ctx.globalAlpha = a0 * (1 - k / 6);
        ctx.fillRect(sx - w / 2 + Math.sin(f.t + k) * 1.5, top + 2 + k * 3.6, w, 1.3);
      }
      ctx.globalAlpha = 1;
    }
  }
  // A village on the far shore: white walls and dark roofs; by night lit windows with a halo,
  // their light drawn down into the lake.
  function fujiTown(P, R, x, n) {
    for (let k = 0; k < n; k++) {
      const w = 5 + R() * 5;
      const h = 3.2 + R() * 2.6;
      P[0].rect(x, 148 - h, w, h + 0.6);
      tri(P[1], x - 1, 148.3 - h, x + w / 2, 145.6 - h, x + w + 1, 148.3 - h);
      if (R() < 0.75) {
        const wx = x + w * (0.25 + R() * 0.4);
        const wy = 148 - h * 0.72;
        circ(P[2], wx + 0.8, wy + 0.8, 2.6);
        P[3].rect(wx, wy, 1.6, 1.6);
        // its light on the water, broken by ripples
        const l = 2 + R() * 2;
        P[4].rect(wx - 0.3, 149.4, 2.2, l);
        P[4].rect(wx + 0.2, 150.6 + l, 1.2, 1 + R() * 2.4);
      }
      x += w + 1.5 + R() * 4;
    }
  }
  // A small torii standing in the lake (its feet in the water at y 151), and its reflection.
  function fujiTorii(p, ref, x) {
    p.rect(x - 4.4, 141, 1.2, 10.4);
    p.rect(x + 3.2, 141, 1.2, 10.4);
    quad(p, x - 6.6, 139.2, x + 6.6, 139.2, x + 6, 141, x - 6, 141);
    p.rect(x - 5.2, 143, 10.4, 0.9);
    ref.rect(x - 4.4, 151.4, 1.2, 5.6);
    ref.rect(x + 3.2, 151.4, 1.2, 5.6);
    ref.rect(x - 5.2, 157.4, 10.4, 0.7);
  }
  // A pine (matsu) on the shore: a leaning trunk and flat pads of needles, each with its shadow
  // under it, the light along its top, and in winter snow on it.
  function fujiPine(P, R, x, s) {
    const lean = (R() - 0.5) * 16 * s;
    const h = 48 * s;
    const t = P[0];
    t.moveTo(x - 2.6 * s, G + 1);
    t.quadraticCurveTo(x + lean * 0.2, G - h * 0.5, x + lean, G - h);
    t.lineTo(x + lean + 2.4 * s, G - h);
    t.quadraticCurveTo(x + lean * 0.2 + 3 * s, G - h * 0.5, x + 2.6 * s, G + 1);
    t.closePath();
    const n = 3 + Math.floor(R() * 2);
    for (let k = 0; k < n; k++) {
      const u = k / (n - 1);
      const cx = x + lean * (0.45 + 0.55 * u) + (k % 2 ? 9 : -9) * s * (1 - u * 0.5);
      const cy = G - h * (0.45 + 0.55 * u);
      const a = (13 - 5 * u) * s;
      const b = 4.8 * s;
      fujiPoly(P[4], cx + 1.5 * s, cy + 1.2 * s, a * 0.95, b, FUJI_PAD[0]);
      for (let q = 1; q < 4; q++) fujiPoly(P[4 + q], cx, cy, a, b, FUJI_PAD[q]);
    }
  }
  // A pine's pad of needles cut from paper, at unit size (x across its half width, y down its
  // height): the shadow under it, the pad, the light along its top, the snow on it.
  const FUJI_PAD = [
    [[-0.9, 0.3], [0.95, 0.3], [0.72, 0.95], [-0.6, 0.9]],
    [[-1, 0.35], [-0.82, -0.32], [-0.45, -0.8], [0, -1], [0.48, -0.84], [0.86, -0.36], [1, 0.35], [0.5, 0.62], [-0.5, 0.6]],
    [[-0.78, -0.28], [-0.42, -0.76], [0.04, -0.96], [0.36, -0.8], [-0.08, -0.56], [-0.54, -0.1]],
    [[-0.74, -0.36], [-0.4, -0.86], [0, -1.12], [0.46, -0.92], [0.82, -0.42], [0.3, -0.6], [-0.3, -0.56]],
  ];
  function fujiPoly(p, cx, cy, a, b, pts) {
    p.moveTo(cx + pts[0][0] * a, cy + pts[0][1] * b);
    for (let k = 1; k < pts.length; k++) p.lineTo(cx + pts[k][0] * a, cy + pts[k][1] * b);
    p.closePath();
  }
  // A broadleaf tree on the shore: a cherry in spring, green in summer, gold in autumn; in
  // winter only its bare boughs, with snow along them.
  function fujiTree(P, R, x, s) {
    const h = 36 * s;
    quad(P[0], x - 1.9 * s, G + 1, x + 1.9 * s, G + 1, x + 1.1 * s, G - h * 0.62, x - 1.1 * s, G - h * 0.62);
    for (const d of [-1, 0, 1]) {
      // a bough from the top of the trunk, and the snow along its upper side
      const ex = x + d * 12 * s;
      const ey = G - h * (d ? 0.9 : 1.02);
      quad(P[0], x - 1.1 * s, G - h * 0.58, x + 1.1 * s, G - h * 0.58, ex + 0.7 * s, ey, ex - 0.7 * s, ey);
      quad(P[1], x - 1.2 * s + d * 2 * s, G - h * 0.66, ex - 0.9 * s, ey - 1.2 * s, ex + 0.4 * s, ey - 1.6 * s, x + 0.4 * s + d * 2 * s, G - h * 0.7);
    }
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU + 0.3;
      circ(P[2], x + Math.cos(a) * 9 * s, G - h * 0.92 + Math.sin(a) * 5.5 * s, (6.8 + R() * 2.6) * s);
    }
    circ(P[2], x, G - h * 0.95, 8.5 * s);
    for (let k = 0; k < 2; k++) circ(P[3], x - 5 * s + k * 7 * s, G - h * (1.05 + k * 0.05), (3.4 + R() * 1.2) * s);
  }
  // This side of the lake: a low grassy bank, and clumps of reeds along it, one blade of each
  // catching the light.
  function fujiReeds(p, lit, R, i, tw, seed) {
    ridge(p, i, tw, seed, 166, 3, 40, 20);
    const n = 8;
    for (let k = 0; k < n; k++) {
      const cx = ((k + 0.15 + 0.7 * R()) * tw) / n;
      const y = ridgeY(i, tw, cx, seed, 166, 3, 40) + 1.5;
      const tall = 5 + 6 * R();
      for (let b = 0; b < 3; b++) {
        const bx = cx + (b - 1) * 2.4;
        const lean = (b - 1) * 1.6 + (R() - 0.5) * 2;
        tri(b === 1 ? lit : p, bx - 0.9, y, bx + lean, y - tall * (b === 1 ? 1 : 0.55 + 0.3 * R()), bx + 0.9, y);
      }
    }
  }
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
    // by day a clear blue, pale and warm low down behind the towers; by night deep indigo down
    // to the magenta glow the city's lights put on the sky
    sky: { light: ['#2356D2', '#4689EA', '#9CCDF6', '#F7E4EA', '#FFD9C9'], dark: ['#03041A', '#0E0B3E', '#261159', '#4F196E', '#7A2578'] },
    light: {
      haze: '#B9C2EF', far: '#8C9BE0', farWin: ['#BAC6F4', 0.85],
      fA: '#4659C4', fB: '#1F968F', fC: '#F6EAD6', side: ['#2B2580', 0.3], winT: ['#FFFFFF', 0.3], winD: ['#2F4FD0', 0.36],
      glint: ['#FFFFFF', 0.75], rim: ['#FFFFFF', 0.6], roofThing: '#2C3876', shop: '#2A3878', shopLit: '#4B60B4',
      s1: '#EC5A9A', s2: '#12A08A', s3: '#F2B43A', s4: '#2F4FD0', t1: '#FFFFFF', t2: '#FFFFFF', t3: '#1B2440', t4: '#FFFFFF',
      tower: '#EE5B36', towerShade: ['#6E1A0C', 0.28], towerW: '#FFFFFF', towerLine: ['#8E2A18', 0.55], towerDeck: '#FFFFFF', towerWin: '#7FA2E6',
      crown: '#2FA56A', crown2: '#63C987', post: '#26316A', lamp: '#F4F7FF', flag: '#EC5A9A',
      ground: '#F6F2FA', groundEdge: '#DED7F0',
    },
    dark: {
      haze: '#2B2068', hazeLamp: ['#FF4D5E', 0.95], far: '#1D1850', farWin: ['#FFC86A', 0.75],
      fA: '#1E1C5C', fB: '#122B52', fC: '#2C1B58', side: ['#03031A', 0.45], winT: ['#8C96FF', 0.12], winD: ['#000014', 0.3],
      win: ['#FFD27A', 0.95], win2: ['#8FEAFF', 0.85], rim: ['#C08CFF', 0.45], roofThing: '#0B0A2A', shop: '#120E32', shopLit: ['#FFCF7A', 0.85],
      s1: '#3A1048', s2: '#08334A', s3: '#3A2A0C', s4: '#16195C',
      e1: ['#FF5FB8', 0.95], e2: ['#3FE8FF', 0.95], e3: ['#FFD24A', 0.95], e4: ['#9EA8FF', 0.95],
      t1: '#FF8ACB', t2: '#7FF2FF', t3: '#FFE48A', t4: '#BCC4FF',
      tower: '#FF8638', towerShade: ['#5A1404', 0.3], towerW: '#FFD9A6', towerLine: ['#FFE9BC', 0.75], towerDeck: '#FFF2D6', towerWin: '#FF9A4A',
      towerLit: ['#FFC48A', 0.8], towerHalo: ['#FF7A3A', 0.13],
      crown: '#123A4C', crown2: '#1C5060', post: '#08071F', lamp: '#FFF2C8', lampGlow: ['#FFD98E', 0.5], lampCone: ['#FFE3A0', 0.13], flag: '#9A2E74',
      cloud: ['#30226E', 0.9], cloudShade: ['#7A2C88', 0.85],
      ground: '#100E2C', groundEdge: '#1C1848',
    },
    // the street trees: cherry blossom, green, ginkgo gold, and bare in winter with
    // illuminations strung on them by night
    seasons: {
      spring: { light: { crown: '#F59FC0', crown2: '#FFD2E2' }, dark: { crown: '#6A2E64', crown2: '#8E447E' } },
      autumn: { light: { crown: '#F2B43A', crown2: '#FFD96E' }, dark: { crown: '#5C4416', crown2: '#7E5E1E' } },
      winter: {
        light: { crown: '', crown2: '', branch: '#26316A' },
        dark: { crown: '', crown2: '', branch: '#08071F', twinkle: ['#C4F1FF', 0.95], twinkleGlow: ['#8FD8FF', 0.16] },
      },
    },
    make() {
      return {
        stars: starLayer(51, 5, -60, 60),
        // long streaks of cloud, a shaded underside under each (lit magenta by night)
        cloud: layer(55, 520, 150, ['cloudShade', 'cloud'], (P, R) => {
          const n = R() < 0.5 ? 1 : 2;
          for (let k = 0; k < n; k++) {
            const x = ((k + R() * 0.7) * 520) / n;
            const y = 12 + R() * 34;
            const w = 70 + R() * 80;
            rr(P[0], x + 6, y + 2.2, w, 6.5, 3.2);
            rr(P[1], x, y, w, 6.5, 3.2);
            if (R() < 0.7) {
              const x2 = x + w * (0.25 + R() * 0.3);
              const w2 = w * (0.4 + R() * 0.3);
              rr(P[0], x2 + 5, y - 3.3, w2, 5.5, 2.7);
              rr(P[1], x2, y - 5.2, w2, 5.5, 2.7);
            }
          }
        }),
        // the farthest towers, pale in the haze; by night a red light blinks on their masts
        haze: layer(56, 340, 30, ['haze'], (P, R, i, items) => {
          for (let k = 0; k < 3; k++) {
            if (R() < 0.25) continue;
            const x = (k + R() * 0.7) * 113;
            const w = 14 + R() * 14;
            const h = 82 + R() * 46;
            const top = G - h;
            P[0].rect(x, top, w, h + 2);
            const kind = R();
            if (kind < 0.35) tri(P[0], x, top + 0.5, x + w / 2, top - 10, x + w, top + 0.5);
            else if (kind < 0.7) P[0].rect(x + 3, top - 6, w - 6, 6.5);
            if (R() < 0.6) {
              const my = top - (kind < 0.35 ? 10 : kind < 0.7 ? 6 : 0);
              P[0].rect(x + w / 2 - 0.5, my - 16, 1, 16.5);
              items.push({ x: x + w / 2, y: my - 16, ph: R() * TAU });
            }
          }
        }, (ctx, items) => {
          if (!setFill(ctx, 'hazeLamp')) return;
          const a = ctx.globalAlpha;
          for (let q = 0; q < items.length; q++) {
            const it = items[q];
            ctx.globalAlpha = a * (0.25 + 0.75 * Math.max(0, Math.sin(F.t * 1.7 + it.ph)));
            ctx.fillRect(it.x - 1.1, it.y - 1.1, 2.2, 2.2);
          }
          ctx.globalAlpha = 1;
        }),
        far: layer(52, 380, 10, ['far', 'farWin'], (P, R, i, items, tw) => {
          let x = 0;
          while (x < tw) {
            const w = Math.min(18 + R() * 30, tw - x);
            const h = 56 + R() * 56;
            P[0].rect(x, G - h, w + 0.6, h + 2);
            if (R() < 0.3) P[0].rect(x + w / 2 - 0.6, G - h - 14, 1.2, 14);
            for (let y = G - h + 6; y < G - 20; y += 9) {
              for (let wx = x + 4; wx < x + w - 4; wx += 6) if (R() < 0.18) P[1].rect(wx, y, 2, 2.6);
            }
            x += w;
          }
        }),
        mid: layer(53, 360, 30, ['fA', 'fB', 'fC', 'side', 'winT', 'winD', 'glint', 'win', 'win2', 'rim', 'roofThing', 'shop', 'shopLit',
          's1', 's2', 's3', 's4', ['e1', 1], ['e2', 1], ['e3', 1], ['e4', 1]], (P, R, i, items, tw) => {
          let x = 4;
          while (x < tw - 40) {
            let w = 46 + R() * 40;
            if (x + w > tw - 4 || tw - 4 - (x + w) < 40) w = tw - 4 - x;
            machiBuilding(P, R, x, w, G - 46 - R() * 70, items);
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
            let a = 1;
            // one sign in a while flickers, as old neon does
            if (F.dark && hash(Math.floor(s.ph), Math.floor(F.t * 0.4 + s.ph)) < 0.12) a *= hash(7, Math.floor(F.t * 12)) < 0.5 ? 0.25 : 1;
            if (F.dark) {
              ctx.strokeStyle = F.C[key];
              ctx.lineWidth = 3.4;
              ctx.globalAlpha = 0.3 * a;
              if (s.v) for (let k = 0; k < s.word.length; k++) ctx.strokeText(s.word[k], s.x, s.y + k * 10);
              else ctx.strokeText(s.word, s.x, s.y);
            }
            ctx.globalAlpha = a;
            if (s.v) for (let k = 0; k < s.word.length; k++) ctx.fillText(s.word[k], s.x, s.y + k * 10);
            else ctx.fillText(s.word, s.x, s.y);
          }
          ctx.globalAlpha = 1;
        }),
        lamps: layer(54, 380, 30, ['twinkleGlow', ['branch', 1.1], 'post', 'crown', 'crown2', 'twinkle', 'lampCone', 'lamp', 'flag'], (P, R, i, items) => {
          const x = 40 + R() * 300;
          P[2].rect(x - 1.2, 112, 2.4, G - 110);
          P[2].moveTo(x, 113);
          P[2].quadraticCurveTo(x, 106, x + 8, 106);
          P[2].lineTo(x + 8, 108);
          P[2].quadraticCurveTo(x + 2, 108, x + 1.2, 113);
          P[2].closePath();
          rr(P[7], x + 5, 106.5, 9, 3, 1.4);
          // by night its light falls to the pavement (two sheets, the inner one brighter)
          quad(P[6], x + 5.5, 109.5, x + 13.5, 109.5, x + 26, G, x - 7, G);
          quad(P[6], x + 7.5, 109.5, x + 11.5, 109.5, x + 17, G, x + 2, G);
          // the shopping street's banner on the post
          P[2].rect(x - 8.5, 117, 7.3, 1.3);
          P[8].rect(x - 8, 118.3, 6, 15);
          items.push({ x: x + 9.5, y: 110 });
          // a street tree, away from the lamp
          let tx = x + 140 + R() * 90;
          if (tx > 372) tx -= 380;
          machiTree(P, R, tx);
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
      drawLayer(ctx, L.cloud, f.scroll * 0.05 + f.t * 2.2);
      drawLayer(ctx, L.haze, f.scroll * 0.04);
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
  // A building of the city: a face in one of three colours (indigo, teal, cream) with its
  // shaded side, light along its roof and its sunny side, windows in a grid or in bands (the
  // sky in a few of them by day, lit by night; smaller and fewer lit at the height of the
  // cards), things on the roof, a shop at street level under an awning, and a sign whose
  // tubes glow by night.
  function machiBuilding(P, R, x, w, top, items) {
    const h = G - top;
    const fam = Math.floor(R() * 3);
    const glass = fam === 2 ? 5 : 4;
    const fw = w - 6;
    P[fam].rect(x, top, fw, h + 2);
    P[fam].rect(x + fw - 0.3, top + 3, 6.3, h - 1);
    P[3].rect(x + fw, top + 3, 6, h - 1);
    P[9].rect(x, top, fw, 1.6);
    P[9].rect(x, top + 1.6, 1.4, h - 1.6);
    const band = R() < 0.35;
    const g0 = R() * 50 - 10;
    for (let y = top + 8; y < G - 22; y += band ? 9 : 11) {
      const lo = y > 98;
      const on = lo ? 0.16 : 0.38;
      if (band) {
        const bh = lo ? 2.6 : 4;
        P[glass].rect(x + 4, y, fw - 8, bh);
        for (let wx = x + 4; wx < x + fw - 9; wx += 10) {
          const q = R();
          if (q < on) P[7].rect(wx, y, 9.6, bh);
          else if (q < on + 0.07) P[8].rect(wx, y, 9.6, bh);
          const d = wx - x - (y - top) * 0.8 - g0;
          if (!lo && d > -6 && d < 6) P[6].rect(wx, y, 9.6, bh);
        }
      } else {
        const ww = lo ? 3.6 : 5;
        const wh = lo ? 4.4 : 6;
        for (let wx = x + 5; wx < x + fw - 8; wx += 9) {
          P[glass].rect(wx, y, ww, wh);
          const q = R();
          if (q < on) P[7].rect(wx, y, ww, wh);
          else if (q < on + 0.07) P[8].rect(wx, y, ww, wh);
          const d = wx - x - (y - top) * 0.8 - g0;
          if (!lo && d > -7 && d < 6) P[6].rect(wx, y, ww, wh);
        }
      }
    }
    // a water tank or a cooling unit on the roof
    if (R() < 0.5) {
      rr(P[10], x + 8, top - 9, 12, 9, 2);
      P[10].rect(x + 10, top - 2, 1.4, 3);
      P[10].rect(x + 17, top - 2, 1.4, 3);
    } else if (R() < 0.5) P[10].rect(x + fw - 16, top - 4, 9, 4.2);
    // a shop at street level, under an awning in a sign's colour
    if (R() < 0.75) {
      const sy = G - 13;
      P[11].rect(x + 2, sy, fw - 4, 15);
      for (let px = x + 5; px < x + fw - 9; px += 8) P[12].rect(px, sy + 3, 6, 12);
      P[13 + Math.floor(R() * 4)].rect(x + 1, sy - 3, fw - 2, 3.4);
    }
    // a sign: on the side of a tall building, read downwards, or on a roof (raised on a frame
    // over a low one)
    const col = Math.floor(R() * 4);
    const word = SIGN_WORDS[Math.floor(R() * SIGN_WORDS.length)];
    const n = Array.from(word).length;
    const sh = n * 10 + 6;
    const vy = Math.min(top + 10, 112 - sh);
    if (n <= 4 && R() < 0.65 && vy >= top + 2) {
      const sx = x + w - 22;
      rr(P[13 + col], sx, vy, 13, sh, 2);
      rr(P[17 + col], sx + 1.6, vy + 1.6, 9.8, sh - 3.2, 1.5);
      // read downwards, the long-vowel mark stands upright
      items.push({ v: 1, x: sx + 6.5, y: vy + 8, word: Array.from(word.replace(/ー/g, '｜')), col: col + 1, ph: R() * 50 });
    } else {
      const sw = n * 9 + 10;
      const sx = x + Math.max(2, (w - 6 - sw) / 2);
      const lift = top > 100 ? 9 : 0;
      const ty = top - 15 - lift;
      P[10].rect(sx + 4, ty + 12, 1.4, 3.5 + lift);
      P[10].rect(sx + sw - 5.4, ty + 12, 1.4, 3.5 + lift);
      rr(P[13 + col], sx, ty, sw, 13, 2);
      rr(P[17 + col], sx + 1.6, ty + 1.6, sw - 3.2, 9.8, 1.5);
      items.push({ v: 0, x: sx + sw / 2, y: ty + 6.8, word, col: col + 1, ph: R() * 50 });
    }
  }
  // A street tree: its trunk (and in winter its bare branches), a round crown in the
  // season's colour with light on its upper side, and the lights strung on it in winter,
  // glowing by night.
  function machiTree(P, R, x) {
    circ(P[0], x, 128, 19);
    line(P[1], x, 146, x - 10, 128);
    line(P[1], x, 140, x + 10, 124);
    line(P[1], x - 5, 138, x - 4, 119);
    line(P[1], x + 4, 134, x + 3, 117);
    line(P[1], x + 6, 131, x + 14, 129);
    P[2].rect(x - 1.6, 128, 3.2, G - 126);
    P[2].rect(x - 5.5, G - 3.5, 11, 4);
    const s = 0.9 + R() * 0.25;
    circ(P[3], x - 7 * s, 131, 8.5 * s);
    circ(P[3], x + 7 * s, 129, 9 * s);
    circ(P[3], x, 122, 10 * s);
    circ(P[3], x, 134, 8 * s);
    circ(P[4], x - 4 * s, 119.5, 5.5 * s);
    circ(P[4], x - 10 * s, 127, 4 * s);
    for (let k = 0; k < 16; k++) {
      const a = R() * TAU;
      const d = Math.sqrt(R()) * 13;
      circ(P[5], x + Math.cos(a) * d, 128 + Math.sin(a) * d * 0.85, 0.85);
    }
  }
  const TOWER_H = 128;
  const towerHalf = (y) => 4 + 26 * Math.pow(y / TOWER_H, 1.6);   // half width at y from the top
  let towerP = null;
  // The tower's shapes at unit size, made on its first frame: its body and mast, the shaded
  // east half, the white bands, the lattice, the two decks and their windows.
  function towerPaths() {
    const h = TOWER_H;
    const at = towerHalf;
    const body = new Path2D();
    body.moveTo(-at(h), 0);
    for (let y = h; y >= 0; y -= 16) body.lineTo(-at(y), y - h);
    body.lineTo(at(0), -h);
    for (let y = 0; y <= h; y += 16) body.lineTo(at(y), y - h);
    body.lineTo(at(h) - 7, 0);
    body.quadraticCurveTo(0, -36, -at(h) + 7, 0);
    body.closePath();
    body.rect(-1, -h - 22, 2, 23);
    const shade = new Path2D();
    shade.moveTo(0, -h - 22);
    shade.lineTo(1, -h - 22);
    shade.lineTo(1, -h);
    shade.lineTo(at(0), -h);
    for (let y = 0; y <= h; y += 16) shade.lineTo(at(y), y - h);
    shade.lineTo(at(h) - 7, 0);
    shade.quadraticCurveTo((at(h) - 7) / 2, -18, 0, -18);
    shade.closePath();
    const bands = new Path2D();
    for (let k = 0; k < 4; k++) {
      const y = h * (0.2 + k * 0.18);
      bands.rect(-at(y), y - h, at(y) * 2, 6);
    }
    bands.rect(-1, -h - 15, 2, 4);
    const lattice = new Path2D();
    for (let y = 8; y + 14 <= h - 18; y += 14) {
      lattice.moveTo(-at(y), y - h);
      lattice.lineTo(at(y + 14), y + 14 - h);
      lattice.moveTo(at(y), y - h);
      lattice.lineTo(-at(y + 14), y + 14 - h);
    }
    const d1 = h * 0.55;
    const d2 = h * 0.25;
    const deck = new Path2D();
    deck.rect(-at(d1) - 4, d1 - h - 2, at(d1) * 2 + 8, 9);
    deck.rect(-at(d2) - 3, d2 - h - 2, at(d2) * 2 + 6, 6);
    const win = new Path2D();
    win.rect(-at(d1) - 2.5, d1 - h + 1, at(d1) * 2 + 5, 3);
    win.rect(-at(d2) - 1.5, d2 - h, at(d2) * 2 + 3, 2);
    // its glow by night: three sheets, each smaller one adding to the light
    const halo = [[46, 84], [34, 66], [22, 48]].map(([rx, ry]) => {
      const p = new Path2D();
      ell(p, 0, -h * 0.5, rx, ry);
      return p;
    });
    return { body, shade, bands, lattice, deck, win, halo };
  }
  // A lattice broadcast tower with two decks; by night it is lit up, its glow growing as the
  // round goes on, and the light on its mast brightest at the end.
  function tower(ctx, x, base, s) {
    if (!towerP) towerP = towerPaths();
    const T = towerP;
    ctx.save();
    ctx.translate(x, base);
    ctx.scale(s, s);
    if (F.dark && setFill(ctx, 'towerHalo')) {
      ctx.globalAlpha *= Math.min(1, 0.5 + 0.4 * F.pj + 0.4 * F.fin);
      for (let k = 0; k < 3; k++) ctx.fill(T.halo[k]);
      ctx.globalAlpha = 1;
    }
    fillP(ctx, 'tower', T.body);
    fillP(ctx, 'towerW', T.bands);
    if (F.C.towerLine) {
      ctx.strokeStyle = F.C.towerLine;
      ctx.globalAlpha = F.A.towerLine || 1;
      ctx.lineWidth = 0.7;
      ctx.stroke(T.lattice);
      ctx.globalAlpha = 1;
    }
    fillP(ctx, 'towerShade', T.shade);
    fillP(ctx, 'towerDeck', T.deck);
    fillP(ctx, 'towerWin', T.win);
    if (F.dark) glow(ctx, 0, -TOWER_H - 22, 6 + 9 * F.fin, 'towerLit', Math.min(1 / (F.A.towerLit || 1), 0.7 + F.fin));
    ctx.restore();
  }

  // ----- 田んぼ: rice terraces stepping down a hillside, a farmhouse, a scarecrow -----
  const TERR = 5;
  // The terraces follow one hill, like contour lines: the top edge of band b at world x.
  const terrY = (b, gx) => 141 + b * 6 - 32 * (1 - b * 0.2) * hills(65, gx, 150);
  // Their edges are traced in steps of TS (the hill is smooth enough), every path on the same
  // points so that they meet exactly.
  const TS = 16;
  // The low bund (畦) along the road, in front of the terraces.
  const bundY = (i, tw, x) => ridgeY(i, tw, x, 67, 164, 3, 70);
  scene({
    id: 'tanbo', ja: '田んぼ', en: 'Rice terraces', stillT: 7,
    sky: { light: ['#2A7DD8', '#6CB6EE', '#C4E7F5', '#FBF3D2'], dark: ['#040822', '#0B164A', '#1A2A6C', '#30397E'] },
    light: {
      m1: '#AFBFF0', m1b: '#8C9FE2', m2: '#3B8679',
      t0: '#B4E06B', t1: '#A0D55D', t2: '#8CC952', t3: '#79BD47', t4: '#67B03D',
      riser: '#539E3C', lip: ['#DDF59A', 0.9], sprout: '', glint: ['#FFFFFF', 0.95],
      trunk: '#7A4A2A', tree: '#2D8A48', treeLit: '#5CB75F',
      thatch: '#D7A14B', thatchDark: '#8C5B28', fwall: '#F7E6C4', fwood: '#8A5530', lit: '#5E3B22',
      bund: '#2E7E30', bundLip: '#93D75F', grass: '#236A29', egret: ['#FFFFFF', 0.95],
      pole: '#6E4426', cloth: '#2F4FD0', cloth2: '#0B7A6B', patch: '#E2452B', face: '#FFF1D6', hat: '#F2B43A',
      ground: '#F6F5E4', groundEdge: '#E3E8C6',
    },
    dark: {
      m1: '#2B3B82', m1b: '#212F6E', m2: '#111C48',
      t0: '#22506C', t1: '#1E4962', t2: '#1B4159', t3: '#183A50', t4: '#153247',
      riser: '#0C1834', lip: ['#72DABD', 0.38], sprout: '', flyGlow: ['#D4FF66', 0.55], farLit: ['#FFC45A', 0.95], farGlow: ['#FFB347', 0.3],
      trunk: '#0D1534', tree: '#122048', treeLit: '#1E3266', fruit: '',
      thatch: '#2B2E5E', thatchDark: '#1A1C44', fwall: '#252B5E', fwood: '#161B40', lit: ['#FFC45A', 0.95], litGlow: ['#FFB347', 0.55],
      bund: '#0A1230', bundLip: '#23407A', grass: '#081028',
      pole: '#0A1030', cloth: '#27378C', cloth2: '#16475F', patch: '#7A2A3A', face: '#2C3366', hat: '#3B3B72',
      ground: '#121A33', groundEdge: '#18213E',
    },
    seasons: {
      // flooded paddies mirroring the sky, rows of young rice, 菜の花 on the bunds
      spring: {
        light: {
          t0: '#BFE6F8', t1: '#A6DAF4', t2: '#8ECEF0', t3: '#78C1EA', t4: '#65B4E2', riser: '#62B048', lip: ['#EFFAD0', 0.9],
          sprout: ['#3F9E33', 0.75], tree: '#F4A3C5', treeLit: '#FFD4E6', nanohana: '#F8D43A',
          refl: '#FFFBE8', reflGlow: ['#FFF2B8', 0.8],
        },
        dark: {
          t0: '#2E50A2', t1: '#2A4996', t2: '#26428A', t3: '#223B7E', t4: '#1F3572', riser: '#0E1944', lip: ['#AABDFF', 0.42],
          sprout: ['#4A7AB0', 0.5], tree: '#5C4488', treeLit: '#8A6AB0', nanohana: '#8E8C4A',
          refl: '#FFF4D6', reflGlow: ['#C4D2FF', 0.6],
        },
      },
      // golden rice, persimmons, red dragonflies, 彼岸花 and susuki; the harvest moon by night
      autumn: {
        light: {
          t0: '#FBE27E', t1: '#F7D466', t2: '#F1C552', t3: '#EAB542', t4: '#DFA436', riser: '#9EA444', lip: ['#FFF6C4', 0.9], egret: '',
          glint: '', tree: '#E0782C', treeLit: '#F6AA42', fruit: '#E8452B',
          dfly: ['#E2452B', 0.85], higan: '#E2452B', susuki: '#FFF6DE', susukiStem: '#B7A266',
        },
        dark: {
          t0: '#40417E', t1: '#3B3B73', t2: '#373669', t3: '#33325F', t4: '#2E2E55', riser: '#141436', lip: ['#E8C66A', 0.62],
          tree: '#3A2A58', treeLit: '#5A3E70',
          moon: '#FFE3A0', moonShade: '#EAC77E', moonGlow: ['#FFD27A', 0.45], higan: '#A8344A', susuki: '#C4BFE8', susukiStem: '#4C4A86',
        },
      },
      // the terraces under snow, cold blue in their shadows
      winter: {
        light: {
          t0: '#F8FBFF', t1: '#EFF5FE', t2: '#E7EFFC', t3: '#DFE9F9', t4: '#D7E3F6', riser: '#A9BDE6', lip: ['#FFFFFF', 0.9],
          sprout: ['#A8977A', 0.3], glint: '', egret: '', tree: '#C5D5F0', treeLit: '#FFFFFF', thatch: '#EAF1FD', thatchDark: '#A8BBE4',
          m2: '#3D7887', bund: '#DCE6F7', bundLip: '#FFFFFF', grass: '#9BB0D8',
        },
        dark: {
          t0: '#4C5FAA', t1: '#465AA2', t2: '#40549A', t3: '#3A4E91', t4: '#354888', riser: '#1F2964', lip: ['#DCE4FF', 0.5],
          sprout: ['#2B376E', 0.35], thatch: '#5B6BB2', thatchDark: '#3A478A', tree: '#4C5CA2', treeLit: '#7C8ED6',
          m2: '#1A2654', bund: '#2B3778', bundLip: '#8090DA', grass: '#1F2966',
          akari: ['#FFE08A', 0.95], akariGlow: ['#FFC45A', 0.28],
        },
      },
    },
    make() {
      return {
        stars: starLayer(61, 12, -60, 100),
        cloud: cloudLayer(62, 440, 24, 64, 44, 92),
        m1: layer(63, 400, 4, ['m1', 'm1b'], (P, R, i, items, tw) => {
          ridge(P[0], i, tw, 63, 116, 62, 120, 8);
          // a nearer range, a step deeper
          ridge(P[1], i, tw, 163, 124, 30, 64, 8);
        }),
        m2: layer(64, 360, 8, ['m2', 'farGlow', 'farLit'], (P, R, i, items, tw) => {
          // the hills with a fringe of treetops along them, in one outline: round tops every
          // 6 units of the world, each over the hill's own line there
          const x0 = i * tw;
          const hill = (x) => ridgeY(i, tw, x, 64, 130, 24, 90);
          const top = (x) => {
            let y = hill(x);
            for (let c = Math.floor((x0 + x - 9) / 6); c <= Math.ceil((x0 + x + 3) / 6); c++) {
              const cx = c * 6 + 3 - x0;
              const r = 3.4 + hash(c, 64) * 2;
              const dx = x - cx;
              if (dx * dx < r * r) y = Math.min(y, hill(cx) + 1 - Math.sqrt(r * r - dx * dx));
            }
            return y;
          };
          P[0].moveTo(0, G + 2);
          for (let x = 0; x <= tw; x += 1.5) P[0].lineTo(x, top(x));
          P[0].lineTo(tw + 1, top(tw + 1));
          P[0].lineTo(tw + 1, G + 2);
          P[0].closePath();
          // and under the trees, the windows of farms far off (only lit, and only seen, by night)
          for (let k = 0; k < 3; k++) {
            const x = 10 + R() * (tw - 20);
            const y = ridgeY(i, tw, x, 64, 130, 24, 90) + 7 + R() * 5;
            P[1].rect(x - 2.2, y - 1.8, 4.4, 3.6);
            P[2].rect(x - 1, y - 0.7, 2, 1.4);
          }
        }),
        // the top terrace with its farmhouse, then the paddies below it, their walls and bunds
        terr: layer(65, 320, 40, ['t0', 'riser', 'lip', 'trunk', 'tree', 'treeLit', 'fruit', 'thatch', 'thatchDark', 'fwall', 'fwood', 'lit',
          't1', 't2', 't3', 't4', 'riser', 'lip', 'sprout', 'akariGlow', 'akari'], (P, R, i, items, tw) => {
          const x0 = i * tw;
          // each paddy reaches down to the next one's edge (and no further: nothing is filled
          // twice); along its top edge, the earth wall of the terrace above and the sunlit bund
          terrBand(P[0], x0, tw, 0);
          terrStrip(P[1], x0, tw, 0, 0, 2.6);
          terrStrip(P[2], x0, tw, 0, -1, 0.1);
          // on the top terrace: a thatched farmhouse and a tree or two
          const [trunk, tree, treeLit, fruit, thatch, thatchDark, fwall, fwood, lit] = P.slice(3, 12);
          if (R() < 0.6) {
            const hx = 30 + R() * 220;
            const y = Math.max(terrY(0, x0 + hx), terrY(0, x0 + hx + 44)) + 3;
            fwall.rect(hx, y - 13, 44, 14);
            quad(thatch, hx - 7, y - 12, hx + 51, y - 12, hx + 41, y - 32, hx + 3, y - 32);
            // the courses of the thatch, and its ridge
            thatchDark.rect(hx - 3.5, y - 19.2, 51, 1.2);
            thatchDark.rect(hx, y - 26, 44, 1.2);
            rr(thatchDark, hx + 2, y - 35, 40, 4.5, 2);
            fwood.rect(hx, y - 12, 44, 2);
            fwood.rect(hx + 6, y - 10, 9, 11);
            fwood.rect(hx - 2, y - 2, 48, 2);
            lit.rect(hx + 24, y - 9, 12, 6);
            items.push({ h: 1, x: hx + 30, y: y - 6 });
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
            circ(treeLit, tx - h * 0.08, y - h * 0.86, h * 0.17);
            circ(treeLit, tx - h * 0.33, y - h * 0.64, h * 0.1);
            for (let d = 0; d < 6; d++) circ(fruit, tx + (R() - 0.5) * h * 0.7, y - h * (0.5 + R() * 0.45), 1.1);
          }
          // below it the walls and bunds keep clear of the paddies, so they share two paths
          // (the lowest paddy's are hidden behind the bund by the road)
          for (let b = 1; b < TERR; b++) {
            terrBand(P[11 + b], x0, tw, b);
            if (b < TERR - 1) {
              terrStrip(P[16], x0, tw, b, 0, 2.6);
              terrStrip(P[17], x0, tw, b, -1, 0.1);
              // little lights along the bund, lit on winter nights (畦のきらめき)
              for (let x = 3 + (b % 2) * 6; x < tw; x += 12) {
                const y = terrY(b, x0 + x) - 0.5;
                P[19].rect(x - 1.6, y - 1.6, 3.2, 3.2);
                P[20].rect(x - 0.7, y - 0.7, 1.4, 1.4);
              }
            }
            if (b < 2) continue;
            // the terrace above is cut into fields by little bunds, some fields a shade deeper
            terrFields(P[11 + b], P[17], R, x0, tw, b - 1);
            // rows of rice
            for (let x = 2 + (b % 2) * 3; x < tw; x += 6) {
              const y = terrY(b, x0 + x);
              const room = (b < TERR - 1 ? terrY(b + 1, x0 + x) : G) - y;
              for (let rI = 5; rI < room - 2; rI += 3.6) P[18].rect(x, y + rI, 1.1, 1.8);
            }
          }
          // the sun glinting on the water, here and there
          for (let g = 0; g < 7; g++) {
            const gx = R() * tw;
            const b = 1 + Math.floor(R() * (TERR - 1));
            const top = terrY(b, x0 + gx) + 3.6;
            const bot = (b < TERR - 1 ? terrY(b + 1, x0 + gx) : 161) - 2;
            const y = top + R() * (bot - top);
            const w = 2.5 + R() * 5;
            if (bot - top > 1) items.push({ x: gx, y, w, ph: R() * TAU, sp: 1.1 + R() * 1.7 });
          }
        }, (ctx, items) => {
          const C = F.C;
          for (let q = 0; q < items.length; q++) {
            const s = items[q];
            if (s.h) {
              // the farmhouse's window, warm in the night
              if (F.dark) glow(ctx, s.x, s.y, 16, 'litGlow', 1);
            } else if (C.glint) {
              const k = 0.5 + 0.5 * Math.sin(F.t * s.sp + s.ph);
              ctx.fillStyle = C.glint;
              ctx.globalAlpha = (F.A.glint || 1) * (0.1 + 0.9 * k * k * k);
              ctx.fillRect(s.x, s.y, s.w, 0.9);
            }
          }
          ctx.globalAlpha = 1;
        }),
        near: layer(67, 300, 40, ['bund', 'bundLip', 'pole', 'cloth', 'cloth2', 'patch', 'face', 'hat', 'grass', 'nanohana', ['higan', 0.9], ['susukiStem', 0.7], 'susuki'],
          (P, R, i, items, tw) => {
            ridge(P[0], i, tw, 67, 164, 3, 70, 8);
            // the sunlit top of the bund
            P[1].moveTo(0, bundY(i, tw, 0) - 0.3);
            for (let x = 8; x <= tw + 1; x += 8) P[1].lineTo(x, bundY(i, tw, x) - 0.3);
            P[1].lineTo(tw + 1, bundY(i, tw, tw + 1) - 0.3);
            P[1].lineTo(tw + 1, bundY(i, tw, tw + 1) + 1.5);
            for (let x = Math.floor((tw + 1) / 8) * 8; x >= 0; x -= 8) P[1].lineTo(x, bundY(i, tw, x) + 1.5);
            P[1].closePath();
            if (R() < 0.35) scarecrow(P, 40 + R() * 220, G, R);
            // tufts of grass along the bund, the season's flowers among them
            for (let x = 2 + R() * 8; x < tw; x += 8 + R() * 9) {
              const y = bundY(i, tw, x) + 1;
              const n = 2 + Math.floor(R() * 2);
              for (let q = 0; q < n; q++) {
                const len = 4 + R() * 6;
                const a = -Math.PI / 2 + (q - (n - 1) / 2) * 0.42 + (R() - 0.5) * 0.3;
                const bx = x + q * 1.8;
                tri(P[8], bx - 0.7, y, bx + Math.cos(a) * len, y + Math.sin(a) * len, bx + 0.7, y);
              }
              const kind = R();
              if (kind < 0.4) tanboFlower(P, x + 2, y, kind < 0.17 ? 0 : kind < 0.32 ? 1 : 2, R);
            }
          }),
      };
    },
    paint(ctx, f, L) {
      skyFill(ctx, 'sky');
      if (f.dark) drawLayer(ctx, L.stars, f.scroll * 0.02);
      const sx = f.W * (0.22 + 0.56 * f.pj);
      const sy = 50 - 24 * Math.sin(Math.PI * f.pj);
      // an autumn night has the big harvest moon of お月見
      const r = f.dark && f.season === 'autumn' ? 16 : 13;
      celestial(ctx, sx, sy, r);
      drawLayer(ctx, L.cloud, f.scroll * 0.04 + f.t * 2.2);
      drawLayer(ctx, L.m1, f.scroll * 0.04);
      drawLayer(ctx, L.m2, f.scroll * 0.1);
      // white egrets (白鷺) over the paddies in spring and summer
      birds(ctx, 'egret', 3, 7, 2.6, 70, 1.6, 66);
      const off = f.scroll * 0.24;
      drawLayer(ctx, L.terr, off);
      // 田毎の月: the moon (or the sun) again in every flooded paddy
      if (f.C.refl) tanboMoons(ctx, sx, off);
      drawLayer(ctx, L.near, f.scroll * 0.6);
      ground(ctx, 'groundEdge');
      // a summer night is a firefly night
      if (f.dark && f.season === 'summer') tanboFireflies(ctx, 18);
      else seasonal(ctx);
      if (!f.dark && f.season === 'autumn') particles(ctx, 'dfly', 4);
      hanamaru(ctx, sx, sy, r + 9, f.fin);
    },
  });
  // A paddy from its top edge down to the next one's.
  function terrBand(p, x0, tw, b) {
    const bot = (x) => (b < TERR - 1 ? terrY(b + 1, x0 + x) + 1 : G + 2);
    p.moveTo(0, terrY(b, x0));
    for (let x = TS; x <= tw + 1; x += TS) p.lineTo(x, terrY(b, x0 + x));
    p.lineTo(tw + 1, terrY(b, x0 + tw + 1));
    p.lineTo(tw + 1, bot(tw + 1));
    for (let x = Math.floor((tw + 1) / TS) * TS; x >= 0; x -= TS) p.lineTo(x, bot(x));
    p.closePath();
  }
  // The fields of terrace b: a few little bunds across it, and every so often a field filled
  // (in fill, the next terrace's colour, a shade deeper). They keep clear of the terrace's
  // walls, so they may be drawn after them.
  function terrFields(fill, bund, R, x0, tw, b) {
    const top = (x) => terrY(b, x0 + x) + 2.6;
    const bot = (x) => terrY(b + 1, x0 + x) - 0.9;
    let xa = TS * (1 + Math.floor(R() * 3));
    while (xa < tw - 3 * TS) {
      const xb = Math.min(tw - TS, xa + TS * (3 + Math.floor(R() * 5)));
      if (R() < 0.42) {
        fill.moveTo(xa, top(xa));
        for (let x = xa + TS; x <= xb; x += TS) fill.lineTo(x, top(x));
        fill.lineTo(xb + 1.5, bot(xb + 1.5));
        for (let x = xb; x > xa; x -= TS) fill.lineTo(x, bot(x));
        fill.lineTo(xa + 1.5, bot(xa + 1.5));
        fill.closePath();
      }
      quad(bund, xb, top(xb), xb + 1.1, top(xb), xb + 2.6, bot(xb + 2.6), xb + 1.5, bot(xb + 1.5));
      xa = xb;
    }
  }
  // A strip along the top edge of paddy b, from d0 to d1 below it.
  function terrStrip(p, x0, tw, b, d0, d1) {
    p.moveTo(0, terrY(b, x0) + d0);
    for (let x = TS; x <= tw + 1; x += TS) p.lineTo(x, terrY(b, x0 + x) + d0);
    p.lineTo(tw + 1, terrY(b, x0 + tw + 1) + d0);
    p.lineTo(tw + 1, terrY(b, x0 + tw + 1) + d1);
    for (let x = Math.floor((tw + 1) / TS) * TS; x >= 0; x -= TS) p.lineTo(x, terrY(b, x0 + x) + d1);
    p.closePath();
  }
  // The moon (or the sun) seen in each paddy under it, a little wider the nearer the paddy.
  function tanboMoons(ctx, sx, off) {
    const gx = sx + off;
    for (let b = 0; b < TERR - 1; b++) {
      const top = terrY(b, gx) + 3.4;
      const bot = terrY(b + 1, gx) - 1.6;
      if (bot - top < 2) continue;
      const y = (top + bot) / 2;
      glow(ctx, sx, y, 10 + b * 2, 'reflGlow', 0.7);
      if (setFill(ctx, 'refl')) {
        ctx.beginPath();
        ctx.ellipse(sx, y, 4.5 + b, Math.min(1.6, (bot - top) * 0.3), 0, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }
  // Fireflies over the paddies on a summer night, each in its own soft light.
  function tanboFireflies(ctx, n) {
    const t = F.t;
    const span = F.W + 80;
    const par = F.scroll * 0.35;
    for (let k = 0; k < n; k++) {
      const a = hash(k, 611);
      const b = hash(k, 612);
      const c = hash(k, 613);
      const x = wrap(a * span - par + Math.sin(t * (0.21 + 0.12 * c) + a * 9) * 34, span) - 40;
      const y = 102 + b * 60 + Math.sin(t * (0.5 + c * 0.4) + b * 7) * 7;
      const pulse = Math.pow(0.5 + 0.5 * Math.sin(t * (1.3 + c) + a * 20), 2);
      glow(ctx, x, y, 5 + 5 * pulse, 'flyGlow', 0.2 + 0.8 * pulse);
      if (setFill(ctx, 'fly')) {
        ctx.globalAlpha *= 0.35 + 0.65 * pulse;
        ctx.beginPath();
        ctx.arc(x, y, 1.15, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
  // A scarecrow (かかし): a straw hat (菅笠), a patched shirt on a cross of poles.
  function scarecrow(P, x, base, R) {
    P[2].rect(x - 1.2, base - 46, 2.4, 47);
    P[2].rect(x - 16, base - 36, 32, 2.2);
    const shirt = P[R() < 0.5 ? 3 : 4];
    quad(shirt, x - 12, base - 37, x + 12, base - 37, x + 8, base - 20, x - 8, base - 20);
    quad(shirt, x - 17, base - 37.6, x - 10, base - 37.6, x - 10.5, base - 30.5, x - 16, base - 30.5);
    quad(shirt, x + 10, base - 37.6, x + 17, base - 37.6, x + 16, base - 30.5, x + 10.5, base - 30.5);
    P[5].rect(x + 2.4, base - 30, 3.4, 3.4);
    circ(P[6], x, base - 42, 4.6);
    tri(P[7], x - 12.5, base - 44.6, x, base - 53, x + 12.5, base - 44.6);
  }
  // The season's flowers by the bund: 菜の花 (kind 0), 彼岸花 (1) or a clump of susuki (2),
  // each in a colour only its season has. The first two stand on stalks of grass, so in the
  // other seasons they are grass.
  function tanboFlower(P, x, y, kind, R) {
    if (kind === 0) {
      const h = 7 + R() * 5;
      P[8].rect(x - 0.4, y - h, 0.8, h);
      for (let q = 0; q < 5; q++) circ(P[9], x + (R() - 0.5) * 3.4, y - h - R() * 3, 1.1 + R() * 0.5);
    } else if (kind === 1) {
      const h = 7 + R() * 4;
      const cy = y - h;
      P[8].rect(x - 0.4, cy, 0.8, h);
      for (let q = 0; q < 6; q++) {
        const a = -Math.PI / 2 + (q - 2.5) * 0.55;
        P[10].moveTo(x, cy);
        P[10].quadraticCurveTo(x + Math.cos(a) * 2.6, cy + Math.sin(a) * 1.4, x + Math.cos(a) * 3.4, cy + Math.sin(a) * 3.4 - 1.4);
      }
    } else {
      const n = 3 + Math.floor(R() * 2);
      for (let q = 0; q < n; q++) {
        const h = 14 + R() * 8;
        const lean = (q - (n - 1) / 2) * 3 + (R() - 0.5) * 2;
        const tx = x + lean * 1.6;
        const ty = y - h;
        P[11].moveTo(x + q * 0.8, y);
        P[11].quadraticCurveTo(x + lean * 0.4, y - h * 0.6, tx, ty);
        // the plume hangs over from the tip
        leaf(P[12], tx, ty, 6 + R() * 2, lean >= 0 ? 0.5 : Math.PI - 0.5, 1.5);
      }
    }
  }

  // ----- 雪国: a snow country village of steep thatched roofs, smoke from the hearths -----
  scene({
    id: 'yukiguni', ja: '雪国', en: 'Snow country', stillT: 11,
    sky: { light: ['#1A56C2', '#3F84DD', '#86B8EE', '#D9E9FA'], dark: ['#03061C', '#0A1242', '#1A2768', '#2C3480'] },
    light: {
      mSnow: '#F6F8FF', mShade: '#BAC6F0', mRock: '#9AA7E2', mFoot: '#7487D2', m2: '#EDF2FD', drift: '#D9E3F8',
      cf: '#33637C', cfSnow: '#DDE8F8', cfShadow: '#BACAF0',
      shadow: '#BACAF0', snowRoof: '#FFFFFF', snowShade: '#BCCDF1', thatch: '#9C6A38', gwall: '#6B4430', beam: '#3F2717', gwin: '#FFD27A',
      kuraWall: '#FBF8F0', kuraBase: '#3D4668', kuraRoof: '#34406E', door: '#4A5A9C', ice: '#D2EAFF', smoke: ['#FFFFFF', 0.85],
      stone: '#9AA2C0', bib: '#E2452B', kasa: '#D9A64C',
      cedar: '#1C4A40', cedarShade: '#123931', cedarSnow: '#FFFFFF',
      body: '#FFFFFF', bodyShade: '#C2D1F2', eye: '#1B2440', bucket: '#E2452B',
      ground: '#F2F6FC', groundEdge: '#DCE6F7',
    },
    dark: {
      mSnow: '#7381C8', mShade: '#4A58A2', mRock: '#3E4B94', mFoot: '#222D6C', m2: '#36468E', drift: '#2E3D80',
      cf: '#0A1236', cfSnow: '#5A6AB4', cfShadow: '#25316E',
      shadow: '#26316E', snowRoof: '#A2B0EE', snowShade: '#6575BE', thatch: '#3A2C50', gwall: '#221C42', beam: '#14112C', gwin: ['#FFC45A', 0.95],
      winGlow: ['#FFB347', 0.6], pool: ['#FFB347', 0.6],
      kuraWall: '#7684CA', kuraBase: '#1E2450', kuraRoof: '#151B42', door: ['#FFB85A', 0.95], ice: '#B9C6FF', smoke: ['#A6B2E6', 0.35],
      stone: '#4E5A9E', bib: '#B23A4C', kasa: '#7E6A48', spark: ['#FFFFFF', 0.9],
      cedar: '#060C28', cedarShade: '#040820', cedarSnow: '#8E9EE2',
      body: '#B4C0F2', bodyShade: '#7383CA', eye: '#1B2440', bucket: '#A8344A',
      ground: '#121933', groundEdge: '#1A2244',
    },
    make() {
      return {
        stars: starLayer(71, 14, -60, 110),
        cloud: cloudLayer(77, 520, 16, 50, 50, 100),
        m1: layer(72, 420, 4, ['mShade', 'mSnow', 'mRock', 'mFoot'], (P, R, i, items, tw) => {
          const top = (x) => ridgeY(i, tw, x, 72, 124, 62, 150);
          // the range in shadow, and over it the faces the sun reaches: under the ridge as it
          // is a little further on, so the slopes going down to the right keep a shadow
          ridge(P[0], i, tw, 72, 124, 62, 150, 8);
          P[1].moveTo(0, G + 2);
          for (let x = 0; x <= tw + 1; x += 8) P[1].lineTo(x, Math.max(top(x), top(x + 34)));
          P[1].lineTo(tw + 1, Math.max(top(tw + 1), top(tw + 35)));
          P[1].lineTo(tw + 1, G + 2);
          P[1].closePath();
          // streaks of rock in the shadow, where the slopes are too steep for snow
          for (let x = 4; x < tw; x += 8) {
            const y0 = top(x);
            const y1 = top(x + 8);
            if (y1 - y0 > 2.4 && hash(i * 131 + x, 72) < 0.55) {
              const len = 6 + hash(i * 131 + x, 73) * 12;
              tri(P[2], x + 2, y1 + 3, x + 4.5, y1 + 3 + len, x + 6.5, y1 + 2);
            }
          }
          // the wooded foot of the range, under the snow line
          ridge(P[3], i, tw, 172, 128, 22, 60, 8);
        }),
        m2: layer(73, 360, 4, ['m2', 'drift'], (P, R, i, items, tw) => {
          ridge(P[0], i, tw, 73, 142, 6, 90, 10);
          // long low drifts across the snowfield (inside the tile: they may not hang over)
          for (let k = 0; k < 3; k++) {
            const rx = 22 + R() * 30;
            ell(P[1], rx + R() * (tw - 2 * rx), 153 + R() * 12, rx, 1.3 + R() * 0.6);
          }
          for (let k = 0; k < 6; k++) items.push({ x: 3 + R() * (tw - 6), y: 151 + R() * 14, ph: R() * TAU, sp: 0.8 + R() * 1.4 });
        }, (ctx, items) => {
          // by night the snow glitters in the moonlight
          if (!setFill(ctx, 'spark')) return;
          const a = ctx.globalAlpha;
          for (let q = 0; q < items.length; q++) {
            const s = items[q];
            const k = Math.sin(F.t * s.sp + s.ph);
            if (k < 0.1) continue;
            const r = 0.5 + 1.5 * k;
            ctx.globalAlpha = a * k;
            ctx.fillRect(s.x - r, s.y - 0.35, r * 2, 0.7);
            ctx.fillRect(s.x - 0.35, s.y - r, 0.7, r * 2);
          }
          ctx.globalAlpha = 1;
        }),
        cf: layer(74, 200, 12, ['cfShadow', 'cf', 'cfSnow'], (P, R, i, items, tw) => {
          // the wood's blue shadow on the snow in front of it
          P[0].moveTo(0, 144);
          P[0].lineTo(tw + 1, 144);
          for (let x = tw + 1; x >= 0; x -= 10) P[0].lineTo(x, 148 + 2.5 * noise(74, (i * tw + x) / 23));
          P[0].closePath();
          for (let x = 4; x < tw; x += 7 + R() * 8) farCedar(P[1], P[2], x, 146, 0.45 + R() * 0.25);
        }),
        houses: layer(75, 300, 70, ['shadow', 'snowRoof', 'snowShade', 'thatch', 'gwall', 'kuraWall', 'kuraBase', 'kuraRoof', 'beam', 'gwin', 'door', 'ice',
          'stone', 'bib', 'kasa', 'snowRoof'], (P, R, i, items) => {
            // one house to a stretch, and beside it now and then a storehouse (蔵), a snow hut
            // (かまくら) or the six jizo of the tale
            if (R() < 0.8) {
              const w = 50 + R() * 34;
              const x = 20 + R() * (250 - w);
              gassho(P, x, w, items, R);
              const by = R();
              if (by < 0.36) kura(P, x + w + 14, R);
              else if (by < 0.54) kamakura(P, x + w + 24, items, R);
              else if (by < 0.68) kasaJizo(P, x + w + 16, R);
            } else {
              const by = R();
              if (by < 0.4) kura(P, 60 + R() * 160, R);
              else if (by < 0.7) kamakura(P, 80 + R() * 140, items, R);
              else kasaJizo(P, 60 + R() * 140, R);
            }
          }, (ctx, items) => {
            if (F.dark) {
              // windows and doorways that glow, and the warm light they lay on the snow
              for (let q = 0; q < items.length; q++) {
                const s = items[q];
                glow(ctx, s.gx, s.gy, s.gr, 'winGlow', 1);
                ctx.save();
                ctx.translate(s.gx, G - 1);
                ctx.scale(1, 0.34);
                glow(ctx, 0, 0, s.gr * 1.45, 'pool', 1);
                ctx.restore();
              }
            }
            if (!setFill(ctx, 'smoke')) return;
            const a = ctx.globalAlpha;
            for (let q = 0; q < items.length; q++) {
              const s = items[q];
              if (!s.smoke) continue;
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
        cedars: layer(76, 360, 30, ['shadow', 'cedar', 'cedarShade', 'cedarSnow'], (P, R, i, items, tw) => {
          if (R() < 0.45) return;
          const x = 30 + R() * 280;
          const n = 1 + Math.floor(R() * 3);
          for (let k = 0; k < n; k++) {
            const cx = x + k * 15 + R() * 6;
            const s = 1 + R() * 0.4 - k * 0.15;
            ell(P[0], cx + 9 * s, G - 0.5, 15 * s, 2.2);
            cedar(P[1], P[2], P[3], cx, G + 1, s);
          }
        }),
      };
    },
    paint(ctx, f, L) {
      skyFill(ctx, 'sky');
      if (f.dark) drawLayer(ctx, L.stars, f.scroll * 0.02);
      const sx = f.W * (0.3 + 0.44 * f.pj);
      const sy = 52 - 16 * Math.sin(Math.PI * f.pj);
      celestial(ctx, sx, sy, 12);
      // a few clouds by day; the night is clear and full of stars
      if (!f.dark) drawLayer(ctx, L.cloud, f.scroll * 0.04 + f.t * 2);
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
  // A cedar (杉) in three tiers, the side away from the sun in shade, and snow on each tier:
  // a cap on its top and a ledge along its lower edge.
  function cedar(body, shade, snow, x, base, s) {
    const h = 44 * s;
    for (let k = 0; k < 3; k++) {
      const y = base - h * (0.3 + k * 0.25);
      const w = (13 - k * 3.4) * s;
      const yb = y + h * 0.26;
      const yt = y - h * 0.24;
      tri(body, x - w, yb, x, yt, x + w, yb);
      tri(shade, x + w * 0.08, yb, x + w * 0.1, yt + h * 0.1, x + w, yb);
      const cy = yt + h * 0.124;
      tri(snow, x - w * 0.55, cy, x, yt, x + w * 0.55, cy);
      quad(snow, x - w - 0.6, yb + 0.4, x + w * 0.35, yb + 0.4, x + w * 0.2, yb - 1.8 * s, x - w * 0.78, yb - 2.6 * s);
    }
    body.rect(x - 1.2 * s, base - h * 0.1, 2.4 * s, h * 0.1 + 1);
  }
  // A cedar far off: the same three tiers drawn as one outline, and snow on its tip.
  function farCedar(body, snow, x, base, s) {
    const h = 44 * s;
    const w0 = 13 * s;
    const w1 = 9.6 * s;
    const w2 = 6.2 * s;
    const y0 = base - h * 0.04;
    const y1 = base - h * 0.29;
    const y2 = base - h * 0.54;
    const yt = base - h * 1.04;
    body.moveTo(x - w0, y0);
    body.lineTo(x - w0 / 2, y1);
    body.lineTo(x - w1, y1);
    body.lineTo(x - w1 / 2, y2);
    body.lineTo(x - w2, y2);
    body.lineTo(x, yt);
    body.lineTo(x + w2, y2);
    body.lineTo(x + w1 / 2, y2);
    body.lineTo(x + w1, y1);
    body.lineTo(x + w0 / 2, y1);
    body.lineTo(x + w0, y0);
    body.closePath();
    tri(snow, x - w2 * 0.55, yt + h * 0.124, x, yt, x + w2 * 0.55, yt + h * 0.124);
  }
  // A gassho house (合掌造り), seen from its gable end: a steep thatched roof deep in snow,
  // the gable face with rows of small windows, icicles, smoke from the hearth.
  function gassho(P, x, w, items, R) {
    const eave = G - 20;
    const cx = x + w / 2;
    const apex = eave - w * 0.92;
    // its cold blue shadow on the snow
    ell(P[0], cx + w * 0.3, G - 0.5, w * 0.8, 3.4);
    // the snow on the roof (with a soft lip along the eaves), the thatch showing under it
    tri(P[1], x - 10, eave + 1, cx, apex - 5, x + w + 10, eave + 1);
    quad(P[2], cx, apex - 5, x + w + 10, eave + 1, x + w + 4, eave + 1, cx, apex + 3);
    rr(P[1], x - 12, eave - 2, w + 24, 6, 3);
    tri(P[3], x - 2, eave, cx, apex + 4, x + w + 2, eave);
    // the gable face and the ground floor
    tri(P[4], x + 5, eave - 1, cx, apex + 12, x + w - 5, eave - 1);
    P[4].rect(x + 3, eave + 3, w - 6, G - eave - 2);
    let wy = eave - 12;
    for (let r = 0; r < 3; r++) {
      const y = eave - 12 - r * 13;
      const half = ((y - apex - 12) / (eave - apex - 13)) * (w / 2 - 5);
      if (half < 8) break;
      P[8].rect(cx - half + 1, y + 9, half * 2 - 2, 1.4);
      const n = Math.max(1, Math.floor((half * 2 - 8) / 9));
      for (let k = 0; k < n; k++) P[9].rect(cx - (n * 9) / 2 + k * 9 + 1.5, y, 6, 6.5);
      wy = y;
    }
    P[8].rect(x + 3, eave + 3, w - 6, 1.6);
    for (let k = 0; k < 2; k++) P[9].rect(x + 8 + k * (w - 26), eave + 8, 10, 7);
    // icicles (つらら) under the lip of snow
    for (let ix = x - 9 + R() * 3; ix < x + w + 8; ix += 3.5 + R() * 4) tri(P[11], ix, eave + 3.4, ix + 0.8, eave + 5.6 + R() * 4.5, ix + 1.6, eave + 3.4);
    items.push({ smoke: 1, x: cx + 2, y: apex - 2, ph: R(), gx: cx, gy: (eave - 12 + wy) / 2 + 4, gr: w * 0.6 });
  }
  // A small white storehouse with a dark base and a snowy roof.
  function kura(P, x, R) {
    const w = 22 + R() * 6;
    const h = 24;
    ell(P[0], x + w * 0.7, G - 0.5, w * 0.75, 2.8);
    P[5].rect(x, G - h, w, h + 1);
    P[6].rect(x, G - h * 0.36, w, h * 0.36 + 1);
    P[9].rect(x + w / 2 - 3, G - h + 7, 6, 6);
    quad(P[7], x - 5, G - h + 1, x + w + 5, G - h + 1, x + w - 1, G - h - 6, x + 1, G - h - 6);
    rr(P[1], x - 6, G - h - 9, w + 12, 6, 3);
  }
  // A kamakura (かまくら), the snow hut children make, with a candle inside by night.
  function kamakura(P, x, items, R) {
    const w = 14 + R() * 4;
    const h = 16 + R() * 4;
    ell(P[0], x + w * 0.7, G - 0.5, w * 1.3, 2.6);
    P[1].moveTo(x - w, G + 1);
    P[1].ellipse(x, G + 1, w, h, 0, Math.PI, TAU);
    P[1].closePath();
    // the side away from the sun
    P[2].moveTo(x + w * 0.1, G + 1 - h);
    P[2].ellipse(x, G + 1, w, h, 0, -Math.PI / 2 + 0.1, 0);
    P[2].lineTo(x + w * 0.55, G + 1);
    P[2].quadraticCurveTo(x + w * 0.62, G + 1 - h * 0.62, x + w * 0.1, G + 1 - h);
    P[2].closePath();
    // the doorway
    P[10].moveTo(x - 4.4, G + 1);
    P[10].lineTo(x - 4.4, G - 5);
    P[10].arc(x, G - 5, 4.4, Math.PI, TAU);
    P[10].lineTo(x + 4.4, G + 1);
    P[10].closePath();
    items.push({ gx: x, gy: G - 4, gr: 15 });
  }
  // かさじぞう: six stone jizo standing in the snow, each with a straw hat and a red bib, as
  // in the tale of the old man who gave them hats on New Year's Eve.
  function kasaJizo(P, x, R) {
    ell(P[0], x + 30, G - 0.4, 34, 2.4);
    for (let k = 0; k < 6; k++) {
      const cx = x + k * 9.6;
      const h = 11 + R() * 2;
      rr(P[12], cx - 3.4, G - h, 6.8, h + 1, 3.2);
      circ(P[12], cx, G - h - 2, 2.8);
      tri(P[13], cx - 3.1, G - h + 2.2, cx + 3.1, G - h + 2.2, cx, G - h + 6.8);
      tri(P[14], cx - 6.2, G - h - 2.6, cx, G - h - 8.6, cx + 6.2, G - h - 2.6);
      // snow on the hat
      tri(P[15], cx - 3.2, G - h - 5.6, cx, G - h - 8.6, cx + 3.2, G - h - 5.6);
    }
    // and drifted round their feet
    rr(P[15], x - 6, G - 3.2, 60, 5, 2.5);
  }
  function yukidaruma(ctx, x, base, s) {
    ctx.save();
    ctx.translate(x, base);
    ctx.scale(s, s);
    if (setFill(ctx, 'shadow')) {
      ctx.beginPath();
      ctx.ellipse(8, -0.6, 19, 2.6, 0, 0, TAU);
      ctx.fill();
    }
    // the side away from the light, then the lit snow over it
    if (setFill(ctx, 'bodyShade')) {
      ctx.beginPath();
      ctx.ellipse(0, -10, 13, 10.5, 0, 0, TAU);
      ctx.moveTo(9, -28);
      ctx.ellipse(0, -28, 9, 8.5, 0, 0, TAU);
      ctx.fill();
    }
    if (setFill(ctx, 'body')) {
      ctx.beginPath();
      ctx.ellipse(-1.6, -11.2, 11, 9.2, 0, 0, TAU);
      ctx.moveTo(6.2, -29);
      ctx.ellipse(-1.2, -29, 7.4, 7.2, 0, 0, TAU);
      ctx.fill();
    }
    // a red bucket for a hat
    if (setFill(ctx, 'bucket')) {
      ctx.beginPath();
      ctx.moveTo(-6.6, -34.2);
      ctx.lineTo(6.6, -35.4);
      ctx.lineTo(5.2, -42.6);
      ctx.lineTo(-5.4, -41.6);
      ctx.closePath();
      ctx.fill();
    }
    if (F.C.eye) {
      ctx.globalAlpha = 1;
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
    // bright turquoise under the surface, going deep blue down to the sea floor
    sky: {
      light: ['#3FD0E2', '#1FB0D8', '#178CCB', '#166BBE', '#1A4FA8'],
      dark: ['#0F3C7C', '#0A2864', '#081A4C', '#071139', '#060B2C'],
    },
    light: {
      surface: '#A8F2F4', surfaceLine: ['#FFFFFF', 0.9], sun: ['#FFFDE8', 0.6], ray: ['#E8FFFF', 0.42],
      rockFar: '#4A86D6', rock: '#24519E', rockTop: '#3A74C8', floor: '#132C6E',
      kelp: '#22A774', kelp2: '#14876A', kelp3: '#86C23A',
      c1: '#FF5A93', c2: '#8A5CF6', c3: '#FFB833', c4: '#16BFA8', coralHi: ['#FFFFFF', 0.55], star5: '#FF7A3D',
      f1: '#FFD23F', f2: '#FF8A4C', f3: '#F4F8FF', fin2: '#FFFFFF', jelly: ['#FF9AD5', 0.85],
      whale: '#1E3C8C', whaleBelly: '#8CC0EA', whaleRim: ['#6FA8EC', 0.9], whaleLine: ['#5C8FD6', 0.9], eye: '#0E1A44',
      ring: ['#FFFFFF', 0.45], ground: '#FAF4E6', groundEdge: '#EADCBC',
    },
    dark: {
      surface: '#2C64B0', surfaceLine: ['#9FE4FF', 0.7], sun: ['#9FD8FF', 0.32], ray: ['#7FE6FF', 0.16],
      rockFar: '#122A68', rock: '#0B1A4A', rockTop: '#18306E', floor: '#060D30',
      kelp: '#0E4E5E', kelp2: '#0B3B52', kelp3: '#155A50',
      c1: '#E8409A', c2: '#8A5CF0', c3: '#2FD8C8', c4: '#4F7CFF', coralHi: ['#FFFFFF', 0.5], star5: '#E86A50',
      g0: ['#FF5AB4', 0.6], g1: ['#A77BFF', 0.6], g2: ['#3FF0DC', 0.6], g3: ['#6F95FF', 0.6],
      f1: '#3C7CE0', f2: '#4C5FD8', f3: '#5A9CF0', fin2: '#9FF6FF', jelly: ['#C8F6FF', 0.95], jellyGlow: ['#4FE0FF', 0.6], fly: ['#7FFFE6', 1],
      whale: '#081640', whaleBelly: '#14306E', whaleRim: ['#4A7CE0', 0.95], whaleLine: ['#1E3F86', 0.9], eye: '#3A64B8', wake: ['#8FFFF0', 0.9],
      ring: ['#7FE8FF', 0.4], ground: '#0B1530', groundEdge: '#132048',
    },
    make() {
      return {
        rays: layer(91, 240, 160, [], (P, R, i, items) => {
          if (R() < 0.8) items.push({ x: R() * 240, w: 10 + R() * 16, ph: R() * TAU });
        }, (ctx, items) => {
          // shafts of light from the surface, fainter where they reach down past the whale
          if (!setFill(ctx, 'ray')) return;
          const top = F.top - 2;
          const k = (UMINAKA_RAY_Y - top) / (G - top);
          for (let q = 0; q < items.length; q++) {
            const s = items[q];
            const a = F.A.ray * (0.5 + 0.5 * Math.sin(F.t * 0.4 + s.ph));
            const ml = s.x + 50 * k;
            const mr = s.x + s.w + (s.w + 50) * k;
            ctx.globalAlpha = a;
            ctx.beginPath();
            ctx.moveTo(s.x, top);
            ctx.lineTo(s.x + s.w, top);
            ctx.lineTo(mr, UMINAKA_RAY_Y);
            ctx.lineTo(ml, UMINAKA_RAY_Y);
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = a * 0.45;
            ctx.beginPath();
            ctx.moveTo(ml, UMINAKA_RAY_Y);
            ctx.lineTo(mr, UMINAKA_RAY_Y);
            ctx.lineTo(s.x + s.w * 2 + 50, G);
            ctx.lineTo(s.x + 50, G);
            ctx.closePath();
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        }),
        rocksFar: layer(97, 460, 4, ['rockFar'], (P, R, i, items, tw) => ridge(P[0], i, tw, 97, 140, 36, 140, 8)),
        rocks: layer(92, 380, 40, ['rock', 'rockTop'], (P, R, i, items, tw) => {
          ridge(P[0], i, tw, 92, 158, 22, 80, 8);
          // a tall rock with an arch through it
          let arch = null;
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
            arch = x;
          }
          // the light from above on the rocks' tops, but not across the arch standing in front
          const y = (x) => ridgeY(i, tw, x, 92, 158, 22, 80);
          const band = (x0, x1) => {
            if (x1 - x0 < 4) return;
            const n = Math.max(1, Math.round((x1 - x0) / 8));
            P[1].moveTo(x0, y(x0));
            for (let k = 1; k <= n; k++) P[1].lineTo(x0 + ((x1 - x0) * k) / n, y(x0 + ((x1 - x0) * k) / n));
            for (let k = n; k >= 0; k--) P[1].lineTo(x0 + ((x1 - x0) * k) / n, y(x0 + ((x1 - x0) * k) / n) + 3);
            P[1].closePath();
          };
          if (arch === null) band(0, tw);
          else {
            band(0, arch - 28);
            band(arch + 36, tw);
          }
        }),
        jelly: layer(93, 460, 30, [], (P, R, i, items) => {
          if (R() < 0.8) items.push({ x: R() * 460, y: 40 + R() * 50, s: 0.8 + R() * 0.5, ph: R() * TAU });
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
              glow(ctx, j.x, y, 20 * j.s, 'jellyGlow', 0.8 + 0.2 * pulse);
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
            const r = R();
            const key = r < 0.4 ? 'kelp' : r < 0.8 ? 'kelp2' : 'kelp3';
            for (let b = 0; b < 3; b++) items.push({ x: x + b * 4 - 4, h: (40 + R() * 60) * (b === 1 ? 1 : 0.7), w: 3 + R() * 2.5, ph: R() * TAU, key });
          }
        }, (ctx, items) => {
          // ribbons of kelp that sway, each a long tapering leaf; those of a colour in one shape
          for (let c = 0; c < UMINAKA_KELP.length; c++) {
            const key = UMINAKA_KELP[c];
            let any = false;
            for (let q = 0; q < items.length; q++) {
              const k = items[q];
              if (k.key !== key) continue;
              if (!any) {
                if (!setFill(ctx, key)) break;
                ctx.beginPath();
                any = true;
              }
              const sway = Math.sin(F.t * 0.7 + k.ph) * 9;
              const x = k.x;
              const h = k.h;
              const w = k.w;
              ctx.moveTo(x - w / 2, G + 1);
              ctx.bezierCurveTo(x - w - 5 + sway * 0.2, G - h * 0.35, x - w + 5 + sway * 0.6, G - h * 0.7, x + sway, G - h);
              ctx.bezierCurveTo(x + w + 5 + sway * 0.6, G - h * 0.7, x + w - 5 + sway * 0.2, G - h * 0.35, x + w / 2, G + 1);
              ctx.closePath();
            }
            if (any) ctx.fill();
          }
          ctx.globalAlpha = 1;
        }),
        // the reef: a low bank of dark stones along the floor, coral of four kinds on it, and
        // now and then a starfish; by night the coral glows
        coral: layer(96, 540, 40, ['floor', 'c1', 'c2', 'c3', 'c4', 'coralHi', 'star5'], (P, R, i, items, tw) => {
          ridge(P[0], i, tw, 96, G - 1, 9, 26, 6);
          for (let k = 0; k < 5; k++) {
            if (R() < 0.3) continue;
            const x = ((k + 0.15 + R() * 0.7) * tw) / 5;
            const kind = Math.floor(R() * 4);
            uminakaCoral(P, R, x, kind);
            items.push({ x, y: G - 10, k: UMINAKA_GLOW[kind], ph: R() * TAU });
          }
          for (let s = 0; s < 2; s++) {
            if (R() < 0.5) continue;
            const x = R() * tw;
            for (let a = 0; a < 5; a++) leaf(P[6], x, G - 5, 5.5, -Math.PI / 2 + (a * TAU) / 5, 1.6);
          }
        }, (ctx, items) => {
          // by night each clump glows: a halo of its own light, in two flat rings
          if (!F.dark) return;
          for (let q = 0; q < items.length; q++) {
            const it = items[q];
            if (!setFill(ctx, it.k)) continue;
            const a = ctx.globalAlpha * (0.75 + 0.25 * Math.sin(F.t * 1.3 + it.ph));
            for (let k = 0; k < 2; k++) {
              ctx.globalAlpha = a * (0.24 + 0.08 * k);
              ctx.beginPath();
              ctx.arc(it.x, it.y, 18 - k * 7, 0, TAU);
              ctx.fill();
            }
          }
          ctx.globalAlpha = 1;
        }),
      };
    },
    paint(ctx, f, L) {
      skyFill(ctx, 'sky');
      // the sun (or the moon) through the surface, in rings of light, and the surface far
      // above, rippling, its underside catching the light
      if (setFill(ctx, 'sun')) {
        const gx = f.W * (0.22 + 0.4 * f.pj);
        ctx.globalAlpha *= 0.27;
        for (let k = 0; k < 2; k++) {
          ctx.beginPath();
          ctx.arc(gx, -14, 100 - k * 42, 0, TAU);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      uminakaSurface(ctx, f, 'surface', F.top - 2, 5);
      uminakaSurface(ctx, f, 'surfaceLine', 5, 6.6);
      drawLayer(ctx, L.rays, f.scroll * 0.12);
      // the whale passes over as the round goes on (in the still frame, clear of the finale)
      whale(ctx, f.W * (f.still ? 0.45 : 1.2 - 0.8 * f.pj), 66, 1.1);
      drawLayer(ctx, L.rocksFar, f.scroll * 0.06);
      drawLayer(ctx, L.jelly, f.scroll * 0.18);
      drawLayer(ctx, L.rocks, f.scroll * 0.2);
      drawLayer(ctx, L.fish, f.scroll * 0.3 + f.t * 7);
      drawLayer(ctx, L.kelp, f.scroll * 0.5);
      drawLayer(ctx, L.coral, f.scroll * 0.85);
      ground(ctx, 'groundEdge');
      particles(ctx, 'bubble', 14);
      if (f.dark) particles(ctx, 'fly', 10);
      // the finishing touch: a ring of bubbles in the shape of a はなまる, floating up in a glow
      if (f.fin > 0 && F.C.bubble) {
        const s = 1.4;
        const y = 84 - (f.still ? 0 : 20 * f.fin);
        glow(ctx, f.W * 0.72, y, 58, 'ring', f.fin);
        ctx.save();
        ctx.translate(f.W * 0.72, y);
        ctx.scale(s, s);
        ctx.strokeStyle = F.C.bubble;
        ctx.globalAlpha = (F.A.bubble || 0.5) * f.fin;
        ctx.lineWidth = 3 / s;
        ctx.lineCap = 'round';
        ctx.setLineDash(U.dots);
        ctx.stroke(U.hana);
        ctx.restore();
      }
    },
  });
  const FISH_KEYS = ['', 'f1', 'f2', 'f3'];
  const UMINAKA_GLOW = ['g0', 'g1', 'g2', 'g3'];
  const UMINAKA_KELP = ['kelp', 'kelp2', 'kelp3'];
  const UMINAKA_RAY_Y = 96;   // where the shafts of light grow fainter
  // The surface seen from below, rippling: the band between depths y0 and y1, both following
  // the ripple (y0 above the picture: from its top).
  const uminakaRipple = (x, t) => Math.sin(x * 0.05 + t * 0.9) * 2.4 + Math.sin(x * 0.13 - t * 0.6) * 1.2;
  function uminakaSurface(ctx, f, key, y0, y1) {
    if (!setFill(ctx, key)) return;
    const top = y0 <= F.top - 2;
    const end = Math.ceil((f.W + 14) / 12) * 12 - 2;
    ctx.beginPath();
    ctx.moveTo(-2, top ? y0 : y0 + uminakaRipple(-2, f.t));
    if (!top) for (let x = 10; x <= end; x += 12) ctx.lineTo(x, y0 + uminakaRipple(x, f.t));
    else ctx.lineTo(end, y0);
    for (let x = end; x >= -2; x -= 12) ctx.lineTo(x, y1 + uminakaRipple(x, f.t));
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  // A clump of coral standing on the floor at x: branching (0), a sea fan (1), a brain coral (2)
  // or tube sponges (3), with a stone at its foot. P: the coral layer's roles (P[5], the light
  // on the fan's ribs, the coral's ridges and the tubes' rims). Shapes go clockwise so where
  // they overlap they stay filled.
  function uminakaCoral(P, R, x, kind) {
    const by = G - 3;
    if (kind === 0) {
      const n = 6 + Math.floor(R() * 3);
      for (let b = 0; b < n; b++) {
        const a = -Math.PI / 2 + (b - (n - 1) / 2) * 0.27 + (R() - 0.5) * 0.15;
        const len = 14 + R() * 15;
        const tx = x + Math.cos(a) * len;
        const ty = by + Math.sin(a) * len;
        uminakaBranch(P[1], x, by, tx, ty, 2.5, 1.6);
        if (R() < 0.7) {
          const m = 0.45 + R() * 0.2;
          const mx = x + (tx - x) * m;
          const my = by + (ty - by) * m;
          const a2 = a + (R() < 0.5 ? -0.65 : 0.65);
          const l2 = len * (0.35 + R() * 0.2);
          uminakaBranch(P[1], mx, my, mx + Math.cos(a2) * l2, my + Math.sin(a2) * l2, 1.6, 1.3);
        }
      }
    } else if (kind === 1) {
      // a fan, taller than wide, on a short stalk, its ribs and a cross vein in a lighter line
      const rx = 11 + R() * 6;
      const ry = 16 + R() * 9;
      const cy = by - 3;
      P[2].moveTo(x, by - 1);
      P[2].ellipse(x, cy, rx, ry, 0, -Math.PI + 0.36, -0.36);
      P[2].closePath();
      P[2].rect(x - 1.4, cy, 2.8, 6);
      for (let k = 0; k < 6; k++) {
        const a = -Math.PI + 0.5 + (k * (Math.PI - 1)) / 5;
        uminakaBranch(P[5], x, cy + 1, x + Math.cos(a) * rx * 0.9, cy + Math.sin(a) * ry * 0.9, 0.5, 0.35, false);
      }
      uminakaArc(P[5], x, cy, rx * 0.62, ry * 0.62, -Math.PI + 0.45, -0.45, 0.45);
    } else if (kind === 2) {
      // a brain coral: a dome or two, with its ridges
      const rx = 11 + R() * 4;
      const ry = 8 + R() * 3;
      ell(P[3], x, G - 4, rx, ry);
      ell(P[3], x + rx * 0.9, G - 2, rx * 0.55, ry * 0.6);
      for (const k of [0.68, 0.38]) uminakaArc(P[5], x, G - 4, rx * k, ry * k, Math.PI, TAU, 0.55);
    } else {
      const n = 3 + Math.floor(R() * 2);
      for (let k = 0; k < n; k++) {
        const h = 10 + R() * 16;
        const tx = x - 8 + k * 5.4 + (R() - 0.5) * 1.5;
        rr(P[4], tx, G - 1 - h, 4.8, h + 2, 2.4);
        uminakaArc(P[5], tx + 2.4, G - h + 0.8, 1.6, 0.8, 0, TAU, 0.45);
      }
    }
    ell(P[0], x + 12, G - 1, 7, 3.5);
  }
  // One branch of coral from (x0, y0) to (x1, y1), tapering from w0 to w1 (half widths), with
  // a round tip unless tip is false (then it is a thin rib, filled rather than stroked).
  function uminakaBranch(p, x0, y0, x1, y1, w0, w1, tip) {
    const d = Math.hypot(x1 - x0, y1 - y0) || 1;
    const nx = -(y1 - y0) / d;
    const ny = (x1 - x0) / d;
    p.moveTo(x0 - nx * w0, y0 - ny * w0);
    p.lineTo(x1 - nx * w1, y1 - ny * w1);
    p.lineTo(x1 + nx * w1, y1 + ny * w1);
    p.lineTo(x0 + nx * w0, y0 + ny * w0);
    p.closePath();
    if (tip !== false) circ(p, x1, y1, w1 + 0.6);
  }
  // A thin band along part of an ellipse (angles a0 to a1, half width w), as a filled shape.
  function uminakaArc(p, x, y, rx, ry, a0, a1, w) {
    p.moveTo(x + Math.cos(a0) * (rx + w), y + Math.sin(a0) * (ry + w));
    p.ellipse(x, y, rx + w, ry + w, 0, a0, a1);
    p.ellipse(x, y, rx - w, ry - w, 0, a1, a0, true);
    p.closePath();
  }
  // A humpback whale swimming left: its long flipper, a pale grooved belly, the light along its
  // back, and its tail beating slowly.
  function whale(ctx, x, y, s) {
    if (!setFill(ctx, 'whale')) return;
    const tail = F.still ? 0 : Math.sin(F.t * 0.8) * 4;
    const flip = F.still ? 0 : Math.sin(F.t * 0.8 + 1.2) * 0.12;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    // the flipper, the body and the small dorsal fin, as one shape
    ctx.beginPath();
    ctx.ellipse(-20 + Math.cos(0.6 + flip) * 14, 9 + Math.sin(0.6 + flip) * 14, 16, 3.4, 0.6 + flip, 0, TAU);
    ctx.moveTo(-58, 0);
    ctx.bezierCurveTo(-56, -20, -10, -24, 26, -10);
    ctx.quadraticCurveTo(44, -4, 58, -6 + tail);
    ctx.lineTo(70, -16 + tail);
    ctx.quadraticCurveTo(68, -4 + tail, 72, 6 + tail);
    ctx.lineTo(58, 0 + tail);
    ctx.quadraticCurveTo(40, 8, 20, 12);
    ctx.bezierCurveTo(-10, 18, -52, 16, -58, 0);
    ctx.closePath();
    ctx.moveTo(22, -11);
    ctx.lineTo(31, -16);
    ctx.lineTo(33, -8);
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
    if (F.C.whaleLine) {
      // the grooves of the belly
      ctx.strokeStyle = F.C.whaleLine;
      ctx.globalAlpha = F.A.whaleLine || 1;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      for (let k = 0; k < 3; k++) {
        ctx.moveTo(-50 + k * 2, 8 + k * 1.6);
        ctx.quadraticCurveTo(-24, 12.5 + k * 1.2, 4 - k * 6, 11 + k * 0.8);
      }
      ctx.stroke();
    }
    if (F.C.whaleRim) {
      ctx.strokeStyle = F.C.whaleRim;
      ctx.globalAlpha = F.A.whaleRim || 1;
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-55, -5);
      ctx.bezierCurveTo(-50, -18, -12, -21.5, 24, -9);
      ctx.stroke();
    }
    if (setFill(ctx, 'eye')) {
      ctx.beginPath();
      ctx.arc(-44, 2, 1.7, 0, TAU);
      ctx.fill();
    }
    // by night the sea's tiny lights wake in its wake, glittering (in two sets, by turns) and
    // dwindling behind the tail
    if (F.C.wake) {
      glow(ctx, 78, tail * 0.5, 22, 'wake', 0.7);
      ctx.fillStyle = F.C.wake;
      for (let g = 0; g < 2; g++) {
        ctx.globalAlpha = (F.A.wake || 1) * (0.45 + 0.55 * Math.abs(Math.sin(F.t * 2.2 + g * 1.6)));
        ctx.beginPath();
        for (let k = g; k < 12; k += 2) {
          const u = k / 12;
          const dx = 66 + k * 9;
          const dy = tail * (1 - u) + Math.sin(k * 2.1 + F.t * 0.6) * (3 + 8 * u);
          const r = 1.6 - u * 1.1;
          ctx.moveTo(dx + r, dy);
          ctx.arc(dx, dy, r, 0, TAU);
        }
        ctx.fill();
      }
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
    // a deep blue going gold behind the mountains; by night navy going violet
    sky: {
      light: ['#1F54D2', '#3A80E8', '#79BBF3', '#CBE9F7', '#FFE4B5', '#FFC98C', '#FFB877'],
      dark: ['#02061E', '#081246', '#141C62', '#2C2474', '#4E2E86', '#74388E', '#8A4090'],
    },
    light: {
      m0: '#A6B1EB', m1: '#7E8ED8', m1Rim: ['#D2DAFF', 0.9], pier: '#6676C2', deck: '#36448E', deckRim: '#DCE4FF',
      mast: '#2E3A78', cat: ['#2E3A78', 0.65], sigG: '#3FE0A0', sigR: '#FF5A3C',
      hill: '#47A86B', tree: '#2A8150', hill2: '#2F8E58', hwall: '#FFF3DC', roof: '#3C4A7C', roof2: '#C2553A', hlit: '#3C4A7C',
      field: '#7CC66E', row: ['#3F9A52', 0.75], pole: '#2E3866', wire: ['#2E3352', 0.85],
      xpost: '#1B2440', xboard: '#F2B43A', xedge: ['#1B2440', 0.9], xoff: '#8E2E22',
      body: '#FFFFFF', troof: '#B9C3E6', stripe: '#2F4FD0', stripe2: '#F2B43A', twin: '#2B3A7C', bogie: '#1B2440', head: '#FFE58A',
      plat: '#D5DAF0', platFace: '#7D89C6', platLine: '#F2B43A', sign: '#FFFFFF', signLine: '#2F4FD0', signText: '#1B2440', signText2: '#FFFFFF',
      ground: '#FAF4E6', groundEdge: '#EADCBE',
    },
    dark: {
      m0: '#1C2060', m1: '#131850', m1Rim: ['#5C66BE', 0.8], mLit: ['#FFCB6A', 0.9], pier: '#1E266A', deck: '#2C3884', deckRim: ['#8E9EFF', 0.7],
      mast: '#0B1040', cat: ['#3E4A98', 0.85], sigG: '#3FFFB0', sigR: '#FF4D3A',
      hill: '#141A4C', tree: '#0E1440', hill2: '#0F1541', hwall: '#1E2562', roof: '#0D1236', roof2: '#2A1838', hlit: ['#FFC45A', 0.95],
      field: '#15204C', row: ['#22306A', 1], pole: '#060924', wire: ['#3A4488', 0.9],
      xpost: '#0C1034', xboard: '#7A6630', xedge: ['#05081E', 0.9], xoff: '#3A1418', xlamp: ['#FF5A3C', 1], xglow: ['#FF5A3C', 0.5],
      body: '#3A4794', troof: '#232D6E', stripe: '#7F98FF', stripe2: '#F2B43A', twin: ['#FFE08A', 0.98], trainGlow: ['#FFD27A', 0.1],
      bogie: '#070A26', head: '#FFF6D6', beam: ['#FFE9B0', 0.16],
      plat: '#2C3470', platFace: '#1A2050', platLine: '#C89A30', sign: '#FBF8EE', signLine: '#3F5DE6', signText: '#1B2440', signText2: '#FFFFFF',
      signGlow: ['#FFF0C0', 0.12],
      ground: '#0F1430', groundEdge: '#1B2152',
    },
    // the paddies: flooded and mirroring the sky in spring, green in summer, gold at harvest,
    // under snow in winter (the hills' trees turn in autumn and the hills go dull in winter)
    seasons: {
      spring: { light: { field: '#8ECFF0', row: ['#4FB06A', 0.85] }, dark: { field: '#1C2C68', row: ['#2E447E', 1] } },
      autumn: { light: { field: '#E9C25E', row: ['#C4902C', 0.8], tree: '#D8742E' }, dark: { field: '#2A2A50', row: ['#3A3660', 1] } },
      winter: { light: { field: '#DCE6F7', row: ['#B2C1E4', 0.9], hill: '#7FA486', hill2: '#668F72', tree: '#3D6A58' }, dark: { field: '#26306A', row: ['#34407A', 1] } },
    },
    make() {
      return {
        stars: starLayer(121, 9, -60, 100),
        cloud: cloudLayer(122, 460, 26, 70, 46, 96),
        // the far range, only down to where the near mountains always hide it
        m0: layer(128, 520, 4, ['m0'], (P, R, i, items, tw) => denshaRidge(P[0], i, tw, 128, 114, 50, 150, 20, 124)),
        // the near mountains with light along their ridge, and by night the lights of the
        // towns at their feet (seen through the viaduct's arches)
        m1: layer(123, 420, 4, ['m1Rim', 'm1', 'mLit'], (P, R, i, items, tw) => {
          denshaRidge(P[0], i, tw, 123, 120, 54, 110, 8, 152);
          denshaRidge(P[1], i, tw, 123, 121.6, 54, 110, 8, 152);
          for (let k = 0; k < 26; k++) {
            const x = R() * tw;
            const y = 119 + R() * 20;
            if (y > ridgeY(i, tw, x, 123, 120, 54, 110) + 4) P[2].rect(x, y, 1.6, 1.6);
          }
        }),
        viaduct: layer(124, 480, 4, ['pier', 'deck', 'deckRim', 'mast', ['cat', 0.7]], (P, R, i, items) => {
          P[1].rect(0, VY, 481, 6.5);
          P[1].rect(0, VY - 1.6, 481, 0.9);
          P[2].rect(0, VY, 481, 0.9);
          // a row of arches under the deck
          for (let x = 0; x < 480; x += 30) {
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
          // masts and their brackets for the overhead wire, and the wire
          for (let x = 14; x < 480; x += 60) {
            P[3].rect(x - 0.7, VY - 26, 1.4, 26);
            P[3].rect(x - 0.7, VY - 26, 6.5, 1.2);
            line(P[4], x, VY - 19, x + 5.4, VY - 25);
          }
          line(P[4], -1, VY - 22, 481, VY - 22);
          // a signal now and then
          for (let k = 0; k < 2; k++) {
            if (R() < 0.4) continue;
            const sx = k * 240 + 36 + Math.floor(R() * 3) * 60;
            P[3].rect(sx - 0.7, VY - 19, 1.4, 19);
            rr(P[3], sx - 2.7, VY - 28.5, 5.4, 10.5, 1.8);
            items.push({ x: sx, y: VY - 23.3, s: Math.floor(R() * 1e6) });
          }
        }, (ctx, items) => {
          // green, and now and then red for a while; by night they glow
          for (let q = 0; q < items.length; q++) {
            const it = items[q];
            const red = hash(it.s, Math.floor(F.t / 6)) < 0.3;
            const key = red ? 'sigR' : 'sigG';
            const ly = red ? it.y - 2.6 : it.y + 2.6;
            if (F.dark) glow(ctx, it.x, ly, 9, key, 0.55);
            rect(ctx, key, it.x - 1.4, ly - 1.4, 2.8, 2.8);
          }
        }),
        hills: layer(125, 360, 30, ['hill', 'tree', 'hill2', 'hwall', 'roof', 'roof2', 'hlit'], (P, R, i, items, tw) => {
          ridge(P[0], i, tw, 125, 150, 12, 110, 8);
          // trees in clumps along the hill
          for (let k = 0; k < 6; k++) {
            const x = R() * tw;
            if (R() < 0.5) continue;
            const y = ridgeY(i, tw, x, 125, 150, 12, 110);
            const r = 3.5 + R() * 3;
            circ(P[1], x, y - r * 0.55, r);
            circ(P[1], x + r * 0.95, y - r * 0.25, r * 0.75);
          }
          ridge(P[2], i, tw, 126, 158, 5, 70, 8);
          for (let k = 0; k < 3; k++) {
            if (R() < 0.4) continue;
            const x = R() * (tw - 30);
            const y = ridgeY(i, tw, x + 10, 125, 150, 12, 110) + 4;
            P[3].rect(x, y - 9, 20, 10);
            quad(P[R() < 0.3 ? 5 : 4], x - 3, y - 8, x + 23, y - 8, x + 18, y - 15, x + 2, y - 15);
            P[6].rect(x + 4, y - 6.5, 5, 3.5);
            P[6].rect(x + 12, y - 6.5, 5, 3.5);
          }
        }),
        // (the wires reach the next tile's pole, up to 270 past this tile)
        fields: layer(127, 320, 272, ['field', ['row', 1], 'pole', ['wire', 0.8], 'xpost', 'xboard', ['xedge', 0.7], 'xoff'],
          (P, R, i, items, tw) => {
            P[0].rect(0, 158, tw + 1, 11);
            for (let x = 2; x < tw; x += 9) line(P[1], x, 160, x - 2.5, 167);
            const px = (j) => 40 + hash(127, j) * 220;
            const x = px(i);
            const nx = tw + px(i + 1);
            P[2].rect(x - 1.6, 84, 3.2, G - 82);
            P[2].rect(x - 10, 92, 20, 2);
            P[2].rect(x - 9.6, 89.4, 1.8, 2.8);
            P[2].rect(x + 7.8, 89.4, 1.8, 2.8);
            for (const dx of [-9, 9]) {
              P[3].moveTo(x + dx, 93);
              P[3].quadraticCurveTo((x + nx) / 2 + dx, 93 + 20, nx + dx, 93);
            }
            if (R() < 0.3) {
              // a level crossing (踏切): a striped post, the crossed boards, two lamps
              const cx = x + 60 + R() * 60;
              P[4].rect(cx - 1.4, 126, 2.8, G - 124);
              for (let y = 145; y < G - 2; y += 7) P[5].rect(cx - 1.4, y, 2.8, 3.5);
              for (const s of [-1, 1]) {
                for (const p of [P[5], P[6]]) {
                  p.moveTo(cx - 10, 128 + s * 4);
                  p.lineTo(cx + 10, 128 - s * 4);
                  p.lineTo(cx + 10, 128 - s * 4 + 3);
                  p.lineTo(cx - 10, 128 + s * 4 + 3);
                  p.closePath();
                }
              }
              P[4].rect(cx - 6, 137.8, 12, 1.4);
              circ(P[4], cx - 6, 138.5, 3);
              circ(P[4], cx + 6, 138.5, 3);
              circ(P[7], cx - 6, 138.5, 1.9);
              circ(P[7], cx + 6, 138.5, 1.9);
              items.push({ x: cx });
            }
          }, (ctx, items) => {
            // by night the crossing lights blink in turn
            if (!F.dark || !F.C.xlamp) return;
            const on = Math.floor(F.t * 1.6) % 2;
            for (let q = 0; q < items.length; q++) {
              const it = items[q];
              const lx = it.x + (on ? -6 : 6);
              glow(ctx, lx, 138.5, 13, 'xglow', 1);
              if (setFill(ctx, 'xlamp')) {
                ctx.beginPath();
                ctx.arc(lx, 138.5, 2.2, 0, TAU);
                ctx.fill();
                ctx.globalAlpha = 1;
              }
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
      drawLayer(ctx, L.m0, f.scroll * 0.02);
      drawLayer(ctx, L.m1, f.scroll * 0.04);
      drawLayer(ctx, L.viaduct, f.scroll * 0.12);
      train(ctx);
      drawLayer(ctx, L.hills, f.scroll * 0.22);
      drawLayer(ctx, L.fields, f.scroll * 0.55);
      // the finishing touch: the station やおき, the stop after ななころび
      if (f.fin > 0) stationSign(ctx, f.W * (1.12 - 0.3 * f.fin), 148);
      ground(ctx, 'groundEdge');
      seasonal(ctx);
      hanamaru(ctx, sx, sy, 21, f.fin);
    },
  });
  // A ridge like ridge(), closed at y bottom instead of at the ground.
  function denshaRidge(p, i, tw, seed, base, amp, scale, step, bottom) {
    const x0 = i * tw;
    p.moveTo(0, bottom);
    for (let x = 0; x <= tw + 1; x += step) p.lineTo(x, base - amp * hills(seed, x0 + x, scale));
    p.lineTo(tw + 1, base - amp * hills(seed, x0 + tw + 1, scale));
    p.lineTo(tw + 1, bottom);
    p.closePath();
  }
  // The shapes of the train and of the light by night, made on their first frame: the three
  // cars (the front one with its nose) one path per colour, the pantograph up to the wire on
  // the middle car; two long halos round the train, its headlight's beam (a long faint sheet
  // and a short brighter one), and the halos round the lit station sign.
  let denshaP = null;
  function denshaPaths() {
    const P = { panto: new Path2D() };
    for (const k of ['body', 'troof', 'stripe', 'stripe2', 'twin', 'bogie', 'head', 'beam', 'beam2']) P[k] = new Path2D();
    for (let c = 0; c < 3; c++) {
      const cx = c * 41;
      const cw = c === 2 ? 40 : 39.5;
      if (c === 2) {
        P.body.moveTo(cx, 0);
        P.body.lineTo(cx, -12);
        P.body.lineTo(cx + 33, -12);
        P.body.quadraticCurveTo(cx + 40, -11, cx + 40, -4);
        P.body.lineTo(cx + 40, 0);
        P.body.closePath();
      } else P.body.rect(cx, -12, 39.5, 12);
      P.troof.rect(cx + 1, -13.2, c === 2 ? 31 : 37.5, 1.4);
      P.stripe.rect(cx, -4.5, cw, 2);
      P.stripe2.rect(cx, -2.5, cw, 1);
      for (let w = 0; w < 4; w++) P.twin.rect(cx + 3 + w * 8, -10, 5, 4);
      P.bogie.rect(cx + 4, -0.4, 9, 2);
      P.bogie.rect(cx + cw - 13, -0.4, 9, 2);
    }
    P.head.rect(117.5, -7.5, 2.4, 2.2);
    P.panto.moveTo(57, -12.5);
    P.panto.lineTo(64, -17);
    P.panto.lineTo(59.5, -21);
    P.panto.moveTo(56.5, -21);
    P.panto.lineTo(63.5, -21);
    tri(P.beam, 120, -6.4, 236, -18, 236, 6);
    tri(P.beam2, 120, -6.4, 176, -12.2, 176, -0.6);
    const sheet = (x, y, rx, ry) => {
      const p = new Path2D();
      ell(p, x, y, rx, ry);
      return p;
    };
    P.halo = sheet(61, -7, 72, 13);
    P.halo2 = sheet(61, -7, 84, 21);
    P.sign = sheet(0, -42, 50, 28);
    P.sign2 = sheet(0, -42, 62, 38);
    return P;
  }
  // The little train runs along the viaduct now and then: white with the line's indigo band,
  // a pantograph up to the wire; by night its windows are lit and its headlight shines ahead.
  function train(ctx) {
    const span = F.W + 900;
    const x = wrap(F.t * 55 - F.scroll * 0.12 + 300, span) - 300;
    if (x > F.W + 10 || x < -240) return;
    const y = VY - 1.5;
    if (!denshaP) denshaP = denshaPaths();
    const T = denshaP;
    ctx.translate(x, y);
    if (F.dark) {
      fillP(ctx, 'trainGlow', T.halo2);
      fillP(ctx, 'trainGlow', T.halo);
      fillP(ctx, 'beam', T.beam);
      fillP(ctx, 'beam', T.beam2);
    }
    if (F.C.bogie) {
      ctx.strokeStyle = F.C.bogie;
      ctx.lineWidth = 0.9;
      ctx.stroke(T.panto);
    }
    fillP(ctx, 'body', T.body);
    fillP(ctx, 'troof', T.troof);
    fillP(ctx, 'stripe', T.stripe);
    fillP(ctx, 'stripe2', T.stripe2);
    fillP(ctx, 'twin', T.twin);
    fillP(ctx, 'bogie', T.bogie);
    fillP(ctx, 'head', T.head);
    ctx.translate(-x, -y);
  }
  // The station's name board (駅名標) on a short platform: やおき in large letters, YAOKI, and
  // the line's band with the stop before it, ななころび; lit from inside by night.
  function stationSign(ctx, x, base) {
    ctx.save();
    ctx.translate(x, base);
    rect(ctx, 'platFace', -96, 0, 192, 10);
    rect(ctx, 'plat', -96, -3.5, 192, 3.5);
    rect(ctx, 'platLine', -96, -2.6, 192, 1.2);
    if (F.dark) {
      if (!denshaP) denshaP = denshaPaths();
      fillP(ctx, 'signGlow', denshaP.sign2);
      fillP(ctx, 'signGlow', denshaP.sign);
    }
    rect(ctx, 'xpost', -24, -26, 2.4, 23);
    rect(ctx, 'xpost', 22, -26, 2.4, 23);
    rect(ctx, 'sign', -36, -60, 72, 36);
    rect(ctx, 'signLine', -36, -35, 72, 6.5);
    if (setFill(ctx, 'signText')) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = FONT_STATION;
      ctx.fillText('やおき', 0, -50);
      ctx.font = FONT_SMALL;
      ctx.fillText('YAOKI', 0, -40.5);
      ctx.globalAlpha = 1;
    }
    if (setFill(ctx, 'signText2')) {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = FONT_SMALL;
      ctx.fillText('◀ ななころび', -33, -31.6);
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
