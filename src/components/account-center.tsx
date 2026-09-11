"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { AccountBalance } from "@/lib/types";
import { buildStatement, isDebtAccount, portfolioTotals, summarizeStatement, type AccountEntry } from "@/lib/account-center";
import { accountBalanceClass } from "@/lib/balance";

const money = (n: number) => new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n));
const label = (s: string) => s.toLowerCase().replaceAll("_", " ");
const day = (s: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(s + "T00:00:00Z"));
const balanceTone = accountBalanceClass;

export function AccountCenter({ accounts, selectedId, entries }: { accounts: AccountBalance[]; selectedId?: string; entries: AccountEntry[] }) {
  const [scope, setScope] = useState("ALL");
  const [accountQuery, setAccountQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("ALL");
  const [newest, setNewest] = useState(false);
  const [page, setPage] = useState(0);
  const account = accounts.find(a => a.id === selectedId);
  const scopedAccounts = accounts.filter(a => scope === "ALL" || a.scope === scope);
  const visibleAccounts = scopedAccounts.filter(a => `${a.name} ${a.type} ${a.holder ?? ""}`.toLowerCase().includes(accountQuery.toLowerCase()));
  const totals = portfolioTotals(scopedAccounts, accounts[0]?.owner??"ME");
  const statement = useMemo(() => buildStatement(entries), [entries]);
  const summary = useMemo(() => summarizeStatement(statement, from, to), [statement, from, to]);
  const invalidDates = !!from && !!to && from > to;
  const debt = !!account && isDebtAccount(account.type);
  const matching = summary.entries.filter(row => (type === "ALL" || row.type === type) && `${row.description ?? ""} ${row.counterparty ?? ""} ${row.category ?? ""} ${row.project ?? ""} ${row.task ?? ""} ${row.transactionId}`.toLowerCase().includes(query.toLowerCase()));
  if (newest) matching.reverse();
  const pageCount = Math.max(1, Math.ceil(matching.length / 25));
  const safePage = Math.min(page, pageCount - 1);
  const displayed = matching.slice(safePage * 25, (safePage + 1) * 25);
  const utilization = account?.type === "CREDIT_CARD" && account.creditLimit && account.creditLimit > 0 ? Math.max(account.balance, 0) / account.creditLimit * 100 : null;
  const reconciles = account && Math.abs((statement.at(-1)?.balance ?? 0) - account.balance) < 0.005;

  function exportStatement() {
    const cell = (value: unknown) => { const text = String(value ?? ""); return '"' + (/^[=+@\-\t\r]/.test(text) ? "'" : "") + text.replaceAll('"', '""') + '"'; };
    const data = [["Date", "Transaction ID", "Type", "Status", "Description", "Counterparty", "Scope", "Category", "Project", "Task", "Source", "Destination", "Increase", "Decrease", "Balance"], ...matching.map(r => [r.entryDate, r.transactionId, r.type, r.status, r.description, r.counterparty, r.scope, r.category, r.project, r.task, r.source, r.destination, Math.max(r.amount, 0).toFixed(2), Math.max(-r.amount, 0).toFixed(2), r.balance.toFixed(2)])];
    const url = URL.createObjectURL(new Blob(["\uFEFF" + data.map(row => row.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a"); a.href = url; a.download = `account-statement-${selectedId}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <>
    <div className="page-heading"><div><p className="eyebrow">Every account. Every movement.</p><h1>Account Center</h1><p className="muted">Follow your balances from the first entry to today.</p></div><Link className="button" href="/master-data?section=ACCOUNT">Manage accounts ↗</Link></div>
    <div className="ac-portfolio-heading"><h2>Account overview</h2><label>Account scope<select value={scope} onChange={e => setScope(e.target.value)}><option value="ALL">Personal & business</option><option value="PERSONAL">Personal</option><option value="BUSINESS">Business</option></select></label></div>
    <div className="ac-metrics">
      <Metric title="Available cash" value={totals.available} note="Included cash, bank and savings; card debt reduces it" />
      <Metric title="Asset balances" value={totals.assets} note="Cash, bank and savings; includes inactive" />
      <Metric title="Debt balances" value={totals.debt} note="Cards and loans, net of credit balances" accountType="CREDIT_CARD" />
      <Metric title="Net account position" value={totals.net} note="Assets less debt; excludes unpaid accruals" />
    </div>
    <div className="ac-layout">
      <aside className="panel ac-directory"><div className="ac-directory-title"><h2>All accounts</h2><span>{scopedAccounts.length}</span></div><input aria-label="Search accounts" placeholder="Search name or type…" value={accountQuery} onChange={e => setAccountQuery(e.target.value)} /><nav aria-label="Choose account" className="ac-account-list">{visibleAccounts.map(a => <Link key={a.id} href={`/account-center?account=${encodeURIComponent(a.id)}`} aria-current={a.id === selectedId ? "page" : undefined}><span className="ac-account-type">{a.type === "CREDIT_CARD" ? "▤" : isDebtAccount(a.type) ? "↗" : "▣"}</span><span><strong>{a.name}</strong><small>{label(a.type)} · {label(a.scope)}{!a.isActive && " · Inactive"}</small><b className={balanceTone(a.balance, a.type)}>{money(a.balance)}</b></span></Link>)}{!visibleAccounts.length && <p className="muted">No matching accounts.</p>}</nav></aside>
      <div className="ac-detail">{!account ? <section className="panel empty"><h2>{accounts.length ? "Choose an account" : "Your accounts start here"}</h2><p>Select an account to see its complete statement and balance trends.</p><Link className="button primary" href="/master-data?section=ACCOUNT">Set up accounts</Link></section> : <>
        <section className="panel ac-account-heading"><div><p className="eyebrow">{label(account.scope)} / {label(account.type)}{!account.isActive && " / inactive"}</p><h2>{account.name}</h2><p className="muted">{account.holder || "Account statement"}</p></div><div className="ac-current"><span>{debt ? "Current debt balance" : "Current balance"}</span><strong className={balanceTone(account.balance, account.type)}>{money(account.balance)}</strong><small>All recorded entries</small></div></section>
        {utilization !== null && <section className="panel ac-credit"><div><strong>Credit limit used · {utilization.toFixed(1)}%</strong><span>{money(Math.max((account.creditLimit ?? 0) - account.balance, 0))} available · {money(account.creditLimit ?? 0)} limit</span></div><progress max={100} value={Math.min(utilization, 100)} aria-label="Credit limit utilization" />{utilization > 100 && <p role="status">Recorded balance exceeds your credit limit by {money(account.balance - (account.creditLimit ?? 0))}.</p>}</section>}
        <section className="panel ac-period"><div><h2>Statement period</h2><p className="muted">All history by default. Balances include entries before your start date.</p></div><div className="ac-date-fields"><label>From<input type="date" value={from} max={to || undefined} onChange={e => { setFrom(e.target.value); setPage(0); }} /></label><label>To<input type="date" value={to} min={from || undefined} onChange={e => { setTo(e.target.value); setPage(0); }} /></label><button className="button" onClick={() => { setFrom(""); setTo(""); setPage(0); }}>All history</button></div></section>
        {invalidDates ? <p role="alert" className="ac-alert">The end date must be on or after the start date.</p> : <>
          <div className="ac-metrics ac-period-metrics"><Metric title="Opening balance" value={summary.opening} note="Before the first entry in this period" accountType={account.type} /><Metric title={debt ? "Debt increases" : "Money in"} value={summary.increases} note="Includes transfers and opening entries" tone={debt?"negative":"positive"} /><Metric title={debt ? "Debt reductions" : "Money out"} value={summary.decreases} note="All decreases in the account balance" tone={debt?"positive":"negative"} /><Metric title="Closing balance" value={summary.closing} note={`${summary.entries.length} ledger entries in period`} accountType={account.type} /></div>
          <div className="ac-charts"><section className="panel"><p className="eyebrow">Balance journey</p><h2>{debt ? "Debt over time" : "Balance over time"}</h2><p className="ac-caption">Daily closing balances · hover or focus a point for details.</p><BalanceChart days={summary.days} accountType={account.type} /></section><section className="panel"><p className="eyebrow">Monthly movement</p><h2>{debt ? "Borrowing & repayments" : "Inflow & outflow"}</h2><p className="ac-caption">Latest 6 active months in period. Transfers included; opening balances excluded.</p><div className="ac-legend"><span>● {debt ? "Debt added" : "In"}</span><span>● {debt ? "Debt reduced" : "Out"}</span></div><MovementChart months={summary.months.slice(-6)} /></section></div>
          <section className="panel ac-spending"><div><p className="eyebrow">Spending focus</p><h2>Where spending goes</h2><p className="ac-caption">Expense entries only. Transfers and debt repayments are excluded.</p><strong className="balance-negative">{money(summary.expenses)}</strong><p className="ac-caption">Recorded income: <b className="balance-positive">{money(summary.income)}</b></p></div><div className="ac-category-bars">{summary.categories.slice(0, 5).map(c => <div key={c.name}><span>{c.name}<b className="balance-negative">{money(c.amount)} · {summary.expenses ? (c.amount / summary.expenses * 100).toFixed(0) : 0}%</b></span><progress max={summary.expenses || 1} value={c.amount} aria-label={`${c.name} spending`} /></div>)}{!summary.categories.length && <p className="muted">No expense entries in this period.</p>}{summary.categories.length > 5 && <small>Top 5 of {summary.categories.length} categories</small>}</div></section>
          <section className="panel ac-statement"><div className="ac-statement-heading"><div><p className="eyebrow">Complete ledger</p><h2>Transaction history</h2><p className="ac-caption">{debt ? "A positive balance is debt owed; a negative balance is a credit." : "Each balance is the account position immediately after that entry."}</p></div><button className="button" onClick={exportStatement} disabled={!matching.length}>Export CSV</button></div>
            <div className="ac-statement-filters"><input aria-label="Search statement" placeholder="Search description, category, project, or reference…" value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} /><select aria-label="Transaction type" value={type} onChange={e => { setType(e.target.value); setPage(0); }}><option value="ALL">All types</option>{[...new Set(entries.map(e => e.type))].sort().map(t => <option key={t} value={t}>{label(t)}</option>)}</select><select aria-label="Statement order" value={newest ? "new" : "old"} onChange={e => { setNewest(e.target.value === "new"); setPage(0); }}><option value="old">Oldest first</option><option value="new">Newest first</option></select></div>
            <p className="ac-caption">Search and type filters change visible rows only. Running balances and period totals always include all ledger entries. On small screens, scroll the table sideways to see amounts and balances.</p>
            <div className="ac-table-scroll" tabIndex={0} role="region" aria-label="Account statement, scroll for more columns"><table><thead><tr><th>Date / reference</th><th>Transaction details</th><th>{debt ? "Debt added" : "In"}</th><th>{debt ? "Debt reduced" : "Out"}</th><th>Balance after entry</th></tr></thead><tbody>{displayed.map(row => <tr key={row.id}><td>{day(row.entryDate)}<details><summary>Reference</summary><small>{row.transactionId}</small><small>Recorded {row.createdAt}</small></details></td><td><strong>{row.description || row.counterparty || label(row.type)}</strong><small>{label(row.type)} · {label(row.scope)} · {label(row.status)}</small><small>{[row.category, row.project, row.task].filter(Boolean).join(" / ")}</small>{row.counterparty && <small>Counterparty: {row.counterparty}</small>}{row.destination && <small>{row.source ?? "—"} → {row.destination}</small>}</td><td className={`ac-number ${balanceTone(row.amount, account.type)}`}>{row.amount > 0 ? money(row.amount) : "—"}</td><td className={`ac-number ${balanceTone(row.amount, account.type)}`}>{row.amount < 0 ? money(-row.amount) : "—"}</td><td className="ac-number"><b className={balanceTone(row.balance, account.type)}>{money(row.balance)}</b></td></tr>)}</tbody></table>{!displayed.length && <div className="empty">No entries match this period and these filters.</div>}</div>
            <div className="ac-pagination"><span>{matching.length ? `${safePage * 25 + 1}–${Math.min((safePage + 1) * 25, matching.length)} of ${matching.length} entries` : "0 entries"}</span><button className="button" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>Previous</button><button className="button" disabled={safePage + 1 >= pageCount} onClick={() => setPage(safePage + 1)}>Next</button></div>
            <p className={reconciles ? "ac-caption" : "ac-alert"}>{reconciles ? "✓ Full-history closing balance matches the recorded account balance." : "The balance changed while this page loaded. Refresh to reconcile the statement."} Only ledger entries affect balances; pending transactions without entries are in Review.</p>
          </section>
        </>}
      </>}</div>
    </div>
  </>;
}

function Metric({ title, value, note, accountType, tone }: { title: string; value: number; note: string; accountType?: string; tone?: "positive"|"negative" }) { return <article className="ac-metric"><p>{title}</p><strong className={tone ? `balance-${tone}` : balanceTone(value, accountType)}>{money(value)}</strong><small>{note}</small></article>; }

function BalanceChart({ days, accountType }: { days: { date: string; balance: number }[]; accountType: string }) {
  const [active, setActive] = useState<number | null>(null);
  if (!days.length) return <p className="ac-chart-empty">No balance history in this period.</p>;
  const low = Math.min(0, ...days.map(d => d.balance)), high = Math.max(0, ...days.map(d => d.balance));
  const range = high - low || 1;
  const first = Date.parse(days[0].date), duration = Date.parse(days.at(-1)!.date) - first || 1;
  const x = (i: number) => days.length === 1 ? 250 : 18 + (Date.parse(days[i].date) - first) / duration * 464;
  const y = (v: number) => 162 - (v - low) / range * 140;
  const selected = days[Math.min(active ?? days.length - 1, days.length - 1)];
  const trendColor = balanceTone(selected.balance, accountType) === "balance-positive" ? "#0c7048" : "#ba3731";
  return <div className="ac-balance-chart"><p aria-live="polite">{day(selected.date)} <b className={balanceTone(selected.balance, accountType)}>{money(selected.balance)}</b></p><svg viewBox="0 0 500 190" role="img" aria-label={`Daily closing balance from ${day(days[0].date)} to ${day(days.at(-1)!.date)}`}><line x1="18" x2="482" y1={y(0)} y2={y(0)} stroke="#d5dfda" strokeDasharray="4 4" /><polyline points={days.map((d, i) => `${x(i)},${y(d.balance)}`).join(" ")} fill="none" stroke={trendColor} strokeWidth="2.5" />{days.map((d, i) => <circle key={d.date} cx={x(i)} cy={y(d.balance)} r={i === active ? 6 : 3.5} fill={trendColor} tabIndex={0} aria-label={`${day(d.date)}: ${money(d.balance)}`} onFocus={() => setActive(i)} onMouseEnter={() => setActive(i)}><title>{`${day(d.date)}: ${money(d.balance)}`}</title></circle>)}</svg><div className="ac-chart-axis"><span>{day(days[0].date)}</span><span>{day(days.at(-1)!.date)}</span></div></div>;
}

function MovementChart({ months }: { months: { month: string; increases: number; decreases: number }[] }) {
  const max = Math.max(1, ...months.flatMap(m => [m.increases, m.decreases]));
  return months.length ? <div className="ac-month-chart">{months.map(m => <div key={m.month} className="ac-month"><div className="ac-month-bars"><div style={{ height: `${m.increases / max * 100}%` }} tabIndex={0} aria-label={`${m.month}: increases ${money(m.increases)}`}><span>{money(m.increases)}</span></div><div style={{ height: `${m.decreases / max * 100}%` }} tabIndex={0} aria-label={`${m.month}: decreases ${money(m.decreases)}`}><span>{money(m.decreases)}</span></div></div><small>{m.month}</small></div>)}</div> : <p className="ac-chart-empty">No movement beyond opening balances.</p>;
}
