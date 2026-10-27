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
 *
 * What it rewards is accuracy, getting up again and showing up, never speed: a card typed with
 * no miss and no hint settles inside a teacher's はなまる and counts towards a clean run (連続)
 * that Yaoki cheers at 5, 10, 20 and 40; a card that knocked him over and comes back typed
 * cleanly is stamped 起; a card holding one of the player's weak spots has a gold corner.
 * Between visits, a day's typing time fills a box on a seven-day stamp card that never resets,
 * and たいへんよくできました on three different days gives a stage its はなまる. None of it
 * touches the learning data: the clean count, the pace, the bests and the weak spots.
 *
 * Cleared cards ride on to Yaoki, and he gets past each with a trick (a jump, a spin, a duck or
 * a smash) before it settles behind him. Each round is played in a scene (scenes.js) under the
 * graph paper, to its own tune (music.js); Yaoki's lines and their little items are in
 * items.js. Each of those modules is optional: without it the round is plain paper, silent, or
 * uses the few lines built in here.
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
  const RUN_STEPS = [5, 10, 20, 40];   // clean cards in a row that Yaoki cheers
  const GOALS = [3, 5, 10];    // minutes of typing a day for the day's stamp
  const PRACTICE_IDLE = 8;     // seconds without a key after which typing time stops counting
  const STAMP_T = 0.32;        // a 済 landing, on the curve of the app's yk-stamp
  const INK_T = 0.25;          // its ink ring
  const DROP_T = 0.35;         // the ink drops of a clean card's stamp
  const POP_T = 0.12;          // the newest romaji letter's pop
  const HOP_T = 0.4;           // Yaoki's hop
  const HAPPY_T = 0.6;         // his smile after a clean card
  const CHEER_T = 1.2;         // a cheer's bubble
  const BUBBLE_POP = 0.15;
  const VOICE_T = 0.9;          // no effect sound this long after a course word's clip starts (or its length, if longer)
  const DAY_TILTS = [-9, 6, -4, 8, -7, 5, -10];
  // Yaoki's tricks past a cleared card: length (s), the stretch of it in which the card goes by
  // him (or, for a smash, when he hits it), and the trick's sound word
  const TRICKS = {
    jump: { len: 0.8, pass: [0.14, 0.66], ja: 'ぴょん' },
    spin: { len: 1.0, pass: [0.16, 0.7], ja: 'くるりん' },
    duck: { len: 0.9, pass: [0.14, 0.72], ja: 'ひょい' },
    smash: { len: 0.8, hit: 0.3, ja: 'どーん！' },
  };
  const TRICK_LEAD = 34;       // a trick starts when a cleared card is this close to Yaoki's front
  const NODE_BACK = 40;        // where a passed card's node lands, behind him
  const SETTLE_T = 0.3;        // a card that just settles into its node
  const NOD_T = 0.12;          // his nod for a right key
  const BLINK_T = 0.12;
  const FX_T = 0.6;            // a trick's sound word
  const TRAIL_T = 0.35;        // the stars a spin leaves
  const FINALE_MAX = 4;        // at most this long for the cleared cards to parade past him at the end

  // ---------- what is kept between visits ----------

  const DEFAULTS = {
    mode: null, stage: {}, level: null, unit: {}, hints: 'stuck', len: 20, kb: true, sound: true, best: {}, pace: {}, stats: {},
    sfx: 'quiet', music: 'on', goal: 5, practice: null, stampCard: { days: [], done: 0, lastDay: null }, run: {}, seal: {},
  };
  let saved = load();
  sanitize();

  // Keys added after the first version, checked so that any old or odd save still loads.
  function sanitize() {
    if (!['off', 'quiet', 'all'].includes(saved.sfx)) saved.sfx = 'quiet';
    if (!['off', 'soft', 'on'].includes(saved.music)) saved.music = 'on';
    if (!GOALS.includes(saved.goal)) saved.goal = 5;
    const p = saved.practice;
    if (!p || typeof p !== 'object' || typeof p.d !== 'string' || !(p.s >= 0)) saved.practice = null;
    const sc = saved.stampCard;
    if (!sc || typeof sc !== 'object' || !Array.isArray(sc.days)) {
      saved.stampCard = { days: [], done: 0, lastDay: null };
    } else {
      sc.days = sc.days.filter((d) => typeof d === 'string').slice(0, 6);
      sc.done = Math.max(0, sc.done | 0);
      if (typeof sc.lastDay !== 'string') sc.lastDay = sc.days[sc.days.length - 1] || null;
    }
    for (const k of ['run', 'seal']) if (!saved[k] || typeof saved[k] !== 'object' || Array.isArray(saved[k])) saved[k] = {};
  }

  // The day, by the local calendar, as the app counts days (window.__ykNow is its test clock).
  const clock = () => window.__ykNow || Date.now();
  const pad2 = (n) => String(n).padStart(2, '0');
  function localDay(t = clock()) {
    const d = new Date(t);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  const shortDay = (iso) => +iso.slice(5, 7) + '/' + +iso.slice(8, 10);

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
    // missed again in the same round: it has not left the list after all
    if (r && name === r.stats) r.graduated.delete(key);
  }
  function markOk(name, key) {
    const b = bucket(name);
    const v = b[key];
    if (!v) return;
    v.ok++;
    if (v.ok >= 3) {
      delete b[key];
      if (r && name === r.stats) r.graduated.add(key);
    }
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
    // always from a click or a key press: the moment to wake the audio for the music
    wakeAudio();
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
      // the clean run, comebacks and weak-spot cards: round only, beside the counts above
      run: 0,
      bestRun: 0,
      stepChip: false,
      runRecord: false,
      comebacks: 0,
      fellEntries: new Set(),
      graduated: new Set(),
      weakDealt: 0,
      weakClean: 0,
      // typing time for the day's stamp
      practice: 0,
      credited: 0,
      lastKeyAt: 0,
      dayStamp: 0,
      cardDone: null,
      seal: null,
      yk: { happyT: 0, hopT: 0, hopH: 6, bubble: null, box: null, lift: 0, liftMax: 0, nodT: 0, blinkT: -1, blinkAt: 1.5, fx: null, trail: [], trick: null },
      tricks: { jump: 0, spin: 0, duck: 0, smash: 0 },
      scroll: 0,
      finale: null,
      // the scene the round is played in, and its song
      scene: window.TypingScenes && window.TypingScenes.forStage ? safely(() => window.TypingScenes.forStage(key), null) : null,
      song: null,
      musicOn: false,
      started: false,
      // a clean run one longer than the stage's record is cheered (rounds that can keep it)
      runRecordAt: !weakOnly && saved.hints !== 'always' && saved.run[key] ? saved.run[key] + 1 : 0,
      sayNext: '',
      lastMissSfx: -1,
      voiceUntil: 0,
      fxDrawn: 0,
    };
    markWeakCards();
    r.song = songFor(r.scene);
    hush();
    setPhase('play');
    startMusic();
    resize();
    if (modeId === 'course' && saved.sound) loadSound(level, unit);
    setStatus('', '');
    hud();
  }

  // A gold corner on the cards that hold the player's weak spots: the weakest items first, one
  // card each, at most one card in five. Not in a weak-spot round (every card there is weak),
  // nor with hints always on (a shown spelling cannot be typed clean from memory).
  function markWeakCards() {
    if (r.weakOnly || saved.hints === 'always') return;
    const stats = bucket(r.stats);
    const cap = Math.ceil(r.total / 5);
    const seen = new Set();
    const picks = r.queue
      .map((e, i) => ({ e, i, w: weakness(e.item, stats) }))
      .filter((x) => x.w > 0)
      .sort((a, b) => b.w - a.w || a.i - b.i);
    for (const x of picks) {
      if (seen.size >= cap) break;
      if (seen.has(x.e.item.id)) continue;
      seen.add(x.e.item.id);
      x.e.weak = true;
    }
    r.weakDealt = seen.size;
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
      clean: false, comeback: false, star: false, popT: 0, ink: null, inkOn: 'badge', fill: null,
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
    // typing time for the day's stamp: it stops 8 seconds after the last key
    if (r.time - r.lastKeyAt < PRACTICE_IDLE) r.practice += dt;
    r.time += dt;
    for (const c of r.cards) {
      if (c.state === 'done') {
        c.stampT += dt;
        if (c.phase === 'settle' && (c.settleT += dt) >= SETTLE_T) c.phase = 'node';
      }
      if (c.flashT > 0) c.flashT = Math.max(0, c.flashT - dt);
      if (c.popT > 0) c.popT = Math.max(0, c.popT - dt);
    }
    const yk = r.yk;
    yk.happyT = Math.max(0, yk.happyT - dt);
    yk.hopT = Math.max(0, yk.hopT - dt);
    yk.nodT = Math.max(0, yk.nodT - dt);
    if (yk.bubble && (yk.bubble.t += dt) >= yk.bubble.life) yk.bubble = null;
    // he blinks every few seconds
    if (yk.blinkT >= 0) {
      yk.blinkT += dt;
      if (yk.blinkT >= BLINK_T) {
        yk.blinkT = -1;
        yk.blinkAt = r.time + 2.2 + 2.8 * Math.random();
      }
    } else if (r.time >= yk.blinkAt) {
      yk.blinkT = 0;
    }
    if (yk.fx && (yk.fx.t += dt) >= FX_T) yk.fx = null;
    if (yk.trail.length) {
      for (const st of yk.trail) st.age += dt;
      if (yk.trail[0].age >= TRAIL_T) yk.trail = yk.trail.filter((st) => st.age < TRAIL_T);
    }
    updateTrick(dt);

    if (r.finale !== null && r.endIn === null) {
      const riding = r.cards.some((c) => c.state === 'done' && (c.phase === 'ride' || c.phase === 'trick'));
      if (!riding || r.time - r.finale >= FINALE_MAX) r.endIn = 0.8;
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
      // halfway through, he rights himself: よいしょ!
      if (!r.fall.rose && r.fall.t >= 0.5 * r.fall.length) {
        r.fall.rose = true;
        sfx('up');
        cheer('rise', r.fall.length - r.fall.t + 0.5, { first: r.falls === 1 });
      }
      if (r.fall.t >= r.fall.length) endFall();
      return;
    }

    const live = r.cards.filter((c) => c.state === 'live');
    const target = targetCard();
    const halted = !!(target && target.halted);
    const waiting = !target && (live.length > 0 || r.queue.length > 0 || r.finale !== null) && r.endIn === null;
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

    // the card of a trick in progress is held where it is: the trick moves it
    for (const c of r.cards) if (c.phase !== 'trick') c.x -= speed * dt;
    r.scroll += speed * dt;
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
          cheer('halt', 2);
        }
      } else {
        startFall(first);
      }
    }

    // A cleared card that reaches him: he gets past it with a trick (once its stamp is down).
    if (!r.fall) {
      for (const c of r.cards) {
        if (c.state !== 'done' || c.phase !== 'ride' || c.stampT < 0.2 || c.x > view.yx + REACH + TRICK_LEAD) continue;
        if (!yk.trick && !reducedMotion.matches) startTrick(c);
        else settleCard(c);
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
        // a word from Yaoki as the round starts, and for its last card
        if (!r.started) {
          r.started = true;
          cheer('start', 1.4, { first: true });
        } else if (r.cleared + r.skipped === r.total - 1) {
          cheer('last', 1.4);
          if (r.musicOn) music('cue', 'last');
        }
      } else if (r.pendingSpeak === t) {
        speakTarget(t);
      }
      t.idle += dt;
      // a gentle nudge before any hint, once a card
      if (t.idle >= 3.5 && !t.nudged && !t.typed) {
        t.nudged = true;
        cheer('idle', 1.6);
      }
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
    r.fall = { t: 0, card, length, at, back: ahead + at, rose: false };
    r.falls++;
    r.p = Math.max(0.5, r.p * 0.8);
    r.target = null;
    // the clean run ends quietly: no red, no sound of its own
    r.run = 0;
    r.stepChip = false;
    r.fellEntries.add(card.entry);
    endTrick();
    r.yk.happyT = 0;
    r.yk.hopT = 0;
    r.yk.bubble = null;
    r.yk.fx = null;
    if (r.musicOn) music('cue', 'fall');
    sfx('fall');
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
    if (r.musicOn) music('setLevel', musicLevel());
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
    const clean = !card.misses && !card.hinted && !card.entry.falls;
    card.clean = clean;
    if (clean) r.clean++;
    // 起: a card that knocked Yaoki over, typed this time with no miss and no hint showing
    card.comeback = !clean && card.entry.falls >= 1 && !card.halted && !card.misses && card.level === 0;
    // a weak-spot card typed clean (not with its spelling on show after a switch to "always")
    card.star = !!card.entry.weak && clean && card.level < 2;
    measure(card);
    applyStats(card);

    // The clean run: it grows with each clean card and ends quietly on a card that is not
    // clean. A card that has already fallen leaves it alone: its fall ended the run already.
    r.stepChip = false;
    let step = -1;
    if (clean) {
      r.run++;
      r.bestRun = Math.max(r.bestRun, r.run);
      step = RUN_STEPS.indexOf(r.run);
      if (step >= 0) {
        r.stepChip = true;
        r.sayNext = r.run + ' clean in a row.';
      }
    } else if (!card.entry.falls) {
      r.run = 0;
    }
    if (card.comeback) r.comebacks++;
    if (card.star) r.weakClean++;

    // Yaoki: a smile for a clean card, a hop and a cheer at a step of the run or a comeback;
    // and the trick he will get past this card with when it reaches him.
    card.phase = 'ride';
    card.trick = card.comeback || card.star || card.halted ? 'smash' : !clean ? 'duck' : r.run >= 5 ? 'spin' : 'jump';
    const yk = r.yk;
    if (clean || card.comeback) yk.happyT = HAPPY_T;
    if (step >= 0) {
      hop(step >= 2 ? 8 : 6);
      cheer('step' + step, CHEER_T, { first: true });
    } else if (card.comeback) {
      hop(6);
      cheer('comeback', 1);
    } else if (card.star) {
      cheer('star', 1.2);
    }
    if (r.runRecordAt && r.bestRun === r.runRecordAt && !r.hintModes.has('always')) cheer('record', 1.4);

    // The stamp's ink, on the corner badge; a clean card's stamp throws a few drops.
    card.inkOn = 'badge';
    if (clean) {
      card.ink = [];
      for (let i = 0; i < 6; i++) card.ink.push({ a: Math.random() * Math.PI * 2, d: 8 + 10 * Math.random(), r: 1.2 + 1.2 * Math.random() });
    }

    // A course word's own voice is its reward: no effect sound plays over it.
    const voice = !!(card.item.clip && saved.sound && window.ykSound && window.ykSound.has(card.item.clip));
    if (voice) {
      window.ykSound.play(card.item.clip);
      r.voiceUntil = r.time + Math.max(VOICE_T, (window.ykSound.ms ? window.ykSound.ms(card.item.clip) : 0) / 1000);
      if (r.musicOn) music('duck', r.voiceUntil - r.time + 0.2);
    } else {
      sfx('clear', { streak: clean ? r.run : 0 });
      if (card.star) sfx('gold');
      if (step >= 0) sfxLater('streak', { step }, 140);
      else if (card.comeback) sfxLater('up', null, 120);
    }
    // the music follows the clean run
    if (r.musicOn) {
      music('setLevel', musicLevel());
      if (step >= 0) music('cue', 'step');
    }
    if (r.cleared + r.skipped >= r.total) startFinale();
    roundLines();
    setStatus('', '');
    hud();
  }

  // The last card is done: the cleared cards still on the route hurry past Yaoki, each with its
  // trick, then the result (straight away under reduced motion, where nothing hurries).
  function startFinale() {
    if (r.finale !== null) return;
    r.finale = r.time;
    if (reducedMotion.matches) r.endIn = 0.8;
  }

  // Yaoki's word halfway through the round, and at its end (by the stamp it will get).
  function roundLines() {
    const passed = r.cleared + r.skipped;
    if (passed >= r.total) {
      const tier = tierOf(r);
      cheer(['endGood', 'endOk', 'endTry'][tier], 1.2);
      if (tier === 0) hop(10);
    } else if (r.total >= 10 && passed === Math.floor(r.total / 2)) {
      cheer('half', 1.3);
    }
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
    sfx('swish');
    setStatus('', '');
    if (r.cleared + r.skipped >= r.total) startFinale();
    roundLines();
    hud();
  }

  function finishRound() {
    if (r.musicOn) music('cue', 'end');
    creditPractice();
    saved.pace[r.key] = { r: Math.round(r.rt * 100) / 100, p: Math.round(r.p * 100) / 100 };
    const kpm = r.active > 0.2 ? Math.round(r.keysRight / (r.active / 60)) : 0;
    // A round counts for the best only if hints were never always on during it.
    const counts = !r.hintModes.has('always') && !r.weakOnly;
    const prev = saved.best[r.key];
    const isBest = counts && kpm > 0 && (!prev || kpm > prev);
    if (isBest) saved.best[r.key] = kpm;
    // The longest clean run is kept per stage, on the same terms as the best.
    const runPrev = saved.run[r.key] || 0;
    r.runPrev = runPrev;
    r.runRecord = counts && r.bestRun > runPrev;
    if (r.runRecord) saved.run[r.key] = r.bestRun;
    const tier = tierOf(r);
    r.seal = sealRound(tier, counts);
    save();
    showResult(kpm, isBest, prev, counts);
    setPhase('result');
    revealResult(tier);
  }

  // The teacher's stamp, by the share of clean cards, as for the app's week tests.
  function tierOf(round) {
    const share = round.clean / round.total;
    return share >= 0.8 ? 0 : share >= 0.6 ? 1 : 2;
  }

  // A stage's はなまる: たいへんよくできました in a counted round stamps one ring on the stage
  // (or course week), at most one a day; three rings, on three different days, make it.
  function sealRound(tier, counts) {
    if (tier !== 0) return null;
    if (!counts) return { kind: 'nocount' };
    const d = localDay();
    const list = Array.isArray(saved.seal[r.key]) ? saved.seal[r.key] : (saved.seal[r.key] = []);
    if (list.length >= 3) return { kind: 'had', n: 3 };
    if (list.includes(d)) return { kind: 'today', n: list.length };
    list.push(d);
    return { kind: list.length === 3 ? 'hana' : 'ring', n: list.length };
  }

  // The day's typing time goes on the stamp card: at the end of a round, on Quit, and when the
  // page is hidden. Each second is credited once; the day's box is stamped once the goal is met.
  function creditPractice() {
    if (!r) return;
    const sec = r.practice - r.credited;
    if (sec <= 0) return;
    r.credited = r.practice;
    const d = localDay();
    if (!saved.practice || saved.practice.d !== d) saved.practice = { d, s: 0 };
    saved.practice.s = Math.round((saved.practice.s + sec) * 10) / 10;
    stampIfDue(true);
  }
  function stampIfDue(inRound) {
    const p = saved.practice;
    const c = saved.stampCard;
    if (!p || p.d !== localDay() || p.s < saved.goal * 60 || c.lastDay === p.d) return false;
    // the clock went back to a day already on the card: it keeps its one box
    if (c.days.includes(p.d)) {
      c.lastDay = p.d;
      return false;
    }
    c.days.push(p.d);
    c.lastDay = p.d;
    if (inRound && r) r.dayStamp = c.days.length;
    if (c.days.length >= 7) {
      if (inRound && r) r.cardDone = c.days.slice();
      c.done++;
      c.days = [];
    }
    return true;
  }
  // Today's typing time so far (0 on a new day).
  const todaySec = () => (saved.practice && saved.practice.d === localDay() ? saved.practice.s : 0);

  // ---------- input ----------

  let sawKeyboard = false;

  function onKeyDown(e) {
    if (!sawKeyboard && e.key && e.key.length === 1) {
      sawKeyboard = true;
      $('touch-note').hidden = true;
      showKeyboard();
    }
    wakeAudio();
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
    // a held key's repeats are not typing: only real presses keep the day's time counting
    if (!e.repeat) r.lastKeyAt = r.time;
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
    r.yk.nodT = NOD_T;
    flashKey(code, 'ok');
    // a romaji letter pops under the route and ticks; one-key cards have their stamp instead
    if (card.item.kind === 'romaji') {
      card.popT = POP_T;
      sfx('key', { streak: r.run });
    }
  }

  function miss(card, code, note, pressed) {
    card.misses++;
    card.flashT = 0.3;
    noteMiss(card, pressed);
    raiseHint(card);
    flashKey(code, 'miss');
    setStatus(note, 'bad', true);
    if (r.lastMissSfx < 0 || r.time - r.lastMissSfx >= 0.15) {
      r.lastMissSfx = r.time;
      sfx('miss');
    }
  }

  // もう一度: the same kind of round again (a normal one if no weak spots are left).
  function again() {
    clearTimers();
    startRound(!!(r && r.weakOnly && weakItems().length));
  }

  // ---------- sound effects (sfx.js) ----------
  // "Quiet" plays a stamp for each card, a drum for a fall and a bounce for getting up; "All"
  // also ticks for each right romaji key and knocks for a miss. The audio output is only ever
  // made on a key press or a click.

  let sfxReady = false;
  const SFX_ALL_ONLY = new Set(['key', 'miss']);
  const UNDER_VOICE = new Set(['key', 'miss', 'jump', 'duck', 'spin', 'smash']);
  function wakeAudio() {
    if (!window.TypingSfx || (saved.sfx === 'off' && saved.music === 'off')) return;
    sfxReady = true;
    window.TypingSfx.unlock();
  }
  // With effects and music both off, the audio output is given back.
  function sleepAudio() {
    if (saved.sfx === 'off' && saved.music === 'off' && window.TypingSfx && window.TypingSfx.sleep) window.TypingSfx.sleep();
  }

  // ---------- music (music.js) ----------
  // A song for each scene, made in the browser. It starts with the round, gets livelier as the
  // clean run grows (5, then 10 in a row), drops back when Yaoki falls, dips while a course word
  // is spoken, pauses with the round and ends with it.

  const MUSIC_VOL = { off: 0, soft: 0.35, on: 0.7 };
  function music(fn, ...args) {
    const m = window.TypingMusic;
    if (!m || typeof m[fn] !== 'function') return undefined;
    try {
      return m[fn](...args);
    } catch (err) {
      return undefined;
    }
  }
  const musicLevel = () => (r.run >= 10 ? 3 : r.run >= 5 ? 2 : 1);
  function songFor(scene) {
    const m = window.TypingMusic;
    if (!m || !Array.isArray(m.SONGS) || !m.SONGS.length) return null;
    if (typeof m.forScene === 'function') {
      const id = m.forScene(scene);
      if (id) return id;
    }
    const scenes = window.TypingScenes && window.TypingScenes.SCENES ? window.TypingScenes.SCENES.map((x) => x.id) : [];
    const i = Math.max(0, scenes.indexOf(scene));
    return m.SONGS[i % m.SONGS.length].id;
  }
  function startMusic() {
    if (!r || saved.music === 'off' || !sfxReady) return;
    music('volume', MUSIC_VOL[saved.music]);
    if (music('start', r.song) !== false) {
      r.musicOn = true;
      music('setLevel', r.cleared ? musicLevel() : 0);
    }
  }
  function sfx(name, opts) {
    if (!sfxReady || !window.TypingSfx || saved.sfx === 'off') return;
    if (SFX_ALL_ONLY.has(name) && saved.sfx !== 'all') return;
    if (UNDER_VOICE.has(name) && r && r.time < r.voiceUntil) return;
    try {
      window.TypingSfx.play(name, opts);
    } catch (err) {
      // a sound that cannot play is simply not heard
    }
  }

  // Sounds and reveals a moment later; all are cancelled when the screen changes.
  let timers = [];
  function later(fn, ms) {
    timers.push(setTimeout(fn, ms));
  }
  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
  }
  function sfxLater(name, opts, ms) {
    later(() => {
      if (phase === 'play' || phase === 'result') sfx(name, opts);
    }, ms);
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
    clearTimers();
    const was = phase;
    phase = p;
    $('menu').hidden = p !== 'menu';
    $('play').hidden = !(p === 'play' || p === 'paused');
    $('result').hidden = p !== 'result';
    $('pause-sheet').hidden = p !== 'paused' || !$('settings-sheet').hidden;
    $('app').inert = p === 'paused' || !$('settings-sheet').hidden;
    document.body.classList.toggle('playing', p === 'play' || p === 'paused');
    if (p === 'menu') {
      music('stop', 0.3);
      r = null;
      hush();
      renderMenu();
    }
    if (p === 'paused') music('pause');
    if (p === 'paused') $('resume').focus();
    if (p === 'play') {
      if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
      // the hint setting the round goes on with counts, even if it is changed again at once
      if (r) r.hintModes.add(saved.hints);
      if (was === 'paused' && r) {
        r.spokenAt = -9;
        r.target = null;
        // the music goes on (or starts, if it was turned on during the pause)
        wakeAudio();
        if (r.musicOn && saved.music !== 'off') {
          music('volume', MUSIC_VOL[saved.music]);
          music('resume');
        } else {
          startMusic();
        }
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
  // With `markup`, enText is markup already (made with jaMarked), so the Japanese in an English
  // sentence is read in a Japanese voice too.
  let sayTimer = 0;
  function say(jaText, enText, markup = false) {
    const el = $('sr-prompt');
    el.textContent = '';
    clearTimeout(sayTimer);
    sayTimer = setTimeout(() => {
      el.innerHTML = (jaText ? ja(jaText) : '') + (enText ? (jaText ? '. ' : '') + (markup ? enText : esc(enText)) : '');
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
    // still one line a card: a step of the clean run and a weak-spot card ride along with it
    const en = [r.sayNext, card.entry.weak ? 'Weak spot.' : ''].filter(Boolean).join(' ');
    r.sayNext = '';
    say(it.reading && it.reading !== it.text ? it.text + '、' + it.reading : it.text, en);
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
    $('hud-run').textContent = r.run;
    const chip = $('hud-run-chip');
    chip.classList.toggle('zero', r.run === 0);
    chip.classList.toggle('step', r.stepChip);
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

    // The teacher's stamp (it lands in revealResult).
    const tier = tierOf(r);
    const stamp = $('res-stamp');
    stamp.className = 'hanko' + (tier === 0 ? ' three' : '');
    $('res-stamp-text').innerHTML = ['たいへん<br>よく<br>できました', 'よく<br>できました', 'がんばり<br>ましょう'][tier];
    stamp.setAttribute('aria-label', ['Stamp: excellent', 'Stamp: well done', 'Stamp: keep at it'][tier]);

    // The longest clean run, and the stage's record for it.
    $('res-run').textContent = r.bestRun;
    const runText = 'longest run of clean cards in a row';
    $('res-run-en').innerHTML = !counts ? esc(runText + ' (not kept: hints always on, or a weak-spot round)')
      : r.runRecord ? esc(runText) + ' <span class="tag gold" lang="ja">記録更新</span> New record'
        : esc(runText) + (r.runPrev ? ' · stage record ' + r.runPrev : '');

    // 起: the cards that came back after a fall and were typed clean.
    const ups = $('res-ups');
    const allUp = r.falls > 0 && r.skipped === 0 && r.comebacks === r.fellEntries.size;
    ups.hidden = !r.comebacks;
    ups.innerHTML = allUp ? ja('七転び八起き！') + '　Every card that knocked Yaoki over was typed clean when it came back.'
      : ja('起き上がり') + ' ×' + r.comebacks + '　' + (r.comebacks === 1 ? 'One came back and was' : r.comebacks + ' came back and were') + ' typed clean (' + ja('起') + ')';

    // Weak-spot cards (gold corner) typed clean.
    $('res-wc-row').hidden = !r.weakDealt;
    $('res-wc').innerHTML = r.weakClean + ' <small>/ ' + r.weakDealt + '</small>';

    $('res-best').hidden = !isBest && !prev;
    $('res-best').firstElementChild.hidden = !isBest;
    if (isBest) $('res-best-text').textContent = 'New best on this stage: ' + kpm + ' right keys a minute.';
    else if (prev) $('res-best-text').textContent = 'Best on this stage: ' + prev + ' right keys a minute.' + (counts ? '' : ' (Rounds with hints always on, and weak-spot rounds, are not counted.)');

    // A ring towards the stage's はなまる, and the next stage after a top round.
    showSeal(tier, counts);

    const weak = [...r.missed.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    $('res-weak-box').hidden = !weak.length;
    fillChips($('res-weak'), weak, STAR_ICON);
    // 卒業: what left the weak list during the round (three clean in a row).
    const grad = [...r.graduated];
    const left = weakItems().length;
    $('res-grad-box').hidden = !grad.length;
    fillChips($('res-grad'), grad.map((key) => [key, 1]), DONE_ICON);
    $('res-grad-note').innerHTML = (left ? '' : '<b lang="ja">苦手ゼロ！</b>　No weak spots left on this ' + (r.course ? 'week' : 'stage') + '. ')
      + ja('3回つづけてノーミス') + '　Three clean in a row took these off your weak spots.';
    $('again-weak').hidden = !left;

    // Today's box on the stamp card.
    renderDayCard(true);

    // The screen reader hears it all in one line.
    const parts = ['Round over.', r.clean + ' of ' + r.total + ' cards clean.', ['Stamp: excellent.', 'Stamp: well done.', 'Stamp: keep at it.'][tier]];
    if (r.bestRun >= 2) parts.push('Longest clean run ' + r.bestRun + (r.runRecord ? ', a new record.' : '.'));
    if (r.comebacks) parts.push(r.comebacks + (r.comebacks === 1 ? ' comeback.' : ' comebacks.'));
    if (grad.length) parts.push('Off the weak list: ' + grad.slice(0, 5).map(chipLabel).join(', ') + (grad.length > 5 ? ', and ' + (grad.length - 5) + ' more.' : '.'));
    if (r.cardDone) parts.push('Stamp card complete.');
    else if (r.dayStamp) parts.push('Today\'s stamp is in, ' + r.dayStamp + ' of 7.');
    if (r.seal && r.seal.kind === 'ring') parts.push('A ring for this ' + (r.course ? 'week' : 'stage') + ', ' + r.seal.n + ' of 3.');
    if (r.seal && r.seal.kind === 'hana') parts.push('はなまる for this ' + (r.course ? 'week' : 'stage') + '.');
    say('結果', jaMarked(parts.join(' ')), true);
  }

  const STAR_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9 6.6 19.8l1.1-6.1L3.2 9.4l6.1-.8z" fill="#F2B43A" stroke="#1B2440" stroke-width="1.8" stroke-linejoin="round"/></svg>';
  const DONE_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#FFFFFF" stroke="#E2452B" stroke-width="2.4"/><text x="12" y="16.5" text-anchor="middle" font-size="12" font-weight="800" fill="#C7361E">済</text></svg>';
  // A weak spot's label: a Shift-layer kana key is kept as "ぁ+", shown as "ぁ (Shift)".
  const chipLabel = (key) => (key.length > 1 && key.endsWith('+') ? key.slice(0, -1) + ' (Shift)' : key);
  function fillChips(box, list, icon) {
    box.textContent = '';
    for (const [key, n] of list) {
      const chip = document.createElement('span');
      const label = chipLabel(key);
      if (/[぀-ヿ]/.test(label)) chip.lang = 'ja';
      chip.innerHTML = icon;
      chip.appendChild(document.createTextNode(label + (n > 1 ? ' ×' + n : '')));
      box.appendChild(chip);
    }
  }

  // The stage's rings towards its はなまる, and the offer of the next stage.
  function showSeal(tier, counts) {
    const seal = r.seal;
    const what = r.course ? 'week' : 'stage';
    const box = $('res-seal');
    const tag = $('res-seal-tag');
    const text = $('res-seal-text');
    const hana = !!(seal && seal.kind === 'hana');
    $('res-hana').toggleAttribute('hidden', !hana);
    $('res-stamp').classList.toggle('hana', hana);
    box.hidden = !seal;
    tag.hidden = true;
    if (seal) {
      const rings = (n) => '<span class="rings" aria-hidden="true">' + [0, 1, 2].map((i) => '<i' + (i < n ? ' class="on"' : '') + '></i>').join('') + '</span> ';
      if (seal.kind === 'ring') {
        text.innerHTML = rings(seal.n) + ja('はなまるまで ' + seal.n + '/3') + '　' + ['', 'One', 'Two'][seal.n] + ' of three rings towards this ' + what + '\'s ' + ja('はなまる') + ': a ring comes with ' + ja('たいへんよくできました') + ', one a day.';
      } else if (seal.kind === 'hana') {
        tag.hidden = false;
        tag.textContent = 'はなまる！';
        text.innerHTML = 'This ' + what + ' has its ' + ja('はなまる') + ': ' + ja('たいへんよくできました') + ' on three different days.';
      } else if (seal.kind === 'today') {
        text.innerHTML = rings(seal.n) + ja('今日の分は済') + '　Today\'s ring for this ' + what + ' is in (' + seal.n + ' of 3). The next one comes on another day.';
      } else if (seal.kind === 'had') {
        text.innerHTML = ja(r.course ? 'はなまるの週' : 'はなまるのステージ') + '　This ' + what + ' already has its ' + ja('はなまる') + '.';
      } else {
        text.innerHTML = 'Rings towards a ' + what + '\'s ' + ja('はなまる') + ' are not given with hints always on, or in weak-spot rounds.';
      }
    }
    // After a top round, the next stage (course weeks follow the app's own plan instead).
    const next = tier === 0 && counts && !r.course ? nextStage(r.key) : null;
    const btn = $('res-next');
    btn.hidden = !next;
    // one span, so a narrow screen wraps it as a line of text, not piece by piece
    if (next) btn.innerHTML = '<span>' + ja('次のステージ') + '　Next: ' + ja(next.ja) + ' ' + esc(next.en) + '</span>';
  }
  function nextStage(key) {
    const [mode, id] = key.split(':');
    const list = STAGES[mode];
    if (!list) return null;
    const i = list.findIndex((s) => s.id === id);
    return i >= 0 && i + 1 < list.length ? list[i + 1] : null;
  }

  // Once the result is on screen: the hanko lands with its thump and ink ring.
  function revealResult(tier) {
    for (const el of [$('res-stamp'), $('res-ink')]) {
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = '';
    }
    // the thump comes as the hanko touches, and never over the last word's voice
    const wait = Math.max(0, (r.voiceUntil - r.time) * 1000);
    sfxLater('result', { tier }, Math.max(reducedMotion.matches ? 0 : 452, wait));
  }

  // ---------- the stamp card ----------
  // Seven boxes, one for each day the goal was typed. Days off never erase one; a full card
  // starts a new one. Shown on the menu and, smaller, on the result.

  function renderDayCard(onResult) {
    const c = saved.stampCard;
    const today = localDay();
    const goal = saved.goal * 60;
    const s = todaySec();
    const stampedToday = c.lastDay === today || c.days.includes(today);
    const days = onResult && r && r.cardDone ? r.cardDone : c.days;
    const fresh = onResult && r ? (r.cardDone ? r.cardDone.length : r.dayStamp) : 0;
    const boxes = $(onResult ? 'res-day-boxes' : 'day-boxes');
    boxes.textContent = '';
    for (let i = 0; i < 7; i++) {
      const b = document.createElement('span');
      b.className = 'day-box';
      if (i < days.length) {
        b.classList.add('stamped');
        if (fresh && i === fresh - 1) b.classList.add('new');
        b.innerHTML = '<i lang="ja" style="--tilt:' + DAY_TILTS[i] + 'deg">済</i><small>' + shortDay(days[i]) + '</small>';
      } else if (i === days.length && !stampedToday) {
        b.classList.add('open');
        b.style.setProperty('--fill', Math.min(100, Math.floor(100 * s / goal)) + '%');
      }
      boxes.appendChild(b);
    }
    // whole seconds typed, and the rest of the goal: the two always add up to the goal
    const shown = Math.floor(s);
    const left = Math.max(0, goal - shown);
    const count = days.length + ' / 7';
    if (onResult) {
      $('res-day-count').textContent = count;
      $('res-day-line').innerHTML = r && r.cardDone ? ja('スタンプカード完成！') + '　Card complete: seven days of practice. A new card starts next time.'
        : r && r.dayStamp ? ja('今日の分、済！') + '　Today\'s stamp is in: ' + r.dayStamp + ' of 7.'
          : stampedToday ? ja('今日の分は済') + '　Today\'s stamp was already in. ' + days.length + ' of 7.'
            : ja('今日') + ' <b>' + fmt(shown) + '</b> / ' + fmt(goal) + '　' + fmt(left) + ' more typing for today\'s stamp.';
      return;
    }
    $('day-count').textContent = count;
    $('day-line').innerHTML = '<b>' + fmt(shown) + '</b> / ' + fmt(goal) + '　' + ja('今日の練習') + '　Typed today';
    $('day-hint').innerHTML = (stampedToday ? ja('今日の分、済！') + '　Today\'s stamp is in. See you tomorrow.'
      : ja('あと ' + fmt(left) + ' で今日のスタンプ') + '　' + fmt(left) + ' more typing for today\'s stamp.')
      + '<br>' + ja('休んでも消えません') + '　Days off never erase a stamp.';
    const done = $('day-done');
    done.hidden = !c.done;
    done.innerHTML = ja('完成 ' + c.done + '枚') + '　' + c.done + (c.done === 1 ? ' card' : ' cards') + ' done';
    const n = (k, w) => k + ' ' + w + (k === 1 ? '' : 's');
    const mins = (sec) => {
      const m = Math.floor(sec / 60);
      const x = Math.floor(sec % 60);
      return m && x ? n(m, 'minute') + ' ' + n(x, 'second') : m ? n(m, 'minute') : n(x, 'second');
    };
    $('day-sr').textContent = 'Stamp card: ' + days.length + ' of 7 days stamped. Today: ' + (stampedToday ? 'stamped.' : mins(shown) + ' of ' + saved.goal + ' minutes typed.')
      + (c.done ? ' ' + c.done + (c.done === 1 ? ' card' : ' cards') + ' complete.' : '');
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
    renderDayCard(false);
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
    seg('sfx-seg', [
      { value: 'off', html: '<span lang="ja">なし</span>　<small>Off</small>' },
      { value: 'quiet', html: '<span lang="ja">しずか</span>　<small>Quiet</small>' },
      { value: 'all', html: '<span lang="ja">ぜんぶ</span>　<small>All</small>' },
    ], saved.sfx, (v) => {
      saved.sfx = v;
      save();
      if (v === 'off') sleepAudio();
      else wakeAudio();
    });
    seg('music-seg', [
      { value: 'off', html: '<span lang="ja">なし</span>　<small>Off</small>' },
      { value: 'soft', html: '<span lang="ja">小さめ</span>　<small>Soft</small>' },
      { value: 'on', html: '<span lang="ja">あり</span>　<small>On</small>' },
    ], saved.music, (v) => {
      saved.music = v;
      save();
      if (v === 'off') {
        music('stop', 0.2);
        if (r) r.musicOn = false;
        sleepAudio();
      } else {
        wakeAudio();
        music('volume', MUSIC_VOL[v]);
      }
    });
    seg('goal-seg', GOALS.map((n, i) => ({
      value: n, cls: 'tile', html: '<b>' + n + '<small lang="ja">分</small></b><small><span lang="ja">' + ['かるく', 'ふつう', 'しっかり'][i] + '</span>　' + ['Light', 'Regular', 'Solid'][i] + '</small>',
    })), saved.goal, (v) => {
      saved.goal = v;
      // a lower goal can already be met today; a higher one never takes a stamp away
      stampIfDue(!!r && phase !== 'menu');
      save();
      if (phase === 'menu') renderDayCard(false);
      else if (phase === 'result') renderDayCard(true);
    });
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
    // the rings towards the stage's はなまる, or the はなまる itself
    if (o.rings) {
      const meta = b.querySelector('.o-meta');
      if (o.rings >= 3) {
        meta.insertAdjacentHTML('beforeend', ' ' + HANA_ICON(18, 'hana') + '<span class="sr-only"> · ' + ja('はなまる') + '</span>');
      } else {
        meta.insertAdjacentHTML('beforeend', ' <span class="rings" aria-hidden="true">' + [0, 1, 2].map((i) => '<i' + (i < o.rings ? ' class="on"' : '') + '></i>').join('') + '</span><span class="sr-only"> · ' + o.rings + ' of 3 rings towards ' + ja('はなまる') + '</span>');
      }
    }
    return b;
  }
  const sealOf = (key) => (Array.isArray(saved.seal[key]) ? saved.seal[key].length : 0);

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
        rings: sealOf(key),
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
        rings: u.words.length ? sealOf('course:' + level + 'u' + u.n) : 0,
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
      gold: v('--gold'), note: v('--note'),
      dark: lightness(v('--ground')) < 0.5,
    };
  }
  // 0 (black) to 1 (white), for a #rrggbb colour
  function lightness(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return 1;
    const n = parseInt(m[1], 16);
    return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  }
  const safely = (fn, fallback) => {
    try {
      return fn();
    } catch (err) {
      return fallback;
    }
  };

  // A teacher's はなまる: n scallops round a ring of radius R, as an SVG path (also a Path2D).
  function hanamaruPath(R, n) {
    const f = (v) => String(Math.round(v * 100) / 100);
    const step = (2 * Math.PI) / n;
    const a = R * Math.sin(step / 2);
    let d = '';
    for (let i = 0; i < n; i++) {
      const t0 = i * step - Math.PI / 2;
      const t1 = t0 + step;
      if (!i) d += 'M' + f(R * Math.cos(t0)) + ' ' + f(R * Math.sin(t0));
      d += 'A' + f(a) + ' ' + f(a) + ' 0 0 1 ' + f(R * Math.cos(t1)) + ' ' + f(R * Math.sin(t1));
    }
    return d + 'Z';
  }
  const HANAMARU = new Path2D(hanamaruPath(21, 9));
  const HANA_ICON = (size, cls) => '<svg class="' + cls + '" width="' + size + '" height="' + size + '" viewBox="-13 -13 26 26" aria-hidden="true"><path class="hm" d="' + hanamaruPath(9, 9) + '" fill="none" stroke-width="2" stroke-linejoin="round"/><circle class="hm" r="3.2" fill="none" stroke-width="2"/></svg>';
  const HAPPY_MOUTH = new Path2D('M41 54c5 5 13 5 18 0');
  // the gold star of the weak-spot chips, at unit size
  const STAR = new Path2D('M0 -9l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L0 4.9-5.4 7.8l1.1-6.1-4.5-4.3 6.1-.8z');

  // Yaoki, from the drawing the app uses (Main.dc.html): one eye painted, in every pose.
  const DARUMA = {
    body: new Path2D('M50 6c26 0 40 20 40 46 0 24-16 42-40 42S10 76 10 52C10 26 24 6 50 6z'),
    brows: new Path2D('M28 30c6-5 14-5 19 0M53 30c5-5 13-5 19 0'),
    mouth: new Path2D('M44 55c4 3 8 3 12 0'),
    gold: new Path2D('M38 74h24M42 82h16'),
  };
  // his other faces: eyes shut (a blink), dazed after a fall, gritted teeth, a drop of sweat,
  // and brows: normal, worried (a card is close), up (surprise, joy), firm (a smash)
  const FACE = {
    closed: new Path2D('M31 42c4 2 12 2 16 0M53 42c4 2 12 2 16 0'),
    dizzy: new Path2D('M33 37l10 5-10 5M67 37l-10 5 10 5'),
    grit: new Path2D('M43 56h14'),
    sweat: new Path2D('M84 18c3 5 5 8 5 11a5 5 0 0 1-10 0c0-3 2-6 5-11z'),
    brows: {
      normal: DARUMA.brows,
      worried: new Path2D('M28 32c6-2 13-5 19-9M53 23c6 4 13 7 19 9'),
      up: new Path2D('M28 27c6-6 14-6 19-1M53 26c5-5 13-5 19 1'),
      firm: new Path2D('M28 25c6 2 13 4 19 7M53 32c6-3 13-5 19-7'),
    },
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
    drawScene(W, oy / s);
    drawPaper(W, oy / s);
    if (!r) return;
    r.fxDrawn = 0;
    const target = targetCard();
    for (const c of r.cards) if (c.state === 'done') drawCard(c, false);
    drawYaoki();
    drawBubble();
    drawFx();
    for (const c of r.cards) if (c.state !== 'done') drawCard(c, c === target);
    const under = r.fall ? r.fall.card : target;
    if (under) drawUnder(under, W);
  }

  // The round's scene (scenes.js), like a picture pasted into the notebook under its graph
  // paper: it moves with the route, follows the round from start to end, and the season.
  function drawScene(W, pad) {
    const sc = window.TypingScenes;
    if (!r || !r.scene || !sc || typeof sc.draw !== 'function' || r.sceneFailed) return;
    const still = reducedMotion.matches;
    ctx.save();
    try {
      sc.draw(ctx, {
        scene: r.scene, W, top: -pad, bottom: H + pad, ground: GROUND,
        scroll: still ? 0 : r.scroll, progress: Math.min(1, (r.cleared + r.skipped) / r.total), t: still ? 0 : r.time,
        still, dark: pal.dark, season: seasonOf(clock()), pal,
      });
    } catch (err) {
      // a scene that fails is left out for the rest of the round: the paper is enough
      r.sceneFailed = true;
      console.warn(err);
    }
    ctx.restore();
  }
  function seasonOf(t) {
    const m = new Date(t).getMonth() + 1;
    return m >= 3 && m <= 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter';
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
  // step; the others are quiet. A cleared card gets a 済 badge (起 for a comeback), stamped
  // on like a hanko, rides on to Yaoki and settles behind him as a node like the done days on
  // the app's map (drawDone).
  function drawCard(c, isTarget) {
    ctx.save();
    if (c.state === 'done') {
      drawDone(c);
      ctx.restore();
      return;
    }
    let alpha = 1;
    if (c.state === 'fallen' && r.fall) alpha = Math.max(0, Math.min(1, (r.fall.length - r.fall.t) / 0.35));
    ctx.globalAlpha = alpha;
    const top = GROUND - CARD_H;
    let stroke = pal.line;
    let width = 2;
    if (c.state === 'fallen' || c.flashT > 0) {
      stroke = pal.bad;
      width = 2.5;
      cardBox(c, top, pal.badSoft, stroke, width, isTarget);
    } else if (isTarget) {
      stroke = pal.outline;
      cardBox(c, top, pal.card, stroke, width, true);
    } else {
      cardBox(c, top, pal.card, stroke, width, false);
    }
    if (c.entry.weak) weakCorner(c, top, stroke, width);
    cardText(c, top, pal.ink);
    ctx.restore();
  }

  // The 済 landing, as the CSS yk-stamp: from large and turned, down to its place.
  function stampPose(t) {
    const u = Math.min(1, t / STAMP_T);
    if (u < 0.55) {
      const k = ease(u / 0.55);
      return { s: 1.8 - 0.88 * k, tilt: -20 + 10 * k, a: k };
    }
    return { s: 0.92 + 0.08 * ease((u - 0.55) / 0.45), tilt: -10, a: 1 };
  }

  // Where the stamp touches the paper: a ring of ink that spreads and fades, and on a clean
  // card a few drops. Behind the live cards, never over the card being typed.
  function drawInk(c, cx, settle) {
    const tau = c.stampT - 0.55 * STAMP_T;
    if (tau < 0 || (tau >= INK_T && (!c.ink || tau >= DROP_T))) return;
    const onNode = c.inkOn === 'node';
    // the badge shrinks with its card about (cx, GROUND) as it settles: its ink does too
    const sc = onNode ? 1 : 1 - 0.4 * ease(settle);
    const x = onNode ? cx : cx + (c.x + c.w - 4 - cx) * sc;
    const y = onNode ? GROUND - 16 : GROUND - (CARD_H - 4) * sc;
    const fade = onNode ? 1 : 1 - settle;
    let drawn = false;
    ctx.save();
    if (tau < INK_T) {
      const k = tau / INK_T;
      ctx.globalAlpha = 0.5 * (1 - k) * fade;
      ctx.beginPath();
      ctx.arc(x, y, ((onNode ? 15 : 12) + 10 * ease(k)) * sc, 0, Math.PI * 2);
      ctx.lineWidth = 2 * (1 - k);
      ctx.strokeStyle = pal.daruma;
      ctx.stroke();
      drawn = true;
    }
    if (c.ink && tau < DROP_T) {
      const k = tau / DROP_T;
      ctx.globalAlpha = (1 - k) * fade;
      ctx.fillStyle = pal.stamp;
      for (const d of c.ink) {
        const dist = (10 + d.d * ease(k)) * sc;
        ctx.beginPath();
        ctx.arc(x + Math.cos(d.a) * dist, y + Math.sin(d.a) * dist, d.r * sc, 0, Math.PI * 2);
        ctx.fill();
      }
      drawn = true;
    }
    ctx.restore();
    if (drawn && fade > 0) r.fxDrawn++;
  }

  // A weak-spot card's gold folded corner, top left (the 済 badge lands top right).
  function weakCorner(c, top, stroke, width) {
    ctx.save();
    roundRect(c.x, top, c.w, CARD_H, 14);
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(c.x, top);
    ctx.lineTo(c.x + 22, top);
    ctx.lineTo(c.x, top + 22);
    ctx.closePath();
    ctx.fillStyle = pal.gold;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(c.x + 22, top);
    ctx.lineTo(c.x, top + 22);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = pal.outline;
    ctx.stroke();
    ctx.restore();
    roundRect(c.x, top, c.w, CARD_H, 14);
    ctx.lineWidth = width;
    ctx.strokeStyle = stroke;
    ctx.stroke();
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
        fillKana(c, cx, top + 16);
      }
      ctx.font = '600 ' + promptSize(it) + 'px ' + JP;
      ctx.fillStyle = color;
      ctx.fillText(it.text, cx, top + (ruby ? 44 : CARD_H / 2 + 1));
      if (!ruby) fillKana(c, cx, top + CARD_H / 2 + 1);
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

  // The kana already typed turn green on the card: the reading line of a word written in
  // kanji, or the prompt itself. Drawn over the line just drawn, in the font still set.
  function fillKana(c, cx, y) {
    if (c.state !== 'live') return;
    const f = kanaFill(c);
    if (!f || !f.chars) return;
    const line = c.item.fillLine;
    if (f.font !== ctx.font) {
      f.font = ctx.font;
      f.full = ctx.measureText(line).width;
      f.w = ctx.measureText(Array.from(line).slice(0, f.chars).join('')).width;
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - f.full / 2 - 1, y - CARD_H, f.w + 1, 2 * CARD_H);
    ctx.clip();
    ctx.fillStyle = pal.good;
    ctx.fillText(line, cx, y);
    ctx.restore();
  }

  // How many kana of the card's kana line are typed: a kana counts once its letters are all
  // in (hon for ほんや fills ほ; honn fills ほん). Kept per typed string.
  function kanaFill(c) {
    const it = c.item;
    if (it.kind !== 'romaji') return null;
    if (it.fillLen === undefined) {
      const line = it.reading && it.reading !== it.text ? it.reading : it.text;
      const sum = it.units.reduce((n, u) => n + Array.from(u).length, 0);
      it.fillLine = line;
      it.fillLen = Array.from(line).length === sum ? sum : 0;
    }
    if (!it.fillLen) return null;
    if (!c.fill || c.fill.typed !== c.typed) {
      const at = c.typed ? E.unitAt(it.tokens, c.typed) : 0;
      const n = at === null ? it.units.length : at;
      let chars = 0;
      for (let i = 0; i < n; i++) chars += Array.from(it.units[i]).length;
      c.fill = { typed: c.typed, chars, font: null, full: 0, w: 0 };
    }
    return c.fill;
  }

  // 済, as the app stamps it: a red ring with the character in vermilion, tilted (or 起).
  function stamp(x, y, radius, ring, tilt = -10, ch = '済') {
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
    ctx.fillText(ch, 0, radius * 0.06);
    ctx.restore();
  }

  // ---------- cleared cards: they ride on to Yaoki, and he gets past each with a trick ----------
  //
  // A cleared card keeps its place on the route, quiet and stamped, until it reaches Yaoki.
  // Then he gets past it: he jumps over it (a clean card), spins over it (a clean card in a run
  // of five or more), ducks while it sails over him (a card typed with a slip or a hint), or
  // smashes through it (a comeback, a weak-spot card typed clean, a card that waited for him).
  // It lands behind him as its 済 node, inside a はなまる if it was clean. One trick at a time:
  // a card that comes while he is busy, or any card under reduced motion, simply settles.

  function startTrick(c) {
    const yk = r.yk;
    const kind = TRICKS[c.trick] ? c.trick : 'jump';
    const spec = TRICKS[kind];
    c.phase = 'trick';
    yk.hopT = 0;
    yk.trick = {
      kind, card: c, t: 0, len: spec.len * (r.finale !== null ? 0.7 : 1),
      // where the card goes as it passes him, and where its node lands behind him
      pass: view.yx - 22 - c.w - c.x,
      nodeOff: view.yx - NODE_BACK - (c.x + c.w / 2),
      shards: null, hit: false, tilt: (Math.random() - 0.5) * 0.3,
    };
    // its word: beside him at the top of a jump or spin, low beside him for a duck, over the
    // card for a smash (as he hits it)
    const at = { jump: [62, 46], spin: [68, 40], duck: [46, 128], smash: [96, 62] }[kind];
    yk.fx = { ja: spec.ja, t: kind === 'smash' ? -spec.hit * spec.len : 0, x: view.yx + at[0], y: at[1], tilt: kind === 'duck' ? 0.1 : -0.14, big: kind === 'smash' };
    if (kind !== 'smash') sfx(kind);
    r.tricks[kind]++;
  }
  function updateTrick(dt) {
    const tr = r.yk.trick;
    if (!tr) return;
    tr.t += dt;
    if (tr.kind === 'smash' && !tr.hit && tr.t >= TRICKS.smash.hit * tr.len) {
      tr.hit = true;
      tr.shards = shardsOf(tr.card);
      sfx('smash');
    }
    if (tr.shards) {
      for (const s of tr.shards) {
        s.x += s.vx * dt;
        s.vy += 620 * dt;
        s.y += s.vy * dt;
        s.a += s.va * dt;
      }
    }
    if (tr.t >= tr.len) endTrick();
  }
  function endTrick() {
    const tr = r.yk.trick;
    if (!tr) return;
    tr.card.x += tr.nodeOff;
    tr.card.phase = 'node';
    r.yk.trick = null;
  }
  function settleCard(c) {
    c.phase = reducedMotion.matches ? 'node' : 'settle';
    c.settleT = 0;
  }
  // The card in pieces: a grid of torn scraps that fly off ahead of him and fall.
  function shardsOf(c) {
    const cols = Math.max(2, Math.min(8, Math.round(c.w / 40)));
    const pw = c.w / cols;
    const ph = CARD_H / 2;
    const out = [];
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < 2; j++) {
        const jit = () => (Math.random() - 0.5) * 8;
        out.push({
          x: c.x + (i + 0.5) * pw, y: GROUND - CARD_H + (j + 0.5) * ph,
          pts: [[-pw / 2 + jit(), -ph / 2 + jit()], [pw / 2 + jit(), -ph / 2 + jit()], [pw / 2 + jit(), ph / 2 + jit()], [-pw / 2 + jit(), ph / 2 + jit()]],
          vx: 40 + 200 * Math.random() * (1 - i / (cols + 2)), vy: -90 - 170 * Math.random() - (1 - j) * 60, a: 0, va: (Math.random() - 0.5) * 14,
        });
      }
    }
    return out;
  }

  function drawDone(c) {
    const still = reducedMotion.matches;
    const cx = c.x + c.w / 2;
    if (c.phase === 'node') {
      drawNode(c, cx, GROUND - 16, 1, 1);
      return;
    }
    if (c.phase === 'settle') {
      const settle = ease(Math.min(1, c.settleT / SETTLE_T));
      ctx.save();
      ctx.globalAlpha = 1 - settle;
      const sc = 1 - 0.4 * settle;
      ctx.translate(cx, GROUND);
      ctx.scale(sc, sc);
      ctx.translate(-cx, -GROUND);
      rideCard(c, 1);
      ctx.restore();
      drawNode(c, cx, GROUND - 16, 0.7 + 0.3 * settle, Math.min(1, settle * 1.5));
      if (!still) drawInk(c, cx, settle);
      return;
    }
    if (c.phase === 'ride') {
      rideCard(c, 1);
      if (!still) drawInk(c, cx, 0);
      return;
    }
    // a trick
    const tr = r.yk.trick;
    if (!tr || tr.card !== c) {
      drawNode(c, cx, GROUND - 16, 1, 1);
      return;
    }
    const u = Math.min(1, tr.t / tr.len);
    const nodeX = cx + tr.nodeOff;
    if (tr.kind === 'smash') {
      const hit = TRICKS.smash.hit;
      if (u < hit) {
        rideCard(c, 1);
        return;
      }
      const k = (u - hit) / (1 - hit);
      // the flash where he hits it
      if (k < 0.4) {
        ctx.save();
        ctx.globalAlpha = 0.6 * (1 - k / 0.4);
        ctx.beginPath();
        ctx.arc(c.x, GROUND - CARD_H / 2, 14 + 40 * ease(k / 0.4), 0, Math.PI * 2);
        ctx.lineWidth = 3 * (1 - k / 0.4) + 0.5;
        ctx.strokeStyle = pal.gold;
        ctx.stroke();
        ctx.restore();
        r.fxDrawn++;
      }
      // the scraps
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - k * 1.2);
      ctx.fillStyle = pal.card;
      ctx.strokeStyle = pal.line;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = 'round';
      for (const s of tr.shards || []) {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.a);
        ctx.beginPath();
        ctx.moveTo(s.pts[0][0], s.pts[0][1]);
        for (let i = 1; i < 4; i++) ctx.lineTo(s.pts[i][0], s.pts[i][1]);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
      // its stamp flies over him and lands behind him as the node
      const f = ease(Math.min(1, k / 0.75));
      const bx = c.x + c.w - 4;
      const by = GROUND - CARD_H + 4;
      const x = bx + (nodeX - bx) * f;
      const y = by + (GROUND - 16 - by) * f - 70 * Math.sin(Math.PI * f);
      drawNode(c, x, y, 0.8 + 0.2 * f, 1, f < 1 ? 6 * f : 0);
      return;
    }
    const [a, b] = TRICKS[tr.kind].pass;
    let dx = tr.pass * smooth(a, b, u);
    let dy = 0;
    let rot = 0;
    if (u > b) dx -= 26 * (u - b) / (1 - b);
    if (tr.kind === 'duck') {
      // it sails up over his head, turning a little like a paper in the wind
      const up = smooth(0.02, 0.24, u);
      dy = -58 * up;
      rot = (-0.1 + tr.tilt) * up;
    }
    const fade = 1 - smooth(b, Math.min(1, b + 0.18), u);
    if (fade > 0) {
      ctx.save();
      ctx.translate(cx + dx, GROUND - CARD_H / 2 + dy);
      ctx.rotate(rot);
      ctx.translate(-cx, -(GROUND - CARD_H / 2));
      rideCard(c, fade);
      ctx.restore();
      // speed lines behind it as it rushes past
      if (u > a && u < b) {
        ctx.save();
        ctx.globalAlpha = 0.5 * fade;
        ctx.strokeStyle = pal.lineStrong;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        const rx = c.x + c.w + dx + 8;
        for (const ly of [0.25, 0.5, 0.75]) {
          const yy = GROUND - CARD_H + CARD_H * ly + dy;
          ctx.moveTo(rx, yy);
          ctx.lineTo(rx + 16 + 10 * ly, yy);
        }
        ctx.stroke();
        ctx.restore();
        r.fxDrawn++;
      }
    }
    const land = smooth(b - 0.06, 1, u);
    if (land > 0) drawNode(c, nodeX, GROUND - 16, 0.7 + 0.3 * land, Math.min(1, land * 1.5));
  }

  // A cleared card as it rides on: quiet, with its stamp.
  function rideCard(c, alpha) {
    const still = reducedMotion.matches;
    const pose = still ? { s: 1, tilt: -10, a: 1 } : stampPose(c.stampT);
    ctx.save();
    ctx.globalAlpha *= alpha;
    cardBox(c, GROUND - CARD_H, pal.card, pal.line, 2, false);
    cardText(c, GROUND - CARD_H, pal.muted);
    ctx.globalAlpha *= pose.a;
    stamp(c.x + c.w - 4, GROUND - CARD_H + 4, 12 * pose.s, 2, pose.tilt, c.comeback ? '起' : '済');
    ctx.restore();
  }

  // A node on the route: 済 (起 for a comeback, with a gold ring), inside a はなまる if the card
  // was clean, with a star if it held a weak spot.
  function drawNode(c, x, y, k, alpha, spin = 0) {
    if (alpha <= 0) return;
    const ch = c.comeback ? '起' : '済';
    ctx.save();
    ctx.globalAlpha *= alpha;
    if (c.clean) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-9 * Math.PI / 180 + spin);
      ctx.scale(k, k);
      ctx.lineWidth = 1.8 / k;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = pal.stamp;
      ctx.stroke(HANAMARU);
      ctx.restore();
    }
    if (c.comeback) {
      ctx.beginPath();
      ctx.arc(x, y, 15 * k + 3.5, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = pal.gold;
      ctx.stroke();
    }
    stamp(x, y, 15 * k, 2.5, -9 + spin * 57, ch);
    if (c.star) {
      ctx.save();
      ctx.translate(x + 19, y + 12);
      ctx.scale(0.62 * k, 0.62 * k);
      ctx.fillStyle = pal.gold;
      ctx.fill(STAR);
      ctx.lineWidth = 2.2;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = pal.outline;
      ctx.stroke(STAR);
      ctx.restore();
    }
    ctx.restore();
  }

  // ---------- Yaoki: his pose, his tricks, his words ----------
  //
  // Yaoki is drawn from a pose: where he stands (x, lift), how he leans (rot), his squash and
  // stretch (sx, sy), where he looks, and his face (eyes, brows, mouth). The pose is built each
  // frame from what is going on: rocking along the route, breathing and blinking, a nod for each
  // right key, a worried look when the card being typed is close, a fall and the dizzy stars,
  // a hop, and a trick as a cleared card passes him. Under reduced motion only the face changes.

  function yaokiPose() {
    const still = reducedMotion.matches;
    const yk = r ? r.yk : null;
    const p = { x: view.yx, lift: 0, rot: 0, sx: 1, sy: 1, lookX: 0, lookY: 0, eyes: 'open', brows: 'normal', mouth: 'normal', blush: false, sweat: false, dizzy: 0 };
    if (!r) return p;
    const t = r.time;

    // the fall: down, then up again with a wobble (the toy rights itself)
    if (r.fall) {
      const ft = r.fall.t;
      const L = r.fall.length;
      const down = -1.35;
      const rise = L * 0.5;
      if (still) p.rot = ft < rise ? down : 0;
      else if (ft < 0.22) p.rot = down * ease(ft / 0.22);
      else if (ft < rise) p.rot = down;
      else {
        const u = (ft - rise) / (L - rise);
        p.rot = down * Math.exp(-4.5 * u) * Math.cos(11 * u);
      }
      if (ft >= 0.12 && ft < rise) {
        p.eyes = 'dizzy';
        p.mouth = 'o';
        p.dizzy = still ? 0.5 : ft;
      } else {
        p.brows = 'up';
      }
      return p;
    }

    // rocking along the route, and breathing
    if (!still && phase === 'play') {
      p.rot = Math.sin(r.rock * Math.PI) * (5 * Math.PI / 180);
      const breath = Math.sin((t * 2 * Math.PI) / 2.2) * 0.022;
      p.sy *= 1 + breath;
      p.sx *= 1 - breath * 0.6;
    }
    // a little nod for each right key
    if (!still && yk.nodT > 0) {
      const k = Math.sin(Math.PI * (1 - yk.nodT / NOD_T));
      p.sy *= 1 - 0.07 * k;
      p.sx *= 1 + 0.04 * k;
    }
    // a hop (a step of the clean run, a comeback): stretch going up, squash on landing
    if (!still && yk.hopT > 0) {
      const u = 1 - yk.hopT / HOP_T;
      p.lift = yk.hopH * Math.sin(Math.PI * u);
      const s = u < 0.5 ? 0.08 : -0.1 * Math.sin(Math.PI * (u - 0.5) * 2);
      p.sy *= 1 + s;
      p.sx *= 1 - s * 0.6;
    }

    // the face: looking at the card being typed, worried when it is close, happy in a run
    const target = targetCard();
    if (target) {
      p.lookX = 1;
      const near = target.halted ? 0 : (target.x - (view.yx + REACH)) / Math.max(1, r.speed);
      if (near < 1.6 && !target.halted) {
        p.brows = 'worried';
        p.sweat = near < 0.9;
        p.mouth = 'o';
      }
    }
    if (isHappy()) {
      p.mouth = 'happy';
      p.blush = true;
      if (p.brows === 'worried') p.mouth = 'o';
    }
    if (!still && yk.blinkT >= 0 && yk.blinkT < BLINK_T) p.eyes = 'closed';

    // a trick past a cleared card
    const tr = yk.trick;
    if (tr && !still) trickPose(tr, p);
    return p;
  }

  // Each trick, as curves over u = 0..1 of its length.
  const smooth = (a, b, u) => {
    const k = Math.min(1, Math.max(0, (u - a) / (b - a)));
    return k * k * (3 - 2 * k);
  };
  function trickPose(tr, p) {
    const u = Math.min(1, tr.t / tr.len);
    if (tr.kind === 'jump' || tr.kind === 'spin') {
      const [a, b] = tr.kind === 'jump' ? [0.14, 0.74] : [0.16, 0.8];
      const H = tr.kind === 'jump' ? 92 : 102;
      if (u < a) {
        const k = Math.sin(Math.PI * u / a);
        p.sy *= 1 - 0.16 * k;
        p.sx *= 1 + 0.12 * k;
      } else if (u < b) {
        const k = (u - a) / (b - a);
        p.lift = H * Math.sin(Math.PI * k);
        p.sy *= 1.08 - 0.08 * k;
        p.sx *= 0.94 + 0.06 * k;
        p.lookY = 1;
        p.mouth = 'happy';
        if (tr.kind === 'spin') p.rot = 2 * Math.PI * smooth(0.05, 0.95, k);
      } else {
        const k = Math.sin(Math.PI * Math.min(1, (u - b) / 0.14));
        p.sy *= 1 - 0.14 * k;
        p.sx *= 1 + 0.1 * k;
      }
      p.brows = 'up';
    } else if (tr.kind === 'duck') {
      const k = smooth(0.04, 0.2, u) * (1 - smooth(0.68, 0.84, u));
      p.sy *= 1 - 0.42 * k;
      p.sx *= 1 + 0.24 * k;
      p.lookY = -1;
      p.lookX = -0.4 * k;
      p.brows = 'up';
      p.mouth = 'o';
    } else if (tr.kind === 'smash') {
      const hit = TRICKS.smash.hit;
      if (u < hit - 0.08) {
        const k = smooth(0, hit - 0.08, u);
        p.rot = -0.3 * k;
        p.sx *= 1 - 0.06 * k;
        p.sy *= 1 + 0.05 * k;
      } else if (u < hit) {
        const k = smooth(hit - 0.08, hit, u);
        p.rot = -0.3 + 0.62 * k;
        p.x += 30 * k;
      } else {
        const k = (u - hit) / (1 - hit);
        p.x += 30 * (1 - smooth(0, 0.5, k));
        p.rot = 0.32 * Math.exp(-5 * k) * Math.cos(9 * k);
        const sq = Math.exp(-7 * k);
        p.sx *= 1 + 0.16 * sq;
        p.sy *= 1 - 0.12 * sq;
      }
      p.brows = 'firm';
      p.mouth = u < hit + 0.1 ? 'grit' : 'happy';
    }
  }

  function drawYaoki() {
    const p = yaokiPose();
    const yk = r ? r.yk : null;
    if (yk) {
      yk.lift = p.lift;
      yk.liftMax = Math.max(yk.liftMax, p.lift);
    }
    // the shadow stays on the route and shrinks as he goes up
    const shade = Math.max(0.35, 1 - p.lift / 140);
    ctx.fillStyle = pal.line;
    ctx.beginPath();
    ctx.ellipse(p.x, GROUND + 2, 22 * shade, 4 * shade, 0, 0, Math.PI * 2);
    ctx.fill();
    // a spin leaves a trail of little stars
    if (yk && yk.trick && yk.trick.kind === 'spin' && p.lift > 4 && phase === 'play' && yk.trail.length < 16) {
      const lastSt = yk.trail[yk.trail.length - 1];
      if (!lastSt || lastSt.age > 0.03) yk.trail.push({ x: p.x + (Math.random() - 0.5) * 16, y: GROUND - p.lift - 30 + (Math.random() - 0.5) * 16, age: 0 });
    }
    if (yk && yk.trail.length) drawTrail(yk.trail);
    drawDaruma(p);
  }

  // Yaoki, from the drawing the app uses (Main.dc.html): one eye painted, in every pose. The
  // scale about his base gives squash and stretch; the rotation is about his base too, as a
  // daruma rocks.
  function drawDaruma(p) {
    ctx.save();
    ctx.translate(p.x, GROUND - p.lift);
    // a spin turns about his middle, not his base
    if (p.lift > 0 && Math.abs(p.rot) > 0.5) {
      ctx.translate(0, -29);
      ctx.rotate(p.rot);
      ctx.translate(0, 29);
    } else {
      ctx.rotate(p.rot);
    }
    ctx.scale(YAOKI * p.sx, YAOKI * p.sy);
    ctx.translate(-50, -94);
    ctx.fillStyle = '#E2452B';
    ctx.fill(DARUMA.body);
    ctx.fillStyle = '#FFF6EA';
    ctx.beginPath();
    ctx.ellipse(50, 42, 27, 23, 0, 0, Math.PI * 2);
    ctx.fill();
    if (p.blush) {
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#F59A8A';
      for (const bx of [31, 69]) {
        ctx.beginPath();
        ctx.ellipse(bx, 55, 5, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1B2440';
    ctx.fillStyle = '#1B2440';
    if (p.eyes === 'open') {
      ctx.lineWidth = 2.5;
      for (const ex of [39, 61]) {
        ctx.beginPath();
        ctx.arc(ex, 42, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.stroke();
      }
      // only the right eye is painted: its pupil looks where he looks
      ctx.fillStyle = '#1B2440';
      ctx.beginPath();
      ctx.arc(61 + 2.4 * p.lookX, 42 + 2.4 * p.lookY, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.eyes === 'closed') {
      ctx.lineWidth = 2.5;
      ctx.stroke(FACE.closed);
    } else {
      ctx.lineWidth = 2.5;
      ctx.stroke(FACE.dizzy);
    }
    ctx.lineWidth = 3;
    ctx.stroke(FACE.brows[p.brows] || DARUMA.brows);
    if (p.mouth === 'o') {
      ctx.beginPath();
      ctx.ellipse(50, 57, 3.2, 4.2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.lineWidth = 2.5;
      ctx.stroke(p.mouth === 'happy' ? HAPPY_MOUTH : p.mouth === 'grit' ? FACE.grit : DARUMA.mouth);
    }
    ctx.strokeStyle = '#F2B43A';
    ctx.lineWidth = 3.5;
    ctx.stroke(DARUMA.gold);
    // a drop of sweat when a card is about to reach him
    if (p.sweat) {
      ctx.fillStyle = '#9FD3F5';
      ctx.strokeStyle = '#1B2440';
      ctx.lineWidth = 2;
      ctx.fill(FACE.sweat);
      ctx.stroke(FACE.sweat);
    }
    // stars round his head while he is down
    if (p.dizzy) {
      for (let i = 0; i < 3; i++) {
        const a = p.dizzy * 5 + (i * 2 * Math.PI) / 3;
        ctx.save();
        ctx.translate(50 + Math.cos(a) * 30, -6 + Math.sin(a) * 9);
        ctx.scale(0.62, 0.62);
        ctx.fillStyle = '#F2B43A';
        ctx.fill(STAR);
        ctx.lineWidth = 2.6;
        ctx.strokeStyle = '#1B2440';
        ctx.stroke(STAR);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  function drawTrail(trail) {
    ctx.save();
    for (const s of trail) {
      const a = 1 - s.age / TRAIL_T;
      if (a <= 0) continue;
      ctx.globalAlpha = a * 0.9;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.age * 6);
      ctx.scale(0.45 * a + 0.15, 0.45 * a + 0.15);
      ctx.fillStyle = pal.gold;
      ctx.fill(STAR);
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = pal.outline;
      ctx.stroke(STAR);
      ctx.restore();
    }
    ctx.restore();
  }

  const isHappy = () => !!(r && !r.fall && (r.yk.happyT > 0 || r.run >= 5));
  function hop(h) {
    if (r.fall || r.yk.trick) return;
    const t = targetCard();
    if (t && t.halted) return;
    r.yk.hopT = HOP_T;
    r.yk.hopH = h;
  }

  // A word from Yaoki in a bubble, with a little item beside it. Lines come from items.js
  // (several for each occasion) or the few built in here; a newer line replaces the one
  // showing unless that one matters more (a step of the run over a nudge).
  const OWN_LINES = {
    start: [{ ja: 'いくよ！', en: "Let's go", item: 'koinobori' }],
    half: [{ ja: 'はんぶん！', en: 'Halfway', item: 'dango' }],
    last: [{ ja: 'ラスト！', en: 'Last one', item: 'flag' }],
    step0: [{ ja: 'いいね！', en: 'Nice', item: 'sakura' }],
    step1: [{ ja: 'すごい！', en: 'Great', item: 'star' }],
    step2: [{ ja: 'さすが！', en: 'Brilliant', item: 'fireworks' }],
    step3: [{ ja: 'かんぺき！', en: 'Spotless', item: 'fuji' }],
    comeback: [{ ja: 'もう大丈夫！', en: 'Got it now', item: 'onigiri' }],
    rise: [{ ja: 'よいしょ！', en: 'Up again', item: 'sweat' }],
    halt: [{ ja: 'ゆっくりでいい', en: 'Take your time', item: 'tea' }],
    star: [{ ja: 'にがて克服！', en: 'Weak spot down', item: 'star' }],
    record: [{ ja: '新記録！', en: 'New record', item: 'fan' }],
    endGood: [{ ja: 'やったね！', en: 'Well done', item: 'fireworks' }],
    endOk: [{ ja: 'おつかれ！', en: 'Good work', item: 'tea' }],
    endTry: [{ ja: 'つぎがある！', en: 'Next time', item: 'onigiri' }],
    idle: [{ ja: 'うーん…', en: 'Hmm…', item: 'dango' }],
  };
  const PRIORITY = { step0: 3, step1: 3, step2: 3, step3: 3, record: 3, comeback: 2, rise: 2, halt: 2, star: 2, last: 2, endGood: 3, endOk: 3, endTry: 3, start: 1, half: 1, idle: 0 };
  const said = {};
  function lineFor(occasion, first) {
    const lib = window.TypingItems && window.TypingItems.LINES && window.TypingItems.LINES[occasion];
    const list = Array.isArray(lib) && lib.length ? lib : OWN_LINES[occasion] || [];
    if (!list.length) return null;
    // the cheers for the steps of the run, and the first of a kind in a round, keep their
    // first line; the rest take turns
    if (first) {
      const own = OWN_LINES[occasion] && OWN_LINES[occasion][0];
      return (own && list.find((x) => x.ja === own.ja)) || list[0];
    }
    said[occasion] = ((said[occasion] || 0) + 1) % list.length;
    return list[said[occasion]] || list[0];
  }
  function cheer(occasion, life, opts = {}) {
    const yk = r.yk;
    const line = lineFor(occasion, !!opts.first);
    if (!line) return;
    const prio = PRIORITY[occasion] || 0;
    if (yk.bubble && yk.bubble.prio > prio && yk.bubble.t < yk.bubble.life) return;
    yk.bubble = { ja: line.ja, en: line.en, item: line.item, occasion, prio, t: 0, life };
  }

  // The bubble: left of Yaoki and above his head, clear of the cards (they are all to his
  // right) and of the route; its item sits at its left.
  function drawBubble() {
    const b = r.yk.bubble;
    r.yk.box = null;
    if (!b) return;
    const still = reducedMotion.matches;
    const yx = view.yx;
    const jaSize = small(13);
    const enSize = small(9);
    const items = window.TypingItems;
    const icon = b.item && items && items.draw ? Math.round(jaSize + enSize) : 0;
    ctx.save();
    ctx.font = '600 ' + jaSize + 'px ' + JP;
    const wJa = ctx.measureText(b.ja).width;
    ctx.font = '800 ' + enSize + 'px ' + UI;
    const wEn = ctx.measureText(b.en).width;
    const w = Math.ceil(Math.max(wJa, wEn)) + 14 + (icon ? icon + 6 : 0);
    const h = 8 + jaSize + 2 + enSize + 8;
    const right = yx - 6;
    const x = Math.max(4, right - w);
    // a wide bubble on a narrow screen reaches past Yaoki: it goes up, clear of the card tops
    const bottom = x + w > yx + REACH - 6 ? GROUND - CARD_H - 4 : 104;
    const y = bottom - h;
    const tipX = yx - 8;
    const tipY = 114;
    const pop = still ? 1 : 0.8 + 0.2 * ease(Math.min(1, b.t / BUBBLE_POP));
    ctx.translate(tipX, tipY);
    ctx.scale(pop, pop);
    ctx.translate(-tipX, -tipY);
    // one outline: a rounded box with the tail let into its bottom edge, near the right
    const shape = (dy) => {
      const t = y + dy;
      const btm = bottom + dy;
      const tr = x + w - 10;
      ctx.beginPath();
      ctx.moveTo(x + 10, t);
      ctx.arcTo(x + w, t, x + w, btm, 10);
      ctx.arcTo(x + w, btm, x, btm, 10);
      ctx.lineTo(tr, btm);
      ctx.lineTo(tipX, tipY + dy);
      ctx.lineTo(tr - 12, btm);
      ctx.arcTo(x, btm, x, t, 10);
      ctx.arcTo(x, t, x + w, t, 10);
      ctx.closePath();
    };
    shape(3);
    ctx.fillStyle = pal.hard;
    ctx.fill();
    shape(0);
    ctx.fillStyle = pal.card;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = pal.outline;
    ctx.stroke();
    if (icon) {
      try {
        items.draw(ctx, b.item, x + 7 + icon / 2, y + h / 2, icon, pal, still ? 0 : r.time);
      } catch (err) {
        // an item that cannot be drawn is left out
      }
    }
    const tx = x + (icon ? icon + 6 : 0) + (w - (icon ? icon + 6 : 0)) / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = pal.ink;
    ctx.font = '600 ' + jaSize + 'px ' + JP;
    ctx.fillText(b.ja, tx, y + 8 + jaSize / 2);
    ctx.fillStyle = pal.muted;
    ctx.font = '800 ' + enSize + 'px ' + UI;
    ctx.fillText(b.en, tx, y + h - 8 - enSize / 2);
    ctx.restore();
    r.yk.box = { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
  }

  // A trick's sound word, drawn like a comic's: ぴょん, ひょい, くるりん, どーん！ Above the
  // cards' tops, near Yaoki, and gone in half a second.
  function drawFx() {
    const fx = r.yk.fx;
    if (!fx || fx.t < 0) return;
    const u = fx.t / FX_T;
    if (u >= 1) return;
    const size = small(fx.big ? 22 : 16);
    const pop = u < 0.2 ? 0.6 + 0.4 * ease(u / 0.2) : 1;
    ctx.save();
    ctx.globalAlpha = u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3;
    ctx.translate(fx.x, fx.y - 10 * u);
    ctx.rotate(fx.tilt);
    ctx.scale(pop, pop);
    ctx.font = '800 ' + size + 'px ' + UI;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, size / 5);
    ctx.strokeStyle = pal.card;
    ctx.strokeText(fx.ja, 0, 0);
    ctx.fillStyle = fx.big ? pal.stamp : pal.ink;
    ctx.fillText(fx.ja, 0, 0);
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
    // the newest letter pops: drawn a little larger for a moment, about its own centre (the
    // grey hint and the green letters typed before it are drawn around it, not under it)
    const pop = done && c.popT > 0 && !reducedMotion.matches ? 1 + 0.3 * (c.popT / POP_T) : 1;
    ctx.fillStyle = pal.muted;
    if (pop > 1) ctx.fillText(text.slice(done.length), x + ctx.measureText(done).width, y);
    else ctx.fillText(text, x, y);
    if (done) {
      ctx.fillStyle = pal.good;
      if (pop > 1) {
        const head = done.slice(0, -1);
        const w0 = ctx.measureText(head).width;
        const w1 = ctx.measureText(done.slice(-1)).width;
        ctx.fillText(head, x, y);
        ctx.save();
        ctx.translate(x + w0 + w1 / 2, y);
        ctx.scale(pop, pop);
        ctx.fillText(done.slice(-1), -w1 / 2, 0);
        ctx.restore();
      } else {
        ctx.fillText(done, x, y);
      }
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
  document.querySelector('#res-hana path').setAttribute('d', hanamaruPath(66, 12));
  setPhase('menu');
  renderSettings();

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('resize', () => resize());
  if (window.ResizeObserver) new ResizeObserver(() => resize()).observe(canvas.parentElement);
  window.addEventListener('blur', () => {
    if (phase === 'play') setPhase('paused');
  });
  // A page hidden or closed mid-round keeps the typing time so far for the day's stamp.
  function creditAway() {
    if (r && (phase === 'play' || phase === 'paused')) {
      creditPractice();
      save();
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      if (phase === 'menu') renderDayCard(false);
      return;
    }
    if (phase === 'play') setPhase('paused');
    creditAway();
  });
  window.addEventListener('pagehide', creditAway);
  window.addEventListener('pageshow', () => {
    if (phase === 'menu') renderDayCard(false);
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
    if (r) {
      creditPractice();
      keepMisses();
    }
    toMenu();
  });
  $('res-next').addEventListener('click', () => {
    const next = r && !r.course ? nextStage(r.key) : null;
    if (!next) return;
    saved.stage[r.key.split(':')[0]] = next.id;
    save();
    clearTimers();
    startRound(false);
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
    wakeAudio();
  });

  requestAnimationFrame((now) => {
    last = now;
    requestAnimationFrame(frame);
  });

  // Read-only view of the round, for the browser checks in check/typing-test.js.
  window.ykTyping = {
    state() {
      const t = targetCard();
      const fill = t ? kanaFill(t) : null;
      const yk = r ? r.yk : null;
      return {
        phase,
        mode: saved.mode,
        target: t ? {
          text: t.item.text, reading: t.item.reading || null, typed: t.typed,
          spell: t.item.kind === 'romaji' ? E.spell(t.item.tokens, t.typed) : null,
          key: t.item.key || null, code: t.item.code || null, shift: !!t.item.shift, level: hintLevel(t), halted: t.halted,
          kanaDone: fill ? fill.chars : 0, kanaLen: fill ? t.item.fillLen : 0, weak: !!t.entry.weak,
        } : null,
        run: r ? r.run : 0,
        bestRun: r ? r.bestRun : 0,
        comebacks: r ? r.comebacks : 0,
        graduated: r ? [...r.graduated] : [],
        weakCards: r ? { dealt: r.weakDealt, clean: r.weakClean } : null,
        practice: r ? Math.round(r.practice * 10) / 10 : 0,
        day: { d: localDay(), s: todaySec(), goal: saved.goal, stamped: saved.stampCard.lastDay === localDay() },
        stampCard: { days: saved.stampCard.days.slice(), done: saved.stampCard.done },
        sfx: saved.sfx,
        yaoki: yk ? { bubble: yk.bubble ? yk.bubble.ja : null, item: yk.bubble ? yk.bubble.item : null, happy: isHappy(), hop: yk.lift > 0, liftMax: yk.liftMax, box: yk.box, trick: yk.trick ? yk.trick.kind : null } : null,
        tricks: r ? Object.assign({}, r.tricks) : null,
        scene: r ? r.scene : null,
        sceneFailed: !!(r && r.sceneFailed),
        song: r ? r.song : null,
        music: saved.music,
        fx: r ? r.fxDrawn : 0,
        cleared: r ? r.cleared : 0,
        skipped: r ? r.skipped : 0,
        total: r ? r.total : 0,
        falls: r ? r.falls : 0,
        falling: !!(r && r.fall),
        back: r && r.fall ? r.fall.back : null,
        answerShown: r && r.fall ? hintLevel(r.fall.card) >= 2 : null,
        W: view.W,
        cards: r ? r.cards.map((c) => ({ text: c.item.text, x: Math.round(c.x), w: Math.round(c.w), state: c.state, clean: c.clean, comeback: c.comeback, star: c.star, phase: c.phase || null, trick: c.trick || null })) : [],
        clean: r ? r.clean : 0,
        speed: r ? r.speed : 0,
        T: r ? r.T : 0,
      };
    },
  };
})();
