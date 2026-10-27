/*
 * Kana Runner: the side-scroller. The runner stays put; boxes come in from the right,
 * each with a prompt. Type the prompt to jump over the box. A box that reaches the
 * runner costs a heart. Rules for what counts as a correct key are in engine.js.
 */
(function () {
  'use strict';

  const E = window.TypingEngine;
  const $ = (id) => document.getElementById(id);

  const W = 960, H = 400;
  const GROUND = 330;
  const BOX_H = 66;
  const PLAYER_X = 150;
  const GRAVITY = 1800;
  const JUMP_V = 640;
  const HEARTS = 3;
  const SPEED_START = 70, SPEED_STEP = 3, SPEED_MAX = 230;
  const GAP_SECONDS = 2.4;
  const JP = "'Hiragino Sans','Yu Gothic','Noto Sans JP',Meiryo,sans-serif";
  const MONO = "Consolas,Menlo,'Courier New',monospace";
  const IME_MSG = 'Keys are not reaching the game. Set your input to 英数 (direct input) and try again.';

  const MODES = {
    romaji: {
      label: 'Romaji typing',
      desc: 'Each box shows a kana. Type its romaji the way you type Japanese on this keyboard. Every accepted spelling counts (si and shi, tu and tsu, and so on).',
      stages: E.ROMAJI_STAGES,
    },
    symbol: {
      label: 'JIS symbol keys',
      desc: 'Each box shows a symbol. Type it on the key where a Japanese keyboard prints it. The caption says when Shift is needed.',
      stages: E.SYMBOL_STAGES,
    },
    kana: {
      label: 'Kana positions',
      desc: 'Each box shows a kana printed on a Japanese keyboard. Press the key that carries it. Your input mode does not matter here.',
      stages: E.KANA_STAGES,
    },
  };

  // The JIS keyboard as drawn on the page: physical code, the character with no
  // modifier (main), the character with Shift (sub), and the width of the key.
  const k = (code, main, sub = '', w = 1) => ({ code, main, sub, w });
  const letters = (s) => s.split('').map((l) => k('Key' + l, l));
  const KEY_ROWS = [
    [k('Backquote', '半/全'), k('Digit1', '1', '!'), k('Digit2', '2', '"'), k('Digit3', '3', '#'),
      k('Digit4', '4', '$'), k('Digit5', '5', '%'), k('Digit6', '6', '&'), k('Digit7', '7', "'"),
      k('Digit8', '8', '('), k('Digit9', '9', ')'), k('Digit0', '0'), k('Minus', '-', '='),
      k('Equal', '^', '~'), k('IntlYen', '¥', '|'), k('Backspace', 'BS', '', 1.8)],
    [k('Tab', 'Tab', '', 1.5), ...letters('QWERTYUIOP'), k('BracketLeft', '@', '`'), k('BracketRight', '[', '{')],
    [k('CapsLock', 'Caps', '', 1.7), ...letters('ASDFGHJKL'), k('Semicolon', ';', '+'),
      k('Quote', ':', '*'), k('Backslash', ']', '}'), k('Enter', 'Enter', '', 1.6)],
    [k('ShiftLeft', 'Shift', '', 2.2), ...letters('ZXCVBNM'), k('Comma', ',', '<'), k('Period', '.', '>'),
      k('Slash', '/', '?'), k('IntlRo', '\\', '_'), k('ShiftRight', 'Shift', '', 2.2)],
    [k('Space', 'Space', '', 6)],
  ];
  const KEYDEF = {};
  for (const row of KEY_ROWS) for (const key of row) KEYDEF[key.code] = key;
  const KANA_BY_CODE = {};
  for (const key of E.KANA_KEYS) KANA_BY_CODE[key.code] = key.kana;
  const KANA_CODES = new Set(E.KANA_KEYS.map((key) => key.code));

  const canvas = $('stage');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Screen state
  let mode = 'romaji';
  let stageIdx = 0;
  let phase = 'menu';          // menu | play | paused | over
  let g = null;                // the current run
  let hintsOn = true;
  let lastItem = null;
  const bg = { scroll: 0 };

  // ---------- keyboard display ----------

  const keyEls = new Map();
  function buildKeyboard() {
    const kb = $('kb');
    for (const row of KEY_ROWS) {
      const r = document.createElement('div');
      r.className = 'kb-row';
      for (const key of row) {
        const el = document.createElement('div');
        el.className = 'key';
        el.style.flexGrow = key.w;
        el.innerHTML = '<span class="sub"></span><span class="main"></span>';
        r.appendChild(el);
        keyEls.set(key.code, el);
      }
      kb.appendChild(r);
    }
    setKeyLabels();
  }

  // In kana mode the keys show their kana, with the romaji key under it.
  function setKeyLabels() {
    for (const [code, el] of keyEls) {
      const def = KEYDEF[code];
      const kana = mode === 'kana' ? KANA_BY_CODE[code] : undefined;
      el.querySelector('.main').textContent = kana || def.main;
      el.querySelector('.sub').textContent = kana ? def.main : def.sub;
    }
  }

  function flashKey(code) {
    const el = keyEls.get(code);
    if (!el) return;
    el.classList.add('press');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('press'), 160);
  }

  let lastNextSig = '';
  function refreshKeys() {
    const set = nextCodes();
    const sig = [...set].sort().join(',');
    if (sig === lastNextSig) return;
    lastNextSig = sig;
    for (const [code, el] of keyEls) el.classList.toggle('next', set.has(code));
  }

  // The keys to light up: the next key(s) of the target prompt.
  function nextCodes() {
    const out = new Set();
    const ob = targetOb();
    if (!ob || phase !== 'play') return out;
    if (mode === 'romaji') {
      for (const ch of E.nextChars(ob.tokens, ob.typed)) {
        const code = E.codeFor(ch);
        if (code) out.add(code);
      }
    } else {
      out.add(ob.code);
      if (ob.shift) {
        out.add('ShiftLeft');
        out.add('ShiftRight');
      }
    }
    return out;
  }

  // ---------- menus ----------

  function buildMenu() {
    const tabs = $('mode-tabs');
    tabs.innerHTML = '';
    for (const id of Object.keys(MODES)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tab';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(id === mode));
      b.textContent = MODES[id].label;
      b.addEventListener('click', () => {
        mode = id;
        stageIdx = 0;
        setKeyLabels();
        buildMenu();
      });
      tabs.appendChild(b);
    }
    $('mode-desc').textContent = MODES[mode].desc;

    const list = $('stage-list');
    list.innerHTML = '';
    MODES[mode].stages.forEach((st, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'stage' + (i === stageIdx ? ' on' : '');
      b.textContent = (i + 1) + '. ' + st.name;
      b.addEventListener('click', () => {
        stageIdx = i;
        buildMenu();
      });
      list.appendChild(b);
    });

    const best = loadBest();
    $('best').textContent = best
      ? `Best on this stage: ${best.score} points, ${best.cleared} cleared, ${best.accuracy}% accuracy`
      : 'No score yet on this stage.';
  }

  const bestKey = () => `kana-runner:${mode}:${MODES[mode].stages[stageIdx].id}`;
  function loadBest() {
    try {
      return JSON.parse(localStorage.getItem(bestKey()));
    } catch (err) {
      return null;
    }
  }
  function saveBest(rec) {
    try {
      localStorage.setItem(bestKey(), JSON.stringify(rec));
    } catch (err) {
      // Private windows can refuse storage; the score just is not kept.
    }
  }

  function setPhase(p) {
    phase = p;
    $('overlay').hidden = p === 'play';
    $('menu').hidden = p !== 'menu';
    $('paused').hidden = p !== 'paused';
    $('over').hidden = p !== 'over';
    if (p === 'menu') buildMenu();
    if (p === 'over') showResult();
    if (p === 'play') setStatus('', '');
  }

  function showResult() {
    const acc = g.keysTotal ? Math.round((100 * g.keysRight) / g.keysTotal) : 0;
    const perMin = g.time > 0 ? Math.round(g.keysRight / (g.time / 60)) : 0;
    const prev = loadBest();
    const isBest = !prev || g.score > prev.score;
    if (isBest) saveBest({ score: g.score, cleared: g.cleared, accuracy: acc, perMin });
    $('res-score').textContent = g.score;
    $('res-cleared').textContent = g.cleared;
    $('res-acc').textContent = acc + '%';
    $('res-kpm').textContent = perMin;
    $('res-combo').textContent = g.bestCombo;
    $('res-note').textContent = isBest
      ? 'New best on this stage.'
      : `Best on this stage: ${prev.score} points.`;
  }

  // ---------- the run ----------

  function startGame() {
    const stage = MODES[mode].stages[stageIdx];
    g = {
      stage,
      hearts: HEARTS,
      score: 0, combo: 0, bestCombo: 0,
      keysTotal: 0, keysRight: 0,
      cleared: 0, time: 0,
      speed: SPEED_START,
      runT: 0,
      jumpY: 0, jumpV: 0,
      obstacles: [], fx: [], popups: [],
      shake: 0, flash: 0,
    };
    lastItem = null;
    spawn(W + 40);
    setPhase('play');
  }

  function endRun() {
    setPhase('over');
  }

  function pickItem() {
    const items = g.stage.items;
    let item;
    do {
      item = items[Math.floor(Math.random() * items.length)];
    } while (items.length > 1 && item === lastItem);
    lastItem = item;
    return item;
  }

  function keyCap(code) {
    const def = KEYDEF[code];
    return def ? def.main : code;
  }

  function spawn(x) {
    const item = pickItem();
    const ob = { x, done: false, doneT: 0, gone: false, typed: '', pending: false, pendingT: 0 };
    if (mode === 'romaji') {
      ob.text = item;
      ob.tokens = E.tokenize(item);
      ob.hint = E.romajiHint(ob.tokens);
      ob.w = 40 + 30 * Array.from(item).length;
      ob.caption = '';
    } else if (mode === 'symbol') {
      ob.text = item.ch;
      ob.ch = item.ch;
      ob.code = item.code;
      ob.shift = item.shift;
      ob.w = 84;
      ob.caption = (item.shift ? 'Shift + ' : '') + keyCap(item.code);
    } else {
      ob.text = item.kana;
      ob.code = item.code;
      ob.shift = false;
      ob.w = 84;
      ob.caption = keyCap(item.code);
    }
    g.obstacles.push(ob);
    return ob;
  }

  // The box the typing goes to: the nearest one that is not cleared yet.
  function targetOb() {
    if (!g) return null;
    return g.obstacles.find((o) => !o.done && !o.gone) || null;
  }

  function update(dt) {
    g.time += dt;
    g.runT += dt * (g.speed / 40);

    if (g.jumpY > 0 || g.jumpV > 0) {
      g.jumpV -= GRAVITY * dt;
      g.jumpY += g.jumpV * dt;
      if (g.jumpY <= 0) {
        g.jumpY = 0;
        g.jumpV = 0;
      }
    }

    const last = g.obstacles[g.obstacles.length - 1];
    if (!last || last.x + last.w + g.speed * GAP_SECONDS <= W + 40) spawn(W + 40);

    for (const ob of g.obstacles) {
      ob.x -= g.speed * dt;
      if (ob.done) {
        ob.doneT += dt;
        if (ob.doneT > 0.6) ob.gone = true;
      } else if (ob.pending) {
        ob.pendingT += dt;
        if (ob.pendingT > 0.7) complete(ob);
      } else if (ob.x <= PLAYER_X + 22) {
        crash(ob);
      }
    }
    g.obstacles = g.obstacles.filter((o) => !o.gone);
    if (g.hearts <= 0) {
      endRun();
      return;
    }

    for (const f of g.fx) {
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vy += 600 * dt;
      f.life -= dt;
    }
    g.fx = g.fx.filter((f) => f.life > 0);
    for (const p of g.popups) {
      p.y -= 40 * dt;
      p.life -= dt;
    }
    g.popups = g.popups.filter((p) => p.life > 0);
    g.shake = Math.max(0, g.shake - dt);
    g.flash = Math.max(0, g.flash - dt);
  }

  function crash(ob) {
    ob.gone = true;
    g.hearts--;
    g.combo = 0;
    g.shake = 0.3;
    g.flash = 0.35;
    popup('Ouch!', PLAYER_X + 40, GROUND - 100, '#c2362f');
    burst(PLAYER_X + 30, GROUND - 40, '#c2362f', 10);
  }

  function complete(ob) {
    ob.done = true;
    g.cleared++;
    const pts = 10 + Math.min(g.combo, 20);
    g.score += pts;
    popup('+' + pts, ob.x + ob.w / 2, GROUND - BOX_H - 24, '#1f9d55');
    burst(ob.x + ob.w / 2, GROUND - BOX_H / 2, '#f5a623', 14);
    if (g.jumpY === 0) g.jumpV = JUMP_V;
    g.speed = Math.min(SPEED_MAX, SPEED_START + g.cleared * SPEED_STEP);
  }

  function popup(text, x, y, color) {
    g.popups.push({ text, x, y, color, life: 0.8 });
  }

  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 80 + Math.random() * 160;
      g.fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, life: 0.6, color });
    }
  }

  // ---------- input ----------

  function setStatus(text, kind) {
    const s = $('status');
    s.textContent = text;
    s.className = kind || '';
  }

  function expectedText(ob) {
    if (mode === 'romaji') return 'Expected: ' + [...E.nextChars(ob.tokens, ob.typed)].join(' / ');
    if (mode === 'symbol') return `Expected ${ob.ch} (${ob.caption})`;
    return `Expected the ${ob.caption} key for ${ob.text}`;
  }

  function onKeyDown(e) {
    if (e.isComposing || e.keyCode === 229 || e.key === 'Process') {
      setStatus(IME_MSG, 'warn');
      return;
    }

    if (phase === 'menu') {
      if (e.key === 'Enter' && e.target === document.body) {
        e.preventDefault();
        startGame();
      }
      return;
    }
    if (phase === 'over') {
      if (e.key === 'Enter' && e.target === document.body) {
        e.preventDefault();
        startGame();
      } else if (e.key === 'Escape') {
        setPhase('menu');
      }
      return;
    }
    if (phase === 'paused') {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        setPhase('play');
      }
      return;
    }

    // phase === 'play'
    if (e.key === 'Escape') {
      e.preventDefault();
      setPhase('paused');
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Backspace') {
      e.preventDefault();
      const ob = targetOb();
      if (ob && mode === 'romaji' && ob.typed) {
        ob.typed = ob.typed.slice(0, -1);
        ob.pending = false;
      }
      return;
    }
    if (mode === 'kana' ? !KANA_CODES.has(e.code) : e.key.length !== 1) return;
    e.preventDefault();
    flashKey(e.code);
    pressKey(e);
  }

  function pressKey(e) {
    const ob = targetOb();
    if (!ob) return;

    if (mode === 'romaji') {
      const c = e.key.toLowerCase();
      if (!/^[a-z'-]$/.test(c)) return;
      // A finished word that could still take another letter (ん typed as n, nn or n')
      // waits for the next key. A key that cannot extend it finishes it first.
      if (ob.pending && !E.nextChars(ob.tokens, ob.typed).has(c)) {
        complete(ob);
        return pressKey(e);
      }
      g.keysTotal++;
      const typed = ob.typed + c;
      if (!E.matchPrefix(ob.tokens, typed)) return wrongKey(ob);
      ob.typed = typed;
      ob.pending = false;
      if (!E.isComplete(ob.tokens, typed)) return hit(null);
      if (E.nextChars(ob.tokens, typed).size) {
        ob.pending = true;
        ob.pendingT = 0;
        return hit(null);
      }
      hit(ob);
    } else if (mode === 'symbol') {
      g.keysTotal++;
      if (e.key !== ob.ch) return wrongKey(ob);
      hit(ob);
    } else {
      g.keysTotal++;
      if (e.code !== ob.code) return wrongKey(ob);
      hit(ob);
    }
  }

  // A correct key. `finished` is the box if this key completed it, else null.
  function hit(finished) {
    g.keysRight++;
    g.combo++;
    g.bestCombo = Math.max(g.bestCombo, g.combo);
    if (finished) {
      complete(finished);
      setStatus('', '');
    }
  }

  function wrongKey(ob) {
    g.combo = 0;
    g.shake = Math.max(g.shake, 0.12);
    setStatus(expectedText(ob), 'bad');
  }

  // ---------- drawing ----------

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function cloud(x, y, s) {
    ctx.beginPath();
    ctx.arc(x, y, 22 * s, 0, Math.PI * 2);
    ctx.arc(x + 26 * s, y - 10 * s, 28 * s, 0, Math.PI * 2);
    ctx.arc(x + 56 * s, y, 22 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  function hills(offset, base, amp, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) {
      ctx.lineTo(x, base - amp * (0.5 + 0.5 * Math.sin((x + offset) * 0.011)));
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  }

  function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
    sky.addColorStop(0, '#9fd8ff');
    sky.addColorStop(1, '#eaf8ff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#ffe27a';
    ctx.beginPath();
    ctx.arc(860, 70, 34, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    for (let i = 0; i < 4; i++) {
      const x = (((i * 260 - bg.scroll * 0.2) % 1100) + 1100) % 1100 - 80;
      cloud(x, 60 + (i % 2) * 40, 1 + (i % 3) * 0.2);
    }

    hills(bg.scroll * 0.3, GROUND - 70, 60, '#b9e3a4');
    hills(bg.scroll * 0.6, GROUND - 30, 40, '#8fd16a');

    ctx.fillStyle = '#7cc04f';
    ctx.fillRect(0, GROUND, W, 12);
    ctx.fillStyle = '#d9b07a';
    ctx.fillRect(0, GROUND + 12, W, H - GROUND - 12);
    ctx.fillStyle = '#c49a62';
    for (let x = -(bg.scroll % 60); x < W; x += 60) ctx.fillRect(x, GROUND + 30, 28, 4);
  }

  function drawRunner() {
    const jumpY = g ? g.jumpY : 0;
    const airborne = jumpY > 0;
    const running = phase === 'play' && !airborne;
    const s = running ? Math.sin(g.runT * 12) : 0;

    const shrink = 1 - Math.min(jumpY / 140, 0.6);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.ellipse(PLAYER_X, GROUND + 4, 26 * shrink, 5 * shrink, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(PLAYER_X, GROUND - jumpY);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const legs = airborne ? [[12, -8], [-4, -14]] : [[s * 14, 0], [-s * 14, 0]];
    ctx.strokeStyle = '#2b3a55';
    ctx.lineWidth = 8;
    for (const [dx, dy] of legs) {
      ctx.beginPath();
      ctx.moveTo(0, -34);
      ctx.lineTo(dx, dy);
      ctx.stroke();
    }

    ctx.strokeStyle = '#2d6cdf';
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.moveTo(0, -34);
    ctx.lineTo(0, -56);
    ctx.stroke();

    const arms = airborne ? [[10, -70], [-2, -66]] : [[-s * 10, -40], [s * 10, -40]];
    ctx.lineWidth = 6;
    for (const [dx, dy] of arms) {
      ctx.beginPath();
      ctx.moveTo(0, -52);
      ctx.lineTo(dx, dy);
      ctx.stroke();
    }

    ctx.fillStyle = '#ffd9b0';
    ctx.beginPath();
    ctx.arc(0, -70, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3b2a1e';
    ctx.beginPath();
    ctx.arc(0, -72, 12.5, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#1f2328';
    ctx.beginPath();
    ctx.arc(5, -69, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawRomajiCaption(ob, cx, y, isTarget) {
    const typed = isTarget ? ob.typed : '';
    const hint = hintsOn ? ob.hint : '';
    if (!hint && !typed) return;
    ctx.font = `700 20px ${MONO}`;
    ctx.textBaseline = 'alphabetic';
    if (typed && !hint.startsWith(typed)) {
      // Another spelling of the same kana: show what was typed on its own.
      ctx.textAlign = 'center';
      ctx.fillStyle = '#1f9d55';
      ctx.fillText(typed, cx, y);
      return;
    }
    const left = cx - ctx.measureText(hint).width / 2;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#9aa0a8';
    ctx.fillText(hint, left, y);
    if (typed) {
      ctx.fillStyle = '#1f9d55';
      ctx.fillText(typed, left, y);
    }
  }

  function drawBox(ob, isTarget) {
    const lift = ob.done ? ob.doneT * 180 : 0;
    const alpha = ob.done ? Math.max(0, 1 - ob.doneT / 0.6) : 1;
    const x = ob.x;
    const y = GROUND - BOX_H - lift;

    ctx.save();
    ctx.globalAlpha = alpha;
    roundRect(x, y, ob.w, BOX_H, 12);
    ctx.fillStyle = '#fffdf5';
    ctx.fill();
    ctx.lineWidth = isTarget ? 4 : 2;
    ctx.strokeStyle = isTarget ? '#f5a623' : '#8a6a4a';
    ctx.stroke();

    ctx.fillStyle = '#1f2328';
    ctx.font = `600 30px ${JP}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ob.text, x + ob.w / 2, y + BOX_H / 2 + 2);

    if (mode === 'romaji') {
      drawRomajiCaption(ob, x + ob.w / 2, y - 12, isTarget);
    } else if (isTarget || hintsOn) {
      ctx.font = `600 18px ${JP}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#5b4636';
      ctx.fillText(ob.caption, x + ob.w / 2, y - 12);
    }
    ctx.restore();
  }

  function drawObstacles() {
    const target = targetOb();
    for (const ob of g.obstacles) drawBox(ob, ob === target);
  }

  function drawFx() {
    for (const f of g.fx) {
      ctx.globalAlpha = Math.max(0, f.life / 0.6);
      ctx.fillStyle = f.color;
      ctx.fillRect(f.x - 3, f.y - 3, 6, 6);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of g.popups) {
      ctx.globalAlpha = Math.min(1, p.life / 0.4);
      ctx.font = `700 22px ${JP}`;
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawHud() {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#1f2328';
    ctx.font = `700 22px ${JP}`;
    ctx.fillText(`Score ${g.score}`, 20, 34);
    ctx.font = `600 16px ${JP}`;
    ctx.fillText(`Cleared ${g.cleared}    Combo ${g.combo}`, 20, 58);

    ctx.textAlign = 'right';
    ctx.font = `600 14px ${JP}`;
    ctx.fillStyle = '#5b636e';
    ctx.fillText(MODES[mode].label + ' · ' + g.stage.name, W - 20, 58);
    for (let i = 0; i < HEARTS; i++) {
      ctx.font = '28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = i < g.hearts ? '#e5484d' : '#d6d3cc';
      ctx.fillText('♥', W - 30 - i * 34, 34);
    }
  }

  function draw() {
    ctx.save();
    if (g && g.shake > 0) {
      const a = g.shake * 14;
      ctx.translate((Math.random() - 0.5) * a, (Math.random() - 0.5) * a);
    }
    drawBackground();
    if (g) drawObstacles();
    drawRunner();
    if (g) {
      drawFx();
      drawHud();
    }
    if (g && g.flash > 0) {
      ctx.fillStyle = `rgba(194,54,47,${g.flash * 1.2})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  // ---------- loop ----------

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (phase === 'play') update(dt);
    bg.scroll += (phase === 'play' ? g.speed : phase === 'paused' ? 0 : 40) * dt;
    draw();
    refreshKeys();
    requestAnimationFrame(frame);
  }

  // ---------- wiring ----------

  buildKeyboard();
  setPhase('menu');
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('blur', () => {
    if (phase === 'play') setPhase('paused');
  });

  $('start').addEventListener('click', startGame);
  $('resume').addEventListener('click', () => setPhase('play'));
  $('quit').addEventListener('click', () => setPhase('menu'));
  $('again').addEventListener('click', startGame);
  $('to-menu').addEventListener('click', () => setPhase('menu'));
  $('hints').addEventListener('change', (e) => {
    hintsOn = e.target.checked;
  });
  $('kb-toggle').addEventListener('change', (e) => {
    $('kb').hidden = !e.target.checked;
  });

  requestAnimationFrame((now) => {
    last = now;
    requestAnimationFrame(frame);
  });

  // Read-only view of the run, for the browser checks in check/typing-test.js.
  window.kanaRunnerState = () => {
    const ob = targetOb();
    return {
      phase,
      mode,
      target: ob ? { text: ob.text, typed: ob.typed, hint: ob.hint || null, code: ob.code || null } : null,
      score: g ? g.score : 0,
      hearts: g ? g.hearts : HEARTS,
      cleared: g ? g.cleared : 0,
    };
  };
})();
