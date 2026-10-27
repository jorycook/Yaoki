// Checks the rules of Yaoki Typing (docs/typing/engine.js) without a browser.
// Run: node check/typing-engine-test.js
'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const E = require('../docs/typing/engine.js');

let failures = 0;
function test(name, fn) {
  try {
    fn();
    console.log('ok   ' + name);
  } catch (err) {
    failures++;
    console.log('FAIL ' + name + '\n     ' + err.message.split('\n').join('\n     '));
  }
}

const T = (w) => E.tokenize(w);
const accepts = (w, typed) => E.isComplete(T(w), typed);

// Typing `word` one key at a time must stay valid until the last key, and complete there.
function typeAll(word, typed) {
  const tokens = T(word);
  let s = '';
  for (const c of typed) {
    s += c;
    assert.ok(E.matchPrefix(tokens, s), `"${s}" should be a valid start for ${word}`);
  }
  return E.isComplete(tokens, s);
}

test('the hint is a spelling both IMEs accept', () => {
  const hints = {
    'がっこう': 'gakkou', 'にほんご': 'nihongo', 'ちょっと': 'chotto', 'しゃしん': 'shashinn',
    'ラーメン': 'ra-menn', 'こんにちは': 'konnnichiha', 'すみません、': 'sumimasenn,', 'まっちゃ': 'maccha',
    'パーティー': 'pa-thi-', 'ファイル': 'fairu', 'くぁ': 'qa', 'ふぅ': 'fuxu', 'ほんを': 'honwo', 'はなぢ': 'hanadi',
    'つづく': 'tsuduku', '「いいえ」': '[iie]', 'ヴァイオリン': 'vaiorinn',
  };
  for (const [w, hint] of Object.entries(hints)) assert.equal(E.spell(T(w)), hint, w);
});

test('spellings either IME accepts are taken', () => {
  const ok = [
    ['し', 'si'], ['し', 'ci'], ['ち', 'ti'], ['ふ', 'hu'], ['つ', 'tu'], ['じ', 'zi'], ['か', 'ca'], ['く', 'cu'], ['こ', 'co'], ['せ', 'ce'],
    ['しゃ', 'sya'], ['じゃ', 'zya'], ['じゃ', 'jya'], ['ちゃ', 'cya'], ['ちゃ', 'tya'], ['きゃ', 'kixya'], ['きゃ', 'kilya'],
    ['っ', 'xtu'], ['っ', 'ltsu'], ['ゎ', 'xwa'], ['ヶ', 'xke'], ['まっちゃ', 'matcha'], ['まっちゃ', 'maccha'], ['まっちゃ', 'mattya'],
    ['ほっと', 'hotto'], ['ほっと', 'hoxtsuto'], ['かんうぃ', 'kanwi'], ['すみません、', 'sumimasen,'], ['すみません、', 'sumimasenn,'],
    ['ふぁ', 'fa'], ['ふぁ', 'hwa'], ['てぃ', 'thi'], ["てぃ", "t'i"], ['でゅ', 'dhu'], ['うぃ', 'wi'], ['うぇ', 'we'], ['うぉ', 'who'],
    ['しぇ', 'she'], ['ちぇ', 'che'], ['じぇ', 'je'], ['いぇ', 'ye'], ['ゔぁ', 'va'], ['つぁ', 'tsa'], ['くぁ', 'kwa'], ['ぐぁ', 'gwa'],
    ['ぢゃ', 'dya'], ['ほんや', "hon'ya"], ['ほんや', 'honnya'], ['きんようび', 'kinnyoubi'], ['かんじ', 'kanji'], ['かんじ', 'kannji'],
    ['ほん', 'honn'], ['ほん', "hon'"], ['〜', '~'], ['～', '~'], ['・', '/'], ['ほんとうですか？', 'hontoudesuka?'], ['ほんとうですか?', 'hontoudesuka?'],
  ];
  for (const [w, typed] of ok) assert.equal(typeAll(w, typed), true, `${w} as ${typed}`);
});

test('spellings that would give other kana are refused', () => {
  const no = [
    ['を', 'o'], ['ぢ', 'ji'], ['ぢ', 'zi'], ['づ', 'zu'], ['っな', 'nna'], ['こんな', 'kona'], ['こんな', 'konna'],
    ['ほん', 'hon'], ['ほんや', 'honya'], ['せんえん', 'senen'], ['は', 'wa'], ['まっちゃ', 'mactya'], ['ちょっと', 'chocchi'],
  ];
  for (const [w, typed] of no) assert.equal(accepts(w, typed), false, `${w} must not take ${typed}`);
  assert.equal(E.matchPrefix(T('こんな'), 'kona'), false);
  assert.equal(E.matchPrefix(T('きって'), 'kitta'), false);
});

test('the game sees a refused spelling at its first wrong key', () => {
  // pressRomaji counts a miss when matchPrefix fails, so check that, not only isComplete.
  const firstWrong = [
    ['を', 'o'], ['ぢ', 'j'], ['ぢ', 'z'], ['づ', 'z'], ['っな', 'n'], ['こんな', 'kona'], ['ほん', 'hona'],
    ['ほんや', 'hony'], ['せんえん', 'sene'], ['は', 'w'], ['まっちゃ', 'mact'],
  ];
  for (const [w, typed] of firstWrong) {
    assert.equal(E.matchPrefix(T(w), typed), false, `${w}: ${typed} must be a miss`);
    assert.equal(E.matchPrefix(T(w), typed.slice(0, -1)), true, `${w}: ${typed.slice(0, -1)} is still a valid start`);
  }
});

test('hints are spellings both IMEs take, and Google-only spellings are still accepted', () => {
  assert.equal(E.spell(T('あっい')), 'axtui');
  assert.equal(E.spell(T('くゃ')), 'kuxya');
  assert.equal(E.spell(T('あっぁ')), 'axtuxa');
  for (const [w, typed] of [['とぁ', 'twa'], ['とぉ', 'two'], ['どぇ', 'dwe'], ['っっか', 'kkka'], ['あっぁ', 'axxa'], ['あっぁ', 'alla'], ['くゃ', 'qya']]) {
    assert.equal(typeAll(w, typed), true, `${w} as ${typed}`);
  }
});

test('units() and unitAt() put a miss on the kana it belongs to', () => {
  assert.deepEqual(E.units(T('がっこう')), ['が', 'っ', 'こ', 'う']);
  assert.deepEqual(E.units(T('こんばんは')), ['こ', 'ん', 'ば', 'ん', 'は']);
  const at = (w, typed) => E.units(T(w))[E.unitAt(T(w), typed)];
  assert.equal(at('がっこう', 'ga'), 'っ');
  assert.equal(at('がっこう', 'gakk'), 'こ');
  assert.equal(at('こんばんは', 'konbann'), 'は');
  assert.equal(at('きんようび', 'kinn'), 'よ');
  assert.equal(E.unitAt(T('ねこ'), 'na'), null);
});

test('blame() puts the classic ん and っ slips on ん and っ', () => {
  const b = (w, typed, key) => E.units(T(w))[E.blame(T(w), typed, key)];
  assert.equal(b('こんにちは', 'konn', 'i'), 'ん');
  assert.equal(b('おんな', 'onn', 'a'), 'ん');
  assert.equal(b('こんな', 'kon', 'a'), 'ん');
  assert.equal(b('きって', 'kit', 'e'), 'っ');
  assert.equal(b('がっこう', 'gak', 'o'), 'っ');
  assert.equal(b('いっしょ', 'is', 'h'), 'っ');
  assert.equal(b('きって', 'kitt', 'a'), 'て');
  assert.equal(b('せんせい', 'senn', 'd'), 'せ');
  // also when ん or っ sits inside a longer joined token
  assert.equal(b('ほんっと', 'hont', 'o'), 'っ');
  assert.equal(b('あっっか', 'akk', 'a'), 'っ');
  assert.equal(b('あっんな', 'axtunn', 'a'), 'ん');
});

test('runs of っ stay small, and their hint is one both IMEs take', () => {
  assert.equal(E.spell(T('あっっわ')), 'axtuwwa');
  assert.equal(typeAll('っっか', 'kkka'), true);
  const started = Date.now();
  const tokens = T('あ' + 'っ'.repeat(8) + 'か');
  assert.ok(Date.now() - started < 200, 'tokenize took ' + (Date.now() - started) + ' ms');
  assert.ok(tokens.every((t) => t.opts.length <= 7000));
  // up to five っ in a row, every spelling either IME takes is still accepted
  for (const [w, typed] of [['あっっっっか', 'axtuxtuxtuxtuka'], ['あっっっっか', 'altultultultuka'], ['あっっっっっか', 'axtukkkkka'], ['あっっっちゃ', 'altucccha'], ['あっっしぇ', 'altsultsushe']]) {
    assert.equal(typeAll(w, typed), true, `${w} as ${typed}`);
  }
});

test('nextChars() lights the right keys around っ and ん', () => {
  assert.deepEqual([...E.nextChars(T('きって'), 'ki')].sort(), ['l', 't', 'x']);
  assert.deepEqual([...E.nextChars(T('かんじ'), 'kan')].sort(), ["'", 'j', 'n', 'z']);
});

test('spell() goes on from the spelling actually typed', () => {
  assert.equal(E.spell(T('しゃしん'), 'sy'), 'syashinn');
  assert.equal(E.spell(T('こんばんは'), 'kon'), 'konbanha');
  assert.equal(E.spell(T('ちょっと'), 'ty'), 'tyotto');
  assert.equal(E.spell(T('ねこ'), 'na'), null);
});

test('choices() and at() name the kana being typed', () => {
  assert.deepEqual(E.choices(T('しゃしん'), 'sha').slice(0, 3), ['shi', 'si', 'ci']);
  assert.deepEqual(E.at(T('しゃしん'), 'shas'), { index: 1, start: 3 });
  assert.deepEqual([...E.nextChars(T('し'), 's')].sort(), ['h', 'i']);
  assert.deepEqual([...E.nextChars(T('ちゃ'), '')].sort(), ['c', 't']);
});

test('why() explains the usual learner slips', () => {
  assert.match(E.why(T('ほんを'), 'hon', 'o'), /wo/);
  assert.match(E.why(T('を'), '', 'o'), /wo/);
  assert.match(E.why(T('はなぢ'), 'hana', 'j'), /di/);
  assert.match(E.why(T('つづく'), 'tsu', 'z'), /du/);
  assert.match(E.why(T('こんな'), 'kon', 'a'), /nn/);
  assert.match(E.why(T('は'), '', 'w'), /ha/);
  assert.match(E.why(T('っな'), '', 'n'), /xtu/);
  assert.equal(E.why(T('ねこ'), 'ne', 'x'), null);
  // a correct nn is never blamed, and the kana after ん get their own notes
  assert.equal(E.why(T('せんせい'), 'senn', 'd'), null);
  assert.match(E.why(T('ほんを'), 'honn', 'o'), /を = wo/);
  assert.match(E.why(T('こんばんは'), 'konban', 'w'), /は = ha/);
  assert.match(E.why(T('こんばんは'), 'konbann', 'w'), /は = ha/);
  assert.match(E.why(T('かんづめ'), 'kan', 'z'), /du/);
  assert.match(E.why(T('ほん'), 'hon', 'x'), /end/);
  // the な行 note only before な行
  assert.equal(E.why(T('きって'), 'ki', 'n'), null);
  assert.equal(E.why(T('がっこう'), 'gakk', 'a'), null);
  // one n too few before な行, and no ん note before a consonant kana
  assert.match(E.why(T('こんにちは'), 'konn', 'i'), /konnnichiha/);
  assert.equal(E.why(T('せんせい'), 'sen', 'a'), null);
  assert.equal(E.why(T('でんわ'), 'den', 'a'), null);
  // ほんを spells honwo: a lone n is right there, so no nn note
  assert.equal(E.why(T('ほんを'), 'hon', 'a'), null);
});

test('every built-in prompt types out by its hint', () => {
  for (const stage of E.KANA_STAGES) {
    for (const it of stage.items) {
      const hint = E.spell(T(it.text));
      assert.ok(hint, `${stage.id}: ${it.text} has a hint`);
      assert.equal(typeAll(it.text, hint), true, `${stage.id}: ${it.text} typed as ${hint}`);
    }
  }
});

test('every course word (N5 to N2) types out by its hint', () => {
  global.window = {};
  let n = 0;
  for (const lv of ['n5', 'n4', 'n3', 'n2']) {
    require(path.join(__dirname, '..', 'docs', 'assets', 'course-' + lv + '.js'));
    for (const u of window.__ykCourses[lv.toUpperCase()].units) {
      for (const d of u.days || []) {
        for (const w of (d.scene && d.scene.words) || []) {
          const hint = E.spell(T(w.reading));
          assert.equal(typeAll(w.reading, hint), true, `${lv} ${w.word} (${w.reading}) typed as ${hint}`);
          n++;
        }
      }
    }
  }
  delete global.window;
  assert.ok(n > 1400, 'course words found: ' + n);
});

test('JIS tables: unique keys, no untypable backslash card, punctuation on its keys', () => {
  const combos = E.SYMBOL_KEYS.map((k) => k.code + (k.shift ? '+' : ''));
  assert.equal(new Set(combos).size, combos.length);
  assert.ok(!E.SYMBOL_KEYS.some((k) => k.ch === '\\'), 'the \\ card cannot be typed on a Mac JIS keyboard');
  const punct = Object.fromEntries(E.PUNCT_KEYS.map((k) => [k.ch, k.code + (k.shift ? '+' : '')]));
  assert.deepEqual(punct, { '、': 'Comma', '。': 'Period', '・': 'Slash', '「': 'BracketRight', '」': 'Backslash', 'ー': 'Minus', '〜': 'Equal+', '！': 'Digit1+', '？': 'Slash+' });
  const kana = E.KANA_KEYS.concat(E.KANA_SHIFT_KEYS).map((k) => k.code + (k.shift ? '+' : ''));
  assert.equal(new Set(kana).size, kana.length);
  const on = Object.fromEntries(E.KANA_KEYS.map((k) => [k.code, k.kana]));
  assert.equal(on.BracketLeft, '゛');
  assert.equal(on.BracketRight, '゜');
  assert.equal(on.Backslash, 'む');
  assert.equal(on.IntlRo, 'ろ');
  assert.equal(on.IntlYen, 'ー');
  const shifted = Object.fromEntries(E.KANA_SHIFT_KEYS.map((k) => [k.kana, k.code]));
  assert.equal(shifted['を'], 'Digit0');
  assert.equal(shifted['っ'], 'KeyZ');
  assert.equal(shifted['ぃ'], 'KeyE');
});

test('keys, fingers and rows', () => {
  assert.deepEqual(E.keyFor('k'), { code: 'KeyK', shift: false });
  assert.deepEqual(E.keyFor("'"), { code: 'Digit7', shift: true });
  assert.deepEqual(E.keyFor('-'), { code: 'Minus', shift: false });
  assert.equal(E.fingerFor('KeyJ')[1], 'right index finger');
  assert.equal(E.fingerFor('KeyA')[1], 'left little finger');
  for (const k of E.KANA_KEYS) assert.ok(E.fingerFor(k.code), 'finger for ' + k.code);
  assert.equal(E.rowOf('KeyA'), 'home');
  assert.equal(E.rowOf('Backslash'), 'home');
  assert.equal(E.rowOf('BracketLeft'), 'top');
  assert.equal(E.rowOf('IntlYen'), 'number');
  assert.equal(E.rowOf('IntlRo'), 'bottom');
});

if (failures) {
  console.log(`\n${failures} failed`);
  process.exit(1);
}
console.log('\nall typing engine checks passed');
