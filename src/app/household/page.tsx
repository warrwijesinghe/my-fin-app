import { Nav } from "@/components/nav";
import { Household } from "@/components/household";
import { requireSession } from "@/lib/auth";
import { householdRows as rows } from "@/lib/db";
import { monthOffset, monthEnd, validMonth } from "@/lib/household";
export const dynamic="force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<{month?:string;error?:string;saved?:string;created?:string;deleted?:string}>}) {
  const viewer=await requireSession();const params=await searchParams;
  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Colombo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const month=params.month&&validMonth(params.month)?params.month:today.slice(0,7);
  const [lines,budgets,categories,unpaid]=await Promise.all([
    rows<any>(`SELECT COALESCE(l.id,t.id) id,t.id transactionId,t.transactionDate,t.description,t.owner,t.spentBy,t.type,t.status,t.household,
      COALESCE(l.amount,t.amount) amount,COALESCE(l.categoryId,t.categoryId) categoryId,COALESCE(c.name,'Uncategorized') category,
      l.itemId,i.name item,l.quantity,l.unit,a.name account
      FROM FinancialTransaction t LEFT JOIN ExpenseLine l ON l.transactionId=t.id
      LEFT JOIN Item i ON i.id=l.itemId LEFT JOIN Category c ON c.id=COALESCE(l.categoryId,t.categoryId)
      LEFT JOIN Account a ON a.id=t.accountId
      WHERE t.status='POSTED' AND t.type IN ('EXPENSE','ACCRUED_EXPENSE') AND t.transactionDate>=? AND t.transactionDate<=?
      ORDER BY t.transactionDate DESC,t.createdAt DESC,l.id`,[`${monthOffset(month,-5)}-01`,monthEnd(month)]),
    rows<any>("SELECT * FROM HouseholdBudget WHERE month=?",[month]),
    rows<any>("SELECT id,name FROM Category WHERE kind='EXPENSE' ORDER BY name"),
    rows<any>("SELECT t.id,t.owner,t.description,a.dueDate,GREATEST(a.amount-a.paidAmount,0) amount FROM FinancialTransaction t JOIN AccruedExpense a ON a.id=t.accrualId WHERE t.household=1 AND t.status='POSTED' AND a.status IN ('OPEN','PARTIALLY_PAID') AND a.amount>a.paidAmount ORDER BY a.dueDate")
  ]);
  return <><Nav/><main className="household-page"><Household key={month} viewer={viewer} month={month} today={today} lines={lines} budgets={budgets} categories={categories} unpaid={unpaid} notice={params.error?"Unable to save. Check the values and try again.":params.deleted?"Entry deleted and balances updated.":params.saved?"Changes saved.":params.created?"Expense saved.":""}/></main></>;
}
