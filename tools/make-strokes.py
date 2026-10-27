#!/usr/bin/env python3
"""Stroke-order data for the writing practice, made from KanjiVG.

usage: python3 tools/make-strokes.py [--kanjivg DIR] [--check]

Writes, for each app, the strokes of every kanji the learner writes in it, in stroke order:
  yaoki/project/strokes.js     the main app (N5 to N2): every kanji of the words of the kanji-and-words scenes
                               (content/n*/u*.json)
  yaoki-n1/project/strokes.js  the N1 app: the kanji bank and every kanji of the words (yaoki-n1/project/n1-content.js)
Each file sets window.__ykStrokes = { kanji: "stroke|stroke|…" }, a stroke being SVG path data in KanjiVG's
109 × 109 box, numbers rounded to one decimal place. yk-write.js reads it.

KanjiVG (https://kanjivg.tagaini.net, by Ulrich Apel and contributors) is under the Creative Commons Attribution-Share
Alike 3.0 licence, and so is the data made from it here. The release named in RELEASE is downloaded once into a cache
folder (~/.cache/yaoki), or read from --kanjivg DIR (a folder holding KanjiVG's kanji/ folder of SVG files).

--check only reports kanji that a strokes.js file is missing (the course build calls it to make sure every new word
can be written), and fails if any is.
"""
import io
import json
import os
import re
import sys
import urllib.request
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
RELEASE = 'r20240807'
ZIP_URL = 'https://github.com/KanjiVG/kanjivg/releases/download/%s/kanjivg-%s-main.zip' % (RELEASE, RELEASE[1:])
CACHE = os.path.join(os.environ.get('XDG_CACHE_HOME') or os.path.expanduser('~/.cache'), 'yaoki', 'kanjivg-' + RELEASE)

MAIN_OUT = os.path.join(ROOT, 'yaoki', 'project', 'strokes.js')
N1_OUT = os.path.join(ROOT, 'yaoki-n1', 'project', 'strokes.js')


def is_kanji(c):
    """a character the learner writes as a kanji: CJK ideographs, and the repeat mark 々"""
    o = ord(c)
    return 0x4E00 <= o <= 0x9FFF or 0x3400 <= o <= 0x4DBF or 0xF900 <= o <= 0xFAFF or c == '々'


def main_app_kanji():
    """every kanji of every scene word of the main app's levels, as the content files hold them"""
    out = set()
    for lv in sorted(os.listdir(os.path.join(ROOT, 'content'))):
        folder = os.path.join(ROOT, 'content', lv)
        if not (os.path.isdir(folder) and re.fullmatch(r'n\d', lv)):
            continue
        for name in sorted(os.listdir(folder)):
            if not re.fullmatch(r'u\d\d\.json', name):
                continue
            with open(os.path.join(folder, name), encoding='utf-8') as f:
                unit = json.load(f)
            for day in (unit.get('days') or {}).values():
                for w in ((day or {}).get('scene') or {}).get('words') or []:
                    out.update(c for c in w.get('word', '') if is_kanji(c))
    return out


def n1_kanji():
    """the N1 app's kanji bank, and every kanji of its words (each lesson's own and its word bank's)"""
    path = os.path.join(ROOT, 'yaoki-n1', 'project', 'n1-content.js')
    with open(path, encoding='utf-8') as f:
        text = f.read()
    m = re.search(r'window\.__ykN1\s*=\s*(\{.*\});\s*$', text, re.S)
    if not m:
        sys.exit('make-strokes: could not read ' + path)
    bank = json.loads(m.group(1))
    out = set(k['c'] for k in bank.get('kanji') or [] if k.get('c'))
    for lesson in bank.get('lessons') or []:
        for w in (lesson.get('vocab') or []) + (lesson.get('vocab2') or []):
            out.update(c for c in w.get('w', '') if is_kanji(c))
    return out


def kanjivg_dir(given):
    if given:
        folder = os.path.join(given, 'kanji') if os.path.isdir(os.path.join(given, 'kanji')) else given
        if not os.path.isdir(folder):
            sys.exit('make-strokes: no KanjiVG folder at ' + given)
        return folder
    folder = os.path.join(CACHE, 'kanji')
    if os.path.isdir(folder):
        return folder
    print('make-strokes: downloading KanjiVG ' + RELEASE + ' …', file=sys.stderr)
    with urllib.request.urlopen(ZIP_URL, timeout=120) as r:
        data = r.read()
    os.makedirs(folder, exist_ok=True)
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        for info in z.infolist():
            name = info.filename
            # only the SVG files of the kanji/ folder, by their plain names (never a path that climbs out)
            if not re.fullmatch(r'kanji/[0-9a-f]{5}\.svg', name):
                continue
            with open(os.path.join(folder, name[len('kanji/'):]), 'wb') as out:
                out.write(z.read(info))
    return folder


NUMBER = re.compile(r'-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?')


def short(num):
    """a number with one decimal place at most, and no leading zero: 0.25 → .3, -0.5 → -.5, 12.0 → 12"""
    v = round(float(num) + 0.0, 1)
    s = ('%.1f' % v).rstrip('0').rstrip('.')
    if s in ('-0', ''):
        s = '0'
    if s.startswith('0.'):
        s = s[1:]
    elif s.startswith('-0.'):
        s = '-' + s[2:]
    return s


def compact(d):
    """KanjiVG path data, shorter: rounded numbers, the separators a parser needs and no more"""
    out = []
    pos = 0
    for tok in re.finditer(r'[MmCcSsLlHhVvQqTtZz]|' + NUMBER.pattern, d):
        t = tok.group(0)
        if t[0].isalpha():
            out.append(t)
            continue
        n = short(t)
        prev = out[-1] if out else ''
        # a separator is needed only between two numbers where the second would otherwise run into the first
        if prev and not prev[-1].isalpha() and not n.startswith('-') and not (n.startswith('.') and '.' in prev.split(',')[-1].lstrip('-')):
            out.append(',')
        out.append(n)
    return ''.join(out)


def strokes_of(folder, c):
    path = os.path.join(folder, '%05x.svg' % ord(c))
    if not os.path.isfile(path):
        return None
    with open(path, encoding='utf-8') as f:
        text = f.read()
    found = re.findall(r'<path\b[^>]*\bid="kvg:[0-9a-f]+-s(\d+)"[^>]*\bd="([^"]+)"', text)
    if not found:
        return None
    found.sort(key=lambda x: int(x[0]))
    nums = [int(n) for n, _ in found]
    if nums != list(range(1, len(nums) + 1)):
        sys.exit('make-strokes: strokes of %s are not numbered 1 to %d' % (c, len(nums)))
    return [compact(d) for _, d in found]


HEAD = ('/* Stroke order for the writing practice. Generated by tools/make-strokes.py; do not edit, run it again.\n'
        ' * The strokes of each kanji this app has the learner write, in order: SVG path data in a 109 x 109 box.\n'
        ' * Made from KanjiVG %s (https://kanjivg.tagaini.net), by Ulrich Apel and contributors, under the\n'
        ' * Creative Commons Attribution-Share Alike 3.0 licence (https://creativecommons.org/licenses/by-sa/3.0/);\n'
        ' * this data is available under the same licence. */\n') % RELEASE


def read_existing(path):
    if not os.path.isfile(path):
        return {}
    with open(path, encoding='utf-8') as f:
        m = re.search(r'window\.__ykStrokes\s*=\s*(\{.*\});', f.read(), re.S)
    return json.loads(m.group(1)) if m else {}


def write(path, data):
    body = ',\n'.join('%s:%s' % (json.dumps(c, ensure_ascii=False), json.dumps('|'.join(data[c]), ensure_ascii=False)) for c in sorted(data))
    text = HEAD + 'window.__ykStrokes = {\n' + body + '\n};\n'
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)
    return len(text.encode('utf-8'))


def main(argv):
    check = '--check' in argv
    given = None
    if '--kanjivg' in argv:
        given = argv[argv.index('--kanjivg') + 1]
    jobs = [('main app', MAIN_OUT, main_app_kanji()), ('N1 app', N1_OUT, n1_kanji())]
    if check:
        bad = 0
        for label, path, need in jobs:
            have = read_existing(path)
            missing = sorted(c for c in need if c not in have)
            if missing:
                bad += 1
                print('STROKES FAIL: the %s has no strokes for %d kanji: %s. Run: python3 tools/make-strokes.py'
                      % (label, len(missing), ''.join(missing[:40]) + (' …' if len(missing) > 40 else '')))
        if not bad:
            print('STROKES PASS: every kanji the two apps ask the learner to write has its strokes')
        return 1 if bad else 0
    folder = kanjivg_dir(given)
    for label, path, need in jobs:
        data = {}
        missing = []
        for c in sorted(need):
            s = strokes_of(folder, c)
            if s:
                data[c] = s
            else:
                missing.append(c)
        if missing:
            sys.exit('make-strokes: KanjiVG has no strokes for ' + ''.join(missing))
        size = write(path, data)
        print('make-strokes: %s: %d kanji, %d strokes, %.0f KB -> %s' % (label, len(data), sum(len(v) for v in data.values()), size / 1024, os.path.relpath(path, ROOT)))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
