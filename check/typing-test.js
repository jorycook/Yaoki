// Plays Yaoki Typing (docs/typing/) in a browser with real key presses.
// Run: node check/typing-test.js            (SHOTS=<dir> keeps screenshots)
'use strict';

const path = require('node:path');
const { chromium } = require('playwright');

const url = 'file://' + path.resolve(__dirname, '..', 'docs', 'typing', 'index.html');
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

  async function open(opts = {}) {
    const page = await browser.newPage(Object.assign({ viewport: { width: 1366, height: 768 } }, opts));
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/fonts\.g|net::/.test(m.text())) errors.push('console: ' + m.text());
    });
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

  // ---- the menu
  let page = await open();
  check('page loads with no script errors', errors.length === 0, errors.join('\n'));
  check('brand is タイピング · Yaoki Typing', /タイピング\s*Yaoki Typing/.test(await page.textContent('.brand')));
  check('four modes in the app\'s words', (await page.$$eval('#modes button', (b) => b.map((x) => x.textContent))).join('|').includes('かな入力'));
  check('links back to the app with a trailing slash', (await page.$$('a[href="../"]')).length >= 1);
  if (shots) await page.screenshot({ path: `${shots}/menu.png`, fullPage: true });

  // ---- romaji: type cards by their hints; a miss; Backspace; IME
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

  let t = await target(page);
  await page.keyboard.press('q');
  let s = await state(page);
  check('a wrong key does not clear the card', s.target && s.target.typed === '' && s.cleared >= 6);
  check('a first miss shows the kana being typed (hint level 1)', s.target && s.target.level === 1, JSON.stringify(s.target));
  check('the miss flashes on the keyboard', await page.$('#kb .key.miss') !== null);
  await page.keyboard.press('q');
  check('a second miss shows the whole spelling (hint level 2)', (await state(page)).target.level === 2);
  if (shots) await page.screenshot({ path: `${shots}/romaji-miss.png` });

  if (t.spell.length > 1) {
    await page.keyboard.press(t.spell[0]);
    await page.keyboard.press('Backspace');
    check('Backspace takes back a typed letter', (await state(page)).target.typed === '');
  }
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Process', keyCode: 229 })));
  check('an IME key shows the 英数 warning', /英数/.test(await page.textContent('#status')));

  // ---- a fall: stop typing and let the card reach Yaoki
  const before = (await state(page)).falls;
  check('the card reaches Yaoki and knocks him over', await waitFor(async () => (await state(page)).falling, 20000));
  if (shots) {
    await sleep(400);
    await page.screenshot({ path: `${shots}/fall.png` });
  }
  check('the fall is counted', (await state(page)).falls === before + 1);
  check('he gets up and the round goes on', await waitFor(async () => !(await state(page)).falling, 5000));

  // ---- Esc pauses; the sheet's Quit goes back to the menu
  await target(page);
  await page.keyboard.press('Escape');
  check('Esc pauses', (await state(page)).phase === 'paused' && await page.isVisible('#pause-sheet'));
  await page.keyboard.press('Escape');
  check('Esc again carries on', (await state(page)).phase === 'play');
  await page.click('#pause');
  await page.click('#quit');
  check('Quit goes back to the menu', (await state(page)).phase === 'menu');

  // ---- symbol keys: a whole 10-card round to the result
  await pick(page, 3, 1);
  await page.click('#len-seg button:nth-child(1)');
  await page.click('#start');
  for (let i = 0; i < 10; i++) {
    const c = await target(page);
    if (!c) break;
    await page.keyboard.type(c.key, { delay: 25 });
  }
  check('a finished round shows the result', await waitFor(() => page.isVisible('#result'), 8000));
  check('the result counts clean cards', (await page.textContent('#res-clean')) === '10' && /\/ 10/.test(await page.textContent('#res-clean-total')));
  check('ten clean cards earn the top stamp', /たいへん/.test(await page.textContent('#res-stamp-text')));
  check('focus moves to the result heading', await page.evaluate(() => document.activeElement.id === 'res-title'));
  if (shots) {
    await sleep(700);
    await page.screenshot({ path: `${shots}/result.png`, fullPage: true });
  }
  await page.keyboard.press('Enter');
  check('Enter plays again', (await state(page)).phase === 'play');
  await page.keyboard.press('Escape');
  await page.click('#quit');

  // ---- kana input: physical keys, and the Shift layer
  await pick(page, 4, 1);
  await page.click('#start');
  for (let i = 0; i < 3; i++) {
    const c = await target(page);
    await page.keyboard.press(c.code);
  }
  check('kana keys clear cards by key position', (await state(page)).cleared === 3);
  await page.keyboard.press('Escape');
  await page.click('#quit');
  await pick(page, 4, 5);
  await page.click('#start');
  let c = await target(page);
  await page.keyboard.press(c.code);
  check('a Shift-layer kana pressed without Shift is a miss', (await state(page)).cleared === 0);
  await page.keyboard.down('Shift');
  await page.keyboard.press(c.code);
  await page.keyboard.up('Shift');
  check('the same key with Shift clears it', (await state(page)).cleared === 1);
  await page.keyboard.press('Escape');
  await page.click('#quit');

  // ---- settings sheet: hints never; kept in storage
  await page.click('#open-settings');
  await page.click('#hint-seg button:nth-child(3)');
  await page.click('#close-settings');
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('yaoki.typing.v1')).hints);
  check('the hint setting is kept', kept === 'never', kept);
  await page.click('#open-settings');
  await page.click('#hint-seg button:nth-child(2)');
  await page.click('#close-settings');
  await page.close();

  // ---- course words from the app's own files
  page = await open({ colorScheme: 'dark' });
  await page.click('#modes button:nth-child(1)');
  check('the N5 weeks load from ../assets', await waitFor(async () => (await page.$$('#units .option')).length === 8, 10000));
  await page.click('#start');
  for (let i = 0; i < 3; i++) {
    const w = await target(page);
    await page.keyboard.type(w.spell, { delay: 25 });
  }
  const w = await target(page);
  check('course cards carry the reading', w && !!w.reading, JSON.stringify(w));
  check('the word, reading and meaning show under the game', (await page.textContent('#info')).length > 2);
  if (shots) await page.screenshot({ path: `${shots}/course-dark.png` });
  await page.close();

  // ---- every round ends: a card that has knocked Yaoki over twice waits for him
  page = await open({ reducedMotion: 'reduce' });
  await pick(page, 3, 1);
  await page.click('#len-seg button:nth-child(1)');
  await page.click('#start');
  const halted = await waitFor(async () => {
    const st = await state(page);
    return st.target && st.target.halted;
  }, 90000);
  check('after two falls a card stops and the world waits', halted, JSON.stringify(await state(page)));
  if (halted) {
    const h = (await state(page)).target;
    await sleep(800);
    check('the waiting card does not knock him over again', !(await state(page)).falling && (await state(page)).target.halted);
    await page.keyboard.type(h.key);
    check('typing it clears it', await waitFor(async () => !((await state(page)).target || {}).halted, 3000));
    if (shots) await page.screenshot({ path: `${shots}/after-halt.png` });
  }
  await page.close();

  // ---- small screens and touch: no sideways scroll, and the keyboard note
  page = await open({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true });
  check('375px phone: no sideways scrolling', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  check('touch-only devices are told a keyboard is needed', await page.isVisible('#touch-note'));
  if (shots) {
    await sleep(400);
    await page.screenshot({ path: `${shots}/phone.png`, fullPage: true });
  }
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
