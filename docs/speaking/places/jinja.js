/*
 * Yaoki Speaking's place 神社 Shrine, drawn for world.js: hail from a storm over the torii; Climb goes up the stone
 * steps, through torii, to the shrine hall and its bell.
 *
 * It is registered with SpeakingWorld.define(id, place), where place = { palette: { light, dark }, layout(n, W),
 * fall(ctx, o, C), climb(ctx, o, C), ledge(ctx, o, C, pal), summit(ctx, o, C, pal), thing(ctx, o, C), colors(n) }
 * (C: the palette of the theme in use; o as world.js says of back, ledge, summit and thing). The helpers it draws with
 * are world.js's (SpeakingWorld.kit), and a few of its own below.
 *
 * The look is a woodblock print of a storm at a shrine in the cedars. Falling looks through a great vermilion torii at
 * the court beyond: the storm hangs overhead in lobes lit from below, lightning flickers at the side, rain slants down
 * and the hail comes through the gate. Climb goes up the stone steps along a ridge, under torii and past stone lanterns
 * and the cedars of the avenue, while the hills sink away and the storm clears; at the top stands the hall, its copper
 * roof green, with its bell and rope, and the sun (the moon at night) comes out behind it. Night is the same storm by
 * moonlight, the lanterns lit. The season shows in the tree by the gate and in what the wind carries. The hail and the
 * signs stay pale where the words are, and the busy parts keep to the sides.
 */
(function () {
  'use strict';

  const W0 = window.SpeakingWorld;
  if (!W0 || !W0.kit) return;
  const { TAU, INK, hash, rng, noise, clamp, smooth, wrap, mix, rgba, rr, roundPoly } = W0.kit;

  const PALETTE = {
    // a storm late in the day: deep blue overhead, the light low and golden under it; vermilion and gold for the shrine
    light: {
      sky: ['#151D52', '#1F3474', '#285996', '#3383A8', '#6FB3AE', '#E8D69C'],
      eve: ['#161750', '#272B72', '#4D3A86', '#94467E', '#DB6A4E', '#F6B35E'],
      clear: ['#1F3A88', '#3462AA', '#5A92C8', '#9ECBD8', '#F6E1A0', '#FFC27A'],
      storm: '#18204F', storm2: '#29366F', stormHi: '#40518F', stormRim: '#F4BF7E',
      cloud: '#2D4482', cloudHi: '#4E69AA', cloudRim: '#F2BC7E',
      bolt: '#FFF8D4', boltGlow: '#FFE7A0', flash: '#FFF4D8',
      sun: '#FFF2C6', halo: '#FFD58A', star: '#FFFFFF',
      far: '#86A6CE', far2: '#6584B8', mist: '#D5E7EC', hill: '#3F7E86', hillHi: '#5E9C9E', valley: '#9CC0C8',
      court: '#9AA8C7', path: '#C8D1E4', pathLine: '#7783A6', gravel: '#B8C2DA',
      cedarFar: '#4F8D94', cedarFarHi: '#6CA8A9', trunkFar: '#6E8098',
      cedar: '#1F5A4C', cedarHi: '#3D8C6B', cedarLine: '#0B2B24', cedarNear: '#16463A',
      trunk: '#7D3B29', trunkHi: '#B0613F',
      torii: '#EE5A24', toriiHi: '#FF9259', toriiShade: '#B43A1D', kasagi: '#1B2440', kasagiHi: '#4A5686',
      stone: '#9EABC5', stoneHi: '#D0D8E9', stoneShade: '#6F7C9C',
      // (the steps a slate a shade deeper than the slabs and the kerbs, so the white signs over them stand out)
      step: '#8796BF', stepHi: '#B7C3E2', stepShade: '#6877A6',
      slab: '#A4B1CB', slabTop: '#D6DDEB', slabShade: '#7A88A8',
      line: '#1B2440', rim: '',
      lamp: '#FFD47A', lampGlow: '#FFB24A',
      ground: '#8F9ABA', groundHi: '#B9C2DA', joint: '#4A5378',
      puddle: '#4F9DC9', puddleHi: '#C6ECF7',
      moss: '#5B9B50', mossHi: '#8DC66C', mossLine: '#24481F',
      rope: '#E5C26E', ropeShade: '#A9843B', ropeLine: '#4A3414', paper: '#FFFFFF',
      roof: '#3A9A8A', roofHi: '#74CFB8', roofShade: '#276C63', roofLine: '#0F302B',
      wall: '#F6EFDF', wood: '#5A3226', woodHi: '#8A5338', dim: '#2B2342', gold: '#F2B43A', goldHi: '#FFE493',
      snow: '#FFFFFF', snowShade: '#BFD3F2',
      rain: 'rgba(228,241,255,0.5)', pellet: '#FFFFFF',
    },
    // the same storm at night, by moonlight: navy and violet, a cool rim on the edges, the lanterns warm
    dark: {
      sky: ['#04081E', '#0A123C', '#131C55', '#1D276C', '#2B2F80', '#4A3E8E'],
      eve: ['#05071E', '#0D1142', '#1B185C', '#341F73', '#55297E', '#7E3E86'],
      clear: ['#050A26', '#0F1950', '#1C276C', '#2E3386', '#4B3F96', '#704E9E'],
      storm: '#0C1234', storm2: '#161F55', stormHi: '#25327A', stormRim: '#97A9F7',
      cloud: '#18225A', cloudHi: '#2B3A80', cloudRim: '#93A6F2',
      bolt: '#F6F4FF', boltGlow: '#BAC6FF', flash: '#C9D2FF',
      sun: '#FFF5DA', halo: '#AFC0FF', star: '#EEF1FF',
      far: '#2E3E7E', far2: '#233169', mist: '#3E4E92', hill: '#17345A', hillHi: '#22476C', valley: '#2A3A78',
      court: '#2A3466', path: '#3C487E', pathLine: '#141A40', gravel: '#343E74',
      cedarFar: '#1B3A58', cedarFarHi: '#27506D', trunkFar: '#2A3358',
      cedar: '#0F2D36', cedarHi: '#1D4D53', cedarLine: '#030D11', cedarNear: '#0A2129',
      trunk: '#4E241A', trunkHi: '#743827',
      torii: '#C73E21', toriiHi: '#EC6A3E', toriiShade: '#7E2314', kasagi: '#0A0E22', kasagiHi: '#3A4580',
      stone: '#4B588B', stoneHi: '#7080B8', stoneShade: '#2E3862',
      step: '#3A4679', stepHi: '#5B69A2', stepShade: '#29335E',
      slab: '#505D91', slabTop: '#7887BF', slabShade: '#343F6E',
      line: '#070A1C', rim: '#8EA6FF',
      lamp: '#FFD27A', lampGlow: '#FF9E3D',
      ground: '#273166', groundHi: '#3B4886', joint: '#0D1232',
      puddle: '#1E3C7C', puddleHi: '#7492E8',
      moss: '#2E6047', mossHi: '#4B8A62', mossLine: '#081A12',
      rope: '#C29E55', ropeShade: '#80632F', ropeLine: '#22170A', paper: '#E8EDFF',
      roof: '#23685F', roofHi: '#3F9C8B', roofShade: '#164741', roofLine: '#051512',
      wall: '#CFCBE0', wood: '#2E1913', woodHi: '#55301F', dim: '#120E24', gold: '#F2B43A', goldHi: '#FFE493',
      snow: '#E4EBFF', snowShade: '#8E9FD6',
      rain: 'rgba(172,194,255,0.42)', pellet: '#DCE6FF',
    },
  };

  // the season: the tree by the gate (fill, light, line) and what the wind carries
  const SEASONS = {
    spring: { light: ['#F29BBB', '#FFD6E5', '#7A2F52'], dark: ['#A8627F', '#D99AB5', '#26101C'], bits: ['#FFC4D8', '#F48DB3'] },
    summer: { light: ['#4C9E54', '#8DCC6F', '#163E22'], dark: ['#285B3A', '#3F8052', '#06170C'], bits: ['#79C463', '#3F8A47'] },
    autumn: { light: ['#CF3036', '#F59E3A', '#470A10'], dark: ['#962630', '#C2652C', '#170305'], bits: ['#E8452B', '#F5A93A'] },
    winter: { light: ['#FFFFFF', '#FFFFFF', '#5A6A8A'], dark: ['#DCE4F8', '#FFFFFF', '#1A2140'], bits: ['#FFFFFF', '#E6EEFF'] },
  };
  const seasonOf = (o) => (SEASONS[o.season] ? o.season : 'autumn');
  const mixAll = (a, b, k) => a.map((c, i) => mix(c, b[i], k));

  // ---------- pictures kept between frames ----------
  // A frame here uses several pictures (the sky, the scene, the clouds, the torii, the hall), kept here, each at the
  // size it is shown at, on whole device pixels. A round is played one way, in one theme: what was painted for another
  // is let go when it starts. Beyond a budget of pixels, those not drawn in the last two frames are let go too, the
  // least recently drawn first.

  const PICS = new Map();
  const BUDGET = 1.2e7;
  let frame = 0;
  let mode = '';
  function modeIs(m) {
    if (m === mode) return;
    mode = m;
    for (const k of Array.from(PICS.keys())) if (!k.startsWith('glow')) drop(k);
  }
  // and all of it let go of once nothing of this place has been drawn for a few seconds (a round in another place, the
  // menu, a hidden page), as in the other places: a phone has only so much memory for canvases
  let drawnAt = 0;
  let sweeping = false;
  function drawn() {
    drawnAt = Date.now();
    if (sweeping) return;
    sweeping = true;
    const check = () => {
      if (Date.now() - drawnAt < 5000) {
        setTimeout(check, 2500);
        return;
      }
      sweeping = false;
      mode = '';
      for (const k of Array.from(PICS.keys())) drop(k);
    };
    setTimeout(check, 2500);
  }
  function devScale(ctx) {
    try {
      const m = ctx.getTransform();
      return clamp(Math.hypot(m.a, m.b), 0.5, 6);
    } catch (err) {
      return 2;
    }
  }
  function drop(k) {
    const p = PICS.get(k);
    PICS.delete(k);
    if (p) p.c.width = p.c.height = 0;
  }
  function pic(key, w, h, sc, paint) {
    const k = key + '|' + w.toFixed(1) + 'x' + h.toFixed(1) + '@' + sc.toFixed(2);
    let p = PICS.get(k);
    if (p) {
      p.used = frame;
      return p;
    }
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w * sc));
    c.height = Math.max(1, Math.ceil(h * sc));
    const g = c.getContext('2d');
    g.setTransform(sc, 0, 0, sc, 0, 0);
    g.lineJoin = 'round';
    g.lineCap = 'round';
    paint(g);
    p = { c, w: c.width / sc, h: c.height / sc, used: frame };
    PICS.set(k, p);
    let px = 0;
    for (const v of PICS.values()) px += v.c.width * v.c.height;
    if (px > BUDGET) {
      const old = Array.from(PICS.entries()).filter((e) => e[1].used < frame - 1).sort((a, b) => a[1].used - b[1].used);
      for (const [kk, v] of old) {
        if (px <= BUDGET) break;
        px -= v.c.width * v.c.height;
        drop(kk);
      }
    }
    return p;
  }
  // a picture with its corner at (x, y), on whole device pixels so it stays as sharp as it was painted
  function put(ctx, p, x, y) {
    let X = x;
    let Y = y;
    try {
      const m = ctx.getTransform();
      if (!m.b && !m.c && m.a > 0 && m.d > 0) {
        X = (Math.round(m.a * x + m.e) - m.e) / m.a;
        Y = (Math.round(m.d * y + m.f) - m.f) / m.d;
      }
    } catch (err) {
      // drawn where it is
    }
    ctx.drawImage(p.c, X, Y, p.w, p.h);
  }
  // a soft round light, as a picture: drawn with an alpha, it costs no gradient each frame; drawn whole, on whole device
  // pixels, it is a copy rather than a stretch
  function glow(sc, color, r) {
    return pic('glow' + color + r, 2 * r, 2 * r, sc, (g) => {
      const gr = g.createRadialGradient(r, r, 0, r, r, r);
      gr.addColorStop(0, rgba(color, 0.85));
      gr.addColorStop(0.3, rgba(color, 0.4));
      gr.addColorStop(1, rgba(color, 0));
      g.fillStyle = gr;
      g.fillRect(0, 0, 2 * r, 2 * r);
    });
  }
  function putGlow(ctx, sc, color, r, x, y, a) {
    if (a <= 0.01) return;
    const p = glow(sc, color, r);
    ctx.globalAlpha = Math.min(1, a);
    put(ctx, p, x - r, y - r);
    ctx.globalAlpha = 1;
  }

  // ---------- painting: the pieces ----------

  // a sky in bands (bokashi): each colour held a little, then blended into the next
  function bands(g, y0, y1, cols) {
    const gr = g.createLinearGradient(0, y0, 0, y1);
    const n = cols.length - 1;
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      gr.addColorStop(clamp(k - 0.05, 0, 1), cols[i]);
      gr.addColorStop(clamp(k + 0.05, 0, 1), cols[i]);
    }
    return gr;
  }

  // the same, painted each frame over the height H down to y1: flat bands, each colour a solid fill, with short
  // gradient seams between them, so most of it costs no more than a fill
  function skyBands(ctx, W, H, y1, cols) {
    const n = cols.length - 1;
    const step = H / n;
    const seam = step * 0.24;
    for (let i = 0; i <= n; i++) {
      const a = i === 0 ? 0 : (i - 0.5) * step + seam / 2;
      const b = i === n ? H : (i + 0.5) * step - seam / 2;
      if (a >= y1) break;
      ctx.fillStyle = cols[i];
      ctx.fillRect(0, a, W, Math.min(b, y1) - a);
      if (i < n && b < y1) {
        const gr = ctx.createLinearGradient(0, b, 0, b + seam);
        gr.addColorStop(0, cols[i]);
        gr.addColorStop(1, cols[i + 1]);
        ctx.fillStyle = gr;
        ctx.fillRect(0, b, W, Math.min(seam, y1 - b));
      }
    }
  }

  // the storm overhead: a low ceiling of cloud whose underside hangs in lobes, lit from below at their rims, with a
  // lighter layer behind showing between them, and a few curls
  function stormBank(g, W, yb, C, seed) {
    const R = rng(seed);
    const row = (y, r0, r1) => {
      const out = [];
      for (let x = -14; x < W + 30; ) {
        const r = r0 + R() * (r1 - r0);
        out.push([x + r, y + (R() - 0.5) * 6, r]);
        x += r * 1.55;
      }
      return out;
    };
    const lobes = (list, dy) => {
      g.beginPath();
      for (const [x, y, r] of list) {
        g.moveTo(x + r, y + dy);
        g.arc(x, y + dy, r, 0, TAU);
      }
    };
    const back = row(yb - 10, 8, 13);
    const front = row(yb, 10, 17);
    g.fillStyle = C.storm2;
    g.fillRect(-4, -4, W + 8, yb - 6);
    lobes(back, 0);
    g.fill();
    g.fillStyle = C.stormHi;
    lobes(front, 0);
    g.fill();
    g.fillStyle = C.storm;
    g.fillRect(-4, -4, W + 8, yb - 2);
    lobes(front, -4.5);
    g.fill();
    // the rims, lit from under the storm
    g.lineWidth = 2;
    g.strokeStyle = C.stormRim;
    g.beginPath();
    for (const [x, y, r] of front) {
      g.moveTo(x + r * Math.cos(0.18 * Math.PI), y + r * Math.sin(0.18 * Math.PI));
      g.arc(x, y, r, 0.18 * Math.PI, 0.82 * Math.PI);
    }
    g.stroke();
    // curls at the sides, as clouds are drawn in prints
    g.lineWidth = 1.6;
    g.strokeStyle = rgba(C.stormRim, 0.8);
    for (const [k, x] of [[0, W * 0.07], [1, W * 0.93]]) {
      const cy = yb - 10;
      g.beginPath();
      for (let a = 0; a < TAU * 1.6; a += 0.3) {
        const rad = 1.5 + a * 1.6;
        const px = x + Math.cos(a + k * Math.PI) * rad;
        const py = cy + Math.sin(a + k * Math.PI) * rad * 0.7;
        if (a === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.stroke();
    }
  }

  // a cloud of the kind drawn in prints: lobes over a flat underside, its top lit and its underside rimmed
  function kumo(g, x, y, w, h, C, seed, rim) {
    const R = rng(seed);
    const lobes = [];
    const n = Math.max(2, Math.round(w / (h * 0.8)));
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1);
      const r = h * (0.3 + 0.32 * Math.sin(Math.PI * k) + 0.1 * R());
      lobes.push([x + h * 0.4 + (w - h * 0.8) * k, y + h - r * 0.85 - h * 0.12, r]);
    }
    const shape = (dy) => {
      g.beginPath();
      rr(g, x, y + h * 0.5 + dy, w, h * 0.5, h * 0.25);
      for (const [cx, cy, r] of lobes) {
        g.moveTo(cx + r, cy + dy);
        g.arc(cx, cy + dy, r, 0, TAU);
      }
    };
    shape(-2.5);
    g.fillStyle = C.cloudHi;
    g.fill();
    shape(0);
    g.fillStyle = C.cloud;
    g.fill();
    if (rim === false) return;
    g.beginPath();
    g.moveTo(x + h * 0.3, y + h - 0.8);
    g.lineTo(x + w - h * 0.3, y + h - 0.8);
    g.lineWidth = 1.6;
    g.strokeStyle = rgba(C.cloudRim, 0.45);
    g.stroke();
  }

  // a ridge, its top furred with the tips of cedars, filled down to yBase
  function ridge(g, W, yTop, amp, yBase, fill, seed, tips) {
    g.beginPath();
    g.moveTo(-12, yBase);
    const step = 6;
    for (let x = -12; x <= W + 12; x += step) {
      const y = yTop + amp * (0.65 * noise(seed, x / 80) + 0.35 * noise(seed + 7, x / 26));
      if (tips) {
        g.lineTo(x - step / 2, y + 1);
        g.lineTo(x, y - tips * (0.7 + 0.6 * hash(seed, x)));
        g.lineTo(x + step / 2, y + 1);
      } else g.lineTo(x, y);
    }
    g.lineTo(W + 12, yBase);
    g.closePath();
    g.fillStyle = fill;
    g.fill();
  }

  // a band of mist (kasumi), its ends rounded
  function kasumi(g, x, y, w, h, color) {
    g.beginPath();
    rr(g, x, y, w, h, h / 2);
    g.fillStyle = color;
    g.fill();
  }

  // a cedar (sugi): tiers of needles from its top down to its trunk, each over the one below, lit from the upper left.
  // tone 0: far (lighter, no outline), 1: mid, 2: near (darker, outlined in ink)
  function cedar(g, x, base, h, w, C, tone, seed, snow) {
    const R = rng(seed);
    const fill = tone === 0 ? C.cedarFar : tone === 1 ? C.cedar : C.cedarNear;
    const hi = tone === 0 ? C.cedarFarHi : C.cedarHi;
    const line = tone === 0 ? '' : tone === 1 ? C.cedarLine : C.line;
    const lw = tone === 2 ? 2 : 1.5;
    const top = base - h;
    const foot = base - h * 0.17;
    // the trunk
    const tw = Math.max(2.5, w * 0.085);
    g.beginPath();
    g.moveTo(x - tw * 0.6, top + h * 0.35);
    g.lineTo(x - tw, base);
    g.lineTo(x + tw, base);
    g.lineTo(x + tw * 0.6, top + h * 0.35);
    g.closePath();
    g.fillStyle = tone === 0 ? C.trunkFar : C.trunk;
    g.fill();
    if (line) {
      g.save();
      g.clip();
      g.fillStyle = C.trunkHi;
      g.fillRect(x - tw - 1, top, tw * 0.75, h);
      g.restore();
      g.lineWidth = lw;
      g.strokeStyle = line;
      g.stroke();
    }
    // the tiers, the lowest first
    const n = 6 + Math.floor(R() * 3);
    const span = foot - top;
    for (let i = n - 1; i >= 0; i--) {
      const k = (i + 1) / n;
      const ty = top + span * (i / n) * 0.95;
      const th = (span / n) * 1.8;
      const hw = (w / 2) * (0.2 + 0.8 * Math.pow(k, 0.8)) * (0.9 + R() * 0.2);
      const ax = x + (R() - 0.5) * w * 0.05;
      const p = new Path2D();
      p.moveTo(ax, ty);
      p.quadraticCurveTo(x + hw * 0.5, ty + th * 0.42, x + hw, ty + th);
      const teeth = hw > 14 ? 4 : 3;
      for (let j = 1; j <= teeth; j++) {
        const xx = x + hw - (2 * hw * j) / teeth;
        const xm = x + hw - (2 * hw * (j - 0.5)) / teeth;
        p.quadraticCurveTo(xm, ty + th - 4 - R() * 3, xx, ty + th + (j < teeth ? R() * 2.5 : 0));
      }
      p.quadraticCurveTo(x - hw * 0.5, ty + th * 0.42, ax, ty);
      p.closePath();
      g.fillStyle = fill;
      g.fill(p);
      g.save();
      g.clip(p);
      g.beginPath();
      g.moveTo(ax - 1, ty - 2);
      g.lineTo(x - hw - 4, ty + th + 4);
      g.lineTo(x - hw * 0.12, ty + th + 4);
      g.closePath();
      g.fillStyle = hi;
      g.fill();
      if (snow) {
        g.beginPath();
        g.moveTo(ax, ty);
        g.quadraticCurveTo(x - hw * 0.5, ty + th * 0.42, x - hw, ty + th);
        g.lineWidth = 5;
        g.strokeStyle = C.snow;
        g.stroke();
      }
      if (C.rim && tone > 0) {
        g.beginPath();
        g.moveTo(ax, ty);
        g.quadraticCurveTo(x + hw * 0.5, ty + th * 0.42, x + hw, ty + th);
        g.lineWidth = 2.6;
        g.strokeStyle = rgba(C.rim, 0.55);
        g.stroke();
      }
      g.restore();
      if (line) {
        g.lineWidth = lw;
        g.strokeStyle = line;
        g.stroke(p);
      }
    }
  }

  // a torii (myōjin): two posts leaning in a little on black feet, the tie beam (nuki) through them, the plaque, and
  // the top beam, black over vermilion, sweeping up at its ends. u: its size (1 for posts 160 apart)
  function torii(g, cx, half, yK, yB, C, u, snow, rope) {
    const lw = clamp(1.7 * u, 1.6, 2.8);
    const L = C.line;
    const postTop = yK + 8 * u;
    for (const sd of [-1, 1]) {
      const xb = cx + sd * half;
      const xt = cx + sd * (half - 3.5 * u);
      const wb = 6 * u;
      const wt = 5 * u;
      const quad = (a, b) => {
        g.beginPath();
        g.moveTo(xt + wt * a, postTop);
        g.lineTo(xt + wt * b, postTop);
        g.lineTo(xb + wb * b, yB);
        g.lineTo(xb + wb * a, yB);
        g.closePath();
      };
      quad(-1, 1);
      g.fillStyle = C.torii;
      g.fill();
      quad(0.25, 1);
      g.fillStyle = C.toriiShade;
      g.fill();
      quad(-0.72, -0.42);
      g.fillStyle = C.toriiHi;
      g.fill();
      quad(-1, 1);
      g.lineWidth = lw;
      g.strokeStyle = L;
      g.stroke();
      if (C.rim) {
        g.beginPath();
        g.moveTo(xt + wt - lw, postTop + 6 * u);
        g.lineTo(xb + wb - lw, yB - 14 * u);
        g.lineWidth = 1.5 * u;
        g.strokeStyle = rgba(C.rim, 0.8);
        g.stroke();
      }
      // the black foot (nemaki), on its stone
      const fh = 14 * u;
      g.beginPath();
      rr(g, xb - wb - 1.5 * u, yB - fh, 2 * wb + 3 * u, fh, 1.5 * u);
      g.fillStyle = C.kasagi;
      g.fill();
      g.fillStyle = C.kasagiHi;
      g.fillRect(xb - wb, yB - fh + 2 * u, 2.4 * u, fh - 4 * u);
      g.lineWidth = lw;
      g.strokeStyle = L;
      g.stroke();
    }
    // the tie beam
    const ny = yK + 30 * u;
    const nh = 6.5 * u;
    const nx = half + 16 * u;
    g.fillStyle = C.torii;
    g.fillRect(cx - nx, ny, 2 * nx, nh);
    g.fillStyle = C.toriiShade;
    g.fillRect(cx - nx, ny + nh * 0.62, 2 * nx, nh * 0.38);
    g.fillStyle = C.toriiHi;
    g.fillRect(cx - nx, ny + nh * 0.14, 2 * nx, nh * 0.18);
    g.lineWidth = lw;
    g.strokeStyle = L;
    g.strokeRect(cx - nx, ny, 2 * nx, nh);
    // the strut, and the plaque with the shrine's name
    const sy = yK + 11 * u;
    g.fillStyle = C.torii;
    g.fillRect(cx - 3.5 * u, sy, 7 * u, ny - sy);
    g.strokeRect(cx - 3.5 * u, sy, 7 * u, ny - sy);
    const py = (sy + ny) / 2;
    g.beginPath();
    rr(g, cx - 6.5 * u, py - 8.5 * u, 13 * u, 17 * u, 1.5 * u);
    g.fillStyle = C.kasagi;
    g.fill();
    g.lineWidth = lw;
    g.strokeStyle = L;
    g.stroke();
    g.beginPath();
    rr(g, cx - 4.8 * u, py - 6.8 * u, 9.6 * u, 13.6 * u, 1 * u);
    g.lineWidth = Math.max(1, 0.9 * u);
    g.strokeStyle = C.gold;
    g.stroke();
    g.beginPath();
    g.moveTo(cx - 1.6 * u, py - 4.5 * u);
    g.lineTo(cx - 1.6 * u, py + 4.5 * u);
    g.moveTo(cx + 1.6 * u, py - 4.5 * u);
    g.lineTo(cx + 1.6 * u, py + 4.5 * u);
    g.lineWidth = Math.max(1, 1.2 * u);
    g.stroke();
    // the top beam: the vermilion under-beam (shimaki), then the black kasagi over it
    const K = half + 28 * u;
    const curve = (x0, x1, ym, ye) => {
      const yc = (4 * ym - ye) / 3;
      g.bezierCurveTo(x0 + (x1 - x0) * 0.3, yc, x0 + (x1 - x0) * 0.7, yc, x1, ye);
    };
    g.beginPath();
    g.moveTo(cx - K + 8 * u, yK + 0.5 * u);
    curve(cx - K + 8 * u, cx + K - 8 * u, yK + 6.5 * u, yK + 0.5 * u);
    g.lineTo(cx + K - 9 * u, yK + 5.5 * u);
    curve(cx + K - 9 * u, cx - K + 9 * u, yK + 12.5 * u, yK + 5.5 * u);
    g.closePath();
    g.fillStyle = C.torii;
    g.fill();
    g.save();
    g.clip();
    g.fillStyle = C.toriiShade;
    g.fillRect(cx - K, yK + 9.5 * u, 2 * K, 6 * u);
    g.restore();
    g.lineWidth = lw;
    g.strokeStyle = L;
    g.stroke();
    g.beginPath();
    g.moveTo(cx - K, yK - 9 * u);
    curve(cx - K, cx + K, yK, yK - 9 * u);
    g.lineTo(cx + K - 3 * u, yK - 1.5 * u);
    curve(cx + K - 3 * u, cx - K + 3 * u, yK + 6.5 * u, yK - 1.5 * u);
    g.closePath();
    g.fillStyle = C.kasagi;
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(cx - K + 4 * u, yK - 6.5 * u);
    curve(cx - K + 4 * u, cx + K - 4 * u, yK + 2.2 * u, yK - 6.5 * u);
    g.lineWidth = 1.4 * u;
    g.strokeStyle = C.kasagiHi;
    g.stroke();
    if (snow) {
      g.beginPath();
      g.moveTo(cx - K + 2 * u, yK - 9.5 * u);
      curve(cx - K + 2 * u, cx + K - 2 * u, yK - 0.6 * u, yK - 9.5 * u);
      g.lineWidth = 4 * u;
      g.strokeStyle = C.snow;
      g.stroke();
      g.fillStyle = C.snow;
      for (const sd of [-1, 1]) {
        g.beginPath();
        rr(g, cx + sd * nx - (sd > 0 ? 9 * u : 0), ny - 2.5 * u, 9 * u, 3 * u, 1.5 * u);
        g.fill();
      }
    }
    if (rope) {
      // a shimenawa under the tie beam, its paper hanging by the posts, clear of the middle
      const ry = ny + nh + 2.5 * u;
      const px = half - 4.5 * u;
      shimenawa(g, cx - px, ry, cx + px, ry, 3 * u, 4.6 * u, C);
      for (const sd of [-1, 1]) {
        shide(g, cx + sd * (px - 7 * u) - 5 * u, ry + 2.5 * u, 1.05 * u, C, 0);
        g.beginPath();
        for (let s = -2; s <= 2; s++) {
          const tx = cx + sd * (px - 17 * u) + s * 1.1 * u;
          g.moveTo(tx, ry + 2.5 * u);
          g.lineTo(tx + s * 0.3 * u, ry + 9 * u);
        }
        g.lineWidth = Math.max(1, 0.9 * u);
        g.strokeStyle = C.ropeShade;
        g.stroke();
      }
    }
  }

  // a stone lantern (kasuga dōrō) standing at (x, base): foot, post, table, light box, roof and jewel; s its size
  // (1: about 62 tall). Returns where its light is.
  function lantern(g, x, base, s, C, snow) {
    const lw = clamp(1.5 * s, 1.2, 2.4);
    const L = C.line;
    const block = (yTop, h, wTop, wBot) => {
      const wm = Math.max(wTop, wBot);
      g.beginPath();
      g.moveTo(x - wTop, yTop);
      g.lineTo(x + wTop, yTop);
      g.lineTo(x + wBot, yTop + h);
      g.lineTo(x - wBot, yTop + h);
      g.closePath();
      g.fillStyle = C.stone;
      g.fill();
      g.save();
      g.clip();
      g.fillStyle = C.stoneShade;
      g.fillRect(x + wm * 0.35, yTop - 1, wm * 2, h + 2);
      g.fillStyle = C.stoneHi;
      g.fillRect(x - wm - 1, yTop - 1, wm * 0.5, h + 2);
      g.restore();
      g.lineWidth = lw;
      g.strokeStyle = L;
      g.stroke();
    };
    block(base - 8 * s, 8 * s, 10 * s, 12 * s);
    block(base - 29 * s, 21 * s, 3.4 * s, 4.4 * s);
    block(base - 34 * s, 5 * s, 11 * s, 7.5 * s);
    block(base - 46 * s, 12 * s, 7.5 * s, 7.5 * s);
    // its window, lit
    g.fillStyle = C.lamp;
    g.fillRect(x - 4.6 * s, base - 44 * s, 9.2 * s, 8 * s);
    g.lineWidth = lw * 0.8;
    g.strokeStyle = L;
    g.strokeRect(x - 4.6 * s, base - 44 * s, 9.2 * s, 8 * s);
    g.beginPath();
    g.moveTo(x, base - 44 * s);
    g.lineTo(x, base - 36 * s);
    g.stroke();
    // the roof, its corners turned up
    g.beginPath();
    g.moveTo(x - 17 * s, base - 46.5 * s);
    g.quadraticCurveTo(x - 10 * s, base - 48 * s, x - 5 * s, base - 55 * s);
    g.lineTo(x + 5 * s, base - 55 * s);
    g.quadraticCurveTo(x + 10 * s, base - 48 * s, x + 17 * s, base - 46.5 * s);
    g.lineTo(x + 15.5 * s, base - 44.5 * s);
    g.lineTo(x - 15.5 * s, base - 44.5 * s);
    g.closePath();
    g.fillStyle = C.stone;
    g.fill();
    g.save();
    g.clip();
    g.fillStyle = C.stoneShade;
    g.fillRect(x + 3 * s, base - 56 * s, 16 * s, 12 * s);
    g.fillStyle = C.stoneHi;
    g.fillRect(x - 18 * s, base - 47.5 * s, 34 * s, 1.6 * s);
    g.restore();
    g.lineWidth = lw;
    g.strokeStyle = L;
    g.stroke();
    // the jewel on top
    g.beginPath();
    g.moveTo(x, base - 63 * s);
    g.quadraticCurveTo(x + 4.8 * s, base - 58 * s, x + 3.2 * s, base - 55 * s);
    g.lineTo(x - 3.2 * s, base - 55 * s);
    g.quadraticCurveTo(x - 4.8 * s, base - 58 * s, x, base - 63 * s);
    g.closePath();
    g.fillStyle = C.stone;
    g.fill();
    g.stroke();
    if (snow) {
      g.fillStyle = C.snow;
      g.beginPath();
      g.moveTo(x - 15 * s, base - 47.5 * s);
      g.quadraticCurveTo(x - 9 * s, base - 50 * s, x - 5 * s, base - 56.5 * s);
      g.lineTo(x + 5 * s, base - 56.5 * s);
      g.quadraticCurveTo(x + 9 * s, base - 50 * s, x + 15 * s, base - 47.5 * s);
      g.quadraticCurveTo(x, base - 51 * s, x - 15 * s, base - 47.5 * s);
      g.fill();
      g.beginPath();
      rr(g, x - 10 * s, base - 36 * s, 20 * s, 2.6 * s, 1.3 * s);
      g.fill();
    }
    return [x, base - 40 * s];
  }

  // a shide: paper cut and folded in a zigzag, hanging from (x, y); s its size
  function shide(g, x, y, s, C, sway) {
    const d = 3 * s;
    const h = 6 * s;
    g.save();
    g.translate(x, y);
    if (sway) g.rotate(sway);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(0, h);
    g.lineTo(0.8 * d, h);
    g.lineTo(0.8 * d, 2 * h);
    g.lineTo(1.6 * d, 2 * h);
    g.lineTo(1.6 * d, 3 * h);
    g.lineTo(2.4 * d, 3 * h);
    g.lineTo(2.4 * d, 4 * h);
    g.lineTo(3.4 * d, 4 * h);
    g.lineTo(3.4 * d, 3 * h);
    g.lineTo(2.6 * d, 3 * h);
    g.lineTo(2.6 * d, 2 * h);
    g.lineTo(1.8 * d, 2 * h);
    g.lineTo(1.8 * d, h);
    g.lineTo(d, h);
    g.lineTo(d, 0);
    g.closePath();
    g.fillStyle = C.paper;
    g.fill();
    g.lineWidth = Math.max(1, 0.9 * s);
    g.lineJoin = 'round';
    g.strokeStyle = C.line;
    g.stroke();
    g.restore();
  }

  // a shimenawa: a thick straw rope, twisted, from (x0, y0) to (x1, y1), its middle sagging by sag; t its thickness
  function shimenawa(g, x0, y0, x1, y1, sag, t, C) {
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2 + sag * 2;
    g.beginPath();
    g.moveTo(x0, y0);
    g.quadraticCurveTo(mx, my, x1, y1);
    g.lineCap = 'round';
    g.lineWidth = t + 2.6;
    g.strokeStyle = C.ropeLine;
    g.stroke();
    g.lineWidth = t;
    g.strokeStyle = C.rope;
    g.stroke();
    const n = Math.max(3, Math.round(Math.hypot(x1 - x0, y1 - y0) / (t * 0.8)));
    g.beginPath();
    for (let i = 1; i < n; i++) {
      const k = i / n;
      const px = (1 - k) * (1 - k) * x0 + 2 * (1 - k) * k * mx + k * k * x1;
      const py = (1 - k) * (1 - k) * y0 + 2 * (1 - k) * k * my + k * k * y1;
      g.moveTo(px - t * 0.22, py - t * 0.42);
      g.lineTo(px + t * 0.22, py + t * 0.42);
    }
    g.lineWidth = Math.max(1, t * 0.2);
    g.strokeStyle = C.ropeShade;
    g.stroke();
  }

  // the shrine's tree for the season: cherry in spring, maple in summer and autumn, bare and snowy in winter
  function seasonTree(g, x, base, h, C, season, dark, seed) {
    const R = rng(seed);
    const col = SEASONS[season][dark ? 'dark' : 'light'];
    const L = C.line;
    // trunk and boughs, leaning out over the court
    g.beginPath();
    g.moveTo(x - 5, base);
    g.quadraticCurveTo(x - 4, base - h * 0.4, x - 16, base - h * 0.72);
    g.lineTo(x - 11, base - h * 0.74);
    g.quadraticCurveTo(x + 1, base - h * 0.45, x + 3, base - h * 0.55);
    g.quadraticCurveTo(x + 8, base - h * 0.75, x + 20, base - h * 0.86);
    g.lineTo(x + 22, base - h * 0.82);
    g.quadraticCurveTo(x + 9, base - h * 0.6, x + 6, base);
    g.closePath();
    g.fillStyle = dark ? '#2A1712' : '#5A2E22';
    g.fill();
    g.lineWidth = 1.8;
    g.strokeStyle = L;
    g.stroke();
    if (season === 'winter') {
      g.beginPath();
      g.moveTo(x - 15, base - h * 0.73);
      g.lineTo(x - 30, base - h * 0.84);
      g.moveTo(x - 6, base - h * 0.6);
      g.lineTo(x - 24, base - h * 0.62);
      g.moveTo(x + 20, base - h * 0.85);
      g.lineTo(x + 34, base - h * 0.95);
      g.moveTo(x + 12, base - h * 0.7);
      g.lineTo(x + 30, base - h * 0.7);
      g.lineWidth = 2.4;
      g.strokeStyle = dark ? '#2A1712' : '#5A2E22';
      g.stroke();
      g.beginPath();
      g.moveTo(x - 15, base - h * 0.75);
      g.lineTo(x - 30, base - h * 0.86);
      g.moveTo(x + 20, base - h * 0.87);
      g.lineTo(x + 34, base - h * 0.97);
      g.moveTo(x - 6, base - h * 0.62);
      g.lineTo(x - 24, base - h * 0.64);
      g.lineWidth = 2;
      g.strokeStyle = C.snow;
      g.stroke();
      return;
    }
    // the crown: clumps over each other, each lit at its upper left and outlined, the way prints draw leaves
    const clumps = [];
    const cw = h * 0.62;
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI;
      const rad = h * (0.12 + 0.06 * R());
      clumps.push([x + 3 + Math.cos(Math.PI - a) * cw * (0.55 + 0.3 * R()), base - h * 0.78 - Math.sin(a) * h * (0.16 + 0.12 * R()), rad]);
    }
    clumps.push([x + 2, base - h * 0.84, h * 0.17], [x - cw * 0.3, base - h * 0.72, h * 0.13], [x + cw * 0.35, base - h * 0.74, h * 0.14]);
    clumps.sort((a, b) => a[1] - b[1]);
    for (const [cx, cy, r] of clumps) {
      g.save();
      g.beginPath();
      g.arc(cx, cy, r, 0, TAU);
      g.clip();
      g.fillStyle = col[1];
      g.fillRect(cx - r, cy - r, 2 * r, 2 * r);
      g.beginPath();
      g.arc(cx + r * 0.22, cy + r * 0.26, r, 0, TAU);
      g.fillStyle = col[0];
      g.fill();
      g.restore();
      g.beginPath();
      g.arc(cx, cy, r, 0, TAU);
      g.lineWidth = 1.5;
      g.strokeStyle = col[2];
      g.stroke();
    }
    // blossoms or leaves picked out
    g.fillStyle = col[1];
    for (let i = 0; i < 18; i++) {
      const cl = clumps[Math.floor(R() * clumps.length)];
      g.beginPath();
      g.arc(cl[0] + (R() - 0.5) * cl[2], cl[1] + (R() - 0.5) * cl[2], 1.2 + R() * 1.2, 0, TAU);
      g.fill();
    }
  }

  // flagstones from y0 down to y1, the rows deeper further down, lit at their top edges
  function paving(g, x0, x1, y0, y1, C, seed) {
    const R = rng(seed);
    g.fillStyle = C.ground;
    g.fillRect(x0, y0, x1 - x0, y1 - y0);
    let y = y0;
    let h = 7;
    g.lineWidth = 1.5;
    g.strokeStyle = C.joint;
    while (y < y1) {
      const sw = h * 2.6 + 8;
      g.fillStyle = C.groundHi;
      g.fillRect(x0, y + 1.2, x1 - x0, Math.max(1.4, h * 0.14));
      g.beginPath();
      g.moveTo(x0, y);
      g.lineTo(x1, y);
      let x = x0 - R() * sw;
      while (x < x1) {
        g.moveTo(x, y);
        g.lineTo(x, y + h);
        x += sw * (0.8 + R() * 0.4);
      }
      g.stroke();
      y += h;
      h *= 1.45;
    }
  }

  // a puddle: the sky in it, a streak of the torii's red, a glint
  function puddle(g, x, y, w, h, C, red) {
    g.beginPath();
    g.ellipse(x, y, w, h, 0, 0, TAU);
    g.fillStyle = C.puddle;
    g.fill();
    g.save();
    g.clip();
    if (red) {
      g.fillStyle = rgba(C.torii, 0.8);
      g.fillRect(x + red - 3, y - h, 6, 2 * h);
    }
    g.fillStyle = C.puddleHi;
    g.fillRect(x - w * 0.6, y - h * 0.5, w * 0.7, Math.max(1.2, h * 0.28));
    g.restore();
    g.lineWidth = 1.4;
    g.strokeStyle = C.joint;
    g.stroke();
  }

  // ---------- Falling: through the torii, under the storm ----------

  function fallGeo(o) {
    const W = o.W;
    const H = o.H;
    const gy = o.ground;
    const cx = W / 2;
    const half = Math.min(W * 0.36, 122);
    return {
      W, H, gy, cx, half, u: half / 80,
      yK: clamp(gy * 0.24, 60, 170),
      hz: gy - clamp(gy * 0.12, 26, 64),
      yb: clamp(gy * 0.16, 44, 116),
    };
  }
  // the moon (and the lightning, by day) seen through the gate, on its right, under the tie beam
  function moonAt(G) {
    const under = G.yK + 37 * G.u;
    return [G.cx + G.half * 0.7, under + clamp((G.hz - under) * 0.22, 18, 60), clamp(G.W * 0.055, 12, 22)];
  }

  function paintFallSky(g, G, C, P, dark) {
    const { W, gy, hz, cx, half } = G;
    g.fillStyle = bands(g, 0, hz + 6, mixAll(C.sky, C.eve, P));
    g.fillRect(0, 0, W, hz + 8);
    // the light low under the storm
    const r = Math.max(W * 0.75, 200);
    const gl = g.createRadialGradient(cx, hz, 0, cx, hz, r);
    gl.addColorStop(0, rgba(C.halo, dark ? 0.35 : 0.6));
    gl.addColorStop(1, rgba(C.halo, 0));
    g.fillStyle = gl;
    g.fillRect(0, hz - r, W, r + 6);
    // bands of mist across the sky, printed flat
    kasumi(g, -20, hz - (hz - G.yb) * 0.42, W * 0.3 + 20, 7, rgba(C.mist, 0.16));
    kasumi(g, W * 0.72, hz - (hz - G.yb) * 0.3, W * 0.3, 6, rgba(C.mist, 0.14));
    if (dark) {
      // stars in the gaps of the storm, and the moon behind its lobes, with its halo
      const R = rng(41);
      g.fillStyle = C.star;
      for (let k = 0; k < 26; k++) {
        const x = R() * W;
        const y = G.yb + R() * (hz - G.yb - 40);
        if (Math.abs(x - cx) < half * 0.5 && R() < 0.7) continue;
        g.globalAlpha = 0.35 + 0.5 * R();
        g.beginPath();
        g.arc(x, y, 0.5 + R() * 0.9, 0, TAU);
        g.fill();
      }
      g.globalAlpha = 1;
      const [mx, my, mr] = moonAt(G);
      const h = g.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 4.2);
      h.addColorStop(0, rgba(C.halo, 0.5));
      h.addColorStop(1, rgba(C.halo, 0));
      g.fillStyle = h;
      g.fillRect(mx - mr * 4.2, my - mr * 4.2, mr * 8.4, mr * 8.4);
      g.beginPath();
      g.arc(mx, my, mr, 0, TAU);
      g.fillStyle = C.sun;
      g.fill();
      g.beginPath();
      g.arc(mx - mr * 0.3, my + mr * 0.15, mr * 0.22, 0, TAU);
      g.arc(mx + mr * 0.25, my - mr * 0.3, mr * 0.14, 0, TAU);
      g.fillStyle = 'rgba(170,180,220,0.35)';
      g.fill();
    }
  }

  function paintFallScene(g, G, C, season, dark) {
    const { W, H, gy, cx, half, u, yK, hz, yb } = G;
    const snow = season === 'winter';
    stormBank(g, W, yb, C, 17);
    // far ridges and the mist at their feet
    ridge(g, W, hz - 70, 30, hz + 6, C.far, 3, 4);
    ridge(g, W, hz - 40, 18, hz + 6, C.far2, 9, 3);
    kasumi(g, -30, hz - 24, W * 0.62, 10, rgba(C.mist, 0.75));
    kasumi(g, W * 0.42, hz - 14, W * 0.7, 9, rgba(C.mist, 0.6));
    // the court beyond the gate, and the path across it to the hall out of sight
    g.fillStyle = C.court;
    g.fillRect(-4, hz, W + 8, gy - hz + 4);
    const R = rng(23);
    g.fillStyle = C.gravel;
    for (let k = 0; k < 140; k++) {
      const y = hz + Math.pow(R(), 1.6) * (gy - hz);
      g.fillRect(R() * W, y, 1.2, 1.2);
    }
    const nh = Math.min(W * 0.28, 92);
    const fh = nh * 0.18;
    g.beginPath();
    g.moveTo(cx - fh, hz);
    g.lineTo(cx + fh, hz);
    g.lineTo(cx + nh, gy + 4);
    g.lineTo(cx - nh, gy + 4);
    g.closePath();
    g.fillStyle = C.path;
    g.fill();
    g.save();
    g.clip();
    g.beginPath();
    for (let k = 1; k < 8; k++) {
      const y = hz + (gy - hz) * Math.pow(k / 8, 1.5);
      g.moveTo(cx - nh * 1.2, y);
      g.lineTo(cx + nh * 1.2, y);
    }
    g.lineWidth = 1;
    g.strokeStyle = C.pathLine;
    g.stroke();
    g.restore();
    puddle(g, cx - nh * 1.25, hz + (gy - hz) * 0.62, 16 * u, 2.6 * u, C, 0);
    puddle(g, cx + nh * 1.35, hz + (gy - hz) * 0.42, 12 * u, 2 * u, C, 0);
    // cedars far off along the court, then the groves either side of the gate: taller on the left, where the sacred
    // cedar stands with its rope; lower on the right, leaving the sky open for the moon and the lightning
    const far = [];
    for (let x = cx - half * 0.55; x > -30; x -= 18 * u) far.push(x);
    for (let x = cx + half * 0.55; x < W + 30; x += 18 * u) far.push(x);
    far.forEach((x, i) => cedar(g, x, hz + 8, (60 + 40 * hash(i, 2)) * u, 26 * u, C, 0, 60 + i, snow));
    const tw = 44 * u;
    const right = [];
    for (let x = cx + half + 10 * u, i = 0; x < W + tw; x += tw * 0.62, i++) right.push([x, i]);
    for (const [x, i] of right.reverse()) cedar(g, x, gy + 2, gy * (0.5 + 0.16 * hash(i, 5)), tw, C, 1, 80 + i, snow);
    const left = [];
    for (let x = cx - half - 12 * u, i = 0; x > -tw; x -= tw * 0.6, i++) left.push([x, i]);
    for (const [x, i] of left.reverse()) {
      const h = i === 0 ? gy + 40 : gy * (0.78 + 0.2 * hash(i, 7));
      cedar(g, x, gy + 2, h, i === 0 ? tw * 1.25 : tw, C, 1, 100 + i, snow);
    }
    // the tree of the season, beyond the right post, its crown kept out of the middle
    const th = clamp(gy * 0.42, 100, 230);
    seasonTree(g, Math.max(cx + half + 14 * u, cx + half * 0.78 + th * 0.55), gy + 2, th, C, season, dark, 31);
    // the great torii, with its rope
    torii(g, cx, half, yK, gy + 2, C, u, snow, true);
    // stone lanterns in front, either side
    const lx = Math.min(half + 34 * u, W / 2 - 4);
    lantern(g, cx - lx, gy + 30, 1.25 * u, C, snow);
    lantern(g, cx + lx, gy + 30, 1.25 * u, C, snow);
    // the near ground: flagstones and puddles, under the dock
    paving(g, -4, W + 4, gy + 4, H + 4, C, 5);
    puddle(g, cx - half * 0.62, gy + 22, 22 * u, 4 * u, C, -6 * u);
    puddle(g, cx + half * 0.7, gy + 40, 26 * u, 5 * u, C, 8 * u);
    if (snow) {
      g.fillStyle = rgba(C.snow, 0.9);
      g.beginPath();
      for (let k = 0; k < 7; k++) {
        const x = (k + 0.5) * (W / 7) + (hash(k, 3) - 0.5) * 20;
        g.ellipse(x, gy + 8 + 30 * hash(k, 4), 16 + 10 * hash(k, 5), 3 + 2 * hash(k, 6), 0, 0, TAU);
      }
      g.fill();
    }
    return { lights: [[cx - lx, gy + 30 - 40 * 1.25 * u], [cx + lx, gy + 30 - 40 * 1.25 * u]] };
  }

  // lightning, now and then: the sky lit, a glow in the storm where it strikes, and the bolt. Returns how bright.
  function lightning(ctx, sc, t, x0, x1, yTop, yBottom, W, C) {
    const per = 7.3;
    const k = Math.floor(t / per);
    const ph = t - k * per;
    const a = ph < 0.08 ? 1 : ph < 0.15 ? 0.2 : ph < 0.25 ? 0.8 : ph < 0.55 ? (0.8 * (0.55 - ph)) / 0.3 : 0;
    if (a <= 0.01) return 0;
    ctx.fillStyle = rgba(C.flash, 0.14 * a);
    ctx.fillRect(0, 0, W, yBottom + 40);
    const bx = x0 + (x1 - x0) * hash(k, 9);
    putGlow(ctx, sc, C.boltGlow, 60, bx, yTop, 0.7 * a);
    if (a > 0.3) {
      const R = rng(300 + k);
      ctx.beginPath();
      let x = bx;
      let y = yTop;
      ctx.moveTo(x, y);
      const fork = [];
      while (y < yBottom) {
        y += 7 + R() * 10;
        x += (R() - 0.45) * 13;
        ctx.lineTo(x, y);
        if (R() < 0.18) fork.push([x, y]);
      }
      for (const [fx, fy] of fork.slice(0, 2)) {
        ctx.moveTo(fx, fy);
        ctx.lineTo(fx + 10 + R() * 8, fy + 12 + R() * 8);
        ctx.lineTo(fx + 8 + R() * 10, fy + 24 + R() * 8);
      }
      ctx.lineJoin = 'miter';
      ctx.lineWidth = 6;
      ctx.strokeStyle = rgba(C.boltGlow, 0.35 * a);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = rgba(C.bolt, a);
      ctx.stroke();
    }
    return a;
  }

  // the rain, slanting down from the left
  function rain(ctx, W, y0, y1, t, n, C, seed) {
    if (n <= 0) return;
    const slant = 0.28;
    const span = y1 - y0;
    ctx.beginPath();
    for (let k = 0; k < n; k++) {
      const sp = 300 + 140 * hash(seed, k);
      const len = 9 + 10 * hash(seed + 1, k);
      const y = y0 + wrap(hash(seed + 2, k) * span + t * sp, span + len) - len;
      const x = wrap(hash(seed + 3, k) * (W + 40) + (y - y0) * slant, W + 40) - 20;
      ctx.moveTo(x, y);
      ctx.lineTo(x + len * slant, y + len);
    }
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    ctx.strokeStyle = C.rain;
    ctx.stroke();
  }

  // small hail coming down behind the big hailstones, mostly at the sides
  function pellets(ctx, W, y0, y1, t, n, C, seed) {
    if (n <= 0) return;
    const span = y1 - y0;
    const cx = W / 2;
    ctx.beginPath();
    for (let k = 0; k < n; k++) {
      const sp = 140 + 70 * hash(seed, k);
      const y = y0 + wrap(hash(seed + 2, k) * span + t * sp, span);
      const h = hash(seed + 3, k);
      const side = W / 2 - 58;
      let x = k % 3 ? (h < 0.5 ? h * 2 * side : cx + 58 + (h - 0.5) * 2 * side) : h * W;
      x = wrap(x + (y - y0) * 0.2, W);
      const r = 1 + hash(seed + 4, k) * 1.1;
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, TAU);
    }
    ctx.fillStyle = C.pellet;
    ctx.fill();
  }

  // what the wind carries in the season: cherry petals, green leaves, maple leaves, snow
  const MAPLE = (() => {
    const p = new Path2D();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * TAU;
      const r = i % 2 ? 1.6 : 4.2;
      if (i === 0) p.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else p.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    p.closePath();
    return p;
  })();
  function bits(ctx, W, y0, y1, t, season, n, seed) {
    const col = SEASONS[season].bits;
    const span = y1 - y0;
    const at = (k) => {
      const fall = season === 'winter' ? 24 + 16 * hash(seed, k) : 34 + 26 * hash(seed, k);
      const y = y0 + wrap(hash(seed + 1, k) * span + t * fall, span + 20) - 10;
      const x = wrap(hash(seed + 2, k) * W + t * (20 + 16 * hash(seed + 3, k)) + Math.sin(t * 1.6 + k * 2) * 9, W + 20) - 10;
      return [x, y, t * (1.4 + 2 * hash(seed + 4, k)) + k];
    };
    if (season === 'autumn') {
      for (let k = 0; k < n; k++) {
        const [x, y, a] = at(k);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a);
        ctx.scale(1, 0.55 + 0.45 * Math.abs(Math.cos(a * 0.7)));
        ctx.fillStyle = col[k % 2];
        ctx.fill(MAPLE);
        ctx.restore();
      }
      return;
    }
    for (let c = 0; c < 2; c++) {
      ctx.beginPath();
      for (let k = c; k < n; k += 2) {
        const [x, y, a] = at(k);
        if (season === 'winter') {
          const r = 1.3 + 1.2 * hash(seed + 5, k);
          ctx.moveTo(x + r, y);
          ctx.arc(x, y, r, 0, TAU);
        } else {
          const rx = season === 'spring' ? 3.2 : 4;
          ctx.moveTo(x + rx, y);
          ctx.ellipse(x, y, rx, (season === 'spring' ? 1.9 : 1.7) * (0.4 + 0.6 * Math.abs(Math.cos(a))), a, 0, TAU);
        }
      }
      ctx.fillStyle = col[c];
      ctx.fill();
    }
  }

  // the lanterns' light: warm and breathing at night, faint by day
  function lights(ctx, sc, list, t, still, dark, C, r) {
    for (let i = 0; i < list.length; i++) {
      const [x, y] = list[i];
      const f = still ? 0 : 0.08 * Math.sin(t * 7.3 + i * 2.1) + 0.06 * Math.sin(t * 12.7 + i);
      putGlow(ctx, sc, C.lampGlow, dark ? r : r * 0.6, x, y, (dark ? 0.8 : 0.4) + f);
    }
  }

  const jinja = {
    fall(ctx, o, C) {
      frame++;
      modeIs('fall' + (o.dark ? 1 : 0));
      drawn();
      const G = fallGeo(o);
      const { W, gy, cx, half, yb, hz } = G;
      const sc = devScale(ctx);
      const dark = !!o.dark;
      const still = !!o.still;
      const t = still ? 0 : o.t || 0;
      const season = seasonOf(o);
      const key = W.toFixed(1) + ',' + G.H.toFixed(1) + ',' + gy.toFixed(1) + ',' + (dark ? 1 : 0);
      // the sky as the round begins, and towards evening as it goes on: two pictures, the second over the first
      // as the round goes, so the sky moves on smoothly and is never painted again
      const P = clamp(o.progress || 0, 0, 1);
      const sky0 = pic('fsky0,' + key, W, hz + 8, sc, (g) => paintFallSky(g, G, C, 0, dark));
      const sky1 = pic('fsky1,' + key, W, hz + 8, sc, (g) => paintFallSky(g, G, C, 1, dark));
      if (!sky1.warm) {
        // shown once from the start, a pixel of it under the first sky, so that it is ready when it is needed
        sky1.warm = true;
        ctx.drawImage(sky1.c, 0, 0, 1, 1, 0, 0, 1, 1);
      }
      if (P < 1) put(ctx, sky0, 0, 0);
      if (P > 0) {
        ctx.globalAlpha = P;
        put(ctx, sky1, 0, 0);
        ctx.globalAlpha = 1;
      }
      // clouds drifting under the storm
      const band = Math.max(30, hz - yb - 90);
      for (let i = 0; i < 3; i++) {
        const w = (64 + 18 * i) * Math.min(1.4, G.u);
        const h = w * 0.26;
        const p = pic('kumo' + i + (dark ? 1 : 0), w + 4, h + 6, sc, (g) => kumo(g, 2, 4, w, h, C, 50 + i, false));
        const x = wrap(i * W * 0.41 + t * (5 + 2 * i), W + w + 60) - w - 30;
        put(ctx, p, x, yb + 18 + band * [0.1, 0.55, 0.3][i]);
      }
      // the lightning's glow is made from the start, not at the first flash
      glow(sc, C.boltGlow, 60);
      if (!still) lightning(ctx, sc, t, cx + half * 0.45, cx + half * 0.95, yb + 4, hz - 30, W, C);
      let scene = null;
      const sp = pic('fscene,' + key + ',' + season, W, G.H, sc, (g) => {
        scene = paintFallScene(g, G, C, season, dark);
      });
      put(ctx, sp, 0, 0);
      if (scene) sp.lights = scene.lights;
      lights(ctx, sc, sp.lights || [], t, still, dark, C, 30 * G.u);
      if (!still) {
        rain(ctx, W, yb, gy + 20, t, 34 + Math.round(10 * P), C, 11);
        pellets(ctx, W, yb, gy, t, 12 + Math.round(10 * P), C, 21);
        bits(ctx, W, yb, gy + 30, t, season, 8, 31);
      }
    },
  };

  // ---------- Climb: up the steps, out of the storm ----------

  // The steps go up the middle along a ridge, kerbed in stone, a narrow bank of hedges either side where the cedars,
  // the lanterns and the torii's posts stand. The posts stand wide of where Yaoki stands on any ledge (the ledges spread
  // with the width, at 0.34 to 0.66 of it, and he is about 48 wide).
  const KERB = 6;
  const BANK = 24;
  function stairGeo(W) {
    const post = Math.max(W * 0.16 + 40, 71);
    return { post, sw: 2 * (post - 16 - KERB), outer: post + 8 };
  }
  function climbGeo(o) {
    const W = o.W;
    const H = o.H;
    const ground = o.ground || H - 122;
    const y0s = 14 - ground;
    const climbed = Math.max(0, y0s - o.y0);
    const span = Math.max(1, -o.top - 40);
    return Object.assign(stairGeo(W), {
      W, H, cx: W / 2, y0: o.y0, top: o.top, climbed, up: clamp(climbed / span, 0, 1),
      yb: clamp(H * 0.12, 40, 110), ground,
    });
  }

  const TORII_GAP = 480;
  const TILE = 200;
  // the steps and their banks, a tile that repeats up the hill: each step lit at its nose and quiet otherwise, so the
  // signs stand out over them; on the banks, a hedge of bushes, flowering in its season
  const FLOWERS = { spring: ['#F48DB3', '#FFD0E2'], summer: ['#6F86E8', '#B9C6FF'], autumn: ['#E8452B', '#F5A93A'], winter: null };
  function bush(g, x, y, r, C, season) {
    g.save();
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.clip();
    g.fillStyle = C.cedarHi;
    g.fillRect(x - r, y - r, 2 * r, 2 * r);
    g.beginPath();
    g.arc(x + r * 0.25, y + r * 0.3, r, 0, TAU);
    g.fillStyle = C.cedar;
    g.fill();
    if (season === 'winter') {
      g.fillStyle = C.snow;
      g.beginPath();
      g.ellipse(x - r * 0.15, y - r * 0.8, r * 0.9, r * 0.42, 0, 0, TAU);
      g.fill();
    }
    g.restore();
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.lineWidth = 1.4;
    g.strokeStyle = C.cedarLine;
    g.stroke();
    if (C.rim) {
      g.beginPath();
      g.arc(x, y, r - 1.2, -1.3, -0.1);
      g.lineWidth = 1.2;
      g.strokeStyle = rgba(C.rim, 0.5);
      g.stroke();
    }
  }
  function blossoms(g, x, y, r, season, dark, R) {
    const f = FLOWERS[season];
    if (!f) return;
    const a = dark ? mix(f[0], '#0F2D36', 0.35) : f[0];
    const b = dark ? mix(f[1], '#0F2D36', 0.35) : f[1];
    if (season === 'summer') {
      // a hydrangea's head
      const hx = x + (R() - 0.5) * r * 0.6;
      const hy = y - r * 0.2;
      g.beginPath();
      g.arc(hx, hy, r * 0.48, 0, TAU);
      g.fillStyle = a;
      g.fill();
      g.lineWidth = 1;
      g.strokeStyle = 'rgba(20,30,70,0.6)';
      g.stroke();
      g.fillStyle = b;
      for (let i = 0; i < 4; i++) {
        g.beginPath();
        g.arc(hx + Math.cos(i * 1.7) * r * 0.22, hy + Math.sin(i * 1.7) * r * 0.22, 1.2, 0, TAU);
        g.fill();
      }
      return;
    }
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.arc(x + (R() - 0.5) * r * 1.3, y + (R() - 0.6) * r * 1.1, 1.4 + R(), 0, TAU);
      g.fillStyle = i % 2 ? b : a;
      g.fill();
    }
  }
  function paintStair(g, w, h, C, season, dark) {
    const R = rng(77);
    const cx = w / 2;
    const sw = w - 2 * (BANK + KERB);
    const x0 = cx - sw / 2;
    for (const sd of [-1, 1]) {
      const inner = cx + sd * (sw / 2 + KERB);
      // the ground under the hedge, then its bushes, the higher behind the lower
      g.fillStyle = C.cedarNear;
      g.fillRect(sd < 0 ? inner - BANK + 6 : inner, 0, BANK - 6, h);
      const clumps = [];
      for (let y = 4; y < h; y += 12) {
        clumps.push([inner + sd * (6 + R() * (BANK - 14)), y + (R() - 0.5) * 6, 7.5 + R() * 5, R() < 0.3]);
        if (R() < 0.55) clumps.push([inner + sd * (BANK - 5 + R() * 4), y + 6 + (R() - 0.5) * 4, 5.5 + R() * 4, false]);
      }
      const all = [];
      for (const c of clumps) all.push(c, [c[0], c[1] - h, c[2], c[3]], [c[0], c[1] + h, c[2], c[3]]);
      all.sort((a, b) => a[1] - b[1]);
      const F = rng(99);
      for (const [x, y, r, flower] of all) {
        if (y + r < -2 || y - r > h + 2) continue;
        bush(g, x, y, r, C, season);
        if (flower) blossoms(g, x, y, r, season, dark, F);
      }
    }
    // the steps
    g.fillStyle = C.step;
    g.fillRect(x0, 0, sw, h);
    const lighter = mix(C.step, C.stepHi, 0.28);
    const darker = mix(C.step, C.stepShade, 0.3);
    for (let y = 0; y < h; y += 20) {
      // the stones of each step, a few a shade lighter or darker, as cut stone is
      const joints = [];
      for (let x = x0 + 10 + R() * 20; x < x0 + sw - 8; x += 24 + R() * 18) joints.push(x);
      let a = x0;
      for (const x of joints.concat([x0 + sw])) {
        const k = R();
        if (k < 0.2 || k > 0.82) {
          g.fillStyle = k < 0.2 ? lighter : darker;
          g.fillRect(a, y + 4.4, x - a, 15.6);
        }
        a = x;
      }
      g.fillStyle = C.stepHi;
      g.fillRect(x0, y, sw, 1.8);
      g.fillStyle = C.stepShade;
      g.fillRect(x0, y + 1.8, sw, 2.6);
      g.beginPath();
      for (const x of joints) {
        g.moveTo(x, y + 4.4);
        g.lineTo(x, y + 20);
      }
      g.lineWidth = 0.9;
      g.strokeStyle = C.stepShade;
      g.stroke();
      if (season === 'winter') {
        g.fillStyle = rgba(C.snow, 0.8);
        g.fillRect(x0, y - 0.6, sw, 2.2);
      }
    }
    // the kerbs, in blocks, moss in their joints
    for (const x of [x0 - KERB, x0 + sw]) {
      g.fillStyle = C.stone;
      g.fillRect(x, 0, KERB, h);
      g.fillStyle = C.stoneHi;
      g.fillRect(x + 1, 0, 1.6, h);
      g.fillStyle = C.stoneShade;
      g.fillRect(x + KERB - 1.8, 0, 1.8, h);
      g.beginPath();
      g.moveTo(x + 0.6, 0);
      g.lineTo(x + 0.6, h);
      g.moveTo(x + KERB - 0.6, 0);
      g.lineTo(x + KERB - 0.6, h);
      for (let y = 18; y < h; y += 46) {
        g.moveTo(x, y);
        g.lineTo(x + KERB, y);
      }
      g.lineWidth = 1.3;
      g.strokeStyle = C.line;
      g.stroke();
      g.fillStyle = C.moss;
      for (let y = 18; y < h; y += 46) {
        g.beginPath();
        g.ellipse(x + KERB / 2, y - 1, 3.6, 1.8, 0, 0, TAU);
        g.fill();
      }
    }
  }

  // The torii of the climb, as pictures: the one at the foot of the steps stands on the forecourt; the others frame a
  // ledge (see ledge), their beams behind its sign as if the sign were the gate's plaque, their posts' feet in the
  // hedges beside the steps. yK: where the top beam is in the picture.
  function gatePic(sc, W, C, dark, snow, kind) {
    const { post } = stairGeo(W);
    const u = clamp(post / 80, 0.9, 1.5);
    const yK = 9 * u + 3;
    const tall = kind === 'entrance' ? 134 : 118;
    const p = pic('gate' + kind + (dark ? 1 : 0) + (snow ? 1 : 0), W, yK + tall + 8, sc, (g) => {
      torii(g, W / 2, post, yK, yK + tall, C, u, snow, kind === 'entrance');
      if (kind !== 'entrance') {
        // the posts' feet in the hedge
        for (const sd of [-1, 1]) {
          const x = W / 2 + sd * post;
          bush(g, x - 8 * u, yK + tall - 1, 8 * u, C, snow ? 'winter' : '');
          bush(g, x + 7 * u, yK + tall + 1, 7 * u, C, snow ? 'winter' : '');
        }
      }
    });
    p.yK = yK;
    return p;
  }

  // a cedar bough reaching in from the edge of the view, the nearest thing: dark, outlined, lit at its top
  function bough(g, w, h, C, seed, flip, snow) {
    const R = rng(seed);
    g.save();
    if (flip) {
      g.translate(w, 0);
      g.scale(-1, 1);
    }
    g.beginPath();
    g.moveTo(-4, h * 0.56);
    g.quadraticCurveTo(w * 0.5, h * 0.5, w * 0.92, h * 0.6);
    g.lineWidth = 3.4;
    g.strokeStyle = C.line;
    g.stroke();
    g.lineWidth = 2;
    g.strokeStyle = C.trunk;
    g.stroke();
    for (let i = 0; i < 5; i++) {
      const k = i / 4;
      const x = w * (0.1 + 0.78 * k);
      const y = h * (0.54 + 0.06 * k) + (R() - 0.5) * 3;
      const sw2 = w * (0.2 - 0.06 * k) + 6;
      const sh = h * (0.4 - 0.14 * k);
      const p = new Path2D();
      p.moveTo(x - sw2, y + 1);
      p.quadraticCurveTo(x - sw2 * 0.3, y - sh, x + sw2 * 0.8, y - sh * 0.3);
      p.lineTo(x + sw2, y + 1);
      for (let j = 1; j <= 4; j++) {
        const xx = x + sw2 - (2 * sw2 * j) / 4;
        p.quadraticCurveTo(xx + sw2 * 0.25, y - 2, xx, y + 3 + R() * 3);
      }
      p.closePath();
      g.fillStyle = C.cedarNear;
      g.fill(p);
      g.save();
      g.clip(p);
      g.fillStyle = C.cedarHi;
      g.fillRect(x - sw2, y - sh - 2, sw2 * 1.2, sh * 0.6);
      if (snow) {
        g.fillStyle = C.snow;
        g.fillRect(x - sw2, y - sh - 2, sw2 * 2, sh * 0.32);
      }
      g.restore();
      g.lineWidth = 1.8;
      g.strokeStyle = C.line;
      g.stroke(p);
    }
    g.restore();
  }

  Object.assign(jinja, {
    climb(ctx, o, C) {
      frame++;
      modeIs('climb' + (o.dark ? 1 : 0));
      drawn();
      const G = climbGeo(o);
      const { W, H, cx, sw, post, y0, top, up, yb, climbed } = G;
      const sc = devScale(ctx);
      const dark = !!o.dark;
      const still = !!o.still;
      const t = still ? 0 : o.t || 0;
      const season = seasonOf(o);
      const snow = season === 'winter';
      const dk = (dark ? 1 : 0) + (snow ? 2 : 0);
      // The far planes are drawn whole: a clip of several rectangles costs more than it saves. The sky is in flat
      // bands with short soft seams (bokashi), cheap to paint every frame, down to where the ridges cover it.
      const fy = H * 0.34 + climbed * 0.05;
      const hy = H * 0.56 + climbed * 0.2;
      const stw = 2 * G.outer;
      const yTop = Math.max(top + 30 - y0, -4);
      const yBot = Math.min(-y0, H + 4);
      skyBands(ctx, W, H, Math.min(H, fy + 50), mixAll(C.sky, C.clear, smooth(0.1, 1, up)));
      // the sun (the moon at night) coming out, to stand behind the hall at the end
      const yEnd = top - G.ground + 14 + 0.12 * (G.ground - 28);
      const disc = discAt(W, top);
      const discY = disc[1] - yEnd + (yEnd - y0) * 0.3;
      const dr = disc[2];
      // its halo and the lightning's glow are made from the start, not when they first show
      glow(sc, C.halo, dr * 3.4);
      glow(sc, C.boltGlow, 60);
      if (discY > -dr * 3 && discY < H + dr) {
        const a = smooth(0.3, 0.75, up);
        putGlow(ctx, sc, C.halo, dr * 3.4, disc[0], discY, a * 0.9);
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(disc[0], discY, dr, 0, TAU);
        ctx.fillStyle = C.sun;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (dark) {
        // stars, coming out as the storm draws off
        const a = smooth(0.2, 0.9, up);
        if (a > 0.02) {
          const R = rng(43);
          for (const k of [0.45, 0.9]) {
            ctx.beginPath();
            for (let i = 0; i < Math.round(W / 12); i++) {
              const x = R() * W;
              const y = R() * Math.min(H * 0.5, fy + 40);
              const r = 0.5 + R() * 0.9;
              ctx.moveTo(x + r, y);
              ctx.arc(x, y, r, 0, TAU);
            }
            ctx.fillStyle = rgba(C.star, k * a);
            ctx.fill();
          }
        }
      }
      // the storm overhead, drawing off as he climbs, and clouds
      if (up < 0.98) {
        const sb = pic('cstorm' + dk, W, yb + 24, sc, (g) => stormBank(g, W, yb, C, 19));
        ctx.globalAlpha = 1 - 0.6 * up;
        put(ctx, sb, 0, -up * (yb + 36));
        ctx.globalAlpha = 1;
      }
      for (let i = 0; i < 3; i++) {
        const w = 90 + 22 * i;
        const h = w * 0.24;
        const p = pic('kumo' + i + (dark ? 1 : 0), w + 4, h + 6, sc, (g) => kumo(g, 2, 4, w, h, C, 50 + i));
        const x = wrap(i * W * 0.43 + t * (4 + 2 * i) + up * (i % 2 ? 60 : -60), W + w + 60) - w - 30;
        put(ctx, p, x, yb + 12 + H * [0.1, 0.3, 0.2][i] + climbed * 0.03);
      }
      if (!still && up < 0.6) lightning(ctx, sc, t, W * 0.78, W * 0.94, yb, H * 0.45, W, C);
      // far ridges, then the hills: both sink away as he climbs
      if (fy < H) {
        const fr = pic('cfar' + (dark ? 1 : 0), W, 160, sc, (g) => {
          ridge(g, W, 10, 36, 160, C.far, 4, 4);
          kasumi(g, -20, 46, W * 0.6, 10, rgba(C.mist, 0.7));
          ridge(g, W, 52, 22, 160, C.far2, 12, 3);
          kasumi(g, W * 0.4, 84, W * 0.7, 10, rgba(C.mist, 0.6));
          g.fillStyle = C.valley;
          g.fillRect(-4, 110, W + 8, 52);
        });
        put(ctx, fr, 0, fy);
        if (fy + 158 < H) {
          ctx.fillStyle = C.valley;
          ctx.fillRect(0, fy + 158, W, Math.min(H, hy + 50) - fy - 158);
        }
      }
      if (hy < H) {
        const hl = pic('chill' + dk, W, 220, sc, (g) => {
          ridge(g, W, 18, 30, 220, C.hill, 21, 6);
          g.fillStyle = C.hillHi;
          const R = rng(5);
          for (let k = 0; k < Math.round(W / 9); k++) {
            const x = R() * W;
            const y = 60 + R() * 140;
            g.beginPath();
            g.moveTo(x - 4, y + 4);
            g.lineTo(x, y - 7);
            g.lineTo(x + 4, y + 4);
            g.fill();
          }
          if (snow) {
            g.fillStyle = rgba(C.snow, 0.5);
            g.fillRect(0, 40, W, 3);
          }
        });
        put(ctx, hl, 0, hy);
        if (hy + 218 < H) {
          ctx.fillStyle = C.hill;
          ctx.fillRect(0, hy + 218, W, H - hy - 218);
        }
      }
      // on a wide screen, groves of cedars in the mist on the slopes either side, passing at half the steps' pace; they
      // end at the terrace at the top (its wall hides where), so none is left standing in the sky over the hall
      const side = cx - G.outer - 2;
      const groveCut = top - 4 - y0;
      if (side > 40 && groveCut < H) {
        const GH = 300;
        const cutting = groveCut > 0;
        if (cutting) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, groveCut, W, H - groveCut);
          ctx.clip();
        }
        for (const sd of [-1, 1]) {
          const p = pic('cgrove' + sd + (dark ? 1 : 0) + (snow ? 1 : 0), side, GH, sc, (g) => {
            const R = rng(sd > 0 ? 61 : 67);
            for (const [gy0, n] of [[70, 4], [220, 3]]) {
              const x0 = R() * Math.max(10, side - 110);
              for (let i = 0; i < n; i++) {
                const h = 60 + R() * 50;
                cedar(g, x0 + 16 + i * 24 + R() * 8, gy0 + 30, h, 30, C, 0, 300 + i + gy0, snow);
              }
              kasumi(g, x0 - 10, gy0 + 22, Math.min(side, 150), 14, rgba(C.mist, dark ? 0.55 : 0.8));
            }
          });
          const x = sd < 0 ? 0 : W - side;
          for (let k = Math.floor((y0 * 0.5) / GH) - 1; k * GH - y0 * 0.5 < H; k++) {
            if (k * GH - y0 * 0.5 + GH < groveCut) continue;
            put(ctx, p, x, k * GH - y0 * 0.5);
          }
        }
        if (cutting) ctx.restore();
      }
      // the steps, from the ground up to the terrace at the top
      if (yBot > yTop) {
        const stair = pic('cstair' + (dark ? 1 : 0) + season, stw, TILE, sc, (g) => paintStair(g, stw, TILE, C, season, dark));
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, yTop, W, yBot - yTop);
        ctx.clip();
        for (let k = Math.floor(y0 / TILE); k * TILE < y0 + H; k++) put(ctx, stair, cx - stw / 2, k * TILE - y0);
        ctx.restore();
      }
      // the climb's pieces, as pictures, all made on its first frame so that none is painted as it comes into view
      const cw = 50;
      const cedars = [0, 1, 2].map((v) => {
        const ch = 180 + 30 * v;
        return pic('ccedar' + v + dk, cw + 12, ch + 4, sc, (g) => {
          cedar(g, (cw + 12) / 2, ch + 1, ch, cw, C, 1, 140 + v, snow);
          bush(g, (cw + 12) / 2 - 8, ch - 2, 8.5, C, season);
          bush(g, (cw + 12) / 2 + 8, ch, 7.5, C, season);
        });
      });
      const lan = pic('clantern' + dk, 44, 62, sc, (g) => {
        lantern(g, 22, 54, 0.82, C, snow);
        // its plinth
        g.beginPath();
        rr(g, 9, 54, 26, 7, 2);
        g.fillStyle = C.stoneShade;
        g.fill();
        g.fillStyle = C.stoneHi;
        g.fillRect(10, 54.8, 24, 1.4);
        g.lineWidth = 1.4;
        g.strokeStyle = C.line;
        g.stroke();
      });
      const bw = Math.min(64, W * 0.22);
      const boughs = [0, 1].map((f) => pic('cbough' + f + dk, bw, 46, sc, (g) => bough(g, bw, 46, C, 90, f === 1, snow)));
      const ground = pic('cground' + dk, W, 150, sc, (g) => {
        paving(g, -4, W + 4, 0, 150, C, 9);
        puddle(g, W * 0.18, 26, 20, 4, C, 0);
        puddle(g, W * 0.84, 48, 24, 5, C, 0);
      });
      const gate = gatePic(sc, W, C, dark, snow, 'entrance');
      gatePic(sc, W, C, dark, snow, 'ledge');
      // the cedars of the avenue, rising from the hedges beside the kerbs
      const CG = 150;
      for (let i = Math.max(0, Math.floor((-(y0 + H) - 90) / CG)); i <= Math.floor((-y0 + 300 - 90) / CG); i++) {
        const Y = -90 - CG * i;
        if (Y < top + 40) break;
        const side = i % 2 ? 1 : -1;
        const x = cx + side * (sw / 2 + KERB + 13 + 8 * hash(i, 1));
        const v = i % 3;
        put(ctx, cedars[v], x - (cw + 12) / 2, Y - (180 + 30 * v) - 3 - y0);
      }
      // stone lanterns on their plinths either side of the steps (the torii are the ledges', see ledge)
      const lit = [];
      for (let j = Math.max(0, Math.floor((-(y0 + H) - 300) / TORII_GAP)); j <= Math.floor((-y0 + 80 - 300) / TORII_GAP); j++) {
        const Y = -300 - TORII_GAP * j;
        if (Y < top + 60) break;
        for (const sd of [-1, 1]) {
          const x = cx + sd * (sw / 2 + KERB + 9);
          put(ctx, lan, x - 22, Y - 61 - y0);
          lit.push([x, Y - 61 + 21.2 - y0]);
        }
      }
      // the gate at the foot of the steps, on the forecourt, with its rope: its beams come behind the first sign,
      // whatever its height (a sign is at least 62 tall, and the first hangs from 12 under its ledge)
      if (-134 - gate.yK - y0 < H && -y0 > -10) put(ctx, gate, 0, -134 - gate.yK - y0);
      // the ground at the foot of the steps
      if (-y0 < H + 10) put(ctx, ground, 0, -y0 - 1);
      // boughs reaching in at the edges, nearest of all, passing faster than the steps
      const near = 1.35;
      const off = -(y0 - (14 - G.ground)) * near - (14 - G.ground);
      for (let b = Math.floor((off - H - 120) / 230); b <= Math.floor((off + 120) / 230) + 1; b++) {
        const Y = -60 - 230 * b + off;
        if (Y < -60 || Y > H + 60) continue;
        const flip = wrap(b, 2) === 1;
        put(ctx, boughs[flip ? 1 : 0], flip ? W - bw + 8 : -8, Y - 23);
      }
      lights(ctx, sc, lit, t, still, dark, C, 22);
      if (!still) {
        rain(ctx, W, 0, H, t, Math.round(34 * (1 - 0.85 * up)), C, 13);
        pellets(ctx, W, 0, H, t, Math.round(14 * (1 - up)), C, 23);
        bits(ctx, W, 0, H, t, season, 8, 33);
      }
    },
  });

  // where the sun (the moon) stands at the end of the climb: behind the hall's roof, to the right
  function discAt(W, top) {
    return [W / 2 + Math.min(W * 0.17, 60), top - 150, clamp(W * 0.1, 22, 44)];
  }

  // ---------- the ledges: stone steps to stand on ----------

  Object.assign(jinja, {
    ledge(ctx, o, C, pal) {
      const { x, y } = o;
      const n = o.n || 0;
      const R = rng(900 + n * 7);
      const lw = clamp((o.w || 84) + 30, 104, 126);
      const L = x - lw / 2;
      const season = seasonOf(o);
      // every fourth ledge (one in the middle) stands under a torii: its beams behind this ledge's sign, between where
      // Yaoki stands on this ledge and on the one below, its posts wide of both
      if (wrap(n, 4) === 1 && o.W) {
        const gp = gatePic(devScale(ctx), o.W, C, !!o.dark, season === 'winter', 'ledge');
        put(ctx, gp, 0, y + 14 - gp.yK);
      }
      // a hard shadow, so it stands off the steps behind
      ctx.beginPath();
      rr(ctx, L + 3, y - 2, lw, 19, 4);
      ctx.fillStyle = rgba(o.dark ? '#000000' : INK, o.dark ? 0.55 : 0.35);
      ctx.fill();
      // the slab: its top seen from a little above, its front, the shade under it, the joints of its stones
      ctx.beginPath();
      rr(ctx, L, y - 6, lw, 19, 4);
      ctx.fillStyle = C.slab;
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = C.slabTop;
      ctx.fillRect(L, y - 6, lw, 6.5);
      ctx.fillStyle = C.slabShade;
      ctx.fillRect(L, y + 8, lw, 6);
      ctx.beginPath();
      const j1 = L + lw * (0.3 + 0.1 * R());
      const j2 = L + lw * (0.66 + 0.1 * R());
      ctx.moveTo(j1, y + 0.5);
      ctx.lineTo(j1, y + 13);
      ctx.moveTo(j2, y + 0.5);
      ctx.lineTo(j2, y + 13);
      ctx.moveTo(L, y + 0.5);
      ctx.lineTo(L + lw, y + 0.5);
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = C.slabShade;
      ctx.stroke();
      ctx.fillStyle = rgba('#FFFFFF', o.dark ? 0.18 : 0.6);
      ctx.fillRect(L + 4, y - 5, lw - 8, 1.4);
      ctx.restore();
      ctx.beginPath();
      rr(ctx, L, y - 6, lw, 19, 4);
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = C.line;
      ctx.stroke();
      if (C.rim) {
        ctx.beginPath();
        ctx.moveTo(L + lw - 1.5, y - 3);
        ctx.lineTo(L + lw - 1.5, y + 9);
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = rgba(C.rim, 0.7);
        ctx.stroke();
      }
      // moss on one end, hanging over its front
      const mx = n % 2 ? L + lw - 14 : L + 14;
      ctx.beginPath();
      ctx.ellipse(mx, y - 4.5, 11, 3.4, 0, 0, TAU);
      ctx.moveTo(mx - 6, y - 3);
      ctx.quadraticCurveTo(mx - 4, y + 6, mx - 1, y - 2);
      ctx.quadraticCurveTo(mx + 2, y + 4, mx + 5, y - 3);
      ctx.fillStyle = C.moss;
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = C.mossLine;
      ctx.stroke();
      ctx.fillStyle = C.mossHi;
      ctx.beginPath();
      ctx.ellipse(mx - 3, y - 6, 5, 1.4, 0, 0, TAU);
      ctx.fill();
      // what the storm left on it: hail, or snow in winter, a leaf or petal in its season
      if (season === 'winter') {
        ctx.beginPath();
        ctx.moveTo(L + 3, y - 5);
        ctx.quadraticCurveTo(L + lw * 0.25, y - 10, L + lw * 0.5, y - 7.5);
        ctx.quadraticCurveTo(L + lw * 0.75, y - 10.5, L + lw - 3, y - 5);
        ctx.closePath();
        ctx.fillStyle = C.snow;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = C.snowShade;
        ctx.stroke();
      } else {
        const hx = [0, 1, 2].map((k) => L + lw * (0.36 + 0.28 * R()) + (k - 1) * 10);
        ctx.beginPath();
        for (const px of hx) {
          ctx.moveTo(px + 3, y - 2);
          ctx.ellipse(px + 0.8, y - 2, 2.4, 1, 0, 0, TAU);
        }
        ctx.fillStyle = rgba(INK, 0.25);
        ctx.fill();
        ctx.beginPath();
        for (const px of hx) {
          ctx.moveTo(px + 2, y - 3.6);
          ctx.arc(px, y - 3.6, 2, 0, TAU);
        }
        ctx.fillStyle = C.pellet;
        ctx.fill();
        const col = SEASONS[season].bits;
        ctx.fillStyle = col[0];
        ctx.beginPath();
        ctx.ellipse(n % 2 ? L + 18 : L + lw - 20, y - 3.5, 3.4, 1.6, 0.4, 0, TAU);
        ctx.fill();
      }
    },
  });

  // ---------- the top: the hall, its bell and rope ----------

  function hallGeo(W) {
    const hh = clamp(W * 0.8, 184, 320) / 2;
    return { cx: W / 2, hh, E: Math.min(hh * 1.22, W / 2 - 3) };
  }
  const HALL_UP = 214;

  function paintSummit(g, W, Y, C, season, dark) {
    const { cx, hh, E } = hallGeo(W);
    const snow = season === 'winter';
    const L = C.line;
    // cedars either side of the hall, and the tree of the season where there is room
    for (let i = 0; ; i++) {
      const x = cx + hh * 1.05 + 14 + i * 30;
      if (x - 30 > W) break;
      cedar(g, x, Y, 190 + 30 * hash(i, 3), 50, C, 1, 170 + i, snow);
      cedar(g, W - x, Y, 190 + 30 * hash(i, 4), 50, C, 1, 180 + i, snow);
    }
    if (cx - hh * 1.3 > 40) seasonTree(g, cx - hh * 1.32, Y - 2, 150, C, season, dark, 37);
    // the terrace: its top, and its wall of cut stones, the steps coming up through it
    const sw = stairGeo(W).sw + 2 * KERB;
    g.fillStyle = C.stoneHi;
    g.fillRect(-4, Y - 6, W + 8, 7);
    g.fillStyle = C.stoneShade;
    g.fillRect(-4, Y + 1, W + 8, 60);
    const R = rng(51);
    for (let row = 0, yy = Y + 2; yy < Y + 60; row++, yy += 12) {
      for (let x = -14 + (row % 2) * 10 + R() * 6; x < W + 4; ) {
        const bw = 18 + R() * 14;
        if (Math.abs(x + bw / 2 - cx) > sw / 2 + bw / 2 - 2) {
          g.beginPath();
          rr(g, x + 1, yy + 1, bw - 2, 10, 2.5);
          g.fillStyle = C.stone;
          g.fill();
          g.fillStyle = C.stoneHi;
          g.fillRect(x + 3, yy + 1.8, bw - 7, 1.6);
          g.lineWidth = 1.2;
          g.strokeStyle = L;
          g.stroke();
        }
        x += bw;
      }
    }
    g.fillStyle = C.moss;
    for (let k = 0; k < 6; k++) {
      const x = (k + 0.5) * (W / 6) + (R() - 0.5) * 20;
      if (Math.abs(x - cx) < sw / 2 + 8) continue;
      g.beginPath();
      g.ellipse(x, Y + 2 + R() * 4, 7 + R() * 5, 2.4, 0, 0, TAU);
      g.fill();
    }
    g.fillStyle = C.step;
    g.fillRect(cx - sw / 2, Y + 1, sw, 60);
    for (let yy = Y + 1; yy < Y + 61; yy += 20) {
      g.fillStyle = C.stepHi;
      g.fillRect(cx - sw / 2, yy, sw, 1.8);
      g.fillStyle = C.stepShade;
      g.fillRect(cx - sw / 2, yy + 1.8, sw, 2.6);
    }
    g.beginPath();
    g.moveTo(-4, Y - 6);
    g.lineTo(W + 4, Y - 6);
    g.moveTo(-4, Y + 1);
    g.lineTo(W + 4, Y + 1);
    g.moveTo(cx - sw / 2, Y + 1);
    g.lineTo(cx - sw / 2, Y + 61);
    g.moveTo(cx + sw / 2, Y + 1);
    g.lineTo(cx + sw / 2, Y + 61);
    g.lineWidth = 2;
    g.strokeStyle = L;
    g.stroke();
    if (snow) {
      g.fillStyle = C.snow;
      g.fillRect(-4, Y - 8, W + 8, 3.5);
    }
    // the floor of the hall, raised on its beams
    g.beginPath();
    rr(g, cx - hh * 0.96, Y - 20, hh * 1.92, 15, 2);
    g.fillStyle = C.wood;
    g.fill();
    g.fillStyle = C.woodHi;
    g.fillRect(cx - hh * 0.96, Y - 20, hh * 1.92, 3);
    g.lineWidth = 2;
    g.strokeStyle = L;
    g.stroke();
    // the walls between the posts: white plaster in the eave's shade, a vermilion beam across, windows of bars; the
    // middle open and dim, its mirror catching the light
    const posts = [-0.84, -0.3, 0.3, 0.84].map((k) => cx + hh * k);
    const wy = Y - 98;
    g.fillStyle = C.dim;
    g.fillRect(posts[1], wy, posts[2] - posts[1], Y - 20 - wy);
    g.beginPath();
    g.arc(cx, Y - 70, 7.5, 0, TAU);
    g.fillStyle = C.gold;
    g.fill();
    g.lineWidth = 1.4;
    g.strokeStyle = L;
    g.stroke();
    g.fillStyle = C.goldHi;
    g.beginPath();
    g.arc(cx - 2.2, Y - 72.5, 2.4, 0, TAU);
    g.fill();
    g.beginPath();
    for (let x = posts[1] + 6; x < posts[2] - 3; x += 7) {
      g.moveTo(x, wy + 2);
      g.lineTo(x, wy + 14);
    }
    g.moveTo(posts[1], wy + 14);
    g.lineTo(posts[2], wy + 14);
    g.lineWidth = 1.2;
    g.strokeStyle = rgba(C.gold, 0.55);
    g.stroke();
    for (const [a, b] of [[0, 1], [2, 3]]) {
      const x0 = posts[a];
      const x1 = posts[b];
      g.fillStyle = C.wall;
      g.fillRect(x0, wy, x1 - x0, Y - 20 - wy);
      g.fillStyle = mix(C.wall, C.roofShade, 0.3);
      g.fillRect(x0, wy, x1 - x0, 7);
      g.fillStyle = C.wood;
      g.fillRect(x0 + 6, wy + 12, x1 - x0 - 12, 18);
      g.fillStyle = C.wall;
      for (let x = x0 + 9; x < x1 - 8; x += 6) g.fillRect(x, wy + 14, 2.4, 14);
      g.fillStyle = C.torii;
      g.fillRect(x0, Y - 52, x1 - x0, 6);
      g.lineWidth = 1.4;
      g.strokeStyle = L;
      g.strokeRect(x0 + 6, wy + 12, x1 - x0 - 12, 18);
      g.strokeRect(x0, Y - 52, x1 - x0, 6);
    }
    // the posts
    for (const x of posts) {
      g.beginPath();
      g.rect(x - 4.5, wy - 4, 9, Y - 20 - wy + 4);
      g.fillStyle = C.torii;
      g.fill();
      g.fillStyle = C.toriiShade;
      g.fillRect(x + 1.2, wy - 4, 3.3, Y - 20 - wy + 4);
      g.fillStyle = C.toriiHi;
      g.fillRect(x - 3.4, wy - 4, 1.6, Y - 20 - wy + 4);
      g.lineWidth = 1.8;
      g.strokeStyle = L;
      g.stroke();
      if (C.rim) {
        g.fillStyle = rgba(C.rim, 0.7);
        g.fillRect(x + 3, wy, 1.2, Y - 24 - wy);
      }
    }
    // the beam over the posts, with its gold fittings, and the brackets above it
    g.beginPath();
    g.rect(cx - hh * 0.98, wy - 12, hh * 1.96, 9);
    g.fillStyle = C.torii;
    g.fill();
    g.fillStyle = C.toriiShade;
    g.fillRect(cx - hh * 0.98, wy - 6.5, hh * 1.96, 3.5);
    g.lineWidth = 1.8;
    g.strokeStyle = L;
    g.stroke();
    for (const x of posts) {
      g.fillStyle = C.gold;
      g.beginPath();
      g.arc(x, wy - 7.5, 2.2, 0, TAU);
      g.fill();
      g.beginPath();
      rr(g, x - 6, wy - 20, 12, 8, 1.5);
      g.fill();
      g.lineWidth = 1.2;
      g.stroke();
    }
    // the roof: the great sweep of green copper, its corners turned up, its tiles in lines, lit on the left; the dark
    // eave with gold at its corners; the gable above with its gold ornament; the ridge with its logs (katsuogi) and
    // crossed boards (chigi)
    const ey = wy - 20;
    const roof = new Path2D();
    roof.moveTo(cx - E, ey - 15);
    roof.quadraticCurveTo(cx - hh * 0.92, ey - 8, cx - hh * 0.62, ey - 44);
    roof.lineTo(cx + hh * 0.62, ey - 44);
    roof.quadraticCurveTo(cx + hh * 0.92, ey - 8, cx + E, ey - 15);
    roof.quadraticCurveTo(cx + E * 0.62, ey + 3, cx, ey + 2);
    roof.quadraticCurveTo(cx - E * 0.62, ey + 3, cx - E, ey - 15);
    roof.closePath();
    g.fillStyle = C.roof;
    g.fill(roof);
    g.save();
    g.clip(roof);
    g.fillStyle = C.roofHi;
    g.beginPath();
    g.moveTo(cx - E, ey - 15);
    g.quadraticCurveTo(cx - hh * 0.92, ey - 8, cx - hh * 0.62, ey - 44);
    g.lineTo(cx - hh * 0.22, ey - 44);
    g.quadraticCurveTo(cx - hh * 0.5, ey - 12, cx - hh * 0.72, ey + 6);
    g.closePath();
    g.fill();
    g.beginPath();
    for (let x = cx - E; x < cx + E; x += 7) {
      const k = (x - cx) / E;
      g.moveTo(x, ey + 4);
      g.lineTo(cx + (x - cx) * 0.55 - k * 4, ey - 46);
    }
    g.lineWidth = 1;
    g.strokeStyle = C.roofShade;
    g.stroke();
    g.beginPath();
    g.moveTo(cx - E - 2, ey - 19);
    g.quadraticCurveTo(cx - E * 0.62, ey - 3, cx, ey - 4);
    g.quadraticCurveTo(cx + E * 0.62, ey - 3, cx + E + 2, ey - 19);
    g.lineWidth = 7;
    g.strokeStyle = C.roofLine;
    g.stroke();
    g.restore();
    g.lineWidth = 2.2;
    g.strokeStyle = C.roofLine;
    g.stroke(roof);
    for (const sd of [-1, 1]) {
      g.beginPath();
      g.arc(cx + sd * (E - 3), ey - 14, 3.2, 0, TAU);
      g.fillStyle = C.gold;
      g.fill();
      g.lineWidth = 1.2;
      g.strokeStyle = L;
      g.stroke();
    }
    // the gable
    const gy = ey - 44;
    g.beginPath();
    g.moveTo(cx - hh * 0.5, gy + 1);
    g.lineTo(cx, gy - 30);
    g.lineTo(cx + hh * 0.5, gy + 1);
    g.closePath();
    g.fillStyle = C.wood;
    g.fill();
    g.save();
    g.clip();
    g.fillStyle = C.wall;
    g.fillRect(cx - hh * 0.5, gy - 14, hh, 6);
    g.restore();
    g.lineWidth = 2;
    g.strokeStyle = L;
    g.stroke();
    g.beginPath();
    g.moveTo(cx - hh * 0.58, gy + 4);
    g.lineTo(cx, gy - 34);
    g.lineTo(cx + hh * 0.58, gy + 4);
    g.lineWidth = 5;
    g.strokeStyle = C.roofLine;
    g.stroke();
    g.lineWidth = 2;
    g.strokeStyle = C.gold;
    g.stroke();
    g.beginPath();
    g.arc(cx, gy - 22, 4.5, 0, TAU);
    g.fillStyle = C.gold;
    g.fill();
    g.lineWidth = 1.2;
    g.strokeStyle = L;
    g.stroke();
    // ridge, katsuogi and chigi
    const ry = gy - 34;
    g.beginPath();
    rr(g, cx - hh * 0.36, ry - 5, hh * 0.72, 7, 2);
    g.fillStyle = C.roofLine;
    g.fill();
    for (let i = 0; i < 3; i++) {
      const x = cx + (i - 1) * hh * 0.2;
      g.beginPath();
      rr(g, x - 7, ry - 12, 14, 7, 3.5);
      g.fillStyle = C.wood;
      g.fill();
      g.fillStyle = C.woodHi;
      g.fillRect(x - 5, ry - 11, 10, 1.6);
      g.lineWidth = 1.3;
      g.strokeStyle = L;
      g.stroke();
      g.beginPath();
      g.arc(x - 6, ry - 8.5, 2, 0, TAU);
      g.arc(x + 6, ry - 8.5, 2, 0, TAU);
      g.fillStyle = C.gold;
      g.fill();
    }
    for (const sd of [-1, 1]) {
      const x = cx + sd * hh * 0.36;
      g.beginPath();
      g.moveTo(x - sd * 3, ry);
      g.lineTo(x + sd * 11, ry - 22);
      g.moveTo(x + sd * 6, ry);
      g.lineTo(x - sd * 7, ry - 20);
      g.lineWidth = 5;
      g.strokeStyle = C.roofLine;
      g.stroke();
      g.lineWidth = 2.6;
      g.strokeStyle = C.woodHi;
      g.stroke();
      g.fillStyle = C.gold;
      g.beginPath();
      g.arc(x + sd * 11, ry - 22, 2.2, 0, TAU);
      g.arc(x - sd * 7, ry - 20, 2.2, 0, TAU);
      g.fill();
    }
    if (snow) {
      g.beginPath();
      g.moveTo(cx - hh * 0.62, ey - 45);
      g.lineTo(cx + hh * 0.62, ey - 45);
      g.lineWidth = 4;
      g.strokeStyle = C.snow;
      g.stroke();
      g.beginPath();
      g.moveTo(cx - E + 4, ey - 17);
      g.quadraticCurveTo(cx - hh * 0.92, ey - 10, cx - hh * 0.62, ey - 45);
      g.moveTo(cx + E - 4, ey - 17);
      g.quadraticCurveTo(cx + hh * 0.92, ey - 10, cx + hh * 0.62, ey - 45);
      g.lineWidth = 3;
      g.stroke();
      g.beginPath();
      g.moveTo(cx - hh * 0.5, gy);
      g.lineTo(cx, gy - 31);
      g.lineTo(cx + hh * 0.5, gy);
      g.lineWidth = 2.5;
      g.stroke();
    }
    // the shimenawa over the middle, with its straw tassels
    const sy = wy - 2;
    shimenawa(g, posts[1] + 2, sy, posts[2] - 2, sy, 5, 8, C);
    g.beginPath();
    for (const k of [-0.62, 0.62]) {
      const x = cx + (posts[2] - posts[1]) * 0.5 * k;
      const yy = sy + 9 + 10 * (1 - k * k) * 0.5;
      for (let s = -2; s <= 2; s++) {
        g.moveTo(x + s * 1.2, yy - 4);
        g.lineTo(x + s * 1.4, yy + 5);
      }
    }
    g.lineWidth = 1.2;
    g.strokeStyle = C.ropeShade;
    g.stroke();
    // hanging lanterns (chōchin) in the side bays
    for (const sd of [-1, 1]) {
      const x = cx + sd * hh * 0.57;
      const yy = wy + 24;
      g.beginPath();
      g.moveTo(x, wy - 3);
      g.lineTo(x, yy - 11.5);
      g.lineWidth = 1.2;
      g.strokeStyle = L;
      g.stroke();
      g.beginPath();
      g.ellipse(x, yy, 7, 9.5, 0, 0, TAU);
      g.fillStyle = '#E8452F';
      g.fill();
      g.fillStyle = '#FFF2D6';
      g.fillRect(x - 7, yy - 2, 14, 4);
      g.lineWidth = 1.4;
      g.stroke();
      g.fillStyle = C.kasagi;
      g.fillRect(x - 4, yy - 11.5, 8, 3);
      g.fillRect(x - 4, yy + 8.5, 8, 3);
    }
    // stone lanterns at the ends of the terrace, where there is room
    const lx = hh * 1.1 + 22;
    const lights2 = [[cx - hh * 0.57, wy + 24], [cx + hh * 0.57, wy + 24]];
    if (cx + lx < W - 10) {
      for (const sd of [-1, 1]) lights2.push(lantern(g, cx + sd * lx, Y - 5, 0.9, C, snow));
    }
    return { lights: lights2, bell: [cx, sy + 6], shide: [posts[1], posts[2], sy] };
  }

  Object.assign(jinja, {
    summit(ctx, o, C, pal) {
      const { W, y } = o;
      const sc = devScale(ctx);
      const dark = !!o.dark;
      const still = !!o.still;
      const t = still ? 0 : o.t || 0;
      const season = seasonOf(o);
      const { cx, hh } = hallGeo(W);
      const reached = !!o.reached;
      const swing = reached && !still;
      // the light behind the hall, once he is there: rays turning slowly round the sun (or the moon)
      if (reached) {
        const [sx, syy] = discAt(W, y);
        const Rr = Math.max(W, 420);
        const gr = ctx.createRadialGradient(sx, syy, 10, sx, syy, Rr);
        gr.addColorStop(0, rgba(C.halo, dark ? 0.5 : 0.65));
        gr.addColorStop(0.5, rgba(C.halo, dark ? 0.16 : 0.24));
        gr.addColorStop(1, rgba(C.halo, 0));
        ctx.fillStyle = gr;
        ctx.beginPath();
        const a0 = t * 0.12;
        for (let i = 0; i < 16; i++) {
          const a = a0 + (i / 16) * TAU;
          ctx.moveTo(sx, syy);
          ctx.lineTo(sx + Math.cos(a) * Rr, syy + Math.sin(a) * Rr);
          ctx.lineTo(sx + Math.cos(a + TAU / 40) * Rr, syy + Math.sin(a + TAU / 40) * Rr);
          ctx.closePath();
        }
        ctx.fill();
      }
      let made = null;
      const p = pic('summit' + (dark ? 1 : 0) + season, W, HALL_UP + 66, sc, (g) => {
        made = paintSummit(g, W, HALL_UP, C, season, dark);
      });
      if (made) p.info = made;
      const off = y - HALL_UP;
      put(ctx, p, 0, off);
      const info = p.info || { lights: [], bell: [cx, HALL_UP - 94], shide: [cx - hh * 0.3, cx + hh * 0.3, HALL_UP - 100] };
      // the lights brighten once he is there: their larger glow made from the start
      glow(sc, C.lampGlow, dark ? 34 : 34 * 0.6);
      lights(ctx, sc, info.lights.map(([lx, ly]) => [lx, ly + off]), t, still, dark, C, reached ? 34 : 24);
      // the paper of the shimenawa, stirring in the wind; more once he is there
      const [p1, p2, sy0] = info.shide;
      for (let i = 0; i < 4; i++) {
        const k = -0.8 + i * 0.53;
        const x = cx + (p2 - p1) * 0.5 * k * 0.92;
        const yy = sy0 + off + 4 + 5 * (1 - k * k) + 2;
        const sway = still ? 0 : Math.sin(t * (swing ? 5 : 1.8) + i * 1.7) * (swing ? 0.22 : 0.07);
        shide(ctx, x - 3, yy, 1, C, sway);
      }
      // the bell and its rope, swinging once he is there, and the ring of its sound
      const bx = info.bell[0];
      const by = info.bell[1] + off;
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(swing ? Math.sin(t * 5) * 0.18 : 0);
      ctx.beginPath();
      ctx.arc(0, 7, 7.5, 0, TAU);
      ctx.fillStyle = C.gold;
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = C.line;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-4, 10);
      ctx.lineTo(4, 10);
      ctx.stroke();
      ctx.fillStyle = C.goldHi;
      ctx.beginPath();
      ctx.arc(-2.5, 4.5, 2, 0, TAU);
      ctx.fill();
      // the rope: braided red and white, its tassel purple, ending over his head
      const r0 = 14;
      const r1 = 28;
      ctx.lineCap = 'butt';
      ctx.lineWidth = 6.5;
      ctx.strokeStyle = C.line;
      ctx.beginPath();
      ctx.moveTo(0, r0 - 1);
      ctx.lineTo(0, r1 + 1);
      ctx.stroke();
      ctx.lineWidth = 4.2;
      ctx.setLineDash([3.5, 3.5]);
      ctx.strokeStyle = '#E2452B';
      ctx.beginPath();
      ctx.moveTo(0, r0);
      ctx.lineTo(0, r1);
      ctx.stroke();
      ctx.lineDashOffset = 3.5;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
      ctx.fillStyle = '#7A3FA0';
      ctx.beginPath();
      ctx.moveTo(-4, r1);
      ctx.lineTo(4, r1);
      ctx.lineTo(3, r1 + 6);
      ctx.lineTo(-3, r1 + 6);
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = C.line;
      ctx.stroke();
      ctx.restore();
      if (swing) {
        const k = (t * 1.2) % 1;
        ctx.lineWidth = 2;
        ctx.strokeStyle = rgba(C.goldHi, 0.85 * (1 - k));
        ctx.beginPath();
        for (const sd of [-1, 1]) {
          const rad = 13 + 18 * k;
          ctx.moveTo(bx + Math.cos(sd > 0 ? -0.55 : Math.PI + 0.55) * rad, by + 7 + Math.sin(sd > 0 ? -0.55 : Math.PI + 0.55) * rad);
          ctx.arc(bx, by + 7, rad, sd > 0 ? -0.55 : Math.PI + 0.55, sd > 0 ? 0.55 : Math.PI - 0.55, sd < 0);
        }
        ctx.stroke();
        // gold, vermilion and white flakes falling over the hall
        const cols = [C.gold, '#E8452F', '#FFFFFF'];
        for (let c = 0; c < 3; c++) {
          ctx.beginPath();
          for (let i = c; i < 27; i += 3) {
            const fx = wrap(hash(i, 1) * W + Math.sin(t * 1.3 + i) * 14, W);
            const fy = y - 240 + wrap(hash(i, 2) * 270 + t * (40 + 30 * hash(i, 3)), 270);
            const ang = t * (2 + 3 * hash(i, 4)) + i;
            const rx = 3.4 * Math.cos(ang);
            const ry = 3.4 * Math.sin(ang);
            ctx.moveTo(fx + rx, fy + ry * 0.5);
            ctx.lineTo(fx - ry * 0.5, fy + rx);
            ctx.lineTo(fx - rx, fy - ry * 0.5);
            ctx.lineTo(fx + ry * 0.5, fy - rx);
            ctx.closePath();
          }
          ctx.fillStyle = cols[c];
          ctx.fill();
        }
      }
    },
  });

  // ---------- the falling things: hailstones ----------
  // Each is drawn round the box of its word, a little larger: pale ice where the word is, so it reads in both themes;
  // its colour (a cool rim, a shade band at its lower right, a glint at its upper left) keeps to its edge. A hard
  // shadow under each, a thick ink outline and a gold ring for the one to say, red when it lands.

  const SHAPES = new Map();
  function hailShape(n, w, h) {
    const key = n + ':' + w + ':' + h;
    let s = SHAPES.get(key);
    if (s) return s;
    if (SHAPES.size > 80) SHAPES.clear();
    const R = rng(7000 + n * 31);
    const kind = wrap(n, 3);
    const cx = w / 2;
    const cy = h / 2;
    const a = w / 2 + 10;
    const b = h / 2 + 10;
    const e = 2.6;
    const m = kind === 1 ? 10 : 18;
    const off = R() * TAU;
    const pts = [];
    for (let i = 0; i < m; i++) {
      const th = off + (i / m) * TAU + (R() - 0.5) * (kind === 1 ? 0.25 : 0.08);
      const c = Math.cos(th);
      const sn = Math.sin(th);
      const r = 1 / Math.pow(Math.pow(Math.abs(c) / a, e) + Math.pow(Math.abs(sn) / b, e), 1 / e);
      const k = kind === 1 ? 1.03 + (R() - 0.5) * 0.06 : kind === 0 ? (i % 2 ? 1.045 : 0.995) + (R() - 0.5) * 0.03 : 1 + (R() - 0.5) * 0.05;
      pts.push([cx + c * r * k, cy + sn * r * k]);
    }
    const body = new Path2D();
    roundPoly(body, pts, kind === 1 ? 4 : 0);
    let lump = null;
    let lumpAt = null;
    if (kind === 2) {
      const side = n % 2 ? 1 : -1;
      const lr = clamp(Math.min(w, h) * 0.2, 8, 12);
      lumpAt = [cx + side * (a - lr * 0.55), cy - b + lr * 0.55, lr];
      lump = new Path2D();
      lump.arc(lumpAt[0], lumpAt[1], lr, 0, TAU);
    }
    // glints of frost at its edge, at the lower right and the upper right
    const sparks = [pts[Math.floor(m * 0.12)], pts[Math.floor(m * 0.85)]].map(([px, py]) => [cx + (px - cx) * 0.93, cy + (py - cy) * 0.9]);
    s = { body, lump, lumpAt, a, b, cx, cy, sparks };
    SHAPES.set(key, s);
    return s;
  }
  // a shape filled again inside itself, smaller by d and moved by (dx, dy): its edge left showing as a band
  function inset(ctx, path, cx, cy, a, b, d, dx, dy) {
    ctx.save();
    ctx.translate(cx + dx, cy + dy);
    ctx.scale((a - d) / a, (b - d) / b);
    ctx.translate(-cx, -cy);
    ctx.fill(path);
    ctx.restore();
  }
  const ICE = { core: '#F6FBFF', shade: '#C9E9FA', rim: '#79C3EA' };
  const BURN = { core: '#FFEDE7', shade: '#F9C6B8', rim: '#EE7A5E' };
  function thing(ctx, o) {
    const { x, y } = o;
    const w = Math.round(o.w);
    const h = Math.round(o.h);
    const pal = o.pal || {};
    const S = hailShape(o.n || 0, w, h);
    const flash = !!o.flash;
    const target = !!o.target && !flash;
    const col = flash ? BURN : ICE;
    const line = flash ? pal.bad || '#C7361E' : o.dark ? '#0A1030' : INK;
    ctx.translate(x, y);
    ctx.lineJoin = 'round';
    const parts = S.lump ? [S.lump, S.body] : [S.body];
    // the hard shadow
    ctx.save();
    ctx.translate(target ? 4 : 3, target ? 5.5 : 4);
    ctx.fillStyle = o.dark ? '#02040C' : pal.hard || INK;
    for (const p of parts) ctx.fill(p);
    ctx.restore();
    if (target) {
      // the one to say: a gold ring round it, edged in ink, breathing
      const k = o.t ? Math.sin(o.t * 4) : 0;
      ctx.lineWidth = 14 + 1.6 * k;
      ctx.strokeStyle = o.dark ? '#02040C' : INK;
      for (const p of parts) ctx.stroke(p);
      ctx.lineWidth = 10 + 1.6 * k;
      ctx.strokeStyle = '#F7BE3E';
      for (const p of parts) ctx.stroke(p);
    } else if (o.dark && !flash) {
      ctx.lineWidth = 7;
      ctx.strokeStyle = 'rgba(150,200,255,0.3)';
      for (const p of parts) ctx.stroke(p);
    }
    for (const p of parts) {
      const lumpy = p === S.lump;
      const cx = lumpy ? S.lumpAt[0] : S.cx;
      const cy = lumpy ? S.lumpAt[1] : S.cy;
      const a = lumpy ? S.lumpAt[2] : S.a;
      const b = lumpy ? S.lumpAt[2] : S.b;
      ctx.fillStyle = col.rim;
      ctx.fill(p);
      ctx.fillStyle = col.shade;
      inset(ctx, p, cx, cy, a, b, 2.4, -0.5, -0.7);
      ctx.fillStyle = col.core;
      inset(ctx, p, cx, cy, a, b, 5.5, -2, -2.6);
      ctx.lineWidth = target ? 3.6 : 2.6;
      ctx.strokeStyle = line;
      ctx.stroke(p);
    }
    // its glint at the upper left, and frost sparkling at its edge
    ctx.lineCap = 'round';
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(S.cx, S.cy, S.a - 5.5, S.b - 5.5, 0, Math.PI * 1.08, Math.PI * 1.36);
    ctx.stroke();
    ctx.beginPath();
    for (const [sx, sy] of S.sparks) {
      ctx.moveTo(sx, sy - 4);
      ctx.quadraticCurveTo(sx, sy, sx + 2.6, sy);
      ctx.quadraticCurveTo(sx, sy, sx, sy + 4);
      ctx.quadraticCurveTo(sx, sy, sx - 2.6, sy);
      ctx.quadraticCurveTo(sx, sy, sx, sy - 4);
    }
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
  }
  function colors() {
    return { fill: '#DDF1FC', line: '#2D6E9E' };
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
