# Yaoki: source of the iPhone web app prototype

Yaoki is a JLPT study app prototype (N2 sample content). This folder holds everything needed to rebuild the installable web app. The design itself lives on the design canvas "Yaoki JLPT App"; the screens here are copies of the canvas's files.

## What is where

| Folder | What it holds |
|---|---|
| `docs/` | The built app, served by GitHub Pages at https://jorycook.github.io/Yaoki/. This is all a phone needs. |
| `yaoki/project/` | The design canvas's files: 27 screens (`*.dc.html`), the sound player (`sound.js`) and the clips (`sound-mock.js`, `sound-lessons.js`). 17 of the screens make up the app. |
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
```

`dist/` is what `docs/` is a copy of: after a build, replace `docs/` with it and push. Settings, all optional: `YK_OUT` (output folder), `YK_APP_VERSION` (default 0.1), `YK_BUILD_DATE` (default today), `YK_PROJECT` and `YK_FONTS` (where the screens and the typefaces are).

## Put it on the web

Copy the contents of `docs/` (or `yaoki-app/dist/`) to any https address. Every address inside the app is relative, so a sub-folder works. This repository is set up for GitHub Pages: Settings → Pages → Deploy from a branch, `main`, folder `/docs`. The empty `.nojekyll` file tells GitHub to serve the files as they are.

On the iPhone: open the address in Safari, tap Share, then Add to Home Screen, then open Yaoki from its icon once while online.

## Change a screen

Edit the screen file in `yaoki/project/`, then build again. The same file runs on the design canvas, so publish it there too to keep the two alike. A new build has a new version; phones that have the app fetch it by themselves and switch to it at a quiet moment.

## Tests

```
cd check
npm install                      # typefaces for the canvas-side runs; Playwright must be installed as well
bash all-app.sh                  # the click-through suites against the app build
bash run-app.sh app-test.js      # app-only checks: saved progress, sizes, offline, updates
node preview-test.js             # the page shown inside Claude
```

For the reader:

```
cd check
bash run-reader.sh reader-test.js    # serves docs/ at /Yaoki/ as GitHub Pages does, with the app's offline worker running
bash run-reader.sh aozora-test.js    # Aozora Bunko: search, fetch, parts, a downloaded zip (the copy of Aozora's files is played by the test)
```

`NODE_PATH` may point at another Playwright install (the default is `/opt/npm-tools/node_modules`).

`BACKUP=<a reader backup file>` also loads that file and opens every text in it.

`all.sh` runs the same suites against the design canvas's own runtime. That needs the canvas runtime file, which is not part of this folder (see `setup-site.sh` for where it is expected).

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

Third-party parts are listed in `docs/licenses.txt`: Preact (MIT), the typefaces M PLUS Rounded 1c and Klee One (SIL Open Font License 1.1), and the synthetic voices (Kokoro-82M, Apache-2.0; two voices built from Koniwa recordings, CC BY 3.0).

The reader's are in `docs/reader/licenses.txt`: Aozora Bunko (the catalog of works, and where the texts come from), JMdict (EDRDG, CC BY-SA 4.0, and the shortened word list under the same licence), kuromoji.js (Apache-2.0, with the mecab-ipadic notice) and the typefaces it loads from Google Fonts (SIL Open Font License 1.1).
