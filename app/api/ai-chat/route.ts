import { start } from "workflow/api";
import { convertToModelMessages, createUIMessageStreamResponse } from "ai";
import { aiChatWorkflow } from "@/workflows/ai-chat";

export async function POST(req: Request) {
  const { messages } = await req.json();
  const modelMessages = await convertToModelMessages(messages);

  const run = await start(aiChatWorkflow, [modelMessages]);

  return createUIMessageStreamResponse({
    stream: run.readable,
    headers: { "x-workflow-run-id": run.runId },
  });
}