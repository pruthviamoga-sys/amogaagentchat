import { resumeHook } from "workflow/api";
import { NextResponse } from "next/server";

// Resumes an "approval" step in a flow. The token is `${flowId}-${runId}-${stepId}`.
export async function POST(request: Request) {
  const { token, approved } = await request.json();
  await resumeHook(token, { approved: Boolean(approved) });
  return NextResponse.json({ resumed: true, token, approved: Boolean(approved) });
}
