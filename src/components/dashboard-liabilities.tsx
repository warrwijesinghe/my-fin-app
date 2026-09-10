import Link from "next/link";
import { lkr } from "@/lib/format";
import type { AccountBalance } from "@/lib/types";
import type { LiabilitySupplier } from "@/lib/finance";

export function DashboardLiabilities({accounts,suppliers}:{accounts:AccountBalance[];suppliers:LiabilitySupplier[]}) {
  const debts=accounts.filter(account=>["CREDIT_CARD","LOAN"].includes(account.type)&&account.balance>0);
  const accountTotal=debts.reduce((total,account)=>total+account.balance,0);
  const supplierTotal=suppliers.reduce((total,supplier)=>total+supplier.amount,0);
  return <section className="panel" id="liabilities">
    <div className="section-heading"><div><p className="eyebrow">What you owe</p><h2>All liabilities</h2><p className="muted">Grouped by debt account and supplier.</p></div><strong>{lkr(accountTotal+supplierTotal)}</strong></div>
    {debts.length||suppliers.length?<div className="table-wrap"><table><thead><tr><th>Group</th><th>Liability</th><th>Details</th><th>Amount</th><th>Action</th></tr></thead><tbody>
      {debts.map(account=><tr key={`account-${account.id}`}><td>Account</td><td><strong>{account.name}</strong></td><td>{account.type.replace("_"," ")} · {account.scope.toLowerCase()}</td><td>{lkr(account.balance)}</td><td><Link href={`/?account=${encodeURIComponent(account.id)}#recent-transactions`}>View activity</Link></td></tr>)}
      {suppliers.map(supplier=><tr key={`supplier-${supplier.id??supplier.name}`}><td>Supplier</td><td><strong>{supplier.name}</strong></td><td>{supplier.count} {supplier.count===1?"unpaid bill":"unpaid bills"}</td><td>{lkr(supplier.amount)}</td><td>{supplier.id?<Link href={`/parties/${supplier.id}`}>View ledger</Link>:<Link href="/bills">View bills</Link>}</td></tr>)}
    </tbody></table></div>:<p className="muted">No outstanding account debt or supplier bills.</p>}
  </section>;
}
