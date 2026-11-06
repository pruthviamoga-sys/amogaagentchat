import { NextResponse } from "next/server";
import { getRunProgress } from "@/lib/progress";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const { steps, output } = await getRunProgress(id);
  return NextResponse.json({ id, steps, output });
}