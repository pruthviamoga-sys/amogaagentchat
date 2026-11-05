import { resumeHook } from "workflow/api";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { city, approved } = await request.json();
  await resumeHook(`approval-${city}`, { approved: Boolean(approved) });
  return NextResponse.json({ resumed: true, city, approved: Boolean(approved) });
}