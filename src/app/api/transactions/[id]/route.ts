import crypto from "node:crypto";
import { z } from "zod";
import { currentOwner, relativeRedirect } from "@/lib/auth";
import { requireApiSession } from "@/lib/route-auth";
import { transaction } from "@/lib/db";
import { validDate } from "@/lib/analytics";
import { moneyCents } from "@/lib/expenses";

const amount=z.coerce.number().positive().max(999999999).refine(value=>Math.abs(value*100-Math.round(value*100))<0.00001);
const optionalId=z.preprocess(value=>value===""?undefined:value,z.string().uuid().optional());
const schema=z.object({amount,transactionDate:z.string().refine(validDate),description:z.string().max(300),revision:z.coerce.number().int().nonnegative(),accountId:optionalId,projectId:optionalId,categoryId:optionalId,taskId:optionalId,expenseKind:z.enum(["HOUSEHOLD","BUSINESS"]).optional()});
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
    const expense=["EXPENSE","ACCRUED_EXPENSE"].includes(entry.type);
    if(expense&&!parsed.data.expenseKind)throw new InputError("expense-kind");
    if(!expense&&parsed.data.expenseKind)throw new InputError("expense-kind");
    const accountId=entry.accountId ? parsed.data.accountId : undefined;
    if(entry.accountId&&!accountId)throw new InputError("account");
    const account=accountId?await find("SELECT id,type,owner FROM Account WHERE id=? AND isActive=1 FOR UPDATE",[accountId]):null;
    if(accountId&&(!account||account.owner!==viewer))throw new InputError("account");
    const categoryId=parsed.data.categoryId||null;
    if(categoryId) {
      const category=await find("SELECT kind FROM Category WHERE id=? AND isActive=1",[categoryId]);
      if(!category||category.kind!==(entry.type==="INCOME"?"INCOME":"EXPENSE"))throw new InputError("category");
    }
    const taskId=parsed.data.taskId||null;
    if(taskId&&!await find("SELECT id FROM Task WHERE id=? AND isActive=1",[taskId]))throw new InputError("task");
    const projectId=parsed.data.projectId||null;
    if(projectId&&!await find("SELECT id FROM Project WHERE id=? AND isActive=1",[projectId]))throw new InputError("project");
    const household=expense&&parsed.data.expenseKind==="HOUSEHOLD";
    const scope=expense?(household?"PERSONAL":"BUSINESS"):entry.scope;
    const taxScope=expense&&!household?"BUSINESS":entry.taxScope;
    if(projectId&&scope!=="BUSINESS")throw new InputError("project");
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
      await connection.execute("UPDATE AccruedExpense SET amount=?,expenseDate=?,description=?,scope=?,projectId=?,taskId=?,categoryId=?,status=?,updatedAt=NOW(3) WHERE id=?",[parsed.data.amount,parsed.data.transactionDate,parsed.data.description,scope,household?null:projectId,taskId,categoryId,status,entry.accrualId]);
    }
    if(entry.accountId) {
      const cashImpact=entry.type === "INCOME" ? parsed.data.amount : -parsed.data.amount;
      const accountAmount=["CREDIT_CARD","LOAN"].includes(account.type) ? -cashImpact : cashImpact;
      await connection.execute("UPDATE AccountEntry SET accountId=?,amount=?,entryDate=? WHERE transactionId=?",[account.id,accountAmount,parsed.data.transactionDate,id]);
    }
    await connection.execute("UPDATE PartyEntry SET amount=SIGN(amount)*? WHERE transactionId=?",[parsed.data.amount,id]);
    await connection.execute("UPDATE FinancialTransaction SET amount=?,transactionDate=?,description=?,accountId=?,categoryId=?,taskId=?,scope=?,taxScope=?,household=?,projectId=?,revision=revision+1,updatedAt=NOW(3) WHERE id=?",[parsed.data.amount,parsed.data.transactionDate,parsed.data.description,accountId||null,categoryId,taskId,scope,taxScope,household,household?null:projectId,id]);
    await connection.execute("INSERT INTO AuditLog (id,transactionId,action,details) VALUES (?,?,?,?)",[crypto.randomUUID(),id,"TRANSACTION_EDITED",JSON.stringify({actor:viewer,before:{amount:entry.amount,date:entry.transactionDate,description:entry.description},after:parsed.data})]);
  }); } catch(error) { if(error instanceof InputError)return fail();throw error; }
  return relativeRedirect("/transactions/new?updated=1#transaction-history");
}
