/* Chant synthesiser: laghu = 1 mātrā, guru = 2, with a tanpura drone and optional mātrā clicks.
   A formant "voice" hums each akṣara's vowel; consonant onsets get a short noise burst.
   This is a rhythm guide, not a recitation. */
(function (root) {
'use strict';
let ctx=null, master=null, noiseBuf=null, drone=[], timer=null, raf=0, playing=false, events=[], onTick=null, onEnd=null;
const FORM={a:[730,1090],'ā':[750,1100],i:[300,2250],'ī':[280,2300],u:[330,850],'ū':[310,800],e:[450,1950],ai:[600,1750],o:[460,850],au:[600,1000],'ṛ':[420,1350],'ṝ':[420,1350],'ḷ':[420,1300],'ḹ':[420,1300]};
const NASAL=new Set(['m','n','ṇ','ñ','ṅ']);
const SCALE=[0,2,4,5,7];

function ensure(){
  if(!ctx){
    ctx=new (root.AudioContext||root.webkitAudioContext)();
    const comp=ctx.createDynamicsCompressor(); comp.connect(ctx.destination);
    master=ctx.createGain(); master.gain.value=0.9; master.connect(comp);
    noiseBuf=ctx.createBuffer(1,Math.floor(ctx.sampleRate*0.08),ctx.sampleRate);
    const d=noiseBuf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
  }
  if(ctx.state==='suspended') ctx.resume();
  return ctx;
}
function note(t,dur,f,fprev,s){
  const [F1,F2]=FORM[s.v]||FORM.a;
  const mix=ctx.createGain(); mix.gain.value=0.5;
  const oscs=[0,7].map(det=>{ const o=ctx.createOscillator(); o.type='sawtooth'; o.detune.value=det; o.frequency.setValueAtTime(fprev||f,t); o.frequency.exponentialRampToValueAtTime(f,t+0.08); o.connect(mix); o.start(t); o.stop(t+dur+0.06); return o; });
  if(dur>0.38){ const lfo=ctx.createOscillator(); lfo.frequency.value=5.3; const lg=ctx.createGain(); lg.gain.setValueAtTime(0,t); lg.gain.linearRampToValueAtTime(f*0.013,t+dur*0.7); lfo.connect(lg); oscs.forEach(o=>lg.connect(o.frequency)); lfo.start(t); lfo.stop(t+dur+0.06); }
  const env=ctx.createGain(); env.gain.setValueAtTime(0.0001,t); env.gain.exponentialRampToValueAtTime(0.55,t+0.035); env.gain.setValueAtTime(0.55,t+Math.max(0.04,dur-0.07)); env.gain.exponentialRampToValueAtTime(0.0001,t+dur+0.04); env.connect(master);
  const band=(fr,q,gv)=>{ const b=ctx.createBiquadFilter(); b.type='bandpass'; b.frequency.value=fr; b.Q.value=q; const gg=ctx.createGain(); gg.gain.value=gv; mix.connect(b); b.connect(gg); gg.connect(env); return b; };
  band(F1,6,1.0); const b2=band(F2,9,0.55);
  const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=520; const lg2=ctx.createGain(); lg2.gain.value=0.4; mix.connect(lp); lp.connect(lg2); lg2.connect(env);
  if(s.m||(s.coda&&s.coda.length&&NASAL.has(s.coda[0]))){ b2.frequency.setValueAtTime(F2,t+dur*0.55); b2.frequency.linearRampToValueAtTime(1000,t+dur*0.75); }
  const c0=s.on&&s.on[0];
  if(c0&&!NASAL.has(c0)&&!'yrlv'.includes(c0)){
    const n=ctx.createBufferSource(); n.buffer=noiseBuf; const nb=ctx.createBiquadFilter(); nb.type='bandpass'; nb.frequency.value=/[śṣs]/.test(c0)?5200:2600; nb.Q.value=1.2;
    const ng=ctx.createGain(); const sib=/[śṣsh]/.test(c0); ng.gain.setValueAtTime(sib?0.22:0.16,t); ng.gain.exponentialRampToValueAtTime(0.0001,t+(sib?0.07:0.03));
    n.connect(nb); nb.connect(ng); ng.connect(master); n.start(t); n.stop(t+0.08);
  }
}
function click(t,hi){ const o=ctx.createOscillator(); o.frequency.value=hi?1250:880; const gg=ctx.createGain(); gg.gain.setValueAtTime(hi?0.12:0.06,t); gg.gain.exponentialRampToValueAtTime(0.0001,t+0.04); o.connect(gg); gg.connect(master); o.start(t); o.stop(t+0.05); }
function startDrone(t,f){
  const g0=ctx.createGain(); g0.gain.setValueAtTime(0.0001,t); g0.gain.exponentialRampToValueAtTime(0.05,t+0.8);
  const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=900; lp.connect(g0); g0.connect(master);
  const nodes=[f/2,f*0.75,f,f*1.003].map((fr,i)=>{ const o=ctx.createOscillator(); o.type='sawtooth'; o.frequency.value=fr; const gg=ctx.createGain(); gg.gain.value=i===1?0.8:0.6; o.connect(gg); gg.connect(lp); o.start(t); return o; });
  const lfo=ctx.createOscillator(); lfo.frequency.value=0.7; const lfg=ctx.createGain(); lfg.gain.value=0.012; lfo.connect(lfg); lfg.connect(g0.gain); lfo.start(t);
  drone=[...nodes,lfo,g0];
}
function stopDrone(){ drone.forEach(n=>{ try{ if(n.stop) n.stop(); else { n.gain.cancelScheduledValues(ctx.currentTime); n.gain.setTargetAtTime(0.0001,ctx.currentTime,0.15);} }catch(e){} }); drone=[]; }

/* ---------- Recite: real voice, akṣara by akṣara, through the device's speech engine ---------- */
let rTimer=null, rItems=[], rKeep=[], reciting=false;
const INDIC=/^(sa|hi|mr|ne|kok|mai)(-|_|$)/i;
function voices(){
  if(!('speechSynthesis' in root)) return [];
  const v=root.speechSynthesis.getVoices();
  const ind=v.filter(x=>INDIC.test(x.lang)||/^en[-_]IN/i.test(x.lang));
  const rank=x=>(/^sa/i.test(x.lang)?0:/^hi/i.test(x.lang)?1:/^en/i.test(x.lang)?5:2)+(/google/i.test(x.name)?0:0.5);
  return ind.sort((a,b)=>rank(a)-rank(b));
}
function whenVoices(ms=1500){
  return new Promise(res=>{
    if(!('speechSynthesis' in root)) return res([]);
    const v=voices(); if(v.length) return res(v);
    let done=false; const fin=()=>{ if(!done){ done=true; res(voices()); } };
    root.speechSynthesis.addEventListener?root.speechSynthesis.addEventListener('voiceschanged',fin,{once:true}):(root.speechSynthesis.onvoiceschanged=fin);
    root.speechSynthesis.getVoices(); setTimeout(fin,ms);
  });
}
/* Split for speaking: a conjunct's first consonant closes the previous akṣara (कुन्·देन्·दु), as chanters divide syllables. */
const ROMAN=[['ā','aa'],['ī','ee'],['ū','oo'],['ṝ','ree'],['ṛ','ri'],['ḹ','lree'],['ḷ','li'],['ai','ai'],['au','ow'],['ṃ','m'],['ḥ','ha'],['ṅ','ng'],['ñ','ny'],['ṭh','th'],['ṭ','t'],['ḍh','dh'],['ḍ','d'],['ṇ','n'],['ś','sh'],['ṣ','sh'],['c','ch'],['m̐','n']];
function roman(s){ let out=s; for(const [a,b] of ROMAN) out=out.split(a).join(b); return out.replace(/chh/g,'chh'); }
function units(p, english){
  const sy=p.syls.map(s=>Object.assign({},s,{on:[...s.on],coda:[...s.coda]}));
  for(let i=0;i<sy.length-1;i++){ const n=sy[i+1]; if(!sy[i].wb&&n.on.length>=2){ sy[i].coda.push(n.on.shift()); } }
  return sy.map(s=>english? roman(root.PS.sylIAST(s,true)) : root.PS.sylDev(s,true));
}
async function recite(padas, opts){
  const list=await whenVoices();
  const voice=list.find(v=>v.voiceURI===opts.voiceURI)||list[0];
  if(!voice) return false;
  stop(); reciting=true; onTick=opts.onTick; onEnd=opts.onEnd;
  if(opts.drone){ ensure(); startDrone(ctx.currentTime+0.05,opts.sa||146.83); }
  const u=(opts.tempo||0.3)*1000*1.6, rate=Math.max(0.6,Math.min(1.5,0.3/(opts.tempo||0.3)));
  rItems=[];
  const english=/^en/i.test(voice.lang);
  padas.forEach((p,pi)=>{ const txt=units(p,english); const n=p.syls.length;
    p.syls.forEach((s,i)=>{ const last=i===n-1; rItems.push({s,pi,i,text:txt[i],dur:(s.g?2:1)*u*(last&&(p.exp%2===1||p.strong)?1.4:1),pause:last?((p.exp%2===1||p.strong)?u*1.6:u*0.6):0}); }); });
  let k=0;
  const next=()=>{
    if(!reciting) return;
    if(k>=rItems.length){ stop(); return; }
    const it=rItems[k++], ut=new SpeechSynthesisUtterance(it.text);
    ut.voice=voice; ut.lang=voice.lang; ut.rate=it.s.g?rate*0.78:rate; ut.pitch=it.s.g?1.08:1.0; ut.volume=1;
    rKeep.push(ut); if(rKeep.length>8) rKeep.shift();
    const t0=performance.now(); let moved=false;
    const go=()=>{ if(moved) return; moved=true; clearTimeout(rTimer); const wait=Math.max(0,it.dur-(performance.now()-t0))+it.pause; rTimer=setTimeout(next,wait); };
    ut.onend=go; ut.onerror=go;
    rTimer=setTimeout(go,Math.max(2500,it.dur*3));   // guard: some engines skip onend
    onTick&&onTick(it);
    root.speechSynthesis.speak(ut);
  };
  root.speechSynthesis.cancel();
  setTimeout(next,opts.drone?500:80);
  return true;
}

/* padas: [{syls, exp, strong, id?}] ; opts: {tempo, sa, drone, clicks, onTick(ev|null), onEnd()} */
function play(padas, opts){
  stop();
  ensure(); playing=true; onTick=opts.onTick; onEnd=opts.onEnd;
  const u=opts.tempo||0.3, sa=opts.sa||146.83, ev=[]; let t=0;
  padas.forEach((p,pi)=>{
    const n=p.syls.length;
    p.syls.forEach((s,i)=>{
      let lvl = n>1? Math.round(Math.sin(Math.PI*i/(n-1))*2) : 0;
      if(s.g) lvl=Math.min(4,lvl+1);
      const last=i===n-1;
      if(last) lvl=(p.exp%2===0&&!p.strong)?1:0;
      if(i===0) lvl=Math.min(lvl,1);
      let dur=(s.g?2:1)*u; if(last&&(p.exp%2===1||p.strong)) dur*=1.5;
      ev.push({t,dur,semi:SCALE[lvl],s,pi,i,m:s.g?2:1}); t+=dur;
    });
    t+=(p.exp%2===1||p.strong)? u*2 : u*0.8;
  });
  const t0=ctx.currentTime+0.25+(opts.drone?0.6:0);
  if(opts.drone) startDrone(ctx.currentTime+0.05,sa);
  let prev=null;
  ev.forEach(e=>{ const f=sa*Math.pow(2,e.semi/12); e.abs=t0+e.t; note(e.abs,e.dur*0.96,f,prev,e.s); prev=f; if(opts.clicks){ click(e.abs,true); if(e.m===2) click(e.abs+u,false); } });
  events=ev;
  timer=setTimeout(stop,(t0-ctx.currentTime+t+0.3)*1000);
  let cur=null;
  const tick=()=>{ if(!playing) return; const now=ctx.currentTime; const e=events.find(x=>now>=x.abs&&now<x.abs+x.dur)||null; if(e!==cur){ cur=e; onTick&&onTick(e); } raf=requestAnimationFrame(tick); };
  raf=requestAnimationFrame(tick);
}
function stop(){
  if(reciting){ reciting=false; clearTimeout(rTimer); try{ root.speechSynthesis.cancel(); }catch(e){} if(ctx) stopDrone(); onTick&&onTick(null); const cb=onEnd; onEnd=null; cb&&cb(); return; }
  if(!playing) return; playing=false; clearTimeout(timer); cancelAnimationFrame(raf);
  if(ctx){ master.gain.setTargetAtTime(0.0001,ctx.currentTime,0.05); stopDrone(); const m=master; setTimeout(()=>{ if(!playing) m.gain.setValueAtTime(0.9,ctx.currentTime); },350); }
  onTick&&onTick(null); const cb=onEnd; onEnd=null; cb&&cb();
}
root.PSChant={play,recite,stop,voices,whenVoices,isPlaying:()=>playing||reciting};
})(window);
