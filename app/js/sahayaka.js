/* Chando-Sahāyaka — metre-repair assistant. Port of python/pingala_shodhana/sahayaka.py. */
(function (root) {
'use strict';
const E = (typeof module!=='undefined'&&module.exports)? require('./engine.js') : root.PS;
const A_END=['ः','ौ','ाः','म्','ं','ान्','ेन','ेण','ाभ्याम्','ैः','ाय','ेभ्यः','ात्','ाद्','स्य','योः','ानाम्','ाणाम्','े','ेषु','ानि','ाणि'];
const AA_END=['ा','े','ाः','ाम्','ां','या','ाभ्याम्','ाभिः','ायै','ाभ्यः','ायाः','योः','ानाम्','ाणाम्','ायाम्','ासु'];
const PARTICLES=['च','हि','तु','एव','अपि','वै','खलु'];
const BLOCK=new Set('चछजझञटठडढणतथदधनशसल');
const VIRAMA='्', MATRAS=new Set('ािीुूृॄॢॣेैोौंःँ');
const byLenDesc=a=>[...new Set(a)].sort((x,y)=>(y.length-x.length)||(x<y?-1:x>y?1:0));
const A_SORTED=byLenDesc(A_END), AA_SORTED=byLenDesc(AA_END);

function stemClass(stem){
  if(!stem) return null; const last=stem[stem.length-1];
  if(last==='ा') return 'aa';
  if(MATRAS.has(last)||last===VIRAMA) return null;
  if(last>='क'&&last<='ह') return 'a';
  return null;
}
let KOSHA=null;
function kosha(){
  if(KOSHA) return KOSHA;
  const data=(root.PS_KOSHA&&root.PS_KOSHA.sets)||[];
  const index=new Map(), sets=[], arthas=[];
  data.forEach(([artha,_v,words],i)=>{ sets.push(words); arthas.push(artha); words.forEach(([w])=>{ if(!index.has(w)) index.set(w,[]); index.get(w).push(i); }); });
  KOSHA={index,sets,arthas}; return KOSHA;
}
function natva(form){
  const a=Array.from(form); let m=-1;
  a.forEach((ch,i)=>{ if('रषृॄ'.includes(ch)) m=i; });
  if(m<0) return form;
  for(let i=m+1;i<a.length;i++){
    if(a[i]==='न'&&(i+1===a.length||a[i+1]!==VIRAMA)){ if(!a.slice(m+1,i).some(c=>BLOCK.has(c))) a[i]='ण'; break; }
    if(BLOCK.has(a[i])) break;
  }
  return a.join('');
}
function analyseWord(word){
  const {index}=kosha(), out=[];
  for(const end of A_SORTED){ if(word.endsWith(end)&&word.length>end.length){ const stem=word.slice(0,-end.length); for(const c of new Set([stem,stem.replace(/ण/g,'न')])) if(index.has(c)&&stemClass(c)==='a') out.push([c,end,'a']); } }
  for(const end of AA_SORTED){ if(word.endsWith(end)&&word.length>end.length){ const stem=word.slice(0,-end.length)+'ा'; if(index.has(stem)&&stemClass(stem)==='aa') out.push([stem,end,'aa']); } }
  if(index.has(word)&&stemClass(word)==='aa') out.push([word,'','aa']);
  return out;
}
function synonyms(word,limit=30){
  const {index,sets,arthas}=kosha(), res=[], seen=new Set([word]);
  for(const [stem,end,cls] of analyseWord(word)){
    for(const si of index.get(stem)||[]){
      const g0=(sets[si].find(([w])=>w===stem)||[])[1];
      for(const [w,g] of sets[si]){
        if(w===stem||g!==g0||stemClass(w)!==cls||w.length<2) continue;
        let form = cls==='a'? w+end : (end? w.slice(0,-1)+end : w);
        form = cls==='a'? natva(form.replace('ेण','ेन').replace('ाणाम्','ानाम्').replace('ाणि','ानि')) : natva(form.replace('ाणाम्','ानाम्'));
        if(!seen.has(form)){ seen.add(form); res.push([form,arthas[si]]); }
        if(res.length>=limit) return res;
      }
    }
  }
  return res;
}
const lines=t=>t.trim().split('\n').map(l=>l.split(/\s+/).filter(Boolean));
const join=ls=>ls.map(l=>l.join(' ')).join('\n');
const coreOf=w=>w.replace(/[।॥|]+$/,'');

function suggest(text, metreId, maxResults=10, allowReorder=true){
  const segs=E.parseVerse(text);
  if(!segs.length) return {target:null,base:0,suggestions:[]};
  const all=E.METRES;
  const target = metreId? all.find(m=>m.id===metreId) : E.identify(segs,1)[0].M;
  const base=E.scoreMetre(target,segs).score;
  const score=t=>{ const s=E.parseVerse(t); return s.length?E.scoreMetre(target,s).score:99; };
  const L0=lines(text), orig=join(L0), cands=new Map();
  const consider=(nl,change,kind,extra)=>{ const t=join(nl); if(cands.has(t)||t===orig) return; const sc=score(t); if(sc<(extra?extra.score:base)) cands.set(t,{text:t,score:sc,changes:(extra?extra.changes:[]).concat([change]),kind:extra?extra.kind+'+'+kind:kind}); };
  const copy=()=>L0.map(l=>[...l]);
  L0.forEach((ln,li)=>ln.forEach((w,wi)=>{ const c=coreOf(w), tail=w.slice(c.length); for(const [form,artha] of synonyms(c)){ const nl=copy(); nl[li][wi]=form+tail; consider(nl,`${c} → ${form} (paryāya: “${artha}”)`,'synonym'); } }));
  L0.forEach((ln,li)=>{
    ln.forEach((w,wi)=>{ const c=coreOf(w); if(PARTICLES.includes(c)){ const nl=copy(); nl[li].splice(wi,1); if(wi===ln.length-1&&nl[li].length) nl[li][nl[li].length-1]+=w.slice(c.length); consider(nl,`drop ${c}`,'particle'); } });
    for(let pos=1;pos<=ln.length;pos++) for(const p of PARTICLES){
      const nl=copy();
      if(pos===ln.length){ const last=nl[li][nl[li].length-1], c=coreOf(last); nl[li][nl[li].length-1]=c; nl[li].push(p+last.slice(c.length)); }
      else nl[li].splice(pos,0,p);
      consider(nl,`add ${p} after “${coreOf(ln[pos-1])}”`,'particle');
    }
  });
  if(allowReorder) L0.forEach((ln,li)=>{
    if(ln.length<2||ln.length>6) return;
    const core=ln.map(coreOf), tail=ln[ln.length-1].slice(core[core.length-1].length);
    for(const perm of permutations([...Array(ln.length).keys()])){
      if(perm.every((x,i)=>x===i)) continue;
      const nl=copy(); nl[li]=perm.map(i=>core[i]); nl[li][nl[li].length-1]+=tail;
      consider(nl,`reorder line ${li+1}: ${nl[li].join(' ')}`,'order');
    }
  });
  const partial=[...cands.values()].filter(c=>c.score>0.3).sort((a,b)=>a.score-b.score).slice(0,6);
  for(const c of partial){
    const cl=lines(c.text);
    cl.forEach((ln,li)=>ln.forEach((w,wi)=>{
      if(li<L0.length&&wi<L0[li].length&&L0[li][wi]!==w) return;
      const core=coreOf(w), tail=w.slice(core.length);
      for(const [form,artha] of synonyms(core,15)){
        const nl=cl.map(l=>[...l]); nl[li][wi]=form+tail; const t=join(nl);
        if(cands.has(t)) continue; const sc=score(t);
        if(sc<c.score) cands.set(t,{text:t,score:sc,changes:c.changes.concat([`${core} → ${form} (paryāya: “${artha}”)`]),kind:c.kind+'+synonym'});
      }
    }));
  }
  const out=[...cands.values()].sort((a,b)=>(Math.round(a.score*100)-Math.round(b.score*100))||(a.changes.length-b.changes.length)||((a.kind!=='synonym')-(b.kind!=='synonym')));
  return {target,base,suggestions:out.slice(0,maxResults)};
}
function* permutations(arr){ if(arr.length<=1){ yield arr; return; } for(let i=0;i<arr.length;i++){ const rest=arr.slice(0,i).concat(arr.slice(i+1)); for(const p of permutations(rest)) yield [arr[i],...p]; } }

const API={suggest,synonyms,analyseWord,natva,PARTICLES};
if(typeof module!=='undefined'&&module.exports) module.exports=API; else root.PSSahayaka=API;
})(typeof window!=='undefined'?window:globalThis);
