# Yaoki: source of the iPhone web app prototype

Yaoki is a JLPT study app prototype. There are two apps, built from the same shell: one for N5 to N2 (N2 sample content) and one for N1 (N1 sample content). This folder holds everything needed to rebuild both installable web apps. The design itself lives on the design canvas "Yaoki JLPT App"; the screens here are copies of the canvas's files.

## What is where

| Folder | What it holds |
|---|---|
| `docs/` | The built app, served by GitHub Pages at https://jorycook.github.io/Yaoki/. This is all a phone needs. |
| `docs/n1/` | The built N1 app, served at https://jorycook.github.io/Yaoki/n1/. |
| `yaoki/project/` | The design canvas's files: 27 screens (`*.dc.html`), the sound player (`sound.js`) and the clips (`sound-mock.js`, `sound-lessons.js`). 17 of the screens make up the app. |
| `yaoki-n1/project/` | The same 27 files with N1 content, for the N1 app (and for an N1 copy of the canvas, "Yaoki JLPT App · N1"). |
| `yaoki-n1/make-sound.py` | Makes the N1 app's spoken clips. |
| `yaoki-app/` | The app around the screens: `src/` (runtime, shell, install page, offline worker, page, manifest), `build.mjs`, `fonts.py`. |
| `docs/reader/` | Yaoki Reader, served at https://jorycook.github.io/Yaoki/reader/. It has no build step: these files are its source. |
| `reader-tools/` | Scripts that make the reader's Aozora Bunko files (the catalog of works, the JIS X 0213 table). |
| `check/` | The tests (Playwright). |

## Build

Needs Node 22, Python 3 with `fonttools` and `brotli`, and about 27 MB of typeface sources.

```
cd yaoki-app
npm install            # preact and sharp
bash fetch-fonts.sh    # the two typefaces, into ../fonts-src
node build.mjs         # writes dist/ (the app) and dist-preview/ (the page shown inside Claude)
YK_LEVEL=N1 node build.mjs    # the N1 app: writes dist-n1/ and dist-n1-preview/
```

`dist/` is what `docs/` is a copy of, and `dist-n1/` what `docs/n1/` is a copy of: after a build, replace the app's files with it and push. Leave `docs/reader/` and `docs/n1/` alone when replacing the N5 to N2 app in `docs/`. Settings, all optional: `YK_LEVEL` (`N2`, the default, or `N1`), `YK_OUT` (output folder, relative to `yaoki-app/`), `YK_APP_VERSION` (default 0.1), `YK_BUILD_DATE` (default today), `YK_PROJECT` and `YK_FONTS` (where the screens and the typefaces are).

The two apps share everything in `yaoki-app/src/`. What differs is set in `LEVELS` at the top of `build.mjs`: the screens folder, the name on the Home Screen ("Yaoki" and "Yaoki N1"), the level line in the menu and the icon colour (gold and indigo).

## Put it on the web

Copy the contents of `docs/` (or `yaoki-app/dist/`) to any https address. Every address inside the app is relative, so a sub-folder works. This repository is set up for GitHub Pages: Settings → Pages → Deploy from a branch, `main`, folder `/docs`. The empty `.nojekyll` file tells GitHub to serve the files as they are.

On the iPhone: open the address in Safari, tap Share, then Add to Home Screen, then open Yaoki from its icon once while online. The N1 app is added the same way from its own address (`/Yaoki/n1/`). The two apps keep separate progress and separate offline copies, and either can be on a phone without the other.

## Change a screen

Edit the screen file in `yaoki/project/` (or `yaoki-n1/project/` for N1), then build again. The same file runs on the design canvas, so publish it there too to keep the two alike. A new build has a new version; phones that have the app fetch it by themselves and switch to it at a quiet moment.

## Tests

```
cd check
npm install                      # typefaces for the canvas-side runs; Playwright must be installed as well
bash all-app.sh                  # the click-through suites against the app build
bash run-app.sh app-test.js      # app-only checks: saved progress, sizes, offline, updates
node preview-test.js             # the page shown inside Claude
```

`YK_LEVEL=N1` in front of any of these builds and tests the N1 app instead (`YK_LEVEL=N1 bash all-app.sh`). The click-throughs have N1 versions, which take the course as it is written, on 14 Oct 2026: `e2e-n1.js` makes a plan on the goal screen and works through its first day, the week test and a new plan; `e2e-mock-n1.js` runs mini mock 1 on the mock tab of four; `nb-check-n1.js` fills the notebook with every question of the course and reviews one of each kind; `sweep-n1.js` takes every lesson, week test, mini mock and day of the sample plan through its states (about seven minutes). The other checks read the level's clip lengths and words from `level.js`. `bash run-app.sh screens-app.js` opens every screen of the app on its own (for N1, in each state its plan can put it in) and reports anything that leaves the frame. Every check also reports content that runs into the bottom 34 px of a screen as a `PAD WARNING`, apart from its failures. `node two-apps-test.js` serves `docs/` as GitHub Pages does and checks that the two apps keep their own progress and offline copies (`YK_DOCS` names another folder laid out the same way). Two runs at once need their own build folder and port: `YK_TESTDIR=dist-test-2 PORT=8766 bash all-app.sh`; `PREVIEW_PORT` and `TWO_APPS_PORT` move the other two.

For the reader:

```
cd check
bash run-reader.sh reader-test.js    # serves docs/ at /Yaoki/ as GitHub Pages does, with the app's offline worker running
bash run-reader.sh aozora-test.js    # Aozora Bunko: search, fetch, parts, a downloaded zip (the copy of Aozora's files is played by the test)
```

`NODE_PATH` may point at another Playwright install (the default is `/opt/npm-tools/node_modules`).

`BACKUP=<a reader backup file>` also loads that file and opens every text in it.

`all.sh` runs the same suites against the design canvas's own runtime. That needs the canvas runtime file, which is not part of this folder (see `setup-site.sh` for where it is expected).

## The N1 app

The same app, with N1 content: one sample day in week 3 of the 8-week plan (原因・理由: 〜とあって and 〜ゆえに, with 〜こととて to compare), kanji read in a scene (station notices when the trains stop: 運転見合わせ, 架線, 復旧, 振替輸送 and more, asked as 漢字読み), a reading-skill item on finding the writer's claim, a quick-response listening drill (〜ものを), notebook entries and their review, and a 12-question mini mock in the N1 format: 漢字読み, 文脈規定, 言い換え類義, 用法, the three grammar types, a short text and 統合理解, then 課題理解, 概要理解 and 即時応答. The mock tab and the readiness screen use N1's figures: 110 and 55 minutes, a pass mark of 100 of 180, 19 in each section. All questions and texts are written for this app.

The spoken clips are made with the same text-to-speech model as the N5 to N2 app (Kokoro-82M), with its narrator and man voices; the woman's voice is Kokoro's jf_alpha. `python3 make-sound.py` in `yaoki-n1/` makes them again (Python 3.10 to 3.12 with `kokoro` 0.9.4, `misaki[ja]` and the UniDic dictionary from `python3 -m unidic download`, and ffmpeg); the texts it speaks are in the script.

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

**Saving.** On GitHub Pages the reader keeps its texts in the browser it is used in (`localStorage`, under keys starting `yomu.`; analyses in IndexedDB `yomu-reader`). The app's own saved progress is left alone. **Save a backup** writes the library to a file and **Load a backup** reads one, which is how texts move between devices or browsers. Texts already in the library are skipped. When the same page runs as a Claude artifact it saves to the artifact's own store instead.

Nothing a reader adds goes into this repository. Only the built-in sample (片目のだるま) is published; for Aozora Bunko only the list of works is, never a work's text.

## Licences

Third-party parts are listed in `docs/licenses.txt` (and the same list in `docs/n1/licenses.txt`): Preact (MIT), the typefaces M PLUS Rounded 1c and Klee One (SIL Open Font License 1.1), and the synthetic voices (Kokoro-82M, Apache-2.0; two voices built from Koniwa recordings, CC BY 3.0).

The reader's are in `docs/reader/licenses.txt`: Aozora Bunko (the catalog of works, and where the texts come from), JMdict (EDRDG, CC BY-SA 4.0, and the shortened word list under the same licence), kuromoji.js (Apache-2.0, with the mecab-ipadic notice) and the typefaces it loads from Google Fonts (SIL Open Font License 1.1).
