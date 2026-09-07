import { Nav } from "@/components/nav";
import { requireSession } from "@/lib/auth";
import { rows } from "@/lib/db";
import { dateValue } from "@/lib/format";
import { QuickEntry } from "@/components/quick-entry";

export const dynamic = "force-dynamic";

export default async function NewTransactionPage({searchParams}:{searchParams:Promise<{owner?:string;household?:string;error?:string;scope?:string}>}) {
  await requireSession();
  const params=await searchParams;
  const [accounts, projects, tasks, categories, items, parties] = await Promise.all([rows<any>("SELECT * FROM `Account` WHERE isActive=1 ORDER BY name"),rows<any>("SELECT * FROM `Project` WHERE isActive=1 ORDER BY name"),rows<any>("SELECT * FROM `Task` WHERE isActive=1 ORDER BY name"),rows<any>("SELECT * FROM `Category` WHERE isActive=1 ORDER BY name"),rows<any>("SELECT * FROM Item WHERE isActive=1 ORDER BY name"),rows<any>("SELECT * FROM Party WHERE isActive=1 ORDER BY name")]);
  return <><Nav /><main>{params.error&&<p className="analytics-alert" role="alert">Unable to save. Check the account, category, item amounts and units. Wife accounts support Personal expenses only. Inactive items must be reactivated in Item Master.</p>}<QuickEntry initialScope={params.scope==="BUSINESS"?"BUSINESS":"PERSONAL"} parties={parties} items={items} initialOwner={params.owner==="WIFE"?"WIFE":"ME"} initialHousehold={params.household==="1"} accounts={accounts} projects={projects} tasks={tasks} categories={categories} today={dateValue(new Date())} />
  </main></>;
}

