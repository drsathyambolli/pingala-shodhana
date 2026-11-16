// Node test for the browser engine: same expectations as python/tests/test_pingala.py.  Run: node tests/test_engine.js
const assert=require('assert'), path=require('path');
const ROOT=path.join(__dirname,'..');
global.PS_METRES=require(path.join(ROOT,'data/metres.json'));
global.PS_KOSHA=require(path.join(ROOT,'data/kosha.json'));
const E=require(path.join(ROOT,'app/js/engine.js')); E.loadMetres(global.PS_METRES);
const L=require(path.join(ROOT,'app/js/laksana.js'));
const S=require(path.join(ROOT,'app/js/sahayaka.js'));
const verses=require('./verses.json'), core=require(path.join(ROOT,'tools/core_laksanas.json')).metres;
let n=0; const t=(name,fn)=>{ fn(); n++; console.log('ok -',name); };
t('scan weights',()=>{ assert.deepStrictEqual(E.parseVerse('या कुन्देन्दुतुषारहारधवला या शुभ्रवस्त्रावृता').map(E.wstr),['GGGLLGLGLLLGGGLGGLG']); });
t('identify samples',()=>{ for(const v of verses){ const b=E.identify(v.text,1)[0]; assert.strictEqual(b.M.id,v.metre,v.label); assert.strictEqual(Math.round(b.score),v.deviations,v.label); } });
t('diagnosis',()=>{ const v=verses.find(x=>x.label.startsWith('Śārdūla with errors')); assert(E.diagnose(E.identify(v.text,1)[0]).some(h=>h.cat==='textual')); });
t('lakṣaṇas scan in their own metre',()=>{ for(const m of core){ const pat=E.formulaToPattern(m.f||m.ardha[0]); const r=L.readLaksana(m.laksana,m.dev); assert.strictEqual(r.scanned[0].slice(0,-1),pat.slice(0,-1),m.iast); } });
t('lakṣaṇa reader accuracy',()=>{ const ok=core.filter(m=>L.readLaksana(m.laksana,m.dev).decoded===(m.f||m.ardha.join(''))).length; assert(ok>=38,ok);
  const r=L.readLaksana('मन्दाक्रान्ता जलधिषडगैर्म्भौ नतौ ताद्गुरू चेत्','मन्दाक्रान्ता'); assert.strictEqual(r.decoded,'mbnttgg'); assert.deepStrictEqual(r.yati,[4,6,7]); assert(r.agree&&r.yatiOk); });
t('ṇatva and synonyms',()=>{ assert.strictEqual(S.natva('अमरेन'),'अमरेण'); assert(S.synonyms('सूर्यः').some(([f])=>f==='भास्करः')); });
t('repair finds a fit',()=>{ const r=S.suggest('धर्मज्ञश्च कृतज्ञश्च सत्यवाक्यो दृढव्रतः\nरामो राजा सदा देवो वनं गच्छति सूर्यः'); assert.strictEqual(r.target.id,'anustubh'); assert(r.suggestions[0].score===0); });
console.log(`\n${n} tests passed`);
