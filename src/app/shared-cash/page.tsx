import Link from "next/link";
import { Nav } from "@/components/nav";
import { requireSession } from "@/lib/auth";
import { cashRows } from "@/lib/db";
import { cashName, personName } from "@/lib/access";
import { lkr, dateValue } from "@/lib/format";
export const dynamic="force-dynamic";

export default async function SharedCashPage({searchParams}:{searchParams:Promise<{saved?:string;deleted?:string}>}) {
  const viewer=await requireSession(), params=await searchParams;
  const accounts=await cashRows<any>("SELECT a.*,COALESCE(SUM(e.amount),0) balance FROM Account a LEFT JOIN AccountEntry e ON e.accountId=a.id WHERE a.isActive=1 GROUP BY a.id ORDER BY a.owner,a.name");
  const shared=accounts.filter(a=>a.isSharedCash);
  const privateAccounts=accounts.filter(a=>a.owner===viewer&&!a.isSharedCash&&["CASH","BANK","SAVINGS"].includes(a.type));
  const entries=await cashRows<any>(`SELECT t.id,t.transactionDate,t.description,t.type,t.amount,t.owner,t.spentBy,t.recordedBy,t.accountId,t.destinationAccountId
    FROM FinancialTransaction t WHERE t.status='POSTED' AND (t.accountId IN (SELECT id FROM Account WHERE isSharedCash=1) OR t.destinationAccountId IN (SELECT id FROM Account WHERE isSharedCash=1)) ORDER BY t.transactionDate DESC,t.createdAt DESC LIMIT 200`);
  return <><Nav/><main><div className="page-heading"><div><p className="eyebrow">Signed in as {personName(viewer)}</p><h1>Shared cash</h1><p>Track whose money it is and who spent it. Both of you can view, edit and delete these entries.</p></div><Link className="button primary" href="/transactions/new?type=EXPENSE">Record an expense</Link></div>
    {(params.saved||params.deleted)&&<p role="status">{params.deleted?"Entry deleted and balances updated.":"Changes saved and balances updated."}</p>}
    <div className="two-column">{shared.map(a=><section className="panel" key={a.id}><h2>{cashName(a.owner,viewer)}</h2><p className="muted">{personName(a.owner)}’s money · held by {personName(a.owner==="ME"?"WIFE":"ME")}</p><strong style={{fontSize:28}}>{lkr(a.balance)}</strong><p>{Number(a.balance)<0?"Spent beyond the funded amount. The money owner can top up to settle this balance.":`Shown as ${cashName(a.owner,viewer==="ME"?"WIFE":"ME")} in the other login.`}</p>
      {a.owner===viewer?<form action="/api/transactions" method="post" className="form-grid"><input type="hidden" name="type" value="TRANSFER"/><input type="hidden" name="scope" value="PERSONAL"/><input type="hidden" name="destinationAccountId" value={a.id}/><input type="hidden" name="returnTo" value="shared-cash"/><label>Top up from<select name="accountId" required><option value="">Select your account</option>{privateAccounts.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Amount (LKR)<input name="amount" type="number" min="0.01" max="999999999" step="0.01" required/></label><label>Date<input name="transactionDate" type="date" defaultValue={dateValue(new Date())} required/></label><label>Note<input name="description" maxLength={300} defaultValue={`Top up ${cashName(a.owner,viewer)}`}/></label><button className="button primary" disabled={!privateAccounts.length}>Transfer to top up</button>{!privateAccounts.length&&<Link href="/master-data?section=ACCOUNT">Add your cash or bank account first</Link>}</form>:<p>{personName(a.owner)} funds this account from their login. You can record spending from it.</p>}
    </section>)}</div>
    <section className="panel" style={{marginTop:20}}><h2>Shared cash history</h2><p>Latest 200 entries. Transfers move money without counting as income or expense. Your partner’s private account details remain hidden.</p><div className="table-wrap"><table><thead><tr><th>Date</th><th>Description</th><th>Shared account</th><th>Whose money</th><th>Spent / moved by</th><th>Amount</th><th>Actions</th></tr></thead><tbody>{entries.map(e=><tr key={e.id}><td>{String(e.transactionDate).slice(0,10)}</td><td>{e.description||e.type}<small>{e.type.replaceAll("_"," ")}</small></td><td>{shared.filter(a=>a.id===e.accountId||a.id===e.destinationAccountId).map(a=>cashName(a.owner,viewer)).join(" → ")}</td><td>{personName(e.owner)}</td><td>{personName(e.spentBy)}</td><td>{lkr(e.amount)}</td><td><Link href={`/shared-transactions/${e.id}`}>Edit / delete</Link></td></tr>)}</tbody></table></div>{!entries.length&&<p>No shared cash activity yet. Top up an account or record an expense from it.</p>}</section>
  </main></>;
}
