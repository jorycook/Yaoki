"""Makes the N1 app's spoken clips: project/audio/ (every lesson's clips, one MP3 file each, named in audio/clips.js)
and project/sound-mock.js (the first mini mock and the sound check, as base64 text).

usage: python3 make-sound.py            (from this folder; the first run takes a while, later runs only redo what changed)
Needs Python 3.10 to 3.12 with kokoro 0.9.4, misaki[ja] and numpy, the UniDic dictionary (python3 -m unidic download,
about 500 MB) and ffmpeg on the path. The voice model (hexgrad/Kokoro-82M, Apache-2.0) is fetched from Hugging Face
on first use.

Voices: the narrator jf_gongitsune and the man jm_kumo, as named in the N5 to N2 app's licences (both built from
Koniwa recordings, CC BY 3.0), and the woman jf_alpha. Every clip is MP3, 24 kHz mono, 32 kbit/s,
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
# written form -> what the voice is given, where the voice would misread a word: these, and content/readings.json
# (a fragment of a lesson or mock text, long enough to be unique, and the same with the word in kana)
SAY = {'技術畑': '技術ばたけ', '何分不慣れ': 'なにぶん不慣れ', '何分ほど': 'なんぷんほど'}
_readings = os.path.join(HERE, 'content', 'readings.json')
if os.path.exists(_readings):
    import json as _json
    SAY.update(_json.load(open(_readings, encoding='utf-8')))

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


# ---------- lessons: every lesson's teach page examples, words and listening item, one MP3 file each ----------
# Kept as files in project/audio (the build copies them), named in audio/clips.js. A clip is made again only when
# its text or voice changes: audio/clips.json keeps what each file says.
AUDIO = os.path.join(PROJECT, 'audio')
VOICE = {'男': MAN, '女': WOMAN}


def spoken(text):
    """what the voice is given for a text with markup: the furigana instead of its kanji, no 【】, and the fixed readings"""
    text = re.sub(r'[一-鿿々〆ヶ]+《([^》]+)》', r'\1', text)
    text = text.replace('【', '').replace('】', '')
    for k, v in SAY.items():
        text = text.replace(k, v)
    return text


def lesson_clips(lesson):
    """(key, parts) for one lesson"""
    lid = lesson['id']
    out = []
    for p, pat in enumerate(lesson['grammar']['patterns']):
        for e, ex in enumerate(pat['ex']):
            out.append(('g.%s.%d.%d' % (lid, p, e), [(NARR, spoken(ex['ja']))]))
    # the lesson's five words, then the fifteen of its word bank (BANKS.md), numbered on from 5
    for n, w in enumerate(list(lesson.get('vocab', [])) + list(lesson.get('vocab2', []))):
        out.append(('w.%s.%d' % (lid, n), [(NARR, w['r'] + '。'), 0.6, (NARR, spoken(w['ex']['ja']))]))
    t = lesson['listening']
    other = WOMAN if t['who'] == '男' else MAN
    parts = [(VOICE[t['who']], spoken(t['line']))] + numbered(other, t['replies'])
    out.append(('l.%s' % lid, parts))
    # the slower take, for the 0.8x button
    out.append(('l.%s.slow' % lid, parts, 0.8))
    # the longer listening item of the bank: one clip per part, as a mock's (l.<lesson id>.<part>)
    t2 = lesson.get('listening2')
    if t2:
        for a in t2['audio']:
            out.append(('l.%s.%s' % (lid, a['part']), part_lines(a['lines'], t2['kind'])))
    return out


def part_lines(lines, kind):
    """the parts of a listening item (a mock's or the bank's) as (voice, text) with pauses: a numbered choice is said
    by the narrator, or in a quick-response item by the other speaker than the line's"""
    speakers = [w for w, _ in lines if w in VOICE]
    parts = []
    for who, text in lines:
        if who in ('1', '2', '3', '4'):
            voice = NARR if kind != 'quick' else (WOMAN if speakers and speakers[0] == '男' else MAN)
            parts += [1.0, (voice, NUM[int(who) - 1] + spoken(text))]
        else:
            parts += [0.5, (VOICE.get(who, NARR), spoken(text))]
    return parts[1:]


def mock_clips(mock):
    """(key, parts) for each listening part of a mock that names no clips of its own (mock 2 on; see content/MOCKS.md)"""
    out = []
    n = 0
    for sec in mock['sections']:
        for it in sec['items']:
            n += 1
            if 'audio' not in it or any('clip' in a for a in it['audio']):
                continue
            for a in it['audio']:
                out.append(('m%d.%d.%s' % (mock['id'], n, a['part']), part_lines(a['lines'], it['kind'])))
    return out


def make_files(items):
    """items: (key, parts). Writes the MP3 files that are missing or out of date, and audio/clips.js"""
    import hashlib
    import json
    os.makedirs(AUDIO, exist_ok=True)
    known_path = os.path.join(AUDIO, 'clips.json')
    known = json.load(open(known_path, encoding='utf-8')) if os.path.exists(known_path) else {}
    keep = {}
    made = 0
    for key, parts, *rest in items:
        speed = rest[0] if rest else 1.0
        sig = hashlib.sha1(json.dumps([parts, speed], ensure_ascii=False).encode('utf-8')).hexdigest()[:12]
        f = os.path.join(AUDIO, key + '.mp3')
        if key in known and known[key]['sig'] == sig and os.path.exists(f):
            keep[key] = known[key]
            continue
        audio = clip(parts, speed)
        open(f, 'wb').write(mp3(audio))
        keep[key] = {'sig': sig, 'ms': int(round(len(audio) / SR * 100)) * 10}
        made += 1
        if made % 25 == 0:
            print('  %d clips made' % made, flush=True)
    for f in os.listdir(AUDIO):
        if f.endswith('.mp3') and f[:-4] not in keep:
            os.remove(os.path.join(AUDIO, f))
    json.dump(keep, open(known_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=0, sort_keys=True)
    lines = ["c['%s'] = { ms: %d, u: 'audio/%s.mp3' };" % (k, v['ms'], k) for k, v in sorted(keep.items())]
    open(os.path.join(AUDIO, 'clips.js'), 'w', encoding='utf-8').write(
        '/* Generated by make-sound.py: the spoken clips kept as files next to this one. Synthetic voices. Played by sound.js. */\n'
        '(function () {\nvar c = window.__ykClips = window.__ykClips || {};\n%s\n})();\n' % '\n'.join(lines))
    size = sum(os.path.getsize(os.path.join(AUDIO, k + '.mp3')) for k in keep)
    print('audio/: %d clips (%d made now), %d bytes' % (len(keep), made, size))


def lessons_in_order():
    """the lessons with their banks, as build-content.mjs joins them (so the clips follow the same numbering)"""
    import json
    syllabus = json.load(open(os.path.join(HERE, 'content', 'syllabus.json'), encoding='utf-8'))
    out = []
    for w in syllabus['weeks']:
        banks = {}
        for kind in ('words', 'reading', 'listening'):
            f = os.path.join(HERE, 'content', kind, 'u%d.json' % w['n'])
            banks[kind] = json.load(open(f, encoding='utf-8')) if os.path.exists(f) else None
        for d in w['days']:
            f = os.path.join(HERE, 'content', 'lessons', 'u%dl%d.json' % (w['n'], d['d']))
            if not os.path.exists(f):
                continue
            lesson = json.load(open(f, encoding='utf-8'))
            lesson['vocab2'] = (banks['words'] or {}).get('lessons', {}).get(str(d['d']), [])
            items = (banks['listening'] or {}).get('items') or []
            lesson['listening2'] = items[d['d'] - 1] if len(items) >= d['d'] else None
            out.append(lesson)
    return out


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

def mocks_in_order():
    import json
    d = os.path.join(HERE, 'content', 'mocks')
    return [json.load(open(os.path.join(d, f), encoding='utf-8')) for f in sorted(os.listdir(d)) if f.endswith('.json')]


make_files([c for lesson in lessons_in_order() for c in lesson_clips(lesson)] + [c for m in mocks_in_order() for c in mock_clips(m)])
check = re.search(r"c\['m_check'\] = \{[^}]*\};", open(os.path.join(N2_PROJECT, 'sound-mock.js'), encoding='utf-8').read()).group(0)
write('sound-mock.js', 'Yaoki prototype sound data, N1: the mini mock listening section and its sound check. Synthetic voices, MP3 as base64.',
      [check] + [entry(k, a) for k, a in mock])
