import crypto from "node:crypto";
import { RowDataPacket } from "mysql2";
import { z } from "zod";
import { relativeRedirect } from "@/lib/auth";
import { requireApiSession } from "@/lib/route-auth";
import { transaction } from "@/lib/db";
import { SCOPES } from "@/lib/types";
import { validDate } from "@/lib/analytics";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireApiSession();
  if (denied) return denied;
  const { id } = await params;
  const form = await request.formData();
  const parsed = z.enum(SCOPES).safeParse(form.get("taxScope"));
  const query = new URLSearchParams();
  for (const key of ["start", "end"]) {
    const value = String(form.get(key) ?? "");
    if (validDate(value)) query.set(key, value);
  }
  const reportScope = z.enum(SCOPES).safeParse(form.get("reportScope"));
  if (reportScope.success) query.set("taxScope", reportScope.data);
  if (!parsed.success) { query.set("error", "invalid"); return relativeRedirect(`/reports/tax?${query}`); }
  const saved = await transaction(async connection => {
    const [items] = await connection.execute<RowDataPacket[]>("SELECT scope,taxScope FROM FinancialTransaction WHERE id=? AND status='POSTED' AND type IN ('INCOME','EXPENSE','ACCRUED_EXPENSE') FOR UPDATE", [id]);
    const item = items[0];
    if (!item) return false;
    const before = item.taxScope ?? item.scope;
    if (before === parsed.data) return true;
    await connection.execute("UPDATE FinancialTransaction SET taxScope=?,updatedAt=NOW(3) WHERE id=?", [parsed.data, id]);
    await connection.execute("INSERT INTO AuditLog (id,transactionId,action,details) VALUES (?,?,?,?)", [crypto.randomUUID(), id, "TAX_LABEL_CHANGED", JSON.stringify({ before, after: parsed.data, actualScope: item.scope })]);
    return true;
  });
  query.set(saved ? "saved" : "error", saved ? "1" : "missing");
  return relativeRedirect(`/reports/tax?${query}#tax-labels`);
}
