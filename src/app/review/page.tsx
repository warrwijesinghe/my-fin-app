import Link from "next/link";
import { Nav } from "@/components/nav";
import { requireSession } from "@/lib/auth";
import { rows } from "@/lib/db";
import { lkr } from "@/lib/format";
export const dynamic="force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<{posted?:string}>}) {
  await requireSession(); const params=await searchParams;
  const items=await rows<any>("SELECT * FROM FinancialTransaction WHERE status='PENDING_REVIEW' ORDER BY createdAt,id");
  return <><Nav/><main><div className="page-heading"><div><p className="eyebrow">Complete before posting</p><h1>Review entries</h1><p className="muted">Open an entry, add missing details and optional items, then post. Drafts never affect balances or reports.</p></div><Link className="button" href="/">Dashboard</Link></div>{params.posted&&<p role="status">Transaction posted successfully.</p>}<section className="panel">{items.length?<div className="review-list">{items.map(i=><article className="review-item review-draft-row" key={i.id}><div><strong>{i.type.replaceAll("_"," ")} · {lkr(i.amount)}</strong><p>{String(i.transactionDate).slice(0,10)} · {i.description||"No description"}</p></div><Link className="button primary" href={`/review/${i.id}`}>Complete entry</Link></article>)}</div>:<div className="empty"><p>Everything is reviewed.</p></div>}</section></main></>;
}
