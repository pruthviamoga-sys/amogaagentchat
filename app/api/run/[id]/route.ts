import { getRun } from "workflow/api";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = getRun(id);
  const status = await run.status;
  if (status !== "completed") return NextResponse.json({ status });
  const result = await run.returnValue;
  return NextResponse.json({ status, result });
}