import { validMonth } from "@/lib/household";
import crypto from "node:crypto";
import { z } from "zod";
import { householdRows as rows, execute, transaction } from "@/lib/db";
import { requireApiSession } from "@/lib/route-auth";
import { relativeRedirect } from "@/lib/auth";

export async function POST(request:Request) {
  const denied=await requireApiSession();if(denied)return denied;
  const form=await request.formData(),month=String(form.get("month")||"");
  if(!validMonth(month))return relativeRedirect("/household?error=1");
  const back=`/household?month=${month}`;
  if(form.get("intent")==="label") {
    const id=z.string().uuid().safeParse(form.get("id"));if(!id.success)return relativeRedirect(back+"&error=1");
    const household=form.get("household")==="on";
    const changed=await transaction(async c=>{
      const [found]=await c.execute<any[]>("SELECT household FROM FinancialTransaction WHERE id=? AND status='POSTED' AND type IN ('EXPENSE','ACCRUED_EXPENSE') FOR UPDATE",[id.data]);
      if(!found[0])return false;
      await c.execute("UPDATE FinancialTransaction SET household=?,updatedAt=NOW(3) WHERE id=?",[household,id.data]);
      await c.execute("INSERT INTO AuditLog (id,transactionId,action,details) VALUES (?,?,?,?)",[crypto.randomUUID(),id.data,"HOUSEHOLD_LABEL_CHANGED",JSON.stringify({before:Boolean(found[0].household),after:household})]);return true;
    }, "household");
    return relativeRedirect(back+(changed?"&saved=1":"&error=1")+"#classify");
  }
  if(form.get("intent")!=="budget")return relativeRedirect(back+"&error=1");
  const amount=z.coerce.number().min(0).max(999999999).safeParse(form.get("amount")),categoryKey=String(form.get("categoryKey")||"");
  if(!amount.success || !String(form.get("amount")??"").trim() || Math.abs(amount.data*100-Math.round(amount.data*100))>0.00001)return relativeRedirect(back+"&error=1");
  if(categoryKey&&!(await rows<any>("SELECT id FROM Category WHERE id=? AND kind='EXPENSE'",[categoryKey])).length)return relativeRedirect(back+"&error=1");
  await execute("INSERT INTO HouseholdBudget (month,categoryKey,amount) VALUES (?,?,?) ON DUPLICATE KEY UPDATE amount=VALUES(amount)",[month,categoryKey,amount.data]);
  return relativeRedirect(back+"&saved=1#budgets");
}
