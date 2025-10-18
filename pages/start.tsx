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

  if (err) return <div style={{ padding: 24 }}>Fehler: {err}</div>;
  if (!flow) return <div style={{ padding: 24 }}>Lade Fragen…</div>;

  const Flow = FlowRunner as any;
  return (
    <main style={{ minHeight: "100vh", background: "#f6f1e7", color: "#0a2a4a" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
        <img src="/logo.png" alt="Amanaya" style={{ height: 30, marginBottom: 20 }} />
        <Flow flow={flow} logoSrc="/logo.png" />
      </div>
    </main>
  );
}
