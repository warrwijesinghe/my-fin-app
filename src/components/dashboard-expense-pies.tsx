"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { lkr } from "@/lib/format";

export type ExpenseSlice = { category: string; amount: number };
export type ExpenseActivity = { activityId: string; categoryId: string | null; category: string; item: string; amount: number; household: boolean; scope: "PERSONAL" | "BUSINESS"; taxScope: "PERSONAL" | "BUSINESS" | null; transactionDate: string };

const colors = ["#c9574d", "#d78b45", "#d6b84f", "#679b77", "#4e879a", "#746ab0", "#b56b9c", "#8b7767"];

export function DashboardExpensePies({ charts, categories }: { charts: { title: string; slices: ExpenseSlice[]; activities: ExpenseActivity[] }[]; categories: { id: string; name: string }[] }) {
  const [selected, setSelected] = useState<{ chart: typeof charts[number]; category: string } | null>(null);
  return <section className="expense-pie-grid" aria-label="Expense breakdowns">
    {charts.map(chart => <ExpensePie key={chart.title} {...chart} onSelect={category => setSelected({ chart, category })} />)}
    {selected && <ExpenseDetail chart={selected.chart} category={selected.category} categories={categories} onClose={() => setSelected(null)} />}
  </section>;
}

function ExpensePie({ title, slices, onSelect }: { title: string; slices: ExpenseSlice[]; activities: ExpenseActivity[]; onSelect: (category: string) => void }) {
  const total = slices.reduce((sum, slice) => sum + slice.amount, 0);
  let offset = 0;
  return <section className="panel expense-pie-panel">
    <p className="eyebrow">This month</p>
    <h2>{title}</h2>
    {total > 0 ? <>
      <div className="expense-pie-wrap">
        <svg className="expense-pie" viewBox="0 0 42 42" role="img" aria-label={`${title}: ${slices.map(slice => `${slice.category} ${lkr(slice.amount)}`).join(", ")}`}>
          <circle className="expense-pie-track" cx="21" cy="21" r="15.9155" />
          {slices.map((slice, index) => {
            const share = slice.amount / total * 100;
            const segment = <circle key={slice.category} className="expense-pie-segment" cx="21" cy="21" r="15.9155" pathLength="100" stroke={colors[index % colors.length]} strokeDasharray={`${share} ${100 - share}`} strokeDashoffset={-offset} role="button" tabIndex={0} aria-label={`View ${slice.category} items`} onClick={() => onSelect(slice.category)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(slice.category); } }}><title>{`${slice.category}: ${lkr(slice.amount)} (${share.toFixed(1)}%)`}</title></circle>;
            offset += share;
            return segment;
          })}
        </svg>
        <div><strong>{lkr(total)}</strong><span>Total</span></div>
      </div>
      <ul className="expense-pie-legend">
        {slices.map((slice, index) => <li key={slice.category}><button type="button" onClick={() => onSelect(slice.category)} aria-label={`View ${slice.category} items`}><i style={{ backgroundColor: colors[index % colors.length] }} /><span>{slice.category}</span><b>{lkr(slice.amount)}</b></button></li>)}
      </ul>
    </> : <p className="muted expense-pie-empty">No confirmed expenses yet this month.</p>}
  </section>;
}

function ExpenseDetail({ chart, category, categories, onClose }: { chart: { title: string; activities: ExpenseActivity[] }; category: string; categories: { id: string; name: string }[]; onClose: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const items = chart.activities.filter(item => item.category === category);
  async function changeCategory(activityId: string, categoryId: string) {
    setSaving(activityId); setError("");
    try {
      const response = await fetch("/api/dashboard/expense-category", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ activityId, categoryId }) });
      if (!response.ok) throw new Error();
      router.refresh();
      onClose();
    } catch { setError("Unable to update the category. Please try again."); }
    finally { setSaving(null); }
  }
  async function changeClassification(activityId: string, patch: { scope?: "PERSONAL" | "BUSINESS"; taxScope?: "PERSONAL" | "BUSINESS" }) {
    setSaving(activityId); setError("");
    try {
      const response = await fetch("/api/dashboard/expense-category", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ activityId, ...patch }) });
      if (!response.ok) throw new Error();
      router.refresh();
      onClose();
    } catch { setError("Unable to update the expense type or tax label. Please try again."); }
    finally { setSaving(null); }
  }
  return <div className="expense-detail-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="expense-detail" role="dialog" aria-modal="true" aria-labelledby="expense-detail-title" onMouseDown={event => event.stopPropagation()}>
      <div className="section-heading"><div><p className="eyebrow">{chart.title}</p><h2 id="expense-detail-title">{category}</h2><p className="muted">Change an item’s category to update this expense breakdown.</p></div><button className="button" type="button" onClick={onClose}>Close</button></div>
      {error && <p role="alert">{error}</p>}
      <div className="expense-detail-list">{items.map(item => <div key={item.activityId}><div><strong>{item.item}</strong><span>{item.transactionDate} · {item.household ? "Household expense" : "Business expense"} · Tax label: {(item.taxScope ?? item.scope) === "BUSINESS" ? "Business" : "Household"} · {lkr(item.amount)}</span></div><div className="expense-detail-fields"><label>Category<select value={item.categoryId || ""} disabled={saving === item.activityId} onChange={event => changeCategory(item.activityId, event.target.value)}><option value="" disabled>Select category</option>{categories.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label><label>Expense type<select value={item.household ? "PERSONAL" : "BUSINESS"} disabled={saving === item.activityId} onChange={event => changeClassification(item.activityId, { scope: event.target.value as "PERSONAL" | "BUSINESS" })}><option value="PERSONAL">Household</option><option value="BUSINESS">Business</option></select></label><label>Tax label<select value={item.household ? (item.taxScope ?? item.scope) : "BUSINESS"} disabled={saving === item.activityId || !item.household} onChange={event => changeClassification(item.activityId, { taxScope: event.target.value as "PERSONAL" | "BUSINESS" })}><option value="PERSONAL">Household</option><option value="BUSINESS">Business</option></select></label></div></div>)}</div>
    </section>
  </div>;
}
