"use client";
import { useState } from "react";
import { AnalyticsRow, groupBy } from "@/lib/analytics";
import { analyticsMoney as lkr } from "@/lib/analytics";
export function AnalyticsBreakdown({ rows }: { rows: AnalyticsRow[] }) {
  const [dimension, setDimension] = useState<"scope" | "project" | "category" | "task">("project");
  const groups = groupBy(rows, dimension);
  return <section className="panel"><div className="section-heading"><div><p className="eyebrow">Find what drives your result</p><h2>Performance breakdown</h2></div><label className="analytics-group">Group by<select value={dimension} onChange={e => setDimension(e.target.value as typeof dimension)}><option value="project">Project</option><option value="category">Category</option><option value="task">Task</option><option value="scope">Business vs personal</option></select></label></div><div className="table-wrap"><table><thead><tr><th>{dimension}</th><th>Income</th><th>Expenses</th><th>Net result</th><th>Records</th></tr></thead><tbody>{groups.map(group => <tr key={group.name}><td>{group.name}</td><td>{lkr(group.income)}</td><td>{lkr(group.expenses)}</td><td className={group.net >= 0 ? "analytics-positive" : "analytics-negative"}>{lkr(group.net)}</td><td>{group.count}</td></tr>)}{!groups.length && <tr><td colSpan={5} className="empty-cell">No confirmed income or expense records match these filters.</td></tr>}</tbody></table></div></section>;
}

