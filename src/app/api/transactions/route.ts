import crypto from "node:crypto";
import { z } from "zod";
import { RowDataPacket } from "mysql2";
import { currentOwner, relativeRedirect } from "@/lib/auth";
import { requireApiSession } from "@/lib/route-auth";
import { transaction } from "@/lib/db";
import { SCOPES } from "@/lib/types";
import { validDate } from "@/lib/analytics";
import { linesSchema, moneyCents, normalizeItem } from "@/lib/expenses";

const schema = z.object({
  draftId:z.string().uuid().optional(), partyId:z.string().max(191).optional(), paymentTiming:z.enum(["PAID","CREDIT"]).optional(),
  type: z.enum(["INCOME","EXPENSE","TRANSFER","ACCRUED_EXPENSE","DEBT_PAYMENT"]),
  amount: z.coerce.number().positive().max(999999999).optional(), transactionDate: z.string().refine(validDate),
  scope: z.enum(SCOPES), taxScope: z.enum(SCOPES).optional(), owner: z.enum(["ME","WIFE"]).default("ME"),
  description: z.string().max(300).optional(), counterparty: z.string().max(140).optional(),
  accountId: z.string().optional(), destinationAccountId: z.string().optional(), projectId: z.string().optional(),
  taskId: z.string().optional(), categoryId: z.string().optional(), dueDate: z.string().refine(validDate).optional(),
});
class InputError extends Error {}
export async function POST(request: Request) {
  const denied=await requireApiSession(); if(denied)return denied; const viewer=await currentOwner();
  const form = await request.formData();
  const draftId=String(form.get("draftId")||"");
  const saveDraft=form.get("intent")==="saveDraft";
  const back=draftId && z.string().uuid().safeParse(draftId).success ? `/review/${draftId}` : "/transactions/new";
  const fail=(code:string)=>relativeRedirect(`${back}?error=${code}`);
  if(saveDraft&&!draftId)return fail("invalid");
  const parsed = schema.safeParse(Object.fromEntries([...form].map(([k,v]) => [k,String(v)||undefined])));
  let rawLines: unknown;
  try { rawLines = JSON.parse(String(form.get("lines") || "[]")); } catch { return fail("invalid"); }
  const parsedLines = linesSchema.safeParse(rawLines);
  if (!parsed.success || !parsedLines.success) return fail("invalid");
  const d = parsed.data, lines = parsedLines.data;
  d.owner=viewer;
  const spentBy=z.enum(["ME","WIFE"]).safeParse(form.get("spentBy")||viewer);
  if(!spentBy.success)return fail("invalid");
  const expense = ["EXPENSE","ACCRUED_EXPENSE"].includes(d.type);
  const household = expense && form.get("household") === "on";
  if (household) {
    d.scope="PERSONAL";
    d.taxScope="PERSONAL";
    d.projectId=undefined;
  }
  if (lines.length && !expense) return fail("invalid");
  let amount = lines.length ? lines.reduce((sum,line) => sum + moneyCents(line.amount),0)/100 : d.amount;
  if ((!amount && !draftId) || (amount ?? 0) > 999999999 || Math.abs((amount ?? 0)*100-Math.round((amount ?? 0)*100))>0.00001) return fail("invalid");
  const credit=d.paymentTiming==="CREDIT" || d.type==="ACCRUED_EXPENSE";
  if(credit && !["INCOME","EXPENSE","ACCRUED_EXPENSE"].includes(d.type))return fail("invalid");
  if(credit && !saveDraft && d.type==="EXPENSE") d.type="ACCRUED_EXPENSE";
  const moving = ["TRANSFER","DEBT_PAYMENT"].includes(d.type);
  if (moving && (!d.accountId || !d.destinationAccountId || d.accountId === d.destinationAccountId)) return fail("accounts");
  if (!moving && d.destinationAccountId) return fail("accounts");
  try {
    await transaction(async c => {
      const find = async (sql: string, values: unknown[]) => (await c.execute<RowDataPacket[]>(sql, values))[0][0];
      const draft=d.draftId ? await find("SELECT * FROM FinancialTransaction WHERE id=? AND status='PENDING_REVIEW' FOR UPDATE",[d.draftId]) : null;
      if(d.draftId){
        if(!draft || draft.owner!==viewer || (draft.type!==d.type && !(["EXPENSE","ACCRUED_EXPENSE"].includes(draft.type)&&["EXPENSE","ACCRUED_EXPENSE"].includes(d.type))))throw new InputError("already-posted");
        const total=lines.reduce((sum,line)=>sum+moneyCents(line.amount),0);
        if(lines.length && (total>moneyCents(draft.amount) || (!saveDraft&&total!==moneyCents(draft.amount))))throw new InputError("item-total");
        if(!lines.length&&d.amount!=null&&moneyCents(d.amount)!==moneyCents(draft.amount))throw new InputError("item-total");
        amount=Number(draft.amount);
      }
      if(!amount)throw new InputError("invalid");
      const account = d.accountId ? await find("SELECT id,type,owner,isSharedCash FROM Account WHERE id=? AND isActive=1 FOR UPDATE",[d.accountId]) : null;
      const dest = d.destinationAccountId ? await find("SELECT id,type,owner,isSharedCash FROM Account WHERE id=? AND isActive=1 FOR UPDATE",[d.destinationAccountId]) : null;
      if ((d.accountId && !account) || (!saveDraft && !credit && !account) || (d.destinationAccountId && !dest)) throw new InputError("account");
      const owner = credit ? d.owner : account?.owner ?? d.owner;
      if(credit&&d.accountId)throw new InputError("account");
      const party=d.partyId ? await find("SELECT id,name,kind,isCash FROM Party WHERE id=? AND isActive=1 FOR UPDATE",[d.partyId]) : null;
      if(d.partyId&&!party)throw new InputError("party");
      if(party && (moving || !["BOTH",d.type==="INCOME"?"CUSTOMER":"SUPPLIER"].includes(party.kind)))throw new InputError("party");
      if(credit && !saveDraft && (!party||party.isCash))throw new InputError("credit-party");
      if(account && account.owner!==viewer && !(expense && spentBy.data===account.owner))throw new InputError("account");
      if(dest && (dest.owner!==viewer || account?.owner!==viewer))throw new InputError("accounts");
      if(account?.isSharedCash && d.type==="INCOME")throw new InputError("Use-transfer-to-top-up");
      if(account && account.owner!==viewer && d.projectId)throw new InputError("shared-metadata");
      if (d.type === "DEBT_PAYMENT" && !["CREDIT_CARD","LOAN"].includes(dest?.type)) throw new InputError("accounts");
      const categoryIds = [...new Set(lines.length ? lines.map(l=>l.categoryId) : d.categoryId ? [d.categoryId] : [])];
      for (const categoryId of categoryIds) {
        const category = await find("SELECT kind FROM Category WHERE id=? AND isActive=1",[categoryId]);
        if (!category || category.kind !== (d.type === "INCOME" ? "INCOME" : "EXPENSE")) throw new InputError("category");
      }
      if (d.projectId && !await find("SELECT id FROM Project WHERE id=? AND isActive=1",[d.projectId])) throw new InputError("project");
      if (d.taskId && !await find("SELECT id FROM Task WHERE id=? AND isActive=1",[d.taskId])) throw new InputError("invalid");
      const id = d.draftId ?? crypto.randomUUID();
      let accrualId: string | null = null;
      const categoryId = categoryIds.length === 1 ? categoryIds[0] : null;
      if (!saveDraft && d.type === "ACCRUED_EXPENSE") {
        accrualId = crypto.randomUUID();
        await c.execute("INSERT INTO AccruedExpense (id,amount,expenseDate,dueDate,description,scope,owner,projectId,taskId,categoryId,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,NOW(3))",[accrualId,amount,d.transactionDate,d.dueDate||null,d.description||null,d.scope,owner,d.projectId||null,d.taskId||null,categoryId]);
      }
      if(d.draftId){
        await c.execute("UPDATE FinancialTransaction SET type=?,status=?,transactionDate=?,description=?,counterparty=?,scope=?,taxScope=?,owner=?,household=?,accountId=?,projectId=?,taskId=?,categoryId=?,accrualId=?,partyId=?,paymentTiming=?,dueDate=?,updatedAt=NOW(3) WHERE id=?",[d.type,saveDraft?"PENDING_REVIEW":"POSTED",d.transactionDate,d.description||null,party?.name||d.counterparty||null,d.scope,d.taxScope??d.scope,owner,household,d.accountId||null,d.projectId||null,d.taskId||null,categoryId,accrualId,d.partyId||null,credit?"CREDIT":"PAID",d.dueDate||null,id]);
        await c.execute("DELETE FROM ExpenseLine WHERE transactionId=?",[id]);
      }else{
      await c.execute("INSERT INTO FinancialTransaction (id,type,status,amount,transactionDate,description,counterparty,scope,taxScope,owner,household,accountId,destinationAccountId,projectId,taskId,categoryId,accrualId,updatedAt) VALUES (?,?,'POSTED',?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW(3))",[id,d.type,amount,d.transactionDate,d.description||null,d.counterparty||null,d.scope,d.taxScope??d.scope,owner,household,d.accountId||null,d.destinationAccountId||null,d.projectId||null,d.taskId||null,categoryId,accrualId]);
        await c.execute("UPDATE FinancialTransaction SET partyId=?,paymentTiming=?,counterparty=COALESCE(?,counterparty),dueDate=? WHERE id=?",[d.partyId||null,credit?"CREDIT":"PAID",party?.name||null,d.dueDate||null,id]);
      }
      if(!saveDraft&&credit&&party)await c.execute("INSERT INTO PartyEntry (id,partyId,transactionId,amount) VALUES (?,?,?,?)",[crypto.randomUUID(),party.id,id,d.type==="INCOME"?amount:-amount]);
      for (const line of lines) {
        // The unique key also prevents duplicate items when two expenses are saved concurrently.
        await c.execute("INSERT INTO Item (id,name,normalizedName,categoryId,defaultUnit) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE id=id",[crypto.randomUUID(),line.name.trim().replace(/\s+/g," "),normalizeItem(line.name),line.categoryId,line.unit||null]);
        const item = await find("SELECT id,isActive FROM Item WHERE categoryId=? AND normalizedName=?",[line.categoryId,normalizeItem(line.name)]);
        if (!item?.isActive) throw new InputError("item");
        await c.execute("INSERT INTO ExpenseLine (id,transactionId,itemId,categoryId,quantity,unit,amount) VALUES (?,?,?,?,?,?,?)",[crypto.randomUUID(),id,item.id,line.categoryId,line.quantity??null,line.unit||null,line.amount]);
      }
      // Both owners use the same ledger. Shared cash is one account, not mirrored entries.
      if (!saveDraft && account && !credit) {
        const debt = ["CREDIT_CARD","LOAN"].includes(account.type);
        const cashImpact=d.type === "INCOME" ? amount : -amount;
        const impact=debt ? -cashImpact : cashImpact;
        await c.execute("INSERT INTO AccountEntry (id,accountId,transactionId,amount,entryDate) VALUES (?,?,?,?,?)",[crypto.randomUUID(),account.id,id,impact,d.transactionDate]);
        if (dest) await c.execute("INSERT INTO AccountEntry (id,accountId,transactionId,amount,entryDate) VALUES (?,?,?,?,?)",[crypto.randomUUID(),dest.id,id,["CREDIT_CARD","LOAN"].includes(dest.type) ? -amount : amount,d.transactionDate]);
      }
      await c.execute("UPDATE FinancialTransaction SET spentBy=?,recordedBy=? WHERE id=?",[spentBy.data,viewer,id]);
      await c.execute("INSERT INTO AuditLog (id,transactionId,action,details) VALUES (?,?,?,?)",[crypto.randomUUID(),id,saveDraft?"DRAFT_UPDATED":"TRANSACTION_POSTED",JSON.stringify({owner,household,lines:lines.length})]);
    }, "family");
  } catch (error) { if (error instanceof InputError) return fail(error.message); throw error; }
  if(d.draftId)return relativeRedirect(saveDraft?`/review/${d.draftId}?saved=1`:"/review?posted=1");
  if(form.get("returnTo")==="shared-cash")return relativeRedirect("/shared-cash?saved=1");
  return relativeRedirect(form.get("returnTo") === "household" ? "/household?created=1" : "/?created=1");
}
