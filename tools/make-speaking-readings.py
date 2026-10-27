"""Makes docs/speaking/readings.js, the readings Yaoki Speaking reads a phone's speech recognition with.

usage: python3 tools/make-speaking-readings.py <kanjidic2.xml.gz>        (from the repository's root)
The file comes from https://www.edrdg.org/kanjidic/kanjidic2.xml.gz. The words come from the shortened JMdict list
that Yaoki Reader already has (docs/reader/engine/jm-1.txt and jm-2.txt), so nothing else is downloaded.

A phone's speech recognition writes what it hears the way a Japanese writer would: ねこ comes back as 猫, がっこう as
学校. The game checks whether the words it hears can be read as the card's reading, so it needs to know how kanji are
read. Three tables:

- kanji: the on and kun readings of each jōyō and jinmeiyō kanji, and of the other kanji in the usual spelling of a
  common word (叱る, 頬, 餃子), from KANJIDIC2 (on readings in hiragana, kun readings without their okurigana: た for
  食べる). In a word of two or more characters, each kanji may be read with any of
  these, voiced (連濁: 本棚 ほんだな) or with a small っ before the next one (学校 がっこう), as the game does.
- single: the readings of a kanji heard on its own, as a word (the first reading of JMdict's common words written
  with that kanji alone): 火 on its own is ひ, not か.
  The game uses them when the whole of what was heard is one kanji, so a card's か is not taken for a 火 heard as ひ.
- words: the common words the game must know as wholes, with all their readings: those whose reading cannot be made
  from their kanji's readings that way (今日 きょう, お兄さん, 大人), and those whose usual spelling could be read
  kanji by kanji as another common word (作家 さっか, which 作 さ and 家 か would make さか, 坂). A word that is all
  that was heard is read only as itself, by these readings.

Written forms and readings are kept as the game compares them: katakana as hiragana, full-width letters and digits
as plain ones (NFKC).
"""
import gzip
import os
import sys
import unicodedata
import xml.etree.ElementTree as ET
from functools import lru_cache

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'docs', 'speaking', 'readings.js')
JM = [os.path.join(ROOT, 'docs', 'reader', 'engine', f) for f in ('jm-1.txt', 'jm-2.txt')]
if len(sys.argv) < 2:
    sys.exit(__doc__)
GRADES = {'1', '2', '3', '4', '5', '6', '8', '9', '10'}   # jōyō (1-6, 8) and jinmeiyō (9, 10)


def kata2hira(s):
    return ''.join(chr(ord(c) - 0x60) if 'ァ' <= c <= 'ヶ' and c != 'ヵ' and c != 'ヶ' else c for c in s)


def norm(s):
    return kata2hira(unicodedata.normalize('NFKC', s))


def is_kanji(ch):
    return '\u3400' <= ch <= '\u9fff' or '\uf900' <= ch <= '\ufaff' or ord(ch) >= 0x20000 or ch in '々〆'


# ---------- JMdict (the reader's list: written forms; readings; rank 0-3 and u, o; glosses) ----------
entries = []
usual = set()   # the kanji of each common word's usual spelling (its first written form)
spellings = set()   # those usual spellings themselves
for path in JM:
    with open(path, encoding='utf-8') as f:
        for line in f:
            p = line.rstrip('\n').split('\t')
            if len(p) < 3:
                continue
            written = [norm(w) for w in p[0].split(';') if w]
            readings = [norm(r) for r in p[1].split(';') if r]
            rank = int(p[2][0]) if p[2][:1].isdigit() else 0
            if written and readings and rank >= 2:
                entries.append((written, readings))
                if 'u' not in p[2]:
                    usual.update(ch for ch in written[0] if is_kanji(ch))
                    spellings.add(written[0])

# ---------- KANJIDIC2 ----------
root = ET.fromstring(gzip.open(sys.argv[1]).read())
version = root.findtext('header/database_version') or ''
# kanji -> [(reading, stem)] in KANJIDIC's order; stem: a kun reading that takes okurigana (た for 食べる), which the
# game reads only when kana follow the kanji (a reading that is also a whole one, on or kun, is a whole one)
KANJI = {}
for c in root.iter('character'):
    lit = c.findtext('literal')
    if c.find('misc').findtext('grade') not in GRADES and lit not in usual:
        continue
    out = {}
    rm = c.find('reading_meaning')
    if rm is not None:
        for g in rm.iter('rmgroup'):
            for r in g.findall('reading'):
                kind = r.get('r_type')
                if kind == 'ja_on':
                    rd, stem = kata2hira(r.text), False
                elif kind == 'ja_kun':
                    base = r.text.replace('-', '')
                    rd, stem = base.split('.')[0], '.' in base
                else:
                    continue
                if rd:
                    out[rd] = out[rd] and stem if rd in out else stem
    if out:
        KANJI[lit] = list(out.items())

# a kanji said alone: the first reading of each common word written with it alone (an entry's later readings are
# often rare ones: 机 つくえ, also つき)
SINGLE = {}
for written, readings in entries:
    for w in written:
        if len(w) == 1 and is_kanji(w):
            known = SINGLE.setdefault(w, [])
            if readings[0] not in known:
                known.append(readings[0])

# The sound changes a kanji's reading may take inside a word, as the game reads it (voice.js, variants()): voiced
# (v: 本棚 ほんだな) or with p for h (h: 一本 いっぽん) when it is not the word's first sound, and with a small っ for a
# last く, き, ち or つ when more follows (t: 学校 がっこう).
VOICED = dict(zip('かきくけこさしすせそたちつてとはひふへほ', 'がぎぐげござじずぜぞだぢづでどばびぶべぼ'))
HALF = dict(zip('はひふへほ', 'ぱぴぷぺぽ'))


def forms(rd, first, last):
    out = [(rd, '')]
    if not first:
        if rd[0] in VOICED:
            out.append((VOICED[rd[0]] + rd[1:], 'v'))
        if rd[0] in HALF:
            out.append((HALF[rd[0]] + rd[1:], 'h'))
    if not last and len(rd) > 1 and rd[-1] in 'くきちつ':
        out += [(f[:-1] + 'っ', k + 't') for f, k in out]
    return out


def readings_at(w, i):
    src = w[i - 1] if w[i] == '々' and i > 0 else w[i]
    if src in KANJI:
        okuri = i + 1 < len(w) and not is_kanji(w[i + 1])
        return src, [rd for rd, stem in KANJI[src] if okuri or not stem]
    return src, SINGLE.get(src, [])


def uses(w, r):
    """The (kanji, reading, sound changes) some reading of w as r is made of, or None when r cannot be made of the
    readings of w's kanji."""
    n = len(w)

    @lru_cache(None)
    def go(i, j):
        if i == n:
            return frozenset() if j == len(r) else None
        if not is_kanji(w[i]):
            return go(i + 1, j + 1) if j < len(r) and w[i] == r[j] else None
        src, rds = readings_at(w, i)
        found = None
        for rd in rds:
            for f, kinds in forms(rd, i == 0, i == n - 1):
                if r.startswith(f, j):
                    rest = go(i + 1, j + len(f))
                    if rest is not None:
                        found = (found or frozenset()) | rest | {(src, rd, kinds)}
        return found
    return go(0, 0)


# Which readings and sound changes the common words use (平 is not read ひょう, nor 紙 じ, in any of them), and the
# words whose readings cannot be made of their kanji's readings at all.
USED = {}
READINGS = {}   # each written form of a common word, and all its readings
WORDS = set()
for written, readings in entries:
    for w in written:
        if not any(is_kanji(ch) for ch in w):
            continue
        known = READINGS.setdefault(w, [])
        known += [r for r in readings if r not in known]
        for r in readings:
            u = uses(w, r)
            if u is None:
                if len(w) >= 2:
                    WORDS.add(w)
                continue
            for src, rd, kinds in u:
                USED.setdefault(src, {}).setdefault(rd, set()).update(kinds)

# The readings the game makes of a word kanji by kanji, with the readings and changes common words use (and every
# change after a numeral, as counters take them); only those that begin some common word's reading are followed.
NUMERALS = '〇一二三四五六七八九十百千万億'
ALL_READINGS = {r for rs in READINGS.values() for r in rs}
for written, readings in entries:
    if not any(is_kanji(ch) for ch in written[0]):
        ALL_READINGS.update(readings)
PREFIXES = {r[:k] for r in ALL_READINGS for k in range(1, len(r) + 1)}


def made(w):
    n = len(w)
    out = set()

    def go(i, sofar):
        if sofar and sofar not in PREFIXES:
            return
        if i == n:
            out.add(sofar)
            return
        if not is_kanji(w[i]):
            go(i + 1, sofar + w[i])
            return
        src = w[i - 1] if w[i] == '々' and i > 0 else w[i]
        okuri = i + 1 < n and not is_kanji(w[i + 1])
        counted = (i > 0 and w[i - 1] in NUMERALS) or (w[i] in NUMERALS and i + 1 < n and is_kanji(w[i + 1]))
        if src in KANJI:
            used = USED.get(src)
            rds = [(rd, used[rd] if used else set('vht')) for rd, stem in KANJI[src] if (okuri or not stem) and (not used or rd in used)]
        else:
            rds = [(rd, set('vht')) for rd in SINGLE.get(src, [])]
        for rd, kinds in rds:
            for f, k in forms(rd, i == 0, i == n - 1):
                if counted or all(x in kinds for x in k):
                    go(i + 1, sofar + f)
    go(0, '')
    return out


# The usual spellings that can be read as another common word.
for w in spellings:
    if len(w) >= 2 and w in READINGS and w not in WORDS and (made(w) & ALL_READINGS) - set(READINGS[w]):
        WORDS.add(w)
WORDS = {w: READINGS[w] for w in WORDS}


def kanji_line(k):
    used = USED.get(k)
    out = []
    for rd, stem in KANJI[k]:
        if used and rd not in used:
            continue
        # a kanji no common word is written with keeps every reading, with every change
        out.append(rd + ('-' if stem else '') + (''.join(sorted(used[rd])) if used else 'htv'))
    return k + ','.join(out)


def js(s):
    return "'" + s.replace('\\', '\\\\').replace("'", "\\'").replace('\n', '\\n') + "'"


kanji = '\n'.join(kanji_line(k) for k in KANJI)
single = '\n'.join(k + ','.join(v) for k, v in SINGLE.items())
words = '\n'.join(w + '\t' + ','.join(v) for w, v in sorted(WORDS.items()))
with open(OUT, 'w', encoding='utf-8') as f:
    f.write('/*\n * Readings for Yaoki Speaking, made by tools/make-speaking-readings.py: do not edit by hand.\n'
            ' * From KANJIDIC2 (database version ' + version + ') and JMdict, by the Electronic Dictionary Research and\n'
            ' * Development Group, used under CC BY-SA 4.0; this file is under the same licence.\n'
            ' * kanji: each kanji and the readings common words use (on readings in hiragana, kun readings without okurigana),\n'
            ' * each marked - when it takes okurigana, and with the changes common words make to it: v voiced, h p for h,\n'
            ' * t a small っ for its last sound.\n'
            ' * single: a kanji heard on its own, as a word, and its readings. words: common words the game knows as wholes\n'
            ' * (not read by their kanji\'s readings, or readable that way as another word), and all their readings.\n'
            ' * One entry a line.\n */\n'
            '(function (root) {\n'
            '  var data = {\n'
            '    source: ' + js('KANJIDIC2 ' + version + ' and JMdict (EDRDG, CC BY-SA 4.0)') + ',\n'
            '    kanji: ' + js(kanji) + ',\n'
            '    single: ' + js(single) + ',\n'
            '    words: ' + js(words) + ',\n'
            '  };\n'
            '  root.SpeakingReadings = data;\n'
            '  if (typeof module !== \'undefined\' && module.exports) module.exports = data;\n'
            '})(typeof window !== \'undefined\' ? window : globalThis);\n')
print('%d kanji, %d kanji said alone, %d words: %s (%d bytes)' % (len(KANJI), len(SINGLE), len(WORDS), OUT, os.path.getsize(OUT)))
