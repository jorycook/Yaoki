// What the app-side tests need to know about the level the app was built for. YK_LEVEL=N1 tests the N1 app
// (run-app.sh passes the same setting to the build); the default is the app for N5 to N2.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const LEVEL = process.env.YK_LEVEL || 'N2';
const PROJECT = path.join(__dirname, '..', LEVEL === 'N1' ? 'yaoki-n1' : 'yaoki', 'project');

/* the length of every clip in milliseconds, as the sound files the build copies give it. N2 keeps its lesson clips in
   sound-lessons.js; N1 keeps them as files listed in audio/clips.js ({ ms, u }). Each level's mini mock (mock 1) and the
   sound check are in sound-mock.js */
const SOUND_FILES = LEVEL === 'N1' ? ['audio/clips.js', 'sound-mock.js'] : ['sound-lessons.js', 'sound-mock.js'];
const clips = {};
for (const f of SOUND_FILES) {
  const file = path.join(PROJECT, f);
  if (!fs.existsSync(file)) continue;
  for (const m of fs.readFileSync(file, 'utf8').matchAll(/c\['([^']+)'\] = \{ ms: (\d+)/g)) clips[m[1]] = +m[2];
}
/* the mini mock's listening clips in the order they play, and how long the section lasts with sound:
   each clip and a breath of 0.4 s, then the answer time (8, 8 and 6 s) */
const mockClips = ['m10_q', 'm10_talk', 'm10_q2', 'm11_talk', 'm11_q', 'm12_line', 'm12_replies'].map((k) => clips[k]);
const listeningMs = mockClips.reduce((n, ms) => n + ms + 400, 0) + 8000 + 8000 + 6000;

/* the N1 course as the app has it: the content bank and the plan engine (window.ykN1), run here on a given day */
function course(today) {
  const sandbox = { window: { __ykToday: today || undefined }, console };
  vm.createContext(sandbox);
  for (const f of ['n1-content.js', 'n1.js']) vm.runInContext(fs.readFileSync(path.join(PROJECT, f), 'utf8'), sandbox, { filename: f });
  return sandbox.window.ykN1;
}

/* words the shared checks look for. weekTheme: the week path's banner once a goal is set on the first screen;
   teachTitle: the first teach page's heading; drillWrong, drillLine: a wrong option of the first drill and words its
   notebook line shows; drillSrc: the notebook's name for that drill; teachClip: the first teach page example's clip;
   tabCount: words only the mock tab shows */
let TEXT;
if (LEVEL === 'N1') {
  /* a new plan starts with the first lesson of the first unit */
  const N = course();
  const l = N.lessons[0];
  const d = l.grammar.drills[0];
  const wrong = d.options.filter((o, k) => k + 1 !== d.answer).sort((a, b) => b.length - a.length)[0];
  TEXT = {
    appName: 'Yaoki N1', tabCount: 'short papers in the real format', weekTheme: N.units[0].ja,
    teachTitle: l.grammar.patterns[0].p, drillWrong: N.plain(wrong), drillLine: N.plain(d.ja).replace(/[。！？]$/, '').slice(-6),
    drillSrc: 'g.' + l.id + '.d0', teachClip: 'g.' + l.id + '.0.0',
  };
} else {
  TEXT = { appName: 'Yaoki', tabCount: '101問', weekTheme: '原因・理由', teachTitle: '〜ばかりに', drillWrong: 'あまり', drillLine: '寝坊した', drillSrc: 'drill', teachClip: 't_ex1' };
}

module.exports = { LEVEL, PROJECT, clips, mockClips, listeningMs, course, ...TEXT };
