/*
 * Yaoki Speaking's first steps, あいうえお: hiragana and katakana from the start, for someone who has never read
 * Japanese. One lesson for each row of the kana table (and the marks ゛ ゜, the small ゃ ゅ ょ っ and the long ー),
 * in the order a Japanese child learns them. Each lesson brings in its new kana and a few common words made only of
 * kana already taught, so reading and saying go together from the start.
 *
 * window.SpeakingLessons = {
 *   SCRIPTS: [{ id: 'hiragana' | 'katakana', ja, en, lessons: [lesson] }],
 *   lesson = { id, n, kana: [kana], marks?: [mark], words: [{ text, kanji?, gloss }], note? }
 *     kana     the new kana, as they are said one by one (きゃ is one)
 *     marks    what the lesson's note teaches that is never said on its own (っ, ー)
 *     words    common words of kana and marks taught so far; `kanji`, how a phone usually writes the word, where it does
 *     note     what is new in the lesson besides the kana (the marks ゛ ゜, a small kana, ー)
 *   all(script)                       every kana of a script, lesson by lesson
 * }
 * No DOM here: the same file runs in Node (check/speaking-engine-test.js checks that every word is made of kana taught).
 */
(function (root) {
  'use strict';

  const w = (text, gloss, kanji) => (kanji ? { text, kanji, gloss } : { text, gloss });

  const HIRAGANA = [
    { kana: ['あ', 'い', 'う', 'え', 'お'], words: [w('あい', 'love', '愛'), w('いえ', 'house', '家'), w('うえ', 'up, above', '上'), w('あお', 'blue', '青')] },
    { kana: ['か', 'き', 'く', 'け', 'こ'], words: [w('あか', 'red', '赤'), w('かお', 'face', '顔'), w('えき', 'station', '駅'), w('こえ', 'voice', '声'), w('あき', 'autumn', '秋')] },
    { kana: ['さ', 'し', 'す', 'せ', 'そ'], words: [w('あさ', 'morning', '朝'), w('いす', 'chair', '椅子'), w('すし', 'sushi', '寿司'), w('かさ', 'umbrella', '傘'), w('せかい', 'world', '世界')] },
    { kana: ['た', 'ち', 'つ', 'て', 'と'], words: [w('くつ', 'shoes', '靴'), w('そと', 'outside', '外'), w('した', 'below', '下'), w('ちかてつ', 'subway', '地下鉄'), w('たかい', 'tall, dear', '高い')] },
    { kana: ['な', 'に', 'ぬ', 'ね', 'の'], words: [w('いぬ', 'dog', '犬'), w('ねこ', 'cat', '猫'), w('なつ', 'summer', '夏'), w('にく', 'meat', '肉'), w('あなた', 'you')] },
    { kana: ['は', 'ひ', 'ふ', 'へ', 'ほ'], words: [w('はな', 'flower', '花'), w('ひと', 'person', '人'), w('ふね', 'ship', '船'), w('ほし', 'star', '星'), w('ひこうき', 'aeroplane', '飛行機')] },
    { kana: ['ま', 'み', 'む', 'め', 'も'], words: [w('うみ', 'sea', '海'), w('むし', 'insect', '虫'), w('あめ', 'rain', '雨'), w('もも', 'peach', '桃'), w('さかな', 'fish', '魚')] },
    { kana: ['や', 'ゆ', 'よ'], words: [w('やま', 'mountain', '山'), w('ゆき', 'snow', '雪'), w('へや', 'room', '部屋'), w('やさい', 'vegetable', '野菜')] },
    { kana: ['ら', 'り', 'る', 'れ', 'ろ'], words: [w('とり', 'bird', '鳥'), w('はる', 'spring', '春'), w('くるま', 'car', '車'), w('そら', 'sky', '空'), w('さくら', 'cherry blossom', '桜')] },
    {
      kana: ['わ', 'を', 'ん'], words: [w('わたし', 'I, me', '私'), w('かわ', 'river', '川'), w('ほん', 'book', '本'), w('みかん', 'mandarin orange'), w('にほん', 'Japan', '日本')],
      note: 'を sounds just like お; in a sentence it marks what is done to something. ん is a sound of its own, like the n of "sun".',
    },
    {
      kana: ['が', 'ぎ', 'ぐ', 'げ', 'ご', 'ざ', 'じ', 'ず', 'ぜ', 'ぞ', 'だ', 'ぢ', 'づ', 'で', 'ど'],
      words: [w('かぎ', 'key', '鍵'), w('かぜ', 'wind', '風'), w('ちず', 'map', '地図'), w('でんわ', 'telephone', '電話'), w('だいがく', 'university', '大学')],
      note: 'Two small strokes ゛ make a sound voiced: か ka becomes が ga, さ sa ざ za, た ta だ da. ぢ and づ sound just like じ and ず.',
    },
    {
      kana: ['ば', 'び', 'ぶ', 'べ', 'ぼ', 'ぱ', 'ぴ', 'ぷ', 'ぺ', 'ぽ'],
      words: [w('ぶた', 'pig', '豚'), w('かばん', 'bag', '鞄'), w('えんぴつ', 'pencil', '鉛筆'), w('さんぽ', 'a walk', '散歩'), w('てんぷら', 'tempura', '天ぷら')],
      note: 'With ゛ は ha becomes ば ba; with the small circle ゜ it becomes ぱ pa.',
    },
    {
      kana: ['きゃ', 'きゅ', 'きょ', 'しゃ', 'しゅ', 'しょ', 'ちゃ', 'ちゅ', 'ちょ', 'じゃ', 'じゅ', 'じょ'], marks: ['っ'],
      words: [w('おちゃ', 'tea', 'お茶'), w('しゃしん', 'photo', '写真'), w('きょう', 'today', '今日'), w('いしゃ', 'doctor', '医者'), w('きって', 'stamp', '切手'), w('がっこう', 'school', '学校')],
      note: 'A small ゃ ゅ ょ joins the kana before it into one sound: き + ゃ is きゃ kya. A small っ is a short stop before the next sound: きって kit-te.',
    },
  ];

  const KATAKANA = [
    { kana: ['ア', 'イ', 'ウ', 'エ', 'オ'], words: [], note: 'Katakana are the same sounds as hiragana, written another way. They are used for words from other languages, and for names.' },
    { kana: ['カ', 'キ', 'ク', 'ケ', 'コ'], words: [w('ココア', 'cocoa'), w('カカオ', 'cacao')] },
    {
      kana: ['サ', 'シ', 'ス', 'セ', 'ソ'], marks: ['ー'], words: [w('アイス', 'ice cream'), w('スキー', 'skiing'), w('ケーキ', 'cake')],
      note: 'A line ー makes the sound before it long: ケーキ kēki, cake.',
    },
    { kana: ['タ', 'チ', 'ツ', 'テ', 'ト'], words: [w('テスト', 'test'), w('タクシー', 'taxi'), w('スケート', 'skating'), w('セーター', 'sweater')] },
    { kana: ['ナ', 'ニ', 'ヌ', 'ネ', 'ノ'], words: [w('ネクタイ', 'necktie'), w('ノート', 'notebook'), w('テニス', 'tennis'), w('カヌー', 'canoe')] },
    { kana: ['ハ', 'ヒ', 'フ', 'ヘ', 'ホ'], words: [w('コーヒー', 'coffee'), w('ハート', 'heart'), w('ソフト', 'soft')] },
    { kana: ['マ', 'ミ', 'ム', 'メ', 'モ'], words: [w('トマト', 'tomato'), w('メモ', 'memo'), w('ハム', 'ham'), w('ホーム', 'platform')] },
    { kana: ['ヤ', 'ユ', 'ヨ'], words: [w('タイヤ', 'tyre'), w('ヨーヨー', 'yo-yo'), w('ユニホーム', 'uniform')] },
    { kana: ['ラ', 'リ', 'ル', 'レ', 'ロ'], words: [w('カメラ', 'camera'), w('ホテル', 'hotel'), w('トイレ', 'toilet'), w('アメリカ', 'America')] },
    {
      kana: ['ワ', 'ヲ', 'ン'], words: [w('ワイン', 'wine'), w('ラーメン', 'ramen'), w('メロン', 'melon'), w('レモン', 'lemon')],
      note: 'ヲ sounds like オ and is hardly ever used. ン is a sound of its own.',
    },
    {
      kana: ['ガ', 'ギ', 'グ', 'ゲ', 'ゴ', 'ザ', 'ジ', 'ズ', 'ゼ', 'ゾ', 'ダ', 'ヂ', 'ヅ', 'デ', 'ド'],
      words: [w('ゲーム', 'game'), w('ラジオ', 'radio'), w('デザート', 'dessert'), w('ガム', 'chewing gum')],
      note: 'The marks are the same as in hiragana: カ ka becomes ガ ga with ゛.',
    },
    {
      kana: ['バ', 'ビ', 'ブ', 'ベ', 'ボ', 'パ', 'ピ', 'プ', 'ペ', 'ポ'],
      words: [w('テレビ', 'television'), w('バス', 'bus'), w('パン', 'bread'), w('ピアノ', 'piano'), w('ペン', 'pen')],
      note: 'ハ ha becomes バ ba with ゛, and パ pa with ゜.',
    },
    {
      kana: ['キャ', 'キュ', 'キョ', 'シャ', 'シュ', 'ショ', 'チャ', 'チュ', 'チョ', 'ジャ', 'ジュ', 'ジョ'], marks: ['ッ'],
      words: [w('シャツ', 'shirt'), w('ジュース', 'juice'), w('チョコレート', 'chocolate'), w('ベッド', 'bed'), w('サッカー', 'football'), w('コップ', 'cup')],
      note: 'As in hiragana, a small ャ ュ ョ joins the kana before it into one sound, and a small ッ is a short stop: ベッド bed-do.',
    },
  ];

  const SCRIPTS = [
    { id: 'hiragana', ja: 'ひらがな', en: 'Hiragana', lessons: HIRAGANA },
    { id: 'katakana', ja: 'カタカナ', en: 'Katakana', lessons: KATAKANA },
  ];
  for (const s of SCRIPTS) {
    s.lessons.forEach((l, i) => {
      l.n = i + 1;
      l.id = s.id[0] + l.n;
      l.script = s.id;
    });
  }
  const all = (script) => [].concat(...(SCRIPTS.find((s) => s.id === script) || SCRIPTS[0]).lessons.map((l) => l.kana));

  root.SpeakingLessons = { SCRIPTS, all };
  if (typeof module === 'object' && module.exports) module.exports = root.SpeakingLessons;
})(typeof window !== 'undefined' ? window : globalThis);
