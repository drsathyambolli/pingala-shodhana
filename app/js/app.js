/* Piṅgala-Śodhana — user interface. */
(function(){
'use strict';
const P=window.PS, LY=window.PSLaksana, SH=window.PSSahayaka, CH=window.PSChant, PA=window.PSPatha;
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const PADA_DEV=['प्रथमः पादः','द्वितीयः पादः','तृतीयः पादः','चतुर्थः पादः'];
const GANA_DEV={LGG:'य',GGG:'म',GGL:'त',GLG:'र',LGL:'ज',GLL:'भ',LLL:'न',LLG:'स'};
const SPECIAL_IDS=['anustubh','upajati','vamsopajati','arya','giti','upagiti','udgiti','aryagiti','vaitaliya','matrasamaka','gayatri','usnih','brhati','virat','pankti-vedic','tristubh','jagati-vedic'];
const CAT={sandhi:'Sandhi',kavisamaya:'Kavisamaya',arsa:'Ārṣa',textual:'Scribal / OCR',licence:'Reading'};

const SAMPLES=[
 {label:'Sarasvatī-vandanā · Śārdūlavikrīḍita',text:'या कुन्देन्दुतुषारहारधवला या शुभ्रवस्त्रावृता\nया वीणावरदण्डमण्डितकरा या श्वेतपद्मासना।\nया ब्रह्माच्युतशङ्करप्रभृतिभिर्देवैः सदा वन्दिता\nसा मां पातु सरस्वती भगवती निःशेषजाड्यापहा॥'},
 {label:'Same verse with copying errors · diagnosis demo',text:'या कुन्देन्दुतुषारहारधवला या शुभ्रवस्त्रवृता\nया वीणावरदण्डमण्डितकरा या श्वेतपद्मासना।\nया ब्रह्माच्युतशङ्करप्रभृतिभिर्देवैः सदा वन्दीता\nसा मां पातु सरस्वती भगवती निःशेषजाड्यापहा॥'},
 {label:'Rāmāyaṇa 1.1.2 · Anuṣṭubh',text:'को न्वस्मिन् साम्प्रतं लोके गुणवान् कश्च वीर्यवान्।\nधर्मज्ञश्च कृतज्ञश्च सत्यवाक्यो दृढव्रतः॥'},
 {label:'Bhagavad Gītā 2.47 · IAST',text:"karmaṇy evādhikāras te mā phaleṣu kadācana |\nmā karmaphalahetur bhūr mā te saṅgo 'stv akarmaṇi ||"},
 {label:'Kumārasambhava 1.1 · Upajāti',text:'अस्त्युत्तरस्यां दिशि देवतात्मा हिमालयो नाम नगाधिराजः।\nपूर्वापरौ तोयनिधी वगाह्य स्थितः पृथिव्या इव मानदण्डः॥'},
 {label:'Meghadūta 1 · Mandākrāntā',text:'कश्चित्कान्ताविरहगुरुणा स्वाधिकारात्प्रमत्तः\nशापेनास्तङ्गमितमहिमा वर्षभोग्येण भर्तुः।\nयक्षश्चक्रे जनकतनयास्नानपुण्योदकेषु\nस्निग्धच्छायातरुषु वसतिं रामगिर्याश्रमेषु॥'},
 {label:'Āryā lakṣaṇa · Āryā',text:'यस्याः पादे प्रथमे द्वादश मात्रास्तथा तृतीयेऽपि।\nअष्टादश द्वितीये चतुर्थके पञ्चदश सार्या॥'},
 {label:'Ṛgveda 1.1.1 · Gāyatrī (Vedic)',text:'अग्निमीळे पुरोहितं यज्ञस्य देवमृत्विजम्।\nहोतारं रत्नधातमम्॥'},
 {label:'Telugu script · Śārdūlavikrīḍita',text:'యా కున్దేన్దుతుషారహారధవలా యా శుభ్రవస్త్రావృతా\nయా వీణావరదణ్డమణ్డితకరా యా శ్వేతపద్మాసనా।'},
];
const S_SAMPLE='धर्मज्ञश्च कृतज्ञश्च सत्यवाक्यो दृढव्रतः\nरामो राजा सदा देवो वनं गच्छति सूर्यः';

const state={cmode:'voice',voiceURI:'',view:'sodhana',script:'deva',text:'',sText:S_SAMPLE,lText:'',lName:'',tempo:0.3,sa:146.83,drone:true,clicks:false,user:[]};
let current=null;          // {segs, ranked, chosen}
let play={padas:[],prefix:'s'};
function load(){ try{ Object.assign(state,JSON.parse(localStorage.getItem('pingala.v1')||'{}')); }catch(e){} }
function save(){ try{ localStorage.setItem('pingala.v1',JSON.stringify({script:state.script,text:state.text,sText:state.sText,lText:state.lText,lName:state.lName,tempo:state.tempo,sa:state.sa,drone:state.drone,clicks:state.clicks,user:state.user,cmode:state.cmode,voiceURI:state.voiceURI})); }catch(e){} }
let toastT; function toast(m,el='#toast'){ const t=$(el); if(!t) return; t.textContent=m; clearTimeout(toastT); toastT=setTimeout(()=>t.textContent='',4000); }
const sylText=s=>P.sylText(s,state.script);

/* ---------- shared renderers ---------- */
function stripHTML(syls, o={}){
  const mis=new Set(o.mis||[]), yset=new Set(o.yati||[]), pre=o.prefix||'x';
  let h='<div class="strip">';
  for(let i=0;i<syls.length;i+=3){
    const part=syls.slice(i,i+3), w=part.map(s=>s.g?'G':'L').join('');
    const lab=part.length===3?GANA_DEV[w]+'-गणः':part.map(s=>s.g?'ग':'ल').join(' ');
    h+='<div class="gana"><div class="gsyls">';
    part.forEach((s,k)=>{ const j=i+k, cls=['syl',s.g?'G':'L'];
      if(s.wb&&j<syls.length-1) cls.push('wb'); if(yset.has(j)) cls.push('yati'); if(mis.has(j)) cls.push('bad');
      const exp=mis.has(j)? `<span class="exp">${o.pat&&o.pat[j]&&o.pat[j]!=='?'?'want '+(o.pat[j]==='G'?'ऽ':'।'):'!'}</span>`:'';
      h+=`<div class="${cls.join(' ')}" id="${pre}-${o.pi||0}-${j}" title="${s.g?'guru':'laghu'}">${exp}<span class="ak">${esc(sylText(s))}</span><span class="mk">${s.g?'ऽ':'।'}</span></div>`; });
    h+=`</div><div class="glab">${lab}</div></div>`;
  }
  return h+'</div>';
}
function miniPattern(pats, yati, bad){
  let h='<div class="minip" aria-hidden="true">';
  pats.forEach((p,pi)=>{ const ys=new Set(); if(yati&&pi===0){ let acc=0; yati.slice(0,-1).forEach(y=>{acc+=y; ys.add(acc-1);}); }
    [...p].forEach((c,i)=>{ h+=`<span class="${c}${ys.has(i)?' y':''}${bad&&bad.has(pi+':'+i)?' x':''}"></span>`; }); if(pi<pats.length-1) h+='<span class="br"></span>'; });
  return h+'</div>';
}
function yatiPositions(M){ if(!M.yati) return null; const out=[]; let acc=0; M.yati.slice(0,-1).forEach(y=>{acc+=y; out.push(acc);}); return out; }
function metreFacts(M){
  const f=[];
  if(M.kind==='jati') f.push(`<span>Mātrās per pāda <b>${M.targets.join(' · ')}</b></span>`);
  else if(M.kind==='vedic') f.push(`<span>Akṣaras per pāda <b>${M.targets.join(' · ')}</b></span>`);
  else if(M.kind==='anus') f.push('<span>Akṣaras per pāda <b>8</b></span>');
  else f.push(`<span>Akṣaras per pāda <b>${[...new Set(M.lens)].join(' / ')}</b></span>`);
  if(M.class) f.push(`<span>Class <b>${M.class}</b></span>`);
  if(M.formula) f.push(`<span>Gaṇas <b class="formula">${M.formula}</b></span>`);
  if(M.yati) f.push(`<span>Yati <b>${M.yati.join(' · ')}</b></span>`);
  return `<div class="facts">${f.join('')}</div>`;
}
const kindLabel={sama:'Samavṛtta',ardha:'Ardhasamavṛtta',visama:'Viṣamavṛtta',jati:'Jāti',anus:'Śloka',upajati:'Upajāti',vedic:'Vedic'};

/* ---------- 1. Śodhana ---------- */
function analyse(){
  CH.stop();
  const segs=P.parseVerse(state.text), box=$('#result');
  if(!segs.length){ current=null; play.padas=[]; box.innerHTML='<div class="card empty">Type or paste a verse above, or choose a sample.</div>'; return; }
  const ranked=P.identify(segs,8);
  current={segs,ranked,chosen:0};
  renderAnalysis();
}
function renderAnalysis(){
  const {segs,ranked}=current, total=segs.reduce((a,s)=>a+s.length,0);
  const match=ranked[current.chosen], M=match.M;
  const known = current.chosen>0 || match.score<=Math.max(2,total*0.1);
  const isVedic = M.kind==='vedic';
  const padas = known? match.padas : segs.map((s,i)=>({syls:s,exp:i,strong:s.strong,mis:[],notes:[],lenOk:true}));
  play={padas,prefix:'s'};
  if(PA){ PA.setVerse(padas); if(PA.hasAudio()) PA.align(); }
  let h='<div class="card" style="display:grid;gap:8px">';
  if(known){
    const exact=isVedic? match.score<=1.01 : match.score<0.3, dev=Math.round(isVedic?match.score-1:match.score);
    h+=`<div class="metre-head"><h2 class="metre-name">${esc(M.dev)}</h2><span class="metre-lat">${esc(M.iast)}</span>
      <span class="pill ${exact?'good':'warn'}">${isVedic?(exact?'Vedic syllable count matches':'Vedic · close'):exact?'Exact match':`Closest · ${dev} deviation${dev===1?'':'s'}`}</span><span class="src">${kindLabel[M.kind]||''}</span></div>`;
    h+=metreFacts(M);
    if(M.aliases&&M.aliases.length) h+=`<div class="small-note">Also called ${M.aliases.slice(0,6).map(esc).join(', ')}</div>`;
    if(M.note) h+=`<div class="small-note">${esc(M.note)}</div>`;
    if(M.laksana) h+=`<div class="laksana">${esc(M.laksana)}</div>`;
  } else {
    h+=`<div class="metre-head"><h2 class="metre-name">अज्ञातम्</h2><span class="metre-lat">Not identified</span><span class="pill muted">no close match</span></div>
      <div class="small-note">Check that pāda breaks are marked with । or new lines. The nearest candidates are listed below; choose one to see where the verse departs from it.</div>`;
  }
  h+=`<div class="small-note">Candidates: ${ranked.slice(0,6).map((r,i)=>i===current.chosen?`<b>${esc(r.M.iast)} (${Math.round(r.score)})</b>`:`<button class="linkish" data-cand="${i}">${esc(r.M.iast)}</button> (${Math.round(r.score)})`).join(' · ')}</div>`;
  h+='</div>';
  if(known&&match.score>=0.3&&!isVedic){
    const hyps=P.diagnose(match);
    if(hyps.length){
      h+=`<div class="card diag"><h3>Why the verse deviates · निदानम्</h3><p class="small-note" style="margin:0">Hypotheses for each deviation, from the commonest causes in manuscripts and digital texts. The verse itself is not changed.</p>`;
      hyps.forEach(x=>{ h+=`<div class="hyp"><span class="cat ${x.cat}">${CAT[x.cat]}</span><span>${x.pi!=null?`<b>${PADA_DEV[match.padas[x.pi].exp%4]||'pāda'}${x.i!=null?`, akṣara ${x.i+1}`:''}:</b> `:''}${esc(x.text)}</span></div>`; });
      h+=`<div class="row"><button class="btn small" id="go-repair">Ask Chando-Sahāyaka for repairs</button></div></div>`;
    }
  }
  h+=`<div class="legend"><span><i class="lL"></i>laghu · 1 mātrā · ।</span><span><i class="lG"></i>guru · 2 mātrās · ऽ</span><span><i class="ly"></i>yati</span><span style="color:var(--bad)">red outline = breaks the metre</span></div>`;
  padas.forEach((p,pi)=>{
    const syls=p.syls, m=P.matra(syls), notes=[...(p.notes||[])];
    let ys=[];
    if(known&&M.yati&&M.kind==='sama'&&syls.length===M.lens[0]){ yatiPositions(M).forEach(y=>{ ys.push(y-1); notes.push(syls[y-1].wb?`yati after ${y} ✓ word break`:`yati after ${y}: no word break (fine only at a compound joint)`); }); }
    const label=known?(PADA_DEV[p.exp%4]||'पादः'):`Line ${pi+1}`;
    h+=`<div class="card pada"><div class="pada-head"><span class="pn">${label}</span><span>${syls.length} akṣaras</span><span>${m} mātrās</span><span class="marks">${syls.map(s=>s.g?'ऽ':'।').join('')}</span></div>`;
    if(notes.length) h+=`<div class="notes">${notes.map(n=>{ const bad=/should|both|no word/.test(n)||(/expected/.test(n)&&!p.lenOk); const good=/✓|pathyā|accepted/.test(n); return `<span class="note ${bad?'bad':good?'good':''}">${esc(n)}</span>`; }).join('')}</div>`;
    h+=stripHTML(syls,{mis:p.mis,pat:p.pat||p.want,yati:ys,prefix:'s',pi});
    h+='</div>';
  });
  $('#result').innerHTML=h;
}

/* ---------- 2. Sahāyaka ---------- */
let koshaLoading=null;
function loadKosha(){ if(window.PS_KOSHA) return Promise.resolve(); if(koshaLoading) return koshaLoading;
  koshaLoading=new Promise((res,rej)=>{ const s=document.createElement('script'); s.src='data/kosha.js'; s.onload=res; s.onerror=rej; document.body.appendChild(s); }); return koshaLoading; }
function fillMetreSelect(){
  const sel=$('#s-metre'), segs=P.parseVerse(state.sText), prev=sel.value;
  const near = segs.length? P.identify(segs,8).map(r=>r.M) : [];
  const core=P.METRES.filter(m=>m.src&&m.src[0]==='core');
  sel.innerHTML='<option value="">Closest metre (automatic)</option>'+
    (near.length?`<optgroup label="Nearest to this draft">${near.map(m=>`<option value="${m.id}">${esc(m.iast)}</option>`).join('')}</optgroup>`:'')+
    `<optgroup label="Common metres">${core.map(m=>`<option value="${m.id}">${esc(m.iast)}</option>`).join('')}</optgroup>`;
  if([...sel.options].some(o=>o.value===prev)) sel.value=prev;
}
async function runSahayaka(){
  const box=$('#s-result');
  $('#s-status').textContent='Loading the kośa…';
  try{ await loadKosha(); }catch(e){ $('#s-status').textContent='Could not load the synonym data.'; return; }
  $('#s-status').textContent='Searching…';
  await new Promise(r=>setTimeout(r,20));
  const t0=performance.now();
  const r=SH.suggest(state.sText, $('#s-metre').value||undefined, 12, $('#s-reorder').checked);
  $('#s-status').textContent='';
  if(!r.target){ box.innerHTML='<div class="card empty">Write a draft verse first.</div>'; return; }
  const segs=P.parseVerse(state.sText), base=P.scoreMetre(r.target,segs);
  const bad=new Set(); base.padas.forEach((p,pi)=>(p.mis||[]).forEach(i=>bad.add(pi+':'+i)));
  let h=`<div class="card" style="display:grid;gap:6px"><div class="metre-head"><h2 class="metre-name" style="font-size:26px">${esc(r.target.dev)}</h2><span class="metre-lat">${esc(r.target.iast)}</span>
    <span class="pill ${r.base<0.3?'good':'warn'}">${r.base<0.3?'Draft already fits':`Draft: ${Math.round(r.base)} deviation${Math.round(r.base)===1?'':'s'}`}</span></div>${metreFacts(r.target)}
    <div class="small-note">Draft rhythm</div>${miniPattern(base.padas.map(p=>P.wstr(p.syls)),null,bad)}
    <div class="small-note">${r.suggestions.length} suggestion${r.suggestions.length===1?'':'s'} in ${Math.round(performance.now()-t0)} ms. Check sandhi at any changed joint before you use one.</div></div>`;
  if(!r.suggestions.length) h+='<div class="card empty">No single or double edit improves this draft. Try another target metre, or rephrase the line that deviates most.</div>';
  const origWords=new Set(state.sText.split(/\s+/));
  r.suggestions.forEach((s,i)=>{
    const sc=P.scoreMetre(r.target,P.parseVerse(s.text)); const b2=new Set(); sc.padas.forEach((p,pi)=>(p.mis||[]).forEach(k=>b2.add(pi+':'+k)));
    const txt=s.text.split('\n').map(l=>l.split(' ').map(w=>origWords.has(w)?esc(w):`<mark>${esc(w)}</mark>`).join(' ')).join('\n');
    h+=`<div class="card sugg"><div class="row"><span class="pill ${s.score<0.3?'good':'warn'}">${s.score<0.3?'Fits the metre':`${Math.round(s.score)} deviation${Math.round(s.score)===1?'':'s'} left`}</span><span class="src">${esc(s.kind)}</span></div>
      <div class="txt">${txt}</div>${miniPattern(sc.padas.map(p=>P.wstr(p.syls)),null,b2)}
      <div class="chg">${s.changes.map(esc).join(' · ')}</div>
      <div class="row"><button class="btn small" data-use="${i}">Use this</button><button class="btn small" data-chant="${i}">Chant</button></div></div>`;
  });
  box.innerHTML=h; box._sugg=r.suggestions; box._target=r.target;
}

/* ---------- 3. Lakṣaṇa-Yantra ---------- */
const CORE=()=>P.METRES.filter(m=>m.laksana);
function runLaksana(){
  const text=state.lText.trim(), box=$('#l-result');
  if(!text){ box.innerHTML='<div class="card empty">Paste a lakṣaṇa or choose one above.</div>'; return; }
  const r=LY.readLaksana(text,state.lName||undefined);
  const first=r.scanned[0]||'';
  let match=null;
  if(first) match=P.METRES.filter(m=>m.pats&&m.kind!=='jati'&&(r.scanned.length===1? (m.pats[0].length===first.length&&m.pats[0].slice(0,-1)===first.slice(0,-1)) : (m.pats.length===2&&m.pats[0].slice(0,-1)===first.slice(0,-1)&&r.scanned[1]&&m.pats[1].slice(0,-1)===r.scanned[1].slice(0,-1))));
  const yPos=[]; if(r.yati.length&&r.yatiOk!==false){ let a=0; r.yati.slice(0,-1).forEach(y=>{a+=y; yPos.push(a-1);}); }
  let h=`<div class="card" style="display:grid;gap:10px"><div class="row"><span class="pill ${r.agree?'good':r.decoded?'warn':'muted'}">${r.agree?'Definition and verse agree':r.decoded?'Definition and verse differ':'No gaṇa words read'}</span>${r.yati.length?`<span class="pill ${r.yatiOk?'good':'warn'}">yati ${r.yati.join(' · ')} ${r.yatiOk?'✓':'?'}</span>`:''}</div>
    <dl class="kv"><dt>Gaṇas read from the words</dt><dd class="formula">${r.decoded?P.formulaDev(r.decoded):'—'}</dd>
    <dt>…as a pattern</dt><dd><code>${r.decodedPattern||'—'}</code></dd>
    <dt>The verse itself scans</dt><dd><code>${r.scanned.join(' | ')}</code> <span class="formula">(${r.scanned.map(p=>P.formulaDev(P.patternToFormula(p))).join(' | ')})</span></dd>
    <dt>Yati from number words</dt><dd>${r.yati.length?r.yati.join(' + ')+' = '+r.yati.reduce((a,b)=>a+b,0):'none stated'}</dd>
    <dt>In the database</dt><dd>${match&&match.length?match.slice(0,5).map(m=>`<b>${esc(m.iast)}</b> <span class="small-note">${esc(m.dev)}</span>`).join(', '):'not found: a new metre for your collection'}</dd></dl>
    ${r.notes.length?`<div class="notes">${r.notes.map(n=>`<span class="note">${esc(n)}</span>`).join('')}</div>`:''}`;
  r.segs.forEach((s,pi)=>{ h+=stripHTML(s,{prefix:'l',pi,yati:pi===0?yPos:[]}); });
  h+=`<div class="row"><button class="btn small" id="l-add" ${r.agree?'':'disabled'}>Add to my metres</button><button class="btn small" id="l-json">Copy as database entry</button><button class="btn small" id="l-chant">Chant the lakṣaṇa</button></div></div>`;
  box.innerHTML=h; box._r=r; play={padas:r.segs.map((s,i)=>({syls:s,exp:i,strong:s.strong})),prefix:'l'};
}
function laksanaEntry(r){
  const name=state.lName||'user-metre', pats=r.scanned.length===1?[r.scanned[0]]:r.scanned.slice(0,2);
  return {id:'user-'+(name.replace(/\s+/g,'-')),iast:name,dev:name,kind:pats.length===1?'sama':'ardha',pats,yati:r.yati.length&&r.yatiOk?r.yati:undefined,src:['user'],laksana:r.text,laksana_decoded:r.decoded,laksana_agree:r.agree};
}
function runEval(){
  const rows=CORE().filter(m=>m.src[0]==='core'&&m.kind!=='anus'&&m.kind!=='jati'&&m.kind!=='upajati');
  let ok=0, okY=0, nY=0, okS=0;
  const trs=rows.map(m=>{ const r=LY.readLaksana(m.laksana,m.dev); const want=m.f||''; const wantF=want.replace('|','');
    const g=r.decoded===wantF; ok+=g; const self=r.scanned[0]&&r.scanned[0].slice(0,-1)===m.pats[0].slice(0,-1)&&r.scanned[0].length===m.pats[0].length; okS+=self;
    const cut=(y,L)=>{ const out=[]; let a=0; y.forEach(v=>{ a+=v; if(a<L) out.push(a); }); return out.join(); };
    const statedY=r.yati.length>0; if(statedY){ nY++; okY+=!!(m.yati&&cut(r.yati,m.pats[0].length)===cut(m.yati,m.pats[0].length)); }
    return `<tr><td class="dv">${esc(m.dev)}</td><td>${self?'✓':'✗'}</td><td class="formula">${r.decoded?P.formulaDev(r.decoded):'—'}</td><td>${g?'✓':'✗'}</td><td>${r.yati.join('·')||'—'}</td></tr>`; });
  $('#l-eval-out').innerHTML=`<p><b>${okS}/${rows.length}</b> lakṣaṇas scan in their own metre · gaṇas read correctly in <b>${ok}/${rows.length}</b> · yati read correctly in <b>${okY}/${nY}</b> lakṣaṇas that state one.</p>
    <table class="eval"><thead><tr><th>Metre</th><th>Self-scan</th><th>Gaṇas read</th><th>Correct</th><th>Yati</th></tr></thead><tbody>${trs.join('')}</tbody></table>`;
}

/* ---------- 4. Kośa ---------- */
let libShown=60;
function libList(){
  const q=($('#q').value||'').trim().toLowerCase(), kind=$('#f-kind').value, len=$('#f-len').value, src=$('#f-src').value;
  const qPat=/^[lg]+$/i.test(q)?q.toUpperCase():null;
  return P.METRES.filter(M=>{
    if(kind==='special'){ if(!['anus','upajati'].includes(M.kind)) return false; } else if(kind&&M.kind!==kind) return false;
    if(len&&!(M.lens&&M.kind!=='jati'&&M.kind!=='vedic'&&M.lens[0]===+len)) return false;
    if(src&&!(M.src||[]).includes(src)) return false;
    if(!q) return true;
    if(qPat) return (M.pats||[]).some(p=>p.includes(qPat));
    const hay=(M.iast+' '+M.dev+' '+(M.aliases||[]).join(' ')+' '+(M.formula||'')+' '+(M.class||'')+' '+(M.lens?M.lens[0]:'')).toLowerCase();
    return q.split(/\s+/).every(t=>hay.includes(t));
  });
}
function renderLib(reset){
  if(reset) libShown=60;
  const list=libList();
  $('#lib-count').textContent=`${list.length.toLocaleString()} metre${list.length===1?'':'s'}`;
  $('#lib').innerHTML=list.slice(0,libShown).map(M=>{
    const size=M.kind==='jati'?`${M.targets.join('·')} mātrās`:M.kind==='vedic'?`${M.targets.join('+')} akṣaras`:M.kind==='anus'?'8 akṣaras':`${[...new Set(M.lens)].join('/')} akṣaras`;
    return `<div class="card mcard"><div><h4>${esc(M.dev)}</h4><div class="lat">${esc(M.iast)}</div></div>
      ${M.pats&&M.kind!=='jati'?miniPattern(M.kind==='upajati'?[M.pats[0]]:M.pats,M.yati):''}
      <div class="facts"><span><b>${size}</b></span>${M.class?`<span>${M.class}</span>`:''}<span>${kindLabel[M.kind]||''}</span>${M.yati?`<span>yati ${M.yati.join('·')}</span>`:''}</div>
      ${M.formula?`<div class="formula">${M.formula}</div>`:''}
      ${M.aliases&&M.aliases.length?`<div class="small-note">Also: ${M.aliases.slice(0,5).map(esc).join(', ')}</div>`:''}
      ${M.note?`<div class="small-note">${esc(M.note)}</div>`:''}
      ${M.laksana?`<div class="laksana">${esc(M.laksana)}</div>`:''}
      <div class="row">${(M.src||[]).map(s=>`<span class="src">${esc(s)}</span>`).join('')}</div>
      <div class="row">${M.pats&&M.kind!=='jati'?`<button class="btn small" data-pchant="${M.id}">Chant the pattern</button>`:''}${M.laksana?`<button class="btn small" data-ltry="${M.id}">Scan lakṣaṇa</button><button class="btn small" data-lread="${M.id}">Read in Yantra</button>`:''}</div></div>`;
  }).join('')||'<div class="empty">No metre matches.</div>';
  $('#lib-more').hidden=list.length<=libShown;
}
function patternPadas(M){
  const pats=M.kind==='ardha'?[M.pats[0],M.pats[1],M.pats[0],M.pats[1]]:M.kind==='visama'?M.pats:[M.pats[0],M.pats[0],M.pats[0],M.pats[0]];
  return pats.map((p,i)=>({exp:i,strong:i===3,syls:[...p].map((c,k)=>({on:['t'],v:c==='G'?'ā':'a',coda:[],m:false,h:false,n:false,g:c==='G',wb:k===p.length-1,dummy:true}))}));
}

/* ---------- 5. About ---------- */
function renderAbout(){
  const n=P.METRES.length;
  $('#about-body').innerHTML=`
  <h3 style="margin-top:0">Piṅgala-Śodhana · पिङ्गल-शोधनम्</h3>
  <p>A sandhi-aware computational framework for detecting and explaining metrical anomalies in Sanskrit verse. Five tools work on one prosodic engine: <b>Śodhana</b> (scansion, identification among ${n.toLocaleString()} metres, and diagnosis), <b>chanting</b> in time with the scansion, <b>Chando-Sahāyaka</b> (metre repair for composers), <b>Lakṣaṇa-Yantra</b> (reading metre definitions from the śāstra) and the <b>Chandaḥ-kośa</b>.</p>
  <h3>How it reads a verse</h3>
  <ol><li>The verse is scanned as written, in saṃhitā. A short vowel before a conjunct is guru even across a word boundary, so sandhi is never undone before scanning.</li>
  <li>Akṣaras get weights by the classical rules (long vowel, anusvāra, visarga, conjunct, closed pāda-final syllable). The pāda-final akṣara may be either.</li>
  <li>Lines are cut into pādas to fit each candidate metre (a line may hold one, two or four pādas) and compared syllable by syllable. Anuṣṭubh is checked by its rules (5th laghu, 6th guru, 7th by pāda, vipulā variants), and the Āryā family by mātrā counts.</li>
  <li>For the closest metre, every deviation gets hypotheses: <span class="cat sandhi">Sandhi</span> <span class="cat kavisamaya">Kavisamaya</span> <span class="cat arsa">Ārṣa</span> <span class="cat textual">Scribal / OCR</span>. Yati is checked against real word breaks, which is where knowing the word boundaries matters.</li></ol>
  <h3>Lakṣaṇa-Yantra</h3>
  <p>A lakṣaṇa verse names its gaṇas in a coded vocabulary (म्भौ नतौ ताद्गुरू …) and its yati with number words (जलधि-षड्-अगैः = 4 · 6 · 7), and it is itself composed in the metre it defines. The Yantra reads both and accepts a metre only when they agree.</p>
  <h3>Pāṭha</h3>
  <p>Chanting with a real voice: record or load a recitation and the app lines it up with the scansion, so each akṣara lights up as it is sung. Recite along follows your own voice from the microphone.</p>
  <h3>Chando-Sahāyaka</h3>
  <p>Proposes edits that make a draft fit a metre while keeping its meaning: kośa synonyms of the same liṅga and ending, pāda-pūraṇa particles, and word order. Every candidate is rescanned and ranked.</p>
  <h3>Team PINGALA · पिङ्गल</h3>
  <p><b>Dr Sathyam Bolli</b>. PGDSCL, Karnataka Samskrit University and Central Sanskrit University, 2026–27.</p>
  <p class="small-note">Source code, Python package and licence information are in the project's GitHub repository.</p>`;
}

/* ---------- routing & wiring ---------- */
const VIEWS=['sodhana','sahayaka','laksana','kosa','about'];
function route(){
  let v=location.hash.replace('#','')||'sodhana'; if(!VIEWS.includes(v)) v='sodhana';
  state.view=v; CH.stop();
  VIEWS.forEach(x=>{ $('#view-'+x).hidden=x!==v; });
  document.querySelectorAll('nav.tabs a').forEach(a=>{ if(a.dataset.view===v) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current'); });
  if(v==='sodhana'&&current) renderAnalysis();
  if(v==='sahayaka'){ fillMetreSelect(); loadKosha().catch(()=>{}); }
  if(v==='kosa') renderLib(false);
  if(v==='about') renderAbout();
  if(v==='laksana'&&$('#l-result').innerHTML==='') runLaksana();
}
function setPlayIcon(on){ $('#play').innerHTML=on?'<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4.5" height="14" rx="1"/><rect x="13.5" y="5" width="4.5" height="14" rx="1"/></svg>':'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg>'; $('#play').setAttribute('aria-label',on?'Stop chanting':'Chant the verse'); }
let nowEl=null;
async function chant(padas,prefix){
  if(CH.isPlaying()){ CH.stop(); return; }
  if(!padas||!padas.length){ toast('Nothing to chant yet.'); return; }
  setPlayIcon(true);
  const opts={tempo:state.tempo,sa:state.sa,drone:state.drone,clicks:state.clicks,voiceURI:state.voiceURI,
      onTick:e=>{ if(nowEl){ nowEl.classList.remove('now'); nowEl=null; }
        if(e){ const el=prefix?document.getElementById(`${prefix}-${e.pi}-${e.i}`):null; if(el){ el.classList.add('now'); nowEl=el; }
          $('#now-ak').textContent=e.s.dummy?(e.s.g?'ता':'त'):sylText(e.s); $('#now-meta').textContent=e.s.g?'guru · 2 mātrās':'laghu · 1 mātrā'; }
        else { $('#now-ak').textContent='–'; $('#now-meta').textContent='Press play to chant. Guru akṣaras last two mātrās, laghu one.'; } },
      onEnd:()=>setPlayIcon(false)};
  const dummy=padas.some(p=>p.syls.some(s=>s.dummy));
  try{
    if(state.cmode==='voice'&&!dummy){
      const ok=await CH.recite(padas,opts);
      if(ok) return;
      toast('No Hindi or Sanskrit voice on this device, so playing the rhythm hum. In Chrome, the “Google हिन्दी” voice works; on Windows add Hindi under Settings → Time & language → Speech.');
    }
    CH.play(padas,opts);
  }catch(err){ setPlayIcon(false); toast('Audio is not available in this browser.'); }
}
async function fillVoices(){
  const sel=$('#voice'); const list=await CH.whenVoices(2500);
  if(!list.length){ sel.innerHTML='<option value="">No Indian voice found</option>'; return; }
  sel.innerHTML=list.map(v=>`<option value="${esc(v.voiceURI)}">${esc(v.name)} (${esc(v.lang)})${/^en/i.test(v.lang)?' · phonetic':''}</option>`).join('');
  if(list.some(v=>v.voiceURI===state.voiceURI)) sel.value=state.voiceURI; else { state.voiceURI=list[0].voiceURI; }
}

/* ---------- Pāṭha wiring ---------- */
function hl(it){ if(nowEl){ nowEl.classList.remove('now'); nowEl=null; }
  if(it){ const el=document.getElementById(`s-${it.pi}-${it.i}`); if(el){ el.classList.add('now'); nowEl=el; if(el.getBoundingClientRect().top>window.innerHeight-160) el.scrollIntoView({block:'center',behavior:'smooth'}); }
    $('#now-ak').textContent=sylText(it.s); $('#now-meta').textContent=it.s.g?'guru · 2 mātrās':'laghu · 1 mātrā'; }
  else { $('#now-ak').textContent='–'; } }
const pst=m=>{ $('#p-status').textContent=m; };
function micError(e){ pst(e&&e.name==='NotAllowedError'?'Microphone permission was refused. Allow it in the browser and try again.':'The microphone is not available in this view. Open the app at drsathyambolli.github.io/pingala-shodhana, or use Load audio.'); }
function enablePatha(on){ ['#p-play','#p-tap','#p-export'].forEach(s=>$(s).disabled=!on); }
function wirePatha(){
  if(!PA) return;
  let recording=false;
  $('#p-rec').onclick=async()=>{
    if(!recording){ try{ CH.stop(); PA.stop(); await PA.startRecording(); recording=true; $('#p-rec').textContent='■ Stop recording'; pst('Recording… chant the verse, then press Stop.'); }catch(e){ micError(e); } return; }
    recording=false; $('#p-rec').textContent='● Record'; const blob=await PA.stopRecording(); if(!blob) return;
    try{ const d=await PA.loadBlob(blob); enablePatha(true); pst(`Recorded ${d.toFixed(1)} s · lined up with ${PA.count} akṣaras. Press Play.`); }catch(e){ pst('Could not read the recording.'); }
  };
  $('#p-file').onchange=async e=>{ const f=e.target.files[0]; if(!f) return; pst('Reading the audio…');
    try{ const d=await PA.loadBlob(f); enablePatha(true); pst(`${f.name} · ${d.toFixed(1)} s · lined up with ${PA.count} akṣaras. Press Play.`); }catch(err){ pst('This audio file could not be decoded. Try MP3, WAV, M4A or OGG.'); } e.target.value=''; };
  $('#p-play').onclick=()=>{ if(PA.playing()){ PA.stop(); $('#p-play').textContent='▶ Play with highlighting'; return; }
    CH.stop(); if(PA.play(+$('#p-rate').value,hl,()=>{ $('#p-play').textContent='▶ Play with highlighting'; hl(null); })) $('#p-play').textContent='■ Stop'; };
  $('#p-tap').onclick=()=>{
    if(PA.isTapping()){ PA.tap(); return; }
    CH.stop(); if(PA.startTap(+$('#p-rate').value,hl,()=>{ $('#p-tap').textContent='Tap to sync'; pst('Timing updated from your taps. Press Play to check.'); })){ $('#p-tap').textContent='Tap here at each akṣara (or Space)'; pst('Tap once at the start of every akṣara as you hear it.'); } };
  document.addEventListener('keydown',e=>{ if(e.code==='Space'&&PA.isTapping()){ e.preventDefault(); PA.tap(); } });
  let following=false;
  $('#p-follow').onclick=async()=>{
    if(following){ following=false; PA.stopFollow(); $('#p-follow').textContent='Recite along'; hl(null); pst(''); return; }
    try{ CH.stop(); PA.stop(); await PA.startFollow(hl,()=>{ following=false; $('#p-follow').textContent='Recite along'; pst('Verse complete.'); }); following=true; $('#p-follow').textContent='■ Stop reciting'; pst('Listening… start chanting. Each akṣara lights up as you voice it.'); }catch(e){ micError(e); } };
  $('#p-export').onclick=()=>{ const t=PA.exportTimings(); if(navigator.clipboard) navigator.clipboard.writeText(t).then(()=>pst('Akṣara timings copied (JSON).'),()=>pst('Copy was blocked by the browser.')); };
}

function start(){
  load();
  if(window.PS_METRES) P.loadMetres(window.PS_METRES);
  state.user.forEach(u=>{ if(!P.METRES.some(m=>m.id===u.id)) P.METRES.push(Object.assign({},u)); });
  P.loadMetres({metres:P.METRES.filter(m=>!SPECIAL_IDS.includes(m.id))});
  $('#metre-count').textContent=P.METRES.length.toLocaleString();
  const lens=[...new Set(P.METRES.filter(m=>m.kind==='sama').map(m=>m.lens[0]))].sort((a,b)=>a-b);
  $('#f-len').innerHTML='<option value="">Any length</option>'+lens.map(l=>`<option value="${l}">${l} akṣaras${P.CLASS[l]?' · '+P.CLASS[l]:''}</option>`).join('');
  const sel=$('#samples'); sel.innerHTML='<option value="">Load a sample verse…</option>'+SAMPLES.map((s,i)=>`<option value="${i}">${esc(s.label)}</option>`).join('');
  if(!state.text) state.text=SAMPLES[0].text;
  $('#verse').value=state.text; $('#script').value=state.script; $('#s-verse').value=state.sText;
  const core=CORE(); $('#l-samples').innerHTML='<option value="">Load a lakṣaṇa…</option>'+core.map(m=>`<option value="${m.id}">${esc(m.iast)}</option>`).join('');
  if(!state.lText){ const m=core.find(x=>x.id==='mandakranta')||core[0]; state.lText=m.laksana; state.lName=m.dev; }
  $('#l-text').value=state.lText; $('#l-name').value=state.lName;
  $('#tempo').value=state.tempo; $('#sa').value=String(state.sa); $('#drone').checked=state.drone; $('#clicks').checked=state.clicks;
  try{ if(matchMedia('(min-width:700px)').matches) $('#settings-d').open=true; }catch(e){}
  let deb;
  $('#verse').addEventListener('input',e=>{ state.text=e.target.value; clearTimeout(deb); deb=setTimeout(()=>{ save(); analyse(); },250); });
  sel.addEventListener('change',()=>{ if(sel.value==='') return; state.text=SAMPLES[+sel.value].text; $('#verse').value=state.text; save(); analyse(); sel.value=''; });
  $('#script').onchange=e=>{ state.script=e.target.value; save(); if(current) renderAnalysis(); if(state.view==='laksana') runLaksana(); };
  $('#clear').onclick=()=>{ state.text=''; $('#verse').value=''; save(); analyse(); $('#verse').focus(); };
  $('#copy').onclick=()=>{ if(!current) return; const m=current.ranked[current.chosen]; const lines=play.padas.map(p=>p.syls.map(sylText).join(' ')+'\n'+p.syls.map(s=>s.g?'ऽ':'।').join(' '));
    const txt=`${m.M.dev} (${m.M.iast})\n\n`+lines.join('\n\n'); if(navigator.clipboard) navigator.clipboard.writeText(txt).then(()=>toast('Scansion copied.'),()=>toast('Copy was blocked by the browser.')); };
  const toRepair=()=>{ state.sText=state.text.replace(/[।॥|]/g,'').replace(/[ \t]+\n/g,'\n').trim(); $('#s-verse').value=state.sText; save(); location.hash='sahayaka';
    setTimeout(()=>{ if(current){ const id=current.ranked[current.chosen].M.id; fillMetreSelect(); if([...$('#s-metre').options].some(o=>o.value===id)) $('#s-metre').value=id; } runSahayaka(); },30); };
  $('#to-repair').onclick=toRepair;
  $('#result').addEventListener('click',e=>{ const c=e.target.closest('[data-cand]'); if(c){ current.chosen=+c.dataset.cand; renderAnalysis(); } if(e.target.closest('#go-repair')) toRepair(); });
  $('#s-verse').addEventListener('input',e=>{ state.sText=e.target.value; save(); clearTimeout(deb); deb=setTimeout(fillMetreSelect,400); });
  $('#s-run').onclick=runSahayaka;
  $('#s-result').addEventListener('click',e=>{ const box=$('#s-result'); const u=e.target.closest('[data-use]'), c=e.target.closest('[data-chant]');
    if(u){ const s=box._sugg[+u.dataset.use]; state.sText=s.text; $('#s-verse').value=s.text; state.text=s.text; $('#verse').value=s.text; save(); analyse(); toast('Applied. The Scan tab shows the new verse.','#s-status'); }
    if(c){ const s=box._sugg[+c.dataset.chant]; const sc=P.scoreMetre(box._target,P.parseVerse(s.text)); chant(sc.padas,null); } });
  $('#l-text').addEventListener('input',e=>{ state.lText=e.target.value; save(); });
  $('#l-name').addEventListener('input',e=>{ state.lName=e.target.value; save(); });
  $('#l-samples').onchange=e=>{ const m=P.METRES.find(x=>x.id===e.target.value); if(!m) return; state.lText=m.laksana; state.lName=m.dev; $('#l-text').value=m.laksana; $('#l-name').value=m.dev; save(); runLaksana(); e.target.value=''; };
  $('#l-run').onclick=runLaksana; $('#l-eval').onclick=runEval;
  $('#l-result').addEventListener('click',e=>{ const r=$('#l-result')._r; if(!r) return;
    if(e.target.id==='l-add'){ const ent=laksanaEntry(r); state.user=state.user.filter(u=>u.id!==ent.id).concat([ent]); save(); P.METRES.push(ent); P.loadMetres({metres:P.METRES.filter(m=>!SPECIAL_IDS.includes(m.id))}); toast('Added to your metres (kept in this browser).','#toast'); e.target.textContent='Added ✓'; e.target.disabled=true; }
    if(e.target.id==='l-json'){ const t=JSON.stringify(laksanaEntry(r),null,1); if(navigator.clipboard) navigator.clipboard.writeText(t).then(()=>{ e.target.textContent='Copied ✓'; },()=>{}); }
    if(e.target.id==='l-chant'){ chant(play.padas,'l'); } });
  $('#q').addEventListener('input',()=>renderLib(true)); ['#f-kind','#f-len','#f-src'].forEach(s=>$(s).addEventListener('change',()=>renderLib(true)));
  $('#lib-more').onclick=()=>{ libShown+=60; renderLib(false); };
  $('#lib').addEventListener('click',e=>{ const p=e.target.closest('[data-pchant]'), t=e.target.closest('[data-ltry]'), r=e.target.closest('[data-lread]');
    if(p){ const M=P.METRES.find(m=>m.id===p.dataset.pchant); chant(patternPadas(M),null); }
    if(t){ const M=P.METRES.find(m=>m.id===t.dataset.ltry); state.text=M.laksana; $('#verse').value=M.laksana; save(); location.hash='sodhana'; analyse(); window.scrollTo({top:0}); }
    if(r){ const M=P.METRES.find(m=>m.id===r.dataset.lread); state.lText=M.laksana; state.lName=M.dev; $('#l-text').value=M.laksana; $('#l-name').value=M.dev; save(); location.hash='laksana'; runLaksana(); window.scrollTo({top:0}); } });
  $('#play').onclick=()=>chant(play.padas,play.prefix);
  $('#tempo').oninput=e=>{ state.tempo=+e.target.value; save(); };
  $('#sa').onchange=e=>{ state.sa=+e.target.value; save(); };
  $('#drone').onchange=e=>{ state.drone=e.target.checked; save(); };
  $('#clicks').onchange=e=>{ state.clicks=e.target.checked; save(); };
  $('#cmode').value=state.cmode; $('#cmode').onchange=e=>{ state.cmode=e.target.value; save(); };
  $('#voice').onchange=e=>{ state.voiceURI=e.target.value; save(); };
  fillVoices(); if('speechSynthesis' in window&&speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged',fillVoices);
  window.addEventListener('hashchange',route);
  wirePatha();
  analyse(); route();
}
start();
})();
