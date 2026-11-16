"""Tokenisation, transliteration and syllabification (akṣara-vibhāga) for Sanskrit verse.

Weights follow the classical rules (Piṅgala, Vṛttaratnākara 1):
  * a long vowel (ā ī ū ṝ ḹ e ai o au) is guru;
  * a vowel followed by anusvāra or visarga is guru;
  * a short vowel followed by a conjunct (two or more consonants, across word
    boundaries inside a pāda) is guru;
  * a short vowel closed by a pāda-final consonant is guru;
  * otherwise laghu.
The pāda-final akṣara is treated as optionally guru (pādānta) by the matcher,
not here.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from typing import List

C2D = {'k': 'क', 'kh': 'ख', 'g': 'ग', 'gh': 'घ', 'ṅ': 'ङ', 'c': 'च', 'ch': 'छ', 'j': 'ज', 'jh': 'झ', 'ñ': 'ञ',
       'ṭ': 'ट', 'ṭh': 'ठ', 'ḍ': 'ड', 'ḍh': 'ढ', 'ṇ': 'ण', 't': 'त', 'th': 'थ', 'd': 'द', 'dh': 'ध', 'n': 'न',
       'p': 'प', 'ph': 'फ', 'b': 'ब', 'bh': 'भ', 'm': 'म', 'y': 'य', 'r': 'र', 'l': 'ल', 'v': 'व',
       'ś': 'श', 'ṣ': 'ष', 's': 'स', 'h': 'ह', 'ḻ': 'ळ'}
D2C = {v: k for k, v in C2D.items()}
V2D = {'a': 'अ', 'ā': 'आ', 'i': 'इ', 'ī': 'ई', 'u': 'उ', 'ū': 'ऊ', 'ṛ': 'ऋ', 'ṝ': 'ॠ', 'ḷ': 'ऌ', 'ḹ': 'ॡ',
       'e': 'ए', 'ai': 'ऐ', 'o': 'ओ', 'au': 'औ'}
D2V = {v: k for k, v in V2D.items()}
V2M = {'a': '', 'ā': 'ा', 'i': 'ि', 'ī': 'ी', 'u': 'ु', 'ū': 'ू', 'ṛ': 'ृ', 'ṝ': 'ॄ', 'ḷ': 'ॢ', 'ḹ': 'ॣ',
       'e': 'े', 'ai': 'ै', 'o': 'ो', 'au': 'ौ'}
M2V = {v: k for k, v in V2M.items() if k != 'a'}
LONG = {'ā', 'ī', 'ū', 'ṝ', 'ḹ', 'e', 'ai', 'o', 'au'}
IAST_V = {'a', 'ā', 'i', 'ī', 'u', 'ū', 'ṛ', 'ṝ', 'ḷ', 'ḹ', 'e', 'o'}
IAST_C = {'k', 'g', 'ṅ', 'c', 'j', 'ñ', 'ṭ', 'ḍ', 'ṇ', 't', 'd', 'n', 'p', 'b', 'm', 'y', 'r', 'l', 'v',
          'ś', 'ṣ', 's', 'h', 'ḻ'}
SEP = re.compile(r"[\s\-–—,;:.!?\"“”‘()\[\]{}_/\\]")
# Other Brahmic scripts share the Devanagari layout at a fixed offset.
SCRIPT_OFFSETS = {'telugu': 0x0C00 - 0x0900, 'malayalam': 0x0D00 - 0x0900,
                  'gujarati': 0x0A80 - 0x0900, 'bengali': 0x0980 - 0x0900, 'odia': 0x0B00 - 0x0900}


def to_devanagari_block(text: str) -> str:
    """Map Telugu / Malayalam / Gujarati / Bengali / Odia text onto Devanagari code points."""
    out = []
    for ch in text:
        o = ord(ch)
        for off in SCRIPT_OFFSETS.values():
            if 0x0900 + off <= o < 0x0980 + off and o not in (0x0964, 0x0965):
                ch = chr(o - off)
                break
        out.append(ch)
    return ''.join(out)


def is_indic(text: str) -> bool:
    return bool(re.search(r'[ऀ-෿]', text))


@dataclass
class Tok:
    t: str            # C consonant, V vowel, M anusvāra, H visarga, N candrabindu, W word break, P pāda break, A avagraha
    v: str = ''
    strong: bool = False


def tokenize_devanagari(s: str) -> List[Tok]:
    a = list(unicodedata.normalize('NFC', to_devanagari_block(s)))
    out: List[Tok] = []
    i = 0
    while i < len(a):
        ch = a[i]
        if ch in D2C:
            out.append(Tok('C', D2C[ch]))
            j = i + 1
            if j < len(a) and a[j] == '़':
                j += 1
            nx = a[j] if j < len(a) else ''
            if nx == '्':
                i = j
            elif nx in M2V:
                out.append(Tok('V', M2V[nx]))
                i = j
            else:
                out.append(Tok('V', 'a'))
                i = j - 1
        elif ch in D2V:
            out.append(Tok('V', D2V[ch]))
        elif ch == 'ं':
            out.append(Tok('M'))
        elif ch == 'ः':
            out.append(Tok('H'))
        elif ch == 'ँ':
            out.append(Tok('N'))
        elif ch == 'ॐ':
            out += [Tok('V', 'o'), Tok('M')]
        elif ch == 'ऽ':
            out.append(Tok('A'))
        elif ch == '॥':
            out.append(Tok('P', strong=True))
        elif ch in '।|':
            if i + 1 < len(a) and a[i + 1] == ch:
                i += 1
                out.append(Tok('P', strong=True))
            else:
                out.append(Tok('P'))
        elif ch == '\n':
            out.append(Tok('P'))
        elif SEP.match(ch):
            out.append(Tok('W'))
        i += 1
    return out


def tokenize_iast(s: str) -> List[Tok]:
    s = unicodedata.normalize('NFC', s).lower().replace('ṁ', 'ṃ').replace('m̐', 'ṃ').replace('ṙ', 'r')
    a = list(s)
    out: List[Tok] = []
    i = 0
    while i < len(a):
        c = a[i]
        n = a[i + 1] if i + 1 < len(a) else ''
        if c == 'a' and n in ('i', 'u'):
            out.append(Tok('V', 'a' + n)); i += 2; continue
        if c in IAST_V:
            out.append(Tok('V', c))
        elif c in 'kgcjṭḍtdpb' and n == 'h':
            out.append(Tok('C', c + 'h')); i += 2; continue
        elif c in IAST_C:
            out.append(Tok('C', c))
        elif c == 'ṃ':
            out.append(Tok('M'))
        elif c == 'ḥ':
            out.append(Tok('H'))
        elif c in '|।॥':
            if n == c or c == '॥':
                if n == c:
                    i += 1
                out.append(Tok('P', strong=True))
            else:
                out.append(Tok('P'))
        elif c == '\n':
            out.append(Tok('P'))
        elif c in "'’ऽ":
            out.append(Tok('A'))
        elif SEP.match(c):
            out.append(Tok('W'))
        i += 1
    return out


def tokenize(text: str) -> List[Tok]:
    return tokenize_devanagari(text) if is_indic(text) else tokenize_iast(text)


@dataclass
class Syl:
    on: List[str]
    v: str
    coda: List[str] = field(default_factory=list)
    m: bool = False
    h: bool = False
    n: bool = False
    after: int = 0      # consonants between this vowel and the next one
    wb: bool = False    # word boundary after this akṣara
    final: bool = False
    avag: bool = False  # an avagraha (elided a) follows
    g: bool = False

    @property
    def weight(self) -> str:
        return 'G' if self.g else 'L'

    @property
    def matra(self) -> int:
        return 2 if self.g else 1

    def dev(self, coda: bool = True) -> str:
        out = ''
        if self.on:
            out += '्'.join(C2D[c] for c in self.on) + V2M.get(self.v, '')
        else:
            out += V2D.get(self.v, '')
        out += ('ँ' if self.n else '') + ('ं' if self.m else '') + ('ः' if self.h else '')
        if coda:
            out += ''.join(C2D[c] + '्' for c in self.coda)
        return out

    def iast(self, coda: bool = True) -> str:
        out = ''.join(self.on) + self.v + ('m̐' if self.n else '') + ('ṃ' if self.m else '') + ('ḥ' if self.h else '')
        return out + (''.join(self.coda) if coda else '')


def syllabify(toks: List[Tok]) -> List[Syl]:
    syls: List[Syl] = []
    cl: List[Tok] = []
    for t in toks:
        if t.t == 'V':
            last_w = max([k for k, x in enumerate(cl) if x.t == 'W'], default=-1)
            cc = sum(1 for x in cl if x.t == 'C')
            if syls:
                p = syls[-1]
                p.after, p.wb = cc, last_w >= 0
                p.coda = [x.v for x in cl[:max(last_w, 0)] if x.t == 'C']
                onset = [x.v for x in cl[last_w + 1:] if x.t == 'C']
            else:
                onset = [x.v for x in cl if x.t == 'C']
            syls.append(Syl(onset, t.v))
            cl = []
        elif t.t in ('C', 'W'):
            if t.t == 'W' and cl and cl[-1].t == 'W':
                continue
            cl.append(t)
        elif t.t in ('M', 'H', 'N') and syls and not any(x.t == 'C' for x in cl):
            setattr(syls[-1], {'M': 'm', 'H': 'h', 'N': 'n'}[t.t], True)
        elif t.t == 'A' and syls:
            syls[-1].avag = True
    if syls:
        cc = [x.v for x in cl if x.t == 'C']
        syls[-1].coda, syls[-1].after, syls[-1].wb, syls[-1].final = cc, len(cc), True, True
    for s in syls:
        s.g = s.v in LONG or s.m or s.h or s.after >= 2 or (s.final and s.after >= 1)
    return syls


@dataclass
class Segment:
    syls: List[Syl]
    strong: bool = False

    @property
    def pattern(self) -> str:
        return ''.join(s.weight for s in self.syls)

    @property
    def matra(self) -> int:
        return sum(s.matra for s in self.syls)


def parse_verse(text: str) -> List[Segment]:
    """Split a verse into lines/half-verses at । ॥ | or new lines and syllabify each."""
    segs: List[Segment] = []
    cur: List[Tok] = []

    def flush(strong: bool) -> None:
        nonlocal cur
        syls = syllabify(cur)
        if syls:
            segs.append(Segment(syls, strong))
        elif strong and segs:
            segs[-1].strong = True
        cur = []

    for t in tokenize(text):
        if t.t == 'P':
            flush(t.strong)
        else:
            cur.append(t)
    flush(True)
    if segs:
        segs[-1].strong = True
    return segs


def scan(text: str) -> List[str]:
    """Return the laghu/guru pattern of each line, e.g. ['GGGLLGLGLLLGGGLGGLG', ...]."""
    return [s.pattern for s in parse_verse(text)]


def iast_to_devanagari(text: str) -> str:
    """Transliterate IAST to Devanagari (word by word, keeping spaces)."""
    def conv(m: 're.Match[str]') -> str:
        syls = syllabify([t for t in tokenize_iast(m.group(0)) if t.t not in ('W', 'P')])
        return ''.join(s.dev() for s in syls)
    text = unicodedata.normalize('NFC', text).lower().replace('-', '').replace('–', '').replace('—', '')
    return re.sub(r"[a-zāīūṛṝḷḹṅñṭḍṇśṣṃṁḥḻ]+", conv, text)
