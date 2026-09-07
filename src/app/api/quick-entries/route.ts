import crypto from "node:crypto";
import { z } from "zod";
import { requireApiSession } from "@/lib/route-auth";
import { relativeRedirect } from "@/lib/auth";
import { transaction } from "@/lib/db";
const schema = z.object({type:z.enum(["EXPENSE","INCOME"]),amount:z.coerce.number().positive().max(999999999).refine(n=>Math.abs(n*100-Math.round(n*100))<0.00001),description:z.string().trim().min(1).max(300)});
export async function POST(request:Request) {
  const denied=await requireApiSession(); if(denied)return denied;
  const parsed=schema.safeParse(Object.fromEntries(await request.formData()));
  if(!parsed.success)return relativeRedirect("/?captureError=1");
  const d=parsed.data,id=crypto.randomUUID();
  const date=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Colombo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  await transaction(async c=>{
    await c.execute("INSERT INTO FinancialTransaction (id,type,status,amount,transactionDate,description,scope,owner,updatedAt) VALUES (?,?,'PENDING_REVIEW',?,?,?,'PERSONAL','ME',NOW(3))",[id,d.type,d.amount,date,d.description]);
    await c.execute("INSERT INTO AuditLog (id,transactionId,action) VALUES (?,?,'QUICK_ENTRY_CAPTURED')",[crypto.randomUUID(),id]);
  });
  return relativeRedirect("/?captured=1");
}
