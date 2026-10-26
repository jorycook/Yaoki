// Plays Kana Runner (docs/typing/) in a browser with real key presses.
// Run: node check/typing-test.js            (set SHOTS=<dir> to keep screenshots)
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

async function waitFor(fn, ms = 4000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, 40));
  }
  return false;
}

// Clears `count` boxes: waits for each prompt, types it with `typeFor`, and waits for the clear.
async function clearBoxes(page, count, typeFor, limitMs = 60000) {
  const state = () => page.evaluate(() => window.kanaRunnerState());
  const start = (await state()).cleared;
  const end = Date.now() + limitMs;
  while (Date.now() < end && (await state()).cleared < start + count) {
    const s = await state();
    if (!s.target) {
      await new Promise((r) => setTimeout(r, 60));
      continue;
    }
    await typeFor(s.target);
    await waitFor(async () => (await state()).cleared > s.cleared, 3000);
  }
  return (await state()).cleared - start;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('console: ' + m.text());
  });
  await page.goto(url);
  const state = () => page.evaluate(() => window.kanaRunnerState());
  const statusText = () => page.textContent('#status');

  check('page loads with no script errors', errors.length === 0, errors.join('\n'));

  // ---- romaji: clear words by typing their hints
  await page.click('#start');
  await waitFor(async () => (await state()).phase === 'play');
  check('start puts the game in play', (await state()).phase === 'play');

  const cleared = await clearBoxes(page, 10, (t) => page.keyboard.type(t.hint, { delay: 30 }));
  check('typing each hint clears boxes', cleared >= 10, 'cleared ' + cleared);
  check('score goes up with cleared boxes', (await state()).score > 0);

  // A key that starts no spelling of the prompt is a miss.
  await waitFor(async () => !!(await state()).target, 8000);
  const beforeMiss = await state();
  await page.keyboard.press('q');
  await waitFor(async () => /Expected/.test(await statusText()));
  check('wrong key shows what was expected', /Expected/.test(await statusText()), await statusText());
  check('wrong key does not clear the box', (await state()).target?.typed === beforeMiss.target?.typed);

  // Esc pauses; Enter resumes
  await page.keyboard.press('Escape');
  check('Esc pauses the run', (await state()).phase === 'paused');
  await page.keyboard.press('Enter');
  check('Enter resumes the run', (await state()).phase === 'play');

  // Backspace removes the last typed letter of the prompt
  const s2 = await state();
  if (s2.target && s2.target.hint.length > 1) {
    await page.keyboard.press(s2.target.hint[0]);
    await page.keyboard.press('Backspace');
    const after = await state();
    check('Backspace erases a typed letter', after.target && after.target.typed === '', JSON.stringify(after.target));
  }

  // An IME keystroke (key "Process") gets the warning
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Process', keyCode: 229 })));
  check('IME keystroke shows the input warning', /英数/.test(await statusText()), await statusText());

  if (shots) await page.screenshot({ path: `${shots}/romaji-play.png` });

  // ---- symbols: type the symbol shown; Playwright sends the character itself
  await page.keyboard.press('Escape'); // pause
  await page.click('#quit');
  await waitFor(async () => (await state()).phase === 'menu');
  await page.click('.tab:nth-child(2)');
  await page.click('#start');
  await waitFor(async () => (await state()).phase === 'play');
  const symCleared = await clearBoxes(page, 5, (t) => page.keyboard.type(t.text, { delay: 30 }));
  check('symbol keys clear boxes when typed with their characters', symCleared >= 4, 'cleared ' + symCleared);
  if (shots) await page.screenshot({ path: `${shots}/symbol-play.png` });

  // ---- kana positions: press the physical key (home row stage)
  await page.keyboard.press('Escape'); // pause
  await page.click('#quit');
  await waitFor(async () => (await state()).phase === 'menu');
  await page.click('.tab:nth-child(3)');
  await page.click('.stage:nth-child(2)');
  await page.click('#start');
  await waitFor(async () => (await state()).phase === 'play');
  const kanaCleared = await clearBoxes(page, 5, (t) => page.keyboard.press(t.code));
  check('kana keys clear boxes when the key position is pressed', kanaCleared >= 4, 'cleared ' + kanaCleared);
  if (shots) await page.screenshot({ path: `${shots}/kana-play.png` });

  // ---- ん at the end of a prompt: "nn" clears it at once, a single "n" after a short wait
  for (const keys of ['nn', 'n']) {
    const p2 = await browser.newPage();
    await p2.addInitScript(() => {
      // The first box is the last kana of the basic stage, ん; later boxes use the real random.
      let calls = 0;
      const real = Math.random;
      Math.random = () => (calls++ === 0 ? 0.99 : real());
    });
    await p2.goto(url);
    await p2.click('#start');
    const got = await waitFor(async () => (await p2.evaluate(() => window.kanaRunnerState())).target?.text === 'ん', 6000);
    if (!got) {
      check('the first box is ん for the ん check', false);
    } else {
      await p2.keyboard.type(keys, { delay: 30 });
      const cleared = await waitFor(async () => (await p2.evaluate(() => window.kanaRunnerState())).cleared === 1, 3000);
      const next = await p2.evaluate(() => window.kanaRunnerState());
      const status = await p2.textContent('#status');
      check(`ん typed as "${keys}" clears the box`, cleared, JSON.stringify(next));
      check(`ん typed as "${keys}" leaves no stray miss for the next box`, !/Expected/.test(status), status);
    }
    await p2.close();
  }

  // ---- losing: stop typing and let three boxes reach the runner
  const over = await waitFor(async () => (await state()).phase === 'over', 60000);
  check('run ends after three hearts are lost', over, JSON.stringify(await state()));
  if (over) {
    check('results panel is shown', await page.isVisible('#over'));
    if (shots) await page.screenshot({ path: `${shots}/over.png` });
  }

  check('no page errors during the run', errors.length === 0, errors.join('\n'));

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
