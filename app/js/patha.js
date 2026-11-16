/* Pāṭha — chant with a real recording.
   1. Record your chant (microphone) or load an audio file.
   2. Metre-guided alignment: the verse's scansion says how many akṣaras each line has and how long each
      should be (laghu 1, guru 2 mātrās). Long silences mark line breaks; inside a line, onsets are placed
      by mātrā proportion and snapped to the nearest energy peak (vowel nucleus) in the recording.
   3. Play back with each akṣara lighting up; slow down without changing pitch; fix timing by tapping along.
   4. Recite-along: the highlight follows your own voice from the microphone, one akṣara per voiced pulse. */
(function (root) {
'use strict';
let ctx=null, audio=null, url=null, buffer=null, times=[], items=[], raf=0, onTick=null, cur=-1;
let rec=null, recChunks=[], micStream=null, follow=null, tapMode=false, tapTimes=[];

function ac(){ if(!ctx) ctx=new (root.AudioContext||root.webkitAudioContext)(); if(ctx.state==='suspended') ctx.resume(); return ctx; }

/* items: flat list [{pi,i,s,w}] in verse order; padaEnd marks the last akṣara of each pāda */
function setVerse(padas){
  items=[]; padas.forEach((p,pi)=>p.syls.forEach((s,i)=>items.push({pi,i,s,w:s.g?2:1,padaEnd:i===p.syls.length-1})));
  times=[];
}

async function loadBlob(blob){
  const arr=await blob.arrayBuffer();
  buffer=await ac().decodeAudioData(arr.slice(0));
  if(url) URL.revokeObjectURL(url);
  url=URL.createObjectURL(blob);
  audio=new Audio(url); audio.preservesPitch=true; audio.mozPreservesPitch=true; audio.webkitPreservesPitch=true;
  align();
  return buffer.duration;
}

/* ---------- metre-guided alignment ---------- */
function envelope(W0){
  const ch=buffer.getChannelData(0), sr=buffer.sampleRate, hop=Math.round(sr*0.01), n=Math.floor(ch.length/hop);
  const env=new Float32Array(n);
  for(let k=0;k<n;k++){ let s=0; for(let j=k*hop;j<(k+1)*hop;j++){ const v=ch[j]; s+=v*v; } env[k]=Math.sqrt(s/hop); }
  const sm=new Float32Array(n); const W=W0||4;                     // moving average (W0*20+10 ms)
  for(let k=0;k<n;k++){ let s=0,c=0; for(let j=Math.max(0,k-W);j<=Math.min(n-1,k+W);j++){ s+=env[j]; c++; } sm[k]=s/c; }
  return sm;
}
function align(){
  if(!buffer||!items.length){ times=[]; return; }
  const env=envelope(), n=env.length;
  const sorted=Array.from(env).sort((a,b)=>a-b), floor=sorted[Math.floor(n*0.1)], peak=sorted[Math.floor(n*0.98)]||1e-6;
  const thr=floor+(peak-floor)*0.12;
  let a=0; while(a<n&&env[a]<thr) a++;
  let b=n-1; while(b>a&&env[b]<thr) b--;
  // silences longer than 250 ms inside the voiced span
  const sil=[]; let k=a, start=-1;
  for(;k<=b;k++){ if(env[k]<thr){ if(start<0) start=k; } else if(start>=0){ if(k-start>=18) sil.push([start,k]); start=-1; } }
  // pādas expected (every pāda end is a possible breath)
  const lines=[]; let curL=[]; items.forEach((it,idx)=>{ curL.push(idx); if(it.padaEnd){ lines.push(curL); curL=[]; } }); if(curL.length) lines.push(curL);
  const W=lines.map(L=>L.reduce((x,i)=>x+items[i].w,0)), tot=W.reduce((x,y)=>x+y,0);
  // anchor pāda boundaries on silences: each long silence goes to the nearest expected boundary
  const nb=lines.length-1, cum=[]; let accW=0; for(let j=0;j<nb;j++){ accW+=W[j]; cum.push(accW/tot); }
  const exp=j=>a+(b-a)*cum[j];
  const assigned=new Array(nb).fill(null);
  sil.slice().sort((x,y)=>(y[1]-y[0])-(x[1]-x[0])).forEach(sl=>{
    const mid=(sl[0]+sl[1])/2; let best=-1, bd=Infinity;
    for(let j=0;j<nb;j++){ if(assigned[j]) continue; const d=Math.abs(mid-exp(j)); const lim=(b-a)*Math.max(W[j],W[j+1])/tot*0.6; if(d<lim&&d<bd){ best=j; bd=d; } }
    if(best<0) return;
    const prev=assigned.slice(0,best).reverse().find(x=>x), next=assigned.slice(best+1).find(x=>x);
    if((prev&&prev[1]>sl[0])||(next&&next[0]<sl[1])) return;
    assigned[best]=sl;
  });
  // fill unanchored boundaries by mātrā proportion between neighbouring anchors
  const bounds=[]; // [endOfPada, startOfNext]
  for(let j=0;j<nb;j++){
    if(assigned[j]){ bounds.push([assigned[j][0],assigned[j][1]]); continue; }
    let pj=j-1; while(pj>=0&&!assigned[pj]) pj--; let nj=j+1; while(nj<nb&&!assigned[nj]) nj++;
    const left=pj>=0?assigned[pj][1]:a, right=nj<nb?assigned[nj][0]:b;
    const wl=pj>=0?cum[pj]:0, wr=nj<nb?cum[nj]:1, t=left+(right-left)*(cum[j]-wl)/(wr-wl||1);
    bounds.push([t,t]);
  }
  const spans=lines.map((L,j)=>[j===0?a:bounds[j-1][1], j===nb?b:bounds[j][0]]);
  // dips between syllables (consonant closures) from a lightly smoothed envelope
  const fine=envelope(2);
  const dips=[]; for(let i=3;i<n-3;i++){ if(fine[i]<=fine[i-1]&&fine[i]<=fine[i+1]&&fine[i]<fine[i-3]&&fine[i]<fine[i+3]) dips.push(i); }
  times=new Array(items.length);
  lines.forEach((L,li)=>{
    const [p,q]=spans[li], lt=W[li]; let acc=0;
    const unit=(q-p)/lt;
    let prevT=p;
    L.forEach((idx,k)=>{
      let t=p+acc*unit;                                            // predicted onset (frames)
      if(k>0){
        const lo=Math.max(prevT+unit*0.4,t-unit*0.5), hi=t+unit*0.5;
        let best=null, bs=Infinity;
        for(const d of dips){ if(d<lo) continue; if(d>hi) break; const score=Math.abs(d-t)/unit+fine[d]/(peak||1)*2; if(score<bs){ bs=score; best=d; } }
        if(best!==null) t=best;
      } else t=p;
      times[idx]=t/100; prevT=t; acc+=items[idx].w;
    });
  });
  for(let i=1;i<times.length;i++) if(times[i]<=times[i-1]) times[i]=times[i-1]+0.05;
}

/* ---------- playback with highlighting ---------- */
function play(rate, tick, end){
  if(!audio) return false;
  stop(); onTick=tick; audio.playbackRate=rate||1; audio.currentTime=0; cur=-1;
  audio.onended=()=>{ stop(); end&&end(); };
  audio.play();
  const loop=()=>{ if(!audio||audio.paused) return; const t=audio.currentTime; let i=-1; for(let k=0;k<times.length;k++){ if(times[k]<=t) i=k; else break; }
    if(tapMode&&i<0) i=-1; if(i!==cur){ cur=i; onTick&&onTick(i>=0?items[i]:null); } raf=requestAnimationFrame(loop); };
  raf=requestAnimationFrame(loop);
  return true;
}
function stop(){ cancelAnimationFrame(raf); if(audio){ audio.pause(); } stopFollow(); onTick&&onTick(null); cur=-1; if(tapMode) endTap(); }
function playing(){ return !!(audio&&!audio.paused)||!!follow; }

/* Tap to sync: play the recording and tap once at the start of every akṣara. */
function startTap(rate, tick, end){ if(!audio) return false; tapMode=true; tapTimes=[]; stop(); tapMode=true; onTick=tick; audio.playbackRate=rate||1; audio.currentTime=0; audio.onended=()=>{ endTap(); end&&end(); }; audio.play(); return true; }
function tap(){ if(!tapMode||!audio) return; tapTimes.push(audio.currentTime); const i=tapTimes.length-1; onTick&&onTick(items[i]||null); if(tapTimes.length>=items.length){ audio.pause(); endTap(); } }
function endTap(){ if(!tapMode) return; tapMode=false; if(tapTimes.length>=Math.min(items.length,3)){ for(let i=0;i<items.length;i++) times[i]= i<tapTimes.length? tapTimes[i] : times[i]; } }

/* ---------- record from the microphone ---------- */
async function startRecording(){
  micStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:true}});
  recChunks=[]; rec=new MediaRecorder(micStream);
  rec.ondataavailable=e=>{ if(e.data.size) recChunks.push(e.data); };
  rec.start();
}
function stopRecording(){
  return new Promise(res=>{ if(!rec){ res(null); return; }
    rec.onstop=()=>{ const blob=new Blob(recChunks,{type:rec.mimeType||'audio/webm'}); micStream.getTracks().forEach(t=>t.stop()); micStream=null; rec=null; res(blob); };
    rec.stop(); });
}

/* ---------- recite-along: follow the voice ---------- */
async function startFollow(tick, end){
  stop(); onTick=tick;
  const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});
  const c=ac(), src=c.createMediaStreamSource(stream), bp=c.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=900; bp.Q.value=0.7;
  const an=c.createAnalyser(); an.fftSize=1024; src.connect(bp); bp.connect(an);
  const data=new Float32Array(an.fftSize);
  let noise=0.004, above=false, lastOn=0, idx=-1, t0=performance.now(), quietSince=0;
  follow={stream,src,timer:0};
  const step=()=>{
    if(!follow) return;
    an.getFloatTimeDomainData(data); let s=0; for(const v of data) s+=v*v; const rms=Math.sqrt(s/data.length);
    const now=performance.now();
    if(now-t0<600){ noise=Math.max(noise,rms*1.5); }                // calibrate on the first half second
    const on=rms>noise*2.2, off=rms<noise*1.5;
    if(!above&&on&&now-lastOn>110){ above=true; lastOn=now; idx++; if(idx<items.length){ onTick&&onTick(items[idx]); } else { stopFollow(); end&&end(); return; } }
    else if(above&&off){ above=false; quietSince=now; }
    follow.timer=setTimeout(step,15);
  };
  step();
  return true;
}
function stopFollow(){ if(!follow) return; clearTimeout(follow.timer); follow.stream.getTracks().forEach(t=>t.stop()); follow=null; }

function exportTimings(){ return JSON.stringify({akṣaras:items.map((it,k)=>({pada:it.pi+1,aksara:it.i+1,text:root.PS.sylDev(it.s),guru:!!it.s.g,start:+(times[k]||0).toFixed(3)}))},null,1); }

root.PSPatha={setVerse,loadBlob,align,play,stop,playing,startTap,tap,startRecording,stopRecording,startFollow,stopFollow,exportTimings,hasAudio:()=>!!audio,isTapping:()=>tapMode,get count(){ return items.length; }};
})(window);
