/* Lakṣaṇa-Yantra — read a metre's definition from its lakṣaṇa verse.
   Port of python/pingala_shodhana/laksana.py (kept rule-for-rule identical; tests compare both). */
(function (root) {
'use strict';
const E = (typeof module!=='undefined'&&module.exports)? require('./engine.js') : root.PS;
const {tokenize, syllabify, sylDev, parseVerse, formulaToPattern, patternToFormula} = E;

const GANA_LETTER={m:'m',y:'y',r:'r',s:'s',t:'t',j:'j',bh:'b',n:'n',g:'g',l:'l'};
const CODE_VOWELS=new Set(['a','ā','ai','au','o']);
const CASE_VOWELS=new Set(['ā','ai','au','o','e']);
const RESIDUE=new Set(['t','d','n','s','ś','ṣ','r','m']);
const NUMBER_WORDS=[
 ['वेद',[4]],['श्रुति',[4]],['जलधि',[4]],['अब्धि',[4]],['अम्बुधि',[4]],['सागर',[4]],['समुद्र',[4]],['युग',[4]],['चतुर्',[4]],
 ['बाण',[5]],['शर',[5]],['इषु',[5]],['भूत',[5]],['अक्ष',[5]],['इन्द्रिय',[5]],
 ['रस',[6]],['ऋतु',[6]],['अङ्ग',[6]],['तर्क',[6]],['षडग',[6,7]],['षड',[6]],['षट',[6]],
 ['अश्व',[7]],['मुनि',[7]],['ऋषि',[7]],['लोक',[7]],['स्वर',[7]],['अद्रि',[7]],['शैल',[7]],['हय',[7]],['तुरग',[7]],['नग',[7]],
 ['वसु',[8]],['भोगि',[8]],['नाग',[8]],['गज',[8]],['सर्प',[8]],
 ['ग्रह',[9]],['रन्ध्र',[9]],['अङ्क',[9]],['निधि',[9]],
 ['दश',[10]],['दिश',[10]],['दिक्',[10]],
 ['रुद्र',[11]],['सूर्य',[12]],['अर्क',[12]],['आदित्य',[12]],['भानु',[12]],
 ['त्रिमुनि',[7,7,7]],['त्रिदश',[3,10]],['त्रि',[3]],
].sort((a,b)=>b[0].length-a[0].length);
const YATI_WORDS=['यति','विरति','विराम','च्छिन्न','छिन्न','युत','युक्त'];
const TERMINATORS=['संयुत','सहित','समेत','युक्त','युते','युत','अन्वित'];
const MULTIPLIERS=[['युगल',2],['युग्म',2],['युग',2],['द्वय',2],['त्रय',3],['चतुर्भि',4],['चतू',4],['चतुर्',4]];
const GURU_WORDS=[['सगुरवः','g'],['सगुरु','g'],['गुरुयुग्म','gg'],['गुरुद्वय','gg'],['गुरुयुग','gg'],['गुरू','gg'],['गुरवः','g'],['गुरुः','g'],['गुरु','g'],['लघू','ll'],['लघुः','l'],['लघु','l']];
const STOP=new Set(['यदि','स्यात्','स्याद्','स्या','चेत्','चेद्','चे','च','तु','हि','इह','वा','ततो','ततः','तदा','यदा','सा','या','इयम्','एषा','भवति','भवेत्','भवे','आह','उदिता','उदितम्','तत्','अथ','इति','वद','मता','मतम्','ज्ञेया','ज्ञेयम्','प्रोक्ता','विषमे','समे','अयुजि','युजि','पादे','तथा','अपि','इदम्','इदं']);

const rstrip=(s,chars)=>{ let e=s.length; while(e>0&&chars.includes(s[e-1])) e--; return s.slice(0,e); };
const clone=(s,on)=>Object.assign({},s,{on:[...(on===undefined?s.on:on)],coda:[...s.coda]});
const dev=(units,k=0)=>units.slice(k).map((u,i)=>sylDev(u,(k+i)===units.length-1)).join('');
const eqArr=(a,b)=>a.length===b.length&&a.every((x,i)=>x===b[i]);

function match(units,k,lex){
  let s='';
  for(let j=k;j<units.length;j++){
    s+=sylDev(units[j], j===units.length-1);
    if(s.startsWith(lex)||rstrip(s,'्')===rstrip(lex,'्')) return j-k+1;
    if(!lex.startsWith(s)) return 0;
  }
  return 0;
}
function matchAny(units,k,lex,pv){
  let n=match(units,k,lex); if(n) return n;
  if('अआ'.includes(lex[0])&&k<units.length){
    const u=units[k];
    if((pv==='a'||pv==='ā')&&k>0){ n=match(units,k,lex.slice(1)); if(n) return n; }
    if(u.on.length===1&&u.v==='a'){ n=match([clone(u,[]),...units.slice(k+1)],0,lex); if(n) return n; }
  }
  return 0;
}
function codable(u){
  if(!u.on.length||!CODE_VOWELS.has(u.v)) return [];
  const out=[];
  for(const c of u.on){ if(!(c in GANA_LETTER)) return []; const L=GANA_LETTER[c]; if(!out.length||out[out.length-1]!==L) out.push(L); }
  return out;
}
function subwords(sy){
  const subs=[]; let cur=[], forced=null;
  sy.forEach((s0,k)=>{
    let s=s0;
    if(k>0){
      const pv=sy[k-1].v;
      const merged=((pv==='a'||pv==='ā')&&NUMBER_WORDS.some(([L])=>L[0]==='अ'&&match(sy,k,L.slice(1)))) || NUMBER_WORDS.some(([L])=>!'अआ'.includes(L[0])&&match(sy,k,L));
      if(sy[k-1].avag){ subs.push([cur,forced]); cur=[]; forced=null; s=clone(s,s.on); }
      else if(merged){}
      else if((pv==='ai'||pv==='au')&&eqArr(s.on,['r'])){ subs.push([cur,forced]); cur=[]; forced=null; s=clone(s,[]); }
      else if(CASE_VOWELS.has(pv)&&s.on.length>=2&&RESIDUE.has(s.on[0])){ subs.push([cur,forced]); cur=[]; forced=null; s=clone(s,s.on.slice(1)); }
      else if(pv==='ā'&&(eqArr(s.on,['v'])||eqArr(s.on,['y']))){ subs.push([cur, eqArr(s.on,['v'])?'au':'ai']); cur=[]; forced=null; s=clone(s,[]); }
      else if(pv==='a'&&s.on.length>=2&&RESIDUE.has(s.on[0])){
        const rest=[clone(s,s.on.slice(1)),...sy.slice(k+1)];
        if(NUMBER_WORDS.some(([L])=>match(rest,0,L))||GURU_WORDS.some(([L])=>match(rest,0,L))){ subs.push([cur,'aḥ']); cur=[]; forced=null; s=rest[0]; }
      }
    }
    cur.push(s);
  });
  subs.push([cur,forced]);
  return subs.filter(x=>x[0].length);
}
class Reader{
  constructor(){ this.letters=[]; this.yati=[]; this.pending=0; this.chainOpen=false; }
  addYati(nums){ if(this.chainOpen) this.yati=this.yati.concat(nums); else if(nums.length>=this.yati.length) this.yati=[...nums]; this.chainOpen=true; }
  add(ls){ this.chainOpen=false; if(this.pending&&ls.length){ ls=ls.slice(0,-1).concat(Array(this.pending).fill(ls[ls.length-1])); this.pending=0; } this.letters.push(...ls); }
}
function readSub(units0,forced,rd,prevEnd){
  let units=units0;
  const word=dev(units);
  if(STOP.has(word)||STOP.has(rstrip(word,'ः्'))) return;
  for(const t of TERMINATORS){
    for(let p=1;p<units.length;p++){
      if(match(units,p,t)){
        let ls=[], ok=true;
        for(const u of units.slice(0,p)){ const c=codable(u); if(!c.length||u.v!=='a'){ ok=false; break; } ls=ls.concat(c); }
        if(ok&&ls.length){ rd.add(ls); return; }
      }
    }
  }
  for(const [lex,val] of [['चतुर्भि',4],['त्रयेण',3],['त्रय',3]]){
    if(match(units,0,lex)&&rd.letters.length){ const last=rd.letters[rd.letters.length-1]; for(let i=1;i<val;i++) rd.letters.push(last); return; }
  }
  let k=0; const nums=[];
  while(k<units.length){
    let hit=null;
    for(const [lex,val] of NUMBER_WORDS){ const n=matchAny(units,k,lex,k===0?prevEnd:units[k-1].v); if(n){ hit=[n,val]; break; } }
    if(!hit) break;
    nums.push(...hit[1]);
    const n=hit[0]; k+=n;
    for(const [lex,val] of NUMBER_WORDS){
      if(lex.endsWith('्')&&val===hit[1]&&match(units,k-n,lex)){
        const last=units[k-1];
        if(last.on.length>=2){ units=units.slice(0,k-1).concat([clone(last,last.on.slice(1))],units.slice(k)); k-=1; }
        break;
      }
    }
  }
  if(nums.length){
    const rest=units.slice(k), tail=rest.length?dev(rest):'';
    if(rest.length&&codable(rest[0]).length&&!YATI_WORDS.some(y=>tail.startsWith(y))&&nums.length===1){ rd.pending=nums[0]; readCode(rest,forced,rd); return; }
    if(!rest.length||YATI_WORDS.some(y=>tail.startsWith(y))||rest[0].v==='ai'||rest[0].v==='au'||nums.length>=2){ rd.addYati(nums); return; }
  }
  readCode(units,forced,rd);
}
function readCode(units,forced,rd){
  let run=[], k=0, endVowel=null, complete=false, broke=false;
  while(k<units.length){
    const u=units[k];
    let hit=null;
    for(const [lex,val] of GURU_WORDS){ const n=match(units,k,lex); if(n){ hit=[n,val]; break; } }
    if(hit){ if(run.length&&CASE_VOWELS.has(endVowel)) rd.add(run); run=[]; rd.letters.push(...hit[1].split('')); return; }
    let mhit=null;
    for(const [lex,val] of MULTIPLIERS){ const n=match(units,k,lex); if(n){ mhit=[n,val]; break; } }
    if(mhit){
      const [n,val]=mhit;
      if(run.length){ run=run.concat(Array(val-1).fill(run[run.length-1])); }
      else if(rd.letters.length&&k===0&&dev(units,k).startsWith('चतुर्भि')){ const l=rd.letters[rd.letters.length-1]; for(let i=1;i<val;i++) rd.letters.push(l); return; }
      else if(rd.letters.length&&k===0&&dev(units,k).startsWith('त्रय')){ const l=rd.letters[rd.letters.length-1]; for(let i=1;i<val;i++) rd.letters.push(l); return; }
      else rd.pending=val;
      k+=n; continue;
    }
    const nr=match(units,k,'रेफ');
    if(nr){ run=run.concat(Array(rd.pending||1).fill('r')); rd.pending=0; k+=nr; complete=true; broke=true; break; }
    if(k+1<units.length&&eqArr(units[k+1].on,['k'])&&dev(units,k+1).startsWith('कार')&&u.v==='a'&&codable(u).length){
      const c=codable(u); for(let i=0;i<(rd.pending||1);i++) run=run.concat(c); rd.pending=0; complete=true; broke=true; break;
    }
    let c=codable(u);
    if(!c.length){ broke=true; break; }
    if(rd.pending){ c=c.slice(0,-1).concat(Array(rd.pending).fill(c[c.length-1])); rd.pending=0; }
    run=run.concat(c); endVowel=u.v; k++;
    if(u.v!=='a'||u.h){
      complete = k===units.length || ['नाम्','नां','णाम्','णां'].includes(dev(units,k));
      if(u.v==='au'&&run.length===1) run=run.concat(run);
      if(complete){ broke=true; break; }
      run=[]; broke=true; break;
    }
  }
  if(!broke){ if(forced&&run.length){ if(forced==='au'&&run.length===1) run=run.concat(run); complete=true; } }
  if(complete&&run.length&&forced==='au'&&run.length===1&&endVowel==='ā') run=run.concat(run);
  if(complete&&run.length) rd.add(run);
}
function decode(text,name){
  const rd=new Reader();
  const nameStem=rstrip(rstrip((name||'').trim().split(' ')[0],'ःम्ं'),'्');
  for(const raw of text.replace(/[।॥\n]/g,' ').split(/\s+/).filter(Boolean)){
    let sy=syllabify(tokenize(raw).filter(t=>t.t!=='W'&&t.t!=='P'));
    if(!sy.length) continue;
    const word=sy.map(s=>sylDev(s)).join('');
    if(nameStem&&nameStem.length>=3){
      if(rstrip(rstrip(rstrip(word,'ःम्ं'),'्'),'ा')===rstrip(nameStem,'ा')||word.startsWith(nameStem)){
        let acc='', cut=0;
        for(let j=0;j<sy.length;j++){ acc+=sylDev(sy[j],false); if(acc.length>=nameStem.length){ cut=j+1; break; } }
        sy=sy.slice(cut); if(!sy.length) continue;
      }
    }
    let prevEnd=null;
    for(const [units,forced] of subwords(sy)){ readSub(units,forced,rd,prevEnd); prevEnd=units[units.length-1].v; }
  }
  return {formula:rd.letters.join(''), yati:rd.yati};
}
function readLaksana(text,name){
  const segs=parseVerse(text), scanned=segs.map(s=>s.map(x=>x.g?'G':'L').join(''));
  const r={text,name,scanned,decoded:'',decodedPattern:'',scanFormula:'',agree:false,yati:[],yatiOk:null,notes:[]};
  if(!scanned.length){ r.notes.push('No akṣaras found.'); return r; }
  const d=decode(text,name); r.decoded=d.formula;
  try{ r.decodedPattern=d.formula?formulaToPattern(d.formula):''; }catch(e){ r.decodedPattern=''; }
  const first=scanned[0]; r.scanFormula=patternToFormula(first);
  if(scanned.length===1) r.agree=!!r.decodedPattern&&r.decodedPattern.length===first.length&&r.decodedPattern.slice(0,-1)===first.slice(0,-1);
  else { const tgt=scanned[0]+scanned[1], skip=new Set([scanned[0].length-1,tgt.length-1]); r.agree=!!r.decodedPattern&&r.decodedPattern.length===tgt.length&&[...r.decodedPattern].every((a,i)=>skip.has(i)||a===tgt[i]); }
  if(!r.decoded) r.notes.push('No gaṇa words found; the lakṣaṇa may define the metre by reference to another one.');
  else if(!r.agree) r.notes.push(`Decoded gaṇas give ${r.decodedPattern}, the verse itself scans ${first}.`);
  if(d.yati.length){
    r.yati=d.yati;
    if(d.yati.reduce((a,b)=>a+b,0)===first.length){
      let pos=0; r.yatiOk=true;
      for(const seg of d.yati.slice(0,-1)){ pos+=seg; if(!segs[0][pos-1].wb) r.notes.push(`Yati after akṣara ${pos} falls inside a written word (a sandhi or compound joint).`); }
    } else { r.yatiOk=false; r.notes.push(`Yati numbers ${d.yati.join(', ')} add up to ${d.yati.reduce((a,b)=>a+b,0)}, the pāda has ${first.length} akṣaras.`); }
  }
  r.segs=segs;
  return r;
}
const API={decode,readLaksana,NUMBER_WORDS};
if(typeof module!=='undefined'&&module.exports) module.exports=API; else root.PSLaksana=API;
})(typeof window!=='undefined'?window:globalThis);
