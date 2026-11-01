/* Yaoki: the header and footer every page of the website shares, and the light or dark choice.
 * Loaded in <head>, as a plain script (Yaoki Typing's check opens its page from a file, so no modules, no fetch):
 *   <script src="../site/site.js" data-root="../" data-page="reader" data-licences="licenses.txt"></script>
 * data-root is the path from the page to the site's root folder; data-page names the page in the nav (study, n1,
 * reader, typing); data-licences is the page's own licences file; data-app marks the Study and N1 pages, whose
 * 390 by 844 design is shown in a frame when the window is wide enough for a web page (see yk-app.js, fit()).
 * Before the first paint the script applies the saved theme and, on an app page, decides whether the page is laid
 * out as the website; when the document is ready it fills <header data-site-bar>, <footer data-site-foot> and
 * <div data-site-cards>. The theme is kept under localStorage 'yaoki.theme' ('light' or 'dark'; Auto keeps no key,
 * and nothing is written until the control is used), and a change is announced as the window event 'yaoki:theme'. */
(function () {
  'use strict';
  var me = document.currentScript;
  var ds = (me && me.dataset) || {};
  var ROOT = ds.root || './';
  var PAGE = ds.page || '';
  var LICENCES = ds.licences || 'licenses.txt';
  var IS_APP = 'app' in ds;
  var KEY = 'yaoki.theme';
  var root = document.documentElement;

  /* every app of Yaoki: the nav shows the pages of the website, the footer and the home page's cards show all five */
  var APPS = [
    { key: 'study', nav: 'Study', name: 'Yaoki', ja: 'やおき', path: '', tile: 'gold', glyph: '', line: 'The study app for JLPT N5 to N2: lessons, drills, writing, mock tests. Installs on a phone.' },
    { key: 'n1', nav: 'N1', name: 'Yaoki N1', ja: 'N1', path: 'n1/', tile: 'indigo', glyph: 'N1', line: 'The N1 course, planned to your exam date. An app of its own, with its own progress.' },
    { key: 'reader', nav: 'Reader', name: 'Yaoki Reader', ja: 'よむ', path: 'reader/', tile: 'paper', glyph: '読', line: 'Read Japanese with the furigana hidden. Touch a phrase to see its reading and meaning.' },
    { key: 'typing', nav: 'Typing', name: 'Yaoki Typing', ja: 'タイピング', path: 'typing/', tile: 'red', glyph: '打', line: 'A typing game for a computer with a Japanese (JIS) keyboard: kana, course words, kanji.' },
    { key: 'speaking', nav: null, name: 'Yaoki Speaking', ja: 'スピーキング', path: 'speaking/', tile: 'teal', glyph: '話', line: 'A game for a phone held upright: say the words out loud. It opens on its own.' }
  ];
  var DARUMA = '<path d="M50 6c26 0 40 20 40 46 0 24-16 42-40 42S10 76 10 52C10 26 24 6 50 6z" fill="#E2452B" stroke="#1B2440" stroke-width="2.6"/><ellipse cx="50" cy="42" rx="27" ry="23" fill="#FFF6EA" stroke="#1B2440" stroke-width="2"/><circle cx="39" cy="42" r="8" fill="#fff" stroke="#1B2440" stroke-width="2.5"/><circle cx="61" cy="42" r="8" fill="#fff" stroke="#1B2440" stroke-width="2.5"/><circle cx="61" cy="42" r="4.2" fill="#1B2440"/><path d="M28 30c6-5 14-5 19 0M53 30c5-5 13-5 19 0" stroke="#1B2440" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M44 55c4 3 8 3 12 0" stroke="#1B2440" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M38 74h24M42 82h16" stroke="#F2B43A" stroke-width="3.5" stroke-linecap="round"/>';
  var ICONS = {
    auto: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17A8.5 8.5 0 0 0 12 3.5z" fill="currentColor" stroke="none"/>',
    light: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
    dark: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>'
  };
  var WORDS = { auto: 'Auto', light: 'Light', dark: 'Dark' };
  var NEXT = { auto: 'light', light: 'dark', dark: 'auto' };

  /* ---------- the theme ---------- */
  function saved() {
    try { var v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : ''; } catch (e) { return ''; }
  }
  function theme() { return root.getAttribute('data-theme') || ''; }
  var metas = null;
  function colourBars() {
    /* the strip the browser draws above the page takes the ground colour of the theme in force; the app pages keep their own meta */
    if (IS_APP) return;
    if (!metas) metas = Array.prototype.map.call(document.querySelectorAll('meta[name="theme-color"]'), function (m) { return { el: m, was: m.getAttribute('content') }; });
    var forced = theme();
    var ground = forced ? getComputedStyle(root).getPropertyValue('--ground').trim() : '';
    metas.forEach(function (m) { m.el.setAttribute('content', forced && ground ? ground : m.was); });
  }
  function setTheme(v) {
    v = v === 'light' || v === 'dark' ? v : '';
    if (v) root.setAttribute('data-theme', v); else root.removeAttribute('data-theme');
    try { if (v) localStorage.setItem(KEY, v); else localStorage.removeItem(KEY); } catch (e) {}
    colourBars();
    drawTheme();
    try { window.dispatchEvent(new CustomEvent('yaoki:theme', { detail: { theme: v } })); } catch (e) {}
  }
  var first = saved();
  if (first) root.setAttribute('data-theme', first);

  /* an app page in a window wide enough for a web page is laid out as the website: decided here, before the first paint,
     and from then on by yk-app.js (fit()), with the same rule */
  function wantSite() {
    var standalone = navigator.standalone === true || !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    return !standalone && window.__ykHost !== 'artifact' && window.innerWidth >= 700 && window.innerHeight >= 560;
  }
  if (IS_APP && wantSite()) root.classList.add('yk-site');

  /* ---------- the header, the footer and the home page's cards ---------- */
  function h(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function href(app) { return ROOT + app.path; }
  function themeButton() {
    return '<button class="pill site-theme" type="button"></button>';
  }
  function drawTheme() {
    var now = theme() || 'auto';
    Array.prototype.forEach.call(document.querySelectorAll('.site-theme'), function (b) {
      b.innerHTML = '<svg class="site-theme-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[now] + '</svg><span>' + WORDS[now] + '</span>';
      b.setAttribute('aria-label', 'Theme: ' + WORDS[now] + '. Next: ' + WORDS[NEXT[now]]);
      b.title = 'Light or dark: ' + WORDS[now];
    });
  }
  function bar() {
    var nav = APPS.filter(function (a) { return a.nav; }).map(function (a) {
      return '<a href="' + h(href(a)) + '"' + (a.key === PAGE ? ' aria-current="page"' : '') + '>' + h(a.nav) + '</a>';
    }).join('');
    return '<div class="site-wrap">' +
      '<a class="site-brand" href="' + h(ROOT) + '" aria-label="Yaoki, home"><svg class="site-mark" viewBox="0 0 100 100" aria-hidden="true">' + DARUMA + '</svg><span class="site-word">Yaoki</span><span class="site-ja" lang="ja" aria-hidden="true">やおき</span></a>' +
      '<nav class="site-nav" aria-label="Yaoki apps">' + nav + '</nav>' +
      themeButton() +
      '</div>';
  }
  function foot() {
    var all = APPS.map(function (a) {
      return '<a href="' + h(href(a)) + '"' + (a.key === PAGE ? ' aria-current="page"' : '') + '>' + h(a.nav || 'Speaking') + '</a>';
    }).join('<i aria-hidden="true">·</i>');
    var version = window.__ykBuild ? '<p class="site-version">' + h(window.__ykBuild) + '</p>' : '';
    return '<div class="site-wrap">' +
      '<nav class="site-apps" aria-label="All of Yaoki">' + all + '</nav>' +
      '<p class="site-legal">JLPT is a trademark of the Japan Foundation and Japan Educational Exchanges and Services. Yaoki is not connected with them and holds no official test material; its lessons and texts were written for it. <a href="' + h(LICENCES) + '">Licences</a></p>' +
      version +
      '</div>';
  }
  function cards() {
    return APPS.filter(function (a) { return a.key !== PAGE; }).map(function (a) {
      var face = a.key === 'study' ? '<svg viewBox="0 0 100 100" aria-hidden="true">' + DARUMA + '</svg>' : /^[A-Za-z0-9]+$/.test(a.glyph) ? h(a.glyph) : '<span lang="ja">' + h(a.glyph) + '</span>';
      return '<a class="card app-card" href="' + h(href(a)) + '"><span class="tile tile-' + a.tile + '" aria-hidden="true">' + face + '</span><b>' + h(a.name) + '</b><span class="hint">' + h(a.line) + '</span></a>';
    }).join('');
  }
  function render() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-site-bar]'), function (el) { el.innerHTML = bar(); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-site-foot]'), function (el) { el.innerHTML = foot(); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-site-cards]'), function (el) { el.innerHTML = cards(); });
    drawTheme();
    colourBars();
  }
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('.site-theme') : null;
    if (!b) return;
    e.preventDefault();
    setTheme(NEXT[theme() || 'auto']);
  });
  /* a choice made on another page of the site, in another tab, is followed here */
  window.addEventListener('storage', function (e) {
    if (e.key === KEY && saved() !== theme()) setTheme(saved());
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();

  window.ykSite = { root: ROOT, page: PAGE, apps: APPS, theme: theme, setTheme: setTheme, render: render, wantSite: wantSite };
})();
