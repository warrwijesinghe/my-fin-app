import { Nav } from "@/components/nav";
import { requireSession } from "@/lib/auth";
import { cashName } from "@/lib/access";
import { rows, familyPaymentAccounts } from "@/lib/db";
import { dateValue } from "@/lib/format";
import { QuickEntry } from "@/components/quick-entry";
import { TransactionTable } from "@/components/transaction-table";

export const dynamic = "force-dynamic";

export default async function NewTransactionPage({searchParams}:{searchParams:Promise<{household?:string;error?:string;scope?:string;from?:string;to?:string;updated?:string}>}) {
  const viewer=await requireSession();
  const params=await searchParams;
  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Colombo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const validDate=(value:string|undefined)=>Boolean(value&&/^\d{4}-\d{2}-\d{2}$/.test(value));
  const from=validDate(params.from)?params.from!:`${today.slice(0,7)}-01`,to=validDate(params.to)?params.to!:today;
  const [accounts, projects, tasks, categories, items, parties, transactions] = await Promise.all([
    familyPaymentAccounts<any>(),rows<any>("SELECT * FROM `Project` WHERE isActive=1 ORDER BY name"),rows<any>("SELECT * FROM `Task` WHERE isActive=1 ORDER BY name"),rows<any>("SELECT * FROM `Category` WHERE isActive=1 ORDER BY name"),rows<any>("SELECT * FROM Item WHERE isActive=1 ORDER BY name"),rows<any>("SELECT * FROM Party WHERE isActive=1 ORDER BY name"),
    rows<any>(`SELECT t.id,t.type,t.amount,t.transactionDate,t.description,t.counterparty,t.household,
      a.name accountName,a.isSharedCash accountShared,d.name destinationName,d.isSharedCash destinationShared,p.name partyName
      FROM FinancialTransaction t LEFT JOIN Account a ON a.id=t.accountId LEFT JOIN Account d ON d.id=t.destinationAccountId LEFT JOIN Party p ON p.id=t.partyId
      WHERE t.status='POSTED' AND t.transactionDate>=? AND t.transactionDate<=? ORDER BY t.transactionDate DESC,t.createdAt DESC LIMIT 200`,[from,to])
  ]);
  return <><Nav/><main>
    {params.error&&<p className="analytics-alert" role="alert">Unable to save. Check the account, category, item amounts and units. Transfers must use your own money. Inactive items must be reactivated in Item Master.</p>}
    {params.updated&&<p role="status">Transaction updated.</p>}
    <QuickEntry initialScope={params.scope==="BUSINESS"?"BUSINESS":"PERSONAL"} parties={parties} items={items} initialOwner={viewer} initialHousehold={params.household==="1"} accounts={accounts.map(a=>({...a,name:a.isSharedCash?cashName(a.owner,viewer):a.name}))} projects={projects} tasks={tasks} categories={categories} today={dateValue(new Date())}/>
    <TransactionTable from={from} to={to} rows={transactions}/>
  </main></>;
}
