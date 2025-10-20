(async function(){
  const FLOW_URL = "/flows/flow.de.json";
  const STORAGE_KEY = "amanaya:flow:de:v2a";
  const elStep = document.getElementById("step");
  const elPrev = document.getElementById("prev");
  const elNext = document.getElementById("next");
  const elSave = document.getElementById("save");
  const elProg = document.getElementById("progress");
  let flow, visibleSteps = [], visIndex = 0, answers = {};

  function saveLocal(){ localStorage.setItem(STORAGE_KEY, JSON.stringify({visIndex, answers})); }
  function loadLocal(){
    try{ const s=JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}");
      if(Number.isInteger(s.visIndex)) visIndex=s.visIndex;
      if(s.answers) answers=s.answers;
    }catch(e){}
  }

  function getVal(id){ return answers[id]; }
  function includes(arr,val){ return Array.isArray(arr)&&arr.includes(val); }
  function evalExpr(expr){
    if(!expr) return true;
    let js=expr
      .replace(/\s+and\s+|\s*\&\&\s*/gi," && ")
      .replace(/\s+or\s+|\s*\|\|\s*/gi," || ")
      .replace(/([a-zA-Z0-9_]+)\s+includes\s+'([^']+)'/g,(_,k,v)=>`__includes(getVal("${k}"),"${v}")`)
      .replace(/([a-zA-Z0-9_]+)\s*==\s*'([^']+)'/g,(_,k,v)=>`getVal("${k}")==="${v}"`)
      .replace(/([a-zA-Z0-9_]+)\s*!=\s*'([^']+)'/g,(_,k,v)=>`getVal("${k}")!=="${v}"`);
    try{ return Function("getVal","__includes",`return (${js});`)(getVal,includes); }
    catch(e){ console.warn("Condition parse error",expr); return true; }
  }

  function recomputeVisible(){
    visibleSteps = flow.steps.filter(st=>!st.showIf || evalExpr(st.showIf));
    if(visIndex>=visibleSteps.length) visIndex=Math.max(0,visibleSteps.length-1);
  }

  function render(){
    if(visibleSteps.length===0){ elStep.innerHTML="<p>Keine Fragen verfügbar.</p>"; elNext.disabled=true; return;}
    const step=visibleSteps[visIndex];
    elProg.textContent=`Schritt ${visIndex+1} von ${visibleSteps.length}`;
    let html=`<h2 class="title">${step.title||""}</h2>`;
    if(step.description) html+=`<p class="desc">${step.description}</p>`;
    const val=answers[step.id];

    // --- Summary ---
    if(step.type==="summary"){
      html+="<div class='summary'>";
      Object.entries(answers).forEach(([k,v])=>{
        if(v===undefined||v===""||v===null) return;
        const display=Array.isArray(v)?v.join(", "):v;
        html+=`<p><strong>${k}:</strong> ${display}</p>`;
      });
      html+="</div>";
      elStep.innerHTML=html;
      elNext.textContent="Weiter";
      elPrev.disabled=visIndex===0;
      return;
    }

    // --- normale Felder ---
    if(step.type==="single"||step.type==="yesno"){
      const opts=step.type==="yesno"?[{value:"yes",label:"Ja"},{value:"no",label:"Nein"}]:(step.options||[]);
      html+=opts.map(o=>`<label><input type="radio" name="field" value="${o.value}" ${val===o.value?"checked":""}> ${o.label}</label>`).join("");
    }
    if(step.type==="multi"){
      const sel=new Set(Array.isArray(val)?val:[]);
      html+=(step.options||[]).map(o=>`<label><input type="checkbox" name="field" value="${o.value}" ${sel.has(o.value)?"checked":""}> ${o.label}</label>`).join("");
    }
    if(step.type==="text"){ html+=`<textarea name="field" rows="5">${val?String(val):""}</textarea>`; }
    if(step.type==="number"){ html+=`<input type="number" name="field" value="${val??""}">`; }
    if(step.type==="date"){ html+=`<input type="date" name="field" value="${val??""}">`; }

    elStep.innerHTML=html;
    elNext.textContent="Weiter";
    elPrev.disabled=visIndex===0;
  }

  function collect(){
    const step=visibleSteps[visIndex];
    const nodes=elStep.querySelectorAll("[name='field']");
    if(step.type==="single"||step.type==="yesno"){
      const checked=[...nodes].find(n=>n.checked);
      if(checked) answers[step.id]=checked.value; else if(step.required) return false;
    }else if(step.type==="multi"){
      const vals=[...nodes].filter(n=>n.checked).map(n=>n.value);
      if(step.required&&vals.length===0) return false;
      answers[step.id]=vals;
    }else if(["text","number","date"].includes(step.type)){
      const v=nodes[0]?.value??"";
      if(step.required&&String(v).trim()==="") return false;
      answers[step.id]=v;
    }
    return true;
  }

  function nextStep(){
    if(!collect()){ alert("Bitte fülle die Frage aus."); return; }
    recomputeVisible();
    if(visIndex<visibleSteps.length-1){ visIndex++; saveLocal(); render(); }
    else{
      saveLocal();
      elStep.innerHTML="<h2>Danke!</h2><p>Deine Angaben wurden gespeichert.</p>";
      elNext.disabled=true;
    }
  }
  function prevStep(){ if(visIndex>0){ visIndex--; saveLocal(); render(); } }

  elNext.addEventListener("click",nextStep);
  elPrev.addEventListener("click",prevStep);
  elSave.addEventListener("click",()=>{ if(collect()){ saveLocal(); alert("Zwischengespeichert."); }});

  try{
    const res=await fetch(FLOW_URL,{cache:"no-store"});
    flow=await res.json();
    if(!flow||!Array.isArray(flow.steps)) throw new Error("Flow ungültig");
    loadLocal(); recomputeVisible(); render();
  }catch(e){
    console.error(e);
    elStep.innerHTML="<p>Der Fragenkatalog konnte nicht geladen werden.</p>";
  }
})();
