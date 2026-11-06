import { getWorkflowMetadata, getWritable } from "workflow";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { streamText, stepCountIs, type ModelMessage } from "ai";
import { z } from "zod";
import settings from "@/flows/ai-chat.json";

async function fetchWeather() {
  const url =
    "https://api.open-meteo.com/v1/forecast?latitude=43.65&longitude=-79.38" +
    "&current=temperature_2m,precipitation,weather_code";
  const res = await fetch(url);
  const data = await res.json();
  return {
    city: "Toronto",
    temperatureC: data.current.temperature_2m,
    precipitationMm: data.current.precipitation,
    weatherCode: data.current.weather_code,
  };
}

async function reportProgress(runId: string, stepId: string, state: string) {
  "use step";
  const { setStepState } = await import("@/lib/progress");
  await setStepState(runId, stepId, state);
}

// Called from inside a step, so it is a plain function, not a step.
async function recordState(runId: string, stepId: string, state: string, detail?: string) {
  const { setStepState } = await import("@/lib/progress");
  await setStepState(runId, stepId, state, detail);
}

// The OpenRouter model is created inside this step, so it is never saved as a step argument.
async function runModelStep(messages: ModelMessage[], writable: WritableStream, runId: string) {
  "use step";
  const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
  const result = streamText({
    model: openrouter(settings.model),
    system: settings.system,
    messages,
    tools: {
      getWeather: {
        description: "Get the current weather in Toronto",
        inputSchema: z.object({}),
        execute: async () => {
          await recordState(runId, "weather", "running");
          const weather = await fetchWeather();
          await recordState(runId, "weather", "done");
          return weather;
        },
      },
    },
    stopWhen: stepCountIs(settings.maxSteps),
  });
  await result.toUIMessageStream().pipeTo(writable);
  const answer = await result.text;
  await recordState(runId, "answer", "done", answer);
}

export async function aiChatWorkflow(messages: ModelMessage[]) {
  "use workflow";
  const { workflowRunId } = getWorkflowMetadata();
  await reportProgress(workflowRunId, "answer", "running");
  await runModelStep(messages, getWritable(), workflowRunId);
  await reportProgress(workflowRunId, "answer", "done");
}