// Plays Yaoki Typing (docs/typing/) in a browser with real key presses.
// Run: node check/typing-test.js            (SHOTS=<dir> keeps screenshots; takes about 6 minutes)
'use strict';

const path = require('node:path');
const { chromium } = require('playwright');

const url = 'file://' + path.resolve(__dirname, '..', 'docs', 'typing', 'index.html');
// The app's saved state lives under its folder: on this file:// page, docs/.
const appKey = 'yaoki.v1:' + path.resolve(__dirname, '..', 'docs') + '/';
const shots = process.env.SHOTS;

let failures = 0;
function check(label, ok, detail = '') {
  if (ok) console.log('ok   ' + label);
  else {
    failures++;
    console.log('FAIL ' + label + (detail ? '\n     ' + detail : ''));
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, ms = 5000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return true;
    await sleep(40);
  }
  return false;
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];

  // A page, optionally with saved state put in place before the game reads it.
  async function open(opts = {}, store = null, init = null) {
    const page = await browser.newPage(Object.assign({ viewport: { width: 1366, height: 768 } }, opts));
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/fonts\.g|net::/.test(m.text())) errors.push('console: ' + m.text());
    });
    if (store) {
      await page.addInitScript((pairs) => {
        if (!sessionStorage.getItem('seeded')) {
          for (const [k, v] of pairs) localStorage.setItem(k, JSON.stringify(v));
          sessionStorage.setItem('seeded', '1');
        }
      }, Object.entries(store));
    }
    for (const script of [].concat(init || [])) await page.addInitScript(script);
    // The page asks Google Fonts for its typefaces; the test does without them.
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.goto(url);
    return page;
  }
  const state = (page) => page.evaluate(() => window.ykTyping.state());
  const target = async (page, ms = 10000) => {
    await waitFor(async () => !!(await state(page)).target, ms);
    return (await state(page)).target;
  };
  const pick = async (page, mode, stage) => {
    await page.click(`#modes button:nth-child(${mode})`);
    if (stage) await page.click(`#stages .option:nth-child(${stage})`);
  };
  const quit = async (page) => {
    await page.keyboard.press('Escape');
    await page.click('#quit');
  };
  const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('yaoki.typing.v1') || '{}'));
  // The sound effects, recorded instead of played; and a fixed day for the stamp card.
  const SFX_STUB = 'window.__sfx = []; (function () { var stub = { unlock: function () {}, play: function (n, o) { window.__sfx.push([n, performance.now(), o || {}]); return true; } };'
    + ' Object.defineProperty(window, "TypingSfx", { configurable: true, get: function () { return stub; }, set: function () {} }); })();';
  const CLOCK = 'window.__ykNow = new Date(2026, 9, 27, 10, 0, 0).getTime();';
  const sounds = (page) => page.evaluate(() => window.__sfx.map((x) => x[0]));
  // The music, recorded instead of played.
  const MUSIC_STUB = 'window.__music = []; (function () { var st = { playing: false, paused: false, song: null, level: 1 };'
    + ' function rec(a) { window.__music.push(a); }'
    + ' var stub = { SONGS: [{ id: "one", bpm: 120 }, { id: "two", bpm: 130 }],'
    + ' start: function (s) { st.playing = true; st.paused = false; st.song = s; st.level = 1; rec(["start", s]); return true; },'
    + ' stop: function () { st.playing = false; rec(["stop"]); }, pause: function () { st.paused = true; rec(["pause"]); }, resume: function () { st.paused = false; rec(["resume"]); },'
    + ' setLevel: function (n) { st.level = n; rec(["level", n]); }, duck: function (x) { rec(["duck", x]); }, cue: function (n) { rec(["cue", n]); }, volume: function (v) { rec(["volume", v]); },'
    + ' state: function () { return st; } };'
    + ' Object.defineProperty(window, "TypingMusic", { configurable: true, get: function () { return stub; }, set: function () {} }); })();';
  const musicLog = (page) => page.evaluate(() => window.__music.map((x) => x.join(':')));
  // Types every card as it comes until the round is over (or `ms` passes).
  async function playOut(page, typeFor, ms = 60000) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const s = await state(page);
      if (s.phase !== 'play') return true;
      if (s.target && !s.falling) await typeFor(s.target);
      else await sleep(40);
    }
    return false;
  }

  // ---- the menu
  let page = await open();
  check('page loads with no script errors', errors.length === 0, errors.join('\n'));
  check('brand is タイピング · Yaoki Typing', /タイピング\s*Yaoki Typing/.test(await page.textContent('.brand')));
  check('four modes in the app\'s words', (await page.$$eval('#modes button', (b) => b.map((x) => x.textContent))).join('|').includes('かな入力'));
  check('links back to the app with a trailing slash', (await page.$$('a[href="../"]')).length >= 1);
  if (shots) await page.screenshot({ path: `${shots}/menu.png`, fullPage: true });

  // ---- romaji: type cards by their hints; misses; Backspace; IME
  await pick(page, 2, 1);
  await page.click('#start');
  check('start opens the round', (await state(page)).phase === 'play');
  check('the brand bar is out of the way during a round', !(await page.isVisible('.bar')));
  for (let i = 0; i < 6; i++) {
    const t = await target(page);
    await page.keyboard.type(t.spell, { delay: 25 });
    if (i === 4) {
      // five clean cards in a row: the run chip turns gold, Yaoki smiles and cheers
      const s5 = await state(page);
      check('five clean cards in a row light the run chip', s5.run === 5 && (await page.$('#hud-run-chip.step')) !== null, JSON.stringify({ run: s5.run }));
      check('…and Yaoki cheers いいね！ with a smile', s5.yaoki.bubble === 'いいね！' && s5.yaoki.happy, JSON.stringify(s5.yaoki));
      check('…and the step is said with the next card', await waitFor(async () => /5 clean in a row/.test(await page.textContent('#sr-prompt')), 4000), await page.textContent('#sr-prompt'));
      if (shots) {
        await sleep(120);
        await page.screenshot({ path: `${shots}/run-step.png` });
      }
    }
  }
  check('typing each card clears it', (await state(page)).cleared >= 6, JSON.stringify(await state(page)));
  check('the segmented bar follows the round', (await page.$$('#progress i.done')).length >= 6);
  let s = await state(page);
  check('the run counts the clean cards', s.run === s.clean && s.bestRun === s.run && s.run >= 6, JSON.stringify({ run: s.run, clean: s.clean, bestRun: s.bestRun }));

  // '1' starts no romaji spelling, so it is always a miss
  const t = await target(page);
  const runBefore = s.run;
  await page.keyboard.press('1');
  s = await state(page);
  check('a wrong key does not clear the card', s.target && s.target.typed === '' && s.cleared >= 6);
  check('a miss does not end the run until the card is over, and the chip is never red', s.run === runBefore && (await page.$('#hud-run-chip.step')) === null
    && await page.evaluate(() => getComputedStyle(document.getElementById('hud-run-chip')).color !== getComputedStyle(document.querySelector('.status.bad') || document.body).color));
  check('a first miss shows the kana being typed (hint level 1)', s.target && s.target.level === 1, JSON.stringify(s.target));
  check('the miss flashes on the keyboard', (await page.$('#kb .key.miss')) !== null);
  check('the next key is lit while the hint shows', await waitFor(async () => (await page.$('#kb .key.next')) !== null, 1000));
  await page.keyboard.press('1');
  check('a second miss shows the whole spelling (hint level 2)', (await state(page)).target.level === 2);
  if (shots) await page.screenshot({ path: `${shots}/romaji-miss.png` });
  if (t.spell.length > 1) {
    await page.keyboard.press(t.spell[0]);
    await page.keyboard.press('Backspace');
    check('Backspace takes back a typed letter', (await state(page)).target.typed === '');
  }
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Process', keyCode: 229 })));
  check('an IME key shows the 英数 warning', /英数/.test(await page.textContent('#status')));

  // ---- a fall, and the card comes back after the number of cards the game says
  check('the card reaches Yaoki and knocks him over', await waitFor(async () => (await state(page)).falling, 20000));
  const fall = await state(page);
  const fallen = t.text;
  if (shots) {
    await sleep(400);
    await page.screenshot({ path: `${shots}/fall.png` });
  }
  check('the fall is counted', fall.falls === 1);
  check('a fall ends the clean run, quietly', fall.run === 0 && (await page.$('#hud-run-chip.step')) === null);
  check('he says よいしょ！ as he gets up', await waitFor(async () => ((await state(page)).yaoki || {}).bubble === 'よいしょ！', 4000));
  check('he gets up and the round goes on', await waitFor(async () => !(await state(page)).falling, 5000));
  const order = [];
  for (let i = 0; i < 8; i++) {
    const c = await target(page);
    if (!c) break;
    order.push(c.text);
    if (c.text === fallen) break;
    await page.keyboard.type(c.spell, { delay: 20 });
  }
  check(`the fallen card comes back after the ${fall.back} cards it says`, order.indexOf(fallen) === fall.back, order.join(' '));
  // typed clean when it comes back: a comeback (起), not a clean card, and the run is left alone
  s = await state(page);
  const before起 = { clean: s.clean, run: s.run };
  await page.keyboard.type(s.target.spell, { delay: 20 });
  s = await state(page);
  const up = s.cards.find((c) => c.text === fallen && c.state === 'done');
  check('the fallen card typed clean when it comes back is a comeback (起)', s.comebacks === 1 && up && up.comeback && !up.clean, JSON.stringify({ comebacks: s.comebacks, up }));
  check('…it is not counted clean and leaves the run alone', s.clean === before起.clean && s.run === before起.run, JSON.stringify({ before: before起, clean: s.clean, run: s.run }));
  await quit(page);
  check('Quit goes back to the menu, with focus on Start', (await state(page)).phase === 'menu' && await page.evaluate(() => document.activeElement.id === 'start'));

  // ---- a card that falls last comes back from the right edge, not in front of Yaoki
  await pick(page, 3, 1);
  await page.click('#len-seg button:nth-child(1)');
  await page.click('#start');
  for (let i = 0; i < 9; i++) {
    const c = await target(page);
    await page.keyboard.type(c.key, { delay: 20 });
  }
  const lastCard = await target(page);
  await waitFor(async () => (await state(page)).falling, 20000);
  await waitFor(async () => !(await state(page)).falling, 5000);
  await sleep(60);
  s = await state(page);
  const back = s.cards.find((c) => c.state === 'live' && c.text === lastCard.text);
  check('a card that falls last comes back from the right edge', back && back.x >= s.W - 60, JSON.stringify({ back, W: s.W }));
  await quit(page);

  // ---- symbol keys: a 10-card round with three misses, to the result and its stamp
  // (from clean stats: the card that fell above is rightly a weak spot already)
  await page.evaluate(() => {
    const v = JSON.parse(localStorage.getItem('yaoki.typing.v1'));
    Object.assign(v, { stats: {}, best: {}, pace: {} });
    localStorage.setItem('yaoki.typing.v1', JSON.stringify(v));
  });
  await page.reload();
  await page.click('#start');
  // a player who reads each card for a moment, and slips on the first three
  let missed = 0;
  await playOut(page, async (c) => {
    await sleep(300);
    if (missed < 3) {
      missed++;
      await page.keyboard.press('1');
    }
    await page.keyboard.type(c.key, { delay: 20 });
  });
  check('a finished round shows the result', await page.isVisible('#result'));
  check('the result counts clean cards', (await page.textContent('#res-clean')) === '7', await page.textContent('#res-clean'));
  check('7 clean cards of 10 earn よくできました', /^よく/.test(await page.textContent('#res-stamp-text')), await page.textContent('#res-stamp-text'));
  check('focus moves to the result heading', await page.evaluate(() => document.activeElement.id === 'res-title'));
  await sleep(100);
  check('the result is announced in a live region that is not hidden', await page.evaluate(() => {
    const el = document.getElementById('sr-prompt');
    return /Round over/.test(el.textContent) && !el.closest('[hidden]');
  }));
  check('the three missed keys show as weak spots', (await page.$$('#res-weak span')).length === 3);
  let saved = await stored(page);
  check('the round\'s pace and best are kept', saved.pace && saved.pace['symbol:plain'] && saved.best && saved.best['symbol:plain'] > 0, JSON.stringify({ pace: saved.pace, best: saved.best }));
  check('a first best is announced', await page.isVisible('#res-best .tag'));
  if (shots) {
    await sleep(700);
    await page.screenshot({ path: `${shots}/result.png`, fullPage: true });
  }
  await page.keyboard.press('Escape');
  check('the weak-spot round is offered for the three keys', /\(3\)/.test(await page.textContent('#start-weak')));
  await page.reload();
  check('weak spots survive a reload', /\(3\)/.test(await page.textContent('#start-weak')));
  await page.click('#start-weak');
  s = await state(page);
  const weakKeys = Object.keys((await stored(page)).stats.symbol);
  const wt = await target(page);
  check('the weak-spot round deals only the weak cards, each twice', s.total === 6 && weakKeys.includes(wt.text), JSON.stringify({ total: s.total, text: wt.text, weakKeys }));
  await quit(page);

  // ---- a weak spot leaves the list after its third clean answer in a row
  await page.evaluate(() => {
    const v = JSON.parse(localStorage.getItem('yaoki.typing.v1'));
    v.stats = { symbol: { '@': { miss: 1, ok: 2 } } };
    localStorage.setItem('yaoki.typing.v1', JSON.stringify(v));
  });
  await page.reload();
  const bestBefore = (await stored(page)).best['symbol:plain'];
  await page.click('#start-weak');
  await playOut(page, async (c) => {
    await sleep(250);
    await page.keyboard.type(c.key, { delay: 20 });
  });
  saved = await stored(page);
  check('three clean answers in a row take a key off the weak list', !saved.stats.symbol['@'], JSON.stringify(saved.stats));
  check('a weak-spot round leaves the best alone', saved.best['symbol:plain'] === bestBefore);
  check('the result shows the key that left the weak list (卒業)', (await page.isVisible('#res-grad-box')) && (await page.textContent('#res-grad')).includes('@') && (await state(page)).graduated.includes('@'));
  check('…and that no weak spots are left on the stage', /苦手ゼロ/.test(await page.textContent('#res-grad-note')));
  await page.keyboard.press('Escape');

  // ---- missed again in the same round: it has not left the list after all
  await page.evaluate(() => {
    const v = JSON.parse(localStorage.getItem('yaoki.typing.v1'));
    v.stats = { symbol: { '@': { miss: 1, ok: 2 } } };
    localStorage.setItem('yaoki.typing.v1', JSON.stringify(v));
  });
  await page.reload();
  await page.click('#start-weak');
  let firstAt = true;
  await playOut(page, async (c) => {
    await sleep(250);
    if (!firstAt) await page.keyboard.press('1');
    firstAt = false;
    await page.keyboard.type(c.key, { delay: 20 });
  });
  saved = await stored(page);
  check('a key off the list but missed again in the round is not shown as 卒業', (await page.isHidden('#res-grad-box')) && !(await state(page)).graduated.includes('@') && saved.stats.symbol['@'] && saved.stats.symbol['@'].miss === 1, JSON.stringify(saved.stats));
  await page.keyboard.press('Escape');

  // ---- the saved pace sets the round's time: T = 1.4 × (reaction + keys / rate)
  await page.evaluate(() => {
    const v = JSON.parse(localStorage.getItem('yaoki.typing.v1'));
    v.pace = { 'symbol:plain': { r: 3, p: 0.5 } };
    localStorage.setItem('yaoki.typing.v1', JSON.stringify(v));
  });
  await page.reload();
  await page.click('#start');
  await target(page);
  s = await state(page);
  check('a saved pace is used for the round', Math.abs(s.T - 7) < 0.01, 'T ' + s.T);
  await quit(page);

  // ---- quitting keeps the misses already made
  await page.click('#len-seg button:nth-child(1)');
  await page.click('#start');
  const qt = await target(page);
  await page.keyboard.press('1');
  await quit(page);
  saved = await stored(page);
  check('Quit saves the misses of the round so far', !!(saved.stats.symbol && saved.stats.symbol[qt.text]), JSON.stringify(saved.stats));

  // ---- the settings sheet is modal, from the menu and from the pause sheet
  await page.click('#open-settings');
  for (let i = 0; i < 6; i++) await page.keyboard.press('Tab');
  check('Tab stays inside the settings sheet', await page.evaluate(() => !!document.activeElement.closest('#settings-sheet')));
  await page.click('#settings-h');
  await page.keyboard.press('Enter');
  check('Enter does not start a round behind the settings sheet', (await state(page)).phase === 'menu');
  await page.keyboard.press('Escape');
  check('Escape closes the settings sheet wherever focus is', await page.isHidden('#settings-sheet'));
  await page.click('#start');
  await target(page);
  await page.keyboard.press('Escape');
  await page.click('#pause-settings');
  check('settings open from the pause sheet', (await page.isVisible('#settings-sheet')) && (await page.isHidden('#pause-sheet')));
  await page.keyboard.press('Escape');
  check('closing them goes back to the pause sheet', (await page.isVisible('#pause-sheet')) && await page.evaluate(() => document.activeElement.id === 'resume'));
  await page.click('#quit');

  // ---- hint settings: never, always, and the stuck timer
  const setHints = async (n) => {
    await page.click('#open-settings');
    await page.click(`#hint-seg button:nth-child(${n})`);
    await page.click('#close-settings');
  };
  await setHints(3);
  check('the hint setting is kept', (await stored(page)).hints === 'never');
  await pick(page, 2, 1);
  await page.click('#start');
  await target(page);
  await page.keyboard.press('1');
  await page.keyboard.press('1');
  s = await state(page);
  check('with hints off, misses show no hint and no note', s.target.level === 0 && (await page.textContent('#status')) === '', JSON.stringify(s.target));
  await waitFor(async () => (await state(page)).falling, 20000);
  check('with hints off, a fall still shows the answer', (await state(page)).answerShown === true);
  await quit(page);
  await setHints(1);
  await page.click('#start');
  check('with hints always on, the whole spelling shows at once', (await target(page)).level === 2);
  await quit(page);
  await setHints(2);
  await page.click('#start');
  await target(page);
  check('when stuck, the first hint comes after 5 seconds', await waitFor(async () => ((await state(page)).target || {}).level === 1, 7000));
  // a card with a hint shown is not clean; between keys the hint comes after 3 seconds
  let st = await state(page);
  const cleanBefore = st.clean;
  await page.keyboard.type(st.target.spell, { delay: 20 });
  check('a card typed after a hint showed is not counted clean', (await state(page)).clean === cleanBefore);
  await quit(page);
  await page.click('#start');
  let long = await target(page);
  while (long && long.spell.length < 2) {
    await page.keyboard.type(long.spell);
    long = await target(page);
  }
  await page.keyboard.press(long.spell[0]);
  check('between keys, the stuck hint comes after 3 seconds', await waitFor(async () => ((await state(page)).target || {}).level === 1, 4500));
  await quit(page);

  // ---- notes for the usual slips: shown when stuck, not with hints off (seeded を)
  await page.evaluate(() => {
    const v = JSON.parse(localStorage.getItem('yaoki.typing.v1'));
    v.stats = { kana: { 'を': { miss: 2, ok: 0 } } };
    v.hints = 'never';
    localStorage.setItem('yaoki.typing.v1', JSON.stringify(v));
  });
  await page.reload();
  await page.click('#start-weak');
  check('the weak-spot round deals を', (await target(page)).text === 'を');
  await page.keyboard.press('o');
  check('with hints off, a slip gets no note', (await page.textContent('#status')) === '');
  await page.keyboard.press('Escape');
  await page.click('#pause-settings');
  await page.click('#hint-seg button:nth-child(2)');
  await page.click('#close-settings');
  await page.click('#resume');
  await page.keyboard.press('o');
  check('when stuck, o for を gets the を = wo note', /wo/.test(await page.textContent('#status')));
  check('only the kana of the note is marked Japanese', await page.evaluate(() => [...document.querySelectorAll('#status [lang="ja"]')].every((e) => !/[a-z]/.test(e.textContent))));
  await quit(page);

  // ---- a best does not count with hints always on
  await setHints(1);
  await pick(page, 3, 2);
  await page.click('#len-seg button:nth-child(1)');
  await page.click('#start');
  await playOut(page, (c) => page.keyboard.type(c.key, { delay: 20 }));
  check('a round with hints always on leaves the best alone', !(await stored(page)).best['symbol:shifted']);
  check('with hints always on, the result says so instead of counting hints', (await page.textContent('#res-hints')) === '—');
  check('ten clean cards earn たいへんよくできました', /^たいへん/.test(await page.textContent('#res-stamp-text')));
  check('with hints always on, no run record and no ring towards はなまる are kept', !(await stored(page)).run['symbol:shifted'] && !(await stored(page)).seal['symbol:shifted'] && /not kept/.test(await page.textContent('#res-run-en')));
  await page.keyboard.press('Escape');
  await setHints(2);

  // ---- hints turned on for part of a round: it does not count for the best either
  await setHints(2);
  await pick(page, 3, 3);
  await page.click('#start');
  await target(page);
  await page.keyboard.press('Escape');
  await page.click('#pause-settings');
  await page.click('#hint-seg button:nth-child(1)');
  await page.click('#close-settings');
  await page.click('#resume');
  await target(page);
  await page.keyboard.press('Escape');
  await page.click('#pause-settings');
  await page.click('#hint-seg button:nth-child(2)');
  await page.click('#close-settings');
  await page.click('#resume');
  await playOut(page, (c) => page.keyboard.type(c.key, { delay: 20 }));
  check('a round with hints always on for part of it leaves the best alone', !(await stored(page)).best['symbol:punct']);
  check('…and its result says hints were on for part of it', /part of the round/.test(await page.textContent('#res-hints-en')));
  await page.keyboard.press('Escape');
  check('the menu does not repeat the last round\'s words to a screen reader', (await page.textContent('#sr-prompt')) === '');
  await pick(page, 3, 1);

  // ---- five misses in ten cards: がんばりましょう
  await page.click('#start');
  let slips = 0;
  await playOut(page, async (c) => {
    if (slips < 5) {
      slips++;
      await page.keyboard.press('1');
    }
    await page.keyboard.type(c.key, { delay: 20 });
  });
  check('5 clean cards of 10 earn がんばりましょう', /^がんばり/.test(await page.textContent('#res-stamp-text')));
  await page.keyboard.press('Escape');

  // ---- kana input: physical keys, the Shift layer, and an IME in kana mode
  await pick(page, 4, 1);
  await page.click('#start');
  for (let i = 0; i < 3; i++) {
    const c = await target(page);
    await page.keyboard.press(c.code);
  }
  check('kana keys clear cards by key position', (await state(page)).cleared === 3);
  const kc = await target(page);
  await page.evaluate((code) => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Process', keyCode: 229, code })), kc.code);
  check('a kana card is cleared even with the input method on', (await state(page)).cleared === 4);
  await quit(page);
  await pick(page, 4, 5);
  await page.click('#start');
  const sc = await target(page);
  await page.keyboard.press(sc.code);
  check('a Shift-layer kana pressed without Shift is a miss, and says so', (await state(page)).cleared === 0 && /needs Shift/.test(await page.textContent('#status')));
  await page.keyboard.down('Shift');
  await page.keyboard.press(sc.code);
  await page.keyboard.up('Shift');
  check('the same key with Shift clears it', (await state(page)).cleared === 1);
  await quit(page);

  // ---- the next key and the other hand's Shift are lit (hints always on)
  await setHints(1);
  await pick(page, 3, 2);
  await page.click('#start');
  const shifted = await target(page);
  await sleep(100);
  const lit = await page.$$eval('#kb .key.next', (els) => els.map((e) => e.dataset.code));
  const left = /^(Digit[1-5]|Key[QWERTASDFGZXCVB])$/.test(shifted.code);
  check('the key and the Shift of the other hand are lit', lit.includes(shifted.code) && lit.includes(left ? 'ShiftRight' : 'ShiftLeft') && lit.length === 2, JSON.stringify({ code: shifted.code, lit }));
  await quit(page);
  await setHints(2);
  await page.close();

  // ---- course words: the learner's week, the reading and meaning, the word's sound
  page = await open({ colorScheme: 'dark' }, { [appKey]: { started: true, level: 'N4', cur: 'n4u03d2' } }, [() => {
    window.ykSound = { has: () => true, unlock: () => true, play: (clip) => { window.__played = clip; return true; } };
  }, SFX_STUB, MUSIC_STUB]);
  check('the menu opens at the learner\'s course words', (await page.textContent('#modes [aria-pressed="true"]')).includes('語彙'));
  check('the N4 weeks load from ../assets', await waitFor(async () => (await page.$$('#units .option')).length === 10, 10000));
  check('the learner\'s week is picked and marked 今', /第3週/.test(await page.textContent('#units [aria-pressed="true"]')) && /今/.test(await page.textContent('#units [aria-pressed="true"]')));
  await page.click('#start');
  const w = await target(page);
  await sleep(100);
  const info = await page.textContent('#info');
  check('the word, its reading and meaning show under the game', info.includes(w.text) && info.includes(w.reading), info);
  await page.keyboard.type(w.spell, { delay: 25 });
  const played = await page.evaluate(() => window.__played);
  check('a cleared word is spoken with its clip', /^s_n4u3d\d_/.test(played || ''), played);
  check('…and no stamp sound plays over the word', !(await sounds(page)).includes('clear'), (await sounds(page)).join(','));
  check('…and the music dips while it is spoken', (await musicLog(page)).some((x) => x.startsWith('duck')), (await musicLog(page)).join(' '));
  if (shots) await page.screenshot({ path: `${shots}/course-dark.png` });
  await page.close();

  // ---- kanji (advanced): the reading is the answer, shown only as a hint
  page = await open();
  await pick(page, 5, 2);
  check('the kanji mode has its five levels', (await page.$$('#stages .option')).length === 5 && /漢字/.test(await page.textContent('#modes [aria-pressed="true"]')));
  await page.click('#len-seg button:nth-child(1)');
  await page.click('#start');
  let kj = await target(page);
  check('a kanji card shows the word without its reading', !!kj.reading && !kj.readingShown && !(await page.textContent('#info')).includes(kj.reading), JSON.stringify(kj));
  await page.keyboard.type(kj.spell, { delay: 25 });
  check('typed from memory, it is clean', (await state(page)).clean === 1);
  kj = await target(page);
  await page.keyboard.press('1');
  kj = (await state(page)).target;
  check('a slip shows the reading first, on the card and under the game', kj.readingShown && kj.level === 1 && (await page.textContent('#info')).includes(kj.reading), JSON.stringify(kj));
  await sleep(120);
  check('…but not yet the romaji or the keys', (await page.$('#kb .key.next')) === null);
  await page.keyboard.press('1');
  check('a second slip shows the romaji, and lights the next key', (await state(page)).target.level === 2 && await waitFor(async () => (await page.$('#kb .key.next')) !== null, 1000));
  await page.keyboard.type((await state(page)).target.spell, { delay: 25 });
  kj = await target(page);
  check('when stuck, the reading shows after 5 seconds', !kj.readingShown && await waitFor(async () => ((await state(page)).target || {}).readingShown === true, 7000));
  if (shots) await page.screenshot({ path: `${shots}/kanji.png` });
  await quit(page);
  await pick(page, 5, 5);
  await page.click('#start');
  const kdone = await playOut(page, (c) => page.keyboard.type(c.spell, { delay: 10 }), 120000);
  check('a round of sentences with kanji can be played to the end', kdone && (await state(page)).phase === 'result');
  await page.close();

  // ---- sound effects: quiet by default, all, off; the kana fill; the fall's drum and bounce
  page = await open({}, null, SFX_STUB);
  check('sound effects are quiet by default', (await state(page)).sfx === 'quiet');
  await pick(page, 2, 4);
  await page.click('#start');
  for (let i = 0; i < 2; i++) {
    const c = await target(page);
    await page.keyboard.type(c.spell, { delay: 25 });
  }
  let heard = await sounds(page);
  check('quiet: a stamp sound for each cleared card, and no key ticks', heard.filter((n) => n === 'clear').length === 2 && !heard.includes('key'), heard.join(','));
  let kt = await target(page);
  check('no kana is filled on a card before its first key', kt.kanaDone === 0 && kt.kanaLen > 1, JSON.stringify(kt));
  await page.keyboard.type(kt.spell.slice(0, -1), { delay: 25 });
  kt = (await state(page)).target;
  check('the kana typed so far are filled in on the card', kt.kanaDone > 0 && kt.kanaDone < kt.kanaLen, JSON.stringify(kt));
  const filled = kt.kanaDone;
  await page.keyboard.press('1');
  kt = (await state(page)).target;
  check('a miss leaves the fill as it was, and makes no sound when quiet', kt.kanaDone === filled && !(await sounds(page)).includes('miss'));
  const setSfx = async (n) => {
    await page.keyboard.press('Escape');
    await page.click('#pause-settings');
    await page.click(`#sfx-seg button:nth-child(${n})`);
    await page.click('#close-settings');
    await page.click('#resume');
  };
  await setSfx(3);
  await page.evaluate(() => { window.__sfx.length = 0; });
  kt = await target(page);
  await page.keyboard.type(kt.spell.slice(kt.typed.length), { delay: 25 });
  check('all: a tick for each right key', (await sounds(page)).includes('key'));
  check('a card cleared after a miss ends the clean run', (await state(page)).run === 0);
  await target(page);
  await page.keyboard.press('1');
  await page.keyboard.press('1');
  check('all: a knock for a miss, once however fast the misses come', (await sounds(page)).filter((n) => n === 'miss').length === 1, (await sounds(page)).join(','));
  await setSfx(1);
  await page.evaluate(() => { window.__sfx.length = 0; });
  kt = await target(page);
  await page.keyboard.type(kt.spell.slice(kt.typed.length), { delay: 25 });
  check('off: no sound at all', (await sounds(page)).length === 0, (await sounds(page)).join(','));
  check('the setting is kept', (await stored(page)).sfx === 'off');
  await setSfx(2);
  check('a card reaching Yaoki plays the drum', await waitFor(async () => (await state(page)).falling, 25000) && (await sounds(page)).includes('fall'));
  check('…and the bounce as he gets up', await waitFor(async () => (await sounds(page)).includes('up'), 4000));
  await quit(page);
  await page.close();

  // ---- Yaoki's tricks past the cleared cards, his words, the scene and the music
  page = await open({}, { 'yaoki.typing.v1': { mode: 'symbol', stage: { symbol: 'plain' }, len: 20, hints: 'stuck' } }, [SFX_STUB, MUSIC_STUB]);
  await page.click('#start');
  await target(page);
  let ms = await musicLog(page);
  s = await state(page);
  check('the round starts its music, quietly at first', ms.includes('start:' + s.song) && ms.includes('level:0') && !!s.song, ms.join(' '));
  check('the round is played in a scene', !!s.scene === !!(await page.evaluate(() => window.TypingScenes)), String(s.scene));
  check('Yaoki says something as the round starts', !!s.yaoki.bubble, JSON.stringify(s.yaoki));
  // each card is typed once Yaoki is free, so it gets its own trick when it reaches him
  const free = () => waitFor(async () => {
    const st = await state(page);
    return st.phase !== 'play' || (!st.yaoki.trick && !st.cards.some((x) => x.state === 'done' && (x.phase === 'ride' || x.phase === 'trick')));
  }, 6000);
  // five clean cards: jumps, then a spin for the fifth (a run of five); the run livens the music
  for (let i = 0; i < 5; i++) {
    await free();
    const c = await target(page);
    await page.keyboard.type(c.key, { delay: 20 });
  }
  ms = await musicLog(page);
  check('a clean run of five livens the music, with a fill', ms.includes('level:2') && ms.includes('cue:step'), ms.join(' '));
  // a slip: that card is ducked under
  await free();
  const c6 = await target(page);
  await page.keyboard.press('1');
  await page.keyboard.type(c6.key, { delay: 20 });
  check('cleared cards ride on to Yaoki and he gets past each with a trick', await waitFor(async () => {
    const tr = (await state(page)).tricks;
    return tr.jump + tr.spin + tr.duck + tr.smash >= 2;
  }, 20000), JSON.stringify((await state(page)).tricks));
  check('…a passed card lands behind him as its node', (await state(page)).cards.some((x) => x.state === 'done' && x.phase === 'node'));
  // pause and go on
  await page.keyboard.press('Escape');
  ms = await musicLog(page);
  check('pausing pauses the music', ms[ms.length - 1] === 'pause', ms.join(' '));
  await page.click('#resume');
  check('…and going on resumes it', (await musicLog(page)).includes('resume'));
  // a fall drops the music back; the card comes back and is typed clean: a smash
  const fallCard = await target(page);
  await waitFor(async () => (await state(page)).falling, 25000);
  check('a fall drops the music back', (await musicLog(page)).includes('cue:fall'));
  await waitFor(async () => !(await state(page)).falling, 5000);
  check('…and the groove comes back after it', (await musicLog(page)).slice(-3).some((x) => x === 'level:1'), (await musicLog(page)).slice(-4).join(' '));
  await playOut(page, async () => {
    await free();
    const c = (await state(page)).target;
    if (c) await page.keyboard.type(c.key, { delay: 20 });
  }, 150000);
  const done = (await state(page)).tricks;
  check('he does each trick: jump, spin in a run of five, duck after a slip, smash for a comeback', done.jump >= 1 && done.spin >= 1 && done.duck >= 1 && done.smash >= 1, JSON.stringify({ done, fell: fallCard.text }));
  ms = await musicLog(page);
  check('the last card and the end have their music', ms.includes('cue:last') && ms.includes('cue:end'), ms.slice(-6).join(' '));
  check('the scene drew all round without failing', !(await state(page)).sceneFailed && !(await page.evaluate(() => !!(window.TypingScenes && window.TypingScenes.draw.warned))));
  await page.keyboard.press('Escape');
  check('the music stops on the menu', (await musicLog(page)).slice(-1)[0] === 'stop');
  // with the music off, no music
  await page.click('#open-settings');
  await page.click('#music-seg button:nth-child(1)');
  await page.click('#close-settings');
  await page.evaluate(() => { window.__music.length = 0; });
  await page.click('#start');
  await target(page);
  check('with the music off, none plays', !(await musicLog(page)).some((x) => x.startsWith('start')), (await musicLog(page)).join(' '));
  check('…and the setting is kept', (await stored(page)).music === 'off');
  await quit(page);
  await page.close();

  // ---- a day: the stamp card, a weak-spot card, the run record, the stage's はなまる
  page = await open({}, { 'yaoki.typing.v1': {
    mode: 'symbol', stage: { symbol: 'plain' }, len: 10, hints: 'stuck', goal: 3,
    practice: { d: '2026-10-27', s: 179 }, seal: { 'symbol:plain': ['2026-10-25', '2026-10-26'] }, stats: { symbol: { '@': { miss: 2, ok: 0 } } },
  } }, [SFX_STUB, CLOCK]);
  check('the menu shows the stamp card with today\'s box open', (await page.textContent('#day-count')) === '0 / 7' && (await page.$('#day-boxes .day-box.open')) !== null);
  check('the stage shows its two rings towards はなまる', (await page.$$('#stages .option:nth-child(1) .rings i.on')).length === 2);
  if (shots) await page.screenshot({ path: `${shots}/menu-daycard.png` });
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.keyboard.press('Enter');
  check('Enter on the menu still starts a round', await waitFor(async () => (await state(page)).phase === 'play', 3000));
  check('the weak spot in the deck is marked on one card', (await state(page)).weakCards.dealt === 1);
  let sawWeak = false;
  let weakSaid = false;
  let sawFx = false;
  await playOut(page, async (c) => {
    if (c.weak) {
      sawWeak = c.text === '@';
      weakSaid = await waitFor(async () => /Weak spot/.test(await page.textContent('#sr-prompt')), 2500);
    }
    await sleep(150);
    await page.keyboard.type(c.key, { delay: 20 });
    if (!sawFx) sawFx = await waitFor(async () => (await state(page)).fx > 0, 300);
  });
  const atResult = await sounds(page);
  check('the result\'s stamp sounds once it lands, not before', !atResult.includes('result') && await waitFor(async () => (await sounds(page)).includes('result'), 1500), atResult.join(','));
  saved = await stored(page);
  check('typing up to the day\'s goal stamps today\'s box', JSON.stringify(saved.stampCard.days) === '["2026-10-27"]' && (await state(page)).day.stamped
    && /Today's stamp is in: 1 of 7/.test(await page.textContent('#res-day-line')), JSON.stringify(saved.stampCard));
  check('the weak-spot card is said to be one', sawWeak && weakSaid);
  check('typed clean, it is counted, and counts towards leaving the list', (await state(page)).weakCards.clean === 1 && /^1/.test(await page.textContent('#res-wc'))
    && (await page.isVisible('#res-wc-row')) && saved.stats.symbol['@'].ok === 1, JSON.stringify(saved.stats));
  check('a cleared card\'s stamp lands with ink', sawFx);
  check('a clean round sets the stage\'s run record', saved.run && saved.run['symbol:plain'] === 10 && /記録更新/.test(await page.textContent('#res-run-en')), JSON.stringify(saved.run));
  check('たいへんよくできました on a third day gives the stage its はなまる', saved.seal['symbol:plain'].length === 3
    && (await page.textContent('#res-seal-tag')) === 'はなまる！' && (await page.isVisible('#res-hana')), JSON.stringify(saved.seal));
  check('…and the result offers the next stage', (await page.isVisible('#res-next')) && /シフト/.test(await page.textContent('#res-next')));
  check('the result says it all in one line', await page.evaluate(() => /Round over.*Longest clean run 10.*Today's stamp is in.*はなまる/.test(document.getElementById('sr-prompt').textContent)));
  if (shots) {
    await sleep(1600);
    await page.screenshot({ path: `${shots}/result-full.png`, fullPage: true });
  }
  await page.keyboard.press('Escape');
  check('the menu shows the new stamp', (await page.textContent('#day-count')) === '1 / 7');
  check('…and the stage\'s はなまる', (await page.$('#stages .option:nth-child(1) .hana')) !== null);
  await page.click('#start');
  await playOut(page, async (c) => {
    await sleep(150);
    await page.keyboard.type(c.key, { delay: 20 });
  });
  saved = await stored(page);
  check('one stamp a day, however many rounds', saved.stampCard.days.length === 1, JSON.stringify(saved.stampCard));
  check('a stage keeps its はなまる, with no fourth ring', saved.seal['symbol:plain'].length === 3 && /already has/.test(await page.textContent('#res-seal-text')));
  check('matching the run record is not a new one', /stage record 10/.test(await page.textContent('#res-run-en')), await page.textContent('#res-run-en'));
  const typedBefore = saved.practice.s;
  await page.click('#res-next');
  check('Next plays the next stage', await waitFor(async () => (await state(page)).phase === 'play', 4000) && (await stored(page)).stage.symbol === 'shifted');
  for (let i = 0; i < 3; i++) {
    const c = await target(page);
    await page.keyboard.type(c.key, { delay: 20 });
  }
  await quit(page);
  check('Quit keeps the typing time of the round so far', (await stored(page)).practice.s > typedBefore);
  await page.close();

  // ---- a save from before the stamp card loads, and typing time stops without keys
  page = await open({}, { 'yaoki.typing.v1': { mode: 'symbol', stage: { symbol: 'plain' }, hints: 'stuck', len: 10, kb: true, sound: true, best: { 'symbol:plain': 55 }, pace: {}, stats: { symbol: { '@': { miss: 1, ok: 0 } } } } });
  check('an older save loads: the stamp card starts empty', (await page.textContent('#day-count')) === '0 / 7');
  await page.click('#open-settings');
  check('…sound effects are しずか and the goal 5 minutes', /しずか/.test(await page.textContent('#sfx-seg [aria-pressed="true"]')) && /5/.test(await page.textContent('#goal-seg [aria-pressed="true"]')));
  await page.keyboard.press('Escape');
  check('…its weak spots and best are kept', /\(1\)/.test(await page.textContent('#start-weak')) && (await stored(page)).best['symbol:plain'] === 55);
  await page.click('#start');
  await sleep(5000);
  await page.keyboard.press('1');
  await page.keyboard.down('Shift');
  // a held key's repeats are not typing
  for (let i = 0; i < 100; i++) {
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', code: 'ShiftLeft', shiftKey: true, repeat: true })));
    await sleep(100);
  }
  await page.keyboard.up('Shift');
  const idle = (await state(page)).practice;
  check('a key restarts typing time, which stops 8 seconds after the last press (held keys do not count)', idle >= 12.4 && idle <= 13.6, 'practice ' + idle);
  await quit(page);
  await page.close();

  // ---- the stamp card's seventh day completes it; a lower goal stamps at once; leaving keeps the time
  page = await open({}, { 'yaoki.typing.v1': {
    mode: 'symbol', stage: { symbol: 'plain' }, len: 10, hints: 'stuck', goal: 3, practice: { d: '2026-10-27', s: 179 }, seal: { 'symbol:plain': ['2026-10-27'] },
    stampCard: { days: ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24'], done: 0, lastDay: '2026-10-24' },
  } }, [SFX_STUB, CLOCK]);
  check('the stamp card shows six days', (await page.textContent('#day-count')) === '6 / 7');
  await page.click('#start');
  await playOut(page, async (c) => {
    await sleep(150);
    await page.keyboard.type(c.key, { delay: 20 });
  });
  saved = await stored(page);
  check('the seventh day completes the card, and a new one starts', saved.stampCard.days.length === 0 && saved.stampCard.done === 1
    && (await page.textContent('#res-day-count')) === '7 / 7' && /Card complete/.test(await page.textContent('#res-day-line')), JSON.stringify(saved.stampCard));
  check('…and the screen reader hears it', await waitFor(() => page.evaluate(() => /Stamp card complete/.test(document.getElementById('sr-prompt').textContent)), 1500), await page.textContent('#sr-prompt'));
  check('one ring a day towards a stage\'s はなまる', saved.seal['symbol:plain'].length === 1 && /Today's ring/.test(await page.textContent('#res-seal-text')), JSON.stringify(saved.seal));
  await page.keyboard.press('Escape');
  check('the menu shows the new card and the finished one', (await page.textContent('#day-count')) === '0 / 7' && /完成 1枚/.test(await page.textContent('#day-done')));
  // the next morning, in the same tab: today's box is open again
  await page.evaluate(() => {
    window.__ykNow += 24 * 3600 * 1000;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  check('a menu left open overnight shows the new day when looked at again', /more typing for today/.test(await page.textContent('#day-hint')) && (await page.$('#day-boxes .day-box.open')) !== null);
  await page.close();
  page = await open({}, { 'yaoki.typing.v1': { mode: 'symbol', stage: { symbol: 'plain' }, len: 10, goal: 5, practice: { d: '2026-10-27', s: 200 } } }, [SFX_STUB, CLOCK]);
  check('the day card adds up: time typed and time left make the goal', /3:20 \/ 5:00/.test(await page.textContent('#day-line')) && /1:40/.test(await page.textContent('#day-hint')));
  await page.click('#open-settings');
  await page.click('#goal-seg button:nth-child(1)');
  await page.click('#close-settings');
  check('a goal already met today stamps the day at once', (await page.textContent('#day-count')) === '1 / 7');
  await page.click('#start');
  for (let i = 0; i < 3; i++) {
    const c = await target(page);
    await page.keyboard.type(c.key, { delay: 20 });
  }
  const leftAt = (await stored(page)).practice.s;
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  check('a page closed mid-round keeps its typing time', (await stored(page)).practice.s > leftAt);
  await quit(page);
  await page.close();

  // ---- every round ends: a card that has knocked Yaoki over twice waits; Tab skips it
  page = await open({ reducedMotion: 'reduce' });
  await pick(page, 3, 1);
  await page.click('#len-seg button:nth-child(1)');
  await page.click('#start');
  const before = (await stored(page)).stats || {};
  const halted = await waitFor(async () => ((await state(page)).target || {}).halted, 90000);
  check('after two falls a card stops and the world waits', halted, JSON.stringify(await state(page)));
  if (halted) {
    await sleep(800);
    check('the waiting card does not knock him over again', !(await state(page)).falling && (await state(page)).target.halted);
    if (shots) await page.screenshot({ path: `${shots}/halted.png` });
    const waitingKey = (await state(page)).target.key;
    await page.keyboard.press('1');
    await page.keyboard.press('Tab');
    check('a skipped card takes its note with it', (await page.textContent('#status')) === '');
    s = await state(page);
    check('Tab skips the waiting card', s.skipped === 1);
    check('the bar counts the skipped card', (await page.getAttribute('#progress', 'aria-label')) === 'Card ' + Math.min(s.cleared + 2, s.total) + ' of ' + s.total);
    // without motion: no ink, no hop
    let inked = 0;
    let rm = null;
    await playOut(page, async (c) => {
      await page.keyboard.type(c.key, { delay: 20 });
      for (let i = 0; i < 4; i++) {
        rm = await state(page);
        inked = Math.max(inked, rm.fx);
        await sleep(50);
      }
    });
    // the round asked for a hop (a comeback or a step of the run), and none was drawn
    check('with reduced motion, stamps land without ink and Yaoki does not hop', inked === 0 && rm && rm.yaoki.liftMax === 0 && (rm.comebacks > 0 || rm.bestRun >= 5),
      JSON.stringify({ inked, lift: rm && rm.yaoki.liftMax, comebacks: rm && rm.comebacks, bestRun: rm && rm.bestRun }));
    check('…and does no tricks: cleared cards simply settle', rm && Object.values(rm.tricks).every((n) => n === 0), JSON.stringify(rm && rm.tricks));
    check('the result says a card was skipped', /skipped/.test(await page.textContent('#res-falls-en')) && /skipped/.test(await page.textContent('#res-line')));
    const was = before.symbol && before.symbol[waitingKey] ? before.symbol[waitingKey].miss : 0;
    const now = ((await stored(page)).stats.symbol || {})[waitingKey];
    check('a skipped card\'s misses are kept: two falls and the miss before Tab', now && now.miss === was + 3, JSON.stringify({ waitingKey, was, now }));
  }
  await page.close();

  // ---- narrow windows: every card fits, and a round of the longest prompts ends
  for (const size of [{ width: 640, height: 900 }, { width: 480, height: 800 }]) {
    page = await open({ viewport: size });
    await pick(page, 2, 5);
    await page.click('#len-seg button:nth-child(1)');
    await page.click('#start');
    const done = await playOut(page, (c) => page.keyboard.type(c.spell, { delay: 10 }), 120000);
    check(`${size.width}px: a round of phrases can be played to the end`, done && (await state(page)).phase === 'result', JSON.stringify(await state(page)));
    await page.close();
  }

  // ---- a pick made while the typefaces load does not change the round being started
  page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.route(/fonts\.googleapis\.com/, (r) => r.fulfill({ contentType: 'text/css', body: "@font-face{font-family:'Klee One';font-weight:600;src:url(https://fonts.gstatic.com/never.woff2)}" }));
  await page.route(/fonts\.gstatic\.com/, () => {}); // never answered
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await pick(page, 2, 1);
  await page.click('#start');
  await page.click('#modes button:nth-child(3)');
  await sleep(2000);
  check('a mode picked during the font wait cancels that start', (await state(page)).phase === 'menu');
  await page.click('#start');
  await page.click('#stages .option:nth-child(2)');
  await page.click('#start');
  check('a second Start after a pick plays the new pick', await waitFor(async () => (await state(page)).phase === 'play', 4000));
  check('…with the stage picked last', (await state(page)).mode === 'symbol' && /シフト/.test(await page.evaluate(() => document.querySelector('#stages [aria-pressed="true"]').textContent)));
  await page.close();

  // ---- keyboard labels at narrow widths: the Shift characters stay at 640 px
  page = await open({ viewport: { width: 640, height: 900 } });
  check('640px: the keyboard still shows the Shift characters', await page.evaluate(() => getComputedStyle(document.querySelector('[data-code="Digit2"] .sub')).display !== 'none'));
  await page.close();

  page = await open({ viewport: { width: 480, height: 900 } });
  await pick(page, 4, 5);
  const overlap = await page.evaluate(() => {
    const el = document.querySelector('[data-code="Digit3"]');
    const a = el.querySelector('.main').getBoundingClientRect();
    const b = el.querySelector('.sub').getBoundingClientRect();
    return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  });
  check('480px kana input: the small kana does not sit on the main kana', overlap === 0, 'overlap ' + overlap);
  await page.close();
  page = await open({ viewport: { width: 375, height: 700 } });
  await page.click('#open-settings');
  await page.click('#hint-seg button:nth-child(1)');
  await page.click('#close-settings');
  await pick(page, 3, 2);
  await page.click('#start');
  const sh = await target(page);
  await sleep(150);
  const shiftCode = /^(Digit[1-5]|Key[QWERTASDFGZXCVB])$/.test(sh.code) ? 'ShiftRight' : 'ShiftLeft';
  check('375px: the lit Shift key keeps its label', await page.evaluate((code) => {
    const m = document.querySelector('[data-code="' + code + '"] .main');
    return m.closest('.key').classList.contains('next') && getComputedStyle(m).display !== 'none' && m.textContent === 'Shift';
  }, shiftCode));
  await page.close();

  // ---- the smallest phones: the HUD, with two-digit counts, still fits at 320 px
  page = await open({ viewport: { width: 320, height: 568 } });
  await pick(page, 3, 1);
  await page.click('#start');
  await target(page);
  await page.evaluate(() => {
    document.getElementById('hud-run').textContent = '40';
    document.getElementById('hud-falls').textContent = '12';
    document.getElementById('hud-time').textContent = '12:34';
  });
  check('320px: the HUD fits, and the page does not scroll sideways', await page.evaluate(() => {
    const h = document.querySelector('.hud');
    return h.scrollWidth <= h.clientWidth && document.documentElement.scrollWidth <= 320;
  }));
  await page.close();

  // ---- small screens and touch: no sideways scroll, the keyboard note, the result
  page = await open({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true });
  check('375px phone: no sideways scrolling', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  check('touch-only devices are told a keyboard is needed', await page.isVisible('#touch-note'));
  if (shots) {
    await sleep(400);
    await page.screenshot({ path: `${shots}/phone.png`, fullPage: true });
  }
  await pick(page, 3, 1);
  await page.click('#len-seg button:nth-child(1)');
  await page.click('#start');
  await target(page);
  check('375px phone: the HUD fits', await page.evaluate(() => { const h = document.querySelector('.hud'); return h.scrollWidth <= h.clientWidth; }));
  // a fall: よいしょ！ in a bubble that stays in the scene, above the cards
  await waitFor(async () => ((await state(page)).yaoki || {}).bubble === 'よいしょ！', 25000);
  s = await state(page);
  const box = s.yaoki && s.yaoki.box;
  const cardTop = 168 - 74;
  const hit = box && s.cards.some((c) => c.state === 'live' && box.x < c.x + c.w && c.x < box.x + box.w && box.y + box.h > cardTop);
  check('375px phone: Yaoki\'s bubble stays in the scene, clear of the cards', box && !hit && box.x >= 0 && box.x + box.w <= s.W && box.y >= 0, JSON.stringify({ box, W: s.W, cards: s.cards }));
  if (shots) await page.screenshot({ path: `${shots}/phone-fall.png` });
  await playOut(page, (c) => page.keyboard.type(c.key, { delay: 10 }));
  let widest = 0;
  for (let i = 0; i < 15; i++) {
    widest = Math.max(widest, await page.evaluate(() => document.documentElement.scrollWidth));
    await sleep(50);
  }
  check('375px phone: the result does not scroll sideways while its stamp lands', widest <= 375, 'scrollWidth ' + widest);
  await page.close();

  check('no page errors in any run', errors.length === 0, errors.join('\n'));
  await browser.close();
  if (failures) {
    console.log(`\n${failures} failed`);
    process.exit(1);
  }
  console.log('\nall typing game checks passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
