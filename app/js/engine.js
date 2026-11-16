/* Piṅgala-Śodhana — prosodic engine (browser + Node).
   Tokenise → syllabify → identify against the metre database → diagnose deviations.
   Mirrors python/pingala_shodhana/{scan,metres}.py. */
(function (root) {
'use strict';
const C2D = {k:'क',kh:'ख',g:'ग',gh:'घ','ṅ':'ङ',c:'च',ch:'छ',j:'ज',jh:'झ','ñ':'ञ','ṭ':'ट','ṭh':'ठ','ḍ':'ड','ḍh':'ढ','ṇ':'ण',t:'त',th:'थ',d:'द',dh:'ध',n:'न',p:'प',ph:'फ',b:'ब',bh:'भ',m:'म',y:'य',r:'र',l:'ल',v:'व','ś':'श','ṣ':'ष',s:'स',h:'ह','ḻ':'ळ'};
const D2C = Object.fromEntries(Object.entries(C2D).map(([a,b])=>[b,a]));
const V2D = {a:'अ','ā':'आ',i:'इ','ī':'ई',u:'उ','ū':'ऊ','ṛ':'ऋ','ṝ':'ॠ','ḷ':'ऌ','ḹ':'ॡ',e:'ए',ai:'ऐ',o:'ओ',au:'औ'};
const D2V = Object.fromEntries(Object.entries(V2D).map(([a,b])=>[b,a]));
const V2M = {a:'','ā':'ा',i:'ि','ī':'ी',u:'ु','ū':'ू','ṛ':'ृ','ṝ':'ॄ','ḷ':'ॢ','ḹ':'ॣ',e:'े',ai:'ै',o:'ो',au:'ौ'};
const M2V = Object.fromEntries(Object.entries(V2M).filter(([a])=>a!=='a').map(([a,b])=>[b,a]));
const LONG = new Set(['ā','ī','ū','ṝ','ḹ','e','ai','o','au']);
const IV = new Set(['a','ā','i','ī','u','ū','ṛ','ṝ','ḷ','ḹ','e','o']);
const IC = new Set(['k','g','ṅ','c','j','ñ','ṭ','ḍ','ṇ','t','d','n','p','b','m','y','r','l','v','ś','ṣ','s','h','ḻ']);
const SEP = /[\s\-–—,;:.!?"“”‘()\[\]{}_\/\\]/;
const SCRIPTS = {deva:0, telugu:0x0C00-0x0900, malayalam:0x0D00-0x0900, gujarati:0x0A80-0x0900, bengali:0x0980-0x0900, odia:0x0B00-0x0900};

function toDevanagariBlock(s){
  let out='';
  for(const ch of s){ const o=ch.codePointAt(0); let c=ch;
    for(const off of Object.values(SCRIPTS)){ if(off && o>=0x0900+off && o<0x0980+off && o!==0x0964 && o!==0x0965){ c=String.fromCodePoint(o-off); break; } }
    out+=c; }
  return out;
}
function fromDevanagari(s, script){ const off=SCRIPTS[script]||0; if(!off) return s;
  let out=''; for(const ch of s){ const o=ch.codePointAt(0); out+= (o>=0x0901&&o<0x0970&&o!==0x0964&&o!==0x0965)? String.fromCodePoint(o+off): ch; } return out; }
const isIndic = s => /[ऀ-෿]/.test(s);

function tokDev(s){
  const out=[], a=Array.from(toDevanagariBlock(s).normalize('NFC'));
  for(let i=0;i<a.length;i++){
    const ch=a[i];
    if(D2C[ch]){
      out.push({t:'C',v:D2C[ch]});
      let j=i+1; if(a[j]==='़') j++;
      const nx=a[j];
      if(nx==='्'){ i=j; }
      else if(M2V[nx]!==undefined){ out.push({t:'V',v:M2V[nx]}); i=j; }
      else { out.push({t:'V',v:'a'}); i=j-1; }
      continue;
    }
    if(D2V[ch]){ out.push({t:'V',v:D2V[ch]}); continue; }
    if(ch==='ं'){ out.push({t:'M'}); continue; }
    if(ch==='ः'){ out.push({t:'H'}); continue; }
    if(ch==='ँ'){ out.push({t:'N'}); continue; }
    if(ch==='ॐ'){ out.push({t:'V',v:'o'},{t:'M'}); continue; }
    if(ch==='ऽ'){ out.push({t:'A'}); continue; }
    if(ch==='॥'){ out.push({t:'P',strong:true}); continue; }
    if(ch==='।'||ch==='|'){ if(a[i+1]===ch){ i++; out.push({t:'P',strong:true}); } else out.push({t:'P'}); continue; }
    if(ch==='\n'){ out.push({t:'P'}); continue; }
    if(SEP.test(ch)) out.push({t:'W'});
  }
  return out;
}
function tokIAST(s){
  s=s.normalize('NFC').toLowerCase().replace(/ṁ/g,'ṃ').replace(/m̐/g,'ṃ').replace(/ṙ/g,'r');
  const out=[], a=Array.from(s);
  for(let i=0;i<a.length;i++){
    const c=a[i], n=a[i+1];
    if(c==='a'&&(n==='i'||n==='u')){ out.push({t:'V',v:'a'+n}); i++; continue; }
    if(IV.has(c)){ out.push({t:'V',v:c}); continue; }
    if('kgcjṭḍtdpb'.includes(c)&&n==='h'){ out.push({t:'C',v:c+'h'}); i++; continue; }
    if(IC.has(c)){ out.push({t:'C',v:c}); continue; }
    if(c==='ṃ'){ out.push({t:'M'}); continue; }
    if(c==='ḥ'){ out.push({t:'H'}); continue; }
    if(c==='|'||c==='।'||c==='॥'){ if(n===c||c==='॥'){ if(n===c) i++; out.push({t:'P',strong:true}); } else out.push({t:'P'}); continue; }
    if(c==='\n'){ out.push({t:'P'}); continue; }
    if(c==="'"||c==='’'||c==='ऽ'){ out.push({t:'A'}); continue; }
    if(SEP.test(c)) out.push({t:'W'});
  }
  return out;
}
const tokenize = s => isIndic(s)?tokDev(s):tokIAST(s);

function syllabify(toks){
  const syls=[]; let cl=[];
  for(const t of toks){
    if(t.t==='V'){
      let lastW=-1; cl.forEach((x,k)=>{ if(x.t==='W') lastW=k; });
      const cc=cl.filter(x=>x.t==='C').length, p=syls[syls.length-1];
      let onset;
      if(p){ p.after=cc; p.wb=lastW>=0; p.coda=cl.slice(0,Math.max(lastW,0)).filter(x=>x.t==='C').map(x=>x.v); onset=cl.slice(lastW+1).filter(x=>x.t==='C').map(x=>x.v); }
      else onset=cl.filter(x=>x.t==='C').map(x=>x.v);
      syls.push({on:onset,v:t.v,coda:[],m:false,h:false,n:false,after:0,wb:false,final:false,avag:false,g:false});
      cl=[];
    } else if(t.t==='C'||t.t==='W'){
      if(t.t==='W'&&cl.length&&cl[cl.length-1].t==='W') continue;
      cl.push(t);
    } else if((t.t==='M'||t.t==='H'||t.t==='N')&&syls.length&&!cl.some(x=>x.t==='C')){
      syls[syls.length-1][{M:'m',H:'h',N:'n'}[t.t]]=true;
    } else if(t.t==='A'&&syls.length){ syls[syls.length-1].avag=true; }
  }
  const last=syls[syls.length-1];
  if(last){ const cc=cl.filter(x=>x.t==='C').map(x=>x.v); last.coda=cc; last.after=cc.length; last.wb=true; last.final=true; }
  syls.forEach(s=>{ s.g = LONG.has(s.v)||s.m||s.h||s.after>=2||(s.final&&s.after>=1); });
  return syls;
}
function parseVerse(text){
  const segs=[]; let cur=[];
  const flush=strong=>{ const syls=syllabify(cur); if(syls.length){ syls.strong=!!strong; segs.push(syls);} else if(strong&&segs.length) segs[segs.length-1].strong=true; cur=[]; };
  for(const t of tokenize(text)){ if(t.t==='P') flush(t.strong); else cur.push(t); }
  flush(true);
  if(segs.length) segs[segs.length-1].strong=true;
  return segs;
}
function sylDev(s, withCoda=true){
  let out='';
  if(s.on.length){ out+=s.on.map(c=>C2D[c]).join('्')+(V2M[s.v]??''); } else out+=V2D[s.v]||'';
  if(s.n) out+='ँ'; if(s.m) out+='ं'; if(s.h) out+='ः';
  if(withCoda) s.coda.forEach(c=>{ out+=C2D[c]+'्'; });
  return out;
}
function sylIAST(s, withCoda=true){
  let out=s.on.join('')+s.v; if(s.n) out+='m̐'; if(s.m) out+='ṃ'; if(s.h) out+='ḥ';
  if(withCoda) out+=s.coda.join(''); return out;
}
function sylText(s, script){ if(script==='iast') return sylIAST(s); const d=sylDev(s); return script&&script!=='deva'?fromDevanagari(d,script):d; }
function iastToDev(text){
  return text.normalize('NFC').toLowerCase().replace(/[-–—]/g,'').replace(/[a-zāīūṛṝḷḹṅñṭḍṇśṣṃṁḥḻ]+/g, w=>syllabify(tokIAST(w).filter(t=>t.t!=='W'&&t.t!=='P')).map(s=>sylDev(s)).join(''));
}

/* ---------------- metres ---------------- */
const GANA={y:'LGG',m:'GGG',t:'GGL',r:'GLG',j:'LGL',b:'GLL',n:'LLL',s:'LLG',l:'L',g:'G'};
const GANA_NAME={LGG:'y',GGG:'m',GGL:'t',GLG:'r',LGL:'j',GLL:'b',LLL:'n',LLG:'s'};
const GDEV={y:'य',m:'म',t:'त',r:'र',j:'ज',b:'भ',n:'न',s:'स',l:'ल',g:'ग'};
const CLASS=['','uktā','atyuktā','madhyā','pratiṣṭhā','supratiṣṭhā','gāyatrī','uṣṇik','anuṣṭubh','bṛhatī','paṅkti','triṣṭubh','jagatī','atijagatī','śakvarī','atiśakvarī','aṣṭi','atyaṣṭi','dhṛti','atidhṛti','kṛti','prakṛti','ākṛti','vikṛti','saṃkṛti','abhikṛti','utkṛti'];
const formulaToPattern = f => f.split('').map(c=>GANA[c]).join('');
function patternToFormula(p){ let out='',i=0; for(;i+3<=p.length;i+=3) out+=GANA_NAME[p.slice(i,i+3)]; for(;i<p.length;i++) out+=p[i].toLowerCase(); return out; }
const formulaDev = f => f.split('').map(c=>GDEV[c]).join(' ');

const SPECIAL=[
 {id:'anustubh',iast:'Anuṣṭubh (Śloka)',dev:'अनुष्टुभ् (श्लोकः)',kind:'anus',src:['core'],laksana:'श्लोके षष्ठं गुरु ज्ञेयं सर्वत्र लघु पञ्चमम्।\nद्विचतुष्पादयोर्ह्रस्वं सप्तमं दीर्घमन्ययोः॥',note:'8 akṣaras per pāda; 5th laghu and 6th guru everywhere; 7th laghu in pādas 2 & 4 and guru in 1 & 3. Vipulā variants are accepted in odd pādas.'},
 {id:'upajati',iast:'Upajāti',dev:'उपजातिः',kind:'upajati',pats:[formulaToPattern('ttjgg'),formulaToPattern('jtjgg')],src:['core'],laksana:'अनन्तरोदीरितलक्ष्मभाजौ पादौ यदीयावुपजातयस्ताः',note:'Pādas mix Indravajrā and Upendravajrā.'},
 {id:'vamsopajati',iast:'Upajāti (Vaṃśastha–Indravaṃśā)',dev:'उपजातिः (वंश)',kind:'upajati',pats:[formulaToPattern('jtjr'),formulaToPattern('ttjr')],src:['core'],note:'Pādas mix Vaṃśastha and Indravaṃśā.'},
 {id:'arya',iast:'Āryā',dev:'आर्या',kind:'jati',targets:[12,18,12,15],src:['core'],laksana:'यस्याः पादे प्रथमे द्वादश मात्रास्तथा तृतीयेऽपि।\nअष्टादश द्वितीये चतुर्थके पञ्चदश सार्या॥',note:'Mātrā metre: 12 · 18 · 12 · 15 mātrās.'},
 {id:'giti',iast:'Gīti',dev:'गीतिः',kind:'jati',targets:[12,18,12,18],src:['core'],note:'Mātrā metre: 12 · 18 · 12 · 18 mātrās.'},
 {id:'upagiti',iast:'Upagīti',dev:'उपगीतिः',kind:'jati',targets:[12,15,12,15],src:['core'],note:'Mātrā metre: 12 · 15 · 12 · 15 mātrās.'},
 {id:'udgiti',iast:'Udgīti',dev:'उद्गीतिः',kind:'jati',targets:[12,15,12,18],src:['core'],note:'Mātrā metre: 12 · 15 · 12 · 18 mātrās.'},
 {id:'aryagiti',iast:'Āryāgīti',dev:'आर्यागीतिः',kind:'jati',targets:[12,20,12,20],src:['core'],note:'Mātrā metre: 12 · 20 · 12 · 20 mātrās.'},
 {id:'vaitaliya',iast:'Vaitālīya',dev:'वैतालीयम्',kind:'jati',targets:[14,16,14,16],src:['core'],note:'Mātrā metre (Piṅgala, Jayadeva): 14 · 16 · 14 · 16 mātrās, each pāda ending in ra-la-ga.'},
 {id:'matrasamaka',iast:'Mātrāsamaka (Pādākulaka)',dev:'मात्रासमकम्',kind:'jati',targets:[16,16,16,16],src:['core'],note:'Mātrā metre: 16 mātrās in every pāda.'},
 {id:'gayatri',iast:'Gāyatrī (Vedic)',dev:'गायत्री',kind:'vedic',targets:[8,8,8],src:['core'],note:'Vedic metre (Chandaḥsūtra): three pādas of 8 akṣaras; one akṣara less or more is nicṛt / bhurik.'},
 {id:'usnih',iast:'Uṣṇih (Vedic)',dev:'उष्णिक्',kind:'vedic',targets:[8,8,12],src:['core'],note:'Vedic metre: 8 + 8 + 12 akṣaras.'},
 {id:'brhati',iast:'Bṛhatī (Vedic)',dev:'बृहती',kind:'vedic',targets:[8,8,12,8],src:['core'],note:'Vedic metre: 8 + 8 + 12 + 8 akṣaras.'},
 {id:'virat',iast:'Virāj (Vedic)',dev:'विराट्',kind:'vedic',targets:[10,10,10],src:['core'],note:'Vedic metre: three pādas of 10 akṣaras.'},
 {id:'pankti-vedic',iast:'Paṅkti (Vedic)',dev:'पङ्क्तिः',kind:'vedic',targets:[8,8,8,8,8],src:['core'],note:'Vedic metre: five pādas of 8 akṣaras.'},
 {id:'tristubh',iast:'Triṣṭubh (Vedic)',dev:'त्रिष्टुभ्',kind:'vedic',targets:[11,11,11,11],src:['core'],note:'Vedic metre: four pādas of 11 akṣaras.'},
 {id:'jagati-vedic',iast:'Jagatī (Vedic)',dev:'जगती',kind:'vedic',targets:[12,12,12,12],src:['core'],note:'Vedic metre: four pādas of 12 akṣaras.'},
];
let METRES=null;
function loadMetres(data){
  const list=[...SPECIAL, ...(data?data.metres:[])];
  list.forEach(m=>{
    if(m.kind==='anus') m.lens=[8,8,8,8];
    else if(m.kind==='jati'||m.kind==='vedic') m.lens=m.targets;
    else if(m.kind==='sama'||m.kind==='upajati'){ const n=m.pats[0].length; m.lens=[n,n,n,n]; }
    else if(m.kind==='ardha'){ const a=m.pats[0].length,b=m.pats[1].length; m.lens=[a,b,a,b]; }
    else if(m.kind==='visama') m.lens=m.pats.map(p=>p.length);
    if(m.pats&&!m.formula&&m.kind!=='jati') m.formula=m.pats.map(p=>formulaDev(patternToFormula(p))).join('  |  ');
    if(m.kind==='sama'&&!m.class){ const L=m.pats[0].length; m.class=L<CLASS.length?CLASS[L]:'daṇḍaka'; }
  });
  METRES=list; return list;
}
const wstr = syls => syls.map(s=>s.g?'G':'L').join('');
const matra = syls => syls.reduce((a,s)=>a+(s.g?2:1),0);
function lev(a,b){ let prev=Array.from({length:b.length+1},(_,j)=>j);
  for(let i=1;i<=a.length;i++){ const cur=[i]; for(let j=1;j<=b.length;j++) cur.push(Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1))); prev=cur; }
  return prev[b.length]; }

function arrange(segs, lens, byMatra){
  const res=[]; let j=0;
  for(const seg of segs){
    const total=byMatra?matra(seg):seg.length; let best=null;
    for(const k of [1,2,4]){ const parts=[]; let sum=0; for(let q=0;q<k;q++){ const L=lens[(j+q)%lens.length]; parts.push(L); sum+=L; } const d=Math.abs(total-sum); if(!best||d<best.d) best={k,d,parts}; }
    let pos=0;
    for(let q=0;q<best.k;q++){
      const last=q===best.k-1; let end;
      if(last) end=seg.length;
      else if(byMatra){ let acc=0; end=pos; while(end<seg.length&&acc<best.parts[q]){ acc+=seg[end].g?2:1; end++; } }
      else end=Math.min(seg.length,pos+best.parts[q]);
      const sy=seg.slice(pos,end);
      if(sy.length) res.push({syls:sy,exp:(j+q)%lens.length,strong:last&&seg.strong,mis:[],notes:[],lenOk:true,score:0});
      pos=end;
    }
    j+=best.k;
  }
  return res;
}
function cmp(act,pat){ if(act.length===pat.length){ const mis=[]; for(let i=0;i<act.length-1;i++) if(act[i]!==pat[i]) mis.push(i); return {s:mis.length,mis,ok:true}; } return {s:lev(act,pat)+0.5,mis:[],ok:false}; }
const VIPULA={LLL:'na-vipulā',GLL:'bha-vipulā',GGG:'ma-vipulā',GLG:'ra-vipulā'};
function anus(p){
  const w=wstr(p.syls);
  if(w.length!==8){ p.score=Math.abs(w.length-8)*1.5+1; p.lenOk=false; p.notes.push(`${w.length} akṣaras (expected 8)`); return; }
  let s=0;
  if(w[1]==='L'&&w[2]==='L'){ s++; p.mis.push(1,2); p.notes.push('2nd and 3rd akṣaras are both laghu'); }
  if(p.exp%2===1){
    [[4,'L','5th should be laghu'],[5,'G','6th should be guru'],[6,'L','7th should be laghu in an even pāda']].forEach(([i,want,msg])=>{ if(w[i]!==want){ s++; p.mis.push(i); p.notes.push(msg);} });
    if(!p.notes.length) p.notes.push('pathyā (regular)');
    p.want='????LGL?';
  } else {
    const k=w.slice(4,7); p.want='????LGG?';
    if(k==='LGG') p.notes.push('pathyā (regular)');
    else if(VIPULA[k]){ p.notes.push(VIPULA[k]+' (accepted variant)'); p.want='????'+k+'?'; }
    else { [[4,'L'],[5,'G'],[6,'G']].forEach(([i,want])=>{ if(w[i]!==want){ s++; p.mis.push(i);} }); p.notes.push('5th–7th should be laghu–guru–guru'); }
  }
  if(p.mis.includes(1)) p.want=p.want.slice(0,1)+'GG'+p.want.slice(3);
  p.score=s;
}
function scoreMetre(M, segs){
  if(M.kind==='jati'){
    const padas=arrange(segs,M.targets,true); let s=0;
    padas.forEach(p=>{ const t=M.targets[p.exp], m=matra(p.syls), last=p.syls[p.syls.length-1]; let d=Math.abs(t-m); if(t-m===1&&last&&!last.g) d=0; p.score=d; p.lenOk=d===0; p.notes.push(`${m} mātrās (expected ${t})`); s+=d; });
    if(segs.reduce((a,x)=>a+x.length,0)<16) s+=6;
    return {M,score:s+0.25,padas};
  }
  if(M.kind==='vedic'){
    const padas=arrange(segs,M.targets,false); let s=1;
    padas.forEach(p=>{ const t=M.targets[p.exp%M.targets.length], d=Math.abs(p.syls.length-t); p.score=d===1?0.5:d; p.lenOk=d<=1; p.notes.push(`${p.syls.length} akṣaras (Vedic ${t}${d===1?', nicṛt / bhurik':''})`); s+=p.score; });
    if(padas.length!==M.targets.length) s+=2*Math.abs(padas.length-M.targets.length);
    return {M,score:s,padas};
  }
  const padas=arrange(segs,M.lens,false); let s=0; const used=new Set();
  padas.forEach(p=>{
    if(M.kind==='anus'){ anus(p); s+=p.score; return; }
    const opts = M.kind==='ardha'?[M.pats[p.exp%2]]: M.kind==='visama'?[M.pats[p.exp%M.pats.length]]: M.pats;
    let best=null,bi=0; opts.forEach((pat,i)=>{ const r=cmp(wstr(p.syls),pat); if(!best||r.s<best.s){best=r;bi=i;} });
    used.add(bi); p.pat=opts[bi]; p.mis=best.mis; p.lenOk=best.ok; p.score=best.s; s+=best.s;
  });
  if(M.kind==='upajati'&&used.size<2) s+=0.5;
  return {M,score:s,padas};
}
function plausible(M, segLens){
  if(M.kind==='jati'||M.kind==='anus'||M.kind==='upajati'||M.kind==='vedic') return true;
  const n=M.lens.reduce((a,b)=>a+b,0)/4;
  return segLens.some(L=>[1,2,4].some(k=>Math.abs(L-n*k)<=Math.max(2,n*k*0.15)));
}
const PRI={core:0,std:1};
function identify(segs, top=6){
  if(!METRES) loadMetres(root.PS_METRES||null);
  if(typeof segs==='string') segs=parseVerse(segs);
  if(!segs.length) return [];
  const lens=segs.map(s=>s.length);
  const out=[]; for(const M of METRES){ if(plausible(M,lens)) out.push(scoreMetre(M,segs)); }
  out.sort((a,b)=>a.score-b.score || (PRI[a.M.src[0]]??5)-(PRI[b.M.src[0]]??5));
  return out.slice(0,top);
}

/* ---------------- diagnosis: why does the verse deviate? ---------------- */
function explainPosition(pi, sy, i, want){
  const s=sy[i], nxt=sy[i+1], ak=sylDev(s), out=[];
  if(s.g&&want==='L'){
    if(s.m) out.push({pi,i,cat:'textual',text:`“${ak}” is guru only because of the anusvāra; an extra anusvāra (ं) is a common scribal or OCR error.`});
    if(s.h) out.push({pi,i,cat:'sandhi',text:`“${ak}” is guru because of the visarga; check the visarga-sandhi before the next word.`});
    if(['ī','ū','ṝ'].includes(s.v)) out.push({pi,i,cat:'textual',text:`Long vowel in “${ak}”; the short vowel would give the expected laghu (vowel-length slip in copying or OCR).`});
    if(['e','o','ai','au'].includes(s.v)) out.push({pi,i,cat:'licence',text:`“${ak}” contains ${s.v}, which is always long; the reading itself has to differ here.`});
    if(!LONG.has(s.v)&&!s.m&&!s.h&&s.after>=2&&nxt){
      const cl=[...s.coda,...nxt.on].join('');
      if(s.wb){
        if(!s.coda.length&&['pr','hr','br','kr'].includes(nxt.on.slice(0,2).join(''))) out.push({pi,i,cat:'kavisamaya',text:`The next word begins with “${cl}”: by kavisamaya a short vowel before pr / hr / br / kr may stay laghu.`});
        else if(s.coda.length) out.push({pi,i,cat:'sandhi',text:`This word's final consonant meets the next word (“${cl}”) and makes “${ak}” guru by position; check the word division or sandhi choice.`});
        else out.push({pi,i,cat:'sandhi',text:`The next word starts with the conjunct “${cl}”, which makes the short “${ak}” guru by position.`});
      } else out.push({pi,i,cat:'textual',text:`The conjunct “${cl}” after “${ak}” makes it guru; a misplaced halant (्) in the source or OCR would cause this.`});
    }
  } else if(!s.g&&want==='G'){
    if(['a','i','u','ṛ'].includes(s.v)) out.push({pi,i,cat:'textual',text:`Short vowel in “${ak}”; the source may have the long vowel (vowel-length slip).`});
    out.push({pi,i,cat:'textual',text:`“${ak}” is laghu; a lost anusvāra / visarga or a lost conjunct after it would make it guru.`});
    if(s.wb&&nxt&&nxt.on.length===1) out.push({pi,i,cat:'sandhi',text:`Word boundary after “${ak}”: a different sandhi (for example a retained final consonant) would close the syllable.`});
  }
  return out;
}
function explainLength(pi, p, M){
  const sy=p.syls, out=[];
  if(M.kind==='jati'||M.kind==='vedic'){ out.push({pi,i:null,cat:'textual',text:p.notes.join(' ')}); return out; }
  const want=M.lens[p.exp%M.lens.length], diff=sy.length-want;
  if(diff>0){
    for(let k=0;k<sy.length-1;k++) if(sy[k].wb&&!sy[k].coda.length&&!sy[k+1].on.length) out.push({pi,i:k+1,cat:'arsa',text:`Vowel hiatus between “${sylDev(sy[k])}” and “${sylDev(sy[k+1])}”: applying vowel sandhi removes one akṣara; keeping the hiatus is an ārṣa usage.`});
    out.push({pi,i:null,cat:'textual',text:`${diff} extra akṣara${diff>1?'s':''}: a particle (ca, hi, tu, eva) may have been added, or a line break is misplaced.`});
  } else {
    sy.forEach((s,k)=>{ if(s.avag) out.push({pi,i:k,cat:'arsa',text:`Avagraha after “${sylDev(s)}”: reading the elided a (ārṣa / chāndasa) adds one akṣara.`}); });
    out.push({pi,i:null,cat:'textual',text:`${-diff} akṣara${-diff>1?'s':''} missing: a word or particle may have dropped out (scribal omission), or a line break is misplaced.`});
  }
  return out;
}
function diagnose(match){
  const out=[];
  match.padas.forEach((p,pi)=>{
    if(p.pat&&p.lenOk) p.mis.forEach(i=>out.push(...explainPosition(pi,p.syls,i,p.pat[i])));
    else if(match.M.kind==='anus'&&p.lenOk) [...new Set(p.mis)].forEach(i=>{ const want=p.want?p.want[i]:'G'; if(want!=='?') out.push(...explainPosition(pi,p.syls,i,want)); });
    else if(!p.lenOk) out.push(...explainLength(pi,p,match.M));
  });
  return out;
}

const API={C2D,D2C,V2D,V2M,M2V,LONG,GANA,GANA_NAME,GDEV,CLASS,SCRIPTS,tokenize,tokDev,tokIAST,syllabify,parseVerse,sylDev,sylIAST,sylText,fromDevanagari,toDevanagariBlock,iastToDev,
  formulaToPattern,patternToFormula,formulaDev,loadMetres,identify,scoreMetre,diagnose,wstr,matra,lev,get METRES(){ if(!METRES) loadMetres(root.PS_METRES||null); return METRES; }};
if(typeof module!=='undefined'&&module.exports) module.exports=API; else root.PS=API;
})(typeof window!=='undefined'?window:globalThis);
