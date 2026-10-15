// Builds the installable Yaoki web app into dist/ from the design canvas's screen files.
// usage: node build.mjs                          (NODE_PATH must reach "sharp"; the main app, N5 to N2, into dist/)
//        YK_LEVEL=N1 node build.mjs              (the N1 app, from ../yaoki-n1/project, into dist-n1/)
//
// What it does:
//   1. takes the screens the prototype plays (16 for the main app, 17 for N1: see LEVELS), plus the app's own shell and install page (src/*.dc.html),
//      and turns each into one YK.define(...) call in assets/screens.js (template text + logic class);
//   2. gathers the small style rules the screens declare into assets/screens.css;
//   3. cuts the two typefaces down to the characters used (fonts.py) and draws the icons;
//   4. copies the runtime, the sound files, the page and the manifest;
//   5. writes sw.js with the exact list of files, so the whole app is stored on the phone for offline use.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
/* one app per set of screens, each with its own screens, name, icon colour and scripts; the shell around the screens
   (src/) is shared. N2 is the main app, for N5 to N2: the learner picks the level in the app, and each level's course is
   data (course-n5.js … course-n2.js, made from content/ by tools/build-course.mjs). N1 is an app of its own, with its
   course bank and plan (n1-content.js, n1.js) and its spoken clips as files (audio/).
   The few lines of the shared files that belong to one app only are marked (see forLevel below). */
const LEVELS = {
  N2: { project: '../yaoki/project', out: 'dist', name: 'Yaoki', full: 'Yaoki JLPT', tile: '#F2B43A', about: 'Prototype with N2 sample content.', credits: '',
    screens: ['Goal', 'Main', 'Today', 'Teach', 'Compare', 'Drill', 'Exam', 'Scene', 'Reading', 'WeekTest', 'Notebook', 'Review', 'Mock', 'MockRun', 'Readiness', 'Listening'],
    /* run first: the course content, checked and turned into course-n2.js, course-n5.js, course-n4.js and course-n3.js next to the screens */
    prepare: '../tools/build-course.mjs',
    /* loaded after the sound player and before the screens; words: the ones whose text the typefaces must hold */
    scripts: ['course-n2.js', 'course-n5.js', 'course-n4.js', 'course-n3.js', 'course.js'],
    words: ['course-n2.js', 'course-n5.js', 'course-n4.js', 'course-n3.js'],
    /* the clips, loaded after the app; each level's sound by unit (sound-course-n5-u01.js …) is fetched by course.js
       when the unit is in use, and stored by the offline worker when used, not at install (lazy) */
    sounds: ['sound-mock.js', 'sound-lessons.js', 'sound-course.js'],
    unitSound: /^sound-course-n\d-u\d+\.js$/,
    lazy: /^\.\/assets\/sound-course-n\d-u\d+\.js$/ },
  N1: { project: '../yaoki-n1/project', out: 'dist-n1', name: 'Yaoki N1', full: 'Yaoki JLPT N1', tile: '#2F4FD0', about: 'Prototype N1 course, planned to your exam date.', credits: 'Kanji data: KANJIDIC2 and JMdict, by the EDRDG (CC BY-SA 4.0). ',
    screens: ['Goal', 'Main', 'Today', 'Teach', 'Compare', 'Drill', 'Star', 'Exam', 'Scene', 'Reading', 'WeekTest', 'Notebook', 'Review', 'Mock', 'MockRun', 'Readiness', 'Listening'],
    /* the content bank and the plan that lays it out (tools/build-content.mjs makes n1-content.js), and the list of the spoken clips */
    scripts: ['n1-content.js', 'n1.js', 'audio/clips.js'],
    words: ['n1-content.js', 'n1.js', 'audio/clips.js'],
    optional: ['audio/clips.js'],
    sounds: ['sound-mock.js'],
    /* the spoken clips kept as files (645 of them, about 21 MB): sound.js fetches each when it is played. They are not part
       of the install: the offline worker stores each the first time it is played, and all of them in the background once
       the learner has a plan (lazy) */
    audio: 'audio',
    lazy: /^\.\/assets\/audio\/[^/]+\.mp3$/,
    licence: ['== Kanji and dictionary data ==', 'The kanji readings, meanings and example words come from KANJIDIC2 and JMdict, the property of the',
      'Electronic Dictionary Research and Development Group (EDRDG), used under the Creative Commons Attribution-ShareAlike 4.0 licence:',
      'https://www.edrdg.org/edrdg/licence.html. The selection and the wrong readings in the quizzes were made from them for this app,',
      'and the kanji data in the app (assets/n1-content.js, the kanji and review kanji lists) is available under the same licence.', ''] },
};
const LEVEL = process.env.YK_LEVEL || 'N2';
const L = LEVELS[LEVEL];
if (!L) throw new Error('YK_LEVEL must be one of ' + Object.keys(LEVELS).join(', '));
const PROJECT = path.resolve(HERE, process.env.YK_PROJECT || L.project);
const FONTS = path.resolve(HERE, process.env.YK_FONTS || '../fonts-src');
const SRC = path.join(HERE, 'src');
const OUT = path.join(HERE, process.env.YK_OUT || L.out);
const APP_VERSION = process.env.YK_APP_VERSION || '0.1';

const SCREENS = L.screens;
const OWN = ['Shell', 'Install'];
const has = (f) => fs.existsSync(path.join(PROJECT, f));
const SCRIPTS = L.scripts.filter((f) => !(L.optional || []).includes(f) || has(f));
const WORDS = L.words.filter((f) => SCRIPTS.includes(f));
const SOUNDS = ['sound.js', ...L.sounds];
const UNIT_SOUND = L.unitSound ? fs.readdirSync(PROJECT).filter((f) => L.unitSound.test(f)).sort() : [];

/* The shared files (src/) are written for both apps. Lines that belong to one app only sit between marks of the file's
   own comment kind, each mark alone on its line:  <!-- #if N1 --> … <!-- #else --> … <!-- #end -->  in a page or a
   template, and  /* #if N1 *\/ … /* #else *\/ … /* #end *\/  in a script ("#if !N1" is the other way round). The marks and
   the other app's lines are left out of the build. Then the marks %APP_NAME% and the like are filled in. */
function forLevel(text, file) {
  const out = [];
  let open = false;
  let keep = true;
  for (const line of text.split('\n')) {
    const m = /^\s*(?:<!--|\/\*)\s*#(if\s+(!?)(\w+)|else|end)\s*(?:-->|\*\/)\s*$/.exec(line);
    if (!m) { if (keep) out.push(line); continue; }
    if (m[3]) {
      if (open) throw new Error(file + ': #if inside #if');
      if (!LEVELS[m[3]]) throw new Error(file + ': #if names no app: ' + m[3]);
      open = true;
      keep = (m[3] === LEVEL) !== (m[2] === '!');
    } else if (m[1] === 'else') {
      if (!open) throw new Error(file + ': #else without #if');
      keep = !keep;
    } else {
      if (!open) throw new Error(file + ': #end without #if');
      open = false;
      keep = true;
    }
  }
  if (open) throw new Error(file + ': #if without #end');
  return out.join('\n');
}
const tags = (dir, list, attr) => list.map((f) => `\n<script ${attr}src="${dir}${f}"></script>`).join('');
const fill = (text, file) => forLevel(text, file)
  .replace(/%CREDITS%/g, L.credits || '').replace(/%EXTRA_SCRIPTS%/g, tags('./assets/', SCRIPTS, '')).replace(/%ASYNC_SCRIPTS%/g, tags('./assets/', L.sounds, 'async '))
  .replace(/%APP_ABOUT%/g, L.about).replace(/%APP_FULL_NAME%/g, L.full).replace(/%APP_NAME%/g, L.name).replace(/%TILE%/g, L.tile);
/* the app's own text files as this app has them, for the typefaces to read (in a folder of their own, removed after the build) */
const TEXT = fs.mkdtempSync(path.join(os.tmpdir(), 'yk-text-'));
process.on('exit', () => fs.rmSync(TEXT, { recursive: true, force: true }));
const ownText = (file) => { const to = path.join(TEXT, path.basename(file)); fs.writeFileSync(to, fill(fs.readFileSync(file, 'utf8'), file)); return to; };

const read = (f) => fs.readFileSync(f, 'utf8');
const write = (rel, data) => { const f = path.join(OUT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, data); };
const copy = (from, rel) => write(rel, fs.readFileSync(from));

/* one screen file -> its template, the style rules in its <helmet>, and its logic script */
function parts(file) {
  const text = fill(read(file), file);
  const body = text.match(/<x-dc>([\s\S]*?)<\/x-dc>/);
  const logic = text.match(/<script type="text\/x-dc" data-dc-script[^>]*>([\s\S]*?)<\/script>/);
  if (!body || !logic) throw new Error(file + ': not a screen file');
  const helmet = body[1].match(/<helmet>([\s\S]*?)<\/helmet>/);
  const rules = [];
  if (helmet) {
    for (const m of helmet[1].matchAll(/<style>([\s\S]*?)<\/style>/g)) {
      for (const line of m[1].split('\n').map((l) => l.trim()).filter(Boolean)) {
        /* the screens write one whole rule per line; anything else would be cut apart here, so stop instead */
        if (!line.endsWith('}') || (line.match(/\{/g) || []).length !== (line.match(/\}/g) || []).length) throw new Error(file + ': a helmet style rule must sit on one line: ' + line.slice(0, 60));
        rules.push(line);
      }
    }
    const other = helmet[1].replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<link href="https:\/\/fonts\.googleapis\.com[^>]*>/g, '').trim();
    if (other) throw new Error(file + ': the build does not know what to do with this in the helmet: ' + other.slice(0, 80));
  }
  if (/<\/script/i.test(logic[1])) throw new Error(file + ': logic contains a closing script tag');
  return { template: body[1].replace(/<helmet>[\s\S]*?<\/helmet>/, '').trim(), rules, logic: logic[1].trim() };
}

/* 0: what the app's scripts are made from (the main app: the course content, checked and turned into course-n2.js,
      course-n5.js, course-n4.js and course-n3.js next to the screens) */
if (L.prepare) execFileSync('node', [path.join(HERE, L.prepare)], { stdio: 'inherit' });

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });

/* 1 and 2: screens.js and screens.css */
const rules = new Set();
const defs = [];
const textSources = [];
for (const name of [...SCREENS, ...OWN]) {
  const file = path.join(OWN.includes(name) ? SRC : PROJECT, name + '.dc.html');
  const p = parts(file);
  p.rules.forEach((r) => rules.add(r));
  textSources.push(OWN.includes(name) ? ownText(file) : file);
  defs.push(`YK.define(${JSON.stringify(name)}, ${JSON.stringify(p.template)}, function (DCLogic) {\n${p.logic}\n;return (typeof Component !== "undefined" && Component) || undefined;\n});`);
}
write('assets/screens.js', `/* Generated by build.mjs from the design canvas's screen files and src/*.dc.html. Do not edit: change the screen file and rebuild. */\n(function () {\nvar YK = window.YK;\n${defs.join('\n')}\n})();\n`);
/* hover colours only where there is a pointer that hovers: after a tap, a phone would leave the link tinted */
const css = [...rules].map((r) => r.replace(/(a:hover\{[^}]*\})/g, '@media (hover:hover){$1}'));
write('assets/screens.css', `/* Generated by build.mjs: the style rules the screens declare. */\n${css.join('\n')}\n`);

/* 3: typefaces and icons */
/* every file that puts words on the screen: the screens, the app's own code, and the page (its sideways note) */
const fontLog = execFileSync('python3', [path.join(HERE, 'fonts.py'), FONTS, path.join(OUT, 'assets'), ...textSources, ...WORDS.map((f) => path.join(PROJECT, f)), ownText(path.join(SRC, 'yk-app.js')), ownText(path.join(SRC, 'index.html'))], { encoding: 'utf8' });
process.stdout.write(fontLog);

const DARUMA = (shadow) => `
  ${shadow ? '<path d="M50 6c26 0 40 20 40 46 0 24-16 42-40 42S10 76 10 52C10 26 24 6 50 6z" fill="#1B2440" transform="translate(3.5 4.5)"/>' : ''}
  <path d="M50 6c26 0 40 20 40 46 0 24-16 42-40 42S10 76 10 52C10 26 24 6 50 6z" fill="#E2452B" stroke="#1B2440" stroke-width="2.6"/>
  <ellipse cx="50" cy="42" rx="27" ry="23" fill="#FFF6EA" stroke="#1B2440" stroke-width="2"/>
  <circle cx="39" cy="42" r="8" fill="#fff" stroke="#1B2440" stroke-width="2.5"/>
  <circle cx="61" cy="42" r="8" fill="#fff" stroke="#1B2440" stroke-width="2.5"/>
  <circle cx="61" cy="42" r="4.2" fill="#1B2440"/>
  <path d="M28 30c6-5 14-5 19 0M53 30c5-5 13-5 19 0" stroke="#1B2440" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M44 55c4 3 8 3 12 0" stroke="#1B2440" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <path d="M38 74h24M42 82h16" stroke="#F2B43A" stroke-width="3.5" stroke-linecap="round"/>`;
const icon = (size, share) => {
  const d = size * share;
  const k = d / 100;
  const x = (size - d) / 2 - 1.5 * k;
  const y = (size - d) / 2 - 1.5 * k;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="${L.tile}"/><g transform="translate(${x} ${y}) scale(${k})">${DARUMA(true)}</g></svg>`;
};
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const png = async (rel, size, share) => write(rel, await sharp(Buffer.from(icon(1024, share))).resize(size, size).png({ compressionLevel: 9 }).toBuffer());
await png('icons/apple-touch-icon.png', 180, 0.7);
await png('icons/icon-192.png', 192, 0.7);
await png('icons/icon-512.png', 512, 0.7);
await png('icons/icon-512-maskable.png', 512, 0.56);
await png('icons/favicon-32.png', 32, 0.82);

/* 4: runtime, sound, page, manifest, licences */
const preactDir = path.join(HERE, 'node_modules/preact');
copy(path.join(preactDir, 'dist/preact.min.js'), 'assets/preact.min.js');
for (const f of ['yk-runtime.js', 'app.css']) copy(path.join(SRC, f), 'assets/' + f);
write('assets/yk-app.js', fill(read(path.join(SRC, 'yk-app.js')), 'yk-app.js'));
for (const f of [...SOUNDS, ...UNIT_SOUND, ...SCRIPTS]) copy(path.join(PROJECT, f), 'assets/' + f);
/* the spoken clips kept as files (an app with many of them): audio/clips.js names them, sound.js fetches each when it is played */
if (L.audio && has(L.audio)) for (const f of fs.readdirSync(path.join(PROJECT, L.audio)).filter((f) => /\.mp3$/.test(f))) copy(path.join(PROJECT, L.audio, f), 'assets/' + L.audio + '/' + f);
write('index.html', fill(read(path.join(SRC, 'index.html')), 'index.html'));
write('manifest.webmanifest', fill(read(path.join(SRC, 'manifest.webmanifest')), 'manifest.webmanifest'));
const ofl = read(path.join(FONTS, 'kleeone/OFL.txt')).split('\n').slice(1).join('\n').trim();
write('licenses.txt', [
  'Yaoki app: third-party licences',
  '',
  '== Preact ' + JSON.parse(read(path.join(preactDir, 'package.json'))).version + ' (MIT) ==',
  read(path.join(preactDir, 'LICENSE')).trim(),
  '',
  '== Typefaces (SIL Open Font License 1.1) ==',
  'Klee One: Copyright 2020 The Klee Project Authors (https://github.com/fontworks-fonts/Klee)',
  'M PLUS Rounded 1c: Copyright 2016 The Rounded M+ Project Authors.',
  'Both are included as subsets holding only the characters this app shows.',
  '',
  ofl,
  '',
  '== Voices ==',
  'The spoken clips are synthetic placeholders made with Kokoro-82M (Apache-2.0).',
  'The narrator\'s and the man\'s voices (jf_gongitsune, jm_kumo) were built from Koniwa recordings (CC BY 3.0).',
  'Voice list and credits: https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md',
  '',
  '== Trademarks and content ==',
  'JLPT (Japanese-Language Proficiency Test) is a trademark of the Japan Foundation and Japan Educational Exchanges and Services.',
  'This app is not connected with, endorsed by or affiliated with them, and holds no official test material. Its lessons,',
  'questions, passages and listening scripts were written for the app and follow the format of the test only.',
  '',
  ...(L.licence || []),
].join('\n'));

/* 5: version stamp and the offline worker */
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const day = process.env.YK_BUILD_DATE || new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const hash = crypto.createHash('sha256');
hash.update(APP_VERSION + '|' + day);
for (const f of walk(OUT).sort()) { hash.update(path.relative(OUT, f)); hash.update(fs.readFileSync(f)); }
const digest = hash.digest('hex').slice(0, 10);
write('assets/build.js', `/* Generated by build.mjs. */\nwindow.__ykBuild = ${JSON.stringify(`${L.name} prototype ${APP_VERSION} · ${day} · ${digest.slice(0, 6)}`)};\n`);
const files = walk(OUT).map((f) => './' + path.relative(OUT, f).split(path.sep).join('/')).filter((f) => f !== './sw.js').sort();
/* the sound that is stored when used, not at install (sw.js, and "lazy" in LEVELS); its hash lets a new build keep unchanged files */
const isLazy = (f) => !!L.lazy && L.lazy.test(f);
const lazy = {};
files.filter(isLazy).forEach((f) => { lazy[f] = crypto.createHash('sha256').update(fs.readFileSync(path.join(OUT, f))).digest('hex').slice(0, 10); });
write('sw.js', fill(read(path.join(SRC, 'sw.js')), 'sw.js').replace('__VERSION__', digest).replace('__FILES__', JSON.stringify(['./', ...files.filter((f) => !isLazy(f))], null, 1)).replace('__LAZY__', JSON.stringify(lazy, null, 1)));
/* GitHub Pages: serve the files as they are */
write('.nojekyll', '');

/* 6: the same app as a page inside Claude (a private preview): one page file plus its scripts.
      There the host supplies the page skeleton, typefaces come from Google Fonts and Preact from a CDN,
      and nothing can be installed or kept for offline use. */
const PREVIEW = OUT + '-preview';
fs.rmSync(PREVIEW, { recursive: true, force: true });
fs.mkdirSync(path.join(PREVIEW, 'assets'), { recursive: true });
const preactVersion = JSON.parse(read(path.join(preactDir, 'package.json'))).version;
const stamp = `${L.name} prototype ${APP_VERSION} · ${day} · ${digest.slice(0, 6)} · preview`;
for (const f of ['yk-runtime.js', ...SOUNDS, ...UNIT_SOUND, ...SCRIPTS, 'screens.js', 'yk-app.js']) { fs.mkdirSync(path.dirname(path.join(PREVIEW, 'assets', f)), { recursive: true }); fs.copyFileSync(path.join(OUT, 'assets', f), path.join(PREVIEW, 'assets', f)); }
if (L.audio && fs.existsSync(path.join(OUT, 'assets', L.audio))) fs.cpSync(path.join(OUT, 'assets', L.audio), path.join(PREVIEW, 'assets', L.audio), { recursive: true });
fs.writeFileSync(path.join(PREVIEW, 'yaoki-app.html'), `<title>${L.name} App</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@500;700;800&family=Klee+One:wght@400;600&display=swap">
<style>
${read(path.join(SRC, 'app.css')).trim()}
${read(path.join(OUT, 'assets/screens.css')).trim()}
</style>
<div id="yk-view"><div id="yk-stage"></div></div>
<div id="yk-sideways" role="status"><div lang="ja">縦向きでお使いください</div><div>Turn the phone upright</div></div>
<script src="https://cdn.jsdelivr.net/npm/preact@${preactVersion}/dist/preact.min.js"></script>
<script>window.__ykHost = 'artifact'; window.__ykBuild = ${JSON.stringify(stamp)};</script>
<script src="assets/yk-runtime.js"></script>
<script src="assets/sound.js"></script>${tags('assets/', SCRIPTS, '')}
<script src="assets/screens.js"></script>
<script src="assets/yk-app.js"></script>${tags('assets/', L.sounds, 'async ')}
`);

const size = walk(OUT).reduce((n, f) => n + fs.statSync(f).size, 0);
console.log(`built ${LEVEL}: ${walk(OUT).length} files, ${(size / 1024 / 1024).toFixed(2)} MB, version ${digest}`);
