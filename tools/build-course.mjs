// Builds yaoki/project/course-n2.js from content/n2/*.json and checks every item on the way.
// usage: node tools/build-course.mjs          (exits 1 and lists the problems if anything is wrong)
//
// The generated file sets window.__ykCourseData = { level, units: [...], items: { id: item } }.
// It is loaded next to course.js by the screens on the design canvas and by the app.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'content', 'n2');
const OUT = path.join(ROOT, 'yaoki', 'project', 'course-n2.js');

const problems = [];
const bad = (where, msg) => problems.push(where + ': ' + msg);
const syllabus = JSON.parse(fs.readFileSync(path.join(SRC, 'units.json'), 'utf8'));
const items = {};

// the markup must balance: {…} highlight, _…_ underline, ^…^ clue, [base|reading] ruby
function markup(where, text) {
  if (typeof text !== 'string') return;
  for (const [ch, name] of [['_', 'underline'], ['^', 'clue']]) if ((text.split(ch).length - 1) % 2) bad(where, `unbalanced ${name} marks in "${text}"`);
  let depth = 0;
  for (const c of text) { if (c === '{') depth++; if (c === '}') depth--; if (depth < 0 || depth > 1) break; }
  if (depth !== 0) bad(where, `unbalanced { } in "${text}"`);
  for (const m of text.matchAll(/\[([^\]]*)\]/g)) if (!/^[^|]+\|[^|]+$/.test(m[1])) bad(where, `ruby must be [base|reading]: [${m[1]}]`);
}

function item(where, it, ctx) {
  if (!it || typeof it !== 'object') return bad(where, 'missing item');
  if (!it.id) bad(where, 'item without an id');
  else if (items[it.id]) bad(where, 'duplicate item id ' + it.id);
  if (!it.type) bad(it.id || where, 'item without a type (the exam item type, such as 文の文法1)');
  if (it.kind === 'choice') {
    if (!it.q) bad(it.id, 'choice item without q');
    markup(it.id + '.q', it.q);
    if (!Array.isArray(it.options) || it.options.length < 2) bad(it.id, 'needs at least two options');
    else {
      if (!(it.answer >= 1 && it.answer <= it.options.length)) bad(it.id, 'answer must be 1 to ' + it.options.length);
      if (new Set(it.options).size !== it.options.length) bad(it.id, 'two options are the same');
      it.options.forEach((o, k) => markup(`${it.id}.options[${k}]`, o));
      if (it.why && it.why.length !== it.options.length) bad(it.id, 'why must have one line per option');
      if (it.short && it.short.length !== it.options.length) bad(it.id, 'short must have one entry per option');
      if (!it.why && !it.explain) bad(it.id, 'needs why (one line per option) or explain');
      if (it.why) it.why.forEach((w, k) => { if (k + 1 !== it.answer && !w && !it.explain) bad(it.id, `no reason for wrong option ${k + 1}`); });
      if (typeof it.q === 'string' && !/（　　）|_[^_]+_|★/.test(it.q) && !/読解|内容理解|主張|情報検索|課題|概要|即時|ポイント|統合|用法/.test(it.type)) bad(it.id, 'q has no （　　） blank and no _underlined_ word');
    }
  } else if (it.kind === 'star') {
    if (!Array.isArray(it.tiles) || it.tiles.length !== 4) bad(it.id, 'a star item has exactly four tiles, in the right order');
    if (!(it.star >= 0 && it.star <= 3)) bad(it.id, 'star must be 0 to 3 (the tile position that carries the star)');
    const bank = it.bank || [];
    if (bank.length !== 4 || [...bank].sort().join() !== '0,1,2,3') bad(it.id, 'bank must list the four tiles 0 to 3 in the order they are shown');
    else if (bank.every((b, k) => b === k)) bad(it.id, 'bank shows the tiles already in the right order');
    if (new Set(it.tiles || []).size !== 4) bad(it.id, 'two tiles are the same');
    if (!it.full || !it.explain) bad(it.id, 'a star item needs full (the whole sentence) and explain');
    markup(it.id + '.full', it.full);
    const joined = (it.before || '') + (it.tiles || []).join('') + (it.after || '');
    const plainFull = String(it.full || '').replace(/\[([^|\]]*)\|[^\]]*\]/g, '$1').replace(/[{}_^]/g, '');
    if (plainFull !== joined) bad(it.id, `full "${plainFull}" is not before + tiles + after "${joined}"`);
  } else bad(it.id || where, 'kind must be choice or star');
  ['explain', 'hint'].forEach((k) => markup(`${it.id}.${k}`, it[k]));
  items[it.id] = { ...it, ...ctx };
}

const units = syllabus.units.map((u) => {
  const file = path.join(SRC, `u${String(u.n).padStart(2, '0')}.json`);
  const content = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { days: {}, test: [] };
  const days = [];
  for (let d = 1; d <= 6; d++) {
    const title = d <= 5 ? u.days[d - 1] : 'まとめ：似ている文法';
    const day = (content.days || {})[d];
    if (!day) { days.push({ title }); continue; }
    const where = `u${u.n}d${d}`;
    const ctx = { unit: u.n, day: d };
    if (day.title !== title) bad(where, `title "${day.title}" differs from the syllabus "${title}"`);
    const g = day.grammar || {};
    (g.points || []).forEach((p, k) => {
      if (!p.form || !p.gloss) bad(`${where}.p${k + 1}`, 'a grammar point needs form and gloss');
      (p.connect || []).forEach((c) => markup(where, c.rule));
      (p.examples || []).forEach((e) => { markup(where, e.ja); if (!e.en) bad(where, 'example without English: ' + e.ja); });
    });
    if (d <= 5 && (g.points || []).length !== 2) bad(where, 'a study day teaches two grammar points');
    if (g.compare) { (g.compare.forms || []).forEach((f) => markup(where, f.ja)); item(where + '.compare', g.compare.check, { ...ctx, step: 'compare' }); }
    (g.drill || []).forEach((it) => item(where + '.drill', it, { ...ctx, step: 'drill' }));
    (g.exam || []).forEach((it) => item(where + '.exam', it, { ...ctx, step: 'exam' }));
    if ((g.drill || []).length < 4) bad(where, 'a drill needs at least 4 items');
    if ((g.exam || []).length !== 3) bad(where, 'the exam-style step has 3 items');
    if (day.scene) {
      if ((day.scene.words || []).length < 4) bad(where, 'a scene needs at least 4 words');
      item(where + '.scene', day.scene.check, { ...ctx, step: 'scene' });
    } else bad(where, 'no scene');
    if (day.skill) {
      if (!['reading', 'listening'].includes(day.skill.kind)) bad(where, 'skill kind must be reading or listening');
      markup(where + '.passage', day.skill.passage);
      item(where + '.skill', day.skill.item, { ...ctx, step: 'skill' });
    } else bad(where, 'no reading or listening');
    days.push({ ...day, title });
  }
  (content.test || []).forEach((it) => item(`u${u.n}.test`, it, { unit: u.n, step: 'test' }));
  return { n: u.n, ja: u.ja, en: u.en, days, test: content.test || [] };
});

// the mini mock's questions, so the notebook can show and re-ask the ones that were missed
const mini = JSON.parse(fs.readFileSync(path.join(SRC, 'mini.json'), 'utf8'));
mini.items.forEach((it) => item('mini', it, { step: 'mock' }));

if (problems.length) {
  console.log(problems.length + ' problem(s) in the course content:\n  ' + problems.join('\n  '));
  process.exit(1);
}
const body = JSON.stringify({ level: syllabus.level, units, items });
fs.writeFileSync(OUT, `/* Generated by tools/build-course.mjs from content/n2/*.json. Do not edit: change the content and rebuild. */\nwindow.__ykCourseData = ${body};\n`);
const ready = units.reduce((n, u) => n + u.days.filter((d) => d.grammar).length, 0);
console.log(`course-n2.js: ${units.length} units, ${ready} study days written, ${Object.keys(items).length} items, ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
