"""Build a unit's review sheet for the native-speaking reviewer.
usage: python3 tools/review-sheet.py 3   ->  content/n2/review/u03-review.html
Reads content/n2/uNN.json, units.json and review/uNN-flags.json; the page template is tools/review-sheet.html.
Every row is one thing to judge: a teach page, a comparison, an item, a scene's words, a reading or listening lesson.
Flagged rows (red, then amber) come first; the rest follow day by day in a compact form."""
import html, json, re, sys, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
n = int(sys.argv[1])
U = json.load(open(f'{ROOT}/content/n2/u{n:02d}.json', encoding='utf-8'))
SYL = json.load(open(f'{ROOT}/content/n2/units.json', encoding='utf-8'))
FL = json.load(open(f'{ROOT}/content/n2/review/u{n:02d}-flags.json', encoding='utf-8'))
flags = FL['flags']
syl = next(x for x in (SYL['units'] if isinstance(SYL, dict) else SYL) if x.get('n', x.get('unit')) == n)

e = lambda s: html.escape(s or '', quote=False)


def rich(s):
    """the course markup as HTML: ruby, the taught form in bold, underline; clue marks dropped"""
    s = e(s)
    s = re.sub(r'\[([^|\]]*)\|([^\]]*)\]', r'<ruby>\1<rt>\2</rt></ruby>', s)
    s = re.sub(r'\{([^}]*)\}', r'<b class="hl">\1</b>', s)
    s = re.sub(r'_([^_]*)_', r'<u>\1</u>', s)
    return s.replace('^', '')


def plain(s):
    return re.sub(r'[{}_^]', '', re.sub(r'\[([^|\]]*)\|[^\]]*\]', r'\1', s or ''))


def filled(it):
    """the sentence with the right answer in place, one line"""
    if it['kind'] == 'star':
        t = [('<b class="star">' + e(x) + '</b>') if k == it['star'] else e(x) for k, x in enumerate(it['tiles'])]
        return e(plain(it['before'])) + '<span class="tiles">' + ''.join(t) + '</span>' + e(plain(it['after']))
    q = rich(it['q'])
    a = '<b class="ans">' + rich(it['options'][it['answer'] - 1]) + '</b>'
    if '（　　）' in q:
        return q.replace('（　　）', a, 1)
    return q + ' → ' + a


def options(it):
    if it['kind'] == 'star':
        return ('<p class="small">Tiles (shown as): ' + ' / '.join(e(it['tiles'][t] if isinstance(t, int) else t) for t in it['bank']) + '. ★ on tile ' + str(it['star'] + 1) +
                (('. Hint: ' + e(it['hint'])) if it.get('hint') else '') + '</p><p class="small">' + e(it.get('explain', '')) + '</p>')
    rows = []
    for k, o in enumerate(it['options']):
        ok = k + 1 == it['answer']
        why = (it.get('why') or [''] * 9)[k] if it.get('why') else ''
        rows.append(f'<li class="{"ok" if ok else "no"}"><span lang="ja">{rich(o)}</span>' + (f' <span class="why">{e(why)}</span>' if why else '') + '</li>')
    out = '<ol class="opts">' + ''.join(rows) + '</ol>'
    if it.get('explain'):
        out += '<p class="small">' + e(it['explain']) + '</p>'
    return out


rows = []


def add(rid, group, label, head, body, flag_key=None):
    f = flags.get(flag_key or rid)
    rows.append({'id': rid, 'group': group, 'label': label, 'head': head, 'body': body,
                 'level': f[0] if f else 'green', 'note': f[1] if f else ''})


add('syllabus', 'Unit', 'Syllabus', 'Unit ' + str(n) + ': ' + e((syl['ja'] + ' ' + syl['en'])) + '. ' +
    ' · '.join(e(t) for t in (syl.get('days') or [])), '', 'syllabus')
if flags.get('syllabus') is None:
    rows[-1]['level'] = 'amber'
    rows[-1]['note'] = FL.get('syllabus', '')

for key in sorted(U['days'], key=int):
    d = U['days'][key]
    grp = f'Day {key} · {d["title"]}'
    g = d['grammar']
    for p in g['points']:
        con = ''.join(f'<li>{e(c["pos"])}: <span lang="ja">{rich(c["rule"])}</span></li>' for c in p['connect'])
        ex = ''.join(f'<li><span lang="ja">{rich(x["ja"])}</span><br><span class="en">{e(x["en"])}</span></li>' for x in p['examples'])
        w = p.get('watch') or {}
        body = (f'<ul class="small">{con}</ul><ol class="ex">{ex}</ol>' +
                (f'<p class="small">{e(w.get("note"))}</p><p lang="ja" class="bad">✕ {e(w.get("bad"))}</p><p lang="ja" class="good">○ {e(w.get("good"))}</p>' if w else ''))
        add(p['id'], grp, 'Teach page', f'<b lang="ja">{e(p["form"])}</b> <span class="en">{e(p["gloss"])}</span>', body)
    c = g['compare']
    forms = ''.join(f'<li><b lang="ja">{e(f["form"])}</b> <span class="small">{e(f["tag"])}</span><br><span lang="ja">{rich(f["ja"])}</span><br><span class="en">{e(f["en"])}</span></li>' for f in c['forms'])
    add(c['check']['id'], grp, 'Comparison', f'<span lang="ja">{filled(c["check"])}</span>',
        f'<p class="small">{e(c["intro"])}</p><ol class="ex">{forms}</ol>' + options(c['check']))
    for it in g['drill']:
        add(it['id'], grp, 'Drill · ' + it.get('type', ''), f'<span lang="ja">{filled(it)}</span>', options(it))
    for it in g['exam']:
        add(it['id'], grp, 'Exam-style · ' + it.get('type', ''), f'<span lang="ja">{filled(it)}</span>', options(it))
    s = d['scene']
    words = ''.join(f'<tr><td lang="ja">{e(w["word"])}</td><td lang="ja">{e(w["reading"])}</td><td>{e(w["gloss"])}</td></tr>' for w in s['words'])
    add(f'u{n:02d}d{key}.k', grp, 'Scene words', f'<span lang="ja">{e(s["ja"])}</span> <span class="en">{e(s["en"])}</span>: ' +
        '<span lang="ja">' + '、'.join(e(w['word']) for w in s['words']) + '</span>', f'<table class="words">{words}</table>')
    add(s['check']['id'], grp, 'Scene check · ' + s['check'].get('type', ''), f'<span lang="ja">{filled(s["check"])}</span>', options(s['check']))
    sk = d['skill']
    it = sk['item']
    if sk['kind'] == 'reading':
        body = f'<p lang="ja" class="passage">{rich(sk["passage"])}</p><p lang="ja"><b>{e(plain(it["q"]))}</b></p>' + options(it)
        head = f'Reading · {e(sk["en"])}: <span lang="ja">{e(plain(it["q"]))}</span>'
    else:
        body = '<div class="passage" lang="ja">' + ''.join(f'<p>{e(l)}</p>' for l in it.get('script', [])) + f'</div><p lang="ja"><b>{e(plain(sk.get("ask", "")))}</b></p>' + options(it)
        head = f'Listening · {e(sk["en"])}: <span lang="ja">{e(plain(it["q"]))[:60]}</span>'
    add(it['id'], grp, 'Reading' if sk['kind'] == 'reading' else 'Listening', head, body)

seen = set()
for it in U['test']:
    body = ''
    if it.get('passage') and it['passage'] not in seen:
        seen.add(it['passage'])
        body = f'<p lang="ja" class="passage">{rich(it["passage"])}</p>'
    add(it['id'], 'Week test', 'Test · ' + it.get('type', ''), f'<span lang="ja">{filled(it)}</span>', body + options(it))

for k, v in flags.items():
    if k.startswith('sound.'):
        _, day, word = k.split('.', 2)
        rows.append({'id': k, 'group': 'Sound', 'label': 'Voice', 'head': f'<b lang="ja">{e(word)}</b> ({e(day)})', 'body': '', 'level': v[0], 'note': v[1]})

known = {r['id'] for r in rows}
missing = [k for k in flags if k not in known]
if missing:
    sys.exit('flags for unknown rows: ' + ', '.join(missing))

tpl = open(f'{ROOT}/tools/review-sheet.html', encoding='utf-8').read()
page = tpl.replace('__UNIT__', str(n)).replace('__FN__', '<span lang="ja" style="white-space:nowrap">' + e(syl['ja']) + '</span> ' + e(syl['en'])).replace(
    '__ROWS__', json.dumps(rows, ensure_ascii=False).replace('</', '<\\/'))
out = f'{ROOT}/content/n2/review/u{n:02d}-review.html'
open(out, 'w', encoding='utf-8').write(page)
lv = {}
for r in rows:
    lv[r['level']] = lv.get(r['level'], 0) + 1
print(out, len(rows), 'rows', lv)
