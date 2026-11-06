import { NextResponse } from "next/server";
import { getRun } from "workflow/api";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const run = getRun(id);

  if (!(await run.exists)) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const status = await run.status;
  return NextResponse.json({ id, status });
}