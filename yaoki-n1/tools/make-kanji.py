"""Makes the N1 kanji bank, content/kanji.json, from the EDRDG dictionaries (CC BY-SA 4.0).

usage: python3 tools/make-kanji.py <kanjidic2.xml.gz> <JMdict_e.gz> [--review]        (from yaoki-n1/)
--review writes content/kanji-review.json instead: the kanji of the old JLPT level 2 (the ones the N2 course is
built on), two words each, for the N1 app's review of the earlier levels.
The two files come from http://www.edrdg.org/kanjidic/kanjidic2.xml.gz and http://ftp.edrdg.org/pub/Nihongo/JMdict_e.gz.

Which kanji: the 2,136 jōyō kanji less the 1,023 of the old JLPT levels 4 to 2, which the N5 to N2 lists are built on.
That leaves 1,113, ordered by how often they appear in newspapers (KANJIDIC2's frequency rank), the kanji added to
the jōyō list in 2010 last among those of equal standing.

For each kanji: its on and kun readings (those seen in common words first, at most three of each), up to three English
meanings, the stroke count, and up to three common words that use it (JMdict words marked as common, with their reading
and a short meaning). Each word also gets three wrong readings for the reading quiz, made the way 漢字読み questions
make them (a voiced or unvoiced sound, a long or short vowel, a small っ added or taken away); none of them is a
reading the dictionary gives for that word."""
import gzip
import hashlib
import json
import os
import re
import sys
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
REVIEW = '--review' in sys.argv
OUT = os.path.join(HERE, '..', 'content', 'kanji-review.json' if REVIEW else 'kanji.json')
KANJIDIC, JMDICT = [a for a in sys.argv[1:] if not a.startswith('--')][:2]

JOYO_GRADES = {'1', '2', '3', '4', '5', '6', '8'}


def kata2hira(s):
    return ''.join(chr(ord(c) - 0x60) if 'ァ' <= c <= 'ヶ' else c for c in s)


# ---------- KANJIDIC2 ----------
root = ET.fromstring(gzip.open(KANJIDIC).read())
joyo, n1 = set(), []
for c in root.iter('character'):
    lit = c.findtext('literal')
    misc = c.find('misc')
    grade, jlpt = misc.findtext('grade'), misc.findtext('jlpt')
    if grade not in JOYO_GRADES:
        continue
    joyo.add(lit)
    if (jlpt != '2') if REVIEW else (jlpt in ('2', '3', '4')):
        continue
    rm = c.find('reading_meaning')
    on, kun, en = [], [], []
    if rm is not None:
        for g in rm.iter('rmgroup'):
            for r in g.findall('reading'):
                if r.get('r_type') == 'ja_on':
                    on.append(r.text)
                elif r.get('r_type') == 'ja_kun':
                    kun.append(r.text)
            en += [m.text for m in g.findall('meaning') if m.get('m_lang') is None]
    freq = misc.findtext('freq')
    n1.append({'c': lit, 'grade': grade, 'old': jlpt == '1', 'freq': int(freq) if freq else None,
               's': int(misc.findtext('stroke_count')), 'on_all': on, 'kun_all': kun, 'en': en})

# ---------- JMdict ----------
STRONG = {'news1', 'ichi1', 'spec1', 'gai1'}
WEAK = {'news2', 'ichi2', 'spec2', 'gai2'}
BAD_KE = {'iK', 'ik', 'oK', 'rK', 'sK', 'io', 'ateji'}
BAD_RE = {'ik', 'ok', 'rk', 'sk'}
BAD_SENSE = {'arch', 'obs', 'rare', 'vulg', 'X', 'derog', 'sl', 'uk'}
text = gzip.open(JMDICT).read().decode('utf-8')
# entity references (&n; and the like) become their names, so the XML parser need not know them
text = re.sub(r'<!DOCTYPE.*?]>', '', text, flags=re.S)
text = re.sub(r'&([\w-]+);', r'\1', text)
words = {}          # keb -> best record
readings_of = {}    # keb -> every reading the dictionary allows for it
for e in ET.fromstring(text).iter('entry'):
    kes = []
    for k in e.findall('k_ele'):
        inf = {x.text for x in k.findall('ke_inf')}
        kes.append((k.findtext('keb'), {x.text for x in k.findall('ke_pri')}, inf))
    if not kes:
        continue
    res = []
    for r in e.findall('r_ele'):
        if r.find('re_nokanji') is not None:
            continue
        res.append((r.findtext('reb'), {x.text for x in r.findall('re_restr')}, {x.text for x in r.findall('re_inf')}))
    senses = []
    for s in e.findall('sense'):
        misc = {x.text for x in s.findall('misc')}
        stagk = {x.text for x in s.findall('stagk')}
        gl = [g.text for g in s.findall('gloss') if g.text]
        senses.append((stagk, misc, gl))
    for keb, pri, inf in kes:
        rs = [reb for reb, restr, rinf in res if (not restr or keb in restr)]
        readings_of.setdefault(keb, set()).update(rs)
        if inf & BAD_KE:
            continue
        good = [reb for reb, restr, rinf in res if (not restr or keb in restr) and not (rinf & BAD_RE)]
        sense = next(((m, g) for st, m, g in senses if (not st or keb in st) and g), None)
        if not good or not sense:
            continue
        one_kanji = sum(1 for ch in keb if not ('\u3040' <= ch <= '\u30ff')) == 1
        if (sense[0] & (BAD_SENSE - {'uk'})) or ('uk' in sense[0] and not one_kanji):
            continue
        nf = min([int(p[2:]) for p in pri if p.startswith('nf')] or [60])
        score = (10 if pri & STRONG else 4 if pri & WEAK else 0) + (60 - nf) / 6 if pri else -10
        rec = {'w': keb, 'r': good[0], 'gl': sense[1], 'score': score}
        if keb not in words or words[keb]['score'] < score:
            words[keb] = rec


def short_gloss(gl):
    out = ''
    for g in gl:
        g = re.sub(r'\s*\([^)]*\)', '', g).strip()
        if not g:
            continue
        cand = g if not out else out + '; ' + g
        if len(cand) > 30:
            break
        out = cand
    if not out:
        g = re.sub(r'\s*\([^)]*\)', '', gl[0]).strip()
        out = g if len(g) <= 30 else g[:29].rsplit(' ', 1)[0] + '…'
    return out


KANA = re.compile(r'^[぀-ヿ]$')


def plain_word(w):
    """a word whose other kanji are all jōyō (so the learner meets no unknown character in it)"""
    return all(KANA.match(ch) or ch in joyo for ch in w)


# ---------- readings shown: the ones common words use ----------
VOICE = str.maketrans('かきくけこさしすせそたちつてとはひふへほ', 'がぎぐげござじずぜぞだぢづでどばびぶべぼ')
PSOUND = str.maketrans('はひふへほ', 'ぱぴぷぺぽ')


def on_forms(on):
    h = kata2hira(on.replace('-', ''))
    forms = {h, h[:1].translate(VOICE) + h[1:], h[:1].translate(PSOUND) + h[1:]}
    if len(h) >= 2 and h[-1] in 'つくちき':
        forms.add(h[:-1] + 'っ')
    return {f for f in forms if f}


def kun_stem(k):
    return k.replace('-', '').split('.')[0]


# ---------- wrong readings for the quiz ----------
UNVOICE = {v: k for k, v in zip('かきくけこさしすせそたちつてとはひふへほ', 'がぎぐげござじずぜぞだぢづでどばびぶべぼ')}
UNVOICE.update({p: h for h, p in zip('はひふへほ', 'ぱぴぷぺぽ')})
VOICED = {k: v for k, v in zip('かきくけこさしすせそたちつてとはひふへほ', 'がぎぐげござじずぜぞだぢづでどばびぶべぼ')}
O_SOUND = set('おこごそぞとどのほぼぽもよろょ')
E_SOUND = set('えけげせぜてでねへべぺめれ')
KSTP = set('かきくけこさしすせそたちつてとぱぴぷぺぽ')


def wrong_readings(w, r, on_all):
    """(kind, reading) candidates: 0 voiced/unvoiced, 1 long/short vowel, 2 small っ, 3 another reading of the kanji, 4 small ゃゅょ"""
    # okurigana stay as they are: only the part of the reading the kanji spell is changed
    tail = 0
    while tail < len(w) and KANA.match(w[len(w) - 1 - tail]):
        tail += 1
    if tail and not r.endswith(w[len(w) - tail:]):
        tail = 0
    head, keep = (r[:len(r) - tail], r[len(r) - tail:]) if tail else (r, '')
    # long and short vowels are played with in on-reading compounds only (二字熟語 and longer), as the exam does
    compound = sum(1 for ch in w if not KANA.match(ch)) >= 2 and not tail
    cands = []
    for i, ch in enumerate(head):
        if ch in VOICED and i > 0:
            cands.append((0, head[:i] + VOICED[ch] + head[i + 1:]))
        if ch in UNVOICE:
            cands.append((0, head[:i] + UNVOICE[ch] + head[i + 1:]))
        if compound and ch == 'う' and i > 0 and (head[i - 1] in O_SOUND or head[i - 1] == 'ゅ'):
            cands.append((1, head[:i] + head[i + 1:]))
        if compound and ch in 'ょゅ' and (i + 1 == len(head) or head[i + 1] not in 'うっん'):
            cands.append((1, head[:i + 1] + 'う' + head[i + 1:]))
        if compound and ch == 'い' and i > 0 and head[i - 1] in E_SOUND:
            cands.append((1, head[:i] + head[i + 1:]))
        if ch == 'っ':
            cands.append((2, head[:i] + 'つ' + head[i + 1:]))
            cands.append((2, head[:i] + 'く' + head[i + 1:]))
        if ch in 'つく' and i > 0 and head[i - 1] not in 'ういんっ' and i + 1 < len(head) and head[i + 1] in KSTP:
            cands.append((2, head[:i] + 'っ' + head[i + 1:]))
        if ch in 'ゃゅょ':
            cands.append((4, head[:i] + {'ゃ': 'や', 'ゅ': 'ゆ', 'ょ': 'よ'}[ch] + head[i + 1:]))
    # the kanji read with another of its on readings, as in 前提 ぜんてい / ぜんちょう
    for on in on_all:
        h = kata2hira(on.replace('-', ''))
        for other in on_all:
            o = kata2hira(other.replace('-', ''))
            if o != h and h in head:
                cands.append((3, head.replace(h, o, 1)))
    return [(k, c + keep) for k, c in cands]


def pick_wrong(w, r, on_all):
    real = readings_of.get(w, set()) | {r}
    seen, out = set(), []
    cands = [c for c in wrong_readings(w, r, on_all) if c[1] not in real and len(c[1]) >= 2]
    # one of each kind of change first, so the three wrong answers differ in different ways; the word's hash picks
    # among equally good ones, so the result is the same on every run
    h = int(hashlib.sha1(w.encode()).hexdigest(), 16)
    for kind in (0, 1, 2, 3, 0, 1, 2, 3, 4, 0, 1):
        pool = sorted({c[1] for c in cands if c[0] == kind} - seen)
        if pool:
            choice = pool[h % len(pool)]
            seen.add(choice)
            out.append(choice)
        if len(out) == 3:
            break
    return out


# ---------- per kanji ----------
bank = []
for k in n1:
    c = k['c']
    cand = [x for x in words.values() if c in x['w'] and len(x['w']) <= 4 and plain_word(x['w'])]
    cand.sort(key=lambda x: (-x['score'], len(x['w']), x['w']))
    chosen = []
    for x in cand:
        # prefer words that show a reading not yet shown
        # a common word, or failing that one from the dictionary (some N1 kanji have no common word)
        if len(chosen) < 3 and all(x['r'] != y['r'] for y in chosen) and (x['score'] > 0 or not chosen):
            chosen.append(x)
    # a word written with the kanji alone (a kun word such as 拒む) is worth showing too
    solo = [x for x in words.values() if x['w'].startswith(c) and len(x['w']) >= 2 and all(KANA.match(ch) for ch in x['w'][1:]) and x['score'] > 0]
    solo.sort(key=lambda x: -x['score'])
    if solo and all(solo[0]['w'] != y['w'] for y in chosen):
        if len(chosen) == 3:
            chosen[2] = solo[0]
        else:
            chosen.append(solo[0])
    chosen = chosen[:3]
    used = [x['r'] for x in cand[:40]] + [x['r'] for x in chosen]
    on = sorted(k['on_all'], key=lambda o: -sum(any(f in r for f in on_forms(o)) for r in used))
    on = [o for o in on if any(any(f in r for f in on_forms(o)) for r in used)][:3] or k['on_all'][:1]
    kun_all = list(dict.fromkeys(q.replace('-', '') for q in k['kun_all']))
    kun = sorted(kun_all, key=lambda q: -sum(kun_stem(q) in r for r in used))
    kun = [q for q in kun if any(kun_stem(q) in r for r in used)][:3] or kun_all[:1]
    bank.append({
        'c': c,
        'on': on,
        'kun': kun,
        'en': k['en'][:3],
        's': k['s'],
        'w': [{'w': x['w'], 'r': x['r'], 'en': short_gloss(x['gl']), 'x': pick_wrong(x['w'], x['r'], k['on_all'])} for x in chosen],
        '_f': k['freq'], '_old': k['old'],
    })

# most frequent first; without a rank, the old N1 list before the 2010 additions, then fewer strokes first
bank.sort(key=lambda k: (k['_f'] is None, k['_f'] or 0, not k['_old'], k['s']))
for k in bank:
    del k['_f'], k['_old']
json.dump({'source': 'KANJIDIC2 and JMdict (EDRDG, CC BY-SA 4.0)', 'count': len(bank), 'kanji': bank},
          open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
nw = sum(len(k['w']) for k in bank)
print('%d kanji, %d words, %d kanji without a word, %d words without three wrong readings, %d bytes' % (
    len(bank), nw, sum(1 for k in bank if not k['w']), sum(1 for k in bank for w in k['w'] if len(w['x']) < 3), os.path.getsize(OUT)))
