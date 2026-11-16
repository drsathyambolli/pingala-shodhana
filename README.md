# Piṅgala-Śodhana · पिङ्गल-शोधनम्

**A sandhi-aware computational framework for detecting and explaining metrical anomalies in Sanskrit verse.**
One app with five tools: scansion and metre identification, diagnosis of *why* a verse deviates, chanting in time with the scansion, **Chando-Sahāyaka** (metre repair for composers) and **Lakṣaṇa-Yantra** (building metre entries from lakṣaṇa verses).

**Live app:** https://drsathyambolli.github.io/pingala-shodhana/ (runs fully in the browser, no server)

Dr Sathyam Bolli · Team PINGALA (पिङ्गल) · PGDSCL, Karnataka Samskrit University & Central Sanskrit University, 2026–27.

---

## Tools

| Tool | What you get |
|---|---|
| **Śodhana** (scan & diagnose) | Akṣara-wise laghu/guru scansion of verse in Devanagari, IAST or Telugu; gaṇa grouping; mātrā counts; metre identification with fuzzy matching among 172 metres: samavṛtta from 1 to 26 akṣaras, eight daṇḍakas (27 to 48 akṣaras), ardhasama, viṣama, anuṣṭubh, upajāti, the mātrā metres (āryā family, vaitālīya, mātrāsamaka) and the Vedic metres of Piṅgala's Chandaḥsūtra (gāyatrī, uṣṇih, bṛhatī, virāj, paṅkti, triṣṭubh, jagatī, with nicṛt / bhurik); yati checked against real word breaks; anuṣṭubh rules with vipulā variants. Every deviation gets a categorised hypothesis (**sandhi**, **kavisamaya**, **ārṣa**, **scribal / OCR**) without changing the text. |
| **Chant** | Recites the verse akṣara by akṣara with the device's Hindi / Sanskrit voice, guru held longer than laghu, over a tanpura drone; or a rhythm hum. Adjustable tempo and Sa; the current akṣara lights up. |
| **Pāṭha** (real recordings) | Record a chant (yours or a teacher's) or load an audio file. The recording is lined up with the scansion automatically (pāda breaths anchored on silences, akṣara onsets placed by mātrā and snapped to consonant dips), then plays with each akṣara lighting up, at 0.5× / 0.75× without changing pitch. *Tap to sync* corrects the timing by hand; *Recite along* follows your own voice from the microphone; timings export as JSON. |
| **Chando-Sahāyaka** (repair) | For composers: proposes edits that make a draft fit a metre while keeping its meaning: kośa synonyms of the same liṅga and case ending (with ṇatva), pāda-pūraṇa particles (च हि तु एव अपि वै खलु) and free word order. Every candidate is rescanned and ranked. |
| **Lakṣaṇa-Yantra** | Reads a lakṣaṇa such as *मन्दाक्रान्ता जलधिषडगैर्म्भौ नतौ ताद्गुरू चेत्*: decodes the gaṇa words (म्भौ नतौ ताद्गुरू → म भ न त त ग ग) and the bhūta-saṅkhyā yati (जलधि-षड्-अगैः → 4 + 6 + 7), scans the verse itself, and accepts the metre only when definition and verse agree (*lakṣya = lakṣaṇa*). |
| **Chandaḥ-kośa** | Browse and search all metres by name, gaṇa formula, L/G pattern, akṣara count, class (gāyatrī … utkṛti) and type; chant any pattern; add your own metres from Lakṣaṇa-Yantra. |

## Evaluation

| Measure | Result |
|---|---|
| Core lakṣaṇas that scan in their own metre | **39 / 39** |
| Gaṇa formula read correctly from the words | **38 / 39** (Pañcacāmara is defined by reference to Pramāṇikā, so there are no gaṇa words to read) |
| Yati read correctly, among lakṣaṇas that state it | **14 / 14** |
| Python and JavaScript engines | identical results on the shared test verses (`tests/`) |
| Recording alignment (synthetic chant, 76 akṣaras) | mean onset error 19 ms; 70 / 76 within 120 ms |

## Quick start

**Web app:** open `index.html` (works from disk too) or the live link above.

**Python** (3.8+, no dependencies):

```bash
pip install -e python
pingala identify "या कुन्देन्दुतुषारहारधवला या शुभ्रवस्त्रवृता\nया वीणावरदण्डमण्डितकरा या श्वेतपद्मासना"
pingala laksana "मन्दाक्रान्ता जलधिषडगैर्म्भौ नतौ ताद्गुरू चेत्" --name मन्दाक्रान्ता
pingala repair  "धर्मज्ञश्च कृतज्ञश्च सत्यवाक्यो दृढव्रतः\nरामो राजा सदा देवो वनं गच्छति सूर्यः"
pingala synonyms सूर्यः
```

```python
from pingala_shodhana import identify, diagnose, read_laksana
best = identify(verse)[0]
print(best.metre.iast, best.score)
for h in diagnose(best):
    print(h.category, h.text)
```

**Tests:** `cd python && pytest -q tests` and `node tests/test_engine.js`.
**Rebuild data:** `python tools/build_data.py`

## How it works

```
verse (Devanagari / IAST / Telugu)
  → tokenise & syllabify in saṃhitā (weights counted across word boundaries)
  → laghu / guru by the classical rules; pāda-final akṣara free
  → for each candidate metre: cut lines into pādas (a line may hold 1, 2 or 4) and compare
      sama / ardhasama / viṣama: syllable by syllable (edit distance when lengths differ)
      anuṣṭubh: 5th–7th-syllable rules + vipulās;  āryā family: mātrā counts
  → closest metre + diagnosis of each deviation
      sandhi · kavisamaya (pr/hr/br before a short vowel) · ārṣa (hiatus, avagraha) · scribal / OCR (vowel length, anusvāra, halant)
  → yati verified against word breaks in the verse
```

Sandhi is never undone before scanning: metre lives in the joined text, so splitting first would change the weights. Word boundaries are used where they matter: to check yati and to explain deviations.

### Repository layout

```
index.html, app/css, app/js     web app (engine.js, laksana.js, sahayaka.js, chant.js, patha.js, app.js)
data/                           metres.json, kosha.json (+ .js wrappers), built by tools/build_data.py
python/pingala_shodhana/        Python package: scan, metres (identify, diagnose), laksana, sahayaka, cli
tools/core_laksanas.json        39 core metres with their lakṣaṇa verses (each verified at build time)
tools/metres_std.json           standard metres of the classical chandas texts, from their gaṇa definitions
tools/kosha_std.json            synonym sets for Chando-Sahāyaka
tests/                          shared test verses and Node tests (Python tests in python/tests)
```

## Limitations

- Recitation uses the speech voices installed on the device (for example “Google हिन्दी” in Chrome); without one, the app falls back to the rhythm hum.
- Chando-Sahāyaka handles a-stem and ā-stem nouns from its kośa; other stems, verbs and compounds are left alone. Re-check sandhi at changed joints.
- Lakṣaṇa-Yantra is rule-based; definitions by reference to another metre are not decoded.
- Vedic metres are identified by akṣara count only; svara (accent) is not modelled.

## Licence

MIT (see `LICENSE`).
