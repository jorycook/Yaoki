// Checks how Yaoki Speaking (docs/speaking/voice.js) reads what a phone's speech recognition heard, without a browser.
// Run: node check/speaking-engine-test.js
'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
require('../docs/speaking/readings.js');
const V = require('../docs/speaking/voice.js');
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

const card = (text, reading) => V.prepare(reading ? { text, reading } : { text });
const takes = (text, reading, heard) => V.check(card(text, reading), heard).ok;
const kata = (s) => s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));

test('what was heard is compared without punctuation, as hiragana, with ー as its vowel', () => {
  assert.equal(V.normalize('ラーメン、ください。'), 'らあめんください');
  assert.equal(V.normalize(' ﾈｺ です! '), 'ねこです');
  assert.equal(V.normalize('ＡＢＣ'), 'abc');
  assert.equal(V.normalize('ヴァイオリン'), 'ばいおりん');
  assert.equal(V.normalize('1,000円'), '1000円');
});

test('a word written in kanji is read back into kana', () => {
  const ok = [
    ['ねこ', '猫'], ['ねこ', 'ネコ'], ['いぬ', '犬'], ['さかな', '魚'], ['すし', '寿司'], ['がっこう', '学校'], ['きって', '切手'],
    ['でんしゃ', '電車'], ['ともだち', '友達'], ['ひこうき', '飛行機'], ['びょういん', '病院'], ['ゆうびんきょく', '郵便局'],
    ['はなぢ', '鼻血'], ['ほんを', '本を'], ['ほんだな', '本棚'], ['ひとびと', '人々'], ['ときどき', '時々'], ['こんにちは', '今日は'],
    ['ありがとうございます', '有難うございます'], ['いただきます', '頂きます'], ['ごちそうさまでした', 'ご馳走様でした'],
    ['おかえりなさい', 'お帰りなさい'], ['よろしくおねがいします', '宜しくお願いします'], ['おにいさん', 'お兄さん'], ['おとな', '大人'],
    ['きのう', '昨日'], ['あした', '明日'], ['けしき', '景色'], ['めがね', '眼鏡'], ['くだもの', '果物'], ['へや', '部屋'],
    ['たべる', '食べる'], ['たべました', '食べました'], ['いきます', '行きます'], ['さんかげつ', '三ヶ月'], ['しかる', '叱る'],
  ];
  for (const [text, heard] of ok) assert.equal(takes(text, null, heard), true, text + ' ← ' + heard);
});

test('a kanji heard on its own is read as a word (火 is ひ)', () => {
  for (const [text, heard] of [['き', '木'], ['き', '気'], ['か', '蚊'], ['ひ', '火'], ['て', '手'], ['め', '目'], ['え', '絵'], ['お', '尾'], ['ず', '図'], ['ね', '根']]) {
    assert.equal(takes(text, null, heard), true, text + ' ← ' + heard);
  }
  for (const [text, heard] of [['か', '火'], ['か', '日'], ['つき', '机'], ['し', '上']]) assert.equal(takes(text, null, heard), false, text + ' ← ' + heard);
});

test('a word that is all that was heard is read only as itself', () => {
  // 作家 is さっか; its kanji read one by one could make さか (坂)
  for (const [text, heard] of [['さか', '作家'], ['かんけい', '環境'], ['きけん', '期間'], ['ひょうか', '平日'], ['いく', '入口'], ['ようじ', '用紙']]) {
    assert.equal(takes(text, null, heard), false, text + ' ← ' + heard);
  }
  for (const [text, heard] of [['さっか', '作家'], ['かんきょう', '環境'], ['いりぐち', '入口'], ['にほん', '日本'], ['にっぽん', '日本']]) {
    assert.equal(takes(text, null, heard), true, text + ' ← ' + heard);
  }
  assert.match((V.check(card('きて'), '切手').note || {}).en, /No small っ/, 'a slip inside the word is named');
});

test('…and so is one with a filler before it, or です or a particle after it', () => {
  // お婆さん read kanji by kanji makes おばさん; 主食 しゅしょく must not pass for 就職 しゅうしょく
  for (const [text, reading, heard] of [['おばさん', null, 'お婆さんです'], ['おじさん', null, 'お祖父さんが'], ['就職', 'しゅうしょく', '主食です'],
    ['関係', 'かんけい', '環境です'], ['関係', 'かんけい', 'えっと環境'], ['危険', 'きけん', '機嫌です'], ['さか', null, '作家です']]) {
    assert.equal(takes(text, reading, heard), false, text + ' ← ' + heard);
  }
  for (const [text, reading, heard] of [['おばあさん', null, 'お婆さんです'], ['かんきょう', null, '環境です'], ['関係', 'かんけい', '関係です'],
    ['さっか', null, '作家が'], ['おにいさん', null, 'お兄さんが'], ['ねこ', null, 'ねこです'], ['きけん', null, '危険です']]) {
    assert.equal(takes(text, reading, heard), true, text + ' ← ' + heard);
  }
});

test('a single sound drawn out or said twice is taken when the phone writes it as the word it sounds like', () => {
  for (const [text, heard] of [['きょ', '今日'], ['きゅ', '9'], ['じゅ', '10'], ['み', '耳'], ['ち', '父'], ['は', '母'], ['も', '桃']]) {
    assert.equal(takes(text, null, heard), true, text + ' ← ' + heard);
  }
  for (const [text, heard] of [['か', '火'], ['きゃ', '今日'], ['しょ', '今日']]) assert.equal(takes(text, null, heard), false, text + ' ← ' + heard);
});

test('a card inside what was heard does not end with its last sound drawn out at the end (サッカー is not さっか)', () => {
  for (const [text, heard] of [['さっか', 'サッカー'], ['とおり', 'ストーリー'], ['れっしゃ', 'プレッシャー'], ['さかな', 'さかなー']]) {
    assert.equal(takes(text, null, heard), false, text + ' ← ' + heard);
  }
  for (const [text, heard] of [['さっか', '作家'], ['さくら', '桜がきれい'], ['さっか', 'さっかです'], ['コーヒー', 'コーヒーショップ'], ['ちょっと', 'ちょっとお願いします'],
    ['でんわ', '電話ある'], ['せんせい', '先生いいですか']]) {
    assert.equal(takes(text, null, heard), true, text + ' ← ' + heard);
  }
});

test('digits are read as numbers, with counters as they are said', () => {
  assert.equal(V.numerals('25'), '二十五');
  assert.equal(V.numerals('1000'), '千');
  assert.equal(V.numerals('2026'), '二千二十六');
  assert.equal(V.numerals('10000'), '一万');
  assert.equal(V.numerals('0120'), '〇一二〇');
  const ok = [
    ['に', '2'], ['じゅう', '10'], ['にじゅうご', '25'], ['ひとり', '1人'], ['ふたり', '2人'], ['さんにん', '3人'], ['いっぽん', '1本'],
    ['にほん', '2本'], ['さんぼん', '3本'], ['ろっぽん', '6本'], ['いっぱい', '1杯'], ['さんばい', '3杯'], ['はっぴゃく', '800'],
    ['ろっぴゃくえん', '600円'], ['さんぜん', '3000'], ['ろくじ', '6時'], ['じゅうじ', '10時'], ['ついたち', '1日'], ['はたち', '20歳'],
    ['まいあさろくじにおきます', '毎朝6時に起きます'], ['ぜろ', '0'],
  ];
  for (const [text, heard] of ok) assert.equal(takes(text, null, heard), true, text + ' ← ' + heard);
  assert.equal(takes('ろっぴゃくえん', null, '300円'), false, 'a wrong number is a wrong number');
});

test('letters by their names, and romaji as kana', () => {
  for (const [text, heard] of [['あ', 'a'], ['えー', 'A'], ['びー', 'B'], ['てぃーしゃつ', 'Tシャツ'], ['ねこ', 'Neko'], ['すし', 'sushi'], ['がっこう', 'gakkou']]) {
    assert.equal(takes(text, null, heard), true, text + ' ← ' + heard);
  }
});

test('kana are compared by sound: を お, ぢ じ, づ ず, long vowels however written', () => {
  const ok = [
    ['を', 'お'], ['ぢ', 'じ'], ['づ', 'ず'], ['ほんを', 'ほんお'], ['とうきょう', 'トーキョー'], ['とうきょう', '東京'], ['せんせい', 'センセー'],
    ['コーヒー', 'こうひい'], ['ラーメン', 'らあめん'], ['ヴァイオリン', 'バイオリン'], ['こんにちは', 'こんにちわ'], ['こんばんは', 'こんばんわ'],
  ];
  for (const [text, heard] of ok) assert.equal(takes(text, null, heard), true, text + ' ← ' + heard);
});

test('a small っ, a long vowel, ゃゅょ and ゛ count', () => {
  const no = [
    ['きって', '来て'], ['きて', '切手'], ['おばあさん', 'おばさん'], ['おばさん', 'おばあさん'], ['おじいさん', 'おじさん'], ['びょういん', '美容院'],
    ['びよういん', '病院'], ['ゆき', '勇気'], ['ゆうき', '雪'], ['とり', '通り'], ['とおり', '鳥'], ['おと', '夫'], ['さか', '作家'], ['ここ', '高校'],
    ['いえ', 'いいえ'], ['ビール', 'ビル'], ['きょう', '器用'], ['じゆう', '10'], ['かぎ', '柿'], ['がっこう', '学生'],
  ];
  for (const [text, heard] of no) assert.equal(takes(text, null, heard), false, text + ' ← ' + heard);
});

test('a near miss is named: っ, a long or short vowel, ゃゅょ, ゛', () => {
  const note = (text, heard) => (V.check(card(text), heard).note || {}).en || '';
  assert.match(note('きって', '来て'), /Small っ/);
  assert.match(note('きて', '切手'), /No small っ/);
  assert.match(note('おばあさん', 'おばさん'), /long sound/);
  assert.match(note('おばさん', 'おばあさん'), /short sound/);
  assert.match(note('びょういん', '美容院'), /Small ょ/);
  assert.match(note('びよういん', '病院'), /full-size よ/);
  assert.match(note('かぎ', '柿'), /ぎ, not き: with ゛/);
  assert.equal(note('ねこ', '犬'), '', 'nothing is said about a different word');
  assert.equal(V.check(card('きって'), '来て').said, 'きて', 'what was heard is shown as kana');
});

test('a card of one or two kana must be all that was heard', () => {
  for (const [text, heard] of [['あ', 'ありがとう'], ['ね', '猫'], ['ねこ', '猫ちゃん'], ['か', 'かさ'], ['いく', '行こう']]) {
    assert.equal(takes(text, null, heard), false, text + ' ← ' + heard);
  }
  // …though a single sound may be drawn out or said twice, and a word may have です after it
  for (const [text, heard] of [['あ', 'ああ'], ['き', 'キー'], ['お', 'おう'], ['き', 'きき'], ['ねこ', '猫です'], ['ねこ', 'えっと猫'], ['ねこ', 'ねこねこ']]) {
    assert.equal(takes(text, null, heard), true, text + ' ← ' + heard);
  }
});

test('a longer card may be inside what was heard, at the edge of a word', () => {
  assert.equal(takes('がっこう', null, '学校に行きます'), true);
  assert.equal(takes('学校', 'がっこう', 'えっと学校です'), true);
  assert.equal(takes('百円', 'ひゃくえん', '三百円'), false, 'not from inside a run of kanji');
  assert.equal(takes('三時', 'さんじ', '三時半'), false);
  assert.equal(takes('今日', 'きょう', '東京'), false);
  assert.equal(takes('電車', 'でんしゃ', '自転車'), false, 'a card never starts on a voiced sound of a kanji inside a word');
  assert.equal(takes('日本語', 'にほんご', '毎日日本語を勉強します'), false, 'a short card inside kanji pays for it');
  assert.equal(takes('まいにち、にほんごをべんきょうします。', null, '毎日日本語を勉強します'), true);
});

test('a long card forgives a sound: one from 10 kana, two from 16', () => {
  assert.equal(takes('きょうはいいてんきですね。', null, '今日はいい天気ですよ'), true);
  assert.equal(takes('きょうはいいてんきですね。', null, '今日はいい天気だよ'), false);
  assert.equal(takes('ありがとうございます', null, 'ありがとうございました'), true);
  assert.equal(takes('このたけがきにたけたてかけたのはたけたてかけたかったから', null, 'この竹垣に竹立て掛けたのは竹立て掛けたかったか'), true);
  assert.equal(takes('おはようございます', null, 'おはようございました'), false, 'nine kana: nothing forgiven');
});

test('the card being said fills as it is heard', () => {
  const t = card('ありがとうございます');
  assert.equal(V.check(t, 'ありが').fill, 3);
  assert.equal(V.check(t, 'ありがとう').fill, 5);
  assert.equal(V.check(t, 'えっとありがとう').fill, 5);
  assert.equal(V.check(t, '有難うござい').fill, 8);
  assert.equal(V.check(t, 'ありがとうございます').fill, t.len);
  const d = card('学校', 'がっこう');
  assert.equal(V.check(d, 'がっ').fill, 2);
  assert.deepEqual(d.end, [0, 1, 2, 3]);
  assert.deepEqual(card('ラーメン').end, [0, 1, 2, 3], 'ー is a sound of its own');
});

test('the best of a recognition\'s alternatives counts', () => {
  const t = card('はし');
  const r = V.best(t, ['八', '箸', '橋']);
  assert.equal(r.ok, true);
  assert.equal(r.text, '箸');
  assert.equal(V.best(t, ['八', '星']).ok, false);
});

test('romaji as a guide to the sounds (Hepburn, macrons for long vowels)', () => {
  const hep = {
    'がっこう': 'gakkō', 'こんにちは': 'konnichiwa', 'ほんを': 'hon o', 'おばあさん': 'obāsan', 'おじいさん': 'ojiisan', 'きょう': 'kyō',
    'ビール': 'bīru', 'コーヒー': 'kōhī', 'まっちゃ': 'matcha', 'ほんや': "hon'ya", 'せんせい': 'sensei', 'きんようび': "kin'yōbi",
    'ぎゅうにゅう': 'gyūnyū', 'パーティー': 'pātī', 'ヴァイオリン': 'vaiorin', 'ティッシュ': 'tisshu', 'かわいい': 'kawaii', 'いいえ': 'iie',
    'しゃしん': 'shashin', 'はなぢ': 'hanaji', 'つづく': 'tsuzuku', 'ちょっと': 'chotto', 'ふじさん': 'fujisan', 'せんえん': "sen'en",
  };
  for (const [k, r] of Object.entries(hep)) assert.equal(V.hepburn(k), r, k);
});

// The game's stages: Yaoki Typing's kana and kanji lists, and its own.
const STAGES = [
  ...E.KANA_STAGES.map((s) => ({ name: 'kana:' + s.id, items: s.items })),
  ...E.KANJI_STAGES.map((s) => ({ name: 'kanji:' + s.id, items: s.items })),
  ...Object.values(V.STAGES).map((s) => ({ name: 'speaking:' + s.id, items: s.items })),
];

test('every card of every stage is taken as written, as read, and in katakana', () => {
  let n = 0;
  for (const st of STAGES) {
    for (const it of st.items) {
      const t = V.prepare(it);
      const reading = it.reading || it.text;
      for (const heard of [it.text, reading, kata(reading)]) {
        assert.equal(V.check(t, heard).ok, true, st.name + ' ' + it.text + ' ← ' + heard);
      }
      assert.ok(t.romaji && /^[a-zāīūēō' ,.!?"-]+$/.test(t.romaji), st.name + ' ' + it.text + ' romaji ' + t.romaji);
      n++;
    }
  }
  assert.ok(n > 400, 'cards: ' + n);
});

test('every phrase has its romaji written out (particles cannot be told from kana)', () => {
  const phrases = ['kana:phrases', 'kanji:sentences', 'speaking:greet', 'speaking:twister'];
  for (const st of STAGES.filter((x) => phrases.includes(x.name))) {
    for (const it of st.items) {
      const key = V.prepare(it);
      assert.ok(it.romaji || Object.values(V.PHRASE_ROMAJI).includes(key.romaji), st.name + ' ' + it.text + ' has no romaji written out');
    }
  }
});

// Cards of a stage that may take each other: the same sound written two ways, and a word that is also read as
// another card (上 on its own may be かみ).
const SAME_SOUND = new Set(['お|を', 'を|お', 'じ|ぢ', 'ぢ|じ', 'ず|づ', 'づ|ず', 'オ|ヲ', 'ヲ|オ']);
const KNOWN = new Set(['紙|上']);

test('no card of a stage takes another card of the stage, written or read', () => {
  const clashes = [];
  const known = new Set();
  for (const st of STAGES) {
    const cards = st.items.map((it) => ({ it, t: V.prepare(it) }));
    for (const a of cards) {
      for (const b of cards) {
        if (a === b || SAME_SOUND.has(a.it.text + '|' + b.it.text)) continue;
        if (KNOWN.has(a.it.text + '|' + b.it.text)) {
          if (V.check(a.t, b.it.text).ok) known.add(a.it.text + '|' + b.it.text);
          continue;
        }
        // a card's reading heard in kana inside another's (きょう in べんきょう) cannot be told apart: only kanji count there
        const read = (b.it.reading || b.it.text);
        const inside = V.normalize(read).includes(V.normalize(a.it.reading || a.it.text));
        for (const heard of inside ? [b.it.text] : [b.it.text, read]) {
          if (heard === read && inside) continue;
          if (V.check(a.t, heard).ok) clashes.push(st.name + ' ' + a.it.text + ' takes ' + heard);
        }
      }
    }
  }
  assert.deepEqual(clashes, []);
  assert.deepEqual([...KNOWN].filter((k) => !known.has(k)), [], 'known clashes that no longer happen: take them off the list');
});

test('each card of the long-sound and small-っ pairs refuses its pair', () => {
  const items = V.STAGES.pairs.items;
  for (let i = 0; i < items.length; i += 2) {
    const [a, b] = [items[i], items[i + 1]];
    assert.equal(V.check(V.prepare(a), b.text).ok, false, a.text + ' ← ' + b.text);
    assert.equal(V.check(V.prepare(b), a.text).ok, false, b.text + ' ← ' + a.text);
  }
});

test('every course word (N5 to N2) is taken as written and as read, and few take another word of their week', () => {
  global.window = {};
  let n = 0;
  const clashes = [];
  for (const lv of ['n5', 'n4', 'n3', 'n2']) {
    require(path.join(__dirname, '..', 'docs', 'assets', 'course-' + lv + '.js'));
    for (const u of window.__ykCourses[lv.toUpperCase()].units) {
      const seen = new Set();
      const words = [];
      for (const d of u.days || []) {
        for (const w of (d.scene && d.scene.words) || []) {
          if (!seen.has(w.word + '|' + w.reading)) {
            seen.add(w.word + '|' + w.reading);
            words.push(w);
          }
        }
      }
      V.addWords(words.map((w) => ({ text: w.word, reading: w.reading })));
      const cards = words.map((w) => ({ w, t: V.prepare({ text: w.word, reading: w.reading }) }));
      for (const { w, t } of cards) {
        for (const heard of [w.word, w.reading, kata(w.reading)]) assert.equal(V.check(t, heard).ok, true, `${lv} ${w.word} (${w.reading}) ← ${heard}`);
        n++;
      }
      for (const a of cards) {
        for (const b of cards) {
          if (a !== b && a.w.reading !== b.w.reading && V.check(a.t, b.w.word).ok) clashes.push(`${lv} week ${u.n}: ${a.w.word} takes ${b.w.word}`);
        }
      }
    }
  }
  delete global.window;
  assert.ok(n > 1300, 'course words found: ' + n);
  console.log('     ' + clashes.length + ' of ' + n + ' words take another of their week' + (clashes.length ? ': ' + clashes.join('; ') : ''));
  assert.ok(clashes.length <= n / 200, 'too many: ' + clashes.join('; '));
});

test('the first steps: each lesson\'s words are made of kana taught so far, and each kana and word is taken said', () => {
  const L = require('../docs/speaking/lessons.js');
  assert.deepEqual(L.SCRIPTS.map((s) => s.id + ':' + s.lessons.length), ['hiragana:13', 'katakana:13']);
  const seen = new Set();
  for (const sc of L.SCRIPTS) {
    // what a lesson may use: its script's kana so far (a small ゃ as itself too), its marks, and ー only once taught
    const taught = new Set();
    for (const l of sc.lessons) {
      assert.ok(l.kana.length > 0 && /^[hk]\d+$/.test(l.id) && !seen.has(l.id), 'lesson ' + l.id);
      seen.add(l.id);
      for (const k of l.kana) {
        for (const ch of k) taught.add(ch);
        const t = card(k);
        assert.equal(V.check(t, k).ok, true, `${l.id} ${k} said`);
        assert.ok(V.hepburn(k) && /^[a-z]+$/.test(V.hepburn(k)), `${l.id} ${k} has its sound in letters: ${V.hepburn(k)}`);
      }
      for (const m of l.marks || []) taught.add(m);
      for (const w of l.words) {
        const left = Array.from(w.text).filter((ch) => !taught.has(ch));
        assert.deepEqual(left, [], `${l.id} ${w.text} (${w.gloss}) uses kana not yet taught`);
        assert.ok(w.gloss, `${l.id} ${w.text} has its meaning`);
        const t = card(w.text);
        assert.equal(V.check(t, w.text).ok, true, `${l.id} ${w.text} said`);
        if (w.kanji) assert.equal(V.check(t, w.kanji).ok, true, `${l.id} ${w.text} heard as ${w.kanji}`);
      }
    }
    assert.equal(L.all(sc.id).length, sc.lessons.reduce((n, l) => n + l.kana.length, 0));
  }
  // ん said on its own is heard with the start of a vowel before it
  for (const heard of ['うん', 'ううん', 'うーん', 'ウン']) assert.equal(takes('ん', '', heard), true, 'ん ← ' + heard);
  assert.equal(takes('う', '', 'うん'), false, 'う ← うん');
  // every basic kana of each script is in its lessons
  const base = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん';
  assert.deepEqual(Array.from(base).filter((ch) => !L.all('hiragana').includes(ch)), []);
  assert.deepEqual(Array.from(kata(base)).filter((ch) => !L.all('katakana').includes(ch)), []);
});

test('a check is quick enough for every word the phone hears', () => {
  const t = card('このたけがきにたけたてかけたのはたけたてかけたかったから');
  const heard = 'この竹垣に竹立てかけたのは竹立てかけたかったからですよね本当に';
  const start = process.hrtime.bigint();
  for (let i = 0; i < 200; i++) V.check(t, heard + (i % 7));
  const ms = Number(process.hrtime.bigint() - start) / 1e6 / 200;
  assert.ok(ms < 5, 'a check of the longest card took ' + ms.toFixed(2) + ' ms');
});

console.log(failures ? failures + ' failed' : 'all passed');
process.exit(failures ? 1 : 0);
