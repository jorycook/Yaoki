"""Write a design canvas's canvas.json in the layout the files keep: one line per board and note, one per entry of order."""
import json


def inline(v):
    if isinstance(v, dict):
        return '{ ' + ', '.join(json.dumps(k, ensure_ascii=False) + ': ' + inline(x) for k, x in v.items()) + ' }' if v else '{}'
    if isinstance(v, list):
        return '[' + ', '.join(inline(x) for x in v) + ']'
    return json.dumps(v, ensure_ascii=False)


def dumps(c):
    out = ['{']
    keys = list(c.keys())
    for n, k in enumerate(keys):
        v = c[k]
        end = ',' if n < len(keys) - 1 else ''
        if k in ('boards', 'notes') and isinstance(v, dict) and v:
            out.append('  %s: {' % json.dumps(k))
            items = list(v.items())
            for m, (bk, bv) in enumerate(items):
                out.append('    %s: %s%s' % (json.dumps(bk, ensure_ascii=False), inline(bv), ',' if m < len(items) - 1 else ''))
            out.append('  }' + end)
        elif k == 'order' and isinstance(v, list) and v:
            out.append('  "order": [')
            for m, x in enumerate(v):
                out.append('    %s%s' % (json.dumps(x, ensure_ascii=False), ',' if m < len(v) - 1 else ''))
            out.append('  ]' + end)
        else:
            out.append('  %s: %s%s' % (json.dumps(k), inline(v), end))
    out.append('}')
    return '\n'.join(out) + '\n'


if __name__ == '__main__':
    import sys
    for path in sys.argv[1:]:
        with open(path, encoding='utf-8') as f:
            data = json.load(f)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(dumps(data))
