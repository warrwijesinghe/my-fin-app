import { currentOwner, relativeRedirect } from "@/lib/auth";
import { z } from "zod";
import { execute } from "@/lib/db";
import { requireApiSession } from "@/lib/route-auth";
const schema = z.object({ target: z.coerce.number().positive().max(999999999999), monthlyDebt: z.coerce.number().min(0).max(999999999999), monthlyWealth: z.coerce.number().min(0).max(999999999999) });
export async function POST(request: Request) {
  const denied=await requireApiSession(); if(denied)return denied; const viewer=await currentOwner();
  const form = await request.formData();
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return relativeRedirect("/analytics?goalError=1#goals");
  await execute("INSERT INTO AppSetting (owner,`key`,value,updatedAt) VALUES (?,'analyticsGoals',?,NOW(3)) ON DUPLICATE KEY UPDATE value=VALUES(value),updatedAt=NOW(3)", [viewer,JSON.stringify(parsed.data)]);
  return relativeRedirect("/analytics?goalSaved=1#goals");
}
