export const ACCOUNT_TYPES = ["CASH", "BANK", "SAVINGS", "CREDIT_CARD", "LOAN"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];
export const SCOPES = ["PERSONAL", "BUSINESS"] as const;
export type MoneyScope = (typeof SCOPES)[number];
export type Owner = "ME" | "WIFE";
export type TransactionType = "INCOME" | "EXPENSE" | "TRANSFER" | "ACCRUED_EXPENSE" | "DEBT_PAYMENT" | "OPENING_BALANCE" | "ADJUSTMENT";
export type TransactionStatus = "PENDING_REVIEW" | "POSTED" | "VOID";

export type AccountBalance = {
  id: string; name: string; type: AccountType; scope: MoneyScope; holder: string | null;
  creditLimit: number | null; includeInAvailable: number | boolean; isActive: number | boolean; balance: number;
  owner?: Owner;
};
