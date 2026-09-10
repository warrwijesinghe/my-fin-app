import type { AccountBalance } from "./types";

export type AccountEntry = {
  id: string; transactionId: string; entryDate: string; createdAt: string;
  amount: number; type: string; status: string; description: string | null;
  counterparty: string | null; scope: string; category: string | null;
  expenseBreakdown?: {category:string;amount:number}[]; project: string | null; task: string | null; source: string | null; destination: string | null;
};
export type StatementEntry = AccountEntry & { balance: number };
export const isDebtAccount = (type: string) => type === "CREDIT_CARD" || type === "LOAN";
const cents = (amount: number) => Math.round(amount * 100);

// Compute balances before applying date, text, or pagination filters.
export function buildStatement(entries: AccountEntry[]): StatementEntry[] {
  let balance = 0;
  return [...entries].sort((a, b) => a.entryDate.localeCompare(b.entryDate) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)).map(entry => {
    balance += cents(entry.amount);
    return { ...entry, balance: balance / 100 };
  });
}

export function summarizeStatement(statement: StatementEntry[], from = "", to = "") {
  const before = from ? statement.filter(row => row.entryDate < from) : [];
  const entries = statement.filter(row => (!from || row.entryDate >= from) && (!to || row.entryDate <= to));
  const opening = before.at(-1)?.balance ?? 0;
  const closing = entries.at(-1)?.balance ?? opening;
  const sum = (predicate: (row: StatementEntry) => boolean) => entries.filter(predicate).reduce((total, row) => total + cents(Math.abs(row.amount)), 0) / 100;
  const categories = new Map<string, number>();
  const months = new Map<string, { month: string; increases: number; decreases: number }>();
  const days = new Map<string, number>();
  for (const row of entries) {
    days.set(row.entryDate, row.balance);
    if (row.type === "EXPENSE") { for(const line of row.expenseBreakdown?.length ? row.expenseBreakdown : [{category:row.category||"Uncategorized",amount:Math.abs(row.amount)}]) categories.set(line.category,(categories.get(line.category)??0)+cents(Number(line.amount))); }
    // Opening balances establish the account, rather than represent period activity.
    if (row.type === "OPENING_BALANCE") continue;
    const month = row.entryDate.slice(0, 7);
    const item = months.get(month) ?? { month, increases: 0, decreases: 0 };
    if (row.amount > 0) item.increases += cents(row.amount);
    else item.decreases += cents(-row.amount);
    months.set(month, item);
  }
  return {
    entries, opening, closing,
    increases: sum(row => row.amount > 0), decreases: sum(row => row.amount < 0),
    income: sum(row => row.type === "INCOME"), expenses: sum(row => row.type === "EXPENSE"),
    categories: [...categories].map(([name, amount]) => ({ name, amount: amount / 100 })).sort((a, b) => b.amount - a.amount),
    months: [...months.values()].map(row => ({ ...row, increases: row.increases / 100, decreases: row.decreases / 100 })),
    days: [...days].map(([date, balance]) => ({ date, balance })),
  };
}

export function portfolioTotals(accounts: AccountBalance[], owner: "ME"|"WIFE" = "ME") {
  accounts = accounts.filter(a=>(a.owner??"ME")===owner);
  const sum = (items: AccountBalance[], value: (a: AccountBalance) => number) => items.reduce((total, a) => total + cents(value(a)), 0) / 100;
  const assets = sum(accounts.filter(a => !isDebtAccount(a.type)), a => a.balance);
  const debt = sum(accounts.filter(a => isDebtAccount(a.type)), a => a.balance);
  const available = sum(accounts.filter(a => a.isActive && a.includeInAvailable && !isDebtAccount(a.type)), a => a.balance);
  return { assets, debt, available, net: (cents(assets) - cents(debt)) / 100 };
}
