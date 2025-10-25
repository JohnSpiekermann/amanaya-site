(async function () {
  // -----------------------------
  // 1️⃣ Basis-Konfiguration
  // -----------------------------
  const FLOW_URL = "/flows/flow.test.json?v=t1"; // <- fester Testpfad
  const STORAGE_KEY = "amanaya:flow:test:t1";

  // -----------------------------
  // 2️⃣ Elemente im HTML suchen
  // -----------------------------
  const elStep = document.getElementById("step");
  const elPrev = document.getElementById("prev");
  const elNext = document.getElementById("next");
  const elSave = document.getElementById("save");
  const elProg = document.getElementById("progress");

  // -----------------------------
  // 3️⃣ Variablen für Flow-Steuerung
  // -----------------------------
  let flow = [];
  let visIndex = 0;
  let answers = {};

  // -----------------------------
  // 4️⃣ Lokalen Speicher laden/sichern
  // -----------------------------
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

  // -----------------------------
  // 5️⃣ Step rendern
  // -----------------------------
  function renderStep() {
    const step = flow[visIndex];
    if (!step) {
      elStep.innerHTML = `<p style="color:red">❌ Fehler: Kein Schritt gefunden.</p>`;
      return;
    }

    let html = "";
    if (step.type === "info") {
      html += `<h2>${step.headline || "Info"}</h2><p>${step.text || ""}</p>`;
    } else if (step.type === "radio" && step.options) {
      html += `<p>${step.question}</p>`;
      step.options.forEach((opt) => {
        const checked = answers[step.id] === opt.value ? "checked" : "";
        html += `<label style="display:block;margin-bottom:4px">
                   <input type="radio" name="${step.id}" value="${opt.value}" ${checked}> ${opt.label}
                 </label>`;
      });
    } else {
      html += `<p>${step.question || "(Keine Frage)"}</p>
               <input id="answer" style="width:100%;padding:6px;border:1px solid #ccc;border-radius:6px">`;
      if (answers[step.id]) document.getElementById("answer").value = answers[step.id];
    }

    elStep.innerHTML = html;
    elProg.textContent = `Schritt ${visIndex + 1} von ${flow.length}`;
    saveLocal();
  }

  // -----------------------------
  // 6️⃣ Navigation
  // -----------------------------
  elPrev.onclick = () => {
    if (visIndex > 0) {
      visIndex--;
      renderStep();
    }
  };

  elNext.onclick = () => {
    const step = flow[visIndex];
    if (!step) return;
    let val = null;

    if (step.type === "radio") {
      const input = elStep.querySelector("input[type=radio]:checked");
      if (input) val = input.value;
    } else {
      const input = elStep.querySelector("#answer");
      if (input) val = input.value;
    }

    answers[step.id] = val;
    saveLocal();

    if (visIndex < flow.length - 1) {
      visIndex++;
      renderStep();
    } else {
      elStep.innerHTML = `<h2>✅ Fertig</h2><p>Flow-Ende erreicht.</p>`;
    }
  };

  elSave.onclick = () => {
    localStorage.removeItem(STORAGE_KEY);
    alert("Lokaler Speicher gelöscht.");
  };

  // -----------------------------
  // 7️⃣ Flow laden
  // -----------------------------
  async function init() {
    elStep.innerHTML = `<p>⏳ Lade Fragen ...</p>`;
    try {
      const res = await fetch(FLOW_URL, { cache: "no-store" });
      if (!res.ok) throw new Error("Fehler beim Laden");
      const json = await res.json();
      flow = json.flow || [];
      visIndex = 0;
      answers = {};
      renderStep();
    } catch (e) {
      elStep.innerHTML = `<p style="color:red">❌ Der Fragenkatalog konnte nicht geladen werden (${e.message}).</p>`;
    }
  }

  // -----------------------------
  // 8️⃣ Start
  // -----------------------------
  init();
})();
