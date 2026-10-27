// Builds yaoki/project/course-<level>.js from content/<level>/*.json for every level folder, and checks every item on the way.
// usage: node tools/build-course.mjs          (exits 1 and lists the problems if anything is wrong)
//
// Each generated file sets window.__ykCourses[LEVEL] = { level, units: [...], items: { id: item } }
// (course-n2.js also sets window.__ykCourseData, its name before there were several levels).
// They are loaded next to course.js by the screens on the design canvas and by the app.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/* the kanji a level may use, where the course keeps to a list (N5: the N5 kanji only; everything else in kana) */
const KANJI = {
  N5: new Set([...'一二三四五六七八九十百千万円日月火水木金土年時分半午前後今先週毎何上下中外右左東西南北人男女子母父友名学校生会社本語国山川天気雨電車駅道店食飲見聞読書話言行来出入休買立長高安新古大小多少白花空手足目口耳間魚']),  /* N4: the N5 kanji and the N4 list (the commonly used N4 list, about 170 kanji) */
  N4: new Set([...'一二三四五六七八九十百千万円日月火水木金土年時分半午前後今先週毎何上下中外右左東西南北人男女子母父友名学校生会社本語国山川天気雨電車駅道店食飲見聞読書話言行来出入休買立長高安新古大小多少白花空手足目口耳間魚同事自発者地業方場員開力問代明動京通理体田主題意不作用度強公持野以思家世正院心界教文元重近考画海売知集別物使品計死特私始朝運終台広住無真有町料工建急止送切転研究楽起着病質待試族銀早映親験英医仕去味写字答夜音注帰歌悪図室歩風紙黒春赤青館屋色走秋夏習洋旅服夕借曜肉貸堂鳥飯勉冬昼茶弟牛兄犬妹姉漢暗引遠回寒顔区軽県光好合菜産市弱首所暑乗森進声説洗村太短池低都頭働便民門薬林']),
  /* N3: the N4 set, the commonly used N3 list (about 340 kanji) and about 75 everyday kanji other lists also put at N3 (届, 健康, 練習, 階 …) */
  N3: new Set([...'一二三四五六七八九十百千万円日月火水木金土年時分半午前後今先週毎何上下中外右左東西南北人男女子母父友名学校生会社本語国山川天気雨電車駅道店食飲見聞読書話言行来出入休買立長高安新古大小多少白花空手足目口耳間魚同事自発者地業方場員開力問代明動京通理体田主題意不作用度強公持野以思家世正院心界教文元重近考画海売知集別物使品計死特私始朝運終台広住無真有町料工建急止送切転研究楽起着病質待試族銀早映親験英医仕去味写字答夜音注帰歌悪図室歩風紙黒春赤青館屋色走秋夏習洋旅服夕借曜肉貸堂鳥飯勉冬昼茶弟牛兄犬妹姉漢暗引遠回寒顔区軽県光好合菜産市弱首所暑乗森進声説洗村太短池低都頭働便民門薬林', ...'政議民連対部合市内相定回選米実関決全表戦経最現調化当約首法性要制治務成期取都和機平加受続進数記初指権支産点報済活原共得解交資予向際勝面告反判認参利組信在件側任引求所次昨論官増係感情投示変打直両式確果容必演歳争談能位置流格疑過局放常状球職与供役構割費付由説難優夫収断石違消神番規術備宅害配警育席訪乗残想声念助労例然限追商葉伝働形景落好退頭負渡失差末守若種美命福望非観察段横深申様財港識呼達良候程満敗値突光路科積他処太客否師登易速存飛殺号単座破除完降責捕危給苦迎園具辞因馬愛富彼未舞亡冷適婦寄込顔類余王返妻背熱宿薬険頼覚船途許抜便留罪努精散静婚喜浮絶幸押倒等老曲払庭徒勤遅居雑招困欠更刻賛抱犯恐息遠戻願絵越欲痛笑互束似列探逃遊迷夢君閉緒折草暮酒悲晴掛到寝暗盗吸陽御歯忘雪吹娘誤洗慣礼窓昔貧怒泳祖杯疲皆鳴腹煙眠怖耳頂箱晩寒髪忙才靴恥偶偉猫幾久届暖健康興周仲荷皿片準授浴蔵庫停線練階寺卒課復温島橋符駐鉄袋菓濯掃踊卵涼汗汚濃薄預齢簡泊湯誕祭祝季節紹介絡換替普将減札布傘帯隣戸坂角混禁案咲泣捨並量券保証順冊械額結阪故章評価々歴史営筆比星級枚的管接賃']),

};
/* labels the app shows from the data that are not part of the Japanese the learner reads */
const LABEL_KEYS = new Set(['type', 'label', 'title', 'tag', 'id', 'clip', 'kind', 'step', 'form']);

const problems = [];
let LEVEL = '';
const bad = (where, msg) => problems.push(LEVEL + ' ' + where + ': ' + msg);
let items = {};
const allIds = new Set();

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
  else if (items[it.id] || allIds.has(it.id)) bad(where, 'duplicate item id ' + it.id);
  else allIds.add(it.id);
  if (!it.type) bad(it.id || where, 'item without a type (the exam item type, such as 文の文法1)');
  if (it.kind === 'choice') {
    if (!it.q) bad(it.id, 'choice item without q');
    markup(it.id + '.q', it.q);
    if (!Array.isArray(it.options) || it.options.length < 2) bad(it.id, 'needs at least two options');
    else {
      if (!(it.answer >= 1 && it.answer <= it.options.length)) bad(it.id, 'answer must be 1 to ' + it.options.length);
      if (new Set(it.options).size !== it.options.length) bad(it.id, 'two options are the same');
      /* the notebook and exam conditions show options without readings, so they must differ there too */
      else if (new Set(it.options.map((o) => String(o).replace(/\[([^|\]]*)\|[^\]]*\]/g, '$1').replace(/[{}_^]/g, ''))).size !== it.options.length) bad(it.id, 'two options read the same once their readings are removed');
      it.options.forEach((o, k) => markup(`${it.id}.options[${k}]`, o));
      if (it.why && it.why.length !== it.options.length) bad(it.id, 'why must have one line per option');
      if (it.short && it.short.length !== it.options.length) bad(it.id, 'short must have one entry per option');
      if (!it.why && !it.explain) bad(it.id, 'needs why (one line per option) or explain');
      if (it.why) it.why.forEach((w, k) => { if (k + 1 !== it.answer && !w && !it.explain) bad(it.id, `no reason for wrong option ${k + 1}`); });
      if (typeof it.q === 'string' && !/（　　）|_[^_]+_|★/.test(it.q) && !/読解|内容理解|主張|情報検索|課題|概要|即時|ポイント|統合|用法|発話/.test(it.type)) bad(it.id, 'q has no （　　） blank and no _underlined_ word');
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
    /* spaces between phrases (as the N5 paper writes) do not count */
    const sp = (x) => x.replace(/\[([^|\]]*)\|[^\]]*\]/g, '$1').replace(/[{}_^]/g, '').replace(/[ 　]/g, '');
    if (sp(plainFull) !== sp(joined)) bad(it.id, `full "${plainFull}" is not before + tiles + after "${joined}"`);
  } else bad(it.id || where, 'kind must be choice or star');
  ['explain', 'hint'].forEach((k) => markup(`${it.id}.${k}`, it[k]));
  items[it.id] = { ...it, ...ctx };
}

function kanjiCheck(where, v, key) {
  const allowed = KANJI[LEVEL];
  if (!allowed) return;
  if (typeof v === 'string') {
    if (LABEL_KEYS.has(key)) return;
    /* the skill's own name (内容理解 …) is a label too */
    if (/\.skill\.(ja|en)$/.test(where)) return;
    /* a reading's base text is checked; the reading itself is kana */
    const text = v.replace(/\[([^|\]]*)\|[^\]]*\]/g, '$1');
    const off = [...new Set([...text].filter((c) => /\p{Script=Han}/u.test(c) && !allowed.has(c)))];
    if (off.length) bad(where, `kanji above ${LEVEL}: ${off.join(' ')} in "${v.slice(0, 40)}"`);
  } else if (Array.isArray(v)) v.forEach((x, k) => kanjiCheck(where, x, key));
  else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => kanjiCheck(where + '.' + k, x, k));
}

function buildLevel(dir) {
const SRC = path.join(ROOT, 'content', dir);
const syllabus = JSON.parse(fs.readFileSync(path.join(SRC, 'units.json'), 'utf8'));
LEVEL = syllabus.level;
items = {};
const pre = LEVEL === 'N2' ? '' : LEVEL.toLowerCase();
const units = syllabus.units.map((u) => {
  const file = path.join(SRC, `u${String(u.n).padStart(2, '0')}.json`);
  const content = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { days: {}, test: [] };
  const days = [];
  for (let d = 1; d <= 6; d++) {
    const title = d <= 5 ? u.days[d - 1] : 'まとめ：似ている文法';
    const day = (content.days || {})[d];
    if (!day) { days.push({ title }); continue; }
    const where = `${pre}u${u.n}d${d}`;
    kanjiCheck(where, day, '');
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
    /* every spoken thing gets a clip name; tts/course_clips.py makes the clips under these names (sound-course.js) */
    const key = (k) => k.replace(/[^A-Za-z0-9]+/g, '_');
    (g.points || []).forEach((p) => (p.examples || []).forEach((e, n) => { if (!e.clip) e.clip = key('x_' + p.id + '_' + (n + 1)); }));
    if (day.scene) (day.scene.words || []).forEach((w) => { if (!w.clip) w.clip = key('s_' + where + '_' + w.id); });
    if (day.skill && day.skill.kind === 'listening') {
      if (!Array.isArray(day.skill.audio) || !day.skill.audio.length) bad(where, 'a listening lesson needs audio: the lines to synthesise');
      else day.skill.audio.forEach((l, n) => { if (!Array.isArray(l) || !['N', 'M', 'F'].includes(l[0]) || !l[1]) bad(where, `audio line ${n + 1} must be [N|M|F, text, respelling or null]`); });
      if (!day.skill.item.clip) day.skill.item.clip = key('l_' + where);
      items[day.skill.item.id].clip = day.skill.item.clip;
    }
    days.push({ ...day, title });
  }
  kanjiCheck(`${pre}u${u.n}.test`, content.test || [], '');
  (content.test || []).forEach((it) => item(`${pre}u${u.n}.test`, it, { unit: u.n, step: 'test' }));
  return { n: u.n, ja: u.ja, en: u.en, days, test: content.test || [] };
});

// the mini mock's questions, so the notebook can show and re-ask the ones that were missed
const miniFile = path.join(SRC, 'mini.json');
if (fs.existsSync(miniFile)) JSON.parse(fs.readFileSync(miniFile, 'utf8')).items.forEach((it) => item('mini', it, { step: 'mock' }));
return { dir, level: LEVEL, about: syllabus.about, units, items };
}

const built = fs.readdirSync(path.join(ROOT, 'content')).filter((d) => fs.existsSync(path.join(ROOT, 'content', d, 'units.json'))).sort().map(buildLevel);
if (problems.length) {
  console.log(problems.length + ' problem(s) in the course content:\n  ' + problems.join('\n  '));
  process.exit(1);
}
/* every kanji of a scene word must have its strokes for the writing practice (yaoki/project/strokes.js); new words with a
   kanji the strokes file does not hold yet need: python3 tools/make-strokes.py */
{
  const strokesFile = path.join(ROOT, 'yaoki', 'project', 'strokes.js');
  const held = fs.existsSync(strokesFile) ? fs.readFileSync(strokesFile, 'utf8') : '';
  const need = new Set();
  for (const b of built) for (const u of b.units) for (const d of u.days) for (const w of (d.scene && d.scene.words) || []) for (const c of w.word || '') if (/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3005]/.test(c)) need.add(c);
  const missing = [...need].filter((c) => !held.includes(JSON.stringify(c) + ':'));
  if (missing.length) {
    console.log(`${missing.length} kanji of the scenes have no strokes for the writing practice: ${missing.join('')}\n  run: python3 tools/make-strokes.py`);
    process.exit(1);
  }
}
for (const b of built) {
  const OUT = path.join(ROOT, 'yaoki', 'project', `course-${b.dir}.js`);
  /* below: the kanji of the levels under this one, which a learner on this level is taken to write already (the writing
     practice asks only for the others) */
  const BELOW = { N5: null, N4: KANJI.N5, N3: KANJI.N4, N2: KANJI.N3 };
  const below = BELOW[b.level] ? [...BELOW[b.level]].join('') : '';
  const body = JSON.stringify({ level: b.level, units: b.units, items: b.items, below });
  const alias = b.level === 'N2' ? `window.__ykCourseData = window.__ykCourses.N2;\n` : '';
  fs.writeFileSync(OUT, `/* Generated by tools/build-course.mjs from content/${b.dir}/*.json. Do not edit: change the content and rebuild. */\nwindow.__ykCourses = window.__ykCourses || {};\nwindow.__ykCourses.${b.level} = ${body};\n${alias}`);
  const ready = b.units.reduce((n, u) => n + u.days.filter((d) => d.grammar).length, 0);
  console.log(`course-${b.dir}.js: ${b.units.length} units, ${ready} study days written, ${Object.keys(b.items).length} items, ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
}
