# Brief for the まとめ day (day 6) of a unit of Yaoki N2

Day 6 of every unit is まとめ, a review of the unit's ten forms (the two points of each of its five study days). It is written like a study day, so `BRIEF.md` and `model-day4.json` in this folder hold for it too (read them first); the differences are below. The model for this day is day 6 of unit 3: `../u03.json`, `"days"` → `"6"`. Read it before you write.

## What the day contains
- `title`: exactly `まとめ：似ている文法`.
- `grammar.points`: `[]`. The day teaches nothing new.
- `grammar.compare`:
  - `intro`: one or two English sentences giving the learner the questions that tell the ten forms apart (what comes before the form, and what comes after it).
  - `forms`: ten, the unit's ten forms in the syllabus order, each with `form` (as the syllabus writes it, e.g. `〜ことから`), `tag` (a short Japanese label · a short English gloss, e.g. `根拠 · grounds for a judgement`), `mark` (`down` for a bad or regretted result, `up` for "too much" or "all the more", `dot` otherwise) and a new example: `ja` with the form in `{…}`, and `en`.
  - `check`: a choice item (id `uNNd6.c1`, type `文の文法1`, a short Japanese `label` for its situation as in the model), three options from the ten, `answer`, and `why` for each option.
- `grammar.drill`: eight items, ids `uNNd6.d1` to `uNNd6.d8`. `d4` and `d8` are star items (文の文法2); the other six are choice items (文の文法1, four options, the clue marked with `^…^`, `why` for each option). The wrong options are the unit's other forms, the confusions a learner really has.
- `grammar.exam`: three items, ids `uNNd6.e1` to `uNNd6.e3`: `e1` and `e2` 文の文法1 (four options, `explain`), `e3` a 文の文法2 star item. No readings.
- Across the drill and the exam, every one of the ten forms is the right answer at least once.
- Review of the level below: one drill item and one exam item set a point of this unit against a related N3 point (the N3 point as the key or as a distractor), and say so in its reason.
- `scene` and `skill`: as in `BRIEF.md`, with the place, the eight words and the reading given in your task.

## The reading: 情報検索 (Finding information)
`kind: "reading"`, `ja: "情報検索"`, `en: "Finding information"`. The passage is a notice, a timetable, a price list, a guide or a form, 250 to 400 characters (a table may be written as lines, one entry a line), and the question asks the learner to find what applies to a person in a stated situation (who may apply, which plan, what to bring, by when). `ask` is the English question the skill trains, `seconds` 90 to 120, `strategy` one sentence on what to look for (the conditions first, then the line that meets them all), and the item as in `BRIEF.md`.
