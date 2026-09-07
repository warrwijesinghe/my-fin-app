import { RowDataPacket } from "mysql2";
import { rows } from "@/lib/db";
import { AccountBalance, MoneyScope } from "@/lib/types";

type DbAccount = RowDataPacket & Omit<AccountBalance, "balance"> & { balance: number | string };
const assetTypes = ["CASH", "BANK", "SAVINGS"], debtTypes = ["CREDIT_CARD", "LOAN"];
export async function getAccountBalances() { const items = await rows<DbAccount>("SELECT a.*, COALESCE(SUM(e.amount),0) balance FROM `Account` a LEFT JOIN `AccountEntry` e ON e.accountId=a.id WHERE a.isActive=1 GROUP BY a.id ORDER BY a.scope,a.name"); return items.map((a) => ({ ...a, balance:Number(a.balance), creditLimit:a.creditLimit == null ? null : Number(a.creditLimit), includeInAvailable:Boolean(a.includeInAvailable) })) as AccountBalance[]; }
export async function getDashboardData(scope?: MoneyScope) {
  const accounts=(await getAccountBalances()).filter(a=>a.owner!=="WIFE"), filtered=scope?accounts.filter(a=>a.scope===scope):accounts, where=scope?" AND scope=?":"", values=scope?[scope]:[], start=new Date(); start.setDate(1);
  const date=start.toISOString().slice(0,10); const totals=await rows<RowDataPacket>(`SELECT type,COALESCE(SUM(amount),0) amount FROM \`FinancialTransaction\` WHERE owner='ME' AND status='POSTED' AND transactionDate>=?${where} GROUP BY type`,[date,...values]); const [pending]=await rows<RowDataPacket>("SELECT COUNT(*) count FROM `FinancialTransaction` WHERE owner='ME' AND status='PENDING_REVIEW'"); const [accrual]=await rows<RowDataPacket>(`SELECT COALESCE(SUM(amount-paidAmount),0) amount FROM \`AccruedExpense\` WHERE owner='ME' AND status IN ('OPEN','PARTIALLY_PAID')${where}`,values);
  const amount=(t:string)=>Number(totals.find((x:RowDataPacket)=>x.type===t)?.amount??0), assets=filtered.filter(a=>assetTypes.includes(a.type)).reduce((s,a)=>s+a.balance,0), availableCash=filtered.filter(a=>assetTypes.includes(a.type)&&a.includeInAvailable).reduce((s,a)=>s+a.balance,0), debt=filtered.filter(a=>debtTypes.includes(a.type)).reduce((s,a)=>s+Math.max(a.balance,0),0), outstandingAccruals=Number(accrual?.amount??0), income=amount("INCOME"), expenses=amount("EXPENSE")+amount("ACCRUED_EXPENSE");
  return {accounts:filtered,assets,availableCash,debt,outstandingAccruals,overallPosition:assets-debt-outstandingAccruals,income,expenses,netMovement:income-expenses,pending:Number(pending?.count??0)};
}
