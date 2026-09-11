import type { AccountType } from "./types";

/**
 * Account assets and liabilities use opposite signs. A positive card or loan
 * balance is owed, while a negative one is an overpayment/credit.
 */
export function isDebtBalance(type?: AccountType | string) {
  return type === "CREDIT_CARD" || type === "LOAN";
}

export function accountBalanceClass(balance: number, type?: AccountType | string) {
  if (isDebtBalance(type)) return balance > 0 ? "balance-negative" : "balance-positive";
  return balance < 0 ? "balance-negative" : "balance-positive";
}
