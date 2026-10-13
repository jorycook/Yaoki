# Brief: the N5 mini mock (12 questions)

The app has a short timed mini mock: the N5 paper in miniature, one original question for each main item type, asked in exam conditions with a clock, then marked with a reason for each question. Read `BRIEF.md` in this folder first: its rules on level, the N5 kanji list, natural Japanese, one right answer and spacing all apply. Exam conditions: no readings anywhere, spaces between phrases as the N5 paper writes, rubrics in the paper's style (mostly kana, spaced).

Write `/home/claude/yaoki/content/n5/mini.json`: {"about": "...", "items": [12 items]} in this order, ids n5mock1 … n5mock12:

Section 1, 言語知識（もじ・ごい）・ぶんぽう・どっかい (one clock):
1. 漢字読み (label もんだい1): q with the _kanji word_ underlined, four kana readings.
2. 表記 (もんだい2): q with the _kana word_ underlined, four spellings.
3. 文脈規定 (もんだい3): q with （　　）, four words.
4. 言い換え類義 (もんだい4): q with a _phrase_ underlined, four sentences; the one closest in meaning is right.
5. 文の文法1 (もんだい1, the grammar part): （　　） and four options.
6. 文の文法1 (もんだい1): another grammar point.
7. 文の文法2 (もんだい2): a star item, written as a choice item: `before`, `after` (text around the four blanks), `star` (0 to 3: which blank carries ★), `options` (the four tiles in the order printed, numbered 1 to 4), `order` (the option numbers in the right sentence order, e.g. [3, 1, 4, 2]), and `answer` = the option number that lands on ★. Also `q` = before + "＿＿　＿＿　★　＿＿" style placeholder + after (★ in the right blank).
8. 読解・内容理解（短文） (もんだい4 of reading): `passage` (80 to 150 characters, \n line breaks allowed), `q`, four options, `short`.
9. 読解・情報検索 (もんだい6): `passage` a notice or timetable (\n allowed), `q`, four options, `short`. No answer that depends on a boundary time.

Section 2, ちょうかい (paced by the audio):
10. 課題理解 (もんだい1): `q` the question; four printed `options`; `script` (the whole thing as text, lines starting 男： 女： or the narrator line with no prefix, joined by \n); `parts`: [
   {"k":"q","ja":"しつもん","en":"the question","sim":2000,"lines":[["N","<situation and question>",null]]},
   {"k":"talk","ja":"はなし","en":"the conversation","sim":4200,"lines":[["M"|"F","...",respelling|null], ...]},
   {"k":"q2","ja":"しつもん","en":"the question again","sim":1600,"lines":[["N","<the question>",null]]},
   {"k":"ans","ja":"こたえ","en":"answer time","wait":8000,"sim":6000} ]
11. ポイント理解 (もんだい2): same shape as 10, a different situation.
12. 即時応答 (もんだい4): `q` the line (男：… or 女：…); three spoken `options`; `short`; `script`; `parts`: [
   {"k":"line","ja":"ぶん","en":"the line","sim":1600,"lines":[["M"|"F","...",null]]},
   {"k":"replies","ja":"へんじ 1・2・3","en":"the three replies","sim":3400,"lines":[["N","1",null],["F"|"M","...",null],["N","2",null],["F"|"M","...",null],["N","3",null],["F"|"M","...",null]]},
   {"k":"ans","ja":"こたえ","en":"answer time","wait":6000,"sim":5000} ]
Give a kana respelling (third element) for any line where a voice could misread numbers, times, counters, 何 or names.

Every item: "kind": "choice", "type" (as above), "label", "rubric" (the paper-style instruction for that 問題, in kana with N5 kanji only, spaced), "q", "options", "answer" (1-based), "explain" (English: why the answer is right and each other option wrong). Readings: none. Do not reuse sentences from the course units (content/n5/u0*.json); everything original.

Check before finishing: JSON loads; every kanji in the Japanese is on the N5 list; each item has one right answer only (try every wrong option); the star `order` gives a natural sentence and only one; options differ.
