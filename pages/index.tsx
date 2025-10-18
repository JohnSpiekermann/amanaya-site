export default function Home() {
  return (
    <main style={{ minHeight: "100vh", background: "#f6f1e7", color: "#0a2a4a" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: 24, fontFamily: "Montserrat, system-ui" }}>
        <img src="/logo.png" alt="Amanaya" style={{ height: 40, marginBottom: 16 }} />
        <h1>Amanaya</h1>
        <p>Wenn du das siehst, funktionieren die Pages-Routen. Den Fragenflow findest du unter <a href="/start">/start</a>.</p>
      </div>
    </main>
  );
}
