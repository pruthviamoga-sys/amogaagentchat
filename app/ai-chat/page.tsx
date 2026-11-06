"use client";

import { useChat } from "@ai-sdk/react";
import { WorkflowChatTransport } from "@ai-sdk/workflow/client";
import { useEffect, useState } from "react";

const RUN_KEY = "ai-chat-run-id";

function readSavedRunId(): string | null {
    try {
        return localStorage.getItem(RUN_KEY);
    } catch {
        return null;
    }
}

let activeRunId: string | null = null;

export default function AiChatPage() {
    const [input, setInput] = useState("");

    // A run started before a reload or disconnect, if one is saved.
    const [savedRunId] = useState<string | null>(() =>
        typeof window === "undefined" ? null : readSavedRunId()
    );

    const [transport] = useState(
        () =>
            new WorkflowChatTransport({
                api: "/api/ai-chat",
                maxConsecutiveErrors: 30,
                onChatSendMessage: (response) => {
                    const runId = response.headers.get("x-workflow-run-id");
                    if (runId) {
                        activeRunId = runId;
                        localStorage.setItem(RUN_KEY, runId);
                    }
                },
                prepareReconnectToStreamRequest: ({ api, ...rest }) => {
                    const runId = activeRunId ?? readSavedRunId();
                    if (!runId) throw new Error("No active run");
                    return {
                        ...rest,
                        api: `/api/ai-chat/${encodeURIComponent(runId)}/stream`,
                    };
                },
            })
    );

    const { messages, sendMessage, status } = useChat({
        transport,
        resume: Boolean(savedRunId),
    });
    // If the chat loses its connection, wait until the server answers again, then reload.
    useEffect(() => {
        if (status !== "error") return;
        let cancelled = false;
        let serverWasDown = false;
        let timer: ReturnType<typeof setTimeout>;
        const check = async () => {
            try {
                const res = await fetch("/ai-chat", { cache: "no-store" });
                if (res.ok) {
                    // Server is up. Reload only if it had been down.
                    if (serverWasDown && !cancelled) window.location.reload();
                    return;
                }
                serverWasDown = true;
            } catch {
                serverWasDown = true;
            }
            if (!cancelled) timer = setTimeout(check, 2000);
        };
        timer = setTimeout(check, 2000);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [status]);
    const busy = status !== "ready";

    return (
        <main style={{ maxWidth: 480, margin: "40px auto", padding: 16 }}>
            <h1>AI Chat</h1>

            <div>
                {messages
                    .filter(
                        (m, i) =>
                            !(m.role === "assistant" && messages[i + 1]?.role === "assistant")
                    ).map((m) => (
                        <div key={m.id} style={{ marginBottom: 12 }}>
                            <strong>{m.role === "user" ? "You" : "AI"}: </strong>
                            {m.parts.map((part, i) =>
                                part.type === "text" ? <span key={i}>{part.text}</span> : null
                            )}
                        </div>
                    ))}
            </div>

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    if (!input.trim() || busy) return;
                    sendMessage({ text: input });
                    setInput("");
                }}
            >
                <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask something, e.g. What's the temperature in Toronto?"
                    style={{ width: "70%" }}
                    disabled={busy}
                />
                <button type="submit" disabled={busy}>
                    Send
                </button>
            </form>
        </main>
    );
}