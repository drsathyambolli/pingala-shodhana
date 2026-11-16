"""Command line: pingala scan | identify | laksana | repair | synonyms."""
from __future__ import annotations

import argparse
import sys

from .laksana import read_laksana
from .metres import diagnose, identify
from .sahayaka import suggest, synonyms
from .scan import parse_verse


def _read(args) -> str:
    if args.text:
        return args.text.replace('\\n', '\n')
    return sys.stdin.read()


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog='pingala', description='Piṅgala-Śodhana: Sanskrit metre analysis')
    sub = ap.add_subparsers(dest='cmd', required=True)
    for name, hlp in (('scan', 'laghu/guru scansion of each line'), ('identify', 'identify the metre and explain deviations'),
                      ('laksana', 'read a lakṣaṇa verse (Lakṣaṇa-Yantra)'), ('repair', 'suggest repairs (Chando-Sahāyaka)')):
        p = sub.add_parser(name, help=hlp)
        p.add_argument('text', nargs='?', help='verse text (use \\n between lines); reads stdin if omitted')
        if name == 'laksana':
            p.add_argument('--name', help='metre name in Devanagari')
        if name == 'repair':
            p.add_argument('--metre', help='target metre id or name')
            p.add_argument('-n', type=int, default=8)
        if name == 'identify':
            p.add_argument('-n', type=int, default=3)
    p = sub.add_parser('synonyms', help='inflected kośa synonyms of a word')
    p.add_argument('word')
    args = ap.parse_args(argv)

    if args.cmd == 'synonyms':
        for form, artha in synonyms(args.word):
            print(f'{form}\t{artha}')
        return 0
    text = _read(args)
    if args.cmd == 'scan':
        for seg in parse_verse(text):
            print(' '.join(s.dev() for s in seg.syls))
            print(' '.join('ऽ' if s.g else '।' for s in seg.syls), f'  {len(seg.syls)} akṣaras, {seg.matra} mātrās')
    elif args.cmd == 'identify':
        res = identify(text, top=args.n)
        if not res:
            print('No akṣaras found.'); return 1
        for r in res:
            print(f'{r.metre.iast} ({r.metre.dev})  deviations: {r.score:g}')
        best = res[0]
        for h in diagnose(best):
            print(f'  [{h.category}] pāda {h.pada + 1}{"" if h.position is None else f", akṣara {h.position + 1}"}: {h.text}')
    elif args.cmd == 'laksana':
        r = read_laksana(text, args.name)
        print('scans      :', ' | '.join(r.scanned))
        print('gaṇas read :', r.decoded or '—', r.decoded_pattern)
        print('agree      :', r.agree)
        print('yati       :', r.yati or '—', '' if r.yati_ok is None else ('ok' if r.yati_ok else 'check'))
        for n in r.notes:
            print('note       :', n)
    elif args.cmd == 'repair':
        target, base, sug = suggest(text, args.metre, args.n)
        print(f'target: {target.iast}  draft deviations: {base:g}')
        for s in sug:
            print(f'\n[{s.score:g}] ' + '; '.join(s.changes))
            print(s.text)
    return 0


if __name__ == '__main__':
    sys.exit(main())
