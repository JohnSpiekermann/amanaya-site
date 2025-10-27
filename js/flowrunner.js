(async function () {
  const FLOW_URL = window.AMANAYA_FLOW_URL || "/flows/flow.de.json?v=tmpl1";
  const STORAGE_KEY = window.AMANAYA_STORAGE_KEY || "amanaya:flow:de:tmpl1";

  const elStep = document.getElementById("step");
  const elPrev = document.getElementById("prev");
  const elNext = document.getElementById("next");
  const elSave = document.getElementById("save");
  const elProg = document.getElementById("progress");

  let steps = [];
  let idToIndex = {};
  let visIndex = 0;
  let answers = {};
  let labels = {};           // NEU: gemerkte Labels (für {{..._label}})
  let checkLabels = {};      // NEU: für Checkbox -> Liste der Labels

  function indexSteps(){ idToIndex = {}; steps.forEach((s,i)=>idToIndex[s.id]=i); }
  function saveLocal(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ visIndex, answers, labels, checkLabels }));
  }
  function loadLocal(){
    try{
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      if (Number.isInteger(s.visIndex)) visIndex = s.visIndex;
      if (s.answers && typeof s.answers === "object") answers = s.answers;
      if (s.labels && typeof s.labels === "object") labels = s.labels;
      if (s.checkLabels && typeof s.checkLabels === "object") checkLabels = s.checkLabels;
    }catch(e){}
  }
  function val(id){ return answers[id]; }
  function labelOf(id){ return labels[id]; }
  function labelsOfCheckbox(id){ return checkLabels[id] || []; }

  // ---- Mini-Templating: {{key}} wird aus ctx ersetzt ----
  function interpolate(str, ctx){
    if(!str) return "";
    return String(str).replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => {
      return (k in ctx && ctx[k] != null) ? String(ctx[k]) : "";
    });
  }
  // Context aus Antworten + Labels + abgeleiteten Werten
  function buildCtx(){
    const ctx = { ...answers };
    // für Radio: {{zielland_label}}
    Object.keys(labels).forEach(k => { ctx[`${k}_label`] = labels[k]; });
    // für Checkbox: {{fluchtgruende_labels}} (kommasepariert)
    Object.keys(checkLabels).forEach(k => { ctx[`${k}_labels`] = (checkLabels[k]||[]).join(", "); });
    return ctx;
  }

  function renderStep(){
    const s = steps[visIndex];
    if(!s){ elStep.innerHTML = `<p style="color:red">❌ Kein Schritt gefunden.</p>`; return; }

    const ctx = buildCtx();
    const q = interpolate(s.question, ctx);
    const headline = interpolate(s.headline, ctx);
    const text = interpolate(s.text, ctx);

    let html = "";

    if (s.type === "info"){
      if (headline) html += `<h2>${headline}</h2>`;
      if (text) html += `<p>${text}</p>`;
    }
    else if (s.type === "text" || s.type === "number" || s.type === "date" || s.type === "textarea"){
      html += `<p>${q || ""}</p>`;
      if (s.type === "textarea"){
        html += `<textarea id="answer" rows="5" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:8px"></textarea>`;
      }else{
        const itype = (s.type === "text") ? "text" : s.type;
        html += `<input id="answer" type="${itype}" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:8px">`;
      }
    }
    else if (s.type === "radio" && Array.isArray(s.options)){
      html += `<p>${q || ""}</p>`;
      const current = val(s.id);
      s.options.forEach(opt => {
        const v = String(opt.value);
        const checked = (current != null && String(current) === v) ? "checked" : "";
        html += `<label style="display:block;margin:6px 0">
          <input type="radio" name="${s.id}" value="${v}" ${checked} data-label="${interpolate(opt.label, ctx)}"> ${interpolate(opt.label, ctx)}
        </label>`;
      });
    }
    else if (s.type === "checkbox" && Array.isArray(s.options)){
      html += `<p>${q || ""}</p>`;
      const current = Array.isArray(val(s.id)) ? val(s.id) : [];
      s.options.forEach(opt => {
        const v = String(opt.value);
        const checked = current.map(String).includes(v) ? "checked" : "";
        html += `<label style="display:block;margin:6px 0">
          <input type="checkbox" name="${s.id}" value="${v}" ${checked} data-label="${interpolate(opt.label, ctx)}"> ${interpolate(opt.label, ctx)}
        </label>`;
      });
    }else{
      html += `<p>Unbekannter Schrittentyp.</p>`;
    }

    elStep.innerHTML = html;

    const a = val(s.id);
    const input = document.getElementById("answer");
    if (input && (a || a === 0)) input.value = a;

    elProg.textContent = `Schritt ${visIndex + 1} von ${steps.length}`;
    saveLocal();
  }

  function nextIdFor(s, value){
    if (s.nextMap && value != null){
      const key = String(value);
      if (s.nextMap[key] && idToIndex[s.nextMap[key]] != null) return s.nextMap[key];
    }
    if (typeof s.next === "string" && idToIndex[s.next] != null) return s.next;
    if (visIndex + 1 < steps.length) return steps[visIndex + 1].id;
    return null;
  }

  function goToStepId(id){
    if (id == null) return;
    const idx = idToIndex[id];
    if (idx != null){ visIndex = idx; renderStep(); }
  }

  elPrev.onclick = () => { if (visIndex > 0){ visIndex--; renderStep(); } };

  elNext.onclick = () => {
    const s = steps[visIndex];
    if(!s) return;

    let value = null;

    if (s.type === "radio"){
      const sel = elStep.querySelector(`input[name="${s.id}"]:checked`);
      if (!sel && s.required){ alert("Bitte eine Option auswählen."); return; }
      if (sel){
        value = parseValue(sel.value);
        // Label merken (für {{id_label}})
        labels[s.id] = sel.getAttribute("data-label") || "";
      }
    }
    else if (s.type === "checkbox"){
      const boxes = Array.from(elStep.querySelectorAll(`input[name="${s.id}"]`));
      const vals = boxes.filter(b=>b.checked).map(b=>parseValue(b.value));
      if (s.required && vals.length === 0){ alert("Bitte mindestens eine Option auswählen."); return; }
      value = vals;
      // Liste der Labels (für {{id_labels}})
      checkLabels[s.id] = boxes.filter(b=>b.checked).map(b=> b.getAttribute("data-label") || "");
    }
    else if (s.type === "text" || s.type === "textarea" || s.type === "number" || s.type === "date"){
      const inp = document.getElementById("answer");
      value = inp ? inp.value : "";
      if (s.type === "number" && value !== "") value = Number(value);
      if (s.required && (value === "" || value == null)){ alert("Dieses Feld ist notwendig."); return; }
    }else if (s.type === "info"){
      // kein Wert
    }

    answers[s.id] = value;
    saveLocal();

    const nid = nextIdFor(s, value);
    if (nid){ goToStepId(nid); }
    else { elStep.innerHTML = `<h2>✅ Fertig</h2><p>Flow-Ende erreicht.</p>`; }
  };

  elSave.onclick = () => {
    localStorage.removeItem(STORAGE_KEY);
    answers = {}; labels = {}; checkLabels = {};
    visIndex = 0;
    alert("Lokale Antworten gelöscht.");
    renderStep();
  };

  function parseValue(raw){
    if (raw === "true") return true;
    if (raw === "false") return false;
    return raw;
  }

  async function init(){
    elStep.innerHTML = `<p>⏳ Lade Fragen ...</p>`;
    try{
      const res = await fetch(FLOW_URL, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json = await res.json();
      steps = json.flow || [];
      indexSteps();
      loadLocal();
      if (!steps.length) throw new Error("Leerer Flow");
      if (!steps[visIndex]) visIndex = 0;
      renderStep();
    }catch(e){
      elStep.innerHTML = `<p style="color:red">❌ Der Fragenkatalog konnte nicht geladen werden (${e.message}).</p>`;
    }
  }

  init();
})();
