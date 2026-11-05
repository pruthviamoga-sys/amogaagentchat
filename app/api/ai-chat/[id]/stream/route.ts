import { createUIMessageStreamResponse, type UIMessageChunk } from "ai";
import { getRun } from "workflow/api";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Read the run's saved chunks from the beginning.
  const chunks: UIMessageChunk[] = [];
  const reader = getRun(id).getReadable({ startIndex: 0 }).getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value as UIMessageChunk);
  }

  // Keep only the last attempt, which starts at the last "start" chunk.
  let lastStart = 0;
  chunks.forEach((chunk, i) => {
    if (chunk.type === "start") lastStart = i;
  });
  const kept = chunks.slice(lastStart);

  const stream = new ReadableStream<UIMessageChunk>({
    start(controller) {
      for (const chunk of kept) controller.enqueue(chunk);
      controller.close();
    },
  });

  return createUIMessageStreamResponse({ stream });
}