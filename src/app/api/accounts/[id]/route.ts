import { NextResponse } from "next/server";
import { z } from "zod";
import { execute, rows } from "@/lib/db";
import { requireApiSession } from "@/lib/route-auth";

const idSchema = z.string().uuid();
const updateSchema = z.object({ name: z.string().trim().min(2).max(120), holder: z.string().trim().max(80).optional(), creditLimit: z.coerce.number().min(0).optional(), includeInAvailable: z.boolean() });

function redirect(request: Request, result: string) { return NextResponse.redirect(new URL(`/accounts?${result}=1`, request.url)); }

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireApiSession();
  if (denied) return denied;
  const { id: rawId } = await params;
  const id = idSchema.safeParse(rawId);
  if (!id.success) return redirect(request, "error");
  const form = await request.formData();
  const [account] = await rows<{ id: string; type: string } & any>("SELECT id,type FROM `Account` WHERE id=?", [id.data]);
  if (!account) return redirect(request, "error");
  if (form.get("intent") === "delete") {
    const [entries] = await rows<{ count: number } & any>("SELECT COUNT(*) count FROM `AccountEntry` WHERE accountId=?", [id.data]);
    if (Number(entries?.count || 0) > 0) return redirect(request, "has_entries");
    await execute("DELETE FROM `Account` WHERE id=?", [id.data]);
    return redirect(request, "deleted");
  }
  const data = updateSchema.safeParse({ name: form.get("name"), holder: form.get("holder") || undefined, creditLimit: form.get("creditLimit") || undefined, includeInAvailable: form.get("includeInAvailable") === "on" });
  if (!data.success) return redirect(request, "error");
  await execute("UPDATE `Account` SET name=?,holder=?,creditLimit=?,includeInAvailable=?,updatedAt=NOW(3) WHERE id=?", [data.data.name, data.data.holder || null, account.type === "CREDIT_CARD" ? data.data.creditLimit ?? null : null, data.data.includeInAvailable, id.data]);
  return redirect(request, "updated");
}
