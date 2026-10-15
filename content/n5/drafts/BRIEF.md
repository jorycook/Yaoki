# Brief for drafting one study day of Yaoki N5

You write ONE study day as a JSON object, in exactly the shape of `../../n2/drafts/model-day4.json` (an N2 day; read it first for the shape, and `../../README.md` for the field rules and the markup). The level is different, so the rules below replace the N2 ones wherever they differ. Write the result to the file named in your task, as a single JSON object (the day itself, not wrapped in anything). Do not edit any other file.

## The app and the learner
Yaoki is a JLPT study app. This is the **N5** course: the learner is an adult beginner who can read hiragana and katakana and is preparing for N5 (exam on 6 December 2026). Explanations are in English: short, plain, friendly, for someone who has never studied grammar terms (say "the polite ending", "a noun", "the word before"). No romaji anywhere. Each study day teaches two grammar points, then a comparison, a drill, three exam-style questions, a kanji-and-words scene, and one reading or listening lesson.

## Hard rules (a native-speaking teacher will review; mistakes here cost their limited time)
1. **Every item has exactly one right answer.** Every wrong option must be clearly wrong to a native speaker in that sentence. Check every star (文の文法2) item: the four tiles must fit in only one order; check each tile against every other slot.
2. **No false rules.** A reason line must not teach a rule that is not true in general. If a form is wrong only in this sentence, say why in this sentence.
3. **All sentences are original.** Do not copy from Genki, Minna no Nihongo, other textbooks or past JLPT papers.
4. **Natural Japanese.** Sentences a native speaker would actually say. Polite です／ます style unless the point needs plain forms.
5. **Level.** Only N5 grammar and N5 vocabulary. Grammar may come from any N5 point, but lean on the day's points and earlier units of the syllabus (`../units.json`); keep sentences short (most under 20 characters).
6. **Kanji and furigana.** Only these N5 kanji may appear anywhere:
   一 二 三 四 五 六 七 八 九 十 百 千 万 円 日 月 火 水 木 金 土 年 時 分 半 午 前 後 今 先 週 毎 何 上 下 中 外 右 左 東 西 南 北 人 男 女 子 母 父 友 名 学 校 生 会 社 本 語 国 山 川 天 気 雨 電 車 駅 道 店 食 飲 見 聞 読 書 話 言 行 来 出 入 休 買 立 長 高 安 新 古 大 小 多 少 白 花 空 手 足 目 口 耳 間 魚.
   Any other word is written in kana. In **teach, compare and drill text** (connect rules, examples, watch sentences, compare forms, drill questions and options), every word written in kanji carries its reading: `[学生|がくせい]`, `[食|た]べます`. In **exam-style items, the scene check, reading passages and questions, and listening printed choices**, write kanji without readings, as the real paper does. Never put a reading on the kanji a 漢字読み item asks about.
7. **Reasons for every option.** Choice items in the drill have `why` with one line per option (the right one included). Exam-style items have one `explain` that covers the right answer and why the others fail.
8. **Ids** follow the model but start with `n5`: `n5u01dN.p1`, `n5u01dN.p2` (points), `n5u01dN.c1` (compare check), `n5u01dN.d1`…`d6` (drill), `n5u01dN.e1`…`e3` (exam-style), `n5u01dN.k1` (scene check), `n5u01dN.r1` (reading or listening item). Replace the unit number if your task names another unit.
9. The `title` must be exactly the syllabus title given in your task.

## Spacing and labels (decided after the first drafts)
- Full-width spaces between phrases, as the N5 paper writes them, ONLY in exam-style items (grammar.exam), week-test items, the scene check, reading passages, their questions and options, and the listening `ask`, `q` and printed choices. NO spaces in teach, compare and drill text. Star tiles are never spaced inside; exam-style star `before`/`after`/`full` may be spaced (the build ignores spaces when checking `full`).
- Connect rules write a noun slot as 〜 (never めいし or 名詞); the English `pos` column says what 〜 is.
- Listening item types are written plainly: 発話表現, 即時応答, ポイント理解, 課題理解.

## What a day contains
- `grammar.points`: the two points. For each: `id`, `form`, `gloss` (a few English words), `connect` (2 to 3 rows: `pos` in plain English such as "Noun" or "Verb, ます form"; `rule` in Japanese with the form in {…}), two `examples` (Japanese with the form in {…} and readings on kanji, plus an English translation; no `clip`), and `watch` (the typical beginner mistake: `note`, one wrong sentence `bad` and its corrected sentence `good`, plain text without markup or readings).
- `grammar.compare`: `intro` (one sentence), three `forms` (the two new points and one earlier point or a common confusion; `mark`: dot for neutral, down for a negative meaning, up for "more"; `tag` = short Japanese label · English gloss), and a `check` choice item with three options.
- `grammar.drill`: six items: four choice items (文の文法1, four options) and two star items (文の文法2), at least two on each point. Use ^…^ to mark the clue in a choice sentence. Star items need `hint`, `full`, `explain`, `star` (0 to 3) and a `bank` order (indexes 0 to 3) that is not already 0,1,2,3.
- `grammar.exam`: three items in strict exam format: two 文の文法1 (four options, `explain`) and one 文の文法2 star item. No readings.
- `scene`: a real place or situation where a beginner meets 8 written words (a sign, a menu, a form, a timetable). `ja`, `en`, `intro` (one English sentence telling the learner what to tap), and 8 `words`, each with `id` (short English), `word` (written as on the sign), `reading`, `gloss`, `parts`: one entry per kanji, as [kanji, reading of that kanji in this word in kana (katakana for on'yomi), short meaning]; a word with okurigana lists its kanji only. Mostly words with N5 kanji. Then a `check` choice item in an N5 vocabulary format, using one of the day's words: 漢字読み (q with the _word_ underlined, four kana readings), 表記 (q with the _kana word_ underlined, four kanji spellings), 文脈規定 (（　　）, four words), or 言い換え類義 (q with a _phrase_ underlined; four sentences, the one closest in meaning is right). `explain` gives the reason.
- `skill`: as given in your task.
  - Reading: `kind: "reading"`, `ja`/`en` the skill (内容理解（短文） Short passage, 情報検索 Finding information), `ask` (the English question the skill trains), `seconds` (60 to 120), `passage` (80 to 150 characters, original, N5, written as the paper writes it, with ^…^ around the words the explanation points to), `strategy` (one English sentence: what to look for), and `item`: a choice item with type `読解・<skill>`, `q` the Japanese question, four `options`, `short`, `answer`, `explain`, and `why` (one line per option; the right one may be "").
  - Listening: `kind: "listening"`, `ja`/`en` (the item type), `ask` (the Japanese instruction shown on screen), and `item`: a choice item with `type`, `q`, `script` (every spoken line as an array of strings starting 男： 女： or ナレーター：), `options`, `printed`, `short`, `answer`, `why`. Also `audio` at the skill level: the exact lines to synthesise, as [speaker, text, respelling-or-null] with speaker N (narrator), M (man) or F (woman). Write audio text in kana and N5 kanji; give a kana respelling wherever a voice could misread (numbers, counters, times, 何, names).
    - 発話表現 Expressions: on the paper a picture shows a situation. Here `situation` (at the skill level) is one English sentence describing the picture, `ask` is the Japanese question (e.g. 友だちに　ペンを　かりたいです。何と　いいますか。), `q` is the same question, three spoken `options` (not printed: `printed: false`), and `audio`: N the question, then N "1", the option, N "2", the option, N "3", the option.
    - 即時応答 Quick response: `q` is the line itself (男：…), three spoken replies, `printed: false`; audio: the line, then N "1", reply, N "2", reply, N "3", reply.
    - ポイント理解 / 課題理解: four printed choices (`printed: true`); audio: N reads the situation and the question, then the conversation, then N reads the question again.

## Style of the English
Plain, short sentences. No em-dashes. Explain with the sentence in front of the learner ("も replaces は here because the second person is a student too").

## Before you finish
Re-read every item as a strict examiner. For each choice item, try each wrong option in the sentence and confirm it fails for the reason you gave. For each star item, try other orders. Make sure every `full` equals before + tiles + after exactly, character for character (readings in `full` are allowed; they are removed before comparing). Check every kanji against the list in rule 6. Then validate your JSON (python3 -c "import json;json.load(open('FILE'))").
At the end, report in under 150 words: anything you were unsure about (naturalness, level, a kanji or word you were not sure is N5), so it can be flagged amber for the reviewer.
