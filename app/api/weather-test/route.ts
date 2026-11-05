import { start } from "workflow/api";
import { weatherTest } from "@/workflows/weather-test";
import { NextResponse } from "next/server";

export async function POST() {
  const run = await start(weatherTest, ["Toronto", 43.65, -79.38]);
  return NextResponse.json({ runId: run.runId });
}