(function(){
  const FLOW_URL   = (window.AMANAYA_FLOW_URL   || "/flows/flow.de.json");
  const STORAGEKEY = (window.AMANAYA_STORAGE_KEY|| "amanaya:flow:de") + ":v6";
  const elStep = document.getElementById("step");
  const elPrev = document.getElementById("prev");
  const elNext = document.getElementById("next");

  const FEATURE_FIRST4 = new Set(["zielland","visum_details_A","aufenthaltstitel_details_A","reiseweg_B_aussteller"]);

  let flow, stepsById = new Map();
  let answers = {};
  let labels  = {};
  let vis = [];
  let idx = 0;

  function saveLocal(){ localStorage.setItem(STORAGEKEY, JSON.stringify({answers, labels, idx})); }
  function loadLocal(){
    try{
      const s = JSON.parse(localStorage.getItem(STORAGEKEY)||"{}");
      answers = s.answers || {}; labels = s.labels || {}; if (Number.isInteger(s.idx)) idx = s.idx;
    }catch(e){}
  }

  function substitute(s){
    if (!s) return "";
    return String(s).replace(/\{\{(\w+)\}\}/g, (_,k)=> (k in labels)?labels[k] : (k in answers? String(answers[k]) : ""));
  }

  function evalExpr(expr){
    try{
      return Function.apply(null, [...Object.keys(answers), "return ("+expr+");"]).apply(null, Object.values(answers));
    }catch(e){ return null; }
  }

  function labelFor(stepId, value){
    const step = stepsById.get(stepId); if (!step || !Array.isArray(step.options)) return null;
    const opt = step.options.find(o => String(o.value)===String(value));
    return opt ? opt.label : null;
  }

  function indexSteps(flowObj){
    stepsById.clear();
    (flowObj.flow||[]).forEach(s=>stepsById.set(s.id,s));
  }

  function computeVisible(){
    const out = [];
    let cur = (flow.flow && flow.flow[0]) ? flow.flow[0].id : null;
    const guard = new Set();
    while(cur && !guard.has(cur)){
      guard.add(cur);
      const s = stepsById.get(cur);
      if (!s) break;
      out.push(cur);
      let next = null;
      if (s.type === "router" && s.next && s.next.expr){
        next = evalExpr(s.next.expr);
      }else if (s.nextMap && answers[s.id] !== undefined){
        const key = String(answers[s.id]);
        next = Object.prototype.hasOwnProperty.call(s.nextMap,key) ? s.nextMap[key] : null;
      }else{
        next = s.next || null;
      }
      cur = next || null;
    }
    return out;
  }

  function isAnswered(step){
    if (!step.required) return true;
    const v = answers[step.id];
    if (step.type === "checkbox") return Array.isArray(v) && v.length>0;
    return v !== undefined && v !== null && v !== "";
  }

  function renderInfo(step){
    const h = step.headline ? "<h2>"+step.headline+"</h2>" : "";
    const t = step.text ? "<p>"+substitute(step.text)+"</p>" : "";
    return '<div class="step">'+h+t+'</div>';
  }

  function renderRadio(step){
    const isFeaturedList = FEATURE_FIRST4.has(step.id);
    const opts = (step.options||[]).map((o,i)=>{
      const checked = String(answers[step.id]) === String(o.value) ? "checked" : "";
      const cls = "opt" + (isFeaturedList && i < 4 ? " opt--featured" : "");
      return '<label class="'+cls+'"><input type="radio" name="'+step.id+'" value="'+o.value+'" '+checked+' /><span>'+substitute(o.label)+'</span></label>';
    }).join("");
    return '<div class="step">'+(step.question?'<h2>'+substitute(step.question)+'</h2>':'')+'<div class="options">'+opts+'</div></div>';
  }

  function renderCheckbox(step){
    const vals = Array.isArray(answers[step.id]) ? answers[step.id] : [];
    const opts = (step.options||[]).map(o=>{
      const checked = vals.indexOf(o.value) >= 0 ? "checked" : "";
      return '<label class="opt"><input type="checkbox" name="'+step.id+'" value="'+o.value+'" '+checked+' /><span>'+substitute(o.label)+'</span></label>';
    }).join("");
    return '<div class="step">'+(step.question?'<h2>'+substitute(step.question)+'</h2>':'')+'<div class="options">'+opts+'</div></div>';
  }

  function renderTextarea(step){
    const v = answers[step.id] || "";
    return '<div class="step">'+(step.question?'<h2>'+substitute(step.question)+'</h2>':'')+'<textarea name="'+step.id+'" rows="6" placeholder="Hier schreiben …">'+(v!==undefined?String(v):"")+'</textarea></div>';
  }

  function renderDate(step){
    const v = answers[step.id] || "";
    return '<div class="step">'+(step.question?'<h2>'+substitute(step.question)+'</h2>':'')+'<input type="date" name="'+step.id+'" value="'+v+'" /></div>';
  }

  function renderStep(){
    const stepId = vis[idx];
    const step = stepsById.get(stepId);
    if (!step){ elStep.innerHTML = '<p>Fehler: Schritt nicht gefunden.</p>'; return; }

    // Router nicht anzeigen – aber NICHT idx verändern. Der Sprung passiert zentral in goto().
    if (step.type === "router"){ goto(skipDir); return; }

    let html = "";
    switch(step.type){
      case "info": html = renderInfo(step); break;
      case "radio": html = renderRadio(step); break;
      case "checkbox": html = renderCheckbox(step); break;
      case "textarea": html = renderTextarea(step); break;
      case "date": html = renderDate(step); break;
      default: html = '<div class="step"><p>Unbekannter Fragetyp: '+step.type+'</p></div>';
    }
    elStep.innerHTML = html;

    // Buttons
    elPrev.style.visibility = (idx===0) ? "hidden" : "visible";

    // Standard-Beschriftung: Start nur auf erstem sichtbaren Step, sonst Weiter
    elNext.textContent = (idx===0 ? "Start" : "Weiter");

    // Nur auf der echten Abschlussseite abweichendes Verhalten:
    if (step.id === "abschluss_hint"){
      elNext.textContent = "Fertig";
      elNext.onclick = function(){ location.href = "/beratung"; };
      return;
    }

    // Standard-Weiter-Click
    elNext.onclick = function(){ goto(+1); };
  }

  // Richtung merken, damit Router in renderStep() korrekt übersprungen werden kann
  let skipDir = +1;

  function readAndStoreCurrent(){
    const stepId = vis[idx];
    const step = stepsById.get(stepId);
    if (!step) return true;

    if (step.type === "radio"){
      const sel = elStep.querySelector('input[type="radio"][name="'+step.id+'"]:checked');
      if (sel){
        answers[step.id] = (sel.value === "true") ? true : (sel.value === "false" ? false : sel.value);
        const lab = labelFor(step.id, sel.value);
        if (lab){
          labels[step.id+"_label"] = lab;
          if (step.id === "zielland"){ labels["zielland_label"] = lab; }
          if (step.id === "herkunftsland"){ labels["herkunftsland_label"] = lab; }
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

  // Helfer: um Router-Schritte in gewünschter Richtung zu überspringen
  function skipRouters(direction){
    let safety = 0;
    while (vis[idx] && stepsById.get(vis[idx]) && stepsById.get(vis[idx]).type === "router" && safety < 50){
      idx += direction;
      if (idx < 0) idx = 0;
      if (idx > vis.length-1) idx = vis.length-1;
      safety++;
    }
  }

  function goto(delta){
    // Vor dem Wechsel: aktuelle Antwort sichern & ggf. validieren
    if (delta > 0){
      readAndStoreCurrent();
      if (!validateCurrent()) return;
    }

    // Sichtbaren Pfad neu berechnen (weil Antworten sich geändert haben)
    vis = computeVisible();

    // Zielindex bestimmen
    let ni = idx + delta;
    if (ni < 0) ni = 0;
    if (ni > vis.length-1) ni = vis.length-1;
    idx = ni;

    // Router in Bewegungsrichtung überspringen
    skipDir = (delta >= 0 ? +1 : -1);
    skipRouters(skipDir);

    saveLocal();
    renderStep();
  }

  elPrev.addEventListener("click", function(){ goto(-1); });
  elNext.addEventListener("click", function(){ goto(+1); });

  // Optional: Reset via ?reset=1
  if (location.search.indexOf("reset=1") >= 0) { try{ localStorage.clear(); }catch(e){} }

  loadLocal();
  fetch(FLOW_URL, {cache:"no-store"})
    .then(r=>{ if(!r.ok) throw new Error("Flow nicht ladbar"); return r.json(); })
    .then(j=>{
      flow = j;
      if (!flow || !Array.isArray(flow.flow)) throw new Error("Ungültiges Flow-Format");
      indexSteps(flow);
      vis = computeVisible();
      if (idx < 0 || idx >= vis.length) idx = 0;
      // Beim ersten Render nicht auf Routern hängen bleiben
      skipDir = +1; skipRouters(skipDir);
      renderStep();
    })
    .catch(e=>{
      const msg = (e && e.message) ? e.message : String(e);
      elStep.innerHTML = '<div class="step"><h2>Der Fragenkatalog konnte nicht geladen werden.</h2><p style="color:#a00"><strong>Fehler:</strong> '+msg+'</p><p><a href="?reset=1">Lokale Daten löschen</a> und erneut versuchen.</p><p><a href="'+FLOW_URL+'" target="_blank" rel="noopener">Flow-Datei öffnen</a></p></div>';
    });
})();
