import RunChecker from "../../components/run-checker";

export default function PlaygroundPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "system-ui, sans-serif", color: "#0f172a", padding: "48px 16px" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 6px" }}>Agent Playground</h1>
        <p style={{ fontSize: 15, color: "#475569", margin: "0 0 28px" }}>Start an agent on the left and watch its run on the right.</p>
        <RunChecker />
      </div>
    </main>
  );
}