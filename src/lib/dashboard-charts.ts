import { RowDataPacket } from "mysql2";
import { rows } from "@/lib/db";
import type { AccountBalance } from "@/lib/types";

export type DashboardTrend = { month: string; position: number; cashAndBank: number; availableToSpend: number; liabilities: number; netMovement: number };

function monthKeys(count = 6) {
  const cursor = new Date();
  cursor.setUTCDate(1);
  cursor.setUTCHours(0, 0, 0, 0);
  const months: string[] = [];
  for (let index = count - 1; index >= 0; index--) {
    const month = new Date(cursor);
    month.setUTCMonth(month.getUTCMonth() - index);
    months.push(month.toISOString().slice(0, 7));
  }
  return months;
}

export async function getDashboardTrends(accounts: AccountBalance[], receivables: number, creditors: number): Promise<DashboardTrend[]> {
  const months = monthKeys();
  const start = `${months[0]}-01`;
  const [entries, activity] = await Promise.all([
    rows<RowDataPacket>("SELECT accountId,DATE_FORMAT(entryDate,'%Y-%m') month,COALESCE(SUM(amount),0) amount FROM AccountEntry WHERE entryDate>=? GROUP BY accountId,DATE_FORMAT(entryDate,'%Y-%m')", [start]),
    rows<RowDataPacket>("SELECT DATE_FORMAT(transactionDate,'%Y-%m') month,COALESCE(SUM(CASE WHEN type='INCOME' THEN amount ELSE -amount END),0) amount FROM FinancialTransaction WHERE status='POSTED' AND type IN ('INCOME','EXPENSE','ACCRUED_EXPENSE') AND transactionDate>=? GROUP BY DATE_FORMAT(transactionDate,'%Y-%m')", [start])
  ]);
  const entriesByMonth = new Map<string, Map<string, number>>();
  for (const entry of entries) {
    const byAccount = entriesByMonth.get(String(entry.month)) ?? new Map<string, number>();
    byAccount.set(String(entry.accountId), Number(entry.amount));
    entriesByMonth.set(String(entry.month), byAccount);
  }
  const movementByMonth = new Map(activity.map(row => [String(row.month), Number(row.amount)]));
  const balances = new Map(accounts.map(account => [account.id, account.balance]));
  const result = new Array<DashboardTrend>(months.length);
  for (let index = months.length - 1; index >= 0; index--) {
    const balanceFor = (type: string) => accounts.filter(account => account.type === type).reduce((total, account) => total + (balances.get(account.id) ?? 0), 0);
    const cash = balanceFor("CASH"), bank = balanceFor("BANK"), savings = balanceFor("SAVINGS");
    const loans = accounts.filter(account => account.type === "LOAN").reduce((total, account) => total + Math.max(balances.get(account.id) ?? 0, 0), 0);
    const cards = accounts.filter(account => account.type === "CREDIT_CARD").reduce((total, account) => total + Math.max(balances.get(account.id) ?? 0, 0), 0);
    const cardSpend = accounts.filter(account => account.type === "CREDIT_CARD").reduce((total, account) => total + Math.max(0, (account.creditLimit ?? 0) - Math.max(balances.get(account.id) ?? 0, 0)), 0);
    const cashAndBank = cash + bank;
    result[index] = { month: months[index], cashAndBank, availableToSpend: cashAndBank + cardSpend, liabilities: loans + cards + creditors, position: cashAndBank + savings + receivables - loans - cards - creditors, netMovement: movementByMonth.get(months[index]) ?? 0 };
    for (const [accountId, amount] of entriesByMonth.get(months[index]) ?? []) balances.set(accountId, (balances.get(accountId) ?? 0) - amount);
  }
  return result;
}
