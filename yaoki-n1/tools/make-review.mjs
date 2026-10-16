// Turns the main app's course questions (content/n2, n3: every exam-style and week-test item; n4: the week tests)
// into review items for the N1 app, in the shape its quizzes use. Reading items need their passage, so they are left out.
// usage: node tools/make-review.mjs        (writes content/review-courses.json; run by build-content.mjs as well)
//
// The course markup is converted: {pattern} and ^clue^ become plain, [base|reading] keeps the base only (an N1 learner
// reads N3 kanji), _word_ becomes 【word】. A choice item becomes { kind: 'sentence' } (or 'usage' for 用法, where q is
// the word and the options are sentences); a star item becomes { kind: 'order', pre, post, tiles (right order), star }.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MAIN = path.join(HERE, '..', '..', 'content');
const OUT = path.join(HERE, '..', 'content', 'review-courses.json');
const plain = (s) => String(s || '').replace(/\[([^|\]]*)\|[^\]]*\]/g, '$1').replace(/[{}^]/g, '').replace(/_([^_]+)_/g, '【$1】');
const noMark = (s) => plain(s).replace(/[【】]/g, '');
const SOURCES = [
  ['N2', 'n2', { exam: true, test: true }],
  ['N3', 'n3', { exam: true, test: true }],
  ['N4', 'n4', { exam: false, test: true }],
];

export function makeReview() {
  const items = [];
  const seen = new Set();
  const take = (level, it, from) => {
    if (!it || !it.id || seen.has(it.id)) return;
    if (/読解|内容理解|情報検索|課題|概要|即時|ポイント|統合|発話/.test(it.type || '') || it.passage || it.script) return;
    seen.add(it.id);
    const why = it.explain || (Array.isArray(it.why) ? it.why.filter(Boolean).join(' ') : '');
    if (it.kind === 'star') {
      items.push({ id: 'x.' + it.id, level, from, type: it.type, kind: 'order', pre: noMark(it.before), post: noMark(it.after), tiles: it.tiles.map(noMark), star: it.star, why });
      return;
    }
    if (it.kind !== 'choice' || !Array.isArray(it.options)) return;
    const base = { id: 'x.' + it.id, level, from, type: it.type, options: it.options.map(noMark), answer: it.answer, why };
    if (it.short) base.short = it.short.map(noMark);
    if (it.type === '用法') items.push({ ...base, kind: 'usage', word: noMark(it.q) });
    else items.push({ ...base, kind: 'sentence', ja: plain(it.q) });
  };
  for (const [level, dir, what] of SOURCES) {
    const d = path.join(MAIN, dir);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d).filter((x) => /^u\d+\.json$/.test(x)).sort()) {
      const u = JSON.parse(fs.readFileSync(path.join(d, f), 'utf8'));
      if (!u || typeof u !== 'object') continue;
      if (what.exam) for (const [day, x] of Object.entries(u.days || {})) for (const it of ((x.grammar || {}).exam || [])) take(level, it, `${f.replace('.json', '')} day ${day}`);
      if (what.test) { const t = Array.isArray(u.test) ? u.test : (u.test || {}).items || []; for (const it of t) take(level, it, `${f.replace('.json', '')} test`); }
    }
  }
  return items;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const items = makeReview();
  fs.writeFileSync(OUT, JSON.stringify({ source: 'the main app\'s N2, N3 and N4 courses (content/), converted by tools/make-review.mjs', count: items.length, items }));
  const by = {};
  items.forEach((it) => { const k = it.level + ' ' + it.type; by[k] = (by[k] || 0) + 1; });
  console.log(`review-courses.json: ${items.length} items`, by);
}
