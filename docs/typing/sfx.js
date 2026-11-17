/*
 * Yaoki Typing's sound effects, made on the spot with the Web Audio API (no sound files):
 * a crisp little wooden tick for a right key, a short soft "bu-bu" for a miss, the stamp's tap
 * and its "pon" when a card is cleared, rising notes as a streak grows, a taiko "don" when
 * Yaoki falls and a little bounce when he is up again. Each sound has a mid-range attack (paper,
 * wood, skin) that a laptop's small speakers can play, over a short, tight thump. The pitched
 * ones follow the scale of the song that is playing (TypingMusic.key()), or the yo scale on D
 * (the pentatonic of Japanese folk song) when none is. Each comes from where its maker is:
 * Yaoki's on the left, the card's a little to the right, the key's in the middle; and the
 * musical ones ring a little in a small room, a reverb the music shares.
 *
 * It keeps its own audio output, apart from the app's player for the word clips (sound.js),
 * and makes it only on a key press or a click, as browsers ask. Like that player, it gives the
 * output back when the page is hidden (a phone can leave an output silent after a spell in
 * the background) and the next key press makes a new one. Every call is safe without audio:
 * it just makes no sound.
 *
 * In the loud mix (Yaoki Typing), the effects and the music go out together through one master
 * chain: a high-pass for the rumble no speaker plays, a gentle glue compressor, a mild tanh
 * saturation (so low sounds gain harmonics that small speakers can play) and a limiter, so
 * together they are loud and never clip.
 */
(function () {
  'use strict';

  const AC = window.AudioContext || window.webkitAudioContext;
  let out = null;       // the live output (made by unlock()): see build()

  // How loud. A page that says nothing gets the quiet mix: Yaoki Speaking, which listens to the
  // microphone while its music plays, with no master chain. Yaoki Typing asks for the loud one
  // (mix()): the effects and the music turned up, through the master chain.
  const QUIET = { fx: 0.4, music: 1, limit: false };
  let level = QUIET;

  // The loud mix's master chain, set by measurement: the glue compressor (which adds about 6 dB
  // of its own make-up gain), the drive into the saturation, and the limiter, whose ceiling of
  // about -3 dBFS keeps the true peak under -1 dBTP.
  const GLUE = { threshold: -18, knee: 8, ratio: 2, attack: 0.015, release: 0.2 };
  const DRIVE = 0.7;
  const SAT = 1.3;       // the saturation's curve: tanh(SAT x) / SAT
  const LIMIT = { threshold: -8, knee: 0, ratio: 20, attack: 0.001, release: 0.1 };

  // The room: about 1.4 s, a short pre-delay, the lows taken out of its return.
  const ROOM = { secs: 1.5, t60: 1.4, pre: 0.016, cut: 250, ret: 0.4 };

  // Where each sound comes from (pan): Yaoki stands on the left of the game and the card is typed
  // a little right of the middle; the rest (the key, a miss, a swish, the result) in the middle.
  const PLACE = { jump: -0.3, spin: -0.3, duck: -0.3, smash: -0.3, fall: -0.3, up: -0.3, clear: 0.2, gold: 0.2, streak: 0.2 };

  // ---------- the output ----------
  const gainOf = (ctx, v) => {
    const g = ctx.createGain();
    g.gain.value = v;
    return g;
  };
  const filterOf = (ctx, type, f, q) => {
    const fl = ctx.createBiquadFilter();
    fl.type = type;
    fl.frequency.value = f;
    fl.Q.value = q;
    return fl;
  };
  const compressorOf = (ctx, s) => {
    const c = ctx.createDynamicsCompressor();
    for (const k of Object.keys(s)) c[k].value = s[k];
    return c;
  };

  // The saturation's curve, made once.
  let curve = null;
  function satCurve() {
    if (curve) return curve;
    const n = 2049;
    curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const v = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(SAT * v) / SAT;
    }
    return curve;
  }

  // The room's impulse: a few early reflections, then stereo noise that dies away over ROOM.t60
  // and grows darker as it goes (the highs die first). Made once for each sample rate (a few
  // milliseconds), each channel scaled to unit energy, so ROOM.ret and the sends set the level.
  const IR = {};
  function impulse(rate) {
    if (IR[rate]) return IR[rate];
    const n = Math.floor(rate * ROOM.secs), fade = Math.floor(rate * 0.003);
    const fall = Math.exp(-6.91 / (ROOM.t60 * rate));
    let seed = 40503;
    const ir = [new Float32Array(n), new Float32Array(n)];
    for (const d of ir) {
      let y = 0, env = 1;
      for (let i = 0; i < n; i += 64) {
        const fc = 9000 * Math.pow(1300 / 9000, i / n);
        const a = 1 - Math.exp(-2 * Math.PI * fc / rate);
        const norm = 1 / Math.sqrt(a / (2 - a));   // keeps the noise's level as its filter closes
        for (let j = i, end = Math.min(n, i + 64); j < end; j++) {
          seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
          y += a * (seed / 0x3fffffff - 1 - y);
          d[j] = y * norm * env;
          env *= fall;
        }
      }
      for (let i = 0; i < fade; i++) d[i] *= i / fade;
      for (let k = 0; k < 7; k++) {
        seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
        d[Math.floor(rate * (0.003 + 0.04 * (k + seed / 0x7fffffff) / 7))] += (k & 1 ? -1 : 1) * (0.5 + seed / 0x7fffffff);
      }
      let e = 0;
      for (let i = 0; i < n; i++) e += d[i] * d[i];
      const s = 1 / Math.sqrt(e || 1);
      for (let i = 0; i < n; i++) d[i] *= s;
    }
    IR[rate] = ir;
    return ir;
  }
  // The shared room on a context: its input, or null if the browser cannot make one. On a live
  // output the convolver (whose setting up takes the browser some milliseconds) is put in on
  // the next turn, so the key that made the output sounds at once.
  function room(ctx, dest, live) {
    try {
      if (!ctx.createConvolver) return null;
      const input = ctx.createGain();
      const pre = ctx.createDelay(0.1);
      const cut = filterOf(ctx, 'highpass', ROOM.cut, 0.6);
      const ret = gainOf(ctx, ROOM.ret);
      pre.delayTime.value = ROOM.pre;
      input.connect(pre);
      cut.connect(ret);
      ret.connect(dest);
      const fill = () => {
        try {
          if (ctx.state === 'closed') return;
          const ir = impulse(ctx.sampleRate);
          const buf = ctx.createBuffer(2, ir[0].length, ctx.sampleRate);
          buf.getChannelData(0).set(ir[0]);
          buf.getChannelData(1).set(ir[1]);
          const conv = ctx.createConvolver();
          conv.normalize = false;
          conv.buffer = buf;
          pre.connect(conv);
          conv.connect(cut);
        } catch (err) {
          // no room: the sounds stay dry
        }
      };
      if (live) setTimeout(fill, 0);
      else fill();
      return input;
    } catch (err) {
      return null;
    }
  }

  // An output on a context, for the mix `lv`: the effects' gain (master) and the music's (bus),
  // the places (stereo panners into master), the shared room and, in the loud mix, the master
  // chain: high-pass -> glue compressor -> drive -> saturation -> limiter.
  function build(ctx, lv, live) {
    let dest = ctx.destination;
    if (lv.limit) {
      const hp = filterOf(ctx, 'highpass', 35, 0.7);
      const glue = compressorOf(ctx, GLUE);
      const drive = gainOf(ctx, DRIVE);
      const sat = ctx.createWaveShaper();
      sat.curve = satCurve();
      sat.oversample = '4x';
      const limiter = compressorOf(ctx, LIMIT);
      hp.connect(glue);
      glue.connect(drive);
      drive.connect(sat);
      sat.connect(limiter);
      limiter.connect(ctx.destination);
      dest = hp;
    }
    const o = { ctx, noise: null, lastTick: 0, place: {} };
    o.master = gainOf(ctx, lv.fx);
    o.master.connect(dest);
    o.bus = gainOf(ctx, lv.music);
    o.bus.connect(dest);
    o.verb = room(ctx, dest, live);
    if (ctx.createStereoPanner) {
      for (const k of Object.keys(PLACE)) {
        const p = PLACE[k];
        if (!o.place[p]) {
          o.place[p] = ctx.createStereoPanner();
          o.place[p].pan.value = p;
          o.place[p].connect(o.master);
        }
      }
    }
    return o;
  }

  function context() {
    if (!AC) return null;
    try {
      if (!out) {
        const made = new AC();
        try {
          out = build(made, level, true);
        } catch (err) {
          made.close();
          throw err;
        }
      }
      const ctx = out.ctx;
      if (ctx.state !== 'running' && ctx.state !== 'closed') {
        const woke = ctx.resume();
        if (woke && woke.catch) woke.catch(() => {});
      }
      return ctx.state === 'closed' ? null : ctx;
    } catch (err) {
      return null;
    }
  }

  // A second of noise for each output (the same each time), played from a random place for
  // each burst, or from a set one where a sound must keep its level.
  function noise(o) {
    if (o.noise) return o.noise;
    const ctx = o.ctx, n = ctx.sampleRate;
    o.noise = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = o.noise.getChannelData(0);
    let seed = 7919;
    for (let i = 0; i < n; i++) {
      seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
      d[i] = seed / 0x3fffffff - 1;
    }
    return o.noise;
  }

  // ---------- the notes ----------
  // The scale of the song that is playing (TypingMusic.key()), or the yo scale on D (D E G A B),
  // over four octaves from within a tritone of D4. Remade only when the key changes.
  const YO = { root: 2, scale: [0, 2, 5, 7, 9] };
  let notesOf = '', notes = [];
  function scale() {
    let k = null;
    try {
      const m = window.TypingMusic;
      k = m && typeof m.key === 'function' ? m.key() : null;
    } catch (err) {
      k = null;
    }
    if (!k || !Array.isArray(k.scale) || !k.scale.length || !isFinite(k.root)) k = YO;
    const sig = k.root + ':' + k.scale.join(',');
    if (sig !== notesOf) {
      notesOf = sig;
      notes = [];
      const base = 293.66 * Math.pow(2, ((((k.root - 2 + 6) % 12) + 12) % 12 - 6) / 12);
      for (let o = 0; o < 4; o++) for (const st of k.scale) notes.push(base * Math.pow(2, o + st / 12));
    }
    return notes;
  }

  // ---------- sound making ----------
  // A little difference each time: a factor within `amt` of 1, or a level within `db` decibels.
  const vary = (amt) => 1 + (Math.random() * 2 - 1) * amt;
  const varyDb = (db) => Math.pow(10, ((Math.random() * 2 - 1) * db) / 20);

  // Disconnect a sound's nodes once its source has stopped.
  function done(src, nodes) {
    src.onended = () => {
      try {
        src.disconnect();
        for (const n of nodes) n.disconnect();
      } catch (err) {
        // already gone
      }
    };
  }
  // Send a note to the room at `wet` of its level (a send of its own, gone with the note).
  function send(x, g, wet, nodes) {
    if (!wet || !x.verb) return;
    const s = gainOf(x.ctx, wet);
    g.connect(s);
    s.connect(x.verb);
    nodes.push(s);
  }

  // One tone: a wave from `f0` gliding to `f1`, a quick rise and an exponential fall over `len`.
  // opt: lp (a low-pass to dull it), rise (the attack), wet (its send to the room).
  function tone(x, type, f0, f1, at, len, peak, opt) {
    const c = x.ctx, o = c.createOscillator(), g = c.createGain(), nodes = [g];
    const p = opt || {};
    o.type = type;
    o.frequency.setValueAtTime(f0, at);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, at + len);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + (p.rise || 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    if (p.lp) {
      const fl = filterOf(c, 'lowpass', p.lp, 0.7);
      o.connect(fl);
      fl.connect(g);
      nodes.push(fl);
    } else {
      o.connect(g);
    }
    g.connect(x.out);
    send(x, g, p.wet, nodes);
    o.start(at);
    o.stop(at + len + 0.02);
    done(o, nodes);
  }

  // A burst of filtered noise: the paper, wood or skin in a sound. opt: to (a frequency the
  // filter sweeps to), from (where in the noise to start), rise, wet.
  function hiss(x, freq, q, at, len, peak, type, opt) {
    const c = x.ctx, s = c.createBufferSource(), f = filterOf(c, type || 'bandpass', freq, q), g = c.createGain();
    const p = opt || {}, nodes = [f, g];
    s.buffer = x.noise;
    s.loop = true;
    if (p.to) {
      f.frequency.setValueAtTime(freq, at);
      f.frequency.exponentialRampToValueAtTime(p.to, at + len);
    }
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + (p.rise || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    s.connect(f);
    f.connect(g);
    g.connect(x.out);
    send(x, g, p.wet, nodes);
    s.start(at, p.from !== undefined ? p.from : Math.random() * 0.9);
    s.stop(at + len + 0.02);
    done(s, nodes);
  }

  // Each sound: (x, t, options), x the output's context, its place, the room and the notes.
  const SOUNDS = {
    // a right key: a small wooden key's click and its dry knock, never quite the same twice (its
    // pitch, level and tone vary a little), a little higher as the streak grows
    key(x, t, o) {
      const f = vary(0.03) * Math.pow(2, Math.min(o.streak || 0, 30) / 120), lv = varyDb(1.5), ff = vary(0.06);
      hiss(x, 4600 * f * ff, 1.1, t, 0.01, 0.08 * lv, 'bandpass', { from: 0.5 });
      tone(x, 'sine', 2350 * f * ff, 2250 * f * ff, t, 0.03, 0.026 * lv);
      tone(x, 'triangle', 1800 * f, 1620 * f, t, 0.04, 0.044 * lv);
    },
    // a wrong key: a short, soft "bu-bu", the second lower, its edges dulled
    miss(x, t) {
      tone(x, 'square', 311, 300, t, 0.075, 0.12, { lp: 1600, rise: 0.008 });
      tone(x, 'square', 262, 250, t + 0.09, 0.11, 0.12, { lp: 1400, rise: 0.008 });
    },
    // a card cleared: the stamp's tap on the paper, its wooden handle's knock and a short thump,
    // each a little different, then a bright "pon" in the song's key, higher as the run grows
    clear(x, t, o) {
      const f = vary(0.04), lv = varyDb(1);
      hiss(x, 2400 * vary(0.08), 1, t, 0.03, 0.4 * lv);
      tone(x, 'triangle', 640 * f, 430 * f, t, 0.07, 0.38 * lv);
      tone(x, 'sine', 165 * f, 90, t, 0.09, 0.32 * lv);
      const S = x.notes, i = Math.min(S.length - 1, 5 + Math.min(o.streak || 0, 9));
      tone(x, 'triangle', S[i], S[i], t + 0.03, 0.26, 0.24, { wet: 0.35 });
      tone(x, 'sine', S[i] * 2, S[i] * 2, t + 0.03, 0.18, 0.095, { wet: 0.35 });
    },
    // a streak reaches a new step: three rising notes of the scale
    streak(x, t, o) {
      const S = x.notes, base = Math.min(S.length - 3, 5 + (o.step || 0) * 2);
      for (let k = 0; k < 3; k++) {
        tone(x, 'triangle', S[base + k], S[base + k], t + k * 0.07, 0.22, 0.13, { wet: 0.4 });
        tone(x, 'sine', S[base + k] * 2, S[base + k] * 2, t + k * 0.07, 0.14, 0.04, { wet: 0.4 });
      }
    },
    // a golden card cleared: a koban's ring
    gold(x, t) {
      const S = x.notes;
      for (const [k, i] of [[0, 14], [0.06, 16], [0.12, 17]]) {
        tone(x, 'sine', S[i], S[i], t + k, 0.4, 0.07, { wet: 0.5 });
        tone(x, 'sine', S[i] * 1.5, S[i] * 1.5, t + k, 0.18, 0.02, { wet: 0.5 });
      }
    },
    // Yaoki falls: a taiko "don" (the stick's slap and click, the skin's tone sagging, a short
    // deep thump) and the knock of his wooden body
    fall(x, t) {
      hiss(x, 1300, 0.8, t, 0.09, 0.55);
      hiss(x, 3600, 1.4, t, 0.015, 0.3);
      tone(x, 'triangle', 300, 170, t, 0.25, 0.42);
      tone(x, 'triangle', 470, 330, t, 0.15, 0.28);
      tone(x, 'sine', 125, 58, t, 0.2, 0.38);
      tone(x, 'triangle', 880, 700, t + 0.12, 0.06, 0.12);
    },
    // he is up again: a little two-note bounce
    up(x, t) {
      const S = x.notes;
      tone(x, 'triangle', S[5], S[5], t, 0.1, 0.15, { wet: 0.3 });
      tone(x, 'triangle', S[7], S[7], t + 0.09, 0.18, 0.15, { wet: 0.3 });
      tone(x, 'sine', S[7] * 2, S[7] * 2, t + 0.09, 0.12, 0.04, { wet: 0.3 });
    },
    // Yaoki jumps over a cleared card: a hop off the ground and a springy boing
    jump(x, t) {
      hiss(x, 1500, 1.2, t, 0.03, 0.1);
      tone(x, 'triangle', 280, 660, t, 0.17, 0.18, { wet: 0.15 });
      tone(x, 'sine', 560, 1320, t, 0.13, 0.08, { wet: 0.15 });
    },
    // he spins over one: three bright notes of the scale, quickly, and the air swirling
    spin(x, t) {
      const S = x.notes;
      for (let k = 0; k < 3; k++) tone(x, 'triangle', S[8 + k], S[8 + k], t + k * 0.05, 0.15, 0.085, { wet: 0.3 });
      hiss(x, 3000, 2.5, t, 0.18, 0.04, 'bandpass', { to: 6000 });
    },
    // he ducks while it sails over: a paper whoosh going by
    duck(x, t) {
      hiss(x, 2400, 1.4, t, 0.32, 0.13, 'bandpass', { to: 500, rise: 0.08 });
    },
    // he smashes through one: a short thump and the paper tearing in ragged bursts
    smash(x, t) {
      tone(x, 'sine', 140, 55, t, 0.12, 0.3);
      tone(x, 'triangle', 380, 220, t, 0.09, 0.3);
      for (let k = 0; k < 5; k++) hiss(x, 1300 + 1500 * Math.random(), 1.4, t + 0.014 * k + 0.006 * Math.random(), 0.05, 0.3 * (1 - 0.13 * k));
      hiss(x, 4200, 1.2, t + 0.02, 0.12, 0.13);
    },
    // a card skipped or a power used: a soft paper swish
    swish(x, t) {
      hiss(x, 1800, 0.7, t, 0.18, 0.12);
    },
    // the round's stamp lands on the result: paper, wood and a thump, then a short phrase in
    // the song's key that rises with the tier
    result(x, t, o) {
      hiss(x, 2200, 1, t, 0.04, 0.32);
      tone(x, 'triangle', 540, 340, t, 0.09, 0.3);
      tone(x, 'sine', 150, 75, t, 0.11, 0.26);
      const S = x.notes, tier = o.tier || 0;
      const steps = tier === 0 ? [5, 7, 8, 10] : tier === 1 ? [5, 7, 8] : [5, 6];
      steps.forEach((n, k) => {
        tone(x, 'triangle', S[n], S[n], t + 0.12 + k * 0.1, 0.32, 0.13, { wet: 0.4 });
        tone(x, 'sine', S[n] * 2, S[n] * 2, t + 0.12 + k * 0.1, 0.2, 0.035, { wet: 0.4 });
      });
    },
  };

  // Play `name` on an output at time `at`, from its place.
  function sound(o, name, at, opts) {
    const p = PLACE[name];
    const x = { ctx: o.ctx, out: (p && o.place[p]) || o.master, verb: o.verb, noise: noise(o), notes: scale() };
    SOUNDS[name](x, at, opts);
  }

  // Give the audio output back; unlock() makes a new one.
  function sleep() {
    if (!out) return;
    try {
      const closing = out.ctx.close();
      if (closing && closing.catch) closing.catch(() => {});
    } catch (err) {
      // already closed
    }
    out = null;
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') sleep();
  });

  const mixOf = (o) => {
    const num = (v, d) => (typeof v === 'number' && isFinite(v) && v >= 0 ? v : d);
    return { fx: num(o && o.fx, QUIET.fx), music: num(o && o.music, QUIET.music), limit: !!(o && o.limit) };
  };

  window.TypingSfx = {
    // The mix: { fx, music } gains for the effects and the music, and limit, the master chain
    // on both. Set it before the first unlock(); a change of chain takes the next output.
    mix(o) {
      const next = mixOf(o);
      const rewire = !!out && next.limit !== level.limit;
      level = next;
      if (rewire) sleep();
      else if (out) {
        out.master.gain.value = level.fx;
        out.bus.gain.value = level.music;
      }
    },
    // Wake the output; call it from a key press or a click.
    unlock() {
      context();
    },
    sleep,
    // The output for the page's other sounds (the music): its context, a bus to play into and
    // the shared room's input (verb, or null), or null while there is none (made only by
    // unlock(), in a key press or click).
    audio() {
      const c = out ? context() : null;
      return c ? { ctx: c, out: out.bus, verb: out.verb } : null;
    },
    // Plays on an output a key press or click has made: never makes one by itself.
    play(name, opts) {
      const c = SOUNDS[name] && out ? context() : null;
      if (!c || c.state !== 'running') return false;
      const t = c.currentTime + 0.005;
      if (name === 'key') {
        if (t - out.lastTick < 0.025) return false;
        out.lastTick = t;
      }
      try {
        sound(out, name, t, opts || {});
      } catch (err) {
        return false;
      }
      return true;
    },
    // For tests: an output on any context (an OfflineAudioContext), of the mix `o` or else the
    // page's own: the music's bus and the room (out, verb, for TypingMusic._renderTo) and
    // play(name, opts, at).
    _output(ctx, o) {
      const p = build(ctx, o ? mixOf(o) : level);
      return {
        ctx, out: p.bus, verb: p.verb,
        play(name, opts, at) {
          if (SOUNDS[name]) sound(p, name, at, opts || {});
        },
      };
    },
  };
})();
