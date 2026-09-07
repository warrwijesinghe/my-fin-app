"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export function QuickCapture() {
  const [type, setType] = useState<"EXPENSE" | "INCOME" | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (type) dialog.current?.showModal(); }, [type]);
  return <div className="dashboard-actions">
    <button className="button" type="button" aria-haspopup="dialog" onClick={()=>setType("EXPENSE")}>↗ Expense</button>
    <button className="button" type="button" aria-haspopup="dialog" onClick={()=>setType("INCOME")}>↙ Income</button>
    <Link className="button primary" href="/transactions/new">Add transaction</Link>
    <dialog ref={dialog} className="quick-capture-dialog" aria-labelledby="quick-capture-title" onClose={()=>setType(null)}>
      <h2 id="quick-capture-title">Quick {type?.toLowerCase()}</h2>
      <p className="muted">Save to Review and complete the details later.</p>
      {type && <form key={type} className="form-grid" action="/api/quick-entries" method="post">
        <input type="hidden" name="type" value={type}/>
        <label>Amount (LKR)<input autoFocus name="amount" type="number" min="0.01" max="999999999" step="0.01" required/></label>
        <label>Description<input name="description" maxLength={300} placeholder={type==="EXPENSE"?"Food City bill":"Customer payment"} required/></label>
        <button className="button primary">Save to Review</button>
        <button className="button" type="button" onClick={()=>dialog.current?.close()}>Cancel</button>
      </form>}
    </dialog>
  </div>;
}
