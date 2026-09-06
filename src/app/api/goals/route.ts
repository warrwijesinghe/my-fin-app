import { NextResponse } from "next/server";
import { z } from "zod";
import { execute } from "@/lib/db";
import { requireApiSession } from "@/lib/route-auth";
const schema = z.object({ target: z.coerce.number().positive().max(999999999999), monthlyDebt: z.coerce.number().min(0).max(999999999999), monthlyWealth: z.coerce.number().min(0).max(999999999999) });
export async function POST(request: Request) {
  const denied = await requireApiSession(); if (denied) return denied;
  const form = await request.formData();
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return NextResponse.redirect(new URL("/analytics?goalError=1#goals", request.url), 303);
  await execute("INSERT INTO AppSetting (`key`,value,updatedAt) VALUES ('analyticsGoals',?,NOW(3)) ON DUPLICATE KEY UPDATE value=VALUES(value),updatedAt=NOW(3)", [JSON.stringify(parsed.data)]);
  return NextResponse.redirect(new URL("/analytics?goalSaved=1#goals", request.url), 303);
}
