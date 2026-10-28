/*
 * Yaoki Speaking's place 団地 Apartment block, drawn for world.js: boxes, rubbish bags and flowerpots dropped from the windows; Climb goes up the fire ladder to the roof and its water tank.
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
    light: { sky: '#DCE9F6', low: '#F1F4F8', eve: '#F7DCC9', wall: '#EEE9E1', wall2: '#E5DFD5', line: '#DDD5C9', glass: '#DCE6F1', frame: '#CBD2DD', rail: '#D2CABD', street: '#E2DED7', curb: '#CFC9BF', ladder: '#B9C0CC', lit: '#F6DE96' },
    dark: { sky: '#131A33', low: '#1A2240', eve: '#28223F', wall: '#1E2441', wall2: '#1A203A', line: '#272E4E', glass: '#283157', frame: '#333C62', rail: '#2E3658', street: '#20263F', curb: '#2B3250', ladder: '#4A5378', lit: '#F3D47E' },
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

  // ---------- the falling things: boxes, rubbish bags and flowerpots ----------
  // Each is drawn round the box of its word, a little larger: pale where the word is, so it reads in both themes.

  const KINDS = ['box', 'bag', 'pot'];
  const FILLS = { box: ['#EBD3A6', '#C8A673'], bag: ['#F3F6FA', '#B8C4D4'], pot: ['#F0B796', '#C9805C'] };
  const kindOf = (n) => KINDS[wrap(n, KINDS.length)];
  function colors(n) {
    const f = FILLS[kindOf(n)];
    return { fill: f[0], line: f[1] };
  }
  function thing(ctx, o) {
    const { x, y, w, h, n } = o;
    const kind = kindOf(n);
    const [fill, shade] = FILLS[kind];
    const cx = x + w / 2;
    const cy = y + h / 2;
    const shape = (dy) => {
      ctx.beginPath();
      if (kind === 'box') {
        rr(ctx, x - 6, y - 6 + dy, w + 12, h + 12, 3);
      } else if (kind === 'bag') {
        ctx.moveTo(cx - 8, y - 10 + dy);
        ctx.quadraticCurveTo(x - 10, y - 2 + dy, x - 8, cy + dy);
        ctx.quadraticCurveTo(x - 8, y + h + 10 + dy, cx, y + h + 10 + dy);
        ctx.quadraticCurveTo(x + w + 8, y + h + 10 + dy, x + w + 8, cy + dy);
        ctx.quadraticCurveTo(x + w + 10, y - 2 + dy, cx + 8, y - 10 + dy);
        ctx.closePath();
      } else {
        ctx.moveTo(x - 8, y - 4 + dy);
        ctx.lineTo(x + w + 8, y - 4 + dy);
        ctx.lineTo(x + w + 2, y + h + 8 + dy);
        ctx.lineTo(x - 2, y + h + 8 + dy);
        ctx.closePath();
      }
    };
    thingFrame(ctx, o, fill, shape, (line, lw) => {
      if (kind === 'box') {
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
      } else {
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
      }
    });
  }

  W0.define('danchi', Object.assign(danchi, {
    palette: PALETTE,
    // the fire ladder's rungs, one above the other
    layout(n, W) {
      return { x: W / 2, side: 0 };
    },
    thing,
    colors,
  }));
})();
