import crypto from "node:crypto";
import { z } from "zod";
import { requireApiSession } from "@/lib/route-auth";
import { relativeRedirect } from "@/lib/auth";
import { transaction } from "@/lib/db";
import { validDate } from "@/lib/analytics";
import { moneyCents } from "@/lib/expenses";
const schema=z.object({submissionId:z.string().uuid(),transactionId:z.string().uuid(),accountId:z.string().min(1).max(191),amount:z.coerce.number().positive().max(999999999).refine(n=>Math.abs(n*100-Math.round(n*100))<0.00001),transactionDate:z.string().refine(validDate),description:z.string().max(300)});
class InputError extends Error {}
export async function POST(request:Request){
  const denied=await requireApiSession();if(denied)return denied;
  const f=await request.formData(),parsed=schema.safeParse({submissionId:f.get("submissionId"),transactionId:f.get("transactionId"),accountId:f.get("accountId"),amount:f.get("amount"),transactionDate:f.get("transactionDate"),description:f.get("description")||""});
  const fromBills=f.get("returnTo")==="bills";
  if(!parsed.success)return relativeRedirect(fromBills?"/bills?error=1":"/master-data/parties?error=1");
  const d=parsed.data;let partyId="",owner="ME";
  try{await transaction(async c=>{
    // Lock the original invoice before reading its outstanding amount: concurrent payments serialize.
    const [invoices]=await c.execute<any[]>("SELECT * FROM FinancialTransaction WHERE id=? AND status='POSTED' AND (type='ACCRUED_EXPENSE' OR (type='INCOME' AND paymentTiming='CREDIT')) FOR UPDATE",[d.transactionId]);
    const invoice=invoices[0];if(!invoice || (invoice.type!=="ACCRUED_EXPENSE"&&!invoice.partyId))throw new InputError("invoice");partyId=invoice.partyId||"";owner=invoice.owner;
    const [existing]=await c.execute<any[]>("SELECT settlesTransactionId FROM FinancialTransaction WHERE id=?",[d.submissionId]);
    if(existing.length){if(existing[0].settlesTransactionId!==invoice.id)throw new InputError("duplicate");return;}
    let outstanding:number;
    if(invoice.type==="ACCRUED_EXPENSE"){
      const [bills]=await c.execute<any[]>("SELECT amount,paidAmount,status FROM AccruedExpense WHERE id=? FOR UPDATE",[invoice.accrualId]);
      const bill=bills[0];if(!bill||!["OPEN","PARTIALLY_PAID"].includes(bill.status))throw new InputError("bill");
      outstanding=-(moneyCents(bill.amount)-moneyCents(bill.paidAmount));
      if(outstanding>=0)throw new InputError("amount");
    }else{
      const [balances]=await c.execute<any[]>("SELECT COALESCE(SUM(amount),0) balance FROM PartyEntry WHERE transactionId=? OR settlesTransactionId=?",[invoice.id,invoice.id]);
      outstanding=moneyCents(balances[0].balance);
      if(outstanding<=0)throw new InputError("amount");
    }
    const cents=moneyCents(d.amount);
    if(!outstanding||cents>Math.abs(outstanding)||d.transactionDate<String(invoice.transactionDate).slice(0,10))throw new InputError("amount");
    const [accounts]=await c.execute<any[]>("SELECT id,type,owner FROM Account WHERE id=? AND isActive=1 FOR UPDATE",[d.accountId]);
    const account=accounts[0];if(!account||account.owner!==invoice.owner||!(invoice.type==="ACCRUED_EXPENSE"?["CASH","BANK","SAVINGS","CREDIT_CARD"]:["CASH","BANK","SAVINGS"]).includes(account.type))throw new InputError("account");
    const id=d.submissionId,cashImpact=outstanding>0?d.amount:-d.amount;
    await c.execute("INSERT INTO FinancialTransaction (id,type,status,amount,transactionDate,description,counterparty,scope,taxScope,owner,household,accountId,projectId,taskId,partyId,updatedAt) VALUES (?,'PARTY_PAYMENT','POSTED',?,?,?,?,?,?,?,?,?,?,?,?,NOW(3))",[id,d.amount,d.transactionDate,d.description||`Settlement: ${invoice.description||invoice.id}`,invoice.counterparty,invoice.scope,invoice.taxScope,invoice.owner,invoice.household,d.accountId,invoice.projectId,invoice.taskId,partyId||null]);
    await c.execute("UPDATE FinancialTransaction SET settlesTransactionId=? WHERE id=?",[invoice.id,id]);
    if(partyId)await c.execute("INSERT INTO PartyEntry (id,partyId,transactionId,settlesTransactionId,amount) VALUES (?,?,?,?,?)",[crypto.randomUUID(),partyId,id,invoice.id,-cashImpact]);
    if(invoice.owner==="ME")await c.execute("INSERT INTO AccountEntry (id,accountId,transactionId,amount,entryDate) VALUES (?,?,?,?,?)",[crypto.randomUUID(),d.accountId,id,account.type==="CREDIT_CARD"?-cashImpact:cashImpact,d.transactionDate]);
    if(invoice.accrualId)await c.execute("UPDATE AccruedExpense SET paidAmount=paidAmount+?,status=?,updatedAt=NOW(3) WHERE id=?",[d.amount,cents===Math.abs(outstanding)?"PAID":"PARTIALLY_PAID",invoice.accrualId]);
    await c.execute("INSERT INTO AuditLog (id,transactionId,action,details) VALUES (?,?,'PARTY_SETTLEMENT',?)",[crypto.randomUUID(),id,JSON.stringify({invoiceId:invoice.id,amount:d.amount})]);
  });}catch(error){if(error instanceof InputError)return relativeRedirect(fromBills||!partyId?`/bills?bill=${d.transactionId}&error=1`:partyId?`/parties/${partyId}?owner=${owner}&error=1`:"/master-data/parties?error=1");throw error}
  return relativeRedirect(fromBills||!partyId?`/bills?bill=${d.transactionId}&saved=1`:`/parties/${partyId}?owner=${owner}&saved=1`);
}
