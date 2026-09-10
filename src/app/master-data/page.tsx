import { MasterData } from "@/components/master-data";
import { Nav } from "@/components/nav";
import { requireSession } from "@/lib/auth";
import { rows } from "@/lib/db";
import { getAccountBalances } from "@/lib/finance";

export const dynamic = "force-dynamic";

export default async function MasterDataPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireSession();
  const params = await searchParams;
  const initialSection = params.section === "ACCOUNT" || params.section === "CATEGORY" || params.section === "TASK" ? params.section : "PROJECT";
  const result = params.error ? "error" : params.created ? "created" : params.updated ? "updated" : params.deleted ? "deleted" : "";
  const [projects, categories, tasks, accounts] = await Promise.all([
    rows<any>("SELECT id,name,isActive FROM `Project` ORDER BY isActive DESC,name"),
    rows<any>("SELECT id,name,scope,kind,isActive FROM `Category` ORDER BY isActive DESC,name"),
    rows<any>("SELECT id,name,scope,projectId,isActive FROM `Task` ORDER BY isActive DESC,name"),
    getAccountBalances(),
  ]);
  return <><Nav /><main><div className="page-heading"><div><p className="eyebrow">Setup and maintenance</p><h1>Master data</h1><p className="muted">Categories and tasks are shared. Accounts and projects are private.</p></div></div><MasterData accounts={accounts.filter(a=>!a.isSharedCash)} initialSection={initialSection} result={result} categories={categories} projects={projects} tasks={tasks} /></main></>;
}
