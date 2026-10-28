/*
 * Yaoki Speaking: a round of cards said out loud, on a phone or tablet held upright. Two ways to play:
 *
 * - Falling (ふってくる): things come down on Yaoki, each with a word on it, and saying the word breaks it (or Yaoki
 *   gets out of its way) before it lands on him. One that lands squashes him flat; he pops back up like the toy he is
 *   (七転び八起き) and it comes back later in the round, after about three other cards. One that has squashed him twice
 *   stops above him, on his umbrella, with its reading shown, and waits; the skip button passes it over.
 * - Climb (のぼる): ledges above Yaoki, each with a word on its sign; saying the word makes him jump up to it. There is
 *   no hurry. A word heard wrong and he slips back down, and gets up again; after two slips the sign shows its reading
 *   and the skip button lets him climb past it.
 *
 * What the phone heard is listened for by listen.js and checked by voice.js, as it is said: the part of the card
 * heard so far turns green, a card is cleared the moment it has been said, and a near miss is named (a small っ, a long
 * vowel). Pacing in Falling is measured, as in Yaoki Typing: per stage the game keeps the player's reaction (card shown
 * to the first word heard) and speaking rate (beats a second), and spaces the things so each comes about 1.2 × the time
 * the one before it needs; the speed is set once a round from the longest card.
 *
 * What it rewards is the same as Yaoki Typing's: saying it right the first time with no hint (a はなまる, and a clean
 * run, 連続, that Yaoki cheers at 5, 10, 20 and 40), getting up again (a card that knocked him over, said clean when it
 * comes back, is stamped 起), weak spots (a gold corner) and showing up (a seven-day stamp card for a day's speaking
 * time, and three たいへんよくできました on three days for a stage's はなまる). None of it touches the learning data.
 *
 * The places are drawn by world.js, Yaoki's lines and their items come from Yaoki Typing's items.js, the sound
 * effects and the music from its sfx.js and music.js, and the kana and kanji lists from its engine.js. Each of those
 * modules is optional but engine.js: without one, the round is plain paper, silent, or uses the few lines built in.
 */
(function () {
  'use strict';

  const E = window.TypingEngine;
  const V = window.SpeakingVoice;
  const L = window.SpeakingListen;
  const $ = (id) => document.getElementById(id);
  const STORE = 'yaoki.speaking.v1';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const darkScheme = window.matchMedia('(prefers-color-scheme: dark)');
  const touchOnly = window.matchMedia('(hover: none) and (pointer: coarse)');
  const sideways = window.matchMedia('(orientation: landscape) and (max-height: 520px)');

  const VW = 240;              // the world's width in logical units, at its narrowest
  const YAOKI = 0.6;           // Yaoki's size: the app's 100-unit drawing at 60%
  const YH = 56;               // his height, about, in units
  const GROUND_UP = 34;        // Falling: the ground, this far above the bottom of the view
  const SLACK = 1.2;           // things come 20% slower than the player's measured pace
  const START = {              // first measures for a stage: reaction (s, the recognition's delay in it) and beats a second
    course: { r: 2.6, p: 3 },
    kana: { r: 2.4, p: 3 },
    kanji: { r: 3.4, p: 3 },   // a kanji's reading is recalled before it is said
    phrase: { r: 2.4, p: 3.5 },
  };
  const STUCK_FIRST = 6;       // seconds without a word before the first step of a hint
  const STUCK_NEXT = 5;        // and again before the second
  const RUN_STEPS = [5, 10, 20, 40];
  const GOALS = [3, 5, 10];    // minutes of speaking a day for the day's stamp
  const PRACTICE_IDLE = 8;     // seconds without a word after which speaking time stops counting
  const STAMP_T = 0.32;        // a 済 landing, on the curve of the app's yk-stamp
  const INK_T = 0.25;
  const HOP_T = 0.4;
  const HAPPY_T = 0.6;
  const CHEER_T = 1.2;
  const BUBBLE_POP = 0.15;
  const NOD_T = 0.16;
  const BLINK_T = 0.12;
  const FX_T = 0.7;
  const FLASH_T = 0.35;
  const CRUSH_T = 1.7;         // Falling: squashed flat, and back up
  const SLIP_T = 1.3;          // Climb: a slip back down, and up again
  const JUMP_T = 0.62;         // Climb: a jump up to the next ledge
  const STEP = 128;            // Climb: the least height from one ledge to the next
  const DAY_TILTS = [-9, 6, -4, 8, -7, 5, -10];
  // what Yaoki does once a card is said: by how it was said
  const TRICKS = {
    pop: { ja: 'パリン', len: 0.55 },
    spin: { ja: 'くるりん', len: 0.8 },
    dodge: { ja: 'ころころ', len: 0.85 },
    smash: { ja: 'どーん！', len: 0.75 },
    hop: { ja: 'ぴょん', len: JUMP_T },
    scramble: { ja: 'よじよじ', len: JUMP_T + 0.25 },
    super: { ja: 'どーん！', len: JUMP_T + 0.1 },
  };

  // ---------- what is kept between visits ----------

  const DEFAULTS = {
    mode: null, stage: {}, level: null, unit: {}, style: 'fall', hints: 'stuck', len: 10, mic: 'free', sound: true,
    sfx: 'quiet', music: 'soft', goal: 5, best: {}, pace: {}, stats: {}, practice: null,
    stampCard: { days: [], done: 0, lastDay: null }, run: {}, seal: {},
  };
  let saved = load();
  sanitize();

  // Any old or odd save still loads.
  function sanitize() {
    const pick = (k, list, d) => {
      if (!list.includes(saved[k])) saved[k] = d;
    };
    pick('style', ['fall', 'climb'], 'fall');
    pick('hints', ['always', 'stuck', 'never'], 'stuck');
    pick('mic', ['free', 'hold'], 'free');
    pick('sfx', ['off', 'quiet', 'all'], 'quiet');
    pick('music', ['off', 'soft', 'on'], 'soft');
    pick('len', [5, 10, 20], 10);
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
    for (const k of ['stage', 'unit', 'best', 'pace', 'stats', 'run', 'seal']) {
      if (!saved[k] || typeof saved[k] !== 'object' || Array.isArray(saved[k])) saved[k] = {};
    }
  }

  // The day, by the local calendar (window.__ykNow is the tests' clock).
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
      // storage can be refused (a private window): the page works, nothing is kept
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

  // Misses are kept per card (the word said). Like the app's mistake notebook, a word leaves the list after three
  // clean answers in a row.
  function bucket(name) {
    return saved.stats[name] || (saved.stats[name] = {});
  }
  function markMiss(name, key) {
    const b = bucket(name);
    const v = b[key] || (b[key] = { miss: 0, ok: 0 });
    v.miss++;
    v.ok = 0;
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
    const root = location.pathname.replace(/speaking\/(index\.html)?$/, '');
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

  // ---------- ways to play, modes, stages and course words ----------

  const STYLES = {
    fall: { ja: 'ふってくる', en: 'Falling', desc: 'Things fall on Yaoki. Say the word on each one before it lands on him.' },
    climb: { ja: 'のぼる', en: 'Climb', desc: 'Say the word on the ledge above, and Yaoki jumps up to it. No hurry.' },
  };
  const MODES = {
    course: { ja: '語彙', en: 'Course words', stats: 'course', desc: 'The words of a week of your Yaoki course, with their readings. Say each one; a cleared word is said back to you.' },
    kana: { ja: 'かな', en: 'Kana', stats: 'kana', desc: 'Kana and katakana, words, and pairs of words that differ only by a long sound or a small っ. Say what the card says.' },
    kanji: { ja: '漢字', en: 'Kanji', stats: 'kanji', desc: 'Advanced: say the reading of the kanji. When you are stuck, or after a slip, the reading (furigana) and its romaji show; a card said without them is clean.' },
    phrase: { ja: 'あいさつ・文', en: 'Phrases', stats: 'phrase', desc: 'Greetings, short sentences and tongue twisters (早口言葉), each said in one go.' },
  };
  const MODE_ORDER = ['course', 'kana', 'kanji', 'phrase'];
  const kanaStage = (id) => E.KANA_STAGES.find((s) => s.id === id);
  const STAGES = {
    kana: [kanaStage('basic'), kanaStage('voiced'), kanaStage('katakana'), kanaStage('words'), V.STAGES.pairs].filter(Boolean),
    kanji: E.KANJI_STAGES,
    phrase: [V.STAGES.greet, kanaStage('phrases'), V.STAGES.twister].filter(Boolean),
  };
  // single sounds are the hardest thing for a phone to hear
  const SINGLE_SOUNDS = new Set(['kana:basic', 'kana:voiced', 'kana:katakana']);
  const LEVELS = ['N5', 'N4', 'N3', 'N2'];

  if (!MODES[saved.mode]) saved.mode = place ? 'course' : 'kana';
  if (!LEVELS.includes(saved.level)) saved.level = place && LEVELS.includes(place.level) ? place.level : 'N5';
  if (!saved.stage.kana) saved.stage.kana = 'words';

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
        if (seen.has(key) || !w.word || !w.reading) continue;
        seen.add(key);
        words.push({ text: w.word, reading: w.reading, gloss: w.gloss, clip: w.clip });
      }
    }
    return { n: u.n, ja: u.ja, en: u.en, words };
  }

  // The words' sound: the app's player and the week's clips. The round never waits for them.
  const soundLoads = {};
  function loadSound(level, n) {
    const lv = level.toLowerCase();
    const files = level === 'N2' ? ['sound-course.js', 'sound-lessons.js'] : ['sound-course-' + lv + '-u' + String(n).padStart(2, '0') + '.js'];
    const need = window.ykSound ? [] : ['sound.js'];
    for (const f of need.concat(files)) {
      if (!soundLoads[f]) soundLoads[f] = loadScript('../assets/' + f).catch(() => {});
    }
  }

  // ---------- cards ----------

  // A card: what it shows, what it is said as, and the rules voice.js checks it by.
  const madeItems = new Map();
  function makeItem(src, mode) {
    const reading = src.reading || src.text;
    const id = mode + ':' + src.text + '|' + reading;
    if (madeItems.has(id)) return madeItems.get(id);
    const t = V.prepare({ text: src.text, reading, romaji: src.romaji });
    const item = {
      id, mode, text: src.text, reading, gloss: src.gloss || '', clip: src.clip || null,
      // a kanji card's reading is the answer: it shows only as a hint
      hidden: mode === 'kanji',
      ruby: V.normalize(reading) !== V.normalize(src.text),
      t, beats: Math.max(1, t.beats), romaji: t.romaji,
    };
    madeItems.set(id, item);
    return item;
  }

  // The cards of the stage (or course week) picked in the menu, or null if not ready.
  function currentItems() {
    const mode = saved.mode;
    if (mode === 'course') {
      const units = courses[saved.level];
      const unit = units && units.find((u) => u.n === saved.unit[saved.level]);
      if (!unit || !unit.words.length) return null;
      V.addWords(unit.words);
      return unit.words.map((w) => makeItem(w, 'course'));
    }
    return currentStage().items.map((it) => makeItem(it, mode));
  }

  function currentStage() {
    const list = STAGES[saved.mode];
    return list.find((s) => s.id === saved.stage[saved.mode]) || list[0];
  }

  // Where the pick's pace, best and rings are kept: per stage, or per course week (both ways to play together).
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
  const jaMarked = (t) => esc(t).replace(/[぀-ヿ一-鿿々〜・「」]+/g, (m) => '<span lang="ja">' + m + '</span>');

  const weakness = (item, stats) => (stats[item.text] ? stats[item.text].miss : 0);

  // The cards of a round: every card once before any repeats, weak ones more likely to come early; a weak-spot
  // round deals only the weak ones, weakest first.
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
  let view = { W: VW, H: 360, s: 1, dpr: 1 };
  let pal = palette();
  let startTicket = 0;

  async function startRound(weakOnly) {
    // always from a tap: the moment to wake the audio, and to start listening (a phone asks for the microphone then)
    wakeAudio();
    const ticket = ++startTicket;
    const items = currentItems();
    if (!items || !items.length || !L.supported) return;
    let deck = deal(items, saved.len, weakOnly);
    if (!deck.length && weakOnly) {
      weakOnly = false;
      deck = deal(items, saved.len, false);
    }
    if (!deck.length) return;
    if (saved.mic === 'free') L.listen(true);
    const from = phase;
    const modeId = saved.mode;
    const key = stageKey();
    const name = stageName();
    const level = saved.level;
    const unit = saved.unit[saved.level];
    const style = saved.style;
    // the cards are measured in the typeface they are drawn in (a short wait at most); a newer start wins
    await fontsFor(deck);
    if (ticket !== startTicket || phase !== from || saved.mode !== modeId || stageKey() !== key || !$('settings-sheet').hidden) {
      if (phase !== 'play') L.stop();
      return;
    }
    const pace = saved.pace[key] && saved.pace[key].p ? saved.pace[key] : START[modeId];
    r = {
      style, key, weakOnly, name,
      stats: MODES[modeId].stats,
      course: modeId === 'course' ? { level, unit } : null,
      queue: deck.map((item) => ({ item, falls: 0 })),
      total: deck.length,
      cleared: 0, skipped: 0, clean: 0, falls: 0, hints: 0,
      time: 0, active: 0, practice: 0, credited: 0, lastVoiceAt: 0,
      rt: pace.r, p: pace.p,
      cards: [],
      fall: null, endIn: null, finale: null,
      missed: new Map(),
      misheard: [],
      hintModes: new Set(),
      target: null,
      spokenAt: -9, pendingSpeak: null,
      run: 0, bestRun: 0, stepChip: false, runRecord: false, comebacks: 0,
      fellEntries: new Set(), graduated: new Set(), weakDealt: 0, weakClean: 0,
      sayTimes: [],
      dayStamp: 0, cardDone: null, seal: null,
      yk: { happyT: 0, hopT: 0, hopH: 6, bubble: null, box: null, nodT: 0, blinkT: -1, blinkAt: 1.5, fx: null, trail: [], trick: null, x: 0, lift: 0, liftMax: 0, rollX: 0 },
      tricks: {},
      shards: [], nodes: [], drops: [],
      place: window.SpeakingWorld && window.SpeakingWorld.forStage ? safely(() => window.SpeakingWorld.forStage(key), null) : null,
      song: null, musicOn: false, started: false, said: new Set(),
      runRecordAt: !weakOnly && saved.hints !== 'always' && saved.run[key] ? saved.run[key] + 1 : 0,
      sayNext: '', voiceUntil: 0, errors: 0, fxDrawn: 0,
      speaking: false,
      // Falling: where the next thing comes in; Climb: the ledges and the camera
      head: 0, maxH: 0, speed: 0, T: 0,
      ledges: [], at: -1, camY: 0, jump: null, pending: null, top: 0,
    };
    markWeakCards();
    r.song = songFor(r.place);
    hush();
    setPhase('play');
    startMusic();
    if (document.hidden) setPhase('paused');
    resize();
    if (r.style === 'climb') buildLedges();
    if (modeId === 'course' && saved.sound) loadSound(level, unit);
    setStatus('', '');
    showSay(null);
    showHeard(null);
    hud();
    micUI();
  }

  // A gold corner on the cards that hold the player's weak spots: the weakest first, at most one card in five. Not in
  // a weak-spot round (every card there is weak), nor with hints always on.
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

  // The time a card needs: the reaction, and its beats at the speaking rate.
  const need = (item) => r.rt + item.beats / r.p;

  function makeCard(entry) {
    const card = {
      entry, item: entry.item, state: 'live', x: 0, y: 0, w: 0, h: 0, box: null,
      fill: 0, misses: 0, idle: 0, level: 0, hinted: false, halted: false, heard: '',
      shownAt: null, firstHeardAt: null, stampT: 0, flashT: 0, clean: false, comeback: false, star: false,
      phase: null, trick: null, n: r.cards.length + r.cleared + r.skipped, rot: 0, vy: 0,
    };
    layoutCard(card);
    r.cards.push(card);
    return card;
  }

  // ---------- measuring and laying out text ----------

  const UI = "'M PLUS Rounded 1c', 'Hiragino Maru Gothic ProN', 'Yu Gothic', sans-serif";
  const JP = "'Klee One', 'Hiragino Mincho ProN', 'Yu Mincho', serif";
  const canvas = $('stage');
  const ctx = canvas.getContext('2d');

  function fontsFor(deck) {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    const text = deck.map((it) => it.text + it.reading).join('');
    const wait = Promise.all([
      document.fonts.load('600 26px "Klee One"', text),
      document.fonts.load('800 20px "M PLUS Rounded 1c"', 'abc済'),
    ]).catch(() => {});
    return Promise.race([wait, new Promise((res) => setTimeout(res, 1500))]);
  }

  // Japanese is wrapped between any two characters, but not before a small kana, a long mark or closing punctuation,
  // nor after an opening bracket.
  const NO_START = /^[、。，．！？!?）」』ー〜ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮ・…]/;
  const NO_END = /[「『（]$/;
  function wrap(text, size, room, font) {
    ctx.save();
    ctx.font = '600 ' + size + 'px ' + font;
    const chars = Array.from(text);
    const lines = [];
    let line = '';
    for (const ch of chars) {
      const next = line + ch;
      if (line && ctx.measureText(next).width > room && !NO_START.test(ch) && !NO_END.test(line)) {
        lines.push(line);
        line = ch;
      } else line = next;
    }
    if (line) lines.push(line);
    const width = Math.max(0, ...lines.map((l) => ctx.measureText(l).width));
    ctx.restore();
    return { lines, width };
  }

  // A card's text, laid out to fit its sign or thing: the word large (smaller for long ones, on up to three lines),
  // and its reading above it; a kanji card keeps a line's room for its reading while it is hidden, so it does not grow
  // when it shows.
  function layoutCard(c) {
    const it = c.item;
    const room = Math.max(120, (r.style === 'climb' ? 0.86 : 0.9) * view.W) - 28;
    const n = Array.from(it.text).length;
    let size = n <= 2 ? 34 : n <= 4 ? 28 : n <= 7 ? 24 : n <= 12 ? 20 : 17;
    let main = wrap(it.text, size, room, JP);
    while (main.lines.length > 3 && size > 13) {
      size -= 1;
      main = wrap(it.text, size, room, JP);
    }
    const rSize = Math.min(14, Math.max(11, Math.round(size * 0.48)));
    const showReading = it.ruby && readingShown(c);
    let rd = { lines: [], width: 0 };
    if (it.ruby) rd = wrap(showReading ? it.reading : '　', rSize, room, JP);
    const pad = 12;
    const lh = Math.round(size * 1.18);
    const rlh = Math.round(rSize * 1.3);
    const w = Math.ceil(Math.max(64, main.width, showReading ? rd.width : 0) + pad * 2);
    const h = Math.ceil(pad + (it.ruby ? rd.lines.length * rlh + 2 : 0) + main.lines.length * lh + pad - 2);
    c.box = { size, lines: main.lines, rSize, rLines: showReading ? rd.lines : [], rRoom: it.ruby ? rd.lines.length : 0, pad, lh, rlh, shown: showReading };
    c.w = Math.min(view.W - 12, w);
    c.h = h;
  }

  // ---------- the round, frame by frame ----------

  // A kanji card's reading shows with the first step of a hint, after a fall, and once the card is done.
  const readingShown = (c) => !c.item.hidden || c.state !== 'live' || hintLevel(c) >= 1 || saved.hints === 'always';
  const hintLevel = (c) => (c.state === 'fallen' || c.halted ? 2 : c.level);

  // The card being said: Falling, the lowest thing still falling, once it is in view; Climb, the next ledge's.
  function targetCard() {
    if (!r || r.finale !== null) return null;
    if (r.style === 'climb') {
      if (r.jump || (r.fall && r.fall.kind !== 'slip')) return null;
      const ledge = r.ledges[r.at + 1];
      return ledge && ledge.card.state === 'live' ? ledge.card : null;
    }
    if (r.fall) return null;
    const c = r.cards.find((x) => x.state === 'live');
    return c && (c.halted || c.y >= 4) ? c : null;
  }

  function update(dt) {
    // speaking time for the day's stamp: it stops 8 seconds after the last word heard
    if (r.time - r.lastVoiceAt < PRACTICE_IDLE) r.practice += dt;
    r.time += dt;
    for (const c of r.cards) {
      if (c.state === 'done') c.stampT += dt;
      if (c.flashT > 0) c.flashT = Math.max(0, c.flashT - dt);
    }
    const yk = r.yk;
    yk.happyT = Math.max(0, yk.happyT - dt);
    yk.hopT = Math.max(0, yk.hopT - dt);
    yk.nodT = Math.max(0, yk.nodT - dt);
    if (yk.bubble && (yk.bubble.t += dt) >= yk.bubble.life) yk.bubble = null;
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
      yk.trail = yk.trail.filter((st) => st.age < 0.35);
    }
    for (const s of r.shards) {
      s.x += s.vx * dt;
      s.vy += 700 * dt;
      s.y += s.vy * dt;
      s.a += s.va * dt;
      s.age += dt;
    }
    if (r.shards.length) r.shards = r.shards.filter((s) => s.age < 1.4 && s.y < view.H + 40);
    for (const d of r.drops) {
      d.age += dt;
      d.x += d.vx * dt;
      d.vy += 300 * dt;
      d.y += d.vy * dt;
    }
    if (r.drops.length) r.drops = r.drops.filter((d) => d.age < 0.7);

    if (r.endIn !== null) {
      r.endIn -= dt;
      if (r.endIn <= 0) {
        finishRound();
        return;
      }
    }
    if (r.style === 'climb') updateClimb(dt);
    else updateFall(dt);
    if (!r) return;

    // The card being said: when it came into view, and how long it has gone without a word.
    const t = targetCard();
    if (t) {
      if (t.shownAt === null) t.shownAt = r.time;
      const fresh = t !== r.target;
      r.target = t;
      r.active += dt;
      if (!r.speaking) t.idle += dt;
      if (t.idle >= 3.5 && !t.nudged && !t.fill) {
        t.nudged = true;
        cheer('idle', 1.6);
      }
      raiseHint(t);
      if (fresh) {
        speakTarget(t);
        showSay(t);
        showHeard(null);
        if (!r.started) {
          r.started = true;
          cheer('start', 1.4, { first: true });
        } else if (r.cleared + r.skipped === r.total - 1 && r.lastFor !== t) {
          r.lastFor = t;
          cheer('last', 1.4);
          if (r.musicOn && t.entry.falls < 2) music('cue', 'last');
        }
      } else if (r.pendingSpeak === t) {
        speakTarget(t);
      }
    } else if (r.target && !r.fall) {
      r.target = null;
      showSay(null);
    }
    $('skip').disabled = !(t && t.halted);
    $('skip').classList.toggle('ready', !!(t && t.halted));
  }

  // ---------- Falling ----------

  const groundY = () => view.H - GROUND_UP;
  const impactY = () => groundY() - YH;

  // The round's time budget T: what the longest card needs at the measured pace, with room to spare; the speed
  // follows from it, so the longest card has T from coming into view to reaching Yaoki.
  function setSpeed() {
    const longest = Math.max(...r.queue.map((e) => need(e.item)), ...r.cards.filter((c) => c.state === 'live').map((c) => need(c.item)), 1);
    r.T = Math.max(5, Math.min(32, 1.35 * longest));
    r.maxH = Math.max(60, ...r.queue.map((e) => measureH(e.item)), ...r.cards.map((c) => c.h));
    r.speed = Math.max(8, (impactY() - r.maxH - 4) / r.T);
  }
  const heights = new Map();
  function measureH(item) {
    const key = item.id + '@' + Math.round(view.W);
    if (!heights.has(key)) {
      const c = { item, state: 'live', level: 0 };
      layoutCard(c);
      heights.set(key, c.h);
    }
    return heights.get(key);
  }

  // The room in front of a new thing, from the top of the one before it: the time the one before it needs, plus the
  // slack, at the speed; never overlapping.
  const spacing = (prev) => Math.max(prev.h + 26, r.speed * SLACK * need(prev.item));

  function updateFall(dt) {
    const yk = r.yk;
    if (r.fall) {
      updateCrush(dt);
      return;
    }
    updateTrick(dt);
    const live = r.cards.filter((c) => c.state === 'live');
    const target = targetCard();
    const halted = !!(target && target.halted);
    const waiting = !target && (live.length > 0 || r.queue.length > 0) && r.finale === null && r.endIn === null;
    let speed = halted ? 0 : r.speed;
    if (waiting) {
      if (reducedMotion.matches) cutFall(live);
      else speed = Math.max(r.speed * 4, 220);
    }
    r.speedNow = speed;
    // they fall in turn, the one below never caught up by the one above
    let floor = Infinity;
    for (const c of live) {
      if (c.halted) {
        floor = c.y - 18;
        continue;
      }
      c.y = Math.min(c.y + speed * dt, floor - c.h - 18);
      floor = c.y;
      c.rot = c.spin * Math.sin(r.time * 1.3 + c.n);
    }
    r.head += speed * dt;
    // a new thing comes in at the top, spaced by how long the one before it takes
    if (r.queue.length && r.finale === null) {
      const lastLive = r.lastSpawn;
      const next = r.queue[0];
      const h = measureH(next.item);
      if (!lastLive || r.head - spacing(lastLive) >= -h - 6) {
        const c = makeCard(r.queue.shift());
        c.x = view.W / 2 + (c.n % 3 - 1) * 4;
        c.y = lastLive ? Math.min(r.head - spacing(lastLive), -c.h - 6) : -c.h - 6;
        c.spin = (c.n % 2 ? 1 : -1) * 0.05;
        r.head = c.y;
        r.lastSpawn = c;
      }
    }
    // the lowest one reaches Yaoki: it squashes him, unless it has done so twice; then it stops on his umbrella
    const first = live[0];
    if (first && !first.halted && first.y + first.h >= impactY()) {
      if (first.entry.falls >= 2) halt(first);
      else startCrush(first);
    }
    r.cards = r.cards.filter((c) => c.state !== 'removed');
    // the end: once every card is done and his last trick is over
    if (r.finale !== null && r.endIn === null && !yk.trick) r.endIn = 0.9;
  }

  // Without motion there is no dash: the next thing is simply brought into view.
  function cutFall(live) {
    const next = live[0];
    if (next) {
      if (next.y < 4) {
        const shift = 4 - next.y;
        for (const c of live) c.y += shift;
        r.head += shift;
      }
    } else if (r.queue.length) {
      r.head = Math.max(r.head, (r.lastSpawn ? spacing(r.lastSpawn) : 0) - measureH(r.queue[0].item) - 6);
    }
  }

  function halt(c) {
    c.halted = true;
    c.level = 2;
    c.y = impactY() - c.h - 14;
    layoutCard(c);
    showSay(c);
    say(c.item.text + (c.item.ruby ? '、' + c.item.reading : ''), 'Take your time: this one waits on Yaoki\'s umbrella. The skip button passes it over.');
    cheer('halt', 2);
    if (!c.modelPlayed) {
      c.modelPlayed = true;
      later(() => {
        if (r && targetCard() === c) playModel(c);
      }, 700);
    }
  }

  // A thing lands on Yaoki: he is squashed flat, pops back up, and it is thrown back into the sky, to come round again
  // after about three other cards (the ones already falling come first, so it can be more); the number is said.
  function startCrush(card) {
    card.state = 'fallen';
    card.entry.falls++;
    const ahead = r.cards.filter((c) => c.state === 'live' && c !== card).length;
    const promised = r.queue.reduce((last, e, i) => (e.falls > 0 ? i : last), -1);
    const at = Math.max(promised + 1, Math.min(2 - ahead, r.queue.length));
    r.fall = { kind: 'crush', t: 0, card, length: CRUSH_T, at, back: ahead + at, rose: false, y0: card.y };
    r.falls++;
    r.p = Math.max(0.8, r.p * 0.85);
    // what was being said for it is not said for the next
    L.consume();
    fallen(card);
    say(card.item.text, 'Yaoki was squashed and got up again. It is ' + card.item.reading + ' (' + card.item.romaji + '). ' + backText(r.fall.back) + '.');
  }
  const backText = (n) => (n === 0 ? 'Back next' : 'Back after ' + n + (n === 1 ? ' card' : ' cards'));

  // What a fall or a slip does to the round: the clean run ends quietly, the card's miss is kept, its answer shows.
  function fallen(card) {
    r.target = null;
    r.run = 0;
    r.stepChip = false;
    r.fellEntries.add(card.entry);
    const yk = r.yk;
    yk.trick = null;
    yk.happyT = 0;
    yk.hopT = 0;
    yk.bubble = null;
    yk.fx = null;
    if (r.musicOn) music('cue', 'fall');
    sfx('fall');
    noteMiss(card);
    if (r.style === 'fall') applyStats(card);
    layoutCard(card);
    showSay(card);
    hud();
  }

  function updateCrush(dt) {
    const f = r.fall;
    f.t += dt;
    const c = f.card;
    const still = reducedMotion.matches;
    const flat = impactY() + YH * 0.62;
    if (f.t < 0.14) c.y = f.y0 + (flat - c.h - f.y0) * (still ? 1 : f.t / 0.14);
    else if (f.t < 0.9) c.y = flat - c.h;
    else {
      // flung back up into the sky as he pops up
      if (!f.rose) {
        f.rose = true;
        c.vy = -620;
        sfx('up');
        cheer('rise', f.length - f.t + 0.6, { first: !r.said.has('rise') });
      }
      c.vy += 380 * dt;
      c.y += c.vy * dt;
      c.rot += dt * 5;
    }
    if (f.t >= f.length) endCrush();
  }

  // After a fall the things still to come are pushed back, so the next one arrives no sooner than after a fresh start.
  function endCrush() {
    const card = r.fall.card;
    r.cards = r.cards.filter((c) => c !== card);
    r.queue.splice(Math.min(r.fall.at, r.queue.length), 0, card.entry);
    r.fall = null;
    if (r.lastSpawn === card) r.lastSpawn = null;
    if (r.musicOn) music('setLevel', musicLevel());
    const live = r.cards.filter((c) => c.state === 'live');
    if (live.length) {
      const most = impactY() - live[0].h - r.speed * SLACK * need(live[0].item);
      const shift = live[0].y - Math.max(4, most);
      if (shift > 0) for (const c of live) c.y -= shift;
      r.head = Math.min(r.head, live[live.length - 1].y);
    } else {
      r.head = Math.min(r.head, 0);
    }
    showSay(null);
  }

  // ---------- Climb ----------

  // The ledges, one for each card of the round, from the ground up; and the top, above the last one.
  function buildLedges() {
    const W0 = window.SpeakingWorld;
    let y = 0;
    r.ledges = [];
    r.queue.forEach((entry, k) => {
      const card = makeCard(entry);
      const spot = W0 && W0.layout ? safely(() => W0.layout(r.place, k, view.W), null) : null;
      const x = spot && isFinite(spot.x) ? spot.x : view.W * (k % 2 ? 0.66 : 0.34);
      const side = spot ? spot.side : k % 2 ? 1 : -1;
      y -= Math.max(STEP, card.h + YH + 34);
      r.ledges.push({ card, x, y, side, w: 84 });
      card.ledge = r.ledges[k];
    });
    r.queue = [];
    r.top = y - Math.max(STEP, YH + 60);
    r.yk.x = view.W / 2;
    r.camY = camFor(0);
  }

  // Where Yaoki stands, and where the camera puts the top of the view so he is in the lower part of it.
  const standY = () => (r.at < 0 ? 0 : r.ledges[r.at].y);
  const camFor = (y) => y - view.H * 0.8;

  function updateClimb(dt) {
    const yk = r.yk;
    // the camera follows him up, gently
    const want = r.jump ? camFor(Math.min(standY(), r.jump.toY)) : r.finale !== null ? camFor(r.top) + view.H * 0.12 : camFor(standY());
    r.camY += (want - r.camY) * Math.min(1, dt * (reducedMotion.matches ? 60 : 4));
    if (r.jump) {
      r.jump.t += dt;
      if (r.jump.t >= r.jump.len) land();
    }
    if (r.fall) {
      r.fall.t += dt;
      if (!r.fall.rose && r.fall.t >= 0.62 * r.fall.length) {
        r.fall.rose = true;
        sfx('up');
        cheer('rise', r.fall.length - r.fall.t + 0.5, { first: !r.said.has('rise') });
      }
      if (r.fall.t >= r.fall.length) {
        r.fall = null;
        // a word said right while he was getting up: now he jumps
        if (r.pending && r.pending.state === 'live') clearCard(r.pending);
        r.pending = null;
      }
    }
    if (r.finale !== null && r.endIn === null && !r.jump && r.time - r.finale > 1.6) r.endIn = 0.4;
  }

  // He jumps up to the next ledge (a trick by how the card was said); the sign is stamped as he lands.
  function jumpTo(card, kind) {
    const ledge = card.ledge;
    const from = { x: r.yk.x || view.W / 2, y: standY() };
    r.jump = { t: 0, len: TRICKS[kind].len * (reducedMotion.matches ? 0.01 : 1), kind, card, fromX: from.x, fromY: from.y, toX: ledge.x, toY: ledge.y };
    r.yk.fx = { ja: TRICKS[kind].ja, t: 0, x: ledge.x, y: ledge.y - YH - 26, worldY: true, big: kind === 'super' };
    sfx(kind === 'spin' ? 'spin' : 'jump');
    r.tricks[kind] = (r.tricks[kind] || 0) + 1;
  }
  function land() {
    const j = r.jump;
    r.jump = null;
    r.yk.x = j.toX;
    r.yk.hopT = 0;
    if (!j.card) {
      // the top
      r.atTop = true;
      cheer(['endGood', 'endOk', 'endTry'][tierOf(r)], 1.6);
      hop(10);
      burst(j.toX, r.top - YH, 18, pal.gold);
      return;
    }
    r.at = r.ledges.indexOf(j.card.ledge);
    if (j.kind === 'super') burst(j.toX, j.toY - 10, 12, pal.gold);
    if (r.cleared + r.skipped >= r.total) toTop();
  }
  // The last ledge: up onto the top, and the round is over.
  function toTop() {
    if (r.finale !== null) return;
    r.finale = r.time;
    r.jump = { t: 0, len: reducedMotion.matches ? 0.01 : 0.8, kind: 'hop', card: null, fromX: r.yk.x, fromY: standY(), toX: view.W / 2, toY: r.top };
    sfx('jump');
  }

  // ---------- speech ----------

  L.onheard = (texts, final) => heard(texts, final);
  L.onstate = () => micUI();
  L.onspeech = (on) => {
    if (r) r.speaking = on;
    // the music dips while the player speaks, so the phone hears them
    if (on && r && r.musicOn) music('duck', 1.8);
    micUI();
  };

  function heard(texts, final) {
    if (micTest.on) {
      micTestHeard(texts, final);
      return;
    }
    if (phase !== 'play' || !r) {
      // said before the round is ready: not an answer to anything
      L.consume();
      return;
    }
    r.lastVoiceAt = r.time;
    const c = targetCard() || (r.fall && r.fall.kind === 'slip' ? r.fall.card : null);
    if (!c) {
      // nothing to say just now: what was said is used up
      L.consume();
      return;
    }
    const res = V.best(c.item.t, texts);
    if (!res) return;
    if (c.firstHeardAt === null) c.firstHeardAt = r.time;
    c.idle = 0;
    r.yk.nodT = NOD_T;
    if (res.ok) {
      L.consume();
      c.fill = c.item.t.len;
      showHeard(res, 'good');
      if (r.fall) r.pending = c;
      else clearCard(c);
      return;
    }
    c.fill = res.fill;
    // the start of the card with a pause after it (the phone closed what it had heard so far): the rest is to come,
    // and is heard together with it
    const begun = final && res.fill > 0;
    showHeard(res, final && !begun ? 'bad' : '');
    if (final && !begun) {
      L.consume();
      miss(c, res);
    } else {
      sfx('heard');
    }
  }

  // The phone heard another word: the card flashes, the hint steps up, and the slip is named if it is a common one.
  function miss(card, res) {
    card.misses++;
    card.flashT = FLASH_T;
    card.heard = res.text;
    if (r.misheard.length < 40) r.misheard.push({ text: card.item.text, reading: card.item.reading, heard: res.text, said: res.said });
    noteMiss(card);
    raiseHint(card);
    const note = saved.hints === 'never' || !res.note ? '' : ja(res.note.ja) + '　' + jaMarked(res.note.en);
    setStatus(note, 'bad', true);
    sfx('miss');
    if (card.misses >= 2 && !card.halted) {
      card.halted = true;
      layoutCard(card);
      showSay(card);
    }
    if (r.style === 'climb' && !r.fall && !r.jump) {
      // he tries for the ledge, bumps his head and slips back down; then up he gets
      r.fall = { kind: 'slip', t: 0, card, length: reducedMotion.matches ? 0.6 : SLIP_T, rose: false };
      r.falls++;
      r.fellEntries.add(card.entry);
      r.run = 0;
      r.stepChip = false;
      r.yk.fx = { ja: 'ゴン', t: 0.05, x: card.ledge.x + (r.yk.x - card.ledge.x) * 0.4, y: card.ledge.y + card.h + 6, worldY: true, big: false };
      sfx('fall');
      if (r.musicOn) music('cue', 'fall');
      hud();
    } else {
      cheer('miss', 1.2);
    }
  }

  // The card (or word) a miss belongs to, kept for the round's weak spots.
  function noteMiss(card) {
    const key = card.item.text;
    r.missed.set(key, (r.missed.get(key) || 0) + 1);
  }

  // A card is over: missed, hinted or fallen, it goes on the weak list; said clean, it counts towards coming off it.
  function applyStats(card) {
    const key = card.item.text;
    if (card.misses || card.state === 'fallen' || card.halted || card.hinted) {
      markMiss(r.stats, key);
      if (!r.missed.has(key)) r.missed.set(key, 1);
    } else if (card.level < 1 || saved.hints === 'always') {
      markOk(r.stats, key);
    }
  }

  // Quitting keeps the misses already made on the cards still out, and saves.
  function keepMisses() {
    for (const c of r.cards) if (c.state === 'live' && (c.misses || c.hinted)) markMiss(r.stats, c.item.text);
    save();
  }

  // The player's reaction and speaking rate, as moving averages over the cards they say.
  function measure(card) {
    const a = 0.3;
    const heardAt = card.firstHeardAt === null ? r.time : card.firstHeardAt;
    if (card.shownAt !== null) {
      const react = Math.max(0.4, Math.min(10, heardAt - card.shownAt));
      r.rt = r.rt * (1 - a) + react * a;
      r.sayTimes.push(Math.max(0, r.time - card.shownAt));
    }
    const span = r.time - heardAt;
    if (card.item.beats > 2 && span > 0.25) {
      const rate = Math.max(1, Math.min(9, card.item.beats / span));
      r.p = r.p * (1 - a) + rate * a;
    }
  }

  function clearCard(card) {
    card.state = 'done';
    card.stampT = 0;
    card.fill = card.item.t.len;
    r.cleared++;
    const clean = !card.misses && !card.hinted && !card.entry.falls;
    card.clean = clean;
    if (clean) r.clean++;
    // 起: Falling, a card that squashed Yaoki, said this time with no miss and no hint; Climb, said after a slip
    card.comeback = !clean && (r.style === 'climb' ? card.misses > 0 && !card.halted : card.entry.falls >= 1 && !card.halted && !card.misses && card.level === 0);
    card.star = !!card.entry.weak && clean && card.level < 1;
    measure(card);
    applyStats(card);
    layoutCard(card);
    setStatus('', '');

    // the clean run: it grows with each clean card, and ends quietly on one that is not
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

    // Yaoki: a smile for a clean card, a hop and a cheer at a step of the run or a comeback, and his trick
    const yk = r.yk;
    if (clean || card.comeback) yk.happyT = HAPPY_T;
    const big = card.comeback || card.star || card.halted;
    if (r.style === 'climb') {
      jumpTo(card, big ? 'super' : !clean ? 'scramble' : r.run >= 5 ? 'spin' : 'hop');
    } else {
      startTrick(card, big ? 'smash' : !clean ? 'dodge' : r.run >= 5 ? 'spin' : 'pop');
    }
    if (step >= 0) cheer('step' + step, CHEER_T, { first: !r.said.has('step' + step) });
    else if (card.comeback) cheer('comeback', 1);
    else if (card.star) cheer('star', 1.2);
    if (r.runRecordAt && r.bestRun === r.runRecordAt && !r.said.has('record') && !r.hintModes.has('always')) cheer('record', 1.4);

    // a course word's own voice is its reward: no effect sound plays over it
    const voice = !!(card.item.clip && saved.sound && window.ykSound && window.ykSound.has(card.item.clip));
    if (voice) {
      window.ykSound.play(card.item.clip);
      const ms = Math.max(900, window.ykSound.ms ? window.ykSound.ms(card.item.clip) : 0);
      r.voiceUntil = r.time + ms / 1000;
      L.quiet(ms);
      if (r.musicOn) music('duck', ms / 1000 + 0.2);
    } else {
      sfx('clear', { streak: clean ? r.run : 0 });
      if (card.star) sfx('gold');
      if (step >= 0) sfxLater('streak', { step }, 140);
      else if (card.comeback) sfxLater('up', null, 120);
    }
    if (r.musicOn) {
      music('setLevel', musicLevel());
      if (step >= 0) music('cue', 'step');
    }
    if (r.cleared + r.skipped >= r.total) startFinale();
    roundLines();
    hud();
  }

  // The last card is done: Falling waits for Yaoki's last trick; Climb, for his jump to the top.
  function startFinale() {
    if (r.style === 'climb') return; // the jump to the top starts it, as he lands on the last ledge
    if (r.finale !== null) return;
    r.finale = r.time;
  }

  // Yaoki's word halfway through the round, and at its end (by the stamp it will get).
  function roundLines() {
    const passed = r.cleared + r.skipped;
    if (passed >= r.total) {
      if (r.style === 'fall') {
        const tier = tierOf(r);
        cheer(['endGood', 'endOk', 'endTry'][tier], 1.4);
        if (tier === 0) hop(10);
      }
    } else if (r.total >= 10 && passed === Math.floor(r.total / 2)) {
      cheer('half', 1.3);
    }
  }

  // A card that waits for Yaoki can be passed over with the skip button.
  function skipCard(card) {
    if (card.misses || card.hinted || card.halted) markMiss(r.stats, card.item.text);
    r.skipped++;
    r.target = null;
    sfx('swish');
    setStatus('', '');
    showHeard(null);
    if (r.style === 'climb') {
      card.state = 'skipped';
      jumpTo(card, 'hop');
      if (r.cleared + r.skipped >= r.total) startFinale();
    } else {
      card.state = 'removed';
      r.cards = r.cards.filter((c) => c !== card);
      for (let i = 0; i < 6; i++) r.shards.push(shard(card, i, 6));
      if (r.cleared + r.skipped >= r.total) startFinale();
    }
    roundLines();
    hud();
  }

  // Hints in steps: 0 none; 1 the reading (furigana) and its romaji; 2 the word said for the player to copy. Always:
  // the reading and romaji from the start. Never: none, except after a fall.
  function raiseHint(c) {
    r.hintModes.add(saved.hints);
    if (saved.hints === 'always') {
      if (c.level < 1) {
        c.level = 1;
        layoutCard(c);
        if (c === r.target) showSay(c);
      }
      return;
    }
    if (saved.hints === 'never' || c.level >= 2) return;
    const limit = c.level === 0 ? STUCK_FIRST : STUCK_NEXT;
    let level = Math.min(2, c.misses);
    if (c.idle >= limit) level = Math.max(level, c.level + 1);
    if (level > c.level) {
      c.level = level;
      c.idle = 0;
      if (!c.hinted) {
        c.hinted = true;
        r.hints++;
      }
      layoutCard(c);
      if (c === targetCard() || (r.fall && r.fall.card === c)) {
        showSay(c);
        if (level === 1 && c.item.hidden) say(c.item.reading, '');
        if (level === 2 && !c.modelPlayed) {
          c.modelPlayed = true;
          playModel(c);
        }
      }
    }
  }

  // ---------- the word said for the player to copy ----------
  // A course word with its own clip (the app's voice); any other card in the phone's Japanese voice, if it has one.
  // While it plays, what the phone hears is not the player's.

  let jaVoice = null;
  function findVoice() {
    if (!window.speechSynthesis) return;
    try {
      const voices = window.speechSynthesis.getVoices() || [];
      jaVoice = voices.find((v) => /^ja(-|_|$)/i.test(v.lang) && v.localService) || voices.find((v) => /^ja(-|_|$)/i.test(v.lang)) || null;
    } catch (err) {
      jaVoice = null;
    }
  }
  if (window.speechSynthesis) {
    findVoice();
    if (window.speechSynthesis.addEventListener) window.speechSynthesis.addEventListener('voiceschanged', findVoice);
  }
  const canModel = (item) => !!((item.clip && window.ykSound && window.ykSound.has(item.clip)) || (jaVoice && window.SpeechSynthesisUtterance));

  function playModel(c) {
    const it = c.item;
    let ms = 0;
    if (it.clip && window.ykSound && window.ykSound.has(it.clip)) {
      window.ykSound.unlock();
      window.ykSound.play(it.clip);
      ms = Math.max(800, window.ykSound.ms ? window.ykSound.ms(it.clip) : 1200);
    } else if (jaVoice && window.SpeechSynthesisUtterance) {
      try {
        const u = new window.SpeechSynthesisUtterance(it.reading);
        u.lang = 'ja-JP';
        u.voice = jaVoice;
        u.rate = 0.85;
        u.onend = () => L.loud();
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
        ms = 700 + it.beats * 280;
      } catch (err) {
        ms = 0;
      }
    }
    if (!ms) return false;
    L.quiet(ms);
    if (r) {
      r.voiceUntil = r.time + ms / 1000;
      if (r.musicOn) music('duck', ms / 1000 + 0.3);
    }
    return true;
  }

  // ---------- Falling: what Yaoki does with a thing once it is said ----------
  // A clean card bursts where it is (pop); in a clean run of five or more he spins up and bumps it apart (spin); one
  // said after a slip or a hint lands beside him as he rolls out of its way (dodge); a comeback, a weak spot said clean
  // or one that waited on his umbrella, he jumps up and smashes (smash). Its 済 then lands on the ground as a node.

  function startTrick(c, kind) {
    const yk = r.yk;
    c.phase = 'trick';
    c.trick = kind;
    const still = reducedMotion.matches;
    yk.trick = { kind, card: c, t: 0, len: still ? 0.3 : TRICKS[kind].len, hit: kind === 'pop' ? 0 : kind === 'dodge' ? 0.45 : 0.38, done: false, y0: c.y };
    yk.fx = { ja: TRICKS[kind].ja, t: kind === 'pop' ? 0 : -0.25, x: view.W / 2 + (kind === 'dodge' ? -40 : 52), y: Math.max(40, Math.min(c.y + c.h / 2, impactY() - 30)), big: kind === 'smash' };
    if (kind === 'pop') shatter(c);
    if (kind !== 'pop' && kind !== 'smash') sfx(kind === 'dodge' ? 'duck' : 'spin');
    r.tricks[kind] = (r.tricks[kind] || 0) + 1;
  }
  function updateTrick(dt) {
    const tr = r.yk.trick;
    if (!tr) return;
    tr.t += dt * (r.cards.some((c) => c.state === 'live' && c.y + c.h > impactY() - 60) ? 1.6 : 1);
    const c = tr.card;
    const u = Math.min(1, tr.t / tr.len);
    if (tr.kind === 'smash' || tr.kind === 'spin') {
      // he jumps up to meet it as it comes down
      if (!tr.done && u >= tr.hit) {
        tr.done = true;
        shatter(c);
        if (tr.kind === 'smash') {
          sfx('smash');
          burst(c.x, c.y + c.h, 10, pal.gold);
        }
      } else if (!tr.done) {
        c.y = tr.y0 + (impactY() - 50 - c.h - tr.y0) * smooth(0, tr.hit, u);
      }
    } else if (tr.kind === 'dodge') {
      // it falls past him, onto the ground where he stood, and lies there stamped
      if (u < tr.hit) c.y = tr.y0 + (groundY() - c.h - tr.y0) * Math.pow(u / tr.hit, 2);
      else if (!tr.done) {
        tr.done = true;
        c.y = groundY() - c.h;
        sfx('fall');
        burst(c.x, groundY() - 2, 6, pal.lineStrong);
      }
    }
    if (tr.t >= tr.len) {
      if (!c.gone) {
        if (tr.kind === 'dodge') shatter(c, true);
        else c.gone = true;
      }
      addNode(c);
      c.state = 'removed';
      r.yk.trick = null;
    }
  }

  // The thing breaks into pieces that fly off and fall; its stamp goes to the ground as a node.
  function shatter(c, quiet) {
    c.gone = true;
    const n = Math.max(6, Math.min(14, Math.round(c.w / 16)));
    for (let i = 0; i < n; i++) r.shards.push(shard(c, i, n, quiet));
    if (!quiet) sfx(r.yk.trick && r.yk.trick.kind === 'smash' ? 'smash' : 'clear', { streak: c.clean ? r.run : 0 });
  }
  function shard(c, i, n, quiet) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
    const sp = quiet ? 40 + 60 * Math.random() : 90 + 140 * Math.random();
    const size = 6 + Math.random() * Math.min(18, c.w / 6);
    const pts = [];
    for (let k = 0; k < 4; k++) {
      const t = (k / 4) * Math.PI * 2 + Math.random() * 0.6;
      pts.push([Math.cos(t) * size * (0.5 + Math.random() * 0.5), Math.sin(t) * size * (0.5 + Math.random() * 0.5)]);
    }
    return { x: c.x + Math.cos(a) * c.w * 0.25, y: c.y + c.h / 2 + Math.sin(a) * c.h * 0.25, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (quiet ? 60 : 160), a: 0, va: (Math.random() - 0.5) * 12, pts, n: c.n, age: 0 };
  }
  // A few sparks: a smash, a landing, the top.
  function burst(x, y, n, color) {
    if (reducedMotion.matches) return;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      r.drops.push({ x, y, vx: Math.cos(a) * (60 + 60 * Math.random()), vy: Math.sin(a) * (60 + 60 * Math.random()) - 40, age: 0, color, world: r.style === 'climb' });
    }
  }

  // The ground's nodes: 済 for each thing said, beside Yaoki, inside a はなまる if it was clean (起 for a comeback, a
  // star for a weak spot), the oldest moving off as more come.
  function addNode(c) {
    r.nodes.push({ clean: c.clean, comeback: c.comeback, star: c.star, at: r.time, n: r.nodes.length });
    if (r.nodes.length > 40) r.nodes.shift();
  }

  // ---------- sound effects (sfx.js) and music (music.js) ----------
  // Quiet plays a stamp for each card, a drum for a fall, a bounce for getting up and a sound for each trick; All
  // also knocks when the phone heard another word, and ticks as it hears the word coming. The audio output is only
  // ever made in a tap.

  let sfxReady = false;
  const SFX_ALL_ONLY = new Set(['miss', 'heard']);
  const UNDER_VOICE = new Set(['miss', 'heard', 'jump', 'duck', 'spin', 'smash', 'swish']);
  function wakeAudio() {
    if (window.ykSound) window.ykSound.unlock();
    if (!window.TypingSfx || (saved.sfx === 'off' && saved.music === 'off')) return;
    sfxReady = true;
    window.TypingSfx.unlock();
  }
  function sleepAudio() {
    if (saved.sfx === 'off' && saved.music === 'off' && window.TypingSfx && window.TypingSfx.sleep) window.TypingSfx.sleep();
  }
  function sfx(name, opts) {
    if (!sfxReady || !window.TypingSfx || saved.sfx === 'off') return;
    if (SFX_ALL_ONLY.has(name) && saved.sfx !== 'all') return;
    if (UNDER_VOICE.has(name) && r && r.time < r.voiceUntil) return;
    try {
      window.TypingSfx.play(name === 'heard' ? 'key' : name, opts);
    } catch (err) {
      // a sound that cannot play is simply not heard
    }
  }

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

  const MUSIC_VOL = { off: 0, soft: 0.3, on: 0.6 };
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
  function songFor(id) {
    const m = window.TypingMusic;
    if (!m || !Array.isArray(m.SONGS) || !m.SONGS.length) return null;
    const W0 = window.SpeakingWorld;
    const own = W0 && W0.PLACES ? (W0.PLACES.find((p) => p.id === id) || {}).song : null;
    if (own && m.SONGS.some((x) => x.id === own)) return own;
    return m.SONGS[0].id;
  }
  function startMusic() {
    if (!r || saved.music === 'off' || !sfxReady) return;
    music('volume', MUSIC_VOL[saved.music]);
    if (music('start', r.song) !== false) {
      r.musicOn = true;
      music('setLevel', r.cleared ? musicLevel() : 0);
    }
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
    if (p !== 'play') {
      L.stop();
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    }
    if (p === 'menu') {
      music('stop', 0.3);
      r = null;
      hush();
      renderMenu();
    }
    if (p === 'paused') {
      music('pause');
      $('resume').focus();
    }
    if (p === 'play') {
      if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
      if (r) r.hintModes.add(saved.hints);
      if (was === 'paused' && r) {
        r.spokenAt = -9;
        r.pendingSpeak = null;
        r.target = null;
        wakeAudio();
        if (r.musicOn && saved.music !== 'off') {
          music('volume', MUSIC_VOL[saved.music]);
          music('resume');
        } else {
          startMusic();
        }
        if (saved.mic === 'free') L.listen(true);
      }
    }
    if (p === 'result') $('res-title').focus();
    upright();
    micUI();
  }

  // The line under the game; `html` when the text is markup (with its Japanese marked).
  function setStatus(text, tone, html) {
    const s = $('status');
    if (html) s.innerHTML = text;
    else s.textContent = text;
    s.className = 'status' + (tone ? ' ' + tone : '');
  }

  // Under the game: the card's romaji (as a hint) and its meaning.
  function showSay(c) {
    const box = $('say-line');
    box.textContent = '';
    if (!c) return;
    const it = c.item;
    const level = hintLevel(c);
    if (level >= 1 || saved.hints === 'always') {
      const ro = document.createElement('span');
      ro.className = 'romaji';
      ro.textContent = it.romaji;
      box.appendChild(ro);
    }
    if (it.gloss) {
      const en = document.createElement('span');
      en.className = 'gloss';
      en.textContent = it.gloss;
      box.appendChild(en);
    }
  }

  // What the phone heard, as it heard it (with the reading it was taken as, where that differs).
  function showHeard(res, tone) {
    const el = $('heard');
    el.className = 'heard' + (tone ? ' ' + tone : '');
    if (!res || !res.text) {
      el.textContent = '';
      return;
    }
    el.innerHTML = ja('聞こえた') + '　' + ja('「' + res.text.trim() + '」') + (res.said ? '　' + ja('（' + res.said + '）') : '');
  }

  // The screen reader hears each card (word, and reading once it shows), each fall with its answer, and the result.
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
    const en = [r.sayNext, card.entry.weak ? 'Weak spot.' : ''].filter(Boolean).join(' ');
    r.sayNext = '';
    say(it.ruby && readingShown(card) ? it.text + '、' + it.reading : it.text, en);
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

  // ---------- the microphone ----------

  const MIC_TEXT = {
    on: ['きいています', 'Listening'],
    starting: ['じゅんび中', 'Starting to listen…'],
    off: ['タップして話す', 'Tap the microphone to listen'],
    hold: ['押して話す', 'Hold the microphone down while you speak'],
    tap: ['タップしてください', 'Listening stopped: tap the microphone to go on'],
    blocked: ['マイクが使えません', 'The microphone is blocked for this page. Allow it in the browser\'s settings for this site; on an iPhone or iPad, Dictation must also be on (Settings › General › Keyboard).'],
    nomic: ['マイクがありません', 'No microphone was found, or this device cannot recognise Japanese speech.'],
    offline: ['オフライン', 'Speech recognition needs the internet: check the connection.'],
    error: ['エラー', 'Speech recognition stopped: tap the microphone to try again.'],
    unsupported: ['音声認識なし', 'This browser has no speech recognition.'],
  };
  let held = false;
  function micUI() {
    const btn = $('mic');
    const st = L.state;
    const listening = st === 'on' || st === 'starting';
    const key = saved.mic === 'hold' && !held && (st === 'off' || st === 'on' || st === 'starting') ? 'hold' : st in MIC_TEXT ? st : 'off';
    const t = MIC_TEXT[key];
    btn.classList.toggle('on', listening);
    btn.classList.toggle('speech', !!(r && r.speaking && listening));
    btn.classList.toggle('held', held);
    btn.classList.toggle('warn', ['blocked', 'nomic', 'offline', 'error', 'tap'].includes(st));
    btn.setAttribute('aria-pressed', String(listening));
    btn.setAttribute('aria-label', (listening ? 'Listening' : 'Not listening') + '. ' + (saved.mic === 'hold' ? 'Hold to talk.' : listening ? 'Tap to stop listening.' : 'Tap to listen.'));
    $('mic-label').textContent = listening ? 'きいてる' : saved.mic === 'hold' ? '押して話す' : 'マイク';
    $('mic-state').innerHTML = ja(t[0]) + '　' + esc(t[1]);
  }
  function micDown(e) {
    if (phase !== 'play') return;
    wakeAudio();
    if (saved.mic === 'hold') {
      e.preventDefault();
      held = true;
      L.mode = 'hold';
      L.hold(true);
      if ($('mic').setPointerCapture && e.pointerId !== undefined) {
        try {
          $('mic').setPointerCapture(e.pointerId);
        } catch (err) {
          // not every pointer can be captured
        }
      }
      micUI();
    }
  }
  function micUp() {
    if (saved.mic !== 'hold' || !held) return;
    held = false;
    L.hold(false);
    micUI();
  }
  function micTap() {
    if (phase !== 'play' || saved.mic === 'hold') return;
    if (L.state === 'on' || L.state === 'starting') L.stop();
    else L.listen(true);
    micUI();
  }

  // The microphone check on the menu: a few seconds of listening, and what was heard.
  const micTest = { on: false, timer: 0 };
  function micTestStart() {
    if (!L.supported) return;
    wakeAudio();
    if (micTest.on) {
      micTestEnd('');
      return;
    }
    micTest.on = true;
    L.mode = 'free';
    L.listen(true);
    $('mic-test-label').innerHTML = ja('ストップ') + '　Stop';
    $('mic-test-out').innerHTML = ja('きいています…') + '　Listening: say something, like ' + ja('こんにちは') + '.';
    clearTimeout(micTest.timer);
    micTest.timer = setTimeout(() => micTestEnd('Nothing was heard. Check that the microphone is allowed, and speak a little louder.'), 8000);
  }
  function micTestHeard(texts, final) {
    const text = (texts[0] || '').trim();
    if (!text) return;
    const r0 = V.best(V.prepare({ text: 'こんにちは' }), texts);
    $('mic-test-out').innerHTML = ja('聞こえた') + '　' + ja('「' + text + '」') + (r0 && r0.ok ? '　' + ja('ばっちり！') + ' The phone hears you well.' : '');
    if (final) {
      clearTimeout(micTest.timer);
      micTest.timer = setTimeout(() => micTestEnd(null), 1200);
    }
  }
  function micTestEnd(message) {
    clearTimeout(micTest.timer);
    micTest.on = false;
    L.stop();
    L.mode = saved.mic;
    $('mic-test-label').innerHTML = ja('テスト') + '　Test';
    if (message) $('mic-test-out').textContent = message;
  }
  function micTestState() {
    if (!micTest.on) return;
    const st = L.state;
    if (['blocked', 'nomic', 'offline', 'error', 'tap'].includes(st)) micTestEnd(MIC_TEXT[st][1]);
  }

  // ---------- the result ----------

  function finishRound() {
    if (r.musicOn) music('cue', 'end');
    L.stop();
    creditPractice();
    saved.pace[r.key] = { r: Math.round(r.rt * 100) / 100, p: Math.round(r.p * 100) / 100 };
    // a round counts for the best only if hints were never always on, and not a weak-spot round
    const counts = !r.hintModes.has('always') && !r.weakOnly;
    const prev = saved.best[r.key];
    const share = r.clean / r.total;
    const isBest = counts && r.clean > 0 && (!prev || share > prev.clean / prev.total || (share === prev.clean / prev.total && r.total > prev.total));
    if (isBest) saved.best[r.key] = { clean: r.clean, total: r.total };
    const runPrev = saved.run[r.key] || 0;
    r.runPrev = runPrev;
    r.runRecord = counts && r.bestRun > runPrev;
    if (r.runRecord) saved.run[r.key] = r.bestRun;
    const tier = tierOf(r);
    r.seal = sealRound(tier, counts);
    save();
    showResult(isBest, prev, counts);
    setPhase('result');
    revealResult(tier);
  }

  // The teacher's stamp, by the share of clean cards, as for the app's week tests.
  function tierOf(round) {
    const share = round.clean / round.total;
    return share >= 0.8 ? 0 : share >= 0.6 ? 1 : 2;
  }

  // A stage's はなまる: たいへんよくできました in a counted round stamps one ring on the stage (or course week), at most
  // one a day; three rings, on three different days, make it.
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

  // The day's speaking time goes on the stamp card: at the end of a round, on Quit, and when the page is hidden.
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
  const todaySec = () => (saved.practice && saved.practice.d === localDay() ? saved.practice.s : 0);

  function showResult(isBest, prev, counts) {
    $('res-kicker').innerHTML = ja('結果') + '　RESULT · ' + ja(STYLES[r.style].ja) + ' · ' + r.name;
    $('res-clean').textContent = r.clean;
    $('res-clean-total').textContent = '/ ' + r.total;
    $('res-line').textContent = fmt(r.time) + (r.skipped ? ' · ' + r.skipped + ' skipped' : '') + (r.style === 'climb' && r.atTop ? ' · to the top' : '');
    $('res-falls').textContent = r.falls;
    $('res-falls-en').textContent = r.style === 'climb'
      ? (!r.falls ? 'slips: not one, all the way up' : 'slips back down the ledge; each time he got up again')
      : (!r.falls ? 'falls: nothing landed on Yaoki all round' : r.skipped ? 'times squashed; ' + r.skipped + ' skipped, the others came back and were said' : 'times squashed; each card came back and was said');
    const modes = r.hintModes;
    const onlyAlways = modes.size === 1 && modes.has('always');
    $('res-hints').textContent = onlyAlways ? '—' : r.hints;
    $('res-hints-en').textContent = onlyAlways ? 'readings were on for every card' : modes.has('always') ? 'cards where a hint showed; readings were always on for part of the round' : modes.size === 1 && modes.has('never') ? 'hints were off' : 'cards where a hint showed';
    const avg = r.sayTimes.length ? r.sayTimes.reduce((a, b) => a + b, 0) / r.sayTimes.length : 0;
    $('res-time').innerHTML = (avg ? avg.toFixed(1) : '—') + ' <small>s</small>';

    const tier = tierOf(r);
    const stamp = $('res-stamp');
    stamp.className = 'hanko' + (tier === 0 ? ' three' : '');
    $('res-stamp-text').innerHTML = ['たいへん<br>よく<br>できました', 'よく<br>できました', 'がんばり<br>ましょう'][tier];
    stamp.setAttribute('aria-label', ['Stamp: excellent', 'Stamp: well done', 'Stamp: keep at it'][tier]);

    $('res-run').textContent = r.bestRun;
    const runText = 'longest run of clean cards in a row';
    $('res-run-en').innerHTML = !counts ? esc(runText + ' (not kept: readings always on, or a weak-spot round)')
      : r.runRecord ? esc(runText) + ' <span class="tag gold" lang="ja">記録更新</span> New record'
        : esc(runText) + (r.runPrev ? ' · stage record ' + r.runPrev : '');

    const ups = $('res-ups');
    const allUp = r.falls > 0 && r.skipped === 0 && r.comebacks === r.fellEntries.size;
    ups.hidden = !r.comebacks;
    ups.innerHTML = allUp ? ja('七転び八起き！') + '　Every card that knocked Yaoki over was said ' + (r.style === 'climb' ? 'when he got up.' : 'clean when it came back.')
      : ja('起き上がり') + ' ×' + r.comebacks + '　' + (r.comebacks === 1 ? 'One was' : r.comebacks + ' were') + ' said ' + (r.style === 'climb' ? 'after a slip' : r.comebacks === 1 ? 'clean when it came back' : 'clean when they came back') + ' (' + ja('起') + ')';

    $('res-wc-row').hidden = !r.weakDealt;
    $('res-wc').innerHTML = r.weakClean + ' <small>/ ' + r.weakDealt + '</small>';

    $('res-best').hidden = !isBest && !prev;
    $('res-best').firstElementChild.hidden = !isBest;
    if (isBest) $('res-best-text').textContent = 'New best on this ' + (r.course ? 'week' : 'stage') + ': ' + r.clean + ' of ' + r.total + ' said right first time.';
    else if (prev) $('res-best-text').textContent = 'Best on this ' + (r.course ? 'week' : 'stage') + ': ' + prev.clean + ' of ' + prev.total + '.' + (counts ? '' : ' (Rounds with readings always on, and weak-spot rounds, are not counted.)');

    showSeal(tier, counts);

    // what the phone heard instead of the card (the last time for each card)
    const seenMis = new Map();
    for (const m of r.misheard) seenMis.set(m.text, m);
    const mis = [...seenMis.values()].slice(-6);
    $('res-heard-box').hidden = !mis.length;
    const list = $('res-heard');
    list.textContent = '';
    for (const m of mis) {
      const li = document.createElement('li');
      li.innerHTML = ja(m.text) + (m.reading !== m.text ? ' <span lang="ja">（' + esc(m.reading) + '）</span>' : '') + '<span>heard as</span><span class="was" lang="ja">' + esc(m.heard) + '</span>' + (m.said ? '<span lang="ja">（' + esc(m.said) + '）</span>' : '');
      list.appendChild(li);
    }

    const weak = [...r.missed.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    $('res-weak-box').hidden = !weak.length;
    fillChips($('res-weak'), weak, STAR_ICON);
    const grad = [...r.graduated];
    const left = weakItems().length;
    $('res-grad-box').hidden = !grad.length;
    fillChips($('res-grad'), grad.map((key) => [key, 1]), DONE_ICON);
    $('res-grad-note').innerHTML = (left ? '' : '<b lang="ja">苦手ゼロ！</b>　No weak spots left on this ' + (r.course ? 'week' : 'stage') + '. ')
      + ja('3回つづけてノーミス') + '　Three clean in a row took these off your weak spots.';
    $('again-weak').hidden = !left;

    renderDayCard(true);

    const parts = ['Round over.', r.clean + ' of ' + r.total + ' cards said right first time.', ['Stamp: excellent.', 'Stamp: well done.', 'Stamp: keep at it.'][tier]];
    if (r.bestRun >= 2) parts.push('Longest clean run ' + r.bestRun + (r.runRecord ? ', a new record.' : '.'));
    if (r.comebacks) parts.push(r.comebacks + (r.comebacks === 1 ? ' comeback.' : ' comebacks.'));
    if (grad.length) parts.push('Off the weak list: ' + grad.slice(0, 5).join(', ') + (grad.length > 5 ? ', and ' + (grad.length - 5) + ' more.' : '.'));
    if (r.cardDone) parts.push('Stamp card complete.');
    else if (r.dayStamp) parts.push('Today\'s stamp is in, ' + r.dayStamp + ' of 7.');
    if (r.seal && r.seal.kind === 'ring') parts.push('A ring for this ' + (r.course ? 'week' : 'stage') + ', ' + r.seal.n + ' of 3.');
    if (r.seal && r.seal.kind === 'hana') parts.push('はなまる for this ' + (r.course ? 'week' : 'stage') + '.');
    say('結果', jaMarked(parts.join(' ')), true);
  }

  const STAR_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9 6.6 19.8l1.1-6.1L3.2 9.4l6.1-.8z" fill="#F2B43A" stroke="#1B2440" stroke-width="1.8" stroke-linejoin="round"/></svg>';
  const DONE_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#FFFFFF" stroke="#E2452B" stroke-width="2.4"/><text x="12" y="16.5" text-anchor="middle" font-size="12" font-weight="800" fill="#C7361E">済</text></svg>';
  function fillChips(box, list, icon) {
    box.textContent = '';
    for (const [key, n] of list) {
      const chip = document.createElement('span');
      if (/[぀-ヿ一-鿿]/.test(key)) chip.lang = 'ja';
      chip.innerHTML = icon;
      chip.appendChild(document.createTextNode(key + (n > 1 ? ' ×' + n : '')));
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
        text.innerHTML = 'Rings towards a ' + what + '\'s ' + ja('はなまる') + ' are not given with readings always on, or in weak-spot rounds.';
      }
    }
    const next = tier === 0 && counts && !r.course ? nextStage(r.key) : null;
    const btn = $('res-next');
    btn.hidden = !next;
    if (next) btn.innerHTML = '<span>' + ja('次のステージ') + '　Next: ' + ja(next.ja) + ' ' + esc(next.en) + '</span>';
  }
  function nextStage(key) {
    const [mode, id] = key.split(':');
    const list = STAGES[mode];
    if (!list) return null;
    const i = list.findIndex((s) => s.id === id);
    return i >= 0 && i + 1 < list.length ? list[i + 1] : null;
  }

  function revealResult(tier) {
    for (const el of [$('res-stamp'), $('res-ink')]) {
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = '';
    }
    const wait = Math.max(0, (r.voiceUntil - r.time) * 1000);
    sfxLater('result', { tier }, Math.max(reducedMotion.matches ? 0 : 452, wait));
  }

  // ---------- the stamp card ----------

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
    const shown = Math.floor(s);
    const left = Math.max(0, goal - shown);
    const count = days.length + ' / 7';
    if (onResult) {
      $('res-day-count').textContent = count;
      $('res-day-line').innerHTML = r && r.cardDone ? ja('スタンプカード完成！') + '　Card complete: seven days of practice. A new card starts next time.'
        : r && r.dayStamp ? ja('今日の分、済！') + '　Today\'s stamp is in: ' + r.dayStamp + ' of 7.'
          : stampedToday ? ja('今日の分は済') + '　Today\'s stamp was already in. ' + days.length + ' of 7.'
            : ja('今日') + ' <b>' + fmt(shown) + '</b> / ' + fmt(goal) + '　' + fmt(left) + ' more speaking for today\'s stamp.';
      return;
    }
    $('day-count').textContent = count;
    $('day-line').innerHTML = '<b>' + fmt(shown) + '</b> / ' + fmt(goal) + '　' + ja('今日の練習') + '　Spoken today';
    $('day-hint').innerHTML = (stampedToday ? ja('今日の分、済！') + '　Today\'s stamp is in. See you tomorrow.'
      : ja('あと ' + fmt(left) + ' で今日のスタンプ') + '　' + fmt(left) + ' more speaking for today\'s stamp.')
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
    $('day-sr').textContent = 'Stamp card: ' + days.length + ' of 7 days stamped. Today: ' + (stampedToday ? 'stamped.' : mins(shown) + ' of ' + saved.goal + ' minutes spoken.')
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

  // The little pictures of the two ways to play.
  const WAY_ART = {
    fall: '<svg viewBox="0 0 120 70" aria-hidden="true"><path d="M0 60h120" stroke="#E2452B" stroke-width="3"/><g transform="translate(46 4) rotate(-8 14 9)"><path d="M3 4h22l3 8-5 8H5L0 12z" fill="#E4E1DA" stroke="#1B2440" stroke-width="1.5" stroke-linejoin="round"/><text x="14" y="15" font-size="8" text-anchor="middle" fill="#1B2440" font-weight="700">ねこ</text></g><g transform="translate(70 -6)"><circle cx="8" cy="8" r="7" fill="#EAF6FF" stroke="#1B2440" stroke-width="1.3"/></g><path d="M60 26v6M56 30l4 4 4-4" stroke="#5A6382" stroke-width="1.5" fill="none" stroke-linecap="round"/><g transform="translate(48 36) scale(.24)"><path d="M50 6c26 0 40 20 40 46 0 24-16 42-40 42S10 76 10 52C10 26 24 6 50 6z" fill="#E2452B"/><ellipse cx="50" cy="42" rx="27" ry="23" fill="#FFF6EA"/><circle cx="39" cy="42" r="7" fill="#fff" stroke="#1B2440" stroke-width="3"/><circle cx="61" cy="42" r="7" fill="#fff" stroke="#1B2440" stroke-width="3"/><circle cx="61" cy="38" r="3.5" fill="#1B2440"/><ellipse cx="50" cy="58" rx="4" ry="5" fill="#1B2440"/></g></svg>',
    climb: '<svg viewBox="0 0 120 70" aria-hidden="true"><path d="M14 70V0M106 70V0" stroke="#C9D0E3" stroke-width="2"/><path d="M20 58h30M70 36h30M20 14h30" stroke="#8C7B63" stroke-width="5" stroke-linecap="round"/><rect x="72" y="40" width="26" height="11" rx="3" fill="#fff" stroke="#1B2440" stroke-width="1.3"/><text x="85" y="48.5" font-size="7" text-anchor="middle" fill="#1B2440" font-weight="700">いぬ</text><path d="M44 46q14-20 30-14" stroke="#5A6382" stroke-width="1.4" fill="none" stroke-dasharray="2 3"/><g transform="translate(26 34) scale(.24)"><path d="M50 6c26 0 40 20 40 46 0 24-16 42-40 42S10 76 10 52C10 26 24 6 50 6z" fill="#E2452B"/><ellipse cx="50" cy="42" rx="27" ry="23" fill="#FFF6EA"/><circle cx="39" cy="42" r="7" fill="#fff" stroke="#1B2440" stroke-width="3"/><circle cx="61" cy="42" r="7" fill="#fff" stroke="#1B2440" stroke-width="3"/><circle cx="64" cy="39" r="3.5" fill="#1B2440"/><ellipse cx="50" cy="58" rx="4" ry="5" fill="#1B2440"/></g></svg>',
  };

  function renderMenu() {
    const ways = $('ways');
    ways.textContent = '';
    for (const id of ['fall', 'climb']) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'way';
      b.setAttribute('aria-pressed', String(saved.style === id));
      b.innerHTML = WAY_ART[id] + '<span class="w-ja" lang="ja">' + STYLES[id].ja + '</span><span class="w-en"><b>' + STYLES[id].en + '.</b> ' + esc(STYLES[id].desc) + '</span>';
      b.addEventListener('click', () => {
        saved.style = id;
        save();
        for (const x of ways.children) x.setAttribute('aria-pressed', String(x === b));
      });
      ways.appendChild(b);
    }
    seg('modes', MODE_ORDER.map((id) => ({ value: id, html: '<span lang="ja">' + MODES[id].ja + '</span>　<small>' + MODES[id].en + '</small>' })), saved.mode, (id) => {
      saved.mode = id;
      save();
      renderPicks();
    });
    seg('len-seg', [[5, 'ちょっと', 'Short'], [10, 'ふつう', 'Regular'], [20, 'しっかり', 'Solid']].map(([n, jaText, en]) => ({
      value: n, cls: 'tile', html: '<b>' + n + '<small lang="ja">枚</small></b><small><span lang="ja">' + jaText + '</span>　' + en + '</small>',
    })), saved.len, (v) => {
      saved.len = v;
      save();
    });
    const no = $('no-speech');
    no.hidden = L.supported;
    $('no-speech-text').innerHTML = 'This browser cannot recognise speech. Open the page in <b>Safari</b> on an iPhone or iPad, or in <b>Chrome</b> on an Android phone or tablet.';
    $('desk-note').hidden = touchOnly.matches || !L.supported;
    $('mic-test').disabled = !L.supported;
    renderDayCard(false);
    renderPicks();
  }

  function renderSettings() {
    seg('mic-seg', [
      { value: 'free', html: '<span lang="ja">ずっと聞く</span>　<small>Hands-free</small>' },
      { value: 'hold', html: '<span lang="ja">押して話す</span>　<small>Hold to talk</small>' },
    ], saved.mic, (v) => {
      saved.mic = v;
      L.mode = v;
      save();
      if (phase === 'play' || phase === 'paused') {
        L.stop();
        if (v === 'free' && phase === 'play') L.listen(true);
      }
      micUI();
    });
    seg('hint-seg', [
      { value: 'always', html: '<span lang="ja">いつも</span>　<small>Always</small>' },
      { value: 'stuck', html: '<span lang="ja">困ったら</span>　<small>When stuck</small>' },
      { value: 'never', html: '<span lang="ja">なし</span>　<small>Never</small>' },
    ], saved.hints, (v) => {
      saved.hints = v;
      save();
    });
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
      stampIfDue(!!r && phase !== 'menu');
      save();
      if (phase === 'menu') renderDayCard(false);
      else if (phase === 'result') renderDayCard(true);
    });
  }

  function renderPicks() {
    const mode = saved.mode;
    $('mode-desc').textContent = MODES[mode].desc;
    $('course-pick').hidden = mode !== 'course';
    $('stage-pick').hidden = mode === 'course';
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
  const bestText = (key) => {
    const b = saved.best[key];
    return b && b.total ? ' · ' + ja('自己ベスト') + ' ' + b.clean + '/' + b.total : '';
  };
  function pickIn(box, b) {
    for (const x of box.children) x.setAttribute('aria-pressed', String(x === b));
  }

  function renderStages() {
    const box = $('stages');
    box.textContent = '';
    const cur = currentStage();
    for (const st of STAGES[saved.mode]) {
      const key = saved.mode + ':' + st.id;
      const b = option({ ja: st.ja, en: st.en, meta: st.items.length + ' cards' + bestText(key), on: st === cur, rings: sealOf(key) });
      b.addEventListener('click', () => {
        saved.stage[saved.mode] = st.id;
        save();
        pickIn(box, b);
        stageNote();
        refreshStart();
      });
      box.appendChild(b);
    }
    stageNote();
  }
  function stageNote() {
    const note = $('stage-note');
    note.hidden = !SINGLE_SOUNDS.has(saved.mode + ':' + currentStage().id);
    note.innerHTML = ja('ひとつの音') + '　A sound on its own is the hardest thing for a phone to hear: say each one clearly, a little drawn out if need be. ' + ja('単語') + ' Words are easier for it.';
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
      const key = 'course:' + level + 'u' + u.n;
      const b = option({
        kick: ja('第' + u.n + '週') + ' · Week ' + u.n,
        ja: u.ja,
        en: u.en,
        meta: u.words.length ? u.words.length + ' words' + bestText(key) : ja('準備中') + '　Not written yet',
        on: u.n === saved.unit[level] && u.words.length > 0,
        disabled: !u.words.length,
        tag: mine ? ja('今') + '　NOW' : '',
        rings: u.words.length ? sealOf(key) : 0,
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
    const ready = !!currentItems() && L.supported;
    $('start').disabled = !ready;
    const n = ready ? weakItems().length : 0;
    $('start-weak').hidden = !n;
    $('start-weak').innerHTML = ja('苦手を練習') + '　Weak spots (' + n + ')';
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
  const STAR = new Path2D('M0 -9l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L0 4.9-5.4 7.8l1.1-6.1-4.5-4.3 6.1-.8z');

  // Yaoki, from the drawing the app uses (Main.dc.html): one eye painted, in every pose.
  const DARUMA = {
    body: new Path2D('M50 6c26 0 40 20 40 46 0 24-16 42-40 42S10 76 10 52C10 26 24 6 50 6z'),
    brows: new Path2D('M28 30c6-5 14-5 19 0M53 30c5-5 13-5 19 0'),
    mouth: new Path2D('M44 55c4 3 8 3 12 0'),
    gold: new Path2D('M38 74h24M42 82h16'),
  };
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
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    // as wide as the box, at least VW units, never so large that a phone shows too little of the world
    const s = Math.max(0.8, Math.min(2.2, cw / VW, ch / 320));
    const old = view;
    view = { W: cw / s, H: ch / s, s, dpr };
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    if (!r) return;
    heights.clear();
    for (const c of r.cards) layoutCard(c);
    if (r.style === 'fall') {
      // keep each thing the same time away from Yaoki at the new size and speed
      const oldImpact = old.H - GROUND_UP - YH;
      const oldSpeed = r.speed;
      setSpeed();
      if (oldSpeed) {
        for (const c of r.cards) {
          if (c.state !== 'live') continue;
          c.x = view.W / 2 + (c.n % 3 - 1) * 4;
          c.y = impactY() - c.h - (oldImpact - c.h - c.y) * (r.speed / oldSpeed);
        }
        r.head = impactY() - (oldImpact - r.head) * (r.speed / oldSpeed);
      }
    } else if (r.ledges.length) {
      const W0 = window.SpeakingWorld;
      r.ledges.forEach((l, k) => {
        const spot = W0 && W0.layout ? safely(() => W0.layout(r.place, k, view.W), null) : null;
        l.x = spot && isFinite(spot.x) ? spot.x : view.W * (k % 2 ? 0.66 : 0.34);
      });
      if (!r.jump) r.yk.x = r.at < 0 ? view.W / 2 : r.ledges[r.at].x;
      r.camY = camFor(standY());
    }
  }

  function draw() {
    const { W, H, s, dpr } = view;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = pal.ground;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr * s, 0, 0, dpr * s, 0, 0);
    if (!r) return;
    r.fxDrawn = 0;
    drawBack(W, H);
    drawPaper(W, H);
    if (r.style === 'climb') drawClimb(W, H);
    else drawFall(W, H);
  }

  // The place (world.js), like a picture pasted into the notebook under its graph paper.
  function drawBack(W, H) {
    const w0 = window.SpeakingWorld;
    if (!r.place || !w0 || typeof w0.back !== 'function' || r.sceneFailed) return;
    const still = reducedMotion.matches;
    ctx.save();
    try {
      w0.back(ctx, {
        place: r.place, style: r.style, W, H, y0: r.style === 'climb' ? r.camY : 0, ground: groundY(), top: r.top,
        t: still ? 0 : r.time, progress: Math.min(1, (r.cleared + r.skipped) / r.total), still, dark: pal.dark,
        season: r.season || (r.season = seasonOf(clock())), pal,
      });
    } catch (err) {
      r.sceneFailed = true;
      console.warn(err);
    }
    ctx.restore();
  }
  function seasonOf(t) {
    const m = new Date(t).getMonth() + 1;
    return m >= 3 && m <= 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter';
  }

  // Graph paper over the place; in Climb it moves with the camera.
  function drawPaper(W, H) {
    const off = r.style === 'climb' ? ((r.camY % 26) + 26) % 26 : 0;
    ctx.save();
    ctx.globalAlpha = r.place && !r.sceneFailed ? 0.55 : 1;
    ctx.strokeStyle = pal.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = ((W / 2) % 26) - 26; x < W; x += 26) {
      ctx.moveTo(Math.round(x) + 0.5, 0);
      ctx.lineTo(Math.round(x) + 0.5, H);
    }
    for (let y = -off; y < H; y += 26) {
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(W, Math.round(y) + 0.5);
    }
    ctx.stroke();
    ctx.restore();
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
  const smooth = (a, b, u) => {
    const k = Math.min(1, Math.max(0, (u - a) / (b - a)));
    return k * k * (3 - 2 * k);
  };

  // ---------- drawing Falling ----------

  function drawFall(W, H) {
    const g = groundY();
    // the route on the ground, and the 済 of each thing said
    ctx.lineCap = 'round';
    ctx.lineWidth = 5;
    ctx.strokeStyle = pal.daruma;
    ctx.beginPath();
    ctx.moveTo(-10, g + 2);
    ctx.lineTo(W + 10, g + 2);
    ctx.stroke();
    drawNodes(W, g);
    const target = targetCard();
    // things lying on the ground or breaking, under him; things falling, over him
    for (const c of r.cards) if (c.state === 'done' && !c.gone) drawThing(c, false);
    drawShards();
    // his bubble is under the things coming down, but over one that waits on his umbrella (nothing moves then)
    const over = !!(target && target.halted);
    if (!over) drawBubble();
    drawYaoki();
    for (const c of r.cards) if (c.state === 'live' || c.state === 'fallen') drawThing(c, c === target);
    if (over) drawBubble();
    drawDrops();
    drawFx();
  }

  // The nodes beside Yaoki: the newest nearest him, on alternate sides.
  function drawNodes(W, g) {
    const slots = Math.max(2, Math.floor((W / 2 - 44) / 30));
    const list = r.nodes.slice(-slots * 2);
    list.forEach((nd, i) => {
      const k = list.length - 1 - i;
      const side = k % 2 ? 1 : -1;
      const x = W / 2 + side * (48 + 30 * Math.floor(k / 2));
      nd.stampT = r.time - nd.at;
      drawNode(nd, x, g - 16, 1, 1);
    });
  }

  // A falling thing: its shape (world.js), its word, and how much of the word has been heard.
  function drawThing(c, isTarget) {
    const w0 = window.SpeakingWorld;
    ctx.save();
    const cx = c.x;
    const cy = c.y + c.h / 2;
    ctx.translate(cx, cy);
    ctx.rotate(c.rot || 0);
    // a squash under him, as it lands on him
    ctx.translate(-cx, -cy);
    let drawn = false;
    if (r.place && w0 && typeof w0.thing === 'function' && !r.sceneFailed) {
      try {
        w0.thing(ctx, { place: r.place, n: c.n, x: c.x - c.w / 2, y: c.y, w: c.w, h: c.h, target: isTarget, flash: c.flashT > 0 || c.state === 'fallen', dark: pal.dark, pal, t: reducedMotion.matches ? 0 : r.time });
        drawn = true;
      } catch (err) {
        r.sceneFailed = true;
      }
    }
    if (!drawn) plaque(c, c.x - c.w / 2, c.y, isTarget, false);
    if (c.halted && r.style === 'fall') umbrellaUnder(c);
    if (c.entry.weak && c.state === 'live') weakCorner(c.x - c.w / 2, c.y, c.w, c.h);
    cardText(c, c.x, c.y, drawn ? '#1B2440' : pal.ink, drawn ? '#5A6382' : pal.muted);
    if (c.state === 'done') {
      const pose = reducedMotion.matches ? { s: 1, tilt: -10, a: 1 } : stampPose(c.stampT);
      ctx.globalAlpha *= pose.a;
      stamp(c.x + c.w / 2 - 6, c.y + 6, 12 * pose.s, 2, pose.tilt, c.comeback ? '起' : '済');
    }
    ctx.restore();
  }

  // The umbrella a waiting thing rests on, over Yaoki.
  function umbrellaUnder(c) {
    const x = view.W / 2;
    const y = c.y + c.h + 2;
    const R = Math.max(34, Math.min(60, c.w / 2 + 6));
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x - R, y + 12);
    ctx.quadraticCurveTo(x, y - 12, x + R, y + 12);
    for (let k = 0; k < 6; k++) {
      const x1 = x + R - (k + 1) * (2 * R / 6);
      ctx.quadraticCurveTo(x + R - (k + 0.5) * (2 * R / 6), y + 7, x1, y + 12);
    }
    ctx.closePath();
    ctx.fillStyle = '#E2452B';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#1B2440';
    ctx.stroke();
    ctx.strokeStyle = '#F2B43A';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let k = 1; k < 6; k++) {
      ctx.moveTo(x, y);
      ctx.lineTo(x - R + k * (2 * R / 6), y + 11);
    }
    ctx.stroke();
    ctx.strokeStyle = '#1B2440';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, impactY() + 4);
    ctx.stroke();
    ctx.restore();
  }

  function drawShards() {
    const w0 = window.SpeakingWorld;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineWidth = 1.5;
    for (const s of r.shards) {
      const col = w0 && w0.colors && r.place ? safely(() => w0.colors(r.place, s.n, pal.dark), null) : null;
      ctx.globalAlpha = Math.max(0, 1 - s.age / 1.2);
      ctx.fillStyle = col ? col.fill : pal.card;
      ctx.strokeStyle = col ? col.line : pal.line;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.a);
      ctx.beginPath();
      ctx.moveTo(s.pts[0][0], s.pts[0][1]);
      for (let i = 1; i < s.pts.length; i++) ctx.lineTo(s.pts[i][0], s.pts[i][1]);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      r.fxDrawn++;
    }
    ctx.restore();
  }
  function drawDrops() {
    if (!r.drops.length) return;
    const yOff = r.style === 'climb' ? -r.camY : 0;
    ctx.save();
    for (const d of r.drops) {
      const a = Math.max(0, 1 - d.age / 0.7);
      if (a <= 0) continue;
      ctx.globalAlpha = a;
      ctx.save();
      ctx.translate(d.x, d.y + (d.world ? yOff : 0));
      ctx.scale(0.4, 0.4);
      ctx.fillStyle = d.color;
      ctx.fill(STAR);
      ctx.lineWidth = 2;
      ctx.strokeStyle = pal.outline;
      ctx.stroke(STAR);
      ctx.restore();
      r.fxDrawn++;
    }
    ctx.restore();
  }

  // ---------- drawing Climb ----------

  function drawClimb(W, H) {
    const w0 = window.SpeakingWorld;
    const y0 = r.camY;
    ctx.save();
    ctx.translate(0, -y0);
    // the ground at the bottom, and the top
    if (y0 + H > -10) {
      ctx.lineCap = 'round';
      ctx.lineWidth = 5;
      ctx.strokeStyle = pal.daruma;
      ctx.beginPath();
      ctx.moveTo(-10, 2);
      ctx.lineTo(W + 10, 2);
      ctx.stroke();
    }
    if (w0 && typeof w0.summit === 'function' && !r.sceneFailed) {
      safely(() => w0.summit(ctx, { place: r.place, W, y: r.top, dark: pal.dark, pal, t: reducedMotion.matches ? 0 : r.time, reached: !!r.atTop, still: reducedMotion.matches, season: r.season }), null);
    } else {
      ctx.fillStyle = pal.gold;
      roundRect(W / 2 - 50, r.top, 100, 10, 5);
      ctx.fill();
    }
    const target = targetCard();
    for (const l of r.ledges) {
      if (l.y + l.card.h + 40 < y0 || l.y - YH - 40 > y0 + H) continue;
      const c = l.card;
      if (w0 && typeof w0.ledge === 'function' && !r.sceneFailed) {
        safely(() => w0.ledge(ctx, { place: r.place, n: r.ledges.indexOf(l), x: l.x, y: l.y, w: l.w, side: l.side, dark: pal.dark, pal, W, season: r.season }), null);
      } else {
        ctx.fillStyle = pal.lineStrong;
        roundRect(l.x - l.w / 2, l.y, l.w, 9, 4);
        ctx.fill();
      }
      const px = Math.max(6, Math.min(W - 6 - c.w, l.x - c.w / 2));
      const py = l.y + 12;
      c.x = px + c.w / 2;
      c.y = py;
      plaque(c, px, py, c === target, true);
      if (c.entry.weak && c.state === 'live') weakCorner(px, py, c.w, c.h);
      cardText(c, c.x, py, c.state === 'live' ? pal.ink : pal.muted, pal.muted);
      if (c.state === 'done') drawNode(c, px + c.w - 8, py + 6, 0.62, 1);
      else if (c.state === 'skipped') skippedMark(px + c.w - 10, py + 8);
    }
    drawYaoki();
    ctx.restore();
    drawDrops();
    drawFx();
    drawBubble();
  }

  // A sign: the one being said has the ink outline and hard shadow of the app's next step; the others are quiet.
  function plaque(c, x, y, isTarget, onLedge) {
    const flash = c.flashT > 0 || c.state === 'fallen';
    ctx.save();
    if (isTarget) {
      roundRect(x, y + 4, c.w, c.h, 12);
      ctx.fillStyle = pal.hard;
      ctx.fill();
    }
    roundRect(x, y, c.w, c.h, 12);
    ctx.fillStyle = flash ? pal.badSoft : pal.card;
    ctx.fill();
    ctx.lineWidth = flash ? 2.5 : 2;
    ctx.strokeStyle = flash ? pal.bad : isTarget ? pal.outline : pal.line;
    ctx.stroke();
    if (onLedge && c.state !== 'live') {
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = pal.ground;
      ctx.fill();
    }
    ctx.restore();
  }

  // A weak-spot card's gold folded corner, top left (the stamp lands top right).
  function weakCorner(x, y, w, h) {
    ctx.save();
    roundRect(x, y, w, h, 12);
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 20, y);
    ctx.lineTo(x, y + 20);
    ctx.closePath();
    ctx.fillStyle = pal.gold;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 20, y);
    ctx.lineTo(x, y + 20);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#1B2440';
    ctx.stroke();
    ctx.restore();
  }

  // The card's words: the reading above (or the dotted room for a hidden one), the word below; the part already heard
  // is green.
  function cardText(c, cx, top, color, muted) {
    const b = c.box;
    if (!b) return;
    const it = c.item;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let y = top + b.pad;
    // how many characters of the line that is said (the reading, or the word itself) have been heard
    const filled = c.fill > 0 && c.state === 'live' ? it.t.end[Math.min(c.fill, it.t.end.length) - 1] + 1 : 0;
    if (it.ruby) {
      if (b.shown) {
        ctx.font = '600 ' + b.rSize + 'px ' + JP;
        let at = 0;
        for (const line of b.rLines) {
          fillLine(line, cx, y + b.rlh / 2, muted, filled - at);
          at += Array.from(line).length;
          y += b.rlh;
        }
      } else {
        // a hidden reading: a dotted line where the furigana will show (the same for every card: it tells nothing)
        ctx.setLineDash([2, 4]);
        ctx.lineCap = 'round';
        ctx.lineWidth = 2;
        ctx.strokeStyle = pal.lineStrong;
        ctx.beginPath();
        ctx.moveTo(cx - 30, y + b.rlh / 2);
        ctx.lineTo(cx + 30, y + b.rlh / 2);
        ctx.stroke();
        ctx.setLineDash([]);
        y += b.rlh * b.rRoom;
      }
      y += 2;
    }
    ctx.font = '600 ' + b.size + 'px ' + JP;
    let at = 0;
    for (const line of b.lines) {
      fillLine(line, cx, y + b.lh / 2 + 1, color, it.ruby ? 0 : filled - at);
      at += Array.from(line).length;
      y += b.lh;
    }
    ctx.restore();
  }
  // A line of text, its first `n` characters green.
  function fillLine(line, cx, y, color, n) {
    ctx.fillStyle = color;
    ctx.fillText(line, cx, y);
    if (n <= 0) return;
    const chars = Array.from(line);
    const full = ctx.measureText(line).width;
    const part = ctx.measureText(chars.slice(0, n).join('')).width;
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - full / 2 - 1, y - 40, part + 1, 80);
    ctx.clip();
    ctx.fillStyle = pal.good;
    ctx.fillText(line, cx, y);
    ctx.restore();
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
  function stampPose(t) {
    const u = Math.min(1, t / STAMP_T);
    if (u < 0.55) {
      const k = ease(u / 0.55);
      return { s: 1.8 - 0.88 * k, tilt: -20 + 10 * k, a: k };
    }
    return { s: 0.92 + 0.08 * ease((u - 0.55) / 0.45), tilt: -10, a: 1 };
  }
  // A node: 済 (起 for a comeback, with a gold ring), inside a はなまる if the card was clean, a star for a weak spot.
  function drawNode(c, x, y, k, alpha) {
    if (alpha <= 0) return;
    const ch = c.comeback ? '起' : '済';
    const t = c.stampT !== undefined ? c.stampT : 1;
    const pose = reducedMotion.matches ? { s: 1, a: 1, tilt: -9 } : stampPose(t);
    ctx.save();
    ctx.globalAlpha *= alpha * pose.a;
    k *= pose.s;
    if (c.clean) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-9 * Math.PI / 180);
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
    stamp(x, y, 15 * k, 2.5, -9, ch);
    if (c.star) {
      ctx.save();
      ctx.translate(x + 19 * k, y + 12 * k);
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
  function skippedMark(x, y) {
    ctx.save();
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = pal.lineStrong;
    ctx.beginPath();
    ctx.moveTo(x - 7, y);
    ctx.lineTo(x + 7, y);
    ctx.stroke();
    ctx.restore();
  }

  // ---------- Yaoki: his pose, his tricks, his words ----------
  //
  // Yaoki is drawn from a pose: where he stands (x, base), how he leans (rot), his squash and stretch (sx, sy), where he
  // looks, and his face. The pose is built each frame from what is going on: breathing and blinking, looking up at the
  // card, a nod for each word heard, a worried look as a thing comes close, squashed flat and popping back up, rolling
  // out of the way, jumping, slipping. Under reduced motion only the face changes, and he is simply where he ends up.

  function yaokiPose() {
    const still = reducedMotion.matches;
    const yk = r.yk;
    const p = { x: view.W / 2, base: groundY(), lift: 0, rot: 0, sx: 1, sy: 1, lookX: 0, lookY: -1, eyes: 'open', brows: 'normal', mouth: 'normal', blush: false, sweat: false, dizzy: 0, pivot: 0, umbrella: false };
    const t = r.time;
    if (r.style === 'climb') climbPose(p);
    else fallPose(p);
    if (p.done) return p;
    if (!still && phase === 'play' && !p.busy) {
      const breath = Math.sin((t * 2 * Math.PI) / 2.2) * 0.022;
      p.sy *= 1 + breath;
      p.sx *= 1 - breath * 0.6;
    }
    // a little nod for each word heard
    if (!still && yk.nodT > 0 && !p.busy) {
      const k = Math.sin(Math.PI * (1 - yk.nodT / NOD_T));
      p.sy *= 1 - 0.07 * k;
      p.sx *= 1 + 0.04 * k;
    }
    if (!still && yk.hopT > 0 && !p.busy) {
      const u = 1 - yk.hopT / HOP_T;
      p.lift += yk.hopH * Math.sin(Math.PI * u);
    }
    if (r.speaking && !p.busy) p.mouth = 'o';
    if (isHappy()) {
      p.mouth = 'happy';
      p.blush = true;
      if (p.brows === 'worried') p.mouth = 'o';
    }
    if (!still && yk.blinkT >= 0 && yk.blinkT < BLINK_T && p.eyes === 'open') p.eyes = 'closed';
    return p;
  }

  function fallPose(p) {
    const still = reducedMotion.matches;
    // squashed flat, then back up with a wobble (the toy rights itself)
    if (r.fall) {
      const f = r.fall;
      p.busy = true;
      if (f.t < 0.14) {
        const k = still ? 1 : f.t / 0.14;
        p.sy = 1 - 0.62 * k;
        p.sx = 1 + 0.5 * k;
      } else if (f.t < 0.9) {
        p.sy = 0.38;
        p.sx = 1.5;
        p.eyes = 'dizzy';
        p.mouth = 'o';
        p.dizzy = still ? 0.5 : f.t;
      } else {
        const u = (f.t - 0.9) / (f.length - 0.9);
        const w = still ? 0 : Math.exp(-4 * u) * Math.cos(12 * u);
        p.sy = 1 + 0.35 * w;
        p.sx = 1 - 0.25 * w;
        p.lift = still ? 0 : 26 * Math.max(0, Math.sin(Math.PI * Math.min(1, u * 2.2))) * (1 - u);
        p.brows = 'up';
      }
      return;
    }
    const target = targetCard();
    if (target) {
      if (target.halted) {
        p.umbrella = true;
        p.brows = 'up';
      } else {
        const near = (impactY() - target.y - target.h) / Math.max(1, r.speed);
        if (near < 1.6) {
          p.brows = 'worried';
          p.sweat = near < 0.9;
          p.mouth = 'o';
        }
      }
    }
    const tr = r.yk.trick;
    if (!tr || still) return;
    const u = Math.min(1, tr.t / tr.len);
    p.busy = true;
    if (tr.kind === 'pop') {
      p.lookY = -1;
      p.brows = 'up';
      p.mouth = 'happy';
      p.busy = false;
    } else if (tr.kind === 'dodge') {
      // he rolls out of its way, and back
      const out = smooth(0, 0.35, u) * (1 - smooth(0.6, 1, u));
      p.x += 46 * out;
      p.rot = 2 * Math.PI * smooth(0, 0.35, u) - 2 * Math.PI * smooth(0.6, 1, u);
      p.pivot = 26;
      p.brows = 'up';
      p.mouth = 'o';
    } else {
      // he jumps up and bumps it apart (spinning, in a clean run)
      const k = u < tr.hit ? smooth(0, tr.hit, u) : 1 - smooth(tr.hit, 1, u);
      p.lift = (tr.kind === 'smash' ? 58 : 46) * k;
      p.sy *= 1 + 0.08 * k;
      p.sx *= 1 - 0.05 * k;
      if (tr.kind === 'spin') {
        p.rot = 2 * Math.PI * smooth(0.05, 0.95, u);
        p.pivot = 29;
        if (p.lift > 4 && r.yk.trail.length < 16) r.yk.trail.push({ x: p.x + (Math.random() - 0.5) * 16, y: groundY() - p.lift - 30 + (Math.random() - 0.5) * 16, age: 0 });
      }
      p.brows = tr.kind === 'smash' ? 'firm' : 'up';
      p.mouth = u < tr.hit + 0.1 && tr.kind === 'smash' ? 'grit' : 'happy';
    }
  }

  function climbPose(p) {
    const still = reducedMotion.matches;
    const yk = r.yk;
    p.x = yk.x || view.W / 2;
    p.base = standY();
    const target = targetCard();
    if (target && target.ledge) {
      p.lookX = Math.max(-1, Math.min(1, (target.ledge.x - p.x) / 60));
      p.lookY = -1;
      if (target.halted) p.brows = 'worried';
    }
    if (r.jump) {
      const j = r.jump;
      const u = Math.min(1, j.t / j.len);
      p.busy = true;
      const k = smooth(0, 1, u);
      p.x = j.fromX + (j.toX - j.fromX) * k;
      const arc = Math.max(40, j.fromY - j.toY) * 0.55 + 24;
      p.base = j.fromY + (j.toY - j.fromY) * k;
      p.lift = arc * Math.sin(Math.PI * u) * (j.kind === 'super' ? 1.25 : 1);
      p.sy *= u < 0.15 ? 1 - 0.18 * Math.sin(Math.PI * u / 0.15) : u > 0.85 ? 1 - 0.14 * Math.sin(Math.PI * (u - 0.85) / 0.15) : 1.08;
      p.sx *= 2 - p.sy;
      p.brows = 'up';
      p.mouth = j.kind === 'scramble' ? 'grit' : 'happy';
      if (j.kind === 'spin') {
        p.rot = 2 * Math.PI * smooth(0.1, 0.9, u);
        p.pivot = 29;
      } else if (j.kind === 'scramble') {
        // he only just makes it: a wobble at the top
        p.rot = u > 0.6 ? 0.25 * Math.sin((u - 0.6) * 30) * (1 - u) : 0;
      }
      if (still) {
        p.x = j.toX;
        p.base = j.toY;
        p.lift = 0;
        p.rot = 0;
      }
      return;
    }
    if (r.fall && r.fall.kind === 'slip') {
      // up towards the sign, a bump of the head, down again; he tips over and rights himself
      const f = r.fall;
      const u = f.t / f.length;
      p.busy = true;
      const card = f.card;
      const reach = Math.max(20, standY() - (card.ledge.y + card.h + 6) - YH);
      if (still) {
        p.eyes = u < 0.62 ? 'dizzy' : 'open';
        return;
      }
      if (u < 0.22) {
        p.lift = reach * Math.sin((Math.PI / 2) * (u / 0.22));
        p.x += (card.ledge.x - p.x) * 0.3 * (u / 0.22);
      } else if (u < 0.4) {
        const k = (u - 0.22) / 0.18;
        p.lift = reach * (1 - k * k);
        p.x += (card.ledge.x - p.x) * 0.3 * (1 - k);
        p.eyes = 'dizzy';
      } else {
        const k = (u - 0.4) / 0.6;
        p.rot = -1.35 * Math.exp(-4 * k) * Math.cos(9 * k) * (k < 0.08 ? k / 0.08 : 1);
        if (k < 0.45) {
          p.eyes = 'dizzy';
          p.dizzy = f.t;
          p.mouth = 'o';
        } else p.brows = 'up';
      }
      return;
    }
    if (r.atTop) {
      p.base = r.top;
      p.x = view.W / 2;
    }
  }

  function drawYaoki() {
    const p = yaokiPose();
    const yk = r.yk;
    yk.lift = p.lift;
    yk.liftMax = Math.max(yk.liftMax, p.lift);
    // the shadow stays on the ground and shrinks as he goes up
    const shade = Math.max(0.35, 1 - p.lift / 140);
    ctx.fillStyle = pal.line;
    ctx.beginPath();
    ctx.ellipse(p.x, p.base + 2, 22 * shade, 4 * shade, 0, 0, Math.PI * 2);
    ctx.fill();
    if (yk.trail.length) drawTrail(yk.trail);
    if (p.umbrella) {
      // the waiting thing rests on his umbrella: drawn with the thing
    }
    drawDaruma(p);
  }

  function drawDaruma(p) {
    ctx.save();
    ctx.translate(p.x, p.base - p.lift);
    if (p.pivot) {
      ctx.translate(0, -p.pivot);
      ctx.rotate(p.rot);
      ctx.translate(0, p.pivot);
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
    if (p.sweat) {
      ctx.fillStyle = '#9FD3F5';
      ctx.strokeStyle = '#1B2440';
      ctx.lineWidth = 2;
      ctx.fill(FACE.sweat);
      ctx.stroke(FACE.sweat);
    }
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
      const a = 1 - s.age / 0.35;
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
    if (r.fall || r.yk.trick || r.jump) return;
    r.yk.hopT = HOP_T;
    r.yk.hopH = h;
  }

  // A word from Yaoki in a bubble, with a little item beside it. Lines come from Yaoki Typing's items.js (several for
  // each occasion) or the few built in here; a newer line replaces the one showing unless that one matters more.
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
    halt: [{ ja: 'ゆっくりでいい', en: 'Take your time', item: 'umbrella' }],
    star: [{ ja: 'にがて克服！', en: 'Weak spot down', item: 'star' }],
    record: [{ ja: '新記録！', en: 'New record', item: 'fan' }],
    endGood: [{ ja: 'やったね！', en: 'Well done', item: 'fireworks' }],
    endOk: [{ ja: 'おつかれ！', en: 'Good work', item: 'tea' }],
    endTry: [{ ja: 'つぎがある！', en: 'Next time', item: 'onigiri' }],
    idle: [{ ja: '声に出して！', en: 'Say it out loud', item: 'note' }, { ja: 'うーん…', en: 'Hmm…', item: 'dango' }],
    miss: [{ ja: 'ん？', en: 'Hm?', item: 'note' }, { ja: 'もういっかい！', en: 'Once more', item: 'koma' }, { ja: 'おしい！', en: 'So close', item: 'pencil' }, { ja: 'もう一度！', en: 'Again!', item: 'kendama' }],
  };
  // the occasions whose lines are this game's own (items.js has Yaoki Typing's: typing words, not spoken ones)
  const OWN_ONLY = new Set(['idle', 'miss', 'halt']);
  const PRIORITY = { step0: 3, step1: 3, step2: 3, step3: 3, record: 3, comeback: 2, rise: 2, halt: 2, star: 2, last: 2, endGood: 3, endOk: 3, endTry: 3, start: 1, half: 1, idle: 0, miss: 1 };
  const turns = {};
  function lineFor(occasion, first) {
    const lib = !OWN_ONLY.has(occasion) && window.TypingItems && window.TypingItems.LINES && window.TypingItems.LINES[occasion];
    const list = Array.isArray(lib) && lib.length ? lib : OWN_LINES[occasion] || [];
    if (!list.length) return null;
    if (first) {
      if (!turns[occasion]) turns[occasion] = 1;
      const own = OWN_LINES[occasion] && OWN_LINES[occasion][0];
      return (own && list.find((x) => x.ja === own.ja)) || list[0];
    }
    const k = (turns[occasion] || 0) % list.length;
    turns[occasion] = (k + 1) % list.length;
    return list[k] || list[0];
  }
  function cheer(occasion, life, opts = {}) {
    if (!r) return;
    const yk = r.yk;
    const line = lineFor(occasion, !!opts.first);
    if (!line) return;
    const prio = PRIORITY[occasion] || 0;
    if (yk.bubble && yk.bubble.prio > prio && yk.bubble.t < yk.bubble.life) return;
    yk.bubble = { ja: line.ja, en: line.en, item: line.item, occasion, prio, t: 0, life };
    r.said.add(occasion);
  }

  // The bubble: beside Yaoki's head, on the side away from the card being said, in the view.
  function drawBubble() {
    const b = r.yk.bubble;
    r.yk.box = null;
    if (!b) return;
    const still = reducedMotion.matches;
    const p = { x: r.style === 'climb' ? r.yk.x || view.W / 2 : view.W / 2, y: (r.style === 'climb' ? (r.atTop ? r.top : standY()) - r.camY : groundY()) - YH - 6 };
    const jaSize = 13;
    const enSize = 9;
    const items = window.TypingItems;
    const icon = b.item && items && items.draw ? Math.round(jaSize + enSize) : 0;
    ctx.save();
    ctx.font = '600 ' + jaSize + 'px ' + JP;
    const wJa = ctx.measureText(b.ja).width;
    ctx.font = '800 ' + enSize + 'px ' + UI;
    const wEn = ctx.measureText(b.en).width;
    const w = Math.ceil(Math.max(wJa, wEn)) + 14 + (icon ? icon + 6 : 0);
    const h = 8 + jaSize + 2 + enSize + 8;
    // to his left in Falling (the nodes are low, the things above); away from the next ledge in Climb
    let side = -1;
    if (r.style === 'climb') {
      const t = targetCard();
      side = t && t.ledge && t.ledge.x < p.x ? 1 : -1;
    }
    let x = side < 0 ? p.x - 26 - w : p.x + 26;
    x = Math.max(4, Math.min(view.W - 4 - w, x));
    const y = Math.max(4, p.y - h - 14);
    const tipX = side < 0 ? Math.min(x + w - 6, p.x - 16) : Math.max(x + 6, p.x + 16);
    const tipY = y + h + 10;
    const pop = still ? 1 : 0.8 + 0.2 * ease(Math.min(1, b.t / BUBBLE_POP));
    ctx.translate(tipX, tipY);
    ctx.scale(pop, pop);
    ctx.translate(-tipX, -tipY);
    const shape = (dy) => {
      const t0 = y + dy;
      const btm = y + h + dy;
      const tx = Math.max(x + 12, Math.min(x + w - 12, tipX));
      ctx.beginPath();
      ctx.moveTo(x + 10, t0);
      ctx.arcTo(x + w, t0, x + w, btm, 10);
      ctx.arcTo(x + w, btm, x, btm, 10);
      ctx.lineTo(tx + 6, btm);
      ctx.lineTo(tipX, tipY + dy);
      ctx.lineTo(tx - 6, btm);
      ctx.arcTo(x, btm, x, t0, 10);
      ctx.arcTo(x, t0, x + w, t0, 10);
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

  // A trick's sound word, drawn like a comic's.
  function drawFx() {
    const fx = r.yk.fx;
    if (!fx || fx.t < 0) return;
    const u = fx.t / FX_T;
    if (u >= 1) return;
    const size = fx.big ? 22 : 16;
    const pop = u < 0.2 ? 0.6 + 0.4 * ease(u / 0.2) : 1;
    const y = fx.worldY ? fx.y - r.camY : fx.y;
    ctx.save();
    ctx.globalAlpha = u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3;
    ctx.translate(Math.max(30, Math.min(view.W - 30, fx.x)), Math.max(16, y) - 10 * u);
    ctx.rotate(-0.12);
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
    r.fxDrawn++;
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
      if ((phase === 'play' || phase === 'paused') && r) draw();
      if (r) r.errors = 0;
    } catch (err) {
      // never leave a dead round on screen: after a few errors in a row, go back to the menu
      console.error(err);
      if (r && ++r.errors >= 3) {
        setPhase('menu');
        $('mode-desc').textContent = 'The round stopped because of an error in the game: ' + err.message;
      }
    }
    requestAnimationFrame(frame);
  }

  // ---------- wiring ----------

  // Turned on its side, the game waits: the round pauses and a note asks for the phone upright.
  function upright() {
    const side = sideways.matches && (phase === 'play' || phase === 'paused');
    $('upright').hidden = !side;
    if (side && phase === 'play') setPhase('paused');
  }

  L.mode = saved.mic;
  document.querySelector('#res-hana path').setAttribute('d', hanamaruPath(66, 12));
  $('hud-hana').setAttribute('d', hanamaruPath(9, 9));
  setPhase('menu');
  renderSettings();

  window.addEventListener('resize', () => resize());
  if (window.ResizeObserver) new ResizeObserver(() => resize()).observe(canvas.parentElement);
  if (sideways.addEventListener) sideways.addEventListener('change', upright);
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
    if (micTest.on) micTestEnd('');
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
  $('again').addEventListener('click', () => {
    clearTimers();
    startRound(!!(r && r.weakOnly && weakItems().length));
  });
  $('again-weak').addEventListener('click', () => startRound(true));
  $('close').addEventListener('click', toMenu);
  $('pause').addEventListener('click', () => setPhase('paused'));
  $('resume').addEventListener('click', () => {
    if (sideways.matches) return;
    setPhase('play');
  });
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
  $('skip').addEventListener('click', () => {
    const t = phase === 'play' ? targetCard() : null;
    if (t && t.halted) skipCard(t);
  });
  $('hear').addEventListener('click', () => {
    wakeAudio();
    const t = phase === 'play' ? targetCard() : null;
    if (!t) return;
    if (!canModel(t.item)) {
      setStatus('There is no Japanese voice on this device to say the word: its romaji shows instead.', 'warn');
      if (t.level < 1) {
        t.level = 1;
        layoutCard(t);
        showSay(t);
      }
      return;
    }
    if (!t.hinted) {
      t.hinted = true;
      r.hints++;
    }
    playModel(t);
  });
  const mic = $('mic');
  mic.addEventListener('pointerdown', micDown);
  mic.addEventListener('pointerup', micUp);
  mic.addEventListener('pointercancel', micUp);
  mic.addEventListener('lostpointercapture', micUp);
  mic.addEventListener('click', micTap);
  mic.addEventListener('contextmenu', (e) => e.preventDefault());
  $('mic-test').addEventListener('click', micTestStart);
  const prevState = L.onstate;
  L.onstate = (st, code) => {
    if (prevState) prevState(st, code);
    micTestState();
  };

  // The settings sheet, from the menu, the result or the pause sheet. While it is open the page behind it is inert.
  let settingsFrom = null;
  function openSettings(from) {
    if (phase === 'play') setPhase('paused');
    settingsFrom = from;
    renderSettings();
    $('settings-sheet').hidden = false;
    $('pause-sheet').hidden = true;
    $('app').inert = true;
    const first = $('mic-seg').querySelector('[aria-pressed="true"]') || $('close-settings');
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
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('settings-sheet').hidden) {
      e.preventDefault();
      closeSettings();
    }
  });
  $('opt-sound').addEventListener('change', (e) => {
    saved.sound = e.target.checked;
    save();
    if (saved.sound && r && r.course) loadSound(r.course.level, r.course.unit);
  });
  document.addEventListener('click', () => wakeAudio());

  requestAnimationFrame((now) => {
    last = now;
    requestAnimationFrame(frame);
  });

  // Read-only view of the round, for the browser checks in check/speaking-test.js.
  window.ykSpeaking = {
    state() {
      const t = r ? targetCard() : null;
      const yk = r ? r.yk : null;
      return {
        phase,
        mode: saved.mode,
        style: r ? r.style : saved.style,
        mic: L.state,
        target: t ? {
          text: t.item.text, reading: t.item.reading, romaji: t.item.romaji, level: hintLevel(t), halted: t.halted, misses: t.misses,
          fill: t.fill, len: t.item.t.len, readingShown: !!(t.item.ruby && readingShown(t)), weak: !!t.entry.weak, y: Math.round(t.y), h: Math.round(t.h),
        } : null,
        run: r ? r.run : 0,
        bestRun: r ? r.bestRun : 0,
        comebacks: r ? r.comebacks : 0,
        graduated: r ? [...r.graduated] : [],
        weakCards: r ? { dealt: r.weakDealt, clean: r.weakClean } : null,
        practice: r ? Math.round(r.practice * 10) / 10 : 0,
        day: { d: localDay(), s: todaySec(), goal: saved.goal, stamped: saved.stampCard.lastDay === localDay() },
        stampCard: { days: saved.stampCard.days.slice(), done: saved.stampCard.done },
        yaoki: yk ? { bubble: yk.bubble ? yk.bubble.ja : null, item: yk.bubble ? yk.bubble.item : null, happy: isHappy(), liftMax: yk.liftMax, box: yk.box, trick: yk.trick ? yk.trick.kind : r.jump ? r.jump.kind : null, at: r.at } : null,
        tricks: r ? Object.assign({}, r.tricks) : null,
        place: r ? r.place : null,
        sceneFailed: !!(r && r.sceneFailed),
        song: r ? r.song : null,
        fx: r ? r.fxDrawn : 0,
        cleared: r ? r.cleared : 0,
        skipped: r ? r.skipped : 0,
        total: r ? r.total : 0,
        falls: r ? r.falls : 0,
        falling: !!(r && r.fall),
        fallKind: r && r.fall ? r.fall.kind : null,
        back: r && r.fall && r.fall.kind === 'crush' ? r.fall.back : null,
        clean: r ? r.clean : 0,
        hints: r ? r.hints : 0,
        speed: r ? r.speed : 0,
        T: r ? r.T : 0,
        W: view.W,
        H: view.H,
        cards: r ? r.cards.map((c) => ({ text: c.item.text, state: c.state, x: Math.round(c.x), y: Math.round(c.y), w: Math.round(c.w), h: Math.round(c.h), clean: c.clean, comeback: c.comeback, star: c.star, trick: c.trick })) : [],
        ledges: r ? r.ledges.length : 0,
        atTop: !!(r && r.atTop),
      };
    },
  };
})();
