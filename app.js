/* Noxchiyn Mott — logique de l'application
   Données : window.NM_DATA (dict.js), window.NM_PHRASES (phrases.js) */
"use strict";

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
const STOP_FR=new Set("le la les l un une des de du d en y ce cet cette ces se sa son ses mon ma mes ton ta tes notre nos votre vos leur leurs je tu il elle on nous vous ils elles me te lui ne pas plus que qui quoi dont ou et mais donc or ni car a au aux dans pour par sur sous avec sans est es suis sommes etes sont etait etais serai sera ai as avons avez ont avait aura tres trop peu si comme".split(" "));
const STOP_EN=new Set("the a an to of in on at is are am was were be been do does did and or but not no i you he she it we they me him her us them my your his its our their this that these those".split(" "));
const STOP_RU=new Set("и в на не с к у о а же бы ли что как это я ты он она оно мы вы они мой твой его ее наш ваш их за из по до от для при".split(" "));
function isStop(w,lang){const x=normFr(w);
  return lang==="fr"?STOP_FR.has(x):lang==="en"?STOP_EN.has(x):lang==="ru"?STOP_RU.has(x):false;}

const SRC_LBL={"tchetchene.free.fr":"tchetchene.free.fr","waynakh":"Waynakh","ling073":"LING073",
  "ruwikt":"Wiktionary (ru)","diasporaTR":"diaspora TR"};
function refData(ref){
  if(ref.t==="w"){ const e=W[ref.i];
    return {ce:e.c,fr:e.f||"",en:e.e||"",ru:e.r||"",tr:e.t||"",pos:POS_FR[e.p]||e.p,
      src:e.s?(SRC_LBL[e.s]||e.s):"Wiktionary",
      cls:(!e.s||e.s==="ruwikt")?"b-high":"b-mid",v:e.v}; }
  const e=R[ref.i];
  return {ce:e.c,fr:"",en:"",ru:e.r,tr:"",pos:"",src:e.s||"Matsiev",cls:"b-high"};
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
    ${d.pos?`<span class="pos">${d.pos}</span>`:""}
    <span class="tr">${tr.join(" · ")}</span>
    <span class="badge ${d.cls}" title="Source : ${esc(d.src)}">${esc(d.src)}</span></div>`;
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
      if(d.v) tr.push(`<span class="lat">variante de ${esc(d.v)}</span>`);
      html+=`<div class="sense">${d.pos?`<span class="pos">${d.pos}</span> `:""}${tr.join(" · ")} <span class="badge ${d.cls}" title="Source">${esc(d.src)}</span></div>`;
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
  const M=ruTokenMap();
  const vars=[w]; if(w.length>4)vars.push(w.slice(0,-1)); if(w.length>5)vars.push(w.slice(0,-2));
  for(const v of vars){
    const arr=M.get(v); if(!arr) continue;
    let best=null,bs=2;
    for(const i of arr){ const e=R[i], r=e.r.toLowerCase();
      let s=0;
      if(r===w) s+=5; else if(r===v) s+=4;
      const cw=e.c.split(/\s+/).length;
      s+=(cw===1?3:cw===2?1:0);
      if(s>bs){bs=s;best=e;}
    }
    if(best) return best;
  }
  return null;
}
// analyse une sortie MT vers le tchétchène : mots russes non traduits -> substitution.
// Règle : si le mot figure dans le dictionnaire tchétchène (emprunts au russe inclus), on le garde ;
// sinon, s'il est identifié comme russe, on lui substitue l'équivalent du dictionnaire.
function analyzeCe(text){
  const parts=text.split(/([^а-яёА-ЯЁӏӀ-]+)/);
  let leaks=0, unknown=0; const subs=[]; const out=[];
  for(const w of parts){
    if(!/[а-яё]/i.test(w)){out.push(w);continue;}
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
    // ne retraduire que les mots CONFIRMÉS russes par notre corpus (sinon on risque
    // de « traduire » un mot tchétchène rare, cf. вац -> ват)
    const lw=w.toLowerCase(), M=ruTokenMap();
    if(!M.has(lw)&&!M.has(lw.slice(0,-1))&&!M.has(lw.slice(0,-2))) continue;
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
    if(cw.length) res=NM_PHRASES.filter(p=>{const pf=normFr(p.fr);return cw.every(w=>pf.includes(w));});
  }
  return res.slice(0,10);
}
async function doTranslate(){
  const q=$("trad-in").value.trim(), src=$("src-lang").value, dst=$("dst-lang").value;
  const out=$("trad-out"); out.innerHTML="";
  if(!q) return;
  const words=q.split(/\s+/);
  let html="";
  // 1. expressions du guide de conversation
  const ph=phraseMatches(q,src==="ce"?"ce":"fr");
  if(ph.length){
    html+=`<div class="card"><h2>Expressions</h2>`+
      ph.map(p=>`<div class="entry"><span class="ce">${esc(p.ce)}</span><span class="lat">${esc(translit(p.ce))}</span><span class="tr">${esc(p.fr)}</span><span class="badge b-mid">Manuel</span></div>`).join("")+`</div>`;
  }
  // 2. dictionnaire (requête entière) — sens multiples groupés par mot tchétchène
  const refs=dictSection(q,src,dst);
  if(refs.length){
    html+=`<div class="card"><h2>Dictionnaire</h2>`+renderGrouped(refs,dst)+`</div>`;
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
    if(rows) html+=`<div class="card"><h2>Mot à mot (mots porteurs de sens)</h2>${rows}</div>`;
  }
  if(!html&&!$("use-mt").checked){
    html=`<div class="empty">Aucun résultat dans le dictionnaire. Essayez la traduction en ligne ou une autre orthographe (ӏ / 1, аь…).</div>`;
  }
  out.innerHTML=html;
  // 3bis. expressions idiomatiques du dictionnaire Matsiev, trouvées en déduisant le sens
  // via le russe (fr -> ru, puis recherche dans les 13 000+ paires expressions russes-tchétchènes)
  if($("use-mt").checked&&dst==="ce"&&(src==="fr"||src==="en")&&words.length>1&&words.length<=8){
    try{
      const ruQ=(await gtx(src,"ru",q.slice(0,300))).toLowerCase().replace(/[.!?…]+$/,"").trim();
      let er=lookup(ruQ,"ru");
      let rf=dedupe([...er.exact,...er.partial]).filter(r=>r.t==="r");
      if(!rf.length){ // réessai sans les mots-outils russes
        const key=ruQ.split(/\s+/).filter(w=>!STOP_RU.has(w)).join(" ");
        if(key&&key!==ruQ){ er=lookup(key,"ru");
          rf=dedupe([...er.exact,...er.partial]).filter(r=>r.t==="r"); }
      }
      if(!rf.length){ // dernier repli : chaque mot russe porteur, un à un
        const cw=ruQ.split(/\s+/).filter(w=>w.length>3&&!STOP_RU.has(w)).slice(0,4);
        for(const w of cw){ const e3=lookup(w,"ru");
          rf.push(...dedupe([...e3.exact,...e3.partial]).filter(r=>r.t==="r").slice(0,3)); }
        rf=dedupe(rf);
      }
      rf=rf.slice(0,8);
      if(rf.length){
        const div=document.createElement("div"); div.className="card";
        div.innerHTML=`<h2>Expressions proches du sens <span class="hint" style="font-weight:400">(via le russe « ${esc(ruQ)} », dict. Matsiev)</span></h2>`
          +renderGrouped(rf,dst);
        out.appendChild(div);
      }
    }catch(e){}
  }
  // 4. traduction automatique en ligne (phrases ou si rien trouvé)
  if($("use-mt").checked&&(words.length>1||!refs.length)){
    const box=document.createElement("div");
    box.className="card mt-box";
    box.innerHTML=`<h2>Traduction automatique</h2><p class="hint">Interrogation de Google Translate (directe + pivot russe)…</p>`;
    out.appendChild(box);
    const qmt=q.length>1800?q.slice(0,1800):q; // limite de l'API
    try{
      const direct=await gtx(src,dst,qmt).catch(()=>null);
      let pivot=null;
      if(src!=="ru"&&dst!=="ru"){
        try{ pivot=await gtx("ru",dst,await gtx(src,"ru",qmt)); }catch(e){}
      }
      if(!direct&&!pivot) throw new Error("aucune réponse");
      let html=`<h2>Traduction automatique <span class="badge b-low">MT en ligne</span></h2>`;
      if(dst==="ce"){
        const cands=[["directe",direct],["pivot russe",pivot]].filter(c=>c[1])
          .map(([n,t])=>[n,t,analyzeCe(t)]);
        // choisir la version qui contient le MOINS de mots étrangers au dictionnaire tchétchène
        cands.sort((a,b)=>(a[2].leaks+a[2].unknown)-(b[2].leaks+b[2].unknown));
        const [name,raw,anaRaw]=cands[0];
        const ana=await fixLeaksOnline(anaRaw);
        html+=`<p class="ce" style="font-size:1.15rem;font-weight:600">${esc(ana.text)}</p>
          <p class="lat">${esc(translit(ana.text))}</p>`;
        if(ana.subs.length){
          html+=`<p class="hint">✔ Mots russes laissés par Google, remplacés : `
            +ana.subs.map(s=>`<b>${esc(s.ru)}</b> → <span class="ce">${esc(s.ce)}</span> <span class="badge ${s.src==="MT mot"?"b-low":"b-high"}">${s.src==="MT mot"?"MT mot isolé":"dictionnaire"}</span>`).join(" · ")
            +`</p><p class="hint">Version brute de Google (${name}) : ${esc(raw)}</p>`;
        }
        if(cands.length>1&&cands[1][2].text!==ana.text){
          html+=`<p class="hint">Autre version (${cands[1][0]}) : <span class="ce">${esc(cands[1][2].text)}</span></p>`;
        }
      }else{
        const main=direct||pivot;
        html+=`<p style="font-size:1.1rem;font-weight:600">${esc(main)}</p>
          ${isCyr(main)?`<p class="lat">${esc(translit(main))}</p>`:""}`;
        if(pivot&&direct&&pivot!==direct) html+=`<p class="hint">Via le russe : ${esc(pivot)}</p>`;
      }
      if(q.length>1800) html+=`<p class="hint">Texte long : seuls les 1 800 premiers caractères ont été traduits.</p>`;
      html+=`<p class="warn">⚠ Qualité limitée pour le tchétchène — vérifiez les mots importants avec le dictionnaire ci-dessus.</p>`;
      box.innerHTML=html;
    }catch(e){
      const gl=`https://translate.google.com/?sl=${src}&tl=${dst}&text=${encodeURIComponent(q)}`;
      box.innerHTML=`<h2>Traduction automatique</h2>
        <p class="hint">Service en ligne inaccessible depuis l'application (hors ligne ou accès bloqué).
        <a href="${gl}" target="_blank" rel="noopener">Ouvrir dans Google Translate ↗</a></p>`;
    }
  }
}

/* ---------- dictionnaire ---------- */
$("dico-stats").textContent=`${W.length} entrées (Wiktionary en/ru, tchetchene.free.fr, Waynakh, LING073, diaspora TR) + ${R.length} paires tchétchène-russe (Matsiev intégral, Bersanov, BaltoSlav).`;
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
      : `<div class="empty">Aucun résultat.</div>`;
  },200);
});

/* ---------- expressions ---------- */
(function(){
  const cats=[...new Set(NM_PHRASES.map(p=>p.cat))];
  $("phrases-out").innerHTML=cats.map(c=>
    `<div class="card"><h2>${esc(c)}</h2>`+
    NM_PHRASES.filter(p=>p.cat===c).map(p=>
      `<div class="entry"><span class="ce">${esc(p.ce)}</span><span class="lat">${esc(translit(p.ce))}</span><span class="tr">${esc(p.fr)}</span><span class="badge b-mid">Manuel</span></div>`).join("")+`</div>`).join("");
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
(function(){
  const rows=[[1,"—"],[2,"—"],[3,"—"],[4,"—"],[5,"—"],[6,"—"],[7,"—"],[8,"—"],[9,"—"],[10,"—"],
   [11,"10+1"],[15,"10+5"],[19,"« vingt moins un »"],[20,"base"],[30,"20+10"],[40,"2×20"],[50,"2×20+10"],
   [60,"3×20"],[70,"3×20+10"],[80,"4×20"],[90,"4×20+10"],[100,"—"],[200,"2×100"],[1000,"—"]];
  $("num-table").innerHTML=`<table><tr><th>Nombre</th><th>Tchétchène</th><th>Translit.</th><th>Structure</th></tr>`+
    rows.map(([n,s])=>{const w=num2ce(n);return `<tr><td>${n}</td><td><b>${esc(w)}</b></td><td>${esc(translit(w))}</td><td>${s}</td></tr>`;}).join("")+`</table>`;
})();

/* ---------- grammaire ---------- */
(function(){
  // Déclinaison réelle de москал (dinde) reconstituée depuis les données Wiktionary
  const cases=[["nominatif","nominative"],["génitif","genitive"],["datif","dative"],["ergatif","ergative"],
    ["instrumental","instrumental"],["matériel (substantif)","substantive"],["comparatif","comparative degree"],["locatif","locative"]];
  let mrows="";
  for(const [frc,enc] of cases){
    const sg=W.find(e=>e.e===`${enc} singular of москал`||(enc==="nominative"&&e.c==="москал"&&e.e!=="nominative plural of москал"&&!e.e.includes(" of ")));
    const pl=W.find(e=>e.e===`${enc} plural of москал`);
    if(sg||pl) mrows+=`<tr><td>${frc}</td><td class="ce">${sg?esc(sg.c):"москал"}</td><td class="ce">${pl?esc(pl.c):"—"}</td></tr>`;
  }
  $("gram-out").innerHTML=`
  <div class="card gram">
    <h2>Alphabet et sons particuliers</h2>
    <p>Le tchétchène s'écrit en cyrillique, avec des lettres propres. La <b>palotchka Ӏ</b> marque des consonnes «&nbsp;éjectives&nbsp;» ou pharyngales (son produit avec un coup de glotte).</p>
    <table><tr><th>Lettre</th><th>Prononciation approchée</th></tr>
    <tr><td class="ce">аь / оь / уь</td><td>voyelles antérieures : « è », « eu » (fr. p<b>eu</b>r), « u » (fr. t<b>u</b>)</td></tr>
    <tr><td class="ce">Ӏ</td><td>consonne pharyngale sonore (comme l'arabe ʿayn ع)</td></tr>
    <tr><td class="ce">хӀ</td><td>« h » aspiré (angl. <i>h</i>ello)</td></tr>
    <tr><td class="ce">хь</td><td>« h » pharyngal fort (arabe ح)</td></tr>
    <tr><td class="ce">х</td><td>« kh » guttural (esp. <i>j</i>ota, all. Ba<i>ch</i>)</td></tr>
    <tr><td class="ce">гӀ</td><td>« gh », r grasseyé (arabe غ)</td></tr>
    <tr><td class="ce">кх</td><td>« q » uvulaire (arabe ق)</td></tr>
    <tr><td class="ce">къ, кӀ, пӀ, тӀ, цӀ, чӀ</td><td>consonnes éjectives (k', p', t', ts', tch' « claquées »)</td></tr></table>
  </div>
  <div class="card gram">
    <h2>Classes nominales (accord)</h2>
    <p>Chaque nom appartient à l'une de <b>6 classes</b>. Les verbes et adjectifs qui s'accordent portent un préfixe de classe : <b>в-</b> (homme), <b>й-</b> (femme), <b>б-</b>, <b>д-</b>… Le verbe « être » : <span class="ce">ву / ю / бу / ду</span>.</p>
    <table><tr><th>Exemple</th><th>Sens</th></tr>
    <tr><td class="ce">стаг ву</td><td>l'homme est (classe 1, в-)</td></tr>
    <tr><td class="ce">зуда ю</td><td>la femme est (classe 2, й-)</td></tr>
    <tr><td class="ce">мотт бу</td><td>la langue est (classe б-)</td></tr>
    <tr><td class="ce">хи ду</td><td>l'eau est (classe д-)</td></tr></table>
    <p class="hint">C'est pour cela que plusieurs expressions changent selon qu'on parle à un homme ou à une femme (ву/ю).</p>
  </div>
  <div class="card gram">
    <h2>Déclinaison : 8 cas</h2>
    <p>Le nom se décline. Suffixes de base : génitif <span class="ce">-н</span>, datif <span class="ce">-на</span>, ergatif <span class="ce">-о/-с</span>, instrumental <span class="ce">-ца</span>, matériel <span class="ce">-х</span>, comparatif <span class="ce">-л</span>, locatif <span class="ce">-хь/-га/-ра</span>. Exemple réel tiré du Wiktionary — <span class="ce">москал</span> (dinde) :</p>
    <table><tr><th>Cas</th><th>Singulier</th><th>Pluriel</th></tr>${mrows}</table>
    <p class="hint">La voyelle du radical change souvent (ex. : мотт → меттан « de la langue »). Cherchez la forme dans le dictionnaire : les formes fléchies connues y sont référencées.</p>
  </div>
  <div class="card gram">
    <h2>Phrase et verbe</h2>
    <p>Ordre habituel : <b>Sujet – Objet – Verbe</b> (SOV). Le tchétchène est une langue <b>ergative</b> : le sujet d'un verbe transitif prend le cas ergatif (<span class="ce">со</span> « je » → <span class="ce">ас</span>). Ex. : <span class="ce">Ас нохчийн мотт ӏамабо</span> — « J'apprends la langue tchétchène ».</p>
    <p>Le verbe ne s'accorde pas en personne, mais en <b>classe</b> (préfixe в/й/б/д) pour les verbes à initiale de classe : <span class="ce">ван / ян / бан / дан</span> « faire ».</p>
    <p class="hint">Références : J. Nichols (Berkeley), fiche « Le tchétchène » du CNRS-LGIDF.</p>
  </div>`;
})();

/* ---------- import de fichiers (PDF, Word, images) ---------- */
function loadScript(srcs){
  srcs=Array.isArray(srcs)?srcs:[srcs];
  return srcs.reduce((p,s)=>p.catch(()=>new Promise((res,rej)=>{
    const el=document.createElement("script");el.src=s;el.onload=res;el.onerror=rej;
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
// prétraitement image : agrandissement, niveaux de gris, contraste étiré — améliore nettement l'OCR
async function preOcr(file){
  const img=await createImageBitmap(file);
  const scale=Math.min(3.5,Math.max(1,1800/Math.max(img.width,img.height)));
  const w=Math.round(img.width*scale), h=Math.round(img.height*scale);
  const cv=document.createElement("canvas"); cv.width=w; cv.height=h;
  const cx=cv.getContext("2d"); cx.imageSmoothingQuality="high";
  cx.drawImage(img,0,0,w,h);
  const d=cx.getImageData(0,0,w,h), p=d.data;
  let min=255,max=0;
  for(let i=0;i<p.length;i+=4){const g=.299*p[i]+.587*p[i+1]+.114*p[i+2];p[i]=p[i+1]=p[i+2]=g;if(g<min)min=g;if(g>max)max=g;}
  const rg=Math.max(1,max-min);
  for(let i=0;i<p.length;i+=4){const g=(p[i]-min)*255/rg;p[i]=p[i+1]=p[i+2]=g;}
  cx.putImageData(d,0,0);
  return cv;
}
async function ocrImage(img,lang){
  if(!window.Tesseract && !await loadScript(CDN.tesseract)) throw new Error("OCR inaccessible (internet requis)");
  const r=await Tesseract.recognize(img,lang,{logger:m=>{
    if(m.status==="recognizing text") impStatus(`OCR en cours… ${Math.round(m.progress*100)} %`);
    else if(m.status==="loading language traineddata") impStatus("Téléchargement du modèle OCR…");
  }});
  return r.data.text;
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
    const forceOcr=$("imp-ocr").checked;
    if(!forceOcr){
      for(let i=1;i<=doc.numPages;i++){
        impStatus(`Lecture du PDF : page ${i}/${doc.numPages}…`);
        const tc=await (await doc.getPage(i)).getTextContent();
        text+=tc.items.map(it=>it.str).join(" ")+"\n";
      }
    }
    if(forceOcr || text.replace(/\s/g,"").length<20){ // PDF scanné -> OCR
      text="";
      const n=Math.min(doc.numPages,20);
      for(let i=1;i<=n;i++){
        impStatus(`OCR du PDF : page ${i}/${n}…`);
        const p=await doc.getPage(i), vp=p.getViewport({scale:2});
        const cv=document.createElement("canvas");cv.width=vp.width;cv.height=vp.height;
        await p.render({canvasContext:cv.getContext("2d"),viewport:vp}).promise;
        text+=await ocrImage(cv,ocrLang)+"\n";
      }
      if(doc.numPages>20) text+="\n[OCR limité aux 20 premières pages]";
    }
  }
  else if(["png","jpg","jpeg","webp","bmp","gif"].includes(ext)){
    impStatus("Préparation de l'image (netteté, contraste)…");
    text=await ocrImage(await preOcr(file),ocrLang);
  }
  else if(ext==="doc"){ throw new Error("Format .doc ancien non pris en charge : enregistrez le fichier en .docx"); }
  else{ throw new Error("Format non pris en charge : "+ext); }
  text=text.replace(/[ \t]+/g," ").replace(/\n{3,}/g,"\n\n").trim();
  if(lang==="ce") text=cleanCe(text);
  return text;
}
async function handleFile(file){
  if(!file) return;
  try{
    impStatus("Lecture de « "+file.name+" »…");
    const t=await extractFile(file);
    $("imp-text").value=t;
    impStatus(t?`Texte extrait (${t.length} caractères). Relisez, corrigez si besoin, puis « Traduire ».`
              :"Aucun texte détecté. S'il s'agit d'un scan, cochez « forcer l'OCR ».");
  }catch(e){ impStatus("Erreur : "+(e.message||e)); }
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
const I18N={
 fr:{trad:"Traducteur",dico:"Dictionnaire",phrases:"Expressions",nombres:"Nombres",gram:"Grammaire","import":"Importer",apropos:"À propos",
  btnTrad:"Traduire",mt:"Traduction en ligne (Google) pour les phrases",manu:"✍ manuscrit",
  phTrad:"Mot ou phrase… (клавиатура нохчийн ↓)",phDico:"Chercher un mot (fr, ce, ru, en)… ex : loup, борз",
  phNum:"Entrez un nombre (0–999 999)",impTrad:"Traduire ce texte →",sub:"Noxchiyn Mott · traducteur tchétchène"},
 ru:{trad:"Переводчик",dico:"Словарь",phrases:"Выражения",nombres:"Числа",gram:"Грамматика","import":"Импорт",apropos:"О программе",
  btnTrad:"Перевести",mt:"Онлайн-перевод (Google) для фраз",manu:"✍ рукописный",
  phTrad:"Слово или фраза…",phDico:"Поиск слова (fr, ce, ru, en)… напр. волк, борз",
  phNum:"Введите число (0–999 999)",impTrad:"Перевести этот текст →",sub:"Noxchiyn Mott · чеченский переводчик"},
 en:{trad:"Translator",dico:"Dictionary",phrases:"Phrases",nombres:"Numbers",gram:"Grammar","import":"Import",apropos:"About",
  btnTrad:"Translate",mt:"Online translation (Google) for sentences",manu:"✍ cursive",
  phTrad:"Word or sentence…",phDico:"Search a word (fr, ce, ru, en)… e.g. wolf, борз",
  phNum:"Enter a number (0–999,999)",impTrad:"Translate this text →",sub:"Noxchiyn Mott · Chechen translator"},
 ce:{trad:"Гочдар",dico:"Дошам",phrases:"Аларш",nombres:"Терахьдешнаш",gram:"Грамматика","import":"Импорт",apropos:"Лаьцна",
  btnTrad:"Гочде",mt:"Онлайн-гочдар (Google)",manu:"✍ куьйган йоза",
  phTrad:"Дош я предложени…",phDico:"Дош лаха… (масала : борз)",
  phNum:"Терахь язде (0–999 999)",impTrad:"ХӀара йоза гочде →",sub:"Нохчийн мотт · нохчийн гочдархо"}
};
function applyLang(l){
  const t=k=>(I18N[l]&&I18N[l][k])||I18N.fr[k];
  document.querySelectorAll("#tabs button[data-tab]").forEach(b=>{b.textContent=t(b.dataset.tab);});
  $("btn-trad").textContent=t("btnTrad");
  const m=$("lbl-mt"); if(m) m.textContent=t("mt");
  const c=$("btn-cursive"); if(c) c.textContent=t("manu");
  $("trad-in").placeholder=t("phTrad");
  $("dico-q").placeholder=t("phDico");
  $("num-in").placeholder=t("phNum");
  const it=$("imp-trad"); if(it) it.textContent=t("impTrad");
  const st=$("sub-title"); if(st) st.textContent=t("sub");
}
(function(){
  const sel=$("ui-lang"); if(!sel) return;
  let l="fr"; try{l=localStorage.getItem("nm_uilang")||"fr";}catch(e){}
  sel.value=l; applyLang(l);
  sel.addEventListener("change",()=>{ applyLang(sel.value);
    try{localStorage.setItem("nm_uilang",sel.value);}catch(e){} });
})();

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
    try{localStorage.setItem("nm_theme",v?"dark":"light");}catch(e){}
  }
  set(dark);
  b.addEventListener("click",()=>set(!dark));
})();

/* ---------- PWA ---------- */
if("serviceWorker" in navigator && location.protocol.startsWith("http")){
  navigator.serviceWorker.register("sw.js").catch(()=>{});
}
