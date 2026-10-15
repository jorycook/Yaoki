# Yaoki: source of the iPhone web app prototype

Yaoki is a JLPT study app prototype. There are two apps, built from the same shell: the main app for N5 to N2 (the N5, N4 and N3 courses drafted in full, N2 with its unit 3 written; the learner picks the level in the app) and the N1 app (the N1 course, planned to the learner's exam date). This folder holds everything needed to rebuild both installable web apps, and Yaoki Reader, a reading page of its own. The design itself lives on the design canvas "Yaoki JLPT App"; the screens here are copies of the canvas's files.

## What is where

| Folder | What it holds |
|---|---|
| `docs/` | The built main app, served by GitHub Pages at https://jorycook.github.io/Yaoki/. This is all a phone needs. |
| `docs/n1/` | The built N1 app, served at https://jorycook.github.io/Yaoki/n1/. |
| `docs/reader/` | Yaoki Reader, served at https://jorycook.github.io/Yaoki/reader/. It has no build step: these files are its source. |
| `yaoki/project/` | The design canvas's files for the main app: 27 screens (`*.dc.html`), the course engine (`course.js`), each level's lessons (`course-n5.js` to `course-n2.js`, made from `content/`), the sound player (`sound.js`) and the clips (`sound-mock.js`, `sound-lessons.js`, `sound-course.js`, and one `sound-course-nX-uNN.js` per unit). 16 of the screens make up the app. |
| `content/` | The main app's lessons as data, one folder per level (see `content/README.md`). |
| `tools/` | `build-course.mjs` checks the content and writes the `course-*.js` files (the app build runs it), and the scripts that make the course's sound and review sheets. |
| `yaoki-n1/project/` | The N1 app's 27 screens, its content bank and plan (`n1-content.js`, `n1.js`), the sound player and the clips (`audio/`: 645 MP3 files and `clips.js`, their list). 17 of the screens make up the app. They are also the files of an N1 copy of the canvas, "Yaoki JLPT App · N1". |
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

`dist/` is what `docs/` is a copy of, and `dist-n1/` what `docs/n1/` is a copy of: after a build, replace the app's files with it and push. Leave `docs/reader/` and `docs/n1/` alone when replacing the main app in `docs/`. Settings, all optional: `YK_LEVEL` (`N2`, the default, for the main app, or `N1`), `YK_OUT` (output folder, relative to `yaoki-app/`), `YK_APP_VERSION` (default 0.1), `YK_BUILD_DATE` (default today), `YK_PROJECT` and `YK_FONTS` (where the screens and the typefaces are).

The two apps share everything in `yaoki-app/src/`. What differs is set in `LEVELS` at the top of `build.mjs`: the screens folder and the screens the app plays, the scripts loaded before the screens (the main app's courses and course engine; N1's content bank, plan and clip list), the clips, which sound is stored when used rather than at install, the name on the Home Screen ("Yaoki" and "Yaoki N1") and the icon colour (gold and indigo). The few lines of the shared files that belong to one app only sit between marks, `<!-- #if N1 -->` … `<!-- #else -->` … `<!-- #end -->` in a page or a template and `/* #if N1 */` … `/* #else */` … `/* #end */` in a script; the build keeps the app's own lines and leaves out the marks. So the main app keeps its level menu, its course engine and its saved state (`course.js`), and the N1 app keeps its own saved state (a plan of days, `n1.js`), the Star screen and a "Change the plan" button in its menu; neither app's build holds a line of the other's.

## Put it on the web

Copy the contents of `docs/` (or `yaoki-app/dist/`) to any https address. Every address inside the app is relative, so a sub-folder works. This repository is set up for GitHub Pages: Settings → Pages → Deploy from a branch, `main`, folder `/docs`. The empty `.nojekyll` file tells GitHub to serve the files as they are.

On the iPhone: open the address in Safari, tap Share, then Add to Home Screen, then open Yaoki from its icon once while online. The N1 app is added the same way from its own address (`/Yaoki/n1/`). The two apps keep separate progress and separate offline copies, and either can be on a phone without the other.

## Offline sound

The offline worker (`yaoki-app/src/sw.js`) stores the app itself when it installs. The sound is too large for that, so it is stored when used:

- **Main app:** each level's sound is one file per unit (`sound-course-n5-u01.js` …). A unit's file is stored the first time it is used, and once the learner has chosen a level the app asks for the rest of that level's units in the background. Other levels stay out until they are chosen.
- **N1 app:** the 645 clips (about 21 MB, four times the rest of the app) are not part of the install either, so the first opening stores about 5 MB and cannot fail on one of 645 files. A clip is stored the first time it is played, and once the learner has made a plan (on the goal screen) the app asks for all the others in the background. Whatever has been stored plays offline; a clip that was never stored cannot play offline until the app has been open online long enough to store it.

Each stored file carries a hash of its content, so a new build keeps the ones that did not change instead of fetching them again.

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
```

`release-checks.sh` runs the day flow, the level switch, each level's mini mock, the app checks, a content sweep of each level, `offline-sound.js` (which serves `yaoki-app/dist`: build it first) and the preview, and three canvas-side runs, which need the canvas runtime (see below). Whole-level sweeps run a few units at a time: `LEVEL=N4 bash sweep-chunks.sh <logdir> "1 2" "3 4" …`.

`YK_LEVEL=N1` in front of any of these builds and tests the N1 app instead (`YK_LEVEL=N1 bash all-app.sh`). The click-throughs have N1 versions, which take the course as it is written, on 14 Oct 2026: `e2e-n1.js` makes a plan on the goal screen and works through its first day, the week test and a new plan; `e2e-mock-n1.js` runs mini mock 1 on the mock tab of four; `nb-check-n1.js` fills the notebook with every question of the course and reviews one of each kind; `sweep-n1.js` takes every lesson, week test, mini mock and day of the sample plan through its states (about seven minutes). The other checks read the level's clip lengths and words from `level.js`. `bash run-app.sh screens-app.js` opens every screen of the app on its own (for N1, in each state its plan can put it in) and reports anything that leaves the frame; it is part of the N1 matrix. `YK_LEVEL=N1 node offline-sound.js` checks that the N1 clips are stored when played and when asked for, and play offline (it serves `yaoki-app/dist-n1`; `YK_DIST` names another build folder). Every check also reports content that runs into the bottom 34 px of a screen as a `PAD WARNING`, apart from its failures. `node two-apps-test.js` serves `docs/` as GitHub Pages does and checks that the two apps keep their own progress and offline copies, and that the N1 clips go into the N1 app's store only (`YK_DOCS` names another folder laid out the same way). Two runs at once need their own build folder and port: `YK_TESTDIR=dist-test-2 PORT=8766 bash all-app.sh`; `PREVIEW_PORT`, `TWO_APPS_PORT` and `OFFLINE_PORT` move the other three.

For the reader:

```
cd check
bash run-reader.sh reader-test.js    # serves docs/ at /Yaoki/ as GitHub Pages does, with the app's offline worker running
bash run-reader.sh aozora-test.js    # Aozora Bunko: search, fetch, parts, a downloaded zip (the copy of Aozora's files is played by the test)
```

`NODE_PATH` may point at another Playwright install (the default is `/opt/npm-tools/node_modules`).

`BACKUP=<a reader backup file>` also loads that file and opens every text in it.

`all.sh` runs the same suites against the design canvas's own runtime (with `YK_LEVEL=N1`, every N1 board and the two time-up paths). That needs the canvas runtime file, which is not part of this folder (see `setup-site.sh` for where it is expected).

## The N1 app

The same app around the N1 course: 48 grammar lessons in 8 units (three patterns each, with their words, a reading item and a listening item), the 1,113 N1 kanji and four mini mocks, each the real N1 paper cut short (about 12 questions and 15 minutes). The goal screen asks for the exam date (one of the coming July and December sessions) and the daily study time, and lays the course out as a plan of days up to the exam: six study days and a week test each week, and review days before the exam once everything has been taught. The menu's **Change the plan** goes back to the goal screen, which re-plans what is left. All questions and texts are written for this app. How each screen reads the plan is in `yaoki-n1/SCREENS.md`, the lesson format in `yaoki-n1/content/FORMAT.md`, the mini mocks' in `yaoki-n1/content/MOCKS.md`.

The spoken clips are made with the same text-to-speech model as the main app (Kokoro-82M), with its narrator and man voices; the woman's voice is Kokoro's jf_alpha. `python3 make-sound.py` in `yaoki-n1/` makes again the clips whose text changed (Python 3.10 to 3.12 with `kokoro` 0.9.4, `misaki[ja]` and the UniDic dictionary from `python3 -m unidic download`, and ffmpeg); the readings it corrects for the voice are in `yaoki-n1/content/readings.json`.

## The reader

Yaoki Reader shows Japanese text with the furigana hidden; touching a phrase shows its reading, word meanings and any grammar pattern in it, and letting go hides them again. Texts are pasted in (up to 30,000 characters each) or added from Aozora Bunko, and analysed in the browser: nothing is sent anywhere (adding an Aozora work only fetches that work's file).

| File | What it is |
|---|---|
| `docs/reader/index.html` | The whole page: library, add form, reader, settings, backups. |
| `docs/reader/engine/analyzer.js` | Phrases, readings, glosses and grammar notes (analysis version 4). |
| `docs/reader/engine/kuromoji.js`, `engine/dict/` | kuromoji.js 0.1.2 and the IPA dictionary, its loader changed to read the dictionary as base64 text. |
| `docs/reader/engine/jm-1.txt`, `jm-2.txt` | A shortened JMdict word list (2020 edition, from the `jamdict-data` 1.5 package). The script that made it is not in this repository. |
| `docs/reader/engine/worker.js`, `boot.js` | Runs the engine off the page's main thread. |
| `docs/reader/aozora/aozora.js` | Aozora Bunko works: searching the catalog, fetching a work, reading a downloaded .zip or .txt, taking out Aozora's notation, cutting long works into parts. |
| `docs/reader/aozora/catalog.txt` | The Aozora Bunko works out of copyright (titles, authors, file names; no texts). Made by `reader-tools/aozora-catalog.py`. |
| `docs/reader/aozora/jisx0213.json` | Characters Aozora's Shift_JIS files can only describe (※［＃…、第3水準1-85-25］). Made by `reader-tools/jisx0213-table.py`. |

**Aozora Bunko.** **From Aozora Bunko** in the library finds a work by title or author (in Japanese, kana or roman letters, or by pasting the address of its Aozora page) and adds it. Only works out of copyright are listed, and modern spelling (新字新仮名) is shown unless that box is cleared, since the readings are often wrong for old spelling. Aozora's own site cannot be read by other web pages, so the text is fetched from aozorahack's copy of Aozora's text files on GitHub (`raw.githubusercontent.com/aozorahack/aozorabunko_text`), which can. That copy stopped following Aozora around 2023, so a work added or corrected since is not in it: the page then links to the work's zip file on Aozora Bunko and reads that file once it is loaded (the zip need not be unpacked; a .txt works too, and **Load an Aozora Bunko file** takes one at any time). Ruby, notes and the source notes at the end are taken out. A work longer than about 12,000 characters is cut into parts at its chapter headings (never more than 30,000 characters each); each part is a text of its own, titled 吾輩は猫である（1/21） and so on, and is analysed when it is first opened.

To bring the catalog up to date with Aozora Bunko (it lists 17,344 works as of the index of 2026-08-20):

```
python3 reader-tools/aozora-catalog.py      # downloads Aozora's index and rewrites docs/reader/aozora/catalog.txt
```

About 36 MB is downloaded the first time a text is analysed in a visit; opening a text that was already analysed in that browser needs none of it.

**Saving.** On GitHub Pages the reader keeps its texts in the browser it is used in (`localStorage`, under keys starting `yomu.`; analyses in IndexedDB `yomu-reader`). The apps' own saved progress is left alone. **Save a backup** writes the library to a file and **Load a backup** reads one, which is how texts move between devices or browsers. Texts already in the library are skipped. When the same page runs as a Claude artifact it saves to the artifact's own store instead.

Nothing a reader adds goes into this repository. Only the built-in sample (片目のだるま) is published; for Aozora Bunko only the list of works is, never a work's text.

## Licences

Third-party parts are listed in `docs/licenses.txt` (and the same list in `docs/n1/licenses.txt`): Preact (MIT), the typefaces M PLUS Rounded 1c and Klee One (SIL Open Font License 1.1), and the synthetic voices (Kokoro-82M, Apache-2.0; two voices built from Koniwa recordings, CC BY 3.0). The N1 app's list adds the kanji and dictionary data it was made from (KANJIDIC2 and JMdict, EDRDG, CC BY-SA 4.0).

The reader's are in `docs/reader/licenses.txt`: Aozora Bunko (the catalog of works, and where the texts come from), JMdict (EDRDG, CC BY-SA 4.0, and the shortened word list under the same licence), kuromoji.js (Apache-2.0, with the mecab-ipadic notice) and the typefaces it loads from Google Fonts (SIL Open Font License 1.1).
