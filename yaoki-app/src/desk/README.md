# The screens on a desktop

The app's screens are drawn for a phone, 390 by 844, as inline-styled templates (the design canvas's files in `yaoki/project/` and
`yaoki-n1/project/`). On a desktop browser (`html.yk-desk`, a window of at least 700 by 560: see `../app.css` and `../yk-app.js`) the
build lays them out fluid in a pane beside the app's sidebar, and the files here give each screen a **landscape layout**: what a
desktop monitor, wider than it is tall, should show. The phone never sees any of it.

`build.mjs` joins the files here into `assets/desk.css`: files whose name starts with `_` first (`_base.css`, the rules every layout
shares; `_single.css`, the tidy-ups for a pane too narrow for a landscape layout), then one file per screen (`Drill.css`, …). Each
screen's file serves both apps (the Study app and the N1 course): their templates differ, but they carry the same hooks.

A screen with no file here yet (one the app gains before the website lays it out) is not stretched across the pane: the build adds a
rule at the end of `desk.css` that draws every screen without a file of its own as the phone draws it, in a column 560 px wide in
the middle of the pane. Adding the screen's file takes it out of that rule. Likewise a place the app's tab bar gains is in the
sidebar without a change to `index.html` (`yk-app.js`, `mirrorTabs`: an item made from the tab, its icon and label, in the tab
bar's order), and the browser's tab is named after it; list the place in `index.html` and in `TITLES` (`yk-app.js`) to give it the
sidebar's own icon and name. `check/new-places-test.js` checks all three.

## How a layout is written

- **Only on a wide pane.** Every rule sits inside `@container yk (min-width: 880px) { … }` and starts with `html.yk-desk`. The pane
  (`#yk-view`) is a container named `yk` (`container: yk / inline-size`: its width can be queried, not its height), so a layout
  follows the pane's width whether the sidebar is there or not: a window of 1120 px or more. For the height, use `vh` or `svh`. A narrower pane keeps the phone's single column (`_single.css`).
- **Hooks, not inline styles.** The screens' styles are inline, so a layout targets hooks added to the templates:
  - `data-d="<region>"` on the elements the layout places. The common names are `bar` (the top row: close or back, progress,
    label), `head` (the title block), `main` (what the learner reads or answers), `side` (what comes beside it: feedback,
    explanation, summary), `act` (the row of the main action), `gap` (a spacer the phone needs and a desktop does not). A screen may
    add names of its own (`route`, `card`, `list`, …); keep them short, and use the same name for the same region in both apps.
  - `data-k` for the keyboard (handled in `yk-app.js`, desktop only): `data-k="choice"` on each answer, in order (the keys 1 to 9
    pick them), `data-k="go"` on the main action, Check, Next or Start (Enter; `_base.css` shows the key on it), `data-k="play"` on a
    sound to play (Space), `data-k="on"` on a way on that is the main action only when the screen has no `go` (Enter takes it then), `data-k="close"` on what closes a screen's dialog or a panel it docks beside its content (the scrim, a Close or Cancel button:
    Escape).
  - A screen's own dialog (`role="dialog" aria-modal="true"`: an answer sheet, a quit or open-early question) is a dialog on a
    desktop: focus goes into it when it opens, Tab stays in it, the keys look for `data-k` in it only, Escape takes its
    `data-k="close"` (or `data-d="close"`, or a button whose name starts with Close), and focus goes back to what opened it.
- **Grouping without changing the phone.** When a layout needs a box around regions that are siblings on the phone, wrap them in
  `<div data-d="…" style="display: contents">`: a box with `display: contents` is not laid out, so the phone draws exactly what it
  drew before. The layout then gives the wrapper a real `display` (marked `!important`, since it overrides the inline style).
- **Overriding an inline style** needs `!important`. Match inline styles by attribute only as a last resort, and then in the
  browser's own spelling of them (`0px`, `rgb(…)`), which is not the template's.
- **Nothing else in the templates changes**: no inline style, no text, no structure beyond the hooks and the `display: contents`
  wrappers. The phone's rendering must stay identical to the pixel (see Checks).

## What a landscape layout should do

- **Use the width.** Put side by side what belongs together: what the learner reads or answers (the paper) on one side, what
  answers back (feedback, the reasons, the next step) on the other; a hub as a dashboard (a summary beside its list, cards in a row,
  not in a stack).
- **Keep the action with its content.** A main action sits right under or beside what it acts on, never pinned to the bottom of the
  window far from it. Buttons have a desktop's width (a minimum of about 240 px, not the whole column) unless they sit in a narrow
  panel.
- **Respect the height.** A laptop's window is about 1366 by 657 once the browser has taken its share, which leaves a pane about
  600 px tall: a screen fits it without the page scrolling. Long content scrolls inside its own column, and the main action stays
  in view.
- **Readable measure.** Running text at most about 70 characters a line (about 40 Japanese characters): do not stretch paragraphs
  across 1200 px. A screen's content sits in the middle of a wide pane, at most 1240 px wide (`_base.css`).
- **Japanese a little larger** where it is what is studied (the sentence, the passage, the kanji): there is room.
- **The same visual language**: the colours, the ink outlines and the hard shadows of the phone design. An empty panel may say,
  through CSS `content`, what will appear in it, in the app's way (a Japanese label, then English).

## Checks

Quick rebuild (a few seconds), into a folder a full build made once (`cp -a dist dist-desk` the first time):

```
cd yaoki-app && YK_QUICK=1 YK_OUT=dist-desk node build.mjs
YK_LEVEL=N1 YK_QUICK=1 YK_OUT=dist-n1-desk node build.mjs
```

Then, from `check/` (with `NODE_PATH` reaching Playwright, as for the other checks):

- `node desk-shots.js --dist ../yaoki-app/dist-desk --port 8930 --screen Drill --level N2 --sizes 1366x657,1920x1080 --out out/desk`
  screenshots the screen in every state `screen-states.js` lists (the same states `screens-app.js` opens), and prints what it can
  measure: page errors, parts sticking out of the pane, the page scrolling sideways. `--steps` adds states reached by interaction,
  e.g. `'[{"click":"[data-k=choice]"},{"key":"Enter"},{"shot":"checked"}]'`. Look at the screenshots at 1366x657 (a laptop with
  its browser: a pane about 600 px tall), 1920x1080, 2560x1440, 1120x700 (the narrowest landscape pane) and 1024x768 (the single
  column).
- `node desk-phone.js --a <an earlier build> --b ../yaoki-app/dist-desk --screens Drill --level N2 --out out/phone` proves the
  phone's rendering of every state unchanged, byte for byte, at rest (animations off in both builds), at 390x844, 375x812 and
  640x800 in light and dark; `--steps` for interaction states. It must print `all N identical`. Keep a build of the last release (or
  of `main`) as the earlier build. A full build must never be published from a quick one.
