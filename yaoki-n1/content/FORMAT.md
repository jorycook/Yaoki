# N1 lesson files

One file per lesson: `content/lessons/u<unit>l<lesson>.json` (8 units of 6 lessons; unit 3 lesson 4 is `u3l4.json`).
`content/lessons/u3l4.json` is the finished example: match its tone, length and level of detail.
`node tools/check-content.mjs <file>` checks a file against everything below; a file is done when it reports no problems.

## Markup inside Japanese text

- `【…】` marks text the screen highlights: the grammar pattern in an example, the clue in a drill, the signposts in a reading passage, the underlined word in a question.
- `漢字《よみ》` puts furigana over the kanji just before it (one run of kanji). Use it only on teach-page examples, for words above N1 or rare readings, at most two per sentence.
- `（　　）` (full-width brackets around two full-width spaces) is the blank in a question.
- Lengths below count what the learner sees: markup and furigana are not counted.

## The file

```
{
  "id": "u3l4", "unit": 3, "lesson": 4,
  "grammar": {
    "patterns": [ PATTERN, PATTERN, PATTERN ],     // exactly 3, in the order the syllabus gives
    "compare": COMPARE,
    "drills": [ DRILL, DRILL, DRILL ],             // one per pattern, same order; its answer is that pattern
    "star": STAR,                                 // one sentence-order question using one of the three patterns
    "exam": [ EXAM, EXAM, EXAM ]                  // two "form" questions and one "order" question, exam style
  },
  "vocab": [ WORD × 5 ],                          // the syllabus's five words, in its order
  "reading": READING,
  "listening": LISTENING
}
```

### PATTERN (one teach page)

| field | what | limit |
|---|---|---|
| `p` | the pattern as the syllabus writes it, with 〜 | 10 chars |
| `en` | short English meaning, lower case, may end in … | 36 chars |
| `conn` | 1 to 3 rows `[label, formula]`: label is the word class (動詞, い形, な形, 名詞, 動・い形, 普通形 …), formula shows the connection with the pattern in 【】, e.g. `"普通形 ＋ 【とあって】"` | label 5, formula 18 |
| `ex` | exactly 2 examples `{ "ja", "en" }`; the pattern in 【】; natural, N1-level, everyday or written Japanese as fits the pattern | ja 32, en 80 |
| `note` | "Watch out": the one thing learners get wrong, in plain English | 110 |
| `bad`, `good` | a wrong sentence and its corrected form showing that mistake (no markup) | 19 each |
| `tag` | `[ja, en]` for the compare page chip: what sets this pattern apart | ja 6, en 18 |
| `cmp` | `{ "ja", "en" }` one short example for the compare page, the pattern in 【】 | ja 21, en 50 |

### COMPARE

| field | what | limit |
|---|---|---|
| `intro` | one or two plain sentences: what the three share and what tells them apart | 95 |
| `check.scene` | a 2 to 7 character Japanese label for the quick-check sentence (新人のころ) | 7 |
| `check.ja` | one sentence with `（　　）` where exactly one of the three patterns fits | 21 |
| `check.options` | the three patterns as they would be written in the blank, in pattern order | 6 each |
| `check.answer` | 1, 2 or 3 | |
| `check.notes` | one note per option, starting `せいかい！` for the answer and `おしい！` for the others, then why | 75 each |

### DRILL (文の文法1, practice with explanations)

| field | what | limit |
|---|---|---|
| `ja` | one sentence with `（　　）`; the part that decides the answer in 【】 (underlined after checking) | 40 |
| `options` | 4 forms; the pattern taught, plus three N1 or N2 patterns that a learner could confuse with it and that are clearly wrong here (by meaning or by connection) | 7 each |
| `answer` | 1 to 4; vary the position across the lesson | |
| `why` | 4 short explanations, one per option, in option order: for the answer why it fits, for each other option why not | 85 each |

### STAR (文の文法2, ★ sentence order, practice with a hint)

| field | what | limit |
|---|---|---|
| `pre`, `post` | the fixed text before and after the four blanks | 12 and 10 |
| `tiles` | the four tiles **in the correct order**; exactly one order must be grammatical and natural | 5 each |
| `star` | which blank holds the ★ (0 to 3; 2 is usual) | |
| `hint` | a hint that helps without giving the answer away | 100 |
| `why` | the order and the reasoning | 120 |

### EXAM (exam style, no hints, a clock)

Two of kind `"form"` and one of kind `"order"`, each about one of the lesson's patterns, harder than the drills.

- form: `{ "kind": "form", "ja": sentence with （　　）, "options": [4], "answer": 1-4, "why" }` — ja 40, options 9 each, why 170.
- order: `{ "kind": "order", "pre", "post", "tiles": [4 in the correct order], "star": 0-3, "why" }` — pre 10, post 12, tiles 6 each, why 170.

### WORD (文字・語彙)

| field | what | limit |
|---|---|---|
| `w`, `r`, `en` | the word, its reading (hiragana; katakana words in katakana), its meaning | w 8, r 12, en 34 |
| `ex` | `{ "ja", "en" }` an example sentence with the word in 【】 | ja 30, en 70 |
| `q` | one exam question about the word, of the type that suits it best (see below) | |

Question types (vary them across the five words; each lesson should have at least two types):

- `{ "type": "文脈規定", "ja": sentence with （　　）, "options": [4 words], "answer", "why" }` — ja 36, options 8 each, why 140. The word is the answer; the others are real words of the same kind that do not fit.
- `{ "type": "言い換え類義", "ja": sentence with the word in 【】, "options": [4 words or short phrases], "answer", "why" }` — ja 36, options 10 each, why 140. The answer is closest in meaning to the word.
- `{ "type": "用法", "options": [4 sentences using the word], "answer", "why" }` — options 24 each, why 140. Exactly one sentence uses the word correctly.

### READING (読解スキル, one short passage, a clock)

| field | what | limit |
|---|---|---|
| `skill` | the skill name in Japanese, as the syllabus gives it | 8 |
| `en` | the skill as a question, e.g. "Where is the writer's own claim?" | 40 |
| `passage` | an original passage at N1 level; the two or three signpost words or endings that lead to the answer in 【】 | 175 |
| `ask` | the question, as on the exam (筆者の考えに合うのはどれか。) | 20 |
| `options` | 4 answer sentences | 19 each |
| `short` | the same 4 as short labels for the notebook | 16 each |
| `answer` | 1 to 4 | |
| `tip` | a strategy hint for this kind of question | 105 |
| `why` | why the answer is right, pointing at the signposts | 110 |
| `whyNot` | 4 entries in option order: "" for the answer, for the others why not, starting "Option n …" | 100 each |

### LISTENING (聴解 即時応答: a line, then three spoken replies)

| field | what | limit |
|---|---|---|
| `who` | `"男"` or `"女"`: who says the line (the replies are by the other) | |
| `line` | the line, natural spoken Japanese at N1 level | 30 |
| `replies` | 3 replies; exactly one is a natural, fitting answer | 16 each |
| `answer` | 1 to 3 | |
| `notes` | 3 notes in reply order: why it fits, or what it mishears | 55 each |
| `short` | the 3 replies as short labels for the notebook | 14 each |

## Style

- English: plain, short sentences, British spelling, no exclamation marks, no "Note that". Explain what decides the answer (meaning, connection, register), not grammar jargon for its own sake.
- Japanese: natural and correct, at N1 level, written for adults: work, news, society, everyday life. No names of real people or companies.
- Each question has exactly one right answer, for a reason a learner can see. Wrong options are real Japanese forms that are wrong here, never nonsense.
- Everything is original: do not copy sentences from textbooks or past papers.
