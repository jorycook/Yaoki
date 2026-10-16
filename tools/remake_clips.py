"""Makes again the clips of the main app's courses whose sentence changed, in place in yaoki/project/sound-course-*.js.

usage: python3 tools/remake_clips.py <key> [<key> ...]      (from the repository root, with the N1 app's voice venv)
A key such as x_n3u01d1_p1_1 is unit 1 day 1 point 1 example 1 of content/n3/u01.json; the text is read from there,
said by the narrator with the same voice, speed and encoding as the course's other clips (yaoki-n1/make-sound.py), and
the entry c['<key>'] = { ms, b } in the unit's sound file is replaced. Keys the course does not name are reported."""
import base64
import json
import os
import re
import subprocess
import sys
import tempfile

import numpy as np

from kokoro import KPipeline

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 24000
NARR = 'jf_gongitsune'
PAUSE = {'、': ',', '。': '.', '？': '?', '！': '!'}
pipe = KPipeline(lang_code='j', repo_id='hexgrad/Kokoro-82M')


def plain(s):
    return re.sub(r'[{}_^]', '', re.sub(r'\[([^|\]]*)\|[^\]]*\]', r'\1', s))


def phonemes(sentence):
    out = ''
    for piece, mark in re.findall(r'([^、。？！]*)([、。？！]?)', sentence):
        if piece.strip():
            out += pipe.g2p(piece)[0].strip()
        if mark:
            out = out.rstrip() + PAUSE[mark] + ' '
    return out.strip()


def speak(text, voice, speed=1.0):
    pack = pipe.load_voice(voice)
    audio = np.concatenate([KPipeline.infer(pipe.model, phonemes(s), pack, speed).audio.numpy()
                            for s in re.findall(r'[^。？！]+[。？！]?', text) if s.strip()])
    on = np.where(np.abs(audio) > 0.01)[0]
    return audio[max(0, on[0] - int(0.03 * SR)):on[-1] + int(0.08 * SR)]


def clip(text):
    return np.concatenate([np.zeros(int(0.1 * SR), np.float32), speak(text, NARR), np.zeros(int(0.2 * SR), np.float32)]).astype(np.float32)


def mp3(audio):
    with tempfile.TemporaryDirectory() as d:
        wav, out = os.path.join(d, 'a.f32'), os.path.join(d, 'a.mp3')
        audio.astype(np.float32).tofile(wav)
        subprocess.run(['ffmpeg', '-v', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', wav,
                        '-codec:a', 'libmp3lame', '-b:a', '32k', '-ar', str(SR), '-ac', '1', out], check=True)
        return open(out, 'rb').read()


def text_of(key):
    m = re.fullmatch(r'x_(n\d)u(\d\d)d(\d)_p(\d)_(\d)', key)
    if not m:
        return None, None
    level, unit, day, point, ex = m.groups()
    f = os.path.join(ROOT, 'content', level, 'u%s.json' % unit)
    d = json.load(open(f, encoding='utf-8'))
    try:
        t = d['days'][day]['grammar']['points'][int(point) - 1]['examples'][int(ex) - 1]['ja']
    except (KeyError, IndexError):
        return None, None
    return plain(t), os.path.join(ROOT, 'yaoki', 'project', 'sound-course-%s-u%s.js' % (level, unit))


for key in sys.argv[1:]:
    text, sound_file = text_of(key)
    if not text or not os.path.exists(sound_file):
        print('not in the course:', key)
        continue
    audio = clip(text)
    ms = int(round(len(audio) / SR * 100)) * 10
    entry = "c['%s'] = { ms: %d, b: '%s' };" % (key, ms, base64.b64encode(mp3(audio)).decode('ascii'))
    s = open(sound_file, encoding='utf-8').read()
    pattern = re.compile(r"c\['%s'\] = \{ ms: \d+, b: '[^']*' \};" % re.escape(key))
    if not pattern.search(s):
        print('no entry to replace:', key)
        continue
    open(sound_file, 'w', encoding='utf-8').write(pattern.sub(lambda _: entry, s, count=1))
    print('%s: %d ms, %s' % (key, ms, text))
