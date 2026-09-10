import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/nav";
import { requireSession } from "@/lib/auth";
import { sharedRows } from "@/lib/db";
import { personName } from "@/lib/access";
export const dynamic="force-dynamic";
export default async function SharedTransactionPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string}>}) {
  await requireSession();const {id}=await params, query=await searchParams;
  const [entry]=await sharedRows<any>(`SELECT t.id,t.type,t.amount,t.transactionDate,t.description,t.owner,t.spentBy,t.household,t.revision FROM FinancialTransaction t WHERE t.id=? AND t.status='POSTED' AND (t.household=1 OR t.accountId IN (SELECT id FROM Account WHERE isSharedCash=1) OR t.destinationAccountId IN (SELECT id FROM Account WHERE isSharedCash=1))`,[id]);
  if(!entry)notFound();
  const lines=await sharedRows<any>("SELECT l.id,l.amount,l.quantity,l.unit,i.name FROM ExpenseLine l LEFT JOIN Item i ON i.id=l.itemId WHERE l.transactionId=? ORDER BY l.id",[id]);
  return <><Nav/><main><div className="page-heading"><div><h1>Edit shared entry</h1><p>{entry.type.replaceAll("_"," ")} · {personName(entry.owner)}’s money</p></div><Link href={entry.household?"/household":"/shared-cash"}>Back</Link></div>
    {query.error&&<p role="alert">Unable to save. The entry may have changed; reload before retrying. Check item totals, dates and any bill payments. A bill amount cannot be less than payments already made.</p>}
    <section className="panel"><form className="form-grid" action={`/api/shared-transactions/${id}`} method="post"><input name="revision" type="hidden" value={entry.revision}/><label>Amount (LKR)<input name="amount" type="number" min="0.01" max="999999999" step="0.01" defaultValue={entry.amount} required/></label><label>Date<input name="transactionDate" type="date" defaultValue={String(entry.transactionDate).slice(0,10)} required/></label><label>Who spent / moved the cash?<select name="spentBy" defaultValue={entry.spentBy}><option value="ME">Ayya</option><option value="WIFE">Sudu Manike</option></select></label><label>Description<input name="description" maxLength={300} defaultValue={entry.description||""}/></label>
      {lines.length>0&&<div className="span-2"><h2>Item amounts</h2><p>Item amounts must add up to the transaction amount.</p>{lines.map(l=><label key={l.id}>{l.name||"Item"}{l.quantity!=null?` · ${l.quantity} ${l.unit}`:""}<input name={`line:${l.id}`} type="number" min="0.01" max="999999999" step="0.01" defaultValue={l.amount} required/></label>)}</div>}
      <button className="button primary" name="intent" value="update">Save changes</button><button className="button danger" name="intent" value="delete" formNoValidate>Delete entry</button><p className="span-2 muted">Changes update the original entry and its balances for both logins. Deleting a bill also reverses its linked payments. Deleted entries remain in the audit history.</p>
    </form></section></main></>;
}
