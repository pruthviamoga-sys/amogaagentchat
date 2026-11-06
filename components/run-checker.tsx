"use client";

import { useEffect, useState } from "react";

type RunResult = { results?: Record<string, unknown> };

const card = {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 20,
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
};
const button = {
    background: "#0f172a",
    color: "#ffffff",
    border: "none",
    borderRadius: 8,
    padding: "8px 14px",
    fontSize: 14,
    cursor: "pointer",
};
const input = {
    flex: 1,
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    fontSize: 14,
    minWidth: 0,
};

export default function RunChecker() {
    const [runIdInput, setRunIdInput] = useState("");
    const [question, setQuestion] = useState("What's the temperature in Toronto right now?");
    const [activeId, setActiveId] = useState<string | null>(null);
    const [agentType, setAgentType] = useState<"approval" | "chat" | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const [steps, setSteps] = useState<Record<string, string>>({});
    const [result, setResult] = useState<RunResult | null>(null);
    const [decided, setDecided] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [output, setOutput] = useState<string | null>(null);

    useEffect(() => {
        if (!activeId) return;
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout>;

        const check = async () => {
            try {
                const res = await fetch(`/api/runs/${encodeURIComponent(activeId)}`, { cache: "no-store" });
                const data = await res.json();
                if (cancelled) return;
                if (!res.ok) {
                    setError(data.error ?? res.statusText);
                    setStatus(null);
                    return;
                }
                setError(null);
                setStatus(data.status);

                const progress = await fetch(`/api/run-progress/${encodeURIComponent(activeId)}`, { cache: "no-store" });
                if (progress.ok && !cancelled) {
                    const progressData = await progress.json();
                    setSteps(progressData.steps ?? {});
                    setOutput(progressData.output ?? null);
                }

                if (data.status === "pending" || data.status === "running") {
                    timer = setTimeout(check, 2000);
                } else if (data.status === "completed") {
                    const detail = await fetch(`/api/run/${encodeURIComponent(activeId)}`, { cache: "no-store" });
                    const detailData = await detail.json();
                    if (!cancelled) setResult(detailData.result ?? null);
                }
            } catch {
                if (!cancelled) setError("Could not reach the server.");
            }
        };

        check();
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [activeId]);

    function resetView() {
        setOutput(null);
        setMessage(null);
        setError(null);
        setResult(null);
        setStatus(null);
        setSteps({});
        setDecided(false);
    }

    function checkRun() {
        if (!runIdInput.trim()) return;
        resetView();
        setAgentType(null);
        setActiveId(runIdInput.trim());
    }

    async function startApproval() {
        setBusy(true);
        resetView();
        try {
            const res = await fetch("/api/flow-approval", { method: "POST" });
            const data = await res.json();
            if (!res.ok || !data.runId) {
                setError("Could not start the approval run.");
                return;
            }
            setRunIdInput(data.runId);
            setAgentType("approval");
            setActiveId(data.runId);
            setMessage("Started. Waiting for the approval step.");
        } catch {
            setError("Could not reach the server.");
        } finally {
            setBusy(false);
        }
    }

    async function startAiChat() {
        if (!question.trim()) return;
        setBusy(true);
        resetView();
        try {
            const res = await fetch("/api/ai-chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: [
                        {
                            id: Math.random().toString(36).slice(2) + Date.now().toString(36),
                            role: "user",
                            parts: [{ type: "text", text: question.trim() }],
                        },
                    ],
                }),
            });
            const id = res.headers.get("x-workflow-run-id");
            if (!res.ok || !id) {
                setError("Could not start the AI chat run.");
                return;
            }
            setRunIdInput(id);
            setAgentType("chat");
            setActiveId(id);
            setMessage("AI chat run started.");
        } catch {
            setError("Could not reach the server.");
        } finally {
            setBusy(false);
        }
    }

    async function decide(approved: boolean) {
        if (!activeId) return;
        setBusy(true);
        setError(null);
        const token = `weather-approval-${activeId}-pause`;
        const deadline = Date.now() + 60000;
        try {
            while (true) {
                const res = await fetch("/api/flow-approval/approve", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token, approved }),
                });
                if (res.ok) {
                    setDecided(true);
                    setMessage(approved ? "Decision sent: approved." : "Decision sent: rejected.");
                    break;
                }
                if (Date.now() >= deadline) {
                    setError("The approval step was not ready after 60 seconds.");
                    break;
                }
                await new Promise((r) => setTimeout(r, 3000));
            }
        } catch {
            setError("Could not reach the server.");
        } finally {
            setBusy(false);
        }
    }

    const waiting = status === "running" || status === "pending";
    const results = result?.results as
        | { fetch?: { temperatureC?: number }; save?: string }
        | undefined;

    return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={card}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                        <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Weather with approval</h2>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#b45309", background: "#fef3c7", padding: "4px 10px", borderRadius: 999 }}>Approval</span>
                    </div>
                    <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.5, margin: "8px 0 14px" }}>
                        Fetches Toronto weather, then waits for your approval before saving the reading.
                    </p>
                    <button onClick={startApproval} disabled={busy} style={button}>
                        {busy && agentType !== "chat" ? "Starting..." : "Start run"}
                    </button>
                </div>

                <div style={card}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                        <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>AI chat</h2>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#1d4ed8", background: "#dbeafe", padding: "4px 10px", borderRadius: 999 }}>Streaming</span>
                    </div>
                    <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.5, margin: "8px 0 14px" }}>
                        Answers questions using a weather tool, with the reply streamed as it arrives.
                    </p>
                    <div style={{ display: "flex", gap: 8 }}>
                        <input value={question} onChange={(e) => setQuestion(e.target.value)} style={input} />
                        <button onClick={startAiChat} disabled={busy} style={button}>Start run</button>
                    </div>
                </div>
            </div>

            <div style={card}>
                <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 12px" }}>Run</h2>
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                    <input value={runIdInput} onChange={(e) => setRunIdInput(e.target.value)} placeholder="wrun_..." style={input} />
                    <button onClick={checkRun} style={button}>Check</button>
                </div>

                {!activeId && <p style={{ fontSize: 14, color: "#64748b", margin: 0 }}>Start a run or paste a run ID to see its progress here.</p>}

                {activeId && (
                    <>
                        {status && (
                            <p style={{ margin: "0 0 10px", fontSize: 14 }}>
                                Status: <strong>{status}</strong>{waiting ? " (updating...)" : ""}
                            </p>
                        )}
                        {Object.keys(steps).length > 0 && (
                            <div style={{ fontSize: 14, marginBottom: 12 }}>
                                <div style={{ fontWeight: 600, marginBottom: 4 }}>Steps</div>
                                {Object.entries(steps).map(([stepId, state]) => (
                                    <div key={stepId}>{stepId}: {state}</div>
                                ))}
                            </div>
                        )}
                        {output && (
                            <div style={{ fontSize: 14, background: "#f8fafc", borderRadius: 8, padding: 12, marginBottom: 12, whiteSpace: "pre-wrap" }}>
                                <div style={{ fontWeight: 600, marginBottom: 4 }}>Answer</div>
                                {output}
                            </div>
                        )}
                        {agentType === "approval" && waiting && !decided && (
                            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                                <button onClick={() => decide(true)} disabled={busy} style={button}>Approve</button>
                                <button onClick={() => decide(false)} disabled={busy} style={button}>Reject</button>
                            </div>
                        )}
                        {message && <p style={{ margin: "0 0 12px", fontSize: 14 }}>{message}</p>}
                        {results && (
                            <div style={{ fontSize: 14, background: "#f8fafc", borderRadius: 8, padding: 12 }}>
                                <div>Temperature: {results.fetch?.temperatureC ?? "n/a"}°C</div>
                                <div>Sheet save: {results.save ?? "n/a"}</div>
                            </div>
                        )}
                    </>
                )}

                {error && <p style={{ margin: "12px 0 0", fontSize: 14, color: "#b91c1c" }}>Error: {error}</p>}
            </div>
        </div>
    );
}