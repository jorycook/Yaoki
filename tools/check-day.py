"""Check a drafted day or week test of the N2 course before it joins its unit: the shape the app needs, the ids, the
counts, the markup, the star items, and the rules of the N2 briefs (content/n2/drafts/BRIEF*.md) a script can check.
What it cannot check (one right answer, natural Japanese, true reasons) is still the drafter's and the reviewer's job.
usage: python3 tools/check-day.py content/n2/drafts/u01d1.json [more files] [--words PLAN.json]
       (a day is uNNdD.json, a week test uNN-test.json, in content/n2/drafts. The other levels' briefs differ (their
        tests, their kanji lists), so their drafts are not checked here.
        --words: a plan {units: {N: {days: {D: {scene: {words: [{word, reading}]}}}}}} whose words the scene must use)
Prints each problem and exits 1 if there are any."""
import json
import os
import re
import sys

args = sys.argv[1:]
plan = None
if '--words' in args:
    k = args.index('--words')
    plan = json.load(open(args[k + 1], encoding='utf-8'))
    del args[k:k + 2]

problems = []
FORMS = []  # the pieces of the unit's ten forms (次第, からでないと, さえ, ば …), for the {…} in a star item's full
RUBY = re.compile(r'\[([^|\]]*)\|[^\]]*\]')


def bad(where, msg):
    problems.append('%s: %s' % (where, msg))


def plain(s):
    return re.sub(r'[{}_^]', '', RUBY.sub(r'\1', s or ''))


def markup(where, s):
    if not isinstance(s, str):
        return
    for ch, name in (('_', 'underline'), ('^', 'clue')):
        if s.count(ch) % 2:
            bad(where, 'unbalanced %s marks in "%s"' % (name, s))
    depth = 0
    for c in s:
        depth += (c == '{') - (c == '}')
        if depth < 0 or depth > 1:
            break
    if depth:
        bad(where, 'unbalanced { } in "%s"' % s)
    for m in re.finditer(r'\[([^\]]*)\]', s):
        if not re.fullmatch(r'[^|]+\|[^|]+', m.group(1)):
            bad(where, 'ruby must be [base|reading]: [%s]' % m.group(1))


def spaces(where, s):
    """the N3 to N1 papers are normal Japanese text: no spaces between phrases"""
    if isinstance(s, str) and re.search(r'[぀-ヿ一-鿿][ 　]+[぀-ヿ一-鿿]', plain(s)):
        bad(where, 'a space between phrases in "%s"' % s)


def no_reading(where, s):
    if isinstance(s, str) and RUBY.search(s):
        bad(where, 'a reading [漢字|かな] where the paper has none: "%s"' % s)


def choice(where, it, n_options=None, why=False, explain=False, readings=True, blank=True):
    if it.get('kind') != 'choice':
        return bad(where, 'kind must be choice')
    for k in ('id', 'type', 'q', 'options', 'answer'):
        if not it.get(k):
            bad(where, 'no ' + k)
    opts = it.get('options') or []
    if not isinstance(opts, list):
        bad(where, 'options must be a list')
        opts = []
    if n_options and len(opts) != n_options:
        bad(where, '%d options, not %d' % (len(opts), n_options))
    if not (isinstance(it.get('answer'), int) and 1 <= it['answer'] <= len(opts)):
        bad(where, 'answer must be 1 to %d' % len(opts))
    if len(set(opts)) != len(opts) or len(set(plain(o) for o in opts)) != len(opts):
        bad(where, 'two options are the same (once readings are removed)')
    if why and len(it.get('why') or []) != len(opts):
        bad(where, 'why must have one line per option')
    if why and any(not w for k, w in enumerate(it.get('why') or []) if k + 1 != it.get('answer')):
        bad(where, 'a wrong option has no reason')
    if explain and not it.get('explain'):
        bad(where, 'no explain')
    if 'short' in it and len(it['short']) != len(opts):
        bad(where, 'short must have one entry per option')
    for k, v in [('q', it.get('q'))] + [('options[%d]' % i, o) for i, o in enumerate(opts)] + [('explain', it.get('explain'))]:
        markup('%s.%s' % (where, k), v)
        if k != 'explain':  # the explanation is English, with Japanese in it
            spaces('%s.%s' % (where, k), v)
        if not readings and k != 'explain':
            no_reading('%s.%s' % (where, k), v)
    if blank and not re.search(r'（　　）|_[^_]+_', it.get('q') or ''):
        bad(where, 'q has no （　　） blank and no _underlined_ word')


def like(form, marked):
    """the marked text is the form, part of it, or the form inflected (よりほかなかった for よりほかない, かねて for かねる)"""
    if form in marked or marked in form:
        return True
    k = 0
    while k < min(len(form), len(marked)) and form[k] == marked[k]:
        k += 1
    return k >= min(3, len(form) - 1) and k >= 2


def star(where, it, hint=False, readings=True, brace='form'):
    """brace: what {…} in full goes round, as in unit 3: the form taught in a drill item, the ★ tile (the answer) in an
    exam-style or week test item"""
    if it.get('kind') != 'star':
        return bad(where, 'kind must be star')
    for k in ('id', 'type', 'before', 'after', 'tiles', 'star', 'bank', 'full', 'explain'):
        if k not in it or (k in ('id', 'type', 'tiles', 'bank', 'full', 'explain') and not it[k]):
            bad(where, 'no ' + k)
    tiles = it.get('tiles') or []
    if not isinstance(tiles, list):
        bad(where, 'tiles must be a list')
        tiles = []
    if len(tiles) != 4 or len(set(tiles)) != 4:
        bad(where, 'a star item has four different tiles, in the right order')
    if it.get('star') not in (0, 1, 2, 3):
        bad(where, 'star must be 0 to 3')
    bank = it.get('bank') or []
    if sorted(bank) != [0, 1, 2, 3]:
        bad(where, 'bank must list the tiles 0 to 3 in the order they are shown')
    elif bank == [0, 1, 2, 3]:
        bad(where, 'bank shows the tiles already in the right order')
    if hint and not it.get('hint'):
        bad(where, 'a drill star item needs a hint')
    for t in tiles:
        if t.endswith('。'):
            bad(where, 'a tile ends with 。: ' + t)
    sp = lambda s: re.sub(r'[ 　]', '', plain(s))
    joined = (it.get('before') or '') + ''.join(tiles) + (it.get('after') or '')
    if sp(it.get('full')) != sp(joined):
        bad(where, 'full "%s" is not before + tiles + after "%s"' % (plain(it.get('full')), plain(joined)))
    if '{' not in (it.get('full') or ''):
        bad(where, 'full should mark the form with {…}')
    else:
        marked = re.findall(r'\{([^}]*)\}', RUBY.sub(r'\1', it.get('full') or ''))
        if brace == 'star' and len(tiles) == 4 and it.get('star') in (0, 1, 2, 3):
            if marked != [plain(tiles[it['star']])]:
                bad(where, 'in an exam-style or test item, full marks the ★ tile, the answer ({%s}), not {%s}' % (plain(tiles[it['star']]), '}{'.join(marked)))
        elif brace == 'form' and FORMS and not any(any(like(p, m) for p in FORMS) for m in marked):
            bad(where, 'in a drill item, full marks the form taught, not {%s}' % '}{'.join(marked))
    for k in ('before', 'after', 'full', 'hint', 'explain'):
        markup('%s.%s' % (where, k), it.get(k))
    for k in ('before', 'after', 'full'):
        spaces('%s.%s' % (where, k), it.get(k))
        if not readings:
            no_reading('%s.%s' % (where, k), it.get(k))
    for t in tiles:
        spaces(where + '.tiles', t)
        if not readings:
            no_reading(where + '.tiles', t)


def unit_forms(u):
    out = []
    for t in u['days']:
        for f in t.split('・'):
            f = re.sub(r'（[^）]*）', '', f)
            out += [x for x in f.split('〜') if x]
    return out


def check_day(path, unit, day, level_dir):
    d = json.load(open(path, encoding='utf-8'))
    syl = json.load(open(os.path.join(level_dir, 'units.json'), encoding='utf-8'))
    u = next(x for x in syl['units'] if x['n'] == unit)
    FORMS[:] = unit_forms(u)
    pre = '' if syl['level'] == 'N2' else syl['level'].lower()
    base = '%su%02dd%d' % (pre, unit, day)
    want = u['days'][day - 1] if day <= 5 else 'まとめ：似ている文法'
    if d.get('title') != want:
        bad(base, 'title "%s" must be exactly "%s"' % (d.get('title'), want))
    g = d.get('grammar') or {}
    pts = g.get('points')
    if day <= 5:
        if not isinstance(pts, list) or len(pts) != 2:
            bad(base, 'a study day has two points')
        for k, p in enumerate(pts or []):
            w = '%s.p%d' % (base, k + 1)
            if p.get('id') != w:
                bad(w, 'id should be ' + w)
            for f in ('form', 'gloss', 'connect', 'examples', 'watch'):
                if not p.get(f):
                    bad(w, 'no ' + f)
            if not 2 <= len(p.get('connect') or []) <= 3:
                bad(w, 'connect has 2 to 3 rows')
            for c in p.get('connect') or []:
                if not c.get('pos') or '{' not in (c.get('rule') or ''):
                    bad(w, 'a connect row needs pos and a rule with the form in {…}')
                if not re.search(r'[A-Za-z]{2}', c.get('pos') or ''):
                    bad(w, 'pos is plain English, such as "Verb, ます form" (BRIEF.md): "%s"' % c.get('pos'))
                markup(w + '.connect', c.get('rule'))
            if len(p.get('examples') or []) != 2:
                bad(w, 'two examples')
            for e in p.get('examples') or []:
                if '{' not in (e.get('ja') or '') or not e.get('en'):
                    bad(w, 'an example needs ja with the form in {…} and en')
                if 'clip' in e:
                    bad(w, 'no clip in an example (the build names it)')
                markup(w + '.examples', e.get('ja'))
                spaces(w + '.examples', e.get('ja'))
            wt = p.get('watch') or {}
            if not (wt.get('note') and wt.get('bad') and wt.get('good')):
                bad(w, 'watch needs note, bad and good')
            for k2 in ('bad', 'good'):
                if re.search(r'[{}\[\]^_]', wt.get(k2) or ''):
                    bad(w, 'watch.%s is plain text, no markup' % k2)
    elif pts != []:
        bad(base, 'the まとめ day has points: []')
    cmp_ = g.get('compare') or {}
    nforms = 3 if day <= 5 else 10
    if not cmp_.get('intro'):
        bad(base + '.compare', 'no intro')
    if len(cmp_.get('forms') or []) != nforms:
        bad(base + '.compare', '%d forms, not %d' % (len(cmp_.get('forms') or []), nforms))
    for f in cmp_.get('forms') or []:
        if not (f.get('form') and f.get('tag') and f.get('ja') and f.get('en')):
            bad(base + '.compare', 'a form needs form, tag, mark, ja and en')
        if f.get('mark') not in ('down', 'up', 'dot'):
            bad(base + '.compare', 'mark must be down, up or dot: %s' % f.get('form'))
        if ' · ' not in (f.get('tag') or ''):
            bad(base + '.compare', 'tag is "Japanese label · English gloss": %s' % f.get('tag'))
        if '{' not in (f.get('ja') or ''):
            bad(base + '.compare', 'the example marks the form with {…}: %s' % f.get('ja'))
        markup(base + '.compare', f.get('ja'))
        spaces(base + '.compare', f.get('ja'))
    if day == 6:
        forms = [plain(f.get('form')) for f in cmp_.get('forms') or []]
        syl_forms = [x.strip() for t in u['days'] for x in t.split('・') if x.strip()]
        norm = lambda s: re.sub(r'（(復習|定義|程度)）$', '', s).strip()
        if [norm(x) for x in forms] != [norm(x) for x in syl_forms]:
            bad(base + '.compare', 'the ten forms must be the unit\'s, in the syllabus order: %s' % ' '.join(norm(x) for x in syl_forms))
    chk = cmp_.get('check') or {}
    choice(base + '.c1', chk, 3, why=True)
    if chk.get('id') != base + '.c1':
        bad(base + '.c1', 'id should be %s.c1' % base)
    drill = g.get('drill') or []
    ndrill = 6 if day <= 5 else 8
    if len(drill) != ndrill:
        bad(base, '%d drill items, not %d' % (len(drill), ndrill))
    stars = [k for k, it in enumerate(drill) if it.get('kind') == 'star']
    if day <= 5 and len(stars) != 2:
        bad(base, 'the drill has four choice items and two star items')
    if day == 6 and stars != [3, 7]:
        bad(base, 'the まとめ drill has its star items at d4 and d8')
    for k, it in enumerate(drill):
        w = '%s.d%d' % (base, k + 1)
        if it.get('id') != w:
            bad(w, 'id should be ' + w)
        if it.get('kind') == 'star':
            star(w, it, hint=True)
            if it.get('type') != '文の文法2':
                bad(w, 'type 文の文法2')
        else:
            choice(w, it, 4, why=True)
            if '^' not in (it.get('q') or ''):
                bad(w, 'mark the clue with ^…^')
            if it.get('type') != '文の文法1':
                bad(w, 'type 文の文法1')
    exam = g.get('exam') or []
    if len(exam) != 3:
        bad(base, 'three exam-style items')
    for k, it in enumerate(exam):
        w = '%s.e%d' % (base, k + 1)
        if it.get('id') != w:
            bad(w, 'id should be ' + w)
        if k < 2:
            choice(w, it, 4, explain=True, readings=False)
            if '^' in (it.get('q') or ''):
                bad(w, 'no ^…^ clue in an exam-style item')
            if it.get('type') != '文の文法1':
                bad(w, 'type 文の文法1')
        else:
            star(w, it, readings=False, brace='star')
            if it.get('type') != '文の文法2':
                bad(w, 'type 文の文法2')
    sc = d.get('scene') or {}
    for f in ('ja', 'en', 'intro', 'words', 'check'):
        if not sc.get(f):
            bad(base + '.scene', 'no ' + f)
    words = sc.get('words') or []
    if len(words) != 8:
        bad(base + '.scene', '%d words, not 8' % len(words))
    ids = [w.get('id') for w in words]
    if len(set(ids)) != len(ids):
        bad(base + '.scene', 'two words share an id')
    for w in words:
        where = '%s.scene.%s' % (base, w.get('id'))
        for f in ('id', 'word', 'reading', 'gloss', 'parts'):
            if not w.get(f):
                bad(where, 'no ' + f)
        if not re.fullmatch(r'[a-z][a-z0-9]*', w.get('id') or ''):
            bad(where, 'id is a short lower-case English word')
        if not re.fullmatch(r'[ぁ-ゖー]+', w.get('reading') or ''):
            bad(where, 'reading in hiragana only: %s' % w.get('reading'))
        kan = [c for c in w.get('word') or '' if re.match(r'[一-鿿々]', c)]
        inparts = ''.join(c for p in w.get('parts') or [] if isinstance(p, list) and len(p) == 3 for c in p[0] if re.match(r'[\u4e00-\u9fff々]', c))
        if any(not (isinstance(p, list) and len(p) == 3 and all(p)) for p in w.get('parts') or []):
            bad(where, 'each part is [kanji, reading, meaning]')
        if kan and ''.join(kan) != inparts:
            bad(where, 'the parts must cover the word\'s kanji in order: %s vs %s' % (''.join(kan), inparts))
        if 'clip' in w:
            bad(where, 'no clip (the build names it)')
    planned = ((((plan or {}).get('units') or {}).get(str(unit)) or {}).get('days') or {}).get(str(day))
    if plan and not planned:
        print('  (%s: the plan has no words for this day: its scene is not checked against it)' % base)
    if planned:
        got = [(w.get('word'), w.get('reading')) for w in words]
        exp = [(w['word'], w['reading']) for w in planned['scene']['words']]
        if sorted(got) != sorted(exp):
            bad(base + '.scene', 'the words must be the planned ones: missing %s, extra %s' % (sorted(set(exp) - set(got)), sorted(set(got) - set(exp))))
    k1 = sc.get('check') or {}
    if k1.get('id') != base + '.k1':
        bad(base + '.k1', 'id should be %s.k1' % base)
    choice(base + '.k1', k1, 4, explain=True, readings=False, blank=k1.get('type') != '用法')
    if k1.get('type') not in ('漢字読み', '表記', '語形成', '文脈規定', '言い換え類義', '用法'):
        bad(base + '.k1', 'type must be an N2 vocabulary format: %s' % k1.get('type'))
    sk = d.get('skill') or {}
    it = sk.get('item') or {}
    if it.get('id') != base + '.r1':
        bad(base + '.r1', 'id should be %s.r1' % base)
    if sk.get('kind') == 'reading':
        for f in ('ja', 'en', 'ask', 'seconds', 'passage', 'strategy'):
            if not sk.get(f):
                bad(base + '.skill', 'no ' + f)
        n = len(plain(sk.get('passage')).replace('\n', ''))
        lo, hi = (250, 400) if sk.get('ja') == '情報検索' else (200, 350)
        if not lo <= n <= hi:
            bad(base + '.skill', 'the passage has %d characters, not %d to %d' % (n, lo, hi))
        if not 60 <= (sk.get('seconds') or 0) <= 120:
            bad(base + '.skill', 'seconds 60 to 120')
        no_reading(base + '.skill.passage', sk.get('passage'))
        markup(base + '.skill.passage', sk.get('passage'))
        choice(base + '.r1', it, 4, why=False, explain=True, readings=False, blank=False)
        if len(it.get('why') or []) != 4 or len(it.get('short') or []) != 4:
            bad(base + '.r1', 'a reading item has why and short, one per option')
        if it.get('type') != '読解・' + (sk.get('ja') or ''):
            bad(base + '.r1', 'type should be 読解・' + (sk.get('ja') or ''))
    elif sk.get('kind') == 'listening':
        for f in ('ja', 'en', 'ask', 'audio'):
            if not sk.get(f):
                bad(base + '.skill', 'no ' + f)
        for n, l in enumerate(sk.get('audio') or []):
            if not (isinstance(l, list) and len(l) == 3 and l[0] in ('N', 'M', 'F') and l[1] and (l[2] is None or isinstance(l[2], str))):
                bad(base + '.skill.audio', 'line %d must be [N|M|F, text, respelling or null]' % (n + 1))
        quick = sk.get('ja') == '即時応答'
        gist = sk.get('ja') == '概要理解'
        nopt = 3 if quick else 4
        choice(base + '.r1', it, nopt, why=True, readings=False, blank=False)
        if it.get('type') != sk.get('ja'):
            bad(base + '.r1', 'type should be ' + str(sk.get('ja')))
        if it.get('printed') is not (not (quick or gist)):
            bad(base + '.r1', 'printed should be %s' % (not (quick or gist)))
        for s in it.get('script') or []:
            if not re.match(r'^(男|女|ナレーター)：', s):
                bad(base + '.r1', 'a script line starts 男： 女： or ナレーター：: ' + s[:20])
        if not it.get('script'):
            bad(base + '.r1', 'no script')
        if len(it.get('short') or []) != nopt:
            bad(base + '.r1', 'short needs one entry per option')
        nums = [l[1] for l in sk.get('audio') or [] if l[0] == 'N' and l[1] in ('1', '2', '3', '4')]
        if (quick or gist) and nums != [str(i + 1) for i in range(nopt)]:
            bad(base + '.skill.audio', 'the narrator says 1 to %d before the options' % nopt)
    else:
        bad(base + '.skill', 'kind must be reading or listening')
    # answer positions (a spread over 1 to 4 is wanted)
    pos = [x.get('answer') for x in drill + exam + [k1] if x.get('kind') == 'choice']
    return pos


def check_test(path, unit, level_dir):
    t = json.load(open(path, encoding='utf-8'))
    syl = json.load(open(os.path.join(level_dir, 'units.json'), encoding='utf-8'))
    FORMS[:] = unit_forms(next(x for x in syl['units'] if x['n'] == unit))
    pre = '' if syl['level'] == 'N2' else syl['level'].lower()
    base = '%su%02dt' % (pre, unit)
    if not isinstance(t, list) or len(t) != 24:
        bad(base, 'the week test is a list of 24 items')
        return []
    plan_types = ['漢字読み'] * 2 + ['表記'] * 2 + ['語形成'] * 2 + ['文脈規定'] * 2 + ['文の文法1'] * 7 + ['文の文法2'] * 3 + ['読解・内容理解'] * 6
    for k, it in enumerate(t):
        w = '%s.%d' % (base, k + 1)
        if it.get('id') != w:
            bad(w, 'id should be ' + w)
        if it.get('type') != plan_types[k]:
            bad(w, 'type should be ' + plan_types[k])
        if 15 <= k <= 17:
            star(w, it, readings=False, brace='star')
        else:
            choice(w, it, 4, explain=True, readings=False, blank=k < 18)
        if k >= 18:
            if not it.get('passage') or len(it.get('short') or []) != 4:
                bad(w, 'a passage item carries its passage and short')
            n = len(plain(it.get('passage')))
            if not 200 <= n <= 300:
                bad(w, 'the passage has %d characters, not 200 to 300' % n)
    for a, b in ((18, 19), (20, 21), (22, 23)):
        if t[a].get('passage') != t[b].get('passage'):
            bad(base, 'items %d and %d carry the same passage' % (a + 1, b + 1))
    return [it.get('answer') for it in t if it.get('kind') == 'choice']


for path in args:
    name = os.path.basename(path)
    level_dir = os.path.dirname(os.path.dirname(os.path.abspath(path)))
    m = re.fullmatch(r'(?:n\d)?u(\d\d)d(\d)\.json', name)
    mt = re.fullmatch(r'(?:n\d)?u(\d\d)-test\.json', name)
    before = len(problems)
    try:
        if m:
            pos = check_day(path, int(m.group(1)), int(m.group(2)), level_dir)
        elif mt:
            pos = check_test(path, int(mt.group(1)), level_dir)
        else:
            bad(name, 'not a day (uNNdD.json) or a week test (uNN-test.json)')
            pos = []
        if os.path.basename(level_dir) != 'n2':
            bad(name, 'check-day.py checks N2 drafts (content/n2/drafts) only')
    except Exception as e:  # a value of the wrong kind anywhere: the file's problem, and the other files are still checked
        bad(name, 'could not be read: %r' % e)
        pos = []
    spread = ' '.join('%d:%d' % (n, pos.count(n)) for n in (1, 2, 3, 4))
    print('%s: %s; right answers at %s' % (name, '%d problem(s)' % (len(problems) - before) if len(problems) > before else 'OK', spread))
for p in problems:
    print('  ' + p)
sys.exit(1 if problems else 0)
