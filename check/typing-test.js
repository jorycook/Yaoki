// Plays Yaoki Typing (docs/typing/) in a browser with real key presses.
// Run: node check/typing-test.js            (SHOTS=<dir> keeps screenshots; takes about 4 minutes)
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
    if (init) await page.addInitScript(init);
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
  }
  check('typing each card clears it', (await state(page)).cleared >= 6, JSON.stringify(await state(page)));
  check('the segmented bar follows the round', (await page.$$('#progress i.done')).length >= 6);

  // '1' starts no romaji spelling, so it is always a miss
  const t = await target(page);
  await page.keyboard.press('1');
  let s = await state(page);
  check('a wrong key does not clear the card', s.target && s.target.typed === '' && s.cleared >= 6);
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
  page = await open({ colorScheme: 'dark' }, { [appKey]: { started: true, level: 'N4', cur: 'n4u03d2' } }, () => {
    window.ykSound = { has: () => true, unlock: () => true, play: (clip) => { window.__played = clip; return true; } };
  });
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
  if (shots) await page.screenshot({ path: `${shots}/course-dark.png` });
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
    await playOut(page, (c) => page.keyboard.type(c.key, { delay: 20 }));
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
