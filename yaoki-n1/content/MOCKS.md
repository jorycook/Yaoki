# N1 mini mock files

One file per mini mock: `content/mocks/m<id>.json` (`m1.json`, `m2.json`, …). `content/mocks/m1.json` is the finished
example: match its shape, tone and level. `node tools/build-content.mjs` puts every file of the folder into
`project/n1-content.js`, in file-name order, and the app shows them in that order.
`node tools/check-mocks.mjs <file>` checks a file against everything below; a file is done when it reports no problems.

A mini mock is the real N1 paper cut short, about 12 questions and 15 minutes: section 1 (文字・語彙, 文法 and 読解 on one
clock), a short break, then section 2 (聴解, paced by the audio, which plays once). The Mock tab lists every mock with
the week of the learner's plan after which it is best taken, and its last score. MockRun runs one: the paper, the
answer sheet, the break with its sound check, the listening, then the result by section and area, and the answers with
their reasons. Every question missed goes to the notebook, named `m<id>.<n>` (mock id, place in the whole paper).

## Markup inside Japanese text

- `【…】` in a question sentence underlines the word the question is about (漢字読み, 言い換え類義). In `full` it
  marks the answer, which the answers page highlights. In a passage or a text of a pair it underlines a part a
  question asks about.
- `（　　）` (full-width brackets around two full-width spaces) is the blank of a question.
- `＿＿★＿` are the four blanks of a sentence-order question (文の文法2): three full-width low lines `＿` and one `★`
  for the starred blank, written in the sentence where they stand.
- `漢字《よみ》` is allowed only in a listening script line: the script shows the reading as furigana, and the voice
  says the reading. Use it where a voice would misread a word (技術畑《ぎじゅつばたけ》). No furigana on the paper.
- Lengths below count what the learner sees: markup and blanks are not counted. The screens are 390 × 844 and hold every limit
  at once without scrolling; past a limit the question scrolls.

## The file

```
{
  "id": 2,                                   // whole number, unique; the file is m2.json
  "title": "ミニ模試 2", "en": "Mini mock 2",
  "after": 4,                                // when it is best taken (below)
  "about": { "ja": "…", "en": "…" },         // one line on the Mock tab before it is taken
  "break": 1,                                // minutes between the sections
  "sections": [ SECTION 1, SECTION 2 ]       // exactly two, in this order
}
```

| field | what | limit |
|---|---|---|
| `id` | 1, 2, 3 …; never reuse an id: results and notebook entries are kept under it | |
| `title`, `en` | the mock's name as the tab and the run show it | ja 8, en 14 |
| `after` | how many of the 8 grammar units should have been taught first: the tab shows "Best after week n" for the week of the plan in which they are. In a plan too short to teach every lesson it is the same share of what the plan teaches. 0 means any time. For four mocks: 2, 4, 6, 8 | 0 to 8 |
| `about` | what this mock is for, in a sentence: ja shown bold, en after it | ja 26, en 70 |
| `break` | the break in minutes | 1 to 10 |

### SECTION

| field | what | limit |
|---|---|---|
| `ja`, `short`, `en` | the section's name in full (briefing, break), short (band at the top, result) and in English | ja 18, short 8, en 30 |
| `min` | section 1 only: its clock in minutes. Section 2 has no clock: the audio sets the pace | 5 to 20 |
| `items` | the questions, in the order of the real paper. Section 1: 8 or 9 (the band at the top of the paper has no room for a count of 10 beside the section name); section 2: 2 to 4 | |

Use the same names as `m1.json`: `言語知識（文字・語彙・文法）・読解` / `言語知識・読解` / `Vocabulary, grammar, reading`, and
`聴解` / `聴解` / `Listening`.

### ITEM: what every question has

| field | what | limit |
|---|---|---|
| `m` | the 問題 number it would have on a real N1 paper, as `"問題5"`; listening counts from 問題1 again | 5 |
| `type` | the question type, as below | 8 |
| `area` | `"v"` 文字・語彙, `"g"` 文法, `"r"` 読解, `"l"` 聴解: the answers page and the result by area use it. Every area needs at least one question | |
| `kind` | how the screen lays it out, as below | |
| `rubric` | the instruction line of that 問題, as on the real paper (copy it from the table below) | 50 |
| `options` | the choices as printed, in the order printed: 4, or 3 for 即時応答 | see the kind |
| `answer` | which option is right, 1 to 4; vary the position across the mock | |
| `short` | the same options as short labels, for "your answer" and the notebook. Needed when an option is over 16 characters | 16 each |
| `why` | why the answer is right and, briefly, why the others are not | 240 |

The number shown on a question is worked out by the screen (its place in its section), so it is not in the file.

### Section 1 kinds

| kind | for | fields | limits |
|---|---|---|---|
| `sentence` | 漢字読み, 文脈規定, 言い換え類義, 文の文法1, 文の文法2 | `ja`: the sentence, with `【…】`, `（　　）` or `＿＿★＿`; `full`: the same sentence with the answer in place and in `【】` (for 漢字読み and 言い換え類義 the word with the answer in brackets: `【拒んだ（こばんだ）】`; for 文の文法2 the whole sentence in order, with only the ★ part in `【】`) | ja 50, full 70, options 12 |
| `usage` | 用法 | `word`: the word asked about; `options`: four sentences using it, one correctly; `full`: the right sentence with the word in `【】` | word 8, options 30, full 70 |
| `passage` | 文章の文法, 内容理解 (and other one-text reading) | `lead` (optional): a line above the text, as `以下は、ある新聞のコラムである。`; `passage`: one or two paragraphs, as a list; `ask`: the question | lead 26, passage 180 in all, ask 30, options 20 |
| `pair` | 統合理解 | `texts`: the two texts A and B, as a list; `ask` | texts 100 each, ask 30, options 20 |

### Section 2 kinds (listening)

Nothing of a listening question is printed but the choices of 課題理解. The audio is said in parts, one clip each, and
after the last part comes the answer time.

| kind | for | parts, in order | limits |
|---|---|---|---|
| `task` | 課題理解 | `q` the situation and the question, `talk` the conversation, `q2` the question again | options 16 (printed) |
| `gist` | 概要理解 | `talk` the situation and the talk, `choices` the question and the four choices, numbered | options 20 |
| `quick` | 即時応答 | `line` the one line, `replies` the three replies, numbered | options 24 (three replies) |

| field | what | limit |
|---|---|---|
| `ask` | the question as the answers page and the notebook show it: for 即時応答 the line itself, as `"女：…"` | 30, 即時応答 45 |
| `audio` | the parts, in the order above: `{ "part": "talk", "lines": [[who, text], …] }` | a line 180, a talk 300 in all |
| `wait` | the answer time in seconds | 4 to 15 |

`who` in a line: `""` the narrator, `"男"` the man, `"女"` the woman, `"1"` to `"4"` a numbered choice or reply (said
with its number: by the narrator in 概要理解, by the other speaker than the line's in 即時応答). The answers page shows
these lines as the script.

**Clips.** Each part is one clip, named `m<id>.<n>.<part>`, where n is the question's place in the whole paper: in a
mock of 9 + 3 questions, `m2.10.q`, `m2.10.talk`, `m2.10.q2`, `m2.11.talk`, `m2.11.choices`, `m2.12.line`,
`m2.12.replies`. They are made from the part's lines and kept as files in `project/audio/` (named in
`project/audio/clips.js`). Mock 1 is older: its clips are kept in `project/sound-mock.js` under the names its parts give
in `"clip"` (`m10_q` and so on). Do not write `"clip"` in a new mock. Until a mock's clips exist, its listening runs on
timing alone and says so.

## The shape of a mock

Section 1 follows the real paper's order. `m1.json` has nine questions:

| `m` | `type` | `area` | `kind` | `rubric` |
|---|---|---|---|---|
| 問題1 | 漢字読み | v | sentence | ＿＿＿の言葉の読み方として最もよいものを選びなさい。 |
| 問題2 | 文脈規定 | v | sentence | （　　）に入れるのに最もよいものを選びなさい。 |
| 問題3 | 言い換え類義 | v | sentence | ＿＿＿の言葉に意味が最も近いものを選びなさい。 |
| 問題4 | 用法 | v | usage | 次の言葉の使い方として最もよいものを選びなさい。 |
| 問題5 | 文の文法1 | g | sentence | （　　）に入れるのに最もよいものを選びなさい。 |
| 問題6 | 文の文法2 | g | sentence | 次の文の★に入る最もよいものを選びなさい。 |
| 問題7 | 文章の文法 | g | passage | 次の文章を読んで、文章全体の内容を考えて、（　　）に入る最もよいものを選びなさい。 |
| 問題8 | 内容理解（短文） | r | passage | 次の文章を読んで、後の問いに対する答えとして最もよいものを選びなさい。 |
| 問題11 | 統合理解 | r | pair | 次のAとBの文章を読んで、後の問いに対する答えとして最もよいものを選びなさい。 |

Section 2 has three:

| `m` | `type` | `kind` | `rubric` | `wait` |
|---|---|---|---|---|
| 問題1 | 課題理解 | task | まず質問を聞いてください。それから話を聞いて、最もよいものを選んでください。 | 8 |
| 問題3 | 概要理解 | gist | まず話を聞いてください。それから、質問とせんたくしを聞いて、最もよいものを選んでください。 | 8 |
| 問題4 | 即時応答 | quick | まず文を聞いてください。それから、それに対する返事を聞いて、最もよいものを選んでください。 | 6 |

Keep this shape in every mock, so each one tests every area the same way. A mock may swap a question for another of
the same kind (内容理解（中文） for 内容理解（短文）, say), within the limits.

## Style

- As in `FORMAT.md`: English plain and short, British spelling, no exclamation marks. Japanese natural and correct at
  N1 level, for adults: work, news, society, everyday life. No real people or companies.
- Each question has exactly one right answer, for a reason a learner can see. Wrong options are real Japanese that is
  wrong here, never nonsense.
- Everything is original: do not copy from textbooks or past papers, and do not reuse the lessons' own sentences.
- A spoken talk is about 150 ms a character: a talk of 300 characters takes about 45 seconds.
