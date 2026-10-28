// Plays Yaoki Speaking (docs/speaking/) in a phone-sized browser, with a stand-in for the speech recognition that the
// test speaks into. Run: node check/speaking-test.js        (SHOTS=<dir> keeps screenshots; takes about 4 minutes)
'use strict';

const path = require('node:path');
const { chromium, devices } = require('playwright');

const url = 'file://' + path.resolve(__dirname, '..', 'docs', 'speaking', 'index.html');
const appKey = 'yaoki.v1:' + path.resolve(__dirname, '..', 'docs') + '/';
const STORE = 'yaoki.speaking.v1';
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

// The browser's speech recognition, played by the test: __speech.say(text or [alternatives], { final, replace }) hands
// the listening recognition a result, as a phone's would (replace: the last result, still open, is written over);
// __speech.end() ends the listening as a browser does after a silence; __speech.refuse = 'not-allowed' refuses the next.
const FAKE_SPEECH = `(function () {
  var S = window.__speech = { recs: [], log: [], active: null, refuse: '' };
  function Rec() { this.lang = ''; this.continuous = false; this.interimResults = false; this.maxAlternatives = 1; this.results = []; this.running = false; S.recs.push(this); }
  Rec.prototype.start = function () {
    var self = this;
    if (this.running) throw new Error('InvalidStateError');
    if (S.refuse) { var code = S.refuse; setTimeout(function () { self.onerror && self.onerror({ error: code }); self.onend && self.onend(); }, 5); return; }
    this.running = true; S.active = this; S.log.push('start');
    setTimeout(function () { if (self.running) { self.onstart && self.onstart(); self.onaudiostart && self.onaudiostart(); } }, 5);
  };
  Rec.prototype.stop = function () { S.log.push('stop'); this._end(); };
  Rec.prototype.abort = function () { S.log.push('abort'); this._end(); };
  Rec.prototype._end = function () { var self = this; if (!this.running) return; this.running = false; if (S.active === this) S.active = null; setTimeout(function () { self.onend && self.onend(); }, 5); };
  function list(results) { return results.map(function (r) { var res = r.alts.map(function (t) { return { transcript: t, confidence: 0.9 }; }); res.isFinal = r.final; return res; }); }
  S.say = function (text, opts) {
    opts = opts || {};
    var rec = S.active;
    if (!rec || !rec.running) return false;
    var alts = [].concat(text);
    var last = rec.results[rec.results.length - 1];
    if (S.cumulative && last && last.final && !opts.replace) alts = alts.map(function (a) { return last.alts[0] + a; });
    if (opts.replace && last && !last.final) rec.results[rec.results.length - 1] = { alts: alts, final: opts.final !== false };
    else rec.results.push({ alts: alts, final: opts.final !== false });
    rec.onresult && rec.onresult({ results: list(rec.results), resultIndex: rec.results.length - 1 });
    return true;
  };
  S.end = function () { if (S.active) S.active._end(); };
  window.SpeechRecognition = Rec;
  window.webkitSpeechRecognition = Rec;
})();`;
// The phone's own voice, recorded instead of spoken.
const FAKE_VOICE = `(function () {
  window.__spoken = [];
  var synth = { speaking: false, getVoices: function () { return [{ lang: 'ja-JP', name: 'Kyoko', localService: true }]; }, cancel: function () {},
    speak: function (u) { window.__spoken.push({ text: u.text, lang: u.lang }); setTimeout(function () { u.onend && u.onend(); }, 400); },
    addEventListener: function () {} };
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, get: function () { return synth; } });
  window.SpeechSynthesisUtterance = function (text) { this.text = text; };
})();`;
// The sound effects and music, recorded instead of played; and a fixed day for the stamp card.
const SFX_STUB = 'window.__sfx = []; (function () { var stub = { unlock: function () {}, sleep: function () {}, audio: function () { return null; }, play: function (n, o) { window.__sfx.push([n, o || {}]); return true; } };'
  + ' Object.defineProperty(window, "TypingSfx", { configurable: true, get: function () { return stub; }, set: function () {} }); })();';
const MUSIC_STUB = 'window.__music = []; (function () { function rec(a) { window.__music.push(a); }'
  + ' var stub = { SONGS: [{ id: "yuki" }, { id: "yoru" }, { id: "matsuri" }, { id: "take" }], start: function (s) { rec("start:" + s); return true; }, stop: function () { rec("stop"); }, pause: function () { rec("pause"); }, resume: function () { rec("resume"); },'
  + ' setLevel: function (n) { rec("level:" + n); }, duck: function (x) { rec("duck"); }, cue: function (n) { rec("cue:" + n); }, volume: function () {}, state: function () { return {}; } };'
  + ' Object.defineProperty(window, "TypingMusic", { configurable: true, get: function () { return stub; }, set: function () {} }); })();';
const CLOCK = 'window.__ykNow = new Date(2026, 9, 28, 10, 0, 0).getTime();';

(async () => {
  const browser = await chromium.launch();
  const errors = [];

  // A phone, optionally with saved state put in place before the game reads it, and with speech.
  async function open(opts = {}, store = null, init = []) {
    const ctx = await browser.newContext(Object.assign({}, devices['iPhone 13'], { hasTouch: true }, opts));
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/fonts\.g|net::|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text());
    });
    if (opts.noSpeech !== true) await page.addInitScript(FAKE_SPEECH);
    if (store) {
      await page.addInitScript((pairs) => {
        if (!sessionStorage.getItem('seeded')) {
          for (const [k, v] of pairs) localStorage.setItem(k, JSON.stringify(v));
          sessionStorage.setItem('seeded', '1');
        }
      }, Object.entries(store));
    }
    for (const script of [].concat(init)) await page.addInitScript(script);
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.goto(url);
    await sleep(250);
    return page;
  }
  const state = (page) => page.evaluate(() => window.ykSpeaking.state());
  const target = async (page, ms = 15000) => {
    await waitFor(async () => !!(await state(page)).target, ms);
    return (await state(page)).target;
  };
  const say = (page, text, opts = {}) => page.evaluate(([t, o]) => window.__speech.say(t, o), [text, opts]);
  const speech = (page) => page.evaluate(() => ({ log: window.__speech.log.slice(), active: !!window.__speech.active, n: window.__speech.recs.length, lang: window.__speech.active && window.__speech.active.lang, interim: window.__speech.active && window.__speech.active.interimResults, continuous: window.__speech.active && window.__speech.active.continuous }));
  const stored = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), STORE);
  const sounds = (page) => page.evaluate(() => (window.__sfx || []).map((x) => x[0]));
  // Says every card as it comes until the round is over (or `ms` passes); `sayFor` picks what to say.
  async function playOut(page, sayFor = (t) => t.reading, ms = 60000) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const s = await state(page);
      if (s.phase !== 'play') return true;
      if (s.target && !s.falling) {
        if (s.target.halted) await page.tap('#skip');
        else await say(page, sayFor(s.target), { final: true });
        await sleep(s.style === 'climb' ? 700 : 150);
      } else await sleep(60);
    }
    return false;
  }

  // ---- the menu
  let page = await open({}, null, [SFX_STUB, MUSIC_STUB, CLOCK]);
  check('page loads with no script errors', errors.length === 0, errors.join('\n'));
  check('brand is スピーキング · Yaoki Speaking', /スピーキング\s*Yaoki Speaking/.test(await page.textContent('.brand')));
  check('two ways to play: ふってくる Falling and のぼる Climb', (await page.$$eval('#ways .way', (b) => b.map((x) => x.textContent))).join('|').includes('のぼる'));
  check('four things to practise', (await page.$$('#modes button')).length === 4);
  check('links back to the app, Yaoki Typing and the reader', (await page.$$('a[href="../"], a[href="../typing/"], a[href="../reader/"]')).length === 3);
  check('no browser note when speech recognition is there', !(await page.isVisible('#no-speech')));
  check('the start button stays in reach at the bottom of the screen', await page.evaluate(() => {
    const b = document.getElementById('start').getBoundingClientRect();
    return b.bottom <= window.innerHeight + 1 && b.bottom > window.innerHeight - 120;
  }));
  check('a sound on its own is said to be the hardest for a phone (basic kana)', await (async () => {
    await page.tap('#modes button:nth-child(2)');
    await page.tap('#stages .option:nth-child(1)');
    return page.isVisible('#stage-note');
  })());
  if (shots) await page.screenshot({ path: `${shots}/menu.png`, fullPage: true });

  // ---- the microphone check
  await page.tap('#mic-test');
  check('the microphone check listens in Japanese', await waitFor(async () => (await speech(page)).active) && (await speech(page)).lang === 'ja-JP');
  await say(page, '今日は', { final: false });
  await sleep(80);
  check('…and says what it heard, and that it heard こんにちは', /聞こえた.*今日は.*ばっちり/.test(await page.textContent('#mic-test-out')), await page.textContent('#mic-test-out'));
  await say(page, '今日は', { final: true, replace: true });
  check('…and stops a moment after', await waitFor(async () => !(await speech(page)).active, 3000));

  // ---- Falling: words said as they are heard
  await page.tap('#stages .option:nth-child(4)'); // 単語 Words
  await page.tap('#ways .way:nth-child(1)');
  await page.tap('#start');
  check('start opens the round and listens: Japanese, word by word, hands-free', await waitFor(async () => (await state(page)).phase === 'play' && (await speech(page)).active)
    && (await speech(page)).interim === true && (await speech(page)).continuous === true);
  check('the brand bar is out of the way during a round', !(await page.isVisible('.bar')));
  check('the microphone says it is listening', /きいています/.test(await page.textContent('#mic-state')) && (await page.$('#mic.on')) !== null);
  let t = await target(page);
  check('a thing falls with a card on it, in a place', !!t && !!(await state(page)).place && !(await state(page)).sceneFailed, JSON.stringify(await state(page)).slice(0, 300));
  const half = Array.from(t.reading).slice(0, Math.max(1, Math.floor(Array.from(t.reading).length / 2))).join('');
  await say(page, half, { final: false });
  await sleep(60);
  let s = await state(page);
  check('the part said so far is heard and shown', s.target && s.target.fill > 0 && s.target.fill < s.target.len && /聞こえた/.test(await page.textContent('#heard')), JSON.stringify(s.target));
  await say(page, t.reading, { final: false, replace: true });
  await sleep(60);
  s = await state(page);
  check('a card is cleared as soon as it has been said, before the phone closes the result', s.cleared === 1 && s.clean === 1, JSON.stringify({ cleared: s.cleared }));
  // the phone then closes the same words: that is not an answer to the next card
  await say(page, t.reading, { final: true, replace: true });
  t = await target(page);
  await sleep(60);
  s = await state(page);
  check('the words of a cleared card are not heard again for the next', s.target && s.target.misses === 0, JSON.stringify(s.target));
  // four more, clean: a clean run of five
  for (let i = 0; i < 4; i++) {
    t = await target(page);
    await say(page, t.reading, { final: true });
    await sleep(120);
  }
  s = await state(page);
  check('five clean cards in a row light the run chip, and Yaoki cheers', s.run === 5 && (await page.$('#hud-run-chip.step')) !== null && s.yaoki.bubble === 'いいね！', JSON.stringify({ run: s.run, bubble: s.yaoki.bubble }));
  check('each card said is stamped, and Yaoki gets past it with a trick', Object.keys(s.tricks).length > 0 && (await sounds(page)).includes('clear'), JSON.stringify(s.tricks));
  if (shots) await page.screenshot({ path: `${shots}/fall-run.png` });

  // a miss: another word heard; then a near miss, named
  t = await target(page);
  await say(page, 'ぜんぜんちがう', { final: true });
  await sleep(80);
  s = await state(page);
  check('another word heard does not clear the card, flashes it, and steps up the hint', s.target && s.target.misses === 1 && s.target.level === 1 && s.run === 5, JSON.stringify(s.target));
  check('…what was heard is shown, in red, and the romaji', /聞こえた.*ぜんぜんちがう/.test(await page.textContent('#heard')) && (await page.$('#heard.bad')) !== null && (await page.textContent('#say-line')).includes(t.romaji));
  await say(page, t.reading, { final: true });
  await sleep(100);
  s = await state(page);
  check('said after a miss, it is cleared but not clean, and the run ends quietly', s.cleared === 6 && s.clean === 5 && s.run === 0 && (await page.$('#hud-run-chip.step')) === null);
  if (shots) await page.screenshot({ path: `${shots}/fall-miss.png` });

  // a phrase the browser cut in two is heard whole
  check('a word the phone closes halfway (a pause in it) is no miss, and is matched whole', await (async () => {
    const tt = await target(page);
    const chars = Array.from(tt.reading);
    if (chars.length < 4) return true;
    const cut = Math.ceil(chars.length / 2);
    await say(page, chars.slice(0, cut).join(''), { final: true });
    await sleep(40);
    const mid = await state(page);
    await say(page, chars.slice(cut).join(''), { final: true });
    await sleep(80);
    return mid.cleared === 6 && mid.target.misses === 0 && (await state(page)).cleared === 7;
  })(), JSON.stringify((await state(page)).target));

  // a phone that repeats all it has heard in each new result: the used-up part is still used up
  await page.evaluate(() => { window.__speech.cumulative = true; });
  check('a phone that repeats everything it heard in each new result still has each card heard alone', await (async () => {
    const a = await target(page);
    await say(page, a.reading, { final: true });
    await sleep(120);
    const b = await target(page);
    await say(page, b.reading, { final: true });
    await sleep(120);
    const x = await state(page);
    return x.cleared === 9 && (!x.target || x.target.misses === 0);
  })(), JSON.stringify((await state(page)).target));
  await page.evaluate(() => { window.__speech.cumulative = false; });

  // the browser ends the listening after a silence: it begins again by itself
  const before = (await speech(page)).n;
  await page.evaluate(() => window.__speech.end());
  check('listening that the browser ends begins again by itself', await waitFor(async () => (await speech(page)).n > before && (await speech(page)).active, 3000));

  // pause: nothing heard; continue: listening again
  await page.tap('#pause');
  check('pausing stops listening', await waitFor(async () => !(await speech(page)).active, 2000) && (await page.isVisible('#pause-sheet')));
  await page.tap('#resume');
  check('continuing listens again', await waitFor(async () => (await speech(page)).active, 2000));
  await playOut(page);
  check('the round ends with the result', await waitFor(async () => (await state(page)).phase === 'result', 8000));
  check('the result counts the clean cards', (await page.textContent('#res-clean')).trim() === String((await state(page)).clean));
  check('nothing is heard on the result', !(await speech(page)).active);
  const saved1 = await stored(page);
  check('the misses are kept as weak spots, and the best', Object.keys((saved1.stats && saved1.stats.kana) || {}).length >= 1 && !!saved1.best['kana:words'], JSON.stringify(saved1.stats));
  check('the time spoken counts towards today\'s stamp', saved1.practice && saved1.practice.d === '2026-10-28' && saved1.practice.s > 0, JSON.stringify(saved1.practice));
  check('what the phone heard instead is listed', /ぜんぜんちがう/.test(await page.textContent('#res-heard')));
  if (shots) await page.screenshot({ path: `${shots}/fall-result.png`, fullPage: true });
  await page.context().close();

  // ---- Falling: a thing that lands on Yaoki, and comes back; twice, and it waits on his umbrella
  page = await open({}, { [STORE]: { mode: 'kana', stage: { kana: 'pairs' }, style: 'fall', len: 5, pace: { 'kana:pairs': { r: 0.5, p: 6 } } } }, [SFX_STUB, CLOCK]);
  await page.tap('#start');
  t = await target(page);
  const first = t.text;
  check('a thing that is not said lands on Yaoki', await waitFor(async () => (await state(page)).falling, 12000));
  s = await state(page);
  check('…he is squashed, and the card comes back after a few others (said)', s.falls === 1 && s.fallKind === 'crush' && s.back >= 0
    && await waitFor(async () => /Yaoki was squashed and got up again/.test(await page.textContent('#sr-prompt')), 1500));
  check('…he gets up again: よいしょ', await waitFor(async () => ['よいしょ！', '七転び八起き', 'まだまだ！', 'へっちゃら！', 'よいしょっと'].includes((await state(page)).yaoki.bubble), 2500), (await state(page)).yaoki.bubble);
  if (shots) await page.screenshot({ path: `${shots}/fall-squash.png` });
  let halted = null;
  await waitFor(async () => {
    const x = await state(page);
    if (x.target && x.target.halted) halted = x.target;
    return !!halted;
  }, 60000);
  check('a card that has squashed him twice waits on his umbrella, with its reading', !!halted && halted.level === 2, JSON.stringify(halted));
  check('…the skip button passes it over', !(await page.isDisabled('#skip')) && await (async () => {
    await page.tap('#skip');
    return waitFor(async () => (await state(page)).skipped === 1, 1500);
  })());
  if (shots) await page.screenshot({ path: `${shots}/fall-after-skip.png` });
  await playOut(page);
  await waitFor(async () => (await state(page)).phase === 'result', 8000);
  check('the result says how often he was squashed', /squashed/.test(await page.textContent('#res-falls-en')) && Number(await page.textContent('#res-falls')) >= 2);
  check('the card that squashed him is a weak spot', (await page.textContent('#res-weak')).includes(first) || Object.keys((await stored(page)).stats.kana || {}).length > 0);
  await page.context().close();

  // ---- hints: stuck, the reading and romaji; the word said for the player (and not heard as the player)
  page = await open({}, { [STORE]: { mode: 'kanji', stage: { kanji: 'jukugo' }, style: 'climb', len: 5 } }, [FAKE_VOICE, SFX_STUB]);
  await page.tap('#start');
  t = await target(page);
  check('Climb: a kanji card hides its reading', t && t.readingShown === false && (await state(page)).ledges === 5, JSON.stringify(t));
  check('…until the player is stuck: then the reading and its romaji show', await waitFor(async () => {
    const x = (await state(page)).target;
    return x && x.readingShown && x.level === 1;
  }, 9000) && (await page.textContent('#say-line')).includes(t.romaji));
  await page.tap('#hear');
  await sleep(50);
  const spoken = await page.evaluate(() => window.__spoken.slice());
  check('きく says the word in the phone\'s Japanese voice', spoken.length === 1 && spoken[0].text === t.reading && spoken[0].lang === 'ja-JP', JSON.stringify(spoken));
  await say(page, t.reading, { final: true });
  await sleep(100);
  check('…and the phone hearing that voice is not the player saying it', (await state(page)).cleared === 0);
  await sleep(1500);
  await say(page, t.reading, { final: true });
  check('said by the player, it is cleared (with a hint, so not clean); Yaoki jumps up', await waitFor(async () => (await state(page)).cleared === 1, 1500) && (await state(page)).clean === 0);
  check('…and lands on the ledge', await waitFor(async () => (await state(page)).yaoki.at === 0, 2000));
  // a word heard wrong: he slips back down, and gets up
  t = await target(page);
  await say(page, 'まったくちがうことば', { final: true });
  await sleep(80);
  s = await state(page);
  check('Climb: a word heard wrong and he slips back down', s.falling && s.fallKind === 'slip' && s.falls === 1 && s.target && s.target.readingShown);
  if (shots) await page.screenshot({ path: `${shots}/climb-slip.png` });
  await say(page, t.reading, { final: true });
  await sleep(100);
  check('…a right word while he gets up waits for him', (await state(page)).cleared === 1);
  check('…then he jumps, and it is stamped 起 (said after a slip)', await waitFor(async () => (await state(page)).cleared === 2, 2500) && (await state(page)).comebacks === 1);
  // two misses: the reading, and the skip button
  t = await target(page);
  await say(page, 'ちがう', { final: true });
  await sleep(1500);
  await say(page, 'ちがいます', { final: true });
  await sleep(300);
  s = await state(page);
  check('two words heard wrong: the card waits, its reading shown, and can be skipped', s.target && s.target.halted && s.target.level === 2 && !(await page.isDisabled('#skip')), JSON.stringify(s.target));
  await page.tap('#skip');
  check('…skipped, he climbs past it', await waitFor(async () => (await state(page)).skipped === 1 && (await state(page)).yaoki.at === 2, 2500));
  await playOut(page);
  check('the last ledge leads to the top, then the result', await waitFor(async () => (await state(page)).phase === 'result', 8000));
  check('the result says he climbed to the top', /to the top/.test(await page.textContent('#res-line')));
  if (shots) await page.screenshot({ path: `${shots}/climb-result.png`, fullPage: true });
  await page.context().close();

  // ---- hold to talk: listening only while the microphone is held down
  page = await open({}, { [STORE]: { mode: 'kana', stage: { kana: 'words' }, style: 'climb', len: 5, mic: 'hold' } }, [SFX_STUB]);
  await page.tap('#start');
  t = await target(page);
  check('hold to talk: nothing is heard until the microphone is held', !(await speech(page)).active && /押して話す/.test(await page.textContent('#mic-state')));
  const box = await page.locator('#mic').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.dispatchEvent('#mic', 'pointerdown', { pointerId: 1, pointerType: 'touch', isPrimary: true });
  check('…held, it listens', await waitFor(async () => (await speech(page)).active, 1500));
  await say(page, t.reading, { final: false });
  await page.dispatchEvent('#mic', 'pointerup', { pointerId: 1, pointerType: 'touch', isPrimary: true });
  check('…the words said while it was held count, and letting go stops it', await waitFor(async () => (await state(page)).cleared === 1, 1500) && await waitFor(async () => !(await speech(page)).active, 1500));
  await page.context().close();

  // ---- the microphone refused, and a browser without speech recognition
  page = await open({}, { [STORE]: { mode: 'kana', stage: { kana: 'words' }, style: 'fall', len: 5 } }, ['window.__speechRefuse = true;']);
  await page.evaluate(() => { window.__speech.refuse = 'not-allowed'; });
  await page.tap('#start');
  check('a microphone the player or the phone refuses is said so, with what to do', await waitFor(async () => /マイクが使えません/.test(await page.textContent('#mic-state')), 3000) && /Dictation/.test(await page.textContent('#mic-state')));
  await page.evaluate(() => { window.__speech.refuse = ''; });
  await page.tap('#mic');
  check('…a tap on the microphone tries again', await waitFor(async () => (await speech(page)).active, 2000));
  await page.context().close();
  page = await open({ noSpeech: true }, null, ['try { delete window.webkitSpeechRecognition; delete window.SpeechRecognition; } catch (e) {} Object.defineProperty(window, "webkitSpeechRecognition", { value: undefined, configurable: true }); Object.defineProperty(window, "SpeechRecognition", { value: undefined, configurable: true });']);
  check('without speech recognition the menu says which browsers have it, and does not start', (await page.isVisible('#no-speech')) && /Safari/.test(await page.textContent('#no-speech')) && (await page.isDisabled('#start')));
  await page.context().close();

  // ---- course words: the learner's week, the reading above the word, the word's own voice after it is said
  page = await open({ colorScheme: 'dark' }, { [appKey]: { started: true, level: 'N5', cur: 'n5u02d1' } }, [() => {
    window.ykSound = { has: () => true, unlock: () => true, ms: () => 900, play: (clip) => { window.__played = clip; return true; } };
  }, SFX_STUB]);
  check('the menu opens at the learner\'s course words', (await page.textContent('#modes [aria-pressed="true"]')).includes('語彙'));
  check('…at the learner\'s week, marked 今', await waitFor(async () => /今/.test(await page.textContent('#units [aria-pressed="true"]')), 5000));
  await page.tap('#start');
  t = await target(page);
  check('a course word shows its reading, and is taken said as its kanji', !!t && t.readingShown && await (async () => {
    await say(page, t.text, { final: true });
    return waitFor(async () => (await state(page)).cleared === 1, 1500);
  })(), JSON.stringify(t));
  check('…and its own voice is said back', !!(await page.evaluate(() => window.__played)));
  t = await target(page);
  await say(page, t.reading, { final: true });
  await sleep(80);
  check('…while that voice plays, what the phone hears is not the player', (await state(page)).cleared === 1);
  if (shots) await page.screenshot({ path: `${shots}/course-dark.png` });
  await page.context().close();

  // ---- turned on its side, the round waits; reduced motion
  page = await open({}, { [STORE]: { mode: 'kana', stage: { kana: 'words' }, style: 'fall', len: 5 } });
  await page.tap('#start');
  await target(page);
  await page.setViewportSize({ width: 844, height: 390 });
  check('turned on its side, the round pauses and asks for the phone upright', await waitFor(async () => (await page.isVisible('#upright')) && (await state(page)).phase === 'paused', 2000));
  await page.setViewportSize({ width: 390, height: 664 });
  check('…upright again, the note goes and the pause waits for a tap', await waitFor(async () => !(await page.isVisible('#upright')), 2000) && (await state(page)).phase === 'paused');
  await page.context().close();
  page = await open({ reducedMotion: 'reduce' }, { [STORE]: { mode: 'kana', stage: { kana: 'words' }, style: 'climb', len: 5 } });
  await page.tap('#start');
  check('with reduced motion a round still plays through', await playOut(page, undefined, 30000) && (await state(page)).phase === 'result');
  await page.context().close();

  // ---- a tablet held upright
  page = await open({ ...devices['iPad Mini'], hasTouch: true }, { [STORE]: { mode: 'phrase', stage: { phrase: 'twister' }, style: 'fall', len: 5 } });
  await page.tap('#start');
  t = await target(page);
  s = await state(page);
  check('on a tablet the world is wider, and a long card fits it', s.W > 240 && s.target && (await state(page)).cards.every((c) => c.w <= s.W), JSON.stringify({ W: s.W, cards: s.cards }));
  if (shots) await page.screenshot({ path: `${shots}/tablet.png` });
  await page.context().close();

  check('no script errors anywhere', errors.length === 0, errors.join('\n'));
  await browser.close();
  console.log(failures ? failures + ' failed' : 'all passed');
  process.exit(failures ? 1 : 0);
})();
