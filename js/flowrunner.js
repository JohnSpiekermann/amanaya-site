/* Amanaya Flowrunner – v2.3 (diag+polyfills+hard errors) */
(function(){
  /* ---- Polyfills ---- */
  if (!window.CSS) window.CSS = {};
  if (typeof window.CSS.escape !== "function") {
    window.CSS.escape = function (value) {
      return String(value).replace(/[^a-zA-Z0-9_\-]/g, '\\$&');
    };
  }
  if (!Array.isArray) {
    Array.isArray = function(arg){ return Object.prototype.toString.call(arg) === "[object Array]"; };
  }
})();

/* ---- Global Diagnose auf der Seite ---- */
function diag(msg){
  try{
    var d = document.getElementById("diag");
    if (d) d.textContent = String(msg);
  }catch(e){}
}
window.addEventListener("error", function(e){
  diag("JS-Fehler: " + (e && e.message ? e.message : e));
});

/* ---- Main IIFE ---- */
(async function () {
  try {
    const FLOW_URL    = (window.AMANAYA_FLOW_URL || "/flows/flow.de.json") + "?v=v23_" + Date.now();
    const STORAGE_KEY = (window.AMANAYA_STORAGE_KEY || "amanaya:flow:de") + ":v23";

    const elStep = document.getElementById("step");
    const elPrev = document.getElementById("prev");
    const elNext = document.getElementById("next");
    const elProg = document.getElementById("progress");

    function have(id){ return !!document.getElementById(id); }
    if (!elStep || !elPrev || !elNext || !elProg) {
      document.body.innerHTML = `
        <div style="font-family:system-ui;padding:16px;max-width:760px;margin:40px auto;background:#fff4f4;border:1px solid #ffd6d6;border-radius:12px">
          <h2 style="margin:0 0 8px">Fehlende Halter-Elemente</h2>
          <p>Erforderlich sind exakt diese IDs:</p>
          <ul>
            <li>#step: ${have('step')?'✅':'❌ fehlt'}</li>
            <li>#prev: ${have('prev')?'✅':'❌ fehlt'}</li>
            <li>#next: ${have('next')?'✅':'❌ fehlt'}</li>
            <li>#progress: ${have('progress')?'✅':'❌ fehlt'}</li>
          </ul>
        </div>`;
      return;
    }

    // Zustand
    let flow = [];
    let visibleSteps = [];
    let visIndex = 0;
    let answers = {};

    function saveLocal(){
      try{ localStorage.setItem(STORAGE_KEY, JSON.stringify({visIndex, answers})); }catch(e){}
    }
    function loadLocal(){
      try{
        const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
        if (Number.isInteger(s.visIndex)) visIndex = s.visIndex;
        if (s.answers && typeof s.answers === "object") answers = s.answers;
      }catch(e){}
    }
    function clearLocal(){ try{ localStorage.removeItem(STORAGE_KEY); }catch(e){} }

    function getAnswer(id){ return answers[id]; }
    function setAnswer(id,v){ answers[id]=v; saveLocal(); }

    function optionLabelFor(stepId, value){
      const step = flow.find(s => s.id === stepId);
      if (!step || !Array.isArray(step.options)) return null;
      const opt = step.options.find(o => String(o.value) === String(value));
      return opt ? opt.label : null;
    }
    function substitute(s){
      if (typeof s !== "string") return s;
      const zl = optionLabelFor("zielland", getAnswer("zielland")) || "";
      const hl = optionLabelFor("herkunftsland", getAnswer("herkunftsland")) || "";
      return s.replace(/\{\{\s*zielland_label\s*\}\}/g, zl)
              .replace(/\{\{\s*herkunftsland_label\s*\}\}/g, hl);
    }

    function resolveNextId(step){
      if (!step) return null;
      if (step.nextMap){
        const v = getAnswer(step.id);
        const k = (typeof v === "boolean") ? String(v) : (v ?? "");
        if (Object.prototype.hasOwnProperty.call(step.nextMap, k)) return step.nextMap[k];
      }
      if ((step.type === "router" || step.kind === "router") && step.next && typeof step.next.expr === "string"){
        try{
          const evalExpr = step.next.expr.replace(/\$([a-zA-Z0-9_]+)/g, (_, k) => JSON.stringify(answers[k] ?? null));
          // eslint-disable-next-line no-eval
          const out = eval(evalExpr);
          if (typeof out === "string") return out;
        }catch(e){}
      }
      if (step.next) return step.next;
      return null;
    }

    function computeVisiblePath(){
      const mapById = new Map(flow.map(s => [s.id, s]));
      const path = [];
      let cur = flow[0];
      const guard = new Set();
      let loops = 0;
      while (cur && !guard.has(cur.id) && loops < 1000){
        path.push(cur);
        guard.add(cur.id);
        const nextId = resolveNextId(cur);
        if (!nextId) break;
        cur = mapById.get(nextId);
        loops++;
      }
      return path;
    }

    function isRequired(step){ return !!step && !!step.required; }
    function hasValue(step){
      const v = getAnswer(step.id);
      if (step.type === "checkbox") return Array.isArray(v) && v.length>0;
      return v !== undefined && v !== null && v !== "";
    }

    function render(){
      try{
        if (!visibleSteps.length){
          elStep.innerHTML = `<div class="notice error">Der Fragenkatalog konnte nicht geladen werden.</div>`;
          elPrev.style.visibility = "hidden";
          elNext.style.display = "none";
          diag("Render: sichtbarer Pfad leer.");
          return;
        }
        const step = visibleSteps[visIndex];
        if (!step){
          visIndex = 0;
          return render();
        }
        diag("Render: " + (step.id || "?"));

        // Buttons
        elPrev.style.visibility = (visIndex>0) ? "visible" : "hidden";
        elNext.style.display = "inline-flex";
        elNext.disabled = false;

        // Inhalt
        elStep.innerHTML = renderStepHTML(step);

        // Required blocken bis Antwort da
        if (isRequired(step) && !hasValue(step)) elNext.disabled = true;

        // Inputs binden
        bindInputs(step);

        // Fortschritt
        const total = visibleSteps.length || 1;
        elProg.textContent = (Math.min(visIndex+1,total)) + " / " + total;
      }catch(e){
        diag("Render-Fehler: " + (e.message||e));
        elStep.innerHTML = `<div class="notice error">Render-Fehler: ${e && e.message ? e.message : e}</div>`;
      }
    }

    function renderStepHTML(step){
      const t = step.type || step.kind || "info";
      const q = substitute(step.question || step.headline || "");
      const hlp = substitute(step.text || "");

      if (t === "info") {
        return `<div class="step step-info">${q?`<h2>${q}</h2>`:""}${hlp?`<p>${hlp}</p>`:""}</div>`;
      }
      if (t === "radio") {
        const opts = (step.options||[]).map((o,i)=>`
          <label class="opt">
            <input type="radio" name="${step.id}" id="${step.id}__${i}" value="${o.value}">
            <span>${substitute(o.label)}</span>
          </label>`).join("");
        return `<div class="step">${q?`<h2>${q}</h2>`:""}<div class="options">${opts}</div>${hlp?`<p class="help">${hlp}</p>`:""}</div>`;
      }
      if (t === "checkbox") {
        const vals = getAnswer(step.id) || [];
        const opts = (step.options||[]).map((o,i)=>{
          const checked = (Array.isArray(vals) && vals.includes(o.value)) ? "checked" : "";
          return `<label class="opt">
              <input type="checkbox" name="${step.id}" id="${step.id}__${i}" value="${o.value}" ${checked}>
              <span>${substitute(o.label)}</span>
            </label>`;
        }).join("");
        return `<div class="step">${q?`<h2>${q}</h2>`:""}<div class="options">${opts}</div>${hlp?`<p class="help">${hlp}</p>`:""}</div>`;
      }
      if (t === "textarea") {
        const val = getAnswer(step.id) || "";
        return `<div class="step">${q?`<h2>${q}</h2>`:""}<textarea id="${step.id}" rows="6" placeholder="Deine Antwort...">${val}</textarea>${hlp?`<p class="help">${hlp}</p>`:""}</div>`;
      }
      if (t === "date") {
        const val = getAnswer(step.id) || "";
        return `<div class="step">${q?`<h2>${q}</h2>`:""}<input type="date" id="${step.id}" value="${val}">${hlp?`<p class="help">${hlp}</p>`:""}</div>`;
      }
      // Unbekannt
      return `<div class="step step-info">${q?`<h2>${q}</h2>`:""}${hlp?`<p>${hlp}</p>`:""}</div>`;
    }

    function bindInputs(step){
      const t = step.type || step.kind || "info";
      if (t === "radio") {
        elStep.querySelectorAll(`input[type="radio"][name="${step.id}"]`).forEach(n=>{
          n.addEventListener("change", ()=>{
            setAnswer(step.id, cast(n.value));
            elNext.disabled = isRequired(step) && !hasValue(step);
          });
        });
      }
      if (t === "checkbox") {
        elStep.querySelectorAll(`input[type="checkbox"][name="${step.id}"]`).forEach(n=>{
          n.addEventListener("change", ()=>{
            const vals = Array.from(elStep.querySelectorAll(`input[type="checkbox"][name="${step.id}"]:checked`)).map(x=>cast(x.value));
            setAnswer(step.id, vals);
            elNext.disabled = isRequired(step) && !hasValue(step);
          });
        });
      }
      if (t === "textarea") {
        const ta = elStep.querySelector(`#${CSS.escape(step.id)}`);
        if (ta) ta.addEventListener("input", ()=>{ setAnswer(step.id, ta.value); elNext.disabled = isRequired(step) && !hasValue(step); });
      }
      if (t === "date") {
        const inp = elStep.querySelector(`#${CSS.escape(step.id)}`);
        if (inp) inp.addEventListener("change", ()=>{ setAnswer(step.id, inp.value); elNext.disabled = isRequired(step) && !hasValue(step); });
      }
    }

    function cast(v){ if (v==="true") return true; if (v==="false") return false; return v; }

    function goNext(){
      const currentId = visibleSteps[visIndex]?.id;
      visibleSteps = computeVisiblePath();
      const curStep = visibleSteps.find(s => s.id === currentId);
      const nextId = curStep ? resolveNextId(curStep) : null;
      if (nextId){
        const idx = visibleSteps.findIndex(s => s.id === nextId);
        visIndex = (idx >= 0 ? idx : Math.min(visIndex + 1, visibleSteps.length - 1));
      } else {
        visIndex = Math.min(visIndex + 1, visibleSteps.length - 1);
      }
      saveLocal();
      render();
    }
    function goPrev(){
      visibleSteps = computeVisiblePath();
      visIndex = Math.max(0, visIndex - 1);
      saveLocal();
      render();
    }

    elNext.addEventListener("click", goNext);
    elPrev.addEventListener("click", goPrev);

    // Load flow
    diag("Lade Flow…");
    let loaded;
    try{
      const res = await fetch(FLOW_URL, {cache:"no-store"});
      const txt = await res.text();
      let json = {};
      try { json = JSON.parse(txt); } catch(e){
        elStep.innerHTML = `<div class="notice error">Flow-Datei ist kein gültiges JSON.<br><small>${e.message}</small></div>`;
        diag("JSON-Fehler: " + e.message);
        return;
      }
      loaded = json;
    }catch(e){
      elStep.innerHTML = `<div class="notice error">Flow konnte nicht geladen werden.<br><small>${e.message||e}</small></div>`;
      diag("Fetch-Fehler: " + (e.message||e));
      return;
    }

    flow = Array.isArray(loaded) ? loaded : (Array.isArray(loaded.flow) ? loaded.flow : []);
    if (!Array.isArray(flow) || !flow.length){
      elStep.innerHTML = `<div class="notice error">Flow ist leer oder hat kein <code>flow[]</code>-Array.</div>`;
      diag("Flow leer / kein flow[]");
      return;
    }

    loadLocal();
    visibleSteps = computeVisiblePath();
    if (!visibleSteps.length) {
      visibleSteps = [flow[0]];
      visIndex = 0;
    } else if (visIndex < 0 || visIndex >= visibleSteps.length){
      visIndex = 0;
    }
    diag("Pfad: " + visibleSteps.length + " Steps – start render");
    render();

  } catch (e) {
    diag("Start-Fehler: " + (e && e.message ? e.message : e));
    try{
      const el = document.getElementById("step");
      if (el) el.innerHTML = `<div class="notice error">Start-Fehler:<br><small>${e && e.message ? e.message : e}</small></div>`;
    }catch(_){}
  }
})();
