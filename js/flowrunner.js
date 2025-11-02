(function(){
  // === Konfiguration ===
  const FLOW_URL   = (window.AMANAYA_FLOW_URL    || "/flows/flow.de.json");
  const STORAGEKEY = (window.AMANAYA_STORAGE_KEY || "amanaya:flow:de") + ":v10";

  // === UI-Elemente ===
  const elStep = document.getElementById("step");
  const elPrev = document.getElementById("prev");
  const elNext = document.getElementById("next");

  // 4 Top-Optionen optisch hervorheben
  const FEATURE_FIRST4 = new Set([
    "zielland",
    "visum_details_A",
    "aufenthaltstitel_details_A",
    "reiseweg_B_aussteller"
  ]);

  // === State ===
  let flow = null;
  const stepsById = new Map();
  let answers = {};         // id -> value
  let labels  = {};         // id_label -> label text für Platzhalter
  let vis     = [];         // sichtbarer Pfad (Array von stepIds) – wird LAZY aufgebaut
  let idx     = 0;          // aktueller Index im sichtbaren Pfad

  // === Persistenz ===
  function saveLocal(){
    localStorage.setItem(STORAGEKEY, JSON.stringify({answers, labels, vis, idx}));
  }
  function loadLocal(){
    try{
      const s = JSON.parse(localStorage.getItem(STORAGEKEY)||"{}");
      answers = s.answers || {};
      labels  = s.labels  || {};
      vis     = Array.isArray(s.vis) ? s.vis : [];
      idx     = Number.isInteger(s.idx) ? s.idx : 0;
    }catch(e){}
  }
  function hardReset(){
    try{ localStorage.removeItem(STORAGEKEY); }catch(e){}
    answers = {}; labels = {}; vis = []; idx = 0;
  }

  // === Hilfen ===
  function substitute(s){
    if (!s) return "";
    return String(s).replace(/\{\{(\w+)\}\}/g, (_,k)=>{
      if (k in labels)   return labels[k];
      if (k in answers)  return String(answers[k]);
      return "";
    });
  }
  function evalExpr(expr){
    try{
      return Function.apply(null, [...Object.keys(answers), "return ("+expr+");"])
                     .apply(null, Object.values(answers));
    }catch(e){ return null; }
  }
  function getQuestionText(step){
    if (!step || step.question == null) return "";
    if (typeof step.question === "string") return substitute(step.question);
    if (typeof step.question === "object" && step.question.expr){
      const v = evalExpr(step.question.expr);
      return substitute(v != null ? String(v) : "");
    }
    return "";
  }
  function labelFor(stepId, value){
    const step = stepsById.get(stepId);
    if (!step || !Array.isArray(step.options)) return null;
    const opt = step.options.find(o => String(o.value) === String(value));
    return opt ? opt.label : null;
  }
  function firstStepId(){
    return (flow && Array.isArray(flow.flow) && flow.flow.length) ? flow.flow[0].id : null;
  }

  // === Nächsten Schritt aus einem einzelnen Step auflösen (LAZY) ===
  function resolveNextFrom(step){
    if (!step) return null;

    // Router: reine Logik
    if (step.type === "router"){
      if (step.next && step.next.expr){
        const nid = evalExpr(step.next.expr);
        return nid || null;
      }
      // Fallback: kein next -> Ende
      return null;
    }

    // Verzweigungen über nextMap (abhängig von Antwort)
    if (step.nextMap){
      const v = answers[step.id];
      if (v === undefined) return null; // solange nicht beantwortet, nicht weiter auflösen
      const key = String(v);
      if (Object.prototype.hasOwnProperty.call(step.nextMap, key)){
        return step.nextMap[key] || null;
      }
      return null;
    }

    // Linearer next
    return step.next || null;
  }

  // === Rendern ===
  function renderInfo(step){
    const h = step.headline ? "<h2>"+step.headline+"</h2>" : "";
    const t = step.text ? "<p>"+substitute(step.text)+"</p>" : "";
    return '<div class="step">'+h+t+'</div>';
  }
  function renderRadio(step){
    const q = getQuestionText(step);
    const isFeaturedList = FEATURE_FIRST4.has(step.id);
    const opts = (step.options||[]).map((o,i)=>{
      const checked = String(answers[step.id]) === String(o.value) ? "checked" : "";
      const cls = "opt" + (isFeaturedList && i < 4 ? " opt--featured" : "");
      return '<label class="'+cls+'"><input type="radio" name="'+step.id+'" value="'+o.value+'" '+checked+' /><span>'+substitute(o.label)+'</span></label>';
    }).join("");
    return '<div class="step">'+(q?'<h2>'+q+'</h2>':'')+'<div class="options">'+opts+'</div></div>';
  }
  function renderCheckbox(step){
    const q = getQuestionText(step);
    const vals = Array.isArray(answers[step.id]) ? answers[step.id] : [];
    const opts = (step.options||[]).map(o=>{
      const checked = vals.indexOf(o.value) >= 0 ? "checked" : "";
      return '<label class="opt"><input type="checkbox" name="'+step.id+'" value="'+o.value+'" '+checked+' /><span>'+substitute(o.label)+'</span></label>';
    }).join("");
    return '<div class="step">'+(q?'<h2>'+q+'</h2>':'')+'<div class="options">'+opts+'</div></div>';
  }
  function renderTextarea(step){
    const q = getQuestionText(step);
    const v = answers[step.id] || "";
    return '<div class="step">'+(q?'<h2>'+q+'</h2>':'')+'<textarea name="'+step.id+'" rows="6" placeholder="Hier schreiben …">'+(v!==undefined?String(v):"")+'</textarea></div>';
  }
  function renderDate(step){
    const q = getQuestionText(step);
    const v = answers[step.id] || "";
    return '<div class="step">'+(q?'<h2>'+q+'</h2>':'')+'<input type="date" name="'+step.id+'" value="'+v+'" /></div>';
  }

  function renderStep(){
    const stepId = vis[idx];
    const step   = stepsById.get(stepId);
    if (!step){ elStep.innerHTML = '<div class="step"><p>Fehler: Schritt nicht gefunden.</p></div>'; return; }

    // Router im sichtbaren Pfad nicht rendern → automatisch weiter
    if (step.type === "router"){ goto(+1, /*fromRouter*/true); return; }

    let html = "";
    switch(step.type){
      case "info":     html = renderInfo(step);     break;
      case "radio":    html = renderRadio(step);    break;
      case "checkbox": html = renderCheckbox(step); break;
      case "textarea": html = renderTextarea(step); break;
      case "date":     html = renderDate(step);     break;
      default:         html = '<div class="step"><p>Unbekannter Fragetyp: '+step.type+'</p></div>';
    }
    elStep.innerHTML = html;

    // Buttons
    const atStart = (idx === 0);
    elPrev.style.visibility = atStart ? "hidden" : "visible";
    elNext.textContent      = atStart ? "Start" : "Weiter";

    if (step.id === "abschluss_hint"){
      elNext.textContent = "Fertig";
      elNext.onclick = function(){ location.href = "/beratung"; };
      return;
    }

    elNext.onclick = function(){ goto(+1, false); };
  }

  // === Lesen/Validieren ===
  function readAndStoreCurrent(){
    const stepId = vis[idx];
    const step   = stepsById.get(stepId);
    if (!step) return true;

    if (step.type === "radio"){
      const sel = elStep.querySelector('input[type="radio"][name="'+step.id+'"]:checked');
      if (sel){
        // Wert
        const val = (sel.value === "true") ? true : (sel.value === "false" ? false : sel.value);
        answers[step.id] = val;

        // Label-Mapping für Platzhalter
        const lab = labelFor(step.id, sel.value);
        if (lab){
          labels[step.id+"_label"] = lab;
          if (step.id === "zielland")       labels["zielland_label"] = lab;
          if (step.id === "herkunftsland")  labels["herkunftsland_label"] = lab;
          if (step.id === "dublin_land" || step.id === "dublinland") labels["dublinland_label"] = lab;
        }
      }else{
        delete answers[step.id];
      }
    }else if (step.type === "checkbox"){
      const sels = Array.prototype.slice.call(elStep.querySelectorAll('input[type="checkbox"][name="'+step.id+'"]:checked')).map(x=>x.value);
      answers[step.id] = sels;
    }else if (step.type === "textarea" || step.type === "date"){
      const el = elStep.querySelector('[name="'+step.id+'"]');
      if (el) answers[step.id] = el.value || "";
    }
    saveLocal();
    return true;
  }
  function validateCurrent(){
    const step = stepsById.get(vis[idx]);
    if (!step || !step.required) return true;
    const v = answers[step.id];
    if (step.type === "checkbox") return Array.isArray(v) && v.length>0;
    return v !== undefined && v !== null && v !== "";
  }

  // === Navigation (LAZY) ===
  function goto(delta, fromRouter){
    if (delta > 0){
      // Vorwärts: Antwort lesen & validieren
      if (!fromRouter){
        readAndStoreCurrent();
        if (!validateCurrent()) return;
      }

      // ggf. Pfad ab hier abschneiden (falls wir in der Mitte ändern)
      if (idx < vis.length - 1){
        vis = vis.slice(0, idx + 1);
      }

      // Nächsten Schritt aus dem aktuellen berechnen
      const cur = stepsById.get(vis[idx]);
      let nextId = resolveNextFrom(cur);

      // Router automatisch „durchfahren“ (kann kaskadieren)
      let safety = 0;
      while (nextId){
        const nextStep = stepsById.get(nextId);
        if (!nextStep) break;
        vis.push(nextId);
        if (nextStep.type !== "router") break; // renderbare Frage erreicht
        // Router sofort weiter auflösen
        nextId = resolveNextFrom(nextStep);
        safety++; if (safety > 50) break;
      }

      // Falls kein next ermittelt wurde: stehen bleiben (Ende)
      if (vis.length === 0){ const start = firstStepId(); if (start) vis = [start]; }
      if (idx < vis.length - 1) idx++;
    }else if (delta < 0){
      // Zurück ohne Neu-Berechnung
      idx = Math.max(0, idx - 1);
    }

    saveLocal();
    renderStep();
  }

  // === Initialisierung ===
  (function init(){
    if (location.search.indexOf("reset=1") >= 0) hardReset();

    loadLocal();
    fetch(FLOW_URL, {cache:"no-store"})
      .then(r=>{ if(!r.ok) throw new Error("Flow nicht ladbar"); return r.json(); })
      .then(j=>{
        flow = j || {};
        stepsById.clear();
        (flow.flow||[]).forEach(s=>stepsById.set(s.id, s));

        if (!vis || !vis.length){
          const start = firstStepId();
          if (!start) throw new Error("Flow ist leer.");
          vis = [start];
          idx = 0;
        }else{
          // Safety: existiert der aktuelle Schritt noch?
          if (!stepsById.get(vis[idx]||"")){ vis = [firstStepId()]; idx = 0; }
        }

        saveLocal();
        renderStep();
      })
      .catch(e=>{
        elStep.innerHTML =
          '<div class="step">'+
            '<h2>Der Fragenkatalog konnte nicht geladen werden.</h2>'+
            '<p style="color:#a00"><strong>Fehler:</strong> '+ (e && e.message ? e.message : String(e)) +'</p>'+
            '<p><a href="?reset=1">Lokale Daten löschen</a> und erneut versuchen.</p>'+
            '<p><a href="'+FLOW_URL+'" target="_blank" rel="noopener">Flow-Datei öffnen</a></p>'+
          '</div>';
      });

    // Buttons
    elPrev.addEventListener("click", function(){ goto(-1, false); });
    elNext.addEventListener("click", function(){ goto(+1, false); });
  })();
})();
