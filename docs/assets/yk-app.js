/* Yaoki app
 * Everything the installed app needs around the screens: fitting the 390 by 844 design to the phone,
 * saved progress, the first-visit page that explains Add to Home Screen, and the iPhone's audio and
 * screen-lock quirks. The screens themselves are the design canvas's files (see yk-runtime.js). */
(function () {
  'use strict';
  var W = 390;
  var H = 844;
  var TOP = 50;   /* the design keeps its top 50 px empty for the status bar */
  var GAP = 8;    /* what is left of that zone when the system draws the status bar itself */
  var query = new URLSearchParams(location.search);
  var LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  /* test hooks, on a developer's machine only: the start state comes from the address, and nothing is saved */
  var TEST = LOCAL && query.has('yktest');
  var view = document.getElementById('yk-view');
  var stage = document.getElementById('yk-stage');
  var root = document.documentElement;
  /* "artifact": the same app shown as a page inside Claude, where nothing can be installed or stored for offline use */
  var HOSTED = window.__ykHost === 'artifact';
  if (HOSTED) root.classList.add('yk-hosted');
  var fluid = false;
  /* saved data is kept per copy of the app: two copies under one web address must not share or delete each other's */
  var HOME = location.pathname.replace(/[^/]*$/, '');
  var KEY = 'yaoki.v1:' + HOME;

  /* the first screen appears once its typeface is in (so the text does not jump), or after a moment at the latest */
  var shown = false;
  function reveal() { if (!shown) { shown = true; root.classList.add('yk-ready'); } }
  setTimeout(reveal, 900);

  /* ---------- saved progress ---------- */
  var canSave = false;
  try {
    localStorage.setItem(KEY + '.probe', '1');
    localStorage.removeItem(KEY + '.probe');
    canSave = true;
  } catch (e) { canSave = false; }
  var lastSaved = '';

  /* the writing practice's memory: the kanji written three times (one string of them) and the words written out */
  function wroteOk(x) {
    return typeof x === 'string' ? Array.from(x).filter(function (c, i, all) { return /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3005]/.test(c) && all.indexOf(c) === i; }).join('') : '';
  }
  function wordsOk(x) {
    return Array.isArray(x) ? x.filter(function (w, i, all) { return typeof w === 'string' && w && w.length <= 16 && all.indexOf(w) === i; }) : [];
  }
  function load() {
    if (!canSave) return null;
    try {
      var s = JSON.parse(localStorage.getItem(KEY) || 'null');
      return s && typeof s === 'object' ? s : null;
    } catch (e) { return null; }
  }
  var C = window.ykCourse;
  function obj(x) { return x && typeof x === 'object' && !Array.isArray(x) ? x : null; }
  function dateOk(d) { return typeof d === 'string' && /^\d{4}-\d\d-\d\d$/.test(d); }
  /* a mistake from version 0.1, saved under the name of the screen it came from */
  var OLD = { drill: 'u03d4.d1', star: 'u03d4.d2', exam1: 'u03d4.e1', exam2: 'u03d4.e2', exam3: 'u03d4.e3', scene: 'u03d4.k1', reading: 'u03d4.r1' };
  function start() {
    var s = C.fresh();
    var from = null;
    if (TEST) {
      var json = function (name, fallback) { try { return JSON.parse(query.get(name) || 'null') || fallback; } catch (e) { return fallback; } };
      s.screen = query.get('screen') || 'Goal';
      from = { started: s.screen !== 'Goal', plan: json('plan', null), done: json('done', {}), tests: json('tests', {}), mistakes: json('m', []), mock: json('mock', null), level: query.get('level'), plans: json('plans', {}), cur: query.get('cur'), tp: +(query.get('tp') || 0), set: query.get('set') || 'day', wrote: query.get('wrote') || '', wroteWords: json('words', []) };
      if (from.started && !from.plan) from.plan = { start: C.today(C.now()), exam: '2026-12-06', pace: 'fit' };
      if (query.get('now')) window.__ykNow = +query.get('now');
    } else {
      from = load();
      if (from && from.started) s.screen = 'Main';
    }
    if (from) {
      s.started = !!from.started;
      var planOk = function (p) { p = obj(p); return p && dateOk(p.start) && dateOk(p.exam) ? { start: p.start, exam: p.exam, pace: p.pace === 'steady' ? 'steady' : 'fit', minutes: p.minutes || 30 } : null; };
      s.plan = planOk(from.plan);
      /* the level the learner is on (saves from before there were several levels are N2), and the plans of the others */
      var levels = {};
      C.levels().forEach(function (x) { levels[x.level] = x.ready; });
      s.level = typeof from.level === 'string' && levels[from.level] ? from.level : s.started ? 'N2' : null;
      s.plans = {};
      Object.keys(obj(from.plans) || {}).forEach(function (k) { if (levels[k] && planOk(from.plans[k])) s.plans[k] = planOk(from.plans[k]); });
      C.setLevel(s.level || 'N2');
      s.done = obj(from.done) || {};
      s.tests = obj(from.tests) || {};
      s.mistakes = (Array.isArray(from.mistakes) ? from.mistakes : []).map(function (m) {
        if (!m || typeof m.src !== 'string') return null;
        var src = OLD[m.src] || m.src;
        if (!C.item(src)) return null;
        return { src: src, wrong: String(m.wrong || ''), at: +m.at || C.now(), step: +m.step || 0, due: dateOk(m.due) ? m.due : C.today(C.now()), cleared: !!m.cleared, last: m.last || '' };
      }).filter(Boolean);
      s.mock = obj(from.mock) && from.mock.done ? from.mock : null;
      s.mocks = {};
      Object.keys(obj(from.mocks) || {}).forEach(function (k) { var m = from.mocks[k]; if (levels[k] && obj(m) && m.done) s.mocks[k] = m; });
      if (typeof from.cur === 'string' && C.session(from.cur)) s.cur = from.cur;
      s.tp = from.tp === 1 ? 1 : 0;
      s.set = from.set === 'test' ? 'test' : 'day';
      s.wrote = wroteOk(from.wrote);
      s.wroteWords = wordsOk(from.wroteWords);
      /* version 0.1 kept one sample day as g, k, r and had no plan */
      if (s.started && !s.plan) s.plan = { start: C.today(C.now()), exam: '2026-12-06', pace: 'fit', minutes: 30 };
      if (from.g != null && !obj(from.done)) s.done = { u03d4: { g: +from.g || 0, k: +from.k || 0, r: +from.r || 0 } };
    }
    if (!window.YK.has(s.screen)) s.screen = s.started ? 'Main' : 'Goal';
    return s;
  }
  function remember(s) {
    if (TEST || !canSave) return;
    /* a second attempt at the mini mock that is still open is not a result yet */
    var keep = { v: 2, started: !!s.started, level: s.level || null, plans: s.plans || {}, mocks: s.mocks || {}, plan: s.plan, cur: s.cur, done: s.done, tests: s.tests, mistakes: s.mistakes, mock: s.mock && s.mock.again ? Object.assign({}, s.mock, { again: false }) : s.mock, wrote: s.wrote || '', wroteWords: s.wroteWords || [] };
    var text = JSON.stringify(keep);
    keepLevelSound(s.level);
    if (text === lastSaved) return;
    try { localStorage.setItem(KEY, text); lastSaved = text; } catch (e) { canSave = false; }
  }
  /* the offline copy stores each level's sound only once that level is chosen (see sw.js) */
  var soundAsked = '';
  function keepLevelSound(level) {
    var lv = String(level || '').toLowerCase();
    if (!/^n[345]$/.test(lv) || lv === soundAsked) return;
    try {
      var sw = navigator.serviceWorker && navigator.serviceWorker.controller;
      if (sw) { sw.postMessage({ keepLevel: lv }); soundAsked = lv; }
    } catch (e) {}
  }
  function forget() {
    lastSaved = '';
    try { localStorage.removeItem(KEY); } catch (e) {}
  }

  /* ---------- fit the design to the screen ---------- */
  function fit() {
    var vw = view.clientWidth;
    var vh = Math.min(view.clientHeight, window.innerHeight || view.clientHeight);
    if (!vw || !vh) return;
    var s = vw / W;
    var need = H * s;   /* the height the whole design takes at full width */
    var sx = s;
    var sy = s;
    var tx = 0;
    var ty = 0;
    var boxed = false;
    if (fluid) {
      /* the Add to Home Screen page: full width, as tall as the browser leaves */
      sx = sy = Math.min(s, 1.25);
      stage.style.height = Math.round(vh / sx) + 'px';
      tx = (vw - W * sx) / 2;
    } else {
      stage.style.height = H + 'px';
      if (Math.abs(vh / need - 1) <= 0.02) {
        /* phones with a notch are all within half a percent of the design's shape: stretch to fill exactly */
        sy = vh / H;
      } else if (need > vh && (need - vh) / s <= TOP - GAP + 0.03 * H) {
        /* the screen is shorter by about a status bar, because the system keeps that strip for itself:
           leave out the design's own empty top zone instead of shrinking everything.
           When the strip is taller than the zone, the rest is taken up by a squeeze of at most 3%. */
        var crop = Math.min(TOP - GAP, (need - vh) / s);
        sy = vh / (H - crop);
        ty = -crop * sy;
      } else if (need > vh && vw <= 520) {
        /* a much shorter screen (an older phone, a browser with its bars): the design cannot keep the full width.
           Its empty top zone is left out here too, and the rest is as large as the height allows, centred */
        sx = sy = vh / (H - (TOP - GAP));
        tx = (vw - W * sx) / 2;
        ty = -(TOP - GAP) * sy;
      } else {
        /* any other shape (a tablet, a laptop window, a very tall screen): the whole design, in proportion, centred */
        sx = sy = Math.min(s, vh / H);
        tx = (vw - W * sx) / 2;
        ty = (vh - H * sy) / 2;
        boxed = true;
      }
    }
    stage.style.transform = 'translate(' + tx.toFixed(2) + 'px,' + ty.toFixed(2) + 'px) scale(' + sx.toFixed(5) + ',' + sy.toFixed(5) + ')';
    root.classList.toggle('yk-boxed', boxed && vw > 520);
    /* a phone held sideways: the design is upright only, so say so instead of showing it tiny */
    var sideways = !fluid && boxed && vw > vh && vh < 560 && window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    root.classList.toggle('yk-sideways', !!sideways);
  }
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', function () { setTimeout(fit, 60); setTimeout(fit, 400); });
  window.addEventListener('pageshow', fit);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fit);
  if (window.ResizeObserver) new ResizeObserver(fit).observe(view);
  /* an iPhone can report the height of the screen late when the app opens from the Home Screen */
  setTimeout(fit, 120);
  setTimeout(fit, 600);

  /* ---------- iPhone audio and screen lock ---------- */
  /* Sound made with Web Audio is treated as a ring tone unless the page says it is playback:
     without this the silent switch mutes the listening questions. */
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}

  /* keep the screen awake where the learner listens without touching it */
  var AWAKE = { MockRun: 1, Listening: 1, Review: 1 };
  var wantAwake = false;
  var lock = null;
  var asking = false;
  function syncLock() {
    if (!navigator.wakeLock || !navigator.wakeLock.request) return;
    if (wantAwake && !lock && !asking && document.visibilityState === 'visible') {
      asking = true;
      navigator.wakeLock.request('screen').then(function (l) {
        asking = false;
        lock = l;
        l.addEventListener('release', function () { if (lock === l) lock = null; });
        if (!wantAwake) syncLock();
      }).catch(function () { asking = false; });
    } else if (!wantAwake && lock) {
      var old = lock;
      lock = null;
      old.release().catch(function () {});
    }
  }
  document.addEventListener('visibilitychange', syncLock);

  /* ---------- a newer copy of the app ---------- */
  var screenNow = '';
  var updateReady = false;
  var restarting = false;
  var touched = false;
  document.addEventListener('pointerdown', function () { touched = true; }, true);
  document.addEventListener('keydown', function () { touched = true; }, true);
  /* Switch to a newer stored copy at a quiet moment only: on the week path or the goal screen, never in a
     lesson or a mock. Just after opening it may happen before anything was tapped; later it waits for the
     next return to the week path, and not at all if progress could not be saved across the restart. */
  function restartIfUpdated(justOpened) {
    if (!updateReady || restarting) return;
    if (screenNow !== 'Main' && screenNow !== 'Goal' && screenNow !== '') return;
    if (justOpened ? touched : !canSave) return;
    restarting = true;
    location.reload();
  }
  /* the strip the system draws for its status bar takes the page's theme colour: ink above the mock's ink band */
  var theme = document.querySelector('meta[name="theme-color"]');
  function onScreen(name) {
    var arrived = name !== screenNow;
    screenNow = name;
    wantAwake = !!AWAKE[name];
    syncLock();
    if (theme && arrived) theme.setAttribute('content', name === 'MockRun' ? '#1B2440' : '#F4F5F9');
    if (arrived) restartIfUpdated(false);
  }

  /* a link to another screen file means nothing here: if a screen did not handle the tap, swallow it */
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (a && !e.defaultPrevented && /\.dc\.html?([?#].*)?$/.test(a.getAttribute('href') || '')) e.preventDefault();
  });
  /* no pinch zoom, no double-tap zoom: the design already fills the screen */
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
  document.addEventListener('dblclick', function (e) { e.preventDefault(); });

  /* ---------- which page to open ---------- */
  var standalone = navigator.standalone === true || !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  var ua = navigator.userAgent || '';
  var iPad = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  var iPhone = /iPhone|iPod/.test(ua);
  var skipInstall = TEST || HOSTED || (LOCAL && query.has('browser'));
  try { if (sessionStorage.getItem(KEY + '.browser')) skipInstall = true; } catch (e) {}
  var wantInstall = ((iPhone || iPad) && !standalone && !skipInstall) || (LOCAL && query.has('install'));

  function show(name) {
    fluid = name === 'Install';
    root.classList.toggle('yk-fluid', fluid);
    preact.render(null, stage);
    fit();
    window.YK.mount(name, {}, stage);
  }

  /* whether this copy can be kept for offline use is only known once the browser has been asked (further down) */
  var offline = 'never';
  window.ykApp = {
    version: (window.__ykBuild || 'development build'),
    standalone: standalone,
    hosted: HOSTED,
    device: iPad ? 'iPad' : iPhone ? 'iPhone' : 'device',
    start: start,
    remember: remember,
    forget: forget,
    saving: function () { return canSave && !TEST; },
    /* 'yes' once every file of the app is stored on the device, 'no' until then, 'never' where that cannot happen */
    offline: function () { return offline; },
    onScreen: onScreen,
    useBrowser: function () {
      try { sessionStorage.setItem(KEY + '.browser', '1'); } catch (e) {}
      show('Shell');
    },
  };

  try {
    show(wantInstall ? 'Install' : 'Shell');
  } catch (e) {
    console.error('[yaoki] could not start', e);
    stage.textContent = 'Yaoki could not start. Close the app and open it again.';
    reveal();
  }
  try {
    document.fonts.load("800 16px 'M PLUS Rounded 1c'", '目標').then(function () { return document.fonts.load("500 16px 'M PLUS Rounded 1c'", 'Yaoki'); }).then(reveal, reveal);
  } catch (e) { reveal(); }

  /* ---------- offline copy ---------- */
  if ('serviceWorker' in navigator && !TEST && !HOSTED && (location.protocol === 'https:' || (LOCAL && query.has('sw')))) {
    var hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      /* the very first install is not an update */
      if (hadController) {
        updateReady = true;
        if (performance.now() < 5000) restartIfUpdated(true);
      }
      hadController = true;
    });
    offline = 'no';
    navigator.serviceWorker.ready.then(function () { offline = 'yes'; }).catch(function () {});
    var register = function () {
      navigator.serviceWorker.register('./sw.js').then(function (reg) {
        /* look for a newer copy each time the app comes back to the front */
        document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') reg.update().catch(function () {}); });
      }).catch(function () {
        /* the browser refused (private browsing, for one): say nothing about offline use rather than promise it */
        if (offline === 'no') offline = 'never';
      });
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register);
  }
})();
