/*
 * Yaoki Typing's little items (小物) and the lines Yaoki says with them.
 *
 * Each item is a tiny sticker in the app's stationery style: flat soft fills, an ink
 * outline (pal.outline), round joins, no gradients, drawn to sit beside the words in his
 * speech bubble. They are secular and everyday: food (dango, onigiri, taiyaki, ramen,
 * bento, sushi, mikan, kakigori, tea), toys (kendama, koma, daruma-otoshi, kite, origami
 * crane), the seasons (sakura, koinobori, furin, momiji, snow, fireworks, Fuji) and a few
 * marks (star, sparkles, heart, note, sweat, the teacher's はなまる, a goal flag, a medal).
 *
 * window.TypingItems = {
 *   ITEMS: [id, ...],
 *   draw(ctx, id, x, y, size, pal, t),   // centred on (x, y), fitting a size × size box
 *   LINES: { occasion: [{ ja, en, item }, ...] },
 * }
 *
 * Every item is drawn in a 24-unit box round (0, 0) from Path2D shapes made once (when the
 * page is idle, or on the first draw). The outline stays about 1.5 logical units at the
 * bubble's size (a little finer when tiny, a little bolder when big). An item is a still
 * layer, an optional pose (a whole-item bob, sway or beat that t drives) and optional moving
 * bits drawn over it (steam, sparks, a paper strip); the still layer is kept as a bitmap at
 * the size it is shown at, so a bubble that stays up costs one drawImage and the moving bits.
 * t = 0 (reduced motion) is a still frame that reads on its own. draw() never throws, leaves
 * the context as it found it, and draws nothing for an unknown id.
 *
 * The first line of each occasion is the one game.js has built in, so the first cheer of a
 * kind is always the same; the others take turns.
 */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const BOX = 24;
  const INK = '#1B2440';

  // fills: the same in light and dark, like Yaoki himself
  const COL = {
    white: '#FFFFFF',
    rice: '#FFFDF6',
    cream: '#FFF6EA',
    pink: '#FFC6D3',
    pinkMid: '#F9A8BB',
    pinkDeep: '#F07896',
    red: '#EE6A55',
    daruma: '#E2452B',
    coral: '#F5937A',
    orange: '#F9A43E',
    gold: '#F2B43A',
    goldSoft: '#FFD978',
    goldPale: '#FFEAA6',
    green: '#9ED37E',
    greenDeep: '#6FB45A',
    leaf: '#86C765',
    matcha: '#B9D86A',
    celadon: '#C9E6D4',
    celadonDeep: '#9DCDB4',
    blue: '#8DB4F2',
    blueDeep: '#6A92E6',
    sky: '#CDEBFA',
    drop: '#9FD3F5',
    wood: '#EBC48C',
    woodDeep: '#C98A4B',
    nori: '#2D3B3F',
    lacquer: '#2D3445',
    silver: '#D3D9E8',
    salmon: '#FFA184',
    salmonFat: '#FFE1D6',
    egg: '#FFD95E',
  };

  // ---------- paths ----------

  // A Path2D drawn with a pen that can be moved, turned and scaled (for petals, lobes, ribs).
  function mk(fn) {
    const p = new Path2D();
    const T = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0, s: 1, r: 0 };
    const X = (x, y) => T.a * x + T.c * y + T.e;
    const Y = (x, y) => T.b * x + T.d * y + T.f;
    const pen = {
      at(x, y, rot, s) {
        rot = rot || 0;
        s = s == null ? 1 : s;
        const co = Math.cos(rot) * s;
        const si = Math.sin(rot) * s;
        T.a = co; T.b = si; T.c = -si; T.d = co; T.e = x || 0; T.f = y || 0; T.s = s; T.r = rot;
        return pen;
      },
      M(x, y) { p.moveTo(X(x, y), Y(x, y)); return pen; },
      L(x, y) { p.lineTo(X(x, y), Y(x, y)); return pen; },
      Q(cx, cy, x, y) { p.quadraticCurveTo(X(cx, cy), Y(cx, cy), X(x, y), Y(x, y)); return pen; },
      C(ax, ay, bx, by, x, y) { p.bezierCurveTo(X(ax, ay), Y(ax, ay), X(bx, by), Y(bx, by), X(x, y), Y(x, y)); return pen; },
      A(x1, y1, x2, y2, r) { p.arcTo(X(x1, y1), Y(x1, y1), X(x2, y2), Y(x2, y2), r * T.s); return pen; },
      Z() { p.closePath(); return pen; },
      poly(pts) {
        for (let i = 0; i < pts.length; i += 2) {
          if (i) pen.L(pts[i], pts[i + 1]);
          else pen.M(pts[i], pts[i + 1]);
        }
        return pen.Z();
      },
      circle(x, y, r) {
        const cx = X(x, y);
        const cy = Y(x, y);
        p.moveTo(cx + r * T.s, cy);
        p.arc(cx, cy, r * T.s, 0, TAU);
        p.closePath();
        return pen;
      },
      ellipse(x, y, rx, ry, rot) {
        const cx = X(x, y);
        const cy = Y(x, y);
        const ro = (rot || 0) + T.r;
        p.moveTo(cx + rx * T.s * Math.cos(ro), cy + rx * T.s * Math.sin(ro));
        p.ellipse(cx, cy, rx * T.s, ry * T.s, ro, 0, TAU);
        p.closePath();
        return pen;
      },
      // part of an ellipse, joined to the current point
      arc(x, y, rx, ry, a0, a1, ccw) {
        p.ellipse(X(x, y), Y(x, y), rx * T.s, ry * T.s, T.r, a0, a1, !!ccw);
        return pen;
      },
      rr(x, y, w, h, r) {
        return pen.M(x + r, y).A(x + w, y, x + w, y + h, r).A(x + w, y + h, x, y + h, r).A(x, y + h, x, y, r).A(x, y, x + w, y, r).Z();
      },
    };
    fn(pen);
    return p;
  }

  // a star of n points, outer radius R, inner r, centred on (cx, cy)
  function starPts(n, R, r, cx, cy) {
    const pts = [];
    for (let i = 0; i < n * 2; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / n;
      const rad = i % 2 ? r : R;
      pts.push(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
    }
    return pts;
  }
  // a four-pointed twinkle of radius s
  function twinkle(pen, x, y, s) {
    const c = s * 0.2;
    pen.M(x, y - s).Q(x + c, y - c, x + s, y).Q(x + c, y + c, x, y + s).Q(x - c, y + c, x - s, y).Q(x - c, y - c, x, y - s).Z();
  }

  // ---------- the pen the items draw with ----------

  const G = {
    c: null,       // the context
    o: INK,        // outline colour
    lw: 1,         // outline width, in the item's 24-unit box
    pal: null,
    // fill, then the ink outline
    fo(p, fill, w) {
      const c = G.c;
      c.fillStyle = fill;
      c.fill(p);
      c.lineWidth = G.lw * (w || 1);
      c.strokeStyle = G.o;
      c.stroke(p);
    },
    f(p, fill) {
      G.c.fillStyle = fill;
      G.c.fill(p);
    },
    s(p, colour, w) {
      const c = G.c;
      c.lineWidth = G.lw * (w == null ? 1 : w);
      c.strokeStyle = colour || G.o;
      c.stroke(p);
    },
    // one outline round shapes that overlap (no seams inside)
    u(p, fill) {
      const c = G.c;
      c.lineWidth = G.lw * 2;
      c.strokeStyle = G.o;
      c.stroke(p);
      c.fillStyle = fill;
      c.fill(p);
    },
    // a line of colour w wide with an ink edge (sticks, stems, rays)
    tube(p, fill, w) {
      const c = G.c;
      c.lineWidth = w + G.lw * 2;
      c.strokeStyle = G.o;
      c.stroke(p);
      c.lineWidth = w;
      c.strokeStyle = fill;
      c.stroke(p);
    },
    alpha(a) {
      G.c.globalAlpha = G.a0 * a;
    },
    a0: 1,
  };

  // ---------- the items ----------

  let ART = null;
  let broken = false;

  function build() {
    const A = Object.create(null);

    // 桜: five notched petals and a deep pink heart, floating
    const sakura = mk((p) => {
      for (let i = 0; i < 5; i++) {
        p.at(0, 0.6, (i * TAU) / 5, 1);
        p.M(0, -1).C(-5, -3.2, -6.6, -8.4, -3.3, -11).L(0, -9.1).L(3.3, -11).C(6.6, -8.4, 5, -3.2, 0, -1).Z();
      }
    });
    const sakuraHeart = mk((p) => p.circle(0, 0.6, 2.6));
    const sakuraVeins = mk((p) => {
      for (let i = 0; i < 5; i++) {
        p.at(0, 0.6, (i * TAU) / 5, 1);
        p.M(0, -3.4).L(0, -5.6);
      }
    });
    A.sakura = {
      still(g) {
        g.fo(sakura, COL.pink);
        g.s(sakuraVeins, COL.pinkDeep, 0.8);
        g.f(sakuraHeart, COL.pinkDeep);
      },
      // it floats
      pose(c, t) {
        c.translate(0.6 * Math.sin(t * 1.3), 0.4 * Math.sin(t * 2.1));
      },
    };

    // 星: the gold star of the weak-spot chips, with a glint; it twinkles
    const star = mk((p) => p.poly(starPts(5, 12.4, 5.4, 0, 1.4)));
    const starGlint = mk((p) => p.M(-3.2, -1.6).L(-1.6, -4.2));
    A.star = {
      still(g) {
        g.fo(star, COL.gold);
        g.s(starGlint, COL.white, 1.1);
      },
      pose(c, t) {
        const k = 1 + 0.06 * Math.sin(t * 4);
        c.scale(k, k);
      },
    };

    // 三色だんご: pink, white and green on a stick
    const dangoStick = mk((p) => p.M(-11.2, 11.2).L(10.4, -10.4));
    const dangoBalls = [
      [mk((p) => p.circle(-3.9, 3.9, 4.4)), COL.green],
      [mk((p) => p.circle(0.9, -0.9, 4.4)), COL.rice],
      [mk((p) => p.circle(5.7, -5.7, 4.4)), COL.pinkMid],
    ];
    A.dango = {
      still(g) {
        g.tube(dangoStick, COL.wood, g.lw * 0.9);
        for (const [b, fill] of dangoBalls) g.fo(b, fill);
      },
    };

    // おにぎり: a rounded triangle of rice with a band of nori
    const onigiri = mk((p) => p.M(0, 10).A(12.2, 10, 0, -11.4, 4.4).A(0, -11.4, -12.2, 10, 3.8).A(-12.2, 10, 12.2, 10, 4.4).Z());
    const nori = mk((p) => p.M(-5, 10).L(-5, 3).Q(-5, 2, -4, 2).L(4, 2).Q(5, 2, 5, 3).L(5, 10).Z());
    A.onigiri = {
      still(g) {
        g.f(onigiri, COL.rice);
        g.f(nori, COL.nori);
        g.s(onigiri);
      },
    };

    // たい焼き: a golden fish of batter, facing left
    const taiyaki = mk((p) => p.M(-11.6, 0.4).C(-11.6, -5.2, -6.2, -8.6, -0.6, -8.2).C(3, -7.8, 5.4, -5.8, 6.6, -3.2).L(11.6, -7.6).C(10.3, -2.6, 10.3, 2.6, 11.6, 7.6).L(6.6, 3.2).C(5.4, 5.8, 3, 7.8, -0.6, 8.2).C(-6.2, 8.6, -11.6, 5.2, -11.6, 0.4).Z());
    const taiyakiLines = mk((p) => {
      p.M(-4, -5).Q(-2, 0, -4, 5);                         // gill
      p.M(0.4, -2.4).Q(1.8, -1.2, 0.4, 0);                  // scales
      p.M(3.2, -0.4).Q(4.6, 0.8, 3.2, 2);
      p.M(0.4, 2.2).Q(1.8, 3.4, 0.4, 4.6);
      p.M(7.6, -1.4).L(10, -4.4);                           // tail
      p.M(7.6, 1.4).L(10, 4.4);
      p.M(-11.4, 2.2).L(-9.6, 2.6);                         // mouth
    });
    const taiyakiEye = mk((p) => p.circle(-7.2, -2.4, 1.3));
    A.taiyaki = {
      still(g) {
        g.fo(taiyaki, '#ECB064');
        g.s(taiyakiLines, null, 0.75);
        g.f(taiyakiEye, g.o);
      },
    };

    // 緑茶: a yunomi of green tea, steaming
    const cupTop = -3.4;
    const cupX = (y) => 9.6 - ((y - cupTop) * 2.4) / 14.8;
    const cup = mk((p) => p.M(-9.6, cupTop).L(-cupX(9.2), 9.2).Q(-cupX(11.4), 11.4, -cupX(11.4) + 2.4, 11.4).L(cupX(11.4) - 2.4, 11.4).Q(cupX(11.4), 11.4, cupX(9.2), 9.2).L(9.6, cupTop).arc(0, cupTop, 9.6, 2.4, 0, Math.PI, true).Z());
    const cupBand = mk((p) => p.poly([-cupX(3.4), 3.4, cupX(3.4), 3.4, cupX(6), 6, -cupX(6), 6]));
    const teaTop = mk((p) => p.ellipse(0, cupTop, 9.6, 2.4));
    const teaIn = mk((p) => p.ellipse(0, cupTop + 0.45, 7.6, 1.55));
    const steam = mk((p) => {
      p.M(-3, -6.4).C(-5.2, -8.2, -0.8, -9.8, -3.1, -12);
      p.M(3, -6.4).C(0.8, -8.2, 5.2, -9.8, 2.9, -12);
    });
    A.tea = {
      still(g) {
        g.fo(cup, COL.celadon);
        g.f(cupBand, COL.celadonDeep);
        g.fo(teaTop, COL.cream);
        g.f(teaIn, COL.matcha);
        g.s(cup);
      },
      move(g, t) {
        drawSteam(g, steam, t, 0);
      },
    };

    // 扇子: a gold folding fan with a red sun, for records
    const FAN_C = 6.8;           // the pivot, below the middle
    const FAN_R = 13;
    const FAN_IN = 5.2;
    const FAN_N = 8;
    const FAN_A0 = -Math.PI + 0.42;
    const FAN_A1 = -0.42;
    const fanA = (i) => FAN_A0 + ((FAN_A1 - FAN_A0) * i) / FAN_N;
    const fanPt = (i, r) => [Math.cos(fanA(i)) * r, FAN_C + Math.sin(fanA(i)) * r];
    const fanLeaf = mk((p) => {
      for (let i = 0; i <= FAN_N; i++) {
        const [x, y] = fanPt(i, FAN_R);
        if (i) p.L(x, y);
        else p.M(x, y);
      }
      for (let i = FAN_N; i >= 0; i--) {
        const [x, y] = fanPt(i, FAN_IN);
        p.L(x, y);
      }
      p.Z();
    });
    const fanDark = mk((p) => {
      for (let i = 1; i < FAN_N; i += 2) {
        const a = fanPt(i, FAN_R);
        const b = fanPt(i + 1, FAN_R);
        const c = fanPt(i + 1, FAN_IN);
        const d = fanPt(i, FAN_IN);
        p.poly([a[0], a[1], b[0], b[1], c[0], c[1], d[0], d[1]]);
      }
    });
    const fanPleats = mk((p) => {
      for (let i = 1; i < FAN_N; i++) {
        const a = fanPt(i, FAN_R);
        const b = fanPt(i, FAN_IN);
        p.M(a[0], a[1]).L(b[0], b[1]);
      }
    });
    const fanRibs = mk((p) => {
      p.M(0, FAN_C);
      for (let i = 0; i <= FAN_N; i++) {
        const [x, y] = fanPt(i, FAN_IN + 0.5);
        p.L(x, y);
      }
      p.Z();
    });
    const fanSun = mk((p) => p.circle(0, FAN_C - 9.2, 2.5));
    const fanRivet = mk((p) => p.circle(0, FAN_C, 1.3));
    A.fan = {
      still(g) {
        g.fo(fanRibs, COL.woodDeep);
        g.f(fanLeaf, COL.gold);
        g.f(fanDark, '#E39E25');
        g.f(fanSun, COL.daruma);
        g.s(fanPleats, null, 0.55);
        g.s(fanLeaf);
        g.fo(fanRivet, COL.cream, 0.7);
      },
    };

    // 鯉のぼり: a blue carp and a red one on a pole, waving
    const carp = mk((p) => p.M(0, -3.4).C(5, -4.8, 11.5, -4.6, 15.5, -3).L(20, -4.8).L(17.6, 0).L(20, 4.8).L(15.5, 3).C(11.5, 4.6, 5, 4.8, 0, 3.4).Z());
    const carpMouth = mk((p) => p.ellipse(0, 0, 1.2, 3.4));
    const carpScales = mk((p) => {
      p.M(8, -2.6).Q(10, -1.3, 8, 0);
      p.M(11.4, -2.6).Q(13.4, -1.3, 11.4, 0);
      p.M(8, 0.4).Q(10, 1.7, 8, 3);
      p.M(11.4, 0.4).Q(13.4, 1.7, 11.4, 3);
    });
    const carpEye = mk((p) => p.circle(3.6, -0.8, 1.9));
    const carpPupil = mk((p) => p.circle(3.6, -0.8, 0.95));
    const kPole = mk((p) => p.M(-10.6, -10).L(-10.6, 11.8));
    const kBall = mk((p) => p.circle(-10.6, -10.6, 1.6));
    function fish(g, x, y, s, fill) {
      const c = g.c;
      c.save();
      c.translate(x, y);
      c.scale(s, s);
      g.fo(carp, fill);
      g.s(carpScales, null, 0.6);
      g.fo(carpMouth, COL.white, 0.8);
      g.fo(carpEye, COL.white, 0.8);
      g.f(carpPupil, g.o);
      c.restore();
    }
    A.koinobori = {
      still(g) {
        g.tube(kPole, COL.wood, g.lw * 0.8);
        fish(g, -9.4, -4.8, 1, COL.blueDeep);
        fish(g, -9.4, 5.2, 0.86, COL.red);
        g.fo(kBall, COL.gold, 0.8);
      },
      // the carp fill and stream from the pole with the wind
      pose(c, t) {
        c.translate(-10.6, 0);
        c.scale(1 + 0.035 * Math.sin(t * 3.2), 1);
        c.translate(10.6, 0);
      },
    };

    // 風鈴: a glass bell with goldfish on it and a paper strip, swaying
    const furinString = mk((p) => p.M(0, -12.2).L(0, -10.4));
    const furinBell = mk((p) => p.M(-8.6, -0.4).C(-9, -7.2, -5.2, -10.8, 0, -10.8).C(5.2, -10.8, 9, -7.2, 8.6, -0.4).Z());
    const furinMouth = mk((p) => p.ellipse(0, -0.4, 8.6, 2.2));
    const furinFish = mk((p) => {
      p.ellipse(-3, -5.4, 2, 1.25, -0.25);
      p.poly([-1.2, -5.9, 0.2, -7, 0.2, -4.6]);
      p.ellipse(4, -4, 1.6, 1, 0.25);
      p.poly([5.4, -3.6, 6.6, -2.4, 6.6, -4.6]);
    });
    const furinGlint = mk((p) => p.M(-6, -3.4).Q(-6, -7.4, -3.2, -9));
    const furinCord = mk((p) => p.M(0, -3.4).L(0, 3.6));
    const furinClapper = mk((p) => p.circle(0, 0.2, 1.3));
    const furinStrip = mk((p) => p.M(-2.8, 3.6).L(2.8, 3.6).L(2.8, 12).L(0, 10.8).L(-2.8, 12).Z());
    A.furin = {
      still(g) {
        g.s(furinString);
        g.s(furinCord, null, 0.75);
        g.fo(furinStrip, COL.goldPale);
        g.fo(furinBell, COL.sky);
        g.fo(furinMouth, '#9CCBE8', 0.8);
        g.f(furinFish, COL.red);
        g.s(furinGlint, COL.white, 1.1);
        g.fo(furinClapper, COL.goldPale, 0.6);
      },
      // it sways on its string
      pose(c, t) {
        c.translate(0.5 * Math.sin(t * 2.2), 0.15 * Math.sin(t * 4.4));
      },
    };

    // 折り鶴: an origami crane, wings up
    const craneBackWing = mk((p) => p.poly([0.6, 2.2, 6.6, 2.8, 7.4, -9.2]));
    const craneBody = mk((p) => p.poly([-7.6, 3.6, 0, 1.4, 7.6, 3.6, 0, 8]));
    const craneNeck = mk((p) => p.poly([-7.6, 3.6, -4.6, 2.4, -11.4, -4]));
    const craneHead = mk((p) => p.poly([-11.4, -4, -10, -4.2, -12.4, -0.6]));
    const craneTail = mk((p) => p.poly([4.6, 2.4, 7.6, 3.6, 12, -3.4]));
    const craneWing = mk((p) => p.poly([-5, 2.8, 4.4, 2, 0, -11.6]));
    const craneFold = mk((p) => p.M(0, 1.4).L(0, 8));
    A.crane = {
      still(g) {
        g.fo(craneBackWing, COL.pinkDeep);
        g.fo(craneTail, COL.pinkMid);
        g.fo(craneNeck, COL.pinkMid);
        g.fo(craneHead, COL.pinkMid);
        g.fo(craneBody, COL.pinkMid);
        g.s(craneFold, null, 0.5);
        g.fo(craneWing, COL.pink);
      },
      pose(c, t) {
        c.translate(0, Math.sin(t * 1.8) * 0.6);
      },
    };

    // けん玉: the wooden ken, a cup at each end of its cross, and the red ball on its string
    const KEN = 0.32;
    const kenWood = mk((p) => {
      p.at(-3.4, 1.4, KEN, 1);
      p.M(-0.9, -6.4).L(0, -10.2).L(0.9, -6.4).Z();                                     // the spike
      p.rr(-1.9, -6.8, 3.8, 3, 0.8);
      p.rr(-6.4, -4.4, 12.8, 2.8, 1);                                                   // the cross
      p.M(-6, -4.2).L(-9.4, -6.2).Q(-8.2, -3, -9.4, 0.2).L(-6, -1.8).Z();               // big cup
      p.M(6, -4.2).L(8.6, -5.4).Q(7.8, -3, 8.6, -0.6).L(6, -1.8).Z();                   // small cup
      p.M(-1.8, -2).L(1.8, -2).L(1.8, 7.4).L(2.8, 9.4).Q(0, 8.4, -2.8, 9.4).L(-1.8, 7.4).Z();  // the stick and its cup
    });
    const kenString = mk((p) => p.M(-3.2, 2).C(2, 9.4, 8.4, 6, 7.4, -1.6));
    const kenBall = mk((p) => p.circle(6.4, -6.2, 5.2));
    const kenHole = mk((p) => p.ellipse(7.2, -1.8, 1.1, 0.6, 0.2));
    const kenGlint = mk((p) => p.ellipse(4.2, -8.4, 1.5, 1, -0.6));
    A.kendama = {
      still(g) {
        g.s(kenString, null, 0.6);
        g.u(kenWood, COL.wood);
        g.fo(kenBall, COL.red);
        g.f(kenHole, g.o);
        g.f(kenGlint, COL.white);
      },
      // a little toss
      pose(c, t) {
        c.translate(0, -Math.pow(Math.abs(Math.sin(t * 2.2)), 3) * 1);
      },
    };

    // だるま落とし: a stack of blocks, one being knocked out, under a daruma head
    const otoshiHead = mk((p) => p.M(-6.4, -2.6).C(-7, -8.6, -4, -12, 0, -12).C(4, -12, 7, -8.6, 6.4, -2.6).Z());
    const otoshiFace = mk((p) => p.ellipse(0, -7, 4, 3));
    const otoshiEyes = mk((p) => {
      p.circle(-1.5, -7.4, 0.85);
      p.circle(1.5, -7.4, 0.85);
    });
    const blocks = [
      [mk((p) => p.rr(-7.4, -2.6, 14.8, 4.6, 1)), COL.blue],
      [mk((p) => p.rr(-3.2, 2, 14.8, 4.6, 1)), COL.goldSoft],
      [mk((p) => p.rr(-7.4, 6.6, 14.8, 4.6, 1)), COL.green],
    ];
    const otoshiWhoosh = mk((p) => {
      p.M(-11.8, 3.2).L(-7.8, 3.2);
      p.M(-11, 5.4).L(-7.4, 5.4);
    });
    A.otoshi = {
      still(g) {
        g.fo(blocks[2][0], blocks[2][1]);
        g.fo(blocks[0][0], blocks[0][1]);
        g.fo(otoshiHead, COL.daruma);
        g.f(otoshiFace, COL.cream);
        g.f(otoshiEyes, INK);
        g.s(otoshiWhoosh, null, 0.75);
      },
      // the middle block, on its way out
      move(g, t) {
        const c = g.c;
        c.save();
        if (t) c.translate(Math.abs(Math.sin(t * 2.4)) * 0.8, 0);
        g.fo(blocks[1][0], blocks[1][1]);
        c.restore();
      },
    };

    // みかん: an orange with a leaf
    const mikan = mk((p) => p.ellipse(0, 1.6, 10.8, 9.8));
    const mikanGlint = mk((p) => p.ellipse(-4.6, -2.2, 2.4, 1.4, -0.6));
    const mikanStem = mk((p) => p.circle(0, -7.6, 1.6));
    const mikanLeaf = mk((p) => p.M(0.6, -8.4).C(2, -12.4, 7, -13, 9.8, -10.8).C(7.6, -7.8, 3.6, -7, 0.6, -8.4).Z());
    const mikanVein = mk((p) => p.M(1.8, -8.8).Q(5, -10, 8, -10.6));
    A.mikan = {
      still(g) {
        g.fo(mikan, COL.orange);
        g.f(mikanGlint, '#FFD49A');
        g.fo(mikanLeaf, COL.leaf, 0.85);
        g.s(mikanVein, null, 0.55);
        g.f(mikanStem, COL.greenDeep);
      },
    };

    // 紅葉: a maple leaf, five toothed lobes on a stem
    const MC = [0, 1.4];
    const MOMIJI = [[-2.05, 6.6], [-1.08, 10], [0, 11.6], [1.08, 10], [2.05, 6.6]];
    const momiji = mk((p) => {
      const pt = (a, r) => [MC[0] + Math.sin(a) * r, MC[1] - Math.cos(a) * r];
      const pts = [];
      MOMIJI.forEach(([a, L], i) => {
        pts.push(pt(a - 0.34, L * 0.46), pt(a - 0.3, L * 0.74), pt(a - 0.1, L * 0.68), pt(a, L), pt(a + 0.1, L * 0.68), pt(a + 0.3, L * 0.74), pt(a + 0.34, L * 0.46));
        if (i < MOMIJI.length - 1) pts.push(pt((a + MOMIJI[i + 1][0]) / 2, 3.6));
      });
      pts.push(pt(Math.PI - 0.5, 2.6), pt(Math.PI + 0.5, 2.6));
      p.M(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) p.L(pts[i][0], pts[i][1]);
      p.Z();
    });
    const momijiVeins = mk((p) => {
      for (const [a, L] of MOMIJI) p.M(MC[0], MC[1]).L(MC[0] + Math.sin(a) * L * 0.7, MC[1] - Math.cos(a) * L * 0.7);
    });
    const momijiStem = mk((p) => p.M(0, 3.4).Q(0.2, 8, 2, 11.6));
    A.momiji = {
      still(g) {
        g.tube(momijiStem, '#E0603C', g.lw * 0.8);
        g.fo(momiji, '#F27B50');
        g.s(momijiVeins, '#C9502C', 0.6);
      },
      // it drifts
      pose(c, t) {
        c.translate(0.7 * Math.sin(t * 1.4), 0.3 * Math.sin(t * 2.8));
      },
    };

    // 雪の結晶: six branched arms
    const snow = mk((p) => {
      for (let i = 0; i < 6; i++) {
        p.at(0, 0, (i * TAU) / 6, 1);
        p.M(0, -2.4).L(0, -10.4);
        p.M(0, -5.4).L(-2.8, -8).M(0, -5.4).L(2.8, -8);
      }
    });
    const snowHeart = mk((p) => {
      const pts = [];
      for (let i = 0; i < 6; i++) pts.push(Math.sin((i * TAU) / 6) * 3, -Math.cos((i * TAU) / 6) * 3);
      p.poly(pts);
    });
    A.snowflake = {
      still(g) {
        g.tube(snow, '#D6EEFC', g.lw * 1.2);
        g.fo(snowHeart, '#D6EEFC');
      },
      // it glints as it falls
      pose(c, t) {
        const k = 1 + 0.05 * Math.sin(t * 2.4);
        c.translate(0, 0.5 * Math.sin(t * 1.2));
        c.scale(k, k);
      },
    };

    // 花火: a burst of coloured streaks with sparks at their ends
    const FW = [COL.pinkDeep, COL.gold, COL.blueDeep, COL.gold];
    const fwRays = FW.map((_, k) => mk((p) => {
      for (let i = k; i < 8; i += 4) {
        p.at(0, 0, (i * TAU) / 8, 1);
        p.M(0, -4.2).L(0, -8.2);
      }
    }));
    const fwTips = FW.map((_, k) => mk((p) => {
      for (let i = k; i < 8; i += 4) {
        p.at(0, 0, (i * TAU) / 8, 1);
        p.circle(0, -10.4, 1.5);
      }
    }));
    // sparks between the streaks
    const fwSparks = mk((p) => {
      for (let i = 0; i < 8; i++) {
        const a = (i * TAU) / 8 + TAU / 16;
        p.circle(Math.sin(a) * 7.4, -Math.cos(a) * 7.4, 0.9);
      }
    });
    const fwCore = mk((p) => p.circle(0, 0, 1.9));
    A.fireworks = {
      still(g) {
        for (let i = 0; i < 4; i++) g.tube(fwRays[i], FW[i], g.lw * 1.05);
        for (let i = 0; i < 4; i++) g.fo(fwTips[i], FW[i], 0.75);
        g.fo(fwCore, COL.goldPale, 0.75);
        g.f(fwSparks, COL.gold);
      },
      // it bursts again and again
      pose(c, t) {
        const k = 1 + 0.06 * Math.sin(t * 5);
        c.scale(k, k);
      },
    };

    // 凧: a diamond kite with a ribboned tail
    const KT = [1.6, -12];
    const KR = [9.8, -3.6];
    const KB = [0.8, 6.2];
    const KL = [-7.4, -4.6];
    const KC = [1.2, -4.2];
    const kite = mk((p) => p.poly([KT[0], KT[1], KR[0], KR[1], KB[0], KB[1], KL[0], KL[1]]));
    const kiteA = mk((p) => {
      p.poly([KT[0], KT[1], KR[0], KR[1], KC[0], KC[1]]);
      p.poly([KB[0], KB[1], KL[0], KL[1], KC[0], KC[1]]);
    });
    const kiteSticks = mk((p) => p.M(KT[0], KT[1]).L(KB[0], KB[1]).M(KL[0], KL[1]).L(KR[0], KR[1]));
    const kiteTail = mk((p) => p.M(KB[0], KB[1]).C(-1, 9.4, -4.4, 7.6, -6.6, 10.4));
    const kiteBows = mk((p) => {
      for (const [bx, by] of [[-1.6, 9.2], [-5.6, 9.6]]) p.poly([bx - 2.2, by - 1.4, bx + 2.2, by + 1.4, bx + 2.2, by - 1.4, bx - 2.2, by + 1.4]);
    });
    A.kite = {
      still(g) {
        g.s(kiteTail, null, 0.8);
        g.fo(kite, COL.white);
        g.f(kiteA, COL.red);
        g.s(kiteSticks, null, 0.55);
        g.s(kite);
        g.fo(kiteBows, COL.goldSoft, 0.7);
      },
      // riding the wind
      pose(c, t) {
        c.translate(0.7 * Math.sin(t * 1.3), 0.5 * Math.sin(t * 2.6));
      },
    };

    // お弁当: rice with an umeboshi, tamagoyaki, broccoli and a sausage
    const bentoBox = mk((p) => p.rr(-11.8, -8.6, 23.6, 17.6, 3));
    const bentoTray = mk((p) => p.rr(-9.8, -6.6, 19.6, 13.6, 1.4));
    const bentoWall = mk((p) => p.M(1.4, -6.6).L(1.4, 7));
    const ume = mk((p) => p.circle(-4.2, 0.2, 2.2));
    const egg = mk((p) => p.rr(2.8, -5.4, 5.8, 4.4, 0.8));
    const eggLine = mk((p) => p.M(5.7, -5.4).L(5.7, -1));
    const broc = mk((p) => {
      p.circle(4, 3.2, 1.9);
      p.circle(5.4, 1.7, 1.7);
      p.circle(5.6, 3.9, 1.6);
    });
    const sausage = mk((p) => p.ellipse(8, 3.4, 1.4, 2.4));
    A.bento = {
      still(g) {
        g.fo(bentoBox, '#E7785C');
        g.fo(bentoTray, COL.rice, 0.8);
        g.s(bentoWall, null, 0.8);
        g.fo(egg, COL.egg, 0.7);
        g.s(eggLine, null, 0.45);
        g.u(broc, COL.greenDeep);
        g.fo(sausage, COL.coral, 0.7);
        g.f(ume, COL.daruma);
      },
    };

    // ラーメン: a bowl with noodles, naruto, nori and chopsticks, steaming
    const bowl = mk((p) => p.M(-11.6, -0.4).L(11.6, -0.4).C(11.2, 5.8, 6.6, 9.2, 0, 9.2).C(-6.6, 9.2, -11.2, 5.8, -11.6, -0.4).Z());
    const bowlFoot = mk((p) => p.rr(-4.2, 8.4, 8.4, 2.8, 0.9));
    const bowlBand = mk((p) => p.M(-10.4, 3).Q(0, 5.4, 10.4, 3));
    const soup = mk((p) => p.ellipse(0, -0.4, 11.6, 2.6));
    const noodles = mk((p) => {
      p.M(-8, 0.2).Q(-6.6, -1.8, -5.2, 0.2).Q(-3.8, 2, -2.4, 0.2);
      p.M(1.2, 0.8).Q(2.6, -1.4, 4, 0.6).Q(5.4, 2.2, 6.8, 0.2);
    });
    const ramenNori = mk((p) => p.poly([-9.2, -0.4, -8.6, -7.6, -4.4, -7, -4.6, 0]));
    const naruto = mk((p) => p.circle(1.2, -2.4, 2.8));
    const narutoSwirl = mk((p) => p.M(1.2, -2.4).arc(1.2, -2.4, 1.4, 1.4, 0, Math.PI * 1.6));
    const chopsticks = mk((p) => p.M(4.4, -2.6).L(11.4, -11.2).M(6.6, -1.8).L(12, -9.6));
    const ramenSteam = mk((p) => {
      p.M(-1.6, -6).C(-3.6, -8, 0, -9.4, -1.8, -11.6);
    });
    A.ramen = {
      still(g) {
        g.fo(ramenNori, COL.nori, 0.8);
        g.fo(soup, '#FFE08A');
        g.s(noodles, '#D9A03A', 0.7);
        g.fo(naruto, COL.white, 0.7);
        g.s(narutoSwirl, COL.pinkDeep, 0.7);
        g.tube(chopsticks, COL.wood, g.lw * 0.7);
        g.fo(bowlFoot, COL.red);
        g.fo(bowl, COL.red);
        g.s(bowlBand, COL.cream, 1.3);
      },
      move(g, t) {
        drawSteam(g, ramenSteam, t, 1);
      },
    };

    // 富士山: Mt Fuji with its snow, a little sun and a cloud
    const F0 = [-3.2, -6.8];
    const FCtl = [-5.4, 4];
    const F1 = [-12, 10.4];
    const slopeX = (y) => {
      let lo = 0;
      let hi = 1;
      for (let i = 0; i < 24; i++) {
        const s = (lo + hi) / 2;
        const yy = (1 - s) * (1 - s) * F0[1] + 2 * (1 - s) * s * FCtl[1] + s * s * F1[1];
        if (yy < y) lo = s;
        else hi = s;
      }
      const s = (lo + hi) / 2;
      return (1 - s) * (1 - s) * F0[0] + 2 * (1 - s) * s * FCtl[0] + s * s * F1[0];
    };
    const fuji = mk((p) => p.M(F1[0], F1[1]).Q(FCtl[0], FCtl[1], F0[0], F0[1]).Q(-1.6, -7.6, 0, -6.8).Q(1.6, -7.6, -F0[0], F0[1]).Q(-FCtl[0], FCtl[1], -F1[0], F1[1]).Z());
    const fujiSnow = mk((p) => {
      const yl = -1.6;
      const yr = -2.4;
      p.M(slopeX(yl), yl).L(F0[0], F0[1]).Q(-1.6, -7.6, 0, -6.8).Q(1.6, -7.6, -F0[0], F0[1]).L(-slopeX(yr), yr);
      p.L(2.2, -3.4).L(1, -1.6).L(-0.4, -3.6).L(-1.8, -1.8).Z();
    });
    const fujiSun = mk((p) => p.circle(7.6, -7.4, 3.4));
    const fujiCloud = mk((p) => {
      p.circle(-8.6, 8.2, 2.4);
      p.circle(-5.4, 7.2, 3);
      p.circle(-2.2, 8.4, 2.2);
      p.rr(-10.8, 8.2, 10.6, 2.6, 1.3);
    });
    A.fuji = {
      still(g) {
        g.fo(fujiSun, COL.coral);
        g.fo(fuji, '#86A9E8');
        g.fo(fujiSnow, COL.white, 0.8);
        g.s(fuji);
        g.u(fujiCloud, COL.white);
      },
    };

    // 和傘: a red paper umbrella with its white ring and ribs
    const RIM = [-12, -8, -4, 0, 4, 8, 12];
    const canopyPath = (p, s) => {
      p.at(0, -11, 0, s);
      p.M(-12, 11.6).Q(-7.4, 2.4, 0, 0).Q(7.4, 2.4, 12, 11.6);
      for (let i = RIM.length - 1; i > 0; i--) p.Q((RIM[i] + RIM[i - 1]) / 2, 10.2, RIM[i - 1], 11.6);
      p.Z();
    };
    const canopy = mk((p) => canopyPath(p, 1));
    const ringOut = mk((p) => canopyPath(p, 0.66));
    const ringIn = mk((p) => canopyPath(p, 0.46));
    const ribs = mk((p) => {
      for (const x of RIM.slice(1, -1)) p.M(0, -11).L(x * 0.97, 0.3);
    });
    const underRibs = mk((p) => {
      for (const x of [-8, -4, 4, 8]) p.M(x, 0.8).L(0, 3.6);
    });
    const handle = mk((p) => p.M(0, 0.6).L(0, 11.4));
    const knob = mk((p) => p.circle(0, -11.2, 1.3));
    A.umbrella = {
      still(g) {
        g.s(underRibs, null, 0.6);
        g.tube(handle, COL.woodDeep, g.lw * 1.1);
        g.f(canopy, COL.red);
        g.f(ringOut, COL.cream);
        g.f(ringIn, COL.red);
        g.s(ribs, null, 0.45);
        g.s(canopy);
        g.fo(knob, COL.lacquer, 0.6);
      },
    };

    // 提灯: a plain red paper lantern with black caps, swaying a little
    const lantern = mk((p) => p.ellipse(0, 0.4, 8.4, 9.2));
    const lanternGlow = mk((p) => p.ellipse(-2.2, 0.4, 3, 6.4));
    const lanternRibs = mk((p) => {
      for (const y of [-5.2, -1.6, 2.2, 5.8]) {
        const w = 8.4 * Math.sqrt(Math.max(0, 1 - ((y - 0.4) / 9.2) * ((y - 0.4) / 9.2)));
        p.M(-w, y).Q(0, y + 1.4, w, y);
      }
    });
    const lanternCaps = mk((p) => {
      p.rr(-4.6, -11, 9.2, 3, 0.8);
      p.rr(-4.6, 8.8, 9.2, 3, 0.8);
    });
    const lanternLoop = mk((p) => p.M(0, -12.4).L(0, -11));
    A.lantern = {
      still(g) {
        g.s(lanternLoop);
        g.fo(lantern, '#F07A5E');
        g.f(lanternGlow, '#FFB29C');
        g.s(lanternRibs, null, 0.55);
        g.s(lantern);
        g.fo(lanternCaps, COL.lacquer, 0.8);
      },
      // it sways on its loop
      pose(c, t) {
        c.translate(0.5 * Math.sin(t * 1.7), 0);
      },
    };

    // ゴールの旗: a checked flag, waving
    const flagPole = mk((p) => p.M(-9, -10).L(-9, 11.8));
    const flagKnob = mk((p) => p.circle(-9, -10.8, 1.6));
    const FX0 = -9;
    const FX1 = 11.4;
    const FTOP = -10;
    const FBOT = 1.6;
    const fwave = (x) => {
      const u = (x - FX0) / (FX1 - FX0);
      return 1.6 * Math.sin(u * 4.2) * (0.2 + u);
    };
    const FXS = [];
    for (let i = 0; i <= 8; i++) FXS.push(FX0 + ((FX1 - FX0) * i) / 8);
    const flagCloth = mk((p) => {
      p.M(FX0, FTOP + fwave(FX0));
      for (let i = 1; i <= 8; i++) p.L(FXS[i], FTOP + fwave(FXS[i]));
      for (let i = 8; i >= 0; i--) p.L(FXS[i], FBOT + fwave(FXS[i]));
      p.Z();
    });
    // four columns of three squares, each column bent with the cloth
    const flagChecks = mk((p) => {
      const yAt = (x, f) => FTOP + fwave(x) + (FBOT - FTOP) * f;
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 3; j++) {
          if ((i + j) % 2) continue;
          const a = FXS[i * 2];
          const m = FXS[i * 2 + 1];
          const b = FXS[i * 2 + 2];
          p.M(a, yAt(a, j / 3)).L(m, yAt(m, j / 3)).L(b, yAt(b, j / 3));
          p.L(b, yAt(b, (j + 1) / 3)).L(m, yAt(m, (j + 1) / 3)).L(a, yAt(a, (j + 1) / 3)).Z();
        }
      }
    });
    A.flag = {
      still(g) {
        g.f(flagCloth, COL.white);
        g.f(flagChecks, '#2A3352');
        g.s(flagCloth);
        g.tube(flagPole, COL.wood, g.lw * 0.9);
        g.fo(flagKnob, COL.gold, 0.8);
      },
      // it flaps from the pole
      pose(c, t) {
        c.translate(-9, 0);
        c.scale(1 + 0.04 * Math.sin(t * 3.6), 1 + 0.02 * Math.sin(t * 3.6 + 1.2));
        c.translate(9, 0);
      },
    };

    // キラキラ: a big twinkle and a small one, taking turns to shine
    const sparkBig = mk((p) => twinkle(p, 0, 0, 9.6));
    const sparkSmall = mk((p) => twinkle(p, 0, 0, 4.6));
    const sparkDot = mk((p) => p.circle(0, 0, 1.5));
    A.sparkles = {
      still(g) {
        const c = g.c;
        c.save();
        c.translate(-2.2, 1.6);
        g.fo(sparkBig, COL.gold);
        c.restore();
        c.save();
        c.translate(7.4, 7.6);
        g.fo(sparkDot, COL.goldSoft, 0.8);
        c.restore();
      },
      // the small twinkle comes and goes
      move(g, t) {
        const c = g.c;
        const b = t ? 1 + 0.3 * Math.sin(t * 4 + 2.4) : 1;
        c.save();
        c.translate(7.2, -7);
        c.scale(b, b);
        g.fo(sparkSmall, COL.goldPale, 0.85);
        c.restore();
      },
    };

    // 汗: Yaoki's drop of sweat
    const drop = mk((p) => p.M(0, -11.6).C(4.4, -5.6, 8, -1.2, 8, 3.2).C(8, 7.8, 4.4, 11.6, 0, 11.6).C(-4.4, 11.6, -8, 7.8, -8, 3.2).C(-8, -1.2, -4.4, -5.6, 0, -11.6).Z());
    const dropGlint = mk((p) => p.ellipse(-3.6, 3.6, 1.4, 2.8, 0.3));
    A.sweat = {
      still(g) {
        g.fo(drop, COL.drop);
        g.f(dropGlint, COL.white);
      },
      pose(c, t) {
        c.translate(0, 0.6 * Math.sin(t * 3));
      },
    };

    // ハート: a pink heart that beats
    const heart = mk((p) => p.M(0, 10.6).C(-5.4, 6.6, -11.8, 1.8, -11.8, -3.8).C(-11.8, -8.4, -8.2, -10.6, -5.6, -10.6).C(-3, -10.6, -1, -9, 0, -6.4).C(1, -9, 3, -10.6, 5.6, -10.6).C(8.2, -10.6, 11.8, -8.4, 11.8, -3.8).C(11.8, 1.8, 5.4, 6.6, 0, 10.6).Z());
    const heartGlint = mk((p) => p.ellipse(-6, -4.6, 2, 1.3, -0.7));
    A.heart = {
      still(g) {
        g.fo(heart, '#F98BA6');
        g.f(heartGlint, COL.white);
      },
      pose(c, t) {
        const b = 1 + 0.07 * Math.pow(Math.max(0, Math.sin(t * 4.4)), 6);
        c.scale(b, b);
      },
    };

    // 音符: two beamed quavers, bobbing
    const notes = mk((p) => {
      p.ellipse(-6.4, 7, 4, 2.9, -0.4);
      p.ellipse(6.2, 5, 4, 2.9, -0.4);
      p.rr(-3.6, -8.4, 2.2, 15.4, 0.4);
      p.rr(9, -10.4, 2.2, 15.4, 0.4);
      p.M(-3.6, -8.4).L(11.2, -10.6).L(11.2, -6.6).L(-3.6, -4.4).Z();
    });
    A.note = {
      still(g) {
        g.u(notes, COL.blue);
      },
      pose(c, t) {
        c.translate(0, -Math.abs(Math.sin(t * 3)) * 1.2);
      },
    };

    // はなまる: the teacher's flower circle, in the stamp's red
    const hanamaru = mk((p) => {
      const R = 8.4;
      const n = 9;
      const step = TAU / n;
      const a = R * Math.sin(step / 2);
      for (let i = 0; i < n; i++) {
        const t0 = i * step - Math.PI / 2;
        const t1 = t0 + step;
        const mx = (R * (Math.cos(t0) + Math.cos(t1))) / 2;
        const my = (R * (Math.sin(t0) + Math.sin(t1))) / 2;
        const s0 = Math.atan2(R * Math.sin(t0) - my, R * Math.cos(t0) - mx);
        if (!i) p.M(R * Math.cos(t0), R * Math.sin(t0));
        p.arc(mx, my, a, a, s0, s0 + Math.PI, false);
      }
      // the spiral inside
      p.M(0.4, -0.2);
      for (let i = 1; i <= 28; i++) {
        const u = i / 28;
        const ang = -Math.PI / 2 + u * TAU * 1.6;
        const r = 0.5 + u * 4.6;
        p.L(Math.cos(ang) * r, Math.sin(ang) * r);
      }
    });
    A.hanamaru = {
      still(g) {
        g.s(hanamaru, (g.pal && g.pal.stamp) || '#C7361E', 1.35);
      },
    };

    // 鉛筆: a yellow pencil, ready to write
    const PR = -0.72;
    const pencilBody = mk((p) => p.at(0, 0, PR, 1).poly([-7.6, -3.3, 8, -3.3, 8, 3.3, -7.6, 3.3]));
    const pencilFacet = mk((p) => p.at(0, 0, PR, 1).M(-7.6, 0).L(8, 0));
    const pencilWood = mk((p) => p.at(0, 0, PR, 1).poly([-7.6, -3.3, -14, 0, -7.6, 3.3]));
    const pencilLead = mk((p) => p.at(0, 0, PR, 1).poly([-11.6, -1.25, -14, 0, -11.6, 1.25]));
    const pencilBand = mk((p) => p.at(0, 0, PR, 1).poly([8, -3.3, 10.6, -3.3, 10.6, 3.3, 8, 3.3]));
    const pencilRubber = mk((p) => p.at(0, 0, PR, 1).M(10.6, -3.3).L(12.4, -3.3).Q(14.4, -3.3, 14.4, 0).Q(14.4, 3.3, 12.4, 3.3).L(10.6, 3.3).Z());
    A.pencil = {
      still(g) {
        g.fo(pencilRubber, COL.pinkMid);
        g.fo(pencilBand, COL.silver);
        g.fo(pencilWood, '#F6DBB1');
        g.f(pencilLead, '#3A4256');
        g.fo(pencilBody, COL.egg);
        g.s(pencilFacet, '#E7B93C', 0.7);
      },
      // writing
      pose(c, t) {
        c.translate(0.5 * Math.sin(t * 5), 0.3 * Math.sin(t * 10));
      },
    };

    // 独楽: a spinning top in bands of colour
    const komaSide = mk((p) => p.M(-11.2, -1.8).C(-10.2, 3.4, -4.6, 7.8, 0, 9.6).C(4.6, 7.8, 10.2, 3.4, 11.2, -1.8).Z());
    const komaTop = mk((p) => p.ellipse(0, -1.8, 11.2, 3.8));
    const komaRing1 = mk((p) => p.ellipse(0, -1.8, 7.8, 2.6));
    const komaRing2 = mk((p) => p.ellipse(0, -1.8, 4.6, 1.6));
    const komaSideBand = mk((p) => p.M(-8.4, 3.2).Q(0, 7.6, 8.4, 3.2).L(6.6, 5.6).Q(0, 9.2, -6.6, 5.6).Z());
    const komaAxle = mk((p) => p.rr(-1.4, -11.6, 2.8, 9.4, 1.2));
    const komaTip = mk((p) => p.M(0, 9.6).L(0, 11.8));
    const komaSwish = mk((p) => {
      p.M(-12, 3).Q(-12.4, 6, -10, 8.6);
      p.M(12, 3).Q(12.4, 6, 10, 8.6);
    });
    A.koma = {
      still(g) {
        g.s(komaTip, null, 1.4);
        g.fo(komaSide, COL.wood);
        g.f(komaSideBand, COL.red);
        g.s(komaSide);
        g.fo(komaTop, COL.red);
        g.f(komaRing1, COL.goldSoft);
        g.f(komaRing2, COL.green);
        g.s(komaRing1, null, 0.5);
        g.fo(komaAxle, COL.woodDeep, 0.85);
      },
      // it hums as it spins
      pose(c, t) {
        c.translate(0.3 * Math.sin(t * 23), 0);
      },
      move(g, t) {
        if (!t) return;
        g.alpha(0.5 + 0.5 * Math.sin(t * 9));
        g.s(komaSwish, null, 0.7);
        g.alpha(1);
      },
    };

    // かえる: a green frog's face, for a hop
    const frog = mk((p) => {
      p.ellipse(0, 3.4, 11.2, 7.8);
      p.circle(-5.8, -4.8, 4.6);
      p.circle(5.8, -4.8, 4.6);
    });
    const frogEyes = mk((p) => {
      p.circle(-5.8, -5, 2.7);
      p.circle(5.8, -5, 2.7);
    });
    const frogPupils = mk((p) => {
      p.circle(-5.2, -4.8, 1.4);
      p.circle(6.4, -4.8, 1.4);
    });
    const frogSmile = mk((p) => p.M(-4.4, 3.4).Q(0, 7.2, 4.4, 3.4));
    const frogCheeks = mk((p) => {
      p.ellipse(-7.4, 4.2, 1.9, 1.2);
      p.ellipse(7.4, 4.2, 1.9, 1.2);
    });
    A.frog = {
      still(g) {
        g.u(frog, COL.green);
        g.fo(frogEyes, COL.white, 0.75);
        g.f(frogPupils, INK);
        g.f(frogCheeks, COL.pinkMid);
        g.s(frogSmile, null, 0.8);
      },
      pose(c, t) {
        c.translate(0, -Math.pow(Math.abs(Math.sin(t * 2.4)), 4) * 1.4);
      },
    };

    // かめ: a turtle, slow and steady
    const turtleLegs = mk((p) => {
      p.ellipse(-5.6, 4.8, 2.4, 2.8);
      p.ellipse(4, 4.8, 2.4, 2.8);
      p.M(-10.6, 1.6).L(-12, 3.4).L(-9.4, 3.2).Z();
    });
    const turtleHead = mk((p) => p.ellipse(8.6, -0.6, 3.6, 3));
    const turtleEye = mk((p) => p.circle(9.6, -1.4, 0.85));
    const shell = mk((p) => p.M(-10.6, 3).C(-10.6, -5, -5, -8.8, -0.8, -8.8).C(4, -8.8, 8.2, -5, 8.2, 3).Z());
    const shellRim = mk((p) => p.rr(-11.6, 1.8, 20.8, 2.8, 1.4));
    const shellLines = mk((p) => {
      p.poly([-4, -5.4, 2.2, -5.4, 4, -1.4, 2.2, 1.8, -4, 1.8, -5.8, -1.4]);
      p.M(-4, -5.4).L(-5.6, -8);
      p.M(2.2, -5.4).L(3.8, -8);
      p.M(4, -1.4).L(7.8, -1.4);
      p.M(-5.8, -1.4).L(-10, -1.4);
    });
    A.turtle = {
      still(g) {
        g.u(turtleLegs, COL.matcha);
        g.fo(turtleHead, COL.matcha);
        g.f(turtleEye, INK);
        g.fo(shell, '#7DBB8A');
        g.s(shellLines, '#4E8F63', 0.6);
        g.fo(shellRim, '#C9E6A0');
      },
      // slow and steady
      pose(c, t) {
        c.translate(0.5 * Math.sin(t * 0.9), 0);
      },
    };

    // 太鼓: a festival drum with its sticks
    const drum = mk((p) => p.M(-9.2, -2).C(-10.8, 2.4, -10.8, 6.4, -9.2, 10.4).Q(0, 12.4, 9.2, 10.4).C(10.8, 6.4, 10.8, 2.4, 9.2, -2).Z());
    const drumHead = mk((p) => p.ellipse(0, -2, 9.2, 3.2));
    const drumStuds = mk((p) => {
      for (let i = 0; i < 7; i++) {
        const a = (Math.PI * (i + 0.5)) / 7;
        p.circle(Math.cos(a) * 8.6, 0.4 + Math.sin(a) * 1.8, 0.55);
      }
      for (let i = 0; i < 7; i++) {
        const a = (Math.PI * (i + 0.5)) / 7;
        p.circle(Math.cos(a) * 8.8, 8.6 + Math.sin(a) * 1.6, 0.55);
      }
    });
    const drumBand = mk((p) => p.M(-10.2, 4.4).Q(0, 6.8, 10.2, 4.4));
    const bachiL = mk((p) => p.M(-11, -11.2).L(-3, -4.2));
    const bachiR = mk((p) => p.M(11, -11.2).L(3, -4.2));
    A.taiko = {
      still(g) {
        g.fo(drum, '#D9694F');
        g.s(drumBand, COL.gold, 1.2);
        g.f(drumStuds, COL.lacquer);
        g.fo(drumHead, '#FBEBCB');
        g.tube(bachiL, COL.wood, g.lw * 1.2);
        g.tube(bachiR, COL.wood, g.lw * 1.2);
      },
      // どん: it squashes on each beat
      pose(c, t) {
        const b = Math.pow(Math.max(0, Math.sin(t * 6)), 8);
        c.translate(0, 11.4);
        c.scale(1 + 0.04 * b, 1 - 0.05 * b);
        c.translate(0, -11.4);
      },
    };

    // かき氷: shaved ice with strawberry syrup in a glass
    const ice = mk((p) => p.M(-10.4, 0.6).C(-10.2, -6.2, -5.2, -11.4, 0, -11.4).C(5.2, -11.4, 10.2, -6.2, 10.4, 0.6).Z());
    const syrup = mk((p) => p.M(-8.8, -5).C(-7, -9.4, -3.6, -11.4, 0, -11.4).C(3.6, -11.4, 7, -9.4, 8.8, -5).Q(7.6, -3, 6.4, -4.6).Q(4.6, -1.2, 3, -4).Q(1.4, -2.4, 0, -4.6).Q(-1.8, -1.2, -3.4, -4.2).Q(-5, -2, -6.4, -4.4).Q(-7.6, -2.6, -8.8, -5).Z());
    const glass = mk((p) => p.M(-11, 0).L(11, 0).C(10.4, 4.8, 6, 7.2, 0, 7.2).C(-6, 7.2, -10.4, 4.8, -11, 0).Z());
    const glassFoot = mk((p) => {
      p.rr(-1.4, 6.6, 2.8, 3.2, 0.6);
      p.ellipse(0, 10.4, 5.6, 1.5);
    });
    const glassGlint = mk((p) => p.M(-8, 2).Q(-6.4, 4.6, -3.6, 5.4));
    A.kakigori = {
      still(g) {
        g.u(glassFoot, COL.sky);
        g.fo(ice, COL.white);
        g.fo(syrup, '#F7899F', 0.7);
        g.fo(glass, COL.sky);
        g.s(glassGlint, COL.white, 1);
      },
    };

    // メダル: a gold medal on a ribbon
    const ribbonL = mk((p) => p.poly([-8.6, -12, -3.8, -12, 1.4, -2, -3, -0.4]));
    const ribbonR = mk((p) => p.poly([8.6, -12, 3.8, -12, -1.4, -2, 3, -0.4]));
    const medal = mk((p) => p.circle(0, 4.4, 7.4));
    const medalRing = mk((p) => p.circle(0, 4.4, 5));
    const medalStar = mk((p) => p.poly(starPts(5, 3.2, 1.4, 0, 4.6)));
    A.medal = {
      still(g) {
        g.fo(ribbonR, COL.blue);
        g.fo(ribbonL, COL.red);
        g.fo(medal, COL.gold);
        g.s(medalRing, '#D99A22', 0.8);
      },
      // the star on it shines
      move(g, t) {
        const c = g.c;
        const k = t ? 1 + 0.12 * Math.sin(t * 4) : 1;
        c.save();
        c.translate(0, 4.6);
        c.scale(k, k);
        c.translate(0, -4.6);
        g.f(medalStar, COL.goldPale);
        c.restore();
      },
    };

    // お寿司: a salmon nigiri
    const rice = mk((p) => p.M(-10.4, 0).C(-10.6, 6.4, -9, 8.2, -6, 8.2).L(6, 8.2).C(9, 8.2, 10.6, 6.4, 10.4, 0).Z());
    const neta = mk((p) => p.M(-12, 1.6).C(-12.2, -3.2, -8, -6.4, -1, -6.4).C(6, -6.4, 12.2, -4.2, 12, 0.6).C(11.4, 2.8, 7, 1.6, 0, 1.8).C(-6.4, 2, -10.6, 3.4, -12, 1.6).Z());
    const fat = mk((p) => {
      p.M(-7.2, -4.6).Q(-5.6, -1.6, -6.4, 1.2);
      p.M(-2.6, -5.6).Q(-0.8, -2.4, -1.6, 1);
      p.M(2.4, -5.6).Q(4, -2.4, 3.4, 1);
      p.M(7, -4.4).Q(8.4, -1.8, 8, 0.6);
    });
    const grains = mk((p) => {
      p.ellipse(-6, 5.6, 1.1, 0.6, 0.3);
      p.ellipse(-1.6, 6.4, 1.1, 0.6, -0.2);
      p.ellipse(3.4, 5.4, 1.1, 0.6, 0.2);
      p.ellipse(7.2, 6.2, 1.1, 0.6, -0.3);
    });
    A.sushi = {
      still(g) {
        g.c.translate(0, 1.4);
        g.fo(rice, COL.rice);
        g.f(grains, '#E6E2D6');
        g.fo(neta, COL.salmon);
        g.s(fat, COL.salmonFat, 1);
        g.c.translate(0, -1.4);
      },
    };

    return A;
  }

  // Steam: lines that sway and breathe; with t = 0 they stand still and full.
  function drawSteam(g, path, t, ph) {
    const c = g.c;
    c.save();
    const pal = g.pal;
    const col = (pal && pal.muted) || '#5A6382';
    if (t) {
      c.translate(Math.sin(t * 2 + ph) * 0.7, -((t * 0.8 + ph * 0.3) % 1) * 1.2);
      g.alpha(0.55 + 0.25 * Math.sin(t * 2.6 + ph));
    } else {
      g.alpha(0.7);
    }
    c.lineWidth = g.lw * 0.85;
    c.strokeStyle = col;
    c.stroke(path);
    c.restore();
  }

  function art() {
    if (ART || broken) return ART;
    try {
      if (typeof Path2D !== 'function') throw new Error('no Path2D');
      ART = build();
    } catch (err) {
      broken = true;
      ART = null;
    }
    return ART;
  }

  // ---------- sprites ----------
  //
  // Strokes are the costly part of a draw, so the still layer of an item is kept as a small
  // bitmap at the exact pixel size it is shown at, once that size has held for two draws (a
  // bubble pops in at a growing scale, then stays). It is put on whole device pixels when
  // nothing moves it, so it stays as crisp as the shapes; a pose (a sway, a beat) moves the
  // bitmap, and the moving bits are drawn as shapes over it each time. While the size is
  // still changing, a bitmap of the same item at another size is scaled to fit if there is
  // one, and the shapes are drawn if there is not.

  const MARGIN = 3;             // item units kept round the 24-unit box for outlines and overhangs
  const SPRITE_MAX = 320;       // device px: bigger than this is drawn as shapes
  const KEEP = 24;              // bitmaps kept, the least recently used dropped first
  const sprites = new Map();    // item, colours, line and size → bitmap
  const near = new Map();       // item, colours and line → its latest bitmap, at any size
  const seen = new Map();

  function newCanvas(w) {
    try {
      if (typeof document !== 'undefined' && document.createElement) {
        const cv = document.createElement('canvas');
        cv.width = w;
        cv.height = w;
        return cv;
      }
      if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(w, w);
    } catch (err) {
      // no bitmaps here: the shapes will do
    }
    return null;
  }

  // the bitmap of an item's still layer at dk device px per unit, or null to draw shapes
  function sprite(item, id, dk) {
    const q = Math.round(dk * BOX * 2) / 2;
    if (!(q >= 4) || !isFinite(q)) return null;
    const stamp = id === 'hanamaru' ? (G.pal && G.pal.stamp) || '' : '';
    const base = id + '|' + G.o + '|' + stamp + '|' + Math.round(G.lw * 1000);
    const key = base + '|' + q;
    const hit = sprites.get(key);
    if (hit) {
      sprites.delete(key);
      sprites.set(key, hit);
      return hit;
    }
    const kq = q / BOX;
    // the first time at a size, borrow the item's bitmap at a nearby size, or draw shapes;
    // make the bitmap if the size comes again
    if (!seen.has(key)) {
      if (seen.size > 48) seen.clear();
      seen.set(key, 1);
      const other = near.get(base);
      return other && other.kq > kq * 0.6 && other.kq < kq * 1.6 ? other : null;
    }
    seen.delete(key);
    const px = Math.ceil((BOX + MARGIN * 2) * kq);
    if (px > SPRITE_MAX) return null;
    const cv = newCanvas(px);
    const sc = cv && cv.getContext('2d');
    if (!sc) return null;
    const main = G.c;
    try {
      sc.setTransform(kq, 0, 0, kq, px / 2, px / 2);
      sc.lineJoin = 'round';
      sc.lineCap = 'round';
      G.c = sc;
      item.still(G);
    } finally {
      G.c = main;
    }
    const sp = { cv, kq, px, w: px / kq };
    sprites.set(key, sp);
    if (sprites.size > KEEP) sprites.delete(sprites.keys().next().value);
    near.delete(base);
    near.set(base, sp);
    if (near.size > KEEP) near.delete(near.keys().next().value);
    return sp;
  }

  // the bitmap, centred on the pen's (0, 0)
  function blit(c, sp, snap) {
    const m = c.getTransform();
    const tol = sp.kq * 0.02;
    if (snap && Math.abs(m.b) < 1e-6 && Math.abs(m.c) < 1e-6 && Math.abs(m.a - sp.kq) < tol && Math.abs(m.d - sp.kq) < tol) {
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.drawImage(sp.cv, Math.round(m.e - sp.px / 2), Math.round(m.f - sp.px / 2));
      c.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
    } else {
      c.drawImage(sp.cv, -sp.w / 2, -sp.w / 2, sp.w, sp.w);
    }
  }

  // Draws the item centred on (x, y), fitting a size × size box.
  function draw(ctx, id, x, y, size, pal, t) {
    if (!ctx || typeof ctx.save !== 'function' || typeof id !== 'string') return;
    x = +x;
    y = +y;
    size = +size;
    if (!(size > 0) || !isFinite(size) || !isFinite(x) || !isFinite(y)) return;
    const A = art();
    const item = A && A[id];
    if (!item) return;
    t = +t || 0;
    if (!isFinite(t)) t = 0;
    const k = size / BOX;
    const px = Math.min(2.2, Math.max(1.2, 1.5 * Math.sqrt(size / 22)));
    ctx.save();
    try {
      ctx.translate(x, y);
      ctx.scale(k, k);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      if (ctx.setLineDash) ctx.setLineDash([]);
      if (ctx.shadowBlur || ctx.shadowOffsetX || ctx.shadowOffsetY) ctx.shadowColor = 'rgba(0, 0, 0, 0)';
      G.c = ctx;
      G.o = (pal && typeof pal.outline === 'string' && pal.outline) || INK;
      G.lw = px / k;
      G.pal = pal || null;
      G.a0 = typeof ctx.globalAlpha === 'number' ? ctx.globalAlpha : 1;
      let sp = null;
      if (typeof ctx.getTransform === 'function' && typeof ctx.drawImage === 'function') {
        const m = ctx.getTransform();
        sp = sprite(item, id, Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)));
      }
      const moving = !!(t && item.pose);
      if (moving) item.pose(ctx, t);
      if (sp) blit(ctx, sp, !moving);
      else item.still(G);
      if (item.move) item.move(G, t);
    } catch (err) {
      // an item that cannot be drawn is left out
    } finally {
      ctx.restore();
      G.c = null;
      G.pal = null;
    }
  }

  const ITEMS = [
    'sakura', 'star', 'sparkles', 'heart', 'note', 'sweat', 'hanamaru', 'flag', 'medal', 'fan',
    'dango', 'onigiri', 'taiyaki', 'tea', 'ramen', 'bento', 'sushi', 'mikan', 'kakigori',
    'koinobori', 'furin', 'momiji', 'snowflake', 'fireworks', 'fuji', 'umbrella', 'lantern',
    'crane', 'kendama', 'koma', 'otoshi', 'kite', 'pencil', 'frog', 'turtle', 'taiko',
  ];

  // What Yaoki says. Japanese first, short enough for a small bubble (about 7 characters,
  // and 14 in English); the first of each is the line game.js has built in.
  const L = (ja, en, item) => ({ ja, en, item });
  const LINES = {
    start: [
      L('いくよ！', "Let's go", 'koinobori'),
      L('よーい、どん！', 'Ready, go!', 'flag'),
      L('がんばろう！', "Let's do this", 'onigiri'),
      L('しゅっぱつ！', 'Off we go', 'kite'),
      L('きょうもやるぞ', 'Here we go', 'pencil'),
    ],
    half: [
      L('はんぶん！', 'Halfway', 'dango'),
      L('おりかえし！', 'Halfway there', 'mikan'),
      L('いい調子！', 'Going well', 'koinobori'),
      L('あと半分！', 'Half to go', 'tea'),
      L('その調子！', 'Keep it up', 'note'),
    ],
    last: [
      L('ラスト！', 'Last one', 'flag'),
      L('あと一枚！', 'One more card', 'flag'),
      L('これで最後！', 'This is it', 'taiko'),
      L('もうすぐゴール', 'Nearly there', 'kite'),
      L('あとちょっと！', 'Almost there', 'lantern'),
    ],
    step0: [
      L('いいね！', 'Nice', 'sakura'),
      L('ナイス！', 'Nice one', 'sparkles'),
      L('その調子！', 'Keep it up', 'note'),
      L('じょうず！', 'Good typing', 'pencil'),
      L('きれい！', 'Beautiful', 'momiji'),
    ],
    step1: [
      L('すごい！', 'Great', 'star'),
      L('やるね！', "You're good", 'kendama'),
      L('絶好調！', 'On a roll', 'koma'),
      L('止まらない！', 'Unstoppable', 'kite'),
    ],
    step2: [
      L('さすが！', 'Brilliant', 'fireworks'),
      L('名人だね！', 'A real master', 'kendama'),
      L('ノリノリ！', 'In the groove', 'note'),
      L('お見事！', 'Splendid', 'fan'),
    ],
    step3: [
      L('かんぺき！', 'Spotless', 'fuji'),
      L('達人の域！', 'Master level', 'medal'),
      L('伝説だね！', 'Legendary', 'crane'),
      L('もう無敵！', 'Unbeatable', 'star'),
    ],
    comeback: [
      L('もう大丈夫！', 'Got it now', 'onigiri'),
      L('覚えたね！', 'You learned it', 'pencil'),
      L('今度はできた！', 'Nailed it now', 'sakura'),
      L('リベンジ成功！', 'Rematch won!', 'kendama'),
    ],
    rise: [
      L('よいしょ！', 'Up again', 'sweat'),
      L('七転び八起き', 'Fall 7, rise 8', 'otoshi'),
      L('まだまだ！', 'Not done yet', 'koma'),
      L('へっちゃら！', "I'm fine!", 'heart'),
      L('よいしょっと', 'Up we get', 'sweat'),
    ],
    halt: [
      L('ゆっくりでいい', 'Take your time', 'tea'),
      L('あわてないで', 'No rush', 'turtle'),
      L('待ってるよ', "I'll wait", 'tea'),
      L('ひと呼吸', 'Deep breath', 'furin'),
      L('一歩ずつね', 'Step by step', 'turtle'),
    ],
    star: [
      L('にがて克服！', 'Weak spot down', 'star'),
      L('できたね！', 'You did it', 'hanamaru'),
      L('苦手が得意に', 'Now a strength', 'sparkles'),
      L('成長してる！', "You're growing", 'koinobori'),
    ],
    record: [
      L('新記録！', 'New record', 'fan'),
      L('自己ベスト！', 'Personal best', 'medal'),
      L('記録更新！', 'Record broken', 'fireworks'),
      L('最高記録！', 'Best ever', 'fan'),
    ],
    endGood: [
      L('やったね！', 'Well done', 'fireworks'),
      L('すばらしい！', 'Wonderful', 'hanamaru'),
      L('大成功！', 'Big success', 'medal'),
      L('最高だった！', 'That was great', 'sparkles'),
      L('お祭りだ！', 'Party time!', 'lantern'),
    ],
    endOk: [
      L('おつかれ！', 'Good work', 'tea'),
      L('よくできました', 'Nicely done', 'sakura'),
      L('いい感じ！', 'Nice going', 'dango'),
      L('ひと休みしよう', "Let's rest", 'mikan'),
      L('ごほうびだね', 'Treat time!', 'kakigori'),
    ],
    endTry: [
      L('つぎがある！', 'Next time', 'onigiri'),
      L('ドンマイ！', 'No worries', 'heart'),
      L('また挑戦！', 'Try again', 'kite'),
      L('あしたもやろう', 'Again tomorrow', 'crane'),
    ],
    idle: [
      L('うーん…', 'Hmm…', 'dango'),
      L('だんご食べたい', 'Dango, anyone?', 'dango'),
      L('おなかすいた…', "I'm hungry…", 'ramen'),
      L('おーい？', 'Hello?', 'note'),
      L('たい焼き…', 'Taiyaki…', 'taiyaki'),
      L('お弁当まだ？', 'Lunch yet?', 'bento'),
      L('おすし食べたい', 'Craving sushi', 'sushi'),
      L('次のキーは？', "What's next?", 'pencil'),
      L('いっしょにやろ', "Let's do it", 'heart'),
    ],
    smash: [
      L('どーん！', 'Boom!', 'taiko'),
      L('ドカーン！', 'Kaboom!', 'fireworks'),
      L('えいっ！', 'Hi-yah!', 'otoshi'),
      L('バーン！', 'Bam!', 'taiko'),
    ],
    jump: [
      L('ぴょん！', 'Hop!', 'frog'),
      L('ぴょーん！', 'Boing!', 'frog'),
      L('ひらり！', 'Up and over', 'crane'),
      L('ジャンプ！', 'Jump!', 'kite'),
    ],
    duck: [
      L('ひょいっ', 'Duck!', 'turtle'),
      L('さっ！', 'Swish!', 'fan'),
      L('かわした！', 'Dodged it!', 'sweat'),
      L('すいっ', 'Slip under', 'taiyaki'),
    ],
    spin: [
      L('くるりん！', 'Twirl!', 'koma'),
      L('くるっ！', 'Spin!', 'koma'),
      L('くるくるー', 'Round we go', 'umbrella'),
      L('まわれー！', 'Spin away!', 'snowflake'),
    ],
  };

  // make the shapes while the page is idle, so the first bubble does not wait for them
  try {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(art, { timeout: 3000 });
    else if (typeof setTimeout === 'function') setTimeout(art, 300);
  } catch (err) {
    // they are made on the first draw instead
  }

  window.TypingItems = { ITEMS, draw, LINES };
})();
