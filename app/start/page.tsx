// app/start/page.tsx
import FlowRunner from "@/components/FlowRunner";

async function getFlow() {
  // Variante A: aus /public/flows/flow.de.json
  const res = await fetch("/flows/flow.de.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Flow-Datei nicht gefunden");
  return res.json();
}

export default async function StartPage() {
  const flow = await getFlow();

  return (
    <main style={{ minHeight: "100vh", background: "#f6f1e7", color: "#0a2a4a" }}>
      <FlowRunner flow={flow} logoSrc="/logo.png" />
    </main>
  );
}
