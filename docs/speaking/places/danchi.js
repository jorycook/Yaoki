/*
 * Yaoki Speaking's place 団地 Apartment block, drawn for world.js: boxes, rubbish bags and flowerpots dropped from the
 * windows; Climb goes up the fire ladder on the block's end wall to the roof and its water tank.
 *
 * It is registered with SpeakingWorld.define(id, place), where place = { palette: { light, dark }, layout(n, W),
 * fall(ctx, o, C), climb(ctx, o, C), ledge(ctx, o, C, pal), summit(ctx, o, C, pal), thing(ctx, o, C), colors(n) }
 * (C: the palette of the theme in use; o as world.js says of back, ledge, summit and thing). The helpers it draws with
 * are world.js's (SpeakingWorld.kit), and a few of its own below.
 *
 * The look is a woodblock print of the estate: at sunset in the light theme, at night in the dark. Falling looks up at
 * the block from the street, its balconies hung with washing, the sky in bands round it. Climb goes up the fire ladder
 * on the end wall while the blocks and the town beside it sink and the sky opens out; on the roof, the water tank, and
 * fireworks over the town. The things and the signs stay pale where the words are; the busy parts keep to the sides.
 */
(function () {
  'use strict';

  const W0 = window.SpeakingWorld;
  if (!W0 || !W0.kit) return;
  const { TAU, INK, UI, hash, rng, clamp, smooth, wrap, mix, rgba, rr } = W0.kit;

  const PALETTE = {
    // a sunset: the sky in bands from deep blue to gold, the blocks against it in violet, lit at their edges
    light: {
      sky: ['#2E3C94', '#4A43A6', '#83489F', '#CB5888', '#F27C5E', '#FFAF5F', '#FFDA8E'],
      dusk: '#141955',
      sun: '#FFB347', sunHi: '#FFE9A0', halo: '#FFC98A',
      mist: '#F59FA4', mistHi: '#FFD3B6', mistLine: '#A04D8A',
      star: '#FFFFFF',
      far: '#D195B6', farHi: '#EBB3C2', farWin: '#FFE7A8', tower: '#F08A6A', towerHi: '#FFE2CF',
      town: '#9E6DB4', townHi: '#BC8ACB', townLine: '#55397E', townWin: '#FFD27E',
      nb: '#8266B8', nbHi: '#AC90DC', nbShade: '#634EA0', nbLine: '#2B225B', nbGlass: '#4B418F', nbLit: '#FFC867',
      wall: '#6959AD', wallHi: '#9887D8', wallShade: '#4D4291', rim: '#FFAE74', line: '#201A49',
      parapet: '#7A6AC3', parapetHi: '#B5A5F0', soffit: '#372E6E', glass: '#3A3478', glassHi: '#6A61B6',
      lit: '#FFC95E', litHi: '#FFF1BC', curtain: '#F7D8C6', board: '#E9E0F4',
      walk: '#E3D6EE', walkLine: '#BDACD7', curb: '#F6EFFA', street: '#554F8D', paint: '#F6F1FB',
      hedge: '#2A7955', hedgeHi: '#57AA75', hedgeLine: '#0F3627',
      pole: '#4F4888', poleHi: '#9188CC',
      wire: '#211A45',
      steel: '#25978A', steelHi: '#86E3CF', steelShade: '#17665E',
      tank: '#F1EAF8', tankShade: '#BFB2DE',
      band: '#2FA39A', number: '#FFF0DA',
      lamp: '#FFE3A0',
    },
    // a night: navy and violet, the moon, warm windows and the town's neon
    dark: {
      sky: ['#060A22', '#0B1240', '#161A55', '#2A1E64', '#47256D', '#783473', '#AE4C78'],
      dusk: '#03051A',
      sun: '#FFF0C2', sunHi: '#FFFBE8', halo: '#BFC8FF',
      mist: '#2B2A6C', mistHi: '#5D62BA', mistLine: '#8B93E6',
      star: '#E8ECFF',
      far: '#3C3079', farHi: '#4F3E8F', farWin: '#FFD88A', tower: '#FF8A3D', towerHi: '#FFD9A8',
      town: '#272264', townHi: '#363185', townLine: '#100D32', townWin: '#FFC867',
      nb: '#272B6E', nbHi: '#3A418F', nbShade: '#1D2056', nbLine: '#0B0C2C', nbGlass: '#171A47', nbLit: '#FFC24F',
      wall: '#2D347A', wallHi: '#4550AE', wallShade: '#20255F', rim: '#8EA4FF', line: '#0B0E2D',
      parapet: '#323A8C', parapetHi: '#7888E6', soffit: '#13163E', glass: '#161A47', glassHi: '#2C3474',
      lit: '#FFC24F', litHi: '#FFF0B5', curtain: '#F7C98E', board: '#48509E',
      walk: '#2D3171', walkLine: '#3E438C', curb: '#4D54A2', street: '#1A1D49', paint: '#8E97DA',
      hedge: '#17423B', hedgeHi: '#2C6E5F', hedgeLine: '#061916',
      pole: '#1E2153', poleHi: '#8296F2',
      wire: '#05071C',
      steel: '#228579', steelHi: '#8FF0DE', steelShade: '#13534D',
      tank: '#3B4490', tankShade: '#272E6B',
      band: '#2A8F87', number: '#C9D0FF',
      lamp: '#FFD27A',
    },
  };
  const WASH = ['#FFFFFF', '#E8553A', '#F2B43A', '#2FA39A', '#F28CB1', '#5C7CE6', '#FFE36E'];

  // ---------- pictures kept between frames ----------
  // kit.cachedLayer keeps one picture; a frame here uses several (the sky, the blocks, the floors of the end wall), so
  // they are kept here. Beyond a budget of pixels, the pictures not drawn in the last two frames are let go, the least
  // recently drawn first (never one a frame still needs: on a large tablet two full-screen pictures pass the budget).

  const PICS = new Map();
  const BUDGET = 9e6;
  let frame = 0;
  function forget(k) {
    const v = PICS.get(k);
    PICS.delete(k);
    // let go of its pixels now (a phone keeps them until the canvas is collected otherwise)
    if (v) v.c.width = v.c.height = 0;
  }
  // a round is played one way, in one theme: what was painted for another is let go
  let mode = '';
  function modeIs(m) {
    if (m === mode) return;
    mode = m;
    for (const k of Array.from(PICS.keys())) forget(k);
  }
  function devScale(ctx) {
    try {
      const m = ctx.getTransform();
      return clamp(Math.hypot(m.a, m.b), 0.5, 7);
    } catch (err) {
      return 2;
    }
  }
  function pic(sc, key, w, h, paint) {
    const k = key + '|' + w.toFixed(1) + 'x' + h.toFixed(1) + '@' + sc.toFixed(2);
    let p = PICS.get(k);
    if (p) {
      p.used = frame;
      PICS.delete(k);
      PICS.set(k, p);
      return p;
    }
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w * sc));
    c.height = Math.max(1, Math.ceil(h * sc));
    const g = c.getContext('2d');
    g.setTransform(sc, 0, 0, sc, 0, 0);
    paint(g);
    p = { c, w: c.width / sc, h: c.height / sc, sc, used: frame };
    PICS.set(k, p);
    let px = 0;
    for (const v of PICS.values()) px += v.c.width * v.c.height;
    for (const [kk, v] of Array.from(PICS)) {
      if (px <= BUDGET) break;
      if (v.used >= frame - 1) continue;
      px -= v.c.width * v.c.height;
      forget(kk);
    }
    return p;
  }
  // drawn on whole device pixels, so it stays as sharp as it was painted; cut: how much of its top to leave out
  function put(ctx, p, x, y, s, cut) {
    const X = Math.round(x * s) / s;
    const Y = Math.round(y * s) / s;
    if (!cut || cut <= 0) {
      ctx.drawImage(p.c, X, Y, p.w, p.h);
      return;
    }
    const sy = Math.min(p.c.height - 1, Math.round(cut * p.sc));
    const k = sy / p.sc;
    ctx.drawImage(p.c, 0, sy, p.c.width, p.c.height - sy, X, Y + k, p.w, p.h - k);
  }
  // part of a picture placed at (px, py): its rectangle sx, sy, sw, sh (in units, from the picture's corner), 1:1
  function putPart(ctx, p, px, py, sx, sy, sw, sh, s) {
    const X0 = Math.max(0, Math.round(sx * p.sc));
    const Y0 = Math.max(0, Math.round(sy * p.sc));
    const X1 = Math.min(p.c.width, Math.round((sx + sw) * p.sc));
    const Y1 = Math.min(p.c.height, Math.round((sy + sh) * p.sc));
    if (X1 - X0 < 1 || Y1 - Y0 < 1) return;
    const X = Math.round(px * s) / s;
    const Y = Math.round(py * s) / s;
    ctx.drawImage(p.c, X0, Y0, X1 - X0, Y1 - Y0, X + X0 / p.sc, Y + Y0 / p.sc, (X1 - X0) / p.sc, (Y1 - Y0) / p.sc);
  }
  // a y on whole device pixels, under whatever the context is moved by
  function snapY(ctx, y) {
    try {
      const m = ctx.getTransform();
      return (Math.round(m.d * y + m.f) - m.f) / m.d;
    } catch (err) {
      return y;
    }
  }
  // a picture placed at (px, py), drawn only inside the rectangles [x0, y0, x1, y1] (screen units): what the near
  // planes hide is not drawn at all
  function putRects(ctx, p, px, py, rects, s) {
    for (const [x0, y0, x1, y1] of rects) {
      const sx = Math.max(0, x0 - px);
      const sy = Math.max(0, y0 - py);
      const ex = Math.min(p.w, x1 - px);
      const ey = Math.min(p.h, y1 - py);
      if (ex - sx > 0.2 && ey - sy > 0.2) putPart(ctx, p, px, py, sx, sy, ex - sx, ey - sy, s);
    }
  }
  // evening coming on: the upper sky darkened in a few bands, inside the rectangles (solid fills cost far less than a
  // gradient each frame)
  function dusk(ctx, rects, y0, y1, color, a) {
    if (a <= 0.01) return;
    const n = 4;
    for (let i = 0; i < n; i++) {
      const ya = y0 + ((y1 - y0) * i) / n;
      const yb = ya + (y1 - y0) / n;
      ctx.fillStyle = rgba(color, a * (1 - i / n));
      for (const [x0, r0, x1, r1] of rects) {
        const top = Math.max(ya, r0);
        const bot = Math.min(yb, r1);
        if (bot > top) ctx.fillRect(x0, top, x1 - x0, bot - top);
      }
    }
  }
  function radial(g, x, y, r, color, a) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, rgba(color, a));
    gr.addColorStop(0.4, rgba(color, a * 0.4));
    gr.addColorStop(1, rgba(color, 0));
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }

  // ---------- the sky, the sun and the moon, the far town ----------

  // the sky in bands (bokashi), darkest at the top, each band shading a little towards the next and then giving way
  function skyBands(g, W, H, y0, hz, C) {
    const s = C.sky;
    const pos = [0, 0.22, 0.41, 0.57, 0.71, 0.84, 1];
    const gr = g.createLinearGradient(0, y0, 0, hz);
    for (let i = 0; i < s.length; i++) {
      if (i > 0) gr.addColorStop(Math.max(0, pos[i] - 0.035), mix(s[i - 1], s[i], 0.4));
      gr.addColorStop(pos[i], s[i]);
    }
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
  }
  // the low sun, or the full moon: its halo and ring are painted with the sky; its disc, lit from the upper left, is
  // drawn each frame over the evening coming on, so it keeps its light
  function orbHalo(g, x, y, r, C, dark) {
    const h = g.createRadialGradient(x, y, r * 0.9, x, y, r * 3.8);
    h.addColorStop(0, rgba(C.halo, dark ? 0.4 : 0.7));
    h.addColorStop(0.35, rgba(C.halo, dark ? 0.14 : 0.3));
    h.addColorStop(1, rgba(C.halo, 0));
    g.fillStyle = h;
    g.fillRect(x - r * 3.8, y - r * 3.8, r * 7.6, r * 7.6);
    g.lineWidth = 1.5;
    g.strokeStyle = rgba(C.halo, dark ? 0.55 : 0.8);
    g.beginPath();
    g.arc(x, y, r * 1.36, 0, TAU);
    g.stroke();
  }
  function orbPic(s, r, C, dark) {
    return pic(s, 'dc-orb' + dark + r.toFixed(1), 2 * r + 4, 2 * r + 4, (g) => {
      const x = r + 2;
      const y = r + 2;
      g.beginPath();
      g.arc(x, y, r, 0, TAU);
      g.fillStyle = C.sun;
      g.fill();
      g.save();
      g.clip();
      g.beginPath();
      g.arc(x - r * 0.28, y - r * 0.3, r * 0.94, 0, TAU);
      g.fillStyle = C.sunHi;
      g.fill();
      if (dark) {
        // the moon's seas
        g.fillStyle = rgba('#D9C58C', 0.45);
        for (const [dx, dy, r0] of [[-0.3, -0.1, 0.26], [0.18, 0.22, 0.2], [0.3, -0.32, 0.13], [-0.05, 0.42, 0.1]]) {
          g.beginPath();
          g.arc(x + dx * r, y + dy * r, r0 * r, 0, TAU);
          g.fill();
        }
      }
      g.restore();
    });
  }
  // a long band of mist (suyari-gasumi) with a few rounded heads, lit along its foot by the low sun
  function mistPath(g, x, y, w, h) {
    rr(g, x, y, w, h, h / 2);
    const n = Math.max(1, Math.round(w / 46));
    for (let i = 0; i < n; i++) {
      const cx = x + w * ((i + 0.6) / (n + 0.4));
      const r = h * (0.55 + 0.25 * ((i * 7) % 3) / 2);
      g.moveTo(cx + r, y + h * 0.35);
      g.arc(cx, y + h * 0.35, r, 0, TAU);
    }
  }
  function mist(g, x, y, w, h, C) {
    g.beginPath();
    mistPath(g, x, y, w, h);
    g.lineWidth = 2.2;
    g.strokeStyle = C.mistLine;
    g.stroke();
    g.fillStyle = C.mist;
    g.fill();
    g.beginPath();
    rr(g, x + h * 0.6, y + h * 0.56, Math.max(0, w - h * 1.2), h * 0.26, h * 0.13);
    g.fillStyle = C.mistHi;
    g.fill();
  }
  function sparkle(g, x, y, r) {
    g.moveTo(x, y - r);
    g.quadraticCurveTo(x, y, x + r, y);
    g.quadraticCurveTo(x, y, x, y + r);
    g.quadraticCurveTo(x, y, x - r, y);
    g.quadraticCurveTo(x, y, x, y - r);
  }
  function starField(g, W, y0, y1, seed, n, C) {
    const R = rng(seed);
    g.fillStyle = C.star;
    for (let i = 0; i < n; i++) {
      g.globalAlpha = 0.3 + 0.7 * R();
      g.beginPath();
      g.arc(R() * W, y0 + R() * (y1 - y0), 0.35 + R() * R() * 1.1, 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;
    g.beginPath();
    for (let i = 0; i < Math.max(3, n / 12); i++) sparkle(g, R() * W, y0 + R() * (y1 - y0) * 0.8, 2 + R() * 1.6);
    g.fill();
  }
  // a radio tower in the haze, lattice-red and white (lit orange at night)
  function tower(g, x, base, h, C, dark) {
    const w = h * 0.3;
    g.beginPath();
    g.moveTo(x - w / 2, base);
    g.quadraticCurveTo(x - w * 0.1, base - h * 0.42, x - w * 0.05, base - h * 0.8);
    g.lineTo(x - 0.5, base - h);
    g.lineTo(x + 0.5, base - h);
    g.lineTo(x + w * 0.05, base - h * 0.8);
    g.quadraticCurveTo(x + w * 0.1, base - h * 0.42, x + w / 2, base);
    g.closePath();
    g.fillStyle = C.tower;
    g.fill();
    g.fillStyle = C.towerHi;
    for (const k of [0.2, 0.44, 0.66]) {
      const yy = base - h * k;
      const half = w * (0.5 - 0.47 * Math.pow(k / 0.8, 0.8)) + 1;
      g.fillRect(x - half, yy - 1.4, half * 2, 2.2);
    }
    g.fillRect(x - w * 0.16, base - h * 0.56, w * 0.32, 2.6);
    if (dark) {
      g.fillStyle = '#FF3B30';
      g.beginPath();
      g.arc(x, base - h, 1.2, 0, TAU);
      g.fill();
    }
  }
  // the far town along the horizon, low and pale in the haze
  function skyline(g, W, hz, C, dark, seed) {
    const R = rng(seed);
    g.fillStyle = rgba(C.farHi, 0.55);
    g.fillRect(0, hz - 8, W, 14);
    g.beginPath();
    g.moveTo(-4, hz + 60);
    let x = -4;
    const tops = [];
    while (x < W + 4) {
      const w = 7 + R() * 15;
      let h = 5 + R() * 14;
      if (R() < 0.2) h += 12 + R() * 18;
      g.lineTo(x, hz - h);
      g.lineTo(x + w, hz - h);
      tops.push([x, w, h]);
      x += w;
    }
    g.lineTo(W + 4, hz + 60);
    g.closePath();
    g.fillStyle = C.far;
    g.fill();
    g.fillStyle = C.farWin;
    for (const [bx, bw, bh] of tops) {
      for (let yy = hz - bh + 3; yy < hz - 2; yy += 4) {
        for (let xx = bx + 2; xx < bx + bw - 2; xx += 3.5) if (R() < (dark ? 0.42 : 0.1)) g.fillRect(xx, yy, 1.4, 1.6);
      }
    }
    tower(g, W * 0.84, hz - 4, clamp(W * 0.2, 46, 90), C, dark);
  }

  // ---------- Falling: the block seen from the street, looking up ----------
  // A point on the block's front is X (its x at the block's foot) and v (storeys up): its verticals meet high above
  // the screen, so the block narrows as it rises and the sky shows at the sides.

  function fallGeo(W, H, ground) {
    const cx = W / 2;
    const base = ground - 14;
    // the roof low enough for a band of sky over it, the block narrowing as it rises so the sky shows beside it
    const roofY = clamp(H * 0.2, 60, 112);
    const N = clamp(Math.round((base - roofY) / 48), 3, 8);
    const rho = 0.64;
    const A = Math.min(W * 0.45, 210);
    const yV = (roofY - base * rho) / (1 - rho);
    const c = (1 / rho - 1) / N;
    const nu = Math.max(3, 2 * Math.round((A / 40 - 1) / 2) + 1);
    const G = { W, H, ground, cx, base, roofY, N, rho, A, yV, c, nu, hz: base - 20, wins: [] };
    // the sun (the moon) low to the left of the roof
    G.sr = clamp(W * 0.075, 17, 30);
    G.sx = Math.max(G.sr + 3, Math.min(W * 0.14, cx - A * rho - G.sr - 6));
    G.sy = roofY + 4;
    // the windows that light up as evening comes (the rest are lit or dark in the picture itself): only those of homes
    // with nothing hung out, which a light drawn over the glass would hide (the same draws as paintFallBlock's)
    for (let k = 1; k < N; k++) {
      for (let j = 0; j < nu; j++) {
        const centre = j === (nu - 1) / 2;
        if (k === N - 1 && centre) continue;
        const R = rng(k * 211 + j * 17 + 1);
        if (!centre && (R() < 0.7 || R() < 0.7)) continue;
        G.wins.push({ k, j, lit: hash(k * 31 + j, 5), late: hash(k * 7 + j, 9) });
      }
    }
    return G;
  }
  const FX = (B, X, v) => B.cx + (X - B.cx) / (1 + B.c * v);
  const FY = (B, v) => B.yV + (B.base - B.yV) / (1 + B.c * v);
  function quad(g, B, X0, v0, X1, v1) {
    const ya = FY(B, v0);
    const yb = FY(B, v1);
    g.moveTo(FX(B, X0, v0), ya);
    g.lineTo(FX(B, X1, v0), ya);
    g.lineTo(FX(B, X1, v1), yb);
    g.lineTo(FX(B, X0, v1), yb);
    g.closePath();
  }
  // something small drawn flat on the front at (X, v), in the front's own units (as at its foot), y down
  function onFront(g, B, X, v, draw) {
    const q = 1 + B.c * v;
    const x = FX(B, X, v);
    const y = FY(B, v);
    const d = 1 / (q * q);
    g.save();
    g.transform(1 / q, 0, ((x - B.cx) / (y - B.yV)) * d, d, x, y);
    draw();
    g.restore();
  }
  // the block's x at the foot, for u across it (-1 left edge, 1 right)
  const UX = (G, u) => G.cx + u * G.A;

  // washing on a pole: shirts, towels, socks, from x0 to x1 (front units), hanging from y 0
  function washing(g, R, x0, x1, len, C) {
    g.lineWidth = 1.1;
    g.strokeStyle = C.line;
    g.beginPath();
    g.moveTo(x0 - 2, 0);
    g.lineTo(x1 + 2, 0);
    g.stroke();
    let x = x0;
    while (x < x1 - 4) {
      const kind = R();
      const col = WASH[Math.floor(R() * WASH.length)];
      g.beginPath();
      let w;
      if (kind < 0.45) {
        w = Math.min(x1 - x, 11 + R() * 4);
        const h = len * (0.8 + 0.2 * R());
        g.moveTo(x, 0.5);
        g.lineTo(x + w, 0.5);
        g.lineTo(x + w + 3, h * 0.28);
        g.lineTo(x + w - 0.5, h * 0.4);
        g.lineTo(x + w - 0.5, h);
        g.lineTo(x + 0.5, h);
        g.lineTo(x + 0.5, h * 0.4);
        g.lineTo(x - 3, h * 0.28);
        g.closePath();
      } else if (kind < 0.8) {
        w = Math.min(x1 - x, 7 + R() * 3);
        g.rect(x, 0.5, w, len * (0.7 + 0.35 * R()));
      } else {
        w = 4;
        g.rect(x, 0.5, 3.4, len * 0.45);
      }
      g.fillStyle = col;
      g.fill();
      g.lineWidth = 0.9;
      g.strokeStyle = C.line;
      g.stroke();
      if (kind >= 0.45 && kind < 0.8 && R() < 0.6) {
        // a stripe across the towel
        g.fillStyle = rgba(INK, 0.18);
        g.fillRect(x, len * 0.3, w, 2.2);
      }
      x += w + 2.5 + R() * 2;
    }
  }
  // a futon over the balcony's rail, from x0 to x1 (front units), from the rail (y 0) down
  function futon(g, R, x0, x1, h, C) {
    const pair = [['#F28CB1', '#FFFFFF'], ['#5C7CE6', '#FFFFFF'], ['#F2B43A', '#E8553A'], ['#2FA39A', '#FFF3D6']][Math.floor(R() * 4)];
    g.beginPath();
    g.moveTo(x0, -3);
    g.lineTo(x1, -3);
    g.lineTo(x1 + 1, h * 0.55);
    g.quadraticCurveTo(x1, h, x1 - 4, h);
    g.lineTo(x0 + 4, h);
    g.quadraticCurveTo(x0, h, x0 - 1, h * 0.55);
    g.closePath();
    g.fillStyle = pair[0];
    g.fill();
    g.save();
    g.clip();
    g.fillStyle = pair[1];
    for (let x = x0 + 3; x < x1; x += 8) g.fillRect(x, -4, 3, h + 6);
    g.fillStyle = rgba(INK, 0.16);
    g.fillRect(x0 - 2, h * 0.62, x1 - x0 + 4, h);
    g.restore();
    g.lineWidth = 1.1;
    g.strokeStyle = C.line;
    g.stroke();
    // its clips
    g.fillStyle = C.line;
    g.fillRect(x0 + 3, -5, 3, 5);
    g.fillRect(x1 - 6, -5, 3, 5);
  }
  // pots of plants along the rail's top (y 0), from x0 to x1
  function planters(g, R, x0, x1, C, n) {
    for (let i = 0; i < n; i++) {
      const x = x0 + (x1 - x0) * ((i + 0.5) / n) + (R() - 0.5) * 4;
      const r = 4.5 + R() * 3;
      g.fillStyle = '#C8643C';
      g.beginPath();
      g.moveTo(x - 4, -5);
      g.lineTo(x + 4, -5);
      g.lineTo(x + 3, 0);
      g.lineTo(x - 3, 0);
      g.closePath();
      g.fill();
      g.beginPath();
      g.arc(x - r * 0.5, -5 - r * 0.6, r * 0.75, 0, TAU);
      g.arc(x + r * 0.45, -5 - r * 0.7, r * 0.8, 0, TAU);
      g.arc(x, -5 - r * 1.25, r * 0.7, 0, TAU);
      g.fillStyle = '#3E9A55';
      g.fill();
      g.lineWidth = 0.9;
      g.strokeStyle = C.line;
      g.stroke();
      g.fillStyle = '#7CCB6E';
      g.beginPath();
      g.arc(x - r * 0.55, -5 - r * 1.0, r * 0.32, 0, TAU);
      g.fill();
      if (R() < 0.55) {
        g.fillStyle = ['#FF6B6B', '#FFD45A', '#FF9FD0', '#FFFFFF'][Math.floor(R() * 4)];
        for (let f = 0; f < 3; f++) {
          g.beginPath();
          g.arc(x + (R() - 0.5) * r * 1.6, -5 - r * (0.5 + R()), 1.4, 0, TAU);
          g.fill();
        }
      }
    }
  }
  // an air conditioner high on the wall
  function aircon(g, C) {
    g.beginPath();
    rr(g, -9, -7, 18, 12, 1.5);
    g.fillStyle = '#E4DEEE';
    g.fill();
    g.lineWidth = 1;
    g.strokeStyle = C.line;
    g.stroke();
    g.beginPath();
    g.arc(-2, -1, 4, 0, TAU);
    g.fillStyle = '#9E97B8';
    g.fill();
    g.fillStyle = '#B9B2D0';
    g.fillRect(4, -5, 3, 8);
  }

  // one home's windows on storey k: sliding doors behind the balcony, lit or dark, with curtains
  function homeWindows(g, G, C, dark, k, j, X0, X1) {
    const R = rng(k * 97 + j * 13 + 5);
    const m = (X1 - X0) * 0.06;
    const a = X0 + m;
    const b = X1 - m;
    const centre = j === (G.nu - 1) / 2;
    const open = k === G.N - 1 && centre;
    const litNow = dark ? R() < 0.42 : R() < 0.14;
    const tv = dark && R() < 0.1;
    const warm = R() < 0.4 ? '#FFB04A' : C.lit;
    g.beginPath();
    quad(g, G, a, k + 0.1, b, k + 0.84);
    g.fillStyle = open ? '#140F2C' : litNow ? (tv ? '#3F78D8' : warm) : C.glass;
    g.fill();
    if (!open && !litNow) {
      // the evening sky in the glass
      g.save();
      g.clip();
      g.fillStyle = rgba(C.glassHi, 0.8);
      const ya = FY(G, k + 0.84);
      const yb = FY(G, k + 0.1);
      const xa = FX(G, a, k + 0.5);
      const w = (b - a) * 0.9;
      g.beginPath();
      g.moveTo(xa + w * 0.12, ya);
      g.lineTo(xa + w * 0.3, ya);
      g.lineTo(xa + w * 0.12, yb);
      g.lineTo(xa - w * 0.06, yb);
      g.closePath();
      g.moveTo(xa + w * 0.38, ya);
      g.lineTo(xa + w * 0.44, ya);
      g.lineTo(xa + w * 0.26, yb);
      g.lineTo(xa + w * 0.2, yb);
      g.closePath();
      g.fill();
      g.restore();
    }
    if (litNow && !tv) {
      // curtains at the sides, drawn back
      g.beginPath();
      quad(g, G, a, k + 0.1, a + (b - a) * 0.16, k + 0.84);
      quad(g, G, b - (b - a) * 0.16, k + 0.1, b, k + 0.84);
      g.fillStyle = C.curtain;
      g.fill();
    }
    if (open) {
      // the open door where things come from: a curtain blowing out
      g.beginPath();
      const x1 = FX(G, a + (b - a) * 0.3, k + 0.84);
      const y1 = FY(G, k + 0.84);
      const y2 = FY(G, k + 0.2);
      g.moveTo(x1, y1);
      g.bezierCurveTo(x1 + 12, y1 + 6, x1 - 6, y2 - 10, x1 + 18, y2);
      g.lineTo(FX(G, a, k + 0.2), y2);
      g.lineTo(FX(G, a, k + 0.84), y1);
      g.closePath();
      g.fillStyle = '#FFF3E4';
      g.fill();
      g.lineWidth = 1.2;
      g.strokeStyle = C.line;
      g.stroke();
    }
    // the frames
    g.beginPath();
    quad(g, G, a, k + 0.1, b, k + 0.84);
    const n = 4;
    for (let i = 1; i < n; i++) {
      const X = a + ((b - a) * i) / n;
      g.moveTo(FX(G, X, k + 0.1), FY(G, k + 0.1));
      g.lineTo(FX(G, X, k + 0.84), FY(G, k + 0.84));
    }
    g.lineWidth = 1.1;
    g.strokeStyle = C.line;
    g.stroke();
    return litNow;
  }

  // snow lying along a ledge from x to x + w, its top at y, h deep, with a cool shade along its foot
  function snowCap(g, x, y, w, h) {
    g.fillStyle = '#FFFFFF';
    g.beginPath();
    rr(g, x, y, w, h, Math.min(h / 2, 2));
    for (let k = x + 4; k < x + w - 3; k += 9) {
      g.moveTo(k + 3, y + 0.8);
      g.arc(k, y + 0.8, 3, Math.PI, TAU);
    }
    g.fill();
    g.fillStyle = 'rgba(150,172,240,0.65)';
    g.fillRect(x + 1, y + h - 1.2, w - 2, 1.2);
  }
  function paintFallBlock(g, G, C, dark, snow) {
    const { N, nu } = G;
    const XL = UX(G, -1);
    const XR = UX(G, 1);
    const hw = (XR - XL) / nu;
    // the front
    g.beginPath();
    quad(g, G, XL, 0, XR, N + 0.24);
    g.fillStyle = C.wall;
    g.fill();
    const glows = [];
    for (let k = 0; k < N; k++) {
      for (let j = 0; j < nu; j++) {
        const X0 = XL + j * hw;
        if (homeWindows(g, G, C, dark, k, j, X0, X0 + hw) && dark) glows.push([X0 + hw / 2, k + 0.5]);
      }
      // the underside of the balconies above, seen from below
      g.beginPath();
      quad(g, G, XL, k + 0.84, XR, k + 1);
      g.fillStyle = C.soffit;
      g.fill();
      if (k === 0) continue;
      // the boards between the homes' balconies
      g.beginPath();
      for (let j = 1; j < nu; j++) {
        const X = XL + j * hw;
        quad(g, G, X - 2.2, k + 0.36, X + 2.2, k + 0.84);
      }
      g.fillStyle = C.board;
      g.fill();
      g.lineWidth = 0.9;
      g.strokeStyle = C.line;
      g.stroke();
      // what hangs on the balconies, high up: washing, an air conditioner
      for (let j = 0; j < nu; j++) {
        const R = rng(k * 211 + j * 17 + 1);
        const X0 = XL + j * hw;
        const centre = j === (nu - 1) / 2;
        const out = (X0 + hw / 2 - G.cx) / Math.max(1, G.A);
        if (centre) continue;
        if (R() < 0.7) {
          // washing on the outer part of the balcony, away from the middle
          const from = out < 0 ? X0 + hw * 0.08 : X0 + hw * 0.3;
          const to = out < 0 ? X0 + hw * 0.7 : X0 + hw * 0.92;
          onFront(g, G, from, k + 0.8, () => washing(g, R, 0, (to - from), 18 + R() * 5, C));
        } else if (R() < 0.7) {
          onFront(g, G, X0 + hw * (out < 0 ? 0.25 : 0.75), k + 0.7, () => aircon(g, C));
        }
      }
      // the balconies' front, a band along the whole block, lit along its top
      g.beginPath();
      quad(g, G, XL - 1.5, k, XR + 1.5, k + 0.38);
      g.fillStyle = C.parapet;
      g.fill();
      g.beginPath();
      quad(g, G, XL - 1.5, k + 0.32, XR + 1.5, k + 0.38);
      g.fillStyle = C.parapetHi;
      g.fill();
      g.beginPath();
      quad(g, G, XL - 1.5, k, XR + 1.5, k + 0.38);
      g.lineWidth = 1.3;
      g.strokeStyle = C.line;
      g.stroke();
      if (snow) {
        g.beginPath();
        quad(g, G, XL - 2.5, k + 0.33, XR + 2.5, k + 0.45);
        g.fillStyle = '#FFFFFF';
        g.fill();
        g.beginPath();
        quad(g, G, XL - 2.5, k + 0.33, XR + 2.5, k + 0.355);
        g.fillStyle = 'rgba(150,172,240,0.7)';
        g.fill();
      }
      // over the rail: futons, plants
      for (let j = 0; j < nu; j++) {
        const R = rng(k * 53 + j * 29 + 7);
        const X0 = XL + j * hw;
        const centre = j === (nu - 1) / 2;
        const out = (X0 + hw / 2 - G.cx) / Math.max(1, G.A);
        if (centre) {
          if (R() < 0.6) onFront(g, G, X0 + hw * 0.2, k + 0.38, () => planters(g, R, 0, hw * 0.25, C, 1));
          continue;
        }
        if (R() < 0.42) {
          const from = out < 0 ? X0 + hw * 0.1 : X0 + hw * 0.45;
          onFront(g, G, from, k + 0.38, () => futon(g, R, 0, hw * 0.45, 22, C));
        } else {
          const from = out < 0 ? X0 + hw * 0.1 : X0 + hw * 0.5;
          onFront(g, G, from, k + 0.38, () => planters(g, R, 0, hw * 0.4, C, 2 + Math.floor(R() * 2)));
        }
      }
    }
    // the warm light from lit windows, at night
    for (const [X, v] of glows) {
      const x = FX(G, X, v);
      const y = FY(G, v);
      radial(g, x, y, 34 / (1 + G.c * v), C.lit, 0.32);
    }
    // the roof's edge, and on the roof a water tank and aerials against the sky
    g.beginPath();
    quad(g, G, XL - 3, N, XR + 3, N + 0.24);
    g.fillStyle = C.wallHi;
    g.fill();
    g.lineWidth = 1.4;
    g.strokeStyle = C.line;
    g.stroke();
    const ry = FY(G, N + 0.24);
    const rl = FX(G, XL - 3, N + 0.24);
    const rrx = FX(G, XR + 3, N + 0.24);
    g.fillStyle = C.rim;
    g.fillRect(rl, ry - 1, rrx - rl, 2);
    if (snow) snowCap(g, rl - 1, ry - 4, rrx - rl + 2, 4);
    const tx = rl + (rrx - rl) * 0.78;
    g.beginPath();
    rr(g, tx - 16, ry - 24, 32, 18, 3);
    g.fillStyle = C.wall;
    g.fill();
    g.lineWidth = 1.3;
    g.strokeStyle = C.line;
    g.stroke();
    g.fillStyle = C.rim;
    g.fillRect(tx - 15, ry - 24, 30, 1.6);
    g.beginPath();
    g.moveTo(tx - 12, ry - 6);
    g.lineTo(tx - 13, ry);
    g.moveTo(tx + 12, ry - 6);
    g.lineTo(tx + 13, ry);
    const ax = rl + (rrx - rl) * 0.2;
    g.moveTo(ax, ry);
    g.lineTo(ax, ry - 30);
    for (const kk of [0, 1, 2]) {
      g.moveTo(ax - 9 + kk * 2, ry - 27 + kk * 6);
      g.lineTo(ax + 9 - kk * 2, ry - 27 + kk * 6);
    }
    g.stroke();
    // the sunlit (moonlit) left edge, the shaded right one, and the outline
    g.beginPath();
    quad(g, G, XL, 0, XL + 3.5, N + 0.24);
    g.fillStyle = C.rim;
    g.fill();
    g.beginPath();
    quad(g, G, XR - 9, 0, XR, N + 0.24);
    g.fillStyle = rgba(C.line, 0.28);
    g.fill();
    g.beginPath();
    quad(g, G, XL, 0, XR, N + 0.24);
    g.lineWidth = 2.2;
    g.strokeStyle = C.line;
    g.stroke();
  }

  // a block further off, behind the near one: X0..X1 at its foot, `floors` storeys, smaller by s
  function paintFarBlock(g, G, X0, X1, floors, s, C, dark, seed, snow) {
    const B = { cx: G.cx, yV: G.yV, base: G.base - 4 * s, c: G.c * s };
    const R = rng(seed);
    g.beginPath();
    quad(g, B, X0, 0, X1, floors + 0.2);
    g.fillStyle = s < 0.6 ? mix(C.nb, C.far, 0.45) : C.nb;
    g.fill();
    const hw = 46;
    for (let k = 0; k < floors; k++) {
      // windows
      for (let X = X0 + 4; X < X1 - 10; X += hw) {
        const lit = dark ? R() < 0.55 : R() < 0.12;
        g.beginPath();
        quad(g, B, X + 3, k + 0.12, Math.min(X1 - 4, X + hw - 3), k + 0.8);
        g.fillStyle = lit ? C.nbLit : C.nbGlass;
        g.fill();
        if (!lit && R() < 0.5) {
          // washing, as colour
          g.beginPath();
          quad(g, B, X + 8, k + 0.4, X + 22, k + 0.72);
          g.fillStyle = WASH[Math.floor(R() * WASH.length)];
          g.fill();
        }
      }
      g.beginPath();
      quad(g, B, X0, k + 0.8, X1, k + 1);
      g.fillStyle = C.nbShade;
      g.fill();
      if (k === 0) continue;
      g.beginPath();
      quad(g, B, X0 - 1, k, X1 + 1, k + 0.36);
      g.fillStyle = C.nbHi;
      g.fill();
      g.lineWidth = 0.9;
      g.strokeStyle = C.nbLine;
      g.stroke();
      if (snow) {
        g.beginPath();
        quad(g, B, X0 - 1.5, k + 0.3, X1 + 1.5, k + 0.42);
        g.fillStyle = 'rgba(255,255,255,0.92)';
        g.fill();
      }
    }
    g.beginPath();
    quad(g, B, X0 - 2, floors, X1 + 2, floors + 0.2);
    g.fillStyle = C.nbHi;
    g.fill();
    g.beginPath();
    quad(g, B, X0, 0, X1, floors + 0.2);
    g.lineWidth = 1.5;
    g.strokeStyle = C.nbLine;
    g.stroke();
    // the lit edge
    g.beginPath();
    quad(g, B, X0, 0, X0 + 2.5, floors + 0.2);
    g.fillStyle = rgba(C.rim, 0.85);
    g.fill();
    return B;
  }

  // a tree by the block: its leaves by the season (blossom, green, gold, bare and snowy)
  function tree(g, x, base, sz, C, dark, season) {
    const trunk = dark ? '#2A2347' : '#4A3253';
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const limbs = [
      [x, base, x - 2, base - sz * 0.9],
      [x - 1, base - sz * 0.55, x - sz * 0.5, base - sz * 1.15],
      [x - 1, base - sz * 0.7, x + sz * 0.45, base - sz * 1.2],
      [x - 2, base - sz * 0.85, x - sz * 0.1, base - sz * 1.45],
    ];
    // the trunk and limbs: an ink line under, the bark over it
    for (const [pass, col] of [[0, C.line], [1, trunk]]) {
      g.strokeStyle = col;
      limbs.forEach(([x1, y1, x2, y2], i) => {
        g.lineWidth = (i ? 3.4 : 6.5) + (pass ? 0 : 2.4);
        g.beginPath();
        g.moveTo(x1, y1);
        g.quadraticCurveTo((x1 + x2) / 2 + 3, (y1 + y2) / 2, x2, y2);
        g.stroke();
      });
    }
    if (season === 'winter') {
      // bare branches forking from the limbs, outlined, snow lying along the tops of the ones that lean over
      const R = rng(77);
      const segs = [];
      const grow = (x1, y1, ang, len, wid, depth) => {
        const x2 = x1 + Math.cos(ang) * len;
        const y2 = y1 + Math.sin(ang) * len;
        segs.push([x1, y1, x2, y2, wid]);
        if (depth <= 0) return;
        for (const side of [-1, 1]) grow(x2, y2, ang + side * (0.38 + R() * 0.34), len * (0.6 + R() * 0.14), wid * 0.64, depth - 1);
      };
      for (const [x1, y1, x2, y2] of limbs.slice(1)) grow(x2, y2, Math.atan2(y2 - y1, x2 - x1), sz * 0.3, 2.6, 2);
      for (const pass of [0, 1]) {
        g.strokeStyle = pass ? trunk : C.line;
        for (const [x1, y1, x2, y2, wid] of segs) {
          g.lineWidth = wid + (pass ? 0 : 2);
          g.beginPath();
          g.moveTo(x1, y1);
          g.lineTo(x2, y2);
          g.stroke();
        }
      }
      g.strokeStyle = '#FFFFFF';
      for (const [x1, y1, x2, y2, wid] of limbs.slice(1).map((l) => l.concat(3.4)).concat(segs)) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.hypot(dx, dy) || 1;
        const flat = Math.abs(dx) / len;
        if (flat < 0.3) continue;
        // the normal on the upper side
        let nx = -dy / len;
        let ny = dx / len;
        if (ny > 0) {
          nx = -nx;
          ny = -ny;
        }
        const off = wid / 2 + 0.6;
        g.lineWidth = Math.max(1.3, wid * 0.8 * flat + 0.6);
        g.beginPath();
        g.moveTo(x1 + dx * 0.15 + nx * off, y1 + dy * 0.15 + ny * off);
        g.lineTo(x2 - dx * 0.1 + nx * off, y2 - dy * 0.1 + ny * off);
        g.stroke();
      }
      return;
    }
    const cols = {
      spring: ['#F7A6C6', '#FFD6E6', '#D96A9A'],
      summer: ['#2F8F4E', '#5DBE68', '#1D5E36'],
      autumn: ['#E8862E', '#FFC23E', '#A9461E'],
    }[season] || ['#E8862E', '#FFC23E', '#A9461E'];
    // at night: deep and cool, the moon on its upper side
    const tint = dark ? [mix('#1B2A4E', cols[0], 0.18), mix('#4A5FA8', cols[1], 0.16), '#080C24'] : cols;
    const R = rng(91);
    const blobs = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + R() * 0.5;
      blobs.push([x + Math.cos(a) * sz * 0.48 + (R() - 0.5) * 6, base - sz * 1.22 + Math.sin(a) * sz * 0.34, sz * (0.3 + R() * 0.12)]);
    }
    blobs.push([x, base - sz * 1.25, sz * 0.42]);
    // the crown: an outline, the leaves, a lit band to the upper left, a shade below
    g.beginPath();
    for (const [bx, by, br] of blobs) {
      g.moveTo(bx + br + 1.5, by);
      g.arc(bx, by, br + 1.5, 0, TAU);
    }
    g.fillStyle = C.line;
    g.fill();
    g.beginPath();
    for (const [bx, by, br] of blobs) {
      g.moveTo(bx + br, by);
      g.arc(bx, by, br, 0, TAU);
    }
    g.fillStyle = tint[0];
    g.fill();
    g.save();
    g.clip();
    g.beginPath();
    for (const [bx, by, br] of blobs) {
      g.moveTo(bx + br * 0.7, by + br * 0.5);
      g.arc(bx, by + br * 0.5, br * 0.7, 0, TAU);
    }
    g.fillStyle = tint[2];
    g.globalAlpha = 0.55;
    g.fill();
    g.globalAlpha = 1;
    if (!dark) {
      g.beginPath();
      for (const [bx, by, br] of blobs) {
        g.moveTo(bx - br * 0.3 + br * 0.55, by - br * 0.45);
        g.arc(bx - br * 0.3, by - br * 0.45, br * 0.55, 0, TAU);
      }
      g.fillStyle = tint[1];
      g.fill();
    }
    g.restore();
    if (dark) {
      // at night, a cool rim of moonlight along the crown's upper left
      g.strokeStyle = rgba('#8EA4FF', 0.85);
      g.lineWidth = 1.6;
      g.beginPath();
      for (const [bx, by, br] of blobs) {
        if (by > base - sz * 1.2) continue;
        g.moveTo(bx + Math.cos(Math.PI * 1.05) * (br - 1.2), by + Math.sin(Math.PI * 1.05) * (br - 1.2));
        g.arc(bx, by, br - 1.2, Math.PI * 1.05, Math.PI * 1.6);
      }
      g.stroke();
    }
  }

  // the utility pole: tiger-striped at its foot, its arms, the wires to the left, a lamp at night
  function pole(g, x, foot, top, C, dark) {
    const w = 8;
    g.beginPath();
    g.moveTo(x - w / 2, foot);
    g.lineTo(x - w * 0.38, top);
    g.lineTo(x + w * 0.38, top);
    g.lineTo(x + w / 2, foot);
    g.closePath();
    g.fillStyle = C.pole;
    g.fill();
    g.fillStyle = C.poleHi;
    g.fillRect(x - w * 0.42, top, 2, foot - top);
    g.lineWidth = 1.8;
    g.strokeStyle = C.line;
    g.stroke();
    // the yellow and black guard at its foot
    g.save();
    g.beginPath();
    g.rect(x - w / 2 - 1, foot - 32, w + 2, 22);
    g.clip();
    g.fillStyle = '#F5C431';
    g.fillRect(x - 6, foot - 32, 12, 22);
    g.fillStyle = '#1B2440';
    for (let k = -2; k < 6; k++) {
      g.beginPath();
      g.moveTo(x - 8, foot - 32 + k * 7);
      g.lineTo(x + 8, foot - 40 + k * 7);
      g.lineTo(x + 8, foot - 36.5 + k * 7);
      g.lineTo(x - 8, foot - 28.5 + k * 7);
      g.closePath();
      g.fill();
    }
    g.restore();
    g.strokeStyle = C.line;
    g.lineWidth = 1.2;
    g.strokeRect(x - w / 2 - 0.5, foot - 32, w + 1, 22);
    // the address plate
    g.fillStyle = '#2E5ED6';
    g.fillRect(x - 5, foot - 62, 10, 18);
    g.fillStyle = '#FFFFFF';
    g.fillRect(x - 3, foot - 59, 6, 1.6);
    g.fillRect(x - 3, foot - 55, 6, 1.6);
    g.fillRect(x - 3, foot - 51, 4, 1.6);
    g.strokeRect(x - 5, foot - 62, 10, 18);
    // the arms, insulators, a transformer
    const arms = [top + 16, top + 34];
    g.lineWidth = 3;
    g.strokeStyle = C.line;
    g.beginPath();
    for (const y of arms) {
      g.moveTo(x - 22, y);
      g.lineTo(x + 14, y);
    }
    g.stroke();
    g.lineWidth = 1.6;
    g.strokeStyle = C.poleHi;
    g.beginPath();
    for (const y of arms) {
      g.moveTo(x - 21, y - 0.8);
      g.lineTo(x + 13, y - 0.8);
    }
    g.stroke();
    g.fillStyle = '#E9E4F2';
    for (const y of arms) {
      for (const dx of [-19, -9, 10]) {
        g.beginPath();
        rr(g, x + dx - 2, y - 6, 4, 5, 1.5);
        g.fill();
        g.lineWidth = 0.9;
        g.strokeStyle = C.line;
        g.stroke();
      }
    }
    g.beginPath();
    rr(g, x + 4, top + 50, 11, 18, 3);
    g.fillStyle = dark ? '#5F6AA8' : '#A9A3C9';
    g.fill();
    g.lineWidth = 1.3;
    g.strokeStyle = C.line;
    g.stroke();
    return arms;
  }
  // wires from (x1, y1) away to x2, sagging
  function wires(g, x1, ys, x2, sag, C) {
    g.lineWidth = 1.1;
    g.strokeStyle = C.wire;
    g.beginPath();
    ys.forEach((y, i) => {
      g.moveTo(x1, y);
      g.quadraticCurveTo((x1 + x2) / 2, y + sag + i * 4, x2, y + 6 + i * 3);
    });
    g.stroke();
  }
  // a drinks machine, lit from inside at night
  function vending(g, x, foot, C, dark) {
    const w = 28;
    const h = 46;
    if (dark) radial(g, x + w / 2, foot - h * 0.55, 46, '#CFE4FF', 0.45);
    g.beginPath();
    rr(g, x, foot - h, w, h, 2.5);
    g.fillStyle = dark ? '#E8F2FF' : '#EEF1FA';
    g.fill();
    g.fillStyle = '#2E5ED6';
    g.fillRect(x, foot - h, w, 7);
    g.fillRect(x, foot - 14, w, 4);
    g.fillStyle = rgba(INK, 0.16);
    g.fillRect(x + w - 5, foot - h, 5, h);
    // its rows of bottles
    const cols = ['#E8553A', '#2FA39A', '#F2B43A', '#5C7CE6', '#F28CB1'];
    for (let r0 = 0; r0 < 3; r0++) {
      const y = foot - h + 10 + r0 * 8;
      g.fillStyle = dark ? '#FFFFFF' : '#FAF7FF';
      g.fillRect(x + 3, y - 1, w - 9, 7);
      for (let i = 0; i < 4; i++) {
        g.fillStyle = cols[(r0 * 2 + i) % cols.length];
        g.fillRect(x + 4.5 + i * 4.6, y, 3, 5);
      }
    }
    g.fillStyle = '#1B2440';
    g.fillRect(x + 4, foot - 9, w - 12, 4);
    g.beginPath();
    rr(g, x, foot - h, w, h, 2.5);
    g.lineWidth = 1.8;
    g.strokeStyle = C.line;
    g.stroke();
  }
  function bicycle(g, x, foot, C) {
    const r = 7.5;
    g.lineWidth = 1.6;
    g.strokeStyle = C.line;
    g.beginPath();
    g.arc(x, foot - r, r, 0, TAU);
    g.moveTo(x + 24 + r, foot - r);
    g.arc(x + 24, foot - r, r, 0, TAU);
    g.stroke();
    g.lineWidth = 2;
    g.strokeStyle = '#2FA39A';
    g.beginPath();
    g.moveTo(x, foot - r);
    g.lineTo(x + 9, foot - r - 11);
    g.lineTo(x + 20, foot - r - 11);
    g.lineTo(x + 24, foot - r);
    g.moveTo(x + 9, foot - r - 11);
    g.lineTo(x + 12, foot - r);
    g.lineTo(x + 20, foot - r - 11);
    g.moveTo(x + 22, foot - r - 15);
    g.lineTo(x + 20, foot - r - 11);
    g.stroke();
    g.fillStyle = C.line;
    g.fillRect(x + 6, foot - r - 14, 7, 2.4);
    g.fillRect(x + 19, foot - r - 16, 7, 2);
    // the basket at the front
    g.strokeStyle = C.line;
    g.lineWidth = 1.2;
    g.strokeRect(x + 23, foot - r - 22, 9, 6);
  }
  // the hedge along the block: lumps, lit to the upper left, flowers or snow by the season
  function hedge(g, x0, x1, top, foot, C, season, seed) {
    const R = rng(seed);
    const lumps = [];
    for (let x = x0; x < x1 + 12; x += 13 + R() * 6) lumps.push([x, top + R() * 4, 9 + R() * 3]);
    for (const [pass, col] of [[0, C.hedgeLine], [1, C.hedge]]) {
      g.beginPath();
      g.moveTo(x0 - 4, foot);
      for (const [x, y, r] of lumps) {
        g.moveTo(x + r + (pass ? 0 : 1.6), y);
        g.arc(x, y, r + (pass ? 0 : 1.6), 0, TAU);
      }
      g.rect(x0 - 4, top, x1 - x0 + 8, foot - top);
      g.fillStyle = col;
      g.fill();
    }
    g.fillStyle = C.hedgeHi;
    g.beginPath();
    for (const [x, y, r] of lumps) {
      g.moveTo(x - 2 + r * 0.55, y - 2);
      g.arc(x - 2, y - 2, r * 0.55, Math.PI, Math.PI * 1.9);
    }
    g.fill();
    const flowers = { spring: ['#FF5FA2', '#FFFFFF'], summer: ['#7FA8FF', '#C6A8FF'], autumn: ['#E8553A', '#F2B43A'] }[season];
    if (flowers) {
      for (let i = 0; i < lumps.length * 2; i++) {
        const [x, y, r] = lumps[Math.floor(R() * lumps.length)];
        g.fillStyle = flowers[i % 2];
        g.beginPath();
        g.arc(x + (R() - 0.5) * r * 1.4, y + (R() - 0.2) * r * 0.9, 1.5, 0, TAU);
        g.fill();
      }
    } else if (season === 'winter') {
      g.fillStyle = '#FFFFFF';
      g.beginPath();
      for (const [x, y, r] of lumps) {
        g.moveTo(x + r, y - r * 0.25);
        g.ellipse(x, y - r * 0.45, r * 0.95, r * 0.5, 0, Math.PI, TAU);
      }
      g.fill();
    }
  }
  // the pavement Yaoki stands on, the kerb, and the road below it with its markings
  function street(g, W, ground, H, C, dark) {
    g.fillStyle = C.walk;
    g.fillRect(0, ground - 8, W, 20);
    g.fillStyle = C.walkLine;
    g.fillRect(0, ground - 8, W, 1.4);
    for (let x = 6; x < W; x += 26) g.fillRect(x, ground - 7, 1.2, 19);
    g.fillStyle = C.curb;
    g.fillRect(0, ground + 12, W, 5);
    g.fillStyle = C.line;
    g.fillRect(0, ground + 17, W, 1.5);
    g.fillStyle = C.street;
    g.fillRect(0, ground + 18.5, W, H - ground);
    g.fillStyle = C.paint;
    g.fillRect(0, ground + 24, W, 2);
    // とまれ, painted on the road, and a manhole cover
    g.save();
    g.translate(W * 0.3, ground + 52);
    g.scale(1, 0.55);
    g.font = '800 30px ' + UI;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = rgba(C.paint, dark ? 0.7 : 0.95);
    g.fillText('とまれ', 0, 0);
    g.restore();
    g.fillRect(W * 0.08, ground + 74, W * 0.48, 4);
    g.beginPath();
    g.ellipse(W * 0.8, ground + 56, 15, 6, 0, 0, TAU);
    g.fillStyle = dark ? '#2A2E66' : '#6B66A6';
    g.fill();
    g.lineWidth = 1.2;
    g.strokeStyle = C.line;
    g.stroke();
    g.beginPath();
    g.ellipse(W * 0.8, ground + 56, 10, 4, 0, 0, TAU);
    g.stroke();
  }

  function paintFallSky(g, G, C, dark) {
    const { W, H, hz, sx, sy, sr } = G;
    skyBands(g, W, H, 34, hz, C);
    if (dark) starFieldBox(g, G, C);
    orbHalo(g, sx, sy, sr, C, dark);
    // bands of mist: over the roof, and down the sky beside the block
    const edge = G.cx - G.A * G.rho;
    mist(g, W * 0.52, G.roofY - 26, W * 0.3, 8, C);
    mist(g, W * 0.7, G.roofY - 14, W * 0.42, 7, C);
    mist(g, -12, sy + sr * 1.5, edge + 4, 9, C);
    mist(g, W - edge * 0.85, G.roofY + 52, edge * 1.1, 8, C);
    mist(g, -20, G.roofY + 104, edge * 0.8, 7, C);
    mist(g, W - edge * 0.6, G.roofY + 132, edge * 0.9, 7, C);
    skyline(g, W, hz, C, dark, 5);
  }
  function starFieldBox(g, G, C) {
    starField(g, G.W, 34, G.hz * 0.75, 41, Math.round(G.W * 0.28), C);
  }

  function paintFallBlocks(g, G, C, dark, season) {
    const { W, ground, cx, A } = G;
    // the blocks further off, at the sides, behind the near one
    const sides = [];
    for (const side of [-1, 1]) {
      for (let d = 2; d >= 1; d--) {
        const s = d === 1 ? 0.78 : 0.55;
        const reach = d === 1 ? A * 0.5 : A + 60;
        const len = d === 1 ? 230 : 260;
        const inner = cx + side * reach;
        const outer = inner + side * len;
        if ((side < 0 && outer > W + 40) || (side > 0 && outer < -40)) continue;
        const X0 = Math.min(inner, outer);
        const X1 = Math.max(inner, outer);
        const floors = d === 1 ? G.N - 1 : G.N - 2;
        sides.push([X0, X1, floors, s, 300 + side * 10 + d]);
      }
    }
    sides.sort((p, q) => p[3] - q[3]);
    const snow = season === 'winter';
    for (const [X0, X1, floors, s, seed] of sides) paintFarBlock(g, G, X0, X1, floors, s, C, dark, seed, snow);
    paintFallBlock(g, G, C, dark, snow);
    // the street in front: a tree, the hedge, a bicycle, the drinks machine and the pole with its wires
    const foot = ground - 4;
    hedge(g, -6, W + 6, ground - 26, ground - 6, C, season, 12);
    tree(g, cx - A - 4, foot, clamp(A * 0.6, 58, 92), C, dark, season);
    if (cx + A + 150 < W + 40) tree(g, cx + A + 120, foot, 70, C, dark, season);
    if (cx - A - 150 > -40) tree(g, cx - A - 150, foot, 64, C, dark, season);
    bicycle(g, cx - A * 0.86 + 12, ground - 2, C);
    const px = Math.min(W - 13, cx + A - 6);
    vending(g, px - 46, ground - 2, C, dark);
    street(g, W, ground, G.H, C, dark);
    const arms = pole(g, px, ground + 14, -10, C, dark);
    wires(g, px - 20, arms, -20, 26, C);
    if (cx + A + 200 < W) {
      const p2 = cx + A + 190;
      const arms2 = pole(g, p2, ground + 14, -10, C, dark);
      wires(g, p2 - 20, arms2, px + 12, 14, C);
    }
    if (dark) {
      // the lamp on the pole, and its pool of light
      g.lineWidth = 2;
      g.strokeStyle = C.line;
      g.beginPath();
      g.moveTo(px - 2, 60);
      g.quadraticCurveTo(px - 14, 52, px - 24, 58);
      g.stroke();
      g.fillStyle = C.lamp;
      g.beginPath();
      g.ellipse(px - 24, 60, 5, 2.4, 0, 0, TAU);
      g.fill();
      radial(g, px - 24, 61, 26, C.lamp, 0.6);
      g.save();
      g.translate(px - 24, ground + 2);
      g.scale(1, 0.3);
      radial(g, 0, 0, 50, C.lamp, 0.5);
      g.restore();
    }
  }

  let FG = null;
  function fallGeoFor(o) {
    if (!FG || FG.W !== o.W || FG.H !== o.H || FG.ground !== o.ground) FG = fallGeo(o.W, o.H, o.ground);
    return FG;
  }

  function fall(ctx, o, C) {
    const { W, H, t } = o;
    const G = fallGeoFor(o);
    const s = devScale(ctx);
    const dark = !!o.dark;
    const season = o.season || 'autumn';
    frame++;
    modeIs('fall' + dark);
    // the sky, where the block does not hide it: above its roof and in the wedges beside it
    const yRoof = FY(G, G.N + 0.24);
    const xl = FX(G, UX(G, -1) - 3, G.N + 0.24) + 1;
    const xr = FX(G, UX(G, 1) + 3, G.N + 0.24) - 1;
    const rects = [[0, 0, W, yRoof + 1], [0, yRoof, xl, G.ground - 24], [xr, yRoof, W, G.ground - 24]];
    putRects(ctx, pic(s, 'dc-fsky' + dark, W, H, (g) => paintFallSky(g, G, C, dark)), 0, 0, rects, s);
    // evening comes on as the round goes on; the sun's disc keeps its light
    if (!dark) dusk(ctx, rects, 30, G.hz, C.dusk, 0.5 * o.progress);
    put(ctx, orbPic(s, G.sr, C, dark), G.sx - G.sr - 2, G.sy - G.sr - 2, s);
    // mist drifting behind the blocks
    drift(ctx, W, t, [G.roofY - 34, G.sy + G.sr * 0.2], C);
    if (!dark) birds(ctx, W, G.roofY + 40, t, 4, C.line, 3);
    else blinkers(ctx, G, t);
    put(ctx, pic(s, 'dc-fblocks' + dark + season, W, H, (g) => paintFallBlocks(g, G, C, dark, season)), 0, 0, s);
    // windows lighting up as evening comes (in the dark, a television flickering here and there)
    const k = dark ? 0 : smooth(0.2, 1, o.progress);
    const XL = UX(G, -1);
    const hw = (2 * G.A) / G.nu;
    ctx.beginPath();
    let any = false;
    for (const w of G.wins) {
      if (dark ? w.late > 0.12 : w.late > k * 0.7) continue;
      const X0 = XL + w.j * hw;
      const m = hw * 0.06;
      if (dark) {
        if (Math.sin(t * (5 + w.lit * 6) + w.k) < 0.2) continue;
      }
      quad(ctx, G, X0 + m + 2, w.k + 0.4, X0 + hw - m - 2, w.k + 0.82);
      any = true;
    }
    if (any) {
      ctx.fillStyle = dark ? 'rgba(80,140,240,0.5)' : rgba(C.lit, 0.9);
      ctx.fill();
    }
    weather(ctx, W, H, t, season, 0);
  }

  // the red lights blinking on the far tower and an aeroplane crossing, at night
  function blinkers(ctx, G, t) {
    ctx.fillStyle = '#FF4A3D';
    if (Math.sin(t * 3) > 0) {
      ctx.beginPath();
      ctx.arc(G.W * 0.84, G.hz - 4 - clamp(G.W * 0.2, 46, 90), 1.8, 0, TAU);
      ctx.fill();
    }
    const x = G.W + 40 - wrap(t * 7, G.W + 80);
    const y = G.roofY + 30 + 0.04 * x;
    ctx.fillStyle = '#E8ECFF';
    ctx.fillRect(x - 3, y, 6, 1.2);
    if (wrap(t, 1.2) < 0.25) {
      ctx.fillStyle = '#FF4A3D';
      ctx.beginPath();
      ctx.arc(x, y + 0.6, 1.6, 0, TAU);
      ctx.fill();
    }
  }

  // ---------- life: drifting mist, birds, and what the season lets fall ----------

  // bands of mist drifting slowly across, one at each height in ys
  function drift(ctx, W, t, ys, C) {
    ctx.beginPath();
    ys.forEach((y, k) => {
      const w = 54 + 24 * k;
      const x = wrap(k * 131 + t * (2.2 + 0.8 * k), W + w * 2) - w;
      mistPath(ctx, x, y, w, 8);
    });
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = C.mistLine;
    ctx.stroke();
    ctx.fillStyle = C.mist;
    ctx.fill();
  }

  function birds(ctx, W, y, t, n, col, seed) {
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const sp = 9 + 5 * hash(seed, i);
      const x = W + 30 - wrap(t * sp + hash(seed + 1, i) * (W + 60), W + 60);
      const yy = y + (hash(seed + 2, i) - 0.5) * 40 + Math.sin(t * 0.7 + i) * 3;
      const f = Math.sin(t * 9 + i * 2.1);
      const r = 3.4 + 1.4 * hash(seed + 3, i);
      ctx.moveTo(x - r, yy - f * r * 0.6);
      ctx.quadraticCurveTo(x - r * 0.4, yy - r * 0.25, x, yy);
      ctx.quadraticCurveTo(x + r * 0.4, yy - r * 0.25, x + r, yy - f * r * 0.6);
    }
    ctx.stroke();
  }
  // petals in spring, leaves in autumn, snow in winter; lift keeps them in the air as the view goes up
  function weather(ctx, W, H, t, season, lift) {
    if (season === 'summer') return;
    const snow = season === 'winter';
    const n = snow ? 20 : 12;
    const cols = snow ? ['#FFFFFF'] : season === 'spring' ? ['#FFC2DA', '#FF8FBC'] : ['#FFB52E', '#E8602C'];
    for (let c = 0; c < cols.length; c++) {
      ctx.beginPath();
      for (let i = c; i < n; i += cols.length) {
        const fall = snow ? 10 + 9 * hash(71, i) : 12 + 8 * hash(71, i);
        const x = wrap(hash(72, i) * W + t * (snow ? 3 : 10) + Math.sin(t * 0.9 + i * 1.7) * 10, W + 20) - 10;
        const y = wrap(hash(73, i) * H + t * fall + lift * 0.85, H + 20) - 10;
        if (snow) {
          const r = 1 + 1.2 * hash(74, i);
          ctx.moveTo(x + r, y);
          ctx.arc(x, y, r, 0, TAU);
        } else {
          const a = t * (1.2 + hash(75, i)) + i;
          ctx.moveTo(x + Math.cos(a) * 3, y + Math.sin(a) * 3);
          ctx.ellipse(x, y, 3, 1.6, a, 0, TAU);
        }
      }
      ctx.fillStyle = cols[c];
      ctx.globalAlpha = snow ? 0.9 : 1;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // ---------- Climb: up the fire ladder on the block's end wall ----------
  // The end wall (its storeys painted once and drawn again and again) goes by at the climb's pace; beside it the next
  // blocks and the town sink more slowly, and the sky stays: by the roof, the town lies below and the sky is open.

  const FLOOR = 96;
  const hwOf = (W) => clamp(W * 0.33, 78, 150);
  const RAIL = 21;

  const sunR = (W) => clamp(W * 0.065, 15, 30);
  const sunX = (W) => clamp(Math.min(W * 0.14, (W / 2 - hwOf(W)) * 0.55), sunR(W) * 0.6, W);
  const sunY = (H, dark) => H - 172 - (dark ? 150 : 110);
  function paintClimbSky(g, W, H, hz, C, dark) {
    skyBands(g, W, H, 30, hz, C);
    if (dark) starField(g, W, 30, hz - 40, 43, Math.round(W * 0.3), C);
    const r = sunR(W);
    const side = W / 2 - hwOf(W);
    const sx = sunX(W);
    const sy = sunY(H, dark);
    orbHalo(g, sx, sy, r, C, dark);
    mist(g, sx - r * 2.4, sy + r * 0.3, r * 3.6, 9, C);
    mist(g, W - side * 1.1 - 20, sy - 70, side * 1.4 + 30, 8, C);
    mist(g, W - side * 0.8, sy + 30, side * 0.9 + 20, 7, C);
    mist(g, -20, sy + r * 2.4, side * 1.2 + 26, 8, C);
    skyline(g, W, hz, C, dark, 9);
  }
  // the town between here and the far side: blocks and offices, signs, neon at night
  function paintTown(g, W, h, C, dark) {
    const R = rng(23);
    g.fillStyle = C.town;
    g.fillRect(0, 60, W, h - 60);
    let x = -6;
    while (x < W + 6) {
      const w = 16 + R() * 26;
      const top = 8 + R() * 50;
      g.beginPath();
      g.rect(x, top, w, h - top);
      g.fillStyle = R() < 0.5 ? C.town : C.townHi;
      g.fill();
      g.lineWidth = 1;
      g.strokeStyle = C.townLine;
      g.stroke();
      g.fillStyle = rgba(C.rim, 0.75);
      g.fillRect(x, top, 2, h - top);
      g.fillRect(x, top, w, 1.4);
      g.fillStyle = C.townWin;
      for (let yy = top + 5; yy < h - 4; yy += 7) {
        for (let xx = x + 3; xx < x + w - 4; xx += 5) if (R() < (dark ? 0.45 : 0.14)) g.fillRect(xx, yy, 2.4, 3);
      }
      if (R() < 0.3) {
        // a sign on its roof, or a neon one down its side at night
        const nx = x + w * 0.5;
        if (dark) {
          const col = R() < 0.5 ? '#FF4FA3' : '#3FF0E0';
          radial(g, nx, top + 18, 18, col, 0.35);
          g.fillStyle = col;
          g.fillRect(nx - 2, top + 6, 4, 24);
        } else {
          g.fillStyle = WASH[1 + Math.floor(R() * 5)];
          g.fillRect(nx - 7, top - 7, 14, 7);
          g.strokeStyle = C.townLine;
          g.strokeRect(nx - 7, top - 7, 14, 7);
        }
      }
      x += w;
    }
  }
  // the next blocks, beside the end wall: one storey of their balconies, NF high
  const NF = 40;
  function nbEdges(W) {
    const cx = W / 2;
    const hw = hwOf(W);
    const gap = Math.max(0, (cx - hw - 60) * 0.35);
    return [cx - hw - gap, cx + hw + gap];
  }
  function paintNbFloor(g, W, C, dark, v, snow) {
    const [xl, xr] = nbEdges(W);
    const R = rng(61 + v * 7);
    for (const [a, b] of [[-4, xl], [xr, W + 4]]) {
      if (b - a < 2) continue;
      g.fillStyle = C.nb;
      g.fillRect(a, 0, b - a, NF);
      // windows behind the balconies
      for (let x = (a < 0 ? b - 38 : a + 4); a < 0 ? x > a - 40 : x < b; x += a < 0 ? -40 : 40) {
        const lit = dark ? R() < 0.55 : R() < 0.15;
        g.fillStyle = lit ? C.nbLit : C.nbGlass;
        g.fillRect(x + 3, 6, 32, 20);
        if (!lit && R() < 0.6) {
          g.fillStyle = WASH[Math.floor(R() * WASH.length)];
          g.fillRect(x + 8, 9, 7, 10);
          g.fillStyle = WASH[Math.floor(R() * WASH.length)];
          g.fillRect(x + 18, 9, 9, 8);
        }
        g.fillStyle = C.nbShade;
        g.fillRect(x + 1, 6, 2, 20);
      }
      g.fillStyle = C.nbShade;
      g.fillRect(a, 0, b - a, 5);
      g.fillStyle = C.nbHi;
      g.fillRect(a, 22, b - a, 14);
      g.fillStyle = rgba(C.rim, 0.8);
      g.fillRect(a, 22, b - a, 1.6);
      g.fillStyle = C.nbLine;
      g.fillRect(a, 36, b - a, 1.2);
      g.fillRect(a, 21, b - a, 1);
      if (snow) snowCap(g, a, 19.5, b - a, 3.6);
      if (a > 0) {
        g.fillStyle = rgba(C.rim, 0.85);
        g.fillRect(a, 0, 2.4, NF);
      } else {
        g.fillStyle = rgba(C.nbLine, 0.5);
        g.fillRect(b - 6, 0, 6, NF);
      }
    }
  }
  function paintNbRoof(g, W, C, snow) {
    const [xl, xr] = nbEdges(W);
    for (const [a, b] of [[-4, xl], [xr, W + 4]]) {
      if (b - a < 2) continue;
      g.fillStyle = C.nbHi;
      g.fillRect(a, 22, b - a, 8);
      g.fillStyle = rgba(C.rim, 0.9);
      g.fillRect(a, 22, b - a, 1.8);
      g.fillStyle = C.nbLine;
      g.fillRect(a, 30, b - a, 1.2);
      // a small water tank and an aerial on it
      const tx = a < 0 ? b - 26 : a + 10;
      g.fillStyle = C.nbShade;
      g.fillRect(tx, 6, 18, 12);
      g.fillRect(tx + 2, 18, 2, 4);
      g.fillRect(tx + 14, 18, 2, 4);
      g.fillStyle = rgba(C.rim, 0.8);
      g.fillRect(tx, 6, 18, 1.4);
      g.fillStyle = C.nbLine;
      const ax = a < 0 ? b - 40 : a + 36;
      g.fillRect(ax, 0, 1.2, 22);
      g.fillRect(ax - 5, 4, 11, 1);
      g.fillRect(ax - 4, 9, 9, 1);
      if (snow) {
        snowCap(g, a, 19.5, b - a, 3.6);
        snowCap(g, tx - 1, 4, 20, 3);
      }
    }
  }
  // one storey of the end wall, with the ladder up its middle; v: which homes are lit, what is in their windows
  function paintWallFloor(g, W, C, dark, v, ground, snow) {
    const hw = hwOf(W);
    const TW = hw * 2 + 8;
    const cx = TW / 2;
    const R = rng(131 + v * 17);
    g.fillStyle = C.wall;
    g.fillRect(4, 0, hw * 2, FLOOR);
    // light from the upper left: a lit edge, a shaded one
    g.fillStyle = C.rim;
    g.fillRect(4, 0, 3, FLOOR);
    g.fillStyle = C.wallShade;
    g.fillRect(TW - 16, 0, 12, FLOOR);
    // the joints between the wall's precast panels
    g.fillStyle = rgba(C.line, 0.22);
    for (const jx of [4 + hw * 0.52, TW - 4 - hw * 0.52]) g.fillRect(jx, 0, 1.2, FLOOR - 7);
    g.fillStyle = rgba(C.wallHi, 0.35);
    for (const jx of [4 + hw * 0.52, TW - 4 - hw * 0.52]) g.fillRect(jx + 1.2, 0, 0.8, FLOOR - 7);
    // the floor's edge
    g.fillStyle = C.wallHi;
    g.fillRect(4, FLOOR - 7, hw * 2, 4);
    g.fillStyle = C.line;
    g.fillRect(4, FLOOR - 3, hw * 2, 1.4);
    g.fillStyle = rgba(C.line, 0.25);
    g.fillRect(4, FLOOR - 1.6, hw * 2, 1.6);
    if (snow) snowCap(g, 3, FLOOR - 10, hw * 2 + 2, 4);
    // a small window each side, near the edges
    for (const side of [-1, 1]) {
      const wx = side < 0 ? 4 + 13 : TW - 4 - 13 - 24;
      if (ground && side < 0) {
        // the door at the foot of the wall, its lamp
        g.fillStyle = C.wallShade;
        g.fillRect(wx - 2, 26, 28, FLOOR - 33);
        g.fillStyle = '#8F9BC8';
        g.fillRect(wx, 28, 24, FLOOR - 35);
        g.fillStyle = C.line;
        g.fillRect(wx + 18, 56, 3, 8);
        g.lineWidth = 1.4;
        g.strokeStyle = C.line;
        g.strokeRect(wx, 28, 24, FLOOR - 35);
        g.fillStyle = C.lamp;
        g.fillRect(wx + 8, 18, 8, 4);
        if (dark) radial(g, wx + 12, 22, 22, C.lamp, 0.5);
        continue;
      }
      const lit = dark ? R() < 0.7 : R() < 0.3;
      g.fillStyle = C.line;
      g.fillRect(wx - 1.5, 22, 27, 33);
      g.fillStyle = lit ? C.lit : C.glass;
      g.fillRect(wx, 23.5, 24, 30);
      if (dark && lit) radial(g, wx + 12, 38, 30, C.lit, 0.35);
      if (lit) {
        g.fillStyle = C.curtain;
        g.fillRect(wx, 23.5, 6, 30);
        g.fillRect(wx + 18, 23.5, 6, 30);
        if (R() < 0.35) {
          // a cat in the window
          g.fillStyle = C.line;
          g.beginPath();
          g.ellipse(wx + 12, 49, 5.5, 4.5, 0, 0, TAU);
          g.arc(wx + 12, 42.5, 3.6, 0, TAU);
          g.moveTo(wx + 9, 40.5);
          g.lineTo(wx + 9.5, 37);
          g.lineTo(wx + 11.5, 39.8);
          g.moveTo(wx + 15, 40.5);
          g.lineTo(wx + 14.5, 37);
          g.lineTo(wx + 12.5, 39.8);
          g.fill();
        }
      } else {
        g.fillStyle = rgba(C.glassHi, 0.85);
        g.beginPath();
        g.moveTo(wx + 5, 23.5);
        g.lineTo(wx + 11, 23.5);
        g.lineTo(wx + 4, 53.5);
        g.lineTo(wx, 53.5);
        g.lineTo(wx, 40);
        g.closePath();
        g.fill();
      }
      g.fillStyle = C.line;
      g.fillRect(wx + 11.3, 23.5, 1.4, 30);
      // a box of flowers under it
      if (R() < 0.6) {
        g.fillStyle = '#C8643C';
        g.fillRect(wx - 2, 54, 28, 5);
        g.fillStyle = '#3E9A55';
        g.beginPath();
        for (let i = 0; i < 5; i++) {
          g.moveTo(wx + 1 + i * 5.5 + 3.4, 53);
          g.arc(wx + 1 + i * 5.5, 53, 3.4, 0, TAU);
        }
        g.fill();
        g.fillStyle = ['#FF6B6B', '#FFD45A', '#FF9FD0'][Math.floor(R() * 3)];
        for (let i = 0; i < 4; i++) {
          g.beginPath();
          g.arc(wx + 3 + i * 6, 51.5, 1.6, 0, TAU);
          g.fill();
        }
        g.lineWidth = 1;
        g.strokeStyle = C.line;
        g.strokeRect(wx - 2, 54, 28, 5);
        if (snow) snowCap(g, wx - 3, 50, 30, 4);
      }
    }
    // the drainpipe down the right
    g.fillStyle = C.wallHi;
    g.fillRect(TW - 12, 0, 3, FLOOR);
    g.fillStyle = C.line;
    g.fillRect(TW - 13.5, 14, 6, 2.4);
    g.fillRect(TW - 9, 0, 1, FLOOR);
    // the ladder: its rungs, the two rails, the cage round it (not at the foot: it starts above a child's reach)
    const from = ground ? 34 : 0;
    g.fillStyle = C.steelShade;
    for (let y = from + 8; y < FLOOR; y += 16) g.fillRect(cx - RAIL, y, RAIL * 2, 2.6);
    g.fillStyle = rgba(INK, 0.28);
    for (let y = from + 8; y < FLOOR; y += 16) g.fillRect(cx - RAIL, y + 2.6, RAIL * 2, 1.4);
    if (!ground) {
      g.lineWidth = 1.3;
      g.strokeStyle = rgba(C.steelShade, 0.9);
      g.beginPath();
      for (const y of [22, 70]) {
        g.moveTo(cx - RAIL - 4, y);
        g.quadraticCurveTo(cx, y + 12, cx + RAIL + 4, y);
      }
      for (const dx of [-RAIL - 4, RAIL + 4]) {
        g.moveTo(cx + dx, 0);
        g.lineTo(cx + dx, FLOOR);
      }
      g.stroke();
    }
    for (const dx of [-RAIL, RAIL]) {
      g.fillStyle = C.line;
      g.fillRect(cx + dx - 3, from, 6, FLOOR - from);
      g.fillStyle = C.steel;
      g.fillRect(cx + dx - 1.8, from, 3.6, FLOOR - from);
      g.fillStyle = C.steelHi;
      g.fillRect(cx + dx - 1.8, from, 1.2, FLOOR - from);
    }
    if (ground) {
      g.fillStyle = C.line;
      g.fillRect(cx - RAIL - 3, from - 2, RAIL * 2 + 6, 4);
    }
  }
  // the top of the end wall: a coloured band and the block's number, painted big
  function paintCrown(g, W, C) {
    const hw = hwOf(W);
    const TW = hw * 2 + 8;
    g.fillStyle = C.band;
    g.fillRect(4, 0, hw * 2, 12);
    g.fillStyle = rgba('#FFFFFF', 0.35);
    g.fillRect(4, 0, hw * 2, 2);
    g.fillStyle = C.line;
    g.fillRect(4, 12, hw * 2, 1.4);
    const x = 4 + (hw - RAIL - 4) / 2 + 2;
    const size = Math.min(64, (hw - RAIL - 8) * 1.2);
    g.font = '800 ' + size + 'px ' + UI;
    g.textAlign = 'center';
    g.textBaseline = 'top';
    g.lineJoin = 'round';
    g.lineWidth = 4;
    g.strokeStyle = C.line;
    g.strokeText('5', x, 20);
    g.fillStyle = C.number;
    g.fillText('5', x, 20);
    g.font = '800 ' + Math.round(size * 0.24) + 'px ' + UI;
    g.lineWidth = 2.4;
    g.strokeText('号棟', x, 22 + size);
    g.fillText('号棟', x, 22 + size);
    return TW;
  }
  // the pavement, the hedge and the road at the foot of the climb
  function paintClimbStreet(g, W, C, dark, season) {
    const hw = hwOf(W);
    const cx = W / 2;
    hedge(g, -6, cx - hw + 30, 8, 32, C, season, 5);
    hedge(g, cx + hw - 30, W + 6, 8, 32, C, season, 6);
    street(g, W, 40, 180, C, dark);
  }

  function climb(ctx, o, C) {
    const { W, H, y0, top, t } = o;
    const s = devScale(ctx);
    const dark = !!o.dark;
    const season = o.season || 'autumn';
    frame++;
    modeIs('climb' + dark);
    const cx = W / 2;
    const hw = hwOf(W);
    const hz = H - 172;
    const a = -y0;
    const aStart = H - 136;
    const aTop = -top + 0.58 * H;
    const u = clamp((a - aStart) / Math.max(1, aTop - aStart), 0, 1);
    // what is drawn of the sky and the town: beside the wall down to the next blocks (all the way down in the gaps
    // between them and the wall), and above the roof
    const nbRoof = hz - 0.42 * H + u * (0.42 * H + 40);
    const roofS = top - y0;
    const groundS = -y0;
    const sideL = cx - hw;
    const sideR = cx + hw;
    const [nl, nr] = nbEdges(W);
    const nbTop = Math.min(H, groundS, nbRoof + 10);
    const low = Math.min(H, groundS);
    const rects = [[0, 0, nl, nbTop], [nl, 0, sideL, low], [sideR, 0, nr, low], [nr, 0, W, nbTop]];
    if (roofS > 0) rects.push([sideL, 0, sideR, Math.min(roofS + 1, low)]);
    // the sky stays where it is
    putRects(ctx, pic(s, 'dc-csky' + dark, W, H, (g) => paintClimbSky(g, W, H, hz, C, dark)), 0, 0, rects, s);
    if (!dark) dusk(ctx, rects, 30, hz, C.dusk, 0.45 * smooth(0.3, 1, u));
    put(ctx, orbPic(s, sunR(W), C, dark), sunX(W) - sunR(W) - 2, sunY(H, dark) - sunR(W) - 2, s);
    drift(ctx, W, t, [52, 96, 140], C);
    if (!dark) birds(ctx, W, 90, t, 3, C.line, 7);
    // the town sinks slowly; the next blocks faster
    const TH = 200;
    putRects(ctx, pic(s, 'dc-town' + dark, W, TH, (g) => paintTown(g, W, TH, C, dark)), 0, hz - 112 + u * 114, rects, s);
    const nbRects = [[0, 0, nl, low], [nr, 0, W, low]];
    const snow = season === 'winter';
    putRects(ctx, pic(s, 'dc-nbroof' + dark + snow, W, 32, (g) => paintNbRoof(g, W, C, snow)), 0, nbRoof - 22, nbRects, s);
    for (let y = nbRoof + 9, i = 0; y < low && i < 60; y += NF, i++) putRects(ctx, pic(s, 'dc-nb' + dark + snow + (i % 3), W, NF, (g) => paintNbFloor(g, W, C, dark, i % 3, snow)), 0, y, nbRects, s);
    // the end wall, from the roof down to the ground
    const k0 = Math.max(0, Math.floor((y0 + H) / -FLOOR) - 1);
    const TW = hw * 2 + 8;
    const wx = cx - TW / 2;
    for (let k = k0; k < k0 + 40; k++) {
      const yb = -k * FLOOR - y0;
      if (yb < 0 || -k * FLOOR <= top) break;
      if (yb - FLOOR > H) continue;
      const v = k === 0 ? 'g' : String(Math.floor(hash(k, 3) * 4));
      const p = pic(s, 'dc-wall' + dark + snow + v, TW, FLOOR, (g) => paintWallFloor(g, W, C, dark, k === 0 ? 0 : +v, k === 0, snow));
      // the top storey is cut at the roof
      put(ctx, p, wx, yb - FLOOR, s, top - (-(k + 1) * FLOOR));
    }
    if (roofS > -140 && roofS < H) put(ctx, pic(s, 'dc-crown' + dark, TW, 110, (g) => paintCrown(g, W, C)), wx, roofS, s);
    // the outline of the wall
    ctx.fillStyle = C.line;
    const yA = Math.max(0, roofS);
    const yB = Math.min(H, groundS);
    if (yB > yA) {
      ctx.fillRect(cx - hw - 1.2, yA, 2.4, yB - yA);
      ctx.fillRect(cx + hw - 1.2, yA, 2.4, yB - yA);
    }
    // each storey's number by the ladder
    ctx.font = '800 8px ' + UI;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let k = Math.max(1, k0); k < k0 + 40; k++) {
      const y = -k * FLOOR - y0;
      if (y < 0 || -k * FLOOR <= top + 44) break;
      if (y > H) continue;
      const x = cx + RAIL + 22;
      ctx.fillStyle = C.line;
      ctx.fillRect(x - 11, y + 3, 22, 13);
      ctx.fillStyle = dark ? '#3A4290' : '#FFF6EA';
      ctx.fillRect(x - 10, y + 4, 20, 11);
      ctx.fillStyle = dark ? '#E0E5FF' : '#3A2F7A';
      ctx.fillText(k + 1 + 'F', x, y + 9.8);
    }
    // the street at the foot
    if (groundS < H + 40) put(ctx, pic(s, 'dc-street' + dark + season, W, 180, (g) => paintClimbStreet(g, W, C, dark, season)), 0, groundS - 40, s);
    if (dark) {
      // windows flickering in the next blocks
      ctx.fillStyle = 'rgba(127,214,255,0.5)';
      const [xl, xr] = nbEdges(W);
      for (let i = 0; i < 3; i++) {
        if (Math.sin(t * (4 + i) + i * 2) < 0.3) continue;
        const y = nbRoof + 9 + NF * (1 + i * 2) + 6;
        const x = i % 2 ? xr + 7 : xl - 35;
        if (y < H) ctx.fillRect(x, y, 32, 20);
      }
    }
    weather(ctx, W, H, t, season, y0);
  }

  // ---------- the ledges: the fire escape's landings ----------

  function ledge(ctx, o, C, pal) {
    const { x, y } = o;
    const dark = !!o.dark;
    const a = x - 54;
    const w = 108;
    if (dark) {
      const hw = hwOf(o.W || 240);
      const p = pic(devScale(ctx), 'dc-pool' + hw, hw * 2, 120, (g) => {
        g.save();
        g.translate(hw, 34);
        g.scale(1, 0.7);
        radial(g, 0, 0, hw * 1.05, C.lamp, 0.6);
        g.restore();
      });
      const s = devScale(ctx);
      ctx.drawImage(p.c, Math.round((x - hw) * s) / s, snapY(ctx, y + 6), p.w, p.h);
    }
    // its hard shadow on the wall, the brackets under it
    ctx.fillStyle = dark ? 'rgba(2,3,14,0.55)' : 'rgba(27,22,70,0.4)';
    ctx.fillRect(a + 4, y + 9, w, 5);
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.line;
    ctx.beginPath();
    ctx.moveTo(a + 8, y + 8);
    ctx.lineTo(a + 26, y + 30);
    ctx.moveTo(a + w - 8, y + 8);
    ctx.lineTo(a + w - 26, y + 30);
    ctx.stroke();
    // the railing behind him
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (const px of [a + 3, a + 30, a + w - 30, a + w - 3]) {
      ctx.moveTo(px, y);
      ctx.lineTo(px, y - 21);
    }
    ctx.moveTo(a + 1, y - 21);
    ctx.lineTo(a + w - 1, y - 21);
    ctx.moveTo(a + 1, y - 11);
    ctx.lineTo(a + w - 1, y - 11);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = C.steel;
    ctx.stroke();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = C.steelHi;
    ctx.beginPath();
    ctx.moveTo(a + 1, y - 21.6);
    ctx.lineTo(a + w - 1, y - 21.6);
    ctx.stroke();
    // the landing: a deck lit along its top, its face, a shaded band at its foot, rivets
    ctx.beginPath();
    rr(ctx, a, y, w, 10, 2);
    ctx.fillStyle = C.steel;
    ctx.fill();
    ctx.fillStyle = C.steelHi;
    ctx.fillRect(a + 1, y + 0.5, w - 2, 2.8);
    ctx.fillStyle = C.steelShade;
    ctx.fillRect(a + 1, y + 7, w - 2, 2.6);
    ctx.fillStyle = rgba(INK, 0.55);
    for (let px = a + 7; px < a + w - 4; px += 12) ctx.fillRect(px, y + 4.6, 1.8, 1.8);
    ctx.beginPath();
    rr(ctx, a, y, w, 10, 2);
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = pal.outline && !dark ? pal.outline : C.line;
    ctx.stroke();
    if (o.season === 'winter') {
      // snow on the deck either side of where he stands, and along the top rail
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      rr(ctx, a - 1, y - 2.5, 34, 4, 2);
      rr(ctx, a + w - 33, y - 2.5, 34, 4, 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(a + 1, y - 22.6);
      ctx.lineTo(a + w - 1, y - 22.6);
      ctx.stroke();
    }
    if (dark) {
      // a lamp on the rail, glowing
      ctx.fillStyle = C.lamp;
      ctx.fillRect(a + w - 34, y - 27, 8, 5);
      const s = devScale(ctx);
      const g = pic(s, 'dc-lampglow', 32, 32, (q) => radial(q, 16, 16, 16, C.lamp, 0.8));
      ctx.drawImage(g.c, Math.round((a + w - 46) * s) / s, snapY(ctx, y - 40), g.w, g.h);
    }
  }

  // ---------- the top: the roof, the water tank, the aerial; fireworks once he is there ----------

  function paintSummit(g, W, C, dark, snow) {
    // drawn with the roof's line at y 90
    const y = 90;
    const cx = W / 2;
    const hw = hwOf(W);
    const L = cx - hw - 4;
    const R = cx + hw + 4;
    // the water tank on its legs, to the left
    const tx = L + 12;
    const tw = Math.min(64, hw * 0.75);
    g.lineWidth = 3;
    g.strokeStyle = C.line;
    g.beginPath();
    g.moveTo(tx + 6, y);
    g.lineTo(tx + 8, y - 20);
    g.moveTo(tx + tw - 6, y);
    g.lineTo(tx + tw - 8, y - 20);
    g.moveTo(tx + 6, y - 4);
    g.lineTo(tx + tw - 8, y - 18);
    g.moveTo(tx + tw - 6, y - 4);
    g.lineTo(tx + 8, y - 18);
    g.stroke();
    g.lineWidth = 1.6;
    g.strokeStyle = C.steel;
    g.stroke();
    g.beginPath();
    rr(g, tx, y - 66, tw, 46, 5);
    g.fillStyle = C.tank;
    g.fill();
    g.save();
    g.clip();
    g.fillStyle = C.tankShade;
    g.fillRect(tx + tw * 0.72, y - 66, tw, 46);
    g.strokeStyle = rgba(C.line, 0.35);
    g.lineWidth = 1;
    g.beginPath();
    for (let k = 1; k < 4; k++) {
      g.moveTo(tx + (tw * k) / 4, y - 66);
      g.lineTo(tx + (tw * k) / 4, y - 20);
    }
    for (let k = 1; k < 3; k++) {
      g.moveTo(tx, y - 66 + (46 * k) / 3);
      g.lineTo(tx + tw, y - 66 + (46 * k) / 3);
    }
    g.stroke();
    g.fillStyle = C.rim;
    g.fillRect(tx, y - 66, tw, 2.4);
    g.restore();
    g.beginPath();
    rr(g, tx, y - 66, tw, 46, 5);
    g.lineWidth = 2.2;
    g.strokeStyle = C.line;
    g.stroke();
    g.font = '800 15px ' + UI;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = C.band;
    g.fillText('5', tx + tw * 0.36, y - 43);
    // the aerial, to the right
    const ax = R - 16;
    g.lineWidth = 2.4;
    g.strokeStyle = C.line;
    g.beginPath();
    g.moveTo(ax, y);
    g.lineTo(ax, y - 74);
    for (const k of [0, 1, 2, 3]) {
      g.moveTo(ax - 16 + k * 3, y - 70 + k * 9);
      g.lineTo(ax + 16 - k * 3, y - 70 + k * 9);
    }
    g.moveTo(ax, y - 60);
    g.lineTo(ax - 30, y);
    g.stroke();
    g.lineWidth = 1;
    g.strokeStyle = C.rim;
    g.beginPath();
    g.moveTo(ax - 1, y - 74);
    g.lineTo(ax - 1, y);
    g.stroke();
    // the rail round the roof
    g.lineWidth = 3.4;
    g.strokeStyle = C.line;
    g.beginPath();
    for (let x = L + 2; x <= R; x += 16) {
      g.moveTo(x, y);
      g.lineTo(x, y - 18);
    }
    g.moveTo(L, y - 18);
    g.lineTo(R, y - 18);
    g.moveTo(L, y - 9);
    g.lineTo(R, y - 9);
    g.stroke();
    g.lineWidth = 1.8;
    g.strokeStyle = C.steel;
    g.stroke();
    // the parapet and the band under it
    g.beginPath();
    rr(g, L, y, R - L, 14, 2);
    g.fillStyle = C.wallHi;
    g.fill();
    g.fillStyle = C.rim;
    g.fillRect(L + 1, y, R - L - 2, 2.4);
    g.fillStyle = C.wallShade;
    g.fillRect(L + 1, y + 10, R - L - 2, 3);
    g.lineWidth = 2.2;
    g.strokeStyle = C.line;
    g.stroke();
    if (snow) {
      snowCap(g, L - 1, y - 3, R - L + 2, 4.5);
      snowCap(g, tx - 1, y - 69, tw + 2, 5);
      g.strokeStyle = '#FFFFFF';
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(L, y - 19.6);
      g.lineTo(R, y - 19.6);
      g.stroke();
    }
  }
  function summit(ctx, o, C, pal) {
    const { W, y, t } = o;
    const dark = !!o.dark;
    const s = devScale(ctx);
    // once he is there: fireworks (with reduced motion, one moment of them, still)
    if (o.reached) fireworks(ctx, W, y, o.still ? 1.3 : t, dark);
    const snow = o.season === 'winter';
    const p = pic(s, 'dc-summit' + dark + snow, W, 110, (g) => paintSummit(g, W, C, dark, snow));
    ctx.drawImage(p.c, 0, snapY(ctx, y - 90), p.w, p.h);
  }
  // chrysanthemum fireworks over the town: each rises, bursts with a flash, droops and fades, again and again; at
  // night they add light to the sky
  function fireworks(ctx, W, y, t, dark) {
    const cols = ['#FFD45A', '#FF5F8F', '#5FE6D6', '#FFFFFF', '#FF8A3D', '#B98CFF'];
    ctx.save();
    ctx.lineCap = 'round';
    if (dark) ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 3; k++) {
      const per = 2.3 + k * 0.35;
      const cyc = t / per + k * 0.37;
      const ph = wrap(cyc, 1);
      const seed = Math.floor(cyc) * 3 + k;
      const x = W * (0.12 + 0.76 * hash(seed, 1));
      const cy = y - 120 - hash(seed, 2) * 80;
      const col = cols[Math.floor(hash(seed, 3) * cols.length)];
      const col2 = cols[Math.floor(hash(seed, 4) * cols.length)];
      if (ph < 0.18) {
        // the shell going up, a spark at its head
        const p = ph / 0.18;
        const yy = y - 20 - (y - 20 - cy) * p;
        ctx.strokeStyle = rgba('#FFE8B0', 0.9);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, yy + 16);
        ctx.lineTo(x, yy);
        ctx.stroke();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(x, yy, 2, 0, TAU);
        ctx.fill();
        continue;
      }
      const p = (ph - 0.18) / 0.82;
      const r = 14 + 38 * (1 - Math.pow(1 - p, 3));
      const al = Math.min(1, (1 - p) * 1.6);
      const drop = p * p * 14;
      if (p < 0.12) {
        // the flash
        ctx.fillStyle = rgba('#FFFFFF', 0.85 * (1 - p / 0.12));
        ctx.beginPath();
        ctx.arc(x, cy, 9 + 40 * p, 0, TAU);
        ctx.fill();
      }
      // the stars streaking out from the heart (a dark edge in daylight, so they show on a bright sky), bright tips,
      // and an inner ring in a second colour
      const N = 22;
      const rays = () => {
        ctx.beginPath();
        for (let i = 0; i < N; i++) {
          const an = (i / N) * TAU + seed;
          ctx.moveTo(x + Math.cos(an) * r * 0.24, cy + Math.sin(an) * r * 0.24 + drop * 0.3);
          ctx.lineTo(x + Math.cos(an) * r, cy + Math.sin(an) * r + drop);
        }
      };
      rays();
      if (!dark) {
        ctx.lineWidth = 3.6;
        ctx.strokeStyle = rgba(INK, 0.3 * al);
        ctx.stroke();
      }
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = rgba(col, al);
      ctx.stroke();
      ctx.fillStyle = rgba(dark ? '#FFFFFF' : col, al);
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const an = (i / N) * TAU + seed;
        const xx = x + Math.cos(an) * r;
        const yy = cy + Math.sin(an) * r + drop;
        ctx.moveTo(xx + 2.2, yy);
        ctx.arc(xx, yy, 2.2, 0, TAU);
      }
      ctx.fill();
      ctx.fillStyle = rgba(col2, al);
      ctx.beginPath();
      for (let i = 0; i < 12; i++) {
        const an = (i / 12) * TAU + seed + 0.3;
        const xx = x + Math.cos(an) * r * 0.55;
        const yy = cy + Math.sin(an) * r * 0.55 + drop * 0.6;
        ctx.moveTo(xx + 1.8, yy);
        ctx.arc(xx, yy, 1.8, 0, TAU);
      }
      ctx.fill();
    }
    ctx.restore();
  }

  // ---------- the falling things: boxes, rubbish bags and flowerpots ----------
  // Each is drawn round the box of its word, a little larger: pale where the word is, so it reads in both themes; a
  // hard shadow under it, and a gold ring round the one being said.

  const KINDS = ['box', 'bag', 'pot'];
  const FILLS = { box: ['#DE9A55', '#6B3A1E'], bag: ['#F3F7FD', '#3D4C6E'], pot: ['#2E56B8', '#14275E'] };
  const kindOf = (n) => KINDS[wrap(n, KINDS.length)];
  function colors(n) {
    const f = FILLS[kindOf(n)];
    return { fill: f[0], line: f[1] };
  }

  // a rubbish bag round the box of its word: a knot at the top, full sides, its foot `foot` below the box's top
  function bagPath(ctx, x, y, w, h, foot) {
    const cx = x + w / 2;
    const side = 13;
    ctx.moveTo(cx - 8, y - 10);
    ctx.quadraticCurveTo(x - side + 2, y - 10, x - side, y + h * 0.45);
    ctx.quadraticCurveTo(x - side + 1, y + foot, cx, y + foot);
    ctx.quadraticCurveTo(x + w + side - 1, y + foot, x + w + side, y + h * 0.45);
    ctx.quadraticCurveTo(x + w + side - 2, y - 10, cx + 8, y - 10);
    ctx.closePath();
  }
  function thing(ctx, o) {
    const { x, y, w, h, n } = o;
    const kind = kindOf(n);
    const pal = o.pal || {};
    const target = !!o.target;
    const flash = !!o.flash;
    const dark = !!o.dark;
    const line = flash ? pal.bad || '#C7361E' : INK;
    const cx = x + w / 2;
    const cy = y + h / 2;
    const t = o.t || 0;
    // its outline
    // its outline, lower by dy and grown by g all round (the frame, the rim and the shadow are filled grown shapes:
    // far cheaper to draw than wide strokes)
    let shape;
    if (kind === 'box') {
      shape = (dy, g = 0) => {
        ctx.beginPath();
        rr(ctx, x - 11 - g, y - 9 + dy - g, w + 22 + 2 * g, h + 18 + 2 * g, 3 + g);
      };
    } else if (kind === 'bag') {
      shape = (dy, g = 0) => {
        ctx.beginPath();
        bagPath(ctx, x - g, y + dy - g, w + 2 * g, h + g, h + 13 + g);
      };
    } else {
      shape = (dy, g = 0) => {
        ctx.beginPath();
        ctx.moveTo(x - 11 - g, y - 5 + dy - g);
        ctx.lineTo(x + w + 11 + g, y - 5 + dy - g);
        ctx.lineTo(x + w + 4 + g, y + h + 11 + dy + g);
        ctx.lineTo(x - 4 - g, y + h + 11 + dy + g);
        ctx.closePath();
      };
    }
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // the hard shadow (the one being said casts its gold frame's too)
    shape(target ? 5 : 3.5, target ? 6.2 : 0);
    ctx.fillStyle = dark ? 'rgba(2,3,14,0.8)' : target ? INK : 'rgba(27,36,64,0.55)';
    ctx.fill();
    // what sticks out at the top, behind
    if (kind === 'box') {
      // its flaps, open
      ctx.beginPath();
      ctx.moveTo(x - 9, y - 9);
      ctx.lineTo(x - 17, y - 19);
      ctx.lineTo(cx - 6, y - 21);
      ctx.lineTo(cx - 2, y - 9);
      ctx.closePath();
      ctx.moveTo(x + w + 9, y - 9);
      ctx.lineTo(x + w + 17, y - 19);
      ctx.lineTo(cx + 6, y - 21);
      ctx.lineTo(cx + 2, y - 9);
      ctx.closePath();
      ctx.fillStyle = flash ? '#FFD9CF' : '#F0B978';
      ctx.fill();
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = line;
      ctx.stroke();
      if (n % 2 === 0) {
        // a leek, from the shopping
        ctx.beginPath();
        ctx.moveTo(cx - 14, y - 9);
        ctx.quadraticCurveTo(cx - 18, y - 24, cx - 26, y - 33);
        ctx.quadraticCurveTo(cx - 14, y - 26, cx - 9, y - 9);
        ctx.moveTo(cx - 12, y - 9);
        ctx.quadraticCurveTo(cx - 8, y - 26, cx - 2, y - 35);
        ctx.quadraticCurveTo(cx - 3, y - 22, cx - 6, y - 9);
        ctx.fillStyle = '#3FAE4F';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    } else if (kind === 'bag') {
      // its knot: the gathered neck and the two ears tied over it
      ctx.beginPath();
      ctx.moveTo(cx - 9, y - 9);
      ctx.lineTo(cx - 4, y - 16);
      ctx.lineTo(cx + 4, y - 16);
      ctx.lineTo(cx + 9, y - 9);
      ctx.closePath();
      ctx.fillStyle = flash ? '#FFE2DA' : '#E3ECF8';
      ctx.fill();
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = line;
      ctx.stroke();
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(cx + sx * 7.5, y - 19, 7.5, 4.4, sx * 0.6, 0, TAU);
        ctx.fillStyle = flash ? '#FFE2DA' : '#EEF4FC';
        ctx.fill();
        ctx.stroke();
      }
      ctx.beginPath();
      rr(ctx, cx - 4, y - 21, 8, 6, 2.5);
      ctx.fillStyle = flash ? '#FFD0C4' : '#D5E1F2';
      ctx.fill();
      ctx.stroke();
    } else {
      // the plant: clumps of leaves along the rim (more on a long pot), red flowers with gold hearts; their outline is
      // one ink shape under them, grown a little (cheaper than stroking each leaf)
      const sway = Math.sin(t * 2.2 + n) * 1.2;
      const clumps = Math.max(1, Math.min(4, Math.round((w + 20) / 62)));
      const at = (i) => cx + (clumps === 1 ? 0 : (i / (clumps - 1) - 0.5) * (w - 8)) + sway;
      const LEAVES = [[-13, -12, 9, 5, -0.5], [13, -13, 9, 5, 0.5], [0, -19, 8, 5, 0]];
      const FLOWERS = [[-10, -23], [3, -28], [14, -21]];
      const blobs = (grow, leaves, flowers) => {
        ctx.beginPath();
        for (let i = 0; i < clumps; i++) {
          const ax = at(i);
          if (leaves) {
            for (const [lx, ly, a, b, rot] of LEAVES) {
              ctx.moveTo(ax + lx + a + grow, y + ly);
              ctx.ellipse(ax + lx, y + ly, a + grow, b + grow, rot, 0, TAU);
            }
          }
          if (flowers) {
            for (const [fx, fy] of FLOWERS) {
              const r = flowers + grow;
              ctx.moveTo(ax + fx + r, y + fy + (i % 2) * 2);
              ctx.arc(ax + fx, y + fy + (i % 2) * 2, r, 0, TAU);
            }
          }
        }
      };
      blobs(1.5, true, 5);
      ctx.fillStyle = line;
      ctx.fill();
      blobs(0, true, 0);
      ctx.fillStyle = '#3E9A55';
      ctx.fill();
      blobs(0, false, 5);
      ctx.fillStyle = '#F2513A';
      ctx.fill();
      blobs(0, false, 1.8);
      ctx.fillStyle = '#FFD45A';
      ctx.fill();
    }
    // the ring round the one being said, gold; at night a cool rim round the others
    if (target) {
      shape(0, 6.2);
      ctx.fillStyle = INK;
      ctx.fill();
      shape(0, 4.6);
      ctx.fillStyle = mix('#F2B43A', '#FFE27A', 0.5 + 0.5 * Math.sin(t * 6));
      ctx.fill();
    } else if (dark) {
      shape(0, 2.6);
      ctx.fillStyle = 'rgba(150,168,255,0.6)';
      ctx.fill();
    }
    // the body, its shading inside it (light from the upper left), and what is printed on it
    shape(0);
    if (kind === 'box') {
      ctx.fillStyle = flash ? '#FFD9CF' : '#DE9A55';
      ctx.fill();
      ctx.fillStyle = flash ? 'rgba(199,54,30,0.18)' : '#BF7A3A';
      ctx.fillRect(x + w + 4, y - 8, 6.5, h + 16);
      ctx.fillRect(x - 10, y + h + 4, w + 20, 4.5);
      ctx.fillStyle = flash ? 'rgba(255,255,255,0.4)' : '#EDB36F';
      ctx.fillRect(x - 10, y - 8, w + 20, 3);
      // packing tape either side of the label
      ctx.fillStyle = flash ? 'rgba(255,255,255,0.5)' : '#EBCB92';
      ctx.fillRect(x - 10, y + h * 0.35, 6, 6);
      ctx.fillRect(x + w + 4, y + h * 0.35, 6, 6);
      // the label, where the word is
      ctx.beginPath();
      rr(ctx, x - 4, y - 3, w + 8, h + 6, 3);
      ctx.fillStyle = flash ? '#FFF1EC' : '#FFF9EE';
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = flash ? line : rgba(INK, 0.55);
      ctx.stroke();
      // this way up
      ctx.strokeStyle = flash ? line : '#C7361E';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const ax = x + w + 7;
      const ay = y + h + 7;
      for (const dx of [-3.5, 0]) {
        ctx.moveTo(ax + dx, ay);
        ctx.lineTo(ax + dx, ay - 5);
        ctx.moveTo(ax + dx - 1.6, ay - 3.4);
        ctx.lineTo(ax + dx, ay - 5);
        ctx.lineTo(ax + dx + 1.6, ay - 3.4);
      }
      ctx.stroke();
    } else if (kind === 'bag') {
      // the colour band printed round the foot of the town's bags shows under the pale upper bag
      ctx.fillStyle = flash ? '#F7B9A8' : '#F29A2E';
      ctx.fill();
      ctx.beginPath();
      bagPath(ctx, x, y, w, h, h + 4);
      ctx.fillStyle = flash ? '#FFE9E3' : '#F4F8FE';
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let k = 0; k < 4; k++) ctx.fillRect(cx - 14 + k * 8, y + h + 7, 5, 1.6);
      // a shade down the right, inside the bag
      ctx.fillStyle = flash ? 'rgba(199,54,30,0.12)' : 'rgba(110,132,178,0.3)';
      ctx.beginPath();
      ctx.ellipse(x + w + 7, cy + 2, 4, h * 0.42, 0, 0, TAU);
      ctx.fill();
      // creases from the knot
      ctx.strokeStyle = rgba('#6E84B2', 0.75);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(cx - 4, y - 8);
      ctx.quadraticCurveTo(cx - 9, y - 4, cx - 13, y - 3);
      ctx.moveTo(cx + 4, y - 8);
      ctx.quadraticCurveTo(cx + 9, y - 4, cx + 13, y - 3);
      ctx.stroke();
    } else {
      // a blue-and-white glazed pot: pale where the word is, blue waves (seigaiha) round its foot, a blue rim
      ctx.fillStyle = flash ? '#FFEDE8' : '#FFF6E6';
      ctx.fill();
      const span = h + 16;
      const xl = (yy) => x - 11 + (7 * (yy - (y - 5))) / span;
      const xr = (yy) => x + w + 11 - (7 * (yy - (y - 5))) / span;
      const yb = y + h + 3;
      const yf = y + h + 11;
      ctx.fillStyle = flash ? 'rgba(199,54,30,0.1)' : 'rgba(46,86,184,0.14)';
      ctx.beginPath();
      ctx.moveTo(xr(y - 5) - 9, y - 5);
      ctx.lineTo(xr(y - 5), y - 5);
      ctx.lineTo(xr(yf), yf);
      ctx.lineTo(xr(yf) - 9, yf);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(xl(yb), yb);
      ctx.lineTo(xr(yb), yb);
      ctx.lineTo(xr(yf), yf);
      ctx.lineTo(xl(yf), yf);
      ctx.closePath();
      ctx.fillStyle = flash ? 'rgba(199,54,30,0.45)' : '#2E56B8';
      ctx.fill();
      // the waves as filled arcs, a pale one and the blue again inside it
      for (const [r, col] of [[4, flash ? 'rgba(255,255,255,0.8)' : '#BFD0FF'], [2.6, flash ? 'rgba(199,54,30,0.45)' : '#2E56B8']]) {
        ctx.beginPath();
        for (let sx = xl(yf) + 5; sx < xr(yf) - 4; sx += 8) {
          ctx.moveTo(sx + r, yf);
          ctx.arc(sx, yf, r, 0, Math.PI, true);
          ctx.closePath();
        }
        ctx.fillStyle = col;
        ctx.fill();
      }
    }
    // the outline
    shape(0);
    ctx.lineWidth = target ? 3.2 : 2.3;
    ctx.strokeStyle = line;
    ctx.stroke();
    if (kind === 'pot') {
      // its rim
      ctx.beginPath();
      rr(ctx, x - 14, y - 11, w + 28, 8, 2.5);
      ctx.fillStyle = flash ? '#FFC9BC' : '#2E56B8';
      ctx.fill();
      ctx.fillStyle = flash ? 'rgba(255,255,255,0.5)' : '#5F86E6';
      ctx.fillRect(x - 12, y - 10, w + 24, 2.2);
      ctx.lineWidth = target ? 2.6 : 2;
      ctx.strokeStyle = line;
      ctx.stroke();
    }
  }

  W0.define('danchi', {
    palette: PALETTE,
    // the fire ladder's landings, one above the other
    layout(n, W) {
      return { x: W / 2, side: 0 };
    },
    fall,
    climb,
    ledge,
    summit,
    thing,
    colors,
  });
})();
