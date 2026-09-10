import Link from "next/link";
import { RowDataPacket } from "mysql2";
import { Nav } from "@/components/nav";
import { ExportTaxReport } from "@/components/export-tax-report";
import { requireSession } from "@/lib/auth";
import { rows } from "@/lib/db";
import { analyticsMoney as lkr, groupBy, validDate } from "@/lib/analytics";
import { incomeTaxReport, taxLabel, TaxTransaction } from "@/lib/tax-report";
import { MoneyScope } from "@/lib/types";

export const dynamic = "force-dynamic";
const label = (scope: MoneyScope) => scope === "BUSINESS" ? "Business" : "Personal";

export default async function TaxReports({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer=await requireSession();
  const params = await searchParams;
  const text = (key: string) => typeof params[key] === "string" ? params[key] as string : "";
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const start = text("start") || `${today.slice(0, 4)}-01-01`, end = text("end") || today;
  const valid = validDate(start) && validDate(end) && start <= end;
  const scope: MoneyScope = text("taxScope") === "PERSONAL" ? "PERSONAL" : "BUSINESS";
  const transactions = valid ? await rows<RowDataPacket & TaxTransaction>(`
    SELECT t.owner,t.id,t.transactionDate,t.type,t.status,t.description,t.amount,t.scope,t.taxScope,COALESCE(c.name,'Uncategorized') category
    FROM FinancialTransaction t LEFT JOIN Category c ON c.id=t.categoryId
    WHERE t.status='POSTED' AND t.type IN ('INCOME','EXPENSE','ACCRUED_EXPENSE') AND t.transactionDate>=? AND t.transactionDate<=?
    ORDER BY t.transactionDate,t.createdAt,t.id`, [start, end]) : [];
  const activity = valid ? await rows<RowDataPacket & TaxTransaction>("SELECT t.activityId id,t.owner,t.transactionDate,t.type,t.status,t.description,t.amount,t.scope,t.taxScope,COALESCE(c.name,'Uncategorized') category FROM IncomeExpenseActivity t LEFT JOIN Category c ON c.id=t.categoryId WHERE t.status='POSTED' AND t.type IN ('INCOME','EXPENSE','ACCRUED_EXPENSE') AND t.transactionDate>=? AND t.transactionDate<=? ORDER BY t.transactionDate,t.createdAt",[start,end]) : [];
  const report = incomeTaxReport(activity, scope, viewer);
  const categories = groupBy(report.data, "category");

  return <><Nav /><main className="analytics-page">
    <div className="page-heading"><div><p className="eyebrow">Tax reporting</p><h1>Income tax reports</h1><p className="muted">Separate business and personal income and expenses using the tax label.</p></div><Link className="button" href="/analytics">Actual-label analytics</Link></div>
    <section className="panel"><form className="analytics-filters" action="/reports/tax">
      <label>From<input type="date" name="start" defaultValue={validDate(start) ? start : ""} required /></label>
      <label>To<input type="date" name="end" defaultValue={validDate(end) ? end : ""} required /></label>
      <label>Tax label<select name="taxScope" defaultValue={scope}><option value="BUSINESS">Business</option><option value="PERSONAL">Personal</option></select></label>
      <button className="button primary" type="submit">Generate tax report</button>
    </form><p className="analytics-note">Dates are inclusive. Choose the dates for your reporting period. Dashboards, analytics and ordinary income statements continue to use the actual label.</p></section>
    {!valid && <p className="analytics-alert" role="alert">Choose valid dates with the From date on or before the To date.</p>}
    {valid && <>
      <section className="panel"><div className="section-heading"><div><h2>{label(scope)} income tax report</h2><p className="muted">{start} to {end} · Tax label: {label(scope)} · {report.total.count} activity lines</p></div><ExportTaxReport owner={viewer} transactions={report.transactions} scope={scope} start={start} end={end} /></div>
        <div className="table-wrap"><table><thead><tr><th>Category</th><th>Income</th><th>Expenses</th><th>Net</th></tr></thead><tbody>{categories.map(item => <tr key={item.name}><td>{item.name}</td><td>{lkr(item.income)}</td><td>{lkr(item.expenses)}</td><td>{lkr(item.net)}</td></tr>)}{!categories.length && <tr><td colSpan={4}>No transactions with this tax label in this period.</td></tr>}</tbody><tfoot><tr><th>Total</th><td>{lkr(report.total.income)}</td><td>{lkr(report.total.expenses)}</td><td>{lkr(report.total.net)}</td></tr></tfoot></table></div>
        <p className="analytics-note">Includes posted income and expenses, including pay-later bills when recorded. Excludes transfers, debt payments, opening balances, adjustments, pending and void records. This report classifies records; it does not calculate tax or determine deductibility.</p>
        <details><summary>View included transactions ({report.total.count})</summary><div className="table-wrap"><table><thead><tr><th>Date</th><th>Description</th><th>Actual label</th><th>Tax label</th><th>Income</th><th>Expenses</th></tr></thead><tbody>{report.transactions.map(item => <tr key={item.id}><td>{item.transactionDate.slice(0, 10)}</td><td>{item.description || item.type.replaceAll("_", " ")}</td><td>{label(item.scope)}</td><td>{label(taxLabel(item))}</td><td>{item.type === "INCOME" ? lkr(item.amount) : "—"}</td><td>{item.type !== "INCOME" ? lkr(item.amount) : "—"}</td></tr>)}</tbody></table></div></details>
      </section>
      <section className="panel" id="tax-labels"><h2>Manage tax labels</h2><p className="muted">All posted income and expenses in this period, across both tax labels. Change a tax label to include a transaction in the corresponding tax report. Its actual label stays the same.</p>
        {params.saved && <p role="status">Tax label saved. The report above has been updated.</p>}{params.error && <p role="alert">Unable to update the tax label. Choose Business or Personal for an existing posted income or expense.</p>}
        <div className="table-wrap"><table><thead><tr><th>Date</th><th>Description</th><th>Type</th><th>Amount</th><th>Actual label</th><th>Tax label</th></tr></thead><tbody>{transactions.map(item => <tr key={item.id}><td>{item.transactionDate.slice(0, 10)}</td><td>{item.description || item.category}</td><td>{item.type.replaceAll("_", " ")}</td><td>{lkr(item.amount)}</td><td>{label(item.scope)}</td><td><form action={`/api/transactions/${item.id}/tax-label`} method="post" className="report-picker"><input type="hidden" name="start" value={start} /><input type="hidden" name="end" value={end} /><input type="hidden" name="reportScope" value={scope} /><select aria-label={`Tax label for ${item.description || item.category} on ${item.transactionDate.slice(0, 10)}`} name="taxScope" defaultValue={taxLabel(item)}><option value="BUSINESS">Business</option><option value="PERSONAL">Personal</option></select><button type="submit" className="button">Save</button></form></td></tr>)}{!transactions.length && <tr><td colSpan={6}>No posted income or expenses in this period.</td></tr>}</tbody></table></div>
      </section>
    </>}
  </main></>;
}
