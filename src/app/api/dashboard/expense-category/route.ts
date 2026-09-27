import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { currentOwner } from "@/lib/auth";
import { transaction } from "@/lib/db";
import { normalizeItem } from "@/lib/expenses";
import { requireApiSession } from "@/lib/route-auth";

const bodySchema = z.object({ activityId: z.string().min(1).max(191), categoryId: z.string().uuid().optional(), scope: z.enum(["PERSONAL", "BUSINESS"]).optional(), taxScope: z.enum(["PERSONAL", "BUSINESS"]).optional() }).refine(value => Boolean(value.categoryId || value.scope || value.taxScope));

export async function POST(request: Request) {
  const denied = await requireApiSession(); if (denied) return denied;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid category change" }, { status: 400 });
  const viewer = await currentOwner();
  try {
    await transaction(async connection => {
      const one = async (sql: string, values: unknown[]) => (await connection.execute<any[]>(sql, values))[0][0];
      if (parsed.data.categoryId) { const category = await one("SELECT id FROM Category WHERE id=? AND kind='EXPENSE' AND isActive=1", [parsed.data.categoryId]); if (!category) throw new Error("category"); }
      const line = await one("SELECT l.id,l.transactionId,i.name FROM ExpenseLine l JOIN FinancialTransaction t ON t.id=l.transactionId LEFT JOIN Item i ON i.id=l.itemId WHERE l.id=? AND t.status='POSTED' FOR UPDATE", [parsed.data.activityId]);
      if (line && parsed.data.categoryId) {
        const itemName = String(line.name || "Expense item");
        let item = await one("SELECT id FROM Item WHERE categoryId=? AND normalizedName=?", [parsed.data.categoryId, normalizeItem(itemName)]);
        if (!item) { const id = crypto.randomUUID(); await connection.execute("INSERT INTO Item (id,name,normalizedName,categoryId) VALUES (?,?,?,?)", [id, itemName, normalizeItem(itemName), parsed.data.categoryId]); item = { id }; }
        await connection.execute("UPDATE ExpenseLine SET categoryId=?,itemId=? WHERE id=?", [parsed.data.categoryId, item.id, line.id]);
        const categories = (await connection.execute<any[]>("SELECT DISTINCT categoryId FROM ExpenseLine WHERE transactionId=?", [line.transactionId]))[0];
        const transactionCategory = categories.length === 1 ? categories[0].categoryId : null;
        await connection.execute("UPDATE FinancialTransaction SET categoryId=?,revision=revision+1,updatedAt=NOW(3) WHERE id=?", [transactionCategory, line.transactionId]);
        await connection.execute("UPDATE AccruedExpense SET categoryId=?,updatedAt=NOW(3) WHERE id=(SELECT accrualId FROM FinancialTransaction WHERE id=?)", [transactionCategory, line.transactionId]);
      } else if (!line && parsed.data.categoryId) {
        const entry = await one("SELECT id,accrualId FROM FinancialTransaction WHERE id=? AND status='POSTED' FOR UPDATE", [parsed.data.activityId]);
        if (!entry) throw new Error("activity");
        await connection.execute("UPDATE FinancialTransaction SET categoryId=?,revision=revision+1,updatedAt=NOW(3) WHERE id=?", [parsed.data.categoryId, entry.id]);
        if (entry.accrualId) await connection.execute("UPDATE AccruedExpense SET categoryId=?,updatedAt=NOW(3) WHERE id=?", [parsed.data.categoryId, entry.accrualId]);
      }
      if (parsed.data.scope || parsed.data.taxScope) {
        const transactionId = line?.transactionId || parsed.data.activityId;
        const entry = await one("SELECT id,accrualId,type,scope,taxScope FROM FinancialTransaction WHERE id=? AND status='POSTED' FOR UPDATE", [transactionId]);
        if (!entry) throw new Error("activity");
        if (!["EXPENSE", "ACCRUED_EXPENSE"].includes(entry.type)) throw new Error("type");
        const scope = parsed.data.scope ?? entry.scope;
        const taxScope = scope === "BUSINESS" ? "BUSINESS" : (parsed.data.taxScope ?? entry.taxScope ?? "PERSONAL");
        const household = scope === "PERSONAL";
        await connection.execute("UPDATE FinancialTransaction SET scope=?,taxScope=?,household=?,projectId=IF(?='BUSINESS',projectId,NULL),revision=revision+1,updatedAt=NOW(3) WHERE id=?", [scope, taxScope, household, scope, entry.id]);
        if (entry.accrualId) await connection.execute("UPDATE AccruedExpense SET scope=?,projectId=IF(?='BUSINESS',projectId,NULL),updatedAt=NOW(3) WHERE id=?", [scope, scope, entry.accrualId]);
      }
    });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Unable to update category" }, { status: 400 }); }
}
