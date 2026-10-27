// Runs every artboard in the real canvas runtime (served locally) and reports
// runtime errors, console errors, clipping; saves a screenshot per artboard and row sheets.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PORT = process.env.PORT || '8765';
const BASE = `http://localhost:${PORT}/`;
const site = path.join(__dirname, 'site');
const out = path.join(__dirname, 'out');
const only = process.argv.slice(2);
const APP = !!process.env.YK_APP;
const HOST = APP ? '#yk-stage > .sc-host' : '#dc-root .sc-host';

async function openBoard(browser, name, fontsCss, prep, opts = {}) {
  /* opts.touch: a page that takes touch input (the writing practice's checks draw strokes with a finger) */
  let page;
  if (opts.touch) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
    page = await ctx.newPage();
    page.on('close', () => ctx.close().catch(() => {}));
  } else page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const logs = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text().slice(0, 300)); });
  page.on('pageerror', (e) => logs.push('pageerror: ' + String(e).slice(0, 300)));
  await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ contentType: 'text/css', body: fontsCss }));
  // the canvas editor can run the runtime in a second mode; OMELETTE=1 exercises that path too
  if (process.env.OMELETTE) await page.addInitScript(() => { window.__dcRuntimeMode = 'omelette'; });
  // NOSOUND=1: the sound scripts come back empty, as if the canvas had not run them
  if (process.env.NOSOUND) await page.route('**/sound*.js', (r) => r.fulfill({ contentType: 'text/javascript', body: '' }));
  // BADCLIPS=1: the clips arrive but cannot be decoded, as in a browser that does not read this MP3 flavour
  if (process.env.BADCLIPS) {
    await page.route('**/sound-*.js', async (r) => {
      const res = await r.fetch();
      const body = (await res.text()).replace(/b: '[^']+'/g, "b: '" + 'A'.repeat(4000) + "'");
      await r.fulfill({ response: res, body });
    });
    // clips kept as files (the N1 lessons) arrive but cannot be decoded either
    await page.route('**/audio/*.mp3', (r) => r.fulfill({ contentType: 'audio/mpeg', body: Buffer.from('A'.repeat(4000)) }));
  }
  // HELDBACK=1: the browser has audio but never lets it start (the context stays suspended)
  if (process.env.HELDBACK) {
    await page.addInitScript(() => {
      class Held {
        constructor() { this.state = 'suspended'; this.destination = {}; }
        resume() { return Promise.resolve(); }
        decodeAudioData(buf, ok) { const b = { duration: 1 }; if (ok) ok(b); return Promise.resolve(b); }
        createBufferSource() { return { connect() {}, start() {}, stop() {}, buffer: null, onended: null }; }
      }
      window.AudioContext = Held;
      window.webkitAudioContext = Held;
    });
  }
  // every clip that starts or is stopped is written down, with its length, so tests can check what was played and when
  await page.addInitScript(() => {
    window.__audio = [];
    const P = window.AudioBufferSourceNode && window.AudioBufferSourceNode.prototype;
    if (!P) return;
    const start = P.start;
    const stop = P.stop;
    // d: the clip's length, o: how far into it playback starts (both in milliseconds)
    const note = (ev, node, into) => window.__audio.push({ ev, t: Math.round(performance.now()), d: node.buffer ? Math.round(node.buffer.duration * 1000) : 0, o: Math.round((into || 0) * 1000) });
    P.start = function (...a) { note('start', this, a[1]); return start.apply(this, a); };
    P.stop = function (...a) { note('stop', this); return stop.apply(this, a); };
  });
  // YK_APP=1: the same flows against the installable app build (yaoki-app/dist-test) instead of the canvas runtime.
  // The prototype frame becomes the app's page, with the start state passed in the address as for TShell.
  if (APP) {
    const [file, q] = name.split('?');
    if (!/^(App|TShell)\.dc\.html$/.test(file)) throw new Error('app mode has no board named ' + file);
    name = 'index.html?yktest' + (q ? '&' + q : '');
  }
  // a test may set up more on the page before it loads
  if (prep) await prep(page);
  await page.goto(BASE + name);
  await page.waitForSelector(HOST, { timeout: 10000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  return { page, logs };
}

/* what is wrong with the screen as it stands. issues: runtime errors aside, what leaves the frame (OUT) and taps too
   small to hit (SMALL); these fail a check. pad: a warning class of its own, so it never hides a failure: on a screen
   with a fixed footer the bottom 34 px of the frame (below 810) are kept clear for the phone's home indicator, and
   anything a learner can see there (text, a control, an icon) has run into that padding. The tab bar is the one thing
   designed to reach into it */
async function inspect(page) {
  return page.evaluate((HOST) => {
    const host = document.querySelector(HOST);
    const rootEl = host && host.firstElementChild;
    const res = { errors: [...document.querySelectorAll('.sc-logic-error,.sc-placeholder-error')].map((e) => e.textContent.slice(0, 200)), issues: [], pad: [] };
    if (!rootEl) { res.issues.push('NO ROOT'); return res; }
    res.rootH = rootEl.scrollHeight + '/' + rootEl.clientHeight;
    const top = rootEl.getBoundingClientRect().top;
    for (const el of rootEl.querySelectorAll('*')) {
      const tag = el.tagName.toLowerCase();
      if (el.closest('svg') && tag !== 'svg') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const txt = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 26);
      // an element inside a scrolling list may sit below the fold; only its sideways position counts
      let scrolls = false;
      // a row that scrolls sideways in a box of its own (the stroke-order strip) may run past the frame inside it
      let scrollsX = false;
      // how far down it can be seen: a scrolling list or a box that hides what overflows it cuts it off at its own edge
      let seen = r.bottom;
      let gone = false;
      for (let p = el.parentElement; p && p !== rootEl; p = p.parentElement) {
        const cs = getComputedStyle(p);
        if (cs.overflowY === 'auto' || cs.overflowY === 'scroll') scrolls = true;
        if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') scrollsX = true;
        if (cs.overflowY !== 'visible') { const b = p.getBoundingClientRect(); seen = Math.min(seen, b.bottom); if (r.top >= b.bottom - 0.5) gone = true; }
      }
      if (tag !== 'svg') {
        if ((!scrollsX && (r.right > 390.5 || r.left < -0.5)) || (!scrolls && r.bottom > 844.5)) res.issues.push(`OUT ${tag} "${txt}" l=${Math.round(r.left)} r=${Math.round(r.right)} b=${Math.round(r.bottom)}`);
        if ((tag === 'button' || tag === 'a') && (r.height < 43.5 || r.width < 43.5)) res.issues.push(`SMALL ${tag} "${txt}" ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
      // what a learner sees: text of its own, a control, an icon or a picture
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim());
      if (!own && !/^(button|a|input|svg|img)$/.test(tag)) continue;
      const bottom = seen - top;
      if (!gone && bottom > 810.5 && bottom <= 844.5 && !el.closest('nav') && getComputedStyle(el).visibility !== 'hidden') res.pad.push(`PAD ${tag} "${txt}" b=${Math.round(bottom)}`);
    }
    res.unresolved = document.querySelectorAll('.sc-interp.sc-missing,.sc-interp.sc-unresolved').length;
    return res;
  }, HOST);
}

module.exports = { openBoard, inspect, BASE, site, out, APP };

if (require.main === module) {
  (async () => {
    const fontsCss = fs.readFileSync(path.join(site, 'fonts.css'), 'utf8');
    const names = fs.readdirSync(site).filter((f) => f.endsWith('.dc.html')).filter((f) => !only.length || only.includes(f.replace('.dc.html', '')));
    const browser = await chromium.launch();
    for (const name of names) {
      const { page, logs } = await openBoard(browser, name, fontsCss);
      const info = await inspect(page);
      await page.screenshot({ path: path.join(out, 'rt-' + name.replace('.dc.html', '.png')) });
      console.log(`== ${name} root=${info.rootH} unresolved=${info.unresolved}`);
      for (const e of info.errors) console.log('   RUNTIME-ERROR ' + e);
      for (const s of info.issues) console.log('   ' + s);
      for (const s of info.pad) console.log('   ' + s);
      for (const l of logs) console.log('   ' + l);
      await page.close();
    }
    await browser.close();
  })().catch((e) => { console.error(e); process.exit(1); });
}
