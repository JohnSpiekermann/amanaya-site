// app/start/page.tsx
import FlowRunner from "../../components/FlowRunner";

async function getFlow() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/flows/flow.de.json`, {
    cache: "no-store",
  }).catch(() => null);

  const ok = res && res.ok ? res : await fetch("/flows/flow.de.json", { cache: "no-store" });
  if (!ok.ok) throw new Error("Flow-Datei nicht gefunden");
  return ok.json();
}

export default async function StartPage() {
  const flow = await getFlow();

  return (
    <main style={{ minHeight: "100vh", background: "#f6f1e7", color: "#0a2a4a" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px 40px" }}>
        <img src="/logo.png" alt="Amanaya" style={{ height: 30, marginBottom: 20 }} />
        {/* FlowRunner ist eine Client-Komponente */}
        {/* @ts-expect-error Server/Client boundary */}
        <FlowRunner flow={flow} logoSrc="/logo.png" />
      </div>
    </main>
  );
}
