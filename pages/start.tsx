// pages/start.tsx
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const FlowRunner = dynamic(() => import("../components/FlowRunner"), { ssr: false });

export default function StartPage() {
  const [flow, setFlow] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/flows/flow.de.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject("Flow nicht gefunden")))
      .then(setFlow)
      .catch((e) => setErr(String(e)));
  }, []);

  if (err) {
    return (
      <main style={{ minHeight: "100vh", background: "#f6f1e7", color: "#0a2a4a" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
          <h1 style={{ fontFamily: "Montserrat, system-ui", marginBottom: 12 }}>Fehler</h1>
          <p style={{ fontFamily: "Montserrat, system-ui" }}>{err}</p>
        </div>
      </main>
    );
  }

  if (!flow) {
    return (
      <main style={{ minHeight: "100vh", background: "#f6f1e7", color: "#0a2a4a" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
          <img src="/logo.png" alt="Amanaya" style={{ height: 30, marginBottom: 20 }} />
          <p style={{ fontFamily: "Montserrat, system-ui" }}>Lade Fragen…</p>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f6f1e7", color: "#0a2a4a" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
        <img src="/logo.png" alt="Amanaya" style={{ height: 30, marginBottom: 20 }} />
        <FlowRunner flow={flow} logoSrc="/logo.png" />
      </div>
    </main>
  );
}
