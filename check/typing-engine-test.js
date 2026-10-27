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
