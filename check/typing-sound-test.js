// Yaoki Typing's sound (docs/typing/sfx.js and music.js) through the game's own loud mix:
// each song rendered offline (level 1, then level 3) for its loudness, peaks and tone, the
// effects for their tone and the key tick's level, every effect played on a running output
// (with its nodes let go afterwards), and TypingMusic.beat() and key().
// Run: node check/typing-sound-test.js      (VERBOSE=1 shows the numbers of each check; under a minute)
'use strict';

const path = require('node:path');
const { chromium } = require('playwright');

const url = 'file://' + path.resolve(__dirname, '..', 'docs', 'typing', 'index.html');
const RATE = 48000;

let failures = 0;
function check(label, ok, detail = '') {
  if (ok) console.log('ok   ' + label + (process.env.VERBOSE && detail ? '\n     ' + detail : ''));
  else {
    failures++;
    console.log('FAIL ' + label + (detail ? '\n     ' + detail : ''));
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const db = (v) => 20 * Math.log10(Math.max(v, 1e-12));

// ---------- measuring a stereo buffer ----------
// Integrated loudness (ITU-R BS.1770-4: K-weighting, 400 ms blocks, absolute and relative gates).
function biquad(x, b, a) {
  const y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2;
    x2 = x1;
    x1 = x[i];
    y2 = y1;
    y1 = v;
    y[i] = v;
  }
  return y;
}
function lufs(L, R) {
  const k = (x) => biquad(biquad(x, [1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585]),
    [1, -2, 1], [1, -1.99004745483398, 0.99007225036621]);
  const a = k(L), b = k(R), block = RATE * 0.4, step = RATE * 0.1, z = [];
  for (let s = 0; s + block <= a.length; s += step) {
    let e = 0;
    for (let i = s; i < s + block; i++) e += a[i] * a[i] + b[i] * b[i];
    z.push(e / block);
  }
  const loud = (list) => -0.691 + 10 * Math.log10(list.reduce((p, v) => p + v, 0) / Math.max(list.length, 1));
  const abs = z.filter((v) => -0.691 + 10 * Math.log10(v) > -70);
  const rel = loud(abs) - 10;
  return loud(abs.filter((v) => -0.691 + 10 * Math.log10(v) > rel));
}
// The true peak: 4x oversampled (windowed sinc) around every sample near the sample peak.
function truePeak(chans) {
  let top = 0;
  for (const x of chans) for (let i = 0; i < x.length; i++) top = Math.max(top, Math.abs(x[i]));
  let tp = top;
  const T = 16, sinc = (u) => (u === 0 ? 1 : Math.sin(Math.PI * u) / (Math.PI * u));
  for (const x of chans) {
    for (let i = T; i < x.length - T; i++) {
      if (Math.abs(x[i]) < top * 0.7) continue;
      for (let ph = 1; ph < 4; ph++) {
        let v = 0;
        for (let j = -T + 1; j <= T; j++) {
          const u = j - ph / 4;
          v += x[i + j] * sinc(u) * (0.5 + 0.5 * Math.cos(Math.PI * u / T));
        }
        tp = Math.max(tp, Math.abs(v));
      }
    }
  }
  return tp;
}
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const w = -2 * Math.PI / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const c = Math.cos(w * k), s = Math.sin(w * k);
        const ar = re[i + k + len / 2], ai = im[i + k + len / 2];
        const tr = ar * c - ai * s, ti = ar * s + ai * c;
        re[i + k + len / 2] = re[i + k] - tr;
        im[i + k + len / 2] = im[i + k] - ti;
        re[i + k] += tr;
        im[i + k] += ti;
      }
    }
  }
}
// Tone: the share of the energy in bands (of the frames above -50 dBFS), the spectral centroid
// and the stereo width (side over mid).
function tone(L, R) {
  const N = 8192, win = new Float64Array(N), p = new Float64Array(N / 2);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
  for (let s = 0; s + N <= L.length; s += N / 2) {
    let e = 0;
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const m = (L[s + i] + R[s + i]) / 2;
      e += m * m;
      re[i] = m * win[i];
    }
    if (Math.sqrt(e / N) < Math.pow(10, -50 / 20)) continue;
    fft(re, im);
    for (let k = 0; k < N / 2; k++) p[k] += re[k] * re[k] + im[k] * im[k];
  }
  const band = (lo, hi) => {
    let e = 0, all = 0;
    for (let k = 1; k < N / 2; k++) {
      const f = k * RATE / N;
      if (f < 20 || f > 20000) continue;
      all += p[k];
      if (f >= lo && f < hi) e += p[k];
    }
    return e / (all || 1);
  };
  let num = 0, den = 0;
  for (let k = 1; k < N / 2; k++) {
    num += p[k] * k * RATE / N;
    den += p[k];
  }
  let side = 0, mid = 0;
  for (let i = 0; i < L.length; i++) {
    side += (L[i] - R[i]) ** 2;
    mid += (L[i] + R[i]) ** 2;
  }
  return { low: band(20, 250), mid: band(1000, 4000), keyBand: band(1000, 5000), centroid: num / (den || 1), side: Math.sqrt(side / (mid || 1)) };
}
function measure(L, R) {
  let clips = 0, peak = 0;
  for (const x of [L, R]) for (let i = 0; i < x.length; i++) {
    const v = Math.abs(x[i]);
    if (v >= 0.999) clips++;
    peak = Math.max(peak, v);
  }
  return Object.assign({ lufs: lufs(L, R), tp: db(truePeak([L, R])), peak: db(peak), clips }, tone(L, R));
}
const fmt = (m) => `${m.lufs.toFixed(1)} LUFS, true peak ${m.tp.toFixed(1)} dBTP, ${(100 * m.low).toFixed(0)}% under 250 Hz, `
  + `${(100 * m.mid).toFixed(0)}% at 1-4 kHz, centroid ${m.centroid.toFixed(0)} Hz, side/mid ${m.side.toFixed(2)}`;

(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/fonts\.g|net::/.test(m.text())) errors.push('console: ' + m.text());
  });
  // Count the audio connections still standing: a node's own connect() calls, all dropped by
  // its disconnect().
  await page.addInitScript(() => {
    const connect = AudioNode.prototype.connect, disconnect = AudioNode.prototype.disconnect;
    window.__links = 0;
    AudioNode.prototype.connect = function (...args) {
      if (!(this.context instanceof OfflineAudioContext)) {
        this.__links = (this.__links || 0) + 1;
        window.__links++;
      }
      return connect.apply(this, args);
    };
    AudioNode.prototype.disconnect = function (...args) {
      window.__links -= this.__links || 0;
      this.__links = 0;
      return disconnect.apply(this, args);
    };
  });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto(url);
  await page.evaluate(() => {
    const enc = (a) => {
      const u = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
      let s = '';
      for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
      return btoa(s);
    };
    window.__send = (buf) => ({ L: enc(buf.getChannelData(0)), R: enc(buf.getChannelData(1)) });
  });
  const pull = (res) => {
    const dec = (b64) => {
      const b = Buffer.from(b64, 'base64');
      return new Float32Array(b.buffer, b.byteOffset, b.length / 4);
    };
    return [dec(res.L), dec(res.R)];
  };

  // ---- the songs, offline, through the game's own mix
  const songs = await page.evaluate(() => window.TypingMusic.SONGS.map((s) => ({ id: s.id, bpm: s.bpm })));
  check('six songs', songs.length === 6, songs.map((s) => s.id).join(' '));
  for (const s of songs) {
    const [L, R] = pull(await page.evaluate(async ([id, bpm, rate]) => {
      const octx = new OfflineAudioContext(2, rate * 14, rate);
      const out = window.TypingSfx._output(octx);
      const r = await window.TypingMusic._renderTo(octx, id, 1, 14, { out: out.out, verb: out.verb, events: [{ step: Math.ceil(7 / (15 / bpm)), level: 3 }] });
      return window.__send(r.buffer);
    }, [s.id, s.bpm, RATE]));
    const m = measure(L, R);
    check(`${s.id}: -22 LUFS (within 1.5), true peak under -1 dBTP, no clipping`, Math.abs(m.lufs + 22) <= 1.5 && m.tp <= -1 && m.clips === 0, fmt(m));
    check(`${s.id}: heard on small speakers (at most 40% under 250 Hz, 15% at 1-4 kHz, centroid 800 Hz)`, m.low <= 0.4 && m.mid >= 0.15 && m.centroid >= 800, fmt(m));
    check(`${s.id}: wide (side/mid at least 0.12)`, m.side >= 0.12, fmt(m));
  }
  // 小さめ Soft is about 6 dB under あり On
  {
    const levels = [];
    for (const vol of [0.6, 0.3]) {
      const [L, R] = pull(await page.evaluate(async ([vol, rate]) => {
        const octx = new OfflineAudioContext(2, rate * 8, rate);
        const out = window.TypingSfx._output(octx);
        const r = await window.TypingMusic._renderTo(octx, 'matsuri', 2, 8, { out: out.out, verb: out.verb, volume: vol });
        return window.__send(r.buffer);
      }, [vol, RATE]));
      levels.push(lufs(L, R));
    }
    check('小さめ Soft about 6 dB under あり On', Math.abs(levels[0] - levels[1] - 6) <= 1.5, `${levels[0].toFixed(1)} and ${levels[1].toFixed(1)} LUFS`);
  }

  // ---- the effects, offline: the whole set, then the key tick
  {
    const [L, R] = pull(await page.evaluate(async (rate) => {
      const list = [['key', { streak: 0 }], ['miss'], ['clear', { streak: 0 }], ['clear', { streak: 6 }], ['streak', { step: 1 }], ['gold'], ['fall'], ['up'], ['jump'], ['spin'], ['duck'], ['smash'], ['swish'], ['result', { tier: 0 }], ['result', { tier: 2 }]];
      const octx = new OfflineAudioContext(2, rate * 14, rate);
      const out = window.TypingSfx._output(octx);
      let t = 0.2;
      for (const [n, o] of list) {
        out.play(n, o, t);
        t += n === 'fall' || n === 'result' ? 1.3 : 0.8;
      }
      return window.__send(await octx.startRendering());
    }, RATE));
    const m = measure(L, R);
    check('the effects: at most 50% under 250 Hz, centroid at least 700 Hz', m.low <= 0.5 && m.centroid >= 700, fmt(m));
    check('the effects: true peak under -1 dBTP, no clipping', m.tp <= -1 && m.clips === 0, fmt(m));
  }
  {
    const [L, R] = pull(await page.evaluate(async (rate) => {
      const octx = new OfflineAudioContext(2, rate * 3.2, rate);
      const out = window.TypingSfx._output(octx);
      for (let i = 0; i < 20; i++) out.play('key', { streak: i }, 0.1 + i * 0.15);
      return window.__send(await octx.startRendering());
    }, RATE));
    const peaks = [], cents = [];
    for (let i = 0; i < 20; i++) {
      const s = Math.round((0.1 + i * 0.15) * RATE), e = s + Math.round(0.14 * RATE);
      peaks.push(db(Math.max(...L.subarray(s, e).map(Math.abs), ...R.subarray(s, e).map(Math.abs))));
      cents.push(tone(L.subarray(s - 1000, s + 7192), R.subarray(s - 1000, s + 7192)).centroid);
    }
    const m = tone(L, R);
    check('the key tick peaks at -20 to -14 dBFS', peaks.every((p) => p >= -20 && p <= -14), peaks.map((p) => p.toFixed(1)).join(' '));
    check('the key tick is mostly 1-5 kHz', m.keyBand >= 0.7, (100 * m.keyBand).toFixed(0) + '%');
    check('no two key ticks in a row are the same', peaks.every((p, i) => i === 0 || p !== peaks[i - 1]), peaks.map((p) => p.toFixed(2)).join(' '));
    const firsts = cents.slice(0, 5).reduce((a, b) => a + b) / 5, lasts = cents.slice(-5).reduce((a, b) => a + b) / 5;
    check('the key tick rises with the run', lasts > firsts * 1.03, `centroid ${firsts.toFixed(0)} Hz at first, ${lasts.toFixed(0)} Hz at a run of 15-19`);
  }
  // the room's impulse is made once, quickly
  {
    const ms = await page.evaluate(() => {
      const t = performance.now();
      window.TypingSfx._output(new OfflineAudioContext(2, 100, 44100), { fx: 1, music: 1, limit: true });
      return performance.now() - t;
    });
    check('a new output (the room\'s impulse included) is made in under 40 ms', ms < 40, ms.toFixed(1) + ' ms');
  }

  // ---- on a running output: every effect plays, and its nodes are let go
  await page.keyboard.press('Shift');
  await page.evaluate(() => window.TypingSfx.unlock());
  check('the output runs after a key', await page.evaluate(async () => {
    for (let i = 0; i < 40; i++) {
      const a = window.TypingSfx.audio();
      if (a && a.ctx.state === 'running') return true;
      await new Promise((r) => setTimeout(r, 50));
    }
    return false;
  }));
  await sleep(300);
  const base = await page.evaluate(() => window.__links);
  const played = await page.evaluate(async () => {
    const names = ['key', 'miss', 'clear', 'streak', 'gold', 'fall', 'up', 'jump', 'spin', 'duck', 'smash', 'swish', 'result'];
    const ok = [];
    for (const n of names) {
      ok.push([n, window.TypingSfx.play(n, { streak: 7, step: 1, tier: 0 })]);
      await new Promise((r) => setTimeout(r, 60));
    }
    for (let i = 0; i < 60; i++) {
      window.TypingSfx.play('key', { streak: i });
      await new Promise((r) => setTimeout(r, 30));
    }
    return ok;
  });
  check('every effect plays on a running output', played.every((p) => p[1]), played.filter((p) => !p[1]).map((p) => p[0]).join(' '));
  const during = await page.evaluate(() => window.__links);
  await sleep(2500);
  const after = await page.evaluate(() => window.__links);
  check('the effects\' nodes are let go once they have sounded', during > base && after === base, `${base} links before, ${during} while playing, ${after} after`);

  // ---- the music on the running output: key(), beat(), and its nodes let go after a stop
  const music = await page.evaluate(async () => {
    const M = window.TypingMusic, wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const out = { before: M.beat(), keyBefore: M.key() };
    M.volume(0.6);
    out.started = M.start('take');
    out.key = M.key();
    await wait(400);
    out.a = M.beat();
    const c = window.TypingSfx.audio().ctx, z = M._t0();
    const late = (c.outputLatency > 0 ? c.outputLatency : 0) + (c.baseLatency > 0 ? c.baseLatency : 0);
    out.expect = (c.currentTime - late - z.t0) / (4 * z.sd);
    out.ta = c.currentTime;
    await wait(1500);
    out.b = M.beat();
    out.tb = c.currentTime;
    M.volume(0);
    out.muted = M.beat();
    M.volume(0.6);
    out.unmuted = M.beat();
    M.pause();
    out.paused = M.beat();
    M.resume();
    out.resumed = M.beat();
    let threw = false;
    try {
      for (let i = 0; i < 2000; i++) M.beat();
    } catch (err) {
      threw = true;
    }
    out.threw = threw;
    M.stop(0.05);
    out.stopped = M.beat();
    out.keyAfter = M.key();
    return out;
  });
  check('beat() is null before a song', music.before === null);
  check('key() is null before a song', music.keyBefore === null);
  check('key() gives the song\'s key (take: hirajoshi on A)', music.started && music.key && music.key.root === 9 && music.key.scale.join() === '0,2,3,7,8', JSON.stringify(music.key));
  const okBeat = (b) => b && b.bpm === 108 && b.phase >= 0 && b.phase < 1 && Number.isInteger(b.beat) && b.beat >= 0;
  check('beat() gives bpm, phase and beat while a song plays', okBeat(music.a) && okBeat(music.b), JSON.stringify([music.a, music.b]));
  check('beat() follows the audio clock', music.a && Math.abs(music.a.beat + music.a.phase - music.expect) < 0.05, `${music.a && (music.a.beat + music.a.phase).toFixed(3)} beats, the clock says ${music.expect.toFixed(3)}`);
  const gone = music.a && music.b ? (music.b.beat + music.b.phase) - (music.a.beat + music.a.phase) : 0;
  const due = (music.tb - music.ta) * 108 / 60;
  check('beat() keeps the tempo (108 bpm)', Math.abs(gone - due) < 0.05, `${gone.toFixed(3)} beats in ${(music.tb - music.ta).toFixed(3)} s of audio clock`);
  check('beat() is null when muted, paused or stopped, and back when unmuted or resumed',
    music.muted === null && okBeat(music.unmuted) && music.paused === null && music.stopped === null, JSON.stringify(music));
  check('beat() never throws', !music.threw);
  check('key() is null after a stop', music.keyAfter === null);
  await sleep(2500);
  const afterMusic = await page.evaluate(() => window.__links);
  check('the music\'s nodes are let go after a stop', afterMusic === base, `${base} links before, ${afterMusic} after`);
  check('beat() is null with no output', await page.evaluate(() => {
    window.TypingSfx.sleep();
    return window.TypingMusic.beat() === null;
  }));

  check('no script errors', errors.length === 0, errors.join('\n'));
  await browser.close();
  console.log(failures ? `\n${failures} FAILED` : '\nall passed');
  process.exit(failures ? 1 : 0);
})();
