import type { Owner } from "./types";

export type ReadScope = "private" | "household" | "cash" | "shared" | "family";
export const personName = (owner: string) => owner === "WIFE" ? "Sudu Manike" : "Ayya";
export function cashName(owner: string, viewer: string) {
  return owner === "ME" ? (viewer === "ME" ? "Cash at Sudu Manike" : "Ayya Cash") : (viewer === "WIFE" ? "Cash at Ayya" : "Sudu Manike Cash");
}

// All application SELECTs pass through this boundary, including transaction locks.
// Only these fixed table identifiers are rewritten; values remain bound parameters.
// Writes are authorized by locking/reading their target through the same boundary.
export function scopeSelect(sql: string, owner: Owner, scope: ReadScope = "private") {
  if (!/^\s*SELECT\b/i.test(sql)) throw new Error("Expected a SELECT query");
  const own = `owner='${owner}'`;
  const cash = "SELECT id FROM Account WHERE isSharedCash=1";
  const sharedTx = `(accountId IN (${cash}) OR destinationAccountId IN (${cash}))`;
  const tx = scope === "shared" ? `(${own} OR household=1 OR ${sharedTx})` : scope === "household" ? `(${own} OR household=1)` : scope === "cash" ? `(${own} OR ${sharedTx})` : own;
  const txIds = `SELECT id FROM FinancialTransaction WHERE ${tx}`;
  const filters: Record<string,string> = {
    Account: scope === "family" ? "1=1" : scope !== "private" ? `(${own} OR isSharedCash=1)` : own,
    FinancialTransaction: tx, IncomeExpenseActivity: own, CreditOutstanding: own,
    Project: own, Task: "1=1", Party: "1=1", Category: "1=1", FinancialGoal: own, AppSetting: own,
    Item: "1=1",
    ExpenseLine: `transactionId IN (${txIds})`,
    AccountEntry: `accountId IN (SELECT id FROM Account WHERE ${scope === "cash" ? `(${own} OR isSharedCash=1)` : own})`,
    AccruedExpense: scope === "household" || scope === "shared" ? `(${own} OR id IN (SELECT accrualId FROM FinancialTransaction WHERE household=1))` : own,
    PartyEntry: `transactionId IN (${txIds})`,
    AuditLog: `transactionId IN (${txIds})`,
  };
  const tables = Object.keys(filters).join("|");
  const pattern = new RegExp("\\b(FROM|JOIN)\\s+`?(" + tables + ")`?(?=\\s|\\)|$)(?:\\s+(?:AS\\s+)?((?!(?:WHERE|LEFT|RIGHT|INNER|OUTER|JOIN|ON|GROUP|ORDER|LIMIT|FOR|UNION|HAVING|SET|CROSS)\\b)[A-Za-z_][A-Za-z0-9_]*))?", "gi");
  return sql.replace(pattern, (_match, join: string, table: string, alias: string | undefined) => {
    const name = Object.keys(filters).find(k => k.toLowerCase() === table.toLowerCase())!;
    // A shared task may be attached to a private project. Share the task while
    // keeping the other person's project identifier out of forms and responses.
    if (name === "Task") return `${join} (SELECT id,name,scope,owner,isActive,createdAt,CASE WHEN projectId IN (SELECT id FROM Project WHERE ${own}) THEN projectId ELSE NULL END AS projectId FROM Task) ${alias || "Task"}`;
    return `${join} (SELECT * FROM \`${name}\` WHERE ${filters[name]}) ${alias || `\`${name}\``}`;
  });
}
