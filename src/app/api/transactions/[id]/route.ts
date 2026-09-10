import crypto from "node:crypto";
import { z } from "zod";
import { currentOwner, relativeRedirect } from "@/lib/auth";
import { requireApiSession } from "@/lib/route-auth";
import { transaction } from "@/lib/db";
import { validDate } from "@/lib/analytics";
import { moneyCents } from "@/lib/expenses";

const amount=z.coerce.number().positive().max(999999999).refine(value=>Math.abs(value*100-Math.round(value*100))<0.00001);
const schema=z.object({amount,transactionDate:z.string().refine(validDate),description:z.string().max(300),revision:z.coerce.number().int().nonnegative()});
class InputError extends Error {}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
  const denied=await requireApiSession();if(denied)return denied;
  const viewer=await currentOwner(),{id}=await params;
  const fail=()=>relativeRedirect(`/transactions/${id}?error=1`);
  if(!z.string().uuid().safeParse(id).success)return relativeRedirect("/transactions/new");
  const form=await request.formData(),parsed=schema.safeParse(Object.fromEntries(form));
  if(!parsed.success)return fail();
  try { await transaction(async connection=>{
    const find=async(sql:string,values:unknown[]) => (await connection.execute<any[]>(sql,values))[0][0];
    const entry=await find("SELECT * FROM FinancialTransaction WHERE id=? AND status='POSTED' FOR UPDATE",[id]);
    if(!entry||entry.owner!==viewer||entry.revision!==parsed.data.revision||entry.settlesTransactionId)throw new InputError("stale");
    const lines=(await connection.execute<any[]>("SELECT id FROM ExpenseLine WHERE transactionId=? ORDER BY id FOR UPDATE",[id]))[0];
    let lineTotal=0;
    for(const line of lines) {
      const next=amount.safeParse(form.get(`line:${line.id}`));
      if(!next.success)throw new InputError("line");
      lineTotal+=moneyCents(next.data);
      await connection.execute("UPDATE ExpenseLine SET amount=? WHERE id=? AND transactionId=?",[next.data,line.id,id]);
    }
    if(lines.length&&lineTotal!==moneyCents(parsed.data.amount))throw new InputError("total");
    if(entry.accrualId) {
      const bill=await find("SELECT * FROM AccruedExpense WHERE id=? FOR UPDATE",[entry.accrualId]);
      const payment=await find("SELECT MIN(transactionDate) firstDate FROM FinancialTransaction WHERE settlesTransactionId=? AND status='POSTED'",[id]);
      if(!bill||moneyCents(parsed.data.amount)<moneyCents(bill.paidAmount)||(payment?.firstDate&&parsed.data.transactionDate>String(payment.firstDate).slice(0,10)))throw new InputError("bill");
      const status=moneyCents(bill.paidAmount)===moneyCents(parsed.data.amount)?"PAID":Number(bill.paidAmount)>0?"PARTIALLY_PAID":"OPEN";
      await connection.execute("UPDATE AccruedExpense SET amount=?,expenseDate=?,description=?,status=?,updatedAt=NOW(3) WHERE id=?",[parsed.data.amount,parsed.data.transactionDate,parsed.data.description,status,entry.accrualId]);
    }
    await connection.execute("UPDATE AccountEntry SET amount=SIGN(amount)*?,entryDate=? WHERE transactionId=?",[parsed.data.amount,parsed.data.transactionDate,id]);
    await connection.execute("UPDATE PartyEntry SET amount=SIGN(amount)*? WHERE transactionId=?",[parsed.data.amount,id]);
    await connection.execute("UPDATE FinancialTransaction SET amount=?,transactionDate=?,description=?,revision=revision+1,updatedAt=NOW(3) WHERE id=?",[parsed.data.amount,parsed.data.transactionDate,parsed.data.description,id]);
    await connection.execute("INSERT INTO AuditLog (id,transactionId,action,details) VALUES (?,?,?,?)",[crypto.randomUUID(),id,"TRANSACTION_EDITED",JSON.stringify({actor:viewer,before:{amount:entry.amount,date:entry.transactionDate,description:entry.description},after:parsed.data})]);
  }); } catch(error) { if(error instanceof InputError)return fail();throw error; }
  return relativeRedirect("/transactions/new?updated=1#transaction-history");
}
