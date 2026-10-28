/*
 * Yaoki Speaking's place 神社 Shrine, drawn for world.js: hail from a storm over the torii; Climb goes up the stone steps, through torii, to the shrine and its bell.
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
    light: { sky: '#E7E5F0', low: '#F3F2F7', eve: '#F1DCD8', storm: '#D7D4E4', torii: '#F2B6A7', torii2: '#E9A08E', cedar: '#D4DED3', cedar2: '#C8D4C7', trunk: '#D2C5B4', stone: '#E6E3DC', stone2: '#D6D1C7', lantern: '#DCD7CE', moss: '#D3DFC7', hail: '#FFFFFF' },
    dark: { sky: '#151A30', low: '#1B2139', eve: '#2A2038', storm: '#222844', torii: '#5B2F39', torii2: '#4A2630', cedar: '#1C292D', cedar2: '#18242A', trunk: '#2A2A33', stone: '#252A40', stone2: '#20253A', lantern: '#2C3149', moss: '#21302F', hail: '#C9D6EE' },
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

  // ---------- the falling things: hail ----------
  // Each is drawn round the box of its word, a little larger: pale where the word is, so it reads in both themes.

  const KINDS = ['hail'];
  const FILLS = { hail: ['#EEF7FD', '#A9C7DD'] };
  const kindOf = (n) => KINDS[wrap(n, KINDS.length)];
  function colors(n) {
    const f = FILLS[kindOf(n)];
    return { fill: f[0], line: f[1] };
  }
  function thing(ctx, o) {
    const { x, y, w, h, n } = o;
    const [fill] = FILLS[kindOf(n)];
    const R = rng(1000 + n * 7);
    const cx = x + w / 2;
    const cy = y + h / 2;
    const shape = (dy) => {
      ctx.beginPath();
      const m = 14;
      const pts = [];
      for (let i = 0; i < m; i++) {
        const a = (i / m) * TAU;
        const k = 1 + (i % 2 ? 0.05 : -0.02) + (R() - 0.5) * 0.06;
        pts.push([cx + Math.cos(a) * (w / 2 + 10) * k, cy + dy + Math.sin(a) * (h / 2 + 10) * k]);
      }
      roundPoly(ctx, pts, 0);
    };
    thingFrame(ctx, o, fill, shape, () => {
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.min(w, h) / 2 + 4, Math.PI * 1.1, Math.PI * 1.4);
      ctx.stroke();
      ctx.fillStyle = 'rgba(169,199,221,0.5)';
      ctx.beginPath();
      ctx.arc(x + w - 4, y + h + 2, 3, 0, TAU);
      ctx.fill();
    });
  }

  W0.define('jinja', Object.assign(jinja, {
    palette: PALETTE,
    // the steps turn back and forth up the hill
    layout(n, W) {
      return { x: W * [0.34, 0.5, 0.66, 0.5][wrap(n, 4)], side: 0 };
    },
    thing,
    colors,
  }));
})();
