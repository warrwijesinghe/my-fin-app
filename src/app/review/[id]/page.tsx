import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/nav";
import { QuickEntry, type ReviewDraft } from "@/components/quick-entry";
import { requireSession } from "@/lib/auth";
import { rows } from "@/lib/db";
export const dynamic="force-dynamic";
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string;saved?:string}>}){
  await requireSession();const {id}=await params,query=await searchParams;
  const [draft]=await rows<any>("SELECT * FROM FinancialTransaction WHERE id=? AND status='PENDING_REVIEW'",[id]);
  if(!draft)return <><Nav/><main><h1>Entry is no longer awaiting review</h1><p>It may already have been posted in another window.</p><Link href="/review">Back to Review</Link></main></>;
  if(!["INCOME","EXPENSE","ACCRUED_EXPENSE"].includes(draft.type))notFound();
  const [accounts,projects,tasks,categories,items,parties,lines]=await Promise.all([
    rows<any>("SELECT * FROM Account WHERE isActive=1 ORDER BY name"),rows<any>("SELECT * FROM Project WHERE isActive=1 ORDER BY name"),rows<any>("SELECT * FROM Task WHERE isActive=1 ORDER BY name"),rows<any>("SELECT * FROM Category WHERE isActive=1 ORDER BY name"),rows<any>("SELECT * FROM Item WHERE isActive=1 ORDER BY name"),rows<any>("SELECT * FROM Party WHERE isActive=1 ORDER BY name"),rows<any>("SELECT l.*,i.name FROM ExpenseLine l JOIN Item i ON i.id=l.itemId WHERE l.transactionId=? ORDER BY l.id",[id])
  ]);
  const data:ReviewDraft={...draft,amount:Number(draft.amount),household:Boolean(draft.household),transactionDate:String(draft.transactionDate).slice(0,10),lines:lines.map(l=>({key:l.id,name:l.name,categoryId:l.categoryId,quantity:l.quantity==null?"":String(l.quantity),unit:l.unit||"",amount:String(l.amount)}))};
  return <><Nav/><main><div className="page-heading"><div><p className="eyebrow">Draft · not posted</p><h1>Complete {draft.type==="INCOME"?"income":"expense"}</h1></div><Link className="button" href="/review">Back to Review</Link></div>{query.saved&&<p role="status">Progress saved. This entry is still in Review.</p>}{query.error&&<p role="alert">Unable to save: {query.error==="item-total"?"Item amounts must not exceed the captured amount; before posting they must match it exactly.":"Check your account, customer/supplier, date and item details. Complete each added item, or remove its empty line. Credit transactions require a named customer/supplier."}</p>}<QuickEntry key={draft.updatedAt} draft={data} accounts={accounts} projects={projects} tasks={tasks} categories={categories} items={items} parties={parties} today={data.transactionDate}/></main></>;
}
