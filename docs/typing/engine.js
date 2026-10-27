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
  combos('と', { 'ぅ': ['twu', "t'u"] });
  combos('ど', { 'ぅ': ['dwu', "d'u"] });
  combos('う', { 'ぁ': ['wha'], 'ぃ': ['wi', 'whi'], 'ぇ': ['we', 'whe'], 'ぉ': ['who'] });
  combos('い', { 'ぇ': ['ye'] });
  combos('ゔ', { 'ぁ': ['va'], 'ぃ': ['vi', 'vyi'], 'ぇ': ['ve', 'vye'], 'ぉ': ['vo'], 'ゃ': ['vya'], 'ゅ': ['vyu'], 'ょ': ['vyo'] });
  combos('つ', { 'ぁ': ['tsa'], 'ぃ': ['tsi'], 'ぇ': ['tse'], 'ぉ': ['tso'] });
  combos('く', { 'ぁ': ['qa', 'kwa', 'qwa'], 'ぃ': ['qi', 'kwi', 'qwi', 'qyi'], 'ぅ': [null, 'kwu', 'qwu'], 'ぇ': ['qe', 'kwe', 'qwe', 'qye'], 'ぉ': ['qo', 'kwo', 'qwo'], 'ゃ': ['qya'], 'ゅ': ['qyu'], 'ょ': ['qyo'] });
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

  const NEEDS_NN = /^[aiueoyn']/;          // a lone n before these would make な, にゃ… instead of ん
  const DOUBLES = /^[bcdfghjkmpqrstvwyz]/; // consonants that っ may double (never n, x or l)
  const NN = ['nn', "n'", 'xn'];

  // Turns a prompt into tokens. Each token has `opts`: the romaji it may be typed as.
  function tokenize(prompt) {
    const chars = Array.from(toHiragana(prompt));
    const base = [];
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      const pair = c + (chars[i + 1] || '');
      if (COMBO[pair]) {
        const apart = [];
        for (const a of SINGLE[c]) for (const b of SINGLE[chars[i + 1]]) apart.push(a + b);
        const joined = COMBO[pair];
        const opts = joined[0] === null ? [...apart, ...joined.slice(1)] : [...joined, ...apart];
        base.push({ kana: pair, opts: [...new Set(opts)] });
        i++;
      } else if (c === 'ん') {
        base.push({ kana: c, hatsuon: true });
      } else if (c === 'っ' && i + 1 < chars.length && chars[i + 1] !== 'っ') {
        base.push({ kana: c, sokuon: true });
      } else if (SINGLE[c]) {
        base.push({ kana: c, opts: SINGLE[c] });
      } else {
        throw new Error('Unsupported character: ' + c);
      }
    }

    // っ joins the mora after it: its consonant doubled (kka, ccha; also tcha), tied to the
    // spelling actually typed next, or xtu / ltu / xtsu / ltsu followed by that mora.
    const tokens = [];
    for (let i = 0; i < base.length; i++) {
      const t = base[i];
      if (!t.sokuon) {
        tokens.push(t);
        continue;
      }
      const next = base[i + 1];
      if (next.hatsuon || next.sokuon) {
        tokens.push({ kana: t.kana, opts: SINGLE['っ'] });
        continue;
      }
      const doubled = next.opts.filter((o) => DOUBLES.test(o)).map((o) => o[0] + o);
      const tch = next.opts.filter((o) => o.startsWith('ch')).map((o) => 't' + o);
      const spelled = [];
      for (const s of SINGLE['っ']) for (const o of next.opts) spelled.push(s + o);
      tokens.push({ kana: t.kana + next.kana, opts: [...new Set([...doubled, ...tch, ...spelled])] });
      i++;
    }

    // ん also joins what comes after it, so a lone n is judged by the spelling actually typed
    // next: fine before k, s, t…, punctuation and the like; nn (or n', xn) before a vowel, y or
    // n, and at the end of the prompt. Done from the right, so ん after ん works too.
    for (let i = tokens.length - 1; i >= 0; i--) {
      const t = tokens[i];
      if (!t.hatsuon) continue;
      const next = tokens[i + 1];
      if (!next) {
        tokens[i] = { kana: t.kana, opts: NN };
        continue;
      }
      const single = next.opts.filter((o) => !NEEDS_NN.test(o)).map((o) => 'n' + o);
      const full = [];
      for (const n of NN) for (const o of next.opts) full.push(n + o);
      const hintSingle = /^[a-z]/.test(next.opts[0]) && !NEEDS_NN.test(next.opts[0]);
      tokens.splice(i, 2, { kana: t.kana + next.kana, opts: [...new Set(hintSingle ? [...single, ...full] : [...full, ...single])] });
    }

    return tokens;
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

  // The spellings of the kana being typed that are still open after `typed`.
  function choices(tokens, typed) {
    const pos = at(tokens, typed);
    if (!pos) return [];
    const part = typed.slice(pos.start);
    return tokens[pos.index].opts.filter((o) => o.length > part.length && o.startsWith(part));
  }

  // Why a key a learner is likely to try was not taken, for the line under the card.
  function why(tokens, typed, key) {
    const pos = at(tokens, typed);
    if (!pos) return null;
    const kana = tokens[pos.index].kana;
    const tried = typed.slice(pos.start) + key;
    if ((kana[0] === 'を' && tried[0] === 'o') || (kana.startsWith('んを') && tried === 'no')) return 'を = wo　(o is お)';
    if (kana[0] === 'ぢ' && /^[jz]/.test(tried)) return 'ぢ = di　(ji is じ)';
    if (kana[0] === 'づ' && tried[0] === 'z') return 'づ = du　(zu is ず)';
    if (kana === 'は' && tried[0] === 'w') return 'は = ha　(wa is わ)';
    if (kana[0] === 'ん' && /^n[aiueoyn]/.test(tried)) return 'ん before a vowel, y or n = nn';
    if (kana[0] === 'っ' && tried[0] === 'n') return 'っ before な行 = xtu　(nn is ん)';
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
    toHiragana, tokenize, matchPrefix, isComplete, nextChars, spell, at, choices, why, keyFor, fingerFor, rowOf,
    SINGLE, COMBO, SYMBOL_KEYS, PUNCT_KEYS, KANA_KEYS, KANA_SHIFT_KEYS,
    KANA_STAGES, SYMBOL_STAGES, KANA_KEY_STAGES,
  };

  root.TypingEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
