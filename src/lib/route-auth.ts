import { NextResponse } from "next/server";
import { hasSession } from "@/lib/auth";

export async function requireApiSession() {
  if (await hasSession()) return null;
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
