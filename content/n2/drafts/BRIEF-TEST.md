# Brief for the week test of a unit of Yaoki N2

The week test is 24 exam-style items on the unit, answered against the clock. Write it as a JSON array of the 24 items (nothing around it) to the file named in your task. The model is the test of unit 3: `../u03.json`, `"test"`. Read it first, and `BRIEF.md` in this folder for the rules that hold for every item: exactly one right answer, a reason for the answer and for every wrong option, natural and original Japanese, N2 level, kanji as an educated adult writes them, and no readings (no `[漢字|かな]`) anywhere in a test.

## The items, in this order
Ids are `uNNt.1` to `uNNt.24` (your unit's number, two digits). Every item is `kind: "choice"` unless said, with the `type` and `label` below, a `q`, four `options`, `answer` (1 to 4) and `explain`.

1. Items 1–2, `漢字読み`, label `Kanji reading`: a sentence with one of the unit's scene words underlined (`_word_`), four kana readings. The wrong ones are the real confusions: a long or short vowel, voicing, a small っ, another on'yomi of one of the kanji.
2. Items 3–4, `表記`, label `Kanji spelling`: a sentence with a scene word written in kana and underlined (`_かな_`), four kanji spellings; the wrong ones use kanji that look or sound alike.
3. Items 5–6, `語形成`, label `Word formation`: a word with its prefix or suffix left out as （　　） in a sentence (as 手数（　　） or （　　）記入), four one-kanji options. Use the unit's scene words where you can.
4. Items 7–8, `文脈規定`, label `Word in context`: a sentence with （　　） and four words of one kind (four nouns, or four verbs), only one of which fits. Scene words where you can.
5. Items 9–15, `文の文法1`, label `Choose the form`: seven items; four options each, from the unit's ten forms (an earlier N2 form or an N3 form only where it is the real confusion). Together they cover at least seven of the ten.
6. Items 16–18, `kind: "star"`, `文の文法2`, label `Build the sentence`: `before`, `after`, four `tiles` in the right order, `star` (the ★ position, 0 to 3), `bank` (the order the tiles are shown in: not 0,1,2,3), `full` (before + tiles + after exactly, with the form in `{…}`) and `explain` (the order, then why).
7. Items 19–24, `読解・内容理解`, label `Short passage`: three passages, two questions each (19–20 on the first, 21–22 on the second, 23–24 on the third). Both items of a passage carry the whole passage in `passage` (the same text). Each also has `short` (four short labels for the options). Passages are 200 to 300 characters, original and at N2: a notice, a short essay, a letter or a column, each using one or two of the unit's forms where they come naturally. The questions ask why something happened, what someone should do, or what the writer thinks.

## Also
- Items 1–8 use the unit's scene words, given in your task (their readings are there too).
- Spread the right answers over positions 1 to 4, about six each.
- No two items share a scenario or a sentence frame. You cannot see the unit's study days, so make every sentence your own (new people, new situations).
- Validate the JSON (python3 -c "import json;json.load(open('FILE'))") and check each star item's `full` against before + tiles + after.
- Report in under 150 words anything you were unsure about (a judgement call on naturalness, a word whose level is unclear), so it can be flagged amber for the reviewer.
