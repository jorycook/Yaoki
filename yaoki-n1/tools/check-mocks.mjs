// Checks N1 mini mock files against content/MOCKS.md: their shape, the length limits the screens can hold, the markup,
// the parts of the listening audio, and that each id is unique and matches its file name.
// usage: node tools/check-mocks.mjs [mock files…]        (no files: every file in content/mocks)
// Prints one line per problem and a summary; the exit status is 1 when there are problems.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MOCKS = path.join(HERE, '..', 'content', 'mocks');
const inFolder = () => (fs.existsSync(MOCKS) ? fs.readdirSync(MOCKS).filter((f) => f.endsWith('.json')).sort().map((f) => path.join(MOCKS, f)) : []);
const files = process.argv.slice(2).length ? process.argv.slice(2) : inFolder();
const load = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

/* what the learner sees: furigana, 【】 and the blanks （　　） and ＿＿★＿ do not count (check-content's visible(), and the blanks) */
const BLANK = '（　　）';
const visible = (s) => String(s).replace(/《[^》]*》/g, '').replace(/[【】]/g, '').split(BLANK).join('').replace(/[＿★]{4}/g, '');
const len = (s) => [...visible(s)].length;
const count = (s, sub) => String(s).split(sub).length - 1;

/* the real paper, by section: each question type's kind, area, 問題 number and rubric (MOCKS.md, "The shape of a mock") */
const R_READ = '次の文章を読んで、後の問いに対する答えとして最もよいものを選びなさい。';
const TYPES = [
  {
    漢字読み: ['sentence', 'v', 1, '＿＿＿の言葉の読み方として最もよいものを選びなさい。'],
    文脈規定: ['sentence', 'v', 2, '（　　）に入れるのに最もよいものを選びなさい。'],
    言い換え類義: ['sentence', 'v', 3, '＿＿＿の言葉に意味が最も近いものを選びなさい。'],
    用法: ['usage', 'v', 4, '次の言葉の使い方として最もよいものを選びなさい。'],
    文の文法1: ['sentence', 'g', 5, '（　　）に入れるのに最もよいものを選びなさい。'],
    文の文法2: ['sentence', 'g', 6, '次の文の★に入る最もよいものを選びなさい。'],
    文章の文法: ['passage', 'g', 7, '次の文章を読んで、文章全体の内容を考えて、（　　）に入る最もよいものを選びなさい。'],
    '内容理解（短文）': ['passage', 'r', 8, R_READ],
    '内容理解（中文）': ['passage', 'r', 9, R_READ],
    '内容理解（長文）': ['passage', 'r', 10, R_READ],
    統合理解: ['pair', 'r', 11, '次のAとBの文章を読んで、後の問いに対する答えとして最もよいものを選びなさい。'],
    主張理解: ['passage', 'r', 12, R_READ],
    情報検索: ['passage', 'r', 13, null],
  },
  {
    課題理解: ['task', 'l', 1, 'まず質問を聞いてください。それから話を聞いて、最もよいものを選んでください。'],
    概要理解: ['gist', 'l', 3, 'まず話を聞いてください。それから、質問とせんたくしを聞いて、最もよいものを選んでください。'],
    即時応答: ['quick', 'l', 4, 'まず文を聞いてください。それから、それに対する返事を聞いて、最もよいものを選んでください。'],
  },
];
/* what a sentence question's ja carries: the underlined word, the blank, or the four blanks of sentence order */
const SENTENCE = { 漢字読み: 'mark', 言い換え類義: 'mark', 文脈規定: 'blank', 文の文法1: 'blank', 文の文法2: 'stars' };
/* each kind's own fields, the length of its options, and for listening its audio parts in order */
const KIND = {
  sentence: { fields: ['ja', 'full'], options: 12 },
  usage: { fields: ['word', 'full'], options: 30 },
  passage: { fields: ['lead', 'passage', 'ask'], options: 20 },
  pair: { fields: ['texts', 'ask'], options: 20 },
  task: { fields: ['ask', 'audio', 'wait'], options: 16, parts: ['q', 'talk', 'q2'] },
  gist: { fields: ['ask', 'audio', 'wait'], options: 20, parts: ['talk', 'choices'] },
  quick: { fields: ['ask', 'audio', 'wait'], options: 24, parts: ['line', 'replies'], n: 3, ask: 45 },
};
const COMMON = ['m', 'type', 'area', 'kind', 'rubric', 'options', 'answer', 'short', 'why'];
const SECTIONS = [
  { ja: '言語知識（文字・語彙・文法）・読解', short: '言語知識・読解', en: 'Vocabulary, grammar, reading', min: true, kinds: ['sentence', 'usage', 'passage', 'pair'], items: [8, 9] },
  { ja: '聴解', short: '聴解', en: 'Listening', min: false, kinds: ['task', 'gist', 'quick'], items: [2, 4] },
];
const AREAS = { v: '文字・語彙', g: '文法', r: '読解', l: '聴解' };
const WHO = ['', '男', '女', '1', '2', '3', '4'];

/* every mock id in the files checked and in content/mocks, for the check that no two files share one */
const ids = new Map();
for (const f of new Set([...files, ...inFolder()].map((f) => path.resolve(f)))) {
  try { const id = load(f).id; if (Number.isInteger(id)) ids.set(id, [...(ids.get(id) || []), f]); } catch (e) { /* reported when checked */ }
}

let problems = 0;
function check(file) {
  const where = path.basename(file);
  const bad = (msg) => { problems += 1; console.log(`${where}: ${msg}`); };
  let d;
  try { d = load(file); } catch (e) { bad('not valid JSON: ' + e.message); return; }
  if (!d || typeof d !== 'object' || Array.isArray(d)) { bad('not a mock: the file must hold one object'); return; }

  const str = (v, label, max, o = {}) => {
    if (typeof v !== 'string' || !v.trim()) { bad(`${label}: missing`); return false; }
    if (max && len(v) > max) bad(`${label}: ${len(v)} characters, at most ${max}: ${visible(v)}`);
    let depth = 0, even = true;
    for (const ch of v) { depth += ch === '【' ? 1 : ch === '】' ? -1 : 0; if (depth < 0 || depth > 1) even = false; }
    if (!even || depth || v.includes('【】')) bad(`${label}: unbalanced 【】`);
    if (o.mark === 'need' && !v.includes('【')) bad(`${label}: needs the 【】 mark`);
    if (!o.mark && /[【】]/.test(v)) bad(`${label}: no 【】 here`);
    if (/[《》]/.test(v)) {
      if (!o.furi) bad(`${label}: no furigana 《》 here: only in a listening script line`);
      else if (/[《》]/.test(v.replace(/[一-鿿々〆ヶ]《[ぁ-ゖァ-ヺー]+》/g, ''))) bad(`${label}: 《》 must hold a reading in kana, straight after kanji`);
    }
    if (o.ja && (v.match(/[（(][ 　]*[）)]/g) || []).some((b) => b !== BLANK)) bad(`${label}: write the blank as （　　）, two full-width spaces in full-width brackets`);
    if (o.ja && /[,.!?()]/.test(visible(v).replace(/[0-9]+[.,][0-9]+/g, ''))) bad(`${label}: use Japanese punctuation (、。！？（）)`);
    if (o.en && v.includes('!')) bad(`${label}: no exclamation marks`);
    if (o.en && /\bnote that\b/i.test(v)) bad(`${label}: no "Note that"`);
    return true;
  };
  const num = (v, label, lo, hi) => { if (!Number.isInteger(v) || v < lo || v > hi) { bad(`${label}: must be a whole number from ${lo} to ${hi}`); return false; } return true; };
  const arr = (v, label, n) => { if (!Array.isArray(v) || (n && v.length !== n)) { bad(`${label}: must be a list` + (n ? ` of ${n}` : '')); return false; } return true; };
  const obj = (v, label) => { if (!v || typeof v !== 'object' || Array.isArray(v)) { bad(`${label}: missing`); return false; } return true; };
  const only = (v, label, keys) => Object.keys(v).filter((k) => !keys.includes(k)).forEach((k) => bad(`${label}: unknown field "${k}"`));
  const distinct = (v, label) => { if (new Set(v.map((x) => visible(x))).size !== v.length) bad(`${label}: they repeat`); };

  // the mock
  const fm = /^m([1-9][0-9]*)\.json$/.exec(where);
  if (!fm) bad('the file name must be m<id>.json');
  if (!Number.isInteger(d.id) || d.id < 1) bad('id: a whole number from 1');
  else {
    if (fm && d.id !== +fm[1]) bad(`id should be ${fm[1]}, as in the file name`);
    const others = (ids.get(d.id) || []).filter((f) => f !== path.resolve(file));
    if (others.length) bad(`id ${d.id} is also the id of ${others.map((f) => (path.relative(process.cwd(), f).startsWith('..') ? f : path.relative(process.cwd(), f))).join(', ')}`);
  }
  only(d, 'mock', ['id', 'title', 'en', 'after', 'about', 'break', 'sections']);
  str(d.title, 'title', 8, { ja: true });
  str(d.en, 'en', 14, { en: true });
  num(d.after, 'after', 0, 8);
  if (obj(d.about, 'about')) {
    only(d.about, 'about', ['ja', 'en']);
    str(d.about.ja, 'about.ja', 26, { ja: true });
    str(d.about.en, 'about.en', 70, { en: true });
  }
  num(d.break, 'break', 1, 10);
  if (!arr(d.sections, 'sections', 2)) return;

  const areas = new Set();
  const answers = [];
  let n = 0;                                          // the question's place in the whole paper, as in m<id>.<n>
  d.sections.forEach((sec, s) => {
    const S = SECTIONS[s];
    const at = `section ${s + 1}`;
    if (!obj(sec, at)) return;
    if (!S.min && 'min' in sec) bad(`${at}.min: none: section ${s + 1} has no clock, the audio sets the pace`);
    only(sec, at, ['ja', 'short', 'en', 'items', 'min']);
    str(sec.ja, `${at}.ja`, 18, { ja: true });
    str(sec.short, `${at}.short`, 8, { ja: true });
    str(sec.en, `${at}.en`, 30, { en: true });
    for (const k of ['ja', 'short', 'en']) if (typeof sec[k] === 'string' && sec[k] !== S[k]) bad(`${at}.${k}: should be "${S[k]}", as in m1.json`);
    if (S.min) num(sec.min, `${at}.min`, 5, 20);
    if (!arr(sec.items, `${at}.items`)) return;
    if (sec.items.length < S.items[0] || sec.items.length > S.items[1]) bad(`${at}.items: ${sec.items.length} questions, ${S.items[0]} to ${S.items[1]} in section ${s + 1}`);
    let last = 0;
    sec.items.forEach((it) => {
      n += 1;
      if (!obj(it, `item ${n}`)) return;
      const at = `item ${n}` + (typeof it.type === 'string' ? ` (${it.type})` : '');
      const K = S.kinds.includes(it.kind) ? KIND[it.kind] : null;
      const T = TYPES[s][it.type];
      const fits = K && !(T && T[0] !== it.kind);       // the kind's own fields are checked only when the kind is right
      if (!K) bad(`${at}.kind: one of ${S.kinds.join(', ')} in section ${s + 1}`);
      else if (fits) only(it, at, COMMON.concat(K.fields));
      if (str(it.m, `${at}.m`, 5)) {
        const mm = /^問題([1-9][0-9]?)$/.exec(it.m);
        if (!mm) bad(`${at}.m: as "問題5"`);
        else {
          if (+mm[1] < last) bad(`${at}.m: ${it.m} after 問題${last}: keep the order of the real paper`);
          last = +mm[1];
          if (T && +mm[1] !== T[2]) bad(`${at}.m: ${it.type} is 問題${T[2]} on the real paper`);
        }
      }
      if (str(it.type, `${at}.type`, 8, { ja: true })) {
        if (T && K && T[0] !== it.kind) bad(`${at}.kind: ${it.type} is a "${T[0]}" question`);
        if (!T && K && it.kind !== 'passage') bad(`${at}.type: a "${it.kind}" question is ${Object.keys(TYPES[s]).filter((t) => TYPES[s][t][0] === it.kind).join(' or ')}`);
      }
      const area = T ? T[1] : s === 1 ? 'l' : it.kind === 'passage' ? 'r' : null;
      if (!AREAS[it.area]) bad(`${at}.area: "v", "g", "r" or "l"`);
      else if (area && it.area !== area) bad(`${at}.area: should be "${area}" (${AREAS[area]})`);
      areas.add(it.area);
      if (str(it.rubric, `${at}.rubric`, 50, { ja: true }) && T && T[3] && it.rubric !== T[3]) bad(`${at}.rubric: should be the real paper's: ${T[3]}`);

      // options, answer, short labels, why
      const nOpt = (K && K.n) || 4;
      if (arr(it.options, `${at}.options`, nOpt)) it.options.forEach((o, j) => str(o, `${at}.option ${j + 1}`, K && K.options, { ja: true }));
      const opts = Array.isArray(it.options) && it.options.length === nOpt && it.options.every((o) => typeof o === 'string' && o.trim());
      if (opts) distinct(it.options, `${at}.options`);
      const answered = num(it.answer, `${at}.answer`, 1, nOpt);
      if (answered) answers.push(it.answer);
      const right = opts && answered ? it.options[it.answer - 1] : null;
      if (it.short !== undefined) {
        if (arr(it.short, `${at}.short`, nOpt)) it.short.forEach((o, j) => str(o, `${at}.short ${j + 1}`, 16, { ja: true }));
        if (Array.isArray(it.short) && it.short.length === nOpt && it.short.every((o) => typeof o === 'string')) distinct(it.short, `${at}.short`);
      } else if (opts) {
        const long = it.options.findIndex((o) => len(o) > 16);
        if (long >= 0) bad(`${at}.short: needed, as option ${long + 1} is over 16 characters`);
      }
      str(it.why, `${at}.why`, 240, { en: true });

      if (!fits) return;
      if (it.kind === 'sentence') {
        const need = SENTENCE[it.type];
        let before = problems;
        if (str(it.ja, `${at}.ja`, 50, { ja: true, mark: need && need !== 'mark' ? false : 'may' }) && need) {
          const ja = it.ja;
          const stars = ja.match(/[＿★]+/g) || [];
          if (need === 'mark' && count(ja, '【') !== 1) bad(`${at}.ja: needs the word asked about in 【】, once`);
          if (need === 'blank' && count(ja, BLANK) !== 1) bad(`${at}.ja: needs the blank （　　）, once`);
          if (need !== 'blank' && ja.includes(BLANK)) bad(`${at}.ja: no blank （　　） in ${it.type}`);
          if (need === 'stars' && (stars.length !== 1 || stars[0].length !== 4 || count(stars[0], '★') !== 1)) bad(`${at}.ja: needs the four blanks ＿＿★＿ once: three ＿ and one ★`);
          if (need !== 'stars' && stars.length) bad(`${at}.ja: no ＿ or ★ in ${it.type}`);
        }
        const jaOk = problems === before;
        before = problems;
        if (str(it.full, `${at}.full`, 70, { ja: true, mark: 'need' })) {
          if (count(it.full, '【') !== 1) bad(`${at}.full: only the answer in 【】`);
          else if (need && right && jaOk && problems === before) {
            if (need === 'stars') {
              const g = /[＿★]{4}/.exec(it.ja);
              if (g && count(g[0], '★') === 1) {
                const star = g[0].indexOf('★');
                const pre = it.ja.slice(0, g.index), post = it.ja.slice(g.index + 4);
                const mid = it.full.startsWith(pre) && it.full.endsWith(post) ? it.full.slice(pre.length, it.full.length - post.length) : null;
                const orders = permutations(it.options).filter((p) => p.map((o, i) => (i === star ? `【${o}】` : o)).join('') === mid);
                if (!orders.length) bad(`${at}.full: should be the sentence of ja with the four options in order in place of ＿＿★＿, only the ★ one in 【】`);
                else if (orders[0][star] !== right) bad(`${at}.answer: the ★ part in full is option ${it.options.indexOf(orders[0][star]) + 1}`);
              }
            } else {
              const fill = (o) => (need === 'mark' ? it.ja.replace(/【([^】]*)】/, `【$1（${o}）】`) : it.ja.replace(BLANK, `【${o}】`));
              const j = it.options.findIndex((o) => fill(o) === it.full);
              if (j < 0) bad(`${at}.full: should be ${fill(right)}`);
              else if (j + 1 !== it.answer) bad(`${at}.answer: full gives option ${j + 1}`);
            }
          }
        }
      } else if (it.kind === 'usage') {
        str(it.word, `${at}.word`, 8, { ja: true });
        const before = problems;
        if (str(it.full, `${at}.full`, 70, { ja: true, mark: 'need' })) {
          const marked = /【([^】]*)】/.exec(it.full);
          if (count(it.full, '【') !== 1) bad(`${at}.full: only the word in 【】`);
          else if (typeof it.word === 'string' && marked && marked[1][0] !== it.word[0]) bad(`${at}.full: put the word ${it.word} in 【】`);
          if (right && problems === before) {
            const j = it.options.findIndex((o) => visible(o) === visible(it.full));
            if (j < 0) bad(`${at}.full: should be option ${it.answer}, the right sentence, with the word in 【】`);
            else if (j + 1 !== it.answer) bad(`${at}.answer: full is option ${j + 1}`);
          }
        }
      } else if (it.kind === 'passage') {
        if (it.lead !== undefined) str(it.lead, `${at}.lead`, 26, { ja: true });
        if (arr(it.passage, `${at}.passage`) && it.passage.every((p, j) => str(p, `${at}.passage ${j + 1}`, 0, { ja: true, mark: 'may' }))) {
          if (it.passage.length < 1 || it.passage.length > 2) bad(`${at}.passage: one or two paragraphs`);
          const all = it.passage.reduce((t, p) => t + len(p), 0);
          if (all > 180) bad(`${at}.passage: ${all} characters in all, at most 180`);
          if (it.type === '文章の文法' && count(it.passage.join(''), BLANK) !== 1) bad(`${at}.passage: needs the blank （　　） once`);
        }
        str(it.ask, `${at}.ask`, 30, { ja: true });
      } else if (it.kind === 'pair') {
        if (arr(it.texts, `${at}.texts`, 2)) it.texts.forEach((t, j) => str(t, `${at}.text ${'AB'[j]}`, 100, { ja: true, mark: 'may' }));
        str(it.ask, `${at}.ask`, 30, { ja: true });
      } else {
        // listening: the audio parts in order, their lines and who says them
        const ask = str(it.ask, `${at}.ask`, K.ask || 30, { ja: true }) ? visible(it.ask) : null;
        num(it.wait, `${at}.wait`, 4, 15);
        if (!arr(it.audio, `${at}.audio`)) return;
        const names = it.audio.map((a) => a && a.part);
        if (names.join(',') !== K.parts.join(',')) bad(`${at}.audio: the parts are ${K.parts.join(', ')}, in that order (not ${names.join(', ')})`);
        it.audio.forEach((a, k) => {
          const pat = `${at}.audio ${(a && a.part) || k + 1}`;
          if (!obj(a, pat)) return;
          only(a, pat, ['part', 'lines', 'clip']);
          if ('clip' in a) {
            if (d.id !== 1) bad(`${pat}: no "clip" in a new mock: its clips are named m${d.id}.${n}.${a.part}`);
            else str(a.clip, `${pat}.clip`);
          }
          if (!arr(a.lines, `${pat}.lines`) || !a.lines.length) { if (Array.isArray(a.lines)) bad(`${pat}.lines: none`); return; }
          const lines = [];
          a.lines.forEach((ln, i) => {
            if (!Array.isArray(ln) || ln.length !== 2) { bad(`${pat} line ${i + 1}: must be [who, text]`); return; }
            const [who, text] = ln;
            if (!WHO.includes(who)) bad(`${pat} line ${i + 1}: who is "", "男", "女" or "1" to "4"`);
            if (str(text, `${pat} line ${i + 1}`, 180, { ja: true, furi: true })) lines.push([who, text]);
          });
          if (lines.length !== a.lines.length) return;
          const said = (ls) => ls.map((l) => visible(l[1])).join('');
          const numbered = lines.filter((l) => /^[1-4]$/.test(l[0]));
          if (a.part === 'talk') {
            const all = lines.reduce((t, l) => t + len(l[1]), 0);
            if (all > 300) bad(`${pat}: ${all} characters in all, at most 300`);
          }
          if (a.part === 'choices' || a.part === 'replies') {
            const want = a.part === 'choices' ? 4 : 3;
            const tail = lines.slice(-want);
            const head = lines.slice(0, -want);
            if (numbered.length !== want || tail.map((l) => l[0]).join('') !== '1234'.slice(0, want)) bad(`${pat}: ends with the ${want} ${a.part}, numbered "1" to "${want}" in order`);
            else if (opts) tail.forEach((l, j) => { if (visible(l[1]) !== visible(it.options[j])) bad(`${pat}: ${a.part === 'choices' ? 'choice' : 'reply'} ${j + 1} is not option ${j + 1}`); });
            if (a.part === 'replies' && head.length) bad(`${pat}: only the three replies`);
            if (a.part === 'choices') {
              if (!head.length) bad(`${pat}: the question comes first`);
              else if (ask && said(head) !== ask) bad(`${pat}: the question should be ask: ${ask}`);
            }
          } else if (numbered.length) bad(`${pat}: numbered lines only in choices and replies`);
          if (a.part === 'line') {
            if (lines.length !== 1 || !['男', '女'].includes(lines[0][0])) bad(`${pat}: one line, by "男" or "女"`);
            else if (ask && ask !== `${lines[0][0]}：${visible(lines[0][1])}`) bad(`${pat}: ask should be the line itself: ${lines[0][0]}：${visible(lines[0][1])}`);
          }
          if (a.part === 'q' && ask && !said(lines).endsWith(ask)) bad(`${pat}: should end with the question, as in ask: ${ask}`);
          if (a.part === 'q2' && ask && said(lines) !== ask) bad(`${pat}: should be the question again, as in ask: ${ask}`);
        });
      }
    });
  });
  for (const a of Object.keys(AREAS)) if (!areas.has(a)) bad(`no question in area "${a}" (${AREAS[a]}): every area needs at least one`);
  if (answers.length > 1 && new Set(answers).size === 1) bad(`every answer is option ${answers[0]}: vary the position`);
}

function permutations(xs) {
  if (xs.length < 2) return [xs.slice()];
  return xs.flatMap((x, i) => permutations(xs.slice(0, i).concat(xs.slice(i + 1))).map((p) => [x].concat(p)));
}

for (const f of files) check(f);
console.log(problems ? `${problems} problem(s) in ${files.length} file(s)` : `${files.length} file(s) OK`);
process.exit(problems ? 1 : 0);
