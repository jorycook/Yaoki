/*
 * Yaoki Typing: a round of cards on Yaoki's route. Each card holds a prompt; type it and a
 * 済 lands on it, and it settles onto the route as a 済 node that Yaoki rolls past. A card that
 * reaches him knocks him over; he rights himself like the toy he is (七転び八起き) and the card
 * comes back later in the round. A card that has already knocked him over twice waits for him
 * instead, so every round ends. The rules for spelling and the key tables are in engine.js.
 *
 * Pacing is measured, not stepped: per stage the game keeps the player's reaction time (card
 * shown to first right key) and typing rate (keys a second), and spaces the cards so each
 * arrives about 1.15 × the time the one before it needs. The world speed is set once per round
 * from the longest prompt, so the longest card always has the round's time budget T once it is
 * fully in view.
 */
(function () {
  'use strict';

  const E = window.TypingEngine;
  const $ = (id) => document.getElementById(id);
  const STORE = 'yaoki.typing.v1';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const darkScheme = window.matchMedia('(prefers-color-scheme: dark)');
  const touchOnly = window.matchMedia('(hover: none) and (pointer: coarse)');

  // The scene, in logical units: 240 high and as wide as its box at that scale.
  const H = 240;
  const GROUND = 168;          // the route line; cards stand on it
  const CARD_H = 74;
  const YAOKI = 0.62;          // Yaoki's size: the app's 100-unit drawing at 62%
  const REACH = 26;            // a card whose left edge passes Yaoki's centre + REACH has reached him
  const SLACK = 1.15;          // cards come 15% slower than the player's measured speed
  const START = {              // first measures for a stage: reaction (s) and keys a second
    romaji: { r: 1.0, p: 1.6 },
    symbol: { r: 1.8, p: 1.6 },
    keys: { r: 2.5, p: 1.6 },
  };
  const STUCK_FIRST = 5;       // seconds before the first key of a card until a "when stuck" hint
  const STUCK_NEXT = 3;        // seconds between keys until the next level of hint

  // ---------- what is kept between visits ----------

  const DEFAULTS = { mode: null, stage: {}, level: null, unit: {}, hints: 'stuck', len: 20, kb: true, sound: true, best: {}, pace: {}, stats: {} };
  let saved = load();

  function load() {
    const fresh = JSON.parse(JSON.stringify(DEFAULTS));
    try {
      const v = JSON.parse(localStorage.getItem(STORE));
      if (v && typeof v === 'object') return Object.assign(fresh, v);
    } catch (err) {
      // Storage can be refused (a private window): the page works, nothing is kept.
    }
    return fresh;
  }
  function save() {
    try {
      localStorage.setItem(STORE, JSON.stringify(saved));
    } catch (err) {
      // as above
    }
  }

  // Misses are kept per kana (romaji modes), per symbol and per kana key. Like the app's
  // mistake notebook, an item leaves the list after three clean answers in a row.
  function bucket(name) {
    return saved.stats[name] || (saved.stats[name] = {});
  }
  function markMiss(name, key) {
    const b = bucket(name);
    const v = b[key] || (b[key] = { miss: 0, ok: 0 });
    v.miss++;
    v.ok = 0;
  }
  function markOk(name, key) {
    const b = bucket(name);
    const v = b[key];
    if (!v) return;
    v.ok++;
    if (v.ok >= 3) delete b[key];
  }

  // The learner's place in the Yaoki app, read from the app's own saved state (same site).
  function learnerPlace() {
    const root = location.pathname.replace(/typing\/(index\.html)?$/, '');
    try {
      const s = JSON.parse(localStorage.getItem('yaoki.v1:' + root));
      if (!s) return null;
      const level = s.level || (s.started ? 'N2' : null);
      if (!level) return null;
      const m = /^(?:n\d)?u(\d+)/.exec(s.cur || '');
      return { level, unit: m ? Number(m[1]) : null };
    } catch (err) {
      return null;
    }
  }
  const place = learnerPlace();

  // ---------- modes, stages and course words ----------

  const MODES = {
    course: {
      ja: '語彙', en: 'Course words', kind: 'romaji', stats: 'kana',
      desc: 'The words of a week of your Yaoki course. Each card shows the word with its reading; type the reading in romaji. A cleared word is spoken.',
    },
    romaji: {
      ja: 'ローマ字', en: 'Romaji', kind: 'romaji', stats: 'kana',
      desc: 'Kana, katakana, words and short sentences, typed in romaji as the Japanese input method reads them.',
    },
    symbol: {
      ja: '記号', en: 'Symbol keys', kind: 'symbol', stats: 'symbol',
      desc: 'Symbols and Japanese punctuation, typed on the key where a Japanese keyboard puts them.',
    },
    keys: {
      ja: 'かな入力', en: 'Kana input', kind: 'keys', stats: 'keys',
      desc: 'Where each kana sits on a Japanese keyboard, for kana input. Press the key that carries it; the input mode does not matter.',
    },
  };
  const MODE_ORDER = ['course', 'romaji', 'symbol', 'keys'];
  const STAGES = { romaji: E.KANA_STAGES, symbol: E.SYMBOL_STAGES, keys: E.KANA_KEY_STAGES };
  const LEVELS = ['N5', 'N4', 'N3', 'N2'];

  if (saved.mode === 'kana') saved.mode = 'romaji';
  if (!MODES[saved.mode]) saved.mode = place ? 'course' : 'romaji';
  if (!LEVELS.includes(saved.level)) saved.level = place && LEVELS.includes(place.level) ? place.level : 'N5';

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Could not load ' + src));
      document.head.appendChild(s);
    });
  }

  // A level's weeks, each with its words (one per word and reading). Loaded when first needed.
  const courses = {};
  const courseLoads = {};
  function loadCourse(level) {
    if (!courseLoads[level]) {
      courseLoads[level] = loadScript('../assets/course-' + level.toLowerCase() + '.js').then(() => {
        const c = window.__ykCourses && window.__ykCourses[level];
        if (!c || !Array.isArray(c.units)) throw new Error('No course for ' + level);
        courses[level] = c.units.map(unitWords);
        return courses[level];
      });
      courseLoads[level].catch(() => {
        delete courseLoads[level];
      });
    }
    return courseLoads[level];
  }
  function unitWords(u) {
    const seen = new Set();
    const words = [];
    for (const d of u.days || []) {
      for (const w of (d.scene && d.scene.words) || []) {
        const key = w.word + '|' + w.reading;
        if (seen.has(key)) continue;
        seen.add(key);
        try {
          E.tokenize(w.reading);
        } catch (err) {
          continue;
        }
        words.push({ text: w.word, reading: w.reading, gloss: w.gloss, clip: w.clip });
      }
    }
    return { n: u.n, ja: u.ja, en: u.en, words };
  }

  // The words' sound: the app's player and the week's clips, loaded beside the words.
  // The round never waits for them; a clip that is not there yet is simply not played.
  const soundLoads = {};
  function loadSound(level, n) {
    const lv = level.toLowerCase();
    const files = level === 'N2' ? ['sound-course.js', 'sound-lessons.js'] : ['sound-course-' + lv + '-u' + String(n).padStart(2, '0') + '.js'];
    const need = window.ykSound ? [] : ['sound.js'];
    for (const f of need.concat(files)) {
      if (!soundLoads[f]) soundLoads[f] = loadScript('../assets/' + f).catch(() => {});
    }
  }

  // The keyboard's layout, where the browser can tell: a non-JIS layout puts the symbols on
  // other keys, and a keyboard without the ろ and ¥ keys cannot type those kana cards.
  const layout = { jis: null, ro: true, yen: true };
  if (navigator.keyboard && navigator.keyboard.getLayoutMap) {
    navigator.keyboard.getLayoutMap().then((map) => {
      if (!map || !map.size) return;
      layout.jis = map.get('BracketLeft') === '@';
      layout.ro = map.has('IntlRo');
      layout.yen = map.has('IntlYen');
      if (phase === 'menu') renderPicks();
    }).catch(() => {});
  }

  // ---------- prompts ----------

  function romajiItem(text, extra) {
    const reading = extra.reading || text;
    const tokens = E.tokenize(reading);
    return Object.assign({ kind: 'romaji', id: 'r:' + text + '|' + reading, text, tokens, units: E.units(tokens), len: E.spell(tokens).length }, extra);
  }

  // The prompts of the stage (or course week) picked in the menu, or null if not ready.
  function currentItems() {
    const mode = saved.mode;
    if (mode === 'course') {
      const units = courses[saved.level];
      const unit = units && units.find((u) => u.n === saved.unit[saved.level]);
      if (!unit || !unit.words.length) return null;
      return unit.words.map((w) => romajiItem(w.text, { reading: w.reading, gloss: w.gloss, clip: w.clip }));
    }
    const stage = currentStage();
    if (mode === 'romaji') {
      const out = [];
      for (const it of stage.items) {
        try {
          out.push(romajiItem(it.text, { gloss: it.gloss }));
        } catch (err) {
          // a prompt the rules cannot spell is left out rather than stopping the round
        }
      }
      return out;
    }
    if (mode === 'symbol') {
      return stage.items.map((k) => ({ kind: 'symbol', id: 's:' + k.ch, text: k.ch, key: k.key, code: k.code, shift: k.shift, len: k.shift ? 2 : 1 }));
    }
    return stage.items
      .filter((k) => (k.code !== 'IntlRo' || layout.ro) && (k.code !== 'IntlYen' || layout.yen))
      .map((k) => ({ kind: 'keys', id: 'k:' + k.kana + (k.shift ? '+' : ''), text: k.kana, code: k.code, shift: k.shift, len: k.shift ? 2 : 1 }));
  }

  function currentStage() {
    const list = STAGES[saved.mode];
    return list.find((s) => s.id === saved.stage[saved.mode]) || list[0];
  }

  // Where the pick's pace and best are kept: per stage, or per course week.
  function stageKey() {
    if (saved.mode === 'course') return 'course:' + saved.level + 'u' + saved.unit[saved.level];
    return saved.mode + ':' + currentStage().id;
  }
  function stageName() {
    if (saved.mode === 'course') {
      const units = courses[saved.level] || [];
      const u = units.find((x) => x.n === saved.unit[saved.level]);
      return saved.level + ' · ' + ja('第' + saved.unit[saved.level] + '週') + (u ? '　' + esc(u.en) : '');
    }
    const st = currentStage();
    return ja(MODES[saved.mode].ja + ' · ' + st.ja) + '　' + esc(st.en);
  }

  // Markup helpers: text made safe for innerHTML, and Japanese marked as Japanese.
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const ja = (t) => '<span lang="ja">' + esc(t) + '</span>';
  // Mixed text: only its kana and kanji marked as Japanese.
  const jaMarked = (t) => esc(t).replace(/[\u3040-\u30ff\u4e00-\u9fff々〜・「」]+/g, (m) => '<span lang="ja">' + m + '</span>');

  // How much of an item is still on the weak list.
  function statKey(item) {
    return item.kind === 'symbol' ? item.text : item.text + (item.shift ? '+' : '');
  }
  function weakness(item, stats) {
    if (item.kind === 'romaji') return item.units.reduce((n, u) => n + (stats[u] ? stats[u].miss : 0), 0);
    return stats[statKey(item)] ? stats[statKey(item)].miss : 0;
  }

  // The cards of a round: every prompt once before any repeats, weak ones more likely to
  // come early; a weak-spot round deals only the weak ones, weakest first.
  function deal(items, n, weakOnly) {
    const stats = bucket(MODES[saved.mode].stats);
    let pool;
    if (weakOnly) {
      pool = items.filter((it) => weakness(it, stats) > 0).sort((a, b) => weakness(b, stats) - weakness(a, stats));
      n = Math.min(n, pool.length * 2);
    } else {
      pool = items
        .map((it) => ({ it, k: Math.pow(Math.random(), 1 / (1 + 2 * weakness(it, stats))) }))
        .sort((a, b) => b.k - a.k)
        .map((x) => x.it);
    }
    const out = [];
    while (out.length < n && pool.length) {
      for (const it of pool) {
        if (out.length >= n) break;
        if (out.length && out[out.length - 1] === it && pool.length > 1) continue;
        out.push(it);
      }
    }
    return out;
  }

  // ---------- the round ----------

  let phase = 'menu';           // menu | play | paused | result
  let r = null;                 // the round being played
  let view = { W: 960, s: 1, oy: 0, dpr: 1, yx: 100 };
  let pal = palette();
  let startTicket = 0;

  async function startRound(weakOnly) {
    const ticket = ++startTicket;
    const items = currentItems();
    if (!items || !items.length) return;
    let deck = deal(items, saved.len, weakOnly);
    if (!deck.length && weakOnly) {
      weakOnly = false;
      deck = deal(items, saved.len, false);
    }
    if (!deck.length) return;
    // What is played is fixed now: a pick made while the typefaces load does not change it.
    const from = phase;
    const modeId = saved.mode;
    const key = stageKey();
    const name = stageName();
    const level = saved.level;
    const unit = saved.unit[saved.level];
    // Measure the cards in the typeface they are drawn in (a short wait at most). A newer
    // Start, or a pick made meanwhile, wins over this one.
    await fontsFor(deck);
    if (ticket !== startTicket || phase !== from || saved.mode !== modeId || stageKey() !== key || !$('settings-sheet').hidden) return;
    const mode = MODES[modeId];
    const pace = saved.pace[key] && saved.pace[key].p ? saved.pace[key] : START[mode.kind];
    r = {
      kind: mode.kind,
      stats: mode.stats,
      key,
      weakOnly,
      name,
      course: modeId === 'course' ? { level, unit } : null,
      queue: deck.map((item) => ({ item, falls: 0 })),
      total: deck.length,
      cleared: 0,
      skipped: 0,
      clean: 0,
      falls: 0,
      hints: 0,
      keysRight: 0,
      keysTotal: 0,
      time: 0,
      active: 0,
      rt: pace.r,
      p: pace.p,
      cards: [],
      fall: null,
      endIn: null,
      missed: new Map(),
      hintModes: new Set(),
      rock: 0,
      target: null,
      spokenAt: -9,
      pendingSpeak: null,
      widest: 70,
      maxLen: Math.max(...deck.map((it) => it.len)),
      errors: 0,
    };
    hush();
    setPhase('play');
    resize();
    if (modeId === 'course' && saved.sound) loadSound(level, unit);
    setStatus('', '');
    hud();
  }

  // The round's time budget T: what the longest prompt needs at the measured pace (counted at
  // no more than 2 keys a second), with room to spare; the world speed follows from it.
  function setSpeed() {
    const T = Math.max(6, Math.min(40, 1.4 * (r.rt + r.maxLen / Math.min(r.p, 2))));
    const run = view.W - 8 - (view.yx + REACH) - r.widest;
    r.T = T;
    r.speed = Math.max(12, run / T);
  }

  // The distance in front of a new card, from the left edge of the one before it: the time
  // the one before it needs, plus the slack, at the world speed; never overlapping.
  function spacing(prev) {
    return Math.max(prev.w + 30, r.speed * SLACK * (r.rt + prev.item.len / r.p));
  }

  function makeCard(entry, x) {
    const card = {
      entry, item: entry.item, x, w: cardWidth(entry.item), state: 'live', typed: '',
      missedAt: new Set(), misses: 0, idle: 0, level: 0, hinted: false,
      shownAt: null, firstKeyAt: null, stampT: 0, flashT: 0, halted: false,
    };
    r.cards.push(card);
    return card;
  }

  // ---------- measuring text ----------

  const UI = "'M PLUS Rounded 1c', 'Hiragino Maru Gothic ProN', 'Yu Gothic', sans-serif";
  const JP = "'Klee One', 'Hiragino Mincho ProN', 'Yu Mincho', serif";
  const canvas = $('stage');
  const ctx = canvas.getContext('2d');
  const widths = new Map();

  function fontsFor(deck) {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    const text = deck.map((it) => it.text + (it.reading || '')).join('');
    const wait = Promise.all([
      document.fonts.load('600 26px "Klee One"', text),
      document.fonts.load('800 20px "M PLUS Rounded 1c"', 'abc済'),
    ]).catch(() => {});
    return Promise.race([wait, new Promise((res) => setTimeout(res, 1500))]).then(() => widths.clear());
  }

  // The widest a card may be: it must fit, whole, between Yaoki and the right edge, so it can
  // come fully into view before it reaches him.
  const maxCard = () => Math.max(70, view.W - 8 - (view.yx + REACH) - 30);

  // A type size that fits `text` in `room`: the given size, or smaller for long text.
  function fit(text, size, room, least) {
    ctx.save();
    ctx.font = '600 ' + size + 'px ' + JP;
    const w = ctx.measureText(text).width;
    ctx.restore();
    return w > room ? Math.max(least, Math.floor(size * room / w)) : size;
  }

  // The prompt's type size: smaller for long prompts (not under 14 while it fits), and never
  // wider than a card may be.
  function promptSize(item) {
    if (item.kind !== 'romaji') return 32;
    const n = Array.from(item.text).length;
    const size = n <= 4 ? 30 : n <= 8 ? 26 : n <= 14 ? 22 : 19;
    const nice = fit(item.text, size, Math.max(160, 0.45 * (view.W - view.yx)) - 28, Math.max(14, 10 / view.s));
    return fit(item.text, nice, maxCard() - 28, 8);
  }
  // Small type (readings, the lines under the route): at least about 9 CSS pixels.
  const small = (size) => Math.max(size, 9 / view.s);
  function readingSize(item) {
    return fit(item.reading, Math.min(16, small(12)), maxCard() - 28, 8);
  }

  function cardWidth(item) {
    if (item.kind !== 'romaji') return 70;
    const key = item.id + '@' + Math.round(view.W);
    if (widths.has(key)) return widths.get(key);
    ctx.save();
    ctx.font = '600 ' + promptSize(item) + 'px ' + JP;
    let w = ctx.measureText(item.text).width;
    if (item.reading && item.reading !== item.text) {
      ctx.font = '600 ' + readingSize(item) + 'px ' + JP;
      w = Math.max(w, ctx.measureText(item.reading).width);
    }
    ctx.restore();
    const out = Math.min(maxCard(), Math.max(70, Math.ceil(w) + 28));
    widths.set(key, out);
    return out;
  }

  // ---------- the round, frame by frame ----------

  // A card is in play once it is fully in view.
  const inView = (c) => c.x + c.w <= view.W - 8;

  // The card being typed: the first one not yet cleared, once it is in view.
  function targetCard() {
    if (!r || r.fall) return null;
    const c = r.cards.find((x) => x.state === 'live');
    return c && (c.halted || inView(c)) ? c : null;
  }

  function update(dt) {
    r.time += dt;
    for (const c of r.cards) {
      if (c.state === 'done') c.stampT += dt;
      if (c.flashT > 0) c.flashT = Math.max(0, c.flashT - dt);
    }

    if (r.endIn !== null) {
      r.endIn -= dt;
      if (r.endIn <= 0) {
        finishRound();
        return;
      }
    }

    // A fall stops the world while Yaoki gets back up.
    if (r.fall) {
      r.fall.t += dt;
      if (r.fall.t >= r.fall.length) endFall();
      return;
    }

    const live = r.cards.filter((c) => c.state === 'live');
    const target = targetCard();
    const halted = !!(target && target.halted);
    const waiting = !target && (live.length > 0 || r.queue.length > 0) && r.endIn === null;
    let speed = halted ? 0 : r.speed;
    if (waiting) {
      if (reducedMotion.matches) {
        // no dash without motion: the next card is simply brought into view
        cut(live);
      } else {
        speed = Math.max(r.speed * 4, 320);
      }
    }
    if (target) r.active += dt;

    for (const c of r.cards) c.x -= speed * dt;
    r.rock += dt * Math.min(speed, 160) / 40;

    // New cards come in from the right, spaced by how long the card before them takes.
    const last = r.cards[r.cards.length - 1];
    if (r.queue.length) {
      if (!last) makeCard(r.queue.shift(), view.W + 10);
      else if (last.x + spacing(last) <= view.W + 10) makeCard(r.queue.shift(), view.W + 10);
    }

    // A live card that reaches Yaoki knocks him over, unless it has already done so twice:
    // then it stops in front of him with its spelling shown, and the world waits.
    const first = live[0];
    if (first && first.x <= view.yx + REACH) {
      if (first.entry.falls >= 2) {
        first.x = view.yx + REACH;
        if (!first.halted) {
          first.halted = true;
          first.level = 2;
          say(first.item.text, 'Take your time: the world waits for this one. Tab skips it.');
        }
      } else {
        startFall(first);
      }
    }

    r.cards = r.cards.filter((c) => c.x + c.w > -60 && c.state !== 'removed');

    // The card being typed: when it came into view, and how long it has gone without a key.
    const t = targetCard();
    if (t) {
      if (t.shownAt === null) t.shownAt = r.time;
      if (t !== r.target) {
        r.target = t;
        speakTarget(t);
        showInfo(t);
      } else if (r.pendingSpeak === t) {
        speakTarget(t);
      }
      t.idle += dt;
      raiseHint(t);
    } else if (r.target && !r.fall) {
      r.target = null;
      showInfo(null);
    }
  }

  // Without motion there is no dash: the world jumps so the next card is just in view.
  function cut(live) {
    const next = live[0];
    if (next) {
      const shift = next.x + next.w - (view.W - 8);
      if (shift > 0) for (const c of r.cards) c.x -= shift;
    } else if (r.queue.length) {
      const last = r.cards[r.cards.length - 1];
      const shift = last ? last.x + spacing(last) - (view.W + 10) : 0;
      if (shift > 0) for (const c of r.cards) c.x -= shift;
    }
  }

  // Hints in steps: 0 none, 1 the kana being typed (or the key's row and finger),
  // 2 the whole spelling (or the key). Always: 2. Never: 0, except after a fall.
  function raiseHint(c) {
    r.hintModes.add(saved.hints);
    if (saved.hints === 'always') {
      c.level = 2;
      return;
    }
    if (saved.hints === 'never' || c.level >= 2) return;
    const limit = c.typed || c.firstKeyAt !== null ? STUCK_NEXT : STUCK_FIRST;
    let level = Math.min(2, c.misses);
    if (c.idle >= limit) level = Math.max(level, c.level + 1);
    if (level > c.level) {
      c.level = level;
      c.idle = 0;
      if (!c.hinted) {
        c.hinted = true;
        r.hints++;
      }
    }
  }

  function hintLevel(c) {
    if (c.state === 'fallen' || c.halted) return 2;
    return c.level;
  }

  // A fallen card goes back into the deck to come round again after about three other cards
  // (the cards already on the route come first, so it can be more), and the number is said.
  function startFall(card) {
    card.state = 'fallen';
    card.entry.falls++;
    const length = Math.min(3, 1.2 + 0.05 * card.item.len);
    const ahead = r.cards.filter((c) => c.state === 'live' && c !== card).length;
    const promised = r.queue.reduce((last, e, i) => (e.falls > 0 ? i : last), -1);
    const at = Math.max(promised + 1, Math.min(2 - ahead, r.queue.length));
    r.fall = { t: 0, card, length, at, back: ahead + at };
    r.falls++;
    r.p = Math.max(0.5, r.p * 0.8);
    r.target = null;
    noteMiss(card);
    applyStats(card);
    const answer = card.item.kind === 'romaji' ? E.spell(card.item.tokens) : keyName(card.item);
    say(card.item.text, 'Yaoki fell over and got up. It is ' + answer + '. ' + backText(r.fall.back) + '.');
    showInfo(card);
    hud();
  }
  const backText = (n) => (n === 0 ? 'Back next' : 'Back after ' + n + (n === 1 ? ' card' : ' cards'));

  // After a fall the cards still to come are pushed back, so the next one arrives no sooner
  // than it would after a fresh start.
  function endFall() {
    const card = r.fall.card;
    r.cards = r.cards.filter((c) => c !== card);
    r.queue.splice(Math.min(r.fall.at, r.queue.length), 0, card.entry);
    r.fall = null;
    const live = r.cards.filter((c) => c.state === 'live');
    if (live.length) {
      const min = view.yx + REACH + r.speed * SLACK * (r.rt + live[0].item.len / r.p);
      const shift = min - live[0].x;
      if (shift > 0) for (const c of r.cards) if (c.state === 'live') c.x += shift;
    }
  }

  // The kana (or key) a miss belongs to, kept for the round's weak spots.
  function noteMiss(card, pressed) {
    const it = card.item;
    let key;
    if (it.kind === 'romaji') {
      const at = pressed ? E.blame(it.tokens, card.typed, pressed) : E.unitAt(it.tokens, card.typed);
      const i = at === null ? it.units.length - 1 : at;
      card.missedAt.add(i);
      key = it.units[i];
    } else {
      key = statKey(it);
    }
    r.missed.set(key, (r.missed.get(key) || 0) + 1);
  }

  // A card is over (cleared or fallen): its missed kana or key go on the weak list, and the
  // ones typed cleanly count towards coming off it. Nothing counts as clean that was not
  // typed (the rest of a fallen card) or was typed with the whole spelling on show.
  function applyStats(card) {
    const it = card.item;
    const shown = card.state === 'fallen' || card.halted || card.level >= 2;
    if (it.kind === 'romaji') {
      let reached = it.units.length;
      if (card.state === 'fallen') {
        const at = E.unitAt(it.tokens, card.typed);
        reached = Math.min(at === null ? 0 : at, ...card.missedAt);
      }
      it.units.forEach((u, i) => {
        if (card.missedAt.has(i)) markMiss(r.stats, u);
        else if (card.state === 'fallen' ? i < reached && card.level < 2 && !card.halted : !shown) markOk(r.stats, u);
      });
    } else if (card.misses || card.state === 'fallen') {
      markMiss(r.stats, statKey(it));
    } else if (!shown) {
      markOk(r.stats, statKey(it));
    }
  }

  // Quitting keeps the misses already made on the cards still out, and saves.
  function keepMisses() {
    for (const c of r.cards) {
      if (c.state !== 'live' || !c.misses) continue;
      if (c.item.kind === 'romaji') for (const i of c.missedAt) markMiss(r.stats, c.item.units[i]);
      else markMiss(r.stats, statKey(c.item));
    }
    save();
  }

  // The player's reaction and typing rate, as moving averages over the cards they type.
  function measure(card) {
    const a = 0.3;
    if (card.shownAt !== null && card.firstKeyAt !== null) {
      const react = Math.max(0.2, Math.min(8, card.firstKeyAt - card.shownAt));
      r.rt = r.rt * (1 - a) + react * a;
    }
    const span = r.time - (card.firstKeyAt === null ? r.time : card.firstKeyAt);
    if (card.item.len > 1 && span > 0.05) {
      const rate = Math.max(0.5, Math.min(12, (card.item.len - 1) / span));
      r.p = r.p * (1 - a) + rate * a;
    }
  }

  function clearCard(card) {
    card.state = 'done';
    card.stampT = 0;
    r.cleared++;
    if (!card.misses && !card.hinted && !card.entry.falls) r.clean++;
    measure(card);
    applyStats(card);
    if (card.item.clip && saved.sound && window.ykSound && window.ykSound.has(card.item.clip)) window.ykSound.play(card.item.clip);
    if (r.cleared + r.skipped >= r.total) r.endIn = 0.8;
    setStatus('', '');
    hud();
  }

  // A card that waits for Yaoki can be passed over with Tab (for a key this keyboard lacks).
  function skipCard(card) {
    if (card.misses) {
      if (card.item.kind === 'romaji') for (const i of card.missedAt) markMiss(r.stats, card.item.units[i]);
      else markMiss(r.stats, statKey(card.item));
    }
    r.cards = r.cards.filter((c) => c !== card);
    r.skipped++;
    r.target = null;
    setStatus('', '');
    if (r.cleared + r.skipped >= r.total) r.endIn = 0.8;
    hud();
  }

  function finishRound() {
    saved.pace[r.key] = { r: Math.round(r.rt * 100) / 100, p: Math.round(r.p * 100) / 100 };
    const kpm = r.active > 0.2 ? Math.round(r.keysRight / (r.active / 60)) : 0;
    // A round counts for the best only if hints were never always on during it.
    const counts = !r.hintModes.has('always') && !r.weakOnly;
    const prev = saved.best[r.key];
    const isBest = counts && kpm > 0 && (!prev || kpm > prev);
    if (isBest) saved.best[r.key] = kpm;
    save();
    showResult(kpm, isBest, prev, counts);
    setPhase('result');
  }

  // ---------- input ----------

  let sawKeyboard = false;

  function onKeyDown(e) {
    if (!sawKeyboard && e.key && e.key.length === 1) {
      sawKeyboard = true;
      $('touch-note').hidden = true;
      showKeyboard();
    }
    // A held Escape or Enter does nothing more than its first press did.
    if (e.repeat && (e.key === 'Escape' || e.key === 'Enter')) {
      e.preventDefault();
      return;
    }
    // The settings sheet is modal: Escape closes it, and no key reaches the game behind it.
    if (!$('settings-sheet').hidden) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeSettings();
      }
      return;
    }
    if (window.ykSound && phase === 'play') window.ykSound.unlock();
    if (phase === 'menu') {
      if (e.key === 'Enter' && !e.target.closest('button, a, input, .scrim')) {
        e.preventDefault();
        startRound(false);
      }
      return;
    }
    if (phase === 'result') {
      if (e.key === 'Escape') {
        e.preventDefault();
        toMenu();
      } else if (e.key === 'Enter' && !e.target.closest('button, a, input')) {
        e.preventDefault();
        again();
      }
      return;
    }
    if (phase === 'paused') {
      if (e.key === 'Escape' || (e.key === 'Enter' && !e.target.closest('button'))) {
        e.preventDefault();
        setPhase('play');
      }
      return;
    }
    if (phase !== 'play' || !r) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      setPhase('paused');
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Tab') {
      e.preventDefault();
      const t = targetCard();
      if (t && t.halted) skipCard(t);
      return;
    }

    if (r.kind === 'keys') {
      if (!KEYDEF[e.code] || /^(Shift|Control|Alt|Meta|CapsLock|Tab|Enter|Backspace|Space|Backquote|NonConvert|Convert|KanaMode)/.test(e.code)) return;
      e.preventDefault();
      if (!e.repeat) pressKana(e);
      return;
    }
    if (e.isComposing || e.keyCode === 229 || e.key === 'Process') {
      setStatus(ja('英数にしてください。') + '　Keys are not reaching the game: switch the input to ' + ja('英数') + ' (direct input).', 'warn', true);
      say('英数', 'Keys are not reaching the game. Switch the input to direct input.');
      return;
    }
    if (e.key === 'Backspace') {
      e.preventDefault();
      const t = targetCard();
      if (t && r.kind === 'romaji' && t.typed) t.typed = t.typed.slice(0, -1);
      return;
    }
    if (e.key === ' ') {
      e.preventDefault();
      return;
    }
    if (e.key.length !== 1) return;
    e.preventDefault();
    if (e.repeat) return;
    if (r.kind === 'romaji') pressRomaji(e);
    else pressSymbol(e);
  }

  function pressRomaji(e) {
    const t = targetCard();
    if (!t) return;
    const c = e.key;
    if (/^[A-Z]$/.test(c)) {
      setStatus('Caps Lock or Shift is on. Romaji is typed in lower case.', 'warn');
      say('', 'Caps Lock or Shift is on. Romaji is typed in lower case.');
      return;
    }
    r.keysTotal++;
    const typed = t.typed + c;
    if (!E.matchPrefix(t.item.tokens, typed)) {
      const note = saved.hints === 'never' ? '' : E.why(t.item.tokens, t.typed, c) || '';
      miss(t, e.code, jaMarked(note), c);
      return;
    }
    progress(t, e.code);
    t.typed = typed;
    if (E.isComplete(t.item.tokens, typed)) clearCard(t);
  }

  function pressSymbol(e) {
    const t = targetCard();
    if (!t) return;
    r.keysTotal++;
    if (e.key !== t.item.key) {
      miss(t, e.code, '');
      return;
    }
    progress(t, e.code);
    clearCard(t);
  }

  function pressKana(e) {
    const t = targetCard();
    if (!t) return;
    r.keysTotal++;
    if (e.code !== t.item.code || e.shiftKey !== t.item.shift) {
      const note = e.code === t.item.code && saved.hints !== 'never' ? (t.item.shift ? 'This one needs Shift.' : 'This one is typed without Shift.') : '';
      miss(t, e.code, note);
      return;
    }
    progress(t, e.code);
    clearCard(t);
  }

  function progress(card, code) {
    if (card.firstKeyAt === null) card.firstKeyAt = r.time;
    card.idle = 0;
    r.keysRight++;
    flashKey(code, 'ok');
  }

  function miss(card, code, note, pressed) {
    card.misses++;
    card.flashT = 0.3;
    noteMiss(card, pressed);
    raiseHint(card);
    flashKey(code, 'miss');
    setStatus(note, 'bad', true);
  }

  // もう一度: the same kind of round again (a normal one if no weak spots are left).
  function again() {
    startRound(!!(r && r.weakOnly && weakItems().length));
  }

  // "Shift + 2", "Q": the key as printed on a JIS keyboard.
  function keyName(item) {
    const def = KEYDEF[item.code];
    return (item.shift ? 'Shift + ' : '') + (def ? def.main : item.code);
  }

  // The first step of a key hint: the row and the finger, not the key itself.
  const ROW_JA = { number: '数字の段', top: '上の段', home: 'ホームの段', bottom: '下の段' };
  function keyArea(item) {
    const f = E.fingerFor(item.code);
    return ROW_JA[E.rowOf(item.code)] + (f ? ' · ' + f[0] : '') + (item.shift ? ' · Shift' : '');
  }

  // ---------- screens ----------

  function setPhase(p) {
    const was = phase;
    phase = p;
    $('menu').hidden = p !== 'menu';
    $('play').hidden = !(p === 'play' || p === 'paused');
    $('result').hidden = p !== 'result';
    $('pause-sheet').hidden = p !== 'paused' || !$('settings-sheet').hidden;
    $('app').inert = p === 'paused' || !$('settings-sheet').hidden;
    document.body.classList.toggle('playing', p === 'play' || p === 'paused');
    if (p === 'menu') {
      r = null;
      hush();
      renderMenu();
    }
    if (p === 'paused') $('resume').focus();
    if (p === 'play') {
      if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
      if (was === 'paused' && r) {
        r.spokenAt = -9;
        r.target = null;
      }
    }
    if (p === 'result') $('res-title').focus();
    lastKeysSig = '';
  }

  // The line under the game; `html` when the text is markup (with its Japanese marked).
  function setStatus(text, tone, html) {
    const s = $('status');
    if (html) s.innerHTML = text;
    else s.textContent = text;
    s.className = 'status' + (tone ? ' ' + tone : '');
  }

  // The screen reader hears each card (word and reading only, at most one every 2 seconds:
  // a card that comes sooner is said when the 2 seconds are up), each fall with its answer,
  // and the result. The Japanese part is marked as Japanese, so it is read in a Japanese voice.
  let sayTimer = 0;
  function say(jaText, enText) {
    const el = $('sr-prompt');
    el.textContent = '';
    clearTimeout(sayTimer);
    sayTimer = setTimeout(() => {
      el.innerHTML = (jaText ? ja(jaText) : '') + (enText ? (jaText ? '. ' : '') + esc(enText) : '');
    }, 30);
  }
  function hush() {
    clearTimeout(sayTimer);
    $('sr-prompt').textContent = '';
  }
  function speakTarget(card) {
    if (r.time - r.spokenAt < 2) {
      r.pendingSpeak = card;
      return;
    }
    r.pendingSpeak = null;
    r.spokenAt = r.time;
    const it = card.item;
    say(it.reading && it.reading !== it.text ? it.text + '、' + it.reading : it.text, '');
  }

  // The line under the canvas: the word being typed, its reading and meaning.
  function showInfo(card) {
    const box = $('info');
    box.textContent = '';
    if (!card) return;
    const it = card.item;
    if (it.kind !== 'romaji' || (!it.gloss && !it.reading)) return;
    const ja = document.createElement('span');
    ja.lang = 'ja';
    ja.className = 'info-ja';
    ja.textContent = it.reading && it.reading !== it.text ? it.text + '　' + it.reading : it.text;
    box.appendChild(ja);
    if (it.gloss) {
      const en = document.createElement('span');
      en.textContent = it.gloss;
      box.appendChild(en);
    }
  }

  const fmt = (sec) => {
    const s = Math.max(0, Math.round(sec));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  };

  // The progress bar: one segment per card (a plain bar for long rounds), as in the app.
  function hud() {
    if (!r) return;
    const bar = $('progress');
    if (bar.dataset.total !== String(r.total)) {
      bar.dataset.total = r.total;
      bar.textContent = '';
      bar.className = r.total > 20 ? 'track' : 'segs' + (r.total > 6 ? ' many' : '');
      const n = r.total > 20 ? 1 : r.total;
      for (let i = 0; i < n; i++) bar.appendChild(document.createElement('i'));
    }
    const passed = r.cleared + r.skipped;
    if (r.total > 20) bar.firstElementChild.style.width = (100 * passed / r.total) + '%';
    else [...bar.children].forEach((seg, i) => {
      seg.className = i < r.cleared ? 'done' : i < passed ? 'skip' : i === passed ? 'now' : '';
    });
    bar.setAttribute('aria-label', 'Card ' + Math.min(passed + 1, r.total) + ' of ' + r.total);
    $('hud-falls').textContent = r.falls;
    $('hud-time').textContent = fmt(r.time);
  }

  function showResult(kpm, isBest, prev, counts) {
    $('res-kicker').innerHTML = ja('結果') + '　RESULT · ' + r.name;
    $('res-clean').textContent = r.clean;
    $('res-clean-total').textContent = '/ ' + r.total;
    $('res-line').textContent = fmt(r.time) + ' · ' + kpm + ' right keys a minute' + (r.skipped ? ' · ' + r.skipped + ' skipped' : '');
    $('res-keys').innerHTML = r.keysRight + ' <small>/ ' + r.keysTotal + '</small>';
    $('res-falls').textContent = r.falls;
    $('res-falls-en').textContent = !r.falls ? 'falls: Yaoki stayed up all round'
      : r.skipped && r.falls > 2 * r.skipped ? 'falls; ' + r.skipped + ' skipped with Tab, the others came back and were cleared'
        : r.skipped ? 'falls, all on the ' + (r.skipped === 1 ? 'card' : r.skipped + ' cards') + ' skipped with Tab'
          : 'falls; each card came back and was cleared';
    const modes = r.hintModes;
    const onlyAlways = modes.size === 1 && modes.has('always');
    $('res-hints').textContent = onlyAlways ? '—' : r.hints;
    $('res-hints-en').textContent = onlyAlways ? 'hints were on for every card'
      : modes.has('always') ? 'cards where a hint showed; hints were always on for part of the round'
        : modes.size === 1 && modes.has('never') ? 'hints were off' : 'cards where a hint showed';

    // The teacher's stamp, by the share of clean cards, as for the app's week tests.
    const share = r.clean / r.total;
    const tier = share >= 0.8 ? 0 : share >= 0.6 ? 1 : 2;
    const stamp = $('res-stamp');
    stamp.className = 'hanko' + (tier === 0 ? ' three' : '');
    $('res-stamp-text').innerHTML = ['たいへん<br>よく<br>できました', 'よく<br>できました', 'がんばり<br>ましょう'][tier];
    stamp.setAttribute('aria-label', ['Stamp: excellent', 'Stamp: well done', 'Stamp: keep at it'][tier]);
    stamp.style.animation = 'none';
    void stamp.offsetWidth;
    stamp.style.animation = '';

    $('res-best').hidden = !isBest && !prev;
    $('res-best').firstElementChild.hidden = !isBest;
    if (isBest) $('res-best-text').textContent = 'New best on this stage: ' + kpm + ' right keys a minute.';
    else if (prev) $('res-best-text').textContent = 'Best on this stage: ' + prev + ' right keys a minute.' + (counts ? '' : ' (Rounds with hints always on, and weak-spot rounds, are not counted.)');

    const weak = [...r.missed.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    $('res-weak-box').hidden = !weak.length;
    const box = $('res-weak');
    box.textContent = '';
    for (const [key, n] of weak) {
      const chip = document.createElement('span');
      const shifted = key.length > 1 && key.endsWith('+');
      const label = shifted ? key.slice(0, -1) + ' (Shift)' : key;
      if (/[぀-ヿ]/.test(label)) chip.lang = 'ja';
      chip.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9 6.6 19.8l1.1-6.1L3.2 9.4l6.1-.8z" fill="#F2B43A" stroke="#1B2440" stroke-width="1.8" stroke-linejoin="round"/></svg>';
      chip.appendChild(document.createTextNode(label + (n > 1 ? ' ×' + n : '')));
      box.appendChild(chip);
    }
    $('again-weak').hidden = !weakItems().length;
    say('結果', 'Round over. ' + r.clean + ' of ' + r.total + ' cards clean. ' + ['Stamp: excellent.', 'Stamp: well done.', 'Stamp: keep at it.'][tier]);
  }

  // ---------- the menu ----------

  function seg(container, options, current, onPick) {
    const box = $(container);
    box.textContent = '';
    for (const o of options) {
      const b = document.createElement('button');
      b.type = 'button';
      if (o.cls) b.className = o.cls;
      b.innerHTML = o.html;
      b.setAttribute('aria-pressed', String(o.value === current));
      b.addEventListener('click', () => {
        for (const x of box.children) x.setAttribute('aria-pressed', String(x === b));
        onPick(o.value);
      });
      box.appendChild(b);
    }
  }

  function renderMenu() {
    seg('modes', MODE_ORDER.map((id) => ({ value: id, html: '<span lang="ja">' + MODES[id].ja + '</span>　<small>' + MODES[id].en + '</small>' })), saved.mode, (id) => {
      saved.mode = id;
      save();
      renderPicks();
      setKeyLabels();
    });
    seg('len-seg', [[10, 'かるく', 'Light'], [20, 'ふつう', 'Regular'], [40, 'しっかり', 'Solid']].map(([n, jaText, en]) => ({
      value: n, cls: 'tile', html: '<b>' + n + '<small lang="ja">枚</small></b><small><span lang="ja">' + jaText + '</span>　' + en + '</small>',
    })), saved.len, (v) => {
      saved.len = v;
      save();
    });
    $('touch-note').hidden = !touchOnly.matches || sawKeyboard;
    renderPicks();
  }

  function renderSettings() {
    seg('hint-seg', [
      { value: 'always', html: '<span lang="ja">いつも</span>　<small>Always</small>' },
      { value: 'stuck', html: '<span lang="ja">困ったら</span>　<small>When stuck</small>' },
      { value: 'never', html: '<span lang="ja">なし</span>　<small>Never</small>' },
    ], saved.hints, (v) => {
      saved.hints = v;
      save();
    });
    $('opt-kb').checked = saved.kb;
    $('opt-sound').checked = saved.sound;
  }

  // The stage list, or the level and week list for course words, and the start buttons.
  function renderPicks() {
    const mode = saved.mode;
    $('mode-desc').textContent = MODES[mode].desc;
    $('course-pick').hidden = mode !== 'course';
    $('stage-pick').hidden = mode === 'course';
    const note = $('layout-note');
    note.hidden = !(layout.jis === false && (mode === 'symbol' || mode === 'keys'));
    note.innerHTML = '<b lang="ja">JIS配列用</b>　This practice follows a Japanese (JIS) keyboard. Your keyboard is set to another layout, so some keys will not be where the picture shows them. A card for a key you do not have waits in front of Yaoki; Tab skips it.';
    if (mode === 'course') renderCourse();
    else renderStages();
    refreshStart();
  }

  function option(o) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'option';
    b.setAttribute('aria-pressed', String(!!o.on));
    if (o.disabled) b.disabled = true;
    b.innerHTML = '<span class="o-top"><span class="o-kick"></span></span><span class="o-ja" lang="ja"></span><span class="o-en"></span><span class="o-meta"></span>';
    b.querySelector('.o-kick').innerHTML = o.kick || '';
    b.querySelector('.o-ja').textContent = o.ja;
    b.querySelector('.o-en').textContent = o.en;
    b.querySelector('.o-meta').innerHTML = o.meta || '';
    if (o.tag) {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.innerHTML = o.tag;
      b.querySelector('.o-top').appendChild(tag);
    }
    return b;
  }

  function pickIn(box, b) {
    for (const x of box.children) x.setAttribute('aria-pressed', String(x === b));
  }

  function renderStages() {
    const box = $('stages');
    box.textContent = '';
    const cur = currentStage();
    for (const st of STAGES[saved.mode]) {
      const key = saved.mode + ':' + st.id;
      const best = saved.best[key];
      const b = option({
        ja: st.ja, en: st.en,
        meta: st.items.length + (saved.mode === 'romaji' ? ' prompts' : ' keys') + (best ? ' · ' + ja('自己ベスト') + ' ' + best + ' keys/min' : ''),
        on: st === cur,
      });
      b.addEventListener('click', () => {
        saved.stage[saved.mode] = st.id;
        save();
        pickIn(box, b);
        refreshStart();
      });
      box.appendChild(b);
    }
  }

  function renderCourse() {
    seg('levels', LEVELS.map((lv) => ({ value: lv, html: lv })), saved.level, (lv) => {
      saved.level = lv;
      save();
      renderCourse();
      refreshStart();
    });
    const box = $('units');
    const level = saved.level;
    box.textContent = '';
    $('course-note').textContent = '';
    if (!courses[level]) {
      $('course-note').innerHTML = ja('読み込み中') + '　Loading the ' + level + ' words…';
      loadCourse(level).then(() => {
        if (saved.mode === 'course' && saved.level === level && phase === 'menu') {
          renderCourse();
          refreshStart();
        }
      }, () => {
        if (saved.level === level) $('course-note').textContent = 'The ' + level + ' words could not be loaded. They come from the Yaoki app (../assets/), so open this page from the same site, online or with the app stored for offline use.';
      });
      return;
    }
    const units = courses[level];
    const written = units.filter((u) => u.words.length);
    if (!written.some((u) => u.n === saved.unit[level])) {
      const mine = place && place.level === level && written.find((u) => u.n === place.unit);
      saved.unit[level] = (mine || written[0] || {}).n;
    }
    for (const u of units) {
      const mine = place && place.level === level && place.unit === u.n;
      const best = saved.best['course:' + level + 'u' + u.n];
      const b = option({
        kick: ja('第' + u.n + '週') + ' · Week ' + u.n + ' of ' + units.length,
        ja: u.ja,
        en: u.en,
        meta: u.words.length ? u.words.length + ' words' + (best ? ' · ' + ja('自己ベスト') + ' ' + best + ' keys/min' : '') : ja('準備中') + '　Not written yet',
        on: u.n === saved.unit[level] && u.words.length > 0,
        disabled: !u.words.length,
        tag: mine ? ja('今') + '　NOW' : '',
      });
      b.addEventListener('click', () => {
        saved.unit[level] = u.n;
        save();
        pickIn(box, b);
        refreshStart();
      });
      box.appendChild(b);
    }
    if (place && place.level === level) $('course-note').innerHTML = ja('今') + ' marks the week you are on in the Yaoki app.';
  }

  function weakItems() {
    const items = currentItems();
    if (!items) return [];
    const stats = bucket(MODES[saved.mode].stats);
    return items.filter((it) => weakness(it, stats) > 0);
  }

  function refreshStart() {
    const ready = !!currentItems();
    $('start').disabled = !ready;
    const n = ready ? weakItems().length : 0;
    $('start-weak').hidden = !n;
    $('start-weak').innerHTML = ja('苦手を練習') + '　Weak spots (' + n + ')';
  }

  // ---------- the keyboard ----------

  const k = (code, main, sub = '', w = 1, mod = false) => ({ code, main, sub, w, mod });
  const letters = (s) => s.split('').map((l) => k('Key' + l, l));
  const KEY_ROWS = [
    [k('Backquote', '半/全', '', 1, true), k('Digit1', '1', '!'), k('Digit2', '2', '"'), k('Digit3', '3', '#'),
      k('Digit4', '4', '$'), k('Digit5', '5', '%'), k('Digit6', '6', '&'), k('Digit7', '7', "'"),
      k('Digit8', '8', '('), k('Digit9', '9', ')'), k('Digit0', '0'), k('Minus', '-', '='),
      k('Equal', '^', '~'), k('IntlYen', '¥', '|'), k('Backspace', 'BS', '', 1.6, true)],
    [k('Tab', 'Tab', '', 1.5, true), ...letters('QWERTYUIOP'), k('BracketLeft', '@', '`'), k('BracketRight', '[', '{'), k('Enter', 'Enter', '', 1.1, true)],
    [k('CapsLock', '英数', '', 1.8, true), ...letters('ASDFGHJKL'), k('Semicolon', ';', '+'), k('Quote', ':', '*'), k('Backslash', ']', '}')],
    [k('ShiftLeft', 'Shift', '', 2.3, true), ...letters('ZXCVBNM'), k('Comma', ',', '<'), k('Period', '.', '>'),
      k('Slash', '/', '?'), k('IntlRo', '\\', '_'), k('ShiftRight', 'Shift', '', 2, true)],
    [k('ControlLeft', 'Ctrl', '', 1.5, true), k('NonConvert', '無変換', '', 1.5, true), k('Space', '', '', 5, true), k('Convert', '変換', '', 1.5, true), k('KanaMode', 'かな', '', 1.5, true)],
  ];
  const KEYDEF = {};
  for (const row of KEY_ROWS) for (const key of row) KEYDEF[key.code] = key;
  const KANA_ON = {};
  const KANA_SHIFT_ON = {};
  for (const x of E.KANA_KEYS) KANA_ON[x.code] = x.kana;
  for (const x of E.KANA_SHIFT_KEYS) KANA_SHIFT_ON[x.code] = x.kana;

  const keyEls = new Map();
  function buildKeyboard() {
    const kb = $('kb');
    for (const row of KEY_ROWS) {
      const line = document.createElement('div');
      line.className = 'kb-row';
      for (const key of row) {
        const el = document.createElement('div');
        el.className = 'key' + (key.mod ? ' mod' : '') + (key.code === 'KeyF' || key.code === 'KeyJ' ? ' bump' : '');
        el.dataset.code = key.code;
        el.style.flexGrow = key.w;
        el.innerHTML = '<span class="sub"></span><span class="main"></span>';
        line.appendChild(el);
        keyEls.set(key.code, el);
      }
      kb.appendChild(line);
    }
    setKeyLabels();
  }

  // Kana input shows each key's kana (its Shift kana small); the other modes show the
  // characters typed in direct input (the Shift character small).
  function setKeyLabels() {
    const kana = saved.mode === 'keys';
    for (const [code, el] of keyEls) {
      const def = KEYDEF[code];
      const main = el.querySelector('.main');
      const sub = el.querySelector('.sub');
      if (kana && KANA_ON[code]) {
        main.textContent = KANA_ON[code];
        main.lang = 'ja';
        sub.textContent = KANA_SHIFT_ON[code] || def.main;
        if (KANA_SHIFT_ON[code]) sub.lang = 'ja';
        else sub.removeAttribute('lang');
      } else {
        main.textContent = def.main;
        main.removeAttribute('lang');
        sub.textContent = def.sub;
        sub.removeAttribute('lang');
      }
    }
  }

  const flashTimers = new WeakMap();
  function flashKey(code, tone) {
    const el = keyEls.get(code);
    if (!el) return;
    el.classList.remove('ok', 'miss');
    void el.offsetWidth;
    el.classList.add(tone);
    clearTimeout(flashTimers.get(el));
    flashTimers.set(el, setTimeout(() => el.classList.remove(tone), 200));
  }

  // Touch typists press Shift with the other hand: the right Shift for a key on the left.
  function shiftFor(code) {
    const f = E.fingerFor(code);
    return f && /^左/.test(f[0]) ? 'ShiftRight' : 'ShiftLeft';
  }

  // The keys to light up for the card being typed, while its hint shows.
  function nextKeys(card) {
    const out = [];
    if (!card) return out;
    const level = hintLevel(card);
    if (card.item.kind === 'romaji') {
      if (level < 1) return out;
      for (const ch of E.nextChars(card.item.tokens, card.typed)) {
        const key = E.keyFor(ch);
        if (key) out.push(key);
      }
    } else if (level >= 2) {
      out.push({ code: card.item.code, shift: card.item.shift });
    }
    return out;
  }

  let lastKeysSig = '';
  function refreshKeys() {
    const card = phase === 'play' && r && !r.fall ? targetCard() : null;
    const keys = nextKeys(card);
    const codes = new Set(keys.map((x) => x.code));
    for (const x of keys) if (x.shift) codes.add(shiftFor(x.code));
    const sig = [...codes].sort().join(',');
    if (sig === lastKeysSig) return;
    lastKeysSig = sig;
    for (const [code, el] of keyEls) el.classList.toggle('next', codes.has(code));
    const line = $('next-line');
    line.textContent = '';
    if (!keys.length) return;
    const first = keys[0];
    const cap = (code) => (KEYDEF[code] ? KEYDEF[code].main : code);
    const kick = document.createElement('span');
    kick.className = 'kicker';
    kick.textContent = '次　NEXT · ' + (first.shift ? 'Shift + ' : '') + cap(first.code) + (keys.length > 1 ? ' (or ' + keys.slice(1).map((x) => cap(x.code)).join(', ') + ')' : '');
    line.appendChild(kick);
    const f = E.fingerFor(first.code);
    if (f) {
      const span = document.createElement('span');
      let text = f[0] + '　' + f[1].charAt(0).toUpperCase() + f[1].slice(1);
      if (first.shift) {
        const sf = E.fingerFor(shiftFor(first.code));
        if (sf) text += ' · Shift: ' + sf[0];
      }
      span.textContent = text;
      line.appendChild(span);
    }
  }

  function showKeyboard() {
    const show = saved.kb && (!touchOnly.matches || sawKeyboard);
    document.body.classList.toggle('no-kb', !show);
    $('kb').hidden = !show;
    $('next-line').hidden = !show;
  }

  // ---------- drawing ----------

  function palette() {
    const css = getComputedStyle(document.documentElement);
    const v = (name) => css.getPropertyValue(name).trim();
    return {
      ground: v('--ground'), card: v('--card'), ink: v('--ink'), muted: v('--muted'), line: v('--line'),
      lineStrong: v('--line-strong'), outline: v('--outline'), hard: v('--hard'), accentInk: v('--accent-ink'),
      good: v('--good'), bad: v('--bad'), badSoft: v('--bad-soft'), stamp: v('--stamp'), daruma: v('--daruma'), grid: v('--grid'),
    };
  }

  // Yaoki, from the drawing the app uses (Main.dc.html): one eye painted, in every pose.
  const DARUMA = {
    body: new Path2D('M50 6c26 0 40 20 40 46 0 24-16 42-40 42S10 76 10 52C10 26 24 6 50 6z'),
    brows: new Path2D('M28 30c6-5 14-5 19 0M53 30c5-5 13-5 19 0'),
    mouth: new Path2D('M44 55c4 3 8 3 12 0'),
    gold: new Path2D('M38 74h24M42 82h16'),
  };

  function resize() {
    const wrap = canvas.parentElement;
    const cw = wrap.clientWidth;
    const ch = wrap.clientHeight;
    if (!cw || !ch) return;
    const dpr = window.devicePixelRatio || 1;
    // Scaled by the height, but never so large that the route gets too short to type on.
    const s = Math.max(0.5, Math.min(1.6, ch / H, cw / 520));
    const W = cw / s;
    const oldYx = view.yx;
    view = { W, s, oy: (ch - H * s) / 2, dpr, yx: Math.max(100, W - 1000) };
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    if (r) {
      // keep each card the same time away from Yaoki at the new width and speed
      const oldSpeed = r.speed;
      widths.clear();
      r.widest = Math.max(70, ...r.cards.map((c) => cardWidth(c.item)), ...r.queue.map((e) => cardWidth(e.item)));
      setSpeed();
      let prev = null;
      for (const c of r.cards) {
        c.w = cardWidth(c.item);
        if (oldSpeed) c.x = view.yx + REACH + (c.x - oldYx - REACH) * (r.speed / oldSpeed);
        if (c.state !== 'live') continue;
        if (prev) c.x = Math.max(c.x, prev.x + prev.w + 30);
        prev = c;
      }
    }
  }

  function draw() {
    const { W, s, oy, dpr } = view;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = pal.ground;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr * s, 0, 0, dpr * s, 0, dpr * oy);
    drawPaper(W, oy / s);
    if (!r) return;
    const target = targetCard();
    for (const c of r.cards) if (c.state === 'done') drawCard(c, false);
    drawYaoki();
    for (const c of r.cards) if (c.state !== 'done') drawCard(c, c === target);
    const under = r.fall ? r.fall.card : target;
    if (under) drawUnder(under, W);
  }

  // Graph paper and the route: dotted ahead of Yaoki, traced red behind him (the app's map).
  function drawPaper(W, pad) {
    const still = reducedMotion.matches;
    const scroll = r && !still ? r.rock * 40 : 0;
    ctx.strokeStyle = pal.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = -(scroll % 26); x < W; x += 26) {
      ctx.moveTo(Math.round(x) + 0.5, -pad);
      ctx.lineTo(Math.round(x) + 0.5, H + pad);
    }
    for (let y = 8 - Math.ceil(pad / 26) * 26; y < H + pad; y += 26) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(W, y + 0.5);
    }
    ctx.stroke();

    const y = GROUND + 2;
    const yx = view.yx;
    ctx.lineCap = 'round';
    ctx.lineWidth = 5;
    ctx.strokeStyle = pal.daruma;
    ctx.beginPath();
    ctx.moveTo(-10, y);
    ctx.lineTo(yx, y);
    ctx.stroke();
    ctx.strokeStyle = pal.lineStrong;
    ctx.setLineDash([1, 12]);
    ctx.lineDashOffset = scroll % 13;
    ctx.beginPath();
    ctx.moveTo(yx + 10, y);
    ctx.lineTo(W + 10, y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function roundRect(x, y, w, h, rad) {
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }

  const ease = (t) => 1 - Math.pow(1 - t, 3);

  // A card: the one being typed has the ink outline and hard shadow of the app's "next"
  // step; the others are quiet. A cleared card gets a 済 badge, then settles onto the route
  // as a 済 node like the done days on the app's map.
  function drawCard(c, isTarget) {
    const still = reducedMotion.matches;
    const cx = c.x + c.w / 2;
    ctx.save();
    if (c.state === 'done') {
      let settle = still ? (c.stampT > 0.45 ? 1 : 0) : Math.min(1, Math.max(0, (c.stampT - 0.45) / 0.25));
      settle = Math.max(settle, Math.min(1, Math.max(0, (view.yx + 150 - c.x) / 80)));
      if (settle < 1) {
        ctx.save();
        ctx.globalAlpha = 1 - settle;
        const sc = 1 - 0.4 * ease(settle);
        ctx.translate(cx, GROUND);
        ctx.scale(sc, sc);
        ctx.translate(-cx, -GROUND);
        cardBox(c, GROUND - CARD_H, pal.card, pal.line, 2, false);
        cardText(c, GROUND - CARD_H, pal.muted);
        const pop = still ? 1 : Math.min(1, c.stampT / 0.18);
        stamp(c.x + c.w - 4, GROUND - CARD_H + 4, 12 * (0.6 + 0.4 * ease(pop)), 2);
        ctx.restore();
      }
      if (settle > 0) {
        ctx.globalAlpha = Math.min(1, settle * 1.5);
        stamp(cx, GROUND - 16, 15 * (0.7 + 0.3 * ease(settle)), 2.5, -9);
      }
      ctx.restore();
      return;
    }
    let alpha = 1;
    if (c.state === 'fallen' && r.fall) alpha = Math.max(0, Math.min(1, (r.fall.length - r.fall.t) / 0.35));
    ctx.globalAlpha = alpha;
    const top = GROUND - CARD_H;
    if (c.state === 'fallen' || c.flashT > 0) cardBox(c, top, pal.badSoft, pal.bad, 2.5, isTarget);
    else if (isTarget) cardBox(c, top, pal.card, pal.outline, 2, true);
    else cardBox(c, top, pal.card, pal.line, 2, false);
    cardText(c, top, pal.ink);
    ctx.restore();
  }

  function cardBox(c, top, fill, stroke, width, raised) {
    if (raised) {
      roundRect(c.x, top + 4, c.w, CARD_H, 14);
      ctx.fillStyle = pal.hard;
      ctx.fill();
    }
    roundRect(c.x, top, c.w, CARD_H, 14);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = width;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }

  function cardText(c, top, color) {
    const it = c.item;
    const cx = c.x + c.w / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (it.kind === 'romaji') {
      const ruby = it.reading && it.reading !== it.text;
      if (ruby) {
        ctx.font = '600 ' + readingSize(it) + 'px ' + JP;
        ctx.fillStyle = pal.muted;
        ctx.fillText(it.reading, cx, top + 16);
      }
      ctx.font = '600 ' + promptSize(it) + 'px ' + JP;
      ctx.fillStyle = color;
      ctx.fillText(it.text, cx, top + (ruby ? 44 : CARD_H / 2 + 1));
    } else if (it.kind === 'keys' || /[　-ヿ＀-￯]/.test(it.text)) {
      ctx.font = '600 32px ' + JP;
      ctx.fillStyle = color;
      ctx.fillText(it.text, cx, top + CARD_H / 2 + 1);
    } else {
      ctx.font = '800 32px ' + UI;
      ctx.fillStyle = color;
      ctx.fillText(it.text, cx, top + CARD_H / 2 + 1);
    }
  }

  // 済, as the app stamps it: a red ring with the character in vermilion, tilted.
  function stamp(x, y, radius, ring, tilt = -10) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((tilt * Math.PI) / 180);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = pal.card;
    ctx.fill();
    ctx.lineWidth = ring;
    ctx.strokeStyle = pal.daruma;
    ctx.stroke();
    ctx.fillStyle = pal.stamp;
    ctx.font = '800 ' + Math.round(radius * 1.05) + 'px ' + UI;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('済', 0, radius * 0.06);
    ctx.restore();
  }

  function drawYaoki() {
    const still = reducedMotion.matches;
    let angle = 0;
    if (r && r.fall) {
      const t = r.fall.t;
      const L = r.fall.length;
      const down = -1.35;
      const rise = L * 0.5;
      if (still) angle = t < rise ? down : 0;
      else if (t < 0.22) angle = down * ease(t / 0.22);
      else if (t < rise) angle = down;
      else {
        const u = (t - rise) / (L - rise);
        angle = down * Math.exp(-4.5 * u) * Math.cos(11 * u);
      }
    } else if (r && !still && phase === 'play') {
      // a daruma does not walk: he rocks a little as the route moves under him
      angle = Math.sin(r.rock * Math.PI) * (5 * Math.PI / 180);
    }
    const yx = view.yx;
    ctx.fillStyle = pal.line;
    ctx.beginPath();
    ctx.ellipse(yx, GROUND + 2, 22, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(yx, GROUND);
    ctx.rotate(angle);
    ctx.scale(YAOKI, YAOKI);
    ctx.translate(-50, -94);
    ctx.fillStyle = '#E2452B';
    ctx.fill(DARUMA.body);
    ctx.fillStyle = '#FFF6EA';
    ctx.beginPath();
    ctx.ellipse(50, 42, 27, 23, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#1B2440';
    for (const ex of [39, 61]) {
      ctx.beginPath();
      ctx.arc(ex, 42, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = '#1B2440';
    ctx.beginPath();
    ctx.arc(61, 42, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineCap = 'round';
    ctx.lineWidth = 3;
    ctx.stroke(DARUMA.brows);
    ctx.lineWidth = 2.5;
    ctx.stroke(DARUMA.mouth);
    ctx.strokeStyle = '#F2B43A';
    ctx.lineWidth = 3.5;
    ctx.stroke(DARUMA.gold);
    ctx.restore();
  }

  // Under the route, for the card being typed: the romaji typed so far (green) and, while a
  // hint shows, the kana being typed or the whole rest of the spelling (grey); for keys, the
  // row and finger, then the key. After a fall: the answer and when the card comes back.
  function drawUnder(c, W) {
    const it = c.item;
    const level = hintLevel(c);
    const cx = c.x + c.w / 2;
    const y = GROUND + 36;
    ctx.textBaseline = 'alphabetic';
    let text = '';
    let done = '';
    if (it.kind === 'romaji') {
      done = c.typed;
      if (level >= 2) text = E.spell(it.tokens, c.typed) || c.typed;
      else if (level === 1) {
        const open = E.choices(it.tokens, c.typed);
        const pos = E.at(it.tokens, c.typed);
        text = c.typed + (open.length && pos ? open[0].slice(c.typed.length - pos.start) : '');
      } else text = c.typed;
    } else if (level >= 2) text = keyName(it);
    else if (level === 1) text = keyArea(it);
    if (!text) return;
    const below = c.state === 'fallen' ? 'あとでもう一度　' + backText(r.fall ? r.fall.back : 0)
      : c.halted ? 'ゆっくりでいい　The world waits. Tab skips this card.' : '';
    const captionFont = '800 ' + small(12) + 'px ' + UI;
    ctx.font = captionFont;
    const smallWidth = Math.max(ctx.measureText(below).width, c.state === 'fallen' ? ctx.measureText('正解　answer').width : 0);
    ctx.font = '800 20px ' + UI;
    const width = Math.max(ctx.measureText(text).width, smallWidth);
    const x = Math.max(10, Math.min(W - 10 - width, cx - ctx.measureText(text).width / 2));
    ctx.textAlign = 'left';
    if (c.state === 'fallen') {
      ctx.fillStyle = pal.bad;
      ctx.fillText(text, x, y);
      ctx.font = captionFont;
      ctx.fillText('正解　answer', x, y - 22);
      ctx.fillStyle = pal.muted;
      ctx.fillText(below, x, y + 22);
      return;
    }
    ctx.fillStyle = pal.muted;
    ctx.fillText(text, x, y);
    if (done) {
      ctx.fillStyle = pal.good;
      ctx.fillText(done, x, y);
    }
    if (below) {
      ctx.font = captionFont;
      ctx.fillStyle = pal.muted;
      ctx.fillText(below, x, y + 22);
    }
  }

  // ---------- the loop ----------

  let hudAt = 0;
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    try {
      if (phase === 'play' && r) {
        update(dt);
        if (r) {
          hudAt += dt;
          if (hudAt > 0.25) {
            hudAt = 0;
            hud();
          }
        }
      }
      if (phase === 'play' || phase === 'paused') {
        draw();
        refreshKeys();
      }
      if (r) r.errors = 0;
    } catch (err) {
      // Never leave a dead round on screen: after a few errors in a row, go back to the menu.
      console.error(err);
      if (r && ++r.errors >= 3) {
        setPhase('menu');
        $('mode-desc').textContent = 'The round stopped because of an error in the game: ' + err.message;
      }
    }
    requestAnimationFrame(frame);
  }

  // ---------- wiring ----------

  buildKeyboard();
  showKeyboard();
  setPhase('menu');
  renderSettings();

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('resize', () => resize());
  if (window.ResizeObserver) new ResizeObserver(() => resize()).observe(canvas.parentElement);
  window.addEventListener('blur', () => {
    if (phase === 'play') setPhase('paused');
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && phase === 'play') setPhase('paused');
  });
  if (darkScheme.addEventListener) {
    darkScheme.addEventListener('change', () => {
      pal = palette();
    });
  }

  const toMenu = () => {
    setPhase('menu');
    $('start').focus();
  };
  $('start').addEventListener('click', () => startRound(false));
  $('start-weak').addEventListener('click', () => startRound(true));
  $('again').addEventListener('click', again);
  $('again-weak').addEventListener('click', () => startRound(true));
  $('close').addEventListener('click', toMenu);
  $('pause').addEventListener('click', () => setPhase('paused'));
  $('resume').addEventListener('click', () => setPhase('play'));
  $('quit').addEventListener('click', () => {
    if (r) keepMisses();
    toMenu();
  });

  // The settings sheet, from the menu, the result or the pause sheet. While it is open the
  // page behind it is inert; closing it goes back to where it was opened from.
  let settingsFrom = null;
  function openSettings(from) {
    if (phase === 'play') setPhase('paused');
    settingsFrom = from;
    renderSettings();
    $('settings-sheet').hidden = false;
    $('pause-sheet').hidden = true;
    $('app').inert = true;
    const first = $('hint-seg').querySelector('[aria-pressed="true"]') || $('close-settings');
    first.focus();
  }
  function closeSettings() {
    $('settings-sheet').hidden = true;
    $('pause-sheet').hidden = phase !== 'paused';
    $('app').inert = phase === 'paused';
    if (phase === 'paused') $('resume').focus();
    else if (settingsFrom && !settingsFrom.closest('[hidden]')) settingsFrom.focus();
  }
  $('open-settings').addEventListener('click', (e) => openSettings(e.currentTarget));
  $('pause-settings').addEventListener('click', (e) => openSettings(e.currentTarget));
  $('close-settings').addEventListener('click', closeSettings);
  $('settings-sheet').addEventListener('click', (e) => {
    if (e.target === $('settings-sheet')) closeSettings();
  });
  $('opt-kb').addEventListener('change', (e) => {
    saved.kb = e.target.checked;
    save();
    showKeyboard();
  });
  $('opt-sound').addEventListener('change', (e) => {
    saved.sound = e.target.checked;
    save();
    if (saved.sound && r && r.course) loadSound(r.course.level, r.course.unit);
  });
  document.addEventListener('click', () => {
    if (window.ykSound) window.ykSound.unlock();
  });

  requestAnimationFrame((now) => {
    last = now;
    requestAnimationFrame(frame);
  });

  // Read-only view of the round, for the browser checks in check/typing-test.js.
  window.ykTyping = {
    state() {
      const t = targetCard();
      return {
        phase,
        mode: saved.mode,
        target: t ? {
          text: t.item.text, reading: t.item.reading || null, typed: t.typed,
          spell: t.item.kind === 'romaji' ? E.spell(t.item.tokens, t.typed) : null,
          key: t.item.key || null, code: t.item.code || null, shift: !!t.item.shift, level: hintLevel(t), halted: t.halted,
        } : null,
        cleared: r ? r.cleared : 0,
        skipped: r ? r.skipped : 0,
        total: r ? r.total : 0,
        falls: r ? r.falls : 0,
        falling: !!(r && r.fall),
        back: r && r.fall ? r.fall.back : null,
        answerShown: r && r.fall ? hintLevel(r.fall.card) >= 2 : null,
        W: view.W,
        cards: r ? r.cards.map((c) => ({ text: c.item.text, x: Math.round(c.x), w: Math.round(c.w), state: c.state })) : [],
        clean: r ? r.clean : 0,
        speed: r ? r.speed : 0,
        T: r ? r.T : 0,
      };
    },
  };
})();
