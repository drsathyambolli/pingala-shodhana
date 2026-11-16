"""Lakṣaṇa-Yantra: read a metre's definition (lakṣaṇa) from the śāstra itself.

A lakṣaṇa verse of the Vṛttaratnākara tradition does two things at once:
  1. it *names* the gaṇas in a coded vocabulary (म्भौ नतौ ताद्गुरू …) and the
     yati with bhūta-saṅkhyā number words (जलधि-षड्-अगैः = 4, 6, 7);
  2. it is itself *composed in* the metre it defines (lakṣya = lakṣaṇa).

Lakṣaṇa-Yantra decodes (1) with a rule-based reader, scans (2) with the
prosodic engine, and accepts a metre into the database only when the two
agree. Yati numbers are checked against the scanned length and against the
word breaks of the verse itself.

Reading rules (all rule-based, no dictionary of metres needed):
  * words are cut into sub-words at sandhi residues: ablative -āt/-ād (म्भौ नतौ
    ताद्गुरू), visarga before a consonant (-आस्, -ऐर्, -ऐश्), -āv- for -au + vowel;
  * an akṣara whose consonants are all gaṇa letters (म य र स त ज भ न ग ल) and whose
    vowel is a / ā / ai / au / o is a coded akṣara; a conjunct stands for several
    letters (म्भौ = म + भ);
  * a single letter in the dual (तौ, गौ, यौ) counts twice; a dvandva in the dual or
    plural (जगौ, सजसा) counts each member once;
  * गुरु/गुरू/लघु, multipliers (युग 2, त्रय 3, चतुर् 4) and रेफ / X-कार are read as words;
  * number words (वेद 4, रस 6, अश्व 7, ग्रह 9, सूर्य 12 …) give the yati;
  * the metre's own name and function words (यदि, स्यात्, चेत्, ततः …) are skipped.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional, Tuple

from .metres import formula_to_pattern, pattern_to_formula
from .scan import Syl, parse_verse, syllabify, tokenize

GANA_LETTER = {'m': 'm', 'y': 'y', 'r': 'r', 's': 's', 't': 't', 'j': 'j', 'bh': 'b', 'n': 'n', 'g': 'g', 'l': 'l'}
CODE_VOWELS = {'a', 'ā', 'ai', 'au', 'o'}
CASE_VOWELS = {'ā', 'ai', 'au', 'o', 'e'}
RESIDUE = {'t', 'd', 'n', 's', 'ś', 'ṣ', 'r', 'm'}

NUMBER_WORDS: List[Tuple[str, Tuple[int, ...]]] = sorted([
    ('वेद', (4,)), ('श्रुति', (4,)), ('जलधि', (4,)), ('अब्धि', (4,)), ('अम्बुधि', (4,)), ('सागर', (4,)), ('समुद्र', (4,)),
    ('युग', (4,)), ('चतुर्', (4,)),
    ('बाण', (5,)), ('शर', (5,)), ('इषु', (5,)), ('भूत', (5,)), ('अक्ष', (5,)), ('इन्द्रिय', (5,)),
    ('रस', (6,)), ('ऋतु', (6,)), ('अङ्ग', (6,)), ('तर्क', (6,)), ('षडग', (6, 7)), ('षड', (6,)), ('षट', (6,)),
    ('अश्व', (7,)), ('मुनि', (7,)), ('ऋषि', (7,)), ('लोक', (7,)), ('स्वर', (7,)), ('अद्रि', (7,)), ('शैल', (7,)),
    ('हय', (7,)), ('तुरग', (7,)), ('नग', (7,)),
    ('वसु', (8,)), ('भोगि', (8,)), ('नाग', (8,)), ('गज', (8,)), ('सर्प', (8,)),
    ('ग्रह', (9,)), ('रन्ध्र', (9,)), ('अङ्क', (9,)), ('निधि', (9,)),
    ('दश', (10,)), ('दिश', (10,)), ('दिक्', (10,)),
    ('रुद्र', (11,)), ('सूर्य', (12,)), ('अर्क', (12,)), ('आदित्य', (12,)), ('भानु', (12,)),
    ('त्रिमुनि', (7, 7, 7)), ('त्रिदश', (3, 10)), ('त्रि', (3,)),
], key=lambda x: -len(x[0]))
YATI_WORDS = ('यति', 'विरति', 'विराम', 'च्छिन्न', 'छिन्न', 'युत', 'युक्त')
TERMINATORS = ('संयुत', 'सहित', 'समेत', 'युक्त', 'युते', 'युत', 'अन्वित')
MULTIPLIERS = (('युगल', 2), ('युग्म', 2), ('युग', 2), ('द्वय', 2), ('त्रय', 3), ('चतुर्भि', 4), ('चतू', 4), ('चतुर्', 4))
GURU_WORDS = (('सगुरवः', 'g'), ('सगुरु', 'g'), ('गुरुयुग्म', 'gg'), ('गुरुद्वय', 'gg'), ('गुरुयुग', 'gg'), ('गुरू', 'gg'),
              ('गुरवः', 'g'), ('गुरुः', 'g'), ('गुरु', 'g'), ('लघू', 'll'), ('लघुः', 'l'), ('लघु', 'l'))
STOP = {'यदि', 'स्यात्', 'स्याद्', 'स्या', 'चेत्', 'चेद्', 'चे', 'च', 'तु', 'हि', 'इह', 'वा', 'ततो', 'ततः', 'तदा', 'यदा', 'सा', 'या',
        'इयम्', 'एषा', 'भवति', 'भवेत्', 'भवे', 'आह', 'उदिता', 'उदितम्', 'तत्', 'अथ', 'इति', 'वद', 'मता', 'मतम्', 'ज्ञेया',
        'ज्ञेयम्', 'प्रोक्ता', 'विषमे', 'समे', 'अयुजि', 'युजि', 'पादे', 'तथा', 'अपि', 'इदम्', 'इदं'}


def _clone(s: Syl, on: Optional[List[str]] = None) -> Syl:
    t = Syl(list(s.on if on is None else on), s.v, list(s.coda), s.m, s.h, s.n, s.after, s.wb, s.final, s.avag, s.g)
    return t


def _dev(units: List[Syl], k: int = 0) -> str:
    return ''.join(u.dev(coda=(i == len(units) - 1)) for i, u in enumerate(units[k:], k))


def _match(units: List[Syl], k: int, lex: str) -> int:
    """Number of units from k that spell lex (allowing lex to end inside the last unit)."""
    s = ''
    for j in range(k, len(units)):
        s += units[j].dev(coda=(j == len(units) - 1))
        if s.startswith(lex) or s.rstrip('्') == lex.rstrip('्'):
            return j - k + 1
        if not lex.startswith(s):
            return 0
    return 0


def _match_any(units: List[Syl], k: int, lex: str, prev_vowel: Optional[str]) -> int:
    n = _match(units, k, lex)
    if n:
        return n
    # vowel-initial lexemes hidden by sandhi: अश्व in बाणाश्व, अम्बुधि in (तोटकम्) अम्बुधि, अक्ष in गावक्ष
    if lex[0] in 'अआ' and k < len(units):
        u = units[k]
        if prev_vowel in ('a', 'ā') and k > 0:
            n = _match(units, k, lex[1:])
            if n:
                return n
        if len(u.on) == 1 and u.v == 'a':
            stripped = [_clone(u, [])] + units[k + 1:]
            n = _match(stripped, 0, lex)
            if n:
                return n
    return 0


def _codable(u: Syl) -> List[str]:
    if not u.on or u.v not in CODE_VOWELS:
        return []
    out: List[str] = []
    for c in u.on:
        if c not in GANA_LETTER:
            return []
        L = GANA_LETTER[c]
        if not out or out[-1] != L:
            out.append(L)
    return out


def _subwords(sy: List[Syl]) -> List[Tuple[List[Syl], Optional[str]]]:
    """Cut a word at sandhi residues. Returns (units, forced_end_vowel) pairs."""
    subs: List[Tuple[List[Syl], Optional[str]]] = []
    cur: List[Syl] = []
    forced: Optional[str] = None
    for k, s in enumerate(sy):
        if k > 0:
            pv = sy[k - 1].v
            merged = (pv in ('a', 'ā') and any(L[0] == 'अ' and _match(sy, k, L[1:]) for L, _ in NUMBER_WORDS)) or \
                any(_match(sy, k, L) for L, _ in NUMBER_WORDS if L[0] not in 'अआ')
            if sy[k - 1].avag:
                subs.append((cur, forced)); cur, forced = [], None
                s = _clone(s, s.on)
            elif merged:
                pass
            elif pv in ('ai', 'au') and s.on == ['r']:
                subs.append((cur, forced)); cur, forced = [], None
                s = _clone(s, [])
            elif pv in CASE_VOWELS and len(s.on) >= 2 and s.on[0] in RESIDUE:
                subs.append((cur, forced)); cur, forced = [], None
                s = _clone(s, s.on[1:])
            elif pv == 'ā' and s.on in (['v'], ['y']) and k + 1 <= len(sy):
                subs.append((cur, 'au' if s.on == ['v'] else 'ai')); cur, forced = [], None
                s = _clone(s, [])
            elif pv == 'a' and len(s.on) >= 2 and s.on[0] in RESIDUE:
                rest = [_clone(s, s.on[1:])] + sy[k + 1:]
                if any(_match(rest, 0, lex) for lex, _ in NUMBER_WORDS) or any(_match(rest, 0, lex) for lex, _ in GURU_WORDS):
                    subs.append((cur, 'aḥ')); cur, forced = [], None
                    s = rest[0]
        cur.append(s)
    subs.append((cur, forced))
    return [x for x in subs if x[0]]


@dataclass
class _Reader:
    letters: List[str] = field(default_factory=list)
    yati: List[int] = field(default_factory=list)
    pending: int = 0

    chain_open: bool = False

    def add_yati(self, nums: List[int]) -> None:
        if self.chain_open:
            self.yati = self.yati + nums
        elif len(nums) >= len(self.yati):
            self.yati = list(nums)
        self.chain_open = True

    def add(self, ls: List[str]) -> None:
        self.chain_open = False
        if self.pending and ls:
            ls = ls[:-1] + [ls[-1]] * self.pending
            self.pending = 0
        self.letters.extend(ls)


def _read_sub(units: List[Syl], forced: Optional[str], rd: _Reader, prev_end: Optional[str]) -> None:
    word = _dev(units)
    if word in STOP or word.rstrip('ः्') in STOP:
        return
    # gaṇa letters followed by a terminator (मभसग-युक्ता, र-संयुतैः, ननमयय-युतेयम्)
    for t in TERMINATORS:
        for p in range(1, len(units)):
            if _match(units, p, t):
                pre = units[:p]
                ls: List[str] = []
                ok = True
                for u in pre:
                    c = _codable(u)
                    if not c or u.v != 'a':
                        ok = False
                        break
                    ls += c
                if ok and ls:
                    rd.add(ls)
                    return
    for lex, val in (('चतुर्भि', 4), ('त्रयेण', 3), ('त्रय', 3)):
        if _match(units, 0, lex) and rd.letters:
            rd.letters.extend([rd.letters[-1]] * (val - 1))
            return
    # number words: yati compound or multiplier of the following letter
    k = 0
    nums: List[int] = []
    pv = prev_end
    while k < len(units):
        hit = None
        for lex, val in NUMBER_WORDS:
            n = _match_any(units, k, lex, pv if k == 0 else units[k - 1].v)
            if n:
                hit = (n, val)
                break
        if not hit:
            break
        nums += list(hit[1])
        n, lexv = hit[0], None
        k += n
        if k <= len(units) and k > 0 and units[k - 1].coda == [] and k < len(units) + 1:
            pass
        # a consonant-final lexeme (चतुर्, दिक्) ends inside the next akṣara's onset
        for lex, val in NUMBER_WORDS:
            if lex.endswith('्') and val == hit[1] and _match(units, k - n, lex):
                last = units[k - 1]
                if len(last.on) >= 2:
                    units = units[:k - 1] + [_clone(last, last.on[1:])] + units[k:]
                    k -= 1
                break
    if nums:
        rest = units[k:]
        tail = _dev(rest) if rest else ''
        if rest and _codable(rest[0]) and not any(tail.startswith(y) for y in YATI_WORDS) and len(nums) == 1:
            rd.pending = nums[0]          # अम्बुधि-सैः = sa × 4
            _read_code(rest, forced, rd)
            return
        if not rest or any(tail.startswith(y) for y in YATI_WORDS) or rest[0].v in ('ai', 'au') or len(nums) >= 2:
            rd.add_yati(nums)
            return
    _read_code(units, forced, rd)


def _read_code(units: List[Syl], forced: Optional[str], rd: _Reader) -> None:
    run: List[str] = []
    k = 0
    end_vowel: Optional[str] = None
    complete = False
    while k < len(units):
        u = units[k]
        hit = None
        for lex, val in GURU_WORDS:
            n = _match(units, k, lex)
            if n:
                hit = (n, val)
                break
        if hit:
            if run and end_vowel in CASE_VOWELS:
                rd.add(run)
            run = []
            rd.letters.extend(list(hit[1]))
            k += hit[0]
            # the rest of the sub-word after गुरु (…र्वियोगिनी) is not read
            return
        mhit = None
        for lex, val in MULTIPLIERS:
            n = _match(units, k, lex)
            if n:
                mhit = (n, val)
                break
        if mhit:
            n, val = mhit
            if run:
                run = run + [run[-1]] * (val - 1)
            elif rd.letters and k == 0 and _dev(units, k).startswith('चतुर्भि'):
                rd.letters.extend([rd.letters[-1]] * (val - 1))
                return
            elif rd.letters and k == 0 and _dev(units, k).startswith('त्रय'):
                rd.letters.extend([rd.letters[-1]] * (val - 1))
                return
            else:
                rd.pending = val
            k += n
            continue
        n = _match(units, k, 'रेफ')
        if n:
            run += ['r'] * (rd.pending or 1)
            rd.pending = 0
            k += n
            complete = True
            break
        if k + 1 < len(units) and units[k + 1].on == ['k'] and _dev(units, k + 1).startswith('कार') and u.v == 'a' and _codable(u):
            run += _codable(u) * (rd.pending or 1)
            rd.pending = 0
            complete = True
            break
        c = _codable(u)
        if not c:
            break
        if rd.pending:
            c = c[:-1] + [c[-1]] * rd.pending
            rd.pending = 0
        run += c
        end_vowel = u.v
        k += 1
        if u.v != 'a' or u.h:
            complete = k == len(units) or _dev(units, k) in ('नाम्', 'नां', 'णाम्', 'णां')
            if u.v == 'au' and len(run) == 1:
                run = run * 2
            if complete:
                break
            run = []
            break
    else:
        if forced and run:
            if forced == 'au' and len(run) == 1:
                run = run * 2
            complete = True
    if complete and run and forced == 'au' and run == [run[0]] and end_vowel == 'ā':
        run = run * 2
    if complete and run:
        rd.add(run)


def decode(text: str, name: Optional[str] = None) -> Tuple[str, List[int]]:
    """Read (gaṇa formula, yati segments) from a lakṣaṇa."""
    rd = _Reader()
    name_stem = (name or '').strip().split(' ')[0].rstrip('ःम्ं').rstrip('्')
    for raw in text.replace('।', ' ').replace('॥', ' ').replace('\n', ' ').split():
        toks = [t for t in tokenize(raw) if t.t not in ('W', 'P')]
        sy = syllabify(toks)
        if not sy:
            continue
        word = ''.join(s.dev() for s in sy)
        if name_stem and len(name_stem) >= 3:
            if word.rstrip('ःम्ं').rstrip('्').rstrip('ा') == name_stem.rstrip('ा') or word.startswith(name_stem):
                # strip the metre's name and read what is left (तोटकम्-अम्बुधिसैः)
                acc = ''
                cut = 0
                for j, s in enumerate(sy):
                    acc += s.dev(coda=False)
                    if len(acc) >= len(name_stem):
                        cut = j + 1
                        break
                sy = sy[cut:]
                if not sy:
                    continue
        prev_end = None
        for units, forced in _subwords(sy):
            _read_sub(units, forced, rd, prev_end)
            prev_end = units[-1].v
    return ''.join(rd.letters), rd.yati


def decode_ganas(text: str, name: Optional[str] = None) -> str:
    return decode(text, name)[0]


def decode_yati(text: str, name: Optional[str] = None) -> List[int]:
    return decode(text, name)[1]


@dataclass
class LaksanaReading:
    text: str
    name: Optional[str]
    scanned: List[str]
    decoded: str = ''
    decoded_pattern: str = ''
    scan_formula: str = ''
    agree: bool = False
    yati: List[int] = field(default_factory=list)
    yati_ok: Optional[bool] = None
    notes: List[str] = field(default_factory=list)

    @property
    def pattern(self) -> str:
        return self.scanned[0] if self.scanned else ''


def read_laksana(text: str, name: Optional[str] = None) -> LaksanaReading:
    """Decode a lakṣaṇa and check it against its own scansion."""
    segs = parse_verse(text)
    scanned = [s.pattern for s in segs]
    r = LaksanaReading(text, name, scanned)
    if not scanned:
        r.notes.append('No akṣaras found.')
        return r
    r.decoded, y = decode(text, name)
    try:
        r.decoded_pattern = formula_to_pattern(r.decoded) if r.decoded else ''
    except KeyError:
        r.decoded_pattern = ''
    first = scanned[0]
    r.scan_formula = pattern_to_formula(first)
    if len(scanned) == 1:
        r.agree = bool(r.decoded_pattern) and len(r.decoded_pattern) == len(first) and r.decoded_pattern[:-1] == first[:-1]
    else:
        tgt = scanned[0] + scanned[1]
        skip = {len(scanned[0]) - 1, len(tgt) - 1}
        r.agree = bool(r.decoded_pattern) and len(r.decoded_pattern) == len(tgt) and all(
            a == b for i, (a, b) in enumerate(zip(r.decoded_pattern, tgt)) if i not in skip)
    if not r.decoded:
        r.notes.append('No gaṇa words found; the lakṣaṇa may define the metre by reference to another one.')
    elif not r.agree:
        r.notes.append(f'Decoded gaṇas give {r.decoded_pattern}, the verse itself scans {first}.')
    if y:
        r.yati = list(y)
        if sum(y) == len(first):
            pos = 0
            r.yati_ok = True
            for seg in y[:-1]:
                pos += seg
                if not segs[0].syls[pos - 1].wb:
                    r.notes.append(f'Yati after akṣara {pos} falls inside a written word (a sandhi or compound joint).')
        else:
            r.yati_ok = False
            r.notes.append(f'Yati numbers {y} add up to {sum(y)}, the pāda has {len(first)} akṣaras.')
    return r
