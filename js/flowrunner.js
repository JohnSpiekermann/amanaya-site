(function(){
  const FLOW_URL   = (window.AMANAYA_FLOW_URL    || "/flows/flow.de.json");
  const STORAGEKEY = (window.AMANAYA_STORAGE_KEY || "amanaya:flow:de") + ":v14";

  const elStep = document.getElementById("step");
  const elPrev = document.getElementById("prev");
  const elNext = document.getElementById("next");

  // nie wegsparen:
  const FORCE_SHOW    = new Set(["flucht_details_freitext","innerstaatlicher_schutz_details"]);
  const FORCE_REQUIRE = new Set(["flucht_details_freitext","innerstaatlicher_schutz_details"]);
  const FEATURE_FIRST4 = new Set(["zielland","visum_details_A","aufenthaltstitel_details_A","reiseweg_B_aussteller"]);

  let flow=null, stepsById=new Map(), answers={}, labels={}, vis=[], idx=0;

  function save(){ localStorage.setItem(STORAGEKEY, JSON.stringify({answers,labels,vis,idx})); }
  function load(){
    try{
      const s=JSON.parse(localStorage.getItem(STORAGEKEY)||"{}");
      answers=s.answers||{}; labels=s.labels||{};
      vis=Array.isArray(s.vis)?s.vis:[]; idx=Number.isInteger(s.idx)?s.idx:0;
    }catch(e){}
  }
  function reset(){ try{localStorage.removeItem(STORAGEKEY);}catch(e){} answers={};labels={};vis=[];idx=0; }

  function sub(str){
    if(!str) return "";
    return String(str).replace(/\{\{(\w+)\}\}/g,(_,k)=> (k in labels)?labels[k]:(k in answers?String(answers[k]):""));
  }
  function evalExpr(expr){
    try{
      return Function.apply(null,[...Object.keys(answers),"return ("+expr+");"])
                     .apply(null,Object.values(answers));
    }catch(e){ return null; }
  }
  function qText(step){
    if(!step || step.question==null) return "";
    if(typeof step.question==="string") return sub(step.question);
    if(step.question && typeof step.question==="object" && "expr" in step.question){
      const v=evalExpr(step.question.expr); return sub(v!=null?String(v):"");
    }
    return "";
  }
  function optLabel(stepId,val){
    const s=stepsById.get(stepId); if(!s||!Array.isArray(s.options)) return null;
    const o=s.options.find(o=>String(o.value)===String(val)); return o?o.label:null;
  }
  function firstId(){ return (flow&&Array.isArray(flow.flow)&&flow.flow.length)?flow.flow[0].id:null; }
  function nextFrom(step){
    if(!step) return null;
    if(step.type==="router"){
      if(step.next && step.next.expr){ const nid=evalExpr(step.next.expr); return nid||null; }
      return null;
    }
    if(step.nextMap){
      const v=answers[step.id]; if(v===undefined) return null;
      const key=String(v);
      if(Object.prototype.hasOwnProperty.call(step.nextMap,key)) return step.nextMap[key]||null;
      return null;
    }
    return step.next || null;
  }

  // --- Renderer
  function renderInfo(s){
    const h=s.headline?`<h2>${s.headline}</h2>`:"";
    const t=s.text?`<p>${sub(s.text)}</p>`:"";
    return `<div class="step">${h}${t}</div>`;
  }
  function renderRadio(s){
    const q=qText(s), feat=FEATURE_FIRST4.has(s.id);
    const opts=(s.options||[]).map((o,i)=>{
      const checked=String(answers[s.id])===String(o.value)?"checked":"";
      const cls="opt"+(feat&&i<4?" opt--featured":"");
      return `<label class="${cls}"><input type="radio" name="${s.id}" value="${o.value}" ${checked}/><span>${sub(o.label)}</span></label>`;
    }).join("");
    return `<div class="step">${q?`<h2>${q}</h2>`:""}<div class="options">${opts}</div></div>`;
  }
  function renderCheckbox(s){
    const q=qText(s), vals=Array.isArray(answers[s.id])?answers[s.id]:[];
    const opts=(s.options||[]).map(o=>{
      const checked=vals.indexOf(o.value)>=0?"checked":"";
      return `<label class="opt"><input type="checkbox" name="${s.id}" value="${o.value}" ${checked}/><span>${sub(o.label)}</span></label>`;
    }).join("");
    return `<div class="step">${q?`<h2>${q}</h2>`:""}<div class="options">${opts}</div></div>`;
  }
  function renderTextarea(s){
    const q=qText(s), v=answers[s.id]||"";
    return `<div class="step">${q?`<h2>${q}</h2>`:""}<textarea name="${s.id}" rows="6" placeholder="Hier schreiben …">${v!==undefined?String(v):""}</textarea></div>`;
  }
  function renderDate(s){
    const q=qText(s), v=answers[s.id]||"";
    return `<div class="step">${q?`<h2>${q}</h2>`:""}<input type="date" name="${s.id}" value="${v}"/></div>`;
  }

  function render(){
    const sid=vis[idx], s=stepsById.get(sid);
    if(!s){ elStep.innerHTML='<div class="step"><p>Fehler: Schritt nicht gefunden.</p></div>'; return; }
    if(s.type==="router"){ go(+1,true); return; }

    let html="";
    switch(s.type){
      case "info": html=renderInfo(s); break;
      case "radio": html=renderRadio(s); break;
      case "checkbox": html=renderCheckbox(s); break;
      case "textarea": html=renderTextarea(s); break;
      case "date": html=renderDate(s); break;
      default: html=`<div class="step"><p>Unbekannter Fragetyp: ${s.type}</p></div>`;
    }
    elStep.innerHTML=html;

    // Back: **immer** anzeigen (außer wirklich am allerersten Intro-Schritt)
    const atAbsoluteStart = (idx===0 && vis.length>0 && vis[0]===firstId());
    elPrev.style.visibility = atAbsoluteStart ? "hidden" : "visible";
    elPrev.disabled = atAbsoluteStart ? true : false;

    // Button-Text
    elNext.textContent = atAbsoluteStart ? "Start" : "Weiter";
    if(s.id==="abschluss_hint"){
      elNext.textContent="Fertig";
      elNext.onclick=function(){ location.href="/beratung"; };
    }else{
      elNext.onclick=function(){ go(+1,false); };
    }
  }

  // onAnswer.set (inkl. "$value" und {"expr": "..."} )
  function applyOnAnswerSet(step, rawValue){
    if(!step || !step.onAnswer || !step.onAnswer.set) return;
    const spec = step.onAnswer.set;
    Object.keys(spec).forEach(k=>{
      const v = spec[k];
      if (v === "$value"){
        answers[k] = rawValue;
      } else if (v && typeof v === "object" && "expr" in v){
        answers[k] = evalExpr(v.expr);
      } else {
        answers[k] = v;
      }
    });
  }

  function readStore(){
    const sid=vis[idx], s=stepsById.get(sid); if(!s) return true;
    let rawValue;
    if(s.type==="radio"){
      const sel=elStep.querySelector(`input[type="radio"][name="${s.id}"]:checked`);
      if(sel){
        rawValue=(sel.value==="true")?true:(sel.value==="false"?false:sel.value);
        answers[s.id]=rawValue;
        const lab=optLabel(s.id, sel.value);
        if(lab){
          labels[s.id+"_label"]=lab;
          if(s.id==="zielland") labels["zielland_label"]=lab;
          if(s.id==="herkunftsland") labels["herkunftsland_label"]=lab;
          if(s.id==="dublin_land"||s.id==="dublinland") labels["dublinland_label"]=lab;
        }
      }else{ delete answers[s.id]; }
    }else if(s.type==="checkbox"){
      rawValue=[...elStep.querySelectorAll(`input[type="checkbox"][name="${s.id}"]:checked`)].map(x=>x.value);
      answers[s.id]=rawValue;
    }else if(s.type==="textarea"||s.type==="date"){
      const el=elStep.querySelector(`[name="${s.id}"]`);
      rawValue = el ? (el.value||"") : "";
      answers[s.id]=rawValue;
    }

    applyOnAnswerSet(s, rawValue);
    save(); 
    return true;
  }

  function isValid(){
    const s=stepsById.get(vis[idx]); if(!s) return true;
    const v=answers[s.id];
    if(FORCE_REQUIRE.has(s.id) && s.type==="textarea"){ return v!=null && String(v).trim().length>0; }
    if(!s.required) return true;
    if(s.type==="checkbox") return Array.isArray(v)&&v.length>0;
    return v!==undefined && v!==null && v!=="";
  }

  function go(delta, fromRouter){
    if(delta>0){
      if(!fromRouter){
        readStore();
        if(!isValid()) return;
      }
      if(idx<vis.length-1) vis=vis.slice(0,idx+1);

      let cur=stepsById.get(vis[idx]);
      let nextId=nextFrom(cur);

      let guard=0;
      while(nextId){
        const next=stepsById.get(nextId);
        if(!next) break;
        vis.push(nextId);
        if(FORCE_SHOW.has(nextId) && next.type==="textarea") break;
        if(next.type!=="router") break;
        nextId=nextFrom(next);
        guard++; if(guard>50) break;
      }
      if(idx<vis.length-1) idx++;
    }else if(delta<0){
      // Back: ein Schritt zurück, nicht weiter slicen
      idx=Math.max(0, idx-1);
    }
    save(); render();
  }

  (function init(){
    if(location.search.indexOf("reset=1")>=0) reset();
    load();
    fetch(FLOW_URL,{cache:"no-store"})
      .then(r=>{ if(!r.ok) throw new Error("Flow nicht ladbar"); return r.json(); })
      .then(j=>{
        flow=j||{}; stepsById.clear(); (flow.flow||[]).forEach(s=>stepsById.set(s.id,s));
        if(!vis.length){ const start=firstId(); if(!start) throw new Error("Flow ist leer."); vis=[start]; idx=0; }
        if(!stepsById.get(vis[idx]||"")){ vis=[firstId()]; idx=0; }
        save(); render();
      })
      .catch(e=>{
        elStep.innerHTML='<div class="step"><h2>Der Fragenkatalog konnte nicht geladen werden.</h2>'
          +'<p style="color:#a00"><strong>Fehler:</strong> '+(e&&e.message?e.message:String(e))+'</p>'
          +'<p><a href="?reset=1">Lokale Daten löschen</a> und erneut versuchen.</p>'
          +'<p><a href="'+FLOW_URL+'" target="_blank" rel="noopener">Flow-Datei öffnen</a></p></div>';
      });

    elPrev.addEventListener("click", ()=>go(-1,false));
    elNext.addEventListener("click", ()=>go(+1,false));
  })();
})();
