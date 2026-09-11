import Link from "next/link";
import { Nav } from "@/components/nav";
import { requireSession } from "@/lib/auth";
import { rows } from "@/lib/db";
import { getAccountBalances } from "@/lib/finance";

export const dynamic = "force-dynamic";

export default async function MasterDataPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireSession();
  const params = await searchParams;
  const [projects, categories, tasks, accounts] = await Promise.all([
    rows<any>("SELECT id,name,isActive FROM `Project` ORDER BY isActive DESC,name"),
    rows<any>("SELECT id,name,scope,kind,isActive FROM `Category` ORDER BY isActive DESC,name"),
    rows<any>("SELECT id,name,scope,projectId,isActive FROM `Task` ORDER BY isActive DESC,name"),
    getAccountBalances(),
  ]);
  return <><Nav /><main><div className="page-heading"><div><p className="eyebrow">Setup and maintenance</p><h1>Master Files</h1><p className="muted">Choose a file to view records and manage them in its own table.</p></div></div><div className="module-home"><section className="module-actions" aria-label="Master file actions"><Link className="module-tile" href="/master-data/accounts"><strong>Accounts</strong><span>Cash, bank, savings and credit accounts</span></Link><Link className="module-tile" href="/master-data/projects"><strong>Projects</strong><span>Organize business activity</span></Link><Link className="module-tile" href="/master-data/categories"><strong>Categories</strong><span>Income and expense classifications</span></Link><Link className="module-tile" href="/master-data/tasks"><strong>Tasks</strong><span>Activities and optional project links</span></Link><Link className="module-tile" href="/master-data/items"><strong>Item Master</strong><span>Products and household purchase items</span></Link><Link className="module-tile" href="/master-data/parties"><strong>Customers & suppliers</strong><span>Contacts, credit and settlement records</span></Link></section><aside className="module-figures" aria-label="Master file counts"><p className="eyebrow">Records</p><div><span>Accounts</span><strong>{accounts.filter(a=>!a.isSharedCash).length}</strong></div><div><span>Projects</span><strong>{projects.length}</strong></div><div><span>Categories</span><strong>{categories.length}</strong></div></aside></div></main></>;
}
