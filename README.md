# Yaoki: source of the iPhone web app prototype

Yaoki is a JLPT study app prototype (N2 sample content). This folder holds everything needed to rebuild the installable web app. The design itself lives on the design canvas "Yaoki JLPT App"; the screens here are copies of the canvas's files.

## What is where

| Folder | What it holds |
|---|---|
| `docs/` | The built app, served by GitHub Pages at https://jorycook.github.io/Yaoki/. This is all a phone needs. |
| `yaoki/project/` | The design canvas's files: 27 screens (`*.dc.html`), the sound player (`sound.js`) and the clips (`sound-mock.js`, `sound-lessons.js`). 17 of the screens make up the app. |
| `yaoki-app/` | The app around the screens: `src/` (runtime, shell, install page, offline worker, page, manifest), `build.mjs`, `fonts.py`. |
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

`all.sh` runs the same suites against the design canvas's own runtime. That needs the canvas runtime file, which is not part of this folder (see `setup-site.sh` for where it is expected).

## Licences

Third-party parts are listed in `docs/licenses.txt`: Preact (MIT), the typefaces M PLUS Rounded 1c and Klee One (SIL Open Font License 1.1), and the synthetic voices (Kokoro-82M, Apache-2.0; two voices built from Koniwa recordings, CC BY 3.0).
