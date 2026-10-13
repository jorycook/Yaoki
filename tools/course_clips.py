"""Make the course's clips: every teach example, every scene word and every listening lesson in course-n2.js
that has no clip yet, using the same voices and checks as the prototype's clips (build.py).
usage (from the tts folder, with its venv): python course_clips.py <course-n2.js or course-n5.js> <out-dir> [key ...]
Writes <out-dir>/<key>.mp3 and <out-dir>/manifest.json with what two recognisers heard."""
import json, os, re, sys
import numpy as np
sys.argv, args = sys.argv[:1], sys.argv[1:]
import build as B          # loads the voice model; build.py only runs its own job list as a script
import asr

src, out = args[0], args[1]
only = set(args[2:])
text = open(src, encoding='utf-8').read()
m = re.search(r'__ykCourses\.\w+ = (\{.*\});\n', text) or re.search(r'__ykCourseData = (\{.*\});\n', text)
data = json.loads(m.group(1))
SPK = {'N': B.N, 'M': B.M, 'F': B.F}
plain = lambda s: re.sub(r'[{}_^]', '', re.sub(r'\[([^|\]]*)\|[^\]]*\]', r'\1', s))
OLD = {'t_ex1', 't_ex2'} | {k for k in []}

jobs = {}
for u in data['units']:
    for d in u['days']:
        g = d.get('grammar')
        if not g:
            continue
        for p in g.get('points', []):
            for e in p.get('examples', []):
                if e['clip'].startswith('x_'):
                    jobs[e['clip']] = [(B.N, plain(e['ja']), e.get('say'))]
        for w in d['scene']['words']:
            if re.match(r's_(u|n\d)', w['clip']):
                jobs[w['clip']] = [(B.N, w['word'], w.get('say') or w['reading'])]
        sk = d['skill']
        if sk['kind'] == 'listening':
            jobs[sk['item']['clip']] = [(SPK[l[0]], l[1], l[2]) for l in sk['audio']]

os.makedirs(out, exist_ok=True)
mpath = os.path.join(out, 'manifest.json')
manifest = json.load(open(mpath, encoding='utf-8')) if os.path.exists(mpath) else {}
for key, lines in jobs.items():
    if only and key not in only:
        continue
    if not only and key in manifest and os.path.exists(os.path.join(out, key + '.mp3')):
        continue
    # build() treats keys starting s_ as single words said after a carrier phrase
    try:
        x, phon = B.build(key, lines)
    except AssertionError as err:
        # a very short word can leave no pause to cut the carrier phrase at: say it on its own instead
        print(key, 'carrier cut failed (%s); said on its own' % err, flush=True)
        x, phon = B.build('w_' + key, lines)
    path = os.path.join(out, key + '.mp3')
    B.to_mp3(x, path)
    y, sr = B.from_mp3(path)
    quiet = np.zeros(int(sr * 0.3), dtype=np.float32)
    padded = np.concatenate([quiet, y, quiet])
    manifest[key] = {'ms': int(round(len(y) / sr * 1000)), 'bytes': os.path.getsize(path), 'text': ' '.join(l[1] for l in lines),
                     'heard1': asr.transcribe(padded, sr), 'heard2': asr.transcribe2(padded, sr)}
    print(key.ljust(24), '%5.1fs' % (manifest[key]['ms'] / 1000), '|', manifest[key]['text'][:40], '|', manifest[key]['heard1'][:40], '|', manifest[key]['heard2'][:40], flush=True)
    json.dump(manifest, open(mpath, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('clips:', len(manifest), 'total %.1fs' % (sum(v['ms'] for v in manifest.values()) / 1000))
