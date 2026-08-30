import { MasterData } from "@/components/master-data";
import { Nav } from "@/components/nav";
import { requireSession } from "@/lib/auth";
import { rows } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function MasterDataPage() {
  await requireSession();
  const [projects, categories, tasks] = await Promise.all([
    rows<any>("SELECT id,name,isActive FROM `Project` ORDER BY isActive DESC,name"),
    rows<any>("SELECT id,name,scope,isActive FROM `Category` ORDER BY isActive DESC,name"),
    rows<any>("SELECT id,name,scope,projectId,isActive FROM `Task` ORDER BY isActive DESC,name"),
  ]);
  return <><Nav /><main><div className="page-heading"><div><p className="eyebrow">Setup and maintenance</p><h1>Master data</h1><p className="muted">Create, edit, deactivate, or delete the records used when entering transactions.</p></div></div><MasterData categories={categories} projects={projects} tasks={tasks} /></main></>;
}
