(function () {
  function $(id) {
    return document.getElementById(id);
  }

  function showError(msg) {
    const el = $("error");
    if (el) el.textContent = msg || "";
  }

  function clearAll() {
    $("input-json").value = "";
    $("output-json").value = "";
    showError("");
  }

  /**
   * Hilfsfunktion: minderjährig aus alter_bucket ableiten.
   * Passe die Werte hier später an, wenn deine Buckets anders heißen.
   */
  function isMinorFromBucket(bucket) {
    if (!bucket) return null;
    // Beispiele: "0_17", "U18" etc. – hier kannst du später verfeinern
    return bucket === "0_17" || bucket.toLowerCase().includes("u18");
  }

  /**
   * Kernfunktion: wandelt dein flow_answers_json in ein case_input um.
   * inputPayload ist das geparste Objekt aus dem Textfeld:
   * { meta: {...}, raw_answers: {...} }
   */
  function buildCaseInput(inputPayload) {
    if (!inputPayload || typeof inputPayload !== "object") {
      throw new Error("Eingabe ist kein Objekt. Erwartet wird ein JSON mit meta und raw_answers.");
    }

    const meta = inputPayload.meta || {};
    const a = inputPayload.raw_answers || {};

    const minderjaehrig = isMinorFromBucket(a.alter_bucket);

    const caseInput = {
      meta: {
        version: meta.version || "1.1",
        source: meta.source || "amanaya-beratung.html",
        timestamp: meta.timestamp || new Date().toISOString()
      },
      person: {
        geschlecht: a.geschlecht || null,
        alter_bucket: a.alter_bucket || null,
        minderjaehrig: minderjaehrig
      },
      countries: {
        herkunft: a.herkunftsland || null,
        zielland: a.zielland || null,
        dublinland: null,          // später: aus weiteren Antworten ermitteln
        im_zielland_status: a.im_zielland || null
      },
      procedure: {
        reiseweg: a.reiseweg || null,
        visum: a.reiseweg_A || null,  // Platzhalter – später präzisieren
        biometrie_anderswo: !!a.biometrie_anderswo,
        fingerabdruecke_anderswo: !!a.fingerabdruecke_anderswo,
        asylantrag_anderswo: !!a.asylantrag_anderswo,
        asyl_anderswo: !!a.asyl_anderswo,
        asylantrag_gestellt: !!a.asylantrag_gestellt,
        verfahrensstand_A1: !!a.verfahrensstand_A1
      },
      fluchtgruende: {
        kategorien: Array.isArray(a.fluchtgruende) ? a.fluchtgruende : (a.fluchtgruende ? [a.fluchtgruende] : []),
        details_freitext: a.flucht_details_freitext || null,
        ereignis_beschreibung: a.flucht_ereignis_beschr || null,
        quelle_verfolgung: a.quelle_verfolgung || null
      },
      belege: {
        uyap: a.uyap || null,      // bei Türkei relevant – hier vorerst generisch
        papiere: [],
        beweise: []
      },
      flags: {
        wirtschaftlich: !!a.flag_wirtschaftlich,
        familie: !!a.flag_familie,
        klima: !!a.flag_klima
      },
      rules_hitlist: [],
      debug: {
        raw_answers: a
      }
    };

    return caseInput;
  }

  function onConvertClick() {
    showError("");
    $("output-json").value = "";

    const inputText = $("input-json").value.trim();
    if (!inputText) {
      showError("Bitte zuerst JSON aus dem Feld flow_answers_json einfügen.");
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(inputText);
    } catch (e) {
      showError("Fehler beim Einlesen des JSON:\n" + e.message);
      return;
    }

    try {
      const caseInput = buildCaseInput(parsed);
      $("output-json").value = JSON.stringify(caseInput, null, 2);
    } catch (e) {
      showError("Fehler beim Erzeugen von case_input:\n" + e.message);
    }
  }

  function init() {
    const btnConvert = $("btn-convert");
    const btnClear = $("btn-clear");
    if (btnConvert) btnConvert.addEventListener("click", onConvertClick);
    if (btnClear) btnClear.addEventListener("click", clearAll);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
