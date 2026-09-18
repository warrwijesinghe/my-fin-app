import crypto from "node:crypto";
import { z } from "zod";
import { currentOwner, relativeRedirect } from "@/lib/auth";
import { requireApiSession } from "@/lib/route-auth";
import { sharedRows, transaction } from "@/lib/db";
import { moneyCents } from "@/lib/expenses";

class DeleteError extends Error {}
export async function POST(request: Request, {params}: {params: Promise<{id: string}>}) {
  const denied = await requireApiSession();
  if (denied) return denied;
  const actor = await currentOwner(), {id} = await params;
  if (!z.string().uuid().safeParse(id).success) return relativeRedirect("/transactions/new");
  const fail = () => relativeRedirect(`/transactions/${id}/delete?error=1`);
  const form = await request.formData();
  const revision = z.coerce.number().int().nonnegative().safeParse(form.get("revision"));
  if (form.get("confirm") !== "delete" || form.get("revision") === null || !revision.success) return fail();
  const [candidate] = await sharedRows<any>("SELECT id,settlesTransactionId FROM FinancialTransaction WHERE id=? AND status='POSTED'", [id]);
  if (!candidate) return fail();
  try {
    await transaction(async c => {
      const find = async (sql: string, values: unknown[]) => (await c.execute<any[]>(sql, values))[0][0];
      // Match settlement creation's invoice-first lock order.
      const invoice = candidate.settlesTransactionId ? await find("SELECT * FROM FinancialTransaction WHERE id=? AND status='POSTED' FOR UPDATE", [candidate.settlesTransactionId]) : null;
      const entry = await find("SELECT * FROM FinancialTransaction WHERE id=? AND status='POSTED' FOR UPDATE", [id]);
      if (!entry || entry.revision !== revision.data || entry.settlesTransactionId !== candidate.settlesTransactionId) throw new DeleteError();
      if (entry.settlesTransactionId && !invoice) throw new DeleteError();
      if (invoice?.accrualId) {
        const bill = await find("SELECT * FROM AccruedExpense WHERE id=? FOR UPDATE", [invoice.accrualId]);
        if (!bill) throw new DeleteError();
        const paid = moneyCents(bill.paidAmount) - moneyCents(entry.amount);
        if (paid < 0 || paid > moneyCents(bill.amount)) throw new DeleteError();
        await c.execute("UPDATE AccruedExpense SET paidAmount=?,status=?,updatedAt=NOW(3) WHERE id=?", [paid/100, paid===0 ? "OPEN" : paid===moneyCents(bill.amount) ? "PAID" : "PARTIALLY_PAID", invoice.accrualId]);
      }
      const [payments] = await c.execute<any[]>("SELECT * FROM FinancialTransaction WHERE settlesTransactionId=? AND status='POSTED' ORDER BY id FOR UPDATE", [id]);
      for (const target of [...payments, entry]) {
        await c.execute("DELETE FROM AccountEntry WHERE transactionId=?", [target.id]);
        await c.execute("DELETE FROM PartyEntry WHERE transactionId=?", [target.id]);
        await c.execute("UPDATE FinancialTransaction SET status='VOID',revision=revision+1,updatedAt=NOW(3) WHERE id=?", [target.id]);
        await c.execute("INSERT INTO AuditLog (id,transactionId,action,details) VALUES (?,?,?,?)", [crypto.randomUUID(), target.id, "TRANSACTION_DELETED", JSON.stringify({actor, deletedWith: id, before: {amount: target.amount, date: target.transactionDate, description: target.description}})]);
      }
      if (entry.accrualId) await c.execute("UPDATE AccruedExpense SET status='VOID',paidAmount=0,updatedAt=NOW(3) WHERE id=?", [entry.accrualId]);
    }, "shared");
  } catch (error) {
    if (error instanceof DeleteError) return fail();
    throw error;
  }
  return relativeRedirect("/transactions/new?deleted=1#transaction-history");
}
