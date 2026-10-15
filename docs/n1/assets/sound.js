/* Yaoki prototype sound.
 * Plays the short spoken clips that sound-mock.js and sound-lessons.js register (MP3 as base64 text), and the
 * clips that audio/clips.js names as files (MP3 next to this script, fetched when first played).
 * Every screen works without it: when a clip or the browser's audio is missing, play() returns false
 * and the screen falls back to its silent waveform. on() lets a screen notice, a moment after play(),
 * that the browser accepted the clip but nothing is coming out, and at() tells it how far the clip
 * has really played, so a screen can keep time with the sound instead of guessing. */
(function () {
  var clips = window.__ykClips = window.__ykClips || {};
  /* clip files are found next to this script: the project folder on the canvas, assets/ in the app */
  var here = '';
  try { here = document.currentScript.src.replace(/[^/]*$/, ''); } catch (e) { here = ''; }
  var AC = window.AudioContext || window.webkitAudioContext;
  var ctx = null;
  var decoded = {};
  var current = null;
  var turn = 0;
  var gen = 0;          /* counts the audio outputs made: an answer that comes back for an old one is ignored */
  var failed = false;   /* this output could not decode a clip: stop offering sound until there is a new output */
  var stale = false;    /* the output may be dead (it went quiet, or a screen gave up on it): the next tap makes a new one */
  var ran = false;      /* this output has been seen running */
  var worked = false;   /* some output has been seen running since the page opened: this device can play sound */
  var mark = null;      /* the clip play() last started: whose turn it was, the audio clock's reading at the clip's own zero, and when it ended by itself */
  var probe = null;     /* where the audio clock stood when it was last looked at closely: wall clock and audio clock */
  var moved = false;    /* this output's clock has been seen to advance: sound is really coming out */

  function seen() {
    if (ctx && ctx.state === 'running') { ran = true; worked = true; }
  }

  /* give the audio output back to the phone; the next tap that wants sound makes a new one */
  function drop() {
    if (!ctx) return;
    gen++;
    if (current) { try { current.onended = null; current.stop(); } catch (e) {} }
    try {
      var closing = ctx.close();
      if (closing && typeof closing.catch === 'function') closing.catch(function () {});
    } catch (e) {}
    ctx = null;
    current = null;
    decoded = {};
    mark = null;
    probe = null;
    moved = false;
    ran = false;
    failed = false;
  }

  /* inside a tap, after a silence: start again with a new audio output */
  function renew() {
    if (stale) drop();
    stale = false;
  }

  function context() {
    if (!AC) return null;
    try {
      if (!ctx) {
        ctx = new AC();
        try { ctx.addEventListener('statechange', seen); } catch (e) {}
      }
      /* besides "suspended", iPhones report "interrupted" after a call or a spell in the background: both need waking */
      if (ctx.state !== 'running' && ctx.state !== 'closed') {
        var woke = ctx.resume();
        if (woke && typeof woke.catch === 'function') woke.catch(function () {});
      }
      seen();
    } catch (e) {
      return null;
    }
    return ctx;
  }

  function bytes(b64) {
    var text = atob(b64);
    var out = new Uint8Array(text.length);
    for (var i = 0; i < text.length; i++) out[i] = text.charCodeAt(i);
    return out.buffer;
  }

  function decode(key) {
    if (decoded[key]) return decoded[key];
    var c = context();
    var clip = clips[key];
    if (!c || !clip) return Promise.reject(new Error('no sound for ' + key));
    var mine = gen;
    /* a clip kept as a file is fetched first; a file that cannot be had (offline before it was stored) is not the output's fault */
    var fetched = clip.u ? fetch(here + clip.u).then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }) : null;
    if (fetched) fetched.catch(function () { if (mine === gen) delete decoded[key]; });
    var task = decoded[key] = (fetched || Promise.resolve(null)).then(function (buf) {
      return new Promise(function (ok, fail) {
        try {
          var p = c.decodeAudioData(buf || bytes(clip.b), ok, fail);
          if (p && typeof p.catch === 'function') p.catch(fail);
        } catch (e) {
          fail(e);
        }
      }).catch(function (e) {
        /* a failure to decode counts against the output that was asked, not against one made since */
        if (mine === gen) { delete decoded[key]; failed = true; }
        throw e;
      });
    });
    return task;
  }

  var api = window.ykSound = {
    /* is there a clip under this name, and a way to play it? An output that failed gets another try once it is due to be replaced */
    has: function (key) { return !!(AC && clips[key] && (!failed || stale)); },
    /* length of a clip in milliseconds, known before it is decoded */
    ms: function (key) { return clips[key] ? clips[key].ms : 0; },
    /* call from inside a tap: browsers only let sound start after one */
    unlock: function () { renew(); return !!context(); },
    /* is sound actually coming out? A browser can hold the audio back even after a tap, or fail to decode a clip.
       Ask while a clip should be playing, a moment after play(): the answer is yes once the output is running
       and its clock has been seen to move, and no again when the clock stands still */
    on: function () {
      if (!ctx || failed) return false;
      /* an output that was running and no longer is (a call, the lock screen) is replaced at the next tap */
      if (ctx.state !== 'running') { probe = null; moved = false; if (ran) stale = true; return false; }
      ran = true;
      worked = true;
      /* an iPhone can say "running" while its audio clock stands still and nothing is heard */
      var now = Date.now();
      if (!probe) probe = { wall: now, audio: ctx.currentTime };
      else if (ctx.currentTime - probe.audio > 0.05) { probe = { wall: now, audio: ctx.currentTime }; moved = true; }
      else if (now - probe.wall > 700) { moved = false; stale = true; return false; }
      return moved;
    },
    /* has sound come out at any time since the page opened? Then a silence now is an interruption, not a device without sound */
    worked: function () { return worked; },
    /* how far into its clip the sound is, in milliseconds by the audio's own clock, which stands still whenever
       nothing is heard; -1 until the clip that play() asked for has started */
    at: function () {
      if (!ctx || !mark || mark.turn !== turn) return -1;
      var ms = (ctx.currentTime - mark.audio) * 1000;
      return ms === ms ? Math.max(0, Math.round(ms)) : -1;
    },
    /* milliseconds since the clip that play() asked for came to its end by itself; -1 while it has not, or when it was stopped */
    over: function () { return mark && mark.turn === turn && mark.ended ? Math.max(0, Date.now() - mark.ended) : -1; },
    /* decode ahead of time so the first clip starts on the beat */
    ready: function (keys) {
      for (var i = 0; i < keys.length; i++) if (this.has(keys[i])) decode(keys[i]).catch(function () {});
    },
    /* start a clip, stopping whatever was playing; "from" skips that many milliseconds into it; false means it cannot be played */
    play: function (key, from) {
      var mine = ++turn;
      this.halt();
      if (!this.has(key)) return false;
      /* the clock is looked at afresh from here: it may have idled while nothing was playing */
      probe = null;
      var skip = from > 0 ? from / 1000 : 0;
      decode(key).then(function (buffer) {
        if (mine !== turn || !ctx) return;
        var node = ctx.createBufferSource();
        node.buffer = buffer;
        node.connect(ctx.destination);
        var started = mark = { turn: mine, audio: 0, ended: 0 };
        node.onended = function () {
          if (current === node) current = null;
          started.ended = Date.now();
        };
        current = node;
        var into = Math.min(skip, Math.max(0, (buffer.duration || 0) - 0.05));
        if (into > 0) node.start(0, into);
        else node.start();
        started.audio = ctx.currentTime - into;
        probe = { wall: Date.now(), audio: ctx.currentTime };
        seen();
      }).catch(function () {});
      return true;
    },
    halt: function () {
      if (!current) return;
      try { current.onended = null; current.stop(); } catch (e) {}
      current = null;
    },
    stop: function () {
      turn++;
      this.halt();
    },
    /* the screen has given up on this output (it paused, or waited in vain): the next tap makes a new one */
    retire: function () { stale = true; }
  };

  /* put aside (another app, the lock screen): nothing plays on to nobody, and the audio output is handed back,
     so the phone's other sound can go on and nothing of this page keeps running in the background.
     An iPhone can leave an output silent after such a spell anyway. */
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') { api.stop(); drop(); }
  });
})();
