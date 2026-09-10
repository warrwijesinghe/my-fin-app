import crypto from "node:crypto";
import { z } from "zod";
import { currentOwner, relativeRedirect } from "@/lib/auth";
import { requireApiSession } from "@/lib/route-auth";
import { sharedRows, transaction } from "@/lib/db";
import { validDate } from "@/lib/analytics";
import { moneyCents } from "@/lib/expenses";

const amountSchema=z.coerce.number().positive().max(999999999).refine(n=>Math.abs(n*100-Math.round(n*100))<0.00001);
const schema=z.object({amount:amountSchema,transactionDate:z.string().refine(validDate),description:z.string().max(300),spentBy:z.enum(["ME","WIFE"])});
class InputError extends Error {}
const sharedCondition="(household=1 OR accountId IN (SELECT id FROM Account WHERE isSharedCash=1) OR destinationAccountId IN (SELECT id FROM Account WHERE isSharedCash=1))";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
  const denied=await requireApiSession();if(denied)return denied;
  const actor=await currentOwner(),{id}=await params,form=await request.formData();
  if(!z.string().uuid().safeParse(id).success)return relativeRedirect("/shared-cash");
  const fail=()=>relativeRedirect(`/shared-transactions/${id}?error=1`);
  const deleting=form.get("intent")==="delete";
  if(!deleting&&form.get("intent")!=="update")return fail();
  const revision=z.coerce.number().int().nonnegative().safeParse(form.get("revision"));
  const parsed=schema.safeParse(Object.fromEntries(form));
  if(!revision.success||(!deleting&&!parsed.success))return fail();
  // Discover only a visible shared record, then lock its invoice before the payment.
  const [candidate]=await sharedRows<any>(`SELECT id,settlesTransactionId FROM FinancialTransaction WHERE id=? AND status='POSTED' AND ${sharedCondition}`,[id]);
  if(!candidate)return fail();
  let household=false;
  try { await transaction(async c=>{
    const find=async(sql:string,values:unknown[]) => (await c.execute<any[]>(sql,values))[0][0];
    const invoice=candidate.settlesTransactionId?await find("SELECT * FROM FinancialTransaction WHERE id=? AND status='POSTED' FOR UPDATE",[candidate.settlesTransactionId]):null;
    const entry=await find(`SELECT * FROM FinancialTransaction WHERE id=? AND status='POSTED' AND ${sharedCondition} FOR UPDATE`,[id]);
    if(!entry||entry.revision!==revision.data||entry.settlesTransactionId!==candidate.settlesTransactionId)throw new InputError("stale");
    household=Boolean(entry.household);
    if(entry.settlesTransactionId&&!invoice)throw new InputError("invoice");
    const d=parsed.success?parsed.data:null;
    const nextAmount=deleting?0:d!.amount;
    if(invoice) {
      if(!deleting&&d!.transactionDate<String(invoice.transactionDate).slice(0,10))throw new InputError("date");
      if(invoice.accrualId) {
        const bill=await find("SELECT * FROM AccruedExpense WHERE id=? FOR UPDATE",[invoice.accrualId]);
        if(!bill)throw new InputError("bill");
        const paid=moneyCents(bill.paidAmount)-moneyCents(entry.amount)+moneyCents(nextAmount);
        if(paid<0||paid>moneyCents(bill.amount))throw new InputError("amount");
        await c.execute("UPDATE AccruedExpense SET paidAmount=?,status=?,updatedAt=NOW(3) WHERE id=?",[paid/100,paid===0?"OPEN":paid===moneyCents(bill.amount)?"PAID":"PARTIALLY_PAID",invoice.accrualId]);
      } else {
        const paid=await find("SELECT COALESCE(SUM(amount),0) amount FROM FinancialTransaction WHERE settlesTransactionId=? AND status='POSTED'",[invoice.id]);
        if(moneyCents(paid.amount)-moneyCents(entry.amount)+moneyCents(nextAmount)>moneyCents(invoice.amount))throw new InputError("amount");
      }
    }
    if(deleting) {
      // A shared bill and its payments are one authorized financial operation.
      if(entry.accrualId) {
        await c.execute("DELETE FROM AccountEntry WHERE transactionId IN (SELECT id FROM FinancialTransaction WHERE settlesTransactionId=?)",[id]);
        await c.execute("DELETE FROM PartyEntry WHERE settlesTransactionId=?",[id]);
        await c.execute("UPDATE FinancialTransaction SET status='VOID',revision=revision+1,updatedAt=NOW(3) WHERE settlesTransactionId=?",[id]);
        await c.execute("UPDATE AccruedExpense SET status='VOID',paidAmount=0,updatedAt=NOW(3) WHERE id=?",[entry.accrualId]);
      }
      await c.execute("DELETE FROM AccountEntry WHERE transactionId=?",[id]);
      await c.execute("DELETE FROM PartyEntry WHERE transactionId=?",[id]);
      await c.execute("UPDATE FinancialTransaction SET status='VOID',revision=revision+1,updatedAt=NOW(3) WHERE id=?",[id]);
    } else {
      const [lines]=await c.execute<any[]>("SELECT id FROM ExpenseLine WHERE transactionId=? ORDER BY id",[id]);
      let total=0;
      for(const line of lines) {
        const amount=amountSchema.safeParse(form.get(`line:${line.id}`));
        if(!amount.success)throw new InputError("line");
        total+=moneyCents(amount.data);
        await c.execute("UPDATE ExpenseLine SET amount=? WHERE id=? AND transactionId=?",[amount.data,line.id,id]);
      }
      if(lines.length&&total!==moneyCents(d!.amount))throw new InputError("total");
      if(entry.accrualId) {
        const bill=await find("SELECT * FROM AccruedExpense WHERE id=? FOR UPDATE",[entry.accrualId]);
        const payment=await find("SELECT MIN(transactionDate) firstDate FROM FinancialTransaction WHERE settlesTransactionId=? AND status='POSTED'",[id]);
        if(!bill||moneyCents(d!.amount)<moneyCents(bill.paidAmount)||(payment?.firstDate&&d!.transactionDate>String(payment.firstDate).slice(0,10)))throw new InputError("bill");
        const status=moneyCents(bill.paidAmount)===moneyCents(d!.amount)?"PAID":Number(bill.paidAmount)>0?"PARTIALLY_PAID":"OPEN";
        await c.execute("UPDATE AccruedExpense SET amount=?,expenseDate=?,description=?,status=?,updatedAt=NOW(3) WHERE id=?",[d!.amount,d!.transactionDate,d!.description,status,entry.accrualId]);
      }
      // Preserve ledger directions, including card liabilities and both transfer legs.
      await c.execute("UPDATE AccountEntry SET amount=SIGN(amount)*?,entryDate=? WHERE transactionId=?",[d!.amount,d!.transactionDate,id]);
      await c.execute("UPDATE PartyEntry SET amount=SIGN(amount)*? WHERE transactionId=?",[d!.amount,id]);
      await c.execute("UPDATE FinancialTransaction SET amount=?,transactionDate=?,description=?,spentBy=?,revision=revision+1,updatedAt=NOW(3) WHERE id=?",[d!.amount,d!.transactionDate,d!.description,d!.spentBy,id]);
    }
    await c.execute("INSERT INTO AuditLog (id,transactionId,action,details) VALUES (?,?,?,?)",[crypto.randomUUID(),id,deleting?"SHARED_TRANSACTION_DELETED":"SHARED_TRANSACTION_EDITED",JSON.stringify({actor,before:{amount:entry.amount,date:entry.transactionDate,description:entry.description,spentBy:entry.spentBy},after:deleting?null:d})]);
  },"shared"); } catch(error) { if(error instanceof InputError)return fail();throw error; }
  return relativeRedirect(`${household?"/household":"/shared-cash"}?${deleting?"deleted":"saved"}=1`);
}
