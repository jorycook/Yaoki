"""What a speech recogniser hears in a clip, for the clip checks; it runs offline, with no download on use.

Two recognisers, both run by sherpa-onnx (pip install sherpa-onnx) from models in the sherpa-onnx releases on GitHub
(github.com/k2-fsa/sherpa-onnx/releases, tag asr-models), unpacked into one folder (--asr DIR, or YK_ASR):
  sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2025-09-09   SenseVoice, several languages, set to Japanese
  sherpa-onnx-zipformer-ja-reazonspeech-2024-08-01          ReazonSpeech, Japanese only
A short word heard alone is often misheard by one of them; a clip both mishear is the one to listen to. SenseVoice
(this build) writes kanji and leaves out much of the kana, so its scores run low: ReazonSpeech's are the ones to go by.
A clip is heard sentence by sentence (cut at its pauses), with silence after each piece: heard whole, both can drop a
sentence that follows a long pause, or the end of the last one.

    from asr_onnx import Ears
    ears = Ears(folder)
    ears.heard(mp3_bytes)            -> {'sv': 'text', 'rs': 'text'}
    ears.score(said, mp3_bytes)      -> (best match from 0 to 1, what each heard), compared as the texts sound in kana
"""
import difflib
import glob
import os
import re
import subprocess

import numpy as np


def sounds(k):
    """a katakana reading as it sounds: long vowels as ー, ヅ as ズ, ヂ as ジ (as tools/course_sound.py compares)"""
    k = re.sub(r'[^ァ-ヴー]', '', k).replace('ヅ', 'ズ').replace('ヂ', 'ジ')
    k = re.sub(r'([アカサタナハマヤラワガザダバパャ])ア|([イキシチニヒミリギジヂビピィ])イ|([ウクスツヌフムユルグズヅブプュ])ウ|'
               r'([エケセテネヘメレゲゼデベペ])[イエ]|([オコソトノホモヨロゴゾドボポョ])[ウオ]',
               lambda m: next(g for g in m.groups() if g) + 'ー', k)
    return k


def kana(text):
    import pyopenjtalk
    t = re.sub(r'[／。、？！「」『』（）・…,.?!]', ' ', text or '')
    return sounds(pyopenjtalk.g2p(t, kana=True)) if t.strip() else ''


def match(said, got):
    a, b = kana(said), kana(got)
    return round(difflib.SequenceMatcher(None, a, b, autojunk=False).ratio(), 2) if a and b else 0.0


def pcm16k(data):
    """an MP3 (bytes) or a float32 array at 24 kHz, as float32 samples at 16 kHz with a little silence around them"""
    if isinstance(data, (bytes, bytearray)):
        raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', 'pipe:0', '-f', 'f32le', '-ac', '1', '-ar', '16000', 'pipe:1'],
                             input=bytes(data), capture_output=True, check=True).stdout
    else:
        raw = subprocess.run(['ffmpeg', '-v', 'error', '-f', 'f32le', '-ar', '24000', '-ac', '1', '-i', 'pipe:0',
                              '-f', 'f32le', '-ac', '1', '-ar', '16000', 'pipe:1'],
                             input=np.asarray(data, np.float32).tobytes(), capture_output=True, check=True).stdout
    # a second of silence after the clip: without it ReazonSpeech can leave out the end of the last sentence
    return np.concatenate([np.zeros(4800, np.float32), np.frombuffer(raw, np.float32), np.zeros(16000, np.float32)])


def pieces(a, sr=16000, most=20.0, look=6.0, gap=0.35):
    """16 kHz samples cut into what is said between pauses (a silence of `gap` seconds or more: between sentences,
    speakers or numbered choices), as both recognisers can drop a whole sentence that follows a long pause; a piece
    still longer than `most` seconds is cut at the quietest 20 ms in the last `look` seconds before the limit. Each
    piece has a little silence around it."""
    hop = int(0.02 * sr)
    n = len(a) // hop
    if n:
        rms = np.sqrt(np.mean(a[:n * hop].reshape(n, hop) ** 2, axis=1))
        quiet = rms < max(rms.max() * 0.02, 1e-4)
        cuts, run = [], 0
        for i, q in enumerate(quiet):
            run = run + 1 if q else 0
            if q and run == int(gap / 0.02):
                cuts.append(i)
        bounds = [0] + [c * hop for c in cuts] + [len(a)]
        parts = [a[x:y] for x, y in zip(bounds, bounds[1:]) if y - x > int(0.12 * sr) and np.abs(a[x:y]).max() > 1e-3]
        if len(parts) > 1:
            return [p for part in parts for p in pieces_long(part, sr, most, look)]
    return pieces_long(a, sr, most, look)


def pieces_long(a, sr=16000, most=20.0, look=6.0):
    hop = int(0.02 * sr)
    pad = np.zeros(int(0.15 * sr), np.float32)
    tail = np.zeros(int(0.8 * sr), np.float32)
    if len(a) <= (most + 5) * sr:
        return [np.concatenate([pad, a, tail])]
    out, start = [], 0
    while len(a) - start > most * sr:
        lo, hi = start + int((most - look) * sr), start + int(most * sr)
        seg = a[lo:hi]
        n = len(seg) // hop
        energy = np.sqrt(np.mean(seg[:n * hop].reshape(n, hop) ** 2, axis=1))
        cut = lo + int(np.argmin(energy)) * hop + hop // 2
        out.append(np.concatenate([pad, a[start:cut], pad]))
        start = cut
    out.append(np.concatenate([pad, a[start:], pad]))
    return out


class Ears:
    def __init__(self, folder=None):
        import sherpa_onnx
        folder = folder or os.environ.get('YK_ASR') or os.path.join(os.path.expanduser('~'), '.cache', 'yaoki', 'asr')
        self.rec = {}
        sv = glob.glob(os.path.join(folder, 'sherpa-onnx-sense-voice-*'))
        if sv:
            d = sorted(sv)[-1]
            model = (glob.glob(os.path.join(d, 'model.int8.onnx')) or glob.glob(os.path.join(d, 'model.onnx')))[0]
            self.rec['sv'] = sherpa_onnx.OfflineRecognizer.from_sense_voice(
                model=model, tokens=os.path.join(d, 'tokens.txt'), language='ja', use_itn=False, num_threads=4)
        rs = glob.glob(os.path.join(folder, 'sherpa-onnx-zipformer-ja-reazonspeech-*'))
        if rs:
            d = sorted(rs)[-1]
            pick = lambda name: (sorted(glob.glob(os.path.join(d, name + '*.int8.onnx'))) or sorted(glob.glob(os.path.join(d, name + '*.onnx'))))[0]
            self.rec['rs'] = sherpa_onnx.OfflineRecognizer.from_transducer(
                encoder=pick('encoder'), decoder=pick('decoder'), joiner=pick('joiner'),
                tokens=os.path.join(d, 'tokens.txt'), num_threads=4, decoding_method='greedy_search')
        if not self.rec:
            raise SystemExit('no recogniser models in %s (see tools/asr_onnx.py)' % folder)

    def heard(self, data):
        """what each recogniser hears; a long clip (a talk of a minute or more) is heard in pieces of up to 20 seconds,
        cut at its quietest moments, as both models are trained on short utterances"""
        a = pcm16k(data)
        out = {}
        for name, r in self.rec.items():
            texts = []
            for piece in pieces(a):
                s = r.create_stream()
                s.accept_waveform(16000, piece)
                r.decode_stream(s)
                texts.append(s.result.text.strip())
            out[name] = ''.join(texts)
        return out

    def score(self, said, data):
        got = self.heard(data)
        return max(match(said, t) for t in got.values()), got
