/*
 * Rules for Kana Runner: romaji spellings, the JIS key tables and the word lists.
 * No DOM here, so the same file runs in the page and in Node (check/typing-engine-test.js).
 */
(function (root) {
  'use strict';

  // Romaji accepted for each single kana. The first spelling is the one shown as a hint.
  const SINGLE = {
    'あ': ['a'], 'い': ['i'], 'う': ['u'], 'え': ['e'], 'お': ['o'],
    'か': ['ka'], 'き': ['ki'], 'く': ['ku'], 'け': ['ke'], 'こ': ['ko'],
    'が': ['ga'], 'ぎ': ['gi'], 'ぐ': ['gu'], 'げ': ['ge'], 'ご': ['go'],
    'さ': ['sa'], 'し': ['shi', 'si'], 'す': ['su'], 'せ': ['se'], 'そ': ['so'],
    'ざ': ['za'], 'じ': ['ji', 'zi'], 'ず': ['zu'], 'ぜ': ['ze'], 'ぞ': ['zo'],
    'た': ['ta'], 'ち': ['chi', 'ti'], 'つ': ['tsu', 'tu'], 'て': ['te'], 'と': ['to'],
    'だ': ['da'], 'ぢ': ['ji', 'di'], 'づ': ['zu', 'du'], 'で': ['de'], 'ど': ['do'],
    'な': ['na'], 'に': ['ni'], 'ぬ': ['nu'], 'ね': ['ne'], 'の': ['no'],
    'は': ['ha'], 'ひ': ['hi'], 'ふ': ['fu', 'hu'], 'へ': ['he'], 'ほ': ['ho'],
    'ば': ['ba'], 'び': ['bi'], 'ぶ': ['bu'], 'べ': ['be'], 'ぼ': ['bo'],
    'ぱ': ['pa'], 'ぴ': ['pi'], 'ぷ': ['pu'], 'ぺ': ['pe'], 'ぽ': ['po'],
    'ま': ['ma'], 'み': ['mi'], 'む': ['mu'], 'め': ['me'], 'も': ['mo'],
    'や': ['ya'], 'ゆ': ['yu'], 'よ': ['yo'],
    'ら': ['ra'], 'り': ['ri'], 'る': ['ru'], 'れ': ['re'], 'ろ': ['ro'],
    'わ': ['wa'], 'を': ['wo', 'o'],
    'ぁ': ['xa', 'la'], 'ぃ': ['xi', 'li'], 'ぅ': ['xu', 'lu'], 'ぇ': ['xe', 'le'], 'ぉ': ['xo', 'lo'],
    'ー': ['-'],
  };

  // Kana that take a small ゃ ゅ ょ, with the consonant forms each can take.
  // Only the 'y' forms are used before a small kana, so し is sha/sya, not sa.
  const YOON_STEM = {
    'き': ['ky'], 'ぎ': ['gy'], 'し': ['sh', 'sy'], 'じ': ['j', 'jy', 'zy'],
    'ち': ['ch', 'cy', 'ty'], 'に': ['ny'], 'ひ': ['hy'], 'び': ['by'],
    'ぴ': ['py'], 'み': ['my'], 'り': ['ry'],
  };
  const YOON_VOWEL = { 'ゃ': 'a', 'ゅ': 'u', 'ょ': 'o' };
  const VOWEL_START = /^[aiueoy]/;

  // Turns a kana string into tokens. Each token has `opts`: the romaji it may be typed as.
  // っ doubles the consonant of the next token (kka, tcha); ん depends on what follows it.
  function tokenize(kana) {
    const chars = Array.from(kana);
    const tokens = [];
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      const d = chars[i + 1];
      if (YOON_VOWEL[d] && YOON_STEM[c]) {
        tokens.push({ kana: c + d, opts: YOON_STEM[c].map((s) => s + YOON_VOWEL[d]) });
        i++;
      } else if (c === 'っ') {
        tokens.push({ kana: c, sokuon: true });
      } else if (c === 'ん') {
        tokens.push({ kana: c, hatsuon: true });
      } else if (SINGLE[c]) {
        tokens.push({ kana: c, opts: SINGLE[c] });
      } else {
        throw new Error('Unsupported kana: ' + c);
      }
    }

    tokens.forEach((t, i) => {
      if (!t.sokuon) return;
      const next = tokens[i + 1];
      const opts = [];
      if (next && next.opts) {
        for (const o of next.opts) {
          if ('aiueo'.includes(o[0])) continue;
          if (o.startsWith('ch')) opts.push('t', 'c');
          else opts.push(o[0]);
        }
      }
      t.opts = [...new Set([...opts, 'xtu', 'ltu'])];
    });

    tokens.forEach((t, i) => {
      if (!t.hatsuon) return;
      const next = tokens[i + 1];
      const beforeVowel = !!next && !!next.opts && next.opts.some((o) => VOWEL_START.test(o));
      t.opts = beforeVowel ? ['nn', "n'", 'xn'] : ['n', 'nn', 'xn'];
    });

    return tokens;
  }

  // The romaji a word is shown with (the first spelling of each token).
  function romajiHint(tokens) {
    return tokens.map((t) => t.opts[0]).join('');
  }

  // True when `typed` is the start of some valid spelling of the word.
  function matchPrefix(tokens, typed) {
    const memo = new Map();
    const walk = (i, p) => {
      if (p === typed.length) return true;
      if (i === tokens.length) return false;
      const key = i + ':' + p;
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

  // True when `typed` is exactly one valid spelling of the word.
  function isComplete(tokens, typed) {
    const walk = (i, p) => {
      if (i === tokens.length) return p === typed.length;
      return tokens[i].opts.some((o) => typed.startsWith(o, p) && walk(i + 1, p + o.length));
    };
    return walk(0, 0);
  }

  // The characters that may come next after `typed`, for the keyboard to light up.
  function nextChars(tokens, typed) {
    const out = new Set();
    const walk = (i, p) => {
      if (i === tokens.length) return;
      const rest = typed.slice(p);
      for (const o of tokens[i].opts) {
        if (o.startsWith(rest) && o.length > rest.length) out.add(o[rest.length]);
        if (rest.startsWith(o)) walk(i + 1, p + o.length);
      }
    };
    walk(0, 0);
    return out;
  }

  // Keys of a Japanese (JIS) keyboard that give a symbol, with the physical code and
  // whether Shift is needed. Letters and digits are not listed: their codes are regular.
  const SYMBOL_KEYS = [
    { ch: '!', code: 'Digit1', shift: true }, { ch: '"', code: 'Digit2', shift: true },
    { ch: '#', code: 'Digit3', shift: true }, { ch: '$', code: 'Digit4', shift: true },
    { ch: '%', code: 'Digit5', shift: true }, { ch: '&', code: 'Digit6', shift: true },
    { ch: "'", code: 'Digit7', shift: true }, { ch: '(', code: 'Digit8', shift: true },
    { ch: ')', code: 'Digit9', shift: true }, { ch: '-', code: 'Minus', shift: false },
    { ch: '=', code: 'Minus', shift: true }, { ch: '^', code: 'Equal', shift: false },
    { ch: '~', code: 'Equal', shift: true }, { ch: '\\', code: 'IntlRo', shift: false },
    { ch: '_', code: 'IntlRo', shift: true }, { ch: '@', code: 'BracketLeft', shift: false },
    { ch: '`', code: 'BracketLeft', shift: true }, { ch: '[', code: 'BracketRight', shift: false },
    { ch: '{', code: 'BracketRight', shift: true }, { ch: ']', code: 'Backslash', shift: false },
    { ch: '}', code: 'Backslash', shift: true }, { ch: ':', code: 'Quote', shift: false },
    { ch: '*', code: 'Quote', shift: true }, { ch: ';', code: 'Semicolon', shift: false },
    { ch: '+', code: 'Semicolon', shift: true }, { ch: ',', code: 'Comma', shift: false },
    { ch: '<', code: 'Comma', shift: true }, { ch: '.', code: 'Period', shift: false },
    { ch: '>', code: 'Period', shift: true }, { ch: '/', code: 'Slash', shift: false },
    { ch: '?', code: 'Slash', shift: true },
  ];

  // The kana printed on a Japanese keyboard in kana input, by physical key. The row is
  // the one the key sits in: 'top' (number and Q rows), 'home' (A row) or 'bottom' (Z row).
  const KANA_KEYS = [
    { code: 'Digit1', kana: 'ぬ', row: 'top' }, { code: 'Digit2', kana: 'ふ', row: 'top' },
    { code: 'Digit3', kana: 'あ', row: 'top' }, { code: 'Digit4', kana: 'う', row: 'top' },
    { code: 'Digit5', kana: 'え', row: 'top' }, { code: 'Digit6', kana: 'お', row: 'top' },
    { code: 'Digit7', kana: 'や', row: 'top' }, { code: 'Digit8', kana: 'ゆ', row: 'top' },
    { code: 'Digit9', kana: 'よ', row: 'top' }, { code: 'Digit0', kana: 'わ', row: 'top' },
    { code: 'Minus', kana: 'ほ', row: 'top' }, { code: 'Equal', kana: 'へ', row: 'top' },
    { code: 'IntlYen', kana: 'ー', row: 'top' },
    { code: 'KeyQ', kana: 'た', row: 'top' }, { code: 'KeyW', kana: 'て', row: 'top' },
    { code: 'KeyE', kana: 'い', row: 'top' }, { code: 'KeyR', kana: 'す', row: 'top' },
    { code: 'KeyT', kana: 'か', row: 'top' }, { code: 'KeyY', kana: 'ん', row: 'top' },
    { code: 'KeyU', kana: 'な', row: 'top' }, { code: 'KeyI', kana: 'に', row: 'top' },
    { code: 'KeyO', kana: 'ら', row: 'top' }, { code: 'KeyP', kana: 'せ', row: 'top' },
    { code: 'KeyA', kana: 'ち', row: 'home' }, { code: 'KeyS', kana: 'と', row: 'home' },
    { code: 'KeyD', kana: 'し', row: 'home' }, { code: 'KeyF', kana: 'は', row: 'home' },
    { code: 'KeyG', kana: 'き', row: 'home' }, { code: 'KeyH', kana: 'く', row: 'home' },
    { code: 'KeyJ', kana: 'ま', row: 'home' }, { code: 'KeyK', kana: 'の', row: 'home' },
    { code: 'KeyL', kana: 'り', row: 'home' }, { code: 'Semicolon', kana: 'れ', row: 'home' },
    { code: 'Quote', kana: 'け', row: 'home' }, { code: 'Backslash', kana: 'む', row: 'home' },
    { code: 'KeyZ', kana: 'つ', row: 'bottom' }, { code: 'KeyX', kana: 'さ', row: 'bottom' },
    { code: 'KeyC', kana: 'そ', row: 'bottom' }, { code: 'KeyV', kana: 'ひ', row: 'bottom' },
    { code: 'KeyB', kana: 'こ', row: 'bottom' }, { code: 'KeyN', kana: 'み', row: 'bottom' },
    { code: 'KeyM', kana: 'も', row: 'bottom' }, { code: 'Comma', kana: 'ね', row: 'bottom' },
    { code: 'Period', kana: 'る', row: 'bottom' }, { code: 'Slash', kana: 'め', row: 'bottom' },
    { code: 'IntlRo', kana: 'ろ', row: 'bottom' },
  ];

  // Word lists. Each word is one prompt; the words are separated by spaces here.
  const words = (s) => s.split(' ');

  const ROMAJI_STAGES = [
    {
      id: 'basic', name: 'Basic kana',
      items: words('あ い う え お か き く け こ さ し す せ そ た ち つ て と な に ぬ ね の は ひ ふ へ ほ ま み む め も や ゆ よ ら り る れ ろ わ を ん'),
    },
    {
      id: 'voiced', name: 'Voiced, combined, long vowel',
      items: words('が ぎ ぐ げ ご ざ じ ず ぜ ぞ だ ぢ づ で ど ば び ぶ べ ぼ ぱ ぴ ぷ ぺ ぽ きゃ きゅ きょ ぎゃ ぎゅ ぎょ しゃ しゅ しょ じゃ じゅ じょ ちゃ ちゅ ちょ にゃ にゅ にょ ひゃ ひゅ ひょ びゃ びゅ びょ ぴゃ ぴゅ ぴょ みゃ みゅ みょ りゃ りゅ りょ ぁ ぃ ぅ ぇ ぉ ー'),
    },
    {
      id: 'words', name: 'Words',
      items: words('ねこ いぬ さかな すし てがみ がっこう きって ちょっと にほんご せんせい がくせい ひこうき でんわ ともだち りんご ぎゅうにゅう じどうしゃ ゆうびんきょく おちゃ ちゃわん しゃしん ぱそこん びょういん こうえん まど てんき ありがとう おはよう こんばんは らーめん きょうしつ とけい かばん さくら おにぎり みず ぎんこう'),
    },
    {
      id: 'phrases', name: 'Phrases',
      items: words('わたしはがくせいです きょうはいいてんきですね まいにちにほんごをべんきょうします らーめんがたべたいです ともだちとえいがをみにいきました ゆっくりはなしてください ちょっとまってください'),
    },
  ];

  const SYMBOL_STAGES = [
    { id: 'plain', name: 'Unshifted keys', items: SYMBOL_KEYS.filter((k) => !k.shift) },
    { id: 'shifted', name: 'Shifted keys', items: SYMBOL_KEYS.filter((k) => k.shift) },
    { id: 'all', name: 'All symbols', items: SYMBOL_KEYS },
  ];

  const KANA_STAGES = [
    { id: 'top', name: 'Number & Q row', items: KANA_KEYS.filter((k) => k.row === 'top') },
    { id: 'home', name: 'Home row (A)', items: KANA_KEYS.filter((k) => k.row === 'home') },
    { id: 'bottom', name: 'Bottom row (Z)', items: KANA_KEYS.filter((k) => k.row === 'bottom') },
    { id: 'all', name: 'All kana keys', items: KANA_KEYS },
  ];

  // The physical code of the key that types a character, for the keyboard display.
  function codeFor(ch) {
    if (/^[a-z]$/.test(ch)) return 'Key' + ch.toUpperCase();
    const k = SYMBOL_KEYS.find((s) => s.ch === ch);
    return k ? k.code : null;
  }

  const api = {
    tokenize, romajiHint, matchPrefix, isComplete, nextChars, codeFor,
    SYMBOL_KEYS, KANA_KEYS, ROMAJI_STAGES, SYMBOL_STAGES, KANA_STAGES,
  };

  root.TypingEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
