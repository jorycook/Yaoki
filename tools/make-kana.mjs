// Makes the kana course (the level before N5): content/kana/units.json and content/kana/u01.json … u04.json.
// usage: node tools/make-kana.mjs          (writes the files, then: node tools/build-course.mjs checks them)
//        node tools/make-kana.mjs --check  (makes them in memory and says whether the files on disk are the same)
//
// The course reads and writes hiragana and katakana in four weeks, each of five study days, a まとめ day on the
// kana that look alike, and a week test. The days, their kana, words and notes are the tables below; the questions
// (practice, check, word quiz, week test) are made from them the same way every time, so a change to a table is
// a change to the course. Every word is checked to use only kana taught by its day, and every question to have one
// right answer. Romaji is Hepburn as Yaoki Speaking writes it (docs/speaking/voice.js: shi, chi, tsu, fu; ō and ā for
// long sounds), so the two agree.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const V = require(path.join(ROOT, 'docs', 'speaking', 'voice.js'));
const OUT = path.join(ROOT, 'content', 'kana');
const CHECK = process.argv.includes('--check');

/* ---------- kana ---------- */
const HIRA = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん';
const VOICED = 'がぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ';
const SMALL = 'ぁぃぅぇぉっゃゅょゎ';
const kata = (s) => Array.from(s).map((c) => { const o = c.codePointAt(0); return o >= 0x3041 && o <= 0x3096 ? String.fromCodePoint(o + 0x60) : c; }).join('');
const isHira = (c) => /[ぁ-ゖ]/.test(c);
const isKata = (c) => /[ァ-ヺー]/.test(c);
/* the symbols a word or a sentence may hold besides kana */
const PUNCT = new Set(['　', '。', '、', '「', '」']);
const ROWS = (s, n) => { const out = []; for (let i = 0; i < s.length; i += n) out.push(s.slice(i, i + n)); return out; };
const YOON = ['き', 'し', 'ち', 'に', 'ひ', 'み', 'り', 'ぎ', 'じ', 'び', 'ぴ'].map((c) => [c + 'ゃ', c + 'ゅ', c + 'ょ']);

/* romaji, as Yaoki Speaking writes it; a few kana are taught without a sound of their own */
const SILENT = new Set(['っ', 'ッ', 'ー']);
function romaji(text) {
  const r = V.hepburn(text);
  if (!r && !SILENT.has(text)) throw new Error('no romaji for ' + text);
  return r;
}
/* clip names: k_ the sound of a kana (the same clip for hiragana and katakana), kw_ a word, ks_ a sentence */
const ascii = (r) => r.normalize('NFC').replace(/ā/g, 'aa').replace(/ī/g, 'ii').replace(/ū/g, 'uu').replace(/ē/g, 'ee').replace(/ō/g, 'oo').replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase();
const kanaClip = (k) => (SILENT.has(k) ? null : 'k_' + ascii(romaji(k)));

/* ---------- kana that look alike: the notes say how to tell them apart ---------- */
const LOOKS = [
  ['さち', 'In ち the long line swings round to the right in one big curve, like a 5. In さ the bottom is a short curve of its own, under the cross.'],
  ['きさ', 'き has two lines across; さ has one.'],
  ['るろ', 'る ends in a little loop; ろ does not.'],
  ['ぬめ', 'ぬ ends in a little loop; め does not.'],
  ['ねれわ', 'All three start with the same line down. Then ね ends in a loop, れ kicks out to the right, and わ curls back in.'],
  ['はほ', 'ほ has two lines across on its right side; は has one.'],
  ['はけ', 'は ends in a little loop at the bottom right; け does not.'],
  ['あお', 'お has a little dot at the top right; あ has none, and its loop crosses the line down.'],
  ['いり', 'In い the right line is short; in り it is long and curves down.'],
  ['こに', 'に has a line down on its left; こ does not.'],
  ['まも', 'ま ends in a loop at the bottom; in も the long stroke curves up to the right, and the two lines cross it.'],
  ['しつ', 'し goes down and turns up; つ goes across and turns down.'],
  ['くへ', 'く points left, like <; へ is a roof, like ^.'],
  ['シツ', 'In シ the two short strokes are on the left, one above the other, and the long stroke goes up from the bottom left. In ツ the short strokes stand side by side on top, and the long stroke comes down from the top right.'],
  ['ソン', 'ソ\'s short stroke is almost upright, and its long stroke comes down from the top right. ン\'s short stroke lies flatter, and its long stroke goes up from the bottom left.'],
  ['クケタ', 'ク is two strokes. ケ has a line across instead of the hook, with a stroke falling from its middle. タ is ク with one more short stroke inside.'],
  ['ウワフ', 'ウ has a short stroke on top and a line down on the left; ワ has the line down but nothing on top; フ is one stroke.'],
  ['スヌ', 'In ス the short stroke starts on the long one and goes down to the right; in ヌ it crosses the long one.'],
  ['コユ', 'In コ the bottom line stops at the corner; in ユ it runs on past the upright line.'],
  ['チテ', 'In チ the upright line crosses the line across; テ has two lines across, and its last stroke hangs down from the lower one.'],
  ['アマ', 'ア\'s last stroke falls from the middle of the top; マ\'s short stroke sits inside, lower down.'],
  ['ナメ', 'ナ is a line across with a stroke through it; メ is two strokes crossing like an x.'],
  ['ルレ', 'ル is two strokes; レ is one.'],
  ['かカ', 'か has a short stroke on the right; カ does not.'],
  ['りリ', 'Hiragana り\'s first stroke has a little hook at the bottom; katakana リ\'s strokes are plain lines.'],
  ['へヘ', 'Hiragana へ and katakana ヘ are the same shape. The other kana round them tell you which it is: へや (room) is all hiragana, ヘア (hair) all katakana.'],
];
const LOOK = {};
for (const [set, note] of LOOKS) for (const a of set) for (const b of set) if (a !== b) { LOOK[a] = LOOK[a] || {}; LOOK[a][b] = note; }
/* sounds that are one sound however they are written: never offered side by side */
const SAME = [['お', 'を'], ['オ', 'ヲ'], ['じ', 'ぢ'], ['ず', 'づ'], ['ジ', 'ヂ'], ['ズ', 'ヅ']];
const sameSound = (a, b) => a === b || SAME.some(([x, y]) => (a === x && b === y) || (a === y && b === x));

/* ---------- the course ----------
   A study day: kana (the new kana, in cards of one row or one kana), ex (the example word of a kana), notes (what to know
   about a kana), words (the day's words: [kana, meaning]), write (the kana written three times), dict (the words written
   from what is heard). A まとめ day has pairs (the kana that look alike) instead of new kana. Words are written in the
   script they are written in in Japanese; the course checks each uses only kana taught by its day. */
const W = (w, gloss, r) => ({ w, gloss, r });
const UNITS = [
  {
    n: 1, ja: 'ひらがな（１）', en: 'Hiragana: the 46 basic kana', script: 'hiragana',
    days: [
      {
        title: 'あいうえお・かきくけこ', kana: 'あいうえおかきくけこ',
        intro: 'Japanese is written in kana, each one a beat of sound. Hiragana come first: the five vowels, then k with each of them.',
        ex: { あ: 'あお', い: 'いえ', う: 'うえ', え: 'えき', お: 'おか', か: 'かお', き: 'あき', く: 'きく', け: 'いけ', こ: 'こえ' },
        notes: { う: 'u, said without pushing the lips forward.', え: 'e, as in "get".' },
        words: [W('あお', 'blue'), W('いえ', 'house'), W('うえ', 'up, above'), W('えき', 'station'), W('おか', 'hill'), W('かお', 'face'), W('あき', 'autumn'), W('きく', 'to listen'), W('いけ', 'pond'), W('こえ', 'voice')],
        write: 'あいうえおかきくけこ', dict: ['いえ', 'かお', 'こえ'],
      },
      {
        title: 'さしすせそ・たちつてと', kana: 'さしすせそたちつてと',
        intro: 'The s row and the t row. Three of them change their sound: shi, chi and tsu.',
        ex: { さ: 'あさ', し: 'した', す: 'すし', せ: 'せかい', そ: 'そと', た: 'たかい', ち: 'くち', つ: 'くつ', て: 'て', と: 'とけい' },
        notes: { し: 'shi, not si: before i, the s turns into sh.', ち: 'chi, not ti: before i, the t turns into ch.', つ: 'tsu, not tu: a t and an s said together.' },
        words: [W('あさ', 'morning'), W('した', 'below, under'), W('すし', 'sushi'), W('せかい', 'the world'), W('そと', 'outside'), W('たかい', 'high; expensive'), W('くち', 'mouth'), W('くつ', 'shoes'), W('て', 'hand'), W('とけい', 'clock, watch')],
        write: 'さしすせそたちつてと', dict: ['あさ', 'くつ', 'すし'],
      },
      {
        title: 'なにぬねの・はひふへほ', kana: 'なにぬねのはひふへほ',
        intro: 'The n row and the h row. ふ is fu, and は and へ have a second sound you will meet in week 2.',
        ex: { な: 'なつ', に: 'にく', ぬ: 'いぬ', ね: 'ねこ', の: 'きのこ', は: 'はな', ひ: 'ひと', ふ: 'ふね', へ: 'へた', ほ: 'ほし' },
        notes: { ふ: 'fu: the air goes out between the lips, not between teeth and lip as in an English f.', は: 'ha. After the topic of a sentence it is said wa (week 2).', へ: 'he. As the little word for "to" it is said e (week 2).' },
        words: [W('なつ', 'summer'), W('にく', 'meat'), W('いぬ', 'dog'), W('ねこ', 'cat'), W('きのこ', 'mushroom'), W('はな', 'flower; nose'), W('ひと', 'person'), W('ふね', 'boat, ship'), W('へた', 'bad at something'), W('ほし', 'star')],
        write: 'なにぬねのはひふへほ', dict: ['いぬ', 'ねこ', 'はな'],
      },
      {
        title: 'まみむめも・やゆよ', kana: 'まみむめもやゆよ',
        intro: 'The m row, and the y row, which has only three kana.',
        ex: { ま: 'まち', み: 'みみ', む: 'むし', め: 'あめ', も: 'もも', や: 'やま', ゆ: 'ゆき', よ: 'よむ' },
        notes: { や: 'ya. The y row has no yi and no ye: only や, ゆ and よ.' },
        words: [W('まち', 'town'), W('みみ', 'ear'), W('むし', 'insect'), W('あめ', 'rain'), W('もも', 'peach'), W('やま', 'mountain'), W('ゆき', 'snow'), W('よむ', 'to read'), W('さかな', 'fish'), W('やさい', 'vegetables')],
        write: 'まみむめもやゆよ', dict: ['やま', 'ゆき', 'あめ'],
      },
      {
        title: 'らりるれろ・わをん', kana: 'らりるれろわをん',
        intro: 'The r row, わ, を and ん. That is all 46 hiragana.',
        ex: { ら: 'そら', り: 'とり', る: 'はる', れ: 'これ', ろ: 'いろ', わ: 'わたし', を: 'ほんを　よむ', ん: 'ほん' },
        notes: { ら: 'r: a quick tap of the tongue, between an English r, l and d.', を: 'o, the same sound as お. It is used only after the thing an action is done to: ほんを よむ, to read a book.', ん: 'n: a sound of its own, a whole beat. No word starts with it.' },
        words: [W('そら', 'sky'), W('とり', 'bird'), W('はる', 'spring'), W('これ', 'this'), W('いろ', 'colour'), W('わたし', 'I, me'), W('ほん', 'book'), W('くるま', 'car'), W('さくら', 'cherry blossom'), W('にほん', 'Japan')],
        extra: [W('ほんを　よむ', 'to read a book', 'hon o yomu')],
        write: 'らりるれろわをん', dict: ['ほん', 'そら', 'わたし'],
      },
      {
        title: 'まとめ：にている　かな',
        intro: 'The hiragana that look alike, side by side.',
        pairs: [['さち', ['あさ', 'くち']], ['きさ', ['ゆき', 'さかな']], ['るろ', ['はる', 'いろ']], ['ぬめ', ['いぬ', 'あめ']], ['ねれわ', ['ねこ', 'これ', 'わたし']], ['はほ', ['はな', 'ほし']], ['あお', ['あき', 'おか']], ['いり', ['いえ', 'とり']]],
        words: [W('くち', 'mouth'), W('ゆき', 'snow'), W('はる', 'spring'), W('いろ', 'colour'), W('いぬ', 'dog'), W('あめ', 'rain'), W('ねこ', 'cat'), W('これ', 'this'), W('ほし', 'star'), W('とり', 'bird')],
        dict: ['あさ', 'くち', 'はる', 'いろ', 'いぬ', 'あめ'],
      },
    ],
  },
  {
    n: 2, ja: 'ひらがな（２）', en: 'Hiragana: voiced sounds, small kana and long sounds', script: 'hiragana',
    days: [
      {
        title: 'が・ざ・だ（゛）', kana: ['がぎぐげご', 'ざじずぜぞ', 'だぢづでど'],
        intro: 'Two small strokes ゛ make a sound voiced: か ka becomes が ga.',
        ex: { が: 'かぎ', ざ: 'かぜ', だ: 'まど' },
        notes: { が: 'Two small strokes ゛ (dakuten) make a sound voiced: か ka → が ga.', ざ: 'さ sa → ざ za. じ is ji.', だ: 'た ta → だ da. ぢ and づ are said like じ and ず, and few words use them: はなぢ, a nosebleed; つづく, to go on.' },
        words: [W('かぎ', 'key'), W('ごご', 'afternoon'), W('かぜ', 'wind'), W('ちず', 'map'), W('かぞく', 'family'), W('まど', 'window'), W('でんわ', 'telephone'), W('だいがく', 'university'), W('どこ', 'where'), W('ひだり', 'left')],
        write: 'がざだ', dict: ['かぎ', 'かぜ', 'まど'],
      },
      {
        title: 'ば（゛）・ぱ（゜）', kana: ['ばびぶべぼ', 'ぱぴぷぺぽ'],
        intro: 'は ha takes ゛ to become ば ba, and a small circle ゜ to become ぱ pa.',
        ex: { ば: 'かばん', ぱ: 'さんぽ' },
        notes: { ば: 'は ha → ば ba with the two small strokes ゛.', ぱ: 'The small circle ゜ (handakuten) makes p: は ha → ぱ pa. Only the は row takes it.' },
        words: [W('かばん', 'bag'), W('ぶた', 'pig'), W('べんり', 'handy, convenient'), W('あぶない', 'dangerous'), W('えんぴつ', 'pencil'), W('さんぽ', 'a walk'), W('てんぷら', 'tempura'), W('しんぱい', 'worry'), W('ばんごはん', 'dinner'), W('ぴかぴか', 'shiny')],
        write: 'ばぱ', dict: ['ぶた', 'かばん', 'さんぽ'],
      },
      {
        title: 'ちいさい「っ」・のばす　おと',
        intro: 'A small っ is a short stop. A vowel written twice is one long sound.',
        cards: [
          { kana: [['っ']], note: 'A small っ is a short stop: one beat of silence before the next sound. きって kitte, a stamp; without it, きて kite, come.', words: ['きって', 'がっこう'] },
          { kana: [['かあ']], note: 'A vowel written twice is one long sound, two beats: おかあさん okāsan, mother. Short or long can change the word: おばさん obasan is an aunt, おばあさん obāsan a grandmother.', words: ['おかあさん', 'おばあさん'] },
          { kana: [['にい']], note: 'い after an i sound makes it long: おにいさん oniisan, older brother.', words: ['おにいさん'] },
          { kana: [['くう']], note: 'う after a u sound makes it long: くうき kūki, air.', words: ['くうき'] },
          { kana: [['せい'], ['ねえ']], note: 'A long e is mostly written えい: せんせい sensei, teacher. A few words write ええ: おねえさん onēsan, older sister.', words: ['せんせい', 'おねえさん'] },
          { kana: [['とう'], ['おお']], note: 'A long o is mostly written おう: おとうさん otōsan, father. A few words write おお: おおきい ōkii, big.', words: ['おとうさん', 'おおきい'] },
        ],
        words: [W('きって', 'stamp'), W('がっこう', 'school'), W('おかあさん', 'mother'), W('おばあさん', 'grandmother'), W('おにいさん', 'older brother'), W('くうき', 'air'), W('せんせい', 'teacher'), W('おねえさん', 'older sister'), W('おとうさん', 'father'), W('おおきい', 'big')],
        extra: [W('きて', 'come (please)'), W('おばさん', 'aunt')],
        minimal: [['きって', 'きて'], ['おばあさん', 'おばさん'], ['おかあさん', 'おかさん'], ['せんせい', 'せんせ'], ['おとうさん', 'おとさん'], ['がっこう', 'がこう'], ['くうき', 'くき'], ['おおきい', 'おきい']],
        newKana: 'っ',
        write: 'っ', dict: ['きって', 'せんせい', 'おかあさん'],
      },
      {
        title: 'きゃ・しゅ・ちょ（ちいさい　ゃゅょ）', kana: YOON.map((r) => r),
        intro: 'A small ゃ ゅ ょ joins the kana before it into one sound, one beat: き + ゃ = きゃ kya.',
        ex: { きゃ: 'きょう', しゃ: 'しゃしん', ちゃ: 'おちゃ', ひゃ: 'ひゃく', りゃ: 'りょこう', ぎゃ: 'ぎゅうにゅう', じゃ: 'じゅぎょう', びゃ: 'びょういん' },
        notes: { きゃ: 'A small ゃ ゅ ょ joins the kana before it into one sound, one beat: き + ゃ = きゃ kya. A big や is a beat of its own: きや ki-ya.', しゃ: 'し + ゃ is sha, not shya.', ちゃ: 'ち + ゃ is cha.', じゃ: 'じ + ゃ is ja.' },
        words: [W('きょう', 'today'), W('しゃしん', 'photo'), W('おちゃ', 'tea'), W('ひゃく', 'a hundred'), W('りょこう', 'a trip'), W('ぎゅうにゅう', 'milk'), W('じゅぎょう', 'a class, a lesson'), W('びょういん', 'hospital'), W('でんしゃ', 'train'), W('いしゃ', 'doctor')],
        newKana: 'ゃゅょ',
        write: 'ゃゅょ', dict: ['おちゃ', 'しゃしん', 'きょう'],
      },
      {
        title: 'は・を・へ（ぶんを　よむ）',
        intro: 'Three kana are said another way when they are the little words of a sentence: は wa, を o, へ e.',
        cards: [
          { kana: [['は', 'wa']], note: 'After the topic of a sentence, は is said wa: わたしは がくせいです, I am a student. Inside a word it stays ha: はな.', words: ['わたしは　がくせいです。'] },
          { kana: [['を', 'o']], note: 'を is said o. It comes after the thing an action is done to: みずを のみます, I drink water.', words: ['みずを　のみます。'] },
          { kana: [['へ', 'e']], note: 'As the little word for "to", へ is said e: えきへ いきます, I go to the station. Inside a word it stays he: へや.', words: ['えきへ　いきます。'] },
          { kana: [['。'], ['、'], ['「」']], note: '。 ends a sentence, 、 is a short pause, and 「 」 are quotation marks. Books for beginners leave a space between the parts of a sentence; most writing does not. こんにちは, hello: its は is said wa too.', words: ['こんにちは。'] },
        ],
        sentences: [
          W('わたしは　がくせいです。', 'I am a student.', 'watashi wa gakusei desu.'),
          W('これは　ほんです。', 'This is a book.', 'kore wa hon desu.'),
          W('みずを　のみます。', 'I drink water.', 'mizu o nomimasu.'),
          W('ほんを　よみます。', 'I read a book.', 'hon o yomimasu.'),
          W('えきへ　いきます。', 'I go to the station.', 'eki e ikimasu.'),
          W('がっこうへ　いきます。', 'I go to school.', 'gakkō e ikimasu.'),
          W('こんにちは。', 'Hello.', 'konnichiwa.'),
          W('こんばんは。', 'Good evening.', 'konbanwa.'),
        ],
        /* each: the sentence, the kana asked about (by its place), how it is said there, and the other way it could be said */
        particles: [
          ['わたしは　がくせいです。', 3, 'wa', 'ha'], ['これは　ほんです。', 2, 'wa', 'ha'], ['はな', 0, 'ha', 'wa'],
          ['みずを　のみます。', 2, 'o', 'wa'], ['ほんを　よみます。', 2, 'o', 'wa'],
          ['えきへ　いきます。', 2, 'e', 'he'], ['がっこうへ　いきます。', 4, 'e', 'he'], ['へや', 0, 'he', 'e'],
          ['こんにちは。', 4, 'wa', 'ha'], ['こんばんは。', 4, 'wa', 'ha'],
        ],
        extra: [W('へや', 'room'), W('はな', 'flower; nose')],
        write: '', dict: ['わたしは', 'みずを', 'えきへ'], dictGloss: { わたしは: 'I, as the topic: watashi wa', みずを: 'water, as the object: mizu o', えきへ: 'to the station: eki e' },
      },
      {
        title: 'まとめ：にている　かな',
        intro: 'Sounds and kana that are easy to mix up: the marks, small and big kana, and long sounds.',
        cards: [
          { kana: [['か'], ['が']], note: 'が has the two small strokes ゛; か does not. かぎ, a key; かき, a persimmon.', words: ['かぎ', 'かき'] },
          { kana: [['は'], ['ば'], ['ぱ']], note: 'ば has the two small strokes ゛ and is ba; ぱ has the small circle ゜ and is pa.', words: ['ぶた', 'さんぽ'] },
          { kana: [['つ'], ['っ']], note: 'A big つ is the sound tsu. A small っ is a short stop: くつ kutsu, shoes; きって kitte, a stamp.', words: ['くつ', 'きって'] },
          { kana: [['よ'], ['ょ']], note: 'びよういん has five beats, び・よ・う・い・ん: a hair salon. びょういん has four, びょ・う・い・ん: a hospital.', words: ['びよういん', 'びょういん'] },
          { kana: [['ば'], ['ばあ']], note: 'Short or long: おばさん obasan is an aunt, おばあさん obāsan a grandmother.', words: ['おばさん', 'おばあさん'] },
          { kana: [['じ'], ['ぢ'], ['ず'], ['づ']], note: 'ぢ and づ sound just like じ and ず. Most words use じ and ず: ちず, a map. A few use づ: つづく, to go on.', words: ['ちず', 'つづく'] },
        ],
        words: [W('かぎ', 'key'), W('かき', 'persimmon'), W('ぶた', 'pig'), W('さんぽ', 'a walk'), W('くつ', 'shoes'), W('きって', 'stamp'), W('びよういん', 'hair salon'), W('びょういん', 'hospital'), W('おばさん', 'aunt'), W('おばあさん', 'grandmother'), W('ちず', 'map'), W('つづく', 'to go on, to continue')],
        minimal: [['びょういん', 'びよういん'], ['びよういん', 'びょういん'], ['おばあさん', 'おばさん'], ['おばさん', 'おばあさん'], ['きって', 'きて'], ['かぎ', 'かき'], ['かき', 'かぎ'], ['ぶた', 'ふた'], ['さんぽ', 'さんぼ'], ['くつ', 'くち']],
        dict: ['きって', 'びょういん', 'おばあさん', 'かぎ'],
      },
    ],
  },
  {
    n: 3, ja: 'カタカナ（１）', en: 'Katakana: the 46 basic kana', script: 'katakana',
    days: [
      {
        title: 'アイウエオ・カキクケコ', kana: 'アイウエオカキクケコ', also: 'ー',
        intro: 'Katakana are the same sounds as hiragana, written another way. They are used for words from other languages, and for names.',
        ex: { ア: 'ココア', イ: 'キウイ', エ: 'エコ', オ: 'オーケー', カ: 'カカオ', キ: 'キウイ', ケ: 'ケーキ', コ: 'ココア' },
        notes: { ア: 'a, the same sound as あ.' },
        cards: [{ kana: [['ー']], note: 'A long line ー makes the sound before it long: ケーキ kēki, a cake. Katakana words use it where hiragana write a second vowel.', words: ['ケーキ', 'オーケー'] }],
        words: [W('ココア', 'cocoa'), W('カカオ', 'cacao'), W('ケーキ', 'cake'), W('キウイ', 'kiwi fruit'), W('エコ', 'eco-friendly'), W('オーケー', 'OK'), W('カーキ', 'khaki'), W('ケア', 'care')],
        write: 'アイウエオカキクケコー', dict: ['ケーキ', 'ココア', 'キウイ'],
      },
      {
        title: 'サシスセソ・タチツテト', kana: 'サシスセソタチツテト',
        intro: 'The s row and the t row, with shi, chi and tsu as in hiragana. Watch シ and ツ: they look alike.',
        ex: { サ: 'サーカス', シ: 'シーソー', ス: 'スキー', セ: 'セーター', ソ: 'ソース', タ: 'タクシー', チ: 'チーター', ツ: 'スーツ', テ: 'テスト', ト: 'トースト' },
        notes: { シ: 'shi. Its long stroke goes up from the bottom left.', ツ: 'tsu. Its long stroke comes down from the top right.', ソ: 'so. Its long stroke comes down from the top right, like ツ\'s.' },
        words: [W('サーカス', 'circus'), W('シーソー', 'seesaw'), W('スキー', 'skiing'), W('セーター', 'sweater'), W('ソース', 'sauce'), W('タクシー', 'taxi'), W('チーター', 'cheetah'), W('スーツ', 'suit'), W('テスト', 'test'), W('トースト', 'toast'), W('アイス', 'ice cream')],
        write: 'サシスセソタチツテト', dict: ['テスト', 'アイス', 'スキー'],
      },
      {
        title: 'ナニヌネノ・ハヒフヘホ', kana: 'ナニヌネノハヒフヘホ',
        intro: 'The n row and the h row. ヘ looks just like the hiragana へ.',
        ex: { ナ: 'ナイフ', ニ: 'テニス', ヌ: 'カヌー', ネ: 'ネクタイ', ノ: 'ノート', ハ: 'ハート', ヒ: 'コーヒー', フ: 'ソフト', ヘ: 'ヘア', ホ: 'ホース' },
        notes: { ヘ: 'he: the same shape as the hiragana へ.', フ: 'fu, one stroke.' },
        words: [W('ナイフ', 'knife'), W('テニス', 'tennis'), W('カヌー', 'canoe'), W('ネクタイ', 'necktie'), W('ノート', 'notebook'), W('ハート', 'heart'), W('コーヒー', 'coffee'), W('ソフト', 'soft'), W('ヘア', 'hair'), W('ホース', 'hose')],
        write: 'ナニヌネノハヒフヘホ', dict: ['ノート', 'コーヒー', 'ナイフ'],
      },
      {
        title: 'マミムメモ・ヤユヨ', kana: 'マミムメモヤユヨ',
        intro: 'The m row and the y row.',
        ex: { マ: 'マスク', ミ: 'ミキサー', ム: 'ハム', メ: 'メモ', モ: 'メモ', ヤ: 'タイヤ', ユ: 'ユーモア', ヨ: 'ヨーヨー' },
        notes: {},
        words: [W('マスク', 'mask'), W('ミキサー', 'blender'), W('ハム', 'ham'), W('メモ', 'note, memo'), W('トマト', 'tomato'), W('ホーム', 'station platform'), W('タイヤ', 'tyre'), W('ユーモア', 'humour'), W('ヨーヨー', 'yo-yo')],
        write: 'マミムメモヤユヨ', dict: ['トマト', 'メモ', 'マスク'],
      },
      {
        title: 'ラリルレロ・ワヲン', kana: 'ラリルレロワヲン',
        intro: 'The r row, ワ, ヲ and ン. That is all 46 katakana.',
        ex: { ラ: 'ラーメン', リ: 'アメリカ', ル: 'ホテル', レ: 'レモン', ロ: 'メロン', ワ: 'ワイン', ン: 'ラーメン' },
        notes: { ヲ: 'o, like オ. It is hardly ever used.', ン: 'n. Its long stroke goes up from the bottom left, like シ\'s.' },
        words: [W('ラーメン', 'ramen'), W('アメリカ', 'America'), W('ホテル', 'hotel'), W('レモン', 'lemon'), W('メロン', 'melon'), W('ワイン', 'wine'), W('カメラ', 'camera'), W('トイレ', 'toilet'), W('レストラン', 'restaurant'), W('ミルク', 'milk')],
        write: 'ラリルレロワヲン', dict: ['ワイン', 'メロン', 'ホテル'],
      },
      {
        title: 'まとめ：にている　かな',
        intro: 'The katakana that look alike, side by side.',
        pairs: [['シツ', ['シーソー', 'スーツ']], ['ソン', ['ソース', 'ラーメン']], ['クケタ', ['タクシー', 'ケーキ']], ['ウワフ', ['キウイ', 'ワイン', 'ソフト']], ['スヌ', ['スキー', 'カヌー']], ['コユ', ['ココア', 'ユーモア']], ['チテ', ['チーター', 'テスト']]],
        words: [W('シーソー', 'seesaw'), W('スーツ', 'suit'), W('ソース', 'sauce'), W('ラーメン', 'ramen'), W('タクシー', 'taxi'), W('ケーキ', 'cake'), W('キウイ', 'kiwi fruit'), W('ワイン', 'wine'), W('スキー', 'skiing'), W('カヌー', 'canoe')],
        dict: ['シーソー', 'スーツ', 'ソース', 'ワイン'],
      },
    ],
  },
  {
    n: 4, ja: 'カタカナ（２）', en: 'Katakana: voiced sounds, small kana and new sounds', script: 'katakana',
    days: [
      {
        title: 'ガ・ザ・ダ・バ・パ', kana: ['ガギグゲゴ', 'ザジズゼゾ', 'ダヂヅデド', 'バビブベボ', 'パピプペポ'],
        intro: 'The marks ゛ and ゜ work as in hiragana: カ ka becomes ガ ga, ハ ha becomes バ ba and パ pa.',
        ex: { ガ: 'ガム', ザ: 'デザート', ダ: 'ドア', バ: 'バス', パ: 'パン' },
        notes: { ガ: 'The marks are the same as in hiragana: カ ka → ガ ga.', ダ: 'ヂ and ヅ are almost never used in katakana.', バ: 'ハ ha → バ ba with ゛, and → パ pa with ゜.' },
        words: [W('ゲーム', 'game'), W('ラジオ', 'radio'), W('デザート', 'dessert'), W('ガム', 'chewing gum'), W('テレビ', 'television'), W('バス', 'bus'), W('パン', 'bread'), W('ピアノ', 'piano'), W('ペン', 'pen'), W('ドア', 'door')],
        write: 'ガザダバパ', dict: ['バス', 'パン', 'テレビ'],
      },
      {
        title: 'キャ・シュ・チョ・ちいさい「ッ」', kana: YOON.map((r) => r.map(kata)),
        intro: 'Small ャ ュ ョ and a small ッ, as in hiragana.',
        ex: { キャ: 'キャベツ', シャ: 'シャツ', チャ: 'チョコレート', ニャ: 'ニュース', リャ: 'リュック', ジャ: 'ジュース', ピャ: 'コンピューター' },
        notes: { キャ: 'As in hiragana, a small ャ ュ ョ joins the kana before it into one sound: キ + ャ = キャ kya.' },
        cards: [{ kana: [['ッ']], note: 'A small ッ is a short stop, as in hiragana: ベッド beddo, bed; サッカー sakkā, football.', words: ['サッカー', 'ベッド'] }],
        words: [W('キャベツ', 'cabbage'), W('シャツ', 'shirt'), W('チョコレート', 'chocolate'), W('ニュース', 'the news'), W('リュック', 'backpack'), W('ジュース', 'juice'), W('コンピューター', 'computer'), W('サッカー', 'football'), W('ベッド', 'bed'), W('コップ', 'cup, glass')],
        newKana: 'ャュョッ',
        write: 'ャュョッ', dict: ['シャツ', 'ジュース', 'ベッド'],
      },
      {
        title: 'ティ・ディ・ファ・フィ・フェ・フォ',
        intro: 'Sounds that only words from other languages have, made with a small ィ ァ ェ ォ.',
        cards: [
          { kana: [['ティ'], ['ディ']], note: 'テ + a small ィ = ティ ti: パーティー, a party. デ + ィ = ディ di.', words: ['パーティー', 'ディナー'] },
          { kana: [['ファ'], ['フィ']], note: 'フ + a small ァ or ィ makes fa and fi: ファン, a fan; フィルム, film.', words: ['ファン', 'フィルム'] },
          { kana: [['フェ'], ['フォ']], note: 'フ + a small ェ or ォ makes fe and fo: カフェ, a café; フォーク, a fork.', words: ['カフェ', 'フォーク'] },
        ],
        words: [W('パーティー', 'party'), W('ディナー', 'dinner'), W('メロディー', 'melody'), W('ファン', 'fan'), W('ソファ', 'sofa'), W('フィルム', 'film'), W('カフェ', 'café'), W('フェリー', 'ferry'), W('フォーク', 'fork'), W('ティッシュ', 'tissue')],
        newKana: 'ィァェォ', soundsNew: ['ティ', 'ディ', 'ファ', 'フィ', 'フェ', 'フォ'],
        write: 'ィァェォ', dict: ['カフェ', 'フォーク', 'パーティー'],
      },
      {
        title: 'ウィ・ウェ・ウォ・シェ・ジェ・チェ・ヴ',
        intro: 'More sounds of words from other languages, and ヴ for a v.',
        cards: [
          { kana: [['ウィ'], ['ウェ'], ['ウォ']], note: 'ウ + a small ィ ェ ォ makes wi, we and wo: ハロウィン, Halloween; ウェブ, the web.', words: ['ハロウィン', 'ウェブ', 'ウォーキング'] },
          { kana: [['シェ'], ['ジェ'], ['チェ']], note: 'シ, ジ and チ + a small ェ make she, je and che: シェフ, a chef; チェック, a check.', words: ['シェフ', 'チェック'] },
          { kana: [['ヴ']], note: 'ヴ is vu. A few words use it for a v; most write v with バ ビ ブ ベ ボ: バイオリン, a violin.', words: ['バイオリン'] },
        ],
        words: [W('ハロウィン', 'Halloween'), W('ウェブ', 'the web'), W('ウォーキング', 'walking (for exercise)'), W('シェフ', 'chef'), W('ジェットコースター', 'roller coaster'), W('チェック', 'check'), W('ウェイター', 'waiter'), W('シェア', 'share'), W('チェス', 'chess'), W('バイオリン', 'violin')],
        newKana: 'ヴ', soundsNew: ['ウィ', 'ウェ', 'ウォ', 'シェ', 'ジェ', 'チェ', 'ヴ'],
        write: 'ヴ', dict: ['シェフ', 'チェック', 'ウェブ'],
      },
      {
        title: 'カタカナの　ことば',
        intro: 'Longer words from other languages: countries, food and things around you.',
        cards: [
          { kana: [], note: 'Most country names are written in katakana.', words: ['アメリカ', 'イギリス', 'フランス', 'ドイツ', 'ブラジル'] },
          { kana: [], note: 'An English -er at the end often becomes a long ā: ハンバーガー hanbāgā, a hamburger.', words: ['ハンバーガー', 'エレベーター'] },
          { kana: [], note: 'Some long words are cut short: コンビニ, a convenience store; スマホ, a smartphone.', words: ['コンビニ', 'スマホ'] },
          { kana: [], note: 'Names from other languages are written by their sound: Maria マリア, John ジョン.', words: ['マリア', 'ジョン'] },
        ],
        words: [W('アメリカ', 'America'), W('イギリス', 'the UK'), W('フランス', 'France'), W('ドイツ', 'Germany'), W('ブラジル', 'Brazil'), W('ハンバーガー', 'hamburger'), W('サンドイッチ', 'sandwich'), W('スパゲッティ', 'spaghetti'), W('エレベーター', 'lift, elevator'), W('コンビニ', 'convenience store')],
        extra: [W('スマホ', 'smartphone'), W('マリア', 'Maria'), W('ジョン', 'John')],
        write: '', dict: ['ドイツ', 'コンビニ', 'フランス'],
      },
      {
        title: 'まとめ：にている　かな',
        intro: 'Hiragana and katakana that look alike, small and big kana, and sounds that are easy to mix up.',
        cards: [
          { kana: [['へ'], ['ヘ']], note: LOOK['へ']['ヘ'], words: ['へや', 'ヘア'] },
          { kana: [['り'], ['リ']], note: LOOK['り']['リ'], words: ['とり', 'アメリカ'] },
          { kana: [['か'], ['カ']], note: LOOK['か']['カ'], words: ['かさ', 'カメラ'] },
          { kana: [['ツ'], ['ッ']], note: 'A big ツ is the sound tsu: スーツ, a suit. A small ッ is a short stop: サッカー, football.', words: ['スーツ', 'サッカー'] },
          { kana: [['ヨ'], ['ョ']], note: 'A big ヨ is the sound yo: ヨーヨー. A small ョ joins the kana before it: チョコレート, cho-ko-rē-to.', words: ['ヨーヨー', 'チョコレート'] },
          { kana: [['チ'], ['ティ']], note: 'チ is chi; ティ is ti: チーター, a cheetah; パーティー, a party.', words: ['チーター', 'パーティー'] },
        ],
        words: [W('へや', 'room'), W('ヘア', 'hair'), W('とり', 'bird'), W('アメリカ', 'America'), W('かさ', 'umbrella'), W('カメラ', 'camera'), W('スーツ', 'suit'), W('サッカー', 'football'), W('ヨーヨー', 'yo-yo'), W('チョコレート', 'chocolate'), W('チーター', 'cheetah'), W('パーティー', 'party')],
        minimal: [['サッカー', 'サカー'], ['ベッド', 'ベド'], ['シャツ', 'シヤツ'], ['チョコレート', 'チヨコレート'], ['パーティー', 'パーチー'], ['スーツ', 'スーシ'], ['チーター', 'チータ'], ['カメラ', 'カメル'], ['ヘア', 'ヘヤ'], ['ヨーヨー', 'ヨヨ']],
        dict: ['サッカー', 'チョコレート', 'パーティー', 'カメラ'],
      },
    ],
  },
];

/* ---------- a little seeded randomness, so the questions come out the same every time ---------- */
function rng(seed) {
  let s = 0;
  for (const c of seed) s = (Math.imul(s ^ c.codePointAt(0), 2654435761) + 0x9e3779b9) >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const shuffle = (list, rand) => { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (list, n, rand) => shuffle(list, rand).slice(0, n);

/* ---------- what is taught when ---------- */
const problems = [];
const bad = (where, msg) => problems.push(where + ': ' + msg);
const taught = new Set(PUNCT);
const SOUNDS = new Map();          /* every kana sound the course plays: clip -> the kana said */
const WORDS = new Map();           /* every word or sentence: kana -> { r, gloss, clip } */
function sound(k) {
  const clip = kanaClip(k);
  if (!clip) return null;
  const hira = Array.from(k).map((c) => (isKata(c) && c !== 'ー' ? String.fromCodePoint(c.codePointAt(0) - 0x60) : c)).join('');
  /* a kana on its own is said from its katakana, which the voice never takes for a little word (は alone it reads as the
     particle wa, ハ as ha); a pattern of two kana for a long sound (かあ, せい) is said as hiragana, as in a word */
  const single = Array.from(k).length === 1 || /[ゃゅょャュョァィゥェォぁぃぅぇぉ]$/.test(k);
  const say = single ? kata(hira) : hira;
  if (!SOUNDS.has(clip)) SOUNDS.set(clip, { k, say, r: romaji(k) });
  return clip;
}
function word(w, gloss, r) {
  const rr = (r || romaji(w)).replace(/[.]$/, '');
  const have = WORDS.get(w);
  if (have) { if (gloss && have.gloss !== gloss) bad(w, `two meanings: "${have.gloss}" and "${gloss}"`); return have; }
  const sentence = /[　。]/.test(w);
  let clip = (sentence ? 'ks_' : 'kw_') + ascii(rr);
  /* two words that would share a clip name (a hiragana and a katakana word said alike): the katakana one gets _k */
  for (const [o, x] of WORDS) if (x.clip === clip && o !== w) clip += Array.from(w).some(isKata) ? '_k' : '_h';
  const out = { w, r: rr, gloss, clip };
  WORDS.set(w, out);
  return out;
}
const BY_ROMAJI = {};
for (const c of HIRA) if (!BY_ROMAJI[romaji(c)]) BY_ROMAJI[romaji(c)] = c;
const unknown = (w) => Array.from(w).filter((c) => !taught.has(c));
function checkWord(where, w) {
  const off = unknown(w);
  if (off.length) bad(where, `"${w}" uses ${[...new Set(off)].join(' ')}, not taught yet`);
}

/* ---------- questions ---------- */
const plainR = (r) => r.replace(/[.,]/g, '').trim();
/* the kana that could be mistaken for k: look-alikes first, then its row and its column */
function nearKana(k, pool, rand) {
  const big = /[ゃゅょャュョィェァォ]$/.test(k) ? [Array.from(k)[0] + BIGSMALL[Array.from(k).slice(-1)[0]]].filter((x) => romaji(x) !== romaji(k)) : [];
  if (big.length) return [...big, ...nearKana2(k, pool, rand).filter((x) => !big.includes(x))];
  return nearKana2(k, pool, rand);
}
function nearKana2(k, pool, rand) {
  const look = Object.keys(LOOK[k] || {}).filter((x) => pool.includes(x));
  const row = pool.filter((x) => x !== k && !look.includes(x) && rowOf(x) === rowOf(k));
  const col = pool.filter((x) => x !== k && !look.includes(x) && !row.includes(x) && romaji(x).slice(-1) === romaji(k).slice(-1));
  const rest = pool.filter((x) => x !== k && !look.includes(x) && !row.includes(x) && !col.includes(x));
  return [...shuffle(look, rand), ...shuffle(row, rand), ...shuffle(col, rand), ...shuffle(rest, rand)].filter((x) => !sameSound(x, k) && romaji(x) !== romaji(k) && !/^[ぢづヂヅ]$/.test(x));
}
function rowOf(k) {
  const h = Array.from(k).map((c) => (isKata(c) ? String.fromCodePoint(c.codePointAt(0) - 0x60) : c)).join('');
  for (const r of [...ROWS(HIRA, 5), ...ROWS(VOICED, 5)]) if (r.includes(h[0])) return r;
  return h[0];
}
/* a why line for kana k, offered beside the right kana `right` */
function kanaWhy(k, right, isRight) {
  const r = romaji(k);
  const base = `${k} is ${r}.`;
  if (isRight) return TIPS[k] ? withTip(k, r, TIPS[k]) : base;
  const note = (LOOK[right] || {})[k];
  return base + (note ? ' ' + note : '');
}
/* a kana's tip after "ツ is tsu": a tip that opens with the same romaji goes on from it ("う is u, said without …",
   "ツ is tsu. Its long stroke …") rather than saying it twice */
function withTip(k, r, tip) {
  const m = /^([a-zāīūēō]+)([.,:]) (.*)$/.exec(tip);
  if (m && m[1] === r) return `${k} is ${r}${m[2]} ${m[3]}`;
  return `${k} is ${r}. ${tip}`;
}
const TIPS = {};
let itemN = 0;
/* place the right answer: spread over the options in turn, not left to chance */
function choice(id, fields, right, wrong, why, slot) {
  const n = 1 + wrong.length;
  const at = slot % n;
  const options = wrong.slice();
  options.splice(at, 0, right);
  const whys = why.slice(1);
  whys.splice(at, 0, why[0]);
  return { id, kind: 'choice', ...fields, options, answer: at + 1, why: whys };
}
/* read: a kana shown, its sound picked from romaji */
function readKana(id, k, pool, rand, slot) {
  const near = nearKana(k, pool, rand).slice(0, 3);
  if (near.length < 3) bad(id, 'not enough kana to offer beside ' + k);
  return choice(id, { type: 'かな読み', label: 'Read the kana', mode: 'read', q: '_' + k + '_', clip: sound(k), big: k },
    romaji(k), near.map(romaji), [kanaWhy(k, k, true), ...near.map((x) => kanaWhy(x, k, false))], slot);
}
/* hear: a kana's sound played, the kana picked (in the notebook it is asked from the romaji) */
function hearKana(id, k, pool, rand, slot, type) {
  const near = nearKana(k, pool, rand).slice(0, 3);
  if (near.length < 3) bad(id, 'not enough kana to offer beside ' + k);
  const written = type === 'かな書き';
  return choice(id, { type: type || 'かなを聞く', label: written ? 'Which kana is it?' : 'Pick the kana you hear', mode: written ? 'read' : 'hear', q: '_' + romaji(k) + '_', clip: sound(k), big: romaji(k) },
    k, near, [kanaWhy(k, k, true), ...near.map((x) => kanaWhy(x, k, false))], slot);
}
/* a word changed by one kana: a look-alike, a sound with or without its marks, a small kana made big, a long sound made short */
const VOICE = {};
for (const [a, b] of [['か', 'が'], ['き', 'ぎ'], ['く', 'ぐ'], ['け', 'げ'], ['こ', 'ご'], ['さ', 'ざ'], ['し', 'じ'], ['す', 'ず'], ['せ', 'ぜ'], ['そ', 'ぞ'], ['た', 'だ'], ['て', 'で'], ['と', 'ど'], ['は', 'ば'], ['ひ', 'び'], ['ふ', 'ぶ'], ['へ', 'べ'], ['ほ', 'ぼ'], ['ば', 'ぱ'], ['び', 'ぴ'], ['ぶ', 'ぷ'], ['べ', 'ぺ'], ['ぼ', 'ぽ']]) {
  for (const [x, y] of [[a, b], [kata(a), kata(b)]]) { VOICE[x] = (VOICE[x] || []).concat(y); VOICE[y] = (VOICE[y] || []).concat(x); }
}
const BIGSMALL = {};
for (const [a, b] of [['っ', 'つ'], ['ゃ', 'や'], ['ゅ', 'ゆ'], ['ょ', 'よ'], ['ッ', 'ツ'], ['ャ', 'ヤ'], ['ュ', 'ユ'], ['ョ', 'ヨ'], ['ィ', 'イ'], ['ェ', 'エ'], ['ァ', 'ア'], ['ォ', 'オ']]) { BIGSMALL[a] = b; BIGSMALL[b] = a; }
const VOWEL = { あ: 'え', い: 'え', う: 'お', え: 'い', お: 'う', ア: 'エ', イ: 'エ', ウ: 'オ', エ: 'イ', オ: 'ウ' };
/* the kana of the same row, and of the same column, as c (in its own script) */
const TABLE = [...ROWS(HIRA.slice(0, 35), 5), 'やゆよ', 'らりるれろ', ...ROWS(VOICED, 5)];
function mates(c) {
  const h = isKata(c) ? String.fromCodePoint(c.codePointAt(0) - 0x60) : c;
  const back = (x) => (isKata(c) ? kata(x) : x);
  const row = TABLE.find((r) => r.includes(h));
  if (!row) return [];
  const at = row.indexOf(h);
  const col = TABLE.filter((r) => r !== row && r.length === 5).map((r) => r[at]);
  return [...Array.from(row).filter((x) => x !== h), ...col].map(back);
}
/* a made-up spelling is only offered when it could be a spelling at all (no small ゃ after a kana that takes none, no word
   starting with ん or a small kana), is not a rare kana, and is not a rude word by chance (ちんぽ for さんぽ) */
const RUDE = ['ちんぽ', 'ちんこ', 'ちんちん', 'まんこ', 'うんこ', 'うんち', 'しね', 'くそ', 'ばか', 'あほ', 'ころす', 'きもい', 'ぶす', 'でぶ', 'はげ', 'ちくび', 'おっぱい', 'せっくす', 'えろ', 'やりまん', 'ぱんつ', 'おなら', 'へんたい', 'きちが', 'しっこ', 'がき'];
const YOON_OK = /(?:^|[^きしちにひみりぎじぢびぴキシチニヒミリギジヂビピ])[ゃゅょャュョ]/;
const SMALLV_OK = new Set(['ティ', 'ディ', 'ファ', 'フィ', 'フェ', 'フォ', 'ウィ', 'ウェ', 'ウォ', 'シェ', 'ジェ', 'チェ', 'ヴァ', 'ヴィ', 'ヴェ', 'ヴォ']);
function fair(w) {
  const cs = Array.from(w);
  if (/^[ゃゅょっャュョッーィェァォんン]/.test(w) || /[ぢづヂヅゔヲを]/.test(w)) return false;
  if (YOON_OK.test(w)) return false;
  for (let i = 0; i < cs.length; i++) if (/[ァィゥェォぁぃぅぇぉ]/.test(cs[i]) && !SMALLV_OK.has(cs[i - 1] + cs[i])) return false;
  if (/[っッ][ーっッんンあいうえおアイウエオ。　]/.test(w) || /[っッ]$/.test(w) || /[んンー]ー/.test(w)) return false;
  const h = Array.from(w).map((c) => (isKata(c) && c !== 'ー' ? String.fromCodePoint(c.codePointAt(0) - 0x60) : c)).join('');
  return !RUDE.some((x) => h.includes(x));
}
const COMBO_ALT = { ファ: ['ハ', 'パ', 'フア'], フィ: ['ヒ', 'フイ'], フェ: ['ヘ', 'フエ'], フォ: ['ホ', 'フオ'], ティ: ['チ', 'テ', 'テイ'], ディ: ['ジ', 'デ', 'デイ'], ウィ: ['イ', 'ウイ'], ウェ: ['エ', 'ウエ'], ウォ: ['オ', 'ウオ'], シェ: ['セ', 'シエ'], ジェ: ['ゼ', 'ジエ'], チェ: ['テ', 'チエ'] };
/* how likely a change is to catch a learner out: a look-alike or a mark first, a row or column mate last */
const RANK = { look: 0, voice: 0, size: 0, length: 0, stop: 0, vowel: 1, swap: 1, near: 2 };
function variants(w, rand) {
  const cs = Array.from(w);
  const out = [];
  const add = (v, how) => { if (v !== w && !out.some((x) => x.w === v)) out.push({ w: v, how }); };
  cs.forEach((c, i) => {
    const put = (x) => cs.slice(0, i).concat(x, cs.slice(i + 1)).join('');
    for (const x of Object.keys(LOOK[c] || {})) if (isHira(x) === isHira(c)) add(put(x), 'look');
    for (const x of VOICE[c] || []) add(put(x), 'voice');
    if (BIGSMALL[c]) add(put(BIGSMALL[c]), 'size');
    if (VOWEL[c] && i > 0) add(put(VOWEL[c]), 'vowel');
    /* a long sound made short, and a short one long */
    if ((c === 'ー' || ((c === 'う' || c === 'い' || c === 'あ' || c === 'え' || c === 'お') && i > 0)) && cs.length > 2) add(cs.slice(0, i).concat(cs.slice(i + 1)).join(''), 'length');
    if (c === 'っ' || c === 'ッ') add(cs.slice(0, i).concat(cs.slice(i + 1)).join(''), 'stop');
    for (const x of mates(c)) add(put(x), 'near');
    /* a sound of a kana and a small vowel (ファ), heard as the plain kana it comes from (ハ, フ) */
    const two = c + (cs[i + 1] || '');
    for (const x of COMBO_ALT[two] || []) add(cs.slice(0, i).concat(x, cs.slice(i + 2)).join(''), 'look');
  });
  /* two kana swapped round */
  for (let i = 0; i + 1 < cs.length; i++) if (cs[i] !== cs[i + 1] && !/[ゃゅょャュョっッーィェァォ]/.test(cs[i] + cs[i + 1])) add(cs.slice(0, i).concat(cs[i + 1], cs[i], cs.slice(i + 2)).join(''), 'swap');
  const ok = out.filter((v) => { try { return /^[a-zāīūēō' ]+$/.test(romaji(v.w)) && fair(v.w); } catch (e) { return false; } });
  return shuffle(ok, rand).sort((a, b) => RANK[a.how] - RANK[b.how]);
}
/* the differing kana of two words of the same length, for a why line */
function diff(a, b) {
  const x = Array.from(a);
  const y = Array.from(b);
  if (x.length !== y.length) return null;
  const i = x.findIndex((c, k) => c !== y[k]);
  return i < 0 ? null : [x[i], y[i]];
}
function wordWhy(v, right) {
  const d = diff(right.w, v);
  const note = d && (LOOK[d[0]] || {})[d[1]];
  return `${v} would be ${romaji(v)}.` + (note ? ' ' + note : '');
}
/* read: a word shown, its romaji picked */
function readWord(id, wd, rand, slot, extraType) {
  const long = /[āīūēō]|ii/.test(wd.r) || taught.has('っ');
  let vs = variants(wd.w, rand).filter((v) => romaji(v.w) !== wd.r && (long || !/[āīūēō]|ii|ee|oo|aa|uu/.test(romaji(v.w))));
  vs = vs.filter((v, k, a) => a.findIndex((u) => romaji(u.w) === romaji(v.w)) === k);
  vs = vs.filter((v) => !unknown(v.w).length).concat(vs.filter((v) => unknown(v.w).length));
  if (vs.length < 3) bad(id, 'not enough wrong readings for ' + wd.w);
  const three = vs.slice(0, 3);
  return choice(id, { type: extraType || 'ことば読み', label: 'Read the word', mode: 'read', q: '_' + wd.w + '_', clip: wd.clip, big: wd.w, gloss: wd.gloss },
    wd.r, three.map((v) => romaji(v.w)), [`${wd.w} is ${wd.r}: ${wd.gloss}.`, ...three.map((v) => wordWhy(v.w, wd))], slot);
}
/* hear: a word said, its spelling picked from spellings that differ by one kana (only kana taught so far) */
function hearWord(id, wd, rand, slot, given) {
  let vs = (given || []).map((w) => ({ w })).concat(variants(wd.w, rand)).filter((v) => !unknown(v.w).length && v.w !== wd.w);
  vs = vs.filter((v, k, a) => a.findIndex((u) => u.w === v.w) === k && romaji(v.w) !== wd.r);
  if (vs.length < 3) bad(id, 'not enough spellings to offer beside ' + wd.w);
  const three = vs.slice(0, 3);
  return choice(id, { type: 'ことばを聞く', label: 'Pick the word you hear', mode: 'hear', q: '_' + wd.r + '_', clip: wd.clip, big: wd.r, gloss: wd.gloss },
    wd.w, three.map((v) => v.w), [`${wd.w} is ${wd.r}: ${wd.gloss}.`, ...three.map((v) => wordWhy(v.w, wd))], slot);
}
/* a sentence: how one of its kana is said there */
function particleItem(id, [sent, at, right, other], slot) {
  const cs = Array.from(sent);
  const q = cs.map((c, k) => (k === at ? '{' + c + '}' : c)).join('');
  const k = cs[at];
  const inWord = right === 'ha' || right === 'he';
  const whyRight = inWord ? `Inside a word ${k} keeps its own sound, ${right}.` : `As the little word of the sentence, ${k} is said ${right}.`;
  const whyOther = inWord ? `${other} is how ${k} is said as the little word of a sentence, not inside a word.` : `${other} is how ${k} sounds inside a word, as in ${k === 'は' ? 'はな' : k === 'へ' ? 'へや' : 'わたし'}.`;
  return choice(id, { type: 'ぶん読み', label: 'How is the marked kana said?', mode: 'read', q, clip: WORDS.get(sent) ? WORDS.get(sent).clip : null, big: '' },
    right, [other], [whyRight, whyOther], slot);
}

/* ---------- the days ---------- */
const units = [];
const files = {};
for (const U of UNITS) {
  const pre = 'kanau' + String(U.n).padStart(2, '0');
  const days = {};
  const unitKana = [];
  const unitWords = [];
  U.days.forEach((D, di) => {
    const d = di + 1;
    const sid = pre + 'd' + d;
    const rand = rng(sid);
    /* the kana this day brings in: whole rows (strings or lists of sounds), and the marks taught on their own */
    const groups = typeof D.kana === 'string' ? Array.from(D.kana).map((c) => [c]) : (D.kana || []).map((g) => (typeof g === 'string' ? Array.from(g) : g));
    const newSounds = groups.flat();
    for (const k of newSounds) for (const c of Array.from(k)) taught.add(c);
    for (const c of Array.from(D.newKana || '') + Array.from(D.also || '')) taught.add(c);
    for (const k of D.soundsNew || []) for (const c of Array.from(k)) taught.add(c);
    Object.assign(TIPS, D.notes || {});
    /* words: the day's list, extra words its cards and questions use, and the sentences */
    const list = (D.words || []).concat(D.sentences || []).map((x) => word(x.w, x.gloss, x.r));
    for (const x of D.extra || []) word(x.w, x.gloss, x.r);
    for (const x of list) checkWord(sid + '.words', x.w);
    for (const x of D.extra || []) checkWord(sid + '.extra', x.w);
    const lookup = (w) => { const x = WORDS.get(w); if (!x) bad(sid, `"${w}" is not one of the day's words`); return x || { w, r: '', gloss: '', clip: null }; };
    /* the learn step's cards: a kana (or a row) at a time, with its example word and what to know about it */
    let cards = [];
    if (D.pairs) {
      cards = D.pairs.map(([set, ws]) => {
        const ks = Array.from(set);
        const notes = [...new Set(ks.flatMap((a) => ks.filter((b) => b !== a).map((b) => LOOK[a][b])))];
        if (!notes.length || notes.some((x) => !x)) bad(sid, 'no note for ' + set);
        for (const k of ks) if (!taught.has(k)) bad(sid, k + ' is not taught yet');
        return { kana: ks.map((k) => [k, romaji(k), sound(k)]), note: notes[0], words: ws.map((w) => { const x = WORDS.get(w); if (!x) bad(sid, w + ' has no meaning'); checkWord(sid + '.pairs', w); return x; }) };
      });
    } else {
      cards = groups.map((g) => {
        const lead = g[0];
        const exW = D.ex && D.ex[lead];
        if (exW) checkWord(sid + '.ex', exW);
        const ex = exW ? WORDS.get(exW) : null;
        if (exW && !ex) bad(sid, `example ${exW} is not a word of the day`);
        if (ex && g.length === 1 && !Array.from(exW).includes(lead)) bad(sid, `example ${exW} does not hold ${lead}`);
        return { kana: g.map((k) => [k, romaji(k), sound(k)]), note: (D.notes || {})[lead] || '', words: ex ? [ex] : [] };
      });
    }
    for (const c of D.cards || []) {
      const ks = (c.kana || []).map(([k, r]) => {
        if (/[。、「」]/.test(k)) return [k, '', null];
        const say = r || romaji(k);
        /* a kana said another way (は said wa) plays the sound of the kana written that way (わ) */
        return [k, say, r && r !== romaji(k) ? sound(BY_ROMAJI[r]) : sound(k)];
      });
      cards.push({ kana: ks, note: c.note, words: (c.words || []).map((w) => { checkWord(sid + '.cards', w); return lookup(w); }) });
    }
    /* the kana the questions can offer: everything of this script taught so far */
    const script = U.script === 'katakana' ? isKata : isHira;
    const POOL = [...taught].filter((c) => script(c) && !/[ゃゅょっャュョッーィェァォゥ]/.test(c));
    const yoonPool = YOON.flat().map((k) => (U.script === 'katakana' ? kata(k) : k)).filter((k) => Array.from(k).every((c) => taught.has(c)));
    const singles = newSounds.concat(D.soundsNew || []).filter((k) => !/^[ぢづヂヅヲを]$/.test(k));
    /* practice, check and the word quiz */
    const practice = [];
    const check = [];
    let slot = Math.floor(rand() * 4);
    const next = () => slot++;
    if (singles.length && !D.pairs) {
      const isYoon = singles.some((k) => Array.from(k).length > 1);
      const pool = isYoon ? yoonPool.concat(D.soundsNew || [], POOL) : POOL;
      const order = shuffle(singles, rand);
      const forPractice = order.slice(0, Math.min(order.length, 10));
      forPractice.forEach((k, i) => practice.push(i % 2 ? hearKana(`${sid}.p${practice.length + 1}`, k, pool, rand, next()) : readKana(`${sid}.p${practice.length + 1}`, k, pool, rand, next())));
      /* two more on the kana of earlier days that look like today's */
      const lookBack = singles.flatMap((k) => Object.keys(LOOK[k] || {}).filter((x) => taught.has(x) && !singles.includes(x) && script(x)));
      for (const x of pick([...new Set(lookBack)], 2, rand)) practice.push(readKana(`${sid}.p${practice.length + 1}`, x, POOL, rand, next()));
      /* the check: five of the day's kana, asked the other way round from the practice */
      pick(order, Math.min(5, order.length), rand).forEach((k) => {
        const wasRead = forPractice.indexOf(k) % 2 === 0;
        check.push(wasRead ? hearKana(`${sid}.c${check.length + 1}`, k, pool, rand, next()) : readKana(`${sid}.c${check.length + 1}`, k, pool, rand, next()));
      });
    }
    if (D.pairs) {
      const ks = shuffle(D.pairs.flatMap(([set]) => Array.from(set)), rand);
      ks.slice(0, 12).forEach((k, i) => practice.push(i % 2 ? hearKana(`${sid}.p${practice.length + 1}`, k, POOL, rand, next()) : readKana(`${sid}.p${practice.length + 1}`, k, POOL, rand, next())));
      pick(ks, 5, rand).forEach((k, i) => check.push(i % 2 ? readKana(`${sid}.c${check.length + 1}`, k, POOL, rand, next()) : hearKana(`${sid}.c${check.length + 1}`, k, POOL, rand, next())));
    }
    if (D.particles) {
      D.particles.forEach((p) => practice.push(particleItem(`${sid}.p${practice.length + 1}`, p, next())));
      pick(D.particles, 5, rand).forEach((p) => check.push(particleItem(`${sid}.c${check.length + 1}`, p, next())));
    }
    if (D.minimal) {
      /* small kana and long sounds: heard and told apart from the word that differs by one beat */
      D.minimal.forEach(([w, other], i) => {
        const wd = lookup(w);
        practice.push(i % 2 ? readWord(`${sid}.p${practice.length + 1}`, wd, rand, next()) : hearWord(`${sid}.p${practice.length + 1}`, wd, rand, next(), [other]));
      });
      pick(D.minimal, 5, rand).forEach(([w, other], i) => {
        const wd = lookup(w);
        check.push(i % 2 ? hearWord(`${sid}.c${check.length + 1}`, wd, rand, next(), [other]) : readWord(`${sid}.c${check.length + 1}`, wd, rand, next()));
      });
    }
    if (!practice.length && !D.minimal && !D.particles) {
      /* a day of words only (the katakana words): reading them is the practice */
      const ws = shuffle(list, rand);
      ws.slice(0, 10).forEach((wd, i) => practice.push(i % 2 ? hearWord(`${sid}.p${practice.length + 1}`, wd, rand, next()) : readWord(`${sid}.p${practice.length + 1}`, wd, rand, next())));
      pick(list, 5, rand).forEach((wd, i) => check.push(i % 2 ? readWord(`${sid}.c${check.length + 1}`, wd, rand, next()) : hearWord(`${sid}.c${check.length + 1}`, wd, rand, next())));
    }
    if (practice.length && practice.length < 10 && !D.pairs && !D.minimal && !D.particles) {
      for (const wd of pick(list, 10 - practice.length, rand)) practice.push(readWord(`${sid}.p${practice.length + 1}`, wd, rand, next()));
    }
    if (practice.length < 8) bad(sid, 'the practice has ' + practice.length + ' questions (8 or more)');
    if (check.length !== 5) bad(sid, 'the check has ' + check.length + ' questions (5)');
    /* the word quiz: three read, three heard */
    const quiz = [];
    if (D.particles) {
      const OTHER = { は: ['わ', 'を', 'へ'], を: ['お', 'は', 'へ'], へ: ['え', 'を', 'は'] };
      pick(D.particles.filter((p) => p[2] !== 'ha' && p[2] !== 'he' && OTHER[Array.from(p[0])[p[1]]]), 6, rand).forEach(([sent, at]) => {
        const wd = lookup(sent);
        const cs = Array.from(sent);
        const k = cs[at];
        const three = OTHER[k].map((x) => cs.slice(0, at).concat(x, cs.slice(at + 1)).join(''));
        const say = { は: 'wa', を: 'o', へ: 'e' }[k];
        quiz.push(choice(`${sid}.w${quiz.length + 1}`, { type: 'ぶん書き', label: 'Pick the right spelling of what you hear', mode: 'hear', q: '_' + wd.r + '_', clip: wd.clip, big: wd.r, gloss: wd.gloss },
          sent, three, [`${sent} is ${wd.r}: ${wd.gloss}`, ...three.map((v, j) => { const x = OTHER[k][j]; const PSAY = { は: 'wa', へ: 'e', を: 'o', わ: 'wa', え: 'e', お: 'o' }; return PSAY[x] === say ? `The little word ${say} is written ${k}, not ${x}.` : `${x} here would be said ${PSAY[x]}; what you hear is ${say}, written ${k}.`; })], next()));
      });
    }
    const qws = shuffle(list.filter((x) => !/[。]/.test(x.w)), rand);
    qws.slice(0, 6 - quiz.length).forEach((wd, i) => quiz.push(i % 2 ? hearWord(`${sid}.w${quiz.length + 1}`, wd, rand, next()) : readWord(`${sid}.w${quiz.length + 1}`, wd, rand, next())));
    if (quiz.length !== 6) bad(sid, 'the word quiz has ' + quiz.length + ' questions (6)');
    /* the writing: the kana three times each, then the words from what is heard */
    const write = Array.from(D.write || '');
    for (const c of write) if (!taught.has(c)) bad(sid, 'writes ' + c + ', not taught yet');
    const dict = (D.dict || []).map((w) => {
      checkWord(sid + '.dict', w);
      const x = WORDS.get(w) || (D.dictGloss && D.dictGloss[w] ? word(w, D.dictGloss[w].split(':')[0], D.dictGloss[w].split(': ')[1]) : null);
      if (!x) bad(sid, `writes ${w}, which has no meaning`);
      return x;
    }).filter(Boolean);
    days[d] = {
      title: D.title,
      kana: { script: U.script, intro: D.intro, cards, drill: practice, check },
      write: { kana: write.join(''), words: dict.map((x) => ({ w: x.w, r: x.r, gloss: x.gloss, clip: x.clip })) },
      words: { list: list.map((x, i) => ({ id: 'w' + (i + 1), ...x })), quiz },
    };
    newSounds.concat(D.soundsNew || []).forEach((k) => unitKana.push(k));
    for (const k of D.pairs ? [] : groups.flat()) if (!unitKana.includes(k)) unitKana.push(k);
    list.forEach((x) => unitWords.push(x));
  });
  /* the week test: 20 questions, the week's kana read and found from their romaji, and the week's words read */
  const rand = rng(pre + 't');
  const test = [];
  let slot = Math.floor(rand() * 4);
  const tid = () => `${pre}t.${test.length + 1}`;
  const script = U.script === 'katakana' ? isKata : isHira;
  const POOL = [...taught].filter((c) => script(c) && !/[ゃゅょっャュョッーィェァォゥ]/.test(c));
  const ks = unitKana.filter((k) => !/^[ぢづヂヅヲを]$/.test(k));
  const yoonPool = YOON.flat().map((k) => (U.script === 'katakana' ? kata(k) : k));
  const poolFor = (k) => (Array.from(k).length > 1 ? yoonPool.concat(['ティ', 'ディ', 'ファ', 'フィ', 'フェ', 'フォ', 'ウィ', 'ウェ', 'ウォ', 'シェ', 'ジェ', 'チェ'].filter((x) => script(x[0]))) : POOL);
  const plain = [...new Set(unitWords.filter((x) => !/[。]/.test(x.w)))];
  const nKana = U.n % 2 ? 12 : 8;
  pick(ks, nKana, rand).forEach((k, i) => test.push(i % 3 === 2 ? hearKana(tid(), k, poolFor(k), rand, slot++, 'かな書き') : readKana(tid(), k, poolFor(k), rand, slot++)));
  const sentDay = U.days.find((D) => D.particles);
  if (sentDay) pick(sentDay.particles, 4, rand).forEach((p) => test.push(particleItem(tid(), p, slot++)));
  pick(plain, 20 - test.length, rand).forEach((wd) => test.push(readWord(tid(), wd, rand, slot++)));
  if (test.length !== 20) bad(pre + 't', 'the week test has ' + test.length + ' questions (20)');
  files[`u${String(U.n).padStart(2, '0')}.json`] = { days, test };
  units.push({ n: U.n, ja: U.ja, en: U.en, days: U.days.slice(0, 5).map((D) => D.title) });
}

/* ---------- every question has one right answer ---------- */
const all = Object.values(files).flatMap((f) => Object.values(f.days).flatMap((d) => [...d.kana.drill, ...d.kana.check, ...d.words.quiz]).concat(f.test));
for (const it of all) {
  const ids = all.filter((x) => x.id === it.id).length;
  if (ids > 1) bad(it.id, 'two questions have this id');
  if (new Set(it.options).size !== it.options.length) bad(it.id, 'two options are the same: ' + it.options.join(' / '));
  if (it.type === 'かな読み' || it.type === 'ことば読み') {
    /* the options are readings: only the right one may be the reading of what is shown */
    const shown = it.big;
    const right = it.type === 'かな読み' ? romaji(shown) : WORDS.get(shown).r;
    if (it.options[it.answer - 1] !== right) bad(it.id, 'the answer is not the reading of ' + shown);
    if (it.options.filter((o) => o === right).length !== 1) bad(it.id, 'the reading is offered twice');
  }
  if (it.type === 'かなを聞く' || it.type === 'かな書き' || it.type === 'ことばを聞く') {
    const said = it.options.map((o) => romaji(o));
    const right = said[it.answer - 1];
    if (said.filter((r) => r === right).length !== 1) bad(it.id, 'two options are said the same: ' + it.options.join(' / '));
  }
  if (it.why.length !== it.options.length || it.why.some((w) => !w)) bad(it.id, 'needs a why line for every option');
}
const answerAt = [0, 0, 0, 0];
for (const it of all) if (it.options.length === 4) answerAt[it.answer - 1]++;

if (problems.length) {
  console.log(problems.length + ' problem(s) in the kana course:\n  ' + problems.join('\n  '));
  process.exit(1);
}

const syllabus = {
  level: 'KANA',
  about: 'The kana course: four weeks before N5 for reading and writing hiragana and katakana. Every week has 5 study days of new kana (learn, write, read words), a まとめ day on the kana that look alike, and a week test. Made by tools/make-kana.mjs: change the tables there, not these files.',
  units,
};
const out = { 'units.json': syllabus, ...files };
/* the clips the course plays: each kana sound (said after a carrier phrase and cut) and each word and sentence */
const clips = { sounds: Object.fromEntries([...SOUNDS].sort()), words: Object.fromEntries([...WORDS.values()].map((x) => [x.clip, { text: x.w, r: x.r }]).sort()) };
out['clips.json'] = clips;
const text = (o) => JSON.stringify(o, null, 1) + '\n';
let same = true;
for (const [name, data] of Object.entries(out)) {
  const file = path.join(OUT, name);
  const have = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (have !== text(data)) same = false;
  if (!CHECK) { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(file, text(data)); }
}
const days = Object.values(files).reduce((n, f) => n + Object.keys(f.days).length, 0);
console.log(`kana course: ${units.length} units, ${days} study days, ${all.length} questions (right answers at 1–4: ${answerAt.join(' ')}), ${WORDS.size} words and sentences, ${SOUNDS.size} kana sounds`);
if (CHECK) { console.log(same ? 'KANA PASS: the content files match the tables' : 'KANA FAIL: the content files differ from the tables; run node tools/make-kana.mjs'); process.exit(same ? 0 : 1); }
