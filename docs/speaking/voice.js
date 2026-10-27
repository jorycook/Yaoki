/*
 * Rules for Yaoki Speaking: whether what the phone's speech recognition heard is the card, said out loud.
 *
 * The recognition writes what it hears as a Japanese writer would: ねこ comes back as 猫, がっこう as 学校, に as 2.
 * So what was heard is read back into kana with the readings in readings.js: each kanji by its on and kun readings,
 * voiced or with a small っ inside a word as Japanese does (本棚 ほんだな, 学校 がっこう), a kanji heard on its own
 * by its readings as a word (火 is ひ), and the common words that are not read by their kanji (今日 きょう). Digits
 * are read as the kanji numerals they stand for, letters by their names (A えー), romaji as kana. A page adds the
 * words it shows (the course words, the kanji cards) with addWords(), so their own readings are always known.
 *
 * Kana are compared by sound, not spelling: を and お, ぢ and じ, づ and ず are one sound each, and a long vowel may
 * be written おう, おお or ー. Everything else counts: a small っ, a long vowel, ゃ for や, a voiced sound. A card of
 * one or two kana must be all that was heard (a single sound may be drawn out or said twice: きー, きき); a longer card
 * may be inside what was heard (ねこです for ねこ), and a long one forgives a sound: one from 10 kana, two from 16.
 * What was heard is lined up with the card, so a near miss can be named: a small っ left out, a long vowel cut short.
 *
 * No DOM here, so the same file runs in the page and in Node (check/speaking-engine-test.js). readings.js must be
 * loaded first (in Node, required first).
 */
(function (root) {
  'use strict';

  // ---------- kana ----------

  const VOWEL = {};
  const ROWS = {
    a: 'あかさたなはまやらわがざだばぱぁゃゎゕ',
    i: 'いきしちにひみりぎじぢびぴぃゐ',
    u: 'うくすつぬふむゆるぐずづぶぷぅゅゔ',
    e: 'えけせてねへめれげぜでべぺぇゑゖ',
    o: 'おこそとのほもよろをごぞどぼぽぉょ',
  };
  for (const [v, s] of Object.entries(ROWS)) for (const c of s) VOWEL[c] = v;
  const VOWEL_KANA = { a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お' };
  const VOWELS = new Set('あいうえお');
  // the same sound, written two ways
  const SOUND = { 'を': 'お', 'ぢ': 'じ', 'づ': 'ず', 'ゐ': 'い', 'ゑ': 'え' };
  const SMALL = new Set('ぁぃぅぇぉゃゅょゎ');
  const V_ROW = { 'ぁ': 'ば', 'ぃ': 'び', 'ぇ': 'べ', 'ぉ': 'ぼ' };

  const isKana = (c) => (c >= 'ぁ' && c <= 'ゖ') || c === 'ー';
  const isKanji = (c) => /^[㐀-鿿豈-﫿々〆〇]$/.test(c) || c.codePointAt(0) >= 0x20000;
  const hira = (c) => (c >= 'ァ' && c <= 'ヴ') || c === 'ヽ' || c === 'ヾ' ? String.fromCharCode(c.charCodeAt(0) - 0x60) : c;
  // punctuation, spaces and marks, which nobody says
  const MARK = /[\s、。，．,.!?！？「」『』（）()［］[\]【】〈〉《》〔〕・･…‥〜~"'“”‘’`:;：；/／\\_|＿*＊#＃&＆%％=＝+＋\-－–—<>＜＞^]/;

  // What was heard (or a written form) as the game compares it: NFKC, katakana as hiragana, no punctuation, lower-case
  // letters, ゔぁ as ば (the way it is said), and ー as the vowel before it (the mark stays after a kanji).
  function normalize(text) {
    const src = Array.from(String(text == null ? '' : text).normalize('NFKC').toLowerCase().replace(/(\d),(?=\d{3}(?!\d))/g, '$1'));
    const out = [];
    for (let k = 0; k < src.length; k++) {
      let c = hira(src[k]);
      if (MARK.test(c)) continue;
      if (c === 'ゔ') {
        const v = V_ROW[hira(src[k + 1] || '')];
        if (v) {
          c = v;
          k++;
        } else c = 'ぶ';
      } else if (c === 'ゝ' || c === 'ゞ') {
        const p = out[out.length - 1];
        if (!p || !isKana(p)) continue;
        c = c === 'ゞ' ? VOICED[p] || p : p;
      } else if (c === 'ー') {
        const v = VOWEL[out[out.length - 1]];
        if (v) c = VOWEL_KANA[v];
        else if (out.length && isKana(out[out.length - 1])) continue; // after ん or っ: nothing to draw out
      }
      out.push(c);
    }
    return out.join('');
  }

  // A card's reading as sounds: one kana each, with the long vowels おう and えい as おお and ええ (what was heard is
  // compared to it with eqAt, which takes either). `end[j]` is the last character of the reading that sound j came
  // from, so a part of the card said so far can be shown on the reading as written.
  function sounds(reading) {
    const src = Array.from(String(reading == null ? '' : reading).normalize('NFKC'));
    const C = [];
    const end = [];
    for (let k = 0; k < src.length; k++) {
      let c = hira(src[k].toLowerCase());
      if (MARK.test(c)) continue;
      if (c === 'ゔ') {
        const v = V_ROW[hira(src[k + 1] || '')];
        c = v || 'ぶ';
        if (v) k++;
      } else if (c === 'ー') {
        const v = VOWEL[C[C.length - 1]];
        if (!v) continue;
        c = VOWEL_KANA[v];
      }
      c = SOUND[c] || c;
      const pv = VOWEL[C[C.length - 1]];
      if (c === 'う' && pv === 'o') c = 'お';
      else if (c === 'い' && pv === 'e') c = 'え';
      C.push(c);
      end.push(k);
    }
    return { C, end };
  }

  // How many beats (morae) a card's sounds take: a small ゃ, ゅ, ょ… joins the sound before it.
  const beats = (C) => C.filter((c) => !SMALL.has(c)).length;

  // ---------- readings ----------

  const VOICED = {};
  const HALF = {};
  Array.from('かきくけこさしすせそたちつてとはひふへほ').forEach((c, i) => { VOICED[c] = 'がぎぐげござじずぜぞだぢづでどばびぶべぼ'[i]; });
  Array.from('はひふへほ').forEach((c, i) => { HALF[c] = 'ぱぴぷぺぽ'[i]; });

  let T = null;
  // readings.js, read once: kanji → readings (each with the okurigana it needs and the sound changes common words make
  // to it), a kanji said alone → readings, and words by their first character
  const ANY = { stem: false, v: true, h: true, t: true };
  const entry = (r, flags) => (flags === undefined ? Object.assign({ r }, ANY) : { r, stem: flags.includes('-'), v: flags.includes('v'), h: flags.includes('h'), t: flags.includes('t') });
  function tables() {
    if (T) return T;
    const R = root.SpeakingReadings || {};
    T = { K: new Map(), S: new Map(), W: new Map(), V: new Map() };
    const each = (text, fn) => String(text || '').split('\n').forEach((line) => line && fn(line));
    each(R.kanji, (line) => {
      const ch = Array.from(line)[0];
      T.K.set(ch, line.slice(ch.length).split(',').map((x) => {
        const m = /^(.*?)([-vht]*)$/.exec(x);
        return entry(m[1], m[2]);
      }));
    });
    each(R.single, (line) => {
      const ch = Array.from(line)[0];
      T.S.set(ch, line.slice(ch.length).split(','));
    });
    each(R.words, (line) => {
      const [w, r] = line.split('\t');
      if (w && r) addWord(w, r.split(','), true);
    });
    // 〇 is not a kanji in KANJIDIC, but digits come back as it (0 → 〇)
    if (!T.K.has('〇')) T.K.set('〇', ['ぜろ', 'れい', 'まる'].map((r) => entry(r)));
    return T;
  }

  function addWord(written, readings, fromTable) {
    const w = Array.from(normalize(written));
    if (w.length < 2 && !fromTable) {
      // a word of one kanji: its readings join that kanji's own, as a word said alone
      if (w.length === 1 && isKanji(w[0])) {
        const s = T.S.get(w[0]) || [];
        for (const r of readings) {
          const n = normalize(r);
          if (n && !s.includes(n)) s.push(n);
        }
        T.S.set(w[0], s);
      }
      return;
    }
    if (!w.length) return;
    const list = T.W.get(w[0]) || [];
    const key = w.join('');
    let entry = list.find((e) => e.key === key);
    if (!entry) {
      entry = { key, chars: w, rd: [] };
      list.push(entry);
      list.sort((a, b) => b.chars.length - a.chars.length);
      T.W.set(w[0], list);
    }
    for (const r of readings) {
      const n = normalize(r);
      if (n && !entry.rd.includes(n)) entry.rd.push(n);
    }
    T.V.clear();
  }

  // Words a page shows, so their own readings are always known: [{ text, reading }].
  function addWords(list) {
    tables();
    for (const it of list || []) {
      if (!it || !it.text || !it.reading) continue;
      if (!/[㐀-鿿豈-﫿々〆]/.test(it.text) && normalize(it.text) === normalize(it.reading)) continue;
      addWord(it.text, [it.reading], false);
    }
  }

  // A kanji's readings inside a word, as common words take them: voiced when it is not the word's first sound (本棚
  // ほんだな), p for h (一本 いっぽん), and a small っ for a last く, き, ち or つ when more follows (学校 がっこう); a kun
  // reading that takes okurigana only when kana follow (食べる た). After a numeral every change is taken, as counters
  // take them (三杯 さんばい, 六百 ろっぴゃく), and a numeral may end in っ (八百 はっぴゃく). `plain` leaves out the
  // voiced readings: a card's first sound is never one (電車 is not found in 自転車).
  function variants(list, first, last, okuri, counted) {
    const plain = [];
    const voiced = [];
    const add = (to, x) => {
      if (x && !plain.includes(x) && !voiced.includes(x)) to.push(x);
    };
    const withTsu = (to, f, e) => {
      add(to, f);
      if ((e.t || counted) && !last && f.length > 1 && 'くきちつ'.includes(f[f.length - 1])) add(to, f.slice(0, -1) + 'っ');
    };
    for (const e of list) if (okuri || !e.stem) withTsu(plain, e.r, e);
    if (!first) {
      for (const e of list) {
        if (e.stem && !okuri) continue;
        if ((e.v || counted) && VOICED[e.r[0]]) withTsu(voiced, VOICED[e.r[0]] + e.r.slice(1), e);
        if ((e.h || counted) && HALF[e.r[0]]) withTsu(voiced, HALF[e.r[0]] + e.r.slice(1), e);
      }
    }
    return { rd: plain.concat(voiced), plain };
  }
  const as = (list) => ({ rd: list, plain: list });
  const NUMERALS = '〇一二三四五六七八九十百千万億';
  function cached(key, make) {
    let v = T.V.get(key);
    if (!v) T.V.set(key, (v = make()));
    return v;
  }

  // Letters by their names, as they are said in Japanese, and a run of letters as romaji.
  const LETTERS = {
    a: ['え', 'ええ', 'えい'], b: ['び', 'びい'], c: ['し', 'しい'], d: ['でぃ', 'でぃい', 'で', 'でえ'], e: ['い', 'いい'],
    f: ['えふ'], g: ['じ', 'じい'], h: ['えいち', 'えっち', 'えち'], i: ['あい'], j: ['じぇい', 'じぇえ', 'じぇ'],
    k: ['けい', 'けえ', 'け'], l: ['える'], m: ['えむ'], n: ['えぬ'], o: ['お', 'おお', 'おう'], p: ['ぴ', 'ぴい'],
    q: ['きゅう', 'きゅ'], r: ['ある', 'あある'], s: ['えす'], t: ['てぃ', 'てぃい'], u: ['ゆ', 'ゆう'], v: ['ぶい'],
    w: ['だぶりゅう', 'だぶる'], x: ['えっくす'], y: ['わい'], z: ['ぜっと', 'ぜど'],
  };
  const ROMAJI_IN = {};
  (function () {
    const base = {
      a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お', ka: 'か', ki: 'き', ku: 'く', ke: 'け', ko: 'こ', sa: 'さ', si: 'し', shi: 'し',
      su: 'す', se: 'せ', so: 'そ', ta: 'た', ti: 'ち', chi: 'ち', tu: 'つ', tsu: 'つ', te: 'て', to: 'と', na: 'な', ni: 'に',
      nu: 'ぬ', ne: 'ね', no: 'の', ha: 'は', hi: 'ひ', hu: 'ふ', fu: 'ふ', he: 'へ', ho: 'ほ', ma: 'ま', mi: 'み', mu: 'む',
      me: 'め', mo: 'も', ya: 'や', yu: 'ゆ', yo: 'よ', ra: 'ら', ri: 'り', ru: 'る', re: 'れ', ro: 'ろ', wa: 'わ', wo: 'を',
      ga: 'が', gi: 'ぎ', gu: 'ぐ', ge: 'げ', go: 'ご', za: 'ざ', zi: 'じ', ji: 'じ', zu: 'ず', ze: 'ぜ', zo: 'ぞ', da: 'だ',
      di: 'ぢ', du: 'づ', de: 'で', do: 'ど', ba: 'ば', bi: 'び', bu: 'ぶ', be: 'べ', bo: 'ぼ', pa: 'ぱ', pi: 'ぴ', pu: 'ぷ',
      pe: 'ぺ', po: 'ぽ', fa: 'ふぁ', fi: 'ふぃ', fe: 'ふぇ', fo: 'ふぉ', va: 'ば', vi: 'び', vu: 'ぶ', ve: 'べ', vo: 'ぼ',
      ja: 'じゃ', ju: 'じゅ', jo: 'じょ', je: 'じぇ', sha: 'しゃ', shu: 'しゅ', sho: 'しょ', she: 'しぇ', cha: 'ちゃ',
      chu: 'ちゅ', cho: 'ちょ', che: 'ちぇ', tsa: 'つぁ', thi: 'てぃ', dhi: 'でぃ',
    };
    Object.assign(ROMAJI_IN, base);
    for (const [s, k] of [['ky', 'き'], ['gy', 'ぎ'], ['ny', 'に'], ['hy', 'ひ'], ['by', 'び'], ['py', 'ぴ'], ['my', 'み'], ['ry', 'り'], ['sy', 'し'], ['ty', 'ち'], ['zy', 'じ'], ['jy', 'じ'], ['dy', 'ぢ']]) {
      ROMAJI_IN[s + 'a'] = k + 'ゃ';
      ROMAJI_IN[s + 'u'] = k + 'ゅ';
      ROMAJI_IN[s + 'o'] = k + 'ょ';
    }
  })();
  function romajiToKana(run) {
    let out = '';
    let i = 0;
    while (i < run.length) {
      const c = run[i];
      if (c === 'n' && (i + 1 === run.length || !/[aiueoy]/.test(run[i + 1]))) {
        out += 'ん';
        i += run[i + 1] === 'n' ? 2 : 1;
        continue;
      }
      if (i + 1 < run.length && c === run[i + 1] && /[bcdfghjkmpqrstvwxz]/.test(c)) {
        out += 'っ';
        i++;
        continue;
      }
      if (c === 't' && run.startsWith('ch', i + 1)) {
        out += 'っ';
        i++;
        continue;
      }
      let hit = '';
      for (let len = 3; len >= 1 && !hit; len--) if (ROMAJI_IN[run.slice(i, i + len)]) hit = run.slice(i, i + len);
      if (!hit) return null;
      out += ROMAJI_IN[hit];
      i += hit.length;
    }
    return out;
  }

  // Digits as the kanji numerals they stand for, so a number is read like one written in kanji: 25 二十五, 1000 千,
  // 3人 三人 (さんにん), 1本 一本 (いっぽん). A run that starts with 0, or a long one, is read digit by digit.
  const NUM = '〇一二三四五六七八九';
  function numerals(digits) {
    if ((digits.length > 1 && digits[0] === '0') || digits.length > 12) return Array.from(digits, (d) => NUM[+d]).join('');
    const n = Number(digits);
    if (!n) return '〇';
    const four = (m) => {
      let s = '';
      for (const [size, mark] of [[1000, '千'], [100, '百'], [10, '十']]) {
        const d = Math.floor(m / size) % 10;
        if (d) s += (d > 1 ? NUM[d] : '') + mark;
      }
      return s + (m % 10 ? NUM[m % 10] : '');
    };
    let out = '';
    for (const [size, mark] of [[1e8, '億'], [1e4, '万'], [1, '']]) {
      const part = Math.floor(n / size) % 1e4;
      if (part) out += four(part) + mark;
    }
    return out;
  }
  const heardOf = (text) => Array.from(normalize(text).replace(/\d+/g, numerals));

  // What each stretch of what was heard may be read as: at each place, the words that start there and the readings of
  // the character there.
  function segmentsOf(H) {
    const t = tables();
    const n = H.length;
    // a word that is all that was heard is read only as itself (作家 さっか: not 作 さ and 家 か, which make 坂's さか)
    if (n > 1) {
      const word = (t.W.get(H[0]) || []).find((w) => w.chars.length === n && w.chars.every((ch, k) => ch === H[k]));
      if (word) return H.map((c, i) => (i ? [] : [Object.assign({ len: n }, as(word.rd))]));
    }
    const segs = [];
    for (let i = 0; i < n; i++) {
      const c = H[i];
      const here = [];
      const first = i === 0;
      if (isKana(c)) {
        here.push(Object.assign({ len: 1 }, as([c])));
      } else if (c === '々' || (isKanji(c) && n > 1)) {
        const k = c === '々' ? H[i - 1] : c;
        const base = k && (t.K.get(k) || (t.S.get(k) || []).map((r) => entry(r)));
        const last = i === n - 1;
        const okuri = !last && !isKanji(H[i + 1]);
        // after a numeral, or a numeral before more: as counters are said
        const counted = (i > 0 && NUMERALS.includes(H[i - 1])) || (NUMERALS.includes(c) && !last && isKanji(H[i + 1]));
        if (base && base.length) here.push(Object.assign({ len: 1 }, cached(c + k + first + last + okuri + counted, () => variants(base, first, last, okuri, counted))));
      } else if (c === 'ヶ' || c === 'ヵ') {
        here.push(Object.assign({ len: 1 }, as(['か', 'が', 'こ'])));
      } else if (isKanji(c)) {
        // a kanji that is all that was heard is read as a word on its own (火 ひ, not か)
        const alone = t.S.get(c) || (t.K.get(c) || []).filter((e) => !e.stem).map((e) => e.r);
        if (alone.length) here.push(Object.assign({ len: 1 }, as(alone)));
      } else if (/[a-z]/.test(c)) {
        // a vowel on its own may be the vowel itself (a あ) as well as the letter's name
        here.push(Object.assign({ len: 1 }, as(n === 1 && ROMAJI_IN[c] ? LETTERS[c].concat(ROMAJI_IN[c]) : LETTERS[c])));
        if (first || !/[a-z]/.test(H[i - 1])) {
          let end = i;
          while (end < n && /[a-z]/.test(H[end])) end++;
          const kana = end - i > 1 ? romajiToKana(H.slice(i, end).join('')) : null;
          if (kana) here.push(Object.assign({ len: end - i }, as([kana])));
        }
      }
      for (const w of t.W.get(c) || []) {
        const len = w.chars.length;
        if (i + len > n) continue;
        let k = 1;
        while (k < len && H[i + k] === w.chars[k]) k++;
        if (k === len) here.push(Object.assign({ len }, cached('w' + w.key + first + (i + len === n), () => variants(w.rd.map((r) => entry(r)), first, i + len === n, true, false))));
      }
      segs.push(here);
    }
    return segs;
  }

  // ---------- comparing ----------

  // Is the heard kana h the card's sound j? The card has long vowels as おお and ええ, so う and い are taken there; a
  // ー heard after a kanji is any long vowel; a greeting's last は may be heard as わ (こんにちわ).
  function eqAt(C, j, h) {
    const c = C[j];
    h = SOUND[h] || h;
    if (c === h) return true;
    const pv = j ? VOWEL[C[j - 1]] : null;
    if (c === 'お' && h === 'う' && pv === 'o') return true;
    if (c === 'え' && h === 'い' && pv === 'e') return true;
    if (h === 'ー') return j > 0 && VOWELS.has(c);
    return c === 'は' && h === 'わ' && j === C.length - 1 && C.length >= 4;
  }
  // The ways a reading lines up with the card's sounds from j: exactly, or (a reading of two sounds or more) with one
  // sound wrong, one sound more or one less (切手 きって heard for きて). Each way is [the card's sounds it covers, its
  // cost, the slip: [kind, the card's sound it is at, the sound heard]]. Filled into `out`, which is returned.
  function fit(C, j, rd, out) {
    out.length = 0;
    const n = rd.length;
    const m = C.length;
    if (j + n <= m) {
      let miss = 0;
      let at = -1;
      for (let k = 0; k < n && miss < 2; k++) {
        if (!eqAt(C, j + k, rd[k])) {
          miss++;
          at = k;
        }
      }
      if (!miss) out.push([n, 0, null]);
      else if (miss === 1 && n > 1) out.push([n, INSIDE, ['sub', j + at, rd[at]]]);
    }
    if (n < 2) return out;
    // a sound heard that the card does not have, at k
    if (j + n - 1 <= m) {
      for (let k = 0; k < n; k++) {
        let ok = true;
        for (let q = 0, p = j; q < n && ok; q++) if (q !== k) ok = eqAt(C, p++, rd[q]);
        if (ok) {
          out.push([n - 1, INSIDE, ['ins', j + k, rd[k]]]);
          break;
        }
      }
    }
    // a sound of the card, at j + k, not heard
    if (j + n + 1 <= m) {
      for (let k = 0; k <= n; k++) {
        let ok = true;
        for (let p = 0, q = 0; p <= n && ok; p++) if (p !== k) ok = eqAt(C, j + p, rd[q++]);
        if (ok) {
          out.push([n + 1, INSIDE, ['del', j + k, '']]);
          break;
        }
      }
    }
    return out;
  }

  // Lines what was heard up with the card's sounds, at the least cost: a sound of the card left out, a sound heard
  // that the card does not have, or another sound in its place cost 1 (also inside a kanji's reading, a hair more, so
  // the plainer line-up wins a tie: 美容院 びよういん for びょういん); a character that cannot be read costs 2. Costs
  // are kept in hundredths. `inside`: what was heard may hold more than the card, before and after it. Returns the
  // cost, how far into the card the end of what was heard reaches with nothing wrong (`fill`), and the steps of the
  // best line-up.
  const INF = 1e9;
  const EDIT = 100;
  const INSIDE = 101;
  const SKIP = 200;
  function align(C, H, inside) {
    const n = H.length;
    const m = C.length;
    const segs = segmentsOf(H);
    const ways = [];
    const W = m + 1;
    const cost = new Float64Array((n + 1) * W).fill(INF);
    const from = new Array((n + 1) * W);
    const relax = (i, j, c, step) => {
      const k = i * W + j;
      if (c < cost[k]) {
        cost[k] = c;
        from[k] = step;
      }
    };
    // a card found inside what was heard starts and ends at an edge of a run of kanji, or pays a sound for it
    // (三時 is not quite in 三時半, nor 今日 in 東京)
    const edge = (i) => (i === 0 || i === n || !(isKanji(H[i - 1]) && isKanji(H[i])) ? 0 : EDIT);
    if (inside) for (let i = 0; i <= n; i++) cost[i * W] = edge(i);
    else cost[0] = 0;
    for (let i = 0; i <= n; i++) {
      for (let j = 0; j <= m; j++) {
        const c0 = cost[i * W + j];
        if (c0 >= INF) continue;
        if (j < m) relax(i, j + 1, c0 + EDIT, [i, j, 'del', '']);
        if (i === n) continue;
        const h = H[i];
        for (const s of segs[i]) {
          for (const rd of j ? s.rd : s.plain) {
            for (const [take, c, slip] of fit(C, j, rd, ways)) relax(i + s.len, j + take, c0 + c, [i, j, 'seg', rd, slip]);
          }
        }
        if (isKana(h)) {
          if (j < m) relax(i + 1, j + 1, c0 + EDIT, [i, j, 'sub', h]);
          relax(i + 1, j, c0 + EDIT, [i, j, 'ins', h]);
        } else {
          relax(i + 1, j, c0 + SKIP, [i, j, 'skip', h]);
        }
      }
    }
    let endI = n;
    let endCost = cost[n * W + m];
    if (inside) {
      for (let i = 0; i < n; i++) {
        const c = cost[i * W + m] + edge(i);
        if (c < endCost) {
          endCost = c;
          endI = i;
        }
      }
    }
    let fill = 0;
    for (let j = m; j > 0; j--) {
      if (cost[n * W + j] === 0) {
        fill = j;
        break;
      }
    }
    // the steps, from the start
    const steps = [];
    let i = endI;
    let j = m;
    let guard = 4 * (n + m + 2);
    while (from[i * W + j] && guard-- > 0) {
      const s = from[i * W + j];
      // a reading with a slip in it is a reading, and that slip
      if (s[2] === 'seg' && s[4]) steps.push({ op: s[4][0], at: s[4][1], x: s[4][2], i: s[0], whole: s[3] });
      else steps.push({ op: s[2], at: s[1], x: s[3], i: s[0] });
      i = s[0];
      j = s[1];
    }
    steps.reverse();
    return { cost: endCost, fill, steps, from: i, to: endI };
  }

  // The views of what was heard that a short card is checked against: a single sound drawn out or said twice
  // (きー, きき), and for a card of two kana, えっと… before it or です after it.
  const BEFORE = ['えっと', 'ええと', 'あのう'];
  const AFTER = ['でした', 'です'];
  function views(t, H) {
    const out = [H];
    if (t.C.length > 2) return out;
    const s = H.join('');
    if (t.C.length === 2) {
      let a = 0;
      let b = H.length;
      for (const p of BEFORE) if (s.startsWith(p) && s.length > p.length) { a = p.length; break; }
      for (const p of AFTER) if (s.endsWith(p) && b - a > p.length) { b -= p.length; break; }
      if (a || b < H.length) out.push(H.slice(a, b));
    }
    for (const v of out.slice()) {
      let w = v.slice();
      if (t.beats === 1) {
        const last = t.C[t.C.length - 1];
        const vw = VOWEL[last];
        const long = (c) => c === 'ー' || c === VOWEL_KANA[vw] || (vw === 'o' && c === 'う') || (vw === 'e' && c === 'い');
        while (w.length > 1 && long(w[w.length - 1])) w.pop();
      }
      const half = w.length / 2;
      if (w.length > 1 && w.length % 2 === 0 && w.slice(0, half).join('') === w.slice(half).join('')) w = w.slice(0, half);
      if (w.join('') !== v.join('')) out.push(w);
    }
    return out;
  }

  // ---------- cards ----------

  // A card made ready to be checked: its sounds, how many it may miss, and its own written forms.
  //   item: { text, reading } (reading: the kana said; the text if none)
  function prepare(item) {
    tables();
    const reading = item.reading || item.text;
    const { C, end } = sounds(reading);
    const forms = [];
    const own = normalize(item.text);
    if (own && /[㐀-鿿豈-﫿々〆]/.test(own)) forms.push(own);
    if (item.text && item.reading && /[㐀-鿿豈-﫿々〆]/.test(item.text)) addWord(item.text, [item.reading], false);
    const len = C.length;
    return {
      C, end, forms, len,
      beats: beats(C),
      tol: len >= 16 ? 2 : len >= 10 ? 1 : 0,
      inside: len >= 3,
      romaji: romajiOf(item),
    };
  }

  // Did what was heard say the card? { ok, cost, fill, said, note, heard }:
  //   fill: how many of the card's sounds the end of what was heard has said so far (for showing it as it is said)
  //   said: what was heard, read as kana where it lines up with the card (来て → きて), or null
  //   note: { ja, en } for a near miss of a kind worth naming (a small っ, a long vowel, ゃゅょ, ゛), or null
  function check(t, text) {
    const H = heardOf(text);
    if (!H.length || !t.len) return { ok: false, cost: INF, fill: 0, said: null, note: null, empty: !H.length };
    const joined = H.join('');
    // the card's own written form, at the edges of what was heard or of a run of kanji in it
    const edge = (i) => i === 0 || i === H.length || !(isKanji(H[i - 1]) && isKanji(H[i]));
    for (const f of t.forms) {
      const F = Array.from(f);
      for (let i = 0; i + F.length <= H.length; i++) {
        if ((!t.inside && (i || F.length !== H.length)) || !edge(i) || !edge(i + F.length)) continue;
        let k = 0;
        while (k < F.length && H[i + k] === F[k]) k++;
        if (k === F.length) return { ok: true, cost: 0, fill: t.len, said: null, note: null };
      }
    }
    let best = null;
    for (const v of views(t, H)) {
      const a = align(t.C, v, t.inside);
      a.H = v;
      if (!best || a.cost < best.cost || (a.cost === best.cost && a.fill > best.fill)) best = a;
      if (a.fill > best.fill) best.fill = a.fill;
    }
    const ok = best.cost <= t.tol * EDIT + EDIT / 2;
    let said = '';
    for (const s of best.steps) said += s.whole || (s.op === 'del' ? '' : s.x);
    // the reading is shown only when it covers all that was heard
    const whole = best.from === 0 && best.to === best.H.length;
    return {
      ok,
      cost: Math.round(best.cost / EDIT),
      fill: ok ? t.len : best.fill,
      said: whole && said && said !== joined ? said : null,
      note: ok ? null : noteOf(t, best),
    };
  }

  // The best of a recognition's alternatives.
  function best(t, texts) {
    let out = null;
    for (const x of texts || []) {
      const r = check(t, x);
      r.text = x;
      if (!out || (r.ok && !out.ok) || (r.ok === out.ok && (r.cost < out.cost || (r.cost === out.cost && r.fill > out.fill)))) out = r;
    }
    return out;
  }

  // Why a near miss was not taken, for the line under the game: a step of the line-up that is a common slip.
  const SMALL_BIG = { 'ゃ': 'や', 'ゅ': 'ゆ', 'ょ': 'よ', 'ぁ': 'あ', 'ぃ': 'い', 'ぅ': 'う', 'ぇ': 'え', 'ぉ': 'お' };
  function noteOf(t, a) {
    const wrong = a.steps.filter((s) => s.op !== 'seg');
    if (!wrong.length || wrong.length > 2 || a.cost > (t.tol + 2) * EDIT + EDIT / 2) return null;
    const C = t.C;
    const r = t.romaji;
    const long = (j) => VOWELS.has(C[j]) && j > 0 && VOWEL[C[j - 1]] === VOWEL[C[j]];
    for (const s of wrong) {
      const c = C[s.at];
      if (s.op === 'del' && c === 'っ') return { ja: '小さい「っ」', en: 'Small っ: a short stop before the next sound (' + r + ')' };
      if (s.op === 'ins' && s.x === 'っ') return { ja: '「っ」はなし', en: 'No small っ here: go straight on (' + r + ')' };
      if (s.op === 'del' && long(s.at)) return { ja: 'のばす音', en: 'A long sound: hold the vowel (' + r + ')' };
      if (s.op === 'ins' && VOWELS.has(SOUND[s.x] || s.x) && s.at > 0 && VOWEL[C[s.at - 1]] === VOWEL[s.x]) return { ja: 'みじかい音', en: 'A short sound: do not hold the vowel (' + r + ')' };
      if (s.op === 'sub' && SMALL_BIG[c] === s.x) return { ja: '小さい「' + c + '」', en: 'Small ' + c + ': one beat with the sound before it (' + r + ')' };
      if (s.op === 'sub' && SMALL_BIG[s.x] === c) return { ja: '大きい「' + c + '」', en: 'A full-size ' + c + ': a beat of its own (' + r + ')' };
      if (s.op === 'sub' && (VOICED[c] === s.x || VOICED[s.x] === c || HALF[c] === s.x || HALF[s.x] === c)) {
        return { ja: '「' + c + '」（「' + s.x + '」ではなく）', en: c + ', not ' + s.x + (VOICED[s.x] === c || HALF[s.x] === c ? ': with ゛ or ゜' : ': without ゛ or ゜') + ' (' + r + ')' };
      }
      if (s.op === 'del' && c === 'ん') return { ja: '「ん」', en: 'Say the ん (' + r + ')' };
    }
    return null;
  }

  // ---------- romaji, as a guide to the sounds ----------
  // Hepburn, for reading aloud: し shi, つ tsu, ん n (n' before a vowel or y), っ doubles the next consonant, a long
  // vowel has a macron (ā ū ē ō, and ー on any vowel; いい and えい stay ii and ei), を is o, and a greeting's last は is
  // wa. Phrases have their romaji written out below (particles cannot be told from the kana alone).
  const ROMA = {};
  (function () {
    const kana = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをがぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ';
    const roma = 'a i u e o ka ki ku ke ko sa shi su se so ta chi tsu te to na ni nu ne no ha hi fu he ho ma mi mu me mo ya yu yo ra ri ru re ro wa o ga gi gu ge go za ji zu ze zo da ji zu de do ba bi bu be bo pa pi pu pe po'.split(' ');
    Array.from(kana).forEach((c, i) => { ROMA[c] = roma[i]; });
    Object.assign(ROMA, { 'ゔ': 'vu', 'ぁ': 'a', 'ぃ': 'i', 'ぅ': 'u', 'ぇ': 'e', 'ぉ': 'o', 'ゃ': 'ya', 'ゅ': 'yu', 'ょ': 'yo', 'ゎ': 'wa', 'ゐ': 'i', 'ゑ': 'e' });
  })();
  const PAIRS = {
    'ふぁ': 'fa', 'ふぃ': 'fi', 'ふぇ': 'fe', 'ふぉ': 'fo', 'てぃ': 'ti', 'でぃ': 'di', 'とぅ': 'tu', 'どぅ': 'du', 'うぃ': 'wi',
    'うぇ': 'we', 'うぉ': 'wo', 'しぇ': 'she', 'じぇ': 'je', 'ちぇ': 'che', 'つぁ': 'tsa', 'つぃ': 'tsi', 'つぇ': 'tse', 'つぉ': 'tso',
    'ゔぁ': 'va', 'ゔぃ': 'vi', 'ゔぇ': 've', 'ゔぉ': 'vo', 'いぇ': 'ye', 'くぁ': 'kwa', 'ぐぁ': 'gwa', 'でゅ': 'dyu', 'ふゅ': 'fyu',
  };
  const MACRON = { a: 'ā', i: 'ī', u: 'ū', e: 'ē', o: 'ō' };
  const lengthen = (s) => (MACRON[s.slice(-1)] ? s.slice(0, -1) + MACRON[s.slice(-1)] : s);
  function hepburn(text) {
    const s = Array.from(String(text || '').normalize('NFKC')).map(hira);
    const kanaCount = s.filter((c) => ROMA[c] || c === 'ん' || c === 'っ').length;
    let lastKana = -1;
    for (let i = s.length - 1; i >= 0; i--) if (ROMA[s[i]] || s[i] === 'ん') { lastKana = i; break; }
    const syl = [];
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      const d = s[i + 1];
      if (PAIRS[c + d]) {
        syl.push(PAIRS[c + d]);
        i++;
      } else if ('ゃゅょ'.includes(d || '-') && ROMA[c] && /i$/.test(ROMA[c]) && c !== 'い') {
        const stem = ROMA[c].slice(0, -1);
        syl.push(stem + (/(sh|ch|j)$/.test(stem) ? '' : 'y') + ROMA[d].slice(1));
        i++;
      } else if (c === 'を') {
        syl.push(' o');
      } else if (c === 'は' && i === lastKana && kanaCount >= 4) {
        syl.push('wa');
      } else if (ROMA[c] || c === 'っ' || c === 'ん' || c === 'ー') {
        syl.push(ROMA[c] || c);
      } else if (/[、。！？!?,.]/.test(c)) {
        syl.push({ '、': ', ', '。': '. ', '！': '! ', '？': '? ' }[c] || c + ' ');
      } else if (!MARK.test(c)) {
        syl.push(c);
      }
    }
    let out = '';
    for (let k = 0; k < syl.length; k++) {
      const x = syl[k];
      const next = syl[k + 1] || '';
      if (x === 'っ') {
        out += /^ch/.test(next) ? 't' : /^[bcdfghjkmpqrstvwxyz]/.test(next) ? next[0] : '';
      } else if (x === 'ん') {
        out += /^[aiueoy]/.test(next) ? "n'" : 'n';
      } else if (x === 'ー') {
        out = lengthen(out);
      } else if (/^[aiueo]$/.test(x) && /[aiueo]$/.test(out) && k > 0 && syl[k - 1] !== 'ん' && ((x === out.slice(-1) && x !== 'i') || (out.slice(-1) === 'o' && x === 'u'))) {
        out = lengthen(out);
      } else {
        out += x;
      }
    }
    return out.replace(/ +/g, ' ').trim();
  }
  // Phrases' romaji, written out, by their reading as sounds (punctuation left out).
  const PHRASE_ROMAJI = {};
  function romajiOf(item) {
    const key = sounds(item.reading || item.text).C.join('');
    return PHRASE_ROMAJI[key] || item.romaji || hepburn(item.reading || item.text);
  }

  // ---------- stages of the game's own ----------
  // Items are [text, reading (or ''), gloss, romaji (or '' for the one hepburn() makes)].
  const items = (rows) => rows.map(([text, reading, gloss, romaji]) => {
    const it = { text, gloss };
    if (reading) it.reading = reading;
    if (romaji) it.romaji = romaji;
    return it;
  });

  // Pairs that differ only by a long vowel, a small っ or a small ゃゅょ: said aloud, they are different words.
  const PAIRS_STAGE = items([
    ['おばさん', '', 'aunt'], ['おばあさん', '', 'grandmother'],
    ['おじさん', '', 'uncle'], ['おじいさん', '', 'grandfather'],
    ['ゆき', '', 'snow'], ['ゆうき', '', 'courage'],
    ['とり', '', 'bird'], ['とおり', '', 'street'],
    ['おと', '', 'sound'], ['おっと', '', 'husband'],
    ['きて', '', 'come (please)'], ['きって', '', 'stamp'],
    ['さか', '', 'slope'], ['さっか', '', 'writer'],
    ['びよういん', '', 'hair salon'], ['びょういん', '', 'hospital'],
    ['ここ', '', 'here'], ['こうこう', '', 'high school'],
    ['いえ', '', 'house'], ['いいえ', '', 'no'],
    ['ビル', '', 'building'], ['ビール', '', 'beer'],
    ['きよう', '', 'skilful'], ['きょう', '', 'today'],
    ['じゆう', '', 'freedom'], ['じゅう', '', 'ten'],
  ]);

  const GREETINGS = items([
    ['おはようございます', '', 'Good morning', 'ohayō gozaimasu'],
    ['こんにちは', '', 'Hello', 'konnichiwa'],
    ['こんばんは', '', 'Good evening', 'konbanwa'],
    ['おやすみなさい', '', 'Good night', 'oyasumi nasai'],
    ['ありがとうございます', '', 'Thank you very much', 'arigatō gozaimasu'],
    ['どういたしまして', '', "You're welcome", 'dō itashimashite'],
    ['すみません', '', 'Excuse me; sorry', 'sumimasen'],
    ['ごめんなさい', '', "I'm sorry", 'gomen nasai'],
    ['いただきます', '', '(said before eating)', 'itadakimasu'],
    ['ごちそうさまでした', '', 'Thank you for the meal', 'gochisōsama deshita'],
    ['いってきます', '', "I'm off (leaving home)", 'ittekimasu'],
    ['いってらっしゃい', '', 'See you later (to someone leaving)', 'itterasshai'],
    ['ただいま', '', "I'm home", 'tadaima'],
    ['おかえりなさい', '', 'Welcome home', 'okaeri nasai'],
    ['はじめまして', '', 'Nice to meet you', 'hajimemashite'],
    ['よろしくおねがいします', '', 'I look forward to working with you', 'yoroshiku onegai shimasu'],
    ['おげんきですか', '', 'How are you?', 'ogenki desu ka'],
    ['おかげさまで', '', "I'm well, thank you", 'okagesama de'],
    ['おつかれさまです', '', 'Thanks for your hard work', 'otsukaresama desu'],
    ['いらっしゃいませ', '', 'Welcome (in a shop)', 'irasshaimase'],
    ['しつれいします', '', 'Excuse me (going in or out)', 'shitsurei shimasu'],
    ['おめでとうございます', '', 'Congratulations', 'omedetō gozaimasu'],
    ['さようなら', '', 'Goodbye', 'sayōnara'],
    ['じゃあ、またね', '', 'See you', 'jā, mata ne'],
    ['おだいじに', '', 'Get well soon', 'odaiji ni'],
  ]);

  const TWISTERS = items([
    ['生麦生米生卵', 'なまむぎなまごめなまたまご', 'raw wheat, raw rice, raw egg', 'namamugi namagome namatamago'],
    ['隣の客はよく柿食う客だ', 'となりのきゃくはよくかきくうきゃくだ', 'the guest next door eats a lot of persimmons', 'tonari no kyaku wa yoku kaki kū kyaku da'],
    ['すもももももももものうち', '', 'plums and peaches are both peaches', 'sumomo mo momo mo momo no uchi'],
    ['赤巻紙青巻紙黄巻紙', 'あかまきがみあおまきがみきまきがみ', 'red, blue and yellow rolled paper', 'aka makigami ao makigami ki makigami'],
    ['坊主が屏風に上手に坊主の絵を描いた', 'ぼうずがびょうぶにじょうずにぼうずのえをかいた', 'a monk drew a monk on a folding screen, and drew it well', 'bōzu ga byōbu ni jōzu ni bōzu no e o kaita'],
    ['庭には二羽鶏がいる', 'にわにはにわにわとりがいる', 'in the garden there are two chickens', 'niwa ni wa niwa niwatori ga iru'],
    ['蛙ぴょこぴょこ三ぴょこぴょこ', 'かえるぴょこぴょこみぴょこぴょこ', 'frogs go hop hop, three go hop hop', 'kaeru pyoko pyoko mipyoko pyoko'],
    ['バスガス爆発', 'ばすがすばくはつ', 'a bus gas explosion', 'basu gasu bakuhatsu'],
    ['東京特許許可局', 'とうきょうとっきょきょかきょく', 'the Tokyo patent office', 'tōkyō tokkyo kyoka kyoku'],
    ['新春シャンソンショー', 'しんしゅんしゃんそんしょー', 'a New Year chanson show', 'shinshun shanson shō'],
    ['老若男女', 'ろうにゃくなんにょ', 'young and old, men and women', "rōnyaku nan'nyo"],
    ['親亀の背中に子亀を乗せて', 'おやがめのせなかにこがめをのせて', 'put the little turtle on the big turtle\'s back', 'oyagame no senaka ni kogame o nosete'],
    ['この竹垣に竹立てかけたのは竹立てかけたかったから', 'このたけがきにたけたてかけたのはたけたてかけたかったから', 'I leaned bamboo on this bamboo fence because I wanted to lean bamboo on it', 'kono takegaki ni take tatekaketa no wa take tatekaketakatta kara'],
  ]);

  // The romaji of the phrases in Yaoki Typing's lists (engine.js), which this game shows too.
  for (const [reading, romaji] of [
    ['わたしはがくせいです。', 'watashi wa gakusei desu.'],
    ['きょうはいいてんきですね。', 'kyō wa ii tenki desu ne.'],
    ['まいにち、にほんごをべんきょうします。', 'mainichi, nihongo o benkyō shimasu.'],
    ['ラーメンがたべたいです。', 'rāmen ga tabetai desu.'],
    ['ゆっくりはなしてください。', 'yukkuri hanashite kudasai.'],
    ['ちょっとまってください。', 'chotto matte kudasai.'],
    ['すみません、もういちどおねがいします。', 'sumimasen, mō ichido onegai shimasu.'],
    ['「いただきます」といいました。', '"itadakimasu" to iimashita.'],
    ['ほんとうですか？', 'hontō desu ka?'],
    ['いっしょにいきましょう！', 'issho ni ikimashō!'],
    ['コーヒーとケーキをください。', 'kōhī to kēki o kudasai.'],
    ['きょうはてんきがいいです。', 'kyō wa tenki ga ii desu.'],
    ['えきはどこですか。', 'eki wa doko desu ka.'],
    ['あめがふっています。', 'ame ga futte imasu.'],
    ['にほんごをべんきょうしています。', 'nihongo o benkyō shite imasu.'],
    ['まいあさろくじにおきます。', 'maiasa rokuji ni okimasu.'],
    ['しゅうまつにともだちとえいがをみました。', 'shūmatsu ni tomodachi to eiga o mimashita.'],
    ['ななころびやおき。', 'nanakorobi yaoki.'],
    ['でんしゃでがっこうへいきます。', 'densha de gakkō e ikimasu.'],
    ['さくらがきれいにさいています。', 'sakura ga kirei ni saite imasu.'],
    ['すこしやすみましょう。', 'sukoshi yasumimashō.'],
    ['こんやははやくねます。', "kon'ya wa hayaku nemasu."],
    ['おちゃをもういっぱいください。', 'ocha o mō ippai kudasai.'],
    ['このほんはとてもおもしろいです。', 'kono hon wa totemo omoshiroi desu.'],
    ['まどをあけてもいいですか。', 'mado o akete mo ii desu ka.'],
    ['みちにまよいました。', 'michi ni mayoimashita.'],
    ['なつやすみにうみへいきたいです。', 'natsuyasumi ni umi e ikitai desu.'],
    ['しゅくだいをわすれないでください。', 'shukudai o wasurenaide kudasai.'],
    ['えきのまえでまっています。', 'eki no mae de matte imasu.'],
    ['かぜをひいてしまいました。', 'kaze o hiite shimaimashita.'],
    ['らいねん、きょうとへりゅうがくします。', 'rainen, kyōto e ryūgaku shimasu.'],
    ['しっぱいはせいこうのもと。', 'shippai wa seikō no moto.'],
    ['いしのうえにもさんねん。', 'ishi no ue ni mo sannen.'],
    ['けいぞくはちからなり。', 'keizoku wa chikara nari.'],
    ['いそがばまわれ。', 'isogaba maware.'],
  ]) PHRASE_ROMAJI[sounds(reading).C.join('')] = romaji;

  const api = {
    normalize, prepare, check, best, addWords, hepburn, romajiOf, numerals,
    beatsOf: (reading) => beats(sounds(reading).C),
    ready: () => !!tables(),
    STAGES: {
      pairs: { id: 'pairs', ja: '長い音・っ', en: 'Long sounds and small っ', items: PAIRS_STAGE },
      greet: { id: 'greet', ja: 'あいさつ', en: 'Greetings', items: GREETINGS },
      twister: { id: 'twister', ja: '早口言葉', en: 'Tongue twisters', items: TWISTERS },
    },
    PHRASE_ROMAJI,
  };
  root.SpeakingVoice = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
