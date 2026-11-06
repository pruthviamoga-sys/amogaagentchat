import { createHook, FatalError, getWorkflowMetadata, sleep } from "workflow";

type Step =
  | { id: string; kind: "weather"; lat: number; lon: number }
  | { id: string; kind: "wait"; duration: string }
  | { id: string; kind: "approval" }
  | { id: string; kind: "sheet"; from: string; onlyIfApproved: string };

export type FlowDef = { id: string; steps: Step[] };

type ApprovalDecision = { approved: boolean };

export async function runFlow(definition: FlowDef, city: string) {
  "use workflow";
  const results: Record<string, unknown> = {};
  const { workflowRunId } = getWorkflowMetadata();
  for (const step of definition.steps) {
    await reportProgress(workflowRunId, step.id, "running");

    if (step.kind === "weather") {
      results[step.id] = await getWeather(step.lat, step.lon);
      await reportProgress(workflowRunId, step.id, "done");
    } else if (step.kind === "wait") {
      await sleep(step.duration as `${number}m`);
      await reportProgress(workflowRunId, step.id, "done");
    } else if (step.kind === "approval") {
      const { workflowRunId } = getWorkflowMetadata();
      const token = `${definition.id}-${workflowRunId}-${step.id}`;
      const hook = createHook<ApprovalDecision>({ token });
      await reportProgress(workflowRunId, step.id, "waiting");
      console.log("Waiting for approval, token:", token);
      const decision = await hook;
      console.log("Decision received:", decision);
      results[step.id] = decision;
      await reportProgress(workflowRunId, step.id, "done");
    } else if (step.kind === "sheet") {
      const decision = results[step.onlyIfApproved] as ApprovalDecision | undefined;
      if (decision?.approved !== true) {
        results[step.id] = "skipped";
        continue;
      }
      const weather = results[step.from] as { temperatureC: number } | undefined;
      if (weather === undefined) {
        throw new FatalError(`Sheet step "${step.id}" has no result from step "${step.from}"`);
      }
      const { workflowRunId } = getWorkflowMetadata();
      await saveToSheet(workflowRunId, city, weather.temperatureC);
      results[step.id] = "saved";
      await reportProgress(workflowRunId, step.id, "done");
    } else {
      throw new FatalError(`Unknown step kind: ${(step as { kind: string }).kind}`);
    }
  }

  console.log("Flow finished:", definition.id, city, results);
  return { flow: definition.id, city, results };
}

async function reportProgress(runId: string, stepId: string, state: string) {
  "use step";
  const { setStepState } = await import("@/lib/progress");
  await setStepState(runId, stepId, state);
}

async function getWeather(lat: number, lon: number) {
  "use step";
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather API ${res.status}`);
  const data = await res.json();
  return { temperatureC: data.current.temperature_2m };
}

async function saveToSheet(runId: string, city: string, temperatureC: number) {
  "use step";
  const res = await fetch(process.env.SHEET_WEBHOOK_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret: process.env.SHEET_SECRET, runId, city, temperatureC }),
  });
  if (!res.ok) throw new Error(`Sheet save failed: ${res.status}`);
  console.log("Saved to sheet:", runId);
}