(async function () {
  // =========================
  // Konfiguration
  // =========================
  const FLOW_URL = window.AMANAYA_FLOW_URL || "/flows/flow.de.json?v=robust2";
  const STORAGE_KEY = window.AMANAYA_STORAGE_KEY || "amanaya:flow:de:robust2";

  // =========================
  // DOM-Elemente
  // =========================
  const elStep = document.getElementById("step");
  const elPrev = document.getElementById("prev");
  const elNext = document.getElementById("next");
  const elSave = document.getElementById("save");
  const elProg = document.getElementById("progress");

  // =========================
  // Zustand
  // =========================
  let steps = [];
  let idToIndex = {};
  let visIndex = 0;
  let answers = {};

  function indexSteps() {
    idToIndex = {};
    steps.forEach((s, i) => (idToIndex[s.id] = i));
  }

  function saveLocal() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ visIndex, answers }));
  }
  function loadLocal() {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      if (Number.isInteger(s.visIndex)) visIndex = s.visIndex;
      if (s.answers && typeof s.answers === "object") answers = s.answers;
    } catch (e) {}
  }

  function val(stepId) { return answers[stepId]; }

  // =========================
  // Rendering
  // =========================
  function renderStep() {
    const s = steps[visIndex];
    if (!s) {
      elStep.innerHTML = `<p style="color:red">❌ Kein Schritt gefunden.</p>`;
      return;
    }

    let html = "";

    // Info
    if (s.type === "info") {
      html += `<h2>${s.headline || "Info"}</h2>`;
      if (s.text) html += `<p>${s.text}</p>`;
    }

    // Text / Textarea / Number / Date
    else if (s.type === "text" || s.type === "number" || s.type === "date" || s.type === "textarea") {
      html += `<p>${s.question || ""}</p>`;
      if (s.type === "textarea") {
        html += `<textarea id="answer" rows="5" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:8px"></textarea>`;
      } else {
        const itype = s.type === "text" ? "text" : s.type;
        html += `<input id="answer" type="${itype}" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:8px">`;
      }
    }

    // Radio
    else if (s.type === "radio" && Array.isArray(s.options)) {
      html += `<p>${s.question || ""}</p>`;
      s.options.forEach(opt => {
        const checked = val(s.id) === opt.value ? "checked" : "";
        html += `<label style="display:block;margin:6px 0">
          <input type="radio" name="${s.id}" value="${String(opt.value)}" ${checked}> ${opt.label}
        </label>`;
      });
    }

    // Checkbox
    else if (s.type === "checkbox" && Array.isArray(s.options)) {
      const current = Array.isArray(val(s.id)) ? val(s.id) : [];
      html += `<p>${s.question || ""}</p>`;
      s.options.forEach(opt => {
        const checked = current.includes(opt.value) ? "checked" : "";
        html += `<label style="display:block;margin:6px 0">
          <input type="checkbox" name="${s.id}" value="${String(opt.value)}" ${checked}> ${opt.label}
        </label>`;
      });
    }

    else {
      html += `<p>Unbekannter Schrittentyp.</p>`;
    }

    elStep.innerHTML = html;

    // Vorbelegen für text/textarea/number/date
    const a = val(s.id);
    const input = document.getElementById("answer");
    if (input && (a || a === 0)) input.value = a;

    elProg.textContent = `Schritt ${visIndex + 1} von ${steps.length}`;
    saveLocal();
  }

  // =========================
  // Navigation
  // =========================
  function nextIdFor(s, value) {
    // 1) nextMap
    if (s.nextMap && value != null) {
      const key = String(value);
      if (s.nextMap[key] && idToIndex[s.nextMap[key]] != null) return s.nextMap[key];
    }
    // 2) next (String)
    if (typeof s.next === "string" && idToIndex[s.next] != null) return s.next;
    // 3) Default: nächster Schritt
    if (visIndex + 1 < steps.length) return steps[visIndex + 1].id;
    return null;
  }

  function goToStepId(id) {
    if (id == null) return;
    const idx = idToIndex[id];
    if (idx != null) {
      visIndex = idx;
      renderStep();
    }
  }

  elPrev.onclick = () => {
    if (visIndex > 0) {
      visIndex--;
      renderStep();
    }
  };

  elNext.onclick = () => {
    const s = steps[visIndex];
    if (!s) return;

    // Wert lesen & validieren
    let value = null;

    if (s.type === "radio") {
      const sel = elStep.querySelector(`input[name="${s.id}"]:checked`);
      if (sel) value = parseValue(sel.value);
      if (s.required && sel == null) {
        alert("Bitte eine Option auswählen.");
        return;
      }
    } else if (s.type === "checkbox") {
      const boxes = Array.from(elStep.querySelectorAll(`input[name="${s.id}"]`));
      value = boxes.filter(b => b.checked).map(b => parseValue(b.value));
      if (s.required && value.length === 0) {
        alert("Bitte mindestens eine Option auswählen.");
        return;
      }
    } else if (s.type === "text" || s.type === "textarea" || s.type === "number" || s.type === "date") {
      const inp = document.getElementById("answer");
      value = inp ? inp.value : "";
      if (s.type === "number" && value !== "") value = Number(value);
      if (s.required && (value === "" || value == null)) {
        alert("Dieses Feld ist notwendig.");
        return;
      }
    } else if (s.type === "info") {
      // kein Wert
    }

    answers[s.id] = value;
    saveLocal();

    const nid = nextIdFor(s, value);
    if (nid) {
      goToStepId(nid);
    } else {
      elStep.innerHTML = `<h2>✅ Fertig</h2><p>Flow-Ende erreicht.</p>`;
    }
  };

  elSave.onclick = () => {
    localStorage.removeItem(STORAGE_KEY);
    answers = {};
    visIndex = 0;
    alert("Lokale Antworten gelöscht.");
    renderStep();
  };

  function parseValue(raw) {
    if (raw === "true") return true;
    if (raw === "false") return false;
    return raw;
  }

  // =========================
  // Init
  // =========================
  async function init() {
    elStep.innerHTML = `<p>⏳ Lade Fragen ...</p>`;
    try {
      const res = await fetch(FLOW_URL, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json = await res.json();
      steps = json.flow || [];
      indexSteps();
      loadLocal();
      if (!steps.length) throw new Error("Leerer Flow");
      if (!steps[visIndex]) visIndex = 0;
      renderStep();
    } catch (e) {
      elStep.innerHTML = `<p style="color:red">❌ Der Fragenkatalog konnte nicht geladen werden (${e.message}).</p>`;
    }
  }

  init();
})();
