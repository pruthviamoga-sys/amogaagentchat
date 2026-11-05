import { start } from "workflow/api";
import { approvalTest } from "@/workflows/approval-test";
import { NextResponse } from "next/server";

export async function POST() {
  const run = await start(approvalTest, ["Toronto"]);
  return NextResponse.json({ runId: run.runId });
}