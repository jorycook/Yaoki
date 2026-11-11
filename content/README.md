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

## The scene and the writing

The scene's `words` are also what the learner writes by hand in the lesson's writing step: each kanji in them that is new
to the learner (not from the levels below, not written before) three times, and each word of two kanji or more one kanji
at a time. Every kanji of a scene word needs its strokes in `yaoki/project/strokes.js`: the build stops and names the
kanji when one has none, and `python3 tools/make-strokes.py` adds them (from KanjiVG). A part in `parts` may be a single
kanji (`["学", "ガク", "study"]`) or a word of its own (`["住民", "じゅうみん", "residents"]`); the writing step shows the
part a new kanji is in, with its reading and meaning.

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

## The kana course

`content/kana/` is the kana course (かな, the level before N5), and it is made, not written by hand: `node tools/make-kana.mjs`
writes it from the tables at the top of that script (see the README, "The kana course"). Its days have no grammar,
scene or skill. Instead:

```
"1": {
  "title":  must match the syllabus title (day 6 is まとめ：にている　かな)
  "kana":   script (hiragana | katakana), intro, cards [{kana [[kana, romaji, clip]], note, words [{w, r, gloss, clip}]}],
            drill (the practice, 8 or more questions), check (5)
  "write":  kana (each written three times), words [{w, r, gloss, clip}] (each written from what is heard)
  "words":  list [{id, w, r, gloss, clip}] (6 or more), quiz (6 questions)
}
```

Its questions are choice items with a `mode` (read: what is shown is read, heard: a clip is played and what was heard is
picked), the thing shown large (`big`) and their clip; their types are かな読み, かなを聞く, かな書き, ことば読み,
ことばを聞く, ぶん読み and ぶん書き. Each unit's `test` has 20. `clips.json` lists what each clip says, for
`tools/kana_clips.py`.

## Before content goes to the reviewer

1. Each drafted day or week test passes `python3 tools/check-day.py content/n2/drafts/u01d1.json` (the shape, ids, counts, markup and star items; `--words PLAN.json` also checks the scene's words against a plan) before it joins its unit.
2. `node tools/build-course.mjs` passes.
3. `bash check/run-app.sh content-sweep.js` passes: every answer of every written day shown on screen, with nothing cut off.
4. A blind check: a checker that has not seen the answers solves every item; any disagreement or second defensible answer is fixed or flagged.
5. The unit's review sheet is generated and sent (see `claude/course-plan.md` in the project).
6. The unit's clips are made: `python3 tools/course_sound.py n2 1` (the teach examples, the scene words and the listening lessons, in `yaoki/project/sound-course-n2-u01.js`; `--check heard.json` has a recogniser write down what it hears, and a clip it hears differently is flagged for the reviewer to listen to).

## How N2 units 1, 2 and 4 to 12 were written (November 2026)

`n2/drafts/PLAN.json` set each day's scene, its eight words (none already in the course) and its reading or listening lesson. Each day and each week test was written by one writer to `n2/drafts/BRIEF.md` (with `BRIEF-MATOME.md` for day 6 and `BRIEF-TEST.md` for the test) and examined by a second, who fixed what failed and flagged what was a judgement call. The seven parts were then joined into `uNN.json`, the right answers spread over 1 to 4 (each day's drill items and each test section on different positions) and the star items' tile orders varied, and the unit was blind solved by a solver who saw no answers: in all eleven units the solver's answers agreed with every key, and a settler rewrote the five items where the solver thought a second answer possible and the other doubts it noted (repeated scenarios, keys copied from a passage). What every step found and changed is in `n2/drafts/uNN-notes.md`; what the native reviewer should look at is in `n2/review/uNN-flags.json` and the unit's review sheet, including the clips a speech recogniser heard differently.
