import { start } from "workflow/api";
import { runFlow, type FlowDef } from "@/workflows/flow-runner";
import flow from "@/flows/weather-approval.json";
import { NextResponse } from "next/server";

const definition = flow as unknown as FlowDef;

export async function POST() {
  const run = await start(runFlow, [definition, "Toronto"]);
  return NextResponse.json({ runId: run.runId });
}
