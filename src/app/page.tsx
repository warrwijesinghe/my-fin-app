import { QuickCapture } from "@/components/quick-capture";
import Link from "next/link";
import { RecentTransactions } from "@/components/recent-transactions";
import { Nav } from "@/components/nav";
import { IncomeExpenseChart } from "@/components/chart";
import { getDashboardData } from "@/lib/finance";
import { lkr, signedLkr } from "@/lib/format";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ account?: string; recent?: string; captured?: string; captureError?: string }> }) {
  await requireSession();
  const data = await getDashboardData();
  const availableAccounts = data.accounts.filter((account) => account.includeInAvailable && ["CASH", "BANK", "SAVINGS"].includes(account.type));
  const { account: accountId, recent, captured, captureError } = await searchParams;
  const requestedLimit = Number.parseInt(recent ?? "20", 10);
  const recentLimit = Number.isFinite(requestedLimit) ? Math.min(100, Math.max(20, requestedLimit)) : 20;
  const selectedAccount = data.accounts.find(account => account.id === accountId);
  const liabilities = data.accounts.filter((account) => ["CREDIT_CARD", "LOAN"].includes(account.type));

  return (
    <><Nav /><main>
      <div className="page-heading"><div><p className="eyebrow">Private financial control</p><h1>Your money, clearly visible</h1><p className="muted">Confirmed records only. Pending items never change balances.</p></div><QuickCapture /></div>
      {captured && <p role="status">Saved to Review. Account balances are unchanged. <Link href="/review">Complete entry</Link></p>}
      {captureError && <p role="alert">Enter a positive amount with at most two decimal places and a description.</p>}
      <section className="metric-grid">
        <article className={`metric ${data.overallPosition >= 0 ? "positive" : "negative"}`}><p>Overall financial position</p><strong>{signedLkr(data.overallPosition)}</strong><small>Cash assets + {lkr(data.outstandingReceivables)} receivable, less debts and unpaid bills</small></article>
        <article className="metric"><p>Available cash now</p><strong>{lkr(data.availableCash)}</strong><small>Cash, bank and included savings</small></article>
        <article className="metric"><p>Total liabilities</p><strong>{lkr(data.debt + data.outstandingAccruals)}</strong><small>{lkr(data.debt)} debt · {lkr(data.outstandingAccruals)} owed · <Link href="/bills">Pay bills</Link></small></article>
        <article className={`metric ${data.netMovement >= 0 ? "positive" : "negative"}`}><p>This month’s net movement</p><strong>{signedLkr(data.netMovement)}</strong><small>{lkr(data.income)} income · {lkr(data.expenses)} expenses</small></article>
      </section>
      <div className="dashboard-overview">
      <section className="panel dashboard-cash"><div className="section-heading"><div><p className="eyebrow">Live position</p><h2>Cash and cash equivalents</h2></div><Link href="/master-data?section=ACCOUNT">Manage accounts</Link></div>
        {availableAccounts.length ? <div className="account-list dashboard-scroll-list">{availableAccounts.slice(0, 10).map((account) => <Link key={account.id} className="account-row dashboard-account" href={`/?account=${encodeURIComponent(account.id)}#recent-transactions`} aria-current={selectedAccount?.id === account.id ? "true" : undefined} aria-label={`View transactions for ${account.name}`}><div className="dashboard-account-content"><div><strong>{account.name}</strong><span>{account.type.replace("_", " ")} · {account.scope.toLowerCase()}</span></div><b>{lkr(account.balance)}</b></div><span className="dashboard-account-arrow" aria-hidden="true">›</span></Link>)}</div> : <Empty text="Add your cash, bank or savings accounts to see every available balance here." />}
      </section>
      <section className="panel dashboard-debt"><div className="section-heading"><div><p className="eyebrow">What you owe</p><h2>Credit cards and loans</h2></div></div>
        {liabilities.length ? <div className="account-list">{liabilities.map((account) => <Link key={account.id} className="account-row dashboard-account" href={`/?account=${encodeURIComponent(account.id)}#recent-transactions`} aria-current={selectedAccount?.id === account.id ? "true" : undefined} aria-label={`View transactions for ${account.name}`}><div className="dashboard-account-content"><div><strong>{account.name}</strong><span>{account.type.replace("_", " ")} · {account.scope.toLowerCase()}</span></div><b>{lkr(Math.max(account.balance, 0))}</b></div><span className="dashboard-account-arrow" aria-hidden="true">›</span></Link>)}</div> : <Empty text="No credit card or loan accounts have been added." />}
      </section>
        <RecentTransactions limit={recentLimit} selectedAccount={selectedAccount ? { id: selectedAccount.id, name: selectedAccount.name } : undefined} />
        <IncomeExpenseChart income={data.income} expenses={data.expenses} />
        <section className="panel dashboard-review"><div className="section-heading"><div><p className="eyebrow">Action needed</p><h2>Review queue</h2></div><Link href="/review">Open review</Link></div><div className="empty-compact"><strong>{data.pending}</strong><span>entries need an account or confirmation</span></div></section>
      </div>
    </main></>
  );
}

function Empty({ text }: { text: string }) { return <div className="empty"><p>{text}</p><Link className="button" href="/master-data?section=ACCOUNT">Set up accounts</Link></div>; }
