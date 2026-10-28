/*
 * Yaoki Speaking's place 森 Forest, drawn for world.js: acorns, pears and persimmons from a great tree; Climb goes up its
 * branches to a nest.
 *
 * A woodblock print of a great sacred tree in a deep forest, lit from the upper left, the season strong in it. In spring
 * its crown is cherry blossom and petals drift down; in summer it is deep green, light falls through it in shafts and
 * fireflies come out at night; in autumn it turns red and gold and its leaves fall; in winter snow lies on it and keeps
 * falling, a persimmon or two still on it. It wears the shimenawa, the sacred rope, with its paper streamers, and
 * lanterns hang from it. Behind it the forest: cedars in teal tiers, then hills and far mountains, paler and bluer with
 * distance, under a sky in bands that warms towards evening as the round goes on. At night the sky is deep violet, with
 * the moon in its halo and the stars, the lanterns glow and flicker, and an owl blinks in the hollow of the tree.
 * Outlines are ink, fills flat with one or two crisp bands of light and shade, the leaves in scalloped masses.
 *
 * Falling keeps its still parts as one picture (the hills, the forest, the tree, the ground) over a sky drawn in bands
 * each frame, clouds drifting between them. Climb goes up the trunk of the great tree through the forest and above it:
 * the sky in bands, the far hills sinking slowly, the forest's trunks at the sides at half the speed, the trunk itself
 * in pieces kept as pictures; at the top the crown of the tree with its nest and three chicks, and once Yaoki is there,
 * rays round the sun (the moon), the chicks singing, the parent bird circling, sparkles and the season thrown up.
 * Pictures are painted at the screen's own scale and put on whole pixels, so drawing one is a plain copy.
 *
 * The falling things are fruit: a cream face for the word (nothing else is ever drawn on it) inside a rim of the fruit's
 * colour, banded in light and shade, outlined in ink, with a hard shadow; an acorn's scaly cap, a pear's stem and leaf, a
 * persimmon's four sepals. The one to say wears a ring of gold; a flash turns it red. A ledge is a chunky branch out of
 * the trunk, its top banded in light, with the season on it.
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
  const { TAU, INK, hash, rng, noise, clamp, smooth, wrap, mix, rgba, rr } = W0.kit;
  const lerp = (a, b, k) => a + (b - a) * k;
  const PI = Math.PI;

  // ---------- colours ----------

  const THEME = {
    light: {
      ink: INK, shadow: INK,
      sun: '#FFF7DC', sunRim: '#FFD46A', halo: '#FFF0BC', moon: '#FFF4D2', moonShade: '#E8D6A2',
      cloud: '#FFFFFF', cloudShade: '#D3E4F6', cloudLine: '#7E9DCF',
      far: '#B4CAEA', farLit: '#D2E0F3', far2: '#8DAEDC', far2Lit: '#AEC7E9', mist: '#F3F8FD', snowFar: '#FFFFFF',
      cedar: '#287A63', cedarLit: '#46A27E', cedarLine: '#0D3530', midTrunk: '#8A4A34', midTrunkLit: '#B8704C',
      bark: '#7E4A2A', barkLit: '#B97640', barkShade: '#522D19', barkLine: '#24120A', barkDeep: '#361B10',
      moss: { base: '#6FA63A', lit: '#A8D25A', shade: '#4A7C2A', line: '#22401A' },
      rope: '#ECCB80', ropeShade: '#B78C44', ropeLine: '#4A3212', paper: '#FFFFFF', paperShade: '#CDD6EA',
      lamp: '#E2462B', lampLit: '#FFA05C', lampShade: '#A22A19', lampCap: '#2A1A17', glow: '#FFC66C',
      hollow: '#26120A', eye: '#FFD84A',
      stone: '#9AA3BC', stoneLit: '#D0D6E6', stoneShade: '#69728F', stoneLine: '#2C3452',
      star: '#FFFFFF', bird: '#22304E', firefly: '#E7FF8A', mote: '#FFF4C4', rim: '#FFFFFF',
      shaft: '255,246,206', nest: '#B98A4E', nestLit: '#E0B474', nestShade: '#7A5428', nestLine: '#2E1C0C',
      chick: '#FFD54A', chickLit: '#FFF0A0', chickShade: '#E8A82A', beak: '#F28A2A', bird2: '#7CA83A', bird2Lit: '#B4D45A',
      gold: '#F2B43A', spark: '#FFE27A',
    },
    dark: {
      ink: '#0A0D1C', shadow: '#03050C',
      sun: '#FFF4D2', sunRim: '#FFE39A', halo: '#FFE7AE', moon: '#FFF3CF', moonShade: '#DCC890',
      cloud: '#3A4590', cloudShade: '#2A3272', cloudLine: '#7C8AD2',
      far: '#2F3C80', farLit: '#3F4E98', far2: '#24306A', far2Lit: '#33428A', mist: '#454E98', snowFar: '#C9D4F4',
      cedar: '#16404E', cedarLit: '#2A6878', cedarLine: '#040C16', midTrunk: '#2C1E2C', midTrunkLit: '#4E4A74',
      bark: '#4E302A', barkLit: '#7C7AAC', barkShade: '#2A1818', barkLine: '#0B0608', barkDeep: '#1E1012',
      moss: { base: '#2E5E3E', lit: '#4E8E6A', shade: '#1E3E2A', line: '#08160E' },
      rope: '#CDB06E', ropeShade: '#8A6E3C', ropeLine: '#24180A', paper: '#E8ECFA', paperShade: '#A6B2D8',
      lamp: '#FF6A3A', lampLit: '#FFD28C', lampShade: '#C23E28', lampCap: '#140C0C', glow: '#FFB65A',
      hollow: '#0A0405', eye: '#FFE066',
      stone: '#4C5478', stoneLit: '#8290C0', stoneShade: '#2C3250', stoneLine: '#0A0E20',
      star: '#FFFFFF', bird: '#C9D2F2', firefly: '#E9FF7A', mote: '#BFF4FF', rim: '#A9C2FF',
      shaft: '170,196,255', nest: '#7A5A3A', nestLit: '#A88A5E', nestShade: '#4A3420', nestLine: '#0E0806',
      chick: '#FFD54A', chickLit: '#FFF0A0', chickShade: '#D8982A', beak: '#F28A2A', bird2: '#6E9A48', bird2Lit: '#A6CC6A',
      gold: '#F2B43A', spark: '#FFE27A',
    },
  };

  // the season in the tree, the sky and the ground, by day and by night
  const SEASONS = {
    spring: {
      light: {
        sky: ['#2A66BC', '#4A8ED8', '#7FB9E8', '#B6D9F1', '#E8E3F1', '#F9D2DF'],
        eve: ['#3A4C9E', '#6A64B2', '#B97AA8', '#EDA08E', '#F6C38A', '#FAD7A4'],
        leaf: { base: '#F6B2CA', lit: '#FFE0EA', shade: '#DE84AA', line: '#5A1F3E' },
        leaf2: { base: '#F9C6D6', lit: '#FFEAF1', shade: '#E89ABA', line: '#5A1F3E' },
        accent: { base: '#F4AEC6', lit: '#FFDDE8', shade: '#D985A8', line: '#5E2442' },
        bush: { base: '#5DAE4E', lit: '#94D466', shade: '#3C8640', line: '#173A22' },
        grass: '#56AC4C', grassLit: '#8CD064', grassShade: '#358240', moor: '#22603A', grassLine: '#123A24',
        petal: ['#F8BBD0', '#FFE3EC'], flower: ['#FFFFFF', '#FFC4D6', '#FFE27A'], mark: '#FFFFFF', markIn: '#E0517E',
      },
      dark: {
        sky: ['#060A26', '#0D1646', '#1A2262', '#2C2B78', '#47348A', '#6E3F8E'],
        eve: ['#080A24', '#141444', '#261E5E', '#3E2672', '#5E2E80', '#8A3A86'],
        leaf: { base: '#E38CB4', lit: '#FFC6DC', shade: '#A45488', line: '#1E0A26' },
        leaf2: { base: '#EEA4C4', lit: '#FFD6E6', shade: '#B4669A', line: '#1E0A26' },
        accent: { base: '#C87AA6', lit: '#F0AECE', shade: '#8A4A7E', line: '#1A0A22' },
        bush: { base: '#1E4E3E', lit: '#2E7458', shade: '#123428', line: '#040E0A' },
        grass: '#1E4A3C', grassLit: '#2E6E58', grassShade: '#14362C', moor: '#0C2620', grassLine: '#040E0A',
        petal: ['#F2A2C4', '#FFD4E6'], flower: ['#E8ECFA', '#F2A8C8', '#F2D27A'], mark: '#FFE8F2', markIn: '#B03E78',
      },
    },
    summer: {
      light: {
        sky: ['#1452B6', '#2C7CD6', '#5DAEEC', '#A2D6F4', '#DCF1F4', '#FFF3D2'],
        eve: ['#2E4A9E', '#5A62B4', '#B276A2', '#EE9E80', '#F8C482', '#FFDCA0'],
        leaf: { base: '#3D9A4B', lit: '#80CC5C', shade: '#236E3B', line: '#0E3524' },
        leaf2: { base: '#56B054', lit: '#9AD86C', shade: '#348444', line: '#0E3524' },
        accent: { base: '#5BB252', lit: '#9CD96A', shade: '#38883E', line: '#123A22' },
        bush: { base: '#3E9446', lit: '#78C25A', shade: '#276E36', line: '#103420' },
        grass: '#4AA34A', grassLit: '#84CC5E', grassShade: '#2E7C3A', moor: '#1E5A34', grassLine: '#103420',
        petal: ['#6FBA4E', '#A6D86A'], flower: ['#6E8EF0', '#B38CEB', '#FFFFFF'], mark: '#1E5E34', markIn: '#2A7A40',
      },
      dark: {
        sky: ['#030922', '#071946', '#0D2962', '#143A74', '#1C5280', '#2A6A88'],
        eve: ['#050A22', '#0A1844', '#16225E', '#262A70', '#3A3480', '#58407E'],
        leaf: { base: '#1E6A4E', lit: '#3E9C6E', shade: '#124636', line: '#03120E' },
        leaf2: { base: '#24785A', lit: '#48AA7C', shade: '#16523E', line: '#03120E' },
        accent: { base: '#1E6A50', lit: '#3A9670', shade: '#124A38', line: '#03120E' },
        bush: { base: '#1A4E3C', lit: '#2C7458', shade: '#103428', line: '#040E0A' },
        grass: '#1A4A3A', grassLit: '#2A6E56', grassShade: '#12362A', moor: '#0A2620', grassLine: '#040E0A',
        petal: ['#2E7A54', '#4A9A6C'], flower: ['#5A72D8', '#8A6ACC', '#C8D2F2'], mark: '#2E8A60', markIn: '#3EA470',
      },
    },
    autumn: {
      light: {
        sky: ['#2256A8', '#3B7CCA', '#76ADE0', '#C2DAEC', '#FAE0B2', '#F7BA7E'],
        eve: ['#34489C', '#6060AE', '#B6709A', '#EC9478', '#F6B66E', '#F8CE8A'],
        leaf: { base: '#E4512A', lit: '#F89B3C', shade: '#AC2C21', line: '#46140E' },
        leaf2: { base: '#F2A23A', lit: '#FFD066', shade: '#C46A22', line: '#46140E' },
        accent: { base: '#E76A2E', lit: '#F8AA46', shade: '#B23E22', line: '#46160E' },
        bush: { base: '#9A8A2E', lit: '#CDB64A', shade: '#6E5E22', line: '#2E260C' },
        grass: '#7FA23C', grassLit: '#B2C658', grassShade: '#5A7E2C', moor: '#3A4E1E', grassLine: '#1E2A0C',
        petal: ['#E4532A', '#F7A63C'], flower: ['#F6C445', '#E4532A', '#FFFFFF'], mark: '#FFD166', markIn: '#F7A63C',
      },
      dark: {
        sky: ['#070A24', '#101646', '#1E1E5E', '#342672', '#56307E', '#863E78'],
        eve: ['#080922', '#141242', '#241A58', '#3C206A', '#5C2672', '#88306C'],
        leaf: { base: '#B4392C', lit: '#E8763A', shade: '#741D22', line: '#14060C' },
        leaf2: { base: '#C8782E', lit: '#EAA848', shade: '#844A1E', line: '#14060C' },
        accent: { base: '#9E3A2E', lit: '#D26A3A', shade: '#62202A', line: '#14060C' },
        bush: { base: '#4A4420', lit: '#6E6430', shade: '#302C14', line: '#0C0A04' },
        grass: '#2E3A22', grassLit: '#465630', grassShade: '#1E2816', moor: '#141C0E', grassLine: '#060A04',
        petal: ['#D24A2E', '#E89A3C'], flower: ['#D9A23E', '#C0442C', '#D8DCF0'], mark: '#E8B04A', markIn: '#D27A3A',
      },
    },
    winter: {
      light: {
        sky: ['#3E66B4', '#6088CC', '#93B3E0', '#C6D8F0', '#ECF1FA', '#F6E4EE'],
        eve: ['#3A4A9A', '#5E66AE', '#9A86BC', '#D8A2B8', '#F0C2BE', '#F6D8CC'],
        leaf: { base: '#2B6A56', lit: '#4A8E72', shade: '#1B4A40', line: '#0E2E2C' },
        leaf2: { base: '#367A62', lit: '#58A080', shade: '#23584A', line: '#0E2E2C' },
        accent: { base: '#2E6E5A', lit: '#4C9276', shade: '#1E4E42', line: '#0E2E2C' },
        bush: { base: '#F2F6FE', lit: '#FFFFFF', shade: '#C2D3EE', line: '#3A4E82' },
        grass: '#EEF3FC', grassLit: '#FFFFFF', grassShade: '#C4D4EE', moor: '#9FB6E0', grassLine: '#3A4E82',
        snow: '#FFFFFF', snowShade: '#C2D3EE', snowLine: '#3A4E82',
        petal: ['#FFFFFF', '#E6EEFB'], flower: ['#D9283A', '#E84A4A', '#FFFFFF'], mark: '#FFFFFF', markIn: '#C2D3EE',
      },
      dark: {
        sky: ['#050B28', '#0B1850', '#15266C', '#213A86', '#3854A0', '#5C76B8'],
        eve: ['#060A26', '#0E1448', '#1C2064', '#302C7A', '#4A3A8A', '#6A4C96'],
        leaf: { base: '#1C4650', lit: '#2E6670', shade: '#10303A', line: '#050E1A' },
        leaf2: { base: '#22525C', lit: '#36747E', shade: '#143A44', line: '#050E1A' },
        accent: { base: '#1E4A54', lit: '#306C76', shade: '#12343E', line: '#050E1A' },
        bush: { base: '#A8BAE4', lit: '#CCD8F6', shade: '#7486BE', line: '#141E48' },
        grass: '#A2B4E0', grassLit: '#C8D4F4', grassShade: '#7284BC', moor: '#5A6CA6', grassLine: '#141E48',
        snow: '#DCE6FF', snowShade: '#8CA0D6', snowLine: '#1A2656',
        petal: ['#E8EEFF', '#C4D0F2'], flower: ['#C02434', '#D8464A', '#DCE6FF'], mark: '#DCE6FF', markIn: '#8CA0D6',
      },
    },
  };
  const PALS = new Map();
  function palOf(season, dark) {
    const s = SEASONS[season] ? season : 'summer';
    const key = s + (dark ? ':dark' : ':light');
    let p = PALS.get(key);
    if (!p) {
      const t = dark ? 'dark' : 'light';
      p = Object.assign({}, THEME[t], SEASONS[s][t], { season: s, dark: !!dark });
      PALS.set(key, p);
    }
    return p;
  }

  // ---------- module state: what the latest drawing knew ----------

  let seasonNow = 'summer'; // the season of the latest background, for thing(), which is not told it
  let reachedAt = -1; // o.t when Yaoki got to the top, or -1

  // ---------- pictures kept: what does not move, painted once at the size and scale it is shown at ----------
  // (world.js's cachedLayer keeps one picture; this place keeps a few, all freed when the scene changes)

  const KEPT = new Map();
  let keptScene = '';
  function scaleOf(ctx) {
    try {
      const m = ctx.getTransform();
      return clamp(Math.hypot(m.a, m.b), 1, 7);
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
  // A new picture is only painted, not yet drawn: the browser draws it the first time it is shown, which for one that
  // comes into view in the middle of a climb (the crown) is a stutter then. So a pixel of each new picture is shown at
  // the start of the next frame, under the sky that is drawn over it at once.
  const FRESH = [];
  function warmUp(ctx) {
    for (const c of FRESH) if (c.width && c.height) ctx.drawImage(c, 0, 0, 1, 1, 0, 0, 1 / c.u, 1 / c.u);
    FRESH.length = 0;
  }
  // and let go of when nothing of this place has been drawn for a few seconds (a round in another place, the menu, a
  // hidden page): a phone has only so much memory for canvases, and a place off the screen keeps none of it
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
  function kept(key, w, h, sc, paint) {
    let c = KEPT.get(key);
    if (!c) {
      if (KEPT.size > 40) scene(keptScene + '+');
      c = document.createElement('canvas');
      c.width = Math.max(1, Math.ceil(w * sc));
      c.height = Math.max(1, Math.ceil(h * sc));
      c.u = sc;
      const g = c.getContext('2d');
      // painted to fill its canvas, whole device pixels: no row half painted, so pictures set one on another leave no seam
      g.setTransform(w > 0 ? c.width / w : sc, 0, 0, h > 0 ? c.height / h : sc, 0, 0);
      g.lineJoin = 'round';
      g.lineCap = 'round';
      paint(g);
      KEPT.set(key, c);
      FRESH.push(c);
    }
    return c;
  }
  // where (x, y) falls on the screen's whole pixels, so a kept picture is copied pixel for pixel
  function snap(ctx, x, y) {
    let m = null;
    try {
      m = ctx.getTransform();
    } catch (err) {
      m = null;
    }
    if (m && m.a > 0 && m.d > 0 && !m.b && !m.c) return [(Math.round(m.e + x * m.a) - m.e) / m.a, (Math.round(m.f + y * m.d) - m.f) / m.d];
    return [x, y];
  }
  function put(ctx, c, x, y) {
    const p = snap(ctx, x, y);
    ctx.drawImage(c, p[0], p[1], c.width / c.u, c.height / c.u);
  }
  // the rows u0..u1 (in units) of a kept picture whose top is at (x, y): only those rows are drawn, in their place
  function putRows(ctx, c, u0, u1, x, y) {
    const s0 = clamp(Math.floor(u0 * c.u), 0, c.height);
    const s1 = clamp(Math.ceil(u1 * c.u), 0, c.height);
    if (s1 <= s0) return;
    const p = snap(ctx, x, y);
    ctx.drawImage(c, 0, s0, c.width, s1 - s0, p[0], p[1] + s0 / c.u, c.width / c.u, (s1 - s0) / c.u);
  }
  function glowSprite(sc, col) {
    return kept('glow' + col, 48, 48, sc, (g) => {
      const gr = g.createRadialGradient(24, 24, 0, 24, 24, 24);
      gr.addColorStop(0, rgba(col, 0.85));
      gr.addColorStop(0.3, rgba(col, 0.42));
      gr.addColorStop(0.65, rgba(col, 0.12));
      gr.addColorStop(1, rgba(col, 0));
      g.fillStyle = gr;
      g.fillRect(0, 0, 48, 48);
    });
  }

  // ---------- shapes ----------

  // a mass of leaves: circles [x, y, r] as one shape, outlined round the outside only, in a band of shade below and
  // right, a band of light along the upper left of its top circles
  function massPath(g, cs, grow) {
    g.beginPath();
    for (const c of cs) {
      g.moveTo(c[0] + c[2] + grow, c[1]);
      g.arc(c[0], c[1], c[2] + grow, 0, TAU);
    }
  }
  function leafMass(g, cs, L, lw, lit) {
    massPath(g, cs, 0);
    if (lw) {
      g.lineWidth = lw * 2;
      g.strokeStyle = L.line;
      g.stroke();
    }
    g.fillStyle = L.shade;
    g.fill();
    g.beginPath();
    for (const c of cs) {
      const r = c[2] * 0.82;
      const x = c[0] - c[2] * 0.11;
      const y = c[1] - c[2] * 0.15;
      g.moveTo(x + r, y);
      g.arc(x, y, r, 0, TAU);
    }
    g.fillStyle = L.base;
    g.fill();
    if (lit === false) return;
    let mid = 0;
    let rs = 0;
    for (const c of cs) {
      mid += c[1];
      rs += c[2];
    }
    mid /= cs.length;
    rs /= cs.length;
    g.beginPath();
    for (const c of cs) {
      if (c[1] > mid + rs * 0.1) continue;
      const r = c[2] * 0.6;
      const a0 = PI * 1.1;
      const x = c[0] - c[2] * 0.1;
      const y = c[1] - c[2] * 0.12;
      g.moveTo(x + Math.cos(a0) * r, y + Math.sin(a0) * r);
      g.arc(x, y, r, a0, PI * 1.62);
    }
    g.lineCap = 'round';
    g.lineWidth = Math.max(1.4, rs * 0.24);
    g.strokeStyle = L.lit;
    g.stroke();
  }
  // circles for a mass round (x, y): a dome of smaller ones over a larger one at its foot
  function clusterOf(R, x, y, r, flat) {
    const cs = [[x, y, r * 0.78]];
    const n = 4 + Math.floor(R() * 3);
    for (let i = 0; i < n; i++) {
      const a = PI * (0.92 + 1.16 * (i / (n - 1))) + (R() - 0.5) * 0.25;
      const d = r * (0.5 + 0.28 * R());
      cs.push([x + Math.cos(a) * d * 1.15, y + Math.sin(a) * d * (flat || 0.78), r * (0.42 + 0.24 * R())]);
    }
    return cs;
  }
  // snow lying on a mass: a scalloped cap over each of its top circles
  function snowOn(g, cs, P, lw) {
    let mid = 0;
    for (const c of cs) mid += c[1];
    mid /= cs.length;
    const top = cs.filter((c) => c[1] <= mid);
    const cap = (grow) => {
      g.beginPath();
      for (const c of top) {
        const r = c[2];
        g.moveTo(c[0] + r * 0.9 + grow, c[1] - r * 0.18);
        g.ellipse(c[0], c[1] - r * 0.42, r * 0.9 + grow, r * 0.6 + grow, 0, 0, TAU);
      }
    };
    cap(0);
    g.lineWidth = lw * 2;
    g.strokeStyle = P.snowLine;
    g.stroke();
    g.fillStyle = P.snowShade;
    g.fill();
    g.beginPath();
    for (const c of top) {
      const r = c[2];
      g.moveTo(c[0] - r * 0.05 + r * 0.8, c[1] - r * 0.5);
      g.ellipse(c[0] - r * 0.05, c[1] - r * 0.5, r * 0.8, r * 0.5, 0, 0, TAU);
    }
    g.fillStyle = P.snow;
    g.fill();
  }
  // a cedar: a spire of tiers; half: only its left (lit) half, from the tip down its middle
  function cedarPath(g, x, base, h, w, half, stub) {
    const n = Math.max(3, Math.round(h / (w * 0.46)));
    const tip = base - h;
    const body = h * (1 - (stub === undefined ? 0.1 : stub));
    const step = body / n;
    const hw = (i) => w * 0.5 * (0.28 + 0.72 * i / n);
    g.beginPath();
    g.moveTo(x, tip);
    if (half) g.lineTo(x, base);
    else {
      for (let i = 1; i <= n; i++) {
        g.lineTo(x + hw(i), tip + step * i);
        if (i < n) g.lineTo(x + hw(i) * 0.52, tip + step * i - step * 0.16);
      }
      g.lineTo(x + w * 0.07, tip + body);
      g.lineTo(x + w * 0.07, base);
    }
    g.lineTo(x - w * 0.07, base);
    g.lineTo(x - w * 0.07, tip + body);
    for (let i = n; i >= 1; i--) {
      if (i < n) g.lineTo(x - hw(i) * 0.52, tip + step * i - step * 0.16);
      g.lineTo(x - hw(i), tip + step * i);
    }
    g.closePath();
  }
  function cedar(g, x, base, h, w, col, lit, line, lw, P, stub) {
    cedarPath(g, x, base, h, w, false, stub);
    if (line) {
      g.lineWidth = lw;
      g.strokeStyle = line;
      g.stroke();
    }
    g.fillStyle = col;
    g.fill();
    cedarPath(g, x - w * 0.05, base, h * 0.97, w * 0.84, true, stub);
    g.fillStyle = lit;
    g.fill();
    if (P && P.snow) {
      // snow along the top of each tier
      const n = Math.max(3, Math.round(h / (w * 0.46)));
      const tip = base - h;
      const step = (h * (1 - (stub === undefined ? 0.1 : stub))) / n;
      g.beginPath();
      for (let i = 1; i <= n; i++) {
        const y = tip + step * i;
        const hw = w * 0.5 * (0.28 + 0.72 * i / n);
        const y0 = y - step * 0.16;
        g.moveTo(x - hw, y);
        g.quadraticCurveTo(x - hw * 0.6, y0 - step * 0.2, x, y0 - step * (i === 1 ? 0.5 : 0.28));
        g.quadraticCurveTo(x + hw * 0.6, y0 - step * 0.2, x + hw, y);
        g.quadraticCurveTo(x, y - step * 0.12, x - hw, y);
      }
      g.fillStyle = P.snow;
      g.fill();
      if (line && P.snowLine) {
        g.lineWidth = lw * 0.6;
        g.strokeStyle = P.snowLine;
        g.stroke();
      }
    }
  }
  // a long flat-bottomed cloud of round bumps, outlined, its foot in a band of shade
  function kumoPaint(g, x, y, w, h, P, seed, lw) {
    const R = rng(seed);
    const n = Math.max(3, Math.round(w / (h * 0.9)));
    const cs = [];
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) / n;
      const r = h * (0.2 + 0.2 * Math.sin(PI * k) * (0.8 + 0.25 * R()));
      cs.push([x + w * (0.12 + 0.76 * k), y + h * 0.62 - r * 0.5, r]);
    }
    const path = () => {
      g.beginPath();
      for (const c of cs) {
        g.moveTo(c[0] + c[2], c[1]);
        g.arc(c[0], c[1], c[2], 0, TAU);
      }
      rr(g, x + w * 0.03, y + h * 0.5, w * 0.94, h * 0.5, h * 0.25);
    };
    path();
    g.lineWidth = lw * 2;
    g.strokeStyle = P.cloudLine;
    g.stroke();
    g.fillStyle = P.cloud;
    g.fill();
    g.save();
    path();
    g.clip();
    g.fillStyle = P.cloudShade;
    g.fillRect(x, y + h * 0.76, w, h * 0.3);
    g.restore();
  }
  const KUMO_W = [0.2, 0.27, 0.34];
  function kumoSprite(P, sc, k, H) {
    const w = Math.round(H * KUMO_W[k % 3]);
    const h = Math.round(w * 0.32);
    return kept('kumo' + (k % 3), w + 8, h + 8, sc, (g) => kumoPaint(g, 4, 4, w, h, P, 300 + (k % 3), 1.2));
  }
  // a paper lantern (chōchin) hanging by its cord from (x, y): its body s tall
  function lantern(g, P, x, y, s, cord) {
    const top = y + cord;
    g.strokeStyle = P.ink;
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x, top);
    g.stroke();
    const w = s * 0.72;
    const body = () => {
      g.beginPath();
      g.ellipse(x, top + s * 0.55, w / 2, s * 0.5, 0, 0, TAU);
    };
    body();
    g.fillStyle = P.lampShade;
    g.fill();
    g.beginPath();
    g.ellipse(x - w * 0.06, top + s * 0.52, w * 0.4, s * 0.44, 0, 0, TAU);
    g.fillStyle = P.dark ? P.lampLit : P.lamp;
    g.fill();
    if (!P.dark) {
      g.beginPath();
      g.ellipse(x - w * 0.16, top + s * 0.45, w * 0.12, s * 0.26, 0, 0, TAU);
      g.fillStyle = P.lampLit;
      g.fill();
    }
    // its ribs
    g.strokeStyle = rgba(P.lampShade, P.dark ? 0.75 : 0.9);
    g.lineWidth = 0.8;
    g.beginPath();
    for (let k = 1; k < 5; k++) {
      const yy = top + s * 0.05 + s * 0.9 * k / 5;
      const hw = (w / 2) * Math.sqrt(Math.max(0, 1 - Math.pow((yy - top - s * 0.55) / (s * 0.5), 2)));
      g.moveTo(x - hw + 0.6, yy);
      g.lineTo(x + hw - 0.6, yy);
    }
    g.stroke();
    body();
    g.lineWidth = 1.3;
    g.strokeStyle = P.ink;
    g.stroke();
    // caps
    g.fillStyle = P.lampCap;
    g.fillRect(x - w * 0.3, top - 0.5, w * 0.6, s * 0.12);
    g.fillRect(x - w * 0.3, top + s * 0.98, w * 0.6, s * 0.12);
    // tassel
    g.strokeStyle = P.lamp;
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(x, top + s * 1.1);
    g.lineTo(x, top + s * 1.38);
    g.stroke();
  }
  // a zigzag paper streamer (shide), hanging from (x, y), s long
  function shide(g, P, x, y, s) {
    const w = s * 0.32;
    const h = s * 0.26;
    const off = [0, 0.72, 0.12, 0.84];
    g.beginPath();
    for (let k = 0; k < 4; k++) g.rect(x - w * 0.55 + off[k] * w, y + k * h, w, h);
    g.fillStyle = P.paper;
    g.fill();
    g.lineWidth = 0.9;
    g.strokeStyle = P.ink;
    g.stroke();
    g.beginPath();
    for (let k = 0; k < 4; k++) g.rect(x - w * 0.55 + off[k] * w + w * 0.62, y + k * h, w * 0.38, h);
    g.fillStyle = P.paperShade;
    g.fill();
  }
  // the sacred rope along a curve through pts (each [x, y]), th thick, twisted
  function rope(g, P, pts, th) {
    g.beginPath();
    pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.lineWidth = th + 2.6;
    g.strokeStyle = P.ropeLine;
    g.stroke();
    g.lineWidth = th;
    g.strokeStyle = P.rope;
    g.stroke();
    // the twist: short slanted strokes along it
    g.lineWidth = 1.2;
    g.strokeStyle = P.ropeShade;
    g.beginPath();
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      const len = Math.hypot(x1 - x0, y1 - y0);
      const n = Math.max(1, Math.round(len / 4));
      for (let k = 0; k < n; k++) {
        const u = (k + 0.5) / n;
        const x = lerp(x0, x1, u);
        const y = lerp(y0, y1, u);
        g.moveTo(x - th * 0.25, y - th * 0.42);
        g.lineTo(x + th * 0.25, y + th * 0.42);
      }
    }
    g.stroke();
    g.lineWidth = 1;
    g.strokeStyle = rgba('#FFFFFF', P.dark ? 0.18 : 0.45);
    g.beginPath();
    pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1] - th * 0.28) : g.moveTo(p[0], p[1] - th * 0.28)));
    g.stroke();
  }
  // a five-petalled blossom
  function blossom(g, x, y, r, petal, heart) {
    g.beginPath();
    for (let k = 0; k < 5; k++) {
      const a = -PI / 2 + k * TAU / 5;
      g.moveTo(x + Math.cos(a) * r * 0.55 + r * 0.42, y + Math.sin(a) * r * 0.55);
      g.arc(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.42, 0, TAU);
    }
    g.fillStyle = petal;
    g.fill();
    g.beginPath();
    g.arc(x, y, r * 0.22, 0, TAU);
    g.fillStyle = heart;
    g.fill();
  }
  // a maple leaf (momiji) round (x, y), s across, turned by a
  function maplePath(ctx, x, y, s, a) {
    for (let i = 0; i < 10; i++) {
      const ang = a + i * PI / 5 - PI / 2;
      const r = i % 2 ? s * 0.42 : s * (i === 0 ? 1 : i === 2 || i === 8 ? 0.9 : 0.66);
      const px = x + Math.cos(ang) * r;
      const py = y + Math.sin(ang) * r;
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.closePath();
  }
  // a small fruit hanging in the tree
  function smallFruit(g, P, kind, x, y, r) {
    g.strokeStyle = P.barkLine;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, y - r - 5);
    g.lineTo(x + 0.5, y - r + 1);
    g.stroke();
    const F = FRUIT[kind][P.dark ? 'dark' : 'light'];
    const green = P.season === 'summer';
    g.beginPath();
    if (kind === 'acorn') g.ellipse(x, y + 1, r * 0.8, r * 1.05, 0, 0, TAU);
    else g.arc(x, y, r, 0, TAU);
    g.fillStyle = green ? (kind === 'kaki' ? '#8CB43E' : kind === 'pear' ? '#B8C850' : '#9AAE48') : F.base;
    g.fill();
    g.lineWidth = 1.2;
    g.strokeStyle = P.ink;
    g.stroke();
    g.beginPath();
    g.arc(x - r * 0.35, y - r * 0.3, r * 0.3, 0, TAU);
    g.fillStyle = rgba('#FFFFFF', 0.55);
    g.fill();
    if (kind === 'acorn') {
      g.beginPath();
      g.ellipse(x, y - r * 0.35, r * 0.95, r * 0.6, 0, PI, TAU);
      g.closePath();
      g.fillStyle = F.cap;
      g.fill();
      g.stroke();
    } else if (kind === 'kaki') {
      g.beginPath();
      g.ellipse(x - r * 0.4, y - r * 0.85, r * 0.5, r * 0.22, -0.4, 0, TAU);
      g.ellipse(x + r * 0.4, y - r * 0.85, r * 0.5, r * 0.22, 0.4, 0, TAU);
      g.fillStyle = F.leaf;
      g.fill();
    }
  }
  function moonAt(ctx, P, x, y, R) {
    for (let i = 3; i >= 1; i--) {
      ctx.beginPath();
      ctx.arc(x, y, R * (1 + i * 0.5), 0, TAU);
      ctx.fillStyle = rgba(P.halo, 0.05 + 0.035 * (3 - i));
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(x, y, R * 1.28, 0, TAU);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = rgba(P.halo, 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, R, 0, TAU);
    ctx.fillStyle = P.moon;
    ctx.fill();
    ctx.fillStyle = rgba(P.moonShade, 0.8);
    ctx.beginPath();
    ctx.arc(x - R * 0.32, y - R * 0.18, R * 0.24, 0, TAU);
    ctx.moveTo(x + R * 0.38, y + R * 0.22);
    ctx.arc(x + R * 0.22, y + R * 0.22, R * 0.16, 0, TAU);
    ctx.moveTo(x + R * 0.06, y + R * 0.5);
    ctx.arc(x - R * 0.04, y + R * 0.5, R * 0.1, 0, TAU);
    ctx.fill();
  }
  function sunAt(ctx, P, x, y, R) {
    for (let i = 3; i >= 1; i--) {
      ctx.beginPath();
      ctx.arc(x, y, R * (1 + i * 0.45), 0, TAU);
      ctx.fillStyle = rgba(P.halo, 0.12 + 0.06 * (3 - i));
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(x, y, R, 0, TAU);
    ctx.fillStyle = P.sun;
    ctx.fill();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = P.sunRim;
    ctx.stroke();
  }
  // the sky in bands: from cols' first at y0 to its last at y1, each moved towards eve's by e
  function colAt(cols, k) {
    const f = clamp(k, 0, 1) * (cols.length - 1);
    const i = Math.min(cols.length - 2, Math.floor(f));
    return mix(cols[i], cols[i + 1], f - i);
  }
  function skyBands(ctx, W, y0, y1, P, e, n) {
    ctx.fillStyle = colAt(P.sky, 0);
    if (y0 > 0) ctx.fillRect(0, 0, W, Math.ceil(y0) + 1);
    let y = y0;
    for (let i = 0; i < n; i++) {
      // thinner bands near the horizon
      const k1 = Math.pow((i + 1) / n, 0.8);
      const yb = y0 + (y1 - y0) * k1;
      const k = i / (n - 1);
      ctx.fillStyle = e > 0 ? mix(colAt(P.sky, k), colAt(P.eve, k), e) : colAt(P.sky, k);
      ctx.fillRect(0, Math.floor(y), W, Math.ceil(yb - y) + 1);
      y = yb;
    }
  }
  function starsNow(ctx, P, W, y0, y1, t, n, seed) {
    if (y1 <= y0) return;
    for (let pass = 0; pass < 3; pass++) {
      ctx.beginPath();
      for (let k = pass; k < n; k += 3) {
        const x = hash(seed, k) * W;
        const y = y0 + hash(seed + 1, k) * (y1 - y0);
        const r = 0.45 + 0.9 * hash(seed + 2, k);
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, TAU);
      }
      ctx.fillStyle = rgba(P.star, 0.5 + 0.35 * Math.sin(t * (1.3 + pass * 0.7) + pass * 2));
      ctx.fill();
    }
    // a few that shine in four points
    ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      const x = hash(seed + 5, k) * W;
      const y = y0 + hash(seed + 6, k) * (y1 - y0) * 0.8;
      const s = 2.4 + 1.2 * Math.sin(t * 2 + k * 1.7);
      ctx.moveTo(x, y - s);
      ctx.quadraticCurveTo(x, y, x + s, y);
      ctx.quadraticCurveTo(x, y, x, y + s);
      ctx.quadraticCurveTo(x, y, x - s, y);
      ctx.quadraticCurveTo(x, y, x, y - s);
    }
    ctx.fillStyle = P.star;
    ctx.fill();
  }
  function birdsNow(ctx, P, W, y, t, n, seed) {
    ctx.beginPath();
    for (let k = 0; k < n; k++) {
      const x = wrap(hash(seed, k) * W + t * (9 + 4 * hash(seed + 1, k)), W + 40) - 20;
      const yy = y + 18 * hash(seed + 2, k) + 3 * Math.sin(t * 0.8 + k);
      const f = Math.sin(t * 7 + k * 2);
      const s = 3.6;
      ctx.moveTo(x - s, yy - 1.6 * f);
      ctx.quadraticCurveTo(x - s * 0.5, yy - 2 - 1.2 * f, x, yy);
      ctx.quadraticCurveTo(x + s * 0.5, yy - 2 - 1.2 * f, x + s, yy - 1.6 * f);
    }
    ctx.lineWidth = 1.3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = P.bird;
    ctx.stroke();
  }

  // What drifts down, by the season, over a band of the screen W wide and H tall; scroll moves it all up the screen
  // (Climb: as he goes up, it streams past). At night out of summer, a few motes of light rise near the tree.
  function drift(ctx, P, W, H, t, scroll, sc, x0, x1) {
    const s = P.season;
    const dens = clamp(W / 300, 1, 1.8); // as many again on a wide screen, nearly
    ctx.save();
    if (s === 'spring' || (s === 'summer' && !P.dark)) {
      const n = Math.round((s === 'spring' ? 22 : 7) * dens);
      for (let pass = 0; pass < 2; pass++) {
        ctx.beginPath();
        for (let k = pass; k < n; k += 2) {
          const sp = 10 + 9 * hash(k, 2);
          const y = wrap(hash(k, 3) * H + t * sp + scroll, H + 20) - 10;
          const x = wrap(hash(k, 1) * W + t * (5 + 5 * hash(k, 4)) + 12 * Math.sin(t * 1.1 + k * 1.7), W + 20) - 10;
          const a = t * (1.3 + hash(k, 5)) + k;
          const rx = s === 'spring' ? 3.2 : 3.8;
          const ry = (s === 'spring' ? 1.7 : 1.6) * Math.abs(Math.cos(t * 1.9 + k)) + 0.5;
          ctx.moveTo(x + rx * Math.cos(a), y + rx * Math.sin(a));
          ctx.ellipse(x, y, rx, ry, a, 0, TAU);
        }
        ctx.fillStyle = P.petal[pass];
        ctx.fill();
      }
    } else if (s === 'autumn') {
      const n = Math.round(15 * dens);
      const cols = [P.petal[0], P.petal[1], P.leaf2.lit];
      for (let pass = 0; pass < 3; pass++) {
        ctx.beginPath();
        for (let k = pass; k < n; k += 3) {
          const sp = 13 + 10 * hash(k, 12);
          const y = wrap(hash(k, 13) * H + t * sp + scroll, H + 24) - 12;
          const x = wrap(hash(k, 11) * W + t * (6 + 6 * hash(k, 14)) + 16 * Math.sin(t * 0.9 + k * 1.3), W + 24) - 12;
          maplePath(ctx, x, y, 3.6 + 1.4 * hash(k, 15), t * (1.1 + hash(k, 16)) + k);
        }
        ctx.fillStyle = cols[pass];
        ctx.fill();
      }
    } else if (s === 'winter') {
      for (let pass = 0; pass < 2; pass++) {
        const n = Math.round((pass ? 12 : 30) * dens);
        ctx.beginPath();
        for (let k = 0; k < n; k++) {
          const j = k + pass * 100;
          const sp = pass ? 20 + 8 * hash(j, 22) : 14 + 10 * hash(j, 22);
          const y = wrap(hash(j, 23) * H + t * sp + scroll * (pass ? 1.15 : 0.9), H + 10) - 5;
          const x = wrap(hash(j, 21) * W + 10 * Math.sin(t * 0.8 + k * 1.9) + t * 3, W + 10) - 5;
          const r = pass ? 2.1 : 0.9 + 0.8 * hash(j, 24);
          ctx.moveTo(x + r, y);
          ctx.arc(x, y, r, 0, TAU);
        }
        ctx.fillStyle = pass ? P.petal[0] : rgba(P.petal[1], 0.9);
        ctx.fill();
      }
    }
    if (P.dark) {
      const g = glowSprite(sc, s === 'summer' ? P.firefly : P.mote);
      const n = s === 'summer' ? 14 : 7;
      const lo = x0 === undefined ? 0 : x0;
      const hi = x1 === undefined ? W : x1;
      ctx.beginPath();
      const pts = [];
      for (let k = 0; k < n; k++) {
        let x;
        let y;
        if (s === 'summer') {
          x = lo + hash(k, 31) * (hi - lo) + 14 * Math.sin(t * 0.6 + k * 1.3);
          y = H * (0.35 + 0.6 * hash(k, 32)) + 10 * Math.sin(t * 0.8 + k * 2.1) + wrap(scroll * 0.6, H);
          y = wrap(y, H);
        } else {
          x = lo + hash(k, 33) * (hi - lo) + 6 * Math.sin(t * 0.7 + k);
          y = wrap(H * hash(k, 34) - t * (6 + 4 * hash(k, 35)) + scroll * 0.6, H);
        }
        const a = s === 'summer' ? Math.max(0, Math.sin(t * 1.8 + k * 2.4)) : 0.5 + 0.4 * Math.sin(t * 2 + k);
        if (a < 0.05) continue;
        pts.push([x, y, a]);
      }
      for (const [x, y, a] of pts) {
        ctx.globalAlpha = a * 0.9;
        ctx.drawImage(g, x - 8, y - 8, 16, 16);
      }
      ctx.globalAlpha = 1;
      ctx.beginPath();
      for (const [x, y] of pts) {
        ctx.moveTo(x + 1.1, y);
        ctx.arc(x, y, 1.1, 0, TAU);
      }
      ctx.fillStyle = s === 'summer' ? P.firefly : P.mote;
      ctx.fill();
    }
    ctx.restore();
  }

  // ---------- Falling: the great tree at the side of a clearing ----------

  function fallGeo(o) {
    const W = o.W;
    const H = o.H;
    const gy = isFinite(o.ground) ? o.ground : H - 130;
    const mc = clamp(W * 0.2, 46, 120); // half the middle column the things come down
    const tw = clamp(H * 0.062, 22, 36); // the great trunk's half width
    const tx = Math.max(W * 0.1, W / 2 - mc - tw * 1.15);
    const mirror = W > H * 1.05; // wide: a second tree on the right
    const rx = mirror ? W - tx : Math.min(W * 0.92, W / 2 + mc + 34);
    return { W, H, gy, mc, tw, tx, rx, mirror };
  }
  // how low the crown hangs at x: high over the middle, lower at the sides
  function crownFoot(G, x) {
    const e = smooth(G.mc * 1.0, G.mc * 2.0, Math.abs(x - G.W / 2));
    return G.gy * (0.125 + 0.018 * Math.sin(x * 0.08) + 0.22 * e);
  }
  function skyline(seed, x, base, hm, u0) {
    const u = x / u0;
    return base - hm * (0.52 + 0.26 * Math.sin(u * 1.9 + seed) + 0.14 * Math.sin(u * 4.7 + seed * 2.3) + 0.2 * (noise(seed, u * 2.6) - 0.5));
  }
  function rangeFill(g, W, foot, f, lit, base, band, snow, seed) {
    const path = (dy) => {
      g.beginPath();
      g.moveTo(-4, foot);
      for (let x = -4; x <= W + 4; x += 3) g.lineTo(x, f(x) + dy(x));
      g.lineTo(W + 4, foot);
      g.closePath();
    };
    path(() => 0);
    g.fillStyle = snow || lit;
    g.fill();
    path(snow ? (x) => band * (1.6 + 2.2 * noise(seed, x * 0.08)) : (x) => band + band * 0.5 * Math.sin(x * 0.05));
    g.fillStyle = base;
    g.fill();
  }
  function mist(g, W, y, h, col, seed, a) {
    const R = rng(seed);
    g.fillStyle = rgba(col, a);
    for (let k = 0; k < 4; k++) {
      const w = W * (0.35 + 0.35 * R());
      const x = R() * W - w * 0.3;
      const yy = y + (R() - 0.5) * h * 1.6;
      g.beginPath();
      rr(g, x, yy, w, h, h / 2);
      g.fill();
    }
  }
  function hills(g, P, W, H, foot, base, scale, seed) {
    // the far range: soft blue mountains, snow on them in winter
    const fb = base - H * 0.07;
    const far = (x) => skyline(seed, x, fb, H * 0.2, scale);
    rangeFill(g, W, foot, far, P.farLit, P.far, 4, P.season === 'winter' ? P.snowFar : null, seed + 5);
    mist(g, W, fb - H * 0.01, H * 0.03, P.mist, seed + 11, P.dark ? 0.55 : 0.85);
    // nearer hills, their tree line in little bumps
    const nb = base + H * 0.0;
    const near = (x) => skyline(seed + 6, x, nb, H * 0.12, scale * 0.84) - 2.4 * Math.abs(Math.sin(x * PI / 6.5));
    rangeFill(g, W, foot, near, P.far2Lit, P.far2, 3.5, P.season === 'winter' ? mix(P.snowFar, P.far2Lit, 0.3) : null, seed + 7);
    if (P.season === 'spring' || P.season === 'autumn') {
      // the season on the hills: cherry or maple, in little puffs
      const R = rng(seed + 9);
      g.beginPath();
      for (let k = 0; k < Math.round(W / 9); k++) {
        const x = R() * W;
        const y = near(x) + 4 + R() * H * 0.05;
        const r = 1.1 + R() * (P.dark ? 1.2 : 1.7);
        g.moveTo(x + r, y);
        g.arc(x, y, r, 0, TAU);
      }
      g.fillStyle = rgba(P.season === 'spring' ? P.leaf.base : P.accent.base, P.dark ? 0.4 : 0.62);
      g.fill();
    }
    mist(g, W, nb - H * 0.005, H * 0.026, P.mist, seed + 13, P.dark ? 0.5 : 0.8);
  }
  function cumulus(g, P, W, y, h, seed) {
    // a towering summer cloud behind the far mountains
    const R = rng(seed);
    const cs = [];
    const x0 = W * (0.5 + 0.3 * R());
    for (let k = 0; k < 9; k++) {
      const u = k / 8;
      cs.push([x0 + (R() - 0.5) * h * 1.2 * (1 - u * 0.5), y - h * u * 0.95, h * (0.34 - u * 0.14 + 0.06 * R())]);
    }
    cs.push([x0 - h * 0.7, y - h * 0.05, h * 0.26], [x0 + h * 0.75, y - h * 0.02, h * 0.28]);
    massPath(g, cs, 0);
    g.lineWidth = 2.4;
    g.strokeStyle = rgba(P.cloudLine, 0.7);
    g.stroke();
    g.fillStyle = P.cloud;
    g.fill();
    g.save();
    massPath(g, cs, 0);
    g.clip();
    massPath(g, cs.map((c) => [c[0] + c[2] * 0.3, c[1] + c[2] * 0.42, c[2] * 0.9]), 0);
    g.fillStyle = rgba(P.cloudShade, 0.8);
    g.fill();
    g.restore();
  }
  function midForest(g, P, W, H, foot, mc, seed) {
    const R = rng(seed);
    const backCol = mix(P.cedar, P.far2, 0.55);
    const backLit = mix(P.cedarLit, P.far2Lit, 0.5);
    // the back row: smaller, paler, unlined
    for (let x = -8; x < W + 16; x += H * (0.022 + 0.016 * R())) {
      const side = smooth(mc * 0.7, mc * 1.8, Math.abs(x - W / 2));
      const h = H * (0.07 + 0.05 * R() + 0.07 * side);
      cedar(g, x, foot - 4, h, h * 0.34, backCol, backLit, null, 0, P.season === 'winter' ? { snow: mix(P.snowFar, backLit, 0.25) } : null);
    }
    // the front row: taller at the sides, outlined, the season's own trees among the cedars
    const list = [];
    for (let x = -10; x < W + 20; x += H * (0.03 + 0.022 * R())) {
      const side = smooth(mc * 0.6, mc * 1.7, Math.abs(x - W / 2));
      list.push({ x: x + (R() - 0.5) * 6, h: H * (0.055 + 0.045 * R() + 0.13 * side), round: P.season !== 'winter' && R() < 0.38, r: R() });
    }
    for (const tr of list) {
      if (!tr.round) {
        cedar(g, tr.x, foot, tr.h, tr.h * 0.36, P.cedar, P.cedarLit, P.cedarLine, 1.3, P.season === 'winter' ? P : null);
        continue;
      }
      const h = tr.h * 0.85;
      g.fillStyle = P.midTrunk;
      g.fillRect(tr.x - 1.5, foot - h * 0.45, 3, h * 0.45);
      const cs = clusterOf(rng(seed * 7 + Math.round(tr.x)), tr.x, foot - h * 0.6, h * 0.34);
      leafMass(g, cs, P.accent, 1, true);
    }
  }
  function shafts(g, P, x0, y0, foot, spread, a, seed) {
    // shafts of light through the leaves, from the upper left
    const R = rng(seed);
    for (let i = 0; i < 5; i++) {
      const x = x0 + i * spread + R() * spread * 0.4;
      const w = 5 + R() * 10;
      const dx = (foot - y0) * 0.55;
      const gr = g.createLinearGradient(x, y0, x + dx, foot);
      gr.addColorStop(0, 'rgba(' + P.shaft + ',' + (a * (0.6 + 0.4 * R())).toFixed(3) + ')');
      gr.addColorStop(1, 'rgba(' + P.shaft + ',0)');
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(x, y0);
      g.lineTo(x + w, y0);
      g.lineTo(x + w * 2.6 + dx, foot);
      g.lineTo(x + dx, foot);
      g.closePath();
      g.fill();
    }
  }
  // a row of bushes along y, then the ground below it to `bottom`, the route's strip under y dark so it shows
  function groundAt(g, P, W, y, bottom, seed) {
    const R = rng(seed);
    for (let x = -12; x < W + 24; x += 11 + R() * 13) {
      const cs = clusterOf(R, x, y - 5, 8 + R() * 6, 0.7);
      leafMass(g, cs, P.bush, 1.1, true);
    }
    g.fillStyle = P.grass;
    g.fillRect(-2, y - 3, W + 4, bottom - y + 3);
    // bands across it, darker near
    g.fillStyle = P.grassLit;
    g.fillRect(-2, y + 14, W + 4, 3);
    g.fillStyle = P.grassShade;
    g.fillRect(-2, y + 30, W + 4, bottom - y - 30);
    g.fillStyle = P.moor;
    g.fillRect(-2, y - 3, W + 4, 9);
    g.strokeStyle = P.grassLine;
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(-2, y - 3);
    g.lineTo(W + 2, y - 3);
    g.stroke();
    // tufts of grass
    g.strokeStyle = P.season === 'winter' ? P.grassShade : P.grassShade;
    g.lineWidth = 1.1;
    g.beginPath();
    for (let k = 0; k < W / 7; k++) {
      const x = R() * W;
      const yy = y + 10 + R() * (bottom - y - 12);
      g.moveTo(x - 2, yy);
      g.lineTo(x - 3, yy - 4);
      g.moveTo(x, yy);
      g.lineTo(x, yy - 5);
      g.moveTo(x + 2, yy);
      g.lineTo(x + 3.5, yy - 4);
    }
    g.stroke();
  }
  // flowers, stones, ferns and the like in the ground, where the season puts them
  function groundThings(g, P, W, y, bottom, seed, keep) {
    const R = rng(seed);
    const s = P.season;
    const away = (x) => !keep || Math.abs(x - keep[0]) > keep[1];
    // stones
    for (let k = 0; k < Math.max(2, Math.round(W / 120)); k++) {
      const x = R() * W;
      if (!away(x)) continue;
      const yy = y + 12 + R() * 22;
      const r = 5 + R() * 5;
      g.beginPath();
      g.ellipse(x, yy, r * 1.3, r * 0.8, 0, 0, TAU);
      g.fillStyle = P.stoneShade;
      g.fill();
      g.lineWidth = 1.2;
      g.strokeStyle = P.stoneLine;
      g.stroke();
      g.beginPath();
      g.ellipse(x - r * 0.2, yy - r * 0.22, r * 0.9, r * 0.45, 0, 0, TAU);
      g.fillStyle = s === 'winter' ? P.snow || P.stoneLit : P.stoneLit;
      g.fill();
    }
    // flowers: spring's pinks, summer's hydrangeas, autumn's leaves on the ground, winter's red berries
    const n = Math.round(W / 14);
    for (let k = 0; k < n; k++) {
      const x = R() * W;
      const yy = y + 8 + R() * (bottom - y - 10);
      if (!away(x) && yy < y + 20) continue;
      if (s === 'summer') {
        if (k % 4) continue;
        const cs = clusterOf(R, x, yy, 6 + R() * 3, 0.8);
        leafMass(g, cs, { base: P.flower[k % 2], lit: mix(P.flower[k % 2], '#FFFFFF', 0.45), shade: mix(P.flower[k % 2], '#1B2440', 0.3), line: P.grassLine }, 0.9, true);
      } else if (s === 'autumn') {
        g.beginPath();
        maplePath(g, x, yy, 3 + R() * 2, R() * TAU);
        g.fillStyle = P.flower[k % 2];
        g.fill();
      } else if (s === 'winter') {
        if (k % 3) continue;
        g.beginPath();
        g.arc(x, yy, 1.8, 0, TAU);
        g.arc(x + 3, yy + 1, 1.8, 0, TAU);
        g.fillStyle = P.flower[0];
        g.fill();
      } else {
        blossom(g, x, yy, 2.4 + R() * 1.2, P.flower[k % 3], P.markIn);
      }
    }
  }
  // the great tree's trunk at x (its middle), half width tw, from below the ground at foot up to y = top; it leans
  // into the crown on the side `lean` (1 right, -1 left)
  function trunkEdges(G, x, tw, foot, top, lean) {
    const H = G.H;
    const flare = (y) => Math.pow(smooth(foot - H * 0.16, foot + 6, y), 2);
    const crown = (y) => Math.pow(smooth(G.gy * 0.42, top, y), 1.6);
    const outer = (y) => x - lean * tw * (1 + 0.75 * flare(y) + 0.3 * crown(y) + 0.04 * Math.sin(y * 0.045));
    const inner = (y) => x + lean * tw * (1 + 1.1 * flare(y) + 1.25 * crown(y) + 0.06 * Math.sin(y * 0.05 + 1) + 0.1 * Math.exp(-Math.pow((y - G.gy * 0.62) / 18, 2)));
    return lean > 0 ? { L: outer, R: inner } : { L: inner, R: outer };
  }
  function greatTrunk(g, P, G, x, lean, main) {
    const { gy, H, tw } = G;
    const top = -12;
    const foot = gy + 3; // it goes into the ground under the route: nothing of it is drawn lower
    const E = trunkEdges(G, x, tw, gy, top, lean);
    const N = 44;
    const sides = (close) => {
      g.beginPath();
      for (let i = 0; i <= N; i++) {
        const y = foot - (foot - top) * i / N;
        if (i) g.lineTo(E.L(y), y);
        else g.moveTo(E.L(y), y);
      }
      if (!close) g.moveTo(E.R(top), top);
      for (let i = 0; i <= N; i++) {
        const y = top + (foot - top) * i / N;
        g.lineTo(E.R(y), y);
      }
      if (close) g.closePath();
    };
    const path = () => sides(true);
    // roots, behind the trunk's foot
    const roots = [
      [x + lean * tw * 1.3, gy - 6, x + lean * clamp(lean > 0 ? G.W / 2 - G.mc * 0.8 - x : x - G.W / 2 - G.mc * 0.8, tw * 1.6, tw * 3.1), gy + 6, 8],
      [x - lean * tw * 1.2, gy - 4, x - lean * tw * 2.7, gy + 8, 8],
      [x + lean * tw * 0.4, gy, x + lean * tw * 1.1, gy + 26, 10],
    ];
    for (const r of roots) root(g, P, r[0], r[1], r[2], r[3], r[4]);
    sides(false);
    g.lineWidth = 5;
    g.strokeStyle = P.barkLine;
    g.stroke();
    path();
    g.fillStyle = P.bark;
    g.fill();
    // light on the left, shade on the right, in bands
    const band = (from, to, col) => {
      g.beginPath();
      for (let i = 0; i <= N; i++) {
        const y = foot - (foot - top) * i / N;
        const l = E.L(y);
        const w = E.R(y) - l;
        if (i) g.lineTo(l + w * from, y);
        else g.moveTo(l + w * from, y);
      }
      for (let i = 0; i <= N; i++) {
        const y = top + (foot - top) * i / N;
        const l = E.L(y);
        const w = E.R(y) - l;
        g.lineTo(l + w * to, y);
      }
      g.closePath();
      g.fillStyle = col;
      g.fill();
    };
    band(0, 0.24, P.barkLit);
    band(0.7, 1, P.barkShade);
    // the grain, cut in long strokes
    g.lineWidth = 1.4;
    g.strokeStyle = P.barkLine;
    for (let k = 1; k <= 8; k++) {
      const u = k / 9;
      g.beginPath();
      let on = false;
      for (let i = 0; i <= N; i++) {
        const y = foot - (foot - top) * i / N;
        const l = E.L(y);
        const w = E.R(y) - l;
        const xx = l + w * u + 1.8 * Math.sin(y * 0.07 + k * 1.9);
        const cut = hash(k * 31 + Math.floor(y / 26), 5) < 0.78;
        if (cut && on) g.lineTo(xx, y);
        else if (cut) g.moveTo(xx, y);
        on = cut;
      }
      g.stroke();
    }
    // knots
    const R = rng(main ? 5 : 9);
    for (let k = 0; k < 3; k++) {
      const y = gy * (0.3 + 0.18 * k) + R() * 20;
      const l = E.L(y);
      const w = E.R(y) - l;
      const xx = l + w * (0.35 + 0.4 * R());
      g.beginPath();
      g.ellipse(xx, y, 3.2, 5.5, 0, 0, TAU);
      g.fillStyle = P.barkDeep;
      g.fill();
      g.lineWidth = 1.2;
      g.strokeStyle = P.barkLine;
      g.beginPath();
      g.ellipse(xx, y, 5.8, 9, 0, 0, TAU);
      g.stroke();
    }
    sides(false);
    g.lineWidth = 2.2;
    g.strokeStyle = P.barkLine;
    g.stroke();
    if (P.dark) {
      // moonlight along its left edge
      g.beginPath();
      for (let i = 4; i <= N; i++) {
        const y = foot - (foot - top) * i / N;
        if (i > 4) g.lineTo(E.L(y) + 2.4, y);
        else g.moveTo(E.L(y) + 2.4, y);
      }
      g.lineWidth = 1.4;
      g.strokeStyle = rgba(P.rim, 0.55);
      g.stroke();
    }
    // moss, at its foot and up its lit side
    const M = rng(main ? 41 : 43);
    for (let k = 0; k < 5; k++) {
      const y = k < 3 ? gy - 8 - k * 9 - M() * 6 : gy * (0.45 + 0.1 * k) * 0.9;
      const xx = E.L(y) + (E.R(y) - E.L(y)) * (k < 3 ? 0.15 + 0.6 * M() : 0.08);
      leafMass(g, clusterOf(M, xx, y, 5 + M() * 3, 0.6), P.season === 'winter' ? { base: P.snow, lit: '#FFFFFF', shade: P.snowShade, line: P.snowLine } : P.moss, 0.9, true);
    }
    if (!main) return E;
    // the hollow, low on it
    const hy = gy * 0.8;
    const hx = lerp(E.L(hy), E.R(hy), 0.42);
    const hw = tw * 0.36;
    g.beginPath();
    g.ellipse(hx, hy, hw + 3.4, hw * 1.42 + 3.4, 0, 0, TAU);
    g.fillStyle = P.barkLit;
    g.fill();
    g.lineWidth = 1.6;
    g.strokeStyle = P.barkLine;
    g.stroke();
    g.beginPath();
    g.ellipse(hx, hy + 0.8, hw, hw * 1.42, 0, 0, TAU);
    g.fillStyle = P.hollow;
    g.fill();
    g.stroke();
    G.hollow = [hx, hy, hw];
    // the sacred rope round it, with its paper streamers and straw tassels
    const yr = gy * 0.56;
    const l = E.L(yr) - 3;
    const w = E.R(yr) + 3 - l;
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const u = i / 16;
      pts.push([l + w * u, yr + 7 * Math.sin(PI * u) - 2 * u]);
    }
    rope(g, P, pts, 8);
    const at = (u) => [l + w * u, yr + 7 * Math.sin(PI * u) - 2 * u + 3];
    for (const u of [0.22, 0.5, 0.78]) {
      const [px, py] = at(u);
      shide(g, P, px, py, 17);
    }
    g.strokeStyle = P.ropeShade;
    g.lineWidth = 1.2;
    g.beginPath();
    for (const u of [0.36, 0.64]) {
      const [px, py] = at(u);
      for (let k = -2; k <= 2; k++) {
        g.moveTo(px + k * 1.2, py);
        g.lineTo(px + k * 1.5, py + 9 + Math.abs(k));
      }
    }
    g.stroke();
    return E;
  }
  function root(g, P, x0, y0, x1, y1, th) {
    const mx = (x0 + x1) / 2;
    const path = () => {
      g.beginPath();
      g.moveTo(x0, y0 - th / 2);
      g.quadraticCurveTo(mx, y0 - th * 0.7, x1, y1);
      g.quadraticCurveTo(mx, y0 + th * 0.9, x0, y0 + th / 2);
      g.closePath();
    };
    path();
    g.lineWidth = 3.6;
    g.strokeStyle = P.barkLine;
    g.stroke();
    g.fillStyle = P.bark;
    g.fill();
    g.beginPath();
    g.moveTo(x0, y0 - th * 0.3);
    g.quadraticCurveTo(mx, y0 - th * 0.5, x1 - (x1 - x0) * 0.08, y1 - 1);
    g.lineWidth = 2;
    g.strokeStyle = P.barkLit;
    g.stroke();
  }
  // the crown over the clearing: masses of leaves along the top, lower at the sides, the season in them
  function crownMasses(G, seed) {
    const { W, H } = G;
    const R = rng(seed);
    const step = clamp(H * 0.085, 28, 44);
    const list = [];
    for (let x = -step * 0.6; x < W + step; x += step * (0.7 + 0.3 * R())) {
      const foot = crownFoot(G, x);
      for (let y = foot - step * 0.5; y > -step; y -= step * 0.95) {
        const r = step * (0.62 + 0.22 * R());
        list.push({ x: x + (R() - 0.5) * step * 0.4, y, r, seed: Math.floor(R() * 1e6), low: y === foot - step * 0.5 });
      }
    }
    list.sort((a, b) => a.y - b.y);
    return list;
  }
  function seasonMarks(g, P, cs, R, n) {
    const s = P.season;
    for (let k = 0; k < n; k++) {
      const c = cs[Math.floor(R() * cs.length)];
      const a = R() * TAU;
      const d = c[2] * 0.6 * Math.sqrt(R());
      const x = c[0] + Math.cos(a) * d;
      const y = c[1] + Math.sin(a) * d;
      if (s === 'spring') blossom(g, x, y, 2.2 + R() * 1.3, P.mark, P.markIn);
      else if (s === 'autumn') {
        g.beginPath();
        maplePath(g, x, y, 2.4 + R() * 1.4, R() * TAU);
        g.fillStyle = k % 2 ? P.mark : P.markIn;
        g.fill();
      } else if (s === 'summer') {
        g.beginPath();
        g.moveTo(x - 2.4, y + 1);
        g.quadraticCurveTo(x, y - 2.2, x + 2.4, y + 1);
        g.lineWidth = 1.1;
        g.strokeStyle = P.mark;
        g.stroke();
      }
    }
  }
  function paintCrown(g, P, G, list, fruitSide) {
    const R = rng(97);
    const deep = { base: mix(P.leaf.shade, P.leaf.line, 0.22), lit: P.leaf.shade, shade: mix(P.leaf.shade, P.leaf.line, 0.45), line: P.leaf.line };
    for (const m of list) {
      const cs = clusterOf(rng(m.seed), m.x, m.y, m.r);
      const L = P.season === 'autumn' && hash(m.seed, 3) < 0.4 ? P.leaf2 : P.season === 'spring' && hash(m.seed, 3) < 0.35 ? P.leaf2 : P.leaf;
      if (!m.low) {
        // the masses behind, in the crown's shadow
        leafMass(g, cs, deep, 1.3, true);
        if (P.season === 'winter') snowOn(g, cs, P, 0.9);
        continue;
      }
      leafMass(g, cs, L, 1.5, true);
      if (P.season === 'winter') snowOn(g, cs, P, 1.1);
      else seasonMarks(g, P, cs, R, P.season === 'spring' ? 6 : 4);
      if (P.dark && m.low) {
        // moonlight on the upper left of the low ones
        g.beginPath();
        for (const c of cs) {
          g.moveTo(c[0] + Math.cos(PI * 1.05) * (c[2] - 1.2), c[1] + Math.sin(PI * 1.05) * (c[2] - 1.2));
          g.arc(c[0], c[1], c[2] - 1.2, PI * 1.05, PI * 1.4);
        }
        g.lineWidth = 1.2;
        g.strokeStyle = rgba(P.rim, 0.4);
        g.stroke();
      }
    }
    // fruit hanging at the sides (none in spring: then it is blossom)
    if (P.season === 'spring') return;
    const kinds = ['kaki', 'pear', 'acorn'];
    let k = 0;
    for (const m of list) {
      if (!m.low || !fruitSide(m.x)) continue;
      if (hash(m.seed, 7) < (P.season === 'winter' ? 0.55 : 0.25)) continue;
      const kind = P.season === 'winter' ? 'kaki' : kinds[k++ % 3];
      smallFruit(g, P, kind, m.x + (hash(m.seed, 8) - 0.5) * m.r, m.y + m.r * 0.75, 4.6);
      if (P.season === 'winter') {
        g.beginPath();
        g.ellipse(m.x + (hash(m.seed, 8) - 0.5) * m.r, m.y + m.r * 0.75 - 4.2, 3.6, 1.8, 0, 0, TAU);
        g.fillStyle = P.snow;
        g.fill();
      }
    }
  }
  function paintFallFront(g, P, G) {
    const { W, H, gy } = G;
    if (!P.dark && P.season === 'summer') cumulus(g, P, W, gy - H * 0.2, H * 0.3, 15);
    hills(g, P, W, H, gy, gy - H * 0.1, H * 0.5, 3);
    midForest(g, P, W, H, gy - 2, G.mc, 7);
    if (!P.dark) shafts(g, P, G.tx + G.tw * 1.4, gy * 0.1, gy, W * 0.08, P.season === 'summer' ? 0.36 : P.season === 'winter' ? 0.16 : 0.26, 23);
    groundAt(g, P, W, gy, H + 2, 61);
    // a dark trunk at the right edge to frame it, or, on a wide screen, a second great tree
    if (G.mirror) greatTrunk(g, P, G, G.rx, -1, false);
    else {
      const fx = W + G.tw * 0.15;
      g.beginPath();
      g.moveTo(fx - G.tw * 0.8, gy + 4);
      g.quadraticCurveTo(fx - G.tw * 0.55, gy * 0.6, fx - G.tw * 0.7, 0);
      g.lineTo(W + 10, 0);
      g.lineTo(W + 10, gy + 4);
      g.closePath();
      g.fillStyle = mix(P.bark, P.barkDeep, 0.45);
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = P.barkLine;
      g.stroke();
    }
    greatTrunk(g, P, G, G.tx, 1, true);
    const list = crownMasses(G, 131);
    paintCrown(g, P, G, list, (x) => Math.abs(x - W / 2) > G.mc * 1.1);
    // lanterns hanging from the crown: in front of the trunk, and over at the right
    const lx = G.tx + G.tw * 0.55;
    const rx = G.mirror ? G.rx - G.tw * 0.55 : G.rx;
    G.lamps = [];
    for (const x of [lx, rx]) {
      const y = crownFoot(G, x) - 2;
      lantern(g, P, x, y, 16, 12);
      G.lamps.push([x, y + 12 + 9]);
    }
    groundThings(g, P, W, gy, H, 71, [W / 2, 40]);
  }
  function fall(ctx, o, C) {
    const P = palOf(o.season, o.dark);
    const G = fallGeo(o);
    const { W, H, gy } = G;
    const sc = scaleOf(ctx);
    seasonNow = P.season;
    drawn();
    scene(['fall', P.season, P.dark ? 1 : 0, Math.round(W), Math.round(H), Math.round(gy), sc.toFixed(3)].join('|'));
    warmUp(ctx);
    const t = o.still ? 0 : o.t || 0;
    const e = smooth(0, 1, o.progress || 0) * 0.5;
    const hz = gy - H * 0.08;
    skyBands(ctx, W, 0, hz, P, e, 9);
    ctx.fillStyle = e > 0 ? mix(colAt(P.sky, 1), colAt(P.eve, 1), e) : colAt(P.sky, 1);
    ctx.fillRect(0, hz, W, gy - hz + 4);
    const dx = G.mirror ? Math.min(W - 28, G.rx + G.tw * 3.4) : W / 2 + G.mc * 1.15 + 6;
    const dy = (G.mirror ? gy * 0.46 : gy * 0.34) + e * 24;
    if (P.dark) {
      starsNow(ctx, P, W, crownFoot(G, W / 2), hz - H * 0.2, t, 54, 81);
      moonAt(ctx, P, dx, dy, clamp(H * 0.032, 12, 20));
    } else sunAt(ctx, P, dx, dy, clamp(H * 0.03, 11, 19));
    // clouds drifting behind the hills
    const n = P.dark ? 2 : 3;
    if (P.dark) ctx.globalAlpha = 0.85;
    for (let k = 0; k < n; k++) {
      const w = Math.round(H * KUMO_W[k]);
      const x = wrap(hash(k, 401) * W + t * (2.5 + 1.5 * k), W + w + 20) - w - 10;
      const y = gy * (0.4 + 0.09 * k) - w * 0.15;
      put(ctx, kumoSprite(P, sc, k, H), x, y);
    }
    ctx.globalAlpha = 1;
    if (!P.dark) birdsNow(ctx, P, W, gy * 0.38, t, 3, 501);
    const front = kept('front', W, H, sc, (g) => {
      paintFallFront(g, P, G);
      g.canvas.lamps = G.lamps;
      g.canvas.hollow = G.hollow;
    });
    put(ctx, front, 0, 0);
    if (P.dark) {
      // the lanterns' glow, flickering, and the owl's eyes in the hollow
      const glow = glowSprite(sc, P.glow);
      const lamps = front.lamps || [];
      lamps.forEach(([x, y], k) => {
        const f = o.still ? 0.85 : 0.78 + 0.12 * Math.sin(t * 7.3 + k * 2) + 0.08 * Math.sin(t * 13.1 + k);
        ctx.globalAlpha = f;
        ctx.drawImage(glow, x - 30, y - 30, 60, 60);
      });
      ctx.globalAlpha = 1;
      const h = front.hollow || null;
      if (h) owlEyes(ctx, P, h[0], h[1], h[2], t);
    }
    drift(ctx, P, W, gy + 6, t, 0, sc);
  }
  function owlEyes(ctx, P, x, y, r, t) {
    const blink = ((t + 2) % 4.3) < 0.16 ? 0.15 : 1; // (still, t is 0: the eyes open)
    ctx.fillStyle = P.eye;
    ctx.beginPath();
    ctx.ellipse(x - r * 0.38, y - r * 0.15, r * 0.24, r * 0.26 * blink, 0, 0, TAU);
    ctx.ellipse(x + r * 0.38, y - r * 0.15, r * 0.24, r * 0.26 * blink, 0, 0, TAU);
    ctx.fill();
    if (blink > 0.5) {
      ctx.fillStyle = '#0A0405';
      ctx.beginPath();
      ctx.arc(x - r * 0.36, y - r * 0.13, r * 0.1, 0, TAU);
      ctx.arc(x + r * 0.4, y - r * 0.13, r * 0.1, 0, TAU);
      ctx.fill();
    }
  }

  // ---------- Climb: up the great tree's trunk, through the forest and over it ----------

  const TT = 320; // a piece of the trunk, in units
  const TPAD = 21; // and how far out of it on each side its picture goes
  const MT = 360; // a piece of the forest beside it
  const BASE_UP = 150; // the foot of the trunk: this far above the ground, kept as one picture with the ground
  const baseDown = (G) => Math.ceil(clamp(G.bottom + 44, 120, 260)); // and this far below it: what shows under the dock
  function trunkHalf(W) {
    return clamp(W * 0.1, 22, 30);
  }
  function climbGeo(o) {
    const W = o.W;
    const H = o.H;
    const gy = isFinite(o.ground) ? o.ground : H - 127;
    const bottom = H - 12 - gy;
    const foot = H - bottom - 26;
    const y0s = -foot;
    const top = isFinite(o.top) && o.top < 0 ? o.top : -800;
    const y0e = top - foot + (H - 35 - bottom) * 0.12;
    const up = clamp((y0s - o.y0) / Math.max(1, y0s - y0e), 0, 1);
    const tw = trunkHalf(W);
    const sw = Math.round(clamp(W * 0.25, 56, 200));
    return { W, H, gy, bottom, foot, y0: o.y0, y0s, y0e, top, up, tw, sw, tx: W / 2 };
  }
  // the grain of the trunk at the world's y: the same in every piece, so they join
  function grainX(k, y) {
    return 1.8 * Math.sin((wrap(y, TT) / TT) * TAU * 3 + k * 1.9);
  }
  function trunkPiece(g, P, tw, cx, y0, y1) {
    // the bark from y0 to y1 (the piece's own units), straight sides at cx ± tw
    g.beginPath();
    g.rect(cx - tw, y0 - 4, tw * 2, y1 - y0 + 8);
    g.fillStyle = P.bark;
    g.fill();
    g.fillStyle = P.barkLit;
    g.fillRect(cx - tw, y0 - 4, tw * 0.5, y1 - y0 + 8);
    g.fillStyle = P.barkShade;
    g.fillRect(cx + tw * 0.42, y0 - 4, tw * 0.58, y1 - y0 + 8);
    g.lineWidth = 1.4;
    g.strokeStyle = P.barkLine;
    for (let k = 1; k <= 6; k++) {
      const u = k / 7;
      g.beginPath();
      let on = false;
      for (let y = y0 - 4; y <= y1 + 4; y += 4) {
        const x = cx - tw + tw * 2 * u + grainX(k, y);
        const cut = hash(k * 31 + Math.floor(wrap(y, TT) / 26), 5) < 0.78;
        if (cut && on) g.lineTo(x, y);
        else if (cut) g.moveTo(x, y);
        on = cut;
      }
      g.stroke();
    }
    g.lineWidth = 2.6;
    g.beginPath();
    g.moveTo(cx - tw, y0 - 4);
    g.lineTo(cx - tw, y1 + 4);
    g.moveTo(cx + tw, y0 - 4);
    g.lineTo(cx + tw, y1 + 4);
    g.stroke();
    if (P.dark) {
      g.lineWidth = 1.4;
      g.strokeStyle = rgba(P.rim, 0.5);
      g.beginPath();
      g.moveTo(cx - tw + 2.4, y0 - 4);
      g.lineTo(cx - tw + 2.4, y1 + 4);
      g.stroke();
    }
  }
  function paintTrunkTile(g, P, tw, variant) {
    const cx = tw + TPAD;
    trunkPiece(g, P, tw, cx, 0, TT);
    const R = rng(700 + variant);
    // knots
    for (let k = 0; k < 2; k++) {
      const y = 60 + k * 150 + R() * 40;
      const x = cx + (R() - 0.5) * tw * 0.9;
      g.beginPath();
      g.ellipse(x, y, 3.4, 6, 0, 0, TAU);
      g.fillStyle = P.barkDeep;
      g.fill();
      g.lineWidth = 1.2;
      g.strokeStyle = P.barkLine;
      g.beginPath();
      g.ellipse(x, y, 6, 10, 0, 0, TAU);
      g.stroke();
    }
    // moss or snow on it, and a sprig of leaves out of each side
    const winter = P.season === 'winter';
    for (let k = 0; k < 2; k++) {
      const y = 40 + k * 170 + R() * 50;
      leafMass(g, clusterOf(R, cx - tw * 0.6, y, 5 + R() * 3, 0.6), winter ? { base: P.snow, lit: '#FFFFFF', shade: P.snowShade, line: P.snowLine } : P.moss, 0.9, true);
    }
    const side = variant ? 1 : -1;
    const sy = variant ? 230 : 110;
    g.lineWidth = 3;
    g.strokeStyle = P.barkLine;
    g.beginPath();
    g.moveTo(cx + side * tw * 0.8, sy + 8);
    g.quadraticCurveTo(cx + side * (tw + 8), sy + 4, cx + side * (tw + 13), sy - 6);
    g.stroke();
    g.lineWidth = 1.6;
    g.strokeStyle = P.bark;
    g.stroke();
    const cs = clusterOf(R, cx + side * (tw + 8), sy - 8, 7, 0.75);
    leafMass(g, cs, P.leaf, 1.2, true);
    if (winter) snowOn(g, cs, P, 0.9);
    if (variant === 0) {
      // a hollow, where an owl lives
      const hy = 205;
      const hx = cx - tw * 0.15;
      const hw = tw * 0.36;
      g.beginPath();
      g.ellipse(hx, hy, hw + 3.4, hw * 1.42 + 3.4, 0, 0, TAU);
      g.fillStyle = P.barkLit;
      g.fill();
      g.lineWidth = 1.6;
      g.strokeStyle = P.barkLine;
      g.stroke();
      g.beginPath();
      g.ellipse(hx, hy + 0.8, hw, hw * 1.42, 0, 0, TAU);
      g.fillStyle = P.hollow;
      g.fill();
      g.stroke();
    } else {
      // a lantern on a peg
      g.lineWidth = 2.4;
      g.strokeStyle = P.barkLine;
      g.beginPath();
      g.moveTo(cx - tw * 0.6, 92);
      g.lineTo(cx - tw - 9, 88);
      g.stroke();
      lantern(g, P, cx - tw - 8, 89, 14, 6);
    }
  }
  // where, in a piece of the trunk, its hollow and its lantern are
  const TILE_HOLLOW = 205;
  const TILE_LAMP = 89 + 6 + 8;
  function trunkVariant(k) {
    return hash(k, 909) < 0.5 ? 0 : 1;
  }
  // the forest's trees in a strip at the side: where each stands, and how its trunk sways (the same in every piece)
  function stripTrees(sw, side) {
    const near = Math.min(sw * 0.14, 14);
    const far = Math.min(sw * 0.075, 7.5);
    return side < 0
      ? [{ x: sw * 0.8, w: far, far: 1, ph: 1.3 }, { x: sw * 0.3, w: near, far: 0, ph: 4.1 }]
      : [{ x: sw * 0.2, w: far, far: 1, ph: 2.2 }, { x: sw * 0.7, w: near, far: 0, ph: 0.4 }];
  }
  const swayAt = (tr, y) => tr.w * 0.18 * Math.sin((wrap(y, MT) / MT) * TAU + tr.ph);
  function paintStrip(g, P, sw, side, v) {
    // a strip of the forest beside the great tree: tall trunks, swaying a little, their branches ending in foliage
    const R = rng((side < 0 ? 811 : 823) + v * 101);
    for (const tr of stripTrees(sw, side)) {
      const k = tr.far ? 0.42 : 0.08;
      const trunk = mix(P.midTrunk, P.far2, k);
      const lit = mix(P.midTrunkLit, P.far2Lit, k);
      const down = (d, u) => {
        for (let y = -6; y <= MT + 6; y += 6) {
          const x = tr.x + swayAt(tr, y) + d * tr.w * u;
          if (y === -6) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
      };
      const up = (d, u) => {
        for (let y = MT + 6; y >= -6; y -= 6) g.lineTo(tr.x + swayAt(tr, y) + d * tr.w * u, y);
      };
      g.beginPath();
      down(-1, 1);
      up(1, 1);
      g.closePath();
      g.fillStyle = trunk;
      g.fill();
      g.beginPath();
      down(-1, 1);
      up(-1, 0.25);
      g.closePath();
      g.fillStyle = lit;
      g.fill();
      // its bark in long strips
      g.lineWidth = tr.far ? 0.8 : 1.1;
      g.strokeStyle = mix(trunk, P.cedarLine, tr.far ? 0.3 : 0.55);
      g.beginPath();
      for (let j = 1; j < 4; j++) {
        const u = -1 + (2 * j) / 4;
        for (let y = 0; y < MT; y += 30) {
          if (hash(j * 7 + Math.round(tr.x) + v * 3, y) < 0.35) continue;
          g.moveTo(tr.x + swayAt(tr, y + 2) + u * tr.w, y + 2);
          g.lineTo(tr.x + swayAt(tr, y + 24) + u * tr.w + 0.6, y + 24);
        }
      }
      g.stroke();
      if (!tr.far) {
        g.lineWidth = 1.6;
        g.strokeStyle = P.cedarLine;
        g.beginPath();
        down(-1, 1);
        g.moveTo(tr.x + swayAt(tr, -6) + tr.w, -6);
        for (let y = 0; y <= MT + 6; y += 6) g.lineTo(tr.x + swayAt(tr, y) + tr.w, y);
        g.stroke();
      }
      const L = tr.far
        ? { base: mix(P.cedar, P.far2, 0.5), lit: mix(P.cedarLit, P.far2Lit, 0.5), shade: mix(P.cedar, P.far2, 0.65), line: mix(P.cedarLine, P.far2, 0.5) }
        : { base: P.cedar, lit: P.cedarLit, shade: mix(P.cedar, P.cedarLine, 0.35), line: P.cedarLine };
      // branches, out to either side in turn, each ending in a mass of foliage
      for (let j = 0; j < 3; j++) {
        const y = 52 + j * 112 + R() * 28;
        const d = (j + v + tr.far) % 2 ? 1 : -1;
        const r = sw * (tr.far ? 0.1 : 0.15);
        const bx = tr.x + swayAt(tr, y) + d * tr.w * 0.8;
        // never past the strip's inner edge, where it would be cut off
        const ex = side < 0 ? Math.min(bx + d * sw * 0.24, sw - r * 1.7) : Math.max(bx + d * sw * 0.24, r * 1.7);
        g.beginPath();
        g.moveTo(bx, y + 7);
        g.quadraticCurveTo((bx + ex) / 2, y + 3, ex, y - 5);
        if (!tr.far) {
          g.lineWidth = 4.2;
          g.strokeStyle = P.cedarLine;
          g.stroke();
        }
        g.lineWidth = tr.far ? 2.2 : 2.4;
        g.strokeStyle = trunk;
        g.stroke();
        const cs = clusterOf(R, ex, y - 9, r, 0.55);
        const seasonal = P.season !== 'winter' && P.season !== 'summer' && R() < 0.45;
        leafMass(g, cs, seasonal ? (tr.far ? { base: mix(P.accent.base, P.far2, 0.45), lit: mix(P.accent.lit, P.far2Lit, 0.45), shade: mix(P.accent.shade, P.far2, 0.5), line: P.accent.line } : P.accent) : L, tr.far ? 0 : 1.1, true);
        if (P.season === 'winter') snowOn(g, cs, P, tr.far ? 0.4 : 0.8);
      }
    }
  }
  function paintTops(g, P, sw, side, CH, at, seed) {
    // the tops of the forest's trees: cedar spires on the trunks of the strip below (their sway where the forest ends)
    const R = rng(seed);
    stripTrees(sw, side).forEach((tr) => {
      const h = CH * (tr.far ? 0.72 : 0.92) * (0.94 + 0.12 * R());
      const col = tr.far ? mix(P.cedar, P.far2, 0.5) : P.cedar;
      const lit = tr.far ? mix(P.cedarLit, P.far2Lit, 0.5) : P.cedarLit;
      const x = tr.x + swayAt(tr, at);
      const w = Math.min(tr.w * 4.8, side < 0 ? 2 * (sw - x) : 2 * x);
      cedar(g, x, CH + 3, h, w, col, lit, tr.far ? null : P.cedarLine, 1.4, P.season === 'winter' ? P : null, 0);
    });
  }
  function paintFarClimb(g, P, W, FH) {
    const base = FH * 0.62;
    if (!P.dark && P.season === 'summer') cumulus(g, P, W, base - FH * 0.12, FH * 0.36, 17);
    hills(g, P, W, FH * 1.6, FH + 2, base, FH * 1.1, 5);
    // a sea of treetops, nearer and darker row by row
    for (let row = 0; row < 3; row++) {
      const y = base + FH * (0.08 + 0.1 * row);
      const r = 5 + row * 3;
      const k = 0.55 - row * 0.2;
      const L = { base: mix(P.cedar, P.far2, k), lit: mix(P.cedarLit, P.far2Lit, k), shade: mix(P.cedar, P.far2, k + 0.12), line: mix(P.cedarLine, P.far2, k) };
      const cs = [];
      for (let x = -r; x < W + r * 2; x += r * 1.5) cs.push([x, y + 2 * Math.sin(x * 0.13 + row), r * (0.8 + 0.3 * hash(row, Math.round(x)))]);
      massPath(g, cs, 0);
      g.fillStyle = L.base;
      g.fill();
      g.fillRect(-2, y, W + 4, FH - y + 4);
      // a band of light along the top of the row (snow in winter), then the row again a little lower
      massPath(g, cs, 0);
      g.fillStyle = P.season === 'winter' ? mix(P.snowFar, L.base, 0.2) : L.lit;
      g.fill();
      massPath(g, cs.map((c) => [c[0] + 0.8, c[1] + Math.min(3, c[2] * 0.3), c[2]]), 0);
      g.fillStyle = L.base;
      g.fill();
      g.fillRect(-2, y + 3, W + 4, FH - y + 4);
    }
  }
  function paintBase(g, P, W, tw, seed, down) {
    // the foot of the great tree and the forest floor round it: y 0 here is BASE_UP above the ground
    const gy = BASE_UP;
    const cx = W / 2;
    groundAt(g, P, W, gy, gy + down, seed);
    // the trunk widening into its roots
    const flare = (y) => Math.pow(smooth(gy - 70, gy + 6, y), 2);
    const L = (y) => cx - tw * (1 + 0.9 * flare(y));
    const Rr = (y) => cx + tw * (1 + 0.9 * flare(y));
    const roots = [
      [cx + tw * 1.3, gy - 6, cx + tw * 3.2, gy + 6, 8],
      [cx - tw * 1.3, gy - 6, cx - tw * 3.3, gy + 7, 8],
      [cx + tw * 0.2, gy - 1, cx + tw * 0.9, gy + 22, 9],
      [cx - tw * 0.5, gy - 1, cx - tw * 1.4, gy + 20, 9],
    ];
    for (const r of roots) root(g, P, r[0], r[1], r[2], r[3], r[4]);
    const N = 24;
    const bot = gy + 3; // into the ground under the route
    const band = (from, to) => {
      g.beginPath();
      for (let i = 0; i <= N; i++) {
        const y = bot - (bot + 4) * i / N;
        const l = L(y);
        if (i) g.lineTo(l + (Rr(y) - l) * from, y);
        else g.moveTo(l + (Rr(y) - l) * from, y);
      }
      for (let i = 0; i <= N; i++) {
        const y = -4 + (bot + 4) * i / N;
        const l = L(y);
        g.lineTo(l + (Rr(y) - l) * to, y);
      }
      g.closePath();
    };
    const path = () => band(0, 1);
    path();
    g.fillStyle = P.bark;
    g.fill();
    band(0, 0.25);
    g.fillStyle = P.barkLit;
    g.fill();
    band(0.71, 1);
    g.fillStyle = P.barkShade;
    g.fill();
    g.lineWidth = 1.4;
    g.strokeStyle = P.barkLine;
    for (let k = 1; k <= 6; k++) {
      const u = k / 7;
      g.beginPath();
      let on = false;
      for (let y = -4; y <= bot; y += 4) {
        const x = L(y) + (Rr(y) - L(y)) * u + grainX(k, y - gy);
        const cut = hash(k * 31 + Math.floor(wrap(y - gy, TT) / 26), 5) < 0.78;
        if (cut && on) g.lineTo(x, y);
        else if (cut) g.moveTo(x, y);
        on = cut;
      }
      g.stroke();
    }
    // its outline, down its two sides only
    g.beginPath();
    for (let i = 0; i <= N; i++) {
      const y = -4 + (bot + 4) * i / N;
      if (i) g.lineTo(L(y), y);
      else g.moveTo(L(y), y);
    }
    for (let i = 0; i <= N; i++) {
      const y = -4 + (bot + 4) * i / N;
      if (i) g.lineTo(Rr(y), y);
      else g.moveTo(Rr(y), y);
    }
    g.lineWidth = 2.6;
    g.strokeStyle = P.barkLine;
    g.stroke();
    // moss at the foot
    const M = rng(seed + 3);
    for (let k = 0; k < 4; k++) {
      const y = gy - 6 - k * 8;
      const x = L(y) + (Rr(y) - L(y)) * (0.12 + 0.7 * M());
      leafMass(g, clusterOf(M, x, y, 5 + M() * 3, 0.6), P.season === 'winter' ? { base: P.snow, lit: '#FFFFFF', shade: P.snowShade, line: P.snowLine } : P.moss, 0.9, true);
    }
    // the sacred rope, above his head
    const yr = gy - 104;
    const l = L(yr) - 3;
    const w = Rr(yr) + 3 - l;
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const u = i / 12;
      pts.push([l + w * u, yr + 6 * Math.sin(PI * u)]);
    }
    rope(g, P, pts, 7);
    for (const u of [0.2, 0.5, 0.8]) shide(g, P, l + w * u, yr + 6 * Math.sin(PI * u) + 3, 15);
    // a stone lantern at the side
    const sx = cx - tw * 4.2;
    stoneLantern(g, P, sx, gy - 2, 1);
    groundThings(g, P, W, gy, gy + down, seed + 7, [cx, tw * 2.4]);
    return [sx, gy - 2 - 26];
  }
  function stoneLantern(g, P, x, y, s) {
    const part = (px, py, w, h, r) => {
      g.beginPath();
      rr(g, x + px * s - w * s / 2, y + py * s, w * s, h * s, r);
      g.fillStyle = P.stone;
      g.fill();
      g.lineWidth = 1.3;
      g.strokeStyle = P.stoneLine;
      g.stroke();
    };
    part(0, -6, 18, 6, 1.5);
    part(0, -18, 7, 12, 1);
    part(0, -22, 16, 4, 1.5);
    // the fire box
    g.beginPath();
    rr(g, x - 6 * s, y - 33 * s, 12 * s, 11 * s, 1.5);
    g.fillStyle = P.dark ? P.lampLit : P.stoneShade;
    g.fill();
    g.lineWidth = 1.3;
    g.strokeStyle = P.stoneLine;
    g.stroke();
    g.fillStyle = P.dark ? '#FFF2C0' : P.hollow;
    g.fillRect(x - 3 * s, y - 31 * s, 6 * s, 6 * s);
    // the roof
    g.beginPath();
    g.moveTo(x - 13 * s, y - 33 * s);
    g.quadraticCurveTo(x - 4 * s, y - 36 * s, x, y - 42 * s);
    g.quadraticCurveTo(x + 4 * s, y - 36 * s, x + 13 * s, y - 33 * s);
    g.closePath();
    g.fillStyle = P.season === 'winter' ? P.snow : P.stone;
    g.fill();
    g.stroke();
    g.beginPath();
    g.arc(x, y - 43.5 * s, 2 * s, 0, TAU);
    g.fillStyle = P.stone;
    g.fill();
    g.stroke();
    g.fillStyle = rgba(P.stoneLit, 0.8);
    g.fillRect(x - 8 * s, y - 21.4 * s, 4 * s, 1.6 * s);
  }
  function climb(ctx, o, C) {
    const P = palOf(o.season, o.dark);
    const G = climbGeo(o);
    const { W, H, y0, up, tw, sw, top } = G;
    const sc = scaleOf(ctx);
    seasonNow = P.season;
    drawn();
    scene(['climb', P.season, P.dark ? 1 : 0, Math.round(W), Math.round(H), sc.toFixed(3)].join('|'));
    warmUp(ctx);
    // what is only shown now and then is painted with the rest, on the first frame, not in the middle of the climb
    for (let k = 0; k < 3; k++) kumoSprite(P, sc, k, H);
    if (P.dark) glowSprite(sc, P.glow);
    const t = o.still ? 0 : o.t || 0;
    if (up < 0.8) reachedAt = -1;
    // the sky, warming towards the top
    const hY = lerp(H * 0.6, H * 0.74, up);
    const e = smooth(0.45, 1, up) * 0.5;
    skyBands(ctx, W, 0, hY, P, e, 10);
    // the sun (the moon), coming round over the top as he nears it
    const k = smooth(0.7, 1, up);
    const discX = lerp(W * 0.5 + Math.min(W * 0.32, 110), W / 2, k);
    const discY = lerp(H * 0.2, Math.max(H * 0.12, top - y0 - 165), k);
    const R = clamp(H * 0.036, 13, 22) * (1 + 0.6 * k);
    if (P.dark) starsNow(ctx, P, W, 0, hY - H * 0.06, t, 60, 83);
    // clouds, slowest of all, behind it
    if (P.dark) ctx.globalAlpha = 0.85;
    for (let b = Math.floor((y0 * 0.12) / 150) - 1; b * 150 < y0 * 0.12 + hY + 150; b++) {
      const size = Math.floor(hash(b, 7) * 3);
      const w = Math.round(H * KUMO_W[size]);
      const x = wrap(hash(b, 8) * W + t * (2.5 + 2 * hash(b, 9)), W + w + 20) - w - 10;
      const y = b * 150 + 60 * hash(b, 10) - y0 * 0.12;
      if (y + w * 0.32 > hY - 50 || y < -w) continue;
      put(ctx, kumoSprite(P, sc, size, H), x, y);
    }
    ctx.globalAlpha = 1;
    if (reachedAt >= 0) rays(ctx, P, discX, discY, R, t, o.still ? 1 : Math.min(1, (t - reachedAt) / 0.8), W, H);
    if (P.dark) moonAt(ctx, P, discX, discY, R);
    else sunAt(ctx, P, discX, discY, R);
    if (!P.dark) birdsNow(ctx, P, W, H * 0.3 + (y0 - G.y0s) * -0.05, t, 3, 503);
    // the far hills and a sea of treetops, sinking slowly
    const FH = Math.round(H * 0.42);
    const far = kept('far', W, FH, sc, (g) => paintFarClimb(g, P, W, FH));
    put(ctx, far, 0, hY - FH * 0.62);
    ctx.fillStyle = mix(P.cedar, P.far2, 0.15);
    if (hY + FH * 0.38 < H) ctx.fillRect(0, hY + FH * 0.38 - 1, W, H - hY - FH * 0.38 + 1);
    // the forest's trunks at the sides, at half the speed, up to the tops of its trees
    const mY = H * 0.72 + G.y0e * 0.5; // the forest's top, in its own units
    const topScreen = mY - y0 * 0.5;
    const CH = 130;
    const at = Math.round(wrap(mY, MT));
    const strips = {};
    for (const side of [-1, 1]) {
      strips[side] = [0, 1].map((v) => kept('strip' + side + v, sw, MT, sc, (g) => paintStrip(g, P, sw, side, v)));
      kept('tops' + side + '|' + at, sw, CH + 4, sc, (g) => paintTops(g, P, sw, side, CH, at, side < 0 ? 831 : 837));
    }
    if (topScreen < H) {
      for (const side of [-1, 1]) {
        const x = side < 0 ? 0 : W - sw;
        const from = Math.max(topScreen, 0);
        for (let m = Math.floor((from + y0 * 0.5) / MT) * MT; m - y0 * 0.5 < H; m += MT) {
          const sy = m - y0 * 0.5;
          const cut = Math.max(0, topScreen - sy, -sy - 2);
          const end = Math.min(MT, H - sy + 2);
          if (cut >= end) continue;
          putRows(ctx, strips[side][hash(Math.round(m / MT), side < 0 ? 941 : 947) < 0.5 ? 0 : 1], cut, end, x, sy);
        }
        const tops = kept('tops' + side + '|' + at, sw, CH + 4, sc, (g) => paintTops(g, P, sw, side, CH, at, side < 0 ? 831 : 837));
        if (topScreen - CH < H && topScreen > -10) put(ctx, tops, x, topScreen - CH);
      }
    }
    // the great trunk, up the middle, at the speed of the ledges
    const tile = [0, 1].map((v) => kept('trunk' + v, tw * 2 + TPAD * 2, TT, sc, (g) => paintTrunkTile(g, P, tw, v)));
    const tx = W / 2 - tw - TPAD;
    const end = top + 60; // its top, inside the crown
    const baseY = -BASE_UP; // where the picture of its foot begins
    const from = Math.max(end, y0);
    const lamps = [];
    const hollows = [];
    for (let k = Math.floor(from / TT); k * TT < Math.min(baseY, y0 + H); k++) {
      const v = trunkVariant(k);
      const a = Math.max(k * TT, end, Math.floor(y0) - 2);
      const b = Math.min((k + 1) * TT, baseY, Math.ceil(y0 + H) + 2);
      if (b <= a) continue;
      putRows(ctx, tile[v], a - k * TT, b - k * TT, tx, k * TT - y0);
      if (v === 1 && k * TT + TILE_LAMP > a + 8 && k * TT + TILE_LAMP < b - 8) lamps.push([W / 2 - tw - 8, k * TT + TILE_LAMP - y0]);
      else if (v === 0 && k * TT + TILE_HOLLOW > a + 10 && k * TT + TILE_HOLLOW < b - 10) hollows.push([W / 2 - tw * 0.15, k * TT + TILE_HOLLOW - y0]);
    }
    if (y0 + H > baseY) {
      const down = baseDown(G);
      const bt = kept('base' + down, W, BASE_UP + down, sc, (g) => {
        const at = paintBase(g, P, W, tw, 851, down);
        g.canvas.lamp = at;
      });
      put(ctx, bt, 0, baseY - y0);
      if (bt.lamp) lamps.push([bt.lamp[0], bt.lamp[1] + baseY - y0]);
    }
    if (P.dark) {
      const glow = glowSprite(sc, P.glow);
      lamps.forEach(([x, y], k) => {
        if (y < -40 || y > H + 40) return;
        ctx.globalAlpha = o.still ? 0.85 : 0.78 + 0.12 * Math.sin(t * 7.3 + k * 2) + 0.08 * Math.sin(t * 13.1 + k);
        ctx.drawImage(glow, x - 28, y - 28, 56, 56);
      });
      ctx.globalAlpha = 1;
      for (const [x, y] of hollows) if (y > -20 && y < H + 20) owlEyes(ctx, P, x, y, tw * 0.36, t + x);
    }
    drift(ctx, P, W, H, t, -y0 * 0.9, sc, 0, W);
  }
  // rays round the sun (the moon) at the top, turning, a: how far they have come in
  function rays(ctx, P, x, y, R, t, a, W, H) {
    if (a <= 0) return;
    const n = 14;
    const L = Math.hypot(W, H);
    const spin = t * 0.12;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a0 = spin + (i / n) * TAU;
      const a1 = a0 + (TAU / n) * 0.5;
      ctx.moveTo(x + Math.cos(a0) * R * 1.3, y + Math.sin(a0) * R * 1.3);
      ctx.lineTo(x + Math.cos(a0) * L, y + Math.sin(a0) * L);
      ctx.lineTo(x + Math.cos(a1) * L, y + Math.sin(a1) * L);
      ctx.lineTo(x + Math.cos(a1) * R * 1.3, y + Math.sin(a1) * R * 1.3);
      ctx.closePath();
    }
    ctx.fillStyle = rgba(P.dark ? '#FFE7AE' : '#FFF6D6', (P.dark ? 0.16 : 0.32) * a);
    ctx.fill();
  }

  // ---------- the ledges: branches out of the trunk ----------

  function ledge(ctx, o, C) {
    const P = palOf(o.season || seasonNow, o.dark);
    const { x, y, W } = o;
    const side = o.side || (x < W / 2 ? -1 : 1);
    const tw = trunkHalf(W);
    const e = W / 2 + side * tw; // the trunk's side
    const tip = x + side * 50;
    const n = o.n | 0;
    const near = e + (tip - e) * 0.2;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // its top comes out of the trunk in a curve, then runs on, falling a little, through where he stands
    const topEdge = () => {
      ctx.moveTo(e - side * 1.5, y - 9);
      ctx.quadraticCurveTo(e + side * 2.5, y - 2.2, near, y - 1.4);
      ctx.quadraticCurveTo((near + x) / 2, y - 0.8, x, y);
      ctx.quadraticCurveTo((x + tip) / 2, y + 0.8, tip, y + 2);
    };
    const rest = () => {
      ctx.quadraticCurveTo(tip + side * 6.5, y + 6.4, tip, y + 10.6);
      ctx.quadraticCurveTo((x + tip) / 2, y + 12, x, y + 13.5);
      ctx.quadraticCurveTo(near, y + 15.5, e + side * 6, y + 19);
      ctx.quadraticCurveTo(e + side * 1.5, y + 21, e - side * 1.5, y + 27);
    };
    const path = () => {
      ctx.beginPath();
      topEdge();
      rest();
      ctx.closePath();
    };
    // a hard shadow under it
    ctx.save();
    ctx.translate(2, 3.5);
    path();
    ctx.fillStyle = rgba(P.shadow, P.dark ? 0.55 : 0.32);
    ctx.fill();
    ctx.restore();
    path();
    ctx.fillStyle = P.bark;
    ctx.fill();
    ctx.save();
    path();
    ctx.clip();
    // shade along its underside, light along its top
    ctx.beginPath();
    ctx.moveTo(e - side * 6, y + 40);
    ctx.lineTo(e - side * 6, y + 21);
    ctx.quadraticCurveTo(near, y + 11.5, x, y + 9.5);
    ctx.quadraticCurveTo((x + tip) / 2, y + 8.2, tip + side * 9, y + 6.5);
    ctx.lineTo(tip + side * 9, y + 40);
    ctx.closePath();
    ctx.fillStyle = P.barkShade;
    ctx.fill();
    ctx.beginPath();
    topEdge();
    ctx.lineWidth = 6.4;
    ctx.strokeStyle = P.barkLit;
    ctx.stroke();
    // its grain
    ctx.beginPath();
    ctx.moveTo(e + side * 4, y + 8.5);
    ctx.quadraticCurveTo(near + side * 6, y + 7, x + side * 12, y + 6.6);
    ctx.moveTo(x - side * 6, y + 10.6);
    ctx.quadraticCurveTo((x + tip) / 2, y + 9.2, tip - side * 9, y + 6.2);
    ctx.moveTo(near, y + 12.5);
    ctx.lineTo(near + side * 10, y + 12);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = P.barkLine;
    ctx.stroke();
    ctx.restore();
    // its outline, round all but where it is part of the trunk
    ctx.beginPath();
    topEdge();
    rest();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = P.barkLine;
    ctx.stroke();
    // a twig up from its end, and the season on it: snow on top, or moss; leaves at the end
    ctx.beginPath();
    ctx.moveTo(tip - side * 4, y + 2);
    ctx.quadraticCurveTo(tip + side * 2, y - 5, tip + side * 4, y - 9);
    ctx.lineWidth = 3.4;
    ctx.strokeStyle = P.barkLine;
    ctx.stroke();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = P.bark;
    ctx.stroke();
    if (P.season === 'winter') {
      ctx.beginPath();
      ctx.moveTo(near - side * 2, y - 4.2);
      ctx.quadraticCurveTo((near + x) / 2, y - 3.8, x, y - 2.8);
      ctx.quadraticCurveTo((x + tip) / 2, y - 2, tip + side * 2, y - 0.2);
      ctx.quadraticCurveTo(tip + side * 5.5, y + 2.6, tip + side * 1, y + 3.8);
      for (let k = 7; k >= 0; k--) {
        const u = k / 7;
        ctx.lineTo(lerp(near - side * 2, tip, u), y + 2.4 + (k % 2 ? 1.8 : 0) - (1 - u) * 2.6);
      }
      ctx.closePath();
      ctx.fillStyle = P.snow;
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = P.snowLine;
      ctx.stroke();
      // and icicles under it
      ctx.beginPath();
      for (let k = 0; k < 3; k++) {
        const ix = lerp(x + side * 18, tip - side * 4, k / 2);
        ctx.moveTo(ix - 1.8, y + 11.4);
        ctx.lineTo(ix, y + 18 + 3 * (k % 2));
        ctx.lineTo(ix + 1.8, y + 11.2);
      }
      ctx.fillStyle = P.snowShade;
      ctx.fill();
      ctx.lineWidth = 0.9;
      ctx.stroke();
    } else {
      const cs = [];
      for (let k = 0; k < 3; k++) {
        const u = 0.02 + k * 0.09;
        cs.push([lerp(near, x, u), y - 2.4 - u * 2, 3.3 + (k % 2)]);
      }
      leafMass(ctx, cs, P.moss, 0.8, false);
    }
    const tuft = clusterOf(rng(600 + n), tip + side * 6, y - 8, 10.5, 0.78);
    leafMass(ctx, tuft, n % 2 ? P.leaf : P.leaf2, 1.3, true);
    if (P.season === 'winter') snowOn(ctx, tuft, P, 0.9);
    else if (P.season === 'spring') {
      blossom(ctx, tip + side * 3, y - 11, 3, P.mark, P.markIn);
      blossom(ctx, tip + side * 11, y - 5, 2.6, P.mark, P.markIn);
    } else if (P.season === 'autumn') {
      ctx.beginPath();
      maplePath(ctx, tip + side * 9, y - 12, 3.6, 0.4);
      ctx.fillStyle = P.mark;
      ctx.fill();
    } else {
      // an acorn or two hanging under it
      smallFruit(ctx, P, 'acorn', tip - side * 2, y + 19, 3.8);
    }
    ctx.restore();
  }

  // ---------- the top: the crown of the great tree, its nest and chicks ----------

  function paintCrownTop(g, P, W, py, full) {
    // the crown under where he stands (py), the platform of a fork in its branches: as wide as the picture (W), which
    // is the screen's width on a phone; on a wide screen a dome, its foot rising to its sides, the sky beside it
    const R = rng(977);
    const cx = W / 2 + 20;
    const list = [];
    for (let x = full ? 0 : 52; x < (full ? W + 50 : W - 52); x += 22 + R() * 10) {
      const side = Math.min(1, Math.abs(x - W / 2) / (W / 2));
      const lift = full ? 0 : side * side * 70;
      // rows down to a scalloped foot well inside the picture, the trunk going up into it
      for (let y = py + 18; y < py + 170 - lift; y += 34) list.push([x + (R() - 0.5) * 12, y + (R() - 0.5) * 10 + side * 10 - (y > py + 120 ? side * 26 : 0), 22 + R() * 8]);
      if (side > 0.5) list.push([x, py - 18 - 22 * side * R() - (full ? 0 : 18 * side), 18 + R() * 6]);
    }
    list.sort((a, b) => a[1] - b[1]);
    for (const m of list) {
      const cs = clusterOf(rng(Math.round(m[0] * 7 + m[1])), m[0], m[1], m[2]);
      const L = (P.season === 'autumn' || P.season === 'spring') && hash(Math.round(m[0]), Math.round(m[1])) < 0.45 ? P.leaf2 : P.leaf;
      leafMass(g, cs, L, 1.5, true);
      if (P.season === 'winter') snowOn(g, cs, P, 1.1);
      else seasonMarks(g, P, cs, R, P.season === 'spring' ? 7 : 4);
    }
    // the fork: a thick bough across, banded in light, knotted, its ends lost in leaves
    const x0 = cx - 118;
    const x1 = cx + 116;
    const bough = () => {
      g.beginPath();
      g.moveTo(x0, py + 3);
      g.quadraticCurveTo(cx - 70, py - 2.5, cx - 20, py - 0.8);
      g.quadraticCurveTo(cx + 40, py + 1, x1, py - 5);
      g.lineTo(x1 + 4, py + 7);
      g.quadraticCurveTo(cx + 44, py + 13, cx - 10, py + 16);
      g.quadraticCurveTo(cx - 64, py + 19, x0 - 2, py + 21);
      g.closePath();
    };
    bough();
    g.lineWidth = 4.6;
    g.strokeStyle = P.barkLine;
    g.stroke();
    g.fillStyle = P.bark;
    g.fill();
    g.save();
    bough();
    g.clip();
    g.beginPath();
    g.moveTo(x0 - 4, py + 30);
    g.lineTo(x0 - 4, py + 13);
    g.quadraticCurveTo(cx - 40, py + 10.5, cx, py + 10);
    g.quadraticCurveTo(cx + 50, py + 8.5, x1 + 6, py + 2);
    g.lineTo(x1 + 6, py + 30);
    g.closePath();
    g.fillStyle = P.barkShade;
    g.fill();
    g.beginPath();
    g.moveTo(x0, py + 3);
    g.quadraticCurveTo(cx - 70, py - 2.5, cx - 20, py - 0.8);
    g.quadraticCurveTo(cx + 40, py + 1, x1, py - 5);
    g.lineWidth = 7;
    g.strokeStyle = P.barkLit;
    g.stroke();
    g.lineWidth = 1.3;
    g.strokeStyle = P.barkLine;
    g.beginPath();
    g.moveTo(x0 + 10, py + 9);
    g.quadraticCurveTo(cx - 50, py + 6, cx - 6, py + 7);
    g.moveTo(cx + 14, py + 8);
    g.quadraticCurveTo(cx + 60, py + 6, x1 - 8, py + 2);
    g.stroke();
    for (const kx of [cx - 36, cx + 34]) {
      g.beginPath();
      g.ellipse(kx, py + 9.5, 3.2, 2, 0, 0, TAU);
      g.fillStyle = P.barkShade;
      g.fill();
      g.beginPath();
      g.ellipse(kx, py + 9.5, 6, 3.4, 0, 0, TAU);
      g.stroke();
    }
    g.restore();
    if (P.season === 'winter') {
      g.beginPath();
      g.moveTo(x0, py + 1);
      g.quadraticCurveTo(cx - 70, py - 5, cx - 20, py - 3.6);
      g.quadraticCurveTo(cx + 40, py - 2, x1, py - 8);
      g.lineTo(x1, py - 3.5);
      g.quadraticCurveTo(cx + 40, py + 2.4, cx - 20, py + 1.8);
      g.quadraticCurveTo(cx - 70, py + 1, x0, py + 6);
      g.closePath();
      g.fillStyle = P.snow;
      g.fill();
      g.lineWidth = 1.1;
      g.strokeStyle = P.snowLine;
      g.stroke();
    }
    // the sacred rope draped along it, with its streamers
    const rp = [];
    for (let i = 0; i <= 10; i++) {
      const u = i / 10;
      rp.push([lerp(cx - 104, cx - 26, u), py + 14 + 7 * Math.sin(PI * u)]);
    }
    rope(g, P, rp, 5);
    for (const u of [0.3, 0.7]) shide(g, P, lerp(cx - 104, cx - 26, u), py + 16 + 7 * Math.sin(PI * u), 15);
    // leaves at the bough's ends, and hanging under it
    for (const [x, yy, r] of [[x0 - 4, py + 6, 17], [x1 + 2, py + 2, 18], [cx + 70, py + 22, 11], [cx - 4, py + 24, 10]]) {
      const cs = clusterOf(R, x, yy, r, 0.8);
      leafMass(g, cs, P.leaf, 1.4, true);
      if (P.season === 'winter') snowOn(g, cs, P, 1);
      else seasonMarks(g, P, cs, R, 3);
    }
    // a twig over the nest, for the parent bird
    const nxT = W / 2 + 62;
    g.beginPath();
    g.moveTo(nxT + 16, py + 2);
    g.quadraticCurveTo(nxT + 26, py - 14, nxT + 22, py - 34);
    g.lineWidth = 4.2;
    g.strokeStyle = P.barkLine;
    g.stroke();
    g.lineWidth = 2.2;
    g.strokeStyle = P.bark;
    g.stroke();
    const tw2 = clusterOf(R, nxT + 30, py - 34, 8, 0.8);
    leafMass(g, tw2, P.leaf2, 1.2, true);
    if (P.season === 'winter') snowOn(g, tw2, P, 0.8);
    // the nest's back, where the chicks sit
    const nx = W / 2 + 62;
    g.beginPath();
    g.ellipse(nx, py - 8, 27, 11, 0, PI, TAU);
    g.lineTo(nx + 27, py - 2);
    g.closePath();
    g.fillStyle = P.nestShade;
    g.fill();
    g.lineWidth = 1.8;
    g.strokeStyle = P.nestLine;
    g.stroke();
  }
  function chicks(ctx, P, nx, py, t, reached, still) {
    const k3 = [-15, 0, 15];
    k3.forEach((dx, i) => {
      const speed = reached ? 9 : 4;
      const hop = still ? 0 : Math.abs(Math.sin(t * speed + i * 1.7)) * (reached ? 5 : 1.2);
      const x = nx + dx;
      const y = py - 15 - hop - (i === 1 ? 2 : 0);
      const r = 7.4;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fillStyle = P.chickShade;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x - 0.8, y - 1, r * 0.86, 0, TAU);
      ctx.fillStyle = P.chick;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x - 2.4, y - 3, r * 0.34, 0, TAU);
      ctx.fillStyle = P.chickLit;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = P.ink;
      ctx.stroke();
      // a tuft on its head
      ctx.beginPath();
      ctx.moveTo(x - 1, y - r + 0.5);
      ctx.quadraticCurveTo(x - 2, y - r - 4, x + 1.5, y - r - 4.5);
      ctx.moveTo(x + 0.5, y - r + 0.5);
      ctx.quadraticCurveTo(x + 2, y - r - 2.5, x + 4, y - r - 2);
      ctx.lineWidth = 1.2;
      ctx.stroke();
      // eyes, and the beak: open while it sings
      const open = reached && !still ? 0.5 + 0.5 * Math.sin(t * 12 + i * 2) : i === 1 ? 0.6 : 0;
      ctx.fillStyle = P.ink;
      ctx.beginPath();
      ctx.arc(x - 2.6, y - 1.6, 1.05, 0, TAU);
      ctx.arc(x + 2.6, y - 1.6, 1.05, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - 2.6, y + 1);
      ctx.lineTo(x + 2.6, y + 1);
      ctx.lineTo(x, y + 2.4 + open * 1.2);
      ctx.closePath();
      ctx.moveTo(x - 2.2, y + 1.8 + open * 2.2);
      ctx.lineTo(x + 2.2, y + 1.8 + open * 2.2);
      ctx.lineTo(x, y + 4.6 + open * 2.6);
      ctx.closePath();
      ctx.fillStyle = P.beak;
      ctx.fill();
      ctx.lineWidth = 0.9;
      ctx.strokeStyle = P.ink;
      ctx.stroke();
    });
  }
  function nestFront(ctx, P, nx, py) {
    ctx.beginPath();
    ctx.moveTo(nx - 29, py - 10);
    ctx.quadraticCurveTo(nx - 28, py + 3, nx, py + 3);
    ctx.quadraticCurveTo(nx + 28, py + 3, nx + 29, py - 10);
    ctx.quadraticCurveTo(nx, py - 3, nx - 29, py - 10);
    ctx.closePath();
    ctx.fillStyle = P.nest;
    ctx.fill();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = P.nestLine;
    ctx.stroke();
    // twigs woven round it
    ctx.beginPath();
    for (let k = 0; k < 9; k++) {
      const x = nx - 24 + k * 6;
      ctx.moveTo(x - 3, py - 6 + Math.abs(k - 4) * 0.6);
      ctx.lineTo(x + 4, py - 1 + Math.abs(k - 4) * 0.3);
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = P.nestShade;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(nx - 26, py - 7);
    ctx.quadraticCurveTo(nx, py - 2.6, nx + 26, py - 7);
    ctx.lineWidth = 2;
    ctx.strokeStyle = P.nestLit;
    ctx.stroke();
  }
  // the parent bird (a white-eye, green with its white ring round the eye), its wings beating at f
  function birdAt(ctx, P, x, y, s, f, dir) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir * s, s);
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 5.6, -0.15, 0, TAU);
    ctx.fillStyle = P.bird2;
    ctx.fill();
    ctx.lineWidth = 1.3 / s;
    ctx.strokeStyle = P.ink;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-6, -1);
    ctx.lineTo(-13, -3);
    ctx.lineTo(-12, 2);
    ctx.closePath();
    ctx.fillStyle = P.bird2;
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(6, -2.4, 4.4, 0, TAU);
    ctx.fillStyle = P.bird2Lit;
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(7, -2.8, 1.9, 0, TAU);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(7.2, -2.8, 0.9, 0, TAU);
    ctx.fillStyle = P.ink;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(10, -2.6);
    ctx.lineTo(13.6, -1.6);
    ctx.lineTo(10, -0.8);
    ctx.closePath();
    ctx.fillStyle = P.ink;
    ctx.fill();
    // the wing
    ctx.beginPath();
    ctx.moveTo(-3, -2);
    ctx.quadraticCurveTo(0, -2 - 9 * f, 5, -3 - 6 * f);
    ctx.quadraticCurveTo(3, 0, -3, -2);
    ctx.closePath();
    ctx.fillStyle = mix(P.bird2, P.ink, 0.25);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  // the world's y at the top and the foot of what the context shows, or null
  function viewOf(ctx) {
    try {
      const m = ctx.getTransform();
      if (!(m.d > 0) || m.b || m.c) return null;
      return [-m.f / m.d, (ctx.canvas.height - m.f) / m.d];
    } catch (err) {
      return null;
    }
  }
  function sparkle(ctx, x, y, s) {
    ctx.moveTo(x, y - s);
    ctx.quadraticCurveTo(x, y, x + s, y);
    ctx.quadraticCurveTo(x, y, x, y + s);
    ctx.quadraticCurveTo(x, y, x - s, y);
    ctx.quadraticCurveTo(x, y, x, y - s);
  }
  function note(ctx, x, y, s) {
    ctx.moveTo(x + s * 0.7, y);
    ctx.ellipse(x, y, s * 0.7, s * 0.5, -0.4, 0, TAU);
    ctx.moveTo(x + s * 0.6, y - 0.2);
    ctx.lineTo(x + s * 0.6, y - s * 2.4);
    ctx.lineTo(x + s * 1.6, y - s * 1.8);
  }
  function summit(ctx, o, C) {
    const P = palOf(o.season || seasonNow, o.dark);
    const { W, y } = o;
    const t = o.still ? 0 : o.t || 0;
    if (o.reached) {
      if (reachedAt < 0) reachedAt = t;
    } else reachedAt = -1;
    const since = o.reached ? Math.max(0, t - reachedAt) : 0;
    const sc = scaleOf(ctx);
    drawn();
    // the crown: the screen's width on a phone, a dome on a wide screen (the height shown, from the context)
    const view = viewOf(ctx);
    const H = view ? view[1] - view[0] : W * 1.6;
    const full = W < H * 1.1;
    const pw = full ? W : Math.round(clamp(H * 1.25, 300, W));
    const crown = kept('crown' + pw, pw, 320, sc, (g) => paintCrownTop(g, P, pw, 100, full));
    // out of sight (Climb draws the top every frame, far above the view at first): nothing more to do
    if (view && (y - 260 > view[1] || y + 220 < view[0])) return;
    put(ctx, crown, (W - pw) / 2, y - 100);
    const nx = W / 2 + 62;
    chicks(ctx, P, nx, y - 2, t, !!o.reached, !!o.still);
    nestFront(ctx, P, nx, y - 2);
    // the parent bird: on a twig above the nest, then, once he is there, round and round over it
    if (o.reached && !o.still) {
      const a = since * 2.2;
      const bx = W / 2 + Math.cos(a) * Math.min(W * 0.36, 120);
      const by = y - 120 + Math.sin(a) * 34;
      birdAt(ctx, P, bx, by, 1.1, Math.sin(t * 16), -Math.sin(a) >= 0 ? 1 : -1);
    } else {
      birdAt(ctx, P, nx + 22, y - 41, 1, o.still ? 0.2 : 0.2 + 0.1 * Math.sin(t * 2), -1);
    }
    if (!o.reached) return;
    // sparkles round the crown, notes from the chicks, the season thrown up into the air
    ctx.save();
    ctx.beginPath();
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * TAU + t * 0.3;
      const r = Math.min(W * 0.42, 150) * (0.65 + 0.35 * hash(k, 61));
      const s = 3 + 2.5 * Math.max(0, Math.sin(t * 4 + k * 1.9));
      sparkle(ctx, W / 2 + Math.cos(a) * r, y - 70 + Math.sin(a) * r * 0.45, s);
    }
    ctx.fillStyle = P.spark;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(P.ink, 0.6);
    ctx.stroke();
    ctx.beginPath();
    for (let k = 0; k < 3; k++) {
      const u = wrap(since * 0.5 + k / 3, 1);
      note(ctx, nx - 12 + k * 12 + Math.sin(u * 7 + k) * 5, y - 28 - u * 60, 3.2);
    }
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = P.dark ? '#FFE7AE' : P.ink;
    ctx.fillStyle = P.dark ? '#FFE7AE' : P.ink;
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 1;
    // a burst of the season out of the crown
    const n = 18;
    const cols = P.season === 'autumn' ? [P.leaf.base, P.leaf2.base] : P.season === 'winter' ? [P.snow, P.snowShade] : P.season === 'summer' ? [P.leaf2.lit, P.leaf.lit] : [P.petal[0], P.petal[1]];
    for (let pass = 0; pass < 2; pass++) {
      ctx.beginPath();
      for (let k = pass; k < n; k += 2) {
        const life = 2.6;
        const s = wrap(since + hash(k, 71) * life, life);
        const vx = (hash(k, 72) - 0.5) * 150;
        const vy = -90 - 70 * hash(k, 73);
        const px = W / 2 + vx * s;
        const py = y - 10 + vy * s + 70 * s * s;
        if (P.season === 'autumn') maplePath(ctx, px, py, 4, s * 5 + k);
        else {
          ctx.moveTo(px + 3.2, py);
          ctx.ellipse(px, py, 3.2, 1.9, s * 4 + k, 0, TAU);
        }
      }
      ctx.fillStyle = cols[pass];
      ctx.fill();
    }
    ctx.restore();
  }

  // ---------- the falling things: acorns, pears and persimmons ----------
  // Each is drawn round the box of its word: a cream face for the word, the fruit round it.

  const KINDS = ['acorn', 'pear', 'kaki'];
  const FRUIT = {
    acorn: {
      light: { base: '#BC6A2C', lit: '#E89E58', shade: '#7E3E18', cap: '#6E4E2E', capLit: '#A27C4C', capShade: '#45301A', face: '#FFF8EA', faceLine: '#E8C8A2', leaf: '#4E9A3A' },
      dark: { base: '#B4642C', lit: '#E09A58', shade: '#6E3616', cap: '#5E4228', capLit: '#8E6C44', capShade: '#38260F', face: '#FFF2DE', faceLine: '#D8B48C', leaf: '#3E8A36' },
    },
    pear: {
      light: { base: '#E8B238', lit: '#FFE27E', shade: '#AE7620', dot: '#8E6420', leaf: '#4C9A38', leafLit: '#8CC85C', stem: '#6A4424', face: '#FFF8EA', faceLine: '#EDD49A' },
      dark: { base: '#E0A838', lit: '#FFD878', shade: '#966420', dot: '#7A5418', leaf: '#3E8A36', leafLit: '#7AB854', stem: '#5A3A1E', face: '#FFF2DE', faceLine: '#DEC48E' },
    },
    kaki: {
      light: { base: '#F26C1E', lit: '#FFAA52', shade: '#BE4018', leaf: '#3D8832', leafLit: '#78BA4A', stem: '#5A3A1E', face: '#FFF8EA', faceLine: '#F4C8A2' },
      dark: { base: '#EC661E', lit: '#FFA24E', shade: '#9E3414', leaf: '#367A32', leafLit: '#6AAA48', stem: '#4A2E18', face: '#FFF2DE', faceLine: '#E8B892' },
    },
  };
  // the shape of each: how round (the power of its superellipse) and how far out of the word's box
  const SHAPE = { acorn: { p: 2.6, mx: 11, my: 10 }, pear: { p: 2.35, mx: 15, my: 14 }, kaki: { p: 2.9, mx: 13, my: 12 } };
  const FACE_P = 3.4;
  const N_PTS = 36;
  const UNIT = new Map();
  function unitShape(p) {
    let u = UNIT.get(p);
    if (!u) {
      u = [];
      for (let i = 0; i < N_PTS; i++) {
        const a = (i / N_PTS) * TAU;
        const c = Math.cos(a);
        const s = Math.sin(a);
        u.push([Math.sign(c) * Math.pow(Math.abs(c), 2 / p), Math.sign(s) * Math.pow(Math.abs(s), 2 / p)]);
      }
      UNIT.set(p, u);
    }
    return u;
  }
  // the point i of a fruit's outline round (cx, cy), half sizes a and b (i counts round from the right, 10 degrees a
  // step, downwards first)
  function fruitPt(kind, cx, cy, a, b, i) {
    const [ux, uy] = unitShape(SHAPE[kind].p)[wrap(i, N_PTS)];
    let x = cx + ux * a;
    let y = cy + uy * b;
    if (kind === 'kaki' && uy < 0) y = cy + uy * b * 0.9;
    else if (kind === 'acorn' && uy > 0) {
      x = cx + ux * a * (1 - 0.16 * uy * uy);
      y += Math.pow(uy, 40) * 11;
    }
    return [x, y];
  }
  // a point on its rim, between the face (half sizes fa, fb) at k 0 and its outline at k 1
  function rimPt(kind, cx, cy, a, b, fa, fb, i, k) {
    const p = fruitPt(kind, cx, cy, a, b, i);
    const u = unitShape(FACE_P)[wrap(i, N_PTS)];
    return [lerp(cx + u[0] * fa, p[0], k), lerp(cy + u[1] * fb, p[1], k)];
  }
  function rimLine(ctx, kind, cx, cy, a, b, fa, fb, i0, i1, k) {
    ctx.beginPath();
    for (let i = i0; i <= i1; i++) {
      const p = rimPt(kind, cx, cy, a, b, fa, fb, i, k);
      if (i > i0) ctx.lineTo(p[0], p[1]);
      else ctx.moveTo(p[0], p[1]);
    }
  }
  // its outline as a smooth closed path (a pear's with its neck)
  function fruitPath(ctx, kind, cx, cy, a, b) {
    const pt = (i) => fruitPt(kind, cx, cy, a, b, i);
    let p = pt(N_PTS - 1);
    let q = pt(0);
    ctx.beginPath();
    ctx.moveTo((p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    for (let i = 0; i < N_PTS; i++) {
      p = pt(i);
      q = pt(i + 1);
      ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    }
    ctx.closePath();
    if (kind === 'pear') {
      const r = neckOf(a);
      ctx.moveTo(cx + r, cy - b + 4);
      ctx.ellipse(cx, cy - b + 4, r, NECK_H, 0, 0, TAU);
    }
  }
  const NECK_H = 13;
  const neckOf = (a) => Math.min(a * 0.4, 28);
  function facePath(ctx, cx, cy, a, b) {
    const U = unitShape(FACE_P);
    ctx.beginPath();
    let p = U[N_PTS - 1];
    let q = U[0];
    ctx.moveTo(cx + ((p[0] + q[0]) / 2) * a, cy + ((p[1] + q[1]) / 2) * b);
    for (let i = 0; i < N_PTS; i++) {
      p = U[i];
      q = U[(i + 1) % N_PTS];
      ctx.quadraticCurveTo(cx + p[0] * a, cy + p[1] * b, cx + ((p[0] + q[0]) / 2) * a, cy + ((p[1] + q[1]) / 2) * b);
    }
    ctx.closePath();
  }
  function thing(ctx, o) {
    const { x, y, w, h } = o;
    const kind = KINDS[wrap(o.n | 0, KINDS.length)];
    const dark = !!o.dark;
    const F = FRUIT[kind][dark ? 'dark' : 'light'];
    const S = SHAPE[kind];
    const cx = x + w / 2;
    const cy = y + h / 2;
    const a = w / 2 + S.mx;
    const b = h / 2 + S.my;
    const flash = !!o.flash;
    const target = !!o.target && !flash;
    const t = o.t || 0;
    const ink = dark ? '#0A0D1C' : INK;
    const line = flash ? (dark ? '#FF7A5E' : '#C7361E') : ink;
    const base = flash ? mix(F.base, '#E23A26', 0.55) : F.base;
    const shade = flash ? mix(F.shade, '#A01E14', 0.5) : F.shade;
    const lit = flash ? mix(F.lit, '#FF8A70', 0.5) : F.lit;
    const season = seasonNow;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // the one to say: a band of gold round it, edged in ink, beating, with a glow and two sparkles
    if (target) {
      const beat = 0.5 + 0.5 * Math.sin(t * 5);
      const g = 8 + beat * 1.6;
      fruitPath(ctx, kind, cx, cy, a + g, b + g);
      ctx.lineWidth = 14;
      ctx.strokeStyle = rgba('#FFD25A', 0.2 + 0.16 * beat);
      ctx.stroke();
      ctx.lineWidth = 7.4;
      ctx.strokeStyle = ink;
      ctx.stroke();
      ctx.lineWidth = 4.6;
      ctx.strokeStyle = '#F7BE3E';
      ctx.stroke();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = '#FFE9A6';
      ctx.stroke();
      ctx.beginPath();
      const s1 = 4.5 + 2.5 * beat;
      const s2 = 3.5 + 2.5 * (1 - beat);
      sparkle(ctx, cx + a + g - 2, cy - b - g + 6, s1);
      sparkle(ctx, cx - a - g + 4, cy + b * 0.35, s2);
      ctx.fillStyle = '#FFF1B8';
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = ink;
      ctx.stroke();
    }
    // its hard shadow
    fruitPath(ctx, kind, cx + 3.5, cy + 4, a, b);
    ctx.fillStyle = dark ? '#03050C' : INK;
    ctx.fill();
    // its outline, under the fruit: in its shade, then its own colour up and to the left of that, then a band of light
    const lw = target ? 3.4 : flash ? 3 : 2.4;
    fruitPath(ctx, kind, cx, cy, a, b);
    ctx.lineWidth = lw * 2;
    ctx.strokeStyle = line;
    ctx.stroke();
    ctx.fillStyle = shade;
    ctx.fill();
    fruitPath(ctx, kind, cx - 1.8, cy - 2.2, a - 1.6, b - 1.8);
    ctx.fillStyle = base;
    ctx.fill();
    const fa = w / 2 + 4;
    const fb = h / 2 + 3;
    rimLine(ctx, kind, cx, cy, a, b, fa, fb, 19, 26, 0.55);
    ctx.lineWidth = 4.2;
    ctx.strokeStyle = lit;
    ctx.stroke();
    if (kind === 'pear') {
      // its freckles
      ctx.beginPath();
      for (let i = 0; i < N_PTS; i += 2) {
        if (i > 18 && i < 28) continue;
        const p = rimPt(kind, cx, cy, a, b, fa, fb, i, i % 4 ? 0.42 : 0.68);
        ctx.moveTo(p[0] + 1, p[1]);
        ctx.arc(p[0], p[1], 1, 0, TAU);
      }
      ctx.fillStyle = F.dot;
      ctx.fill();
    }
    if (kind === 'pear') {
      // light on the neck too
      const r = neckOf(a);
      ctx.beginPath();
      ctx.ellipse(cx - 1, cy - b + 3, r - 4, NECK_H - 4, 0, PI * 1.05, PI * 1.5);
      ctx.lineWidth = 3.4;
      ctx.strokeStyle = lit;
      ctx.stroke();
    }
    if (dark && !flash) {
      // moonlight on its upper left
      rimLine(ctx, kind, cx, cy, a, b, fa, fb, 20, 25, 0.86);
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = 'rgba(190,210,255,0.8)';
      ctx.stroke();
    }
    // a glint
    const gl = rimPt(kind, cx, cy, a, b, fa, fb, 20, 0.5);
    ctx.beginPath();
    ctx.ellipse(gl[0], gl[1], 1.8, 3.4, 0.5, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fill();
    // the face for the word: nothing else is drawn on it
    facePath(ctx, cx, cy, fa, fb);
    ctx.fillStyle = flash ? '#FFE4DC' : F.face;
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = flash ? '#F2A08A' : F.faceLine;
    ctx.stroke();
    // what makes it what it is, round the top
    const topY = y - S.my;
    if (kind === 'acorn') acornCap(ctx, F, cx, y, w, ink, flash, line);
    else if (kind === 'pear') pearStem(ctx, F, cx, topY - NECK_H + 6, ink, season);
    else kakiCalyx(ctx, F, cx, topY + (b * 0.1), ink);
    if (season === 'winter') {
      // snow on it
      const sy = kind === 'acorn' ? y - 15 : topY + (kind === 'kaki' ? b * 0.1 : 6 - NECK_H);
      ctx.beginPath();
      ctx.moveTo(cx - 13, sy + 3);
      ctx.quadraticCurveTo(cx - 12, sy - 3.5, cx - 6, sy - 2.5);
      ctx.quadraticCurveTo(cx - 2, sy - 6, cx + 3, sy - 3);
      ctx.quadraticCurveTo(cx + 9, sy - 5, cx + 12, sy + 0.5);
      ctx.quadraticCurveTo(cx + 14, sy + 3.5, cx + 10, sy + 3.6);
      ctx.quadraticCurveTo(cx, sy + 1.6, cx - 13, sy + 3);
      ctx.closePath();
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.lineWidth = 1.3;
      ctx.strokeStyle = dark ? '#5A6CA8' : '#3A4E82';
      ctx.stroke();
    } else if (season === 'spring') blossom(ctx, cx + 11, kind === 'acorn' ? y - 10 : kind === 'pear' ? topY - NECK_H + 4 : topY - 2, 3.4, '#FFD3E0', '#E0517E');
    ctx.restore();
  }
  function acornCap(ctx, F, cx, y, w, ink, flash, line) {
    const A = w / 2 + 14;
    const top = y - 17;
    const rim = y + 3;
    const cap = () => {
      ctx.beginPath();
      ctx.moveTo(cx - A, rim);
      ctx.bezierCurveTo(cx - A, top + 2, cx - A * 0.4, top, cx, top);
      ctx.bezierCurveTo(cx + A * 0.4, top, cx + A, top + 2, cx + A, rim);
      // its edge, in little scallops
      const n = Math.max(6, Math.round(A / 5));
      for (let k = n - 1; k >= 0; k--) {
        const x0 = cx - A + (2 * A * (k + 1)) / n;
        const x1 = cx - A + (2 * A * k) / n;
        ctx.quadraticCurveTo((x0 + x1) / 2, rim + 3.4, x1, rim);
      }
      ctx.closePath();
    };
    // its hard shadow on the face, then the cap
    ctx.save();
    ctx.translate(2, 2.5);
    cap();
    ctx.fillStyle = rgba(ink, 0.3);
    ctx.fill();
    ctx.restore();
    cap();
    ctx.fillStyle = flash ? mix(F.cap, '#C7361E', 0.4) : F.cap;
    ctx.fill();
    // scales in rows
    ctx.beginPath();
    for (let row = 0; row < 3; row++) {
      const yy = top + 5 + row * 5.4;
      const hw = A * Math.sqrt(Math.max(0, 1 - Math.pow((rim - yy) / (rim - top), 2))) - 3;
      for (let x = cx - hw + (row % 2 ? 3 : 0); x <= cx + hw; x += 6) {
        ctx.moveTo(x - 2.6, yy);
        ctx.quadraticCurveTo(x, yy + 3.2, x + 2.6, yy);
      }
    }
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = F.capShade;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - A * 0.8, rim - 6);
    ctx.bezierCurveTo(cx - A * 0.75, top + 5, cx - A * 0.35, top + 2.5, cx - 2, top + 2.5);
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = F.capLit;
    ctx.stroke();
    cap();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = line;
    ctx.stroke();
    // its stalk
    ctx.beginPath();
    ctx.moveTo(cx, top + 1);
    ctx.quadraticCurveTo(cx + 1, top - 5, cx + 4.5, top - 7);
    ctx.lineWidth = 4.2;
    ctx.strokeStyle = line;
    ctx.stroke();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = F.capLit;
    ctx.stroke();
  }
  function pearStem(ctx, F, cx, topY, ink, season) {
    ctx.beginPath();
    ctx.moveTo(cx, topY + 3);
    ctx.quadraticCurveTo(cx + 1, topY - 5, cx + 4, topY - 10);
    ctx.lineWidth = 4.4;
    ctx.strokeStyle = ink;
    ctx.stroke();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = F.stem;
    ctx.stroke();
    // its leaf
    const leaf = season === 'autumn' ? '#E2672E' : F.leaf;
    const leafLit = season === 'autumn' ? '#F7A648' : F.leafLit;
    ctx.beginPath();
    ctx.moveTo(cx + 3, topY - 7);
    ctx.quadraticCurveTo(cx + 9, topY - 17, cx + 21, topY - 13);
    ctx.quadraticCurveTo(cx + 14, topY - 3, cx + 3, topY - 7);
    ctx.closePath();
    ctx.fillStyle = leaf;
    ctx.fill();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = ink;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 5, topY - 8);
    ctx.quadraticCurveTo(cx + 12, topY - 12, cx + 18, topY - 12.5);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = leafLit;
    ctx.stroke();
  }
  function kakiCalyx(ctx, F, cx, topY, ink) {
    // four broad sepals round the stem
    ctx.beginPath();
    for (const ang of [-2.75, -2.05, -1.1, -0.4]) {
      const ex = cx + Math.cos(ang) * 7;
      const ey = topY + 2 + Math.sin(ang) * 3.2 + 3;
      ctx.moveTo(cx, topY + 2);
      ctx.ellipse(ex, ey, 7.6, 3.8, ang + PI / 2 + PI / 2, 0, TAU);
    }
    ctx.fillStyle = F.leaf;
    ctx.fill();
    ctx.lineWidth = 1.7;
    ctx.strokeStyle = ink;
    ctx.stroke();
    ctx.beginPath();
    for (const ang of [-2.75, -2.05]) {
      const ex = cx + Math.cos(ang) * 7;
      const ey = topY + 2 + Math.sin(ang) * 3.2 + 3;
      ctx.moveTo(ex + 3.6, ey - 1);
      ctx.ellipse(ex, ey - 1, 3.6, 1.4, ang, 0, TAU);
    }
    ctx.fillStyle = F.leafLit;
    ctx.fill();
    // the stem
    ctx.beginPath();
    ctx.moveTo(cx, topY + 2);
    ctx.lineTo(cx + 1.4, topY - 5);
    ctx.lineWidth = 4.4;
    ctx.strokeStyle = ink;
    ctx.stroke();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = F.stem;
    ctx.stroke();
  }
  function colors(n, dark) {
    const F = FRUIT[KINDS[wrap(n | 0, KINDS.length)]][dark ? 'dark' : 'light'];
    return { fill: F.base, line: F.shade };
  }

  W0.define('mori', {
    palette: { light: THEME.light, dark: THEME.dark },
    // the branches come off the trunk on either side
    layout(n, W) {
      const side = n % 2 ? 1 : -1;
      return { x: W / 2 + side * Math.min(W * 0.26, 70), side };
    },
    fall,
    climb,
    ledge,
    summit,
    thing,
    colors,
  });
})();
