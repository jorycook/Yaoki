// Checks N1 lesson files against content/FORMAT.md: their shape, the length limits the screens can hold, the markup,
// and that they teach what the syllabus gives for that lesson.
// usage: node tools/check-content.mjs [lesson files…]        (no files: every file in content/lessons)
// Prints one line per problem and a summary; the exit status is 1 when there are problems.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONTENT = path.join(HERE, '..', 'content');
const files = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(path.join(CONTENT, 'lessons')).filter((f) => f.endsWith('.json')).sort().map((f) => path.join(CONTENT, 'lessons', f));
let syllabus = null;
try { syllabus = JSON.parse(fs.readFileSync(path.join(CONTENT, 'syllabus.json'), 'utf8')); } catch (e) { /* checked without it */ }

/* what the learner sees: markup and furigana do not count */
export const visible = (s) => String(s).replace(/《[^》]*》/g, '').replace(/[【】]/g, '');
const len = (s) => [...visible(s)].length;
const BLANK = '（　　）';
const norm = (p) => String(p).replace(/[（(][^）)]*[）)]/g, '').replace(/[〜～\s]/g, '');

let problems = 0;
function check(file) {
  const where = path.basename(file);
  const bad = (msg) => { problems += 1; console.log(`${where}: ${msg}`); };
  let d;
  try { d = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { bad('not valid JSON: ' + e.message); return; }
  const id = where.replace(/\.json$/, '');
  const m = /^u([1-8])l([1-6])$/.exec(id);
  if (!m) bad('the file name must be u<1-8>l<1-6>.json');
  if (d.id !== id) bad(`id should be "${id}"`);
  if (m && (d.unit !== +m[1] || d.lesson !== +m[2])) bad('unit and lesson must match the file name');

  const str = (v, label, max, opts = {}) => {
    if (typeof v !== 'string' || !v.trim()) { bad(`${label}: missing`); return false; }
    if (max && len(v) > max) bad(`${label}: ${len(v)} characters, at most ${max}: ${visible(v)}`);
    const open = (v.match(/【/g) || []).length;
    if (open !== (v.match(/】/g) || []).length || /【[^】]*【/.test(v)) bad(`${label}: unbalanced 【】`);
    if (opts.mark && !open) bad(`${label}: needs the 【】 mark`);
    if (opts.noMark && (open || /《/.test(v))) bad(`${label}: no markup here`);
    if (opts.blank && !v.includes(BLANK)) bad(`${label}: needs the blank （　　）`);
    if (/《/.test(v) && !/[一-鿿々]《/.test(v)) bad(`${label}: 《》 must follow kanji`);
    if (opts.ja && /[,.!?()]/.test(visible(v).replace(/[0-9]+[.,][0-9]+/g, ''))) bad(`${label}: use Japanese punctuation (、。！？（）)`);
    return true;
  };
  const num = (v, label, lo, hi) => { if (!Number.isInteger(v) || v < lo || v > hi) bad(`${label}: must be a whole number from ${lo} to ${hi}`); };
  const arr = (v, label, n) => { if (!Array.isArray(v) || (n && v.length !== n)) { bad(`${label}: must be a list of ${n}`); return false; } return true; };
  const distinct = (v, label) => { if (Array.isArray(v) && new Set(v.map(visible)).size !== v.length) bad(`${label}: options repeat`); };

  const g = d.grammar || {};
  if (arr(g.patterns, 'grammar.patterns', 3)) g.patterns.forEach((p, i) => {
    const at = `pattern ${i + 1}`;
    str(p.p, `${at}.p`, 10, { noMark: true });
    str(p.en, `${at}.en`, 36);
    if (arr(p.conn, `${at}.conn`) && (p.conn.length < 1 || p.conn.length > 3)) bad(`${at}.conn: 1 to 3 rows`);
    (p.conn || []).forEach((row, j) => { if (arr(row, `${at}.conn[${j}]`, 2)) { str(row[0], `${at}.conn[${j}] label`, 5, { noMark: true }); str(row[1], `${at}.conn[${j}] formula`, 18, { mark: true }); } });
    if (arr(p.ex, `${at}.ex`, 2)) p.ex.forEach((e, j) => { str(e.ja, `${at}.ex[${j}].ja`, 32, { mark: true, ja: true }); str(e.en, `${at}.ex[${j}].en`, 80); });
    str(p.note, `${at}.note`, 110);
    str(p.bad, `${at}.bad`, 19, { noMark: true, ja: true });
    str(p.good, `${at}.good`, 19, { noMark: true, ja: true });
    if (p.bad === p.good) bad(`${at}: bad and good are the same`);
    if (arr(p.tag, `${at}.tag`, 2)) { str(p.tag[0], `${at}.tag ja`, 6, { noMark: true }); str(p.tag[1], `${at}.tag en`, 18); }
    if (p.cmp) { str(p.cmp.ja, `${at}.cmp.ja`, 21, { mark: true, ja: true }); str(p.cmp.en, `${at}.cmp.en`, 50); } else bad(`${at}.cmp: missing`);
  });
  const c = g.compare || {};
  str(c.intro, 'compare.intro', 95);
  const ck = c.check || {};
  str(ck.scene, 'compare.check.scene', 7, { noMark: true });
  str(ck.ja, 'compare.check.ja', 21, { blank: true, ja: true });
  if (arr(ck.options, 'compare.check.options', 3)) { ck.options.forEach((o, j) => str(o, `compare.check.options[${j}]`, 6, { noMark: true })); distinct(ck.options, 'compare.check'); }
  num(ck.answer, 'compare.check.answer', 1, 3);
  if (arr(ck.notes, 'compare.check.notes', 3)) ck.notes.forEach((n, j) => {
    str(n, `compare.check.notes[${j}]`, 75);
    const want = j + 1 === ck.answer ? 'せいかい！' : 'おしい！';
    if (typeof n === 'string' && !n.startsWith(want)) bad(`compare.check.notes[${j}]: should start with ${want}`);
  });
  if (arr(g.drills, 'grammar.drills', 3)) g.drills.forEach((q, i) => {
    const at = `drill ${i + 1}`;
    str(q.ja, `${at}.ja`, 40, { blank: true, mark: true, ja: true });
    if (arr(q.options, `${at}.options`, 4)) { q.options.forEach((o, j) => str(o, `${at}.options[${j}]`, 7, { noMark: true })); distinct(q.options, at); }
    num(q.answer, `${at}.answer`, 1, 4);
    if (arr(q.why, `${at}.why`, 4)) q.why.forEach((w, j) => str(w, `${at}.why[${j}]`, 85));
  });
  const st = g.star || {};
  str(st.pre, 'star.pre', 12, { noMark: true }); str(st.post, 'star.post', 10, { noMark: true });
  if (arr(st.tiles, 'star.tiles', 4)) { st.tiles.forEach((t, j) => str(t, `star.tiles[${j}]`, 5, { noMark: true })); distinct(st.tiles, 'star'); }
  num(st.star, 'star.star', 0, 3);
  str(st.hint, 'star.hint', 100); str(st.why, 'star.why', 120);
  if (arr(g.exam, 'grammar.exam', 3)) {
    const kinds = g.exam.map((q) => q.kind).sort().join(',');
    if (kinds !== 'form,form,order') bad('grammar.exam: two "form" questions and one "order" question');
    g.exam.forEach((q, i) => {
      const at = `exam ${i + 1}`;
      if (q.kind === 'form') {
        str(q.ja, `${at}.ja`, 40, { blank: true, ja: true });
        if (arr(q.options, `${at}.options`, 4)) { q.options.forEach((o, j) => str(o, `${at}.options[${j}]`, 9, { noMark: true })); distinct(q.options, at); }
        num(q.answer, `${at}.answer`, 1, 4);
      } else if (q.kind === 'order') {
        str(q.pre, `${at}.pre`, 10, { noMark: true }); str(q.post, `${at}.post`, 12, { noMark: true });
        if (arr(q.tiles, `${at}.tiles`, 4)) { q.tiles.forEach((t, j) => str(t, `${at}.tiles[${j}]`, 6, { noMark: true })); distinct(q.tiles, at); }
        num(q.star, `${at}.star`, 0, 3);
      }
      str(q.why, `${at}.why`, 170);
    });
  }

  if (arr(d.vocab, 'vocab', 5)) {
    const types = new Set();
    d.vocab.forEach((v, i) => {
      const at = `word ${i + 1}`;
      str(v.w, `${at}.w`, 8, { noMark: true }); str(v.r, `${at}.r`, 12, { noMark: true }); str(v.en, `${at}.en`, 34);
      if (v.ex) { str(v.ex.ja, `${at}.ex.ja`, 30, { mark: true, ja: true }); str(v.ex.en, `${at}.ex.en`, 70); } else bad(`${at}.ex: missing`);
      const q = v.q || {};
      types.add(q.type);
      if (q.type === '文脈規定') { str(q.ja, `${at}.q.ja`, 36, { blank: true, ja: true }); if (arr(q.options, `${at}.q.options`, 4)) q.options.forEach((o, j) => str(o, `${at}.q.options[${j}]`, 8, { noMark: true })); }
      else if (q.type === '言い換え類義') { str(q.ja, `${at}.q.ja`, 36, { mark: true, ja: true }); if (arr(q.options, `${at}.q.options`, 4)) q.options.forEach((o, j) => str(o, `${at}.q.options[${j}]`, 10, { noMark: true })); }
      else if (q.type === '用法') { if (arr(q.options, `${at}.q.options`, 4)) q.options.forEach((o, j) => str(o, `${at}.q.options[${j}]`, 24, { noMark: true, ja: true })); }
      else bad(`${at}.q.type: 文脈規定, 言い換え類義 or 用法`);
      distinct(q.options, `${at}.q`);
      num(q.answer, `${at}.q.answer`, 1, 4);
      str(q.why, `${at}.q.why`, 140);
    });
    if (types.size < 2) bad('vocab: use at least two question types');
  }

  const r = d.reading || {};
  str(r.skill, 'reading.skill', 8, { noMark: true }); str(r.en, 'reading.en', 40);
  str(r.passage, 'reading.passage', 175, { mark: true, ja: true });
  str(r.ask, 'reading.ask', 20, { noMark: true, ja: true });
  if (arr(r.options, 'reading.options', 4)) { r.options.forEach((o, j) => str(o, `reading.options[${j}]`, 19, { noMark: true, ja: true })); distinct(r.options, 'reading'); }
  if (arr(r.short, 'reading.short', 4)) r.short.forEach((o, j) => str(o, `reading.short[${j}]`, 16, { noMark: true }));
  num(r.answer, 'reading.answer', 1, 4);
  str(r.tip, 'reading.tip', 105); str(r.why, 'reading.why', 110);
  if (arr(r.whyNot, 'reading.whyNot', 4)) r.whyNot.forEach((w, j) => {
    if (j + 1 === r.answer) { if (w !== '') bad('reading.whyNot: the entry for the answer must be ""'); }
    else str(w, `reading.whyNot[${j}]`, 100);
  });

  const l = d.listening || {};
  if (l.who !== '男' && l.who !== '女') bad('listening.who: "男" or "女"');
  str(l.line, 'listening.line', 30, { noMark: true, ja: true });
  if (arr(l.replies, 'listening.replies', 3)) { l.replies.forEach((o, j) => str(o, `listening.replies[${j}]`, 16, { noMark: true, ja: true })); distinct(l.replies, 'listening'); }
  num(l.answer, 'listening.answer', 1, 3);
  if (arr(l.notes, 'listening.notes', 3)) l.notes.forEach((n, j) => str(n, `listening.notes[${j}]`, 55));
  if (arr(l.short, 'listening.short', 3)) l.short.forEach((n, j) => str(n, `listening.short[${j}]`, 14, { noMark: true }));

  // what the syllabus asks this lesson to teach
  if (syllabus && m) {
    const day = syllabus.weeks?.[+m[1] - 1]?.days?.[+m[2] - 1];
    if (day) {
      const want = day.grammar.map((x) => norm(x.p));
      const have = (g.patterns || []).map((x) => norm(x.p));
      if (want.join('|') !== have.join('|')) bad(`grammar patterns should be the syllabus's: ${day.grammar.map((x) => x.p).join(', ')}`);
      const wantW = day.vocab.map((x) => x.w);
      const haveW = (d.vocab || []).map((x) => x.w);
      if (wantW.join('|') !== haveW.join('|')) bad(`vocab should be the syllabus's: ${wantW.join(', ')}`);
    }
  }
}

for (const f of files) check(f);
console.log(problems ? `${problems} problem(s) in ${files.length} file(s)` : `${files.length} file(s) OK`);
process.exit(problems ? 1 : 0);
