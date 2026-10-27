/*
 * Yaoki Typing's sound effects, made on the spot with the Web Audio API (no sound files):
 * a soft wooden tick for a right key, a dull knock for a miss, a stamp's "pon" when a card is
 * cleared, rising notes of the yo scale (the pentatonic of Japanese folk song) as a streak
 * grows, a taiko "don" when Yaoki falls and a little bounce when he is up again.
 *
 * It keeps its own audio output, apart from the app's player for the word clips (sound.js),
 * and makes it only on a key press or a click, as browsers ask. Every call is safe without
 * audio: it just makes no sound.
 */
(function () {
  'use strict';

  const AC = window.AudioContext || window.webkitAudioContext;
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let lastTick = 0;

  // The yo scale from D: D E G A B, over three octaves.
  const YO = [];
  for (let o = 0; o < 3; o++) for (const st of [0, 2, 5, 7, 9]) YO.push(293.66 * Math.pow(2, o + st / 12));

  function context() {
    if (!AC) return null;
    try {
      if (!ctx) {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.32;
        master.connect(ctx.destination);
      }
      if (ctx.state !== 'running' && ctx.state !== 'closed') {
        const woke = ctx.resume();
        if (woke && woke.catch) woke.catch(() => {});
      }
    } catch (err) {
      return null;
    }
    return ctx.state === 'closed' ? null : ctx;
  }

  function noise() {
    if (noiseBuf) return noiseBuf;
    const n = Math.floor(ctx.sampleRate * 0.4);
    noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }

  // One tone: a wave from `f0` gliding to `f1`, with a quick attack and an exponential fall.
  function tone(type, f0, f1, at, len, peak) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, at);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, at + len);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    o.connect(g).connect(master);
    o.start(at);
    o.stop(at + len + 0.02);
  }

  // A burst of filtered noise: the wood or paper in a sound.
  function hiss(freq, q, at, len, peak, type = 'bandpass') {
    const s = ctx.createBufferSource();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    s.buffer = noise();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    s.connect(f).connect(g).connect(master);
    s.start(at);
    s.stop(at + len + 0.02);
  }

  const SOUNDS = {
    // a right key: a soft wooden tick, a little higher as the streak grows
    key(t, o) {
      const lift = Math.min(o.streak || 0, 30) * 6;
      hiss(2600 + lift * 4, 6, t, 0.035, 0.09);
      tone('sine', 1180 + lift, 1100 + lift, t, 0.04, 0.035);
    },
    // a wrong key: a dull knock, low and short
    miss(t) {
      tone('triangle', 190, 120, t, 0.12, 0.22);
      hiss(500, 2, t, 0.06, 0.08, 'lowpass');
    },
    // a card cleared: the stamp's thump and a bright "pon"
    clear(t, o) {
      hiss(900, 1.2, t, 0.07, 0.28, 'lowpass');
      tone('sine', 150, 70, t, 0.12, 0.35);
      const i = Math.min(YO.length - 1, 5 + Math.min(o.streak || 0, 9));
      tone('triangle', YO[i], YO[i], t + 0.03, 0.22, 0.16);
      tone('sine', YO[i] * 2, YO[i] * 2, t + 0.03, 0.16, 0.05);
    },
    // a streak reaches a new step: three rising notes of the yo scale
    streak(t, o) {
      const base = Math.min(YO.length - 3, 5 + (o.step || 0) * 2);
      for (let k = 0; k < 3; k++) tone('triangle', YO[base + k], YO[base + k], t + k * 0.07, 0.2, 0.14);
    },
    // a golden card cleared: a koban's ring
    gold(t) {
      for (const [k, f] of [[0, 1975.5], [0.06, 2637], [0.12, 3135.9]]) {
        tone('sine', f, f, t + k, 0.35, 0.07);
        tone('sine', f * 1.5, f * 1.5, t + k, 0.18, 0.02);
      }
    },
    // Yaoki falls: a taiko "don"
    fall(t) {
      tone('sine', 120, 52, t, 0.45, 0.6);
      hiss(220, 1, t, 0.18, 0.3, 'lowpass');
    },
    // he is up again: a little two-note bounce
    up(t) {
      tone('triangle', YO[5], YO[5], t, 0.1, 0.12);
      tone('triangle', YO[7], YO[7], t + 0.09, 0.16, 0.12);
    },
    // a card skipped or a power used: a soft paper swish
    swish(t) {
      hiss(1800, 0.7, t, 0.18, 0.12);
    },
    // the round's stamp lands on the result: a thump and a short phrase that rises with the tier
    result(t, o) {
      hiss(700, 1, t, 0.09, 0.3, 'lowpass');
      tone('sine', 140, 60, t, 0.16, 0.4);
      const tier = o.tier || 0;
      const notes = tier === 0 ? [5, 7, 8, 10] : tier === 1 ? [5, 7, 8] : [5, 6];
      notes.forEach((n, k) => tone('triangle', YO[n], YO[n], t + 0.12 + k * 0.1, 0.3, 0.13));
    },
  };

  window.TypingSfx = {
    // Wake the output; call it from a key press or a click.
    unlock() {
      context();
    },
    play(name, opts) {
      const fn = SOUNDS[name];
      const c = fn && context();
      if (!c || c.state !== 'running') return false;
      const t = c.currentTime + 0.005;
      if (name === 'key') {
        if (t - lastTick < 0.025) return false;
        lastTick = t;
      }
      try {
        fn(t, opts || {});
      } catch (err) {
        return false;
      }
      return true;
    },
  };
})();
