"use client";
import { useState } from "react";

export default function ChatPage() {
  const [messages, setMessages] = useState<string[]>([
    "Welcome! What would you like to do?",
  ]);
  const [busy, setBusy] = useState(false);
  const [approvalRunId, setApprovalRunId] = useState<string | null>(null);

  function addMessage(text: string) {
    setMessages((m) => [...m, text]);
  }

  async function waitForResult(runId: string) {
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const res = await fetch(`/api/run/${runId}`);
      const data = await res.json();
      if (data.status === "completed") {
        addMessage(`Toronto temperature: ${data.result.temperatureC}°C`);
        return;
      }
      if (data.status === "failed" || data.status === "cancelled") {
        addMessage(`Run ${data.status}.`);
        return;
      }
    }
    addMessage("Still running. Check the terminal for the result.");
  }

  async function waitForApprovalResult(runId: string) {
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const res = await fetch(`/api/run/${runId}`);
      const data = await res.json();
      if (data.status === "completed") {
        const results = data.result?.results ?? {};
        addMessage("Run completed.");
        if (results.fetch?.temperatureC !== undefined) {
          addMessage(`Toronto temperature: ${results.fetch.temperatureC}°C`);
        }
        if (results.save === "saved") addMessage("Row saved to the sheet.");
        if (results.save === "skipped") addMessage("Sheet save skipped.");
        return;
      }
      if (data.status === "failed" || data.status === "cancelled") {
        addMessage(`Run ${data.status}.`);
        return;
      }
    }
    addMessage("Still running. Check the terminal for the result.");
  }

  async function startApprovalFlow() {
    setBusy(true);
    addMessage("Get temperature with approval");
    try {
      const res = await fetch("/api/flow-approval", { method: "POST" });
      const data = await res.json();
      addMessage(`Started approval flow. Run ID: ${data.runId}`);
      // The approval hook only exists once the run reaches the pause step.
      await new Promise((r) => setTimeout(r, 10000));
      addMessage("Waiting for your decision.");
      setApprovalRunId(data.runId);
    } catch (err) {
      addMessage(`Error: ${String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function sendDecision(approved: boolean) {
    if (!approvalRunId) return;
    const runId = approvalRunId;
    setBusy(true);
    addMessage(approved ? "Approve" : "Reject");
    try {
      const token = `weather-approval-${runId}-pause`;
      const deadline = Date.now() + 60000;
      let resumed = false;
      while (!resumed) {
        const res = await fetch("/api/flow-approval/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, approved }),
        });
        resumed = res.ok;
        if (!resumed) {
          if (Date.now() >= deadline) {
            addMessage("Error: could not send the decision. The approval step was not ready after 60 seconds.");
            return;
          }
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
      setApprovalRunId(null);
      addMessage(approved ? "Decision sent: approved." : "Decision sent: rejected.");
      await waitForApprovalResult(runId);
    } catch (err) {
      addMessage(`Error: ${String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function giveTemperature() {
    setBusy(true);
    addMessage("Give me temperature");
    try {
      const res = await fetch("/api/weather-test", { method: "POST" });
      const data = await res.json();
      addMessage(`Started weather workflow. Run ID: ${data.runId}`);
      await waitForResult(data.runId);
    } catch (err) {
      addMessage(`Error: ${String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 480, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h1>Order Help</h1>
      <div style={{ minHeight: 200, border: "1px solid #ccc", padding: 12, marginBottom: 12 }}>
        {messages.map((text, i) => (
          <p key={i}>{text}</p>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={giveTemperature} disabled={busy || approvalRunId !== null}>
          {busy ? "Working..." : "Give me temperature"}
        </button>
        <button onClick={startApprovalFlow} disabled={busy || approvalRunId !== null}>
          {busy ? "Working..." : "Get temperature with approval"}
        </button>
      </div>
      {approvalRunId && (
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={() => sendDecision(true)} disabled={busy}>
            Approve
          </button>
          <button onClick={() => sendDecision(false)} disabled={busy}>
            Reject
          </button>
        </div>
      )}
    </main>
  );
}