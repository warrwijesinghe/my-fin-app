"use client";
import { AnalyticsRow, groupBy, summarize } from "@/lib/analytics";
export function ExportIncomeStatement({ rows, context }: { rows: AnalyticsRow[]; context: string }) {
  function download() {
    const total = summarize(rows);
    const data = [["Income statement", context], ["Currency", "LKR"], ["Category", "Income", "Expenses", "Net"], ...groupBy(rows,"category").map(row => [row.name,row.income.toFixed(2),row.expenses.toFixed(2),row.net.toFixed(2)]), ["Total",total.income.toFixed(2),total.expenses.toFixed(2),total.net.toFixed(2)], ["Basis", "Confirmed income and recorded expenses including pay-later bills. Excludes transfers, debt payments, opening balances, adjustments, pending and void records."]];
    const csv = data.map(row => row.map(cell => { const text = String(cell); const safe = /^[=+@\t\r]/.test(text) ? `'${text}` : text; return `"${safe.replaceAll('"','""')}"`; }).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], {type:"text/csv;charset=utf-8"}));
    const link = document.createElement("a"); link.href = url; link.download = "income-statement.csv"; link.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
  }
  return <button className="button" type="button" onClick={download}>Download CSV</button>;
}
