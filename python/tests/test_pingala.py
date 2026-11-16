"""Tests for the Python package. The same expectations are checked for the JavaScript engine in tests/test_engine.js."""
import json
import os

from pingala_shodhana import diagnose, identify, read_laksana, scan
from pingala_shodhana.metres import formula_to_pattern
from pingala_shodhana.sahayaka import natva, suggest, synonyms

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
VERSES = json.load(open(os.path.join(ROOT, 'tests', 'verses.json'), encoding='utf-8'))
CORE = json.load(open(os.path.join(ROOT, 'tools', 'core_laksanas.json'), encoding='utf-8'))['metres']


def test_scan_weights():
    assert scan('या कुन्देन्दुतुषारहारधवला या शुभ्रवस्त्रावृता') == ['GGGLLGLGLLLGGGLGGLG']
    assert scan("karmaṇy evādhikāras te mā phaleṣu kadācana") == ['GGGGLGGGGLGLLGLL']


def test_identify_samples():
    for v in VERSES:
        best = identify(v['text'], top=1)[0]
        assert best.metre.id == v['metre'], (v['label'], best.metre.id)
        assert round(best.score) == v['deviations'], v['label']


def test_diagnosis_finds_vowel_length():
    v = next(x for x in VERSES if x['label'].startswith('Śārdūla with errors'))
    cats = [h.category for h in diagnose(identify(v['text'], top=1)[0])]
    assert 'textual' in cats


def test_laksanas_scan_in_their_own_metre():
    for m in CORE:
        pat = formula_to_pattern(m['f']) if 'f' in m else formula_to_pattern(m['ardha'][0])
        r = read_laksana(m['laksana'], m['dev'])
        assert r.scanned[0][:-1] == pat[:-1], m['iast']


def test_laksana_reader_accuracy():
    ok = sum(read_laksana(m['laksana'], m['dev']).decoded == (m.get('f') or ''.join(m['ardha'])) for m in CORE)
    assert ok >= 38
    r = read_laksana('मन्दाक्रान्ता जलधिषडगैर्म्भौ नतौ ताद्गुरू चेत्', 'मन्दाक्रान्ता')
    assert r.decoded == 'mbnttgg' and r.yati == [4, 6, 7] and r.agree and r.yati_ok


def test_natva_and_synonyms():
    assert natva('अमरेन') == 'अमरेण'
    assert any(form == 'भास्करः' for form, _ in synonyms('सूर्यः'))


def test_repair_finds_fit():
    target, base, sug = suggest('धर्मज्ञश्च कृतज्ञश्च सत्यवाक्यो दृढव्रतः\nरामो राजा सदा देवो वनं गच्छति सूर्यः')
    assert target.id == 'anustubh' and base > 0
    assert sug and sug[0].score == 0
