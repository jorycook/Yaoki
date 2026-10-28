/*
 * Yaoki Typing's music: short, bright loops for a round, played live with the Web Audio API
 * (no sound files). Each song is chiptune with a Japanese flavour: a pentatonic tune of folk
 * song (the yo, min'yō, Ryukyu, hirajoshi or kumoi scale) on a fue-like flute or a little
 * pulse wave, taiko-like drums, a shamisen or koto pluck and a driving bass.
 *
 * The songs are written as data: bars of 16 steps, an A and a B section of eight bars each,
 * the chords bar by bar and the tune in scale degrees. The music grows with the player's run
 * in four levels (setLevel) and answers the round with cues locked to the beat: a crash for a
 * new step of the run, a falling fill when Yaoki falls, a drum roll for the last card and a
 * short cadence at the end.
 *
 * It plays into the effects' output (sfx.js, TypingSfx.audio()), through its own bus and a
 * gentle compressor, under the effects. A short look-ahead scheduler (a timer every 25 ms,
 * notes placed up to 0.12 s ahead on the audio clock) keeps the beat tight. When the output is
 * closed (the page hidden, the effects turned off) the music stops cleanly and keeps its
 * place, as if paused. Every call is safe without audio and never throws.
 *
 *   TypingMusic.SONGS              [{ id, ja, en, bpm }]
 *   TypingMusic.start(id)          start or switch to a song at level 1; false if no output
 *   TypingMusic.stop(fade = 0.4)   fade out and stop
 *   TypingMusic.pause() / resume() keep the place / go on (from the bar's start on a new output)
 *   TypingMusic.setLevel(0..3)     0 sparse, 1 groove, 2 + tune, 3 + counter-melody; next beat
 *   TypingMusic.duck(seconds)      dip to a quarter meanwhile
 *   TypingMusic.cue(name)          'step', 'fall', 'last' or 'end', on the next beat
 *   TypingMusic.volume(v)          0..1 (0.6 at first; 0 mutes); returns the volume
 *   TypingMusic.state()            { playing, paused, song, level, bpm, heard, section, bar,
 *                                    tension, ending, volume }
 */
(function () {
  'use strict';

  const LOOKAHEAD = 0.12;   // seconds of notes placed ahead of the audio clock
  const TICK = 25;          // ms between scheduler runs
  const TRIM = 0.2;         // the bus's level after the compressor (set by measurement)
  const DEFAULT_VOLUME = 0.6;
  const BRIGHT = [0.8, 1, 1.08, 1.32];   // filter brightness by level
  const SHINE = [-3, 0, 0.5, 2.5];       // high-shelf gain (dB) by level
  const LEVEL_GAIN = [0.85, 0.9, 1, 1.1]; // the whole mix grows a little with each level
  const VEL = { X: 1, x: 0.7, o: 0.38 };
  const IDX = '0123456789abcdefghij';

  // ---------- the songs ----------
  // Patterns are 16 steps (sixteenth notes) a bar. Drums: X accent, x hit, o ghost, . rest.
  // Part patterns are given by level ({ 0: ..., 1: ... }: the highest key at or under the level
  // plays; none means the part is silent). A pattern may be a list, one per bar of a section.
  // bass:  1 root, 3 the chord's third, 5 fifth, 7 the chord's seventh, b flat seventh,
  //        2 / 4 / 6 / 8 / 9 the second, fourth, sixth, octave and ninth, x a muted note
  // comp / counter: 0-9 the chord's tones upward from `low` (0 the root), x the whole chord
  // lead:  scale degrees, 5 the tonic at `home`, 0-4 the octave under it, a-e the one above
  // - holds the note before, . is silence.
  const SONG_DEFS = [
    {
      id: 'matsuri', ja: 'お祭り', en: 'Festival', bpm: 140, swing: 0,
      scale: [0, 2, 5, 7, 9],                       // yo scale on D: D E G A B
      end: 'D5', roll: 'shime', gain: 0.89,
      echo: [3, 0.26, 0.2],
      mix: { drums: 1, perc: 1.02, bass: 0.85, comp: 0.99, lead: 0.97, counter: 0.54 },
      chords: {
        A: ['D5', 'D5', 'G', 'Asus4', 'D5', 'D5', 'Em7', 'Asus4'],
        B: ['G', 'Asus4', 'Em7', 'D5', 'G', 'Asus4', 'Em7', 'Asus4'],
      },
      drums: [
        { v: 'don', p: { 0: 'X.......X.......', 1: 'X...X...X...X...', 2: 'X...X...X.x.X...', 3: 'X...X..xX.x.X..x' } },
        { v: 'ka', p: { 1: '..x...x...x...x.', 3: '..x...x.o.x...xo' } },
        { v: 'shime', p: { 1: '....X.......X...', 2: '....X.......X..o', 3: '..o.X..o..o.X.o.' } },
        { v: 'shaker', p: { 0: '..x...x...x...x.', 1: 'xoXoxoXoxoXoxoXo' } },
        { v: 'chanchiki', p: { 3: 'X.xxX.x.X.xxX.x.' } },
      ],
      fill: { from: 8, don: '........X.xxX.XX', shime: '........o.o.oxox', ka: '................' },
      bass: { v: 'tri', low: 38, p: { 0: '1.......1.....5.', 1: '1.81.18.1.81.58.' } },
      comp: { v: 'shami', low: 62, p: { 1: '0.2.1.2.0.2.1.21' } },
      lead: {
        v: 'fue', home: 74,
        A: ['8.8.9.a----.9.8.', '7---6.7.8-----..', '9.8.7---6.7.9---', '8-----7.6---5.6.',
          '8.8.9.a----.b.a.', '9---8.9.a-----..', 'b.a.9-8-7---6.7.', '8-------....7.9.'],
        B: ['a.a.a.b.a-9-7---', '8.8.8.9.8-7-6---', '7.9.b-a-9-7-6-7-', '5-----..6.7.8.9.',
          'a.a.a.b.a-9-7---', '8.8.8.9.8-7-6---', '7.9.b.c.b-a-9-a-', 'a-----9-8-------'],
      },
      counter: { v: 'koto', harm: -2 },
    },
    {
      id: 'umi', ja: '海', en: 'Surf', bpm: 148, swing: 0,
      scale: [0, 4, 5, 7, 11],                      // Ryukyu (Okinawan) scale on C: C E F G B
      end: 'C', roll: 'snare', gain: 1.06,
      echo: [3, 0.36, 0.28],
      mix: { drums: 1, perc: 1.16, bass: 1.29, comp: 1.01, lead: 1.14, counter: 0.49 },
      chords: {
        A: ['C', 'F', 'G', 'C', 'C', 'F', 'G', 'C'],
        B: ['F', 'G', 'C', 'Am', 'F', 'G', 'C', 'G7'],
      },
      drums: [
        { v: 'don', p: { 0: 'X.......X.......', 1: 'X.....x.X.......', 3: 'X.....x.X..x..x.' } },
        { v: 'snare', p: { 1: '....X.......X...', 3: '....X.......X.oo' } },
        { v: 'hat', p: { 0: 'x.x.x.x.x.x.x.x.', 2: 'x.xxx.x.x.xxx.x.' } },
        { v: 'shime', pitch: 1.45, p: { 2: 'X..X..X.........', 3: 'X..X..X...X.X...' } },
        { v: 'whistle', bars: [7], p: { 3: '............X...' } },
      ],
      fill: { from: 8, tom: '........X.x.X.XX', snare: '........o.o.oxXX', don: '................' },
      bass: { v: 'pick', low: 36, p: { 0: '1.......1.......', 1: '1.1.1.151.1.1.15', 3: '1.1.1.151.1.5.85' } },
      comp: { v: 'shami', low: 60, p: { 1: '..x...x...x...x.', 2: '..x...x...x.x.x.' } },
      lead: {
        v: 'surf', home: 72,
        A: ['5.6.7.8-9.a---..', '7-8-a-8-7-----..', '8.8.9.8.6-7-8---', '6-5-4-5-----....',
          '5.6.7.8-9.a---..', '7-8-a-b-c-----..', 'b.b.a.9.8-6-7-9-', 'a-------....8.9.'],
        B: ['c-------a-------', 'b-------9-------', 'b---a---9---8---', 'a-------6---8---',
          'c-------a---c---', 'd-------b---9---', 'a---b---c-b-a-8-', '9-------7-6-4-3-'],
      },
      counter: { v: 'koto', low: 72, p: { 3: '0.1.2.1.3.2.1.2.' } },
    },
    {
      id: 'yoru', ja: '夜', en: 'City night', bpm: 116, swing: 0.1,
      scale: [0, 2, 4, 7, 9],                       // yonanuki major on F: F G A C D
      end: 'FM7', roll: 'snare', gain: 1.19,
      echo: [3, 0.3, 0.22],
      mix: { drums: 1, perc: 0.98, bass: 1.28, comp: 0.27, lead: 0.96, counter: 0.38 },
      chords: {
        A: ['BbM7', 'C7', 'Am7', 'Dm7'],            // the "royal road" of J-pop
        B: ['BbM7', 'A7', 'Dm7', 'Cm7 F7'],
      },
      drums: [
        { v: 'kick', p: { 0: 'X.......X.......', 1: 'X...X...X...X...', 3: 'X...X...X...X.x.' } },
        { v: 'snare', p: { 1: '....X.......X...', 2: '....X..o....X...', 3: '....X..o....X.o.' } },
        { v: 'hat', p: { 0: '..x...x...x...x.', 1: 'x.x.x.x.x.x.x.x.', 2: 'xo.oxo.oxo.oxo.o' } },
        { v: 'ohat', p: { 2: '..x...x...x...x.' } },
        { v: 'clap', p: { 3: '....x.......x...' } },
        { v: 'shaker', p: { 3: 'oxoxoxoxoxoxoxox' } },
      ],
      fill: { from: 12, snare: '............xxXX', kick: '............X...' },
      bass: { v: 'slap', low: 34, p: { 0: '1.......1.......', 1: '1..18.x.1..8.58.', 3: '1..18.x51.x8.58.' } },
      comp: { v: 'ep', low: 57, p: { 1: 'x-----x-----..x-' } },
      lead: {
        v: 'square', home: 77,
        A: ['..7.7.8-7.6-5---', '..6.6.7-6.5-4---', '..3.4.3-4.6-7---', '8-7-6-5---4-----',
          '..7.7.8-7.8-9---', '..9.9.a-9.8-7---', '8-7-8-9-8---7-6-', '5-------....3.4.'],
        B: ['9--8--7-----5.6.', '7--6--7-----....', '4--5--7-----8.9.', '9-8-7-6-5-------',
          '9--8--7-----5.6.', '7--6--7-----9.a.', 'a--9--7-----6.7.', '8-------7-6-5---'],
      },
      counter: { v: 'bell', low: 74, p: { 3: '0.1.2.3.4.3.2.1.' } },
    },
    {
      id: 'take', ja: '竹', en: 'Bamboo', bpm: 108, swing: 0,
      scale: [0, 2, 3, 7, 8],                       // hirajoshi (a koto tuning) on A: A B C E F
      end: 'Am', roll: 'shime', gain: 1.29,
      echo: [3, 0.34, 0.28],
      mix: { drums: 1, perc: 0.45, bass: 0.55, comp: 0.52, lead: 0.62, counter: 0.25 },
      chords: {
        A: ['Am', 'FM7', 'Am', 'Esus4'],
        B: ['FM7', 'Dm7', 'Am', 'Esus4', 'FM7', 'Dm7', 'Esus4', 'E5'],
      },
      drums: [
        { v: 'don', p: { 0: 'X.......X.......', 1: 'X.......X.x.....', 3: 'X.....x.X.x...x.' } },
        { v: 'ka', p: { 1: '....x.......x...', 2: '....x..o....x...', 3: '....x..o....x.o.' } },
        { v: 'shaker', p: { 0: '..x...x...x...x.', 1: 'xox.xox.xox.xox.', 3: 'xoxoxoxoxoxoxoxo' } },
        { v: 'shime', p: { 3: '..o...o...o..oo.' } },
      ],
      fill: { from: 12, tom: '............X.XX', don: '................' },
      bass: { v: 'sub', low: 33, p: { 0: '1.......1.......', 1: '1.....1.1...5...', 3: '1.....1.1..5..8.' } },
      comp: { v: 'koto', low: 57, p: { 1: '0.1.2.3.4.3.2.1.' } },
      lead: {
        v: 'shaku', home: 69,
        A: ['8-------7-6-5---', '7---8---9-------', 'a---9-8-7---8---', '6-----------5.6.',
          '8-------7-6-5---', '7---8---a-------', 'b---a---9-8-7---', '6-------5-------'],
        B: ['a-.a-.9-8-7-----', '9-.9-.8-7-5-----', '8-.8-.7-6-5-----', '6-----5-6-------',
          'a-.a-.b-c-a-----', '9-.9-.a-b-9-----', '8-------a-------', '6---------------'],
      },
      counter: { v: 'koto', low: 69, p: { 3: '43.2..2.43.2..1.' } },
    },
    {
      id: 'uchu', ja: '宇宙', en: 'Space', bpm: 128, swing: 0,
      scale: [0, 3, 5, 7, 10],                      // min'yō scale on D: D F G A C
      end: 'Dm', endVoice: 'bell', roll: 'snare', gain: 1.27,
      echo: [3, 0.4, 0.3],
      mix: { drums: 1, perc: 0.54, bass: 0.61, comp: 0.64, lead: 1, counter: 0.27 },
      chords: {
        A: ['Dm', 'BbM7', 'C', 'Am'],
        B: ['Gm7', 'Am7', 'BbM7', 'C', 'Gm7', 'Am7', 'BbM7', 'C7sus4'],
      },
      drums: [
        { v: 'kick', p: { 0: 'X.......X.......', 1: 'X...X...X...X...' } },
        { v: 'clap', p: { 1: '....X.......X...' } },
        { v: 'snare', p: { 3: '....x.......x..o' } },
        { v: 'hat', p: { 0: '..x...x...x...x.', 1: 'x.X.x.X.x.X.x.X.', 2: 'xoXoxoXoxoXoxoXo' } },
        { v: 'ohat', p: { 3: '..x...x...x...x.' } },
        { v: 'zap', bars: [3, 7], p: { 3: '............x...' } },
      ],
      fill: { from: 12, snare: '............xxxx', clap: '................' },
      bass: { v: 'sub', low: 38, p: { 0: '1.......1.......', 1: '..1...1...1...1.', 3: '..1..11...1..18.' } },
      comp: { v: 'arp', low: 57, p: { 1: '0.1.2.3.2.1.2.3.', 2: '0123012301230123' } },
      lead: {
        v: 'pulse25', home: 74,
        A: ['a-------9-8-a---', '8-------7-6-5---', '7---9---a---9---', '8---------------',
          'a-------9-8-a-b-', 'c-------b-a-8---', '9---a---9---7---', '8-----------6.7.'],
        B: ['8.8.7.8.9-8-7---', '8.8.7.8.a-9-8---', 'b.b.a.b.c-b-a---', '9-------7-------',
          '8.8.7.8.9-8-7---', '8.8.7.8.a-9-8---', 'b.b.a.b.c-b-a---', '9---a---b---c---'],
      },
      counter: { v: 'bell', low: 74, p: { 3: '4..3..2..3..4.3.' } },
    },
    {
      id: 'yuki', ja: '雪', en: 'Snow', bpm: 124, swing: 0.12,
      scale: [0, 2, 3, 7, 9],                       // kumoi scale on E: E F# G B C#
      end: 'Em', roll: 'snare', gain: 1.33,
      echo: [3, 0.32, 0.26],
      mix: { drums: 1, perc: 0.99, bass: 0.73, comp: 0.46, lead: 1.17, counter: 0.42 },
      chords: {
        A: ['Em', 'A', 'G', 'D'],
        B: ['G', 'A', 'F#m7', 'Bm7'],
      },
      drums: [
        { v: 'kick', p: { 0: 'X.......X.......', 1: 'X.....x.X.......', 3: 'X.....x.X..x....' } },
        { v: 'snare', p: { 1: '....X.......X...', 3: '....X.......X..o' } },
        { v: 'jingle', p: { 0: '..x...x...x...x.', 1: 'X.x.X.x.X.x.X.x.', 3: 'XoxoXoxoXoxoXoxo' } },
        { v: 'hat', p: { 2: '..x...x...x...x.' } },
        { v: 'clap', p: { 3: '....x.......x...' } },
      ],
      fill: { from: 12, snare: '............x.xx', tom: '............X.X.' },
      bass: { v: 'round', low: 38, p: { 0: '1.......1.......', 1: '1..1..5.1..1..5.', 3: '1..1..5.1..1.58.' } },
      comp: { v: 'bell', low: 64, p: { 1: '0.2.1.2.3.2.1.2.' } },
      lead: {
        v: 'pulse12', home: 76,
        A: ['5.6.7.8---7-6---', '9.8.6.9---8-6---', '8.7.6.7---6-3---', '6-------........',
          '5.6.7.8---a-8---', '9.8.9.b---a-9---', 'a.9.8.6---7-8---', 'b-------a-------'],
        B: ['a.a.8.a.b-a-8---', '9.9.6.9.a-9-6---', '8.8.6.8.9-8-6---', '8-------........',
          'a.a.8.a.b-a-8---', '9.9.6.9.c-b-a---', 'b.b.a.9.a-9-8-6-', '8-------....3.4.'],
      },
      counter: { v: 'koto', low: 76, p: { 3: '4..3..2.4..3..2.' } },
    },
  ];

  // ---------- reading the data ----------
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const QUALITY = {
    '': [0, 4, 7], m: [0, 3, 7], 5: [0, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], M7: [0, 4, 7, 11],
    sus4: [0, 5, 7], sus2: [0, 2, 7], 6: [0, 4, 7, 9], m6: [0, 3, 7, 9], '7sus4': [0, 5, 7, 10],
  };
  function parseChord(name) {
    const m = /^([A-G])([b#]?)(.*)$/.exec(name);
    const pc = NOTE[m[1]] + (m[2] === 'b' ? -1 : m[2] === '#' ? 1 : 0);
    return { pc: (pc + 12) % 12, tones: QUALITY[m[3]] || QUALITY[''] };
  }
  // Level maps become a list of four: the pattern each level plays, or null.
  function byLevel(map) {
    const out = [null, null, null, null];
    if (!map) return out;
    let cur = null;
    for (let l = 0; l < 4; l++) {
      if (map[l] !== undefined) cur = map[l];
      out[l] = cur;
    }
    return out;
  }
  function minLevel(list) {
    for (let l = 0; l < 4; l++) if (list[l]) return l;
    return 9;
  }
  function compile(d) {
    const s = Object.assign({}, d);
    s.form = d.form || ['A', 'B'];
    s.ch = {};
    for (const sec of Object.keys(d.chords)) s.ch[sec] = d.chords[sec].map((e) => e.split(' ').map(parseChord));
    s.drums = d.drums.map((p) => Object.assign({}, p, { p: byLevel(p.p), g: p.g || 1 }));
    s.bass = Object.assign({}, d.bass, { p: byLevel(d.bass.p) });
    s.comp = Object.assign({}, d.comp, { p: byLevel(d.comp.p) });
    s.comp.min = minLevel(s.comp.p);
    s.counter = Object.assign({}, d.counter, { p: byLevel(d.counter.p) });
    s.endChord = parseChord(d.end);
    const fill = { from: d.fill.from, parts: {} };
    for (const k of Object.keys(d.fill)) if (k !== 'from') fill.parts[k] = d.fill[k];
    s.fill = fill;
    s.sd = 15 / d.bpm;       // one step (a sixteenth) in seconds
    return s;
  }
  const SONGS = SONG_DEFS.map(compile);
  const BY_ID = {};
  for (const s of SONGS) BY_ID[s.id] = s;

  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const mod = (a, n) => ((a % n) + n) % n;

  // The tune's scale degree `i` (5 is the tonic at `home`) as a MIDI note.
  function degree(def, i) {
    const sc = def.scale, n = sc.length;
    return def.lead.home - 12 + 12 * Math.floor(i / n) + sc[mod(i, n)];
  }
  // The k-th tone of a chord upward from `low`, as a MIDI note.
  function chordTone(ch, low, k) {
    const root = low + mod(ch.pc - low, 12), n = ch.tones.length;
    return root + ch.tones[k % n] + 12 * Math.floor(k / n);
  }
  const BASS_STEP = { 1: 0, 2: 2, 4: 5, 5: 7, 6: 9, 8: 12, 9: 14, b: 10, x: 0 };
  function bassNote(ch, low, c) {
    const root = low + mod(ch.pc - low, 12);
    if (c === '3') return root + (ch.tones[1] < 6 ? ch.tones[1] : 4);
    if (c === '7') return root + (ch.tones[3] || 10);
    return root + (BASS_STEP[c] || 0);
  }

  // Where the abs-th bar falls in the song: its section and the bar in it.
  function where(def, bar) {
    const len = def.form.length * 8, b = mod(bar, len);
    return { sec: def.form[(b / 8) | 0], bi: b % 8 };
  }
  function chordAt(def, n) {
    const w = where(def, n >> 4), list = def.ch[w.sec], entry = list[w.bi % list.length];
    return entry[(n & 15) < 8 ? 0 : entry.length - 1];
  }
  function patOf(list, level, bi) {
    const p = list[level];
    if (!p) return null;
    return typeof p === 'string' ? p : p[bi % p.length];
  }
  function partChar(def, part, level, n) {
    const p = patOf(part.p, level, where(def, n >> 4).bi);
    return p ? p[n & 15] : '.';
  }
  function leadChar(def, n) {
    const w = where(def, n >> 4);
    return def.lead[w.sec][w.bi][n & 15];
  }
  function holdOf(get, n) {
    let k = 1;
    while (k < 32 && get(n + k) === '-') k++;
    return k;
  }
  const accent = (s) => (s % 4 === 0 ? 1 : s % 2 === 0 ? 0.84 : 0.7);

  // ---------- sound making ----------
  // Shared per audio context: a second of noise and the instruments' wave shapes.
  const RES = new WeakMap();
  function resources(ctx) {
    let r = RES.get(ctx);
    if (r) return r;
    const n = Math.floor(ctx.sampleRate);
    const noise = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = noise.getChannelData(0);
    let seed = 22695477;
    for (let i = 0; i < n; i++) {
      seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
      d[i] = seed / 0x3fffffff - 1;
    }
    const wave = (count, fn) => {
      const re = new Float32Array(count + 1), im = new Float32Array(count + 1);
      for (let k = 1; k <= count; k++) {
        const ab = fn(k);
        re[k] = ab[0];
        im[k] = ab[1];
      }
      return ctx.createPeriodicWave(re, im);
    };
    const pulse = (duty) => wave(48, (k) => [Math.sin(2 * Math.PI * k * duty) / (k * Math.PI), (1 - Math.cos(2 * Math.PI * k * duty)) / (k * Math.PI)]);
    r = {
      noise,
      pulse12: pulse(0.125),
      pulse25: pulse(0.25),
      // a shamisen's twang: a saw-like spectrum with a bump around the 5th-7th harmonics
      shami: wave(40, (k) => [0, (1 / k) * (1 + 1.6 * Math.exp(-((k - 6) * (k - 6)) / 6))]),
      // a bamboo flute: mostly the fundamental with a little 2nd and 3rd
      fue: wave(6, (k) => [0, [1, 0.12, 0.2, 0.05, 0.03, 0.01][k - 1]]),
    };
    RES.set(ctx, r);
    return r;
  }

  // Disconnect a note's nodes when its source has stopped.
  function done(src, a, b, c) {
    src.onended = () => {
      try {
        src.disconnect();
        if (a) a.disconnect();
        if (b) b.disconnect();
        if (c) c.disconnect();
      } catch (err) {
        // already gone
      }
    };
  }
  function osc(x, wave, f, t) {
    const o = x.ctx.createOscillator();
    if (typeof wave === 'string') o.type = wave;
    else o.setPeriodicWave(wave);
    o.frequency.setValueAtTime(f, t);
    return o;
  }
  function noiseSrc(x, t) {
    const s = x.ctx.createBufferSource();
    s.buffer = x.r.noise;
    s.loop = true;
    x.seed = (x.seed + 0.1379) % 0.85;
    s.start(t, x.seed);
    return s;
  }
  function filter(x, type, f, q) {
    const fl = x.ctx.createBiquadFilter();
    fl.type = type;
    fl.frequency.value = f;
    fl.Q.value = q;
    return fl;
  }
  // A percussive gain: a quick rise to `peak` and an exponential fall over `d`.
  function perc(g, t, peak, a, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  // A held note's gain: a rise, a settle to `sus` of the peak, and a release at `end`.
  function held(g, t, peak, a, sus, dTau, end, rTau) {
    end = Math.max(end, t + a + 0.01);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setTargetAtTime(peak * sus, t + a, dTau);
    g.gain.setTargetAtTime(0, end, rTau);
  }
  // One tonal hit, gliding from f0 to f1.
  function tone(x, out, t, wave, f0, f1, glide, a, d, peak) {
    const o = osc(x, wave, f0, t), g = x.ctx.createGain();
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + glide);
    perc(g, t, peak, a, d);
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + a + d + 0.02);
    done(o, g);
  }
  // One burst of filtered noise.
  function hiss(x, out, t, type, f, q, a, d, peak) {
    const s = noiseSrc(x, t), fl = filter(x, type, f, q), g = x.ctx.createGain();
    perc(g, t, peak, a, d);
    s.connect(fl);
    fl.connect(g);
    g.connect(out);
    s.stop(t + a + d + 0.02);
    done(s, fl, g);
  }
  function vibrato(x, o, t, stop, f, rate, depth, delay) {
    const l = x.ctx.createOscillator(), g = x.ctx.createGain();
    l.frequency.value = rate;
    g.gain.setValueAtTime(0, t);
    g.gain.setValueAtTime(0, t + delay);
    g.gain.linearRampToValueAtTime(f * depth, t + delay + 0.25);
    l.connect(g);
    g.connect(o.frequency);
    l.start(t);
    l.stop(stop);
    done(l, g);
  }

  // Drums and percussion: (x, t, velocity, out, arg)
  const DRUM = {
    // a taiko "don": a deep skin that drops in pitch, with the slap of the stick
    don(x, t, v, out, pitch) {
      const p = pitch || 1;
      tone(x, out, t, 'sine', 165 * p, 60 * p, 0.11, 0.004, 0.42, v);
      hiss(x, out, t, 'lowpass', 1100 * p, 0.7, 0.003, 0.07, v * 0.4);
    },
    // a fill's taiko, higher at the start of the fill and lower at the end
    tom(x, t, v, out, pitch) {
      DRUM.don(x, t, v * 0.85, out, pitch || 1.4);
    },
    // a chip kick
    kick(x, t, v, out) {
      tone(x, out, t, 'sine', 190, 46, 0.07, 0.003, 0.3, v);
      tone(x, out, t, 'triangle', 640, 120, 0.015, 0.001, 0.02, v * 0.3);
    },
    // "ka": the stick on the taiko's wooden rim
    ka(x, t, v, out) {
      hiss(x, out, t, 'bandpass', 2600, 4, 0.002, 0.035, v * 0.6);
      tone(x, out, t, 'sine', 1500, 1250, 0.03, 0.001, 0.04, v * 0.25);
    },
    // a shime-daiko: the small, tight, high drum
    shime(x, t, v, out, pitch) {
      const p = pitch || 1;
      tone(x, out, t, 'triangle', 430 * p, 300 * p, 0.05, 0.002, 0.08, v * 0.5);
      hiss(x, out, t, 'bandpass', 2000 * p, 1.2, 0.002, 0.07, v * 0.45);
    },
    snare(x, t, v, out) {
      tone(x, out, t, 'triangle', 230, 160, 0.06, 0.002, 0.09, v * 0.45);
      hiss(x, out, t, 'highpass', 1300, 0.7, 0.002, 0.15, v * 0.5);
    },
    clap(x, t, v, out) {
      for (let k = 0; k < 3; k++) hiss(x, out, t + k * 0.011, 'bandpass', 1400, 1.3, 0.001, 0.01, v * 0.4);
      hiss(x, out, t + 0.033, 'bandpass', 1400, 1.1, 0.001, 0.13, v * 0.45);
    },
    hat(x, t, v, out) {
      hiss(x, out, t, 'highpass', 7200 * x.bright, 0.7, 0.001, 0.035, v * 0.22);
    },
    ohat(x, t, v, out) {
      hiss(x, out, t, 'highpass', 6800 * x.bright, 0.7, 0.002, 0.2, v * 0.16);
    },
    shaker(x, t, v, out) {
      hiss(x, out, t, 'bandpass', 5200 * x.bright, 1.4, 0.012, 0.06, v * 0.28);
    },
    // the atarigane, the festival band's little hand gong: "chan" open, "chiki" damped
    chanchiki(x, t, v, out, p, ch) {
      const d = ch === 'X' ? 0.22 : 0.05;
      tone(x, out, t, 'triangle', 1580, 1580, 0, 0.001, d, v * 0.1);
      tone(x, out, t, 'sine', 2390, 2390, 0, 0.001, d * 0.8, v * 0.08);
      tone(x, out, t, 'sine', 3710, 3710, 0, 0.001, d * 0.6, v * 0.06);
      hiss(x, out, t, 'highpass', 5000, 0.7, 0.001, d * 0.4, v * 0.08);
    },
    // sleigh bells
    jingle(x, t, v, out) {
      hiss(x, out, t, 'bandpass', 7400, 2.5, 0.004, 0.05, v * 0.3);
      hiss(x, out, t + 0.017, 'bandpass', 8600, 2.5, 0.004, 0.06, v * 0.22);
      tone(x, out, t, 'sine', 5920, 5920, 0, 0.001, 0.08, v * 0.035);
    },
    crash(x, t, v, out) {
      hiss(x, out, t, 'highpass', 4200, 0.7, 0.003, 1.1, v * 0.3);
      hiss(x, out, t, 'bandpass', 7000, 0.8, 0.003, 0.5, v * 0.14);
    },
    // the eisa dancers' finger whistle: "pi, piyu!"
    whistle(x, t, v, out) {
      tone(x, out, t, 'sine', 2800, 2900, 0.05, 0.004, 0.07, v * 0.06);
      tone(x, out, t + 0.11, 'sine', 2300, 3100, 0.12, 0.01, 0.3, v * 0.07);
    },
    // a falling laser blip
    zap(x, t, v, out) {
      tone(x, out, t, 'triangle', 2400, 200, 0.22, 0.002, 0.25, v * 0.12);
    },
  };
  const PERC_BUS = { hat: 1, ohat: 1, shaker: 1, chanchiki: 1, jingle: 1, crash: 1, whistle: 1, zap: 1 };

  // A rising whoosh of noise for the last card's tension.
  function riser(x, t, len, out) {
    const s = noiseSrc(x, t), fl = filter(x, 'bandpass', 400, 2.2), g = x.ctx.createGain();
    fl.frequency.setValueAtTime(400, t);
    fl.frequency.exponentialRampToValueAtTime(7000, t + len);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.11, t + len * 0.95);
    g.gain.linearRampToValueAtTime(0.0001, t + len);
    s.connect(fl);
    fl.connect(g);
    g.connect(out);
    s.stop(t + len + 0.02);
    done(s, fl, g);
  }

  // Pitched instruments: (x, out, t, frequency, duration, velocity, options) -> { g, end }
  // options: from (a frequency to glide from), slide (scoop up into the note), send (the
  // echo), trem (tremolo rate), cut (filter cutoff), dead (a muted bass note), pop.
  const VOICE = {
    // a fue, the festival's bamboo flute: soft attack, breath, scoops and a late vibrato
    fue(x, out, t, f, dur, v, o) {
      return flute(x, out, t, f, dur, v, o, 0.15, 5.3, 0.007);
    },
    // a shakuhachi-like flute: more breath, a slower, wider vibrato
    shaku(x, out, t, f, dur, v, o) {
      return flute(x, out, t, f, dur, v, o, 0.3, 4.6, 0.011);
    },
    square(x, out, t, f, dur, v, o) {
      return chip(x, out, t, f, dur, v * 0.62, o, 'square', 3600);
    },
    pulse25(x, out, t, f, dur, v, o) {
      return chip(x, out, t, f, dur, v * 0.75, o, x.r.pulse25, 4200);
    },
    pulse12(x, out, t, f, dur, v, o) {
      return chip(x, out, t, f, dur, v * 0.85, o, x.r.pulse12, 4800);
    },
    // a surf-guitar pulse: held notes are tremolo-picked
    surf(x, out, t, f, dur, v, o) {
      return chip(x, out, t, f, dur, v * 1.1, o, x.r.pulse25, 3400, dur > 0.25 ? o.trem : 0);
    },
    // a shamisen (or Okinawan sanshin) pluck: a bright twang that dulls fast
    shami(x, out, t, f, dur, v) {
      const o = osc(x, x.r.shami, f * 1.025, t), fl = filter(x, 'lowpass', 5200, 2.5), g = x.ctx.createGain();
      o.frequency.exponentialRampToValueAtTime(f, t + 0.03);
      fl.frequency.setValueAtTime(Math.min(5200 * x.bright, 12000), t);
      fl.frequency.exponentialRampToValueAtTime(900, t + 0.15);
      const len = Math.min(dur + 0.25, 0.7);
      perc(g, t, v, 0.002, len);
      o.connect(fl);
      fl.connect(g);
      g.connect(out);
      o.start(t);
      o.stop(t + len + 0.03);
      done(o, fl, g);
      hiss(x, out, t, 'bandpass', 3400, 2, 0.001, 0.012, v * 0.3);
      return { g, end: t + len };
    },
    // a koto pluck: rounder, longer, with a little bend into the note
    koto(x, out, t, f, dur, v, o) {
      const len = Math.min(Math.max(dur + 0.5, 0.7), 1.5);
      const a = osc(x, 'triangle', f * 1.012, t), fl = filter(x, 'lowpass', 3800 * x.bright, 0.7), g = x.ctx.createGain();
      a.frequency.exponentialRampToValueAtTime(f, t + 0.05);
      perc(g, t, v, 0.002, len);
      a.connect(fl);
      fl.connect(g);
      g.connect(out);
      if (o && o.send) g.connect(o.send);
      a.start(t);
      a.stop(t + len + 0.03);
      done(a, fl, g);
      tone(x, out, t, 'sine', f * 2, f * 2, 0, 0.002, 0.3, v * 0.28);
      tone(x, out, t, 'sine', f * 3, f * 3, 0, 0.002, 0.12, v * 0.1);
      hiss(x, out, t, 'bandpass', 2400, 1.5, 0.001, 0.01, v * 0.18);
      return { g, end: t + len };
    },
    // an electric piano (city pop): a soft FM tine
    ep(x, out, t, f, dur, v) {
      const c = x.ctx, car = osc(x, 'sine', f, t), m = osc(x, 'sine', f, t), mg = c.createGain(), g = c.createGain();
      mg.gain.setValueAtTime(f * 1.3, t);
      mg.gain.setTargetAtTime(f * 0.15, t, 0.2);
      m.connect(mg);
      mg.connect(car.frequency);
      const end = t + dur;
      held(g, t, v, 0.004, 0.45, 0.4, end, 0.09);
      car.connect(g);
      g.connect(out);
      car.start(t);
      m.start(t);
      car.stop(end + 0.5);
      m.stop(end + 0.5);
      done(car, g);
      done(m, mg);
      tone(x, out, t, 'sine', f * 4, f * 4, 0, 0.002, 0.15, v * 0.05);
      return { g, end: end + 0.5 };
    },
    // a bell (music box, celesta): FM with an inharmonic ratio
    bell(x, out, t, f, dur, v, o) {
      const c = x.ctx, car = osc(x, 'sine', f, t), m = osc(x, 'sine', f * 3.5, t), mg = c.createGain(), g = c.createGain();
      const len = Math.min(Math.max(dur + 0.6, 0.8), 1.4);
      mg.gain.setValueAtTime(f * 2.2, t);
      mg.gain.exponentialRampToValueAtTime(f * 0.01, t + len * 0.8);
      m.connect(mg);
      mg.connect(car.frequency);
      perc(g, t, v, 0.002, len);
      car.connect(g);
      g.connect(out);
      if (o && o.send) g.connect(o.send);
      car.start(t);
      m.start(t);
      car.stop(t + len + 0.03);
      m.stop(t + len + 0.03);
      done(car, g);
      done(m, mg);
      return { g, end: t + len };
    },
    // a space arpeggio: two detuned saws through a resonant filter that sweeps with the bars
    arp(x, out, t, f, dur, v, o) {
      const c = x.ctx, a = osc(x, 'sawtooth', f, t), b = osc(x, 'sawtooth', f * 1.007, t);
      const cut = Math.min(((o && o.cut) || 2000) * x.bright, 9000);
      const fl = filter(x, 'lowpass', cut, 6), g = c.createGain();
      fl.frequency.setValueAtTime(cut * 1.6, t);
      fl.frequency.exponentialRampToValueAtTime(cut, t + 0.08);
      perc(g, t, v * 0.5, 0.003, 0.2);
      a.connect(fl);
      b.connect(fl);
      fl.connect(g);
      g.connect(out);
      a.start(t);
      b.start(t);
      a.stop(t + 0.24);
      b.stop(t + 0.24);
      done(a, fl, g);
      done(b);
      return { g, end: t + 0.24 };
    },
    // basses
    tri(x, out, t, f, dur, v, o) {
      const c = x.ctx, a = osc(x, 'triangle', f, t), b = osc(x, 'square', f, t), bg = c.createGain();
      const fl = filter(x, 'lowpass', (o.dead ? 450 : 1000) * x.bright, 0.7), g = c.createGain();
      bg.gain.value = 0.13;
      const end = t + (o.dead ? 0.035 : dur);
      held(g, t, v, 0.004, 0.75, 0.15, end, 0.025);
      a.connect(fl);
      b.connect(bg);
      bg.connect(fl);
      fl.connect(g);
      g.connect(out);
      a.start(t);
      b.start(t);
      a.stop(end + 0.15);
      b.stop(end + 0.15);
      done(a, fl, g);
      done(b, bg);
      return { g, end: end + 0.15 };
    },
    pick(x, out, t, f, dur, v, o) {
      const a = osc(x, 'square', f, t), fl = filter(x, 'lowpass', 2000, 1.5), g = x.ctx.createGain();
      const len = o.dead ? 0.04 : dur + 0.08;
      fl.frequency.setValueAtTime(2000 * x.bright, t);
      fl.frequency.exponentialRampToValueAtTime(500, t + 0.12);
      perc(g, t, v * 1.2, 0.003, len);
      a.connect(fl);
      fl.connect(g);
      g.connect(out);
      a.start(t);
      a.stop(t + len + 0.03);
      done(a, fl, g);
      return { g, end: t + len };
    },
    slap(x, out, t, f, dur, v, o) {
      const a = osc(x, 'sawtooth', f, t), fl = filter(x, 'lowpass', 2800, 4), g = x.ctx.createGain();
      const top = (o.pop ? 4200 : 2600) * x.bright;
      const end = t + (o.dead ? 0.03 : dur);
      fl.frequency.setValueAtTime(o.dead ? 700 : top, t);
      fl.frequency.exponentialRampToValueAtTime(420, t + 0.16);
      held(g, t, v * 0.75, 0.003, 0.55, 0.12, end, 0.03);
      a.connect(fl);
      fl.connect(g);
      g.connect(out);
      a.start(t);
      a.stop(end + 0.15);
      done(a, fl, g);
      return { g, end: end + 0.15 };
    },
    sub(x, out, t, f, dur, v, o) {
      const c = x.ctx, a = osc(x, 'sine', f, t), b = osc(x, 'sawtooth', f, t), fl = filter(x, 'lowpass', 520, 1), bg = c.createGain(), g = c.createGain();
      bg.gain.value = 0.4;
      const end = t + (o.dead ? 0.04 : dur);
      held(g, t, v, 0.012, 0.85, 0.3, end, 0.04);
      a.connect(g);
      b.connect(fl);
      fl.connect(bg);
      bg.connect(g);
      g.connect(out);
      a.start(t);
      b.start(t);
      a.stop(end + 0.2);
      b.stop(end + 0.2);
      done(a, g);
      done(b, fl, bg);
      return { g, end: end + 0.2 };
    },
    round(x, out, t, f, dur, v, o) {
      const c = x.ctx, a = osc(x, 'triangle', f, t), b = osc(x, 'sine', f * 2, t), bg = c.createGain();
      const fl = filter(x, 'lowpass', 1200 * x.bright, 0.7), g = c.createGain();
      bg.gain.value = 0.25;
      const end = t + (o.dead ? 0.04 : dur);
      held(g, t, v, 0.006, 0.6, 0.2, end, 0.05);
      a.connect(fl);
      b.connect(bg);
      bg.connect(fl);
      fl.connect(g);
      g.connect(out);
      a.start(t);
      b.start(t);
      a.stop(end + 0.25);
      b.stop(end + 0.25);
      done(a, fl, g);
      done(b, bg);
      return { g, end: end + 0.25 };
    },
  };

  function flute(x, out, t, f, dur, v, o, breath, rate, depth) {
    const c = x.ctx, a = osc(x, x.r.fue, f, t), g = c.createGain();
    const end = t + dur, stop = end + 0.3;
    if (o.from) {
      a.frequency.setValueAtTime(o.from, t);
      a.frequency.exponentialRampToValueAtTime(f, t + 0.05);
    } else if (o.slide) {
      a.frequency.setValueAtTime(f * 0.89, t);
      a.frequency.exponentialRampToValueAtTime(f, t + 0.08);
    }
    held(g, t, v, 0.03, 0.8, 0.25, end, 0.05);
    a.connect(g);
    g.connect(out);
    if (o.send) g.connect(o.send);
    a.start(t);
    a.stop(stop);
    done(a, g);
    if (dur > 0.28) vibrato(x, a, t, stop, f, rate, depth, 0.16);
    const n = noiseSrc(x, t), fl = filter(x, 'bandpass', Math.min(f * 3, 6000), 1.2), bg = c.createGain();
    held(bg, t, v * breath, 0.015, 0.35, 0.06, end, 0.04);
    n.connect(fl);
    fl.connect(bg);
    bg.connect(out);
    n.stop(stop);
    done(n, fl, bg);
    return { g, g2: bg, end: stop };
  }

  function chip(x, out, t, f, dur, v, o, wave, cut, trem) {
    const c = x.ctx, a = osc(x, wave, f, t), fl = filter(x, 'lowpass', Math.min(cut * x.bright, 12000), 0.3), g = c.createGain();
    const end = t + dur, stop = end + 0.2;
    if (o.from) {
      a.frequency.setValueAtTime(o.from, t);
      a.frequency.exponentialRampToValueAtTime(f, t + 0.04);
    }
    held(g, t, v, 0.005, 0.78, 0.2, end, 0.035);
    a.connect(fl);
    let last = fl;
    if (trem) {
      const tg = c.createGain(), l = c.createOscillator(), lg = c.createGain();
      tg.gain.value = 0.62;
      l.type = 'triangle';
      l.frequency.value = trem;
      lg.gain.value = 0.38;
      l.connect(lg);
      lg.connect(tg.gain);
      fl.connect(tg);
      last = tg;
      l.start(t);
      l.stop(stop);
      done(l, lg, tg);
    }
    last.connect(g);
    g.connect(out);
    if (o.send) g.connect(o.send);
    a.start(t);
    a.stop(stop);
    done(a, fl, g);
    if (dur > 0.3) vibrato(x, a, t, stop, f, 5.6, 0.006, 0.18);
    return { g, end: stop };
  }

  // ---------- the bus ----------
  // parts -> mix -> high shelf ("shine") -> compressor -> trim -> fade -> duck -> volume -> out
  function makeBus(ctx, dest, def, volume) {
    const nodes = [];
    const gain = (v) => {
      const g = ctx.createGain();
      g.gain.value = v;
      nodes.push(g);
      return g;
    };
    const x = { ctx, r: resources(ctx), bright: 1, seed: 0, nodes, part: {}, lv: {} };
    x.mix = gain((def.gain || 1) * LEVEL_GAIN[1]);
    x.shine = ctx.createBiquadFilter();
    x.shine.type = 'highshelf';
    x.shine.frequency.value = 3200;
    x.shine.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 10;
    comp.ratio.value = 3;
    comp.attack.value = 0.006;
    comp.release.value = 0.2;
    nodes.push(x.shine, comp);
    const trim = gain(TRIM);
    x.fade = gain(1);
    x.duck = gain(1);
    x.vol = gain(volume);
    x.mix.connect(x.shine);
    x.shine.connect(comp);
    comp.connect(trim);
    trim.connect(x.fade);
    x.fade.connect(x.duck);
    x.duck.connect(x.vol);
    x.vol.connect(dest);
    const pan = (node, p) => {
      if (!ctx.createStereoPanner) {
        node.connect(x.mix);
        return;
      }
      const sp = ctx.createStereoPanner();
      sp.pan.value = p;
      nodes.push(sp);
      node.connect(sp);
      sp.connect(x.mix);
    };
    const MIX = { drums: 0.15, perc: 0.2, bass: 0.08, comp: 0.1, lead: 0.065, counter: 0.08, fx: 0.07 };
    const PAN = { drums: 0, perc: 0.22, bass: 0, comp: -0.28, lead: 0, counter: 0.32, fx: 0 };
    for (const name of Object.keys(MIX)) {
      const v = MIX[name] * ((def.mix && def.mix[name]) || 1);
      x.lv[name] = v;
      x.part[name] = gain(v);
      pan(x.part[name], PAN[name]);
    }
    // the echo: a dotted-eighth delay for the tune and the counter-melody, fed at each part's
    // own level
    const e = def.echo;
    const delay = ctx.createDelay(2);
    delay.delayTime.value = e[0] * def.sd;
    const damp = filter(x, 'lowpass', 2600, 0.5);
    const fb = gain(e[1]);
    const wet = gain(e[2]);
    nodes.push(delay, damp);
    x.sends = {};
    for (const name of ['lead', 'counter', 'fx']) {
      x.sends[name] = gain(x.lv[name]);
      x.sends[name].connect(delay);
    }
    delay.connect(damp);
    damp.connect(fb);
    fb.connect(delay);
    damp.connect(wet);
    pan(wet, -0.15);
    return x;
  }
  function dropBus(x, fade) {
    if (!x) return;
    try {
      const now = x.ctx.currentTime, g = x.fade.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(0, now + Math.max(fade, 0.005));
    } catch (err) {
      // the context is closed
    }
    setTimeout(() => {
      for (const n of x.nodes) {
        try {
          n.disconnect();
        } catch (err) {
          // already gone
        }
      }
    }, (Math.max(fade, 0) + 0.15) * 1000);
  }
  function duckBus(x, secs) {
    try {
      const now = x.ctx.currentTime, g = x.duck.gain, hold = Math.max(secs, 0.08);
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(0.25, now + 0.08);
      g.setValueAtTime(0.25, now + hold);
      g.linearRampToValueAtTime(1, now + hold + 0.35);
    } catch (err) {
      // the context is closed
    }
  }

  // ---------- a player: one song on one output ----------
  function makePlayer(ctx, dest, def, level, volume) {
    return {
      ctx, def, sd: def.sd, t0: 0, abs: 0,
      level, target: level,
      cue: { step: false, fall: false, last: false, end: false },
      tension: -1, endStep: -1, done: false, finalAt: 0, stopAt: 0,
      held: { comp: [], lead: [], counter: [] },
      prev: null, silent: false, events: 0, trace: null,
      x: makeBus(ctx, dest, def, volume),
    };
  }

  function keep(p, name, h) {
    if (!h) return;
    const list = p.held[name];
    list.push(h);
    if (list.length > 32) list.shift();
  }
  // Fade out the held notes of the parts above `level` at time t (a fall, a drop in level).
  function kill(p, t, level) {
    const MIN = { comp: p.def.comp.min, lead: 2, counter: 3 };
    for (const name of Object.keys(p.held)) {
      if (MIN[name] <= level) continue;
      for (const h of p.held[name]) {
        if (h.end <= t) continue;
        for (const g of [h.g, h.g2]) {
          if (!g) continue;
          try {
            g.gain.cancelScheduledValues(t);
            g.gain.setTargetAtTime(0, t, 0.015);
          } catch (err) {
            // gone
          }
        }
      }
      p.held[name].length = 0;
    }
  }
  function prune(p, now) {
    for (const name of Object.keys(p.held)) {
      const list = p.held[name];
      let k = 0;
      while (k < list.length && list[k].end < now) k++;
      if (k) list.splice(0, k);
    }
  }

  function onBeat(p, n, t) {
    const c = p.cue, x = p.x;
    if (c.end) {
      c.end = c.fall = c.step = c.last = false;
      p.endStep = n;
      p.tension = -1;
      kill(p, t, -1);
      return;
    }
    if (c.fall) {
      c.fall = false;
      p.target = 0;
      p.tension = -1;
      if (!p.silent) fallFill(p, t);
    }
    if (p.target !== p.level) {
      if (p.target < p.level) kill(p, t, p.target);
      p.level = p.target;
      try {
        x.shine.gain.setTargetAtTime(SHINE[p.level], t, 0.08);
        x.mix.gain.setTargetAtTime((p.def.gain || 1) * LEVEL_GAIN[p.level], t, 0.08);
      } catch (err) {
        // gone
      }
    }
    if (c.step) {
      c.step = false;
      if (!p.silent) {
        DRUM.crash(x, t, 0.8, x.part.perc);
        DRUM.don(x, t, 1, x.part.drums, 0.9);
        DRUM.don(x, t + p.sd, 0.6, x.part.drums, 1.15);
        p.events += 3;
      }
    }
    if (c.last) {
      c.last = false;
      p.tension = n;
    }
  }

  // Yaoki falls: four falling notes over a beat, the taiko tumbling down with them.
  function fallFill(p, t) {
    const x = p.x, def = p.def, v = VOICE[def.endVoice || def.comp.v];
    const steps = [10, 8, 7, 5];
    for (let i = 0; i < 4; i++) {
      const tt = t + i * p.sd;
      DRUM.don(x, tt, 0.75 - i * 0.08, x.part.drums, 1.6 - i * 0.2);
      v(x, x.part.fx, tt, hz(degree(def, steps[i]) - 12), p.sd * 0.9, 0.55, { cut: 2600 });
    }
    p.events += 8;
  }

  // The round ends: a rising run over one beat, then the home chord, and silence.
  function endSeq(p, n, t) {
    const def = p.def, x = p.x, k = n - p.endStep, lead = VOICE[def.lead.v];
    if (k < 4) {
      lead(x, x.part.fx, t, hz(degree(def, 6 + k)), p.sd * 0.85, 0.6, { send: x.sends.fx, trem: 1.5 / p.sd });
      DRUM.don(x, t, 0.45 + 0.15 * k, x.part.drums, 1.3 + 0.1 * k);
      p.events += 2;
      return;
    }
    const ch = def.endChord, cv = VOICE[def.endVoice || def.comp.v];
    lead(x, x.part.fx, t, hz(degree(def, 10)), 1.0, 0.65, { send: x.sends.fx, trem: 1.5 / p.sd });
    for (let i = 0; i < 4; i++) cv(x, x.part.fx, t + i * 0.014, hz(chordTone(ch, def.comp.low, i)), 1.1, 0.5, { cut: 3000 });
    VOICE[def.bass.v](x, x.part.bass, t, hz(bassNote(ch, def.bass.low, '1')), 1.1, 0.95, {});
    DRUM.don(x, t, 1, x.part.drums, 0.85);
    DRUM.crash(x, t, 0.9, x.part.perc);
    p.events += 9;
    p.done = true;
    p.finalAt = t;
    p.stopAt = t + 2.2;
  }

  // Schedule everything that sounds on the n-th step, at grid time t.
  function play(p, n, t) {
    if (p.trace) {
      p.trace.push([n, t, p.ctx.currentTime]);
      if (p.trace.length > 6000) p.trace.splice(0, 1000);
    }
    const def = p.def, s = n & 15;
    if (s % 4 === 0) onBeat(p, n, t);
    if (p.done) return;
    if (p.endStep >= 0) {
      if (!p.silent || n - p.endStep >= 4) endSeq(p, n, t);
      return;
    }
    if (p.silent) return;
    const x = p.x, L = p.level, w = where(def, n >> 4);
    const tt = t + (s & 1 ? def.swing * p.sd : 0);
    x.bright = BRIGHT[L];

    // drums: the section's crash, the parts, the fill at a section's end, the last card's roll
    if (s === 0 && w.bi === 0 && L >= 1) {
      DRUM.crash(x, t, 0.65, x.part.perc);
      p.events++;
    }
    const fill = w.bi === 7 && L >= 1 && s >= def.fill.from ? def.fill : null;
    for (const d of def.drums) {
      if (d.bars && d.bars.indexOf(w.bi) < 0) continue;
      if (fill && fill.parts[d.v] !== undefined) continue;
      const pat = patOf(d.p, L, w.bi);
      const c = pat ? pat[s] : '.';
      const v = VEL[c];
      if (!v) continue;
      DRUM[d.v](x, tt, v * d.g * (L === 0 ? 0.8 : 1), PERC_BUS[d.v] ? x.part.perc : x.part.drums, d.pitch, c);
      p.events++;
    }
    if (fill) {
      for (const name of Object.keys(fill.parts)) {
        const c = fill.parts[name][s], v = VEL[c];
        if (!v) continue;
        const pitch = name === 'tom' ? 1.75 - 0.75 * (s - fill.from) / (16 - fill.from) : undefined;
        DRUM[name](x, tt, v, PERC_BUS[name] ? x.part.perc : x.part.drums, pitch, c);
        p.events++;
      }
    }
    if (p.tension >= 0 && n >= p.tension) {
      const k = n - p.tension, ph = k % 32;
      if (ph === 0) riser(x, t, 32 * p.sd, x.part.fx);
      if (k >= 16 || (s & 1) === 0) {
        DRUM[def.roll](x, tt, 0.2 + 0.5 * ph / 31, x.part.drums);
        p.events++;
      }
    }

    // bass
    const ch = chordAt(def, n);
    const bc = partChar(def, def.bass, L, n);
    if (bc !== '.' && bc !== '-') {
      const steps = holdOf((m) => partChar(def, def.bass, L, m), n);
      VOICE[def.bass.v](x, x.part.bass, tt, hz(bassNote(ch, def.bass.low, bc)), steps * p.sd - 0.015, accent(s) * (L === 0 ? 0.65 : 0.9),
        { dead: bc === 'x', pop: bc === '8' });
      p.events++;
    }

    // the chords: plucks, arpeggios or a strum
    const cc = partChar(def, def.comp, L, n);
    if (cc !== '.' && cc !== '-') {
      const steps = holdOf((m) => partChar(def, def.comp, L, m), n);
      const dur = steps * p.sd - 0.015, v = VOICE[def.comp.v], vel = accent(s) * 0.8;
      const o = { cut: 700 + 2600 * (0.5 - 0.5 * Math.cos(2 * Math.PI * (n % 128) / 128)) };
      if (cc === 'x') {
        const k = Math.max(3, ch.tones.length);
        for (let i = 0; i < k; i++) keep(p, 'comp', v(x, x.part.comp, tt + i * 0.012, hz(chordTone(ch, def.comp.low, i)), dur, vel * 0.7, o));
        p.events += k;
      } else {
        keep(p, 'comp', v(x, x.part.comp, tt, hz(chordTone(ch, def.comp.low, +cc)), dur, vel, o));
        p.events++;
      }
    }

    // the tune, from level 2
    if (L >= 2) {
      const lc = leadChar(def, n);
      if (lc !== '.' && lc !== '-') {
        const steps = holdOf((m) => leadChar(def, m), n);
        const m = degree(def, IDX.indexOf(lc)), dur = steps * p.sd - 0.012;
        const prev = p.prev, joined = prev && Math.abs(prev.end - tt) < p.sd * 0.45 && Math.abs(prev.m - m) <= 7 && prev.m !== m;
        const before = leadChar(def, n - 1);
        const o = {
          send: x.sends.lead, trem: 1.5 / p.sd,
          from: joined ? hz(prev.m) : 0,     // legato: glide from the note before
          slide: !joined && steps >= 4 && (before === '.' || (prev && m - prev.m >= 5)),   // scoop into a long note
        };
        keep(p, 'lead', VOICE[def.lead.v](x, x.part.lead, tt, hz(m), dur, accent(s) * 0.85, o));
        p.prev = { m, end: tt + dur + 0.012 };
        p.events++;
      }
    } else {
      p.prev = null;
    }

    // the counter-melody, from level 3: a harmony under the tune or a figure on the chords
    if (L >= 3) {
      const cp = def.counter;
      if (cp.harm) {
        const lc = leadChar(def, n);
        if (lc !== '.' && lc !== '-') {
          const steps = holdOf((m) => leadChar(def, m), n);
          const m = degree(def, IDX.indexOf(lc) + cp.harm);
          keep(p, 'counter', VOICE[cp.v](x, x.part.counter, tt, hz(m), steps * p.sd - 0.012, accent(s) * 0.75, { send: x.sends.counter }));
          p.events++;
        }
      } else {
        const kc = partChar(def, cp, L, n);
        if (kc !== '.' && kc !== '-') {
          const steps = holdOf((m) => partChar(def, cp, L, m), n);
          keep(p, 'counter', VOICE[cp.v](x, x.part.counter, tt, hz(chordTone(ch, cp.low, +kc)), steps * p.sd - 0.012, accent(s) * 0.75, { send: x.sends.counter }));
          p.events++;
        }
      }
    }
  }

  // ---------- the live scheduler ----------
  let P = null;               // the player
  let mode = 'stopped';       // 'playing' | 'paused' | 'stopped'
  let timer = 0;
  let VOL = DEFAULT_VOLUME;
  let duckUntil = 0;          // performance.now() at which a duck ends
  let tracing = false;

  function output() {
    try {
      const sfx = window.TypingSfx;
      const a = sfx && sfx.audio && sfx.audio();
      return a && a.ctx && a.out && a.ctx.state !== 'closed' ? a : null;
    } catch (err) {
      return null;
    }
  }
  function arm(ms) {
    clearTimeout(timer);
    timer = setTimeout(tick, ms);
  }
  function halt(fade) {
    clearTimeout(timer);
    timer = 0;
    if (P) dropBus(P.x, fade);
    P = null;
    mode = 'stopped';
  }
  // The output went away while playing: stop cleanly and keep the place (resume() restarts
  // from the bar's start on the next output).
  function lose() {
    clearTimeout(timer);
    timer = 0;
    if (!P || P.done) {
      halt(0);
      return;
    }
    P.resumeAt = (P.abs >> 4) << 4;
    P.lost = true;
    dropBus(P.x, 0);
    for (const k of Object.keys(P.held)) P.held[k].length = 0;
    mode = 'paused';
  }
  function bringBus(p, a) {
    p.ctx = a.ctx;
    p.x = makeBus(a.ctx, a.out, p.def, VOL);
    p.x.shine.gain.value = SHINE[p.level];
    p.x.mix.gain.value = (p.def.gain || 1) * LEVEL_GAIN[p.level];
    p.silent = VOL === 0;
    const left = (duckUntil - performance.now()) / 1000;
    if (left > 0) duckBus(p.x, left);
  }

  function tick() {
    timer = 0;
    if (!P || mode !== 'playing') return;
    try {
      const a = output();
      if (!a || a.ctx !== P.ctx) {
        lose();
        return;
      }
      if (P.ctx.state === 'running') {
        const now = P.ctx.currentTime;
        if (P.done) {
          if (now >= P.stopAt) {
            halt(0.3);
            return;
          }
        } else {
          // fell behind (a busy page): skip what is already past, keeping the grid
          if (P.t0 + P.abs * P.sd < now) P.abs = Math.ceil((now - P.t0) / P.sd);
          let t;
          while (!P.done && (t = P.t0 + P.abs * P.sd) < now + LOOKAHEAD) play(P, P.abs++, t);
        }
        prune(P, now);
      }
    } catch (err) {
      // a sound that cannot be made is simply not heard
    }
    if (P && mode === 'playing') arm(TICK);
  }

  function find(song) {
    if (typeof song === 'number' && isFinite(song)) return SONGS[mod(Math.floor(song), SONGS.length)];
    if (song == null || song === '') return P ? P.def : SONGS[0];
    return BY_ID[song] || null;
  }

  const api = {
    SONGS: Object.freeze(SONGS.map((s) => Object.freeze({ id: s.id, ja: s.ja, en: s.en, bpm: s.bpm }))),

    // Start (or switch to) a song at level 1; false if there is no audio output.
    start(song) {
      try {
        const def = find(song);
        if (!def) return false;
        const a = output();
        halt(0.15);
        if (!a) return false;
        P = makePlayer(a.ctx, a.out, def, 1, VOL);
        P.silent = VOL === 0;
        if (tracing) P.trace = [];
        const left = (duckUntil - performance.now()) / 1000;
        if (left > 0) duckBus(P.x, left);
        P.t0 = a.ctx.currentTime + 0.06;
        mode = 'playing';
        arm(0);   // the first notes go out on the next turn, so a setLevel() just after counts
        return true;
      } catch (err) {
        halt(0);
        return false;
      }
    },

    // Fade out over `fade` seconds and stop.
    stop(fade) {
      try {
        const f = typeof fade === 'number' && isFinite(fade) ? Math.min(Math.max(fade, 0), 10) : 0.4;
        halt(f);
      } catch (err) {
        // nothing to stop
      }
    },

    pause() {
      try {
        if (mode !== 'playing' || !P) return;
        if (P.done) {
          halt(0.05);
          return;
        }
        let at = P.abs;
        try {
          at = Math.max(0, Math.min(P.abs, Math.ceil((P.ctx.currentTime - P.t0) / P.sd)));
        } catch (err) {
          // closed: keep the scheduled place
        }
        P.resumeAt = at;
        clearTimeout(timer);
        timer = 0;
        dropBus(P.x, 0.06);
        for (const k of Object.keys(P.held)) P.held[k].length = 0;
        mode = 'paused';
      } catch (err) {
        // nothing to pause
      }
    },

    // Go on from the paused place; from the bar's start if the output is a new one.
    resume() {
      try {
        if (mode !== 'paused' || !P) return false;
        const a = output();
        if (!a) return false;
        let at = P.resumeAt || 0;
        if (P.lost || a.ctx !== P.ctx) {
          at = (at >> 4) << 4;
          P.lost = false;
        }
        bringBus(P, a);
        P.prev = null;
        P.abs = at;
        P.t0 = a.ctx.currentTime + 0.05 - at * P.sd;
        mode = 'playing';
        arm(0);
        return true;
      } catch (err) {
        return false;
      }
    },

    // 0 sparse, 1 the full groove, 2 + the tune, 3 + counter-melody, more drums, brighter.
    setLevel(n) {
      try {
        const l = Math.round(Number(n));
        if (!P || !isFinite(l)) return;
        P.target = Math.min(3, Math.max(0, l));
      } catch (err) {
        // ignored
      }
    },

    // Dip the music to a quarter for `seconds` (a spoken clip plays meanwhile).
    duck(seconds) {
      try {
        const s = Math.min(Math.max(Number(seconds) || 0, 0), 30);
        duckUntil = performance.now() + s * 1000;
        if (P && mode === 'playing') duckBus(P.x, s);
      } catch (err) {
        // ignored
      }
    },

    // Musical one-shots on the next beat: 'step', 'fall', 'last', 'end'.
    cue(name) {
      try {
        if (!P || mode === 'stopped' || P.done || P.endStep >= 0) return;
        if (name === 'end' && mode === 'paused') {
          halt(0);
          return;
        }
        if (name === 'fall') P.target = 0;
        if (name in P.cue) P.cue[name] = true;
      } catch (err) {
        // ignored
      }
    },

    // The music's own volume, 0..1 (0 mutes it); returns the volume.
    volume(v) {
      try {
        if (v !== undefined) {
          const n = Number(v);
          if (isFinite(n)) VOL = Math.min(Math.max(n, 0), 1);
          if (P) {
            P.silent = VOL === 0;
            if (mode === 'playing') P.x.vol.gain.setTargetAtTime(VOL, P.ctx.currentTime, 0.04);
          }
        }
      } catch (err) {
        // ignored
      }
      return VOL;
    },

    state() {
      const out = { playing: false, paused: false, song: null, level: 0, bpm: 0 };
      try {
        if (!P) return out;
        let now = 0;
        try {
          now = P.ctx.currentTime;
        } catch (err) {
          now = 0;
        }
        const ended = P.done && now >= P.finalAt;
        const w = where(P.def, Math.max(0, P.abs - 1) >> 4);
        out.playing = mode === 'playing' && !ended;
        out.paused = mode === 'paused';
        out.song = P.def.id;
        out.level = P.target;
        out.bpm = P.def.bpm;
        out.heard = P.level;
        out.section = w.sec;
        out.bar = w.bi;
        out.tension = P.tension >= 0;
        out.ending = P.endStep >= 0;
        out.volume = VOL;
      } catch (err) {
        // the plain answer
      }
      return out;
    },

    // For tests: render `seconds` of a song at a level into an OfflineAudioContext, scheduled
    // in slices with suspend() as the live scheduler would. `opts.events` is a list of
    // { step, level } or { step, cue } to apply at those steps; `opts.solo` lists the parts to
    // keep (drums, perc, bass, comp, lead, counter, fx). Resolves to { buffer, events }.
    _renderTo(octx, song, level, seconds, opts) {
      const o = opts || {};
      const def = find(song);
      if (!def || !octx) return Promise.reject(new Error('no song or context'));
      const p = makePlayer(octx, octx.destination, def, level === undefined ? 1 : level, o.volume === undefined ? DEFAULT_VOLUME : o.volume);
      p.x.shine.gain.value = SHINE[p.level];
      p.x.mix.gain.value = (def.gain || 1) * LEVEL_GAIN[p.level];
      if (o.solo) for (const k of Object.keys(p.x.part)) if (o.solo.indexOf(k) < 0) p.x.part[k].gain.value = 0;
      p.t0 = 0.05;
      const ev = (o.events || []).slice().sort((a, b) => a.step - b.step);
      const end = seconds || 16, slice = 0.1;
      let n = 0;
      const upTo = (time) => {
        for (; !p.done && p.t0 + n * p.sd < Math.min(time, end); n++) {
          while (ev.length && ev[0].step <= n) {
            const e = ev.shift();
            if (e.level !== undefined) p.target = e.level;
            if (e.cue === 'fall') p.target = 0;
            if (e.cue) p.cue[e.cue] = true;
          }
          play(p, n, p.t0 + n * p.sd);
        }
        prune(p, time - LOOKAHEAD);
      };
      upTo(LOOKAHEAD);
      for (let k = 1; k * slice < end; k++) {
        octx.suspend(k * slice).then(() => {
          upTo(k * slice + LOOKAHEAD);
          octx.resume();
        }, () => {});
      }
      return octx.startRendering().then((buffer) => ({ buffer, events: p.events }));
    },
    // For tests: record [step, time, audio clock when scheduled] for each step played
    // (_trace(true) starts afresh, _trace(false) stops, _trace() reads).
    _trace(on) {
      if (on !== undefined) {
        tracing = !!on;
        if (P) P.trace = tracing ? [] : null;
      }
      return P && P.trace ? P.trace : null;
    },
    _t0() {
      return P ? { t0: P.t0, sd: P.sd, swing: P.def.swing } : null;
    },
    // For tests: the compiled songs.
    _data() {
      return SONGS;
    },
  };

  window.TypingMusic = api;
})();
