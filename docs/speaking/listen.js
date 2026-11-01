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
 * comes after; and while the game's own voice plays (a hint), and for a moment after, while the phone sends back what
 * it heard, what is heard is used up as it comes (quiet()), so the game never hears itself. The start of a phrase that
 * was not used up when the browser ended a listening (a pause in the middle of a phrase) is offered again joined to the
 * next words heard, and a closed result a phone sends twice at once is heard once.
 *
 * window.SpeakingListen = {
 *   supported, state,                 state: off | starting | on | tap | blocked | nomic | offline | error
 *   mode,                             'free' or 'hold'
 *   listen(fromTap), stop(then), hold(down), consume(), quiet(ms), loud(),
 *   onheard(texts, final, carried, whole),
 *                                     texts: what was heard since the last consume(), alternatives first; carried:
 *                                     it is the rest of words that were partly used up (ねこです after ねこ); whole:
 *                                     when the phone was taken to repeat all it heard before, and only the new end
 *                                     of what it sent is in texts, what it sent whole (いえ after い: a phone that
 *                                     does not repeat sent a new word), to count only as a card's whole word
 *   onstate(state, code),             code: the browser's error, if any
 *   onspeech(on),                     the player is speaking (or has just stopped)
 * }
 */
(function () {
  'use strict';

  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const QUICK_END = 1500;   // a listening that ends sooner than this, with nothing heard, ended at once
  const SPEECH_IDLE = 1300; // ms after the last word heard that the player is taken to have stopped speaking
  const ECHO = 700;         // ms the phone takes to send back what it heard: the game's own voice is kept out this much longer
  const TWICE = 600;        // a closed result that repeats the one before it this soon is the same words sent twice
  const CARRY = 6000;       // ms the start of a phrase heard before a listening ended is offered with the next words
  const LET_GO = 400;       // ms a stopped listening is given to let go of the microphone, if the browser never says

  let rec = null;           // the browser's recognition of the listening going on
  let session = 0;          // counts the listenings: an event from an old one is ignored
  let wanted = false;       // the game wants to listen
  let startedAt = 0;
  let heardAny = false;
  let quickEnds = 0;
  let timer = 0;
  let last = null;          // the results of this listening as last seen: [{ alts, final }]
  let used = null;          // what of them is used up: the results before `index` whole, and `text` of the open ones
                            // from `index` on; `all`, the newest result's text (for a phone that repeats it)
  let repeats = false;      // this listening's phone repeats, in each new result, all it heard before (some Android phones)
  let closedAt = [];        // when each result of this listening was first seen closed
  let twice = new Set();    // the closed results of this listening that are the one before sent again
  let twinOpen = new Set(); // the open results taken for that while they were open
  let before = null;        // { text, at }: what the last listening heard and did not use up, when it ended
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

    // Stop listening now; what was being said is dropped. `then`, if given, is called once the browser has let go of
    // the microphone (or soon, if it never says): a phone plays sound quietly, or not at all, while it listens.
    stop(then) {
      wanted = false;
      clearTimeout(timer);
      if (rec) {
        const r = rec;
        rec = null;
        session++;
        if (then) {
          let done = false;
          const go = () => {
            if (done) return;
            done = true;
            then();
          };
          r.onend = go;
          setTimeout(go, LET_GO);
        }
        try {
          r.abort();
        } catch (err) {
          // already ended
        }
      } else if (then) {
        setTimeout(then, 0);
      }
      last = null;
      used = null;
      before = null;
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
      before = null;
      if (!last || !last.length) return;
      // the closed results whole; the open ones at the end (a browser may split one into a steady and a changing part)
      // as far as they go now
      let open = last.length;
      while (open > 0 && !last[open - 1].final) open--;
      const text = last.slice(open).map((x) => x.alts[0] || '').join('');
      used = { session, index: open, text, all: last[last.length - 1].alts[0] || '' };
    },

    // The game's own voice plays for `ms`: what is heard meanwhile (and while the phone catches up) is not the player.
    quiet(ms) {
      quietUntil = Math.max(quietUntil, Date.now() + ms + ECHO);
      api.consume();
      hushed();
    },
    // The game's voice has finished (sooner than it was given): once the phone has caught up, the player is heard again.
    loud() {
      quietUntil = Math.min(quietUntil, Date.now() + ECHO);
      api.consume();
      hushed();
    },
  };

  // At the end of the game's voice, what was heard during it is used up once more (a result still open holds it).
  function hushed() {
    clearTimeout(quietTimer);
    quietTimer = setTimeout(() => api.consume(), Math.max(0, quietUntil - Date.now()) + 50);
  }

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
      // what this listening heard and did not use up (the start of a phrase, and then a pause): offered with the next
      const left = last ? fresh(last).map((p) => p.alts[0]).join('') : '';
      if (left) before = { text: (before && Date.now() - before.at < CARRY ? before.text : '') + left, at: Date.now() };
      last = null;
      used = null;
      talk(false);
      ended();
    };
    rec = r;
    startedAt = Date.now();
    heardAny = false;
    repeats = false;
    closedAt = [];
    twice = new Set();
    twinOpen = new Set();
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

  // The words of this listening that are not used up, newest result last: [{ alts, final, carried }].
  function fresh(list) {
    const out = [];
    const u = used && used.session === session ? used : null;
    let prefix = u ? u.text : '';
    let all = u ? u.all : '';
    for (let i = u ? u.index : 0; i < list.length; i++) {
      if (twice.has(i)) continue;
      if (!list[i].final && sentTwice(list, i)) {
        twinOpen.add(i);
        continue;
      }
      let alts = list[i].alts;
      const top = alts[0];
      let carried = false;
      let whole = null;
      if (prefix) {
        // what was used up of the results that were open: only what came after it is new
        if (prefix.startsWith(top)) {
          prefix = prefix.slice(top.length);
          continue;
        }
        if (!top.startsWith(prefix)) {
          // written over since (ねこ became 猫…), so what is new in it cannot be told
          if (list[i].final) {
            // closed: it is used up whole, and what comes after it is new
            used = { session, index: i + 1, text: '', all: top };
            prefix = '';
            all = top;
            continue;
          }
          // still open: hands-free, this listening is ended and begun again, so the next words come clean
          if (rec && api.mode === 'free') {
            try {
              rec.stop();
            } catch (err) {
              // already ending
            }
          }
          break;
        }
        alts = alts.filter((t) => t.startsWith(prefix)).map((t) => t.slice(prefix.length));
        prefix = '';
        carried = true;
      } else if (repeats && all && top.length > all.length && top.startsWith(all)) {
        // a phone that repeats, in each new result, all it heard before: only what follows the used part is new. A
        // phone that does not, sending a word that begins with the one before it (いえ after い), sent it whole
        whole = alts.slice();
        alts = alts.filter((t) => t.startsWith(all)).map((t) => t.slice(all.length));
      }
      alts = alts.filter((t) => t.trim());
      if (alts.length) out.push({ alts, final: list[i].final, carried, whole });
    }
    return out;
  }

  // Result i is the closed one before it, sent again at once (some phones send each closed result twice).
  function sentTwice(list, i) {
    const a = list[i - 1];
    return !!(a && a.final && list[i].alts[0] && list[i].alts[0] === a.alts[0] && Date.now() - closedAt[i - 1] < TWICE);
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
    for (let i = 0; i < last.length; i++) {
      if (!last[i].final || closedAt[i] !== undefined) continue;
      closedAt[i] = now;
      const same = i > 0 && last[i - 1].final && last[i].alts[0] === last[i - 1].alts[0];
      if (same && closedAt[i - 1] !== undefined && (sentTwice(last, i) || twinOpen.has(i))) twice.add(i);
    }
    // a new result that begins with all of the closed one before it: this phone repeats what it heard
    for (let k = 1; k < last.length && !repeats; k++) {
      const a = last[k - 1].alts[0];
      const b = last[k].alts[0];
      if (last[k - 1].final && a && b.length > a.length && b.startsWith(a)) repeats = true;
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
    const joined = parts.map((p) => p.alts[0]).join('');
    // a phrase the browser cut in two is matched whole too, and so is one begun before the last listening ended
    if (parts.length > 1) texts.push(joined);
    if (before && now - before.at < CARRY) texts.push(before.text + joined);
    try {
      if (api.onheard) api.onheard(texts, newest.final, newest.carried, newest.whole);
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

  // The browser ended a listening: begin again (hands-free, or while the button is held), at once unless it keeps
  // ending at once.
  function ended() {
    if (!wanted) {
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
