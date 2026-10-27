// Checks the rules of Kana Runner (docs/typing/engine.js) without a browser.
// Run: node check/typing-engine-test.js
'use strict';

const assert = require('node:assert/strict');
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

// Typing `word` one key at a time must stay valid until the last key, and complete there.
function typeAll(word, typed) {
  const tokens = E.tokenize(word);
  let s = '';
  for (const c of typed) {
    s += c;
    assert.ok(E.matchPrefix(tokens, s), `"${s}" should be a prefix for ${word}`);
  }
  return E.isComplete(tokens, s);
}

test('hint shows the first spelling of each kana', () => {
  assert.equal(E.romajiHint(E.tokenize('がっこう')), 'gakkou');
  assert.equal(E.romajiHint(E.tokenize('にほんご')), 'nihongo');
  assert.equal(E.romajiHint(E.tokenize('ちょっと')), 'chotto');
  assert.equal(E.romajiHint(E.tokenize('しゃしん')), 'shashin');
  assert.equal(E.romajiHint(E.tokenize('らーめん')), 'ra-men');
});

test('alternative spellings are accepted in full', () => {
  assert.equal(typeAll('し', 'si'), true);
  assert.equal(typeAll('し', 'shi'), true);
  assert.equal(typeAll('ち', 'ti'), true);
  assert.equal(typeAll('ふ', 'hu'), true);
  assert.equal(typeAll('を', 'o'), true);
  assert.equal(typeAll('しゃ', 'sya'), true);
  assert.equal(typeAll('じゃ', 'zya'), true);
});

test('sokuon doubles the next consonant, and ch takes t or c', () => {
  assert.equal(typeAll('がっこう', 'gakkou'), true);
  assert.equal(typeAll('ちょっと', 'chotto'), true);
  assert.equal(E.isComplete(E.tokenize('ちょっと'), 'chocchi'), false);
  const tokens = E.tokenize('きって');
  assert.equal(E.isComplete(tokens, 'kitte'), true);
  assert.equal(E.isComplete(tokens, 'kitt'), false);
  assert.equal(E.matchPrefix(tokens, 'kitta'), false);
  assert.equal(E.isComplete(E.tokenize('さっか'), 'sakka'), true);
});

test('ん needs nn or n\' before a vowel or y', () => {
  assert.equal(E.isComplete(E.tokenize('ほん'), 'hon'), true);
  assert.equal(E.isComplete(E.tokenize('ほん'), 'honn'), true);
  assert.equal(E.isComplete(E.tokenize('ほんや'), "hon'ya"), true);
  assert.equal(E.isComplete(E.tokenize('ほんや'), 'honnya'), true);
  assert.equal(E.matchPrefix(E.tokenize('ほんや'), 'honya'), false);
  assert.equal(E.isComplete(E.tokenize('にほんご'), 'nihongo'), true);
  assert.equal(E.isComplete(E.tokenize('にほんご'), 'nihonngo'), true);
  assert.equal(E.isComplete(E.tokenize('せんせい'), 'sensei'), true);
});

test('a wrong key is not a prefix; a right key is', () => {
  const t = E.tokenize('ねこ');
  assert.equal(E.matchPrefix(t, 'n'), true);
  assert.equal(E.matchPrefix(t, 'ne'), true);
  assert.equal(E.matchPrefix(t, 'na'), false);
  assert.equal(E.matchPrefix(t, 'neko'), true);
  assert.equal(E.isComplete(t, 'neko'), true);
  assert.equal(E.matchPrefix(t, 'nekoo'), false);
});

test('nextChars lists the keys that may come next', () => {
  const t = E.tokenize('し');
  assert.deepEqual([...E.nextChars(t, '')].sort(), ['s']);
  assert.deepEqual([...E.nextChars(t, 's')].sort(), ['h', 'i']);
  const c = E.tokenize('ちゃ');
  assert.deepEqual([...E.nextChars(c, '')].sort(), ['c', 't']);
});

test('every word in every romaji stage tokenizes and types out in full', () => {
  for (const stage of E.ROMAJI_STAGES) {
    for (const w of stage.items) {
      const hint = E.romajiHint(E.tokenize(w));
      assert.equal(typeAll(w, hint), true, `${stage.id}: ${w} typed as ${hint}`);
    }
  }
});

test('symbol keys: shifted and unshifted lists are split correctly', () => {
  const shifted = E.SYMBOL_KEYS.filter((k) => k.shift).map((k) => k.ch);
  assert.ok(shifted.includes('"') && shifted.includes('&') && shifted.includes('+'));
  assert.ok(!shifted.includes('@') && !shifted.includes('['));
  const plain = E.SYMBOL_KEYS.filter((k) => !k.shift).map((k) => k.ch);
  assert.ok(plain.includes('@') && plain.includes('[') && plain.includes(']'));
});

test('each symbol and kana key has a unique code and character', () => {
  const chars = E.SYMBOL_KEYS.map((k) => k.ch);
  assert.equal(new Set(chars).size, chars.length);
  const combos = E.SYMBOL_KEYS.map((k) => k.code + (k.shift ? '+' : ''));
  assert.equal(new Set(combos).size, combos.length);
  const codes = E.KANA_KEYS.map((k) => k.code);
  assert.equal(new Set(codes).size, codes.length);
});

test('codeFor finds letters and symbols', () => {
  assert.equal(E.codeFor('k'), 'KeyK');
  assert.equal(E.codeFor('-'), 'Minus');
  assert.equal(E.codeFor("'"), 'Digit7');
  assert.equal(E.codeFor('?'), 'Slash');
});

if (failures) {
  console.log(`\n${failures} failed`);
  process.exit(1);
}
console.log('\nall typing engine checks passed');
