"use client";

import { lkr } from "@/lib/format";

export function IncomeExpenseChart({ income, expenses }: { income: number; expenses: number }) {
  const max = Math.max(income, expenses, 1);
  return (
    <section className="panel chart-panel" aria-labelledby="income-expense-title">
      <div className="section-heading"><div><p className="eyebrow">This month</p><h2 id="income-expense-title">Income vs expenses</h2></div></div>
      <div className="bar-chart" role="img" aria-label={`Income ${lkr(income)} and expenses ${lkr(expenses)}`}>
        <div className="bar-group"><div className="bar income" style={{ height: `${(income / max) * 100}%` }} /><strong>{lkr(income)}</strong><span>Income</span></div>
        <div className="bar-group"><div className="bar expense" style={{ height: `${(expenses / max) * 100}%` }} /><strong>{lkr(expenses)}</strong><span>Expenses</span></div>
      </div>
    </section>
  );
}
