// Checks the N1 content banks against content/BANKS.md: words, reading, listening and the N2 grammar review.
// usage: node tools/check-banks.mjs [files…]        (no files: every bank file under content/)
// Prints one line per problem and a summary; the exit status is 1 when there are problems.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const C = path.join(HERE, '..', 'content');
const list = (d) => fs.existsSync(d) ? fs.readdirSync(d).filter((f) => /^u[1-8]\.json$/.test(f)).sort().map((f) => path.join(d, f)) : [];
const files = process.argv.slice(2).length ? process.argv.slice(2) : [...list(path.join(C, 'words')), ...list(path.join(C, 'reading')), ...list(path.join(C, 'listening')), ...(fs.existsSync(path.join(C, 'review-n2.json')) ? [path.join(C, 'review-n2.json')] : [])];

const visible = (s) => String(s).replace(/《[^》]*》/g, '').replace(/[【】]/g, '');
const len = (s) => [...visible(s)].length;
const BLANK = '（　　）';
let problems = 0;
let where = '';
const bad = (msg) => { problems += 1; console.log(`${where}: ${msg}`); };
const str = (v, label, max, o = {}) => {
  if (typeof v !== 'string' || !v.trim()) { bad(`${label}: missing`); return false; }
  if (max && len(v) > max) bad(`${label}: ${len(v)} characters, at most ${max}: ${visible(v).slice(0, 40)}`);
  const open = (v.match(/【/g) || []).length;
  if (open !== (v.match(/】/g) || []).length || /【[^】]*【/.test(v)) bad(`${label}: unbalanced 【】`);
  if (o.mark && !open) bad(`${label}: needs the 【】 mark`);
  if (o.noMark && (open || /《/.test(v))) bad(`${label}: no markup here`);
  if (o.blank && !v.includes(BLANK)) bad(`${label}: needs the blank （　　）`);
  if (/《/.test(v) && !/[一-鿿々]《/.test(v)) bad(`${label}: 《》 must follow kanji`);
  if (o.ja && /[,.!?()]/.test(visible(v).replace(/[0-9]+[.,][0-9]+/g, ''))) bad(`${label}: use Japanese punctuation`);
  return true;
};
const num = (v, label, lo, hi) => { if (!Number.isInteger(v) || v < lo || v > hi) bad(`${label}: must be a whole number from ${lo} to ${hi}`); };
const arr = (v, label, n) => { if (!Array.isArray(v) || (n && v.length !== n)) { bad(`${label}: must be a list of ${n}`); return false; } return true; };
const distinct = (v, label) => { if (Array.isArray(v) && new Set(v.map(visible)).size !== v.length) bad(`${label}: options repeat`); };
const read = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { where = path.basename(f); bad('not valid JSON: ' + e.message); return null; } };

/* the words the syllabus teaches: a bank may not repeat them, nor itself */
const syllabus = fs.existsSync(path.join(C, 'syllabus.json')) ? JSON.parse(fs.readFileSync(path.join(C, 'syllabus.json'), 'utf8')) : null;
const taught = new Map();
if (syllabus) for (const w of syllabus.weeks) for (const d of w.days) for (const v of d.vocab) taught.set(v.w, `syllabus u${w.n}l${d.d}`);
const bankWords = new Map();

function word(v, at) {
  str(v.w, `${at}.w`, 8, { noMark: true }); str(v.r, `${at}.r`, 12, { noMark: true }); str(v.en, `${at}.en`, 34);
  if (!['adverb', 'verb', 'noun', 'adjective', 'katakana', 'expression'].includes(v.kind)) bad(`${at}.kind: adverb, verb, noun, adjective, katakana or expression`);
  if (v.ex) { str(v.ex.ja, `${at}.ex.ja`, 30, { mark: true, ja: true }); str(v.ex.en, `${at}.ex.en`, 70); } else bad(`${at}.ex: missing`);
  const q = v.q || {};
  if (q.type === '文脈規定') { str(q.ja, `${at}.q.ja`, 36, { blank: true, ja: true }); if (arr(q.options, `${at}.q.options`, 4)) q.options.forEach((o, j) => str(o, `${at}.q.options[${j}]`, 8, { noMark: true })); }
  else if (q.type === '言い換え類義') { str(q.ja, `${at}.q.ja`, 36, { mark: true, ja: true }); if (arr(q.options, `${at}.q.options`, 4)) q.options.forEach((o, j) => str(o, `${at}.q.options[${j}]`, 10, { noMark: true })); }
  else if (q.type === '用法') { if (arr(q.options, `${at}.q.options`, 4)) q.options.forEach((o, j) => str(o, `${at}.q.options[${j}]`, 24, { noMark: true, ja: true })); }
  else bad(`${at}.q.type: 文脈規定, 言い換え類義 or 用法`);
  distinct(q.options, `${at}.q`);
  num(q.answer, `${at}.q.answer`, 1, 4);
  str(q.why, `${at}.q.why`, 140);
  return q.type;
}

function checkWords(f, d) {
  const m = /u([1-8])\.json$/.exec(f);
  if (!m || d.unit !== +m[1]) bad(`unit should be ${m ? m[1] : '1 to 8'}`);
  const lessons = d.lessons || {};
  for (let l = 1; l <= 6; l++) {
    const ws = lessons[String(l)];
    if (!arr(ws, `lessons.${l}`, 15)) continue;
    const kinds = new Set(); const types = {}; const answers = new Set();
    ws.forEach((v, i) => {
      const at = `lesson ${l} word ${i + 1}`;
      const t = word(v, at);
      kinds.add(v.kind); types[t] = (types[t] || 0) + 1; answers.add(v.q && v.q.answer);
      const key = v.w;
      if (taught.has(key)) bad(`${at}: ${key} is taught already (${taught.get(key)})`);
      else if (bankWords.has(key)) bad(`${at}: ${key} is in the bank already (${bankWords.get(key)})`);
      else bankWords.set(key, `u${d.unit}l${l}`);
    });
    if (kinds.size < 4) bad(`lesson ${l}: mix at least four kinds of word`);
    for (const t of ['文脈規定', '言い換え類義', '用法']) if ((types[t] || 0) < 4) bad(`lesson ${l}: at least four ${t} questions (${types[t] || 0})`);
    if (answers.size < 3) bad(`lesson ${l}: vary the answer positions`);
  }
}

function checkReading(f, d) {
  const m = /u([1-8])\.json$/.exec(f);
  if (!m || d.unit !== +m[1]) bad(`unit should be ${m ? m[1] : '1 to 8'}`);
  if (!arr(d.items, 'items', 6)) return;
  const KIND = { 1: 'mid', 2: 'info', 3: 'mid', 4: 'info', 5: 'mid', 6: 'pair' };
  d.items.forEach((r, i) => {
    const at = `item ${i + 1}`;
    if (r.lesson !== i + 1) bad(`${at}.lesson: should be ${i + 1}`);
    if (r.kind !== KIND[i + 1]) bad(`${at}.kind: should be ${KIND[i + 1]}`);
    str(r.type, `${at}.type`, 10, { noMark: true }); str(r.skill, `${at}.skill`, 8, { noMark: true }); str(r.en, `${at}.en`, 40);
    if (r.lead != null) str(r.lead, `${at}.lead`, 26, { noMark: true, ja: true });
    if (r.kind === 'pair') {
      if (arr(r.texts, `${at}.texts`, 2)) r.texts.forEach((t, j) => str(t, `${at}.texts[${j}]`, 150, { ja: true }));
      if (r.passage) bad(`${at}: a pair has texts, not a passage`);
    } else {
      if (arr(r.passage, `${at}.passage`) && (r.passage.length < 1 || r.passage.length > 8)) bad(`${at}.passage: 1 to 8 paragraphs or lines`);
      if (Array.isArray(r.passage)) {
        r.passage.forEach((p, j) => str(p, `${at}.passage[${j}]`, 0, { ja: true }));
        const total = r.passage.reduce((n, p) => n + len(p), 0);
        if (total > 360) bad(`${at}.passage: ${total} characters in all, at most 360`);
        if (!r.passage.some((p) => /【/.test(p))) bad(`${at}.passage: mark the signposts in 【】`);
      }
      if (r.texts) bad(`${at}: texts are for a pair`);
    }
    str(r.ask, `${at}.ask`, 30, { noMark: true, ja: true });
    if (arr(r.options, `${at}.options`, 4)) { r.options.forEach((o, j) => str(o, `${at}.options[${j}]`, 24, { noMark: true, ja: true })); distinct(r.options, at); }
    if (arr(r.short, `${at}.short`, 4)) r.short.forEach((o, j) => str(o, `${at}.short[${j}]`, 16, { noMark: true }));
    num(r.answer, `${at}.answer`, 1, 4);
    str(r.tip, `${at}.tip`, 105); str(r.why, `${at}.why`, 140);
    if (arr(r.whyNot, `${at}.whyNot`, 4)) r.whyNot.forEach((w, j) => { if (j + 1 === r.answer) { if (w !== '') bad(`${at}.whyNot: "" for the answer`); } else str(w, `${at}.whyNot[${j}]`, 100); });
  });
  if (new Set(d.items.map((r) => r.answer)).size < 3) bad('vary the answer positions across the unit');
}

function checkListening(f, d) {
  const m = /u([1-8])\.json$/.exec(f);
  if (!m || d.unit !== +m[1]) bad(`unit should be ${m ? m[1] : '1 to 8'}`);
  if (!arr(d.items, 'items', 6)) return;
  const KIND = { 1: 'task', 2: 'point', 3: 'gist', 4: 'task', 5: 'point', 6: 'gist' };
  const TYPE = { task: '課題理解', point: 'ポイント理解', gist: '概要理解' };
  const PARTS = { task: ['q', 'talk', 'q2'], point: ['q', 'talk', 'q2'], gist: ['talk', 'choices'] };
  d.items.forEach((t, i) => {
    const at = `item ${i + 1}`;
    if (t.lesson !== i + 1) bad(`${at}.lesson: should be ${i + 1}`);
    if (t.kind !== KIND[i + 1]) bad(`${at}.kind: should be ${KIND[i + 1]}`);
    if (t.type !== TYPE[t.kind]) bad(`${at}.type: should be ${TYPE[t.kind] || '課題理解, ポイント理解 or 概要理解'}`);
    str(t.ask, `${at}.ask`, 30, { noMark: true, ja: true });
    if (arr(t.options, `${at}.options`, 4)) { t.options.forEach((o, j) => str(o, `${at}.options[${j}]`, 20, { noMark: true, ja: true })); distinct(t.options, at); }
    if (arr(t.short, `${at}.short`, 4)) t.short.forEach((o, j) => str(o, `${at}.short[${j}]`, 16, { noMark: true }));
    num(t.answer, `${at}.answer`, 1, 4);
    num(t.wait, `${at}.wait`, 4, 15);
    str(t.why, `${at}.why`, 200);
    const want = PARTS[t.kind] || [];
    if (arr(t.audio, `${at}.audio`, want.length)) t.audio.forEach((a, j) => {
      if (a.part !== want[j]) bad(`${at}.audio[${j}].part: should be ${want[j]}`);
      if (!arr(a.lines, `${at}.audio[${j}].lines`)) return;
      let total = 0;
      a.lines.forEach((ln, k) => {
        if (!arr(ln, `${at}.audio[${j}].lines[${k}]`, 2)) return;
        if (!['', '男', '女', '1', '2', '3', '4'].includes(ln[0])) bad(`${at}.audio[${j}].lines[${k}]: who must be "", 男, 女 or 1 to 4`);
        str(ln[1], `${at}.audio[${j}].lines[${k}]`, 180, { ja: true });
        total += len(ln[1]);
      });
      if (a.part === 'talk' && total > 300) bad(`${at}.audio[${j}]: the talk is ${total} characters, at most 300`);
      if (a.part === 'choices' && a.lines.filter((ln) => /^[1-4]$/.test(ln[0])).length !== 4) bad(`${at}.audio[${j}]: the choices part says the four choices numbered 1 to 4`);
      if (a.part === 'choices') a.lines.filter((ln) => /^[1-4]$/.test(ln[0])).forEach((ln) => { if (t.options && !t.options.includes(ln[1])) bad(`${at}.audio[${j}]: spoken choice ${ln[0]} differs from the option`); });
    });
    if (t.kind === 'gist' && Array.isArray(t.audio) && t.audio[0] && Array.isArray(t.audio[0].lines) && t.audio[0].lines.some((ln) => /^[1-4]$/.test(ln[0]))) bad(`${at}: the choices are said in the choices part, not the talk`);
  });
  if (new Set(d.items.map((r) => r.answer)).size < 3) bad('vary the answer positions across the unit');
}

function checkReviewN2(f, d) {
  if (!arr(d.patterns, 'patterns', 120)) return;
  const seen = new Set();
  d.patterns.forEach((p, i) => {
    const at = `pattern ${i + 1}`;
    str(p.p, `${at}.p`, 10, { noMark: true }); str(p.en, `${at}.en`, 36); num(p.unit, `${at}.unit`, 1, 12);
    str(p.conn, `${at}.conn`, 24, { mark: true });
    if (p.ex) { str(p.ex.ja, `${at}.ex.ja`, 32, { mark: true, ja: true }); str(p.ex.en, `${at}.ex.en`, 80); } else bad(`${at}.ex: missing`);
    const q = p.q || {};
    str(q.ja, `${at}.q.ja`, 40, { blank: true, ja: true });
    if (arr(q.options, `${at}.q.options`, 4)) { q.options.forEach((o, j) => str(o, `${at}.q.options[${j}]`, 9, { noMark: true })); distinct(q.options, `${at}.q`); }
    num(q.answer, `${at}.q.answer`, 1, 4); str(q.why, `${at}.q.why`, 140);
    const key = String(p.p).replace(/[（(][^）)]*[）)]/g, '').replace(/[〜～\s]/g, '');
    if (seen.has(key)) bad(`${at}: ${p.p} repeats`); seen.add(key);
  });
  const perUnit = {}; d.patterns.forEach((p) => { perUnit[p.unit] = (perUnit[p.unit] || 0) + 1; });
  for (let u = 1; u <= 12; u++) if (perUnit[u] !== 10) bad(`unit ${u}: ${perUnit[u] || 0} patterns, should be 10`);
}

for (const f of files) {
  const d = read(f);
  if (!d) continue;
  where = path.relative(C, f);
  if (/words[\\/]/.test(f)) checkWords(f, d);
  else if (/reading[\\/]/.test(f)) checkReading(f, d);
  else if (/listening[\\/]/.test(f)) checkListening(f, d);
  else if (/review-n2\.json$/.test(f)) checkReviewN2(f, d);
  else bad('not a bank file (content/words, reading, listening or review-n2.json)');
}
console.log(problems ? `${problems} problem(s) in ${files.length} file(s)` : `${files.length} file(s) OK`);
process.exit(problems ? 1 : 0);
