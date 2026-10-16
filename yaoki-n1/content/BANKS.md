# N1 content banks

Besides the lessons (`FORMAT.md`) and the mini mocks (`MOCKS.md`), the course has four banks. The plan lays the first
three out over the learner's days with the lessons; the fourth is the review of earlier levels, which the day quizzes,
week tests and review days draw on. `node tools/check-banks.mjs [files…]` checks them all; `node tools/build-content.mjs`
puts them in the app.

The markup, limits and style are those of `FORMAT.md`: `【…】` highlights, `漢字《よみ》` furigana (teach text only),
`（　　）` the blank; lengths count what the learner sees; plain British English; original Japanese for adults; no real
people, companies, brands or works; exactly one right answer for a reason a learner can see.

## Words: `content/words/u<unit>.json`

Fifteen more words for each lesson of the unit, taught on the days around that lesson, after the lesson's own five.

```
{ "unit": 3, "lessons": { "1": [ WORD × 15 ], "2": [ … ], … "6": [ … ] } }
```

WORD is `FORMAT.md`'s WORD (`w`, `r`, `en`, `ex`, `q`) with one more field: `kind`, one of `adverb`, `verb`, `noun`,
`adjective`, `katakana`, `expression`. Rules:

- Genuinely N1: words that come up in N1 文脈規定, 言い換え類義 and 用法 questions (adverbs of manner and degree,
  compound verbs, Sino-Japanese nouns and する verbs, な and い adjectives, katakana words, idioms). No word that is
  taught by the syllabus or by another lesson's bank; no word that is the lesson's own grammar.
- Each lesson's fifteen mix the kinds (at least four kinds) and the question types (at least four of each of
  文脈規定, 言い換え類義 and 用法), and vary the answer position.
- Lengths: `w` 8, `r` 12, `en` 34, `ex.ja` 30 (the word in `【】`), `ex.en` 70; questions as in `FORMAT.md`.

## Reading: `content/reading/u<unit>.json`

One longer reading item for each lesson of the unit: the kinds of the N1 paper the lessons' short items do not cover.

```
{ "unit": 3, "items": [ READING2 × 6 ] }      // items[0] goes with lesson 1, items[5] with lesson 6
```

| field | what | limit |
|---|---|---|
| `lesson` | 1 to 6 | |
| `kind` | `mid` (lessons 1, 3, 5), `info` (2, 4), `pair` (6) | |
| `type` | the paper's name: 内容理解（中文）, 情報検索, 統合理解 | 10 |
| `skill` | the skill in Japanese (理由, 下線部の意味, 対比, 筆者の主張, 必要な情報 …) | 8 |
| `en` | the skill as a question | 40 |
| `lead` | optional: a line above the text (以下は、ある市の広報の一部である。) | 26 |
| `passage` | `mid`: 2 or 3 paragraphs as a list, 360 characters in all, the 2 or 3 signposts in `【】`; `info`: a notice, timetable, price list or set of conditions as lines, 360 in all, the lines the answer turns on in `【】` | 360 in all |
| `texts` | `pair` only: the two texts A and B, each a stance on one question | 150 each |
| `ask` | the question | 30 |
| `options` | 4 | 24 each |
| `short` | the same 4 as short labels | 16 each |
| `answer` | 1 to 4 | |
| `tip` | a strategy hint for this kind of question | 105 |
| `why` | why the answer is right, pointing at the signposts | 140 |
| `whyNot` | 4 entries in option order: `""` for the answer, else why not, starting "Option n …" | 100 each |

`info` questions give a person and a need (a learner who can only come on Saturdays, a family of four with a child
under six …) and ask which choice, price or deadline applies, so the learner must read the conditions. A `pair` asks what
A and B share or where they differ, never a question only one text answers.

## Listening: `content/listening/u<unit>.json`

One longer listening item for each lesson: the kinds of the N1 paper the lessons' quick-response items do not cover.

```
{ "unit": 3, "items": [ LISTENING2 × 6 ] }     // items[0] goes with lesson 1
```

| field | what | limit |
|---|---|---|
| `lesson` | 1 to 6 | |
| `kind` | `task` (lessons 1, 4), `point` (2, 5), `gist` (3, 6) | |
| `type` | 課題理解, ポイント理解, 概要理解 | 8 |
| `ask` | the question, as the screen and the notebook show it | 30 |
| `options` | 4; printed on the screen for `task` and `point`; for `gist` they are only spoken, as on the paper, and the screen shows the numbers 1 to 4 | 20 each |
| `short` | the same 4 as short labels | 16 each |
| `answer` | 1 to 4 | |
| `audio` | the parts, in order, as `MOCKS.md` writes them: `{ "part": "talk", "lines": [[who, text], …] }`. `task` and `point`: `q` (the situation and the question), `talk` (the conversation or the talk), `q2` (the question again). `gist`: `talk` (the situation, then the talk), `choices` (the question, then the four choices numbered 1 to 4). `who` is `""` the narrator, `"男"`, `"女"`, or `"1"` to `"4"` for a numbered choice | a line 180, a talk 300 in all |
| `wait` | the answer time in seconds | 4 to 15 |
| `why` | why the answer is right and, briefly, why the others are not | 200 |

`task` asks what someone must do first or next; `point` asks a specific thing (why, what the speaker thinks of X,
which one they chose); `gist` asks what the talk is about or what the speaker most wants to say. The talk must decide
the answer on its own: a learner who reads only the options cannot pick it. Scenes and speakers vary across the unit.
Clips are `l.<lesson id>.<part>` (`l.u3l2.talk`), made by `make-sound.py` into `project/audio/`.

## Review of the N2 grammar: `content/review-n2.json`

The 120 N2 patterns of the main app's N2 syllabus (`content/n2/units.json`: 12 units of 5 days, two patterns a day),
each with a one-line reminder and one question. The N1 app's day quizzes, week tests and review days draw on it with
the N3 and N2 course items (`tools/make-review.mjs`) and the N2 kanji.

```
{ "patterns": [ { "p": "〜うちに", "en": "while (still) …", "unit": 1, "conn": "動詞辞書形・ている ＋ 【うちに】",
                  "ex": { "ja": "…【うちに】…", "en": "…" },
                  "q": { "ja": "…（　　）…", "options": [4], "answer": 2, "why": "…" } } × 120 ] }
```

| field | limit |
|---|---|
| `p` 10 · `en` 36 · `conn` 24 (the pattern in `【】`) · `ex.ja` 32 (the pattern in `【】`) · `ex.en` 80 | |
| `q.ja` 40 (with `（　　）`) · `q.options` 4 × 9 · `q.why` 140 | |

The question's wrong options are other N2 or N3 patterns a learner mixes up with it. The sentences are new: not the
N2 course's own examples.
