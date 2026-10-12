// Loads the sound player and both data scripts in a real browser, decodes every clip and plays one.
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const logs = [];
  page.on('console', (m) => logs.push(m.type() + ': ' + m.text()));
  page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
  await page.setContent('<!doctype html><button id="go">go</button>');
  for (const f of ['sound.js', 'sound-mock.js', 'sound-lessons.js']) await page.addScriptTag({ url: 'http://localhost:8765/' + f });
  await page.click('#go');
  const out = await page.evaluate(async () => {
    const s = window.ykSound, c = window.__ykClips, keys = Object.keys(c);
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    const rows = [];
    for (const k of keys) {
      const bin = atob(c[k].b); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      try { const buf = await ctx.decodeAudioData(u.buffer); rows.push([k, c[k].ms, Math.round(buf.duration * 1000), buf.sampleRate, buf.numberOfChannels]); }
      catch (e) { rows.push([k, c[k].ms, 'DECODE FAILED ' + e.message]); }
    }
    let started = 0;
    const orig = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function () { started += 1; return orig.apply(this, arguments); };
    const unlocked = s.unlock();
    const played = s.play('m_check');
    await new Promise((r) => setTimeout(r, 600));
    const missing = s.play('nope');
    return { has: s.has('m_check'), ms: s.ms('m_check'), unlocked, played, started, missing, rows };
  });
  console.log(JSON.stringify({ has: out.has, ms: out.ms, unlocked: out.unlocked, played: out.played, started: out.started, missing: out.missing }));
  let bad = 0;
  for (const r of out.rows) { const ok = typeof r[2] === 'number' && Math.abs(r[2] - r[1]) < 120; if (!ok) bad += 1; console.log((ok ? 'ok ' : 'BAD') + ' ' + r.join(' ')); }
  console.log(bad === 0 && out.started === 1 && out.played && !out.missing ? 'SOUND TEST PASS' : 'SOUND TEST FAIL');
  if (logs.length) console.log('console: ' + JSON.stringify(logs.slice(0, 6)));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
