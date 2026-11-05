import { createHook, getWorkflowMetadata } from "workflow";

export async function approvalTest(city: string) {
  "use workflow";
  const { workflowRunId } = getWorkflowMetadata();
  const weather = await getWeather(43.65, -79.38);
  const hook = createHook<{ approved: boolean }>({ token: `approval-${city}` });
  console.log("Waiting for approval for", city, "token: approval-" + city);
  const decision = await hook;
  console.log("Decision received:", decision);
  if (decision.approved) {
    await saveToSheet(workflowRunId, city, weather.temperatureC);
  }
  return { city, approved: decision.approved, temperatureC: weather.temperatureC };
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