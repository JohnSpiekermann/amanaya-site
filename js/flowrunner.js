/* Amanaya Flow Runner (featured first-4 + mobile tap tweaks)
   Requires a flow JSON at window.AMANAYA_FLOW_URL.
*/
(async function(){
  const FLOW_URL   = (window.AMANAYA_FLOW_URL   || "/flows/flow.de.json");
  const STORAGEKEY = (window.AMANAYA_STORAGE_KEY|| "amanaya:flow:de") + ":v3";
  const elStep = document.getElementById("step");
  const elPrev = document.getElementById("prev");
  const elNext = document.getElementById("next");
  const elSave = document.getElementById("save");
  const elProg = document.getElementById("progress");

  // which steps get "featured" styling for their first 4 options
  const FEATURE_FIRST4 = new Set(["zielland","visum_details_A","aufenthaltstitel_details_A","reiseweg_B_aussteller"]);

  let flow, stepsById = new Map();
  let answers = {};
  let labels  = {};        // store *_label helper for substitutions
  let vis = [];            // visible steps in order
  let idx = 0;             // current index in vis

  // local storage helpers
  function saveLocal(){
    localStorage.setItem(STORAGEKEY, JSON.stringify({answers, labels, idx}));
  }
  function loadLocal(){
    try{
      const s = JSON.parse(localStorage.getItem(STORAGEKEY)||"{}");
      if (s && typeof s === "object"){
        answers = s.answers || {};
        labels  = s.labels  || {};
        if (Number.isInteger(s.idx)) idx = s.idx;
      }
    }catch(e){}
  }

  // tiny templating for {{var_label}}
  function substitute(str){
    if (!str) return "";
    return String(str).replace(/\{\{(\w+)\}\}/g, (_,k)=>{
      if (k in labels) return labels[k];
      if (k in answers) return String(answers[k]);
      return "";
    });
  }

  // evaluator for simple expressions like used in flow (next routers)
  function evalExpr(expr){
    try{
      return Function(...Object.keys(answers), `return (${expr});`)(...Object.values(answers));
    }catch(e){
      return null;
    }
  }

  // resolve label for last chosen option of a step
  function labelFor(stepId, value){
    const step = stepsById.get(stepId);
    if (!step || !Array.isArray(step.options)) return null;
    const opt = step.options.find(o => String(o.value) === String(value));
    return opt ? opt.label : null;
  }

  // build map for convenience
  function indexSteps(flow){
    stepsById.clear();
    (flow.flow||[]).forEach(s => stepsById.set(s.id, s));
  }

  // walk flow to compute currently visible sequence using current answers
  function computeVisible(){
    const out = [];
    let cur = (flow.flow && flow.flow[0]) ? flow.flow[0].id : null;
    const guard = new Set();
    while(cur && !guard.has(cur)){
      guard.add(cur);
      const s = stepsById.get(cur);
      if (!s) break;
      out.push(cur);

      // compute next
      let next = null;
      if (s.type === "router" && s.next && s.next.expr){
        next = evalExpr(s.next.expr);
      }else if (s.nextMap && answers[s.id] !== undefined){
        const key = String(answers[s.id]);
        next = s.nextMap.hasOwnProperty(key) ? s.nextMap[key] : null;
      }else{
        next = s.next || null;
      }
      cur = next || null;
    }
    return out;
  }

  // validation
  function isAnswered(step){
    if (!step.required) return true;
    const v = answers[step.id];
    if (step.type === "checkbox") return Array.isArray(v) && v.length>0;
    return v !== undefined && v !== null && v !== "";
  }

  // renderers
  function renderInfo(step){
    const h = step.headline ? `<h2>${step.headline}</h2>` : "";
    const t = step.text ? `<p>${substitute(step.text)}</p>` : "";
    return `<div class="step">${h}${t}</div>`;
  }

  function renderRadio(step){
    const isFeaturedList = FEATURE_FIRST4.has(step.id);
    const opts = (step.options||[]).map((o,i)=>{
      const checked = String(answers[step.id]) === String(o.value) ? "checked" : "";
      const cls = "opt" + (isFeaturedList && i < 4 ? " opt--featured" : "");
      return `
        <label class="${cls}">
          <input type="radio" name="${step.id}" value="${o.value}" ${checked} />
          <span>${substitute(o.label)}</span>
        </label>`;
    }).join("");
    return `
      <div class="step">
        ${step.question?`<h2>${substitute(step.question)}</h2>`:""}
        <div class="options">${opts}</div>
      </div>`;
  }

  function renderCheckbox(step){
    const vals = Array.isArray(answers[step.id]) ? answers[step.id] : [];
    const opts = (step.options||[]).map((o)=>{
      const checked = vals.includes(o.value) ? "checked" : "";
      return `
        <label class="opt">
          <input type="checkbox" name="${step.id}" value="${o.value}" ${checked} />
          <span>${substitute(o.label)}</span>
        </label>`;
    }).join("");
    return `
      <div class="step">
        ${step.question?`<h2>${substitute(step.question)}</h2>`:""}
        <div class="options">${opts}</div>
      </div>`;
  }

  function renderTextarea(step){
    const v = answers[step.id] || "";
    return `
      <div class="step">
        ${step.question?`<h2>${substitute(step.question)}</h2>`:""}
        <textarea name="${step.id}" rows="6" placeholder="Hier schreiben …">${v !== undefined ? String(v) : ""}</textarea>
      </div>`;
  }

  function renderDate(step){
    const v = answers[step.id] || "";
    return `
      <div class="step">
        ${step.question?`<h2>${substitute(step.question)}</h2>`:""}
        <input type="date" name="${step.id}" value="${v}" />
      </div>`;
  }

  function renderStep(){
    const stepId = vis[idx];
    const step = stepsById.get(stepId);
    if (!step){ elStep.innerHTML = `<p>Fehler: Schritt nicht gefunden.</p>`; return; }

    // progress
    if (elProg) elProg.style.width = `${Math.round(((idx+1)/vis.length)*100)}%`;

    // choose renderer
    let html = "";
    switch(step.type){
      case "info": html = renderInfo(step); break;
      case "radio": html = renderRadio(step); break;
      case "checkbox": html = renderCheckbox(step); break;
      case "textarea": html = renderTextarea(step); break;
      case "date": html = renderDate(step); break;
      case "router": html = renderInfo({headline:"…"}); break;
      default: html = `<div class="step"><p>Unbekannter Fragetyp: ${step.type}</p></div>`;
    }
    elStep.innerHTML = html;

    // buttons
    elPrev.disabled = (idx===0);
    elNext.textContent = (idx === vis.length-1) ? "Fertig" : "Weiter";
  }

  // read inputs of the current step and store answers + labels
  function readAndStoreCurrent(){
    const stepId = vis[idx];
    const step = stepsById.get(stepId);
    if (!step) return true;

    if (step.type === "radio"){
      const sel = elStep.querySelector(`input[type="radio"][name="${step.id}"]:checked`);
      if (sel){
        answers[step.id] = (sel.value === "true") ? true : (sel.value === "false" ? false : sel.value);
        const lab = labelFor(step.id, sel.value);
        if (lab){
          labels[`${step.id}_label`] = lab;
          // special: for some placeholders we also mirror to short vars
          if (step.id === "zielland"){ labels["zielland_label"] = lab; }
          if (step.id === "herkunftsland"){ labels["herkunftsland_label"] = lab; }
        }
      }else{
        delete answers[step.id];
      }
    }else if (step.type === "checkbox"){
      const sels = [...elStep.querySelectorAll(`input[type="checkbox"][name="${step.id}"]:checked`)].map(x=>x.value);
      answers[step.id] = sels;
    }else if (step.type === "textarea" || step.type === "date"){
      const el = elStep.querySelector(`[name="${step.id}"]`);
      if (el) answers[step.id] = el.value || "";
    }
    saveLocal();
    return true;
  }

  // validate current required
  function validateCurrent(){
    const step = stepsById.get(vis[idx]);
    if (!step || !step.required) return true;
    const ok = isAnswered(step);
    if (!ok){
      elNext.disabled = true;
      setTimeout(()=>{ elNext.disabled=false; }, 400);
    }
    return ok;
  }

  function goto(delta){
    if (!readAndStoreCurrent()) return;
    if (delta > 0 && !validateCurrent()) return;

    // recompute visible sequence (so back/next respects skipped steps)
    vis = computeVisible();

    let ni = idx + delta;
    if (ni < 0) ni = 0;
    if (ni > vis.length-1) ni = vis.length-1;
    idx = ni;
    saveLocal();
    renderStep();
  }

  // wire buttons
  elPrev.addEventListener("click", ()=> goto(-1));
  elNext.addEventListener("click", ()=> goto(+1));
  elSave.addEventListener("click", ()=> saveLocal());

  // boot
  loadLocal();
  try{
    const res = await fetch(FLOW_URL, {cache:"no-store"});
    if (!res.ok) throw new Error("Flow nicht ladbar");
    flow = await res.json();
    if (!flow || !Array.isArray(flow.flow)) throw new Error("Ungültiges Flow-Format");
    indexSteps(flow);
    // if idx out of range or flow changed, reset
    vis = computeVisible();
    if (idx < 0 || idx >= vis.length) idx = 0;
    renderStep();
  }catch(e){
    elStep.innerHTML = `<p>Der Fragenkatalog konnte nicht geladen werden.</p>`;
  }
})();
