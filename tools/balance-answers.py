"""Spread the right answers over positions 1 to 4, as on the real paper.
usage: python3 tools/balance-answers.py content/n5/u03.json [more files]   (rewrites the files in place)

Drafts tend to put the right answer first. For every choice item the options are rotated so that the right
answer lands on a position picked from the item's id (stable: running it twice changes nothing more), and the
item's `why`, `short` and any "option N" in its English are moved with them.
Left alone: items whose options are spoken in order (即時応答, 発話表現), items whose options are numbers, times
or prices (the paper lists those in order), and items that already have their spot."""
import hashlib, json, re, sys

SPOKEN = re.compile(r'即時応答|発話表現')
NUMERIC = re.compile(r'[0-9０-９一二三四五六七八九十百千万]')


def target(item_id, n):
    return int(hashlib.sha1(item_id.encode()).hexdigest(), 16) % n + 1


def renumber(text, mapping):
    if not isinstance(text, str):
        return text
    def one(m):
        nums = [mapping.get(int(x), int(x)) for x in re.findall(r'[1-4]', m.group(2))]
        joined = m.group(2)
        for old, new in zip(re.findall(r'[1-4]', m.group(2)), nums):
            joined = joined.replace(old, '\0' + str(new), 1)
        return m.group(1) + joined.replace('\0', '')
    return re.sub(r'(\b[Oo]ptions? )([1-4](?:(?:, | and | or |-)[1-4])*)', one, text)


def balance(it):
    if it.get('kind') != 'choice' or SPOKEN.search(it.get('type', '')) or it.get('order'):
        return False
    opts = it['options']
    n = len(opts)
    if n < 3 or all(NUMERIC.search(o) for o in opts):
        return False
    want = target(it['id'], n)
    shift = (want - it['answer']) % n
    if not shift:
        return False
    # old position k (1-based) moves to ((k - 1 + shift) % n) + 1
    mapping = {k: (k - 1 + shift) % n + 1 for k in range(1, n + 1)}
    def move(arr):
        out = [None] * n
        for k, v in enumerate(arr):
            out[mapping[k + 1] - 1] = v
        return out
    it['options'] = move(opts)
    for key in ('why', 'short'):
        if isinstance(it.get(key), list) and len(it[key]) == n:
            it[key] = move(it[key])
    if isinstance(it.get('why'), list):
        it['why'] = [renumber(w, mapping) for w in it['why']]
    it['explain'] = renumber(it.get('explain'), mapping) if it.get('explain') else it.get('explain')
    it['answer'] = mapping[it['answer']]
    return True


def items_of(u):
    for d in u.get('days', {}).values():
        g = d.get('grammar') or {}
        if g.get('compare'):
            yield g['compare']['check']
        yield from g.get('drill', [])
        yield from g.get('exam', [])
        if d.get('scene'):
            yield d['scene']['check']
        if d.get('skill'):
            yield d['skill']['item']
    yield from u.get('test', [])


for path in sys.argv[1:]:
    u = json.load(open(path, encoding='utf-8'))
    changed = sum(balance(it) for it in items_of(u))
    counts = {}
    for it in items_of(u):
        if it.get('kind') == 'choice':
            counts[it['answer']] = counts.get(it['answer'], 0) + 1
    json.dump(u, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    print(path, 'moved', changed, 'answers now', dict(sorted(counts.items())))
