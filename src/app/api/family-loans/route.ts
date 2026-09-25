import crypto from "node:crypto";
import { z } from "zod";
import { currentOwner, relativeRedirect } from "@/lib/auth";
import { requireApiSession } from "@/lib/route-auth";
import { transaction } from "@/lib/db";
import { validDate } from "@/lib/analytics";

const schema=z.object({accountId:z.string().min(1).max(191),destinationAccountId:z.string().min(1).max(191),amount:z.coerce.number().positive().max(999999999).refine(n=>Math.round(n*100)===n*100),transactionDate:z.string().refine(validDate),description:z.string().max(300).optional()});
class InputError extends Error {}
export async function POST(request:Request) {
  const denied=await requireApiSession(); if(denied)return denied; const lender=await currentOwner();
  const parsed=schema.safeParse(Object.fromEntries((await request.formData()).entries())); if(!parsed.success)return relativeRedirect("/family-loans?error=1"); const d=parsed.data;
  try { await transaction(async c=>{
    const find=async(sql:string,v:unknown[]) => (await c.execute<any[]>(sql,v))[0][0];
    const source=await find("SELECT id,owner,type FROM Account WHERE id=? AND isActive=1 FOR UPDATE",[d.accountId]);
    const destination=await find("SELECT id,owner,type FROM Account WHERE id=? AND isActive=1 FOR UPDATE",[d.destinationAccountId]);
    if(!source||!destination||source.owner!==lender||destination.owner===lender||!["CASH","BANK","SAVINGS"].includes(source.type)||!["CASH","BANK","SAVINGS"].includes(destination.type))throw new InputError();
    const loanId=crypto.randomUUID(), transactionId=crypto.randomUUID();
    await c.execute("INSERT INTO FamilyLoan (id,lender,borrower,amount,loanDate,description,updatedAt) VALUES (?,?,?,?,?,?,NOW(3))",[loanId,lender,destination.owner,d.amount,d.transactionDate,d.description||null]);
    await c.execute("INSERT INTO FinancialTransaction (id,type,status,amount,transactionDate,description,scope,owner,accountId,destinationAccountId,familyLoanId,updatedAt) VALUES (?,'FAMILY_LOAN_ADVANCE','POSTED',?,?,?,'PERSONAL',?,?,?,?,NOW(3))",[transactionId,d.amount,d.transactionDate,d.description||null,lender,d.accountId,d.destinationAccountId,loanId]);
    await c.execute("INSERT INTO AccountEntry (id,accountId,transactionId,amount,entryDate) VALUES (?,?,?,?,?),(?,?,?,?,?)",[crypto.randomUUID(),d.accountId,transactionId,-d.amount,d.transactionDate,crypto.randomUUID(),d.destinationAccountId,transactionId,d.amount,d.transactionDate]);
  },"family"); } catch(error) { if(error instanceof InputError)return relativeRedirect("/family-loans?error=1");throw error; }
  return relativeRedirect("/family-loans?advanced=1");
}
