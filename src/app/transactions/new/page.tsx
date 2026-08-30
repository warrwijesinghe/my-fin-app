import { Nav } from "@/components/nav";
import { requireSession } from "@/lib/auth";
import { rows } from "@/lib/db";
import { dateValue } from "@/lib/format";
import { QuickEntry } from "@/components/quick-entry";

export const dynamic = "force-dynamic";

export default async function NewTransactionPage() {
  await requireSession();
  const [accounts, projects, tasks, categories] = await Promise.all([rows<any>("SELECT * FROM `Account` WHERE isActive=1 ORDER BY name"),rows<any>("SELECT * FROM `Project` WHERE isActive=1 ORDER BY name"),rows<any>("SELECT * FROM `Task` WHERE isActive=1 ORDER BY name"),rows<any>("SELECT * FROM `Category` WHERE isActive=1 ORDER BY name")]);
  return <><Nav /><main><div className="page-heading"><div><p className="eyebrow">Fast entry</p><h1>Add a financial record</h1><p className="muted">Choose a type first, then complete only the fields that apply.</p></div></div>
    <QuickEntry accounts={accounts} projects={projects} tasks={tasks} categories={categories} today={dateValue(new Date())} />
  </main></>;
}
