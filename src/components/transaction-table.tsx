import Link from "next/link";
import { lkr } from "@/lib/format";

export type TransactionRow = {id:string;type:string;amount:number|string;transactionDate:string;description:string|null;counterparty:string|null;accountName:string|null;destinationName:string|null;partyName:string|null;household:number|boolean;accountShared:number|boolean|null;destinationShared:number|boolean|null};
const typeLabel=(type:string)=>type.replaceAll("_"," ").replace(/\b\w/g,letter=>letter.toUpperCase());

export function TransactionTable({from,to,rows}:{from:string;to:string;rows:TransactionRow[]}) {
  return <section className="panel" id="transaction-history">
    <div className="section-heading"><div><p className="eyebrow">Transaction history</p><h2>All transactions</h2><p className="muted">Confirmed records in the selected date range.</p></div><span>{rows.length} {rows.length===1?"record":"records"}</span></div>
    <form className="report-picker"><label>From<input name="from" type="date" defaultValue={from} required/></label><label>To<input name="to" type="date" defaultValue={to} required/></label><button className="button">Apply dates</button></form>
    <div className="table-wrap"><table><thead><tr><th>Date</th><th>Description</th><th>Type</th><th>Account</th><th>Amount</th><th>Action</th></tr></thead><tbody>{rows.map(row=>{
      const shared=Boolean(row.household||row.accountShared||row.destinationShared);
      const account=row.destinationName?`${row.accountName||"No account"} → ${row.destinationName}`:row.accountName||"No account";
      const tone = row.type === "INCOME" ? "balance-positive" : ["EXPENSE", "ACCRUED_EXPENSE"].includes(row.type) ? "balance-negative" : "";
      return <tr key={row.id}><td>{String(row.transactionDate).slice(0,10)}</td><td>{row.description||row.partyName||row.counterparty||typeLabel(row.type)}</td><td>{typeLabel(row.type)}</td><td>{account}</td><td className={tone}>{lkr(row.amount)}</td><td><Link className="button" href={shared?`/shared-transactions/${row.id}`:`/transactions/${row.id}`}>Edit</Link></td></tr>;
    })}{!rows.length&&<tr><td colSpan={6}>No confirmed transactions in this date range.</td></tr>}</tbody></table></div>
  </section>;
}
