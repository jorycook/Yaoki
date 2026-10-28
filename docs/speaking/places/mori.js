/*
 * Yaoki Speaking's place 森 Forest, drawn for world.js: acorns, pears and persimmons from a great tree; Climb goes up its branches to a nest.
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
    light: { sky: '#E3F0EA', low: '#F2F6F3', eve: '#F6E2CC', trunk: '#CDB495', bark: '#B99F80', grass: '#DCE8D1', ground: '#E4E7D8', cloud: '#FFFFFF', far: '#D3E2D2' },
    dark: { sky: '#111D24', low: '#16242B', eve: '#26202F', trunk: '#3A3329', bark: '#2E2820', grass: '#1C2A26', ground: '#1E2826', cloud: '#22323A', far: '#1A2A2C' },
  };
  // the great tree's leaves, by the season
  const LEAVES = {
    spring: { light: ['#D9EBCB', '#CDE3BD', '#F6D3DD'], dark: ['#21352A', '#1D2F25', '#4A3340'] },
    summer: { light: ['#C9E2B8', '#BCD9A9', '#D7EBC6'], dark: ['#1E3326', '#1A2D21', '#234030'] },
    autumn: { light: ['#F3D4A7', '#EDC08E', '#E8A98B'], dark: ['#3E3122', '#3A2A1E', '#43282A'] },
    winter: { light: ['#E2E8E5', '#D7DFDB', '#F7FAFC'], dark: ['#22302E', '#1E2A28', '#34404A'] },
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

  // ---------- the falling things: acorns, pears and persimmons ----------
  // Each is drawn round the box of its word, a little larger: pale where the word is, so it reads in both themes.

  const KINDS = ['acorn', 'pear', 'kaki'];
  const FILLS = { acorn: ['#EDD6AA', '#A97E52'], pear: ['#EFDDA7', '#C2A56A'], kaki: ['#F8C487', '#D98C49'] };
  const kindOf = (n) => KINDS[wrap(n, KINDS.length)];
  function colors(n) {
    const f = FILLS[kindOf(n)];
    return { fill: f[0], line: f[1] };
  }
  function thing(ctx, o) {
    const { x, y, w, h, n } = o;
    const kind = kindOf(n);
    const [fill, shade] = FILLS[kind];
    const R = rng(1000 + n * 7);
    const cx = x + w / 2;
    const cy = y + h / 2;
    const shape = (dy) => {
      ctx.beginPath();
      ctx.ellipse(cx, cy + dy + 2, w / 2 + 10, h / 2 + 10, 0, 0, TAU);
    };
    thingFrame(ctx, o, fill, shape, (line, lw) => {
      if (kind === 'acorn') {
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
        return;
      }
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
    });
  }

  W0.define('mori', Object.assign(mori, {
    palette: PALETTE,
    // the branches come off the trunk on either side
    layout(n, W) {
      const side = n % 2 ? 1 : -1;
      return { x: W / 2 + side * Math.min(W * 0.26, 70), side };
    },
    thing,
    colors,
  }));
})();
