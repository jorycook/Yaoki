/* Yaoki course engine.
 * The lessons themselves are data (course-n2.js, generated from content/n2/*.json by tools/build-course.mjs).
 * This file is what every screen uses to read them: the list of study sessions, the plan that lays them out
 * on the calendar up to the exam, the learner's progress, the mistake notebook's review spacing, and the
 * small text markup the content is written in. It works the same on the design canvas and in the app. */
(function () {
  var C = window.ykCourse = window.ykCourse || {};
  var DAY = 86400000;
  var STEPS = [1, 3, 7];            /* a mistake comes back after 1 day, then 3, then 7; the next right answer clears it */
  var DAYS_PER_UNIT = 7;            /* 5 study days, まとめ, week test */

  function data() { return window.__ykCourseData || { units: [], items: {} }; }

  /* ---------- text markup ----------
     {ばかりに}        highlighted (the pattern being taught)
     [油断|ゆだん]      ruby: base text with its reading above
     _補って_          underlined (the word a question asks about)
     ^大事な試験^       a clue: plain until the answer is shown, then marked (clue:'line' underlines it, clue:'mark' highlights it)
     Options: ruby:false drops readings (exam conditions), hl:false shows highlights as plain text. */
  C.rich = function (src, opt) {
    opt = opt || {};
    var out = [];
    var hl = false;
    var line = false;
    var clue = false;
    var buf = '';
    function seg(t, r) {
      if (!t) return;
      var on = (hl && opt.hl !== false) || (clue && opt.clue === 'mark');
      out.push({
        t: t,
        r: r || '',
        ruby: !!r,
        plain: !r,
        bg: on ? '#FFE9B0' : 'transparent',
        pad: on ? '0 3px' : '0',
        ws: on ? 'nowrap' : 'normal',
        line: line ? '2px solid #1B2440' : clue && opt.clue === 'line' ? '3px solid #F2B43A' : 'none'
      });
    }
    function flush() { seg(buf); buf = ''; }
    var s = String(src == null ? '' : src);
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (ch === '{' || ch === '}') { flush(); hl = ch === '{'; continue; }
      if (ch === '_') { flush(); line = !line; continue; }
      if (ch === '^') { flush(); clue = !clue; continue; }
      if (ch === '[') {
        var end = s.indexOf(']', i);
        var bar = s.indexOf('|', i);
        if (end > i && bar > i && bar < end) {
          flush();
          var base = s.slice(i + 1, bar);
          var reading = s.slice(bar + 1, end);
          if (opt.ruby === false) seg(base);
          else seg(base, reading);
          i = end;
          continue;
        }
      }
      buf += ch;
    }
    flush();
    return out;
  };
  /* the same text with all markup removed, for labels, the notebook and screen readers */
  C.plain = function (src) {
    return String(src == null ? '' : src).replace(/\[([^|\]]*)\|[^\]]*\]/g, '$1').replace(/[{}_^]/g, '');
  };

  /* ---------- the course ---------- */
  C.units = function () { return data().units || []; };
  C.unit = function (n) {
    var us = C.units();
    for (var i = 0; i < us.length; i++) if (us[i].n === n) return us[i];
    return null;
  };
  /* every study session in order: for each unit, days 1 to 6 and then its week test */
  C.sessions = function () {
    var list = [];
    C.units().forEach(function (u) {
      for (var d = 1; d <= 6; d++) {
        var day = (u.days || [])[d - 1] || null;
        list.push({ id: sid(u.n, d), unit: u.n, day: d, kind: d === 6 ? 'matome' : 'study', ready: !!(day && day.grammar), title: day ? day.title : '' });
      }
      list.push({ id: sid(u.n, 't'), unit: u.n, day: 7, kind: 'test', ready: !!(u.test && u.test.length), title: '週テスト' });
    });
    return list;
  };
  function sid(u, d) { return 'u' + (u < 10 ? '0' : '') + u + (d === 't' ? 't' : 'd' + d); }
  C.sid = sid;
  C.session = function (id) {
    var all = C.sessions();
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  };
  C.day = function (id) {
    var m = /^u(\d+)d(\d)$/.exec(id || '');
    if (!m) return null;
    var u = C.unit(+m[1]);
    return u && u.days ? u.days[+m[2] - 1] || null : null;
  };
  /* any question by its id: lesson items, week test items and the mini mock's */
  C.item = function (id) { return (data().items || {})[id] || null; };

  /* ---------- progress ----------
     done[sessionId] = { g: grammar step 0-3 (teach read, drill done, exam-style done), k: scene 0/1, r: reading or listening 0/1 }
     a week test is done when tests[unitId] holds its result */
  C.complete = function (state, s) {
    if (!s) return false;
    if (s.kind === 'test') return !!(state.tests && state.tests[s.id]);
    var p = (state.done || {})[s.id] || {};
    return p.g >= 3 && p.k >= 1 && p.r >= 1;
  };

  /* ---------- the plan ----------
     settings: { start: 'YYYY-MM-DD', exam: 'YYYY-MM-DD', pace: 'fit' | 'steady' }
     fit:    every session fits before the exam, with the last week kept for mock exams; days double up when time is short
     steady: one session a day, whatever the date of the exam */
  function dayNo(iso) {
    var m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(iso || '');
    if (!m) return null;
    return Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY);
  }
  function iso(n) {
    var d = new Date(n * DAY);
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  C.today = function (now) {
    var d = now ? new Date(now) : new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  };
  C.daysBetween = function (a, b) { var x = dayNo(a), y = dayNo(b); return x == null || y == null ? 0 : y - x; };
  C.addDays = function (a, n) { var x = dayNo(a); return x == null ? a : iso(x + n); };
  C.plan = function (settings) {
    var all = C.sessions();
    var n = all.length;
    var start = dayNo(settings && settings.start) || dayNo(C.today());
    var exam = dayNo(settings && settings.exam);
    var room = exam != null ? exam - start - 7 : n;
    if (exam != null && room < 1) room = Math.max(1, exam - start);
    var squeeze = settings && settings.pace !== 'steady' && room < n;
    return all.map(function (s, k) {
      var at = squeeze ? start + Math.floor((k * room) / n) : start + k;
      return Object.assign({}, s, { date: iso(at) });
    });
  };
  /* how the plan stands today: the session to do next, how far ahead or behind, how many days are left */
  C.status = function (state, now) {
    var plan = C.plan(state.plan || {});
    var today = C.today(now);
    var next = null;
    for (var i = 0; i < plan.length; i++) {
      if (plan[i].ready && !C.complete(state, plan[i])) { next = plan[i]; break; }
    }
    var dueToday = plan.filter(function (s) { return s.date <= today && s.ready && !C.complete(state, s); }).length;
    var perDay = 1;
    if (plan.length > 1) {
      var span = C.daysBetween(plan[0].date, plan[plan.length - 1].date) + 1;
      perDay = Math.max(1, Math.round(plan.length / Math.max(1, span)));
    }
    var left = state.plan && state.plan.exam ? C.daysBetween(today, state.plan.exam) : null;
    var stamps = plan.filter(function (s) { return C.complete(state, s); }).length;
    return { plan: plan, next: next, dueToday: dueToday, perDay: perDay, daysLeft: left, stamps: stamps, today: today };
  };
  /* can the whole course be done one session a day before the exam? */
  C.fits = function (settings) {
    if (!settings || !settings.exam) return true;
    var room = C.daysBetween(settings.start || C.today(), settings.exam) - 7;
    return room >= C.sessions().length;
  };

  /* ---------- the mistake notebook ----------
     an entry: { src: item id, wrong: what was chosen, at: when, step: 0-2 (how many right in a row), due: 'YYYY-MM-DD' } */
  C.miss = function (list, m, now) {
    var today = C.today(now);
    var entry = { src: m.src, wrong: m.wrong, at: now || Date.now(), step: 0, due: C.addDays(today, STEPS[0]) };
    return [entry].concat((list || []).filter(function (x) { return x.src !== m.src; }));
  };
  C.due = function (list, now) {
    var today = C.today(now);
    return (list || []).filter(function (x) { return !x.cleared && (x.due || '') <= today; });
  };
  /* the answer in a review: right moves it a step on (the third right in a row clears it), wrong sends it back to 1 day */
  C.reviewed = function (list, src, right, now) {
    var today = C.today(now);
    return (list || []).map(function (x) {
      if (x.src !== src) return x;
      if (!right) return Object.assign({}, x, { step: 0, due: C.addDays(today, STEPS[0]), at: now || Date.now(), last: 'wrong' });
      var step = (x.step || 0) + 1;
      if (step >= 3) return Object.assign({}, x, { step: 3, cleared: true, at: now || Date.now(), last: 'right' });
      return Object.assign({}, x, { step: step, due: C.addDays(today, STEPS[step]), at: now || Date.now(), last: 'right' });
    });
  };

  /* ---------- the app's one memory ----------
     The prototype frame on the canvas and the installed app both keep this state and hand the same props to
     the screens: app (what to show), go (change screen), save (record progress), miss (a wrong answer). */
  C.now = function () { return window.__ykNow || Date.now(); };
  C.fresh = function () {
    return { screen: 'Goal', started: false, plan: null, cur: null, done: {}, tests: {}, mistakes: [], tp: 0, set: 'day', mock: null };
  };
  /* the session a screen works on: the one picked on the week path, else the next one due */
  C.current = function (state, status) {
    var s = state.cur ? C.session(state.cur) : null;
    if (s && s.ready) return s.id;
    if (status.next) return status.next.id;
    var all = C.sessions().filter(function (x) { return x.ready; });
    return all.length ? all[0].id : null;
  };
  C.view = function (state) {
    var status = C.status(state, C.now());
    var sid = C.current(state, status);
    var session = null;
    status.plan.forEach(function (p) { if (p.id === sid) session = p; });
    var unitN = session ? session.unit : 3;
    return {
      status: status,
      plan: state.plan,
      sid: sid,
      session: session,
      unit: C.unit(unitN),
      day: C.day(sid),
      prog: (state.done || {})[sid] || {},
      done: state.done || {},
      tests: state.tests || {},
      tp: state.tp || 0,
      set: state.set || 'day',
      mistakes: state.mistakes || [],
      mock: state.mock || null
    };
  };
  C.handlers = function (get, set) {
    return {
      go: function (to) { set(function (st) { return { screen: to, started: st.started || to !== 'Goal' }; }); },
      save: function (patch) {
        set(function (st) {
          var out = {};
          Object.keys(patch).forEach(function (k) { if (k !== 'prog' && k !== 'result') out[k] = patch[k]; });
          var sid = C.current(st, C.status(st, C.now()));
          if (patch.prog && sid) {
            var done = Object.assign({}, st.done || {});
            var had = done[sid] || {};
            var next = Object.assign({}, had);
            /* steps only ever move forward: going back over a lesson never undoes it */
            Object.keys(patch.prog).forEach(function (k) { next[k] = Math.max(had[k] || 0, patch.prog[k]); });
            done[sid] = next;
            out.done = done;
          }
          if (patch.result) {
            var tests = Object.assign({}, st.tests || {});
            tests[patch.result.id] = patch.result;
            out.tests = tests;
          }
          return out;
        });
      },
      miss: function (m) { set(function (st) { return { mistakes: C.miss(st.mistakes, m, C.now()) }; }); },
      reviewed: function (src, right) { set(function (st) { return { mistakes: C.reviewed(st.mistakes, src, right, C.now()) }; }); }
    };
  };

  C.STEPS = STEPS;
  C.DAYS_PER_UNIT = DAYS_PER_UNIT;

  /* the colours of an item's tag, by exam area */
  C.area = function (type) {
    var t = type || '';
    if (/漢字|表記|語形成|文脈|言い換え|用法|語彙/.test(t)) return { key: 'vocab', ja: '文字・語彙', en: 'Kanji, vocabulary', tagBg: '#FDEBE6', tagColor: '#C7361E' };
    if (/文法/.test(t)) return { key: 'grammar', ja: '文法', en: 'Grammar', tagBg: '#E8ECFB', tagColor: '#2F4FD0' };
    if (/課題|ポイント|概要|即時|聴/.test(t)) return { key: 'listening', ja: '聴解', en: 'Listening', tagBg: '#E0F3EF', tagColor: '#0B7A6B' };
    return { key: 'reading', ja: '読解', en: 'Reading', tagBg: '#FFF4D6', tagColor: '#1B2440' };
  };
})();
