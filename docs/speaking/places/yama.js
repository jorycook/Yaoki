/*
 * Yaoki Speaking's place 山 Mountain, drawn for world.js: rocks come down the crevice; Climb goes up its rock ledges to the
 * summit and its flag.
 *
 * A woodblock print of a high mountain, lit from the upper left. Through the crevice a great snowy peak (Fuji's line,
 * snow in streaks down its ravines) stands over a sea of clouds, at dawn in light mode, under the moon and the stars in
 * dark mode, in a sky in bands. Nearer, teal ridges with cedars and a hut, the season in their trees. Nearest, the
 * crevice's own walls: violet cliffs in layers, each jutting out in a lip and sloping back under itself, outlined in ink,
 * their rims lit in ochre (in moonlight blue) where they face the light, with snow, pines, a climbing chain; at their foot
 * a stone lantern and a sacred rock with its rope and paper streamers. What moves is little: the sun (or the moon) rising
 * as the round goes on, two clouds, birds, petals, leaves, seeds or snow by the season, fireflies on summer nights,
 * twinkling stars, the lantern's flicker. With reduced motion (o.t stays 0) nothing moves.
 *
 * Falling keeps its still parts as pictures: the far scene behind what drifts; the walls and the floor in front of it, in
 * three narrow pictures. Climb draws its sky in fine bands, warming towards the top; keeps the far range as a picture
 * that sinks a little as the top comes near; tiles the far walls and the near ones upwards, the far ones scrolling at
 * 0.45 of the near ones' speed; and at the top the sun rises behind the summit (the moon comes over it at night) in a
 * fan of rays that turns once Yaoki is there, with sparkles and two cranes going over. The summit: a snowy crown of rock
 * with a torii and the flag, the sea of clouds at the eye's level behind it.
 * The pictures are painted at the screen's own scale, so drawing one is a plain copy, and kept as small as what is in
 * them: a frame's pictures stay well under the 32 MB past which Chrome stops putting drawing off and draws at once.
 *
 * The falling rocks are cut stones: a cream face for the word (nothing else is ever drawn there), faceted round it in
 * three tones by how each facet faces the light, capped with snow, with a hard shadow; the one to say wears a gold ring,
 * a flash turns it red. A ledge is a chunky snow-topped slab out of its wall, its top showing above its sign.
 *
 * It is registered with SpeakingWorld.define(id, place), where place = { palette: { light, dark }, layout(n, W),
 * fall(ctx, o, C), climb(ctx, o, C), ledge(ctx, o, C, pal), summit(ctx, o, C, pal), thing(ctx, o, C), colors(n, dark) }
 * (C: the palette of the theme in use; o as world.js says of back, ledge, summit and thing). The helpers it draws with
 * are world.js's (SpeakingWorld.kit), and a few of its own below.
 */
(function () {
  'use strict';

  const W0 = window.SpeakingWorld;
  if (!W0 || !W0.kit) return;
  const { TAU, INK, hash, noise, clamp, smooth, wrap, mix, rgba, rr } = W0.kit;

  const PALETTE = {
    light: {
      // the sky's bands, from the top down to the horizon; deep: the crevice's sky, low down in Climb
      sky: ['#132B63', '#2354A6', '#4C8BD0', '#9FCDEB', '#FBE6BC', '#F5B27F'],
      deep: ['#112757', '#1D4189', '#3263AA', '#5B8DC4', '#86B2D8', '#9EC4E2'],
      sun: '#F0603A', sunRim: '#FFD36E', glow: '#FFD98A', disc: '#FFF3CF',
      peak: '#5A72BD', peakShade: '#3F5396', peakLine: '#2A3A78', snow: '#FFFFFF', snowShade: '#C3D5F0',
      cloud: '#FFFFFF', cloudFoot: '#C7D6EE', cloudLine: '#7F98C9', cloudLit: '#FFE1BA',
      ridge: '#2C7C78', ridgeShade: '#1C5A5E', ridgeLine: '#103740', cedar: '#17493E', cedarLit: '#2E7A5C',
      far: '#8FA6D8', farShade: '#7189C4', farLine: '#5D72AE',
      rock: '#5C4A80', rockShade: '#3B2F5B', rockLit: '#D9904F', rockLine: '#191230', strata: '#4A3B6C',
      pine: '#1F5B47', pineLit: '#3F9163', trunk: '#3A2638',
      floor: '#F3F7FD', floorShade: '#BFCEEA', earth: '#4A3A6A', stone: '#8F95AE', stoneShade: '#5E6380', stoneLit: '#C9CEDF',
      rope: '#D8B25E', ropeShade: '#9C7A34', paper: '#FFFFFF', torii: '#E0442A', toriiShade: '#A82E1C',
      mist: '#FFF4E6', bird: '#1B2440', lamp: '#FFCF6A', star: '#FFFFFF', chain: '#2B2440',
      leaf: { spring: ['#F7A9C1', '#FFE0EA'], summer: ['#FFFFFF', '#E6F4FF'], autumn: ['#E0532B', '#F29A3A'], winter: ['#FFFFFF', '#DCE7F7'] },
      tuft: { spring: '#F4A3BE', summer: '#4FA35E', autumn: '#E0592E', winter: '#FFFFFF' },
    },
    dark: {
      sky: ['#04071A', '#0A1238', '#151B55', '#272468', '#45307C', '#6A4386'],
      deep: ['#04071A', '#081034', '#0E1744', '#141F52', '#1B275E', '#212D66'],
      sun: '#FFF0C4', sunRim: '#FFE39A', glow: '#FFE7AE', disc: '#FFF6DC',
      peak: '#2E3C7A', peakShade: '#1F295A', peakLine: '#121A40', snow: '#DCE5FB', snowShade: '#93A6D8',
      cloud: '#8E9CD3', cloudFoot: '#5B68A6', cloudLine: '#3B4682', cloudLit: '#C9D3F6',
      ridge: '#1B3C52', ridgeShade: '#11293A', ridgeLine: '#06121C', cedar: '#0D2A2E', cedarLit: '#21504F',
      far: '#36447E', farShade: '#29366C', farLine: '#1E2858',
      rock: '#2B2352', rockShade: '#191432', rockLit: '#8197DA', rockLine: '#07061A', strata: '#372E66',
      pine: '#123532', pineLit: '#2A5F57', trunk: '#160F22',
      floor: '#B4C1E6', floorShade: '#7482B6', earth: '#211B42', stone: '#4F5476', stoneShade: '#2D304D', stoneLit: '#8C96C4',
      rope: '#A88C4E', ropeShade: '#6B5629', paper: '#E3E8F8', torii: '#C23A28', toriiShade: '#7E2216',
      mist: '#7E8BC4', bird: '#C9D2F2', lamp: '#FFC66B', star: '#F2F5FF', chain: '#0B0A1C',
      leaf: { spring: ['#E99AB6', '#F6D3E0'], summer: ['#D9F27A', '#FFF7B0'], autumn: ['#C9502E', '#E08A3A'], winter: ['#E9EEFF', '#BCC8EE'] },
      tuft: { spring: '#B8728E', summer: '#2F6B4A', autumn: '#A9442A', winter: '#C9D5F3' },
    },
  };

  // the falling stones' colours: [face of the stone round the word: mid, lit, shade]
  const STONES = [
    { light: ['#B4693D', '#E1A06A', '#72381E'], dark: ['#93604A', '#C99474', '#4B2A28'] },
    { light: ['#6A6FB0', '#A2A8DC', '#42447E'], dark: ['#5E629C', '#949AD3', '#33366A'] },
    { light: ['#B08A3A', '#DEBD6C', '#6B5020'], dark: ['#8C7442', '#C6A863', '#56431F'] },
  ];

  // ---------- pictures kept: what does not move, painted once at the size and scale it is shown at ----------
  // (world.js's cachedLayer keeps one picture; a print in layers needs a few, all freed when the scene changes)
  const KEPT = new Map();
  let keptScene = '';
  // the pixels to a unit the pictures are painted at: the screen's own (a phone at 3 x 1.625 is 4.875), so drawing one
  // is a plain copy, pixel for pixel; stretching a smaller one up each frame costs several times as much, and blurs
  function scaleOf(ctx) {
    try {
      const m = ctx.getTransform();
      return clamp(Math.hypot(m.a, m.b), 1, 5);
    } catch (err) {
      return 2;
    }
  }
  function scene(key) {
    if (key === keptScene) return;
    for (const c of KEPT.values()) c.width = c.height = 0;
    KEPT.clear();
    FRESH.length = 0;
    keptScene = key;
  }
  // and all let go of once nothing of this place has been drawn for a few seconds (a round in another place, the menu,
  // a hidden page), as in the other places: a phone has only so much memory for canvases
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
      scene('');
    };
    setTimeout(check, 2500);
  }
  // A new picture is only painted, not yet drawn: the browser draws it the first time it is shown, which for one that
  // comes into view in the middle of a climb (the summit) is a stutter then. So a pixel of each new picture is shown at
  // the start of the next frame, under the sky that is drawn over it at once.
  const FRESH = [];
  function warmUp(ctx) {
    for (const c of FRESH) if (c.width && c.height) ctx.drawImage(c, 0, 0, 1, 1, 0, 0, 1 / c.u, 1 / c.u);
    FRESH.length = 0;
  }
  function kept(key, w, h, sc, paint) {
    let c = KEPT.get(key);
    if (!c) {
      if (KEPT.size > 40) scene(keptScene + '+');
      c = document.createElement('canvas');
      c.width = Math.max(1, Math.ceil(w * sc));
      c.height = Math.max(1, Math.ceil(h * sc));
      c.u = sc;
      const g = c.getContext('2d');
      g.setTransform(sc, 0, 0, sc, 0, 0);
      g.lineJoin = 'round';
      g.lineCap = 'round';
      paint(g);
      KEPT.set(key, c);
      FRESH.push(c);
    }
    return c;
  }
  // a kept picture with its top left at (x, y), on whole pixels of the screen so it stays crisp
  function put(ctx, c, x, y) {
    let m = null;
    try {
      m = ctx.getTransform();
    } catch (err) {
      m = null;
    }
    if (m && m.a > 0 && m.d > 0 && !m.b && !m.c) {
      x = (Math.round(m.e + x * m.a) - m.e) / m.a;
      y = (Math.round(m.f + y * m.d) - m.f) / m.d;
    }
    ctx.drawImage(c, x, y, c.width / c.u, c.height / c.u);
  }

  // value noise that comes round again every `cells` (the walls of Climb, tiled upwards)
  function pnoise(seed, x, cells) {
    const i = Math.floor(x);
    const f = x - i;
    const a = hash(seed, wrap(i, cells));
    return a + (hash(seed, wrap(i + 1, cells)) - a) * f * f * (3 - 2 * f);
  }

  // ---------- shapes, woodblock style ----------

  // the season's colour in the trees, and its outline: ink, or for winter's snow its own shade (ink makes it bubbles)
  const tuftOf = (C, season) => [C.tuft[season] || C.tuft.autumn, season === 'winter' ? C.snowShade : C.rockLine];

  // Round puffs over a flat foot, as one shape with one outline: the puffs are stroked twice as thick first, then all of
  // it is filled over, so only the outline round the whole is left. circles: [cx, cy, r]; foot: [x, y, w, h].
  function puffs(g, circles, foot, fill, line, lw) {
    g.beginPath();
    for (const [cx, cy, r] of circles) {
      g.moveTo(cx + r, cy);
      g.arc(cx, cy, r, 0, TAU);
    }
    if (foot && foot[4]) rr(g, foot[0], foot[1], foot[2], foot[3], foot[4]);
    else if (foot) g.rect(foot[0], foot[1], foot[2], foot[3]);
    if (line) {
      g.strokeStyle = line;
      g.lineWidth = lw * 2;
      g.stroke();
    }
    g.fillStyle = fill;
    g.fill();
  }
  // a bank of cloud: round scallops along its top (y), its foot flat (y + h), as puffs
  function cloudBank(g, x0, x1, y, h, r, seed, fill, line, lw) {
    const list = [];
    let x = x0 - r;
    for (let k = 0; x < x1 + r; k++) {
      const s = r * (0.7 + 0.6 * hash(seed, k));
      list.push([x + s, y + s + r * 0.7 * hash(seed + 1, k), s]);
      x += s * 1.6;
    }
    puffs(g, list, [x0 - r, y + r * 1.25, x - x0 + 2 * r, h - r * 1.25], fill, line, lw);
  }
  // a cloud of a few puffs, for the sky (x, y: its foot's left end)
  function kumo(g, x, y, w, h, seed, fill, line, lw) {
    const n = 4;
    const list = [];
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) / n;
      const s = (w / n) * (0.6 + 0.25 * hash(seed, i));
      list.push([x + w * k, Math.min(y - s, y - h * (0.3 + 0.7 * Math.sin(Math.PI * k)) + s), s]);
    }
    puffs(g, list, [x + w * 0.04, y - h * 0.34, w * 0.92, h * 0.34, h * 0.17], fill, line, lw);
  }
  // a cedar on a crest, its foot at (x, y), s tall
  function cedar(g, x, y, s) {
    g.moveTo(x, y - s);
    g.lineTo(x + s * 0.3, y - s * 0.46);
    g.lineTo(x + s * 0.15, y - s * 0.46);
    g.lineTo(x + s * 0.4, y);
    g.lineTo(x - s * 0.4, y);
    g.lineTo(x - s * 0.15, y - s * 0.46);
    g.lineTo(x - s * 0.3, y - s * 0.46);
    g.closePath();
  }
  // a pine clinging to the rock at (x, y), leaning out over the gap (dir 1: to the right), s across
  function pine(g, x, y, s, dir, C) {
    g.beginPath();
    g.moveTo(x, y);
    g.bezierCurveTo(x + dir * s * 0.35, y - s * 0.04, x + dir * s * 0.46, y - s * 0.42, x + dir * s * 0.84, y - s * 0.5);
    g.moveTo(x + dir * s * 0.4, y - s * 0.24);
    g.lineTo(x + dir * s * 0.2, y - s * 0.5);
    g.strokeStyle = C.trunk;
    g.lineWidth = Math.max(1.8, s * 0.11);
    g.stroke();
    const pads = [[0.84, -0.56, 0.34], [0.2, -0.56, 0.24], [0.56, -0.32, 0.2], [1.1, -0.44, 0.2]];
    g.beginPath();
    for (const [px, py, pr] of pads) {
      g.moveTo(x + dir * px * s + pr * s, y + py * s);
      g.ellipse(x + dir * px * s, y + py * s, pr * s, pr * s * 0.42, 0, 0, TAU);
    }
    g.fillStyle = C.pine;
    g.fill();
    g.lineWidth = 1.3;
    g.strokeStyle = C.rockLine;
    g.stroke();
    g.beginPath();
    for (const [px, py, pr] of pads) {
      const cx = x + dir * px * s - pr * s * 0.12;
      const cy = y + py * s - pr * s * 0.15;
      g.moveTo(cx + pr * s * 0.68, cy);
      g.ellipse(cx, cy, pr * s * 0.68, pr * s * 0.17, 0, 0, TAU);
    }
    g.fillStyle = C.pineLit;
    g.fill();
  }
  // snow lying on a top from x0 to x1 at y, th thick, its edge hanging in drips
  function snowOn(g, x0, x1, y, th, seed) {
    const n = Math.max(2, Math.round((x1 - x0) / 7));
    g.moveTo(x0, y + th * 0.5);
    g.quadraticCurveTo(x0 + (x1 - x0) * 0.5, y - th * 1.1, x1, y + th * 0.5);
    // its edge in round lobes, a longer drip here and there
    let px = x1;
    for (let i = n - 1; i >= 0; i--) {
      const x = x0 + ((x1 - x0) * i) / n;
      const d = hash(seed, i);
      g.quadraticCurveTo((px + x) / 2, y + th * (d > 0.7 ? 2.6 : 1.3 + 0.5 * d), x, y + th * 0.6);
      px = x;
    }
    g.closePath();
  }
  // paper streamers (shide) hanging from a rope: each a white strip folded in a zigzag, s long, from the points given
  function shide(g, at, s, C) {
    const w = s * 0.26;
    const k = s / 4;
    g.beginPath();
    for (const [x, y] of at) {
      g.moveTo(x, y);
      g.lineTo(x, y + k);
      g.lineTo(x + w, y + k);
      g.lineTo(x + w, y + 2 * k);
      g.lineTo(x, y + 2 * k);
      g.lineTo(x, y + 3 * k);
      g.lineTo(x + w, y + 3 * k);
      g.lineTo(x + w, y + 4 * k);
    }
    g.lineJoin = 'miter';
    g.lineCap = 'butt';
    g.strokeStyle = C.rockLine;
    g.lineWidth = w + 1.6;
    g.stroke();
    g.strokeStyle = C.paper;
    g.lineWidth = w;
    g.stroke();
    g.lineJoin = 'round';
    g.lineCap = 'round';
  }
  // a stone lantern (tōrō) standing at (x, y), s tall; its light's window is at lanternLight(x, y, s)
  function lantern(g, x, y, s, C) {
    const u = s / 10;
    g.beginPath();
    rr(g, x - 2.6 * u, y - 1.4 * u, 5.2 * u, 1.4 * u, 0.4 * u); // foot
    rr(g, x - 0.9 * u, y - 5 * u, 1.8 * u, 3.7 * u, 0.3 * u); // post
    rr(g, x - 2 * u, y - 5.6 * u, 4 * u, 0.9 * u, 0.3 * u); // platform
    rr(g, x - 1.6 * u, y - 7.9 * u, 3.2 * u, 2.4 * u, 0.3 * u); // light box
    g.fillStyle = C.stone;
    g.fill();
    g.lineWidth = 1.2;
    g.strokeStyle = C.rockLine;
    g.stroke();
    // the roof, curved up at its ends
    g.beginPath();
    g.moveTo(x - 3.4 * u, y - 7.6 * u);
    g.quadraticCurveTo(x - 1.4 * u, y - 8.3 * u, x, y - 9.4 * u);
    g.quadraticCurveTo(x + 1.4 * u, y - 8.3 * u, x + 3.4 * u, y - 7.6 * u);
    g.closePath();
    g.moveTo(x + 0.5 * u, y - 9.3 * u);
    g.arc(x, y - 9.5 * u, 0.55 * u, 0, TAU);
    g.fillStyle = C.stoneShade;
    g.fill();
    g.stroke();
    // its window
    g.beginPath();
    g.rect(x - 0.8 * u, y - 7.4 * u, 1.6 * u, 1.4 * u);
    g.fillStyle = C.lit ? C.lamp : C.stoneShade;
    g.fill();
    g.lineWidth = 0.9;
    g.stroke();
    g.fillStyle = C.stoneLit;
    g.fillRect(x - 2.4 * u, y - 1.4 * u, 4.6 * u, 0.4 * u);
  }
  const lanternLight = (x, y, s) => [x, y - 0.67 * s];

  // birds in a skein, high over the gap (day): one path of small wings
  function birds(ctx, C, W, y0, t, n) {
    ctx.beginPath();
    for (let k = 0; k < n; k++) {
      const x = wrap(t * (11 + 3 * k) + k * 37 + 60, W + 80) - 40;
      const y = y0 + k * 9 + 4 * Math.sin(t * 1.3 + k * 2);
      const f = 2.6 * Math.sin(t * 7 + k * 1.7);
      const s = 4.2 - k * 0.4;
      ctx.moveTo(x - s, y - f);
      ctx.quadraticCurveTo(x - s * 0.4, y - 2, x, y);
      ctx.quadraticCurveTo(x + s * 0.4, y - 2, x + s, y - f);
    }
    ctx.strokeStyle = C.bird;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  // What drifts down, by the season: petals in spring, fireflies on summer nights (seeds by day), maple leaves in autumn,
  // snow in winter. drop: how far the world has moved up (Climb), so it falls past faster as Yaoki climbs.
  function drift(ctx, o, C, W, H, drop) {
    const s = o.season || 'autumn';
    const t = o.t;
    const [c1, c2] = (C.leaf[s] || C.leaf.autumn);
    const n = s === 'winter' ? 30 : s === 'summer' ? 12 : 16;
    const spot = (k, speed) => {
      const sp = speed * (0.7 + 0.6 * hash(81, k));
      const y = wrap(hash(82, k) * (H + 40) + t * sp + drop, H + 40) - 20;
      const sway = Math.sin(t * (0.7 + 0.6 * hash(83, k)) + k) * (5 + 9 * hash(84, k));
      const x = wrap(hash(85, k) * (W + 40) + sway + t * 7, W + 40) - 20;
      return [x, y];
    };
    if (s === 'summer' && o.dark) {
      // fireflies: a warm dot in a halo, low down at the sides
      for (const pass of [0, 1]) {
        ctx.beginPath();
        for (let k = 0; k < n; k++) {
          const a = 0.5 + 0.5 * Math.sin(t * (1.5 + hash(86, k)) + k * 2.1);
          if (a < 0.25) continue;
          const side = k % 2 ? 1 : -1;
          const x = W / 2 + side * (W * 0.3 + W * 0.2 * hash(87, k)) + 8 * Math.sin(t * 0.6 + k);
          const y = H * (0.35 + 0.55 * hash(88, k)) + 6 * Math.sin(t * 0.8 + k * 3);
          const r = pass ? 1.1 : 3.4 * a;
          ctx.moveTo(x + r, y);
          ctx.arc(x, y, r, 0, TAU);
        }
        ctx.fillStyle = pass ? '#FFF7C2' : rgba('#E8F27A', 0.28);
        ctx.fill();
      }
      return;
    }
    if (s === 'winter' || s === 'summer') {
      // snow, or the seeds of summer grass by day: round, in two sizes
      for (const pass of [0, 1]) {
        ctx.beginPath();
        for (let k = pass; k < n; k += 2) {
          const [x, y] = spot(k, s === 'winter' ? 22 : 9);
          const r = (s === 'winter' ? 1.3 : 0.9) + (pass ? 0.9 : 0.2) * hash(89, k);
          ctx.moveTo(x + r, y);
          ctx.arc(x, y, r, 0, TAU);
        }
        ctx.fillStyle = pass ? c1 : c2;
        ctx.fill();
      }
      return;
    }
    // petals (spring), maple leaves (autumn): turning as they fall
    for (const pass of [0, 1]) {
      ctx.beginPath();
      for (let k = pass; k < n; k += 2) {
        const [x, y] = spot(k, 15);
        const a = t * (1 + hash(90, k)) + k;
        const r = s === 'autumn' ? 3 + 1.2 * hash(91, k) : 2.4 + hash(91, k);
        if (s === 'autumn') {
          // a five-pointed leaf
          for (let i = 0; i < 10; i++) {
            const ang = a + (i / 10) * TAU;
            const rad = i % 2 ? r * 0.45 : r;
            const px = x + Math.cos(ang) * rad;
            const py = y + Math.sin(ang) * rad * 0.85;
            if (i) ctx.lineTo(px, py);
            else ctx.moveTo(px, py);
          }
          ctx.closePath();
        } else {
          ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
          ctx.ellipse(x, y, r, r * 0.55, a, 0, TAU);
        }
      }
      ctx.fillStyle = pass ? c1 : c2;
      ctx.fill();
    }
  }

  // stars that twinkle (night): only where the sky is open, above y = clear(x)
  function twinkle(ctx, C, W, H, t, clear, seed) {
    ctx.beginPath();
    let k = 0;
    for (let i = 0; i < 40 && k < 12; i++) {
      const x = hash(seed, i) * W;
      const y = hash(seed + 1, i) * H;
      if (y > clear(x) - 6) continue;
      k++;
      const a = Math.max(0, Math.sin(t * (1.2 + hash(seed + 2, i) * 1.6) + i * 1.9));
      const r = 0.6 + 2.4 * a * a;
      ctx.moveTo(x - r, y);
      ctx.lineTo(x, y - r * 0.22);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x, y + r * 0.22);
      ctx.closePath();
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r * 0.22, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r * 0.22, y);
      ctx.closePath();
    }
    ctx.fillStyle = C.star;
    ctx.fill();
  }

  // ---------- the far scene: the banded sky, the sun or the moon, the great peak, the sea of clouds ----------

  // Fuji's line: a flat top, steep high up, flaring out below
  function profile(px, py, hw, Hm) {
    return (x) => {
      const u = Math.abs(x - px) / hw;
      if (u >= 1) return py + Hm;
      if (u < 0.05) return py + Hm * 0.014 * Math.abs(Math.sin(u * 90));
      const v = (u - 0.05) / 0.95;
      return py + Hm * (1 - Math.pow(1 - v, 2.3));
    };
  }

  // a snowy peak: its body, its shaded right flank, snow in tongues down the ravines, a few ravine lines
  function paintPeak(g, C, px, py, hw, Hm, base, seed, soft) {
    const prof = profile(px, py, hw, Hm);
    const body = new Path2D();
    body.moveTo(px - hw, base);
    for (let x = px - hw; x < px + hw; x += 3) body.lineTo(x, prof(x));
    body.lineTo(px + hw, prof(px + hw));
    body.lineTo(px + hw, base);
    body.closePath();
    const col = (c) => (soft ? mix(c, C.far, soft) : c);
    g.fillStyle = col(C.peak);
    g.fill(body);
    g.save();
    g.clip(body);
    const shade = new Path2D();
    shade.moveTo(px + hw * 0.015, py - 4);
    shade.quadraticCurveTo(px + hw * 0.09, py + Hm * 0.5, px + hw * 0.3, base);
    shade.lineTo(px + hw + 4, base);
    shade.lineTo(px + hw + 4, py - 4);
    shade.closePath();
    g.fillStyle = col(C.peakShade);
    g.fill(shade);
    // the snow, down to a line of tongues
    // (measured down from the mountain's line: long streaks down the ravines, short notches of rock between)
    const snow = new Path2D();
    snow.moveTo(px - hw, py - 6);
    snow.lineTo(px + hw, py - 6);
    const n = 34;
    for (let i = n; i >= 0; i--) {
      const x = px - hw * 0.62 + (hw * 1.24 * i) / n;
      const u = Math.abs(x - px) / hw;
      const r = hash(seed, i);
      const depth = i % 2 ? 0.1 + 0.3 * r * r + 0.12 * (1 - u) : 0.03 + 0.05 * r;
      snow.lineTo(x, prof(x) + Hm * depth * (1.15 - u));
    }
    snow.closePath();
    g.fillStyle = col(C.snow);
    g.fill(snow);
    g.save();
    g.clip(shade);
    g.fillStyle = col(C.snowShade);
    g.fill(snow);
    g.restore();
    // ravines: lines from high up down the flanks
    g.beginPath();
    for (let k = 0; k < 6; k++) {
      const side = k % 2 ? 1 : -1;
      const a = 0.08 + 0.13 * Math.floor(k / 2) + 0.03 * hash(seed + 2, k);
      const x0 = px + side * hw * a;
      g.moveTo(x0, prof(x0) + 3);
      g.quadraticCurveTo(x0 + side * hw * 0.05, prof(x0) + Hm * 0.3, x0 + side * hw * 0.12, prof(x0) + Hm * 0.55);
    }
    g.strokeStyle = rgba(col(C.peakLine), 0.45);
    g.lineWidth = 1;
    g.stroke();
    g.restore();
    g.strokeStyle = col(C.peakLine);
    g.lineWidth = soft ? 1 : 1.4;
    g.stroke(body);
    return prof;
  }

  function fallGeo(o) {
    const { W, H, ground: gy } = o;
    const hz = gy * 0.6;
    const R = clamp(Math.min(W, gy) * 0.085, 15, 36);
    const px = W / 2 + clamp(W * 0.08, 14, 70);
    const py = Math.max(44, gy * 0.16);
    const Hm = hz - py;
    const hw = Math.max(Hm * 1.65, W * 0.36);
    const bw = clamp(W * 0.13, 26, 130);
    const prof = profile(px, py, hw, Hm);
    // the open sky: above the great peak and the two softer ones beside it
    const sides = [-1, 1].map((s) => profile(px + s * hw * 1.05, py + Hm * 0.42, hw * 0.62, Hm * 0.58));
    const clear = (x) => Math.min(hz - 8, prof(x), sides[0](x), sides[1](x));
    // the sun (the moon at night) high on the left, where the light comes from, in open sky; it rises as the round goes
    const sx = W / 2 - clamp(W * 0.3, 60, 230);
    const sy = Math.max(R + 40, Math.min(hz * 0.42, clear(sx) - R - 8));
    return { W, H, gy, hz, R, sx, sy, px, py, Hm, hw, bw, prof, clear };
  }

  // sky bands (bokashi) down to the horizon
  function bands(g, C, W, top, hz, list) {
    const s = g.createLinearGradient(0, top, 0, hz);
    const at = [0, 0.16, 0.24, 0.5, 0.72, 0.88, 1];
    const cols = [list[0], list[0], list[1], list[2], list[3], list[4], list[5]];
    for (let i = 0; i < at.length; i++) s.addColorStop(at[i], cols[i]);
    g.fillStyle = s;
    g.fillRect(0, top, W, hz - top + 400);
  }

  // stars from y0 down to y1, only where the sky is open (above clear(x))
  function starField(g, C, W, y0, y1, clear, seed, n) {
    g.fillStyle = C.star;
    for (let k = 0; k < n; k++) {
      const x = hash(seed, k) * W;
      const y = y0 + hash(seed + 1, k) * (y1 - y0);
      if (y > clear(x) - 4) continue;
      g.globalAlpha = 0.45 + 0.5 * hash(seed + 2, k);
      g.beginPath();
      g.arc(x, y, 0.5 + 1.1 * hash(seed + 3, k), 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;
  }

  function paintFallBack(g, o, C, G) {
    const { W, gy, hz } = G;
    bands(g, C, W, 0, hz, C.sky);
    if (o.dark) starField(g, C, W, 0, hz, G.clear, 301, 90);
    // the far peaks on either side, softer, then the great one
    for (const side of [-1, 1]) {
      const fx = G.px + side * G.hw * 1.05;
      paintPeak(g, C, fx, G.py + G.Hm * 0.42, G.hw * 0.62, G.Hm * 0.58, hz + 20, 140 + side, 0.45);
    }
    paintPeak(g, C, G.px, G.py, G.hw, G.Hm, hz + 20, 120, 0);
    // the sea of clouds: two banks, lit warm from the sun's side
    const r = clamp(W * 0.034, 7, 16);
    for (const [y, rad, seed] of [[hz - 14, r, 7], [hz + 6, r * 1.35, 9]]) {
      const grad = g.createLinearGradient(0, y, 0, y + rad * 3.4);
      grad.addColorStop(0, o.dark ? C.cloudLit : mix(C.cloud, C.cloudLit, 0.55));
      grad.addColorStop(0.45, C.cloud);
      grad.addColorStop(1, C.cloudFoot);
      cloudBank(g, -10, W + 10, y, gy - y + 10, rad, seed, grad, C.cloudLine, 1.2);
    }
    paintSpurs(g, o, C, G);
  }

  // the ridges nearer, both sides, teal with cedars on their crests, the season in their trees, a hut on the right one
  function paintSpurs(g, o, C, G) {
    const { W, gy } = G;
    const spurs = [
      { from: -10, to: W * 0.68, y0: gy * 0.6, y1: gy * 0.97, seed: 21, dir: 1 },
      { from: W + 10, to: W * 0.3, y0: gy * 0.66, y1: gy * 0.99, seed: 22, dir: -1 },
    ];
    const [tuft, tuftLine] = tuftOf(C, o.season);
    for (const s of spurs) {
      const crest = (x) => {
        const k = clamp((x - s.from) / (s.to - s.from), 0, 1);
        return s.y0 + (s.y1 - s.y0) * Math.pow(k, 0.85) + gy * 0.022 * (noise(s.seed, x / 22) - 0.5);
      };
      const body = new Path2D();
      const step = (s.to - s.from) / 40;
      body.moveTo(s.from, gy + 20);
      for (let i = 0; i <= 40; i++) body.lineTo(s.from + step * i, crest(s.from + step * i));
      body.lineTo(s.to, gy + 20);
      body.closePath();
      g.fillStyle = C.ridge;
      g.fill(body);
      g.save();
      g.clip(body);
      g.beginPath();
      g.moveTo(s.from, gy + 20);
      for (let i = 0; i <= 40; i++) {
        const x = s.from + step * i;
        g.lineTo(x, crest(x) + 9 + 10 * noise(s.seed + 5, x / 30));
      }
      g.lineTo(s.to, gy + 20);
      g.closePath();
      g.fillStyle = C.ridgeShade;
      g.fill();
      g.restore();
      if (o.season === 'winter') {
        g.save();
        g.clip(body);
        g.beginPath();
        for (let i = 0; i <= 40; i++) g.lineTo(s.from + step * i, crest(s.from + step * i) - 2);
        for (let i = 40; i >= 0; i--) g.lineTo(s.from + step * i, crest(s.from + step * i) + 3 + 2 * hash(s.seed, i));
        g.closePath();
        g.fillStyle = C.snow;
        g.fill();
        g.restore();
      }
      g.strokeStyle = C.ridgeLine;
      g.lineWidth = 1.6;
      g.stroke(body);
      // cedars along the high, outer part of the crest
      const outer = Math.abs(s.to - s.from) * 0.48;
      g.beginPath();
      for (let d = 2; d < outer; d += 5.5 + 3 * hash(s.seed + 7, d | 0)) {
        const x = s.from + s.dir * d;
        const size = (7 + 7 * (1 - d / outer)) * clamp(gy / 300, 0.8, 1.6);
        cedar(g, x, crest(x) + 2, size * (0.8 + 0.4 * hash(s.seed + 8, d | 0)));
      }
      g.fillStyle = o.season === 'winter' ? mix(C.cedar, C.snow, 0.15) : C.cedar;
      g.fill();
      g.strokeStyle = C.ridgeLine;
      g.lineWidth = 1;
      g.stroke();
      // the season's colour in the trees, on the slopes away from the middle
      g.beginPath();
      for (let k = 0; k < 7; k++) {
        const d = outer * (0.1 + 0.85 * hash(s.seed + 9, k));
        const x = s.from + s.dir * d;
        const y = crest(x) + 8 + 22 * hash(s.seed + 10, k);
        for (let j = 0; j < 3; j++) {
          const cx = x + (j - 1) * 3.4;
          const cy = y - (j === 1 ? 2.2 : 0);
          g.moveTo(cx + 3, cy);
          g.arc(cx, cy, 3, 0, TAU);
        }
      }
      g.fillStyle = tuft;
      g.fill();
      g.strokeStyle = o.season === 'winter' ? tuftLine : C.ridgeLine;
      g.lineWidth = 0.9;
      g.stroke();
    }
    // a hut on the right ridge, its window warm at night
    const hx = W - clamp(W * 0.17, 34, 120);
    const k = clamp((hx - (W + 10)) / (W * 0.3 - (W + 10)), 0, 1);
    const hy = gy * 0.66 + (gy * 0.99 - gy * 0.66) * Math.pow(k, 0.85) + 3;
    const u = clamp(gy / 300, 0.8, 1.5);
    if (o.dark) {
      const glow = g.createRadialGradient(hx, hy - 5 * u, 1, hx, hy - 5 * u, 22 * u);
      glow.addColorStop(0, rgba(C.lamp, 0.55));
      glow.addColorStop(1, rgba(C.lamp, 0));
      g.fillStyle = glow;
      g.fillRect(hx - 24 * u, hy - 30 * u, 48 * u, 48 * u);
    }
    g.beginPath();
    g.rect(hx - 7 * u, hy - 8 * u, 14 * u, 8 * u);
    g.fillStyle = o.dark ? '#3A2E3A' : '#8A5A3A';
    g.fill();
    g.strokeStyle = C.ridgeLine;
    g.lineWidth = 1.1;
    g.stroke();
    g.beginPath();
    g.moveTo(hx - 10 * u, hy - 7 * u);
    g.lineTo(hx, hy - 15 * u);
    g.lineTo(hx + 10 * u, hy - 7 * u);
    g.closePath();
    g.fillStyle = o.season === 'winter' ? C.snow : o.dark ? '#1C1830' : '#3B2C3E';
    g.fill();
    g.stroke();
    g.fillStyle = o.dark ? C.lamp : '#3B2C3E';
    g.fillRect(hx - 2.5 * u, hy - 6 * u, 5 * u, 3.4 * u);
  }

  // ---------- the crevice's walls: layered cliffs, outlined, lit from the upper left ----------

  // The layers of a cliff from y0 on: [{ y, h, k }]. Climb's walls come round every `period`: K layers fit it exactly,
  // three rounds from -period, so a picture of one round meets the next without a seam.
  function layersDown(y0, y1, seed) {
    const out = [];
    let y = y0;
    for (let k = 0; y < y1; k++) {
      const h = 24 + 42 * hash(seed, k);
      out.push({ y, h, k });
      y += h;
    }
    return out;
  }
  function layersRound(P, seed) {
    const K = Math.max(5, Math.round(P / 46));
    const raw = [];
    let sum = 0;
    for (let k = 0; k < K; k++) {
      raw.push(0.5 + hash(seed, k));
      sum += raw[k];
    }
    const out = [];
    let y = -P;
    for (let i = 0; i < 3 * K; i++) {
      const k = i % K;
      const h = (P * raw[k]) / sum;
      out.push({ y, h, k });
      y += h;
    }
    return out;
  }

  // A cliff along the left side (the right one is the same, mirrored: lit, as it faces the light). Each layer juts out at
  // its top in a lip and slopes back under itself; reach(y, k): how far out it reaches there. The rim is faceted by how
  // each piece of it faces the light; snow lies on some lips, pines and tufts grow from others; the joints between the
  // layers are thin lines, the cliff's edge one bold line. opts: { seed, line, pines (how many lips have one), pineMax
  // (none on a lip further out: Climb's tiles stay narrow), snow, tufts }
  function paintCliff(g, o, C, layers, reach, lit, opts) {
    const seed = opts.seed;
    const pts = [];
    const lips = [];
    let prev = null;
    for (const L of layers) {
      const r0 = reach(L.y, L.k);
      const r1 = reach(L.y + L.h, L.k + 0.5);
      const jut = r0 * (0.14 + 0.2 * hash(seed + 1, L.k));
      const top = r0 + jut * 0.5;
      const bottom = r1 - jut * 0.5;
      const j1 = (hash(seed + 2, L.k) - 0.5) * jut * 0.5;
      const j2 = (hash(seed + 3, L.k) - 0.5) * jut * 0.5;
      if (prev === null) pts.push([bottom, L.y]);
      lips.push({ x0: prev === null ? bottom : prev, x1: top, y: L.y, k: L.k });
      pts.push([top - 2, L.y + 0.6]);
      pts.push([top, L.y + 2.6]);
      pts.push([top + (bottom - top) * 0.35 + j1, L.y + L.h * 0.38]);
      pts.push([top + (bottom - top) * 0.72 + j2, L.y + L.h * 0.72]);
      pts.push([bottom, L.y + L.h]);
      prev = bottom;
    }
    const N = pts.length;
    const y0 = pts[0][1];
    const y1 = pts[N - 1][1];
    // the mass
    g.beginPath();
    g.moveTo(-10, y0);
    for (const p of pts) g.lineTo(p[0], p[1]);
    g.lineTo(-10, y1);
    g.closePath();
    g.fillStyle = C.rock;
    g.fill();
    // the rim's facets: a band inside each piece of the edge, lit or in shade by where it faces
    const nrm = pts.map((p, i) => {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(N - 1, i + 1)];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return [(b[1] - a[1]) / l, -(b[0] - a[0]) / l];
    });
    const litP = new Path2D();
    const shadeP = new Path2D();
    for (let i = 0; i < N - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const nx = (b[1] - a[1]) / l;
      const ny = -(b[0] - a[0]) / l;
      const tone = (lit ? 0.6 : -0.6) * nx - 0.8 * ny;
      const q = tone > 0.3 ? litP : tone < -0.25 ? shadeP : null;
      if (!q) continue;
      const w = ny < -0.5 ? 3.2 : 5 + 3 * hash(seed + 4, i);
      q.moveTo(a[0], a[1]);
      q.lineTo(b[0], b[1]);
      q.lineTo(b[0] - nrm[i + 1][0] * w, b[1] - nrm[i + 1][1] * w);
      q.lineTo(a[0] - nrm[i][0] * w, a[1] - nrm[i][1] * w);
      q.closePath();
    }
    g.fillStyle = C.rockShade;
    g.fill(shadeP);
    g.fillStyle = C.rockLit;
    g.fill(litP);
    // inside: the joints between the layers, and strokes down the rock near its edge
    g.beginPath();
    for (const p of lips) {
      const x = Math.max(p.x0, p.x1) - 3;
      g.moveTo(x, p.y + 2);
      g.quadraticCurveTo(x * 0.5, p.y + 2 + 4 * (hash(seed + 5, p.k) - 0.3), -10, p.y + 5 * hash(seed + 6, p.k));
    }
    g.strokeStyle = rgba(C.rockLine, 0.55);
    g.lineWidth = 1.2;
    g.stroke();
    g.beginPath();
    for (let i = 3; i < N - 1; i += 2) {
      if (hash(seed + 7, i) < 0.4) continue;
      const [x, y] = pts[i];
      const d = 7 + 10 * hash(seed + 8, i);
      g.moveTo(x - d, y - 4);
      g.lineTo(x - d - 1.5, y + 5 + 5 * hash(seed + 9, i));
    }
    g.strokeStyle = C.strata;
    g.lineWidth = 1.4;
    g.stroke();
    // the cliff's edge
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < N; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.strokeStyle = C.rockLine;
    g.lineWidth = opts.line || 2.3;
    g.stroke();
    // on the lips: snow, pines, tufts of the season
    const [tuft, tuftLine] = tuftOf(C, o.season);
    for (const p of lips) {
      const r = hash(seed + 10, p.k);
      const wide = p.x1 - p.x0;
      if (r < (opts.snow || 0.5)) {
        g.beginPath();
        snowOn(g, p.x1 - Math.max(9, Math.min(22, wide + 8)), p.x1 + 1.5, p.y + 1.6, 3.2, seed * 7 + p.k);
        g.fillStyle = C.snow;
        g.fill();
        g.strokeStyle = C.rockLine;
        g.lineWidth = 1.2;
        g.stroke();
      } else if (opts.tufts && r > 0.82) {
        g.beginPath();
        for (let j = 0; j < 3; j++) {
          const cx = p.x1 - 5 + (j - 1) * 3.4;
          const cy = p.y - 0.5 - (j === 1 ? 2 : 0);
          g.moveTo(cx + 3, cy);
          g.arc(cx, cy, 3, 0, TAU);
        }
        g.fillStyle = tuft;
        g.fill();
        g.strokeStyle = tuftLine;
        g.lineWidth = 1;
        g.stroke();
      }
      if (opts.pines && hash(seed + 11, p.k) > 1 - opts.pines && !(opts.pineMax && p.x1 > opts.pineMax)) {
        pine(g, p.x1 - 3, p.y + 2.4, clamp(o.W * 0.09, 18, 34) * (0.8 + 0.4 * hash(seed + 12, p.k)), 1, C);
      }
    }
    return { pts, lips };
  }

  // a climbing chain hung from a peg, down the wall's face (Japanese mountains have them on their steep rock)
  function chain(g, C, x, y, len) {
    g.beginPath();
    g.arc(x, y, 2, 0, TAU);
    g.fillStyle = C.chain;
    g.fill();
    g.beginPath();
    for (let i = 0; i < len / 4.2; i++) {
      const cy = y + 3 + i * 4.2;
      const cx = x + Math.sin(i * 0.35) * 1.4;
      g.moveTo(cx + (i % 2 ? 1 : 2), cy);
      g.ellipse(cx, cy, i % 2 ? 1 : 2, 2.6, 0, 0, TAU);
    }
    g.strokeStyle = C.chain;
    g.lineWidth = 1.1;
    g.stroke();
  }

  // the floor of the crevice: snow over dark earth and stones; a stone lantern and a sacred rock with its rope
  function paintFloor(g, o, C, W, gy, H, lamp) {
    g.fillStyle = C.earth;
    g.fillRect(0, gy, W, H - gy + 2);
    g.beginPath();
    g.moveTo(-4, gy + 16);
    for (let x = -4; x <= W + 4; x += 8) g.lineTo(x, gy + 11 + 5 * hash(51, Math.round(x)));
    g.lineTo(W + 4, gy - 1);
    for (let x = W + 4; x >= -4; x -= 10) g.lineTo(x, gy - 1 - (Math.abs(x - W / 2) > W * 0.3 ? 2 * hash(52, Math.round(x)) : 0));
    g.closePath();
    g.fillStyle = C.floor;
    g.fill();
    g.fillStyle = C.floorShade;
    g.fillRect(0, gy + 5, W, 2.2);
    // stones in the earth below
    for (let k = 0; k < Math.round(W / 22); k++) {
      const x = hash(53, k) * W;
      const y = gy + 20 + hash(54, k) * Math.max(10, H - gy - 30);
      const r = 4 + 6 * hash(55, k);
      g.beginPath();
      g.ellipse(x, y, r * 1.4, r, 0, 0, TAU);
      g.fillStyle = C.stoneShade;
      g.fill();
      g.strokeStyle = C.rockLine;
      g.lineWidth = 1.2;
      g.stroke();
      g.beginPath();
      g.ellipse(x - r * 0.3, y - r * 0.45, r * 0.8, r * 0.3, 0, 0, TAU);
      g.fillStyle = C.floor;
      g.fill();
    }
    // the sacred rock at the right, with its rope and paper streamers (shimenawa, shide)
    const rx = W - clamp(W * 0.1, 22, 70);
    const rs = clamp(W * 0.1, 22, 46);
    g.beginPath();
    g.moveTo(rx - rs, gy + 4);
    g.bezierCurveTo(rx - rs * 1.05, gy - rs * 0.9, rx + rs * 0.9, gy - rs * 1.15, rx + rs * 1.2, gy + 4);
    g.closePath();
    g.fillStyle = C.stone;
    g.fill();
    g.save();
    g.clip();
    g.fillStyle = C.stoneShade;
    g.beginPath();
    g.ellipse(rx + rs * 0.7, gy, rs * 0.75, rs, 0.3, 0, TAU);
    g.fill();
    g.fillStyle = C.stoneLit;
    g.beginPath();
    g.ellipse(rx - rs * 0.45, gy - rs * 0.62, rs * 0.42, rs * 0.16, -0.4, 0, TAU);
    g.fill();
    g.restore();
    g.beginPath();
    g.moveTo(rx - rs, gy + 4);
    g.bezierCurveTo(rx - rs * 1.05, gy - rs * 0.9, rx + rs * 0.9, gy - rs * 1.15, rx + rs * 1.2, gy + 4);
    g.strokeStyle = C.rockLine;
    g.lineWidth = 1.8;
    g.stroke();
    const ry = gy - rs * 0.42;
    g.beginPath();
    g.moveTo(rx - rs * 0.98, ry + 2);
    g.quadraticCurveTo(rx + rs * 0.1, ry + rs * 0.22, rx + rs * 1.12, ry - 2);
    g.strokeStyle = C.ropeShade;
    g.lineWidth = 5;
    g.stroke();
    g.strokeStyle = C.rope;
    g.lineWidth = 3;
    g.stroke();
    shide(g, [0, 1, 2].map((i) => [rx - rs * 0.55 + i * rs * 0.62, ry + rs * 0.12 - i * 1.6 + 2]), clamp(rs * 0.5, 11, 18), C);
    // the stone lantern at the left
    lantern(g, lamp[0], lamp[1], lamp[2], Object.assign({}, C, { lit: o.dark }));
  }

  function fallLamp(G) {
    return [clamp(G.W * 0.085, 18, 60), G.gy + 1, clamp(G.gy * 0.11, 28, 48)];
  }

  // the walls and the floor in front, painted into a picture whose top left is (ox, oy) in the view, down to foot
  function paintFallFront(g, o, C, G, ox, oy, foot) {
    const { W, gy, bw } = G;
    g.translate(-ox, -oy);
    for (const side of [-1, 1]) {
      g.save();
      if (side > 0) {
        g.translate(W, 0);
        g.scale(-1, 1);
      }
      const seed = side < 0 ? 31 : 37;
      const reach = (y) => bw * (0.62 + 0.5 * noise(seed, y / 120) + 0.14 * noise(seed + 1, y / 30) + 0.5 * smooth(gy * 0.55, gy, y));
      const cliff = paintCliff(g, o, C, layersDown(-30, gy + 14, seed), reach, side > 0, { seed, pines: 0.25, snow: 0.5, tufts: true });
      if (side < 0 && cliff.lips.length > 4) {
        const a = cliff.lips[2];
        chain(g, C, a.x1 - 7, a.y + 5, (cliff.lips[4].y - a.y) * 0.85);
      }
      g.restore();
    }
    paintFloor(g, o, C, W, gy, foot, fallLamp(G));
  }

  // the warm light of a lantern at night, as a picture, drawn with a flicker
  function glowSprite(C, sc) {
    return kept('glow', 48, 48, sc, (g) => {
      const r = g.createRadialGradient(24, 24, 1, 24, 24, 24);
      r.addColorStop(0, rgba(C.lamp, 0.85));
      r.addColorStop(0.35, rgba(C.lamp, 0.35));
      r.addColorStop(1, rgba(C.lamp, 0));
      g.fillStyle = r;
      g.fillRect(0, 0, 48, 48);
    });
  }

  function fall(ctx, o, C) {
    const G = fallGeo(o);
    const { W, H, gy, hz } = G;
    const sc = scaleOf(ctx);
    scene(['fall', o.dark, o.season, Math.round(W), Math.round(H), Math.round(gy), sc.toFixed(2)].join('|'));
    drawn();
    warmUp(ctx);
    put(ctx, kept('back', W, H, sc, (g) => paintFallBack(g, o, C, G)), 0, 0);
    if (o.dark) twinkle(ctx, C, W, hz, o.t, (x) => G.clear(x) - 2, 311);
    // the sun (the moon), climbing a little as the round goes on: a red disc by day, as the morning's
    orb(ctx, C, G.sx, G.sy - Math.min(30, G.R * 1.4) * clamp(o.progress || 0, 0, 1), G.R, o.dark, 1, !o.dark);
    if (!o.dark) birds(ctx, C, W, hz * 0.34, o.t, 3);
    // two clouds drifting across, in front of the peak
    for (let k = 0; k < 2; k++) {
      const w = clamp(W * (0.26 - 0.06 * k), 50, 150);
      const x = wrap(o.t * (4 + 2.5 * k) + k * W * 0.55 + 40, W + w + 30) - w - 15;
      put(ctx, kumoSprite(C, sc, k, w), x, k ? hz - G.Hm * 0.16 - w * 0.34 : hz - G.Hm * 0.5);
    }
    // the walls and the floor, in front: three pictures (the left wall, the right wall, the floor's strip, each on whole
    // pixels), so the open gap is not painted over and a frame's pictures stay small; under the dock, plain earth
    const px = (v) => Math.floor(v * sc) / sc;
    const side = Math.min(W / 2, Math.ceil(G.bw * 2.4 + clamp(W * 0.1, 20, 40)));
    const xr = px(W - side);
    const cut = px(gy - clamp(gy * 0.14, 34, 60));
    const foot = Math.ceil(gy + 40);
    const front = (key, x, y, w, h) => put(ctx, kept(key, w, h, sc, (g) => paintFallFront(g, o, C, G, x, y, foot)), x, y);
    front('frontL', 0, 0, side, cut);
    front('frontR', xr, 0, W - xr, cut);
    front('frontB', 0, cut, W, foot - cut);
    if (foot < H) {
      ctx.fillStyle = C.earth;
      ctx.fillRect(0, foot - 0.5, W, H - foot + 1);
    }
    if (o.dark) {
      const [lx, ly, ls] = fallLamp(G);
      const [wx, wy] = lanternLight(lx, ly, ls);
      const f = o.still ? 1 : 0.82 + 0.12 * Math.sin(o.t * 9) + 0.06 * Math.sin(o.t * 23);
      ctx.globalAlpha = f;
      const s = ls * 1.5 * (0.95 + 0.05 * f);
      ctx.drawImage(glowSprite(C, sc), wx - s / 2, wy - s / 2, s, s);
      ctx.globalAlpha = 1;
    }
    drift(ctx, o, C, W, gy + 20, 0);
  }

  // ---------- Climb: up the crevice ----------

  // the summit's moment, kept between frames: when Yaoki got there (summit() sees it; back() uses it next frame)
  const SUMMIT = { reached: false, at: 0 };

  function climbGeo(o) {
    const { W, H } = o;
    const hz = H * 0.62;
    const px = W / 2 + clamp(W * 0.1, 18, 90);
    const py = H * 0.4;
    const Hm = hz - py;
    const hw = Math.max(Hm * 1.7, W * 0.3);
    const prof = profile(px, py, hw, Hm);
    const sides = [-1, 1].map((s) => profile(px + s * hw * 1.05, py + Hm * 0.4, hw * 0.62, Hm * 0.6));
    const mid = clamp(W * 0.25, 50, 200);
    // the far range's picture: from just above the great peak down to the foot of the view, and across only between the
    // far walls' innermost reach (they always cover the rest), so a frame's pictures stay small
    const fx0 = Math.floor(mid * 0.36);
    const fy0 = Math.floor(py - Hm * 0.1);
    return {
      clear: (x) => Math.min(hz - 10, prof(x), sides[0](x), sides[1](x)),
      W, H, hz, px, py, Hm, hw, sink: H * 0.24, fx0, fy0, fw: W - 2 * fx0, fh: H + 10 - fy0,
      R: clamp(W * 0.075, 14, 32), mx: W / 2 - clamp(W * 0.25, 50, 200), my: Math.max(H * 0.2, 64),
      near: clamp(W * 0.13, 26, 110), mid, prof,
    };
  }

  // the far range over its sea of clouds, painted in the view's units (its picture's origin is at fx0, fy0)
  function paintClimbFar(g, o, C, G) {
    const { W, H, hz } = G;
    g.translate(-G.fx0, -G.fy0);
    for (const side of [-1, 1]) paintPeak(g, C, G.px + side * G.hw * 1.05, G.py + G.Hm * 0.4, G.hw * 0.62, G.Hm * 0.6, hz + 20, 150 + side, 0.5);
    paintPeak(g, C, G.px, G.py, G.hw, G.Hm, hz + 20, 130, 0.2);
    const r = clamp(W * 0.034, 7, 16);
    const rows = [[hz - 14, r, 17, 0], [hz + 8, r * 1.35, 19, 0], [hz + 52, r * 1.7, 23, 1]];
    for (const [y, rad, seed, deep] of rows) {
      const grad = g.createLinearGradient(0, y, 0, y + rad * 3.4);
      grad.addColorStop(0, deep ? mix(C.cloud, C.cloudFoot, 0.4) : o.dark ? C.cloudLit : mix(C.cloud, C.cloudLit, 0.5));
      grad.addColorStop(0.45, deep ? mix(C.cloud, C.cloudFoot, 0.6) : C.cloud);
      grad.addColorStop(1, deep ? mix(C.cloudFoot, C.peakShade, 0.3) : C.cloudFoot);
      cloudBank(g, -10, W + 10, y, H * 1.3 - y, rad, seed, grad, C.cloudLine, 1.2);
    }
  }
  // the stars of the night sky, a small picture laid over the sky again and again (the far range covers those below it)
  function starTile(o, C, sc) {
    return kept('stars', 150, 150, sc, (g) => starField(g, C, 150, 0, 150, () => 150, 401, 26));
  }

  // the far walls' colours: the near ones', paler and bluer with the air between
  const FARS = new Map();
  function farWall(C) {
    let F = FARS.get(C);
    if (!F) {
      F = Object.assign({}, C, {
        rock: mix(C.rock, C.far, 0.55), rockShade: mix(C.rockShade, C.farShade, 0.5), rockLit: mix(C.rockLit, C.far, 0.42),
        rockLine: mix(C.rockLine, C.farLine, 0.55), strata: mix(C.strata, C.far, 0.5), snow: mix(C.snow, C.far, 0.12),
      });
      FARS.set(C, F);
    }
    return F;
  }

  // A wall that tiles upwards, P units a round (a whole number of pixels, so the rounds meet without a seam), its
  // picture as narrow as what is in it: the cliff reaches out to about 1.45 reach, a pine (on a lip no further out than
  // reach) about 1.45 of its size more.
  function wallTile(o, C, G, sc, near, side) {
    const P = Math.round((near ? 480 : 400) * sc) / sc;
    const reach = near ? G.near : G.mid;
    const pineW = clamp(G.W * 0.09, 18, 34) * 1.2;
    const w = Math.ceil(near ? Math.max(reach * 1.45, reach + pineW * 1.45) + 4 : reach * 1.45 + 6);
    const seed = (near ? 60 : 70) + (side < 0 ? 0 : 5);
    const c = kept((near ? 'near' : 'mid') + side, w, P, sc, (g) => {
      if (side > 0) {
        g.translate(w, 0);
        g.scale(-1, 1);
      }
      const Cw = near ? C : farWall(C);
      const at = (y) => (wrap(y, P) / P);
      const reachAt = (y) => reach * (0.62 + 0.5 * pnoise(seed + 1, at(y) * 4, 4) + 0.14 * pnoise(seed + 2, at(y) * 16, 16));
      const cliff = paintCliff(g, o, Cw, layersRound(P, seed), reachAt, side > 0, { seed, line: near ? 2.3 : 1.5, pines: near ? 0.3 : 0, pineMax: reach, snow: near ? 0.45 : 0.6, tufts: near });
      if (!near && side < 0) {
        // a thin fall of water down the far wall's face, the whole way (so it meets itself round after round), on the
        // rock only, past the near wall's edge
        const fx = reach * 0.75;
        const rock = new Path2D();
        rock.moveTo(-10, cliff.pts[0][1]);
        for (const p of cliff.pts) rock.lineTo(p[0] - 2, p[1]);
        rock.lineTo(-10, cliff.pts[cliff.pts.length - 1][1]);
        rock.closePath();
        g.save();
        g.clip(rock);
        g.beginPath();
        g.moveTo(fx - 2.5, -2);
        for (let y = 0; y <= P; y += P / 60) g.lineTo(fx - 2.5 - 1.4 * Math.sin((y / P) * TAU * 6), y);
        for (let y = P; y >= 0; y -= P / 60) g.lineTo(fx + 2.5 + 1.4 * Math.sin((y / P) * TAU * 5 + 1), y);
        g.closePath();
        g.fillStyle = rgba(C.snow, 0.8);
        g.fill();
        g.beginPath();
        for (let y = 0; y < P; y += P / 30) {
          g.moveTo(fx - 0.5, y);
          g.lineTo(fx - 0.5, y + P / 60);
        }
        g.strokeStyle = rgba(C.cloudFoot, 0.9);
        g.lineWidth = 1;
        g.stroke();
        g.restore();
      }
      if (near && side < 0) {
        const a = cliff.lips.find((p) => p.y > 40);
        if (a) chain(g, C, a.x1 - 7, a.y + 5, 150);
      }
    });
    return { c, P, x: side < 0 ? 0 : G.W - w };
  }
  function tiles(ctx, T, y0, H) {
    for (let ty = -wrap(y0, T.P); ty < H; ty += T.P) put(ctx, T.c, T.x, ty);
  }

  function kumoSprite(C, sc, k, w) {
    const h = w * 0.34;
    // (its puffs reach past its width: the picture has room round it, and it is drawn that much further left)
    const pad = w * 0.16 + 4;
    return kept('kumo' + k + '|' + Math.round(w), w + 2 * pad, h + 8, sc, (g) => {
      const grad = g.createLinearGradient(0, 4, 0, h + 4);
      grad.addColorStop(0, C.cloud);
      grad.addColorStop(0.6, C.cloud);
      grad.addColorStop(1, C.cloudFoot);
      kumo(g, pad, h + 3, w, h, 90 + k, grad, C.cloudLine, 1.2);
    });
  }
  // The sun (the moon at night), drawn each frame: its halo, its ring, its disc. red: the morning's red disc
  // (Falling); otherwise a pale one (the top, where Yaoki stands in front of it), ringed in vermilion by day.
  function orb(ctx, C, x, y, R, dark, a, red) {
    if (y < -R * 4) return;
    ctx.globalAlpha = a;
    // its halo in rings, as a print shows it (and cheap: no picture scaled up over a large part of the screen); by day
    // tighter and fainter, or the blue sky turns them grey
    const rings = dark ? [[3.1, 0.08], [2.3, 0.1], [1.65, 0.14]] : [[2.1, 0.12], [1.5, 0.22]];
    for (const [k, alpha] of rings) {
      ctx.beginPath();
      ctx.arc(x, y, R * k, 0, TAU);
      ctx.fillStyle = rgba(C.glow, alpha);
      ctx.fill();
    }
    if (!red) {
      ctx.beginPath();
      ctx.arc(x, y, dark ? R * 1.55 : R + 6, 0, TAU);
      ctx.strokeStyle = dark ? rgba(C.glow, 0.35) : C.sun;
      ctx.lineWidth = dark ? 1.5 : 2.5;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(x, y, R, 0, TAU);
    ctx.fillStyle = red ? C.sun : C.disc;
    ctx.fill();
    ctx.strokeStyle = dark ? rgba('#FFFFFF', 0.7) : C.sunRim;
    ctx.lineWidth = dark ? 2 : 3;
    ctx.stroke();
    if (dark) {
      ctx.beginPath();
      for (const [dx, dy, r] of [[-0.3, -0.2, 0.28], [0.25, 0.15, 0.22], [-0.05, 0.42, 0.16]]) {
        ctx.moveTo(x + (dx + r) * R, y + dy * R);
        ctx.arc(x + dx * R, y + dy * R, r * R, 0, TAU);
      }
      ctx.fillStyle = rgba('#C9B98E', 0.35);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // A sky in fine bands from y0 to y1 (bokashi in steps of about 9 units), its colours along stops [[at, colour], ...]:
  // solid bands cost a phone without a GPU a twentieth of a gradient over the screen, and look the same on one with it.
  function skyBands(ctx, W, y0, y1, stops) {
    const n = Math.max(8, Math.ceil((y1 - y0) / 9));
    const step = (y1 - y0) / n;
    let j = 0;
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n;
      while (j < stops.length - 2 && u > stops[j + 1][0]) j++;
      const [a0, c0] = stops[j];
      const [a1, c1] = stops[j + 1];
      ctx.fillStyle = mix(c0, c1, (u - a0) / Math.max(1e-6, a1 - a0));
      ctx.fillRect(0, y0 + step * i, W, step + 0.6);
    }
  }

  // rays from (x, y), turning slowly once he is at the top
  function rays(ctx, x, y, R, L, n, spin, color) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = spin + (i / n) * TAU;
      const b = a + (TAU / n) * 0.42;
      ctx.moveTo(x + Math.cos(a) * R, y + Math.sin(a) * R);
      ctx.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L);
      ctx.lineTo(x + Math.cos(b) * L, y + Math.sin(b) * L);
      ctx.lineTo(x + Math.cos(b) * R, y + Math.sin(b) * R);
      ctx.closePath();
    }
    ctx.fillStyle = color;
    ctx.fill();
  }

  function climb(ctx, o, C) {
    const G = climbGeo(o);
    const { W, H } = G;
    const y0 = o.y0;
    const sc = scaleOf(ctx);
    scene(['climb', o.dark, o.season, Math.round(W), Math.round(H), sc.toFixed(2)].join('|'));
    drawn();
    warmUp(ctx);
    // the summit's picture, painted with the rest at the start rather than as it comes into view near the top
    summitPic(C, W, o.season, sc);
    const sTop = o.top - y0;
    const dawn = smooth(-H * 1.4, H * 0.3, sTop);
    const show = smooth(-H * 0.7, H * 0.25, sTop);
    const shift = G.sink * dawn;
    // the sky, deeper low in the crevice, warming towards the top, its horizon at the top once it is in view
    const end = Math.max(H * 0.3, G.hz + shift + (sTop - 6 - G.hz - shift) * show);
    // (at the top the dawn's warm bands take more of the sky, so the sun rises in gold)
    const at = [0, 0.16, 0.24, 0.5, 0.72, 0.88, 1];
    const atTop = [0, 0.1, 0.17, 0.34, 0.52, 0.74, 1];
    const idx = [0, 0, 1, 2, 3, 4, 5];
    const stops = at.map((a, i) => [a + (atTop[i] - a) * show, mix(C.deep[idx[i]], C.sky[idx[i]], dawn)]);
    // (only down to where the far range's clouds cover it, past the dips between their scallops)
    const bottom = Math.min(H, G.hz + shift + 14);
    skyBands(ctx, W, 0, Math.min(end, bottom), stops);
    if (end < bottom) {
      ctx.fillStyle = stops[stops.length - 1][1];
      ctx.fillRect(0, end, W, bottom - end);
    }
    // at night the stars, laid over the sky down to the far range
    if (o.dark) {
      const st = starTile(o, C, sc);
      for (let ty = 0; ty < G.fy0 + shift; ty += 150) for (let tx = 0; tx < W; tx += 150) put(ctx, st, tx, ty);
    }
    // the far range sinks a little as the top comes near (it is lower than the top)
    put(ctx, kept('far', G.fw, G.fh, sc, (g) => paintClimbFar(g, o, C, G)), G.fx0, G.fy0 + shift);
    if (o.dark) twinkle(ctx, C, W, (G.hz + shift) * 0.85, o.t, (x) => G.clear(x) + shift, 411);
    // the sun rises behind the top as it comes near; at night the moon, high on the left, comes over it
    const R = o.dark ? G.R + (clamp(W * 0.12, 26, 64) - G.R) * show : clamp(W * 0.14, 30, 76);
    const ox = W / 2;
    const oy = sTop - clamp(H * 0.2, 64, 140);
    const spin = SUMMIT.reached && !o.still ? (o.t - SUMMIT.at) * 0.12 : 0;
    // (the rays lighten the sky, 'screen', never grey it; warm near it, paler and fainter further out)
    const fan = (x, y, color, a) => {
      const L = Math.max(W, H) * 1.15;
      const n = o.dark ? 14 : 16;
      ctx.globalCompositeOperation = 'screen';
      rays(ctx, x, y, R * 1.25, L * 0.42, n, spin, rgba(color, a));
      rays(ctx, x, y, L * 0.42, L, n, spin, rgba('#DCE8FF', a * 0.45));
      ctx.globalCompositeOperation = 'source-over';
    };
    if (o.dark) {
      const mx = G.mx + (ox - G.mx) * show;
      const my = G.my + (oy - G.my) * show;
      if (show > 0) fan(mx, my, C.glow, 0.2 * show);
      orb(ctx, C, mx, my, R, true, 1);
    } else if (show > 0) {
      fan(ox, oy, '#FFF0C0', 0.42 * show);
      orb(ctx, C, ox, oy, R, false, show);
    }
    // clouds between, drifting across and down past as he climbs
    for (let k = 0; k < 2; k++) {
      const w = clamp(W * (0.3 + 0.08 * k), 70, 150);
      const x = wrap(o.t * (5 + 3 * k) + k * 150, W + w + 20) - w - 10;
      const y = wrap(k * 230 + 70 - y0 * 0.3, H + 160) - 80;
      put(ctx, kumoSprite(C, sc, k, w), x, y);
    }
    if (!o.dark) birds(ctx, C, W, H * 0.24 + 6 * Math.sin(o.t * 0.4), o.t, 3);
    // the walls: the far ones at half the speed of the near ones; they end where the top begins
    // (the clip on whole pixels, so it needs no smoothing)
    const cut = Math.round((sTop + 30) * sc) / sc;
    if (cut < H) {
      ctx.save();
      if (cut > 0) {
        ctx.beginPath();
        ctx.rect(0, cut, Math.ceil(W * sc) / sc, Math.ceil((H - cut) * sc) / sc);
        ctx.clip();
      }
      for (const side of [-1, 1]) tiles(ctx, wallTile(o, C, G, sc, false, side), y0 * 0.45, H);
      for (const side of [-1, 1]) tiles(ctx, wallTile(o, C, G, sc, true, side), y0, H);
      ctx.restore();
    }
    // the floor of the crevice, at the start: its picture a little deeper than its snow and stones, plain earth below
    const fy = -y0 - FLOOR_UP;
    if (fy < H) {
      const fh = FLOOR_UP + 64;
      put(ctx, kept('floor', W, fh, sc, (g) => paintFloor(g, o, C, W, FLOOR_UP, fh, climbLamp(G))), 0, fy);
      if (fy + fh < H) {
        ctx.fillStyle = C.earth;
        ctx.fillRect(0, fy + fh - 1, W, H - fy - fh + 1);
      }
      if (o.dark) {
        const [lx, ly, ls] = climbLamp(G);
        const [wx, wy] = lanternLight(lx, ly + fy, ls);
        const f = o.still ? 1 : 0.82 + 0.12 * Math.sin(o.t * 9) + 0.06 * Math.sin(o.t * 23);
        ctx.globalAlpha = f;
        ctx.drawImage(glowSprite(C, sc), wx - ls * 0.75, wy - ls * 0.75, ls * 1.5, ls * 1.5);
        ctx.globalAlpha = 1;
      }
    }
    drift(ctx, o, C, W, H, -y0 * 0.9);
  }
  const FLOOR_UP = 70;
  const climbLamp = (G) => [clamp(G.W * 0.085, 18, 60), FLOOR_UP + 1, clamp(G.H * 0.09, 28, 44)];

  // ---------- Climb's ledges: chunky slabs out of the wall, snow on top ----------
  // The sign hangs from y + 12 down, over the slab's face: the top (lit, snowy) shows above it, the rest at its sides.

  function ledge(ctx, o, C) {
    const { x, y, w, side, W } = o;
    const n = o.n | 0;
    ctx.save();
    let lx = x;
    if (side > 0) {
      ctx.translate(W, 0);
      ctx.scale(-1, 1);
      lx = W - x;
    }
    const tip = lx + w / 2 + 8;
    const wall = -10;
    const th = 15 + 4 * hash(201, n);
    const deep = 32 + 8 * hash(202, n);
    const p = new Path2D();
    p.moveTo(wall, y - 1);
    p.lineTo(tip - 9, y - 0.5);
    p.quadraticCurveTo(tip + 1, y, tip + 1.5, y + 6);
    p.lineTo(tip - 2, y + th);
    p.lineTo(tip - 13, y + th + 4);
    p.quadraticCurveTo((tip + wall) / 2, y + deep * 0.85, wall, y + deep);
    p.closePath();
    // its hard shadow on the wall behind, then the slab
    ctx.save();
    ctx.translate(3, 4);
    ctx.fillStyle = rgba(C.rockLine, 0.45);
    ctx.fill(p);
    ctx.restore();
    ctx.fillStyle = C.rock;
    ctx.fill(p);
    // (its bands follow its own outline, which is drawn over their edges: no clipping, which is dear to draw)
    // in shade below, along the same curve as its underside
    ctx.beginPath();
    ctx.moveTo(wall, y + th - 3);
    ctx.lineTo(tip - 1.2, y + th - 3);
    ctx.lineTo(tip - 2, y + th);
    ctx.lineTo(tip - 13, y + th + 4);
    ctx.quadraticCurveTo((tip + wall) / 2, y + deep * 0.85, wall, y + deep);
    ctx.closePath();
    ctx.fillStyle = C.rockShade;
    ctx.fill();
    // the light on its top, out towards the tip
    const lit0 = tip - (tip - wall) * (0.45 + 0.2 * hash(206, n));
    ctx.beginPath();
    ctx.moveTo(lit0, y - 0.9);
    ctx.lineTo(tip - 9, y - 0.5);
    ctx.lineTo(tip - 2, y + 0.4);
    ctx.lineTo(tip - 1, y + 3.4);
    ctx.lineTo(lit0 + 6, y + 3.4);
    ctx.closePath();
    ctx.fillStyle = C.rockLit;
    ctx.fill();
    // its end, lit on the right wall (it faces the light), in shade on the left
    ctx.beginPath();
    ctx.moveTo(tip + 1.5, y + 6);
    ctx.lineTo(tip - 2, y + th);
    ctx.lineTo(tip - 6, y + th);
    ctx.lineTo(tip - 2.5, y + 5);
    ctx.closePath();
    ctx.fillStyle = side > 0 ? C.rockLit : C.rockShade;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(wall, y + 8 + 2 * hash(203, n));
    ctx.lineTo(tip - 16 - 10 * hash(204, n), y + 9);
    ctx.strokeStyle = C.strata;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = C.rockLine;
    ctx.lineWidth = 2.4;
    ctx.stroke(p);
    // snow on its top towards the tip, and the season's tuft by the wall
    ctx.beginPath();
    snowOn(ctx, tip - 24 - 10 * hash(205, n), tip + 1.5, y - 0.5, 3.4, 220 + n);
    ctx.fillStyle = C.snow;
    ctx.fill();
    ctx.lineWidth = 1.3;
    ctx.stroke();
    const tx = Math.max(6, lx - w / 2 - 14);
    ctx.beginPath();
    for (let j = 0; j < 3; j++) {
      const cx = tx + (j - 1) * 3.6;
      const cy = y - 2.2 - (j === 1 ? 2 : 0);
      ctx.moveTo(cx + 3, cy);
      ctx.arc(cx, cy, 3, 0, TAU);
    }
    const [tuft, tuftLine] = tuftOf(C, o.season);
    ctx.fillStyle = tuft;
    ctx.fill();
    ctx.strokeStyle = tuftLine;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  // ---------- the top: a snowy crown of rock with a torii and a flag; the sun rises behind it ----------

  function paintSummit(g, C, W, S, season) {
    const X = (x) => x + 10;
    const top = [[-8, -26], [W * 0.06, -34], [W * 0.12, -21], [W * 0.17, -6], [W * 0.21, 0], [W * 0.5, 0], [W * 0.79, 0], [W * 0.83, -6], [W * 0.88, -30], [W * 0.95, -39], [W + 8, -25]];
    // behind it, the sea of clouds at the eye's level, lit from above
    const cg = g.createLinearGradient(0, S - 28, 0, S + 24);
    cg.addColorStop(0, C.cloudLit);
    cg.addColorStop(0.5, C.cloud);
    cg.addColorStop(1, C.cloudFoot);
    cloudBank(g, X(-10), X(W + 10), S - 28, 80, clamp(W * 0.04, 8, 18), 351, cg, C.cloudLine, 1.2);
    const body = new Path2D();
    body.moveTo(X(-8), S + 90);
    for (const [x, dy] of top) body.lineTo(X(x), S + dy);
    body.lineTo(X(W + 8), S + 90);
    for (let x = W + 8; x > -8; x -= 13) body.lineTo(X(x), S + 64 + 14 * hash(311, Math.round(x)));
    body.closePath();
    g.save();
    g.translate(3, 4);
    g.fillStyle = rgba(C.rockLine, 0.4);
    g.fill(body);
    g.restore();
    g.fillStyle = C.rock;
    g.fill(body);
    g.save();
    g.clip(body);
    // lit along its top, in shade below, layered
    g.beginPath();
    for (const [x, dy] of top) g.lineTo(X(x), S + dy);
    g.strokeStyle = C.rockLit;
    g.lineWidth = 12;
    g.stroke();
    // in shade below a jagged line; ravines down its face, a few with snow in them
    g.beginPath();
    g.moveTo(0, S + 100);
    for (let x = 0; x <= W + 20; x += 12) g.lineTo(x, S + 34 + 12 * hash(316, Math.round(x)) + (x % 24 ? 6 : 0));
    g.lineTo(W + 20, S + 100);
    g.closePath();
    g.fillStyle = C.rockShade;
    g.fill();
    const n = Math.max(4, Math.round(W / 34));
    const cracks = new Path2D();
    const snowy = new Path2D();
    for (let k = 0; k < n; k++) {
      const x = X((W * (k + 0.3 + 0.4 * hash(317, k))) / n);
      const len = 18 + 26 * hash(318, k);
      cracks.moveTo(x, S + 7);
      cracks.lineTo(x + 3, S + 7 + len * 0.4);
      cracks.lineTo(x - 1, S + 7 + len * 0.7);
      cracks.lineTo(x + 2, S + 7 + len);
      if (hash(319, k) < 0.45) {
        snowy.moveTo(x - 3, S + 6);
        snowy.lineTo(x + 4, S + 6);
        snowy.lineTo(x + 2.5, S + 7 + len * 0.45);
        snowy.lineTo(x + 1, S + 7 + len * 0.5);
        snowy.closePath();
      }
    }
    g.fillStyle = C.snow;
    g.fill(snowy);
    g.strokeStyle = rgba(C.rockLine, 0.75);
    g.lineWidth = 1.2;
    g.stroke(cracks);
    g.restore();
    g.strokeStyle = C.rockLine;
    g.lineWidth = 2.6;
    g.stroke(body);
    // snow: a mantle over the top, caps on the crags
    g.beginPath();
    snowOn(g, X(W * 0.15), X(W * 0.85), S, 5, 330);
    g.moveTo(X(W * 0.03), S - 30);
    snowOn(g, X(W * 0.01), X(W * 0.12), S - 31, 4, 331);
    snowOn(g, X(W * 0.89), X(W * 1.01), S - 33, 4, 332);
    g.fillStyle = C.snow;
    g.fill();
    g.lineWidth = 1.4;
    g.stroke();
    // the torii, its rope and paper streamers
    const tx = X(W * 0.25);
    const h = clamp(W * 0.13, 30, 60);
    const a = h * 0.36;
    g.beginPath();
    g.rect(tx - a - 2, S - h * 0.86, 4, h * 0.86 + 2);
    g.rect(tx + a - 2, S - h * 0.86, 4, h * 0.86 + 2);
    g.rect(tx - a - 6, S - h * 0.7, 2 * a + 12, 3.4);
    g.fillStyle = C.torii;
    g.fill();
    g.strokeStyle = C.rockLine;
    g.lineWidth = 1.4;
    g.stroke();
    g.beginPath();
    g.moveTo(tx - a - 11, S - h * 0.9);
    g.quadraticCurveTo(tx, S - h * 0.84, tx + a + 11, S - h * 0.9);
    g.lineTo(tx + a + 12, S - h * 1.02);
    g.quadraticCurveTo(tx, S - h * 0.93, tx - a - 12, S - h * 1.02);
    g.closePath();
    g.fillStyle = C.rockLine;
    g.fill();
    g.beginPath();
    g.moveTo(tx - a - 9, S - h * 0.84);
    g.quadraticCurveTo(tx, S - h * 0.78, tx + a + 9, S - h * 0.84);
    g.lineTo(tx + a + 8, S - h * 0.9);
    g.quadraticCurveTo(tx, S - h * 0.85, tx - a - 8, S - h * 0.9);
    g.closePath();
    g.fillStyle = C.torii;
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(tx - a + 2, S - h * 0.6);
    g.quadraticCurveTo(tx, S - h * 0.48, tx + a - 2, S - h * 0.6);
    g.strokeStyle = C.ropeShade;
    g.lineWidth = 3.4;
    g.stroke();
    g.strokeStyle = C.rope;
    g.lineWidth = 2;
    g.stroke();
    shide(g, [-0.5, 0, 0.5].map((k) => [tx + k * a - 1.2, S - h * (0.55 - Math.abs(k) * 0.05)]), clamp(h * 0.3, 9, 16), C);
    // the flag's pole, with its gold top
    const fx = X(W * 0.76);
    const fh = clamp(W * 0.24, 56, 110);
    g.beginPath();
    g.moveTo(fx, S + 2);
    g.lineTo(fx, S - fh);
    g.strokeStyle = C.rockLine;
    g.lineWidth = 2.6;
    g.stroke();
    g.beginPath();
    g.arc(fx, S - fh - 2.5, 3, 0, TAU);
    g.fillStyle = '#F2B43A';
    g.fill();
    g.lineWidth = 1.2;
    g.stroke();
  }

  // a Japanese crane, gliding (x, y: its body; f: its wings, -1 down to 1 up)
  function crane(ctx, x, y, s, f, dark) {
    // its neck and head forward, its legs trailing
    ctx.beginPath();
    ctx.moveTo(x + s * 0.5, y - s * 0.05);
    ctx.lineTo(x + s * 1.55, y - s * 0.28);
    ctx.moveTo(x - s * 0.6, y + s * 0.1);
    ctx.lineTo(x - s * 1.75, y + s * 0.36);
    ctx.strokeStyle = '#1B2440';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    // its body and wing, white, the wing's end black
    const wy = y - f * s * 1.4;
    const tip = [x - s * 1.15, wy];
    ctx.beginPath();
    ctx.moveTo(x + s * 0.75, y);
    ctx.ellipse(x, y, s * 0.75, s * 0.26, -0.06, 0, TAU);
    ctx.moveTo(x + s * 0.35, y);
    ctx.quadraticCurveTo(x - s * 0.3, wy + (y - wy) * 0.15, tip[0], tip[1]);
    ctx.lineTo(x - s * 0.75, wy + (y - wy) * 0.45);
    ctx.quadraticCurveTo(x - s * 0.3, y, x - s * 0.35, y);
    ctx.closePath();
    ctx.fillStyle = dark ? '#E3E9FA' : '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(tip[0], tip[1]);
    ctx.lineTo(x - s * 0.88, wy + (y - wy) * 0.18);
    ctx.lineTo(x - s * 0.75, wy + (y - wy) * 0.45);
    ctx.closePath();
    ctx.fillStyle = '#1B2440';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + s * 1.5, y - s * 0.3, s * 0.17, 0, TAU);
    ctx.fillStyle = '#E2452B';
    ctx.fill();
  }

  // its picture as tall as what stands on it (the flag's pole, the torii, the crags) and as deep as it is
  function summitSize(W) {
    const fh = clamp(W * 0.24, 56, 110);
    return { fh, S: Math.ceil(Math.max(fh + 9, clamp(W * 0.13, 30, 60) * 1.05 + 6, 46)) };
  }
  function summitPic(C, W, season, sc) {
    const { S } = summitSize(W);
    return kept('summit', W + 20, S + 100, sc, (g) => paintSummit(g, C, W, S, season));
  }

  function summit(ctx, o, C) {
    const { W, y } = o;
    const t = o.t || 0;
    if (o.reached && !SUMMIT.reached) SUMMIT.at = t;
    SUMMIT.reached = !!o.reached;
    // drawn only when it is in view
    let m = null;
    try {
      m = ctx.getTransform();
    } catch (err) {
      m = null;
    }
    if (m && ctx.canvas && m.d > 0) {
      const a = m.f + (y - 170) * m.d;
      const b = m.f + (y + 100) * m.d;
      if (b < 0 || a > ctx.canvas.height) return;
    }
    const sc = scaleOf(ctx);
    const { fh, S } = summitSize(W);
    put(ctx, summitPic(C, W, o.season, sc), -10, y - S);
    // the flag, waving
    const fx = W * 0.76;
    const len = clamp(W * 0.14, 30, 60);
    const e = SUMMIT.reached ? t - SUMMIT.at : 0;
    const k = o.still ? 0 : SUMMIT.reached ? 1.6 : 1;
    const wave = (u) => (o.still ? 0 : Math.sin(t * 5 * k - u * 4) * 3 * u);
    ctx.beginPath();
    ctx.moveTo(fx, y - fh + 1);
    for (let i = 1; i <= 6; i++) ctx.lineTo(fx + (len * i) / 6, y - fh + 1 + wave(i / 6) + i * 0.4);
    ctx.lineTo(fx + len * 0.78, y - fh + len * 0.32 + wave(0.8));
    ctx.lineTo(fx + len, y - fh + len * 0.62 + wave(1));
    for (let i = 6; i >= 0; i--) ctx.lineTo(fx + (len * i) / 6, y - fh + len * 0.62 * (0.75 + 0.25 * (i / 6)) + wave(i / 6));
    ctx.closePath();
    ctx.fillStyle = '#E2452B';
    ctx.fill();
    ctx.strokeStyle = C.rockLine;
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(fx + len * 0.36, y - fh + len * 0.3 + wave(0.36), len * 0.13, 0, TAU);
    ctx.fillStyle = '#F2B43A';
    ctx.fill();
    // at night, the torii's lantern-light
    if (o.dark) {
      const f = o.still ? 1 : 0.85 + 0.1 * Math.sin(t * 8) + 0.05 * Math.sin(t * 21);
      const h = clamp(W * 0.13, 30, 60);
      ctx.globalAlpha = f * 0.9;
      const s = h * 1.4;
      ctx.drawImage(glowSprite(C, sc), W * 0.25 - s / 2, y - h * 0.62 - s / 2, s, s);
      ctx.globalAlpha = 1;
    }
    if (!SUMMIT.reached) return;
    // there: sparkles round the top, and two cranes going over
    const cx = W / 2;
    const cy = y - clamp(W * 0.36, 80, 150);
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU + 0.3;
      const rad = clamp(W * 0.3, 60, 170) * (0.7 + 0.35 * hash(341, i));
      const tw = o.still ? 0.7 : Math.max(0, Math.sin(e * 3.4 + i * 1.7));
      const r = 1 + 4 * tw * Math.min(1, e * 2 + (o.still ? 1 : 0));
      const sx = cx + Math.cos(a) * rad;
      const sy = cy + Math.sin(a) * rad * 0.7;
      ctx.moveTo(sx - r, sy);
      ctx.lineTo(sx - r * 0.2, sy - r * 0.2);
      ctx.lineTo(sx, sy - r);
      ctx.lineTo(sx + r * 0.2, sy - r * 0.2);
      ctx.lineTo(sx + r, sy);
      ctx.lineTo(sx + r * 0.2, sy + r * 0.2);
      ctx.lineTo(sx, sy + r);
      ctx.lineTo(sx - r * 0.2, sy + r * 0.2);
      ctx.closePath();
    }
    ctx.fillStyle = o.dark ? '#FFF1C4' : '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = '#F2B43A';
    ctx.lineWidth = 1;
    ctx.stroke();
    for (let i = 0; i < 2; i++) {
      const x = wrap(e * (24 + 6 * i) + i * 110 - 40, W + 120) - 60;
      crane(ctx, x, cy - 30 + i * 26 + 4 * Math.sin(e * 1.3 + i), clamp(W * 0.03, 7, 12), o.still ? 0.3 : Math.sin(e * 4.2 + i * 2), o.dark);
    }
  }

  // ---------- the falling things: cut stones ----------
  // A stone round the word's box: a cream face where the word is (never anything else there), facets round it in three
  // tones lit from the upper left, snow on its top, a crack or two, a hard shadow; the one to say has a gold ring.

  const SHAPES = new Map();
  function stoneShape(n, w, h) {
    const key = n + '|' + Math.round(w) + 'x' + Math.round(h);
    let s = SHAPES.get(key);
    if (s) return s;
    if (SHAPES.size > 48) SHAPES.clear();
    // the face: an octagon 4.5 out from the word's box, its corners cut, its sides in pieces of about 24
    const m = 4.5;
    const cut = 7;
    const corners = [[-m + cut, -m], [w + m - cut, -m], [w + m, -m + cut], [w + m, h + m - cut], [w + m - cut, h + m], [-m + cut, h + m], [-m, h + m - cut], [-m, -m + cut]];
    const face = [];
    const ends = [];
    for (let i = 0; i < 8; i++) {
      const a = corners[i];
      const b = corners[(i + 1) % 8];
      const k = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 24));
      ends.push(face.length);
      for (let j = 0; j < k; j++) face.push([a[0] + ((b[0] - a[0]) * j) / k, a[1] + ((b[1] - a[1]) * j) / k]);
    }
    const N = face.length;
    // each point's outward normal (the polygon goes clockwise on the screen)
    const nrm = face.map((p, i) => {
      const a = face[(i + N - 1) % N];
      const b = face[(i + 1) % N];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return [(b[1] - a[1]) / l, -(b[0] - a[0]) / l];
    });
    // the stone: each point of the face pushed out 8 to 12, and down right a little, for its depth
    const out = face.map((p, i) => {
      const by = 8 + 4 * hash(720 + n, i);
      return [p[0] + nrm[i][0] * by + 1.8, p[1] + nrm[i][1] * by + 2.4];
    });
    // the face's points pushed out a little too, never in: the word's box stays inside it
    for (let i = 0; i < N; i++) {
      const by = 1.3 * hash(700 + n, i);
      face[i] = [face[i][0] + nrm[i][0] * by, face[i][1] + nrm[i][1] * by];
    }
    const poly = (pts) => {
      const p = new Path2D();
      p.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
      p.closePath();
      return p;
    };
    // the facets between the face and the stone's edge, by how they face the light (from the upper left)
    const lit = new Path2D();
    const shade = new Path2D();
    const rim = new Path2D();
    const dots = new Path2D();
    let darkest = 0;
    let darkTone = 1;
    for (let i = 0; i < N; i++) {
      const a = out[i];
      const b = out[(i + 1) % N];
      const c = face[(i + 1) % N];
      const d = face[i];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const tone = (-0.6 * (b[1] - a[1]) + 0.8 * (b[0] - a[0])) / l;
      const q = tone > 0.42 ? lit : tone < -0.3 ? shade : null;
      if (q) {
        q.moveTo(a[0], a[1]);
        q.lineTo(b[0], b[1]);
        q.lineTo(c[0], c[1]);
        q.lineTo(d[0], d[1]);
        q.closePath();
      }
      if (tone > 0.42) {
        rim.moveTo(a[0] + (d[0] - a[0]) * 0.22, a[1] + (d[1] - a[1]) * 0.22);
        rim.lineTo(b[0] + (c[0] - b[0]) * 0.22, b[1] + (c[1] - b[1]) * 0.22);
      }
      if (tone < darkTone) {
        darkTone = tone;
        darkest = i;
      }
      if (hash(760 + n, i) < 0.35) {
        const u = 0.3 + 0.4 * hash(761 + n, i);
        const x = (a[0] + b[0]) * 0.5 * (1 - u) + (c[0] + d[0]) * 0.5 * u;
        const y = (a[1] + b[1]) * 0.5 * (1 - u) + (c[1] + d[1]) * 0.5 * u;
        dots.moveTo(x + 0.9, y);
        dots.arc(x, y, 0.9, 0, TAU);
      }
    }
    // snow along the top, above the face, dripping at its ends beside it
    const t0 = ends[0];
    const t1 = ends[1];
    const snow = new Path2D();
    snow.moveTo(out[t0][0] - 1, out[t0][1] + 6);
    for (let i = t0; i <= t1; i++) snow.lineTo(out[i][0], out[i][1] - 1.6);
    snow.lineTo(out[t1][0] + 1, out[t1][1] + 6);
    for (let i = t1; i >= t0; i--) {
      const x = face[i][0];
      const y = face[i][1] - 1.2 - 1.8 * hash(740 + n, i);
      const px = i < t1 ? face[i + 1][0] : out[t1][0] + 1;
      snow.quadraticCurveTo((x + px) / 2, y + 2.2, x, y);
    }
    snow.quadraticCurveTo(out[t0][0] + 1, face[t0][1], out[t0][0] - 1, out[t0][1] + 6);
    snow.closePath();
    // a crack in the darkest facet
    const crack = new Path2D();
    const a = out[darkest];
    const b = out[(darkest + 1) % N];
    const c = face[(darkest + 1) % N];
    const d = face[darkest];
    const mx = (a[0] + b[0]) / 2;
    const my = (a[1] + b[1]) / 2;
    const fx = (c[0] + d[0]) / 2;
    const fy = (c[1] + d[1]) / 2;
    crack.moveTo(mx, my);
    crack.lineTo(mx + (fx - mx) * 0.4 + 2, my + (fy - my) * 0.4);
    crack.lineTo(mx + (fx - mx) * 0.7 - 1, my + (fy - my) * 0.7);
    // the ring between the face and the stone's edge (filled even-odd): the face covers the rest, so the stone's body
    // and its shadow (offset less than the ring is wide) need only this, a third of the area to fill
    const band = poly(out);
    band.addPath(poly(face));
    s = { out: poly(out), face: poly(face), band, lit, shade, rim, snow, crack, dots };
    SHAPES.set(key, s);
    return s;
  }

  function thing(ctx, o, C) {
    const { x, y, w, h } = o;
    const n = o.n | 0;
    const S = stoneShape(n, w, h);
    const tones = STONES[wrap(n, STONES.length)][o.dark ? 'dark' : 'light'];
    const pal = o.pal || {};
    const red = o.flash ? (c) => mix(c, '#E2452B', 0.5) : (c) => c;
    const line = o.flash ? pal.bad || '#C7361E' : o.dark ? '#0A0D1F' : INK;
    ctx.save();
    ctx.translate(x, y);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // the hard shadow, and the gold ring of the one to say
    ctx.translate(3.5, 4.5);
    ctx.fillStyle = o.target ? (o.dark ? '#02030A' : INK) : rgba(o.dark ? '#02030A' : INK, o.dark ? 0.7 : 0.42);
    ctx.fill(S.band, 'evenodd');
    ctx.translate(-3.5, -4.5);
    if (o.target && !o.flash) {
      // a gold ring round it, breathing
      const pulse = 0.5 + 0.5 * Math.sin((o.t || 0) * 5);
      ctx.strokeStyle = '#F2B43A';
      ctx.lineWidth = 8 + 2.5 * pulse;
      ctx.stroke(S.out);
    }
    ctx.fillStyle = red(tones[0]);
    ctx.fill(S.band, 'evenodd');
    ctx.fillStyle = red(tones[1]);
    ctx.fill(S.lit);
    ctx.fillStyle = red(tones[2]);
    ctx.fill(S.shade);
    ctx.fillStyle = rgba(line, 0.4);
    ctx.fill(S.dots);
    if (o.dark && !o.flash) {
      ctx.strokeStyle = rgba('#C9D6FF', 0.75);
      ctx.lineWidth = 1.3;
      ctx.stroke(S.rim);
    }
    ctx.strokeStyle = rgba(line, 0.75);
    ctx.lineWidth = 1.2;
    ctx.stroke(S.crack);
    // the face, where the word is: pale, in both themes
    ctx.fillStyle = o.flash ? '#FFE3DB' : o.dark ? '#F2EBDD' : '#FFF8EC';
    ctx.fill(S.face);
    ctx.strokeStyle = rgba(line, 0.55);
    ctx.lineWidth = 1.2;
    ctx.stroke(S.face);
    ctx.fillStyle = o.dark ? '#E4EBFF' : '#FFFFFF';
    ctx.fill(S.snow);
    ctx.strokeStyle = line;
    ctx.lineWidth = 1.2;
    ctx.stroke(S.snow);
    ctx.lineWidth = o.target || o.flash ? 3.2 : 2.3;
    ctx.stroke(S.out);
    ctx.restore();
  }

  function colors(n, dark) {
    const f = STONES[wrap(n, STONES.length)][dark ? 'dark' : 'light'];
    return { fill: f[0], line: '#2A1A2E' };
  }

  W0.define('yama', {
    palette: PALETTE,
    // the crevice's ledges keep to its walls
    layout(n, W) {
      const side = n % 2 ? 1 : -1;
      return { x: side < 0 ? W * 0.3 : W * 0.7, side };
    },
    fall,
    climb,
    ledge,
    summit,
    thing,
    colors,
  });
})();
