import { Nav } from "@/components/nav";
import { requireSession } from "@/lib/auth";
import { cashName } from "@/lib/access";
import { rows, cashRows } from "@/lib/db";
import { dateValue } from "@/lib/format";
import { QuickEntry } from "@/components/quick-entry";

export const dynamic = "force-dynamic";

export default async function NewTransactionPage({searchParams}:{searchParams:Promise<{owner?:string;household?:string;error?:string;scope?:string}>}) {
  const viewer=await requireSession();
  const params=await searchParams;
  const [accounts, projects, tasks, categories, items, parties] = await Promise.all([cashRows<any>("SELECT * FROM `Account` WHERE isActive=1 ORDER BY name"),rows<any>("SELECT * FROM `Project` WHERE isActive=1 ORDER BY name"),rows<any>("SELECT * FROM `Task` WHERE isActive=1 ORDER BY name"),rows<any>("SELECT * FROM `Category` WHERE isActive=1 ORDER BY name"),rows<any>("SELECT * FROM Item WHERE isActive=1 ORDER BY name"),rows<any>("SELECT * FROM Party WHERE isActive=1 ORDER BY name")]);
  return <><Nav /><main>{params.error&&<p className="analytics-alert" role="alert">Unable to save. Check the account, category, item amounts and units. Transfers must use your own money. Inactive items must be reactivated in Item Master.</p>}<QuickEntry initialScope={params.scope==="BUSINESS"?"BUSINESS":"PERSONAL"} parties={parties} items={items} initialOwner={viewer} initialHousehold={params.household==="1"} accounts={accounts.map(a=>({...a,name:a.isSharedCash?cashName(a.owner,viewer):a.name}))} projects={projects} tasks={tasks} categories={categories} today={dateValue(new Date())} />
  </main></>;
}

