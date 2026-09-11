import Link from "next/link";
import { Nav } from "@/components/nav";
import { RecentTransactions } from "@/components/recent-transactions";
import { requireSession } from "@/lib/auth";
import { getDashboardData } from "@/lib/finance";
import { lkr } from "@/lib/format";

export const dynamic="force-dynamic";

export default async function TransactionsHome() {
  await requireSession();
  const data=await getDashboardData();
  return <><Nav/><main><div className="module-heading"><div><p className="eyebrow">Record · review · settle</p><h1>Transactions</h1><p className="muted">Choose the type of transaction you need to record.</p></div></div><div className="module-home"><section className="module-actions transaction-actions" aria-label="Transaction actions"><Link className="module-tile income" href="/transactions/new?type=INCOME"><i className="module-action-icon" aria-hidden="true">↙</i><span><strong>Income</strong><small>Money received</small></span><b aria-hidden="true">›</b></Link><Link className="module-tile expense" href="/transactions/new?type=EXPENSE"><i className="module-action-icon" aria-hidden="true">↗</i><span><strong>Expense</strong><small>Money spent</small></span><b aria-hidden="true">›</b></Link><Link className="module-tile transfer" href="/transactions/new?type=TRANSFER"><i className="module-action-icon" aria-hidden="true">⇄</i><span><strong>Transfer</strong><small>Move money between accounts</small></span><b aria-hidden="true">›</b></Link><Link className="module-tile debt" href="/transactions/new?type=DEBT_PAYMENT"><i className="module-action-icon" aria-hidden="true">✓</i><span><strong>Debt payment</strong><small>Pay a card or loan</small></span><b aria-hidden="true">›</b></Link><Link className="module-tile pay-later" href="/transactions/new?type=ACCRUED_EXPENSE"><i className="module-action-icon" aria-hidden="true">◷</i><span><strong>Pay later</strong><small>Record a bill you still owe</small></span><b aria-hidden="true">›</b></Link></section><aside className="module-figures" aria-label="Important transaction figures"><p className="eyebrow">At a glance</p><div><span>Available cash</span><strong>{lkr(data.availableCash)}</strong></div><div><span>Pending review</span><strong>{data.pending}</strong></div><div><span>Unpaid bills</span><strong>{lkr(data.outstandingAccruals)}</strong></div></aside></div><RecentTransactions limit={10}/></main></>;
}
