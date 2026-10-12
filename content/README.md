# Course content

The lessons are data. `tools/build-course.mjs` checks every file here and turns them into `yaoki/project/course-n2.js`, which the screens read on the design canvas and in the app. The app build runs it by itself; to check content alone, run `node tools/build-course.mjs`.

## Files

| File | What it holds |
|---|---|
| `n2/units.json` | The syllabus: 12 units, the function each one covers and the title of each study day. |
| `n2/uNN.json` | One unit's lessons: `days` (keyed `"1"` to `"6"`, day 6 is まとめ) and `test` (the week test's questions). Days not written yet are simply left out; the app shows them as 準備中. |
| `n2/mini.json` | The mini mock's questions and the sample listening drill, so the notebook can show them. |

## A study day

```
"4": {
  "title":   must match the syllabus title
  "grammar": {
    "points":  two grammar points: form, gloss, connect [{pos, rule}], examples [{ja, en, clip?}], watch {note, bad, good}
    "compare": intro, forms [{form, tag, mark: down | up | dot, ja, en}], check (a choice item)
    "drill":   4 or more items (choice or star), with hints and a reason for every option
    "exam":    exactly 3 items in exam format, answered against the clock
  },
  "scene":  ja, en, intro, words [{id, word, reading, gloss, parts [[part, reading, meaning], …], clip?}], check (a choice item)
  "skill":  kind: reading | listening, ja, en, ask, seconds, passage (reading), strategy, item
}
```

## Items

Every item has a unique `id` (`u03d4.d1` = unit 3, day 4, drill 1), a `kind`, the exam `type` it practises (文の文法1, 語形成, 読解・筆者の考え …) and an optional `label`.

- **choice:** `q` (the sentence, with （　　） for the blank or `_word_` underlined), `options`, `answer` (1-based), and either `why` (one line per option, the right one included) or `explain`. `short` gives shorter labels for the notebook when the options are long.
- **star (文の文法2):** `before`, `after`, `tiles` in the right order, `star` (the position, 0 to 3, that carries the ★), `bank` (the order the tiles are shown in), `hint`, `full` (the whole sentence) and `explain`. In exam conditions it is asked as on the paper: the four tiles numbered.

## Markup inside the text

| Markup | Shows as |
|---|---|
| `{ばかりに}` | highlighted: the pattern being taught |
| `[油断\|ゆだん]` | ruby: the reading above the kanji (dropped in exam conditions) |
| `_補って_` | underlined: the word a question asks about |
| `^大事な試験を^` | a clue: plain until the answer is shown, then underlined (drill) or highlighted (reading) |

## What the build refuses

Unbalanced markup, an answer out of range, two identical options, a missing reason for a wrong option, a star item whose `full` sentence is not `before` + tiles + `after`, a bank that already shows the right order, a day without two grammar points, at least four drill items and exactly three exam items, a day title that differs from the syllabus, and duplicate ids.

## Before content goes to the reviewer

1. `node tools/build-course.mjs` passes.
2. `bash check/run-app.sh content-sweep.js` passes: every answer of every written day shown on screen, with nothing cut off.
3. A blind check: a checker that has not seen the answers solves every item; any disagreement or second defensible answer is fixed or flagged.
4. The unit's review sheet is generated and sent (see `claude/course-plan.md` in the project).
