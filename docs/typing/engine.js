/*
 * Rules for Yaoki Typing: how each prompt may be spelled in romaji, the JIS key tables and
 * the built-in prompt lists. A spelling is accepted when Microsoft IME or Google 日本語入力
 * turns it into the kana; the hint is always one that both accept. One rule is the game's
 * own: ん at the end of a prompt takes nn, since there is no Enter to settle a lone n.
 * No DOM here, so the same file runs in the page and in Node (check/typing-engine-test.js).
 */
(function (root) {
  'use strict';

  // Spellings of each single kana. The first is the one shown as a hint.
  const SINGLE = {
    'あ': ['a'], 'い': ['i', 'yi'], 'う': ['u', 'wu', 'whu'], 'え': ['e'], 'お': ['o'],
    'か': ['ka', 'ca'], 'き': ['ki'], 'く': ['ku', 'cu', 'qu'], 'け': ['ke'], 'こ': ['ko', 'co'],
    'が': ['ga'], 'ぎ': ['gi'], 'ぐ': ['gu'], 'げ': ['ge'], 'ご': ['go'],
    'さ': ['sa'], 'し': ['shi', 'si', 'ci'], 'す': ['su'], 'せ': ['se', 'ce'], 'そ': ['so'],
    'ざ': ['za'], 'じ': ['ji', 'zi'], 'ず': ['zu'], 'ぜ': ['ze'], 'ぞ': ['zo'],
    'た': ['ta'], 'ち': ['chi', 'ti'], 'つ': ['tsu', 'tu'], 'て': ['te'], 'と': ['to'],
    'だ': ['da'], 'ぢ': ['di'], 'づ': ['du'], 'で': ['de'], 'ど': ['do'],
    'な': ['na'], 'に': ['ni'], 'ぬ': ['nu'], 'ね': ['ne'], 'の': ['no'],
    'は': ['ha'], 'ひ': ['hi'], 'ふ': ['fu', 'hu'], 'へ': ['he'], 'ほ': ['ho'],
    'ば': ['ba'], 'び': ['bi'], 'ぶ': ['bu'], 'べ': ['be'], 'ぼ': ['bo'],
    'ぱ': ['pa'], 'ぴ': ['pi'], 'ぷ': ['pu'], 'ぺ': ['pe'], 'ぽ': ['po'],
    'ま': ['ma'], 'み': ['mi'], 'む': ['mu'], 'め': ['me'], 'も': ['mo'],
    'や': ['ya'], 'ゆ': ['yu'], 'よ': ['yo'],
    'ら': ['ra'], 'り': ['ri'], 'る': ['ru'], 'れ': ['re'], 'ろ': ['ro'],
    'わ': ['wa'], 'を': ['wo'], 'ゔ': ['vu'], 'ゐ': ['wyi'], 'ゑ': ['wye'],
    'ぁ': ['xa', 'la'], 'ぃ': ['xi', 'li', 'xyi', 'lyi'], 'ぅ': ['xu', 'lu'],
    'ぇ': ['xe', 'le', 'xye', 'lye'], 'ぉ': ['xo', 'lo'],
    'ゃ': ['xya', 'lya'], 'ゅ': ['xyu', 'lyu'], 'ょ': ['xyo', 'lyo'],
    'ゎ': ['xwa', 'lwa'], 'ゕ': ['xka', 'lka'], 'ゖ': ['xke', 'lke'],
    'っ': ['xtu', 'ltu', 'xtsu', 'ltsu'],
    // Typed with the key itself in romaji input: ー on -, 、 on , and so on.
    'ー': ['-'], '、': [','], '。': ['.'], '・': ['/', 'z/'], '「': ['['], '」': [']'],
    '〜': ['~', 'z-'], '！': ['!'], '？': ['?'],
  };

  // Two kana typed as one syllable. Each also accepts the two kana spelled one by one
  // (ki + xya for きゃ), so only the joined spellings are listed here. A list that starts
  // with null has no joined spelling both IMEs accept, so its hint is the spelled-out one.
  const COMBO = {};
  const combos = (first, forms) => {
    for (const [small, spellings] of Object.entries(forms)) COMBO[first + small] = spellings;
  };
  const YOON = (stems) => ({
    'ゃ': stems.map((s) => s + 'a'), 'ぃ': stems.map((s) => s + 'i'), 'ゅ': stems.map((s) => s + 'u'),
    'ぇ': stems.map((s) => s + 'e'), 'ょ': stems.map((s) => s + 'o'),
  });
  combos('き', YOON(['ky']));
  combos('ぎ', YOON(['gy']));
  combos('に', YOON(['ny']));
  combos('ひ', YOON(['hy']));
  combos('び', YOON(['by']));
  combos('ぴ', YOON(['py']));
  combos('み', YOON(['my']));
  combos('り', YOON(['ry']));
  combos('ぢ', YOON(['dy']));
  combos('し', { 'ゃ': ['sha', 'sya'], 'ぃ': ['syi'], 'ゅ': ['shu', 'syu'], 'ぇ': ['she', 'sye'], 'ょ': ['sho', 'syo'] });
  combos('じ', { 'ゃ': ['ja', 'jya', 'zya'], 'ぃ': ['jyi', 'zyi'], 'ゅ': ['ju', 'jyu', 'zyu'], 'ぇ': ['je', 'jye', 'zye'], 'ょ': ['jo', 'jyo', 'zyo'] });
  combos('ち', { 'ゃ': ['cha', 'cya', 'tya'], 'ぃ': ['cyi', 'tyi'], 'ゅ': ['chu', 'cyu', 'tyu'], 'ぇ': ['che', 'cye', 'tye'], 'ょ': ['cho', 'cyo', 'tyo'] });
  combos('ふ', { 'ぁ': ['fa', 'fwa', 'hwa'], 'ぃ': ['fi', 'fwi', 'fyi', 'hwi'], 'ぅ': [null, 'fwu'], 'ぇ': ['fe', 'fwe', 'fye', 'hwe'], 'ぉ': ['fo', 'fwo', 'hwo'], 'ゃ': ['fya'], 'ゅ': ['fyu', 'hwyu'], 'ょ': ['fyo'] });
  combos('て', { 'ぃ': ['thi', "t'i"], 'ゃ': ['tha'], 'ゅ': ['thu', "t'yu"], 'ぇ': ['the'], 'ょ': ['tho'] });
  combos('で', { 'ぃ': ['dhi', "d'i"], 'ゃ': ['dha'], 'ゅ': ['dhu', "d'yu"], 'ぇ': ['dhe'], 'ょ': ['dho'] });
  combos('と', { 'ぁ': ['twa'], 'ぃ': ['twi'], 'ぅ': ['twu', "t'u"], 'ぇ': ['twe'], 'ぉ': ['two'] });
  combos('ど', { 'ぁ': ['dwa'], 'ぃ': ['dwi'], 'ぅ': ['dwu', "d'u"], 'ぇ': ['dwe'], 'ぉ': ['dwo'] });
  combos('う', { 'ぁ': ['wha'], 'ぃ': ['wi', 'whi'], 'ぇ': ['we', 'whe'], 'ぉ': ['who'] });
  combos('い', { 'ぇ': ['ye'] });
  combos('ゔ', { 'ぁ': ['va'], 'ぃ': ['vi', 'vyi'], 'ぇ': ['ve', 'vye'], 'ぉ': ['vo'], 'ゃ': ['vya'], 'ゅ': ['vyu'], 'ょ': ['vyo'] });
  combos('つ', { 'ぁ': ['tsa'], 'ぃ': ['tsi'], 'ぇ': ['tse'], 'ぉ': ['tso'] });
  combos('く', { 'ぁ': ['qa', 'kwa', 'qwa'], 'ぃ': ['qi', 'kwi', 'qwi', 'qyi'], 'ぅ': [null, 'kwu', 'qwu'], 'ぇ': ['qe', 'kwe', 'qwe', 'qye'], 'ぉ': ['qo', 'kwo', 'qwo'], 'ゃ': [null, 'qya'], 'ゅ': [null, 'qyu'], 'ょ': [null, 'qyo'] });
  combos('ぐ', { 'ぁ': ['gwa'], 'ぃ': ['gwi'], 'ぅ': ['gwu'], 'ぇ': ['gwe'], 'ぉ': ['gwo'] });
  combos('す', { 'ぁ': ['swa'], 'ぃ': ['swi'], 'ぅ': ['swu'], 'ぇ': ['swe'], 'ぉ': ['swo'] });
  combos('ず', { 'ぁ': [null, 'zwa'], 'ぃ': [null, 'zwi'], 'ぅ': [null, 'zwu'], 'ぇ': [null, 'zwe'], 'ぉ': [null, 'zwo'] });

  // Katakana is matched as hiragana (the prompt is still shown as written), and the forms
  // the two IMEs type differently are folded together: ～ and 〜, ，． and 、。, !? and ！？.
  const FOLD = { '～': '〜', '，': '、', '．': '。', '!': '！', '?': '？' };
  function toHiragana(s) {
    return s
      .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
      .replace(/[～，．!?]/g, (c) => FOLD[c]);
  }

  const NEEDS_NN = /^[aiueoyn']/;           // a lone n before these would make な, にゃ… instead of ん
  const DOUBLES = /^[bcdfghjklmpqrstvwxyz]/; // letters っ may double (never n: nn is ん)
  const NN = ['nn', "n'", 'xn'];
  const SMALL_TU = ['xtu', 'ltu', 'xtsu', 'ltsu'];
  const MAX_OPTS = 7000;

  // A token is one or more kana typed as a unit: `opts` are its spellings, `units` the kana
  // it is made of, and `cuts` gives, for a joined spelling, where each later kana's letters
  // start (so a miss can be put on the right kana).
  const plain = (kana, opts) => ({ kana, units: [kana], opts, cuts: null });
  const cutsOf = (t, o) => (t.cuts && t.cuts.get(o)) || [];
  function joined(first, pairs, next) {
    const opts = [];
    const cuts = new Map();
    for (const [pre, o] of pairs) {
      const spelling = pre + o;
      if (cuts.has(spelling)) continue;
      opts.push(spelling);
      cuts.set(spelling, [pre.length, ...cutsOf(next, o).map((c) => c + pre.length)]);
    }
    return { kana: first + next.kana, units: [first, ...next.units], opts, cuts };
  }

  // Turns a prompt into tokens. ん and っ join the token after them, so what they may be typed
  // as depends on what is actually typed next.
  function tokenize(prompt) {
    const chars = Array.from(toHiragana(prompt));
    const base = [];
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      const pair = c + (chars[i + 1] || '');
      if (COMBO[pair]) {
        const apart = [];
        for (const a of SINGLE[c]) for (const b of SINGLE[chars[i + 1]]) apart.push(a + b);
        const list = COMBO[pair];
        const opts = list[0] === null ? [...apart, ...list.slice(1)] : [...list, ...apart];
        base.push(plain(pair, [...new Set(opts)]));
        i++;
      } else if (c === 'ん' || c === 'っ') {
        base.push({ kana: c, mark: c });
      } else if (SINGLE[c]) {
        base.push(plain(c, SINGLE[c]));
      } else {
        throw new Error('Unsupported character: ' + c);
      }
    }

    // From the right, so each ん or っ meets the token after it already resolved.
    const tokens = [];
    for (let i = base.length - 1; i >= 0; i--) {
      const t = base[i];
      const next = tokens[0];
      if (!t.mark) {
        tokens.unshift(t);
      } else if (!next) {
        tokens.unshift(plain(t.kana, t.mark === 'ん' ? NN : SINGLE['っ']));
      } else if (t.mark === 'っ') {
        // っ: the next consonant doubled (kka, ccha, also tcha), or xtu, ltu… then the next kana.
        // The hint follows the next kana's own hint, and never doubles x or l.
        // Not before a letter already doubled (wwa: www is typed as w), nor before x or l.
        const first = next.opts[0];
        const pairs = [DOUBLES.test(first) && !/^[xl]/.test(first) && first[0] !== first[1] ? [first[0], first] : ['xtu', first]];
        for (const o of next.opts) if (DOUBLES.test(o)) pairs.push([o[0], o]);
        for (const o of next.opts) if (o.startsWith('ch')) pairs.push(['t', o]);
        for (const pre of SMALL_TU) for (const o of next.opts) pairs.push([pre, o]);
        // Each っ multiplies the spellings by about five; up to five っ in a row all are kept,
        // and beyond that the first MAX_OPTS (hint first) are plenty.
        tokens[0] = joined('っ', pairs.slice(0, MAX_OPTS), next);
      } else {
        // ん: a lone n before k, s, t…, punctuation and the like; nn (or n', xn) before a vowel,
        // y or n. At the end of the prompt it is nn (handled above).
        const single = next.opts.filter((o) => !NEEDS_NN.test(o)).map((o) => ['n', o]);
        const full = [];
        for (const n of NN) for (const o of next.opts) full.push([n, o]);
        const hintSingle = /^[a-z]/.test(next.opts[0]) && !NEEDS_NN.test(next.opts[0]);
        tokens[0] = joined('ん', hintSingle ? [...single, ...full] : [...full, ...single], next);
      }
    }
    return tokens;
  }

  // The kana of a prompt one by one, as the tokens hold them.
  function units(tokens) {
    return tokens.flatMap((t) => t.units);
  }

  // True when `typed` is the start of some valid spelling of the prompt.
  function matchPrefix(tokens, typed) {
    const memo = new Map();
    const walk = (i, p) => {
      if (p === typed.length) return true;
      if (i === tokens.length) return false;
      const key = i * 1000 + p;
      if (memo.has(key)) return memo.get(key);
      const rest = typed.slice(p);
      let ok = false;
      for (const o of tokens[i].opts) {
        if (o.startsWith(rest) || (rest.startsWith(o) && walk(i + 1, p + o.length))) {
          ok = true;
          break;
        }
      }
      memo.set(key, ok);
      return ok;
    };
    return walk(0, 0);
  }

  // True when `typed` is exactly one valid spelling of the prompt.
  function isComplete(tokens, typed) {
    const memo = new Map();
    const walk = (i, p) => {
      if (i === tokens.length) return p === typed.length;
      const key = i * 1000 + p;
      if (memo.has(key)) return memo.get(key);
      const ok = tokens[i].opts.some((o) => typed.startsWith(o, p) && walk(i + 1, p + o.length));
      memo.set(key, ok);
      return ok;
    };
    return walk(0, 0);
  }

  // The characters that may come next after `typed`, for the keyboard to light up.
  function nextChars(tokens, typed) {
    const out = new Set();
    const seen = new Set();
    const walk = (i, p) => {
      if (i === tokens.length || seen.has(i * 1000 + p)) return;
      seen.add(i * 1000 + p);
      const rest = typed.slice(p);
      for (const o of tokens[i].opts) {
        if (o.startsWith(rest) && o.length > rest.length) out.add(o[rest.length]);
        if (rest.length && rest.startsWith(o)) walk(i + 1, p + o.length);
      }
    };
    walk(0, 0);
    return out;
  }

  // A whole spelling of the prompt that goes on from what was actually typed (so a player
  // who typed "sy" for しゃ is shown "sya", not "sha"). Null if `typed` is not a valid start.
  function spell(tokens, typed = '') {
    const hint = (from) => tokens.slice(from).map((t) => t.opts[0]).join('');
    const walk = (i, p) => {
      if (i === tokens.length) return p === typed.length ? '' : null;
      const rest = typed.slice(p);
      for (const o of tokens[i].opts) {
        if (rest.startsWith(o)) {
          const r = walk(i + 1, p + o.length);
          if (r !== null) return r;
        }
      }
      for (const o of tokens[i].opts) {
        if (o.length > rest.length && o.startsWith(rest)) return o.slice(rest.length) + hint(i + 1);
      }
      return null;
    };
    const tail = walk(0, 0);
    return tail === null ? null : typed + tail;
  }

  // Where the next key falls: the index of the token being typed and where its letters
  // start in `typed`. Used to name the kana a miss belongs to and the spellings still open.
  function at(tokens, typed) {
    const walk = (i, p) => {
      if (i === tokens.length) return null;
      const rest = typed.slice(p);
      for (const o of tokens[i].opts) {
        if (rest.startsWith(o)) {
          const r = walk(i + 1, p + o.length);
          if (r) return r;
        }
      }
      for (const o of tokens[i].opts) {
        if (o.length > rest.length && o.startsWith(rest)) return { index: i, start: p };
      }
      return null;
    };
    return walk(0, 0);
  }

  // The kana the next key belongs to, as an index into units(tokens); null if `typed` is
  // not a valid start. Inside a joined token it goes by the letters typed so far.
  function unitAt(tokens, typed) {
    const pos = at(tokens, typed);
    if (!pos) return null;
    const t = tokens[pos.index];
    const part = typed.slice(pos.start);
    const o = t.opts.find((x) => x.length > part.length && x.startsWith(part)) || t.opts[0];
    let before = 0;
    for (let i = 0; i < pos.index; i++) before += tokens[i].units.length;
    return before + cutsOf(t, o).filter((c) => c <= part.length).length;
  }

  // The kana a refused key is put on. As unitAt(), except for the two slips that belong to
  // ん and っ although the letters have moved on to the next kana: one n too few before な行
  // (konn + i for こんに), and one consonant where っ needs two (kit + e for きって).
  function blame(tokens, typed, key) {
    const i = unitAt(tokens, typed);
    const pos = at(tokens, typed);
    if (i === null || !pos) return i;
    const t = tokens[pos.index];
    const part = typed.slice(pos.start);
    const o = t.opts.find((x) => x.length > part.length && x.startsWith(part)) || t.opts[0];
    const cuts = cutsOf(t, o);
    const local = cuts.filter((c) => c <= part.length).length;
    if (local === 0 || part.length !== cuts[local - 1]) return i; // letters already typed for this kana
    const prev = t.units[local - 1];
    const letters = o.slice(local > 1 ? cuts[local - 2] : 0, cuts[local - 1]);
    if (prev === 'ん' && letters === 'nn' && NA_ROW.test(t.units[local]) && /^[aiueoy]$/.test(key)) return i - 1;
    if (prev === 'っ' && letters.length === 1 && DOUBLES.test(letters) && key !== letters) return i - 1;
    return i;
  }
  const NA_ROW = /^[なにぬねの]/;

  // The spellings of the kana being typed that are still open after `typed`.
  function choices(tokens, typed) {
    const pos = at(tokens, typed);
    if (!pos) return [];
    const part = typed.slice(pos.start);
    return tokens[pos.index].opts.filter((o) => o.length > part.length && o.startsWith(part));
  }

  // Why a key a learner is likely to try was not taken, for the line under the card.
  const NOTES = {
    wo: 'を = wo　(o is お)', di: 'ぢ = di　(ji is じ)', du: 'づ = du　(zu is ず)', ha: 'は = ha　(wa is わ)',
    nn: 'ん before a vowel, y or n = nn', nnn: 'ん before な行 = nn, then the kana: konnnichiha',
    end: 'ん at the end = nn', xtu: 'っ before な行 = xtu　(nn is ん)',
  };
  function why(tokens, typed, key) {
    const pos = at(tokens, typed);
    return pos ? note(tokens[pos.index].units, typed.slice(pos.start) + key) : null;
  }
  // `tried`: the letters typed for these kana, the last one refused.
  function note(kana, tried) {
    const [k, ...rest] = kana;
    if (k === 'ん') {
      if (!rest.length) return /^n[^n']/.test(tried) ? NOTES.end : null;
      if (NA_ROW.test(rest[0]) && /^nn[aiueoy]$/.test(tried)) return NOTES.nnn;
      const done = /^(nn|n'|xn)/.exec(tried);
      if (done) return tried.length > done[0].length ? note(rest, tried.slice(done[0].length)) : null;
      // を and the small kana take a lone n (nwo, nxa): only the vowel, y and な rows need nn
      if (/^n[aiueoyn]$/.test(tried) && /^[あいうえおやゆよなにぬねの]/.test(rest[0])) return NOTES.nn;
      if (rest[0] === 'を' && tried === 'no') return NOTES.wo;
      if (/^n./.test(tried)) return note(rest, tried.slice(1));
      return null;
    }
    if (k === 'っ' && rest.length) {
      const small = /^(xtsu|ltsu|xtu|ltu)/.exec(tried);
      if (small) return tried.length > small[0].length ? note(rest, tried.slice(small[0].length)) : null;
      if (tried[0] === 'n' && /^[なにぬねの]/.test(rest[0])) return NOTES.xtu;
      if (tried.length > 1 && tried[0] === tried[1]) return note(rest, tried.slice(1));
      return null;
    }
    if (k === 'を' && tried[0] === 'o') return NOTES.wo;
    if (k && k[0] === 'ぢ' && /^[jz]/.test(tried)) return NOTES.di;
    if (k && k[0] === 'づ' && tried[0] === 'z') return NOTES.du;
    if (k === 'は' && tried[0] === 'w') return NOTES.ha;
    return null;
  }

  // ---------- the JIS keyboard ----------

  // Keys that type a symbol on a Japanese (JIS) keyboard in direct input: the character,
  // the physical key and whether Shift is needed. `key` is what the browser reports.
  const SYMBOL_KEYS = [
    ['!', 'Digit1', true], ['"', 'Digit2', true], ['#', 'Digit3', true], ['$', 'Digit4', true],
    ['%', 'Digit5', true], ['&', 'Digit6', true], ["'", 'Digit7', true], ['(', 'Digit8', true],
    [')', 'Digit9', true], ['-', 'Minus', false], ['=', 'Minus', true], ['^', 'Equal', false],
    ['~', 'Equal', true], ['|', 'IntlYen', true], ['@', 'BracketLeft', false], ['`', 'BracketLeft', true],
    ['[', 'BracketRight', false], ['{', 'BracketRight', true], [';', 'Semicolon', false], ['+', 'Semicolon', true],
    [':', 'Quote', false], ['*', 'Quote', true], [']', 'Backslash', false], ['}', 'Backslash', true],
    [',', 'Comma', false], ['<', 'Comma', true], ['.', 'Period', false], ['>', 'Period', true],
    ['/', 'Slash', false], ['?', 'Slash', true], ['_', 'IntlRo', true],
  ].map(([ch, code, shift]) => ({ ch, key: ch, code, shift }));

  // Japanese punctuation as typed in romaji input: shown as the kana mark, typed with the key.
  const PUNCT_KEYS = [
    ['、', ','], ['。', '.'], ['・', '/'], ['「', '['], ['」', ']'], ['ー', '-'], ['〜', '~'], ['！', '!'], ['？', '?'],
  ].map(([ch, key]) => {
    const k = SYMBOL_KEYS.find((s) => s.key === key);
    return { ch, key, code: k.code, shift: k.shift };
  });

  // The kana printed on each key of a JIS keyboard for kana input, by physical key.
  // `shift` marks the small kana and marks typed with Shift.
  const KANA_KEYS = [
    // number row
    ['Digit1', 'ぬ'], ['Digit2', 'ふ'], ['Digit3', 'あ'], ['Digit4', 'う'], ['Digit5', 'え'], ['Digit6', 'お'],
    ['Digit7', 'や'], ['Digit8', 'ゆ'], ['Digit9', 'よ'], ['Digit0', 'わ'], ['Minus', 'ほ'], ['Equal', 'へ'], ['IntlYen', 'ー'],
    // Q row
    ['KeyQ', 'た'], ['KeyW', 'て'], ['KeyE', 'い'], ['KeyR', 'す'], ['KeyT', 'か'], ['KeyY', 'ん'], ['KeyU', 'な'],
    ['KeyI', 'に'], ['KeyO', 'ら'], ['KeyP', 'せ'], ['BracketLeft', '゛'], ['BracketRight', '゜'],
    // A row (home)
    ['KeyA', 'ち'], ['KeyS', 'と'], ['KeyD', 'し'], ['KeyF', 'は'], ['KeyG', 'き'], ['KeyH', 'く'], ['KeyJ', 'ま'],
    ['KeyK', 'の'], ['KeyL', 'り'], ['Semicolon', 'れ'], ['Quote', 'け'], ['Backslash', 'む'],
    // Z row
    ['KeyZ', 'つ'], ['KeyX', 'さ'], ['KeyC', 'そ'], ['KeyV', 'ひ'], ['KeyB', 'こ'], ['KeyN', 'み'], ['KeyM', 'も'],
    ['Comma', 'ね'], ['Period', 'る'], ['Slash', 'め'], ['IntlRo', 'ろ'],
  ].map(([code, kana]) => ({ code, kana, shift: false }));
  const KANA_SHIFT_KEYS = [
    ['Digit3', 'ぁ'], ['Digit4', 'ぅ'], ['Digit5', 'ぇ'], ['Digit6', 'ぉ'], ['Digit7', 'ゃ'], ['Digit8', 'ゅ'],
    ['Digit9', 'ょ'], ['Digit0', 'を'], ['KeyE', 'ぃ'], ['KeyZ', 'っ'], ['BracketRight', '「'], ['Backslash', '」'],
    ['Comma', '、'], ['Period', '。'], ['Slash', '・'],
  ].map(([code, kana]) => ({ code, kana, shift: true }));

  // Kana input: the keys that type a line of kana, one step a key. A voiced kana is its kana
  // and then ゛ (or ゜); a small kana or a mark takes Shift; katakana go on the same keys as
  // hiragana. `ends[i]` is the steps typed once character i is in, and `bases[i]` what it shows
  // half-typed (the kana before its ゛ or ゜). A character kana input cannot type throws.
  const KANA_STEP = {};
  for (const k of KANA_KEYS.concat(KANA_SHIFT_KEYS)) KANA_STEP[k.kana] = k;
  const VOICED = 'がぎぐげござじずぜぞだぢづでどばびぶべぼ';
  const SEMI = 'ぱぴぷぺぽ';
  function kanaKeys(text) {
    const steps = [];
    const ends = [];
    const bases = [];
    for (const ch of Array.from(text)) {
      const c = ch.codePointAt(0);
      const hira = c >= 0x30a1 && c <= 0x30f4 ? String.fromCodePoint(c - 0x60) : ch;
      const add = (kana) => {
        const k = KANA_STEP[kana];
        if (!k) throw new Error('Kana input cannot type ' + ch + ' (in ' + text + ')');
        steps.push({ code: k.code, shift: k.shift, kana });
      };
      let base = null;
      if (KANA_STEP[hira]) {
        add(hira);
      } else if (hira === 'ゔ') {
        add('う');
        add('゛');
        base = ch === 'ゔ' ? 'う' : 'ウ';
      } else if (VOICED.includes(hira) || SEMI.includes(hira)) {
        const back = VOICED.includes(hira) ? 1 : 2;
        add(String.fromCodePoint(hira.codePointAt(0) - back));
        add(back === 1 ? '゛' : '゜');
        base = String.fromCodePoint(c - back);
      } else {
        add(ch);
      }
      ends.push(steps.length);
      bases.push(base);
    }
    return { steps, ends, bases };
  }
  // What kana input shows of `text` once `n` steps of it are typed (as the input method would).
  function kanaTyped(text, keys, n) {
    const chars = Array.from(text);
    let out = '';
    for (let i = 0; i < chars.length; i++) {
      if (keys.ends[i] <= n) out += chars[i];
      else {
        if (keys.bases[i] && n > (i ? keys.ends[i - 1] : 0)) out += keys.bases[i];
        break;
      }
    }
    return out;
  }

  // The physical row of each key, for the kana stages.
  function rowOf(code) {
    if (/^Digit|^Minus$|^Equal$|^IntlYen$/.test(code)) return 'number';
    if (/^Key[QWERTYUIOP]$|^Bracket/.test(code)) return 'top';
    if (/^Key[ASDFGHJKL]$|^Semicolon$|^Quote$|^Backslash$/.test(code)) return 'home';
    return 'bottom';
  }

  // The finger that presses each key in touch typing (Japanese name, English name).
  const FINGERS = {
    lp: ['左手の小指', 'left little finger'], lr: ['左手の薬指', 'left ring finger'],
    lm: ['左手の中指', 'left middle finger'], li: ['左手の人差し指', 'left index finger'],
    ri: ['右手の人差し指', 'right index finger'], rm: ['右手の中指', 'right middle finger'],
    rr: ['右手の薬指', 'right ring finger'], rp: ['右手の小指', 'right little finger'],
    th: ['親指', 'thumb'],
  };
  const FINGER_OF = {};
  const assign = (finger, codes) => codes.split(' ').forEach((c) => { FINGER_OF[c] = finger; });
  assign('lp', 'Backquote Digit1 Tab KeyQ CapsLock KeyA ShiftLeft KeyZ');
  assign('lr', 'Digit2 KeyW KeyS KeyX');
  assign('lm', 'Digit3 KeyE KeyD KeyC');
  assign('li', 'Digit4 Digit5 KeyR KeyT KeyF KeyG KeyV KeyB');
  assign('ri', 'Digit6 Digit7 KeyY KeyU KeyH KeyJ KeyN KeyM');
  assign('rm', 'Digit8 KeyI KeyK Comma');
  assign('rr', 'Digit9 KeyO KeyL Period');
  assign('rp', 'Digit0 Minus Equal IntlYen Backspace KeyP BracketLeft BracketRight Semicolon Quote Backslash Enter Slash IntlRo ShiftRight');
  assign('th', 'Space');
  const fingerFor = (code) => FINGERS[FINGER_OF[code]] || null;

  // The physical key that types a character in direct input, for lighting up the keyboard.
  function keyFor(ch) {
    if (/^[a-z]$/.test(ch)) return { code: 'Key' + ch.toUpperCase(), shift: false };
    if (/^[0-9]$/.test(ch)) return { code: 'Digit' + ch, shift: false };
    const k = SYMBOL_KEYS.find((s) => s.key === ch);
    return k ? { code: k.code, shift: k.shift } : null;
  }

  // ---------- built-in prompts ----------

  // Items are { text, gloss? }. Lists are written as 'text' or 'text=gloss', separated by |.
  const list = (s) => s.split('|').map((x) => {
    const [text, gloss] = x.split('=');
    return gloss ? { text, gloss } : { text };
  });
  const each = (s) => Array.from(s.replace(/\s/g, '')).map((text) => ({ text }));

  const KANA_STAGES = [
    { id: 'basic', ja: '清音', en: 'Basic kana', items: each('あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん') },
    {
      id: 'voiced', ja: '濁音・拗音', en: 'Voiced and combined',
      items: each('がぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ').concat(list(
        'きゃ|きゅ|きょ|ぎゃ|ぎゅ|ぎょ|しゃ|しゅ|しょ|じゃ|じゅ|じょ|ちゃ|ちゅ|ちょ|にゃ|にゅ|にょ|ひゃ|ひゅ|ひょ|' +
        'びゃ|びゅ|びょ|ぴゃ|ぴゅ|ぴょ|みゃ|みゅ|みょ|りゃ|りゅ|りょ|がっこう=school|きって=stamp|ちょっと=a little|ほんや=bookshop')),
    },
    {
      id: 'katakana', ja: 'カタカナ', en: 'Katakana',
      items: each('アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン').concat(list(
        'パソコン=computer|ラーメン=ramen|コーヒー=coffee|テレビ=TV|カメラ=camera|ノート=notebook|タクシー=taxi|' +
        'ホテル=hotel|レストラン=restaurant|ケーキ=cake|ゲーム=game|メール=email|チョコレート=chocolate|' +
        'ファイル=file|パーティー=party|フォーク=fork|ウェブ=web|ウィーク=week|シェフ=chef|チェック=check|' +
        'ジェット=jet|ソファ=sofa|ティッシュ=tissue|ヴァイオリン=violin|ディスク=disk|フィルム=film')),
    },
    {
      id: 'words', ja: '単語', en: 'Words',
      items: list(
        'ねこ=cat|いぬ=dog|さかな=fish|すし=sushi|てがみ=letter|がっこう=school|きって=stamp|ちょっと=a little|' +
        'にほんご=Japanese|せんせい=teacher|がくせい=student|ひこうき=aeroplane|でんわ=telephone|ともだち=friend|' +
        'りんご=apple|ぎゅうにゅう=milk|じどうしゃ=car|ゆうびんきょく=post office|おちゃ=tea|ちゃわん=rice bowl|' +
        'しゃしん=photo|びょういん=hospital|こうえん=park|まど=window|てんき=weather|きょうしつ=classroom|' +
        'とけい=clock|かばん=bag|さくら=cherry blossom|おにぎり=rice ball|みず=water|ぎんこう=bank|' +
        'こんにちは=hello|ほんや=bookshop|せんえん=1,000 yen|おんな=woman|きんようび=Friday|はなぢ=nosebleed|' +
        'つづく=to continue|ほんを=a book (object)'),
    },
    {
      id: 'phrases', ja: '文', en: 'Phrases',
      items: list(
        'わたしはがくせいです。=I am a student.|きょうはいいてんきですね。=Nice weather today.|' +
        'まいにち、にほんごをべんきょうします。=I study Japanese every day.|ラーメンがたべたいです。=I want to eat ramen.|' +
        'ゆっくりはなしてください。=Please speak slowly.|ちょっとまってください。=Please wait a moment.|' +
        'すみません、もういちどおねがいします。=Excuse me, once more please.|「いただきます」といいました。=I said "itadakimasu".|' +
        'ほんとうですか？=Really?|いっしょにいきましょう！=Let\'s go together!|コーヒーとケーキをください。=Coffee and cake, please.'),
    },
  ];

  // Kanji: the card shows the word in kanji, and the reading is typed in romaji. Items are
  // { text, reading, gloss }, written 'text:reading=gloss', separated by |.
  const kanji = (s) => s.split('|').map((x) => {
    const [head, gloss] = x.split('=');
    const [text, reading] = head.split(':');
    return { text, reading, gloss };
  });
  // The room a hidden reading is given, in kana, from the kanji shown alone: two and a half for
  // each kanji (and a half over), one for anything else. Every item's reading fits it.
  function readingSlots(text) {
    const chars = Array.from(text);
    const n = chars.filter((ch) => /[一-鿿々〆ヶ]/.test(ch)).length;
    return Math.ceil(2.5 * n + 0.5) + chars.length - n;
  }
  const KANJI_STAGES = [
    {
      id: 'single', ja: '一字', en: 'Single kanji',
      items: kanji(
        '山:やま=mountain|川:かわ=river|木:き=tree|花:はな=flower|雨:あめ=rain|空:そら=sky|海:うみ=sea|' +
        '森:もり=forest|犬:いぬ=dog|猫:ねこ=cat|鳥:とり=bird|魚:さかな=fish|水:みず=water|火:ひ=fire|' +
        '手:て=hand|目:め=eye|口:くち=mouth|耳:みみ=ear|足:あし=foot|本:ほん=book|車:くるま=car|' +
        '道:みち=road|町:まち=town|机:つくえ=desk|店:みせ=shop|駅:えき=station|春:はる=spring|夏:なつ=summer|' +
        '秋:あき=autumn|冬:ふゆ=winter|朝:あさ=morning|夜:よる=night|右:みぎ=right|左:ひだり=left|' +
        '上:うえ=above|下:した=below|中:なか=inside|外:そと=outside|北:きた=north|南:みなみ=south|' +
        '東:ひがし=east|西:にし=west|月:つき=moon|星:ほし=star|雪:ゆき=snow|風:かぜ=wind|石:いし=stone|' +
        '色:いろ=colour|声:こえ=voice|肉:にく=meat|人:ひと=person|島:しま=island|虫:むし=insect|' +
        '馬:うま=horse|紙:かみ=paper|箱:はこ=box|歌:うた=song|夢:ゆめ=dream|心:こころ=heart|力:ちから=strength'),
    },
    {
      id: 'jukugo', ja: '熟語', en: 'Compound words',
      items: kanji(
        '学校:がっこう=school|先生:せんせい=teacher|学生:がくせい=student|電車:でんしゃ=train|天気:てんき=weather|' +
        '時間:じかん=time|日本語:にほんご=Japanese|友達:ともだち=friend|自転車:じてんしゃ=bicycle|' +
        '図書館:としょかん=library|新聞:しんぶん=newspaper|会社:かいしゃ=company|銀行:ぎんこう=bank|' +
        '病院:びょういん=hospital|映画:えいが=film|音楽:おんがく=music|料理:りょうり=cooking|写真:しゃしん=photo|' +
        '旅行:りょこう=travel|宿題:しゅくだい=homework|勉強:べんきょう=study|練習:れんしゅう=practice|' +
        '質問:しつもん=question|電話:でんわ=telephone|今日:きょう=today|毎週:まいしゅう=every week|先週:せんしゅう=last week|' +
        '毎日:まいにち=every day|午後:ごご=afternoon|半分:はんぶん=half|大人:おとな=adult|子供:こども=child|' +
        '家族:かぞく=family|兄弟:きょうだい=siblings|動物:どうぶつ=animal|果物:くだもの=fruit|野菜:やさい=vegetables|' +
        '牛乳:ぎゅうにゅう=milk|仕事:しごと=work|世界:せかい=world|季節:きせつ=season|花火:はなび=fireworks|' +
        '東京:とうきょう=Tokyo|富士山:ふじさん=Mt Fuji|新幹線:しんかんせん=bullet train|誕生日:たんじょうび=birthday|' +
        '入口:いりぐち=entrance|出口:でぐち=exit|切符:きっぷ=ticket|地下鉄:ちかてつ=underground railway'),
    },
    {
      id: 'advanced', ja: '上級熟語', en: 'Harder compounds',
      items: kanji(
        '経験:けいけん=experience|説明:せつめい=explanation|相談:そうだん=consultation, advice|準備:じゅんび=preparation|' +
        '約束:やくそく=promise|予約:よやく=booking|連絡:れんらく=getting in touch|留学:りゅうがく=studying abroad|' +
        '就職:しゅうしょく=finding a job|環境:かんきょう=environment|経済:けいざい=economy|政治:せいじ=politics|' +
        '技術:ぎじゅつ=technology|情報:じょうほう=information|意見:いけん=opinion|理由:りゆう=reason|努力:どりょく=effort|' +
        '成功:せいこう=success|失敗:しっぱい=failure|結果:けっか=result|原因:げんいん=cause|影響:えいきょう=influence|' +
        '関係:かんけい=relationship|状況:じょうきょう=situation|必要:ひつよう=necessary|複雑:ふくざつ=complicated|' +
        '丁寧:ていねい=polite|真剣:しんけん=serious|緊張:きんちょう=nerves|挑戦:ちょうせん=challenge|' +
        '到着:とうちゃく=arrival|出発:しゅっぱつ=departure|天気予報:てんきよほう=weather forecast|' +
        '観光客:かんこうきゃく=tourist|携帯電話:けいたいでんわ=mobile phone|交差点:こうさてん=crossroads|' +
        '郵便局:ゆうびんきょく=post office|冷蔵庫:れいぞうこ=fridge|洗濯機:せんたくき=washing machine|' +
        '自動販売機:じどうはんばいき=vending machine'),
    },
    {
      id: 'yoji', ja: '四字熟語', en: 'Four-character idioms',
      items: kanji(
        '心機一転:しんきいってん=a fresh start|一期一会:いちごいちえ=a once-in-a-lifetime meeting|' +
        '十人十色:じゅうにんといろ=to each their own|一石二鳥:いっせきにちょう=two birds with one stone|' +
        '一生懸命:いっしょうけんめい=with all one\'s might|以心伝心:いしんでんしん=unspoken understanding|' +
        '三日坊主:みっかぼうず=someone who soon gives up|日進月歩:にっしんげっぽ=rapid, constant progress|' +
        '起承転結:きしょうてんけつ=intro, development, twist, conclusion|花鳥風月:かちょうふうげつ=the beauties of nature|' +
        '温故知新:おんこちしん=finding new ideas in the old|臨機応変:りんきおうへん=adapting to the moment|' +
        '自業自得:じごうじとく=you reap what you sow|異口同音:いくどうおん=with one voice|' +
        '電光石火:でんこうせっか=as fast as lightning|単刀直入:たんとうちょくにゅう=straight to the point|' +
        '晴耕雨読:せいこううどく=work in sun, read in rain|大器晩成:たいきばんせい=great talents ripen late|' +
        '有言実行:ゆうげんじっこう=doing what you say|一日一善:いちにちいちぜん=a good deed a day|' +
        '半信半疑:はんしんはんぎ=half in doubt|四苦八苦:しくはっく=great hardship|' +
        '一喜一憂:いっきいちゆう=swinging between joy and worry|適材適所:てきざいてきしょ=the right person in the right place'),
    },
    {
      id: 'sentences', ja: '漢字の文', en: 'Sentences with kanji',
      items: kanji(
        '今日は天気がいいです。:きょうはてんきがいいです。=The weather is nice today.|' +
        '駅はどこですか。:えきはどこですか。=Where is the station?|雨が降っています。:あめがふっています。=It is raining.|' +
        '日本語を勉強しています。:にほんごをべんきょうしています。=I am studying Japanese.|' +
        '毎朝六時に起きます。:まいあさろくじにおきます。=I get up at six every morning.|' +
        '週末に友達と映画を見ました。:しゅうまつにともだちとえいがをみました。=I saw a film with a friend at the weekend.|' +
        '七転び八起き。:ななころびやおき。=Fall down seven times, get up eight.|' +
        '電車で学校へ行きます。:でんしゃでがっこうへいきます。=I go to school by train.|' +
        '桜がきれいに咲いています。:さくらがきれいにさいています。=The cherry blossoms are blooming beautifully.|' +
        '少し休みましょう。:すこしやすみましょう。=Let\'s rest a little.|今夜は早く寝ます。:こんやははやくねます。=I will go to bed early tonight.|' +
        'お茶をもう一杯ください。:おちゃをもういっぱいください。=Another cup of tea, please.|' +
        'この本はとても面白いです。:このほんはとてもおもしろいです。=This book is very interesting.|' +
        '窓を開けてもいいですか。:まどをあけてもいいですか。=May I open the window?|道に迷いました。:みちにまよいました。=I got lost.|' +
        '夏休みに海へ行きたいです。:なつやすみにうみへいきたいです。=I want to go to the sea in the summer holidays.|' +
        '宿題を忘れないでください。:しゅくだいをわすれないでください。=Please don\'t forget your homework.|' +
        '駅の前で待っています。:えきのまえでまっています。=I am waiting in front of the station.|' +
        '風邪をひいてしまいました。:かぜをひいてしまいました。=I have caught a cold.|' +
        '来年、京都へ留学します。:らいねん、きょうとへりゅうがくします。=Next year I will study in Kyoto.|' +
        '失敗は成功のもと。:しっぱいはせいこうのもと。=Failure is the seed of success.|' +
        '石の上にも三年。:いしのうえにもさんねん。=Patience wins in the end.|継続は力なり。:けいぞくはちからなり。=Keeping at it is strength.|' +
        '急がば回れ。:いそがばまわれ。=More haste, less speed.'),
    },
  ];

  const SYMBOL_STAGES = [
    { id: 'plain', ja: 'シフトなし', en: 'Unshifted keys', items: SYMBOL_KEYS.filter((k) => !k.shift) },
    { id: 'shifted', ja: 'シフト', en: 'Shift keys', items: SYMBOL_KEYS.filter((k) => k.shift) },
    { id: 'punct', ja: '句読点・かっこ', en: 'Japanese punctuation', items: PUNCT_KEYS },
    { id: 'all', ja: 'ぜんぶ', en: 'Everything', items: SYMBOL_KEYS.concat(PUNCT_KEYS) },
  ];

  const KANA_KEY_STAGES = [
    { id: 'home', ja: 'ホームの段', en: 'Home row (A)', items: KANA_KEYS.filter((k) => rowOf(k.code) === 'home') },
    { id: 'top', ja: '上の段', en: 'Upper row (Q)', items: KANA_KEYS.filter((k) => rowOf(k.code) === 'top') },
    { id: 'bottom', ja: '下の段', en: 'Lower row (Z)', items: KANA_KEYS.filter((k) => rowOf(k.code) === 'bottom') },
    { id: 'number', ja: '数字の段', en: 'Number row', items: KANA_KEYS.filter((k) => rowOf(k.code) === 'number') },
    { id: 'shift', ja: 'シフト', en: 'Small kana and marks', items: KANA_SHIFT_KEYS },
    { id: 'all', ja: 'ぜんぶ', en: 'Everything', items: KANA_KEYS.concat(KANA_SHIFT_KEYS) },
  ];

  const api = {
    toHiragana, tokenize, units, matchPrefix, isComplete, nextChars, spell, at, unitAt, blame, choices, why, keyFor, fingerFor, rowOf, readingSlots,
    kanaKeys, kanaTyped,
    SINGLE, COMBO, SYMBOL_KEYS, PUNCT_KEYS, KANA_KEYS, KANA_SHIFT_KEYS,
    KANA_STAGES, KANJI_STAGES, SYMBOL_STAGES, KANA_KEY_STAGES,
  };

  root.TypingEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
