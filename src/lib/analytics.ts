export type AnalyticsRow = {
  month: string; scope: string; project: string; category: string; task: string;
  income: number; expenses: number; count: number;
};
export function summarize(items: AnalyticsRow[]) {
  const income = items.reduce((sum, row) => sum + Math.round(Number(row.income) * 100), 0) / 100;
  const expenses = items.reduce((sum, row) => sum + Math.round(Number(row.expenses) * 100), 0) / 100;
  return { income, expenses, net: Math.round((income - expenses) * 100) / 100, count: items.reduce((sum, row) => sum + Number(row.count), 0) };
}
export function groupBy(items: AnalyticsRow[], dimension: "month" | "scope" | "project" | "category" | "task") {
  const groups = new Map<string, AnalyticsRow[]>();
  for (const row of items) groups.set(row[dimension], [...(groups.get(row[dimension]) ?? []), row]);
  return [...groups].map(([name, rows]) => ({ name, ...summarize(rows) })).sort((a, b) => dimension === "month" ? a.name.localeCompare(b.name) : b.net - a.net);
}
export function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function goalMetrics(netWorth: number, debt: number, target: number, monthlyDebt: number, monthlyWealth: number) {
  const gap = Math.max(0, target - netWorth);
  return { gap, progress: Math.max(0, Math.min(100, netWorth / target * 100)), debtMonths: debt <= 0 ? 0 : monthlyDebt > 0 ? Math.ceil(debt / monthlyDebt) : null, wealthMonths: gap <= 0 ? 0 : monthlyWealth > 0 ? Math.ceil(gap / monthlyWealth) : null };
}
export function analyticsMoney(value: number | string) {
  return new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(Number(value)));
}
