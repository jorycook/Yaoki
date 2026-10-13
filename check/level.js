// What the app-side tests need to know about the level the app was built for. YK_LEVEL=N1 tests the N1 app
// (run-app.sh passes the same setting to the build); the default is the app for N5 to N2.
const fs = require('fs');
const path = require('path');

const LEVEL = process.env.YK_LEVEL || 'N2';
const PROJECT = path.join(__dirname, '..', LEVEL === 'N1' ? 'yaoki-n1' : 'yaoki', 'project');

/* the length of every clip in milliseconds, as the sound files the build copies give it */
const clips = {};
for (const f of ['sound-lessons.js', 'sound-mock.js']) {
  for (const m of fs.readFileSync(path.join(PROJECT, f), 'utf8').matchAll(/c\['([^']+)'\] = \{ ms: (\d+)/g)) clips[m[1]] = +m[2];
}
/* the mini mock's listening clips in the order they play, and how long the section lasts with sound:
   each clip and a breath of 0.4 s, then the answer time (8, 8 and 6 s) */
const mockClips = ['m10_q', 'm10_talk', 'm10_q2', 'm11_talk', 'm11_q', 'm12_line', 'm12_replies'].map((k) => clips[k]);
const listeningMs = mockClips.reduce((n, ms) => n + ms + 400, 0) + 8000 + 8000 + 6000;

const TEXT = {
  N2: { appName: 'Yaoki', tabCount: '101問', teachTitle: '〜ばかりに', drillWrong: 'あまり', drillLine: '寝坊した' },
  N1: { appName: 'Yaoki N1', tabCount: '約100問', teachTitle: '〜とあって', drillWrong: 'とあれば', drillLine: '花火大会' },
}[LEVEL];

module.exports = { LEVEL, clips, mockClips, listeningMs, ...TEXT };
