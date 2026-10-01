"use client";

import { lkr } from "@/lib/format";

type Month = { month: string; income: number; expenses: number };

export function IncomeExpenseChart({ months }: { months: Month[] }) {
  const max = Math.max(...months.flatMap(month => [month.income, month.expenses]), 1);
  const monthLabel = (month: string) => new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
  return (
    <section className="panel chart-panel" aria-labelledby="income-expense-title">
      <div className="section-heading"><div><p className="eyebrow">Last 6 months</p><h2 id="income-expense-title">Income vs expenses</h2></div></div>
      <p className="chart-legend"><span>Income</span><span>Expenses</span></p>
      <div className="bar-chart monthly-bar-chart" role="img" aria-label={months.map(month => `${monthLabel(month.month)}: income ${lkr(month.income)}, expenses ${lkr(month.expenses)}`).join("; ")}>
        {months.map(month => <div className="month-bar-group" key={month.month}><div className="month-bars" title={`${monthLabel(month.month)}: income ${lkr(month.income)}, expenses ${lkr(month.expenses)}`}><div className="bar income" style={{ height: `${month.income / max * 100}%` }} /><div className="bar expense" style={{ height: `${month.expenses / max * 100}%` }} /></div><small>{monthLabel(month.month)}</small></div>)}
      </div>
    </section>
  );
}
