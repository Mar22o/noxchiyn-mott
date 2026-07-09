/* Noxchiyn Mott — logique de l'application
   Données : window.NM_DATA (dict.js), window.NM_PHRASES (phrases.js) */
"use strict";

/* ---------- protections ---------- */
// anti-clickjacking : si le site est chargé dans une iframe d'un autre domaine, on s'en échappe
try{ if(window.top!==window.self) window.top.location=window.self.location; }catch(e){}

/* ---------- utilitaires ---------- */
// Normalisation : minuscules + toutes les variantes de palotchka -> ӏ
function norm(s){
  return (s||"").toLowerCase()
    .replace(/[Ӏ1|]/g,"ӏ").replace(/i(?=[а-яёӏ])/g,"ӏ")
    .replace(/ё/g,"е").replace(/\s+/g," ").trim();
}
function normFr(s){ // pour chercher côté fr/en/ru : minuscules + accents pliés
  return (s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"")
    .replace(/œ/g,"oe").replace(/\s+/g," ").trim();
}
const isCyr = s => /[а-яёӏ]/i.test(s);

// Translittération cyrillique -> latin (pratique)
const TRANSLIT = [["аь","ä"],["оь","ö"],["уь","ü"],["гӏ","gh"],["кх","q"],["къ","q'"],["кӏ","k'"],
["пӏ","p'"],["тӏ","t'"],["хь","h'"],["хӏ","h"],["цӏ","ts'"],["чӏ","ch'"],["ц","ts"],["ч","ch"],
["ш","sh"],["щ","sch"],["ж","zh"],["х","kh"],["ю","yu"],["я","ya"],["е","e"],["ъ","ʺ"],["ь",""],
["а","a"],["б","b"],["в","v"],["г","g"],["д","d"],["з","z"],["и","i"],["й","y"],["к","k"],["л","l"],
["м","m"],["н","n"],["о","o"],["п","p"],["р","r"],["с","s"],["т","t"],["у","u"],["ф","f"],["ы","y"],
["э","e"],["ӏ","ʼ"]];
function translit(s){
  s=(s||"").toLowerCase().replace(/[Ӏ]/g,"ӏ");
  let out="",i=0;
  while(i<s.length){
    let hit=null;
    for(const [c,l] of TRANSLIT){ if(s.startsWith(c,i)){hit=l;i+=c.length;break;} }
    if(hit===null){out+=s[i];i++;} else out+=hit;
  }
  return out;
}
const esc = s => (s||"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

/* ---------- index de recherche ---------- */
const W = NM_DATA.wikt, R = NM_DATA.ru;
const POS_FR = {noun:"nom",adj:"adj.",verb:"verbe",adv:"adv.",pron:"pron.",num:"nombre",conj:"conj.",intj:"interj.",particle:"part.",phrase:"expr."};
const idxCe=new Map(), idxFr=new Map(), idxEn=new Map(), idxRu=new Map();
function addIdx(map,key,ref){ key=key.trim(); if(!key)return;
  if(!map.has(key)) map.set(key,[]); map.get(key).push(ref); }
function tokens(s){ return (s||"").split(/[,;/]| ou /).map(t=>t.replace(/\(.*?\)/g,"").trim()).filter(Boolean); }
W.forEach((e,i)=>{ const ref={t:"w",i};
  addIdx(idxCe,norm(e.c),ref);
  tokens(e.f).forEach(t=>addIdx(idxFr,normFr(t),ref));
  tokens(e.e).forEach(t=>addIdx(idxEn,normFr(t),ref));
  if(e.r) tokens(e.r).forEach(t=>addIdx(idxRu,normFr(t),ref)); // gloses du Wiktionary russe
});
R.forEach((e,i)=>{ const ref={t:"r",i};
  addIdx(idxCe,norm(e.c),ref);
  tokens(e.r).forEach(t=>addIdx(idxRu,normFr(t),ref));
});

function lookup(q,lang){
  // retourne {exact:[], partial:[]} de refs
  const map={ce:idxCe,fr:idxFr,en:idxEn,ru:idxRu}[lang];
  const nq=(lang==="ce")?norm(q):normFr(q);
  if(!nq) return {exact:[],partial:[]};
  const exact=map.get(nq)||[];
  const partial=[];
  if(nq.length>=2){
    for(const [k,refs] of map){
      if(k!==nq && (k.startsWith(nq) || (nq.length>=4 && k.includes(nq)))){
        partial.push(...refs);
        if(partial.length>60) break;
      }
    }
  }
  return {exact,partial};
}
// mots-outils ignorés dans le mot à mot (ils polluaient les résultats)
const STOP_FR=new Set("le la les l un une des de du d en y ce cet cette ces se sa son ses mon ma mes ton ta tes notre nos votre vos leur leurs je tu il elle on nous vous ils elles me te lui ne pas plus que qui quoi dont ou et mais donc or ni car a au aux dans pour par sur sous avec sans est es suis sommes etes sont etait etais serai sera ai as avons avez ont avait aura tres trop peu si comme vais vas va allons allez vont aller fais fait faisons faites font faire veux veut voulons voulez veulent vouloir peux peut pouvons pouvez peuvent dois doit devons devez doivent quand quel quelle quels quelles dire dis dit chez cela quelqu quelque".split(" "));
const STOP_EN=new Set("the a an to of in on at is are am was were be been do does did and or but not no i you he she it we they me him her us them my your his its our their this that these those go going goes went want wants need needs say says said what when someone somebody".split(" "));
const STOP_RU=new Set("и в на не с к у о а же бы ли что как это я ты он она оно мы вы они мой твой его ее наш ваш их за из по до от для при иду идет хочу хочет надо нужно если когда кто-то сказать говорить".split(" "));
function isStop(w,lang){const x=normFr(w);
  return lang==="fr"?STOP_FR.has(x):lang==="en"?STOP_EN.has(x):lang==="ru"?STOP_RU.has(x):false;}

/* ---------- classes nominales (в/й/б/д) ---------- */
// code Wiktionary : 1re lettre = classe du singulier, 2e = classe du pluriel
const CLS_LET={v:{p:"в-",c:"ву"},j:{p:"й-",c:"ю"},b:{p:"б-",c:"бу"},d:{p:"д-",c:"ду"}};
function classInfo(k){
  if(!k) return null;
  const s=String(k).toLowerCase();
  const m=s.match(/^([vjbd])/); if(!m) return null;
  const sg=CLS_LET[m[1]];
  const p=s.match(/^[vjbd]([vjbd])/);
  return {sg:sg, pl:p?CLS_LET[p[1]]:null, code:s};
}

const SRC_LBL={"tchetchene.free.fr":"tchetchene.free.fr","waynakh":"Waynakh","ling073":"LING073",
  "ruwikt":"Wiktionary (ru)","diasporaTR":"diaspora TR"};
function refData(ref){
  if(ref.t==="w"){ const e=W[ref.i];
    return {ce:e.c,fr:e.f||"",en:e.e||"",ru:e.r||"",tr:e.t||"",cls_n:e.k||"",pos:POS_FR[e.p]||e.p,
      src:e.s?(SRC_LBL[e.s]||e.s):"Wiktionary",
      cls:(!e.s||e.s==="ruwikt")?"b-high":"b-mid",v:e.v}; }
  const e=R[ref.i];
  return {ce:e.c,fr:"",en:"",ru:e.r,tr:"",cls_n:e.k||"",pos:"",src:e.s||"Matsiev",cls:"b-high"};
}
function entryHtml(d,dst){
  let tr=[];
  if(d.fr) tr.push(esc(d.fr));
  if(d.ru && (dst==="ru"||!d.fr)) tr.push("🇷🇺 "+esc(d.ru));
  else if(d.ru) tr.push('<span class="lat">ru : '+esc(d.ru)+"</span>");
  if(d.en && dst==="en") tr.unshift(esc(d.en));
  else if(d.en && !d.fr) tr.push('<span class="lat">en : '+esc(d.en)+"</span>");
  if(d.v) tr.push('<span class="lat">variante de '+esc(d.v)+"</span>");
  return `<div class="entry"><span class="ce">${esc(d.ce)}</span>
    <span class="lat">${esc(translit(d.ce))}</span>
    ${d.pos?`<span class="pos">${esc(d.pos)}</span>`:""}
    <span class="tr">${tr.join(" · ")}</span></div>`;
}
function dedupe(refs){
  const seen=new Set(), out=[];
  for(const r of refs){ const k=r.t+r.i; if(!seen.has(k)){seen.add(k);out.push(r);} }
  return out;
}
// affichage groupé : un mot tchétchène = une carte, avec TOUS ses sens et leur définition
function renderGrouped(refs,dst){
  const groups=new Map();
  for(const r of refs){ const d=refData(r);
    if(!groups.has(d.ce)) groups.set(d.ce,[]);
    groups.get(d.ce).push(d); }
  let html="";
  for(const [ce,senses] of groups){
    html+=`<div class="entry"><span class="ce">${esc(ce)}</span><span class="lat">${esc(translit(ce))}</span><div class="senses">`;
    const seen=new Set();
    for(const d of senses.slice(0,7)){
      const key=(d.fr||"")+"|"+(d.en||"")+"|"+(d.ru||"");
      if(seen.has(key)) continue; seen.add(key);
      let tr=[];
      if(d.fr) tr.push(esc(d.fr));
      if(d.ru&&(dst==="ru"||!d.fr)) tr.push("ru : "+esc(d.ru));
      else if(d.ru) tr.push(`<span class="lat">ru : ${esc(d.ru)}</span>`);
      if(d.en&&(dst==="en"||!d.fr)) tr.push(esc(d.en));
      if(d.tr) tr.push("tr : "+esc(d.tr));
      if(d.v) tr.push(`<span class="lat">${T("variantOf")} ${esc(d.v)}</span>`);
      const ci=classInfo(d.cls_n);
      html+=`<div class="sense">${d.pos?`<span class="pos">${esc(d.pos)}</span> `:""}${ci?`<span class="pos">cl. ${esc(ci.sg.p)}</span> `:""}${tr.join(" · ")}</div>`;
    }
    html+=`</div></div>`;
  }
  return html;
}

/* ---------- MT en ligne : pivot russe + correction anti-russe ---------- */
async function gtx(sl,tl,q){
  const r=await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(q)}`);
  if(!r.ok) throw new Error("gtx "+r.status);
  const j=await r.json();
  return (j[0]||[]).map(x=>x&&x[0]||"").join("").trim();
}
// pronoms/particules russes fréquents -> tchétchène (attestés dans notre dictionnaire)
const RU_MINI={"я":"со","ты":"хьо","он":"иза","она":"иза","мы":"вай","вы":"шу","они":"уьш","это":"хӏара","кто":"мила","что":"хӏун"};
let RU_TOK=null;
function ruTokenMap(){
  if(RU_TOK) return RU_TOK;
  RU_TOK=new Map();
  R.forEach((e,i)=>{
    e.r.toLowerCase().split(/[^а-яё-]+/).forEach(w=>{
      if(w.length>2){ if(!RU_TOK.has(w)) RU_TOK.set(w,[]);
        const a=RU_TOK.get(w); if(a.length<8) a.push(i); }
    });
  });
  return RU_TOK;
}
// équivalent tchétchène d'un mot russe (dictionnaire Matsiev) ; null si inconnu
function ruLookup(w){
  if(RU_MINI[w]) return {c:RU_MINI[w],s:"dico"};
  // correspondance EXACTE uniquement : couper la fin d'un mot inconnu pour chercher
  // une racine russe créait des faux positifs sur des mots tchétchènes conjugués
  // (ex. карийча « si tu trouves » -> confondu avec le russe карий « marron »)
  const arr=ruTokenMap().get(w); if(!arr) return null;
  let best=null,bs=2;
  for(const i of arr){ const e=R[i], r=e.r.toLowerCase();
    let s=0;
    if(r===w) s+=5;                      // l'entrée russe est exactement ce mot
    const cw=e.c.split(/\s+/).length;
    s+=(cw===1?3:cw===2?1:0);            // côté tchétchène court = plus sûr
    if(s>bs){bs=s;best=e;}
  }
  return best;
}
// analyse une sortie MT vers le tchétchène : mots russes non traduits -> substitution.
// Règle : si le mot figure dans le dictionnaire tchétchène (emprunts au russe inclus), on le garde ;
// sinon, s'il est identifié comme russe, on lui substitue l'équivalent du dictionnaire.
function analyzeCe(text){
  const parts=text.split(/([^а-яёА-ЯЁӏӀ-]+)/);
  let leaks=0, unknown=0; const subs=[]; const out=[];
  for(const w of parts){
    if(!/[а-яё]/i.test(w)){
      if(/[a-z]{2,}/i.test(w)) unknown+=2; // mot resté en alphabet latin : pas du tchétchène
      out.push(w);continue;
    }
    if(idxCe.has(norm(w))){out.push(w);continue;}
    const hit=ruLookup(w.toLowerCase());
    if(hit){leaks++;subs.push({ru:w,ce:hit.c,src:hit.s==="dico"?"dictionnaire":hit.s});out.push(hit.c);}
    else {unknown++;out.push(w);}
  }
  return {leaks,unknown,subs,text:out.join("")};
}
// lettres/digraphes propres au tchétchène : si un mot en contient, il n'est PAS russe
const CE_MARKS=/[ӏӀ]|аь|оь|уь|хь|хӏ|гӏ|къ|кх|цӏ|чӏ|кӏ|пӏ|тӏ/i;
// filet en ligne : les mots russes restants sont retraduits UN PAR UN (ru->ce mot isolé,
// bien plus fiable que la phrase entière), max 6 mots
async function fixLeaksOnline(ana){
  const parts=ana.text.split(/([^а-яёА-ЯЁӏӀ-]+)/);
  let n=0;
  for(let i=0;i<parts.length&&n<6;i++){
    const w=parts[i];
    if(!/[а-яё]/i.test(w)||w.length<4) continue;   // trop court = trop risqué
    if(CE_MARKS.test(w)) continue;                  // contient une lettre tchétchène : pas du russe
    if(idxCe.has(norm(w))) continue;
    if(ruLookup(w.toLowerCase())) continue; // déjà substitué par le dictionnaire
    // ne retraduire que les mots EXACTEMENT confirmés russes par notre corpus
    // (jamais par racine tronquée : faux positifs sur les mots tchétchènes conjugués)
    const lw=w.toLowerCase();
    if(!ruTokenMap().has(lw)) continue;
    try{
      const t=await gtx("ru","ce",w.toLowerCase());
      // n'accepter la substitution QUE si le résultat est un mot vérifié de notre dictionnaire
      if(t&&norm(t)!==norm(w.toLowerCase())&&idxCe.has(norm(t))){
        ana.subs.push({ru:w,ce:t,src:"MT mot"});
        parts[i]=t; n++;
      }
    }catch(e){break;}
  }
  // si la phrase contenait des fuites russes, les pronoms russes en majuscule
  // (Я, Ты…) sont aussi des fuites, même si le mot existe en tchétchène (ex. « я » = ou)
  if(ana.subs.length){
    for(let i=0;i<parts.length;i++){
      const w=parts[i], lw=w.toLowerCase();
      if(RU_MINI[lw]&&/^[А-ЯЁ]/.test(w)){
        ana.subs.push({ru:w,ce:RU_MINI[lw],src:"dico"});
        parts[i]=RU_MINI[lw];
      }
    }
  }
  ana.text=parts.join("");
  return ana;
}

/* ---------- signalement de mauvaise traduction ---------- */
let lastTrans=null;
const NM_DEBUG=/[?&]debug=1/.test(location.search);
let aiErr="";
async function sendReport(payload){
  const email=(window.NM_REPORT_EMAIL||"");
  if(!email) throw new Error("no-email");
  const r=await fetch("https://formsubmit.co/ajax/"+encodeURIComponent(email),{
    method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},
    body:JSON.stringify(payload)});
  const j=await r.json().catch(()=>({}));
  if(!(j&&(j.success===true||j.success==="true"))) throw new Error((j&&j.message)||"fail");
}
function reportBtn(){
  const b=document.createElement("button");
  b.className="copy-btn report-btn"; b.textContent=T("reportBtn");
  b.addEventListener("click",async()=>{
    if(!lastTrans) return;
    if(!(window.NM_REPORT_EMAIL||"")){ b.textContent="✉ "+((window.NM_REPORT_EMAIL)||"—"); return; }
    let corr=""; try{ corr=window.prompt(T("reportAsk"))||""; }catch(e){}
    const old=b.textContent; b.textContent=T("reportSending"); b.disabled=true;
    try{
      await sendReport({_subject:"Noxchiyn Mott — mauvaise traduction",
        texte:lastTrans.q, de:lastTrans.src, vers:lastTrans.dst,
        traduction:lastTrans.out||"", correction:corr, url:location.href, date:new Date().toISOString()});
      b.textContent="✓ "+T("reportOk");
    }catch(e){ b.textContent=T("reportErr"); b.disabled=false; setTimeout(()=>{b.textContent=old;},2600); }
  });
  return b;
}

/* ---------- bouton copier ---------- */
function copyBtn(text){
  const b=document.createElement("button");
  b.className="copy-btn"; b.textContent="📋 "+T("copy"); b.title=T("copy");
  b.addEventListener("click",()=>{
    const done=()=>{b.textContent="✓ "+T("copied"); setTimeout(()=>{b.textContent="📋 "+T("copy");},1600);};
    const fallback=()=>{const ta=document.createElement("textarea");ta.value=text;
      document.body.appendChild(ta);ta.select();
      try{document.execCommand("copy");done();}catch(e){} ta.remove();};
    if(navigator.clipboard&&navigator.clipboard.writeText)
      navigator.clipboard.writeText(text).then(done,fallback);
    else fallback();
  });
  return b;
}

/* ---------- onglets ---------- */
document.querySelectorAll("#tabs button[data-tab]").forEach(b=>{
  b.addEventListener("click",()=>{
    document.querySelectorAll("#tabs button[data-tab]").forEach(x=>x.classList.remove("active"));
    document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
    b.classList.add("active");
    document.getElementById("tab-"+b.dataset.tab).classList.add("active");
  });
});

/* ---------- clavier virtuel ---------- */
// Rangée tchétchène (toujours visible) + clavier cyrillique complet dépliable (⌨)
const KEYS=["ӏ","аь","оь","уь","гӏ","кх","къ","кӏ","пӏ","тӏ","хь","хӏ","цӏ","чӏ"];
const ROWS=[
 ["й","ц","у","к","е","н","г","ш","щ","з","х","ъ"],
 ["ф","ы","в","а","п","р","о","л","д","ж","э"],
 ["я","ч","с","м","и","т","ь","б","ю","ё"]];
function buildKbd(el,target){
  el.innerHTML=`<button type="button" class="kbd-toggle" title="Ouvrir le clavier cyrillique complet">⌨</button>`
   +KEYS.map(k=>`<button type="button" data-k="${k}">${k}</button>`).join("")
   +`<div class="kbd-full" hidden>`
   +ROWS.map(r=>`<div class="kbd-row">`+r.map(k=>`<button type="button" data-k="${k}">${k}</button>`).join("")+`</div>`).join("")
   +`<div class="kbd-row"><button type="button" data-a="shift" title="Majuscules">⇧</button>
     <button type="button" data-k=" " class="kbd-space">espace</button>
     <button type="button" data-a="bksp" title="Effacer">⌫</button></div></div>`;
  let shift=false;
  el.addEventListener("click",ev=>{
    const b=ev.target.closest("button"); if(!b)return;
    if(b.classList.contains("kbd-toggle")){
      const f=el.querySelector(".kbd-full"); f.hidden=!f.hidden;
      b.classList.toggle("on",!f.hidden); return;
    }
    const t=document.getElementById(target);
    if(b.dataset.a==="shift"){
      shift=!shift; b.classList.toggle("on",shift);
      el.querySelectorAll("[data-k]").forEach(x=>{
        if(x.dataset.k.trim()) x.textContent=shift?x.dataset.k.toUpperCase():x.dataset.k;});
      return;
    }
    const s=t.selectionStart??t.value.length, e=t.selectionEnd??t.value.length;
    if(b.dataset.a==="bksp"){
      if(s===e&&s>0){t.value=t.value.slice(0,s-1)+t.value.slice(e);t.selectionStart=t.selectionEnd=s-1;}
      else{t.value=t.value.slice(0,s)+t.value.slice(e);t.selectionStart=t.selectionEnd=s;}
    }else{
      let k=b.dataset.k; if(shift&&k.trim()) k=k.toUpperCase();
      t.value=t.value.slice(0,s)+k+t.value.slice(e);
      t.selectionStart=t.selectionEnd=s+k.length;
    }
    t.focus(); t.dispatchEvent(new Event("input"));
  });
}
buildKbd(document.getElementById("kbd"),"trad-in");
buildKbd(document.getElementById("kbd2"),"dico-q");
if(document.getElementById("kbd3")) buildKbd(document.getElementById("kbd3"),"imp-text");

/* ---------- traducteur ---------- */
const $=id=>document.getElementById(id);
$("swap").addEventListener("click",()=>{
  const a=$("src-lang"),b=$("dst-lang"); const v=a.value; a.value=b.value; b.value=v;
});
$("btn-trad").addEventListener("click",doTranslate);
$("trad-in").addEventListener("keydown",e=>{ if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();doTranslate();} });

function dictSection(q,src,dst){
  // recherche dictionnaire pour un mot/une expression courte
  const r=lookup(q,src);
  let refs=dedupe([...r.exact,...r.partial]);
  // filtre : si cible fr -> privilégier entrées avec fr ; ru -> avec ru
  const score=ref=>{ const d=refData(ref);
    let s=r.exact.includes(ref)?100:0;
    if(dst==="fr"&&d.fr)s+=10; if(dst==="ru"&&d.ru)s+=10; if(dst==="en"&&d.en)s+=10;
    if(src==="ce"&&d.fr)s+=5;
    return -s; };
  refs.sort((a,b)=>score(a)-score(b));
  return refs.slice(0,30);
}
function phraseMatches(q,src){
  const nq=(src==="ce")?norm(q):normFr(q);
  if(nq.length<2) return [];
  let res=NM_PHRASES.filter(p=> (src==="ce"?norm(p.ce):normFr(p.fr)).includes(nq));
  // sinon : correspondance par mots porteurs de sens ("comment tu t'appelles" ~ "comment t'appelles-tu ?")
  if(!res.length&&src!=="ce"){
    const cw=nq.split(/[^a-zà-ÿ]+/).filter(w=>w.length>2&&!STOP_FR.has(w));
    if(cw.length) res=NM_PHRASES.filter(p=>{const pf=normFr(p.fr+" "+(p.k||""));return cw.every(w=>pf.includes(w));});
  }
  return res.slice(0,10);
}
async function doTranslate(){
  const q=$("trad-in").value.trim();
  let src=$("src-lang").value, dst=$("dst-lang").value;
  // auto-détection : si le script du texte ne correspond pas à la langue source choisie
  const hasCyr=isCyr(q);
  if(q&&!hasCyr&&(src==="ce"||src==="ru")){
    src=(dedupe(lookup(q,"en").exact).length>dedupe(lookup(q,"fr").exact).length)?"en":"fr";
    $("src-lang").value=src;
  }else if(q&&hasCyr&&(src==="fr"||src==="en")){
    src="ce"; $("src-lang").value=src;
  }
  if(dst===src){ dst=(src==="ce")?"fr":"ce"; $("dst-lang").value=dst; }
  if(q) histAdd("nm_h_trad",{q:q.slice(0,120),s:src,d:dst});
  const out=$("trad-out"); out.innerHTML="";
  if(!q) return;
  const words=q.split(/\s+/);
  let html="";
  // 1. expressions du guide de conversation
  const ph=phraseMatches(q,src==="ce"?"ce":"fr");
  if(ph.length){
    html+=`<div class="card"><h2>${T("cardExpr")}</h2>`+
      ph.map(p=>`<div class="entry"><span class="ce">${esc(p.ce)}</span><span class="lat">${esc(translit(p.ce))}</span><span class="tr">${esc(p.fr)}</span></div>`).join("")+`</div>`;
  }
  // 2. dictionnaire (requête entière) — sens multiples groupés par mot tchétchène
  const refs=dictSection(q,src,dst);
  if(refs.length){
    html+=`<div class="card"><h2>${T("cardDict")}</h2>`+renderGrouped(refs,dst)+`</div>`;
  }
  // 3. mot à mot : uniquement les mots porteurs de sens, correspondances exactes
  if(words.length>1&&words.length<=12){
    let rows="";
    for(const w of words){
      if(isStop(w,src)) continue;
      let rs=dedupe(lookup(w,src).exact);
      if(!rs.length&&src==="ce"&&w.length>=4) rs=dedupe(lookup(w,src).partial); // formes fléchies
      rs=rs.slice(0,4);
      if(rs.length) rows+=`<p class="hint" style="margin:8px 0 0"><b>${esc(w)}</b></p>`+renderGrouped(rs,dst);
    }
    if(rows) html+=`<div class="card"><h2>${T("cardWbw")}</h2>${rows}</div>`;
  }
  if(!html&&!true){
    html=`<div class="empty">${T("noRes")}</div>`;
  }
  out.innerHTML=html;
  lastTrans={q:q,src:src,dst:dst,out:""};
  // 3bis. expressions idiomatiques du dictionnaire Matsiev, trouvées en déduisant le sens
  // via le russe (fr -> ru, puis recherche dans les 13 000+ paires expressions russes-tchétchènes)
  if(refs.length && out.querySelector && !out.querySelector(".report-btn")){
    const rb=document.createElement("div"); rb.className="card"; rb.style.textAlign="right"; rb.style.padding="8px 14px";
    rb.appendChild(reportBtn()); out.appendChild(rb);
  }
  if(true&&dst==="ce"&&(src==="fr"||src==="en")&&words.length>1&&words.length<=8){
    try{
      const ruQ=(await gtx(src,"ru",q.slice(0,300))).toLowerCase().replace(/[.!?…]+$/,"").trim();
      let er=lookup(ruQ,"ru");
      let rf=dedupe([...er.exact,...er.partial]).filter(r=>r.t==="r");
      if(!rf.length){ // réessai sans les mots-outils russes
        const key=ruQ.split(/\s+/).filter(w=>!STOP_RU.has(w)).join(" ");
        if(key&&key!==ruQ){ er=lookup(key,"ru");
          rf=dedupe([...er.exact,...er.partial]).filter(r=>r.t==="r"); }
      }
      // complément systématique : chaque mot russe porteur, un à un, avec racines
      // (fait remonter le mot exact même si une phrase proche existe, ex. свободен -> мукъа)
      {
        const cw=ruQ.split(/\s+/).filter(w=>w.length>3&&!STOP_RU.has(w)).slice(0,4);
        for(const w of cw){
          for(const v of [w,w.slice(0,-1),w.length>5?w.slice(0,-2):null]){
            if(!v) continue;
            const e3=lookup(v,"ru");
            rf.push(...dedupe([...e3.exact,...e3.partial]).filter(r=>r.t==="r").slice(0,3));
          }
        }
        rf=dedupe(rf);
      }
      rf=rf.slice(0,8);
      // adaptation grammaticale : la question est à la 1re personne mais le dictionnaire
      // n'a que la 2e (хьо …) -> on propose la forme en со (règle sûre : хьо<->со, copule inchangée)
      let adapted="";
      if(/^(je|j'|i)\b/i.test(q)||/^я\b/i.test(ruQ)){
        const seen=new Set();
        for(const r of rf.slice(0,5)){
          if(r.t!=="r") continue;
          const e=R[r.i];
          if(/^хьо\s/i.test(e.c)){
            const g=e.c.replace(/^хьо/i,"со").replace(/[!?]+$/,"");
            if(seen.has(g)) continue; seen.add(g);
            adapted+=`<div class="entry"><span class="ce">${esc(g)}</span><span class="lat">${esc(translit(g))}</span><span class="tr">${T("adapted1p")}</span></div>`;
          }
        }
      }
      if(rf.length||adapted){
        const div=document.createElement("div"); div.className="card";
        div.innerHTML=`<h2>${T("cardNear")} <span class="hint" style="font-weight:400">(${T("viaRu")} « ${esc(ruQ)} »)</span></h2>`
          +adapted+renderGrouped(rf,dst);
        out.appendChild(div);
      }
    }catch(e){}
  }
  // 4. traduction automatique en ligne (phrases ou si rien trouvé)
  if(true&&(words.length>1||!refs.length)){
    const box=document.createElement("div");
    box.className="card";
    box.innerHTML=`<p class="hint">${T("mtQuery")}</p>`;
    out.appendChild(box);
    const aik=aiKey();
    aiErr = aik ? "" : "aucune cle configuree";
    if(aik){
      try{
        const gt=await geminiTranslate(q.slice(0,2000),src,dst,aik);
        if(!gt) aiErr="reponse vide";
        if(gt){
          box.className="card";
          let h=`<p class="ce" style="font-size:1.2rem;font-weight:600;margin-top:0">${esc(gt)}</p>`;
          if(isCyr(gt)) h+=`<p class="lat">${esc(translit(gt))}</p>`;
          box.innerHTML=h; box.appendChild(copyBtn(gt)); if(lastTrans)lastTrans.out=gt; box.appendChild(reportBtn());
          return;
        }
      }catch(e){ aiErr=(e&&e.message)||String(e); }
    }
    const qmt=q.length>1800?q.slice(0,1800):q; // limite de l'API
    try{
      const direct=await gtx(src,dst,qmt).catch(()=>null);
      let pivot=null;
      if(src!=="ru"&&dst!=="ru"){
        try{ pivot=await gtx("ru",dst,await gtx(src,"ru",qmt)); }catch(e){}
      }
      if(!direct&&!pivot) throw new Error("aucune réponse");
      let copyTarget="";
      let html="";
      if(dst==="ce"){
        const cands=[[T("mtDirect"),direct],[T("mtPivot"),pivot]].filter(c=>c[1])
          .map(([n,t])=>[n,t,analyzeCe(t)]);
        // choisir la version qui contient le MOINS de mots étrangers au dictionnaire tchétchène
        cands.sort((a,b)=>(a[2].leaks+a[2].unknown)-(b[2].leaks+b[2].unknown));
        const [name,raw,anaRaw]=cands[0];
        const ana=await fixLeaksOnline(anaRaw);
        copyTarget=ana.text;
        html+=`<p class="ce" style="font-size:1.2rem;font-weight:600;margin-top:0">${esc(ana.text)}</p>
          <p class="lat">${esc(translit(ana.text))}</p>`;
      }else{
        const main=direct||pivot;
        copyTarget=main;
        html+=`<p style="font-size:1.2rem;font-weight:600;margin-top:0">${esc(main)}</p>
          ${isCyr(main)?`<p class="lat">${esc(translit(main))}</p>`:""}`;
      }
      if(NM_DEBUG&&aiErr) html='<p class="hint" style="color:#d05e57;margin-top:0"><b>IA indisponible :</b> '+esc(aiErr)+'</p>'+html;
      box.innerHTML=html;
      try{ if(lastTrans){ const m=html.match(/font-weight:600">([^<]*)</); if(m)lastTrans.out=m[1]; } }catch(e){}
      box.appendChild(reportBtn());
      if(copyTarget) box.appendChild(copyBtn(copyTarget));
    }catch(e){
      const gl=`https://translate.google.com/?sl=${src}&tl=${dst}&text=${encodeURIComponent(q)}`;
      box.innerHTML=`<p class="hint">${T("mtOffline")}
        <a href="${gl}" target="_blank" rel="noopener noreferrer">${T("mtOpen")}</a></p>`;
    }
  }
}

/* ---------- dictionnaire ---------- */
/* stats retirées */
$("dico-q").addEventListener("change",()=>{
  const v=$("dico-q").value.trim();
  if(v.length>=2) histAdd("nm_h_dico",{q:v.slice(0,80)});
});
let dicoTimer=null;
$("dico-q").addEventListener("input",()=>{
  clearTimeout(dicoTimer);
  dicoTimer=setTimeout(()=>{
    const q=$("dico-q").value.trim(), out=$("dico-out");
    if(q.length<2){out.innerHTML="";return;}
    const lang=isCyr(q)?"ce":"fr";
    let refs=dedupe([...lookup(q,lang).exact,...lookup(q,lang).partial]);
    if(!isCyr(q)){ // aussi en/ru
      refs=dedupe([...refs,...lookup(q,"en").exact,...lookup(q,"ru").exact,
                   ...lookup(q,"en").partial,...lookup(q,"ru").partial]);
    }
    out.innerHTML=refs.length
      ? `<div class="card">`+renderGrouped(refs.slice(0,80),"fr")+`</div>`
      : `<div class="empty">${T("noRes2")}</div>`;
  },200);
});

/* ---------- expressions ---------- */
function phraseRow(p){
  return `<div class="entry"><span class="ce">${esc(p.ce)}</span><span class="lat">${esc(translit(p.ce))}</span><span class="tr">${esc(p.fr)}</span></div>`;
}
function renderPhrases(){
  const cats=[...new Set(NM_PHRASES.map(p=>p.cat))];
  $("phrases-out").innerHTML=cats.map((c,i)=>
    `<details class="pcat"${i===0?" open":""}><summary>${esc(T("cat:"+c))}<span class="pcount">${NM_PHRASES.filter(p=>p.cat===c).length}</span></summary>`+
    NM_PHRASES.filter(p=>p.cat===c).map(phraseRow).join("")+`</details>`).join("");
}
// moteur « décrivez la situation » : correspondance par mots-clés multilingues
function situationSearch(v){
  const nv=normFr(v);
  const words=nv.split(/[^a-zà-ÿа-яёӏ-]+/i).filter(w=>w.length>2&&!STOP_FR.has(w)&&!STOP_EN.has(w)&&!STOP_RU.has(w));
  if(!words.length) return [];
  const scored=[];
  for(const p of NM_PHRASES){
    const hayK=normFr([p.k||"",p.ke||"",p.kr||"",p.cat].join(" "));   // mots-clés de situation
    const hayT=normFr([p.ce,p.fr].join(" "));                          // texte de la fiche
    let s=0; for(const w of words){ if(hayK.includes(w)) s+=2; else if(hayT.includes(w)) s+=1; }
    if(s>0) scored.push([s,p]);
  }
  scored.sort((a,b)=>b[0]-a[0]);
  const best=scored[0]?scored[0][0]:0;
  const seuil=best>=2?best-0:1;   // si une bonne correspondance existe, ne garder que le haut du panier
  return scored.filter(x=>x[0]>=seuil).slice(0,6).map(x=>x[1]);
}
(function(){
  const q=document.getElementById("phr-q"); if(!q) return;
  let t=null;
  q.addEventListener("input",()=>{clearTimeout(t);t=setTimeout(()=>{
    const res=document.getElementById("phr-res"), v=q.value.trim();
    if(v.length<3){res.innerHTML="";return;}
    const hits=situationSearch(v);
    res.innerHTML=hits.length
      ?`<div class="card"><h2>${T("phrFound")}</h2>`+hits.map(phraseRow).join("")+`</div>`
      :`<div class="empty">${T("noRes2")}</div>`;
  },250);});
})();

/* ---------- nombres (système vigésimal) ---------- */
const NUM={0:"ноль",1:"цхьаъ",2:"шиъ",3:"кхоъ",4:"диъ",5:"пхиъ",6:"ялх",7:"ворхӏ",8:"бархӏ",9:"исс",10:"итт",
11:"цхьайтта",12:"шийтта",13:"кхойтта",14:"дейтта",15:"пхийтта",16:"ялхитта",17:"вуьрхӏитта",18:"берхӏитта",19:"ткъайоьсна",20:"ткъа"};
const ATTR={1:"цхьа",2:"ши",3:"кхо",4:"ди",5:"пхи",6:"ялх",7:"ворхӏ",8:"бархӏ",9:"исс"};
const VIG={20:"ткъа",40:"шовзткъа",60:"кхузткъа",80:"дезткъа"};
const VIG_E={20:"ткъе",40:"шовзткъе",60:"кхузткъе",80:"дезткъе"};
function num2ce(n){
  if(n<0||n>999999||!Number.isInteger(n)) return null;
  if(n<=20) return NUM[n];
  if(n<100){
    const base=Math.floor(n/20)*20, r=n-base;
    return r===0?VIG[base]:VIG_E[base]+" "+NUM[r];
  }
  if(n<1000){
    const h=Math.floor(n/100), r=n%100;
    const hw=(h===1?"бӏе":ATTR[h]+" бӏе");
    return r===0?hw:hw+" "+num2ce(r);
  }
  const t=Math.floor(n/1000), r=n%1000;
  const tw=(t===1?"эзар":(t<=9?ATTR[t]:num2ce(t))+" эзар");
  return r===0?tw:tw+" "+num2ce(r);
}
$("num-in").addEventListener("input",()=>{
  const n=parseInt($("num-in").value,10);
  const out=$("num-out");
  if(isNaN(n)){out.textContent="";return;}
  const w=num2ce(n);
  out.innerHTML=w?`${esc(w)} <span class="lat" style="font-weight:400">${esc(translit(w))}</span>`
                 +(n>20&&!(n in NUM)?` <span class="hint">(forme composée générée par règle vigésimale)</span>`:"")
               :"Nombre hors limites (0–999 999).";
});
function renderNumTable(){
  const rows=[[1,"\u2014"],[2,"\u2014"],[3,"\u2014"],[4,"\u2014"],[5,"\u2014"],[6,"\u2014"],[7,"\u2014"],[8,"\u2014"],[9,"\u2014"],[10,"\u2014"],
   [11,"10+1"],[15,"10+5"],[19,"20\u22121"],[20,"\u2014"],[30,"20+10"],[40,"2\u00d720"],[50,"2\u00d720+10"],
   [60,"3\u00d720"],[70,"3\u00d720+10"],[80,"4\u00d720"],[90,"4\u00d720+10"],[100,"\u2014"],[200,"2\u00d7100"],[1000,"\u2014"]];
  $("num-table").innerHTML=`<table><tr><th>${T("numN")}</th><th>${T("numCE")}</th><th>${T("numTL")}</th><th>${T("numST")}</th></tr>`+
    rows.map(([n,st])=>{const w=num2ce(n);return `<tr><td>${n}</td><td><b>${esc(w)}</b></td><td>${esc(translit(w))}</td><td>${st}</td></tr>`;}).join("")+`</table>`;
}

/* ---------- grammaire (multilingue) ---------- */
const GRAM={
fr:{alpha:"Alphabet et sons particuliers",
 alphaP:"Le tchétchène s'écrit en cyrillique, avec des lettres propres. La <b>palotchka Ӏ</b> marque des consonnes éjectives ou pharyngales.",
 letter:"Lettre",pron:"Prononciation approchée",
 rows:[["аь / оь / уь","voyelles antérieures : « è », « eu » (fr. p<b>eu</b>r), « u » (fr. t<b>u</b>)"],
  ["Ӏ","consonne pharyngale sonore (comme l'arabe ʿayn ع)"],["хӀ","« h » aspiré (angl. <i>h</i>ello)"],
  ["хь","« h » pharyngal fort (arabe ح)"],["х","« kh » guttural (esp. <i>j</i>ota, all. Ba<i>ch</i>)"],
  ["гӀ","« gh », r grasseyé (arabe غ)"],["кх","« q » uvulaire (arabe ق)"],
  ["къ, кӀ, пӀ, тӀ, цӀ, чӀ","consonnes éjectives (k', p', t', ts', tch' « claquées »)"]],
 cls:"Classes nominales (accord)",
 clsP:"Chaque nom appartient à l'une de <b>6 classes</b>. Verbes et adjectifs qui s'accordent portent un préfixe de classe : <b>в-</b> (homme), <b>й-</b> (femme), <b>б-</b>, <b>д-</b>… Le verbe « être » : <span class=\"ce\">ву / ю / бу / ду</span>.",
 ex:"Exemple",sens:"Sens",
 clsRows:[["стаг ву","l'homme est (classe 1, в-)"],["зуда ю","la femme est (classe 2, й-)"],["мотт бу","la langue est (classe б-)"],["хи ду","l'eau est (classe д-)"]],
 clsN:"C'est pour cela que plusieurs expressions changent selon qu'on parle à un homme ou à une femme (ву/ю).",
 cas:"Déclinaison : 8 cas",
 casP:"Le nom se décline. Suffixes de base : génitif <span class=\"ce\">-н</span>, datif <span class=\"ce\">-на</span>, ergatif <span class=\"ce\">-о/-с</span>, instrumental <span class=\"ce\">-ца</span>, matériel <span class=\"ce\">-х</span>, comparatif <span class=\"ce\">-л</span>, locatif <span class=\"ce\">-хь/-га/-ра</span>. Exemple réel — <span class=\"ce\">москал</span> (dinde) :",
 cCase:"Cas",cSg:"Singulier",cPl:"Pluriel",
 casN:"La voyelle du radical change souvent (ex. : мотт → меттан « de la langue »). Les formes fléchies connues sont dans le dictionnaire.",
 vb:"Phrase et verbe",
 vbP:"Ordre habituel : <b>Sujet – Objet – Verbe</b> (SOV). Langue <b>ergative</b> : le sujet d'un verbe transitif prend l'ergatif (<span class=\"ce\">со</span> « je » → <span class=\"ce\">ас</span>). Ex. : <span class=\"ce\">Ас нохчийн мотт ӏамабо</span> — « J'apprends la langue tchétchène ».",
 vbP2:"Le verbe ne s'accorde pas en personne, mais en <b>classe</b> (в/й/б/д) : <span class=\"ce\">ван / ян / бан / дан</span> « faire ».",
 refs:"Références : J. Nichols (Berkeley), fiche « Le tchétchène » du CNRS-LGIDF.",
 cases:[["nominatif","nominative"],["génitif","genitive"],["datif","dative"],["ergatif","ergative"],["instrumental","instrumental"],["matériel","substantive"],["comparatif","comparative degree"],["locatif","locative"]]},
ru:{alpha:"Алфавит и особые звуки",
 alphaP:"Чеченский пишется кириллицей с особыми буквами. <b>Палочка Ӏ</b> обозначает абруптивные и фарингальные согласные.",
 letter:"Буква",pron:"Примерное произношение",
 rows:[["аь / оь / уь","гласные переднего ряда: «э», «ö» (нем. sch<b>ö</b>n), «ü» (нем. f<b>ü</b>r)"],
  ["Ӏ","звонкий фарингальный согласный (как арабский ʿайн ع)"],["хӀ","придыхательное «h» (англ. <i>h</i>ello)"],
  ["хь","сильное фарингальное «х» (араб. ح)"],["х","глубокое «х» (нем. Ba<i>ch</i>)"],
  ["гӀ","«гх», картавое «р» (араб. غ)"],["кх","увулярное «къ» (араб. ق)"],
  ["къ, кӀ, пӀ, тӀ, цӀ, чӀ","абруптивные согласные (к', п', т', ц', ч')"]],
 cls:"Именные классы (согласование)",
 clsP:"Каждое имя относится к одному из <b>6 классов</b>. Согласуемые глаголы и прилагательные получают классный префикс: <b>в-</b> (мужчина), <b>й-</b> (женщина), <b>б-</b>, <b>д-</b>… Глагол «быть»: <span class=\"ce\">ву / ю / бу / ду</span>.",
 ex:"Пример",sens:"Значение",
 clsRows:[["стаг ву","мужчина есть (класс 1, в-)"],["зуда ю","женщина есть (класс 2, й-)"],["мотт бу","язык есть (класс б-)"],["хи ду","вода есть (класс д-)"]],
 clsN:"Поэтому многие выражения меняются в зависимости от пола собеседника (ву/ю).",
 cas:"Склонение: 8 падежей",
 casP:"Имя склоняется. Базовые суффиксы: родительный <span class=\"ce\">-н</span>, дательный <span class=\"ce\">-на</span>, эргативный <span class=\"ce\">-о/-с</span>, творительный <span class=\"ce\">-ца</span>, вещественный <span class=\"ce\">-х</span>, сравнительный <span class=\"ce\">-л</span>, местный <span class=\"ce\">-хь/-га/-ра</span>. Реальный пример — <span class=\"ce\">москал</span> (индюк):",
 cCase:"Падеж",cSg:"Ед. число",cPl:"Мн. число",
 casN:"Гласная основы часто меняется (мотт → меттан «языка»). Известные словоформы есть в словаре.",
 vb:"Предложение и глагол",
 vbP:"Обычный порядок: <b>Подлежащее – Дополнение – Глагол</b> (SOV). Язык <b>эргативный</b>: субъект переходного глагола в эргативе (<span class=\"ce\">со</span> «я» → <span class=\"ce\">ас</span>). Пример: <span class=\"ce\">Ас нохчийн мотт ӏамабо</span> — «Я учу чеченский язык».",
 vbP2:"Глагол согласуется не по лицу, а по <b>классу</b> (в/й/б/д): <span class=\"ce\">ван / ян / бан / дан</span> «делать».",
 refs:"Источники: Дж. Николс (Беркли), CNRS-LGIDF «Le tchétchène».",
 cases:[["именительный","nominative"],["родительный","genitive"],["дательный","dative"],["эргативный","ergative"],["творительный","instrumental"],["вещественный","substantive"],["сравнительный","comparative degree"],["местный","locative"]]},
en:{alpha:"Alphabet and special sounds",
 alphaP:"Chechen is written in Cyrillic with extra letters. The <b>palochka Ӏ</b> marks ejective or pharyngeal consonants.",
 letter:"Letter",pron:"Approximate pronunciation",
 rows:[["аь / оь / уь","front vowels: “e”, “ö” (German sch<b>ö</b>n), “ü” (German f<b>ü</b>r)"],
  ["Ӏ","voiced pharyngeal consonant (like Arabic ʿayn ع)"],["хӀ","aspirated “h” (<i>h</i>ello)"],
  ["хь","strong pharyngeal “h” (Arabic ح)"],["х","guttural “kh” (German Ba<i>ch</i>)"],
  ["гӀ","“gh” (Arabic غ)"],["кх","uvular “q” (Arabic ق)"],
  ["къ, кӀ, пӀ, тӀ, цӀ, чӀ","ejective consonants (k', p', t', ts', ch')"]],
 cls:"Noun classes (agreement)",
 clsP:"Every noun belongs to one of <b>6 classes</b>. Agreeing verbs and adjectives take a class prefix: <b>в-</b> (man), <b>й-</b> (woman), <b>б-</b>, <b>д-</b>… The verb “to be”: <span class=\"ce\">ву / ю / бу / ду</span>.",
 ex:"Example",sens:"Meaning",
 clsRows:[["стаг ву","the man is (class 1, в-)"],["зуда ю","the woman is (class 2, й-)"],["мотт бу","the language is (class б-)"],["хи ду","the water is (class д-)"]],
 clsN:"That is why many phrases change depending on whether you address a man or a woman (ву/ю).",
 cas:"Declension: 8 cases",
 casP:"Nouns decline. Base suffixes: genitive <span class=\"ce\">-н</span>, dative <span class=\"ce\">-на</span>, ergative <span class=\"ce\">-о/-с</span>, instrumental <span class=\"ce\">-ца</span>, material <span class=\"ce\">-х</span>, comparative <span class=\"ce\">-л</span>, locative <span class=\"ce\">-хь/-га/-ра</span>. A real example — <span class=\"ce\">москал</span> (turkey):",
 cCase:"Case",cSg:"Singular",cPl:"Plural",
 casN:"The stem vowel often changes (мотт → меттан “of the language”). Known inflected forms are in the dictionary.",
 vb:"Sentence and verb",
 vbP:"Usual order: <b>Subject – Object – Verb</b> (SOV). An <b>ergative</b> language: the subject of a transitive verb takes the ergative (<span class=\"ce\">со</span> “I” → <span class=\"ce\">ас</span>). E.g. <span class=\"ce\">Ас нохчийн мотт ӏамабо</span> — “I am learning Chechen”.",
 vbP2:"The verb agrees in <b>class</b> (в/й/б/д), not person: <span class=\"ce\">ван / ян / бан / дан</span> “to do”.",
 refs:"References: J. Nichols (Berkeley), CNRS-LGIDF.",
 cases:[["nominative","nominative"],["genitive","genitive"],["dative","dative"],["ergative","ergative"],["instrumental","instrumental"],["material","substantive"],["comparative","comparative degree"],["locative","locative"]]}
};
function renderGram(){
  const g=GRAM[CURLANG]||GRAM[CURLANG==="ce"?"ru":"fr"]||GRAM.fr;
  let mrows="";
  for(const [frc,enc] of g.cases){
    const sg=W.find(e=>e.e===`${enc} singular of москал`);
    const pl=W.find(e=>e.e===`${enc} plural of москал`);
    if(sg||pl||enc==="nominative")
      mrows+=`<tr><td>${frc}</td><td class="ce">${sg?esc(sg.c):"москал"}</td><td class="ce">${pl?esc(pl.c):"—"}</td></tr>`;
  }
  $("gram-out").innerHTML=`
  <div class="card gram"><h2>${g.alpha}</h2><p>${g.alphaP}</p>
    <table><tr><th>${g.letter}</th><th>${g.pron}</th></tr>
    ${g.rows.map(r=>`<tr><td class="ce">${r[0]}</td><td>${r[1]}</td></tr>`).join("")}</table></div>
  <div class="card gram"><h2>${g.cls}</h2><p>${g.clsP}</p>
    <table><tr><th>${g.ex}</th><th>${g.sens}</th></tr>
    ${g.clsRows.map(r=>`<tr><td class="ce">${r[0]}</td><td>${r[1]}</td></tr>`).join("")}</table>
    <p class="hint">${g.clsN}</p></div>
  <div class="card gram"><h2>${g.cas}</h2><p>${g.casP}</p>
    <table><tr><th>${g.cCase}</th><th>${g.cSg}</th><th>${g.cPl}</th></tr>${mrows}</table>
    <p class="hint">${g.casN}</p></div>
  <div class="card gram"><h2>${g.vb}</h2><p>${g.vbP}</p><p>${g.vbP2}</p>
    <p class="hint">${g.refs}</p></div>`;
}

/* ---------- import de fichiers (PDF, Word, images) ---------- */
function loadScript(srcs){
  srcs=Array.isArray(srcs)?srcs:[srcs];
  return srcs.reduce((p,s)=>p.catch(()=>new Promise((res,rej)=>{
    const el=document.createElement("script");el.src=s;el.crossOrigin="anonymous";el.referrerPolicy="no-referrer";el.onload=res;el.onerror=rej;
    document.head.appendChild(el);
  })),Promise.reject()).then(()=>true,()=>false);
}
const CDN={
  pdf:"https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
  pdfWorker:"https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
  mammoth:["https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js",
           "https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js"],
  tesseract:["https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.1.1/tesseract.min.js",
             "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"]
};
const impStatus=m=>{$("imp-status").textContent=m;};
// nettoyage OCR pour le tchétchène : 1 / I / l / | mal reconnus -> palotchka
function cleanCe(t){
  return t.replace(/(?<=[а-яА-ЯёЁьъ])[1Il|](?=[а-яА-ЯёЁьъ])/g,"ӏ")
          .replace(/(?<=^|[\s«"(])[1I|](?=[а-яё])/gm,"Ӏ");
}
// ---------- OCR amélioré : modèles « best », variantes de prétraitement, choix par confiance ----------
const TESS_BEST="https://cdn.jsdelivr.net/gh/tesseract-ocr/tessdata_best@4.1.0";
let OCR_WORKER=null, OCR_LANG=null, lastOcrConf=null;
async function getOcrWorker(lang){
  if(!window.Tesseract && !await loadScript(CDN.tesseract)) throw new Error("OCR inaccessible (internet requis)");
  if(OCR_WORKER && OCR_LANG===lang) return OCR_WORKER;
  if(OCR_WORKER){ try{await OCR_WORKER.terminate();}catch(e){} OCR_WORKER=null; }
  impStatus(T("ocrModel"));
  OCR_WORKER=await Tesseract.createWorker(lang,1,{
    langPath:TESS_BEST, gzip:false,   // modèles "best" : bien plus précis que les "fast" par défaut
    logger:m=>{ if(m.status==="recognizing text") impStatus(`OCR… ${Math.round(m.progress*100)} %`); }
  });
  await OCR_WORKER.setParameters({user_defined_dpi:"300",preserve_interword_spaces:"1"});
  OCR_LANG=lang;
  return OCR_WORKER;
}
// deux variantes de prétraitement : (1) gris + contraste étiré (+ inversion auto si fond sombre),
// (2) binarisation adaptative par tuiles (robuste aux éclairages inégaux des photos)
async function preVariants(file){
  const img=await createImageBitmap(file);
  const scale=Math.min(4,Math.max(1,2400/Math.max(img.width,img.height)));
  const w=Math.round(img.width*scale), h=Math.round(img.height*scale);
  const cv=document.createElement("canvas"); cv.width=w; cv.height=h;
  const cx=cv.getContext("2d"); cx.imageSmoothingQuality="high"; cx.drawImage(img,0,0,w,h);
  const d=cx.getImageData(0,0,w,h), p=d.data;
  let min=255,max=0,sum=0;
  const g=new Float32Array(w*h);
  for(let i=0,j=0;i<p.length;i+=4,j++){const v=.299*p[i]+.587*p[i+1]+.114*p[i+2];g[j]=v;sum+=v;if(v<min)min=v;if(v>max)max=v;}
  const dark=(sum/(w*h))<110, rg=Math.max(1,max-min);
  for(let i=0,j=0;i<p.length;i+=4,j++){let v=(g[j]-min)*255/rg; if(dark)v=255-v; p[i]=p[i+1]=p[i+2]=v;}
  cx.putImageData(d,0,0);
  const cv2=document.createElement("canvas"); cv2.width=w; cv2.height=h;
  const cx2=cv2.getContext("2d"); cx2.drawImage(cv,0,0);
  const d2=cx2.getImageData(0,0,w,h), p2=d2.data, TS=32;
  for(let ty=0;ty<h;ty+=TS)for(let tx=0;tx<w;tx+=TS){
    let s=0,n=0;
    const yl=Math.min(ty+TS,h), xl=Math.min(tx+TS,w);
    for(let y=ty;y<yl;y++)for(let x=tx;x<xl;x++){s+=p2[(y*w+x)*4];n++;}
    const th=s/n-8;
    for(let y=ty;y<yl;y++)for(let x=tx;x<xl;x++){
      const k=(y*w+x)*4, v=p2[k]>th?255:0; p2[k]=p2[k+1]=p2[k+2]=v;
    }
  }
  cx2.putImageData(d2,0,0);
  return [cv,cv2];
}
async function ocrImage(src,lang){
  const wk=await getOcrWorker(lang);
  const variants=(src instanceof HTMLCanvasElement)?[src]:await preVariants(src);
  let best=null;
  for(const v of variants){
    const r=await wk.recognize(v);
    if(!best||r.data.confidence>best.data.confidence) best=r;
    if(best.data.confidence>=85) break;  // assez bon : inutile d'essayer les autres variantes
  }
  lastOcrConf=Math.round(best.data.confidence);
  return best.data.text;
}
/* ---------- OCR manuscrit par IA (Gemini) ---------- */
const VIS_SESSION_MAX=15;         // OCR manuscrits maximum par session (remis à 0 au rechargement)
let visSession=0, lastImageFile=null;
function aiKey(){ return (window.NM_AI_KEY||""); }
/* ---------- OCR par IA (Gemini) : comprend le tchétchène, bien meilleur sur le manuscrit ---------- */
async function fileToB64(file){
  return new Promise((res,rej)=>{const r=new FileReader();
    r.onload=()=>res(String(r.result).split(",")[1]); r.onerror=rej; r.readAsDataURL(file);});
}
async function geminiOcr(file,key){
  const model=(window.NM_OCR_MODEL||"gemini-2.5-flash");
  const b64=await fileToB64(file);
  const prompt="Transcris fidelement, caractere par caractere, le texte manuscrit de cette image. "
    +"Le texte est en tchetchene (alphabet cyrillique, avec la lettre palotchka \u0406/\u04cf), et parfois en russe ou en anglais. "
    +"Respecte les sauts de ligne. Corrige uniquement les erreurs de lecture evidentes d'apres le sens. "
    +"Ne traduis rien. Ne mets aucun commentaire ni explication : reponds uniquement par le texte transcrit.";
  const body={contents:[{parts:[{text:prompt},{inline_data:{mime_type:(file.type||"image/jpeg"),data:b64}}]}],
    generationConfig:{temperature:0}};
  const resp=await fetch("https://generativelanguage.googleapis.com/v1beta/models/"+model+":generateContent?key="+encodeURIComponent(key),
    {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const j=await resp.json();
  if(j.error) throw new Error(j.error.message||"Gemini");
  const c=j.candidates&&j.candidates[0];
  const t=c&&c.content&&c.content.parts&&c.content.parts.map(p=>p.text||"").join("");
  return (t||"").trim();
}
/* ---------- traduction de phrases par IA (Gemini), ancrée sur le dictionnaire ---------- */
function transHints(q,src){
  const words=q.toLowerCase().split(/[^a-zà-ÿа-яёӏ-]+/i).filter(w=>w.length>1&&!isStop(w,src));
  const hints=[],seen=new Set();
  for(const w of words){
    if(seen.has(w)) continue;
    const refs=dedupe(lookup(w,src).exact).slice(0,3);
    for(const r of refs){
      const d=refData(r);
      if(!d.ce) continue;
      seen.add(w);
      const ci=classInfo(d.cls_n);
      hints.push(w+" = "+d.ce+(ci?" [classe "+ci.sg.p+", copule «"+ci.sg.c+"»"+(ci.pl?", pluriel "+ci.pl.p:"")+"]":""));
      break;
    }
  }
  return hints.slice(0,20);
}
async function geminiTranslate(q,src,dst,key){
  const L={fr:"français",ce:"tchétchène (нохчийн мотт, alphabet cyrillique)",ru:"russe",en:"anglais"};
  const model=(window.NM_OCR_MODEL||"gemini-2.5-flash");
  const hints=transHints(q,src);
  let prompt="Tu es un traducteur expert du tchétchène. Traduis du "+L[src]+" vers le "+L[dst]+" la phrase suivante, de manière naturelle et grammaticalement correcte.";
  if(dst==="ce"){
    prompt+=" Écris la traduction en tchétchène (alphabet cyrillique).";
    prompt+=" RÈGLES GRAMMATICALES IMPÉRATIVES : (1) le tchétchène est ergatif — le sujet d'un verbe transitif prend l'ergatif (со → ас, хьо → ахь).";
    prompt+=" (2) Le verbe et la copule s'accordent en CLASSE avec l'ABSOLUTIF (l'objet d'un verbe transitif, le sujet d'un intransitif) :";
    prompt+=" classe в- → « ву », classe й- → « ю », classe б- → « бу », classe д- → « ду » ; de même les verbes à préfixe de classe (в/й/б/д).";
    prompt+=" Respecte scrupuleusement la classe indiquée entre crochets dans le lexique ci-dessous.";
  }
  if(hints.length) prompt+=" Lexique vérifié (à utiliser tel quel) : "+hints.join(" ; ")+".";
  prompt+=" Réponds UNIQUEMENT par la traduction, sans guillemets ni explication.\n\nPhrase : "+q;
  const body={contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.2}};
  const resp=await fetch("https://generativelanguage.googleapis.com/v1beta/models/"+model+":generateContent?key="+encodeURIComponent(key),
    {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const j=await resp.json();
  if(j.error) throw new Error(j.error.message||"Gemini");
  const c=j.candidates&&j.candidates[0];
  return ((c&&c.content&&c.content.parts||[]).map(p=>p.text||"").join("")||"").trim();
}
/* ---------- assistance dictionnaire : corrige les mots à 1 lettre près (candidat unique) ---------- */
let CE_SET=null,RU_SET=null,DEL_IDX=null;
function buildLexSets(){
  if(CE_SET) return;
  CE_SET=new Set(); RU_SET=new Set();
  const add=(s,set)=>{for(const t of String(s||"").toLowerCase().replace(/ё/g,"е").split(/[^а-яӏ-]+/)) if(t.length>2) set.add(t);};
  W.forEach(e=>add(e.c,CE_SET));
  R.forEach(e=>{add(e.c,CE_SET);add(e.r,RU_SET);});
}
function buildDelIdx(){
  if(DEL_IDX) return;
  buildLexSets(); DEL_IDX=new Map();
  for(const t of CE_SET){
    if(t.length<4||t.length>12) continue;
    for(let i=0;i<t.length;i++){
      const k=t.slice(0,i)+t.slice(i+1);
      const arr=DEL_IDX.get(k);
      if(arr){ if(arr.length<4) arr.push(t); } else DEL_IDX.set(k,[t]);
    }
  }
}
let lastFixes=null;
function ceAssist(text){
  buildDelIdx();
  const fixes=[];
  const parts=text.split(/([^а-яёА-ЯЁӏӀ-]+)/);
  for(let i=0;i<parts.length;i++){
    const w=parts[i];
    if(!/[а-яё]/i.test(w)||w.length<4||w.length>12) continue;
    const lw=norm(w);
    if(CE_SET.has(lw)||RU_SET.has(lw)) continue;
    const cands=new Set();
    (DEL_IDX.get(lw)||[]).forEach(t=>cands.add(t));               // il manque une lettre
    for(let k=0;k<lw.length;k++){
      const d=lw.slice(0,k)+lw.slice(k+1);
      if(CE_SET.has(d)) cands.add(d);                              // une lettre en trop
      (DEL_IDX.get(d)||[]).forEach(t=>{ if(t.length===lw.length) cands.add(t); }); // une lettre fausse
    }
    cands.delete(lw);
    if(cands.size===1){ const c=[...cands][0]; fixes.push(w+"\u2192"+c); parts[i]=c; }
  }
  lastFixes=fixes;
  return parts.join("");
}
/* ---------- détection de la langue du document ---------- */
function guessDocLang(t){
  buildLexSets();
  const cyr=(t.toLowerCase().replace(/ё/g,"е").match(/[а-яӏ-]{3,}/g)||[]).slice(0,300);
  if(cyr.length>=5){
    let ce=0,ru=0;
    for(const w of cyr){ if(CE_SET.has(w))ce++; if(RU_SET.has(w))ru++; }
    return ce>=ru?"ce":"ru";
  }
  return (t.match(/[a-zà-ÿ]{3,}/gi)||[]).length>=5?"fr":null;
}

function finishText(text){
  text=text.replace(/[ \t]+/g," ").replace(/\n{3,}/g,"\n\n").trim();
  lastFixes=null;
  const gl=guessDocLang(text);
  if(gl&&$("imp-lang")&&$("imp-lang").value!==gl){ $("imp-lang").value=gl; }
  if($("imp-lang")&&$("imp-lang").value==="ce"){ text=cleanCe(text); text=ceAssist(text); }
  return text;
}
// bouton « OCR avancé » (manuscrit) — affiché après l'OCR gratuit, à la demande de l'utilisateur
function renderRetry(){
  const box=$("imp-retry"); if(!box) return;
  if(!lastImageFile||!aiKey()){ box.innerHTML=""; return; }
  if(visSession>=VIS_SESSION_MAX){ box.innerHTML=`<p class="hint">${T("ocrLimit")}</p>`; return; }
  box.innerHTML=`<button id="imp-adv-btn" class="copy-btn">🔍 ${T("ocrRetry")}</button>`
    +`<p class="hint">${T("ocrRetryHint").replace("{n}",VIS_SESSION_MAX-visSession)}</p>`;
  $("imp-adv-btn").addEventListener("click",runAdvanced);
}
async function runAdvanced(){
  if(!lastImageFile||visSession>=VIS_SESSION_MAX) return;
  const key=aiKey(); if(!key) return;
  const box=$("imp-retry"); box.innerHTML=`<p class="hint">${T("ocrAdvRun")}</p>`;
  try{
    const vt=await geminiOcr(lastImageFile,key);   // IA qui comprend le tchétchène
    visSession++;
    $("imp-text").value=finishText(vt);
    let msg=T("ocrAdv");
    if(lastFixes&&lastFixes.length) msg+=" · "+T("fixedN").replace("{n}",lastFixes.length);
    impStatus(msg);
  }catch(e){ impStatus(T("err")+(e.message||e)); }
  renderRetry();
}

async function extractFile(file){
  const ext=(file.name.split(".").pop()||"").toLowerCase();
  const lang=$("imp-lang").value;
  const ocrLang=lang==="fr"?"fra":lang==="en"?"eng":"rus"; // cyrillique via modèle russe
  let text="";
  if(ext==="txt"){ text=await file.text(); }
  else if(ext==="docx"){
    if(!window.mammoth && !await loadScript(CDN.mammoth)) throw new Error("Lecteur Word inaccessible (internet requis)");
    const r=await mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()});
    text=r.value;
  }
  else if(ext==="pdf"){
    if(!window.pdfjsLib && !await loadScript(CDN.pdf)) throw new Error("Lecteur PDF inaccessible (internet requis)");
    pdfjsLib.GlobalWorkerOptions.workerSrc=CDN.pdfWorker;
    const doc=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
    const forceOcr=false;
    if(!forceOcr){
      for(let i=1;i<=doc.numPages;i++){
        impStatus(`PDF : ${i}/${doc.numPages}…`);
        const tc=await (await doc.getPage(i)).getTextContent();
        text+=tc.items.map(it=>it.str).join(" ")+"\n";
      }
    }
    if(forceOcr || text.replace(/\s/g,"").length<20){ // PDF scanné -> OCR
      text="";
      const n=Math.min(doc.numPages,20);
      for(let i=1;i<=n;i++){
        impStatus(`OCR : ${i}/${n}…`);
        const p=await doc.getPage(i), vp=p.getViewport({scale:2});
        const cv=document.createElement("canvas");cv.width=vp.width;cv.height=vp.height;
        await p.render({canvasContext:cv.getContext("2d"),viewport:vp}).promise;
        text+=await ocrImage(cv,ocrLang)+"\n";
      }
      if(doc.numPages>20) text+="\n[OCR limité aux 20 premières pages]";
    }
  }
  else if(["png","jpg","jpeg","webp","bmp","gif"].includes(ext)){
    impStatus(T("impPrep"));
    text=await ocrImage(file,ocrLang);   // OCR local, gratuit
    lastImageFile=file;                  // pour un éventuel OCR avancé à la demande
  }
  else if(ext==="doc"){ throw new Error("Format .doc ancien non pris en charge : enregistrez le fichier en .docx"); }
  else{ throw new Error("Format non pris en charge : "+ext); }
  return finishText(text);
}
async function handleFile(file){
  if(!file) return;
  lastOcrConf=null; lastImageFile=null;
  const prev=$("imp-prev");
  if(prev){
    if(/^image\//.test(file.type||"")){ try{prev.src=URL.createObjectURL(file);prev.hidden=false;}catch(e){} }
    else prev.hidden=true;
  }
  try{
    impStatus(T("impReading")+" « "+file.name+" »…");
    const t=await extractFile(file);
    $("imp-text").value=t;
    let msg=t?T("impDone").replace("{n}",t.length):T("impNone");
    if(lastOcrConf!=null){ msg+=" · OCR "+lastOcrConf+" %"; }
    if(lastFixes&&lastFixes.length) msg+=" · "+T("fixedN").replace("{n}",lastFixes.length)+" ("+lastFixes.slice(0,6).join(", ")+")";
    impStatus(msg);
    renderRetry();
  }catch(e){ impStatus(T("err")+(e.message||e)); }
}
(function(){
  const drop=$("drop"), fi=$("file-in");
  if(!drop) return;
  fi.addEventListener("change",()=>handleFile(fi.files[0]));
  ["dragover","dragenter"].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add("over");}));
  ["dragleave","drop"].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove("over");}));
  drop.addEventListener("drop",e=>handleFile(e.dataTransfer.files[0]));
  $("imp-trad").addEventListener("click",()=>{
    const t=$("imp-text").value.trim(); if(!t) return;
    const lang=$("imp-lang").value;
    $("trad-in").value=t;
    $("src-lang").value=lang;
    $("dst-lang").value=(lang==="ce")?"fr":"ce";
    document.querySelector('#tabs button[data-tab="trad"]').click();
    doTranslate();
  });
})();


/* ---------- langue de l'interface ---------- */
let CURLANG="fr";
const I18N={
 fr:{trad:"Traducteur",dico:"Dictionnaire",phrases:"Expressions",nombres:"Nombres",gram:"Grammaire","import":"Importer",apropos:"À propos",
  btnTrad:"Traduire",mt:"Traduction en ligne (Google) pour les phrases",
  phTrad:"Mot ou phrase…",phDico:"Chercher un mot (fr, ce, ru, en)… ex : loup, борз",
  phNum:"Entrez un nombre (0–999 999)",impTrad:"Traduire ce texte →",sub:"Noxchiyn Mott · traducteur tchétchène",
  lnFr:"Français",lnCe:"Tchétchène (нохчийн)",lnRu:"Russe",lnEn:"Anglais",
  docLang:"Langue du document :",ocrForce:"forcer l'OCR (document scanné)",dropTxt:"Glissez un fichier ici",
  impHint:"Importez un PDF, Word (.docx), une image (PNG, JPG…) ou un .txt : le texte est extrait (OCR pour les scans) puis traduit. Une photo nette et cadrée donne le meilleur OCR.",
  phrasesHint:"Expressions attestées dans les manuels. Le tchétchène distingue l'interlocuteur homme (ву) et femme (ю).",
  numHint:"Le tchétchène compte en base 20 : 30 = « vingt et dix », 40 = « deux-vingts »…",
  space:"espace",cardExpr:"Expressions",cardDict:"Dictionnaire",cardWbw:"Mot à mot",
  cardNear:"Expressions proches du sens",viaRu:"via le russe",cardMT:"Traduction automatique",
  mtQuery:"Interrogation de Google Translate (directe + pivot russe)…",
  mtWarn:"⚠ Qualité limitée pour le tchétchène — vérifiez les mots importants avec le dictionnaire.",
  mtRaw:"Version brute de Google",mtOther:"Autre version",mtSubs:"✔ Mots russes laissés par Google, remplacés : ",
  mtLong:"Texte long : seuls les 1 800 premiers caractères ont été traduits.",
  mtOffline:"Service en ligne inaccessible (hors ligne ou accès bloqué).",mtOpen:"Ouvrir dans Google Translate ↗",
  mtDirect:"directe",mtPivot:"pivot russe",
  badgeMT:"MT en ligne",badgeAI:"IA",reportBtn:"⚠ Mauvaise traduction",reportAsk:"Quelle serait la bonne traduction ? (facultatif)",reportOk:"Merci ! Votre signalement a été envoyé.",reportErr:"Envoi impossible pour le moment. Réessayez plus tard.",reportSending:"Envoi…",badgeManual:"Manuel",badgeDict:"dictionnaire",badgeWord:"MT mot isolé",
  noRes:"Aucun résultat dans le dictionnaire. Essayez la traduction en ligne ou une autre orthographe (ӏ / 1, аь…).",
  noRes2:"Aucun résultat.",variantOf:"variante de",
  impReading:"Lecture de",impPrep:"Préparation de l'image…",
  impDone:"Texte extrait ({n} caractères). Relisez, corrigez si besoin, puis traduisez.",
  impNone:"Aucun texte détecté. S'il s'agit d'un scan, cochez « forcer l'OCR ».",err:"Erreur : ",ocrModel:"Téléchargement du modèle OCR…",
  "cat:Salutations":"Salutations","cat:Vœux et bénédictions":"Vœux et bénédictions","cat:Hospitalité":"Hospitalité","cat:Événements de la vie":"Événements de la vie","cat:Religion et fêtes":"Religion et fêtes","cat:Respect des aînés":"Respect des aînés","cat:Voyage":"Voyage",phrQ:"Décrivez la situation… ex : quelqu\u2019un a acheté un nouvel habit",phrFound:"Expressions pour cette situation","cat:Politesse":"Politesse","cat:Base":"Base","cat:Conversation":"Conversation","cat:Langue":"Langue","cat:Sentiments":"Sentiments",
  numN:"Nombre",numCE:"Tchétchène",numTL:"Translit.",numST:"Structure",
  install:"Installer",copy:"Copier",copied:"Copié !",adapted1p:"adapté à la 1re personne (« je ») — ву pour un homme, ю pour une femme",badgeRule:"règle",histT:"Historique",histEmpty:"Aucun historique pour l\u2019instant.",histClear:"Effacer",ocrLow:"confiance faible : une photo droite, nette et bien éclairée d\u2019un texte imprimé donnera un bien meilleur résultat.",
  lblHand:"écriture manuscrite",advOpts:"Options",visNoKey:"L\u2019écriture manuscrite nécessite une clé Google Vision (gratuite, 1\u00a0000 images/mois). Créez-la sur console.cloud.google.com (API Vision \u2192 Identifiants \u2192 Clé API), puis collez-la ci-dessus : elle reste sur cet appareil.",
  fixedN:"{n} mot(s) corrigé(s) via le dictionnaire",langDet:"langue détectée",ocrAdv:"transcription améliorée (OCR avancé)",ocrLimit:"Limite atteinte.",ocrRetry:"Transcription incorrecte ? OCR avancé",ocrRetryHint:"Pour l\u2019écriture manuscrite ou les scans difficiles. {n} essai(s) restant(s) pour cette session.",ocrAdvRun:"OCR avancé en cours…",installHow:"Pour installer l\u2019application :\niPhone/iPad : Safari \u2192 bouton Partager \u2192 \u00ab Sur l\u2019\u00e9cran d\u2019accueil \u00bb.\nAndroid/PC : menu du navigateur \u2192 \u00ab Installer l\u2019application \u00bb.",
  aboutHtml:`<h2>Нохчийн мотт — Noxchiyn Mott</h2>
   <p>Ceci est un traducteur pour la langue tchétchène. Il a été créé à l'aide de l'intelligence artificielle, en se basant sur de nombreux documents et dictionnaires libres et open source trouvés en ligne.</p>
   <p>Les ressources restant limitées, la traduction peut parfois être imparfaite et des erreurs peuvent se glisser. <b>Nous avons besoin de votre aide pour l'améliorer.</b></p>
   <p>Chaque fois que vous rencontrez une mauvaise traduction, cliquez sur le bouton « Mauvaise traduction » affiché sous le résultat : cela nous envoie un petit rapport, et nous pourrons corriger.</p>
   <p>Et si vous avez des textes — livres, romans, résumés, poésies, chansons, ou tout autre document (PDF ou autre) — <a href="mailto:{MAIL}?subject=Noxchiyn%20Mott">envoyez-les-nous ✉</a>. Nous pourrons ainsi enrichir l'outil. Ensemble, perfectionnons et préservons la langue tchétchène.</p>
   <p class="hint">Sources : Wiktionnaires (kaikki.org), dictionnaire Matsiev et corpus ouverts (arXiv:2507.12672), ressources pédagogiques. Dictionnaire disponible hors ligne · installable sur téléphone.</p>`},
 ru:{trad:"Переводчик",dico:"Словарь",phrases:"Выражения",nombres:"Числа",gram:"Грамматика","import":"Импорт",apropos:"О программе",
  btnTrad:"Перевести",mt:"Онлайн-перевод (Google) для фраз",
  phTrad:"Слово или фраза…",phDico:"Поиск слова (fr, ce, ru, en)… напр. волк, борз",
  phNum:"Введите число (0–999 999)",impTrad:"Перевести этот текст →",sub:"Noxchiyn Mott · чеченский переводчик",
  lnFr:"Французский",lnCe:"Чеченский (нохчийн)",lnRu:"Русский",lnEn:"Английский",
  docLang:"Язык документа:",ocrForce:"принудительный OCR (скан)",dropTxt:"Перетащите файл сюда",
  impHint:"Импортируйте PDF, Word (.docx), изображение (PNG, JPG…) или .txt: текст извлекается (OCR для сканов) и переводится. Чёткое фото даёт лучший OCR.",
  phrasesHint:"Выражения из учебников. Чеченский различает собеседника-мужчину (ву) и женщину (ю).",
  numHint:"Чеченский счёт — двадцатеричный: 30 = «двадцать и десять», 40 = «два-двадцать»…",
  space:"пробел",cardExpr:"Выражения",cardDict:"Словарь",cardWbw:"Пословно",
  cardNear:"Близкие по смыслу выражения",viaRu:"через русский",cardMT:"Машинный перевод",
  mtQuery:"Запрос к Google Translate (прямой + через русский)…",
  mtWarn:"⚠ Качество перевода для чеченского ограничено — проверяйте важные слова по словарю.",
  mtRaw:"Исходный вариант Google",mtOther:"Другой вариант",mtSubs:"✔ Оставленные Google русские слова заменены: ",
  mtLong:"Длинный текст: переведены только первые 1 800 знаков.",
  mtOffline:"Онлайн-сервис недоступен (нет сети или доступ заблокирован).",mtOpen:"Открыть в Google Translate ↗",
  mtDirect:"прямой",mtPivot:"через русский",
  badgeMT:"онлайн-МП",badgeAI:"ИИ",reportBtn:"⚠ Плохой перевод",reportAsk:"Какой был бы правильный перевод? (необязательно)",reportOk:"Спасибо! Ваше сообщение отправлено.",reportErr:"Не удалось отправить. Попробуйте позже.",reportSending:"Отправка…",badgeManual:"Учебник",badgeDict:"словарь",badgeWord:"МП (слово)",
  noRes:"В словаре ничего не найдено. Попробуйте онлайн-перевод или другое написание (ӏ / 1, аь…).",
  noRes2:"Ничего не найдено.",variantOf:"вариант слова",
  impReading:"Чтение",impPrep:"Подготовка изображения…",
  impDone:"Текст извлечён ({n} знаков). Проверьте и переводите.",
  impNone:"Текст не обнаружен. Если это скан, включите «принудительный OCR».",err:"Ошибка: ",ocrModel:"Загрузка модели OCR…",
  "cat:Salutations":"Приветствия","cat:Vœux et bénédictions":"Пожелания и благословения","cat:Hospitalité":"Гостеприимство","cat:Événements de la vie":"События жизни","cat:Religion et fêtes":"Религия и праздники","cat:Respect des aînés":"Уважение к старшим","cat:Voyage":"Дорога",phrQ:"Опишите ситуацию… напр.: человек купил обновку",phrFound:"Выражения для этой ситуации","cat:Politesse":"Вежливость","cat:Base":"Основное","cat:Conversation":"Разговор","cat:Langue":"Язык","cat:Sentiments":"Чувства",
  numN:"Число",numCE:"Чеченский",numTL:"Транслит.",numST:"Структура",
  install:"Установить",copy:"Копировать",copied:"Скопировано!",adapted1p:"адаптировано к 1-му лицу («я») — ву для мужчины, ю для женщины",badgeRule:"правило",histT:"История",histEmpty:"История пока пуста.",histClear:"Очистить",ocrLow:"низкая уверенность: прямое, чёткое и хорошо освещённое фото печатного текста даст куда лучший результат.",
  lblHand:"рукописный текст",advOpts:"Параметры",visNoKey:"Для рукописного текста нужен ключ Google Vision (бесплатно, 1\u00a0000 изображений/мес). Создайте его на console.cloud.google.com и вставьте выше: он хранится на этом устройстве.",
  fixedN:"{n} слов(а) исправлено по словарю",langDet:"обнаружен язык",ocrAdv:"распознавание улучшено (продвинутый OCR)",ocrLimit:"Лимит достигнут.",ocrRetry:"Плохо распознано? Продвинутый OCR",ocrRetryHint:"Для рукописного текста и сложных сканов. Осталось {n} попыт(ок) в этой сессии.",ocrAdvRun:"Продвинутый OCR…",installHow:"Установка приложения:\niPhone/iPad: Safari \u2192 Поделиться \u2192 \u00abНа экран \u00abДомой\u00bb\u00bb.\nAndroid/ПК: меню браузера \u2192 \u00abУстановить приложение\u00bb.",
  aboutHtml:`<h2>Нохчийн мотт — Noxchiyn Mott</h2>
   <p>Это переводчик чеченского языка. Он создан с помощью искусственного интеллекта на основе множества свободных и открытых документов и словарей, найденных в интернете.</p>
   <p>Ресурсов пока мало, поэтому перевод иногда бывает неточным и возможны ошибки. <b>Нам нужна ваша помощь, чтобы его улучшить.</b></p>
   <p>Каждый раз, когда вы видите плохой перевод, нажмите кнопку «Плохой перевод» под результатом — нам придёт небольшой отчёт, и мы сможем исправить.</p>
   <p>Если у вас есть тексты — книги, романы, пересказы, стихи, песни или любой документ (PDF и т. п.) — <a href="mailto:{MAIL}?subject=Noxchiyn%20Mott">пришлите их нам ✉</a>. Так мы сможем развивать инструмент. Вместе сохраним и усовершенствуем чеченский язык.</p>
   <p class="hint">Источники: Викисловари (kaikki.org), словарь Мациева и открытые корпуса (arXiv:2507.12672), учебные ресурсы. Словарь доступен офлайн.</p>`},
 en:{trad:"Translator",dico:"Dictionary",phrases:"Phrases",nombres:"Numbers",gram:"Grammar","import":"Import",apropos:"About",
  btnTrad:"Translate",mt:"Online translation (Google) for sentences",
  phTrad:"Word or sentence…",phDico:"Search a word (fr, ce, ru, en)… e.g. wolf, борз",
  phNum:"Enter a number (0–999,999)",impTrad:"Translate this text →",sub:"Noxchiyn Mott · Chechen translator",
  lnFr:"French",lnCe:"Chechen (нохчийн)",lnRu:"Russian",lnEn:"English",
  docLang:"Document language:",ocrForce:"force OCR (scanned)",dropTxt:"Drop a file here",
  impHint:"Import a PDF, Word (.docx), image (PNG, JPG…) or .txt: the text is extracted (OCR for scans) and translated. A sharp, well-framed photo gives the best OCR.",
  phrasesHint:"Phrases attested in textbooks. Chechen distinguishes a male (ву) and a female (ю) addressee.",
  numHint:"Chechen counts in base 20: 30 = “twenty and ten”, 40 = “two-twenties”…",
  space:"space",cardExpr:"Phrases",cardDict:"Dictionary",cardWbw:"Word by word",
  cardNear:"Expressions close in meaning",viaRu:"via Russian",cardMT:"Machine translation",
  mtQuery:"Querying Google Translate (direct + Russian pivot)…",
  mtWarn:"⚠ Limited quality for Chechen — check important words in the dictionary.",
  mtRaw:"Google's raw version",mtOther:"Other version",mtSubs:"✔ Russian words left by Google, replaced: ",
  mtLong:"Long text: only the first 1,800 characters were translated.",
  mtOffline:"Online service unreachable (offline or blocked).",mtOpen:"Open in Google Translate ↗",
  mtDirect:"direct",mtPivot:"Russian pivot",
  badgeMT:"online MT",badgeAI:"AI",reportBtn:"⚠ Bad translation",reportAsk:"What would be the correct translation? (optional)",reportOk:"Thanks! Your report was sent.",reportErr:"Could not send right now. Please try again later.",reportSending:"Sending…",badgeManual:"Textbook",badgeDict:"dictionary",badgeWord:"MT (word)",
  noRes:"No dictionary result. Try online translation or another spelling (ӏ / 1, аь…).",
  noRes2:"No results.",variantOf:"variant of",
  impReading:"Reading",impPrep:"Preparing image…",
  impDone:"Text extracted ({n} chars). Review, then translate.",
  impNone:"No text detected. If it is a scan, enable “force OCR”.",err:"Error: ",ocrModel:"Downloading OCR model…",
  "cat:Salutations":"Greetings","cat:Vœux et bénédictions":"Wishes & blessings","cat:Hospitalité":"Hospitality","cat:Événements de la vie":"Life events","cat:Religion et fêtes":"Religion & holidays","cat:Respect des aînés":"Respect for elders","cat:Voyage":"Travel",phrQ:"Describe the situation… e.g. someone bought new clothes",phrFound:"Phrases for this situation","cat:Politesse":"Politeness","cat:Base":"Basics","cat:Conversation":"Conversation","cat:Langue":"Language","cat:Sentiments":"Feelings",
  numN:"Number",numCE:"Chechen",numTL:"Translit.",numST:"Structure",
  install:"Install",copy:"Copy",copied:"Copied!",adapted1p:"adapted to 1st person (\u201cI\u201d) \u2014 ву for a man, ю for a woman",badgeRule:"rule",histT:"History",histEmpty:"No history yet.",histClear:"Clear",ocrLow:"low confidence: a straight, sharp, well-lit photo of printed text will work much better.",
  lblHand:"handwriting",advOpts:"Options",visNoKey:"Handwriting needs a Google Vision key (free, 1,000 images/month). Create it at console.cloud.google.com and paste it above: it stays on this device.",
  fixedN:"{n} word(s) corrected via the dictionary",langDet:"detected language",ocrAdv:"transcription improved (advanced OCR)",ocrLimit:"Limit reached.",ocrRetry:"Bad transcription? Advanced OCR",ocrRetryHint:"For handwriting or difficult scans. {n} attempt(s) left this session.",ocrAdvRun:"Advanced OCR…",installHow:"To install the app:\niPhone/iPad: Safari \u2192 Share \u2192 \u201cAdd to Home Screen\u201d.\nAndroid/PC: browser menu \u2192 \u201cInstall app\u201d.",
  aboutHtml:`<h2>Нохчийн мотт — Noxchiyn Mott</h2>
   <p>This is a translator for the Chechen language. It was built with the help of artificial intelligence, based on many free and open-source documents and dictionaries found online.</p>
   <p>Resources are still limited, so translations can sometimes be imperfect and mistakes may slip in. <b>We need your help to improve it.</b></p>
   <p>Whenever you see a bad translation, click the "Bad translation" button below the result: it sends us a short report so we can fix it.</p>
   <p>And if you have any texts — books, novels, summaries, poems, songs, or any document (PDF or other) — <a href="mailto:{MAIL}?subject=Noxchiyn%20Mott">send them to us ✉</a>. Together, let's improve and preserve the Chechen language.</p>
   <p class="hint">Sources: Wiktionaries (kaikki.org), Matsiev dictionary and open corpora (arXiv:2507.12672), learning resources. Dictionary available offline.</p>`},
 ce:{trad:"Гочдар",dico:"Дошам",phrases:"Аларш",nombres:"Терахьдешнаш",gram:"Грамматика","import":"Импорт",apropos:"Лаьцна",
  btnTrad:"Гочде",mt:"Онлайн-гочдар (Google)",
  phTrad:"Дош я предложени…",phDico:"Дош лаха… (масала : борз)",
  phNum:"Терахь язде (0–999 999)",impTrad:"ХӀара йоза гочде →",sub:"Нохчийн мотт · нохчийн гочдархо",
  lnFr:"Французийн",lnCe:"Нохчийн",lnRu:"Оьрсийн",lnEn:"Ингалсан",
  docLang:"Документан мотт:",cardDict:"Дошам",cardExpr:"Аларш",badgeDict:"дошам",
  "cat:Salutations":"Маршалла","cat:Hospitalité":"Хьошалла","cat:Voyage":"Некъ","cat:Langue":"Мотт",numCE:"Нохчийн",numN:"Терахь"}
};
function T(k){
  const l=I18N[CURLANG]||{};
  if(l[k]!==undefined) return l[k];
  if(CURLANG==="ce"&&I18N.ru[k]!==undefined) return I18N.ru[k];
  return I18N.fr[k]!==undefined?I18N.fr[k]:k;
}
function applyLang(l){
  CURLANG=l;
  document.documentElement.lang=(l==="ce"?"ce":l);
  document.querySelectorAll("#tabs button[data-tab]").forEach(b=>{b.textContent=T(b.dataset.tab);});
  $("btn-trad").textContent=T("btnTrad");
  const set=(id,k)=>{const el=$(id);if(el)el.textContent=T(k);};
set("sub-title","sub");set("lbl-imp-lang","docLang");set("lbl-ocr","ocrForce");
  set("drop-text","dropTxt");set("imp-hint","impHint");set("phrases-hint","phrasesHint");set("num-hint","numHint");
  $("trad-in").placeholder=T("phTrad");
  $("dico-q").placeholder=T("phDico");
  $("num-in").placeholder=T("phNum");
  const pq=$("phr-q"); if(pq) pq.placeholder=T("phrQ");
  const it=$("imp-trad"); if(it) it.textContent=T("impTrad");
  const ins=$("lbl-install"); if(ins) ins.textContent=T("install");
  // noms des langues dans les sélecteurs
  const LN={fr:T("lnFr"),ce:T("lnCe"),ru:T("lnRu"),en:T("lnEn")};
  ["src-lang","dst-lang","imp-lang"].forEach(id=>{
    const sel=$(id); if(!sel||!sel.options) return;
    for(const o of sel.options){ if(LN[o.value]) o.textContent=LN[o.value]; }
  });
  document.querySelectorAll(".kbd-space").forEach(b=>{b.textContent=T("space");});
  if(typeof renderPhrases==="function") renderPhrases();
  if(typeof renderNumTable==="function") renderNumTable();
  if(typeof renderGram==="function") renderGram();
  const ab=$("about-out"); if(ab) ab.innerHTML=T("aboutHtml").replace(/{MAIL}/g,(window.NM_REPORT_EMAIL||""));
}
(function(){
  const sel=$("ui-lang"); if(!sel) return;
  let l=null; try{l=localStorage.getItem("nm_uilang");}catch(e){}
  if(!l){ // premier passage : détecter la langue de l'appareil
    const prefs=(navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language||"fr"])
      .map(x=>String(x).toLowerCase().slice(0,2));
    l=prefs.find(c=>["ce","fr","ru","en"].includes(c))||"en";
  }
  sel.value=l;
  sel.addEventListener("change",()=>{ applyLang(sel.value);
    try{localStorage.setItem("nm_uilang",sel.value);}catch(e){} });
  // applyLang est appelé en fin de script, une fois tout défini
  window.addEventListener("DOMContentLoaded",()=>applyLang(sel.value));
  setTimeout(()=>applyLang(sel.value),0);
})();

/* ---------- historique des traductions / recherches ---------- */
function histGet(k){try{return JSON.parse(localStorage.getItem(k)||"[]");}catch(e){return [];}}
function histAdd(k,it){try{
  let h=histGet(k).filter(x=>!(x.q===it.q&&x.s===it.s&&x.d===it.d));
  h.unshift(it); if(h.length>40) h.length=40;
  localStorage.setItem(k,JSON.stringify(h));
}catch(e){}}
function histRender(key,panel,onPick){
  const h=histGet(key);
  panel.innerHTML=`<div class="card"><div class="hist-head"><h2>${T("histT")}</h2>
    <button class="copy-btn hist-clear">🗑 ${T("histClear")}</button></div>`+
    (h.length?h.map((x,i)=>`<div class="hist-item" data-i="${i}"><span class="hq">${esc(x.q)}</span>${x.s?`<span class="lat">${esc(x.s)}→${esc(x.d)}</span>`:""}</div>`).join("")
             :`<div class="empty">${T("histEmpty")}</div>`)+`</div>`;
  panel.querySelector(".hist-clear").addEventListener("click",()=>{ 
    try{localStorage.removeItem(key);}catch(e){} histRender(key,panel,onPick); });
  panel.querySelectorAll(".hist-item").forEach(el=>el.addEventListener("click",()=>{ 
    panel.hidden=true; onPick(h[+el.dataset.i]); }));
}
function histWire(btnId,panelId,key,onPick){
  const b=$(btnId), p=$(panelId); if(!b||!p) return;
  b.addEventListener("click",()=>{ if(p.hidden){histRender(key,p,onPick);p.hidden=false;} else p.hidden=true; });
}
histWire("btn-hist-t","hist-t","nm_h_trad",it=>{
  $("trad-in").value=it.q;
  if(it.s)$("src-lang").value=it.s; if(it.d)$("dst-lang").value=it.d;
  doTranslate();
});
histWire("btn-hist-d","hist-d","nm_h_dico",it=>{
  const q=$("dico-q"); q.value=it.q; q.dispatchEvent(new Event("input"));
});

/* ---------- affichage manuscrit (cursive attachée) ---------- */
(function(){
  const b=$("btn-cursive"); if(!b)return;
  let on=false; try{on=localStorage.getItem("nm_cursive")==="1";}catch(e){}
  function set(v){on=v;document.body.classList.toggle("cursive",v);b.classList.toggle("on",v);
    try{localStorage.setItem("nm_cursive",v?"1":"0");}catch(e){}}
  set(on);
  b.addEventListener("click",()=>set(!on));
})();

/* ---------- thème sombre ---------- */
(function(){
  const b=$("btn-theme"); if(!b) return;
  let dark=false;
  try{
    const s=localStorage.getItem("nm_theme");
    dark = s ? s==="dark" : (window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches);
  }catch(e){}
  function set(v){ dark=v;
    document.body.classList.toggle("dark",v);
    b.textContent=v?"☀️":"🌙";
    // opt-out du "mode sombre forcé" des navigateurs mobiles :
    // clair = only light (interdit l'assombrissement auto), sombre = dark
    document.documentElement.style.colorScheme=v?"dark":"only light";
    const cs=document.querySelector('meta[name="color-scheme"]');
    if(cs) cs.setAttribute("content",v?"dark":"only light");
    const tc=document.querySelector('meta[name="theme-color"]');
    if(tc) tc.setAttribute("content",v?"#0c2f1d":"#0f5c33");
    try{localStorage.setItem("nm_theme",v?"dark":"light");}catch(e){}
  }
  set(dark);
  b.addEventListener("click",()=>set(!dark));
})();

/* ---------- installation (bouton 📲) ---------- */
(function(){
  const b=$("btn-install"); if(!b) return;
  const standalone=window.matchMedia&&window.matchMedia("(display-mode: standalone)").matches;
  if(standalone) return; // déjà installée : pas de bouton
  b.style.display=""; // toujours visible dans un navigateur
  let deferred=null;
  window.addEventListener("beforeinstallprompt",e=>{
    e.preventDefault(); deferred=e;
  });
  b.addEventListener("click",async()=>{
    if(deferred){ deferred.prompt(); try{await deferred.userChoice;}catch(e){} deferred=null; b.style.display="none"; }
    else alert(T("installHow"));
  });
  window.addEventListener("appinstalled",()=>{b.style.display="none";});
})();

/* ---------- indicateur de défilement des onglets (mobile) ---------- */
(function(){
  const nav=document.getElementById("tabs"), wrap=nav&&nav.parentElement;
  if(!nav||!wrap||!wrap.classList.contains("tabs-wrap")) return;
  function upd(){
    const end=nav.scrollLeft+nav.clientWidth>=nav.scrollWidth-8;
    const scrollable=nav.scrollWidth>nav.clientWidth+8;
    wrap.classList.toggle("at-end",end||!scrollable);
  }
  nav.addEventListener("scroll",upd,{passive:true});
  window.addEventListener("resize",upd);
  setTimeout(upd,0); setTimeout(upd,600);
})();

/* ---------- version visible (diagnostic cache) ---------- */
(function(){const v=document.getElementById("ver");if(v)v.textContent="· v42";})();

/* ---------- PWA ---------- */
if("serviceWorker" in navigator && location.protocol.startsWith("http")){
  navigator.serviceWorker.register("sw.js").catch(()=>{});
}
