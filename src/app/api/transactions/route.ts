import crypto from "node:crypto";
import { z } from "zod";
import { RowDataPacket } from "mysql2";
import { relativeRedirect } from "@/lib/auth";
import { requireApiSession } from "@/lib/route-auth";
import { transaction } from "@/lib/db";
import { SCOPES } from "@/lib/types";
import { validDate } from "@/lib/analytics";
import { linesSchema, moneyCents, normalizeItem } from "@/lib/expenses";

const schema = z.object({
  type: z.enum(["INCOME","EXPENSE","TRANSFER","ACCRUED_EXPENSE","DEBT_PAYMENT"]),
  amount: z.coerce.number().positive().max(999999999).optional(), transactionDate: z.string().refine(validDate),
  scope: z.enum(SCOPES), taxScope: z.enum(SCOPES).optional(), owner: z.enum(["ME","WIFE"]).default("ME"),
  description: z.string().max(300).optional(), counterparty: z.string().max(140).optional(),
  accountId: z.string().optional(), destinationAccountId: z.string().optional(), projectId: z.string().optional(),
  taskId: z.string().optional(), categoryId: z.string().optional(), dueDate: z.string().refine(validDate).optional(),
});
class InputError extends Error {}
export async function POST(request: Request) {
  const denied = await requireApiSession(); if (denied) return denied;
  const form = await request.formData();
  const parsed = schema.safeParse(Object.fromEntries([...form].map(([k,v]) => [k,String(v)||undefined])));
  let rawLines: unknown;
  try { rawLines = JSON.parse(String(form.get("lines") || "[]")); } catch { return relativeRedirect("/transactions/new?error=invalid"); }
  const parsedLines = linesSchema.safeParse(rawLines);
  if (!parsed.success || !parsedLines.success) return relativeRedirect("/transactions/new?error=invalid");
  const d = parsed.data, lines = parsedLines.data;
  const expense = ["EXPENSE","ACCRUED_EXPENSE"].includes(d.type);
  if (lines.length && !expense) return relativeRedirect("/transactions/new?error=invalid");
  const amount = lines.length ? lines.reduce((sum,line) => sum + moneyCents(line.amount),0)/100 : d.amount;
  if (!amount || amount > 999999999 || Math.abs(amount*100-Math.round(amount*100))>0.00001) return relativeRedirect("/transactions/new?error=invalid");
  if (d.scope === "BUSINESS" && !d.projectId) return relativeRedirect("/transactions/new?error=project");
  const moving = ["TRANSFER","DEBT_PAYMENT"].includes(d.type);
  if (moving && (!d.accountId || !d.destinationAccountId || d.accountId === d.destinationAccountId)) return relativeRedirect("/transactions/new?error=accounts");
  if (!moving && d.destinationAccountId) return relativeRedirect("/transactions/new?error=accounts");
  try {
    await transaction(async c => {
      const find = async (sql: string, values: unknown[]) => (await c.execute<RowDataPacket[]>(sql, values))[0][0];
      const account = d.accountId ? await find("SELECT id,type,owner FROM Account WHERE id=? AND isActive=1 FOR UPDATE",[d.accountId]) : null;
      const dest = d.destinationAccountId ? await find("SELECT id,type,owner FROM Account WHERE id=? AND isActive=1 FOR UPDATE",[d.destinationAccountId]) : null;
      if ((d.type !== "ACCRUED_EXPENSE" && !account) || (d.destinationAccountId && !dest)) throw new InputError("account");
      const owner = account?.owner ?? d.owner;
      if (owner === "WIFE" && (!expense || d.scope !== "PERSONAL")) throw new InputError("wife");
      if (dest?.owner === "WIFE" || (moving && owner === "WIFE")) throw new InputError("wife");
      if (d.type === "DEBT_PAYMENT" && !["CREDIT_CARD","LOAN"].includes(dest?.type)) throw new InputError("accounts");
      const categoryIds = [...new Set(lines.length ? lines.map(l=>l.categoryId) : d.categoryId ? [d.categoryId] : [])];
      for (const categoryId of categoryIds) {
        const category = await find("SELECT kind FROM Category WHERE id=? AND isActive=1",[categoryId]);
        if (!category || category.kind !== (d.type === "INCOME" ? "INCOME" : "EXPENSE")) throw new InputError("category");
      }
      if (d.projectId && !await find("SELECT id FROM Project WHERE id=? AND isActive=1",[d.projectId])) throw new InputError("project");
      if (d.taskId && !await find("SELECT id FROM Task WHERE id=? AND isActive=1",[d.taskId])) throw new InputError("invalid");
      const id = crypto.randomUUID(), household = expense && form.get("household") === "on";
      let accrualId: string | null = null;
      const categoryId = categoryIds.length === 1 ? categoryIds[0] : null;
      if (d.type === "ACCRUED_EXPENSE") {
        accrualId = crypto.randomUUID();
        await c.execute("INSERT INTO AccruedExpense (id,amount,expenseDate,dueDate,description,scope,owner,projectId,taskId,categoryId,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,NOW(3))",[accrualId,amount,d.transactionDate,d.dueDate||null,d.description||null,d.scope,owner,d.projectId||null,d.taskId||null,categoryId]);
      }
      await c.execute("INSERT INTO FinancialTransaction (id,type,status,amount,transactionDate,description,counterparty,scope,taxScope,owner,household,accountId,destinationAccountId,projectId,taskId,categoryId,accrualId,updatedAt) VALUES (?,?,'POSTED',?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW(3))",[id,d.type,amount,d.transactionDate,d.description||null,d.counterparty||null,d.scope,d.taxScope??d.scope,owner,household,d.accountId||null,d.destinationAccountId||null,d.projectId||null,d.taskId||null,categoryId,accrualId]);
      for (const line of lines) {
        // The unique key also prevents duplicate items when two expenses are saved concurrently.
        await c.execute("INSERT INTO Item (id,name,normalizedName,categoryId,defaultUnit) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE id=id",[crypto.randomUUID(),line.name.trim().replace(/\s+/g," "),normalizeItem(line.name),line.categoryId,line.unit||null]);
        const item = await find("SELECT id,isActive FROM Item WHERE categoryId=? AND normalizedName=?",[line.categoryId,normalizeItem(line.name)]);
        if (!item?.isActive) throw new InputError("item");
        await c.execute("INSERT INTO ExpenseLine (id,transactionId,itemId,categoryId,quantity,unit,amount) VALUES (?,?,?,?,?,?,?)",[crypto.randomUUID(),id,item.id,line.categoryId,line.quantity??null,line.unit||null,line.amount]);
      }
      // Wife accounts are spending logs, not cash-balance accounts. Unpaid bills have no ledger impact.
      if (account && owner === "ME" && d.type !== "ACCRUED_EXPENSE") {
        const debt = ["CREDIT_CARD","LOAN"].includes(account.type);
        const impact = d.type === "INCOME" ? amount : d.type === "EXPENSE" && debt ? amount : -amount;
        await c.execute("INSERT INTO AccountEntry (id,accountId,transactionId,amount,entryDate) VALUES (?,?,?,?,?)",[crypto.randomUUID(),account.id,id,impact,d.transactionDate]);
        if (dest) await c.execute("INSERT INTO AccountEntry (id,accountId,transactionId,amount,entryDate) VALUES (?,?,?,?,?)",[crypto.randomUUID(),dest.id,id,d.type === "DEBT_PAYMENT" ? -amount : amount,d.transactionDate]);
      }
      await c.execute("INSERT INTO AuditLog (id,transactionId,action,details) VALUES (?,?,?,?)",[crypto.randomUUID(),id,"TRANSACTION_POSTED",JSON.stringify({owner,household,lines:lines.length})]);
    });
  } catch (error) { if (error instanceof InputError) return relativeRedirect("/transactions/new?error="+error.message); throw error; }
  return relativeRedirect(form.get("returnTo") === "household" ? "/household?created=1" : "/?created=1");
}
