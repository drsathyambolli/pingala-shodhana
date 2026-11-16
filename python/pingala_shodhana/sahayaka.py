"""Chando-Sahāyaka: a metre-repair assistant for composers.

Given a verse that does not quite fit a metre, propose small edits that make
it fit while keeping the meaning:
  * paryāya — replace a noun with a kośa synonym of the same liṅga and
    stem class, keeping the case ending (देवेन → सुरेण, with ṇatva);
  * pāda-pūraṇa — add or drop a filler particle (च, हि, तु, एव, अपि, वै, खलु);
  * krama — reorder the words of a line (Sanskrit word order is free).
Every candidate is rescanned and scored against the target metre; only edits
that reduce the deviations are returned. Re-check sandhi at changed joints.
"""
from __future__ import annotations

import itertools
import json
import os
import re
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Dict, List, Optional, Tuple

from .metres import DATA_DIR, Metre, identify, load_metres, score_metre
from .scan import parse_verse

A_END = ['ः', 'ौ', 'ाः', 'म्', 'ं', 'ान्', 'ेन', 'ेण', 'ाभ्याम्', 'ैः', 'ाय', 'ेभ्यः', 'ात्', 'ाद्', 'स्य', 'योः', 'ानाम्', 'ाणाम्',
         'े', 'ेषु', 'ानि', 'ाणि', 'ाः']
AA_END = ['ा', 'े', 'ाः', 'ाम्', 'ां', 'या', 'ाभ्याम्', 'ाभिः', 'ायै', 'ाभ्यः', 'ायाः', 'योः', 'ानाम्', 'ाणाम्', 'ायाम्', 'ासु']
PARTICLES = ['च', 'हि', 'तु', 'एव', 'अपि', 'वै', 'खलु']
BLOCK = set('चछजझञटठडढणतथदधनशसल')
VIRAMA, MATRAS = '्', set('ािीुूृॄॢॣेैोौंःँ')


def _stem_class(stem: str) -> Optional[str]:
    if not stem:
        return None
    last = stem[-1]
    if last == 'ा':
        return 'aa'
    if last in MATRAS or last == VIRAMA:
        return None
    if 'क' <= last <= 'ह':
        return 'a'
    return None


@lru_cache(maxsize=1)
def _kosha() -> Tuple[Dict[str, List[int]], List[List[Tuple[str, str]]], List[str]]:
    path = os.path.join(DATA_DIR, 'kosha.json')
    if not os.path.exists(path):
        return {}, [], []
    data = json.load(open(path, encoding='utf-8'))['sets']
    index: Dict[str, List[int]] = {}
    sets, arthas = [], []
    for i, (artha, _verse, words) in enumerate(data):
        sets.append([(w, g) for w, g in words])
        arthas.append(artha)
        for w, _g in words:
            index.setdefault(w, []).append(i)
    return index, sets, arthas


def natva(form: str) -> str:
    """Apply ṇatva (रषाभ्यां नो णः समानपदे, 8.4.1–2) to an ending's न in a simple way."""
    m = None
    for i, ch in enumerate(form):
        if ch in 'रष' or ch in 'ृॄ':
            m = i
    if m is None:
        return form
    out = list(form)
    for i in range(m + 1, len(out)):
        if out[i] == 'न' and (i + 1 == len(out) or out[i + 1] != VIRAMA):
            if not any(c in BLOCK for c in out[m + 1:i]):
                out[i] = 'ण'
            break
        if out[i] in BLOCK:
            break
    return ''.join(out)


def analyse_word(word: str) -> List[Tuple[str, str, str]]:
    """Return possible (stem, ending, class) readings found in the kośa."""
    index, _, _ = _kosha()
    out = []
    for end in sorted(set(A_END), key=lambda e: (-len(e), e)):
        if word.endswith(end) and len(word) > len(end):
            stem = word[:-len(end)]
            for cand in {stem, stem.replace('ण', 'न')}:
                if cand in index and _stem_class(cand) == 'a':
                    out.append((cand, end, 'a'))
    for end in sorted(set(AA_END), key=lambda e: (-len(e), e)):
        if word.endswith(end) and len(word) > len(end):
            stem = word[:-len(end)] + 'ा'
            if stem in index and _stem_class(stem) == 'aa':
                out.append((stem, end, 'aa'))
    if word in index and _stem_class(word) == 'aa':
        out.append((word, '', 'aa'))
    return out


def synonyms(word: str, limit: int = 30) -> List[Tuple[str, str]]:
    """Inflected synonyms of a word: [(new_form, artha)]."""
    index, sets, arthas = _kosha()
    res, seen = [], {word}
    for stem, end, cls in analyse_word(word):
        for si in index.get(stem, []):
            g0 = dict(sets[si]).get(stem)
            for w, g in sets[si]:
                if w == stem or g != g0 or _stem_class(w) != cls or len(w) < 2:
                    continue
                form = (w + end) if cls == 'a' else (w[:-1] + end if end else w)
                form = natva(form.replace('ेण', 'ेन').replace('ाणाम्', 'ानाम्').replace('ाणि', 'ानि')) if cls == 'a' else natva(form.replace('ाणाम्', 'ानाम्'))
                if form not in seen:
                    seen.add(form)
                    res.append((form, arthas[si]))
                if len(res) >= limit:
                    return res
    return res


@dataclass
class Suggestion:
    text: str
    score: float
    changes: List[str]
    kind: str
    pattern: List[str] = field(default_factory=list)


def _lines(text: str) -> List[List[str]]:
    return [ln.split() for ln in re.split(r'\n', text.strip())]


def _join(lines: List[List[str]]) -> str:
    return '\n'.join(' '.join(w) for w in lines)


def suggest(text: str, metre: Optional[str] = None, max_results: int = 10, allow_reorder: bool = True) -> Tuple[Optional[Metre], float, List[Suggestion]]:
    """Propose edits that bring `text` closer to `metre` (id or name; default: the closest metre)."""
    segs = parse_verse(text)
    if not segs:
        return None, 0.0, []
    if metre:
        target = next((m for m in load_metres() if m.id == metre or m.iast.lower() == metre.lower() or m.dev == metre), None)
        if target is None:
            raise ValueError(f'Unknown metre: {metre}')
    else:
        target = identify(segs, top=1)[0].metre
    base = score_metre(target, segs).score

    def score(t: str) -> float:
        s = parse_verse(t)
        return score_metre(target, s).score if s else 99.0

    lines = _lines(text)
    cands: Dict[str, Suggestion] = {}

    def consider(new_lines: List[List[str]], change: str, kind: str, extra: Optional[Suggestion] = None) -> None:
        t = _join(new_lines)
        if t in cands or t == _join(lines):
            return
        sc = score(t)
        changes = (extra.changes if extra else []) + [change]
        if sc < (extra.score if extra else base):
            cands[t] = Suggestion(t, sc, changes, kind if not extra else extra.kind + '+' + kind)

    # 1. synonyms
    for li, ln in enumerate(lines):
        for wi, w in enumerate(ln):
            core = w.rstrip('।॥|')
            tail = w[len(core):]
            for form, artha in synonyms(core):
                nl = [list(x) for x in lines]
                nl[li][wi] = form + tail
                consider(nl, f'{core} → {form} (paryāya: “{artha}”)', 'synonym')
    # 2. particles: add or drop
    for li, ln in enumerate(lines):
        for wi, w in enumerate(ln):
            if w.rstrip('।॥|') in PARTICLES:
                nl = [list(x) for x in lines]
                del nl[li][wi]
                if wi == len(ln) - 1 and nl[li]:
                    nl[li][-1] += w[len(w.rstrip('।॥|')):]
                consider(nl, f'drop {w.rstrip("।॥|")}', 'particle')
        for pos in range(1, len(ln) + 1):
            for p in PARTICLES:
                nl = [list(x) for x in lines]
                if pos == len(ln):
                    last = nl[li][-1]
                    core = last.rstrip('।॥|')
                    nl[li][-1] = core
                    nl[li].append(p + last[len(core):])
                else:
                    nl[li].insert(pos, p)
                consider(nl, f'add {p} after “{ln[pos - 1].rstrip("।॥|")}”', 'particle')
    # 3. word order inside a line
    if allow_reorder:
        for li, ln in enumerate(lines):
            if 2 <= len(ln) <= 6:
                core = [w.rstrip('।॥|') for w in ln]
                tail = ln[-1][len(core[-1]):]
                for perm in itertools.permutations(range(len(ln))):
                    if list(perm) == list(range(len(ln))):
                        continue
                    nl = [list(x) for x in lines]
                    nl[li] = [core[i] for i in perm]
                    nl[li][-1] += tail
                    consider(nl, f'reorder line {li + 1}: {" ".join(nl[li])}', 'order')
    # 4. second step on the best partial candidates
    partial = sorted((c for c in cands.values() if c.score > 0.3), key=lambda c: c.score)[:6]
    for c in partial:
        cl = _lines(c.text)
        orig = _lines(text)
        for li, ln in enumerate(cl):
            for wi, w in enumerate(ln):
                if li < len(orig) and wi < len(orig[li]) and orig[li][wi] != w:
                    continue
                core = w.rstrip('।॥|')
                tail = w[len(core):]
                for form, artha in synonyms(core, limit=15):
                    nl = [list(x) for x in cl]
                    nl[li][wi] = form + tail
                    t = _join(nl)
                    if t in cands:
                        continue
                    sc = score(t)
                    if sc < c.score:
                        cands[t] = Suggestion(t, sc, c.changes + [f'{core} → {form} (paryāya: “{artha}”)'], c.kind + '+synonym')
    out = sorted(cands.values(), key=lambda c: (round(c.score, 2), len(c.changes), c.kind != 'synonym'))
    for s in out:
        s.pattern = [x.pattern for x in parse_verse(s.text)]
    return target, base, out[:max_results]
