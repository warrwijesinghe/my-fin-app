import { QuickCapture } from "@/components/quick-capture";
import Link from "next/link";
import { RecentTransactions } from "@/components/recent-transactions";
import { Nav } from "@/components/nav";
import { IncomeExpenseChart } from "@/components/chart";
import { getDashboardData, getLiabilitySuppliers } from "@/lib/finance";
import { DashboardLiabilities } from "@/components/dashboard-liabilities";
import { lkr, signedLkr } from "@/lib/format";
import { requireSession } from "@/lib/auth";
import { accountBalanceClass } from "@/lib/balance";
import { rows } from "@/lib/db";
import { RowDataPacket } from "mysql2";
import { getDashboardTrends } from "@/lib/dashboard-charts";
import { MiniDonut, Sparkline, TrendArrow } from "@/components/dashboard-mini-chart";

export const dynamic = "force-dynamic";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ account?: string; recent?: string; captured?: string; captureError?: string }> }) {
  const viewer=await requireSession();
  const data = await getDashboardData();
  const [suppliers,goalSettings,trends] = await Promise.all([getLiabilitySuppliers(),rows<RowDataPacket & {value:string}>("SELECT value FROM AppSetting WHERE `key`='analyticsGoals'"),getDashboardTrends(data.accounts, data.outstandingReceivables, data.outstandingAccruals)]);
  const availableAccounts = data.accounts.filter((account) => ["CASH", "BANK", "SAVINGS"].includes(account.type));
  const { account: accountId, recent, captured, captureError } = await searchParams;
  const requestedLimit = Number.parseInt(recent ?? "20", 10);
  const recentLimit = Number.isFinite(requestedLimit) ? Math.min(100, Math.max(20, requestedLimit)) : 20;
  const selectedAccount = data.accounts.find(account => account.id === accountId);
  const liabilities = data.accounts.filter((account) => ["CREDIT_CARD", "LOAN"].includes(account.type));
  const cash = data.accounts.filter(account => account.type === "CASH").reduce((total, account) => total + account.balance, 0);
  const bankCash = data.accounts.filter(account => account.type === "BANK").reduce((total, account) => total + account.balance, 0);
  const cashAndBank = cash + bankCash;
  const loans = data.accounts.filter(account => account.type === "LOAN").reduce((total, account) => total + Math.max(account.balance, 0), 0);
  const creditCards = data.accounts.filter(account => account.type === "CREDIT_CARD").reduce((total, account) => total + Math.max(account.balance, 0), 0);
  const creditCardSpendBalance = data.accounts.filter(account => account.type === "CREDIT_CARD").reduce((total, account) => total + Math.max(0, (account.creditLimit ?? 0) - Math.max(account.balance, 0)), 0);
  const availableToSpend = cashAndBank + creditCardSpendBalance;
  let targetAmount = 30000000;
  try { const saved = JSON.parse(goalSettings[0]?.value ?? "null"); if (Number.isFinite(saved?.target) && saved.target > 0) targetAmount = saved.target; } catch { /* Use the standard target until one is saved in Analytics. */ }
  const negativeProgressRange = 2000000;
  const progressPercent = (position: number) => position < 0 ? position / negativeProgressRange * 100 : position / targetAmount * 100;
  const targetProgress = progressPercent(data.overallPosition);
  const targetGap = targetAmount - data.overallPosition;
  const targetTrend = trends.map(point => ({ label: point.month, value: progressPercent(point.position) }));
  const trendPoints = (key: keyof typeof trends[number]) => trends.map(point => ({ label: point.month, value: Number(point[key]) }));

  return (
    <><Nav /><main>
      <div className="page-heading"><div><p className="eyebrow">{viewer==="WIFE"?"JAD Buddhika · Sudu Manike":"Ayya"} · Private financial control</p><h1>Your money, clearly visible</h1><p className="muted">Confirmed records only. Pending items never change balances.</p></div><QuickCapture /></div>
      {captured && <p role="status">Saved to Review. Account balances are unchanged. <Link href="/review">Complete entry</Link></p>}
      {captureError && <p role="alert">Enter a positive amount with at most two decimal places and a description.</p>}
      <section className="metric-grid dashboard-metric-grid">
        <article className={`metric ${data.overallPosition >= 0 ? "positive" : "negative"}`}><p>Overall financial position</p><div className="metric-value-chart"><strong>{signedLkr(data.overallPosition)}</strong><TrendArrow points={trendPoints("position")}/><Sparkline label="Overall financial position trend" points={trendPoints("position")} tone={data.overallPosition >= 0 ? "green" : "red"}/></div><small>Cash assets + {lkr(data.outstandingReceivables)} receivable, less debts and unpaid bills</small></article>
        <article className={`metric ${cashAndBank >= 0 ? "positive" : "negative"}`}><p>Cash & bank total</p><div className="metric-value-chart"><strong>{lkr(cashAndBank)}</strong><TrendArrow points={trendPoints("cashAndBank")}/><Sparkline label="Cash and bank trend" points={trendPoints("cashAndBank")} /></div><div className="metric-subvalues"><span>Cash <b>{lkr(cash)}</b></span><span>Bank <b>{lkr(bankCash)}</b></span></div></article>
        <article className="metric positive"><p>Available to spend</p><div className="metric-value-chart"><strong>{lkr(availableToSpend)}</strong><TrendArrow points={trendPoints("availableToSpend")}/><MiniDonut label="Available to spend composition" slices={[{ label: "Cash and bank", value: cashAndBank, color: "green" }, { label: "Card spend balance", value: creditCardSpendBalance, color: "blue" }]}/></div><div className="metric-subvalues"><span>Cash & bank <b>{lkr(cashAndBank)}</b></span><span>Card spend balance <b>{lkr(creditCardSpendBalance)}</b></span></div></article>
        <article className="metric negative"><p>Total liabilities</p><div className="metric-value-chart"><strong>{lkr(loans + creditCards + data.outstandingAccruals)}</strong><TrendArrow points={trendPoints("liabilities")} inverse/><Sparkline label="Total liabilities trend" points={trendPoints("liabilities")} tone="red"/></div><div className="metric-subvalues"><span>Long-term loans <b>{lkr(loans)}</b></span><span>Credit cards <b>{lkr(creditCards)}</b></span><span>Creditors <b>{lkr(data.outstandingAccruals)}</b></span></div></article>
        <article className={`metric ${data.netMovement >= 0 ? "positive" : "negative"}`}><p>This month’s net movement</p><div className="metric-value-chart"><strong>{signedLkr(data.netMovement)}</strong><TrendArrow points={trendPoints("netMovement")}/><Sparkline label="Monthly net movement trend" points={trendPoints("netMovement")} tone={data.netMovement >= 0 ? "green" : "red"}/></div><div className="metric-subvalues"><span>Income <b>{lkr(data.income)}</b></span><span>Expenses <b>{lkr(data.expenses)}</b></span></div></article>
        <article className={`metric ${targetProgress >= 0 ? "positive" : "negative"}`}><p>Target amount progress</p><div className="metric-value-chart"><strong>{targetProgress.toFixed(1)}%</strong><TrendArrow points={targetTrend}/><Sparkline label="Target amount progress trend" points={targetTrend} tone={targetProgress >= 0 ? "green" : "red"}/></div><div className="metric-subvalues"><span>Negative range <b>-2M to zero</b></span><span>Positive target <b>{lkr(targetAmount)}</b></span><span>{targetGap > 0 ? "Remaining" : "Above target"} <b>{lkr(Math.abs(targetGap))}</b></span></div></article>
      </section>
      <div className="dashboard-overview">
      <section className="panel dashboard-cash"><div className="section-heading"><div><p className="eyebrow">Live position</p><h2>Cash and cash equivalents</h2></div><Link href="/master-data?section=ACCOUNT">Manage accounts</Link></div>
        {availableAccounts.length ? <div className="account-list dashboard-scroll-list">{availableAccounts.slice(0, 10).map((account) => <Link key={account.id} className="account-row dashboard-account" href={`/?account=${encodeURIComponent(account.id)}#recent-transactions`} aria-current={selectedAccount?.id === account.id ? "true" : undefined} aria-label={`View transactions for ${account.name}`}><div className="dashboard-account-content"><div><strong>{account.name}</strong><span>{account.type.replace("_", " ")} · {account.scope.toLowerCase()}</span></div><b className={accountBalanceClass(account.balance,account.type)}>{lkr(account.balance)}</b></div><span className="dashboard-account-arrow" aria-hidden="true">›</span></Link>)}</div> : <Empty text="Add your cash, bank or savings accounts to see every available balance here." />}
      </section>
      <section className="panel dashboard-debt"><div className="section-heading"><div><p className="eyebrow">What you owe</p><h2>Credit cards and loans</h2></div></div>
        {liabilities.length ? <div className="account-list">{liabilities.map((account) => <Link key={account.id} className="account-row dashboard-account" href={`/?account=${encodeURIComponent(account.id)}#recent-transactions`} aria-current={selectedAccount?.id === account.id ? "true" : undefined} aria-label={`View transactions for ${account.name}`}><div className="dashboard-account-content"><div><strong>{account.name}</strong><span>{account.type.replace("_", " ")} · {account.scope.toLowerCase()}</span></div><b className={accountBalanceClass(account.balance,account.type)}>{lkr(account.balance)}</b></div><span className="dashboard-account-arrow" aria-hidden="true">›</span></Link>)}</div> : <Empty text="No credit card or loan accounts have been added." />}
      </section>
        <RecentTransactions limit={recentLimit} selectedAccount={selectedAccount ? { id: selectedAccount.id, name: selectedAccount.name } : undefined} />
        <IncomeExpenseChart income={data.income} expenses={data.expenses} />
        <section className="panel dashboard-review"><div className="section-heading"><div><p className="eyebrow">Action needed</p><h2>Review queue</h2></div><Link href="/review">Open review</Link></div><div className="empty-compact"><strong>{data.pending}</strong><span>entries need an account or confirmation</span></div></section>
      </div>
      <DashboardLiabilities accounts={data.accounts} suppliers={suppliers}/>
    </main></>
  );
}

function Empty({ text }: { text: string }) { return <div className="empty"><p>{text}</p><Link className="button" href="/master-data?section=ACCOUNT">Set up accounts</Link></div>; }
