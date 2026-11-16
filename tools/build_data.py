#!/usr/bin/env python3
"""Build data/metres.json and data/kosha.json (+ .js wrappers for the web app, + copies for the Python package).

Inputs, all in tools/:
  core_laksanas.json  core metres with their lakṣaṇa verses; each must scan in its own metre (checked here)
  metres_std.json     standard metres from their gaṇa definitions
  kosha_std.json      synonym sets for Chando-Sahāyaka
"""
import json
import os
import re
import shutil
import sys
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(ROOT, 'python'))

from pingala_shodhana.scan import iast_to_devanagari  # noqa: E402
from pingala_shodhana.metres import formula_to_pattern  # noqa: E402
from pingala_shodhana.laksana import read_laksana  # noqa: E402

CLASS = ['', 'uktā', 'atyuktā', 'madhyā', 'pratiṣṭhā', 'supratiṣṭhā', 'gāyatrī', 'uṣṇik', 'anuṣṭubh', 'bṛhatī',
         'paṅkti', 'triṣṭubh', 'jagatī', 'atijagatī', 'śakvarī', 'atiśakvarī', 'aṣṭi', 'atyaṣṭi', 'dhṛti',
         'atidhṛti', 'kṛti', 'prakṛti', 'ākṛti', 'vikṛti', 'saṃkṛti', 'abhikṛti', 'utkṛti']


def slug(s):
    s = ''.join(c for c in unicodedata.normalize('NFD', s) if not unicodedata.combining(c))
    return re.sub(r'[^a-z0-9]+', '-', re.sub(r'\(.*?\)', '', s).lower()).strip('-')


def main():
    out_dir = os.path.join(ROOT, 'data')
    pkg_dir = os.path.join(ROOT, 'python', 'pingala_shodhana', 'data')
    os.makedirs(out_dir, exist_ok=True)
    os.makedirs(pkg_dir, exist_ok=True)
    metres, seen = [], {}

    def add(e):
        key = (e['kind'], tuple(p[:-1] for p in e['pats']))
        if key in seen:
            return
        seen[key] = e
        e.setdefault('id', slug(e['iast']))
        if e['kind'] == 'sama':
            L = len(e['pats'][0])
            e['class'] = CLASS[L] if L < len(CLASS) else 'daṇḍaka'
        metres.append(e)

    core = json.load(open(os.path.join(HERE, 'core_laksanas.json'), encoding='utf-8'))['metres']
    ok = agree = 0
    for m in core:
        pats = [formula_to_pattern(m['f'])] if 'f' in m else [formula_to_pattern(x) for x in m['ardha']]
        r = read_laksana(m['laksana'], m['dev'])
        if not (len(r.scanned[0]) == len(pats[0]) and r.scanned[0][:-1] == pats[0][:-1]):
            print('  ! lakṣaṇa does not scan in its own metre, skipped:', m['iast'], file=sys.stderr)
            continue
        ok += 1
        agree += r.agree
        e = {'id': m['id'], 'iast': m['iast'], 'dev': m['dev'], 'kind': 'sama' if 'f' in m else 'ardha', 'pats': pats,
             'src': ['core'], 'laksana': m['laksana'], 'f': m.get('f') or '|'.join(m['ardha']),
             'laksana_decoded': r.decoded, 'laksana_agree': r.agree}
        if m.get('yati'):
            e['yati'] = m['yati']
        add(e)

    for row in json.load(open(os.path.join(HERE, 'metres_std.json'), encoding='utf-8'))['metres']:
        name, f = row[0], row[1]
        if isinstance(f, str):
            kind, pats = 'sama', [formula_to_pattern(f)]
        elif isinstance(f, list):
            kind, pats = 'ardha', [formula_to_pattern(x) for x in f]
        else:
            kind, pats = 'visama', f['pats']
        e = {'iast': name, 'dev': iast_to_devanagari(name), 'kind': kind, 'pats': pats, 'src': ['std']}
        if len(row) > 2:
            e['yati'] = row[2]
        add(e)

    data = {'version': 2, 'count': len(metres), 'metres': metres}
    with open(os.path.join(out_dir, 'metres.json'), 'w', encoding='utf-8') as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(',', ':'))

    sets = []
    for gloss, linga, words in json.load(open(os.path.join(HERE, 'kosha_std.json'), encoding='utf-8'))['sets']:
        sets.append([gloss, '', [[w, linga] for w in words.split()]])
    with open(os.path.join(out_dir, 'kosha.json'), 'w', encoding='utf-8') as fh:
        json.dump({'format': '[gloss, ref, [[word, liṅga P|S|N], ...]]', 'sets': sets}, fh, ensure_ascii=False, separators=(',', ':'))

    for name, var in (('metres', 'PS_METRES'), ('kosha', 'PS_KOSHA')):
        src = os.path.join(out_dir, name + '.json')
        body = open(src, encoding='utf-8').read()
        with open(os.path.join(out_dir, name + '.js'), 'w', encoding='utf-8') as fh:
            fh.write(f'window.{var}={body};\n')
        shutil.copy(src, os.path.join(pkg_dir, name + '.json'))
    print(f'metres: {len(metres)} (+ rule-based anuṣṭubh, upajāti and āryā family) · core lakṣaṇas verified {ok}/{len(core)}, '
          f'gaṇas decoded {agree}/{len(core)} · synonym sets: {len(sets)}')


if __name__ == '__main__':
    main()
