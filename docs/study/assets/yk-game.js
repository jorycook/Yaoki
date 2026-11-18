/* Yaoki games: the rounds of the four games, made from the course, the record of what was played, and kanji drawn
 * from their strokes.
 *   match  漢字マッチ  Kanji match: flip the cards and pair each word with its reading or its meaning
 *   catch  聞き取りキャッチ  Listening catch: hear a word and tap its card before it lands on Yaoki
 *   build  文づくり  Sentence builder: put the pieces of a ★ sentence in order, a bridge for Yaoki to cross
 *   parts  漢字パズル  Kanji parts: build a kanji from its two parts, then pick how it is read in its word
 * At the kana level (かな) the cards are kana and their sounds, the builder builds words from kana, and there is no
 * kanji puzzle. A round is made from one study day (the day's game on Today's spread) or from a whole week (the games
 * tab), in an order a test can fix (window.__ykSeed). The games keep no lives and no clock score: a clean round gets a
 * はなまる, a finished one a まる. Nothing here counts toward the stamps or goes into the notebook.
 * It reads the course (window.__ykCourses, course.js), the strokes (strokes.js) and the kanji parts (kanji-parts.js). */
(function () {
  var G = window.ykGame = window.ykGame || {};
  var KINDS = ['match', 'catch', 'build', 'parts'];
  G.KINDS = KINDS;

  /* ---------- names ---------- */
  var INFO = {
    match: { ja: '漢字マッチ', en: 'Kanji match', kanaJa: 'かなマッチ', kanaEn: 'Kana match', icon: '合',
      line: 'Flip two cards: pair each word with its reading or its meaning.', kanaLine: 'Flip two cards: pair each kana with its sound, each word with its meaning.' },
    catch: { ja: '聞き取りキャッチ', en: 'Listening catch', icon: '聴',
      line: 'Hear a word, then tap its card before it lands on Yaoki.', kanaLine: 'Hear a kana or a word, then tap it before it lands on Yaoki.' },
    build: { ja: '文づくり', en: 'Sentence builder', kanaJa: 'ことばづくり', kanaEn: 'Word builder', icon: '橋',
      line: 'Put the pieces in order to build Yaoki a bridge.', kanaLine: 'Hear a word, then build it from kana to make Yaoki a bridge.' },
    parts: { ja: '漢字パズル', en: 'Kanji parts', icon: '字',
      line: 'Build a kanji from its two parts, then pick its reading.', kanaLine: 'Kanji parts start at N5.' },
  };
  G.info = function (kind, level) {
    var i = INFO[kind] || INFO.match;
    var k = level === 'KANA';
    return { kind: kind, ja: (k && i.kanaJa) || i.ja, en: (k && i.kanaEn) || i.en, icon: i.icon, line: k ? i.kanaLine : i.line };
  };
  /* the games a level has: the kana level has no kanji puzzle */
  G.kinds = function (level) { return level === 'KANA' ? ['match', 'catch', 'build'] : KINDS.slice(); };
  /* the day's game, in turn through the week: the まとめ day (6) builds the week's sentences; the kana course's sixth
     day sorts out look-alike kana, which is a listening catch */
  var DAILY = ['match', 'catch', 'build', 'parts', 'match', 'build'];
  var DAILY_KANA = ['match', 'catch', 'build', 'match', 'build', 'catch'];
  G.dayKind = function (level, day) {
    var list = level === 'KANA' ? DAILY_KANA : DAILY;
    return list[Math.max(0, Math.min(5, (day || 1) - 1))];
  };

  /* ---------- a random order a test can fix ---------- */
  G.seed = function () {
    if (window.__ykSeed != null) return +window.__ykSeed;
    return (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
  };
  function rng(seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  G.rng = rng;
  function shuffle(list, r) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  G.shuffle = shuffle;

  /* ---------- the course ---------- */
  function courses() { return window.__ykCourses || {}; }
  function prefix(lv) { return lv === 'N2' ? '' : String(lv || '').toLowerCase(); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  /* the record's name for a week (u03, n5u01, kanau02) and for a day (u03d4) */
  G.weekKey = function (level, unit) { return prefix(level) + 'u' + pad(unit); };
  G.dayKey = function (level, unit, day) { return G.weekKey(level, unit) + 'd' + day; };
  function unitOf(level, n) {
    var d = courses()[level];
    if (!d) return null;
    for (var i = 0; i < d.units.length; i++) if (d.units[i].n === n) return d.units[i];
    return null;
  }
  /* the study days a round draws on: the one day, or every day of the week (days 1 to 6) */
  function daysOf(level, unit, day) {
    var u = unitOf(level, unit);
    if (!u || !u.days) return [];
    if (day) return u.days[day - 1] ? [u.days[day - 1]] : [];
    return u.days.slice(0, 6).filter(Boolean);
  }
  function item(id) {
    var c = courses();
    for (var k in c) if (c[k].items && c[k].items[id]) return c[k].items[id];
    return null;
  }
  function plain(s) { return String(s == null ? '' : s).replace(/\[([^|\]]*)\|[^\]]*\]/g, '$1').replace(/[{}_^]/g, ''); }
  /* a gloss short enough for a card: no aside in brackets, and only its first sense when it runs long */
  function short(g) {
    var s = String(g || '').replace(/\s*[(（][^)）]*[)）]/g, '').trim();
    if (s.length > 22) s = s.split(/[;,]/)[0].trim();
    return s;
  }
  G.short = short;
  /* the scene words of the days a round draws on, once each */
  function sceneWords(days) {
    var seen = {};
    var out = [];
    days.forEach(function (d) {
      ((d.scene && d.scene.words) || []).forEach(function (w) {
        if (!w.word || seen[w.word]) return;
        seen[w.word] = 1;
        out.push({ word: w.word, reading: w.reading, gloss: short(w.gloss), clip: w.clip || '', parts: w.parts || [] });
      });
    });
    return out;
  }
  /* the kana course: a day's new kana ([kana, romaji, clip]) and its words */
  function kanaOf(days) {
    var seen = {};
    var out = [];
    days.forEach(function (d) {
      ((d.kana && d.kana.cards) || []).forEach(function (c) {
        (c.kana || []).forEach(function (k) {
          if (!k[0] || seen[k[0]]) return;
          seen[k[0]] = 1;
          out.push({ word: k[0], reading: k[1], gloss: k[1], clip: k[2] || '' });
        });
      });
    });
    return out;
  }
  function kanaWords(days) {
    var seen = {};
    var out = [];
    days.forEach(function (d) {
      var lists = [((d.words && d.words.list) || []), ((d.write && d.write.words) || [])];
      ((d.kana && d.kana.cards) || []).forEach(function (c) { lists.push(c.words || []); });
      lists.forEach(function (l) {
        l.forEach(function (w) {
          if (!w.w || seen[w.w] || /[。、\s]/.test(w.w)) return;
          seen[w.w] = 1;
          out.push({ word: w.w, reading: w.r, gloss: short(w.gloss), clip: w.clip || '' });
        });
      });
    });
    return out;
  }
  /* the whole level's words, for wrong options when a day has too few of its own */
  function levelWords(level) {
    var d = courses()[level];
    if (!d) return [];
    var days = [];
    d.units.forEach(function (u) { (u.days || []).forEach(function (x) { if (x) days.push(x); }); });
    return level === 'KANA' ? kanaOf(days).concat(kanaWords(days)) : sceneWords(days);
  }

  /* ---------- the rounds ----------
     G.round(kind, { level, unit, day (1-6, or 0 for the whole week) }, seed) -> a round, or null when the days hold
     too little for it. Every round has kind, level, unit, day, size (how many turns) and its own pieces. */
  G.round = function (kind, src, seed) {
    var level = src.level || 'N2';
    var r = rng(seed == null ? G.seed() : seed);
    var days = daysOf(level, src.unit, src.day);
    var week = src.day ? daysOf(level, src.unit, 0) : days;
    var make = { match: matchRound, catch: catchRound, build: buildRound, parts: partsRound }[kind];
    if (!make || !days.length) return null;
    var out = make(level, days, week, r, !src.day);
    if (!out) return null;
    out.kind = kind;
    out.level = level;
    out.unit = src.unit;
    out.day = src.day || 0;
    return out;
  };
  /* can this game be played on these days? */
  G.can = function (kind, src) { return !!G.round(kind, src, 1); };

  /* match: six pairs, half of them a word and its reading, half a word and its meaning (at the kana level: a kana and
     its sound in letters, a word and its meaning) */
  function matchRound(level, days, week, r, whole) {
    var pairs = [];
    if (level === 'KANA') {
      var ks = shuffle(kanaOf(days), r);
      if (ks.length < 3) ks = ks.concat(shuffle(kanaOf(week), r).filter(function (k) { return ks.indexOf(k) < 0; }));
      var ws = shuffle(kanaWords(days).filter(function (w) { return w.gloss; }), r);
      if (ws.length < 3) ws = ws.concat(shuffle(kanaWords(week), r).filter(function (w) { return ws.indexOf(w) < 0 && w.gloss; }));
      ks.slice(0, 3).forEach(function (k) { pairs.push({ a: k.word, b: k.reading, face: 'sound', clip: k.clip, word: k.word, reading: k.reading, gloss: '' }); });
      ws.slice(0, 6 - Math.min(3, ks.length)).forEach(function (w) { pairs.push({ a: w.word, b: w.gloss, face: 'meaning', clip: w.clip, word: w.word, reading: w.reading, gloss: w.gloss }); });
    } else {
      var words = shuffle(sceneWords(days).filter(function (w) { return w.reading && w.gloss; }), r);
      if (words.length < 6) words = words.concat(shuffle(sceneWords(week), r).filter(function (w) { return !words.some(function (x) { return x.word === w.word; }) && w.reading && w.gloss; }));
      words.slice(0, 6).forEach(function (w, i) {
        var reading = i % 2 === 0;
        pairs.push({ a: w.word, b: reading ? w.reading : w.gloss, face: reading ? 'reading' : 'meaning', clip: w.clip, word: w.word, reading: w.reading, gloss: w.gloss });
      });
    }
    /* two cards may not show the same text: a word whose reading is itself (a kana word) pairs with its meaning */
    pairs = pairs.filter(function (p) { return p.a && p.b && p.a !== p.b; });
    if (pairs.length < 3) return null;
    var cards = [];
    pairs.forEach(function (p, i) {
      cards.push({ key: 'a' + i, pair: i, face: 'word', text: p.a });
      cards.push({ key: 'b' + i, pair: i, face: p.face, text: p.b });
    });
    return { size: pairs.length, pairs: pairs, cards: shuffle(cards, r) };
  }

  /* catch: a word heard, three cards falling, one of them the word (at the kana level, a kana or a word) */
  function catchRound(level, days, week, r, whole) {
    var n = whole ? 8 : 6;
    var own = level === 'KANA' ? kanaOf(days).concat(kanaWords(days)) : sceneWords(days);
    var pool = level === 'KANA' ? kanaOf(week).concat(kanaWords(week)) : sceneWords(week);
    var targets = shuffle(own.filter(function (w) { return w.clip; }), r);
    if (targets.length < n) targets = targets.concat(shuffle(pool.filter(function (w) { return w.clip && !targets.some(function (x) { return x.word === w.word; }); }), r));
    targets = targets.slice(0, n);
    if (targets.length < 3) return null;
    var others = pool.length >= 6 ? pool : pool.concat(levelWords(level));
    var drops = targets.map(function (t) {
      /* wrong cards that look like the right one in length, and never sound the same */
      var near = shuffle(others.filter(function (w) { return w.word !== t.word && w.reading !== t.reading; }), r);
      near.sort(function (x, y) { return Math.abs(x.word.length - t.word.length) - Math.abs(y.word.length - t.word.length); });
      var picks = [];
      for (var i = 0; i < near.length && picks.length < 2; i++) if (!picks.some(function (p) { return p.word === near[i].word; })) picks.push(near[i]);
      var cards = shuffle([t].concat(picks), r);
      return { target: t, cards: cards, answer: cards.indexOf(t) };
    }).filter(function (d) { return d.cards.length === 3; });
    if (drops.length < 3) return null;
    return { size: drops.length, drops: drops };
  }

  /* build: the ★ sentences of the day (its drill and exam-style ones), then the week's, four or five to a round;
     at the kana level, words heard and built from their kana */
  function stars(days) {
    var out = [];
    days.forEach(function (d) {
      var g = d.grammar || {};
      (g.drill || []).concat(g.exam || []).forEach(function (x) {
        var it = typeof x === 'string' ? item(x) : x && x.id ? item(x.id) || x : null;
        if (it && it.kind === 'star' && it.tiles && it.tiles.length >= 3 && !out.some(function (o) { return o.id === it.id; })) out.push(it);
      });
    });
    return out;
  }
  /* a word's beats: a small ゃ, ゅ, ょ (or ァ, ィ …) goes with the kana before it */
  function morae(w) {
    var out = [];
    Array.from(String(w || '')).forEach(function (c) {
      if (/[ゃゅょぁぃぅぇぉゎャュョァィゥェォヮ]/.test(c) && out.length) out[out.length - 1] += c;
      else out.push(c);
    });
    return out;
  }
  G.morae = morae;
  function buildRound(level, days, week, r, whole) {
    var n = whole ? 5 : 4;
    if (level === 'KANA') {
      var words = shuffle(kanaWords(days).filter(function (w) { var m = morae(w.word); return m.length >= 2 && m.length <= 5; }), r);
      if (words.length < n) words = words.concat(shuffle(kanaWords(week), r).filter(function (w) { var m = morae(w.word); return m.length >= 2 && m.length <= 5 && !words.some(function (x) { return x.word === w.word; }); }));
      words = words.slice(0, n);
      if (words.length < 3) return null;
      var allKana = [];
      kanaWords(week).forEach(function (w) { morae(w.word).forEach(function (m) { if (allKana.indexOf(m) < 0) allKana.push(m); }); });
      var lines = words.map(function (w) {
        var tiles = morae(w.word);
        var extra = shuffle(allKana.filter(function (m) { return tiles.indexOf(m) < 0; }), r)[0];
        var bank = tiles.map(function (t, i) { return { text: t, at: i }; });
        if (extra) bank.push({ text: extra, at: -1 });
        return { id: w.word, before: '', after: '', tiles: tiles, bank: shuffle(bank, r), full: w.word, explain: w.gloss, reading: w.reading, clip: w.clip, star: -1 };
      });
      return { size: lines.length, lines: lines };
    }
    var own = shuffle(stars(days), r);
    var more = shuffle(stars(week), r).filter(function (x) { return own.indexOf(x) < 0; });
    var list = own.concat(more).slice(0, n);
    if (list.length < 3) return null;
    return {
      size: list.length,
      lines: list.map(function (it) {
        var bank = it.tiles.map(function (t, i) { return { text: t, at: i }; });
        return { id: it.id, before: it.before || '', after: it.after || '', tiles: it.tiles.slice(), bank: shuffle(bank, r), full: it.full || '', explain: it.explain || '', star: typeof it.star === 'number' ? it.star : -1 };
      }),
    };
  }

  /* parts: a kanji of the day's words, built from its two parts (two right, two from other kanji), then its reading
     in that word; four kanji to a day's round, five to a week's */
  function partsRound(level, days, week, r, whole) {
    if (level === 'KANA') return null;
    var P = window.__ykParts || {};
    var S = window.__ykStrokes || {};
    var n = whole ? 5 : 4;
    var kanjiOf = function (list) {
      var out = [];
      list.forEach(function (w) {
        (w.parts || []).forEach(function (p) {
          var k = p[0];
          if (Array.from(k || '').length !== 1 || !P[k] || !S[k] || out.some(function (o) { return o.k === k; })) return;
          out.push({ k: k, reading: p[1], meaning: p[2] || '', word: w });
        });
      });
      return out;
    };
    /* a kanji whose parts are both more than a single stroke makes a better puzzle */
    var good = function (x) { return P[x.k][0][1].length >= 2 && P[x.k][1][1].length >= 2; };
    var own = shuffle(kanjiOf(sceneWords(days)), r);
    var weekK = shuffle(kanjiOf(sceneWords(week)), r);
    var list = own.filter(good).concat(weekK.filter(function (x) { return good(x) && !own.some(function (o) { return o.k === x.k; }); })).concat(own.filter(function (x) { return !good(x); }));
    list = list.slice(0, n);
    if (list.length < 3) return null;
    /* the wrong parts come from the week's other kanji, then the level's */
    var spare = weekK.concat(shuffle(kanjiOf(levelWords(level)), r));
    var readings = weekK.concat(kanjiOf(levelWords(level)));
    var kata = function (s) { return /[ァ-ヶ]/.test(s); };
    var puzzles = list.map(function (x) {
      var mine = P[x.k];
      var els = [mine[0][0], mine[1][0]];
      var wrong = [];
      for (var i = 0; i < spare.length && wrong.length < 2; i++) {
        var o = spare[i];
        if (o.k === x.k) continue;
        P[o.k].forEach(function (pt) {
          if (wrong.length >= 2 || !pt[0] || els.indexOf(pt[0]) >= 0 || wrong.some(function (w) { return w.el === pt[0]; })) return;
          if (pt[1].length < 2 && wrong.length === 0) return;
          wrong.push({ src: o.k, el: pt[0], strokes: pt[1], box: pt[2], right: false });
        });
      }
      var tray = shuffle([
        { src: x.k, el: mine[0][0], strokes: mine[0][1], box: mine[0][2], right: true, slot: 0 },
        { src: x.k, el: mine[1][0], strokes: mine[1][1], box: mine[1][2], right: true, slot: 1 },
      ].concat(wrong), r);
      /* how the kanji is read in its word, against two readings of the week's other kanji (katakana with katakana) */
      var others = shuffle(readings.filter(function (o) { return o.reading && o.reading !== x.reading && kata(o.reading) === kata(x.reading); }), r);
      var opts = [x.reading];
      for (var j = 0; j < others.length && opts.length < 3; j++) if (opts.indexOf(others[j].reading) < 0) opts.push(others[j].reading);
      var options = shuffle(opts, r);
      return { kanji: x.k, meaning: x.meaning, reading: x.reading, word: x.word, tray: tray, options: options, answer: options.indexOf(x.reading) };
    }).filter(function (p) { return p.tray.length >= 3 && p.options.length >= 2; });
    if (puzzles.length < 3) return null;
    return { size: puzzles.length, puzzles: puzzles };
  }

  /* ---------- results and the record ----------
     A round ends with a mark: はなまる for a clean round, まる for a finished one.
     The record (the app's state.play): for each week, each game's best mark { h: 1 for a はなまる, n: rounds played,
     at: the day it was last played }, and for each study day, the day's game { k: kind, h, at }. */
  G.mark = function (slips) { return slips ? 'maru' : 'hanamaru'; };
  G.record = function (play, game, mark, today) {
    var out = {};
    var k;
    for (k in play || {}) out[k] = play[k];
    var wk = G.weekKey(game.level, game.unit);
    var week = {};
    for (k in out[wk] || {}) week[k] = out[wk][k];
    var had = week[game.kind] || {};
    week[game.kind] = { h: had.h || mark === 'hanamaru' ? 1 : 0, n: (had.n || 0) + 1, at: today || '' };
    out[wk] = week;
    if (game.day) {
      var dk = G.dayKey(game.level, game.unit, game.day);
      var day = out[dk] || {};
      out[dk] = { k: game.kind, h: day.h || mark === 'hanamaru' ? 1 : 0, at: today || '' };
    }
    return out;
  };
  /* a week's marks: { match: 'hanamaru' | 'maru' | '' … } and how many はなまる */
  G.weekMarks = function (play, level, unit) {
    var w = (play || {})[G.weekKey(level, unit)] || {};
    var out = { count: 0 };
    KINDS.forEach(function (k) { out[k] = w[k] ? (w[k].h ? 'hanamaru' : 'maru') : ''; if (w[k] && w[k].h) out.count += 1; });
    return out;
  };
  G.dayPlayed = function (play, level, unit, day) { return (play || {})[G.dayKey(level, unit, day)] || null; };

  /* ---------- drawing a kanji, or some of its strokes, from strokes.js ----------
     G.draw(el, kanji, { only: [stroke numbers], box: [x0, y0, x1, y1] (fit to that box, else the whole 109 × 109),
     pad, color, width, faint: true (light grey), anim: ms per stroke (draws them in order) })
     The SVG is made by script inside el (a box the screen gives it), as the writing pad does. */
  var NS = 'http://www.w3.org/2000/svg';
  function motion() {
    try { return !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return true; }
  }
  G.motion = motion;
  G.draw = function (el, ch, o) {
    if (!el) return;
    o = o || {};
    var all = (window.__ykStrokes || {})[ch];
    var key = [ch, (o.only || []).join(','), (o.box || []).join(','), o.color || '', o.width || '', o.anim || '', o.faint ? 1 : 0, o.again || 0].join('|');
    if (el.__ykDrawn === key) return;
    el.__ykDrawn = key;
    while (el.firstChild) el.removeChild(el.firstChild);
    if (!all) return;
    var strokes = all.split('|');
    var vb = [0, 0, 109, 109];
    if (o.box) {
      var b = o.box;
      var p = o.pad == null ? 8 : o.pad;
      var w = b[2] - b[0];
      var h = b[3] - b[1];
      var side = Math.max(w, h) + p * 2;
      vb = [b[0] + w / 2 - side / 2, b[1] + h / 2 - side / 2, side, side];
    }
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', vb.map(function (x) { return Math.round(x * 10) / 10; }).join(' '));
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.display = 'block';
    svg.style.overflow = 'visible';
    var list = o.only || strokes.map(function (_, i) { return i; });
    var anim = o.anim && motion() ? o.anim : 0;
    list.forEach(function (i, n) {
      if (!strokes[i]) return;
      var path = document.createElementNS(NS, 'path');
      path.setAttribute('d', strokes[i]);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', o.faint ? '#D5DAE8' : o.color || '#1B2440');
      path.setAttribute('stroke-width', String(o.width || 4.2));
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      if (anim) {
        path.setAttribute('pathLength', '100');
        path.style.strokeDasharray = '100';
        path.style.strokeDashoffset = '100';
        path.style.transition = 'stroke-dashoffset ' + anim + 'ms ease-in-out ' + n * anim + 'ms';
      }
      svg.appendChild(path);
    });
    el.appendChild(svg);
    if (anim) {
      /* start the strokes on the next frame, so the transition runs from the empty stroke */
      var go = function () { Array.prototype.forEach.call(svg.childNodes, function (pth) { pth.style.strokeDashoffset = '0'; }); };
      if (window.requestAnimationFrame) window.requestAnimationFrame(function () { window.requestAnimationFrame(go); });
      else setTimeout(go, 30);
    }
  };

  /* ---------- small sounds for the games: a tick, a chime, a thud ----------
     Made in the browser through the sound player's output (sound.js) when it is running; silent otherwise. */
  G.fx = function (kind, on) {
    if (on === false) return false;
    var s = window.ykSound;
    return !!(s && s.fx && s.fx(kind));
  };
})();
