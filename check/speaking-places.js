// Screenshots of Yaoki Speaking's places in the game itself, on a phone held upright: each place in both ways to play,
// light and dark, the forest in each season, and the top of each climb. For looking at the drawings, not a test.
// Run: SHOTS=<dir> node check/speaking-places.js        (PLACE=jinja for one place; TABLET=1 adds an iPad)
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { chromium, devices } = require('playwright');

const url = 'file://' + path.resolve(__dirname, '..', 'docs', 'speaking', 'index.html');
const shots = process.env.SHOTS;
if (!shots) {
  console.log('Set SHOTS=<dir> for the screenshots.');
  process.exit(1);
}
fs.mkdirSync(shots, { recursive: true });

// a stand-in for the phone's speech recognition: say(text) hands the listening recognition a closed result
const FAKE_SPEECH = `(function () {
  var S = window.__speech = { active: null };
  function Rec() { this.results = []; this.running = false; }
  Rec.prototype.start = function () { var self = this; this.running = true; S.active = this; setTimeout(function () { if (self.running) { self.onstart && self.onstart(); } }, 5); };
  Rec.prototype.stop = Rec.prototype.abort = function () { var self = this; if (!this.running) return; this.running = false; if (S.active === this) S.active = null; setTimeout(function () { self.onend && self.onend(); }, 5); };
  S.say = function (text) {
    var rec = S.active;
    if (!rec || !rec.running) return false;
    rec.results.push(text);
    rec.onresult && rec.onresult({ results: rec.results.map(function (t) { var r = [{ transcript: t, confidence: 0.9 }]; r.isFinal = true; return r; }), resultIndex: rec.results.length - 1 });
    return true;
  };
  window.SpeechRecognition = window.webkitSpeechRecognition = Rec;
})();`;
const SEASONS = { spring: [2026, 3, 20], summer: [2026, 6, 20], autumn: [2026, 9, 28], winter: [2026, 0, 20] };
// a stage played in each place (world.js, OWN)
const STAGE = { yama: 'words', danchi: 'katakana', jinja: 'basic', mori: 'voiced' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return true;
    await sleep(60);
  }
  return false;
}

(async () => {
  const browser = await chromium.launch();
  const phones = [['phone', Object.assign({}, devices['iPhone 13'], { hasTouch: true })]];
  if (process.env.TABLET) phones.push(['tablet', Object.assign({}, devices['iPad Mini'], { hasTouch: true })]);
  const errors = [];
  const places = Object.keys(STAGE).filter((p) => !process.env.PLACE || process.env.PLACE.split(',').includes(p));
  for (const [deviceName, device] of phones) {
    for (const place of places) {
      const seasons = place === 'mori' ? Object.keys(SEASONS) : ['autumn'];
      for (const season of seasons) {
        for (const style of ['fall', 'climb']) {
          for (const dark of [false, true]) {
            const ctx = await browser.newContext(Object.assign({}, device, dark ? { colorScheme: 'dark' } : {}));
            const page = await ctx.newPage();
            page.on('pageerror', (e) => errors.push(place + ' ' + style + ': ' + e.message));
            await page.addInitScript(FAKE_SPEECH);
            const [y, m, d] = SEASONS[season];
            await page.addInitScript((t) => { window.__ykNow = t; }, new Date(y, m, d, 10).getTime());
            await page.addInitScript((save) => {
              if (!sessionStorage.getItem('seeded')) {
                localStorage.setItem('yaoki.speaking.v1', JSON.stringify(save));
                sessionStorage.setItem('seeded', '1');
              }
            }, { mode: 'kana', stage: { kana: STAGE[place] }, style, len: 5, music: 'off', sfx: 'off' });
            await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
            await page.goto(url);
            await page.tap('#start');
            const state = () => page.evaluate(() => window.ykSpeaking.state());
            const name = [deviceName, place, style, dark ? 'dark' : 'light'].concat(place === 'mori' ? [season] : []).join('-');
            if (style === 'fall') {
              // two things in view, then one said and breaking
              await waitFor(async () => (await state()).cards.filter((c) => c.state === 'live' && c.y > 40).length >= 2, 12000);
              await page.screenshot({ path: path.join(shots, name + '.png') });
              const t = (await state()).target;
              if (t) await page.evaluate((w) => window.__speech.say(w), t.reading);
              await sleep(250);
              await page.screenshot({ path: path.join(shots, name + '-said.png') });
            } else {
              await waitFor(async () => !!(await state()).target, 8000);
              const t = (await state()).target;
              await page.evaluate((w) => window.__speech.say(w), t.reading);
              await waitFor(async () => !(await state()).jumping, 3000);
              await sleep(900);
              await page.screenshot({ path: path.join(shots, name + '.png') });
              if (season === 'autumn' || place !== 'mori') {
                // on to the top: the shot as he lands there, before the round's result
                for (let i = 0; i < 8 && !(await state()).atTop; i++) {
                  await waitFor(async () => !!(await state()).target || (await state()).atTop, 4000);
                  const next = (await state()).target;
                  if (next) await page.evaluate((w) => window.__speech.say(w), next.reading);
                  await waitFor(async () => (await state()).atTop || !(await state()).jumping, 2000);
                }
                await waitFor(async () => (await state()).atTop, 3000);
                await sleep(350);
                await page.screenshot({ path: path.join(shots, [deviceName, place, 'summit', dark ? 'dark' : 'light'].join('-') + '.png') });
              }
            }
            await ctx.close();
          }
        }
      }
    }
  }
  await browser.close();
  console.log(errors.length ? 'errors:\n' + errors.join('\n') : 'no script errors');
  console.log('screenshots in ' + shots);
})();
