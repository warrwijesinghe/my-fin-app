import { relativeRedirect } from "@/lib/auth";
import { z } from "zod";
import { execute, rows } from "@/lib/db";
import { requireApiSession } from "@/lib/route-auth";

const idSchema = z.string().uuid();
const updateSchema = z.object({ name: z.string().trim().min(2).max(120), holder: z.string().trim().max(80).optional(), creditLimit: z.coerce.number().min(0).optional(), includeInAvailable: z.boolean() });

function redirect(result: string) { return relativeRedirect(`/master-data?${result}=1&section=ACCOUNT`); }

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireApiSession();
  if (denied) return denied;
  const { id: rawId } = await params;
  const id = idSchema.safeParse(rawId);
  if (!id.success) return redirect("error");
  const form = await request.formData();
  const [account] = await rows<{ id: string; type: string } & any>("SELECT id,type,owner,isSharedCash FROM `Account` WHERE id=?", [id.data]);
  if (!account || account.isSharedCash) return redirect("error");
  if (form.get("intent") === "delete") {
    const [entries] = await rows<{ count: number } & any>("SELECT COUNT(*) count FROM `FinancialTransaction` WHERE accountId=? OR destinationAccountId=?", [id.data,id.data]);
    if (Number(entries?.count || 0) > 0) return redirect("has_entries");
    await execute("DELETE FROM `Account` WHERE id=?", [id.data]);
    return redirect("deleted");
  }
  const data = updateSchema.safeParse({ name: form.get("name"), holder: form.get("holder") || undefined, creditLimit: form.get("creditLimit") || undefined, includeInAvailable: form.get("includeInAvailable") === "on" });
  if (!data.success) return redirect("error");
  await execute("UPDATE `Account` SET name=?,holder=?,creditLimit=?,includeInAvailable=?,updatedAt=NOW(3) WHERE id=?", [data.data.name, data.data.holder || null, account.type === "CREDIT_CARD" ? data.data.creditLimit ?? null : null, data.data.includeInAvailable, id.data]);
  return redirect("updated");
}
