import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/nav";
import { requireSession } from "@/lib/auth";
import { rows } from "@/lib/db";

export const dynamic="force-dynamic";

export default async function TransactionEditPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string}>}) {
  await requireSession();
  const {id}=await params,query=await searchParams;
  const [entry]=await rows<any>("SELECT id,type,amount,transactionDate,description,revision FROM FinancialTransaction WHERE id=? AND status='POSTED'",[id]);
  if(!entry)notFound();
  const lines=await rows<any>("SELECT l.id,l.amount,l.quantity,l.unit,i.name FROM ExpenseLine l LEFT JOIN Item i ON i.id=l.itemId WHERE l.transactionId=? ORDER BY l.id",[id]);
  return <><Nav/><main><div className="page-heading"><div><p className="eyebrow">Transaction history</p><h1>Edit transaction</h1><p className="muted">{entry.type.replaceAll("_"," ")}</p></div><Link className="button" href="/transactions/new#transaction-history">Back to transactions</Link></div>
    {query.error&&<p role="alert">Unable to save. The record may have changed; reload and try again. Item amounts must equal the transaction amount.</p>}
    <section className="panel"><form className="form-grid" action={`/api/transactions/${id}`} method="post"><input name="revision" type="hidden" value={entry.revision}/><label>Amount (LKR)<input name="amount" type="number" min="0.01" max="999999999" step="0.01" defaultValue={entry.amount} required/></label><label>Date<input name="transactionDate" type="date" defaultValue={String(entry.transactionDate).slice(0,10)} required/></label><label className="span-2">Description<input name="description" maxLength={300} defaultValue={entry.description||""}/></label>
      {lines.length>0&&<div className="span-2"><h2>Item amounts</h2><p className="muted">Item amounts must add up to the transaction amount.</p>{lines.map(line=><label key={line.id}>{line.name||"Item"}{line.quantity!=null?` · ${line.quantity} ${line.unit}`:""}<input name={`line:${line.id}`} type="number" min="0.01" max="999999999" step="0.01" defaultValue={line.amount} required/></label>)}</div>}
      <button className="button primary" type="submit">Save changes</button>
    </form></section>
  </main></>;
}
