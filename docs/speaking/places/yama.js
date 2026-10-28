/*
 * Yaoki Speaking's place 山 Mountain, drawn for world.js: rocks come down the crevice; Climb goes up its rock ledges to the summit and its flag.
 *
 * It is registered with SpeakingWorld.define(id, place), where place = { palette: { light, dark }, layout(n, W),
 * fall(ctx, o, C), climb(ctx, o, C), ledge(ctx, o, C, pal), summit(ctx, o, C, pal), thing(ctx, o, C), colors(n) }
 * (C: the palette of the theme in use; o as world.js says of back, ledge, summit and thing). The helpers it draws with
 * are world.js's (SpeakingWorld.kit).
 */
(function () {
  'use strict';

  const W0 = window.SpeakingWorld;
  if (!W0 || !W0.kit) return;
  const { TAU, INK, UI, hash, rng, noise, clamp, smooth, wrap, rgb, mix, rgba, rr, roundPoly, puff, fillPath, skyFill, cachedLayer, stars, thingFrame } = W0.kit;

  const PALETTE = {
    light: { sky: '#D9E8F5', low: '#F2F4F8', eve: '#F9E2CB', far: '#D8DEEA', snow: '#F4F6FA', cliff: '#E4DFD6', cliff2: '#D9D3C8', strata: '#CEC7BA', ground: '#E8E2D6', pebble: '#D5CDC0', ledge: '#DCD5C9', plant: '#C9D9BE', cloud: '#FFFFFF' },
    dark: { sky: '#121933', low: '#1B2341', eve: '#2B2340', far: '#202945', snow: '#2E3857', cliff: '#252B44', cliff2: '#1F243B', strata: '#2E3553', ground: '#21273E', pebble: '#2B3250', ledge: '#3A4262', plant: '#24333A', cloud: '#2A3352' },
  };

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

  // ---------- the falling things: rocks ----------
  // Each is drawn round the box of its word, a little larger: pale where the word is, so it reads in both themes.

  const KINDS = ['rock'];
  const FILLS = { rock: ['#E6E2DA', '#B9B1A4'] };
  const kindOf = (n) => KINDS[wrap(n, KINDS.length)];
  function colors(n) {
    const f = FILLS[kindOf(n)];
    return { fill: f[0], line: f[1] };
  }
  function thing(ctx, o) {
    const { x, y, w, h, n } = o;
    const [fill, shade] = FILLS[kindOf(n)];
    const R = rng(1000 + n * 7);
    const cx = x + w / 2;
    const cy = y + h / 2;
    const shape = (dy) => {
      ctx.beginPath();
      const pts = [];
      const m = 11;
      for (let i = 0; i < m; i++) {
        const a = (i / m) * TAU;
        const jit = 1 + (R() - 0.5) * 0.12;
        pts.push([cx + Math.cos(a) * (w / 2 + 9) * jit, cy + dy + Math.sin(a) * (h / 2 + 9) * jit]);
      }
      roundPoly(ctx, pts, 8);
    };
    thingFrame(ctx, o, fill, shape, () => {
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
    });
  }

  W0.define('yama', Object.assign(yama, {
    palette: PALETTE,
    // the crevice's ledges keep to its walls
    layout(n, W) {
      const side = n % 2 ? 1 : -1;
      return { x: side < 0 ? W * 0.3 : W * 0.7, side };
    },
    thing,
    colors,
  }));
})();
