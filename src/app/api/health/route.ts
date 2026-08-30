import { NextResponse } from "next/server";
import { rows } from "@/lib/db";

export async function GET() {
  try {
    await rows("SELECT 1");
    return NextResponse.json({ ok: true, database: "connected" });
  } catch {
    return NextResponse.json({ ok: false, database: "unavailable" }, { status: 503 });
  }
}
