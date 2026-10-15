"""Compare a blind solve with the answers. usage: python3 tools/blind-compare.py n5 2"""
import json, sys, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
lv, n = sys.argv[1], int(sys.argv[2])
name = ('' if lv == 'n2' else lv) + 'u%02d' % n
d = f'{ROOT}/content/{lv}/drafts'
a = json.load(open(f'{d}/blind-{name}-answers.json')); s = json.load(open(f'{d}/blind-{name}-solved.json'))
dis = []
for k, v in a.items():
    p = s.get(k, {}).get('pick')
    if isinstance(v, int): ok = p == v
    else: ok = isinstance(p, dict) and [x.replace(' ', '').replace('　', '') for x in p.get('order', [])] == [x.replace(' ', '').replace('　', '') for x in v['order']]
    if not ok: dis.append((k, v, p))
print(len(a), 'items,', len(dis), 'disagreements')
for x in dis: print(' ', x)
for k, v in s.items():
    if v.get('second'): print('second:', k, v['second'])
