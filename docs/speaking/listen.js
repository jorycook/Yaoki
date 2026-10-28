/*
 * Yaoki Speaking's ears: the browser's speech recognition (the Web Speech API), listening for Japanese.
 *
 * The phone sends the sound to its own speech service (Apple's on an iPhone or iPad, Google's on most Android phones)
 * and gets words back, written as a Japanese writer would; this page keeps none of it. What comes back is passed on
 * as it is heard, word by word (interim results), so a card can be cleared while the player is still saying it.
 *
 * Two ways to listen: hands-free (`free`), where listening goes on for the whole round and starts again by itself
 * each time the browser ends it (after a silence, or a minute), backing off when it keeps ending at once; and hold to
 * talk (`hold`), while the microphone button is held down. Listening only ever starts from a tap or a resumed round,
 * and the page says whenever it is listening.
 *
 * What has been heard is used up when a card is cleared (consume()), so the next card is matched only against what
 * comes after; and while the game's own voice plays (a hint), what is heard is used up as it comes (quiet()), so the
 * game never hears itself.
 *
 * window.SpeakingListen = {
 *   supported, state,                 state: off | starting | on | tap | blocked | nomic | offline | error
 *   mode,                             'free' or 'hold'
 *   listen(fromTap), stop(), hold(down), consume(), quiet(ms),
 *   onheard(texts, final),            texts: what was heard since the last consume(), alternatives first
 *   onstate(state, code),             code: the browser's error, if any
 *   onspeech(on),                     the player is speaking (or has just stopped)
 * }
 */
(function () {
  'use strict';

  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const QUICK_END = 1500;   // a listening that ends sooner than this, with nothing heard, ended at once
  const SPEECH_IDLE = 1300; // ms after the last word heard that the player is taken to have stopped speaking

  let rec = null;           // the browser's recognition of the listening going on
  let session = 0;          // counts the listenings: an event from an old one is ignored
  let wanted = false;       // the game wants to listen
  let startedAt = 0;
  let heardAny = false;
  let quickEnds = 0;
  let timer = 0;
  let last = null;          // the results of this listening as last seen: [{ alts, final }]
  let used = null;          // what of them is used up: { session, index, text }
  let quietUntil = 0;
  let quietTimer = 0;
  let speaking = false;
  let speechTimer = 0;

  const api = {
    supported: !!Rec,
    state: Rec ? 'off' : 'unsupported',
    mode: 'free',
    onheard: null,
    onstate: null,
    onspeech: null,

    // Start listening (hands-free: until stop()). `fromTap`: called in a tap, so the browser may ask for the microphone.
    listen(fromTap) {
      if (!Rec) return false;
      wanted = true;
      quickEnds = 0;
      if (!rec) begin(!!fromTap);
      return true;
    },

    // Stop listening now; what was being said is dropped.
    stop() {
      wanted = false;
      clearTimeout(timer);
      if (rec) {
        const r = rec;
        rec = null;
        session++;
        try {
          r.abort();
        } catch (err) {
          // already ended
        }
      }
      last = null;
      used = null;
      talk(false);
      if (api.state !== 'blocked' && api.state !== 'nomic' && api.state !== 'unsupported') set('off');
    },

    // Hold to talk: listening while the button is down; the words said before it is let go still come.
    hold(down) {
      if (!Rec) return;
      if (down) {
        wanted = true;
        if (!rec) begin(true);
        return;
      }
      wanted = false;
      clearTimeout(timer);
      if (rec) {
        try {
          rec.stop();
        } catch (err) {
          // already ended
        }
      }
    },

    // What has been heard so far is used up: the next words heard are matched on their own.
    consume() {
      if (!last || !last.length) return;
      const tail = last[last.length - 1];
      used = tail.final ? { session, index: last.length, text: '' } : { session, index: last.length - 1, text: tail.alts[0] || '' };
    },

    // The game's own voice plays for `ms`: what is heard meanwhile (and a moment after) is not the player.
    quiet(ms) {
      quietUntil = Math.max(quietUntil, Date.now() + ms);
      api.consume();
      clearTimeout(quietTimer);
      quietTimer = setTimeout(() => api.consume(), quietUntil - Date.now() + 300);
    },
  };

  function set(state, code) {
    const changed = api.state !== state;
    api.state = state;
    if (changed || code) {
      try {
        if (api.onstate) api.onstate(state, code || '');
      } catch (err) {
        console.error(err);
      }
    }
  }

  function talk(on) {
    clearTimeout(speechTimer);
    if (on) speechTimer = setTimeout(() => talk(false), SPEECH_IDLE);
    if (speaking === on) return;
    speaking = on;
    try {
      if (api.onspeech) api.onspeech(on);
    } catch (err) {
      console.error(err);
    }
  }

  // `tap`: asked for in a tap, so a refusal is the player's choice or the phone's settings, not the want of a tap
  function begin(tap) {
    clearTimeout(timer);
    if (rec || !wanted) return;
    const mine = ++session;
    let r;
    try {
      r = new Rec();
      r.lang = 'ja-JP';
      r.interimResults = true;
      r.maxAlternatives = 5;
      r.continuous = true;
    } catch (err) {
      set('error', 'start');
      return;
    }
    r.onstart = () => {
      if (mine === session) set('on');
    };
    r.onaudiostart = r.onstart;
    r.onspeechstart = () => {
      if (mine === session && Date.now() >= quietUntil) talk(true);
    };
    r.onspeechend = () => {
      if (mine === session) talk(false);
    };
    r.onresult = (e) => {
      if (mine === session) results(e.results);
    };
    r.onerror = (e) => {
      if (mine === session) failed(e.error || 'error', tap);
    };
    r.onend = () => {
      if (mine !== session) return;
      rec = null;
      last = null;
      used = null;
      talk(false);
      ended();
    };
    rec = r;
    startedAt = Date.now();
    heardAny = false;
    last = null;
    used = null;
    set('starting');
    try {
      r.start();
    } catch (err) {
      // a start the browser refuses outright (one already going, or not from a tap)
      rec = null;
      session++;
      set(tap ? 'error' : 'tap', 'start');
    }
  }

  // The words of this listening that are not used up, newest result last: [{ alts, final }].
  function fresh(list) {
    const out = [];
    const u = used && used.session === session ? used : null;
    for (let i = u ? u.index : 0; i < list.length; i++) {
      let alts = list[i].alts;
      if (u && i === u.index && u.text) {
        // only what came after the used part is new; a result written over since (ねこ became 猫…) starts afresh
        // once the browser closes it, so this listening is ended and begun again
        if (!alts[0].startsWith(u.text)) {
          if (!list[i].final && rec && api.mode === 'free') {
            try {
              rec.stop();
            } catch (err) {
              // already ending
            }
          }
          continue;
        }
        alts = alts.filter((t) => t.startsWith(u.text)).map((t) => t.slice(u.text.length));
      }
      alts = alts.filter((t) => t.trim());
      if (alts.length) out.push({ alts, final: list[i].final });
    }
    return out;
  }

  function results(list) {
    const now = Date.now();
    last = [];
    for (let i = 0; i < list.length; i++) {
      const res = list[i];
      const alts = [];
      for (let k = 0; k < res.length; k++) if (res[k] && typeof res[k].transcript === 'string') alts.push(res[k].transcript);
      last.push({ alts: alts.length ? alts : [''], final: !!res.isFinal });
    }
    heardAny = true;
    // the game's own voice: used up as it comes
    if (now < quietUntil) {
      api.consume();
      return;
    }
    const parts = fresh(last);
    if (!parts.length) return;
    talk(true);
    const newest = parts[parts.length - 1];
    const texts = newest.alts.slice();
    // a phrase the browser cut in two is matched whole too
    if (parts.length > 1) texts.push(parts.map((p) => p.alts[0]).join(''));
    try {
      if (api.onheard) api.onheard(texts, newest.final);
    } catch (err) {
      console.error(err);
    }
  }

  function failed(code, tap) {
    if (code === 'no-speech' || code === 'aborted') return; // the listening ends, and (hands-free) begins again
    if (code === 'not-allowed' || code === 'service-not-allowed') {
      // in a tap, it is the player's choice or the phone's settings; otherwise a tap may be all it needs
      wanted = false;
      set(tap ? 'blocked' : 'tap', code);
    } else if (code === 'audio-capture' || code === 'language-not-supported') {
      wanted = false;
      set('nomic', code);
    } else if (code === 'network') {
      set('offline', code);
    } else {
      set('error', code);
    }
  }

  // The browser ended a listening: begin again (hands-free), at once unless it keeps ending at once.
  function ended() {
    if (!wanted || api.mode !== 'free') {
      if (api.state === 'on' || api.state === 'starting') set('off');
      return;
    }
    const quick = !heardAny && Date.now() - startedAt < QUICK_END;
    quickEnds = quick ? quickEnds + 1 : 0;
    if (quickEnds > 6) {
      // it will not stay on: a tap starts it again
      wanted = false;
      set('tap', 'ended');
      return;
    }
    const wait = api.state === 'offline' ? 3000 : quickEnds > 1 ? Math.min(4000, 250 * Math.pow(2, quickEnds)) : 60;
    timer = setTimeout(() => begin(false), wait);
  }

  window.SpeakingListen = api;
})();
