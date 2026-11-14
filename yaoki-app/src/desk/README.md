# The screens on a desktop

The app's screens are drawn for a phone, 390 by 844, as inline-styled templates (the design canvas's files in `yaoki/project/` and
`yaoki-n1/project/`). On a desktop browser (`html.yk-desk`, a window of at least 700 by 560: see `../app.css` and `../yk-app.js`) the
build lays them out fluid in a pane beside the app's sidebar, and the files here give each screen a **landscape layout**: what a
desktop monitor, wider than it is tall, should show. The phone never sees any of it.

`build.mjs` joins the files here into `assets/desk.css`: files whose name starts with `_` first (`_base.css`, the rules every layout
shares; `_single.css`, the tidy-ups for a pane too narrow for a landscape layout), then one file per screen (`Drill.css`, …). Each
screen's file serves both apps (the Study app and the N1 course): their templates differ, but they carry the same hooks.

## How a layout is written

- **Only on a wide pane.** Every rule sits inside `@container yk (min-width: 880px) { … }` and starts with `html.yk-desk`. The pane
  (`#yk-view`) is a size container named `yk`, so a layout follows the pane's width whether the sidebar is there or not: a window of
  1120 px or more. A narrower pane keeps the phone's single column (`_single.css`).
- **Hooks, not inline styles.** The screens' styles are inline, so a layout targets hooks added to the templates:
  - `data-d="<region>"` on the elements the layout places. The common names are `bar` (the top row: close or back, progress,
    label), `head` (the title block), `main` (what the learner reads or answers), `side` (what comes beside it: feedback,
    explanation, summary), `act` (the row of the main action), `gap` (a spacer the phone needs and a desktop does not). A screen may
    add names of its own (`route`, `card`, `list`, …); keep them short, and use the same name for the same region in both apps.
  - `data-k` for the keyboard (handled in `yk-app.js`, desktop only): `data-k="choice"` on each answer, in order (the keys 1 to 9
    pick them), `data-k="go"` on the main action, Check, Next or Start (Enter; `_base.css` shows the key on it), `data-k="play"` on a
    sound to play (Space).
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

Quick rebuild (a few seconds), into a folder a full build made once (`cp -a dist dist-desk-mine` the first time):

```
cd yaoki-app && YK_QUICK=1 YK_OUT=dist-desk-mine node build.mjs
YK_LEVEL=N1 YK_QUICK=1 YK_OUT=dist-n1-desk-mine node build.mjs
```

The kit in `/home/user/deskkit` (outside the repository) screenshots a screen at landscape sizes in every known state, and proves the
phone's rendering unchanged against the builds made before the website existed (`dist-baseline`, `dist-n1-baseline`). A full build
must never be published from a quick one.
