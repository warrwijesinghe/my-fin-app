import Link from "next/link";
import { Nav } from "@/components/nav";
import { IncomeExpenseChart } from "@/components/chart";
import { getDashboardData } from "@/lib/finance";
import { lkr, signedLkr } from "@/lib/format";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  await requireSession();
  const data = await getDashboardData();
  const availableAccounts = data.accounts.filter((account) => account.includeInAvailable && ["CASH", "BANK", "SAVINGS"].includes(account.type));
  const liabilities = data.accounts.filter((account) => ["CREDIT_CARD", "LOAN"].includes(account.type));

  return (
    <><Nav /><main>
      <div className="page-heading"><div><p className="eyebrow">Private financial control</p><h1>Your money, clearly visible</h1><p className="muted">Confirmed records only. Pending items never change balances.</p></div><Link className="button primary" href="/transactions/new">Add transaction</Link></div>
      <section className="metric-grid">
        <article className={`metric ${data.overallPosition >= 0 ? "positive" : "negative"}`}><p>Overall financial position</p><strong>{signedLkr(data.overallPosition)}</strong><small>Assets less loans, credit cards and unpaid accruals</small></article>
        <article className="metric"><p>Available cash now</p><strong>{lkr(data.availableCash)}</strong><small>Cash, bank and included savings</small></article>
        <article className="metric"><p>Total liabilities</p><strong>{lkr(data.debt + data.outstandingAccruals)}</strong><small>{lkr(data.debt)} debt · {lkr(data.outstandingAccruals)} owed</small></article>
        <article className={`metric ${data.netMovement >= 0 ? "positive" : "negative"}`}><p>This month’s net movement</p><strong>{signedLkr(data.netMovement)}</strong><small>{lkr(data.income)} income · {lkr(data.expenses)} expenses</small></article>
      </section>
      <section className="dashboard-grid">
        <IncomeExpenseChart income={data.income} expenses={data.expenses} />
        <section className="panel"><div className="section-heading"><div><p className="eyebrow">Action needed</p><h2>Review queue</h2></div><Link href="/review">Open review</Link></div><div className="empty-compact"><strong>{data.pending}</strong><span>entries need an account or confirmation</span></div></section>
      </section>
      <section className="panel"><div className="section-heading"><div><p className="eyebrow">Live position</p><h2>Cash and cash equivalents</h2></div><Link href="/accounts">Manage accounts</Link></div>
        {availableAccounts.length ? <div className="account-list">{availableAccounts.map((account) => <div key={account.id} className="account-row"><div><strong>{account.name}</strong><span>{account.type.replace("_", " ")} · {account.scope.toLowerCase()}</span></div><b>{lkr(account.balance)}</b></div>)}</div> : <Empty text="Add your cash, bank or savings accounts to see every available balance here." />}
      </section>
      <section className="panel"><div className="section-heading"><div><p className="eyebrow">What you owe</p><h2>Credit cards and loans</h2></div></div>
        {liabilities.length ? <div className="account-list">{liabilities.map((account) => <div key={account.id} className="account-row"><div><strong>{account.name}</strong><span>{account.type.replace("_", " ")} · {account.scope.toLowerCase()}</span></div><b>{lkr(Math.max(account.balance, 0))}</b></div>)}</div> : <Empty text="No credit card or loan accounts have been added." />}
      </section>
    </main></>
  );
}

function Empty({ text }: { text: string }) { return <div className="empty"><p>{text}</p><Link className="button" href="/accounts">Set up accounts</Link></div>; }
