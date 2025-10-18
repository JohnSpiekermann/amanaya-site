// components/FlowRunner.tsx
"use client";

import React, { useMemo, useState } from "react";

/** ================================
 *  Amanaya CI (Beige/Blau)
 *  ================================ */
const CI = {
  bg: "#f6f1e7",        // Hintergrund (Beige)
  text: "#0a2a4a",      // Tiefblau (Text)
  accent: "#0f3a6b",    // Markenblau (Buttons/Rahmen)
  font: "Montserrat, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
};

const styles = {
  wrap: {
    maxWidth: 720,
    margin: "0 auto",
    padding: "24px 20px 40px",
    fontFamily: CI.font,
    color: CI.text,
  } as React.CSSProperties,
  logoRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
  } as React.CSSProperties,
  logoImg: { height: 30 } as React.CSSProperties,
  card: {
    background: "#fff",
    border: `1px solid rgba(10,42,74,0.15)`,
    borderRadius: 16,
    padding: 24,
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  } as React.CSSProperties,
  title: {
    fontSize: 26,
    fontWeight: 800,
    color: CI.text,
    margin: "8px 0 6px",
  } as React.CSSProperties,
  question: {
    fontSize: 22,
    fontWeight: 800,
    color: CI.text,
    margin: "6px 0 14px",
  } as React.CSSProperties,
  desc: { color: CI.text, opacity: 0.9, marginTop: 6 } as React.CSSProperties,
  field: {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 12,
    border: `1px solid rgba(10,42,74,0.25)`,
    outline: "none",
  } as React.CSSProperties,
  row: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 } as React.CSSProperties,
  btn: {
    appearance: "none",
    border: "none",
    background: CI.accent,
    color: CI.bg,
    borderRadius: 12,
    padding: "10px 18px",
    fontWeight: 800,
    cursor: "pointer",
  } as React.CSSProperties,
  btnGhost: {
    appearance: "none",
    border: `1px solid ${CI.accent}`,
    background: "transparent",
    color: CI.accent,
    borderRadius: 12,
    padding: "10px 18px",
    fontWeight: 800,
    cursor: "pointer",
  } as React.CSSProperties,
  hint: {
    marginTop: 12,
    padding: "10px 12px",
    borderRadius: 12,
    background: CI.bg,
    border: `1px dashed ${CI.accent}`,
    fontSize: 14,
    color: CI.text,
  } as React.CSSProperties,
  list: { marginTop: 12 } as React.CSSProperties,
};

type Flow = {
  version: string;
  locale: string;
  ci?: { bg?: string; text?: string; accent?: string; font?: string };
  legal?: any;
  vars?: Record<string, any>;
  flow: Step[];
};

type Step = {
  id: string;
  kind?: "info" | "summary" | "done" | "router";
  title?: string;
  headline?: string;
  text?: string;
  show?: string[];
  eval_hint?: string;
  conditions?: { expr: string }[];
  question?: string | { expr: string };
  type?:
    | "radio"
    | "checkbox"
    | "text"
    | "textarea"
    | "number"
    | "date"
    | "date-range"
    | "email"
    | "payment"
    | "country"
    | "country-eu";
  options?: { label: string; value: any }[];
  labels?: { from?: string; to?: string };
  min?: number;
  max?: number;
  required?: boolean;
  provider?: "paypal";
  amount_eur?: number;
  onAnswer?: { set?: Record<string, any> };
  next?: string | { expr: string } | null;
};

/** Minimaler Ausdrucks-Evaluator
 *  Ersetzt $var durch den aktuellen Variablenwert und wertet kleine JS-Expressions.
 *  Beispiel: "$alter < 18 ? 'minor' : 'adult'"
 */
function evalExpr(expr: string, vars: Record<string, any>) {
  const safe = expr.replace(/\$([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, v) => {
    const val = vars[v];
    return typeof val === "string" ? JSON.stringify(val) : String(val);
  });
  try {
    // eslint-disable-next-line no-new-func
    return new Function(`return (${safe});`)();
  } catch {
    return null;
  }
}

function getQuestionText(q: Step["question"], vars: Record<string, any>) {
  if (!q) return "";
  if (typeof q === "string") return q;
  if ("expr" in q) return String(evalExpr(q.expr, vars) ?? "");
  return "";
}

function passesConditions(step: Step, vars: Record<string, any>) {
  if (!step.conditions || step.conditions.length === 0) return true;
  return step.conditions.every((c) => !!evalExpr(c.expr, vars));
}

function nextId(step: Step, vars: Record<string, any>) {
  if (step.next == null) return null;
  if (typeof step.next === "string") return step.next;
  if ("expr" in step.next) return evalExpr(step.next.expr, vars);
  return null;
}

function setVars(vars: Record<string, any>, setObj?: Record<string, any>, value?: any) {
  if (!setObj) return vars;
  const out = { ...vars };
  for (const [k, v] of Object.entries(setObj)) {
    if (v === "$value") {
      out[k] = value;
    } else if (v && typeof v === "object" && "expr" in (v as any)) {
      out[k] = evalExpr((v as any).expr, out);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/** Eingabefeld je Fragetyp */
function Field({
  step,
  value,
  onChange,
}: {
  step: Step;
  value: any;
  onChange: (v: any) => void;
}) {
  switch (step.type) {
    case "radio":
      return (
        <div role="radiogroup" style={{ display: "grid", gap: 10 }}>
          {step.options?.map((o) => (
            <label key={String(o.value)} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="radio"
                name={step.id}
                checked={value === o.value}
                onChange={() => onChange(o.value)}
              />
              {o.label}
            </label>
          ))}
        </div>
      );
    case "checkbox":
      return (
        <div style={{ display: "grid", gap: 10 }}>
          {step.options?.map((o) => {
            const checked = Array.isArray(value) && value.includes(o.value);
            return (
              <label key={String(o.value)} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    const arr = Array.isArray(value) ? [...value] : [];
                    if (e.target.checked) {
                      if (!arr.includes(o.value)) arr.push(o.value);
                    } else {
                      const idx = arr.indexOf(o.value);
                      if (idx >= 0) arr.splice(idx, 1);
                    }
                    onChange(arr);
                  }}
                />
                {o.label}
              </label>
            );
          })}
        </div>
      );
    case "text":
      return (
        <input
          style={styles.field}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "textarea":
      return (
        <textarea
          style={{ ...styles.field, minHeight: 110 }}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "number":
      return (
        <input
          type="number"
          min={step.min}
          max={step.max}
          style={{ ...styles.field, maxWidth: 180 }}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        />
      );
    case "date":
      return (
        <input
          type="date"
          style={{ ...styles.field, maxWidth: 220 }}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "date-range":
      return (
        <div style={{ display: "flex", gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 4 }}>
              {step.labels?.from ?? "Von"}
            </div>
            <input
              type="date"
              style={{ ...styles.field, maxWidth: 220 }}
              value={value?.from ?? ""}
              onChange={(e) => onChange({ ...(value || {}), from: e.target.value })}
            />
          </div>
          <div>
            <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 4 }}>
              {step.labels?.to ?? "Bis"}
            </div>
            <input
              type="date"
              style={{ ...styles.field, maxWidth: 220 }}
              value={value?.to ?? ""}
              onChange={(e) => onChange({ ...(value || {}), to: e.target.value })}
            />
          </div>
        </div>
      );
    case "email":
      return (
        <input
          type="email"
          placeholder="deine@mailadresse.tld"
          style={styles.field}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "country":
    case "country-eu":
      // Platzhalter: einfache Eingabe; gern später gegen Select mit Liste tauschen
      return (
        <input
          placeholder="Land (z. B. Türkei / Deutschland)"
          style={styles.field}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "payment":
      // Pilot: Stub (setzt zahlung_ok = true)
      return (
        <button type="button" style={styles.btn} onClick={() => onChange(true)}>
          Zahlung jetzt auslösen (PayPal-Stub) – {step.amount_eur ?? 119} €
        </button>
      );
    default:
      return null;
  }
}

export default function FlowRunner({
  flow,
  logoSrc,
}: {
  flow: Flow;
  logoSrc?: string;
}) {
  const steps = flow.flow as Step[];
  const [vars, setVars] = useState<Record<string, any>>({ ...(flow.vars || {}) });
  const [history, setHistory] = useState<string[]>([]);
  const [curId, setCurId] = useState<string>(steps[0]?.id ?? "");
  const [curValue, setCurValue] = useState<any>(null);

  const cur = useMemo(() => steps.find((s) => s.id === curId), [steps, curId]);

  // Vorbelegte Werte beim Zurückspringen in das Feld laden
  React.useEffect(() => {
    if (!cur) return;
    const preset = vars[cur.id];
    setCurValue(preset ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curId]);

  if (!cur) {
    return (
      <div style={styles.wrap}>
        <div style={styles.card}>
          <div style={styles.title}>Flow nicht gefunden</div>
          <p style={styles.desc}>Die angeforderte Frage existiert nicht.</p>
        </div>
      </div>
    );
  }

  function goNext() {
    const isInput = !!cur.type;

    // Pflichtfeld prüfen
    if (isInput && cur.required) {
      const empty =
        curValue === null ||
        curValue === "" ||
        (Array.isArray(curValue) && curValue.length === 0);
      if (empty) {
        alert("Bitte beantworte diese Frage.");
        return;
      }
    }

    // Bedingungen checken
    if (!passesConditions(cur, vars)) {
      const nid = nextId(cur, vars);
      if (!nid) return;
      setHistory((h) => [...h, cur.id]);
      setCurId(String(nid));
      return;
    }

    // Variablen setzen
    let nextVars = { ...vars };
    if (isInput) {
      nextVars[cur.id] = curValue; // Wert unter Step-ID speichern
      nextVars = setVars(nextVars, cur.onAnswer?.set, curValue);
    } else if (cur.onAnswer?.set) {
      nextVars = setVars(nextVars, cur.onAnswer.set);
    }
    setVars(nextVars);

    // Nächste ID ermitteln
    const nid = nextId(cur, nextVars);
    if (!nid) return;
    setHistory((h) => [...h, cur.id]);
    setCurId(String(nid));
  }

  function goBack() {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    setCurId(prev);
  }

  const qText = getQuestionText(cur.question, vars);

  return (
    <div style={styles.wrap}>
      {/* Logo oben links */}
      {logoSrc && (
        <div style={styles.logoRow}>
          <img src={logoSrc} alt="Amanaya" style={styles.logoImg} />
        </div>
      )}

      <div style={styles.card}>
        {/* INFO / ROUTER / SUMMARY / DONE */}
        {cur.kind === "info" && (
          <>
            {cur.headline && <div style={styles.title}>{cur.headline}</div>}
            {cur.text && <p style={styles.desc}>{cur.text}</p>}
          </>
        )}

        {cur.kind === "router" && (
          <>
            <div style={styles.title}>Weiter…</div>
            <p style={styles.desc}>Bitte warte einen Moment.</p>
          </>
        )}

        {cur.kind === "summary" && (
          <>
            <div style={styles.title}>{cur.title ?? "Zusammenfassung"}</div>
            <div style={styles.hint}>
              Bitte prüfe deine Angaben. Du kannst mit „Zurück“ jederzeit korrigieren.
            </div>
            <ul style={styles.list}>
              {(cur.show ?? []).map((k) => (
                <li key={k} style={{ margin: "6px 0" }}>
                  <strong>{k}:</strong>{" "}
                  {Array.isArray(vars[k]) ? vars[k].join(", ") : String(vars[k] ?? "—")}
                </li>
              ))}
            </ul>
          </>
        )}

        {cur.kind === "done" && (
          <>
            <div style={styles.title}>{cur.headline ?? "Fertig"}</div>
            {cur.text && <p style={styles.desc}>{cur.text}</p>}
          </>
        )}

        {/* FRAGE */}
        {!cur.kind && cur.type && (
          <>
            <div style={styles.question}>{qText}</div>
            <Field step={cur} value={curValue} onChange={setCurValue} />
            {cur.eval_hint && <div style={styles.hint}>{cur.eval_hint}</div>}
          </>
        )}

        {/* Buttons */}
        <div style={{ ...styles.row, marginTop: 18 }}>
          <button
            style={styles.btnGhost}
            type="button"
            onClick={goBack}
            disabled={history.length === 0}
            aria-disabled={history.length === 0}
          >
            ← Zurück
          </button>
          <button style={styles.btn} type="button" onClick={goNext}>
            Weiter →
          </button>
        </div>
      </div>
    </div>
  );
}
