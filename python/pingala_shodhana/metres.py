"""Metre database, identification (with fuzzy matching) and anomaly diagnosis."""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Dict, List, Optional, Sequence

from .scan import Segment, Syl, parse_verse

GANA = {'y': 'LGG', 'm': 'GGG', 't': 'GGL', 'r': 'GLG', 'j': 'LGL', 'b': 'GLL', 'n': 'LLL', 's': 'LLG', 'l': 'L', 'g': 'G'}
GANA_NAME = {'LGG': 'y', 'GGG': 'm', 'GGL': 't', 'GLG': 'r', 'LGL': 'j', 'GLL': 'b', 'LLL': 'n', 'LLG': 's'}
GANA_DEV = {'y': 'य', 'm': 'म', 't': 'त', 'r': 'र', 'j': 'ज', 'b': 'भ', 'n': 'न', 's': 'स', 'l': 'ल', 'g': 'ग'}

_HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.environ.get('PINGALA_DATA') or next(
    (d for d in (os.path.join(_HERE, 'data'), os.path.join(_HERE, '..', '..', 'data')) if os.path.exists(os.path.join(d, 'metres.json'))),
    os.path.join(_HERE, 'data'))


def formula_to_pattern(f: str) -> str:
    return ''.join(GANA[c] for c in f)


def pattern_to_formula(p: str) -> str:
    out = []
    i = 0
    while i + 3 <= len(p):
        out.append(GANA_NAME[p[i:i + 3]])
        i += 3
    out += [c.lower() for c in p[i:]]
    return ''.join(out)


@dataclass
class Metre:
    id: str
    iast: str
    dev: str
    kind: str                      # sama | ardha | visama | anus | jati | upajati
    pats: List[str] = field(default_factory=list)
    yati: Optional[List[int]] = None
    targets: Optional[List[int]] = None   # mātrā targets for jāti
    aliases: List[str] = field(default_factory=list)
    src: List[str] = field(default_factory=list)
    laksana: Optional[str] = None

    @property
    def lens(self) -> List[int]:
        if self.kind == 'anus':
            return [8, 8, 8, 8]
        if self.kind == 'sama' or self.kind == 'upajati':
            return [len(self.pats[0])] * 4
        if self.kind == 'ardha':
            a, b = len(self.pats[0]), len(self.pats[1])
            return [a, b, a, b]
        if self.kind == 'visama':
            return [len(p) for p in self.pats]
        return list(self.targets or [])   # jāti: mātrās per pāda; vedic: akṣaras per pāda


SPECIAL = [
    Metre('anustubh', 'Anuṣṭubh (Śloka)', 'अनुष्टुभ् (श्लोकः)', 'anus', src=['core'],
          laksana='श्लोके षष्ठं गुरु ज्ञेयं सर्वत्र लघु पञ्चमम्।\nद्विचतुष्पादयोर्ह्रस्वं सप्तमं दीर्घमन्ययोः॥'),
    Metre('upajati', 'Upajāti', 'उपजातिः', 'upajati', [formula_to_pattern('ttjgg'), formula_to_pattern('jtjgg')], src=['core'],
          laksana='अनन्तरोदीरितलक्ष्मभाजौ पादौ यदीयावुपजातयस्ताः'),
    Metre('vamsopajati', 'Upajāti (Vaṃśastha–Indravaṃśā)', 'उपजातिः (वंश)', 'upajati',
          [formula_to_pattern('jtjr'), formula_to_pattern('ttjr')], src=['core']),
    Metre('arya', 'Āryā', 'आर्या', 'jati', targets=[12, 18, 12, 15], src=['core'],
          laksana='यस्याः पादे प्रथमे द्वादश मात्रास्तथा तृतीयेऽपि।\nअष्टादश द्वितीये चतुर्थके पञ्चदश सार्या॥'),
    Metre('giti', 'Gīti', 'गीतिः', 'jati', targets=[12, 18, 12, 18], src=['core']),
    Metre('upagiti', 'Upagīti', 'उपगीतिः', 'jati', targets=[12, 15, 12, 15], src=['core']),
    Metre('udgiti', 'Udgīti', 'उद्गीतिः', 'jati', targets=[12, 15, 12, 18], src=['core']),
    Metre('aryagiti', 'Āryāgīti', 'आर्यागीतिः', 'jati', targets=[12, 20, 12, 20], src=['core']),
    Metre('vaitaliya', 'Vaitālīya', 'वैतालीयम्', 'jati', targets=[14, 16, 14, 16], src=['core']),
    Metre('matrasamaka', 'Mātrāsamaka (Pādākulaka)', 'मात्रासमकम्', 'jati', targets=[16, 16, 16, 16], src=['core']),
    # Vedic metres of Piṅgala's Chandaḥsūtra: counted by akṣaras per pāda (±1 = nicṛt / bhurik)
    Metre('gayatri', 'Gāyatrī (Vedic)', 'गायत्री', 'vedic', targets=[8, 8, 8], src=['core']),
    Metre('usnih', 'Uṣṇih (Vedic)', 'उष्णिक्', 'vedic', targets=[8, 8, 12], src=['core']),
    Metre('brhati', 'Bṛhatī (Vedic)', 'बृहती', 'vedic', targets=[8, 8, 12, 8], src=['core']),
    Metre('virat', 'Virāj (Vedic)', 'विराट्', 'vedic', targets=[10, 10, 10], src=['core']),
    Metre('pankti-vedic', 'Paṅkti (Vedic)', 'पङ्क्तिः', 'vedic', targets=[8, 8, 8, 8, 8], src=['core']),
    Metre('tristubh', 'Triṣṭubh (Vedic)', 'त्रिष्टुभ्', 'vedic', targets=[11, 11, 11, 11], src=['core']),
    Metre('jagati-vedic', 'Jagatī (Vedic)', 'जगती', 'vedic', targets=[12, 12, 12, 12], src=['core']),
]


@lru_cache(maxsize=1)
def load_metres() -> List[Metre]:
    path = os.path.join(DATA_DIR, 'metres.json')
    with open(path, encoding='utf-8') as fh:
        data = json.load(fh)
    out = list(SPECIAL)
    for m in data['metres']:
        out.append(Metre(m['id'], m['iast'], m['dev'], m['kind'], m['pats'], m.get('yati'), None,
                         m.get('aliases', []), m.get('src', []), m.get('laksana')))
    return out


def lev(a: str, b: str) -> int:
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


@dataclass
class Pada:
    syls: List[Syl]
    exp: int
    strong: bool = False
    pat: Optional[str] = None
    mis: List[int] = field(default_factory=list)
    len_ok: bool = True
    score: float = 0.0
    notes: List[str] = field(default_factory=list)

    @property
    def pattern(self) -> str:
        return ''.join(s.weight for s in self.syls)

    @property
    def matra(self) -> int:
        return sum(s.matra for s in self.syls)


def arrange(segs: Sequence[Segment], lens: Sequence[int], by_matra: bool = False) -> List[Pada]:
    """Cut lines into pādas, allowing one line to hold 1, 2 or 4 pādas."""
    res: List[Pada] = []
    j = 0
    for seg in segs:
        total = seg.matra if by_matra else len(seg.syls)
        best = None
        for k in (1, 2, 4):
            parts = [lens[(j + q) % len(lens)] for q in range(k)]
            d = abs(total - sum(parts))
            if best is None or d < best[0]:
                best = (d, k, parts)
        _, k, parts = best
        pos = 0
        for q in range(k):
            last = q == k - 1
            if last:
                end = len(seg.syls)
            elif by_matra:
                acc, end = 0, pos
                while end < len(seg.syls) and acc < parts[q]:
                    acc += seg.syls[end].matra
                    end += 1
            else:
                end = min(len(seg.syls), pos + parts[q])
            sy = seg.syls[pos:end]
            if sy:
                res.append(Pada(sy, (j + q) % len(lens), strong=last and seg.strong))
            pos = end
        j += k
    return res


def compare(act: str, pat: str):
    if len(act) == len(pat):
        mis = [i for i in range(len(act) - 1) if act[i] != pat[i]]
        return len(mis), mis, True
    return lev(act, pat) + 0.5, [], False


VIPULA = {'LLL': 'na-vipulā', 'GLL': 'bha-vipulā', 'GGG': 'ma-vipulā', 'GLG': 'ra-vipulā'}


def score_anustubh(p: Pada) -> None:
    w = p.pattern
    if len(w) != 8:
        p.score, p.len_ok = abs(len(w) - 8) * 1.5 + 1, False
        p.notes.append(f'{len(w)} akṣaras (expected 8)')
        return
    s = 0
    if w[1] == 'L' and w[2] == 'L':
        s += 1; p.mis += [1, 2]; p.notes.append('2nd and 3rd akṣaras are both laghu')
    if p.exp % 2 == 1:
        for i, want, msg in ((4, 'L', '5th should be laghu'), (5, 'G', '6th should be guru'), (6, 'L', '7th should be laghu in an even pāda')):
            if w[i] != want:
                s += 1; p.mis.append(i); p.notes.append(msg)
        if not p.notes:
            p.notes.append('pathyā')
    else:
        k = w[4:7]
        if k == 'LGG':
            p.notes.append('pathyā')
        elif k in VIPULA:
            p.notes.append(VIPULA[k])
        else:
            for i, want in ((4, 'L'), (5, 'G'), (6, 'G')):
                if w[i] != want:
                    s += 1; p.mis.append(i)
            p.notes.append('5th–7th should be laghu–guru–guru')
    p.score = s
    p.pat = None


@dataclass
class Match:
    metre: Metre
    score: float
    padas: List[Pada]

    @property
    def exact(self) -> bool:
        return self.score < 0.3


def score_metre(m: Metre, segs: Sequence[Segment]) -> Match:
    if m.kind == 'jati':
        padas = arrange(segs, m.targets, by_matra=True)
        s = 0.0
        for p in padas:
            t = m.targets[p.exp]
            d = abs(t - p.matra)
            if t - p.matra == 1 and p.syls and not p.syls[-1].g:
                d = 0
            p.score, p.len_ok = d, d == 0
            p.notes.append(f'{p.matra} mātrās (expected {t})')
            s += d
        if sum(len(x.syls) for x in segs) < 16:
            s += 6
        return Match(m, s + 0.25, padas)
    if m.kind == 'vedic':
        padas = arrange(segs, m.targets)
        s = 1.0
        for p in padas:
            t = m.targets[p.exp % len(m.targets)]
            d = abs(len(p.syls) - t)
            p.score, p.len_ok = (0.5 if d == 1 else d), d <= 1
            p.notes.append(f'{len(p.syls)} akṣaras (Vedic {t}' + (', nicṛt / bhurik' if d == 1 else '') + ')')
            s += p.score
        if len(padas) != len(m.targets):
            s += 2 * abs(len(padas) - len(m.targets))
        return Match(m, s, padas)
    padas = arrange(segs, m.lens)
    s = 0.0
    used = set()
    for p in padas:
        if m.kind == 'anus':
            score_anustubh(p)
            s += p.score
            continue
        if m.kind == 'ardha':
            opts = [m.pats[p.exp % 2]]
        elif m.kind == 'visama':
            opts = [m.pats[p.exp % len(m.pats)]]
        else:
            opts = m.pats
        best = None
        for i, pat in enumerate(opts):
            r = compare(p.pattern, pat)
            if best is None or r[0] < best[0][0]:
                best = (r, i, pat)
        (sc, mis, ok), bi, pat = best
        used.add(bi)
        p.pat, p.mis, p.len_ok, p.score = pat, mis, ok, sc
        s += sc
    if m.kind == 'upajati' and len(used) < 2:
        s += 0.5
    return Match(m, s, padas)


def _plausible(m: Metre, total: int, seg_lens: List[int]) -> bool:
    if m.kind in ('jati', 'anus', 'upajati', 'vedic'):
        return True
    n = sum(m.lens) / 4
    return any(abs(L - n * k) <= max(2, n * k * 0.15) for L in seg_lens for k in (1, 2, 4))


def identify(text_or_segs, top: int = 5) -> List[Match]:
    segs = parse_verse(text_or_segs) if isinstance(text_or_segs, str) else list(text_or_segs)
    if not segs:
        return []
    total = sum(len(s.syls) for s in segs)
    seg_lens = [len(s.syls) for s in segs]
    out = [score_metre(m, segs) for m in load_metres() if _plausible(m, total, seg_lens)]
    out.sort(key=lambda r: (r.score, 0 if r.metre.src and r.metre.src[0] in ('core', 'std') else 1))
    return out[:top]


# ---------------------------------------------------------------- diagnosis
@dataclass
class Hypothesis:
    pada: int
    position: Optional[int]
    category: str        # sandhi | kavisamaya | arsa | textual | licence
    text: str


def diagnose(match: Match) -> List[Hypothesis]:
    """Explain each deviation of a verse from its closest metre with plausible causes."""
    hyps: List[Hypothesis] = []
    for pi, p in enumerate(match.padas):
        sy = p.syls
        if p.pat and p.len_ok:
            for i in p.mis:
                hyps += _explain_position(pi, sy, i, p.pat[i])
        elif match.metre.kind == 'anus' and p.len_ok:
            for i in sorted(set(p.mis)):
                want = 'L' if i in (4,) or (i == 6 and p.exp % 2 == 1) else 'G'
                if i in (1, 2):
                    want = 'G'
                if sy[i].weight != want:
                    hyps += _explain_position(pi, sy, i, want)
        elif not p.len_ok:
            hyps += _explain_length(pi, p, match.metre)
    return hyps


def _explain_position(pi: int, sy: List[Syl], i: int, want: str) -> List[Hypothesis]:
    s = sy[i]
    out: List[Hypothesis] = []
    nxt = sy[i + 1] if i + 1 < len(sy) else None
    ak = s.dev()
    if s.g and want == 'L':
        if s.m:
            out.append(Hypothesis(pi, i, 'textual', f'“{ak}” is guru only because of the anusvāra; an extra anusvāra (ं) is a common scribal or OCR error.'))
        if s.h:
            out.append(Hypothesis(pi, i, 'sandhi', f'“{ak}” is guru because of the visarga; check the visarga-sandhi before the next word.'))
        if s.v in ('ī', 'ū', 'ṝ'):
            out.append(Hypothesis(pi, i, 'textual', f'Long vowel in “{ak}”; the short vowel would give the expected laghu (vowel-length slip in copying or OCR).'))
        if s.v in ('e', 'o', 'ai', 'au'):
            out.append(Hypothesis(pi, i, 'licence', f'“{ak}” contains {s.v}, which is always long; the reading itself has to differ here.'))
        if s.v not in ('ā', 'ī', 'ū', 'ṝ', 'ḹ', 'e', 'ai', 'o', 'au') and not s.m and not s.h and s.after >= 2 and nxt is not None:
            cl = ''.join(s.coda + nxt.on)
            if s.wb:
                if nxt.on[:2] in (['p', 'r'], ['h', 'r'], ['b', 'r'], ['k', 'r']) and not s.coda:
                    out.append(Hypothesis(pi, i, 'kavisamaya', f'The next word begins with “{cl}”: by kavisamaya a short vowel before pr / hr / br / kr may stay laghu.'))
                elif s.coda:
                    out.append(Hypothesis(pi, i, 'sandhi', f"This word's final consonant meets the next word (“{cl}”) and makes “{ak}” guru by position; check the word division or sandhi choice."))
                else:
                    out.append(Hypothesis(pi, i, 'sandhi', f'The next word starts with the conjunct “{cl}”, which makes the short “{ak}” guru by position.'))
            else:
                out.append(Hypothesis(pi, i, 'textual', f'The conjunct “{cl}” after “{ak}” makes it guru; a misplaced halant (्) in the source or OCR would cause this.'))
    elif not s.g and want == 'G':
        if s.v in ('a', 'i', 'u', 'ṛ'):
            out.append(Hypothesis(pi, i, 'textual', f'Short vowel in “{ak}”; the source may have the long vowel (vowel-length slip).'))
        out.append(Hypothesis(pi, i, 'textual', f'“{ak}” is laghu; a lost anusvāra / visarga or a lost conjunct after it would make it guru.'))
        if s.wb and nxt is not None and len(nxt.on) == 1:
            out.append(Hypothesis(pi, i, 'sandhi', f'Word boundary after “{ak}”: a different sandhi (for example a retained final consonant) would close the syllable.'))
    return out


def _explain_length(pi: int, p: Pada, m: Metre) -> List[Hypothesis]:
    out: List[Hypothesis] = []
    sy = p.syls
    want = m.lens[p.exp % len(m.lens)] if m.kind not in ('jati', 'vedic') else None
    if want is None:
        out.append(Hypothesis(pi, None, 'textual', ' '.join(p.notes)))
        return out
    diff = len(sy) - want
    if diff > 0:
        for k in range(len(sy) - 1):
            if sy[k].wb and not sy[k].coda and not sy[k + 1].on:
                out.append(Hypothesis(pi, k + 1, 'arsa', f'Vowel hiatus between “{sy[k].dev()}” and “{sy[k + 1].dev()}”: applying vowel sandhi would remove one akṣara; keeping the hiatus is an ārṣa usage.'))
        out.append(Hypothesis(pi, None, 'textual', f'{diff} extra akṣara(s): a particle (ca, hi, tu, eva) may have been added, or a line break is misplaced.'))
    else:
        for k, s in enumerate(sy):
            if s.avag:
                out.append(Hypothesis(pi, k, 'arsa', f'Avagraha after “{s.dev()}”: reading the elided a (ārṣa / chāndasa) adds one akṣara.'))
        out.append(Hypothesis(pi, None, 'textual', f'{-diff} akṣara(s) missing: a word or particle may have been dropped (scribal omission), or a line break is misplaced.'))
    return out
