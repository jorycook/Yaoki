# Yaoki: source of the iPhone web app prototype

Yaoki is a JLPT study app prototype. There are two apps, built from the same shell: the main app for N5 to N2 (the N5, N4 and N3 courses drafted in full, N2 with its unit 3 written; the learner picks the level in the app) and the N1 app (the N1 course, planned to the learner's exam date). This folder holds everything needed to rebuild both installable web apps, and Yaoki Reader, a reading page of its own. The design itself lives on the design canvas "Yaoki JLPT App"; the screens here are copies of the canvas's files.

## What is where

| Folder | What it holds |
|---|---|
| `docs/` | The built main app, served by GitHub Pages at https://jorycook.github.io/Yaoki/. This is all a phone needs. |
| `docs/n1/` | The built N1 app, served at https://jorycook.github.io/Yaoki/n1/. |
| `docs/reader/` | Yaoki Reader, served at https://jorycook.github.io/Yaoki/reader/. It has no build step: these files are its source. |
| `docs/typing/` | Yaoki Typing (タイピング), a typing game for a Japanese (JIS) keyboard, served at https://jorycook.github.io/Yaoki/typing/. It has no build step: `engine.js` holds the spelling rules, key tables and prompts, `game.js` the game. |
| `yaoki/project/` | The design canvas's files for the main app: 29 screens (`*.dc.html`), the course engine (`course.js`), each level's lessons (`course-n5.js` to `course-n2.js`, made from `content/`), the sound player (`sound.js`) and the clips (`sound-mock.js`, `sound-lessons.js`, `sound-course.js`, and one `sound-course-nX-uNN.js` per unit), and the writing practice (`Write.dc.html`, `yk-write.js`, `strokes.js`). 16 of the screens make up the app, with the writing panel inside one of them. |
| `content/` | The main app's lessons as data, one folder per level (see `content/README.md`). |
| `tools/` | `build-course.mjs` checks the content and writes the `course-*.js` files (the app build runs it), the scripts that make the course's sound and review sheets, and the writing practice's: `make-strokes.py` (the strokes, from KanjiVG) and `sync-write.sh` (the panel and engine copied to the N1 app). |
| `yaoki-n1/project/` | The N1 app's 29 screens, its content bank and plan (`n1-content.js`, `n1.js`), the sound player and the clips (`audio/`: 1,493 MP3 files and `clips.js`, their list). 17 of the screens make up the app. They are also the files of an N1 copy of the canvas, "Yaoki JLPT App · N1". |
| `yaoki-n1/content/`, `yaoki-n1/tools/` | The N1 course as data (`FORMAT.md`, `MOCKS.md`) and the scripts that check it and bundle it into `n1-content.js`. `yaoki-n1/SCREENS.md` says how the screens read the plan. |
| `yaoki-n1/make-sound.py` | Makes the N1 app's spoken clips. |
| `yaoki-app/` | The app around the screens, shared by both apps: `src/` (runtime, shell, install page, offline worker, page, manifest), `build.mjs`, `fonts.py`. |
| `reader-tools/` | Scripts that make the reader's Aozora Bunko files (the catalog of works, the JIS X 0213 table). |
| `check/` | The tests (Playwright). |

## Build

Needs Node 22, Python 3 with `fonttools` and `brotli`, and about 27 MB of typeface sources.

```
cd yaoki-app
npm install                   # preact and sharp
bash fetch-fonts.sh           # the two typefaces, into ../fonts-src
node build.mjs                # the main app: writes dist/ (the app) and dist-preview/ (the page shown inside Claude)
YK_LEVEL=N1 node build.mjs    # the N1 app: writes dist-n1/ and dist-n1-preview/
```

`dist/` is what `docs/` is a copy of, and `dist-n1/` what `docs/n1/` is a copy of: after a build, replace the app's files with it and push. Leave `docs/reader/`, `docs/typing/` and `docs/n1/` alone when replacing the main app in `docs/`. Settings, all optional: `YK_LEVEL` (`N2`, the default, for the main app, or `N1`), `YK_OUT` (output folder, relative to `yaoki-app/`), `YK_APP_VERSION` (default 0.1), `YK_BUILD_DATE` (default today), `YK_PROJECT` and `YK_FONTS` (where the screens and the typefaces are).

The two apps share everything in `yaoki-app/src/`. What differs is set in `LEVELS` at the top of `build.mjs`: the screens folder and the screens the app plays, the scripts loaded before the screens (the main app's courses and course engine; N1's content bank, plan and clip list), the clips, which sound is stored when used rather than at install, the name on the Home Screen ("Yaoki" and "Yaoki N1") and the icon colour (gold and indigo). The few lines of the shared files that belong to one app only sit between marks, `<!-- #if N1 -->` … `<!-- #else -->` … `<!-- #end -->` in a page or a template and `/* #if N1 */` … `/* #else */` … `/* #end */` in a script; the build keeps the app's own lines and leaves out the marks. So the main app keeps its level menu, its course engine and its saved state (`course.js`), and the N1 app keeps its own saved state (a plan of days, `n1.js`), the Star screen and a "Change the plan" button in its menu; neither app's build holds a line of the other's.

## Put it on the web

Copy the contents of `docs/` (or `yaoki-app/dist/`) to any https address. Every address inside the app is relative, so a sub-folder works. This repository is set up for GitHub Pages: Settings → Pages → Deploy from a branch, `main`, folder `/docs`. The empty `.nojekyll` file tells GitHub to serve the files as they are.

On the iPhone: open the address in Safari, tap Share, then Add to Home Screen, then open Yaoki from its icon once while online. The N1 app is added the same way from its own address (`/Yaoki/n1/`). The two apps keep separate progress and separate offline copies, and either can be on a phone without the other.

## Offline sound

The offline worker (`yaoki-app/src/sw.js`) stores the app itself when it installs. The sound is too large for that, so it is stored when used:

- **Main app:** each level's sound is one file per unit (`sound-course-n5-u01.js` …). A unit's file is stored the first time it is used, and once the learner has chosen a level the app asks for the rest of that level's units in the background. Other levels stay out until they are chosen.
- **N1 app:** the 1,493 clips (about 52 MB, eight times the rest of the app) are not part of the install either, so the first opening stores about 6 MB and cannot fail on one of 1,493 files. A clip is stored the first time it is played, and once the learner has made a plan (on the goal screen) the app asks for all the others in the background. It asks its own offline worker only: on a first visit the page can still be held by the main app's worker (whose scope, `/Yaoki/`, holds `/Yaoki/n1/`), and the request is then made when the N1 app's own worker takes over. Whatever has been stored plays offline; a clip that was never stored cannot play offline until the app has been open online long enough to store it.

Each stored file carries a hash of its content, so a new build keeps the ones that did not change instead of fetching them again.

## Writing practice

Both apps have the learner write kanji by hand, with a finger, in the kanji part of a lesson.

- **Main app (N5 to N2).** The kanji and words lesson (Scene) has three steps: 学習 the scene (each word's reading, meaning and kanji), 書く writing, and 本番 the exam question. In the writing step each kanji of the scene's words that is new to the learner is written three times before the next one comes: traced over its strokes once its stroke order has played (a red dot marks where the next stroke starts), then over very faint strokes, then from memory. Each word of two kanji or more is then written one kanji at a time, from memory. A kanji comes before the first word that has it, and a word straight after its new kanji. Next stays shut until the kanji or word is written. New means not written in the app before and not from the levels below: an N4 learner is taken to write the N5 kanji already (`below` in each course file, from the kanji lists in `tools/build-course.mjs`). Today's card shows the lesson's steps as 学習 Learn, 書く Write and 本番 Exam-style.
- **N1 app.** Each kanji's sheet in the kanji step has the same pad: the kanji is written three times before Next kanji opens, and the words open once every kanji of the day is written. After the words comes 書く, where each word of two kanji or more is written one kanji at a time: a kanji of the N1 bank not taught yet is traced, one written before or from the levels below is written from memory.
- **What counts.** A stroke counts when it comes in the right order and goes the right way, close to the stroke, with its shape and roughly its length. The next stroke drawn instead, a stroke drawn backwards or a scribble does not, and the line under the pad says which. After two misses the stroke is shown in yellow from its start; after four it is written in for the learner. The buttons under the pad play the stroke order, show the next stroke and start the current time again. A strip under them shows the stroke order a stroke at a time; it is hidden while the learner writes from memory.
- **What is kept.** The kanji written three times and the words written out are saved with the progress (`wrote`, `wroteWords`), for all levels at once, so nothing is asked twice. A kanji opened again is shown written out, with its stroke order a tap away.
- **Where it lives.** The pad and its stroke matching are `yk-write.js`, and the panel around it (the three times, a word's cells, the buttons, the strip) is `Write.dc.html`. Both are the same file in both apps: change them in `yaoki/project/`, then `bash tools/sync-write.sh` copies them to `yaoki-n1/project/` (`--check` says whether the copies match). The strokes are each app's `strokes.js`, made from KanjiVG by `python3 tools/make-strokes.py`, which downloads the KanjiVG release once: the main app's holds every kanji of the scenes' words, the N1 app's the kanji bank and every kanji of its words. The course build and the app build stop when a kanji has no strokes, so new words with a new kanji need `make-strokes.py` run again.

## Change a screen

Edit the screen file in `yaoki/project/` (or `yaoki-n1/project/` for N1), then build again. The same file runs on the design canvas, so publish it there too to keep the two alike. The main app's lessons are data: change them in `content/` (see `content/README.md`); the N1 course is in `yaoki-n1/content/` (`node yaoki-n1/tools/build-content.mjs` remakes `n1-content.js`). A new build has a new version; phones that have the app fetch it by themselves and switch to it at a quiet moment.

## Tests

```
cd check
npm install                      # typefaces for the canvas-side runs; Playwright must be installed as well
bash all-app.sh                  # the click-through suites against the app build
bash run-app.sh app-test.js      # app-only checks: saved progress, sizes, offline, updates
node preview-test.js             # the page shown inside Claude
bash release-checks.sh           # the main app's checks before a release, each with its verdict line
node write-engine-test.js        # the writing practice's stroke matching, on every kanji of both apps (about two minutes)
bash run-app.sh write-flow.js    # writing with a finger: N5 week 1 day 1, every kanji and word (bash run.sh: on the canvas)
YK_LEVEL=N1 bash run-app.sh write-flow-n1.js   # the same for a day of the N1 sample plan (DAY=n for another)
```

`write-engine-test.js` draws every stroke of every kanji the apps ask for: as it is, the next stroke in its place, backwards, a scribble, and the whole kanji from memory a little small and off-centre. The two write-flow checks draw with touch input, as a phone sends it, and try a stroke out of order and one backwards on the way. The other click-throughs set `window.__ykWriteAuto`, so the pads write themselves, and `window.__ykWriteFast`, so the animations run twenty times quicker; the app never sets either.

`release-checks.sh` runs the day flow, the level switch, each level's mini mock, the app checks, a content sweep of each level, `offline-sound.js` (which serves `yaoki-app/dist`: build it first) and the preview, and three canvas-side runs, which need the canvas runtime (see below). Whole-level sweeps run a few units at a time: `LEVEL=N4 bash sweep-chunks.sh <logdir> "1 2" "3 4" …`.

`YK_LEVEL=N1` in front of any of these builds and tests the N1 app instead (`YK_LEVEL=N1 bash all-app.sh`). The click-throughs have N1 versions, which take the course as it is written, on 14 Oct 2026: `e2e-n1.js` makes a plan on the goal screen and works through its first day, the week test and a new plan; `e2e-mock-n1.js` runs mini mock 1 on the mock tab of four; `nb-check-n1.js` fills the notebook with every question of the course and reviews one of each kind; `sweep-n1.js` takes every lesson, week test, mini mock and day of the sample plan through its states (about seven minutes). The other checks read the level's clip lengths and words from `level.js`. `bash run-app.sh screens-app.js` opens every screen of the app on its own (for N1, in each state its plan can put it in) and reports anything that leaves the frame; it is part of the N1 matrix. `YK_LEVEL=N1 node offline-sound.js` checks that the N1 clips are stored when played and when asked for, and play offline (it serves `yaoki-app/dist-n1`; `YK_DIST` names another build folder). Every check also reports content that runs into the bottom 34 px of a screen as a `PAD WARNING`, apart from its failures. `node two-apps-test.js` serves `docs/` as GitHub Pages does and checks that the two apps keep their own progress and offline copies, and that the N1 clips go into the N1 app's store only, also when the plan is made before the N1 app's own worker is in charge (`YK_DOCS` names another folder laid out the same way). Two runs at once need their own build folder and port: `YK_TESTDIR=dist-test-2 PORT=8766 bash all-app.sh`; `PREVIEW_PORT`, `TWO_APPS_PORT` and `OFFLINE_PORT` move the other three.

For the reader:

```
cd check
bash run-reader.sh reader-test.js    # serves docs/ at /Yaoki/ as GitHub Pages does, with the app's offline worker running
bash run-reader.sh aozora-test.js    # Aozora Bunko: search, fetch, parts, a downloaded zip (the copy of Aozora's files is played by the test)
bash run-reader.sh library-test.js   # Yaoki Library: the catalog and its files, the button, every work and its parts, a part read in full
```

For Yaoki Typing (Node for the rules, Playwright for the page):

```
node check/typing-engine-test.js     # the spelling rules (taken and refused), the key tables, every built-in prompt and every course word
node check/typing-test.js            # plays each mode with real key presses, a fall and a waiting card, the result; SHOTS=<dir> keeps screenshots
```

`NODE_PATH` may point at another Playwright install (the default is `/opt/npm-tools/node_modules`).

`BACKUP=<a reader backup file>` also loads that file and opens every text in it.

`all.sh` runs the same suites against the design canvas's own runtime (with `YK_LEVEL=N1`, every N1 board and the two time-up paths). That needs the canvas runtime file, which is not part of this folder (see `setup-site.sh` for where it is expected).

## The N1 app

The same app around the N1 course: 48 grammar lessons in 8 units, each with three patterns, 20 words (the lesson's own five and fifteen from the word bank), a short and a longer reading item and a short and a longer listening item (96 reading and 96 listening items in all); the 1,113 N1 kanji; and four mini mocks, each the real N1 paper cut short (about 12 questions and 15 minutes). It also reviews the earlier levels, N2 to N4: the 120 patterns of the main app's N2 syllabus (a reminder and a question each), 648 questions of the main app's N2, N3 and N4 courses, and the 739 N2 kanji. Two of these come in each day's quiz, four at the end of each week test (the section 復習) and six in each review day's mixed review, in an order shuffled once per plan, so each comes once before any comes back. The goal screen asks for the exam date (one of the coming July and December sessions) and the daily study time, and lays the course out as a plan of days up to the exam: six study days and a week test each week, and review days before the exam once everything has been taught. The menu's **Change the plan** goes back to the goal screen, which re-plans what is left. All questions and texts are written for this app. How each screen reads the plan is in `yaoki-n1/SCREENS.md`, the lesson format in `yaoki-n1/content/FORMAT.md`, the mini mocks' in `yaoki-n1/content/MOCKS.md`.

**The banks.** Besides the lessons and the mocks, the course has four banks, set out in `yaoki-n1/content/BANKS.md`: the words (`content/words/`, fifteen more N1 words for each lesson (adverbs, compound verbs, Sino-Japanese nouns, adjectives, katakana words and idioms), each with an example and a 文脈規定, 言い換え類義 or 用法 question), the reading (`content/reading/`, a longer item for each lesson of the kinds the short items leave out: 内容理解（中文）, 情報検索 and 統合理解), the listening (`content/listening/`, a longer item for each lesson: 課題理解, ポイント理解 and 概要理解, in spoken parts) and the review of the N2 grammar (`content/review-n2.json`). The plan lays the first three out over the days with their lessons. The other review questions are made from the main app's content: `node yaoki-n1/tools/make-review.mjs` converts the N2 to N4 course questions into `content/review-courses.json`, and `python3 tools/make-kanji.py <KANJIDIC2> <JMdict> --review` (in `yaoki-n1/`) writes the N2 kanji into `content/kanji-review.json`. `node yaoki-n1/tools/check-banks.mjs` checks the banks against `BANKS.md` (fields, lengths and markup, the mix of word kinds and question types, the answers' positions) as `check-content.mjs` checks the lessons and `check-mocks.mjs` the mocks; `build-content.mjs` runs `make-review.mjs` and bundles everything into `n1-content.js`.

The spoken clips are made with the same text-to-speech model as the main app (Kokoro-82M), with its narrator and man voices; the woman's voice is Kokoro's jf_alpha. `python3 make-sound.py` in `yaoki-n1/` makes again the clips whose text changed (Python 3.10 to 3.12 with `kokoro` 0.9.4, `misaki[ja]` and the UniDic dictionary from `python3 -m unidic download`, and ffmpeg); the readings it corrects for the voice are in `yaoki-n1/content/readings.json`. There are 1,493 clips, one MP3 file each in `yaoki-n1/project/audio/` and listed in `clips.js` (`yaoki-n1/SCREENS.md`, "Sound"): 288 teach examples (`g.…`), 960 words with their example sentences (`w.<lesson id>.<0-19>`), 224 listening clips (each short item `l.<lesson id>` with its slow take `l.<lesson id>.slow`, and the parts of the longer items, `l.<lesson id>.<part>`) and 21 for mini mocks 2 to 4 (`m2…` to `m4…`; mock 1's are in `sound-mock.js`). They are about 52 MB, so they are not part of the install: each is stored the first time it is played, and the rest in the background once there is a plan (see Offline sound).

## The reader

Yaoki Reader shows Japanese text with the furigana hidden; touching a phrase shows its reading, word meanings and any grammar pattern in it, and letting go hides them again. Texts are pasted in (up to 30,000 characters each) or added from Aozora Bunko, and analysed in the browser: nothing is sent anywhere (adding an Aozora work only fetches that work's file).

| File | What it is |
|---|---|
| `docs/reader/index.html` | The whole page: library, add form, reader, settings, backups. |
| `docs/reader/engine/analyzer.js` | Phrases, readings, glosses and grammar notes (analysis version 5). |
| `docs/reader/engine/kuromoji.js`, `engine/dict/` | kuromoji.js 0.1.2 and the IPA dictionary, its loader changed to read the dictionary as base64 text. |
| `docs/reader/engine/jm-1.txt`, `jm-2.txt` | A shortened JMdict word list (2020 edition, from the `jamdict-data` 1.5 package). The script that made it is not in this repository. |
| `docs/reader/engine/worker.js`, `boot.js` | Runs the engine off the page's main thread. |
| `docs/reader/aozora/aozora.js` | Aozora Bunko works: searching the catalog, fetching a work, reading a downloaded .zip or .txt, taking out Aozora's notation, cutting long works into parts. |
| `docs/reader/aozora/catalog.txt` | The Aozora Bunko works out of copyright (titles, authors, file names; no texts). Made by `reader-tools/aozora-catalog.py`. |
| `docs/reader/aozora/jisx0213.json` | Characters Aozora's Shift_JIS files can only describe (※［＃…、第3水準1-85-25］). Made by `reader-tools/jisx0213-table.py`. |
| `docs/reader/library/catalog.json` | The Yaoki Library: original works written for Yaoki, with their parts. |
| `docs/reader/library/<work>/` | Each work's text, one plain text file per part, with its glosses or its whole analysis where it has them. |

**Aozora Bunko.** **From Aozora Bunko** in the library finds a work by title or author (in Japanese, kana or roman letters, or by pasting the address of its Aozora page) and adds it. Only works out of copyright are listed, and modern spelling (新字新仮名) is shown unless that box is cleared, since the readings are often wrong for old spelling. Aozora's own site cannot be read by other web pages, so the text is fetched from aozorahack's copy of Aozora's text files on GitHub (`raw.githubusercontent.com/aozorahack/aozorabunko_text`), which can. That copy stopped following Aozora around 2023, so a work added or corrected since is not in it: the page then links to the work's zip file on Aozora Bunko and reads that file once it is loaded (the zip need not be unpacked; a .txt works too, and **Load an Aozora Bunko file** takes one at any time). Ruby, notes and the source notes at the end are taken out. A work longer than about 12,000 characters is cut into parts at its chapter headings (never more than 30,000 characters each); each part is a text of its own, titled 吾輩は猫である（1/21） and so on, and is analysed when it is first opened.

To bring the catalog up to date with Aozora Bunko (it lists 17,344 works as of the index of 2026-08-20):

```
python3 reader-tools/aozora-catalog.py      # downloads Aozora's index and rewrites docs/reader/aozora/catalog.txt
```

About 36 MB is downloaded the first time a text is analysed in a visit; opening a text that was already analysed in that browser needs none of it.

**Saving.** On GitHub Pages the reader keeps its texts in the browser it is used in (`localStorage`, under keys starting `yomu.`; analyses in IndexedDB `yomu-reader`). The apps' own saved progress is left alone. **Save a backup** writes the library to a file and **Load a backup** reads one, which is how texts move between devices or browsers. Texts already in the library are skipped. When the same page runs as a Claude artifact it saves to the artifact's own store instead.

**The Yaoki Library.** **From the Yaoki Library** (ヤオキ文庫から), just under From Aozora Bunko in the library, lists the original works written for Yaoki. A work opens on the same page as an Aozora work: its title, reading, level and a line about it, then its parts, each added on its own or all at once, and read like any other text. The works are published with the site, so nothing is fetched from anywhere else. The first was 始末書 (2026-10-15), in three parts. 目川日記 (2026-10-22), a serial written for learners, is four works, one for each level from N5 to N2 (8, 10, 12 and 12 chapters): each chapter is a part with its own analysis, so it opens at once, without the dictionary, and shows the readings, glosses and grammar notes written for the story.

To add a work:

1. Put its text in `docs/reader/library/<id>/`, one UTF-8 plain text file per part (`1.txt`, `2.txt` and so on), each at most 30,000 characters. Line breaks are kept; a blank line before a heading reads well. No ruby or Aozora notation: the reader makes its own readings.
2. Add it at the top of `works` in `docs/reader/library/catalog.json`: `id` (lower-case letters, digits and hyphens), `title`, `reading` (kana), `level` (`N1` to `N5`, a rough guide; leave it out if unsure), `added` (the date), `about` (one or two sentences in English), and `parts`, each with its `file` and, where the work has its own part names (上, 中, 下), a `title`. Parts without a title are named 題名（1/3） and so on.
3. Give a part its own glosses where the dictionary's first sense would mislead (optional). The reader shows the first common sense of each word, and for a literary text that is often the wrong one: 渡す is "to ferry across" before it is "to hand over", 仰いました is read あおぎました. A part may name a `glosses` file next to it in the catalog (`"glosses": "<id>/1.glosses.json"`): a JSON object of maps the engine applies as it reads — `gl` a gloss by a word's base form (as the engine keys it; the `k` field of each word in an analysis says which), `glx` a gloss for one occurrence (`"渡す#3"`, counting that word's occurrences from 1), `rd` and `rdx` furigana for the word's kanji (one hiragana string, or one per run of kanji), `sf` furigana for a word exactly as written, `bf` the base form and reading the looked-up list shows (`"仰ぐ": ["仰る", "おっしゃる"]`). The engine itself also puts back together a few words IPADIC cuts in two (失くす, 倹しい, 待受, 生き死に) and reads 行 as ぎょう when it counts lines. 始末書's three files were made by analysing each part with the engine in Node, reviewing every distinct word and reading, and writing down the ones that needed changing (about 290 words and 45 readings per part, plus a few glosses and readings for single occurrences).
   Or give a part its whole analysis (optional): `"analysis": "<id>/1.json"`, a JSON file in the shape `engine/analyzer.js` produces (`{ v, paras: [[{ w: [{ s: [[text, furigana]], e, k, f }], h, t, g, d }]] }`), marked `"pre": 1` and stamped with a `rev` that changes whenever the file does. The reader then uses it as it is: the part opens without the dictionary (about 36 MB the first time), and every reading, gloss and grammar note is the file's. A phrase may also carry `n`, notes of the text's own, which the lens shows under 注 with the word meanings. The analysis must show exactly the part's text (the reader checks it and falls back to its own analysis if not); the analysis is fetched when the part is first opened, kept in the browser, and swapped for a newer one when its `rev` changes. 目川日記's 42 files are made from the story's hand-written lexicon by `tools/reader_export.py` in the story's source, which is not in this repository; every reading in them was checked against this reader's own analysis, and each disagreement was settled by hand.
4. `cd check && bash run-reader.sh library-test.js` checks the catalog, every file, every glosses file and every analysis file (its shape, and that it shows exactly its part's text, with a reading for every kanji), then opens every work, reads one of its parts in full and, where the part has glosses or an analysis, holds a phrase to see that the lens shows them; a part with its own analysis must open without asking for the dictionary.
5. Commit and push. Readers see the new work the next time they open the list.

Nothing a reader adds goes into this repository. Only the built-in sample (片目のだるま) and the Yaoki Library's works are published; for Aozora Bunko only the list of works is, never a work's text.

## Yaoki Typing

A typing game for a Japanese (JIS) keyboard, in the app's look: cards come along Yaoki's route, and typing a card stamps it 済. A card that reaches Yaoki knocks him over; he gets up again (七転び八起き) and the card comes back later in the round, after about three other cards (the cards already on the route come first; the game says how many). A card that has knocked him over twice waits in front of him instead, and Tab skips it (for a key the keyboard lacks), so every round ends. There are four modes:

- **語彙 Course words:** the words of a week of the main app's course, N5 to N2, read from `docs/assets/course-*.js`. The page starts at the level and week the learner is on in the app, if the app has been used in the same browser (it reads the app's saved state, `yaoki.v1:/Yaoki/`, and never writes it). A cleared word is spoken with the app's own clip, from `docs/assets/sound.js` and the week's sound file. So course words follow the app's content with no step of their own, but they need the app's files beside the page.
- **ローマ字 Romaji:** kana, katakana, words and short sentences with Japanese punctuation, from the lists in `engine.js`.
- **記号 Symbol keys:** the symbols and Japanese punctuation on their JIS keys.
- **かな入力 Kana input:** where each kana sits on the keyboard, by physical key, including the Shift layer.

A spelling is taken when Microsoft IME or Google 日本語入力 would turn it into the kana: so ぢ is `di`, を is `wo`, ん before a vowel, y or n is `nn`, and っ doubles the consonant actually typed next. The hint is always a spelling both accept. One rule is the game's own: ん at the end of a card takes `nn`, as there is no Enter to settle a lone n. Hints come in steps (the kana being typed, then the whole spelling) after a miss or a pause, or always, or never (設定 Settings).

The cards are paced by the player: the game keeps a moving average of the reaction time and the keys a second for each stage and spaces the cards to suit, and the world speed is set once a round from the longest card. Misses are kept per kana (ん and っ on their own) or per key; like the mistake notebook, one leaves the weak-spot list after three clean answers in a row (a card typed with its whole spelling on show, or the untyped rest of a card that fell, does not count), and 苦手を練習 deals a round of weak spots.

The game rewards accuracy, getting up again and showing up, never speed:

- **はなまる and 連続:** a card typed with no miss and no hint settles on the route as a 済 inside a teacher's はなまる, and a chip counts clean cards in a row. Yaoki smiles, and at 5, 10, 20 and 40 in a row he hops and cheers (いいね！ すごい！ さすが！ かんぺき！). A fall ends the run quietly. The longest run is kept per stage, on the same terms as the best.
- **起:** a card that knocked Yaoki over and is typed clean when it comes back is stamped 起.
- **Weak spots in a normal round:** up to one card in five that holds a weak kana or key has a gold corner, and one typed clean gets a star on the route. The result lists what left the weak list during the round (卒業).
- **Stamp card:** a day's typing time (pauses and stretches of more than 8 seconds without a key do not count) fills a box on a seven-day stamp card once it reaches the daily goal (3, 5 or 10 minutes). Days off never erase a stamp, and a full card starts a new one.
- **A stage's はなまる:** たいへんよくできました in a counted round gives a stage, or a course week, a ring, at most one a day. Three rings make its はなまる, and a top round offers the next stage.
- **Sound effects** are made in the browser by `docs/typing/sfx.js` (Web Audio, no sound files). しずか Quiet, the default, plays a stamp for each card, a drum for a fall and a bounce as Yaoki gets up. ぜんぶ All adds a tick for each right key and a knock for a miss, and なし Off plays nothing. No effect plays over a course word's own clip.

All of these honour reduced motion, and none of them changes the clean count, the pace, the bests or the weak spots. Settings, paces, bests, weak spots, run records, the stamp card and the stage rings are kept under `yaoki.typing.v1`; keys added later (`sfx`, `goal`, `practice`, `stampCard`, `run`, `seal`) are optional, so an older save still loads. The page uses the main app's icons and Google Fonts, as the reader does, and has no offline worker of its own: it needs the network, or the browser's cache.

## Licences

Third-party parts are listed in `docs/licenses.txt` (and the same list in `docs/n1/licenses.txt`): Preact (MIT), the typefaces M PLUS Rounded 1c and Klee One (SIL Open Font License 1.1), the synthetic voices (Kokoro-82M, Apache-2.0; two voices built from Koniwa recordings, CC BY 3.0), and the writing practice's strokes, from KanjiVG (Ulrich Apel and contributors, CC BY-SA 3.0; the `strokes.js` files are under the same licence), with stroke matching that follows Hanzi Writer's (David Chanin, MIT). The N1 app's list adds the kanji and dictionary data it was made from (KANJIDIC2 and JMdict, EDRDG, CC BY-SA 4.0).

Both lists hold a notice that JLPT is a trademark of the Japan Foundation and Japan Educational Exchanges and Services, that the apps are not connected with them and hold no official test material, and that the lessons, questions, passages and listening scripts were written for the apps; each app's menu says the same in a line under its version. Everything was checked to be original in an IP review (15 Oct 2026): a scan of every sentence of both apps flagged 131 texts (61 example sentences that matched stock examples of published grammar references, 6 real names, 64 instruction lines in the wording of the official papers), and each was replaced with an original sentence of the same grammar and length or a reworded instruction. In the main app this changed sentences in `content/n2` to `content/n5`, and nine N3 clips were made again for them with `tools/remake_clips.py`.

The reader's are in `docs/reader/licenses.txt`: Aozora Bunko (the catalog of works, and where the texts come from), JMdict (EDRDG, CC BY-SA 4.0, and the shortened word list under the same licence), kuromoji.js (Apache-2.0, with the mecab-ipadic notice) and the typefaces it loads from Google Fonts (SIL Open Font License 1.1).
