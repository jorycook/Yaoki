"""Export a unit's items for a blind solve: the questions without their answers, and the answers in a separate file.
usage: python3 tools/blind-export.py n5 2   ->  content/n5/drafts/blind-n5u02.json and blind-n5u02-answers.json
       python3 tools/blind-export.py n2 3   ->  content/n2/drafts/blind-u03.json …
The solver must never be shown the answers file or the unit's content files."""
import json, re, sys, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
lv, n = sys.argv[1], int(sys.argv[2])
name = ('' if lv == 'n2' else lv) + 'u%02d' % n
u = json.load(open(f'{ROOT}/content/{lv}/u{n:02d}.json', encoding='utf-8'))
pl = lambda s: re.sub(r'[{}_^]', '', re.sub(r'\[([^|\]]*)\|[^\]]*\]', r'\1', s or ''))
und = lambda s: re.sub(r'\[([^|\]]*)\|[^\]]*\]', r'\1', s or '').replace('{', '').replace('}', '').replace('^', '')
out, ans = [], {}
def add(it, ctx, passage=None, script=None):
    e = {'id': it['id'], 'type': it.get('type'), 'context': ctx}
    if passage: e['passage'] = pl(passage)
    if script: e['script'] = script
    if it['kind'] == 'star':
        e['before'] = pl(it['before']); e['after'] = pl(it['after']); e['tiles'] = [pl(it['tiles'][i]) for i in it['bank']]
        e['task'] = 'Put the four tiles in the only natural order and say which tile lands in the ★ position (position %d of 4).' % (it['star'] + 1)
        ans[it['id']] = {'order': [pl(t) for t in it['tiles']], 'star': pl(it['tiles'][it['star']])}
    else:
        e['q'] = und(it['q']); e['options'] = [pl(o) for o in it['options']]
        ans[it['id']] = it['answer']
    out.append(e)
for k, d in u['days'].items():
    g = d['grammar']
    for it in [g['compare']['check']] + g['drill'] + g['exam']: add(it, 'grammar day ' + k)
    add(d['scene']['check'], 'vocabulary')
    sk = d['skill']
    if sk['kind'] == 'reading': add(sk['item'], 'reading', passage=sk['passage'])
    else: add(sk['item'], 'listening (' + sk['item']['type'] + ')' + (', picture: ' + sk['situation'] if sk.get('situation') else ''), script=sk['item'].get('script') if (sk['item'].get('printed') or sk['item']['type'] == '概要理解') else [sk['item']['q']])
for it in u.get('test', []): add(it, 'week test', passage=it.get('passage'))
d = f'{ROOT}/content/{lv}/drafts'
json.dump(out, open(f'{d}/blind-{name}.json', 'w'), ensure_ascii=False, indent=1)
json.dump(ans, open(f'{d}/blind-{name}-answers.json', 'w'), ensure_ascii=False, indent=1)
print(len(out), 'items ->', f'{d}/blind-{name}.json')
