(async function(){
  const FLOW_URL = window.AMANAYA_FLOW_URL || "/flows/flow.de.json";
  const STORAGE_KEY = (window.AMANAYA_STORAGE_KEY || "amanaya:flow:de") + ":v1";

  const elStep = document.getElementById("step");
  const elPrev = document.getElementById("prev");
  const elNext = document.getElementById("next");
  const elSave = document.getElementById("save");
  const elProg = document.getElementById("progress");

  let flow, stepIndex = 0, answers = {};

  function saveLocal(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify({stepIndex, answers}));
  }
  function loadLocal(){
    try{
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      if(Number.isInteger(s.stepIndex)) stepIndex = s.stepIndex;
      if(s.answers && typeof s.answers === "object") answers = s.answers;
    }catch(e){}
  }

  function render(){
    const step = flow.steps[stepIndex];
    if(!step){ elStep.innerHTML = "<h2>Danke!</h2><p>Du hast alle Fragen beantwortet.</p>"; elNext.disabled = true; return; }

    // Fortschritt
    elProg.textContent = `Schritt ${stepIndex+1} von ${flow.steps.length}`;

    // Grundgerüst
    let html = `<h2 class="title">${step.title}</h2>`;
    if(step.description) html += `<p class="desc">${step.description}</p>`;

    const val = answers[step.id];

    if(step.type === "single" || step.type === "yesno"){
      const opts = step.type === "yesno"
        ? [{value:"yes",label:"Ja"},{value:"no",label:"Nein"}]
        : (step.options || []);
      html += opts.map(o => `
        <label><input type="radio" name="field" value="${o.value}" ${val===o.value?"checked":""}> ${o.label}</label>
      `).join("");
    }

    if(step.type === "multi"){
      const sel = Array.isArray(val) ? new Set(val) : new Set();
      html += (step.options||[]).map(o => `
        <label><input type="checkbox" name="field" value="${o.value}" ${sel.has(o.value)?"checked":""}> ${o.label}</label>
      `).join("");
    }

    if(step.type === "text"){
      html += `<textarea name="field" rows="5" placeholder="Bitte beschreibe es kurz…">${val?String(val):""}</textarea>`;
    }

    if(step.type === "number"){
      html += `<input type="number" name="field" value="${val??""}">`;
    }

    if(step.type === "date"){
      html += `<input type="date" name="field" value="${val??""}">`;
    }

    elStep.innerHTML = html;
    elPrev.disabled = stepIndex === 0;
  }

  function collect(){
    const step = flow.steps[stepIndex];
    const nodes = elStep.querySelectorAll("[name='field']");
    if(step.type === "single" || step.type === "yesno"){
      const checked = [...nodes].find(n => n.checked);
      if(checked) answers[step.id] = checked.value;
      else if(step.required) return false;
    } else if(step.type === "multi"){
      const vals = [...nodes].filter(n => n.checked).map(n => n.value);
      if(step.required && vals.length===0) return false;
      answers[step.id] = vals;
    } else if(step.type === "text" || step.type === "number" || step.type === "date"){
      const v = nodes[0]?.value ?? "";
      if(step.required && String(v).trim()==="") return false;
      answers[step.id] = v;
    }
    return true;
  }

  function nextStep(){
    if(!collect()){ alert("Bitte fülle die Frage aus."); return; }
    if(stepIndex < flow.steps.length-1){ stepIndex++; saveLocal(); render(); }
    else { saveLocal(); elStep.innerHTML = "<h2>Danke!</h2><p>Du hast alle Fragen beantwortet.</p>"; elNext.disabled = true; }
  }
  function prevStep(){
    if(stepIndex>0){ stepIndex--; saveLocal(); render(); }
  }

  elNext.addEventListener("click", nextStep);
  elPrev.addEventListener("click", prevStep);
  elSave.addEventListener("click", ()=>{ collect(); saveLocal(); alert("Zwischengespeichert."); });

  // Flow laden
  try{
    const res = await fetch(FLOW_URL, { cache: "no-store" });
    flow = await res.json();
    if(!flow || !Array.isArray(flow.steps)) throw new Error("Flow ungültig");
    loadLocal();
    render();
  }catch(e){
    elStep.innerHTML = "<p>Der Fragenkatalog konnte nicht geladen werden.</p>";
    console.error(e);
  }
})();
