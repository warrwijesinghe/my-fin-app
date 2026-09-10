import Link from "next/link";
import { Nav } from "@/components/nav";
import { requireSession } from "@/lib/auth";
import { rows } from "@/lib/db";
import styles from "./parties.module.css";

export const dynamic="force-dynamic";

function PartyForm({party}:{party?:any}) {
  return <form className="form-grid" action="/api/parties" method="post">
    {party&&<input type="hidden" name="id" value={party.id}/>}
    <label>Name<input name="name" minLength={2} maxLength={140} required defaultValue={party?.name}/></label>
    <label>Type<select name="kind" defaultValue={party?.kind||"SUPPLIER"}><option value="SUPPLIER">Supplier</option><option value="CUSTOMER">Customer</option><option value="BOTH">Customer & supplier</option></select></label>
    <label>Contact number<input name="contactNo" type="tel" maxLength={40} defaultValue={party?.contactNo||""}/></label>
    <label className="check"><input type="checkbox" name="isCash" defaultChecked={Boolean(party?.isCash)}/>Generic cash customer / supplier (no credit)</label>
    <label className="check"><input type="checkbox" name="isActive" defaultChecked={party?Boolean(party.isActive):true}/>Active</label>
    <button className="button primary">{party?"Save changes":"Create master record"}</button>
  </form>;
}

function kindLabel(kind:string) {
  return kind==="BOTH" ? "Customer & supplier" : kind[0]+kind.slice(1).toLowerCase();
}

export default async function Page({searchParams}:{searchParams:Promise<{q?:string;error?:string;saved?:string}>}) {
  await requireSession();
  const p=await searchParams,q=(p.q||"").trim();
  const parties=await rows<any>("SELECT * FROM Party WHERE name LIKE ? OR contactNo LIKE ? ORDER BY isActive DESC,name",[`%${q}%`,`%${q}%`]);
  return <><Nav/><main>
    <div className="page-heading"><div><p className="eyebrow">Master data</p><h1>Customers & suppliers</h1><p className="muted">Customers and suppliers are shared between both logins. Each login sees only its own financial history. Save names and contact numbers once. Use named records for credit and generic Cash Supplier / Cash Customer records for cash transactions.</p></div><Link className="button" href="/master-data">Master data</Link></div>
    {p.error&&<p role="alert">Unable to save. Names must be unique; type and cash status cannot change after use. Deactivate records to preserve history.</p>}
    {p.saved&&<p role="status">Master record saved.</p>}
    <section className="panel"><h2>Add customer / supplier</h2><PartyForm/></section>
    <section className="panel" style={{marginTop:20}}>
      <div className={styles.listHeading}><div><h2>Customer & supplier list</h2><p className="muted">View contacts, their record type, and available actions in one place.</p></div><span>{parties.length} {parties.length===1?"record":"records"}</span></div>
      <form className="report-picker"><label>Search name or contact<input name="q" defaultValue={q}/></label><button className="button">Search</button><Link href="/master-data/parties">Reset</Link></form>
      {parties.length ? <div className="table-wrap"><table className={styles.table}><thead><tr><th>Name</th><th>Type</th><th>Contact number</th><th>Payment use</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{parties.map(p=><><tr key={p.id}><td><strong>{p.name}</strong></td><td>{kindLabel(p.kind)}</td><td>{p.contactNo||"—"}</td><td>{p.isCash?"Cash only":"Credit available"}</td><td><span className={`${styles.status} ${p.isActive?styles.active:styles.inactive}`}>{p.isActive?"Active":"Inactive"}</span></td><td className={styles.actions}><Link className="button" href={`/parties/${p.id}`}>View ledger</Link></td></tr><tr key={`${p.id}-edit`} className={styles.editRow}><td colSpan={6}><details><summary>Edit record</summary><div className={styles.editor}><PartyForm party={p}/></div></details></td></tr></>)}</tbody></table></div> : <p>No matching customers or suppliers.</p>}
    </section>
  </main></>;
}
