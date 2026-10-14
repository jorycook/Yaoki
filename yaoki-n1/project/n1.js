/* Yaoki N1: the study plan, and what the screens show from the content bank.
 * n1-content.js (made by tools/build-content.mjs from content/) holds the bank: the grammar units and their 48
 * lessons (3 patterns, 5 words, a reading item and a listening item each), the 1,113 kanji, the mini mocks.
 * This file turns the learner's exam date and daily minutes into a plan of days, keeps each day's progress,
 * and builds the questions of the kanji quiz, the week tests and the notebook from the bank. Every screen of
 * the N1 app reads the plan through it; the plan itself lives in the app's saved state (app.plan). */
(function () {
  'use strict';
  var B = window.__ykN1 || { units: [], lessons: [], kanji: [], mocks: [] };

  /* ---------- dates: ISO strings (2026-12-06), counted in whole days ---------- */
  var DAY = 86400000;
  function iso(t) { return new Date(t).toISOString().slice(0, 10); }
  function ms(d) { var p = d.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
  function add(d, n) { return iso(ms(d) + n * DAY); }
  function diff(a, b) { return Math.round((ms(b) - ms(a)) / DAY); }
  /* today on this device; a test (on a developer's machine) can set it with ?ykdate=2026-10-14 */
  function today() {
    if (window.__ykToday) return window.__ykToday;
    try {
      var q = new URLSearchParams(location.search).get('ykdate');
      if (q && /^\d{4}-\d\d-\d\d$/.test(q) && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return q;
    } catch (e) { /* no address to read */ }
    var n = new Date();
    return iso(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
  }
  var WD_JA = '日月火水木金土';
  var WD_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MON_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function parts(d) { var t = new Date(ms(d)); return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), w: t.getUTCDay() }; }
  var fmt = {
    ja: function (d) { var p = parts(d); return p.y + '年' + p.m + '月' + p.d + '日（' + WD_JA[p.w] + '）'; },
    md: function (d) { var p = parts(d); return p.m + '月' + p.d + '日（' + WD_JA[p.w] + '）'; },
    en: function (d) { var p = parts(d); return WD_EN[p.w] + ' ' + p.d + ' ' + MON_EN[p.m - 1] + ' ' + p.y; },
    short: function (d) { var p = parts(d); return p.d + ' ' + MON_EN[p.m - 1].slice(0, 3); },
  };

  /* the JLPT is held on the first Sunday of July and of December; the coming sessions a plan can aim at.
     Only the date of the next December session is announced as this app is made */
  var ANNOUNCED = { '2026-12-06': true };
  function firstSunday(y, m) { var t = Date.UTC(y, m - 1, 1); var w = new Date(t).getUTCDay(); return iso(t + ((7 - w) % 7) * DAY); }
  function sessions(from) {
    from = from || today();
    var y = +from.slice(0, 4);
    var out = [];
    for (var yy = y; yy <= y + 2 && out.length < 3; yy++) {
      [7, 12].forEach(function (m) {
        var d = firstSunday(yy, m);
        /* at least two weeks to prepare */
        if (diff(from, d) >= 14 && out.length < 3) out.push({ date: d, announced: !!ANNOUNCED[d], ja: yy + '年' + m + '月', en: MON_EN[m - 1] + ' ' + yy });
      });
    }
    return out;
  }

  /* ---------- the bank, in teaching order ---------- */
  var LESSONS = B.lessons;
  var WORDS = [];   /* every lesson's five words, in lesson order: { li, i } */
  LESSONS.forEach(function (l, li) { (l.vocab || []).forEach(function (_, i) { WORDS.push({ li: li, i: i }); }); });
  function lessonIndex(id) { for (var i = 0; i < LESSONS.length; i++) if (LESSONS[i].id === id) return i; return -1; }
  function word(wi) { var x = WORDS[wi]; return x ? LESSONS[x.li].vocab[x.i] : null; }
  function unitOf(li) { var l = LESSONS[li]; return l ? B.units[l.unit - 1] : null; }

  /* ---------- the plan ----------
     From the first study day to the day before the exam, in weeks of 7 days: 6 study days, then a week test.
     Content comes in five streams, each in its own order: grammar lessons, kanji, words, reading, listening.
     A day's share is set by the daily minutes, with these estimates of what each item takes */
  var COST = { g: 25, k: 1, w: 1.5, r: 6, l: 3 };
  /* the rest of the daily time goes to the notebook's review */
  var USE = 0.85;
  function streamSizes() { return { g: LESSONS.length, k: B.kanji.length, w: WORDS.length, r: LESSONS.length, l: LESSONS.length }; }
  function total(n) { return n.g * COST.g + n.k * COST.k + n.w * COST.w + n.r * COST.r + n.l * COST.l; }

  /* the calendar of a plan: each date and whether it is a study day or a week test */
  function calendar(start, exam) {
    var out = [];
    var n = diff(start, exam);
    for (var i = 0; i < n; i++) out.push({ d: add(start, i), t: i % 7 === 6 ? 1 : 0, wk: Math.floor(i / 7) + 1 });
    return out;
  }

  /* lay out what is left of each stream over the study days given. Returns the coverage and the days filled in.
     left: { g: [lesson indices], k: [kanji indices], w: [word indices], r: [...], l: [...] } in teaching order */
  function fill(days, left, pace) {
    var study = days.filter(function (x) { return x.t === 0; });
    var S = study.length;
    var need = left.g.length * COST.g + left.k.length * COST.k + left.w.length * COST.w + left.r.length * COST.r + left.l.length * COST.l;
    var per = pace * USE;
    /* the days the content needs at this pace; a tenth of the plan (up to 12 days) is kept for review before the
       exam when the plan is long enough */
    var reserve = S >= 20 ? Math.min(12, Math.round(S * 0.1)) : 0;
    var learn = Math.max(1, Math.min(S - reserve, Math.ceil(need / per)));
    if (S === 0) learn = 0;
    /* what fits: everything, or the same share of every stream when time is short */
    var f = learn ? Math.min(1, (learn * per) / Math.max(1, need)) : 0;
    var take = function (arr, cap) { return arr.slice(0, Math.min(cap, f >= 1 ? arr.length : Math.round(arr.length * f))); };
    var g = take(left.g, learn), r = take(left.r, learn), l = take(left.l, learn), k = take(left.k, 1e9), w = take(left.w, 1e9);
    study.forEach(function (x, j) {
      x.g = -1; x.r = -1; x.l = -1; x.k = []; x.w = [];
      x.t = j < learn ? 0 : 2;
    });
    var spread = function (items, key, shift) {
      items.forEach(function (it, j) { var at = Math.min(learn - 1, Math.floor(((j + shift) * learn) / items.length)); study[at][key] = it; });
    };
    var ranges = function (items, key) {
      for (var j = 0; j < learn; j++) study[j][key] = items.slice(Math.floor((j * items.length) / learn), Math.floor(((j + 1) * items.length) / learn));
    };
    if (learn) {
      spread(g, 'g', 0);
      /* reading and listening fall between the grammar days when there are fewer of them than days */
      spread(r, 'r', g.length < learn ? 0.5 : 0);
      spread(l, 'l', g.length < learn ? 0.25 : 0);
      ranges(k, 'k');
      ranges(w, 'w');
    }
    return { learn: learn, f: f, g: g.length, k: k.length, w: w.length, r: r.length, l: l.length };
  }

  function range(n) { var a = []; for (var i = 0; i < n; i++) a.push(i); return a; }

  /* a new plan: from start (the first study day) to the day before the exam, at pace minutes a day */
  function make(o) {
    var days = calendar(o.start, o.exam);
    var n = streamSizes();
    var cov = fill(days, { g: range(n.g), k: range(n.k), w: range(n.w), r: range(n.r), l: range(n.l) }, o.pace);
    days.forEach(function (x) { x.p = {}; });
    return { v: 1, start: o.start, exam: o.exam, pace: o.pace, set: o.set || today(), days: days, cov: cov, of: n, open: null, tests: {}, mocks: {} };
  }

  /* what a day's part counts as done: grammar at 3 (learn, drill, exam-style), the others at 1 */
  function done(x) {
    if (!x) return false;
    if (x.t === 1) return !!(x.p && x.p.t);
    if (x.t === 2) return !!(x.p && x.p.v);
    var p = x.p || {};
    return (x.g < 0 || p.g >= 3) && (!x.k.length && !x.w.length || p.k >= 1) && (x.r < 0 || p.r >= 1) && (x.l < 0 || p.l >= 1);
  }
  function started(x) { var p = x && x.p; return !!(p && (p.g || p.k || p.r || p.l || p.t || p.v)); }

  /* a new exam date or daily time: the days before today stay as they are; from today on, what is not done yet
     is laid out again over the days left */
  function replan(plan, o) {
    var t = today();
    var keep = plan.days.filter(function (x) { return x.d < t || started(x); });
    var from = keep.length ? add(keep[keep.length - 1].d, 1) : plan.start;
    if (from < t) from = t;
    var doneSet = function (key) {
      var s = {};
      keep.forEach(function (x) {
        var p = x.p || {};
        var did = key === 'g' ? p.g >= 3 : key === 'r' ? p.r : key === 'l' ? p.l : p.k;
        if (!did) return;
        if (key === 'k' || key === 'w') (x[key] || []).forEach(function (i) { s[i] = 1; });
        else if (x[key] >= 0) s[x[key]] = 1;
      });
      return s;
    };
    var n = streamSizes();
    var left = {};
    ['g', 'k', 'w', 'r', 'l'].forEach(function (key) { var s = doneSet(key); left[key] = range(n[key]).filter(function (i) { return !s[i]; }); });
    /* the days kept but not finished give back what was not done */
    keep.forEach(function (x) {
      if (x.t !== 0) return;
      var p = x.p || {};
      if (!(p.g >= 3)) x.g = -1;
      if (!p.r) x.r = -1;
      if (!p.l) x.l = -1;
      if (!p.k) { x.k = []; x.w = []; }
    });
    var exam = o.exam || plan.exam;
    var pace = o.pace || plan.pace;
    var start = keep.length ? plan.start : from;
    var rest = calendar(start, exam).filter(function (x) { return x.d >= from; });
    var cov = fill(rest, left, pace);
    rest.forEach(function (x) { x.p = {}; });
    var days = keep.concat(rest);
    var sum = function (key) { var c = 0; days.forEach(function (x) { if (x.t === 0) c += key === 'k' || key === 'w' ? x[key].length : x[key] >= 0 ? 1 : 0; }); return c; };
    cov = { learn: cov.learn, f: cov.f, g: sum('g'), k: sum('k'), w: sum('w'), r: sum('r'), l: sum('l') };
    var out = JSON.parse(JSON.stringify(plan));
    out.exam = exam; out.pace = pace; out.start = start; out.days = days; out.cov = cov; out.set = t;
    return out;
  }

  /* what the goal screen shows before the plan is made: its length and how much of the content it covers */
  function preview(o) {
    var p = make(o);
    var study = p.days.filter(function (x) { return x.t !== 1; }).length;
    var lastLearn = -1;
    p.days.forEach(function (x, i) { if (x.t === 0 && (x.g >= 0 || x.k.length || x.w.length || x.r >= 0 || x.l >= 0)) lastLearn = i; });
    return {
      weeks: Math.ceil(p.days.length / 7),
      days: p.days.length,
      study: study,
      cov: p.cov,
      of: p.of,
      all: p.cov.f >= 1,
      /* the week by which every lesson has been met; after it, review until the exam */
      doneWeek: lastLearn >= 0 ? Math.floor(lastLearn / 7) + 1 : 0,
      perDay: { k: Math.round(p.cov.k / Math.max(1, p.cov.learn)), w: Math.round((p.cov.w / Math.max(1, p.cov.learn)) * 10) / 10 },
    };
  }

  /* the day to work on: the first one not done, or the last day */
  function current(plan) {
    for (var i = 0; i < plan.days.length; i++) if (!done(plan.days[i])) return i;
    return plan.days.length - 1;
  }
  /* a copy of the plan with a day's progress raised (never lowered) */
  function mark(plan, i, patch) {
    var out = JSON.parse(JSON.stringify(plan));
    var p = out.days[i].p || (out.days[i].p = {});
    Object.keys(patch).forEach(function (k) { p[k] = typeof patch[k] === 'number' ? Math.max(p[k] || 0, patch[k]) : patch[k]; });
    return out;
  }
  function withOpen(plan, i) { var out = JSON.parse(JSON.stringify(plan)); out.open = i; return out; }
  /* the day the lesson screens show: the one opened on the path, or else the day to work on */
  function openDay(plan) { return plan && plan.open != null && plan.days[plan.open] ? plan.open : current(plan); }
  /* where today's date falls in the plan: -1 before its first day, the last day once the exam is near */
  function todayIndex(plan, t) { var n = diff(plan.days[0].d, t || today()); return n < 0 ? -1 : Math.min(n, plan.days.length - 1); }
  /* the days stamped done */
  function stamps(plan) { return plan.days.filter(done).length; }
  /* a copy of the plan with a result kept: kind "tests" (by week) or "mocks" (by mock id) */
  function result(plan, kind, id, r) { var out = JSON.parse(JSON.stringify(plan)); (out[kind] || (out[kind] = {}))[id] = r; return out; }

  /* ---------- a day, as the screens show it ---------- */
  function titleOf(li) { var l = LESSONS[li]; return l ? l.grammar.patterns.map(function (p) { return p.p; }).join('・') : ''; }
  function view(plan, i) {
    var x = plan.days[i];
    if (!x) return null;
    var wk = Math.floor(i / 7) + 1;
    var dow = (i % 7) + 1;
    var p = x.p || {};
    var v = {
      i: i, d: x.d, wk: wk, dow: dow, kind: ['study', 'test', 'review'][x.t], p: p,
      date: fmt.md(x.d), done: done(x), started: started(x),
      grammar: x.g >= 0 ? LESSONS[x.g] : null, gi: x.g,
      kanji: (x.k || []).map(function (k) { return B.kanji[k]; }), ki: x.k || [],
      words: (x.w || []).map(word), wi: x.w || [],
      reading: x.r >= 0 ? LESSONS[x.r] : null, ri: x.r,
      listening: x.l >= 0 ? LESSONS[x.l] : null, li: x.l,
    };
    v.title = x.t === 1 ? '週テスト' : x.t === 2 ? '復習' : v.grammar ? titleOf(x.g) : v.kanji.length ? '漢字 ' + v.kanji.length + (v.words.length ? '・語彙 ' + v.words.length : '') : v.words.length ? '語彙 ' + v.words.length : v.reading ? '読解' : '聴解';
    v.unit = v.grammar ? B.units[v.grammar.unit - 1] : null;
    return v;
  }
  /* the theme of a week: the grammar unit most of its lessons come from */
  function weekTheme(plan, wk) {
    var count = {};
    var best = null;
    for (var i = (wk - 1) * 7; i < Math.min(plan.days.length, wk * 7); i++) {
      var x = plan.days[i];
      if (x.t === 0 && x.g >= 0) { var u = LESSONS[x.g].unit; count[u] = (count[u] || 0) + 1; if (!best || count[u] > count[best]) best = u; }
    }
    if (best) return B.units[best - 1];
    var anyReview = false;
    for (var j = (wk - 1) * 7; j < Math.min(plan.days.length, wk * 7); j++) if (plan.days[j].t === 2) anyReview = true;
    return anyReview ? { ja: '総復習', en: 'Review before the exam' } : { ja: '漢字・語彙', en: 'Kanji and words' };
  }

  /* ---------- Japanese text with markup: 【mark】 and 漢字《よみ》 ---------- */
  function segs(text) {
    var out = [];
    var on = false;
    String(text || '').split(/(【|】)/).forEach(function (chunk) {
      if (chunk === '【') { on = true; return; }
      if (chunk === '】') { on = false; return; }
      var re = /([一-鿿々〆ヶ]+)《([^》]+)》/g;
      var at = 0, m;
      while ((m = re.exec(chunk))) {
        if (m.index > at) out.push({ t: chunk.slice(at, m.index), r: '', mark: on });
        out.push({ t: m[1], r: m[2], mark: on });
        at = m.index + m[0].length;
      }
      if (at < chunk.length) out.push({ t: chunk.slice(at), r: '', mark: on });
    });
    return out.map(function (s) { return { t: s.t, r: s.r, mark: s.mark, plain: !s.r, ruby: !!s.r, hl: s.mark ? '#FFE9B0' : 'transparent', pad: s.mark ? '0 3px' : '0' }; });
  }
  function plain(text) { return String(text || '').replace(/《[^》]*》/g, '').replace(/[【】]/g, ''); }
  /* a sentence with its blank as a gap the screens draw: [{t}, {blank: true}, {t}] */
  function blanks(text) {
    return plain(text).split('（　　）').reduce(function (acc, t, i) { if (i) acc.push({ blank: true, text: false, t: '' }); if (t) acc.push({ text: true, blank: false, t: t }); return acc; }, []);
  }

  /* a fixed shuffle: the same order every time for the same key, so options and tiles never jump about.
     tiles: never the answer order itself, which would give a sentence-order question away */
  function order(n, key, tiles) {
    /* FNV-1a over the key, then a xorshift: the high bits are well mixed */
    var h = 2166136261;
    for (var c = 0; c < key.length; c++) { h ^= key.charCodeAt(c); h = Math.imul(h, 16777619) >>> 0; }
    var a = range(n);
    for (var i = n - 1; i > 0; i--) {
      h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0;
      var j = h % (i + 1);
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    /* never the answer order itself */
    if (tiles && a.every(function (v, k) { return v === k; })) a.push(a.shift());
    return a;
  }

  /* ---------- questions ---------- */
  /* a reading question for a kanji word: its reading and three wrong ones (more from other words when the
     dictionary data gives fewer than three) */
  function readingQ(ki, wj, salt) {
    var k = B.kanji[ki];
    var w = k && k.w[wj];
    if (!w) return null;
    var wrong = w.x.slice(0, 3);
    for (var s = 1; wrong.length < 3 && s < 60; s++) {
      var o = B.kanji[(ki + s * 7) % B.kanji.length].w[0];
      if (o && o.r !== w.r && wrong.indexOf(o.r) < 0 && Math.abs(o.r.length - w.r.length) <= 1) wrong.push(o.r);
    }
    var opts = [w.r].concat(wrong);
    var ord = order(4, w.w + (salt || ''));
    return { src: 'k.' + ki + '.' + wj, type: '漢字読み', word: w.w, options: ord.map(function (n) { return opts[n]; }), answer: ord.indexOf(0) + 1, en: w.en, kanji: k.c, why: w.w + ' is read ' + w.r + ': ' + w.en + '.' };
  }
  /* the kanji quiz of a day: up to max reading questions, one word per kanji, spread over the day's kanji */
  function kanjiQuiz(plan, i, max) {
    var ki = plan.days[i].k || [];
    var qs = [];
    var step = Math.max(1, Math.floor(ki.length / (max || 8)));
    for (var j = 0; j < ki.length && qs.length < (max || 8); j += step) {
      var k = B.kanji[ki[j]];
      /* prefer a word with three wrong readings of its own */
      var wj = 0;
      for (var n = 0; n < k.w.length; n++) if (k.w[n].x.length >= 3) { wj = n; break; }
      var q = readingQ(ki[j], wj, 'd' + i);
      if (q) qs.push(q);
    }
    return qs;
  }
  /* a word's own question, in the shape the quiz and the notebook use */
  function wordQ(wi) {
    var x = WORDS[wi];
    if (!x) return null;
    var v = LESSONS[x.li].vocab[x.i];
    var q = v.q;
    return { src: 'w.' + wi, type: q.type, ja: q.ja || '', word: v.w, options: q.options, answer: q.answer, why: q.why, usage: q.type === '用法' };
  }
  /* a grammar question of a lesson: drill n (d0 to d2) or exam-style n (x0 to x2) */
  function grammarQ(li, which) {
    var l = LESSONS[li];
    if (!l) return null;
    var kind = which[0];
    var n = +which.slice(1);
    /* d0 to d2: the drills; x0 to x2: the exam-style questions; s: the ★ question */
    var q = kind === 'd' ? l.grammar.drills[n] : kind === 's' ? Object.assign({ kind: 'order' }, l.grammar.star) : l.grammar.exam[n];
    if (!q) return null;
    var src = 'g.' + l.id + '.' + which;
    if (q.kind === 'order') {
      var ord = order(4, src, true);
      return { src: src, type: '文の文法2', order: true, pre: q.pre, post: q.post, star: q.star, options: ord.map(function (t) { return q.tiles[t]; }), answer: ord.indexOf(q.star) + 1, tiles: q.tiles, why: q.why };
    }
    return { src: src, type: '文の文法1', ja: plain(q.ja), options: q.options, answer: q.answer, why: Array.isArray(q.why) ? q.why[q.answer - 1] : q.why };
  }

  /* the week test: the week's kanji words, its words' questions and its grammar exam-style questions, in that order
     (文字・語彙 then 文法), about twenty in all */
  function weekTest(plan, wk) {
    var from = (wk - 1) * 7;
    var ks = [], ws = [], gs = [];
    for (var i = from; i < Math.min(plan.days.length, from + 7); i++) {
      var x = plan.days[i];
      if (x.t !== 0) continue;
      (x.k || []).forEach(function (k) { ks.push(k); });
      (x.w || []).forEach(function (w) { ws.push(w); });
      if (x.g >= 0) gs.push(x.g);
    }
    var qs = [];
    var kstep = Math.max(1, Math.floor(ks.length / 8));
    for (var a = 0; a < ks.length && qs.length < 8; a += kstep) {
      var k = B.kanji[ks[a]];
      var q = readingQ(ks[a], Math.min(1, k.w.length - 1), 'w' + wk);
      if (q) qs.push(q);
    }
    var wstep = Math.max(1, Math.floor(ws.length / 6));
    for (var b = 0, nw = 0; b < ws.length && nw < 6; b += wstep, nw++) qs.push(wordQ(ws[b]));
    var ng = 0;
    gs.forEach(function (li) {
      ['x0', 'x1', 'x2'].forEach(function (w) { if (ng < 8) { var gq = grammarQ(li, w); if (gq) { qs.push(gq); ng++; } } });
    });
    return qs.filter(Boolean);
  }

  /* a mixed review before the exam (a review day, or a week test of a week with nothing new): kanji, words and
     grammar from everything learned before day i, a different pick for each day */
  function reviewQuiz(plan, i) {
    var ks = [], ws = [], gs = [];
    var upto = i;
    for (var pass = 0; pass < 2 && !(ks.length || ws.length || gs.length); pass++, upto = plan.days.length) {
      for (var j = 0; j < upto; j++) {
        var x = plan.days[j];
        if (x.t !== 0) continue;
        (x.k || []).forEach(function (k) { ks.push(k); });
        (x.w || []).forEach(function (w) { ws.push(w); });
        if (x.g >= 0) gs.push(x.g);
      }
    }
    var pick = function (arr, n, salt) { var o = order(arr.length, 'v' + i + salt); return o.slice(0, n).map(function (k) { return arr[k]; }); };
    var qs = [];
    pick(ks, 6, 'k').forEach(function (k, n) { var kk = B.kanji[k]; qs.push(readingQ(k, n % Math.max(1, kk.w.length), 'v' + i)); });
    pick(ws, 4, 'w').forEach(function (w) { qs.push(wordQ(w)); });
    pick(gs, 6, 'g').forEach(function (li, n) { qs.push(grammarQ(li, ['x0', 'x1', 'x2', 'd0', 'd1', 'd2'][(n + i) % 6])); });
    return qs.filter(Boolean);
  }
  /* the questions of a test day (its week's test) or a review day (a mixed review) */
  function testFor(plan, i) {
    var x = plan.days[i];
    if (!x) return [];
    if (x.t === 1) { var qs = weekTest(plan, Math.floor(i / 7) + 1); return qs.length >= 6 ? qs : reviewQuiz(plan, i); }
    return reviewQuiz(plan, i);
  }

  /* ---------- notebook entries ----------
     src names what was missed: k.<kanji>.<word>, w.<word>, g.<lesson>.<d0|x0…>, r.<lesson>, l.<lesson>, m<mock>.<item> */
  var TAG = { '漢字読み': 'v', '文脈規定': 'v', '言い換え類義': 'v', '用法': 'v', '文の文法1': 'g', '文の文法2': 'g', '読解': 'r', '即時応答': 'l' };
  function item(src) {
    var s = String(src || '').split('.');
    var q = null;
    if (s[0] === 'k') q = readingQ(+s[1], +s[2], '');
    else if (s[0] === 'w') q = wordQ(+s[1]);
    else if (s[0] === 'g') q = grammarQ(lessonIndex(s[1]), s[2]);
    else if (s[0] === 'r') {
      var l = LESSONS[lessonIndex(s[1])];
      if (l) { var r = l.reading; q = { src: src, type: '読解', ja: r.ask, options: r.options, short: r.short, answer: r.answer, why: r.why, passage: r.passage }; }
    } else if (s[0] === 'l') {
      var l2 = LESSONS[lessonIndex(s[1])];
      if (l2) { var t = l2.listening; q = { src: src, type: '即時応答', ja: t.who + '：' + t.line, options: ['1', '2', '3'], replies: t.replies, notes: t.notes, short: t.short, answer: t.answer, clip: 'l.' + l2.id, listen: true }; }
    }
    if (!q) return null;
    q.area = TAG[q.type] || 'g';
    /* the line the notebook shows */
    q.line = q.word && q.type === '漢字読み' ? q.word : q.order ? q.pre + ' ＿ ＿ ★ ＿ ' + q.post : q.usage ? q.word : q.ja;
    q.right = q.listen ? q.short[q.answer - 1] : q.short ? q.short[q.answer - 1] : q.options[q.answer - 1];
    return q;
  }

  /* spaced review: a mistake comes back after 1, 3 and 7 days, and leaves the notebook after three right answers in a row */
  var STEPS = [1, 3, 7];
  function due(m, t) {
    if (!m || m.cleared) return false;
    var at = m.next || (m.at ? add(iso(m.at), 1) : today());
    return at <= (t || today());
  }
  function reviewed(m, right, t) {
    var step = right ? (m.step || 0) + 1 : 0;
    var out = Object.assign({}, m, { step: step, last: t || today() });
    if (step >= 3) out.cleared = t || today();
    else out.next = add(t || today(), STEPS[step]);
    return out;
  }

  window.ykN1 = {
    bank: B,
    lessons: LESSONS,
    units: B.units,
    kanji: B.kanji,
    mocks: B.mocks || [],
    words: WORDS,
    word: word,
    unitOf: unitOf,
    lessonIndex: lessonIndex,
    titleOf: titleOf,
    today: today,
    add: add,
    diff: diff,
    fmt: fmt,
    sessions: sessions,
    COST: COST,
    make: make,
    replan: replan,
    preview: preview,
    current: current,
    done: done,
    started: started,
    mark: mark,
    withOpen: withOpen,
    openDay: openDay,
    todayIndex: todayIndex,
    stamps: stamps,
    result: result,
    view: view,
    weekTheme: weekTheme,
    segs: segs,
    plain: plain,
    blanks: blanks,
    order: order,
    readingQ: readingQ,
    kanjiQuiz: kanjiQuiz,
    wordQ: wordQ,
    grammarQ: grammarQ,
    weekTest: weekTest,
    reviewQuiz: reviewQuiz,
    testFor: testFor,
    item: item,
    due: due,
    reviewed: reviewed,
    /* the plan a screen shows when it stands alone on the design canvas: week 3, day 4, teaching unit 3 lesson 4 */
    demo: function () {
      var p = make({ start: '2026-09-24', exam: '2026-12-06', pace: 60, set: '2026-09-23' });
      var s = 0;
      p.days.forEach(function (x) { if (x.t !== 1) { x.t = 0; x.g = s < LESSONS.length ? s : -1; x.r = x.g; x.l = x.g; s++; } });
      for (var i = 0; i < 17; i++) p.days[i].p = p.days[i].t === 1 ? { t: 1 } : { g: 3, k: 1, r: 1, l: 1 };
      p.open = 17;
      return p;
    },
  };
})();
