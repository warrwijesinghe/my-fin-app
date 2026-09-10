import { MoneyScope } from "./types";
import { AnalyticsRow, summarize } from "./analytics";

export type TaxTransaction = {
  owner?: "ME"|"WIFE"; id: string; transactionDate: string; type: string; status: string;
  description: string | null; amount: number | string;
  scope: MoneyScope; taxScope: MoneyScope | null; category: string;
};

export const taxLabel = (row: TaxTransaction): MoneyScope => row.taxScope ?? row.scope;
export const isIncomeExpense = (row: TaxTransaction) => row.status === "POSTED" && ["INCOME", "EXPENSE", "ACCRUED_EXPENSE"].includes(row.type);

export function incomeTaxReport(transactions: TaxTransaction[], scope: MoneyScope, owner: "ME"|"WIFE" = "ME") {
  const selected = transactions.filter(row => (row.owner??"ME")===owner && isIncomeExpense(row) && taxLabel(row) === scope);
  const data: AnalyticsRow[] = selected.map(row => ({
    month: row.transactionDate.slice(0, 7), scope: taxLabel(row), category: row.category,
    project: "", task: "", count: 1,
    income: row.type === "INCOME" ? Number(row.amount) : 0,
    expenses: row.type === "INCOME" ? 0 : Number(row.amount),
  }));
  return { transactions: selected, data, total: summarize(data) };
}

export function incomeTaxCsv(transactions: TaxTransaction[], scope: MoneyScope, start: string, end: string, owner: "ME"|"WIFE" = "ME") {
  const report = incomeTaxReport(transactions, scope, owner);
  const data = [
    ["Income tax report", scope], ["Period", start, end], ["Currency", "LKR"],
    ["Classification basis", "Tax label"],
    ["Date", "Description", "Category", "Actual label", "Tax label", "Type", "Income", "Expenses"],
    ...report.transactions.map(row => [row.transactionDate.slice(0, 10), row.description ?? "", row.category, row.scope, taxLabel(row), row.type, row.type === "INCOME" ? Number(row.amount).toFixed(2) : "", row.type !== "INCOME" ? Number(row.amount).toFixed(2) : ""]),
    ["Total income", report.total.income.toFixed(2)], ["Total expenses", report.total.expenses.toFixed(2)], ["Net income less expenses", report.total.net.toFixed(2)],
    ["Basis", "Posted income and expenses, including pay-later bills when recorded. Transfers, debt payments, opening balances, adjustments, pending and void records excluded. This report classifies records; it does not calculate tax or determine deductibility."],
  ];
  return "\uFEFF" + data.map(row => row.map(value => {
    const safe = /^[\s]*[=+@-]|^[\t\r\n]/.test(value) ? `'${value}` : value;
    return `"${safe.replaceAll('"', '""')}"`;
  }).join(",")).join("\r\n");
}
