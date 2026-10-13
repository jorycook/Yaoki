"""Makes the N1 app's spoken clips: project/sound-lessons.js and project/sound-mock.js.

usage: python3 make-sound.py            (from this folder; about two minutes on a laptop CPU)
Needs Python 3.10 to 3.12 with kokoro 0.9.4, misaki[ja] and numpy, the UniDic dictionary (python3 -m unidic download,
about 500 MB) and ffmpeg on the path. The voice model (hexgrad/Kokoro-82M, Apache-2.0) is fetched from Hugging Face
on first use.

Voices: the narrator jf_gongitsune and the man jm_kumo, as named in the N5 to N2 app's licences (both built from
Koniwa recordings, CC BY 3.0), and the woman jf_alpha. Every clip is MP3, 24 kHz mono, 32 kbit/s, as base64 text,
with its length in milliseconds, which the screens use to keep time with it. The sound check (m_check)
says nothing about the level, so it is the same clip as in the N5 to N2 app.

Where the text-to-speech would misread a word, the spoken text spells it out (SAY) and the screen keeps
the written form. A number is said together with its choice, as one sentence: said alone, いち comes out unclear.
Kokoro's Japanese front end leaves out 、 and 。, so the text is cut at them and the model's own pause marks are put
back between the pieces."""
import base64
import os
import re
import subprocess
import tempfile

import numpy as np

from kokoro import KPipeline

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.join(HERE, 'project')
N2_PROJECT = os.path.join(HERE, '..', 'yaoki', 'project')
SR = 24000
NARR, MAN, WOMAN = 'jf_gongitsune', 'jm_kumo', 'jf_alpha'
NUM = ['いち、', 'に、', 'さん、', 'よん、']
# written form -> what the voice is given
SAY = {'技術畑': '技術ばたけ'}

pipe = KPipeline(lang_code='j', repo_id='hexgrad/Kokoro-82M')


PAUSE = {'、': ',', '。': '.', '？': '?', '！': '!'}


def phonemes(sentence):
    out = ''
    for piece, mark in re.findall(r'([^、。？！]*)([、。？！]?)', sentence):
        if piece.strip():
            out += pipe.g2p(piece)[0].strip()
        if mark:
            out = out.rstrip() + PAUSE[mark] + ' '
    return out.strip()


def speak(text, voice, speed):
    for k, v in SAY.items():
        text = text.replace(k, v)
    pack = pipe.load_voice(voice)
    # one sentence at a time, each with its commas
    audio = np.concatenate([KPipeline.infer(pipe.model, phonemes(s), pack, speed).audio.numpy()
                            for s in re.findall(r'[^。？！]+[。？！]?', text) if s.strip()])
    # trim the model's own silence: the clip timing is set by the gaps below
    on = np.where(np.abs(audio) > 0.01)[0]
    return audio[max(0, on[0] - int(0.03 * SR)):on[-1] + int(0.08 * SR)]


def silence(sec):
    return np.zeros(int(sec * SR), dtype=np.float32)


def clip(parts, speed=1.0):
    """parts: (voice, text) to say, or a number of seconds of silence. Gaps stretch with a slower speed."""
    out = [silence(0.1)]
    for p in parts:
        out.append(silence(p / speed) if isinstance(p, (int, float)) else speak(p[1], p[0], speed))
    out.append(silence(0.2))
    return np.concatenate(out).astype(np.float32)


def numbered(voice, options, gap=1.0):
    """the way the exam reads choices: each one after its number, with a pause between them"""
    parts = []
    for n, t in enumerate(options):
        parts += [gap, (voice, NUM[n] + t)]
    return parts


def mp3(audio):
    with tempfile.TemporaryDirectory() as d:
        wav, out = os.path.join(d, 'a.f32'), os.path.join(d, 'a.mp3')
        audio.astype(np.float32).tofile(wav)
        subprocess.run(['ffmpeg', '-v', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', wav,
                        '-codec:a', 'libmp3lame', '-b:a', '32k', '-ar', str(SR), '-ac', '1', out], check=True)
        return open(out, 'rb').read()


def entry(key, audio):
    ms = int(round(len(audio) / SR * 100)) * 10
    return "c['%s'] = { ms: %d, b: '%s' };" % (key, ms, base64.b64encode(mp3(audio)).decode('ascii'))


def write(name, comment, entries):
    body = '\n'.join(entries)
    text = '/* %s Played by sound.js. */\n(function () {\nvar c = window.__ykClips = window.__ykClips || {};\n%s\n})();\n' % (comment, body)
    open(os.path.join(PROJECT, name), 'w', encoding='utf-8').write(text)
    print('%s: %d clips, %d bytes' % (name, len(entries), len(text)))


# ---------- lessons: teach page, kanji scene, listening drill, notebook review ----------
DRILL = [(WOMAN, '言ってくれれば、手伝ったものを。')] + numbered(MAN, ['ごめん、忙しそうだったから。', '手伝ってくれて助かったよ。', 'じゃあ、次も言わないでおくね。'])
lessons = [
    ('l_drill', clip(DRILL)),
    ('r_item', clip([(MAN, '先日お送りした資料、お目通しいただけましたか。')] + numbered(WOMAN, ['いえ、まだお送りしていません。', 'はい、拝見しました。', 'ええ、ぜひご覧ください。']))),
    ('t_ex1', clip([(NARR, '連休とあって、観光地はどこも家族連れでにぎわっている。')])),
    ('t_ex2', clip([(NARR, '人気作家の講演会とあって、会場は開演前から熱気に包まれていた。')])),
]
SCENE = {'halt': '運転見合わせ', 'wire': '架線', 'restore': '復旧', 'transfer': '振替輸送', 'delay': '遅延証明書', 'refund': '払い戻し', 'detour': '迂回', 'limit': '入場規制'}
lessons += [('s_' + k, clip([(NARR, w)])) for k, w in SCENE.items()]
# the slower take of the drill, for the 0.8× button
lessons.append(('l_drill_slow', clip(DRILL, speed=0.8)))

# ---------- mini mock listening ----------
Q10 = '男の人は、このあとまず何をしなければなりませんか。'
TALK10 = [
    (WOMAN, '来週の発表、資料はもうできてる？'),
    (MAN, 'はい、ほぼ。あとはグラフを最新の数字に差し替えるだけです。'),
    (WOMAN, 'そう。それがね、先方の担当の方が替わったらしいのよ。今度の方は技術畑の出身だそうだから、細かい質問が出るかもしれない。'),
    (MAN, 'そうですか。じゃあ、想定される質問と答えをまとめておきます。'),
    (WOMAN, 'それもお願い。でも、その前に、当日何人いらっしゃるのか先方に確認してくれる？ 人数によっては、会議室を変えてもらわないといけないから。'),
    (MAN, 'わかりました。すぐ問い合わせます。'),
]
TALK11 = '「最近の若者は本を読まない」とよく言われます。確かに、紙の本の売り上げは年々減っています。ところが、調査を見ると、若い人たちが一日に読む文字の量は、むしろ増えているんです。スマートフォンでニュースや記事を読み、友人と長い文章をやり取りしている。問題は、読む量ではなく、一つの文章とじっくり向き合う時間が減っていることではないでしょうか。'
CHOICES11 = ['紙の本の売り上げが減っている理由', '若者が読む量と、読み方の変化', 'スマートフォンで読書をする利点', '若者に本を読ませるための方法']
mock = [
    ('m10_q', clip([(NARR, '会社で、女の人と男の人が、取引先での発表について話しています。' + Q10)])),
    ('m10_talk', clip([x for t in TALK10 for x in (0.5, t)][1:])),
    ('m10_q2', clip([(NARR, Q10)])),
    ('m11_talk', clip([(NARR, 'ラジオで、大学の先生が話しています。'), 0.8, (MAN, TALK11)])),
    ('m11_q', clip([(NARR, '先生は、何について話していますか。')] + numbered(NARR, CHOICES11))),
    ('m12_line', clip([(WOMAN, '部長、お言葉を返すようですが、その計画には少々無理があるかと存じます。')])),
    ('m12_replies', clip(numbered(MAN, ['いや、言葉は返さなくていいよ。', 'うん、無理をしないで進めてくれ。', 'そうか。どこが気になるのか聞かせてくれ。'])[1:])),
]

write('sound-lessons.js', 'Yaoki prototype sound data, N1: the listening drill, the notebook review item, the teach page examples and the kanji scene words. Synthetic voices, MP3 as base64.',
      [entry(k, a) for k, a in lessons])
check = re.search(r"c\['m_check'\] = \{[^}]*\};", open(os.path.join(N2_PROJECT, 'sound-mock.js'), encoding='utf-8').read()).group(0)
write('sound-mock.js', 'Yaoki prototype sound data, N1: the mini mock listening section and its sound check. Synthetic voices, MP3 as base64.',
      [check] + [entry(k, a) for k, a in mock])
