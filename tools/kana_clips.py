"""Make the kana course's clips and pack them for the app: each kana sound and each word and sentence the course plays.
usage (with the text-to-speech packages, see README "The kana course"):
    python tools/kana_clips.py --model DIR [--out DIR] [--only key ...] [--pack-only]
DIR holds kokoro-v1.0.onnx and voices-v1.0.bin (Kokoro-82M, ONNX build, from the kokoro-onnx releases on GitHub).
What to say comes from content/kana/clips.json (written by tools/make-kana.mjs): sounds (k_…, a kana said on its own)
and words (kw_… a word, ks_… a sentence). The voice is the narrator of the other clips, jf_gongitsune, a little slower
than its everyday pace (0.9), for learners. A kana or a word said on its own comes out garbled, so each is said after a
carrier phrase, つぎは、…。, and cut out of it at the pause (as the scene words were); a sentence is said as it is.
Every clip is trimmed of silence, brought to the same loudness, encoded as MP3 (mono, 24 kHz, 32 kbps) into --out (a
cache folder by default), listed in tts-clips/kana-manifest.json with its length and the phonemes the voice was given,
then packed per unit into yaoki/project/sound-course-kana-uNN.js, holding the clips that unit's days and test play."""
import base64
import json
import os
import re
import subprocess
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
KANA = os.path.join(ROOT, 'content', 'kana')
MANIFEST = os.path.join(ROOT, 'tts-clips', 'kana-manifest.json')
VOICE, SPEED, SR = 'jf_gongitsune', 0.9, 24000
CARRIER = 'つぎは、'


def args():
    a = sys.argv[1:]
    get = lambda name, d=None: a[a.index(name) + 1] if name in a else d
    only = a[a.index('--only') + 1:] if '--only' in a else []
    return get('--model'), get('--out', os.path.join(os.path.expanduser('~'), '.cache', 'yaoki', 'kana-clips')), only, '--pack-only' in a


def phonemes(g2p, text):
    """the phonemes of a word as one unbroken run (a space inside a word makes the voice break it in two)"""
    p = g2p(text)
    p = p[0] if isinstance(p, tuple) else p
    return re.sub(r'\s+', '', p.strip())


def sentence_phonemes(g2p, text):
    """a sentence: each part (written with a space between, as beginners' books write) as one run, the parts apart"""
    parts = [x for x in re.split(r'[\s　]+', text) if x]
    return ' '.join(phonemes(g2p, x) for x in parts)


def envelope(x, hop=240):
    n = len(x) // hop
    return np.sqrt(np.mean(x[: n * hop].reshape(n, hop) ** 2, axis=1) + 1e-12)


def trim(x, floor=0.012):
    env = envelope(x)
    on = np.where(env > floor)[0]
    if not len(on):
        return x
    a = max(0, on[0] * 240 - 480)
    b = min(len(x), (on[-1] + 1) * 240 + 1440)
    return x[a:b]


def cut_after_carrier(x):
    """everything after the pause that follows the carrier つぎは、: the first stretch of 80 ms or more, from 0.3 s into the
    carrier, quieter than a fifth of the loudest sound. Some of the pause is kept (150 ms at most), or a word that opens
    with a stop or a hiss (k, t, sh) loses its first sound; trim() then takes off what is silent"""
    env = envelope(x)
    hop_s = 240 / SR
    loud_frames = np.where(env > env.max() * 0.2)[0]
    onset = int(loud_frames[0]) if len(loud_frames) else 0
    quiet = env < env.max() * 0.2
    i = onset + int(0.3 / hop_s)
    while i < len(quiet):
        if quiet[i]:
            j = i
            while j < len(quiet) and quiet[j]:
                j += 1
            if (j - i) * hop_s >= 0.08 and j < len(quiet) - 2 and env[j:].max() > env.max() * 0.2:
                cut = max(i + 2, j - int(0.15 / hop_s))
                return x[cut * 240:], (i * hop_s, j * hop_s)
            i = j
        else:
            i += 1
    raise AssertionError('no pause after the carrier')


# the sounds that open with a hiss or a burst of their own: a clip that starts with one keeps the noise before its vowel
NOISY = ('s', 'ɕ', 'h', 'ç', 'ɸ', 'ʦ', 'ʨ', 'k', 't', 'p', 'ʣ', 'ʥ', 'z')


def no_breath(x, ph):
    """a breath the voice takes in the pause before a sound that opens with the voice (ニュ, a vowel, m, n, r …): a hiss of
    40 ms or more just before the voice starts, which the clip leaves out. A sound that opens with a hiss of its own
    (s, sh, h, f, ts, ch, k, t, p) keeps it"""
    if ph.lstrip().startswith(NOISY):
        return x
    hop = 240
    n = len(x) // hop
    if n < 3:
        return x
    frames = x[: n * hop].reshape(n, hop)
    db = 20 * np.log10(np.sqrt(np.mean(frames ** 2, axis=1) + 1e-12) / (np.sqrt(np.mean(frames ** 2, axis=1) + 1e-12).max()))
    onset = int(np.argmax(db > -12))
    spec = np.abs(np.fft.rfft(frames * np.hanning(hop), 1024, axis=1))
    centre = (spec * np.fft.rfftfreq(1024, 1 / SR)).sum(axis=1) / (spec.sum(axis=1) + 1e-9)
    hiss = [i for i in range(onset) if db[i] > -32 and centre[i] > 2500]
    if len(hiss) < 4:
        return x
    y = x[(hiss[-1] + 1) * hop:].copy()
    fade = int(0.01 * SR)
    y[:fade] *= np.linspace(0, 1, fade)
    return y


def morae(text):
    """the beats of a word: every kana but a small ゃ ゅ ょ or a small vowel, which joins the kana before it"""
    return max(1, sum(1 for c in text if c not in 'ゃゅょャュョぁぃぅぇぉァィゥェォ'))


def loud(x, target=0.1):
    env = envelope(x)
    voiced = env[env > env.max() * 0.2]
    rms = float(np.sqrt(np.mean(voiced ** 2))) if len(voiced) else float(env.max())
    y = x * (target / max(rms, 1e-6))
    peak = float(np.abs(y).max())
    if peak > 0.89:
        y = y * (0.89 / peak)
    fade = int(0.005 * SR)
    y[:fade] *= np.linspace(0, 1, fade)
    y[-fade:] *= np.linspace(1, 0, fade)
    return y.astype(np.float32)


def to_mp3(x, path):
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', '-codec:a', 'libmp3lame', '-b:a', '32k', '-ar', str(SR), '-ac', '1', path], input=x.astype(np.float32).tobytes(), check=True)


def ms_of(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', path], capture_output=True, text=True, check=True).stdout
    return int(round(float(out) * 1000))


def make(model_dir, out, only):
    from kokoro_onnx import Kokoro
    from misaki import ja
    kokoro = Kokoro(os.path.join(model_dir, 'kokoro-v1.0.onnx'), os.path.join(model_dir, 'voices-v1.0.bin'))
    g2p = ja.JAG2P()
    clips = json.load(open(os.path.join(KANA, 'clips.json'), encoding='utf-8'))
    manifest = json.load(open(MANIFEST, encoding='utf-8')) if os.path.exists(MANIFEST) else {}
    os.makedirs(out, exist_ok=True)
    jobs = [(k, 'sound', v['say']) for k, v in clips['sounds'].items()] + [(k, 'sentence' if k.startswith('ks_') else 'word', v['text']) for k, v in clips['words'].items()]
    made = 0
    for key, kind, text in jobs:
        path = os.path.join(out, key + '.mp3')
        if only and key not in only:
            continue
        if not only and key in manifest and manifest[key].get('text') == text and os.path.exists(path):
            continue
        if kind == 'sentence':
            ph = sentence_phonemes(g2p, text.replace('。', '').replace('、', ''))
            x, sr = kokoro.create(ph + '.', voice=VOICE, speed=SPEED, lang='ja', is_phonemes=True)
            pause = None
        else:
            word = phonemes(g2p, text)
            # a kana with a small ャ ュ ョ is one sound: the voice's reading of a few of them alone (ミョ, リョ, ギョ as
            # mʲijo …) is replaced by the kana's consonant and the small kana's vowel, as in キョ kʲo
            if kind == 'sound' and len(text) == 2 and text[1] in 'ャュョゃゅょ':
                word = re.sub(r'i$', '', phonemes(g2p, text[0])) + {'ャ': 'a', 'ュ': 'ɨ', 'ョ': 'o', 'ゃ': 'a', 'ゅ': 'ɨ', 'ょ': 'o'}[text[1]]
            # a kana with a small vowel is one sound too: フィ alone comes out as two (ɸɯi); in a word (フィルム) the voice
            # says ɸʲi, so that is what it is given
            if kind == 'sound' and len(text) == 2 and text[1] in 'ァィゥェォ':
                word = re.sub(r'ɯ([aieo])$', lambda m: 'ʲi' if m.group(1) == 'i' else m.group(1), word)
            # ん said on its own runs into the carrier unless it is held a little longer
            if word == 'ɴ':
                word = 'ɴː'
            x = pause = None
            # the carrier ends at a comma; where the voice makes no pause there, at a full stop, and failing that it
            # becomes a sentence of its own (つぎはです。), after which the voice always stops
            for mark in (', ', '. ', ' desɨ. '):
                ph = phonemes(g2p, CARRIER.rstrip('、')) + mark + word + '.'
                full, sr = kokoro.create(ph, voice=VOICE, speed=SPEED, lang='ja', is_phonemes=True)
                assert sr == SR, sr
                try:
                    cut, where = cut_after_carrier(np.asarray(full, dtype=np.float32))
                except AssertionError:
                    continue
                # a cut in the right place leaves the whole word: about 90 ms a beat at the least (a cut at the short
                # stop of きって would leave only て)
                if len(trim(cut)) / SR >= 0.09 * morae(text):
                    x, pause = cut, where
                    break
            if x is None:
                raise AssertionError('no pause after the carrier for ' + key)
            ph = word
        y = loud(no_breath(trim(np.asarray(x, dtype=np.float32)), ph))
        to_mp3(y, path)
        manifest[key] = {'text': text, 'kind': kind, 'phonemes': ph, 'ms': ms_of(path), 'bytes': os.path.getsize(path), 'pause': [round(p, 2) for p in pause] if pause else None}
        made += 1
        print(key.ljust(22), kind.ljust(8), '%5d ms' % manifest[key]['ms'], text, '/', ph, flush=True)
        json.dump(manifest, open(MANIFEST, 'w', encoding='utf-8'), ensure_ascii=False, indent=1, sort_keys=True)
    print('made %d clips; %d in the manifest' % (made, len(manifest)))
    return manifest


# what the voice was given, read back as letters, against the clip's romaji: a kana or a word read wrong by the
# phonemizer (りょ alone as ri-yo, は alone as the little word wa) shows up as a difference
# IPA j (the y of ya) first, so that the j of ʥ is left as it is; ん takes the sound of what follows (m before p b m,
# ŋ before k g, ɲ before n), as it should, and counts as n
PH = [('j', 'y'), ('ɲɲ', 'nɲ'), ('ŋ', 'n'), ('ʔ', 'Q'), ('kʲ', 'ky'), ('ɡʲ', 'gy'), ('ɾʲ', 'ry'), ('mʲ', 'my'), ('bʲ', 'by'), ('pʲ', 'py'), ('tʲ', 't'), ('dʲ', 'd'), ('ɕ', 'sh'), ('ʨ', 'ch'),
      ('ʦ', 'ts'), ('ʥ', 'j'), ('ʣ', 'z'), ('ɸ', 'f'), ('ç', 'hy'), ('ɲ', 'ny'), ('ɾ', 'r'), ('β', 'w'), ('ɯ', 'u'), ('ɨ', 'u'), ('ɴ', 'n'), ('ɡ', 'g')]


def letters_of_phonemes(ph):
    s = ph
    for a, b in PH:
        s = s.replace(a, b)
    s = re.sub(r'([aiueo])ː', r'\1\1', s)
    s = re.sub(r'(?<=[kgrmbpnh])yi', 'i', s)
    s = re.sub(r'(?<=sh|ch)y?i', 'i', s)
    return re.sub(r'[^a-zQ]', '', s)


def letters_of_romaji(r):
    s = r.lower().replace('ā', 'aa').replace('ī', 'ii').replace('ū', 'uu').replace('ē', 'ee').replace('ō', 'oo')
    s = s.replace('ei', 'ee').replace('ou', 'oo').replace("n'", 'n')
    s = re.sub(r'tch', 'Qch', s)
    s = re.sub(r'([kgsztdbpfhmrjc])\1', r'Q\1', s)
    s = s.replace('Qs' + 'h', 'Qsh')
    s = re.sub(r'n(?=[pbm])', 'm', s)
    return re.sub(r'[^a-zQ]', '', s)


def check_phonemes():
    clips = json.load(open(os.path.join(KANA, 'clips.json'), encoding='utf-8'))
    manifest = json.load(open(MANIFEST, encoding='utf-8'))
    romaji = {k: v['r'] for k, v in clips['sounds'].items()}
    romaji.update({k: v['r'] for k, v in clips['words'].items()})
    bad = []
    for k, r in sorted(romaji.items()):
        if k not in manifest:
            continue
        a = letters_of_phonemes(manifest[k]['phonemes'])
        b = letters_of_romaji(r)
        # ん held long for its own clip
        if a != b and not (k == 'k_n' and a == 'nn'):
            bad.append('%s: %s said as %s (%s)' % (k, r, manifest[k]['phonemes'], a))
    for x in bad:
        print('  PHONEMES ' + x)
    print(('KANA PHONEMES FAIL: %d clips are not said as their romaji' % len(bad)) if bad else 'KANA PHONEMES PASS: every clip is said as its romaji')
    return 1 if bad else 0


def pack(out):
    manifest = json.load(open(MANIFEST, encoding='utf-8'))
    missing = set()
    for name in sorted(os.listdir(KANA)):
        m = re.fullmatch(r'u(\d\d)\.json', name)
        if not m:
            continue
        text = open(os.path.join(KANA, name), encoding='utf-8').read()
        keys = sorted(set(re.findall(r'"(k[sw]?_[a-z0-9_]+)"', text)))
        lines = ['/* Yaoki kana course sound, unit %d: the kana, words and sentences its days and test play. Synthetic voice (Kokoro-82M), MP3 as base64. Generated by tools/kana_clips.py. Played by sound.js. */' % int(m.group(1)),
                 '(function () {', 'var c = window.__ykClips = window.__ykClips || {};']
        n = 0
        for k in keys:
            path = os.path.join(out, k + '.mp3')
            if k not in manifest or not os.path.exists(path):
                missing.add(k)
                continue
            lines.append("c['%s'] = { ms: %d, b: '%s' };" % (k, manifest[k]['ms'], base64.b64encode(open(path, 'rb').read()).decode('ascii')))
            n += 1
        lines.append('})();')
        dest = os.path.join(ROOT, 'yaoki', 'project', 'sound-course-kana-u%s.js' % m.group(1))
        open(dest, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
        print('%s: %d clips, %d KB' % (os.path.basename(dest), n, os.path.getsize(dest) // 1024))
    if missing:
        print('KANA CLIPS FAIL: %d clips named in the course are not made: %s' % (len(missing), ' '.join(sorted(missing)[:20])))
        return 1
    print('KANA CLIPS PASS: every clip the kana course names is packed')
    return 0


if __name__ == '__main__':
    model, out, only, pack_only = args()
    if not pack_only:
        if not model:
            sys.exit('kana_clips: --model DIR (the folder with kokoro-v1.0.onnx and voices-v1.0.bin) is needed to make clips')
        make(model, out, only)
    sys.exit(pack(out) | check_phonemes())
