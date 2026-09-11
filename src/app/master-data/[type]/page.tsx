import { notFound } from "next/navigation";
import { Nav } from "@/components/nav";
import { MasterFileTable } from "@/components/master-file-table";
import { requireSession } from "@/lib/auth";
import { rows } from "@/lib/db";
import { getAccountBalances } from "@/lib/finance";

export const dynamic="force-dynamic";
const types=["accounts","projects","categories","tasks"] as const;

export default async function MasterFilePage({params,searchParams}:{params:Promise<{type:string}>;searchParams:Promise<{created?:string;updated?:string;deleted?:string;error?:string}>}) {
  await requireSession();const {type}=await params,p=await searchParams;
  if(!types.includes(type as typeof types[number]))notFound();
  const kind=type as typeof types[number];
  const [projects,records]=await Promise.all([rows<any>("SELECT id,name,isActive FROM `Project` WHERE isActive=1 ORDER BY name"),kind==="accounts"?getAccountBalances():kind==="projects"?rows<any>("SELECT id,name,isActive FROM `Project` ORDER BY isActive DESC,name"):kind==="categories"?rows<any>("SELECT id,name,scope,kind,isActive FROM `Category` ORDER BY isActive DESC,name"):rows<any>("SELECT id,name,scope,projectId,isActive FROM `Task` ORDER BY isActive DESC,name")]);
  const title={accounts:"Accounts",projects:"Projects",categories:"Categories",tasks:"Tasks"}[kind];
  const notice=p.error?"Unable to save. Check the details and try again.":p.created?`${title.slice(0,-1)} created.`:p.updated?`${title.slice(0,-1)} updated.`:p.deleted?`${title.slice(0,-1)} deleted.`:"";
  return <><Nav/><main><div className="page-heading"><div><p className="eyebrow">Master Files</p><h1>{title}</h1><p className="muted">Manage your {title.toLowerCase()} in one table.</p></div></div><MasterFileTable kind={kind} records={(records as any[]).filter(record=>kind!=="accounts"||!record.isSharedCash)} projects={projects} notice={notice}/></main></>;
}
