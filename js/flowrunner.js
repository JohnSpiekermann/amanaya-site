/* Amanaya Flowrunner – v2.2 (Back-Button fix, sichtbarer Pfad, Platzhalter, robustes Laden) */
/* Polyfills (wichtig für ältere Browser/Safari/Embedded) */
(function(){
  if (!window.CSS) window.CSS = {};
  if (typeof window.CSS.escape !== "function") {
    // sehr simple Escape-Variante, reicht für unsere Selektoren
    window.CSS.escape = function (value) {
      return String(value).replace(/[^a-zA-Z0-9_\-]/g, '\\$&');
    };
  }
})();
(async function () {
  // ---- Konfiguration --------------------------------------------------------
  const FLOW_URL     = (window.AMANAYA_FLOW_URL || "/flows/flow.de.json") + "?v=runner22";
  const STORAGE_KEY  = (window.AMANAYA_STORAGE_KEY || "amanaya:flow:de") + ":v2.2";

  // Erwartete DOM-Elemente
  const elStep = document.getElementById("step");
  const elPrev = document.getElementById("prev");
  const elNext = document.getElementById("next");
  const elSave = document.getElementById("save");
  const elProg = document.getElementById("progress");
  if (!elStep || !elPrev || !elNext || !elProg) {
    console.error("[Flowrunner] Benötigte DOM-Elemente fehlen (#step, #prev, #next, #progress).");
    return;
  }

  // ---- Laufzeitzustand ------------------------------------------------------
  let flow = [];                    // Array von Steps (Objekte)
  let byId = new Map();             // id -> Step
  let visibleSteps = [];            // der aktuell *sichtbare* Pfad (nur erreichbare Steps)
  let visIndex = 0;                 // Cursor im sichtbaren Pfad
  let answers = {};                 // id -> value (value: string|boolean|array|null)

  // ---- LocalStorage Helpers -------------------------------------------------
  function saveLocal(){
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ visIndex, answers }));
    } catch(e) { /* ignore */ }
  }
  function loadLocal(){
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      if (Number.isInteger(s.visIndex)) visIndex = s.visIndex;
      if (s.answers && typeof s.answers === "object") answers = s.answers;
    } catch(e) { /* ignore */ }
  }
  function clearLocal(){
    try { localStorage.removeItem(STORAGE_KEY); } catch(e) {}
  }

  // ---- Utilities ------------------------------------------------------------
  function getAnswer(id){ return answers[id]; }

  function setAnswer(id, val){
    answers[id] = val;
    saveLocal();
  }

  function optionLabelFor(stepId, value){
    const step = byId.get(stepId);
    if (!step || !Array.isArray(step.options)) return null;
    const opt = step.options.find(o => String(o.value) === String(value));
    return opt ? opt.label : null;
  }

  function substitutePlaceholders(str){
    if (typeof str !== "string") return str;
    // Unterstützte Platzhalter: {{zielland_label}} / {{herkunftsland_label}}
    const ziellandVal = getAnswer("zielland");
    const herkunftVal = getAnswer("herkunftsland");
    const ziellandLabel = optionLabelFor("zielland", ziellandVal) || "";
    const herkunftLabel = optionLabelFor("herkunftsland", herkunftVal) || "";
    return str
      .replace(/\{\{\s*zielland_label\s*\}\}/g, ziellandLabel)
      .replace(/\{\{\s*herkunftsland_label\s*\}\}/g, herkunftLabel);
  }

  // ---- Next-Auflösung -------------------------------------------------------
  function resolveNextId(step){
    // 1) nextMap basierend auf aktueller Antwort dieses Steps
    if (step.nextMap){
      const val = getAnswer(step.id);
      const key = (typeof val === "boolean") ? String(val) : (val ?? "");
      if (Object.prototype.hasOwnProperty.call(step.nextMap, key)) {
        return step.nextMap[key];
      }
    }
    // 2) router mit next.expr  (einfacher, sicherer Auswerter)
    if ((step.type === "router" || step.kind === "router") && step.next && typeof step.next.expr === "string"){
      try {
        const expr = step.next.expr;
        // Ersetze $variablen durch JSON-Literale ihrer Antworten
        const evalExpr = expr.replace(/\$([a-zA-Z0-9_]+)/g, (_, k) => JSON.stringify(answers[k] ?? null));
        // eslint-disable-next-line no-eval
        const out = eval(evalExpr);
        if (typeof out === "string") return out;
      } catch(e) { /* ignore */ }
    }
    // 3) plain next
    if (step.next) return step.next;
    return null;
  }

  // ---- Sichtbaren Pfad neu berechnen ---------------------------------------
  function computeVisiblePath(flowArr){
    const localById = new Map(flowArr.map(s => [s.id, s]));
    const path = [];
    let cur = flowArr[0];
    const guard = new Set();
    while (cur && !guard.has(cur.id)){
      path.push(cur);
      guard.add(cur.id);
      const nextId = resolveNextId(cur);
      if (!nextId) break;
      cur = localById.get(nextId);
    }
    return path;
  }

  // ---- Rendering ------------------------------------------------------------
  function renderProgress(){
    const total = visibleSteps.length || 1;
    const cur = Math.min(visIndex + 1, total);
    elProg.textContent = `${cur} / ${total}`;
  }

  function render(){
    // Guard
    if (!visibleSteps.length) {
      elStep.innerHTML = `<div class="notice error">
        Der Fragenkatalog konnte nicht geladen werden.
        <div style="margin-top:.5rem"><button id="reloadFlow">Nochmal versuchen</button></div>
      </div>`;
      const btn = document.getElementById("reloadFlow");
      if (btn) btn.addEventListener("click", () => location.reload());
      elPrev.disabled = true;
      elNext.disabled = true;
      return;
    }

    const step = visibleSteps[visIndex];
    const type = step.type || step.kind || "info";

    // Kopf / Buttons
    elPrev.style.visibility = (visIndex > 0) ? "visible" : "hidden";
    elNext.style.display = (resolveNextId(step) || visIndex < visibleSteps.length - 1) ? "inline-flex" : "none";
    elNext.disabled = false; // wir prüfen Anwortpflicht unten
    if (elSave) elSave.style.display = "none";

    // Inhalt
    elStep.innerHTML = renderStepHTML(step);

    // Required-Blocking
    if (isRequired(step) && !hasValue(step)) {
      elNext.disabled = true;
    }

    // Events für Eingaben
    bindInputHandlers(step);

    renderProgress();
  }

  function isRequired(step){
    return !!step.required;
  }

  function hasValue(step){
    const v = getAnswer(step.id);
    if (step.type === "checkbox") return Array.isArray(v) && v.length > 0;
    return v !== undefined && v !== null && v !== "";
  }

  function renderStepHTML(step){
    const t = step.type || step.kind || "info";
    const q = substitutePlaceholders(step.question || step.headline || "");
    const helper = substitutePlaceholders(step.text || "");

    if (t === "info") {
      return `
        <div class="step step-info">
          ${q ? `<h2>${q}</h2>` : ""}
          ${helper ? `<p>${helper}</p>` : ""}
        </div>
      `;
    }

    if (t === "radio") {
      const val = getAnswer(step.id);
      const opts = (step.options || []).map((o, idx) => {
        const id = `${step.id}__${idx}`;
        return `
          <label class="opt">
            <input type="radio" name="${step.id}" id="${id}" value="${o.value}">
            <span>${substitutePlaceholders(o.label)}</span>
          </label>
        `;
      }).join("");
      return `
        <div class="step">
          ${q ? `<h2>${q}</h2>` : ""}
          <div class="options">${opts}</div>
          ${helper ? `<p class="help">${helper}</p>` : ""}
        </div>
      `;
    }

    if (t === "checkbox") {
      const vals = getAnswer(step.id) || [];
      const opts = (step.options || []).map((o, idx) => {
        const id = `${step.id}__${idx}`;
        const checked = Array.isArray(vals) && vals.includes(o.value) ? "checked" : "";
        return `
          <label class="opt">
            <input type="checkbox" name="${step.id}" id="${id}" value="${o.value}" ${checked}>
            <span>${substitutePlaceholders(o.label)}</span>
          </label>
        `;
      }).join("");
      return `
        <div class="step">
          ${q ? `<h2>${q}</h2>` : ""}
          <div class="options">${opts}</div>
          ${helper ? `<p class="help">${helper}</p>` : ""}
        </div>
      `;
    }

    if (t === "textarea") {
      const val = getAnswer(step.id) || "";
      return `
        <div class="step">
          ${q ? `<h2>${q}</h2>` : ""}
          <textarea id="${step.id}" rows="6" placeholder="Deine Antwort...">${val}</textarea>
          ${helper ? `<p class="help">${helper}</p>` : ""}
        </div>
      `;
    }

    if (t === "date") {
      const val = getAnswer(step.id) || "";
      return `
        <div class="step">
          ${q ? `<h2>${q}</h2>` : ""}
          <input type="date" id="${step.id}" value="${val}">
          ${helper ? `<p class="help">${helper}</p>` : ""}
        </div>
      `;
    }

    // Router / Unbekannt → nur weiter
    return `
      <div class="step step-info">
        ${q ? `<h2>${q}</h2>` : ""}
        ${helper ? `<p>${helper}</p>` : ""}
      </div>
    `;
  }

  function bindInputHandlers(step){
    const t = step.type || step.kind || "info";

    if (t === "radio") {
      const nodes = elStep.querySelectorAll(`input[type="radio"][name="${step.id}"]`);
      nodes.forEach(n => {
        n.addEventListener("change", () => {
          setAnswer(step.id, castValue(n.value));
          elNext.disabled = isRequired(step) && !hasValue(step);
        });
      });
      // Vorbelegen
      const v = getAnswer(step.id);
      if (v !== undefined) {
        const match = elStep.querySelector(`input[type="radio"][name="${step.id}"][value="${CSS.escape(String(v))}"]`);
        if (match) match.checked = true;
      }
    }

    if (t === "checkbox") {
      const nodes = elStep.querySelectorAll(`input[type="checkbox"][name="${step.id}"]`);
      nodes.forEach(n => {
        n.addEventListener("change", () => {
          const vals = Array.from(elStep.querySelectorAll(`input[type="checkbox"][name="${step.id}"]:checked`))
                            .map(x => castValue(x.value));
          setAnswer(step.id, vals);
          elNext.disabled = isRequired(step) && !hasValue(step);
        });
      });
    }

    if (t === "textarea") {
      const ta = elStep.querySelector(`#${CSS.escape(step.id)}`);
      if (ta) {
        ta.addEventListener("input", () => {
          setAnswer(step.id, ta.value);
          elNext.disabled = isRequired(step) && !hasValue(step);
        });
      }
    }

    if (t === "date") {
      const inp = elStep.querySelector(`#${CSS.escape(step.id)}`);
      if (inp) {
        inp.addEventListener("change", () => {
          setAnswer(step.id, inp.value);
          elNext.disabled = isRequired(step) && !hasValue(step);
        });
      }
    }
  }

  function castValue(v){
    if (v === "true") return true;
    if (v === "false") return false;
    return v;
  }

  // ---- Navigation -----------------------------------------------------------
  function goNext(){
    // aktuelle Step-ID merken
    const currentId = visibleSteps[visIndex]?.id;
    // Pfad *neu* berechnen (nachdem Antwort gesetzt wurde)
    visibleSteps = computeVisiblePath(flow);

    // den berechneten nächsten Step suchen
    const curStep = visibleSteps.find(s => s.id === currentId);
    const nextId = curStep ? resolveNextId(curStep) : null;

    if (nextId) {
      const idx = visibleSteps.findIndex(s => s.id === nextId);
      visIndex = (idx >= 0 ? idx : Math.min(visIndex + 1, visibleSteps.length - 1));
    } else {
      visIndex = Math.min(visIndex + 1, visibleSteps.length - 1);
    }
    saveLocal();
    render();
  }

  function goPrev(){
    // Vor Zurück ebenfalls Pfad neu berechnen (unterdrückt „geskippten“ Schritt)
    visibleSteps = computeVisiblePath(flow);
    visIndex = Math.max(0, visIndex - 1);
    saveLocal();
    render();
  }

  elNext.addEventListener("click", goNext);
  elPrev.addEventListener("click", goPrev);
  if (elSave) elSave.addEventListener("click", saveLocal);

  // ---- Flow laden -----------------------------------------------------------
  async function loadFlow(){
    // Robust: 2 Versuche (ohne & mit Cache-Buster)
    try {
      const res = await fetch(FLOW_URL, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } catch(e) {
      const bust = FLOW_URL.includes("?") ? `${FLOW_URL}&_=${Date.now()}` : `${FLOW_URL}?_=${Date.now()}`;
      const res2 = await fetch(bust, { cache: "no-store" });
      if (!res2.ok) throw new Error("HTTP " + res2.status);
      return await res2.json();
    }
  }

  function afterFlowLoaded(){
    byId = new Map(flow.map(s => [s.id, s]));
    // Sichtbaren Pfad berechnen
    visibleSteps = computeVisiblePath(flow);
    if (!visibleSteps.length){
      // Harte Fallback-Message
      elStep.innerHTML = `<div class="notice error">
        Der Fragenkatalog konnte nicht geladen werden.
        <div style="margin-top:.5rem"><button id="reloadFlow">Nochmal versuchen</button></div>
      </div>`;
      const btn = document.getElementById("reloadFlow");
      if (btn) btn.addEventListener("click", () => location.reload());
      elPrev.style.visibility = "hidden";
      elNext.style.display = "none";
      return;
    }
    // Index clampen
    if (visIndex < 0 || visIndex >= visibleSteps.length) visIndex = 0;
    render();
  }

  // ---- Start ---------------------------------------------------------------
try {
  loadLocal();
  const loaded = await loadFlow();
  // ✅ hier robust zuweisen (Array direkt ODER Objekt mit .flow)
  flow = Array.isArray(loaded) ? loaded
       : (Array.isArray(loaded.flow) ? loaded.flow : []);

  afterFlowLoaded();
} catch (e) {
  console.error("[Flowrunner] Fehler beim Laden des Flows:", e);
  clearLocal();
  elStep.innerHTML = `<div class="notice error">
    Der Fragenkatalog konnte nicht geladen werden.
    <div style="margin-top:.5rem"><button id="reloadFlow">Nochmal versuchen</button></div>
    <div style="margin-top:.25rem"><small>(Fehlerdetails in der Konsole)</small></div>
  </div>`;
  const btn = document.getElementById("reloadFlow");
  if (btn) btn.addEventListener("click", () => location.reload());
  elPrev.style.visibility = "hidden";
  elNext.style.display = "none";
}

