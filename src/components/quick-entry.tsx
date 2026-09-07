"use client";

import { useEffect, useRef, useState } from "react";
import { ExpenseItems, newLine, type DraftLine, type ItemOption } from "./expense-items";

type EntryType = "INCOME" | "EXPENSE" | "TRANSFER" | "DEBT_PAYMENT" | "ACCRUED_EXPENSE";
type Account = { id: string; name: string; type: string; owner?:"ME"|"WIFE" };
type Option = { id: string; name: string; projectId?: string | null; kind?:string };

const entryTypes: { value: EntryType; label: string; detail: string }[] = [
  { value: "INCOME", label: "Income", detail: "Money received" },
  { value: "EXPENSE", label: "Expense", detail: "Money spent" },
  { value: "TRANSFER", label: "Transfer", detail: "Move money between accounts" },
  { value: "DEBT_PAYMENT", label: "Debt payment", detail: "Pay a card or loan" },
  { value: "ACCRUED_EXPENSE", label: "Pay later", detail: "Record a bill you still owe" },
];

type EntryProps = { accounts: Account[]; projects: Option[]; tasks: Option[]; categories: Option[]; today: string; items:ItemOption[]; initialOwner?:"ME"|"WIFE"; initialHousehold?:boolean };

function readEntryType(): EntryType | null {
  const value = new URLSearchParams(window.location.search).get("type");
  return entryTypes.find(entry => entry.value === value)?.value ?? null;
}

export function QuickEntry(props: EntryProps) {
  const [type, setType] = useState<EntryType | null>(null);
  const [visited, setVisited] = useState<EntryType[]>([]);
  const lastType = useRef<EntryType | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const buttons = useRef<Partial<Record<EntryType, HTMLButtonElement | null>>>({});
  const initialized = useRef(false);

  useEffect(() => {
    const sync = () => {
      const next = readEntryType();
      if (next) setVisited(previous => previous.includes(next) ? previous : [...previous, next]);
      setType(next);
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  useEffect(() => {
    if (!initialized.current && !type) { initialized.current = true; return; }
    if (type) {
      lastType.current = type;
      heading.current?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "instant" });
    } else if (lastType.current) {
      buttons.current[lastType.current]?.focus();
    }
  }, [type]);

  function openEntry(next: EntryType) {
    const url = new URL(window.location.href);
    url.searchParams.set("type", next);
    window.history.pushState({ ...window.history.state, quickEntryLayer: true }, "", url);
    setVisited(previous => previous.includes(next) ? previous : [...previous, next]);
    setType(next);
  }

  function goBack() {
    if (window.history.state?.quickEntryLayer) { window.history.back(); return; }
    const url = new URL(window.location.href);
    url.searchParams.delete("type");
    window.history.replaceState(window.history.state, "", url);
    setType(null);
  }

  const selected = entryTypes.find(entry => entry.value === type);
  return <div className="qe-stack">
    <div hidden={Boolean(type)}>
      <div className="page-heading"><div><p className="eyebrow">Quick entry · Step 1 of 2</p><h1>Add a financial record</h1><p className="muted">Choose what you want to record.</p></div></div>
      <section className="panel entry-panel qe-chooser" aria-label="Choose an entry type">
        <div className="section-heading"><div><h2>What are you recording?</h2><p className="muted">Select a type to open its details.</p></div></div>
        <div className="entry-type-grid">
          {entryTypes.map((entry, index) => <button ref={element => { buttons.current[entry.value] = element; }} className="entry-type qe-type" key={entry.value} onClick={() => openEntry(entry.value)} type="button"><span className={`qe-type-icon qe-icon-${entry.value.toLowerCase()}`} aria-hidden="true">{["↙", "↗", "⇄", "✓", "◷"][index]}</span><span className="qe-type-copy"><strong>{entry.label}</strong><span>{entry.detail}</span></span><span className="qe-chevron" aria-hidden="true">›</span></button>)}
        </div>
      </section>
    </div>
    {selected && <div className="qe-layer-heading"><button className="qe-back" type="button" onClick={goBack}><span aria-hidden="true">←</span> Entry types</button><p className="eyebrow">Quick entry · Step 2 of 2</p><h1 ref={heading} tabIndex={-1}>{selected.label}</h1><p className="muted">{selected.detail}. Complete the details below.</p></div>}
    {visited.map(entryType => <section hidden={type !== entryType} className="panel entry-panel qe-form-layer" key={entryType} aria-label={`${entryTypes.find(entry => entry.value === entryType)?.label} details`}><EntryForm {...props} type={entryType} /><p className="qe-draft-note">Going back keeps your details until you leave or refresh this page.</p></section>)}
  </div>;
}

function EntryForm({ type, accounts, projects, tasks, categories, today, items, initialOwner="ME", initialHousehold=false }: EntryProps & { type: EntryType }) {
  const [scope, setScope] = useState("PERSONAL");
  const [owner,setOwner]=useState<"ME"|"WIFE">(type==="EXPENSE"||type==="ACCRUED_EXPENSE"?initialOwner:"ME");
  const [household,setHousehold]=useState(initialHousehold||initialOwner==="WIFE");
  const [lines,setLines]=useState<DraftLine[]>(()=>type==="EXPENSE"||type==="ACCRUED_EXPENSE"?[newLine()]:[]);
  const [accountId,setAccountId]=useState("");
  const [taxScope, setTaxScope] = useState<string | null>(null);
  const eligibleAccounts=accounts.filter(a=>(a.owner??"ME")===owner);
  const debtAccounts = eligibleAccounts.filter((account) => ["CREDIT_CARD", "LOAN"].includes(account.type));
  const needsAccount = type !== "ACCRUED_EXPENSE";
  const needsDestination = type === "TRANSFER" || type === "DEBT_PAYMENT";
  const supportsClassification = type === "INCOME" || type === "EXPENSE" || type === "ACCRUED_EXPENSE";
  return <form className="form-grid quick-entry-form" action="/api/transactions" method="post">
      <input name="type" type="hidden" value={type} />
      {!lines.length&&<label>Amount<input name="amount" type="number" min="0.01" step="0.01" required /></label>}
      <label>Date<input name="transactionDate" type="date" defaultValue={today} required /></label>
      {(type==="EXPENSE"||type==="ACCRUED_EXPENSE")&&<><label>Paid by / responsible person<select name="owner" value={owner} onChange={e=>{const next=e.target.value as "ME"|"WIFE";setOwner(next);setAccountId("");if(next==="WIFE"){setScope("PERSONAL");setHousehold(true)}}}><option value="ME">Me</option><option value="WIFE">Wife</option></select></label><label className="check"><input type="checkbox" name="household" checked={household} onChange={e=>setHousehold(e.target.checked)}/>Household expense</label><input name="returnTo" type="hidden" value={initialHousehold?"household":""}/></>}
      <label>Actual label<select name="scope" value={scope} onChange={(event) => setScope(event.target.value)}><option value="PERSONAL">Personal</option>{owner!=="WIFE"&&<option value="BUSINESS">Business</option>}</select><small>Used for dashboards and analytics.</small></label>
      {supportsClassification && owner!=="WIFE" && <label>Tax label<select name="taxScope" value={taxScope ?? scope} onChange={(event) => setTaxScope(event.target.value)}><option value="PERSONAL">Personal</option><option value="BUSINESS">Business</option></select><small>Used only for income tax reports. Can differ from the actual label.</small></label>}
      {needsAccount && <label>{type === "INCOME" ? "Received into" : type === "TRANSFER" || type === "DEBT_PAYMENT" ? "Pay from" : "Paid from"}<select name="accountId" value={accountId} onChange={e=>setAccountId(e.target.value)} required><option value="" disabled>Select account</option>{eligibleAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} ({account.type.replace("_", " ")})</option>)}</select></label>}
      {needsAccount&&!eligibleAccounts.length&&<p className="span-2">No {owner==="WIFE"?"wife":"personal or business"} payment account available. <a href="/master-data?section=ACCOUNT">Create {owner==="WIFE"?"a Wife Cash":"an"} account in Master Data.</a></p>}
      {needsDestination && <label>{type === "DEBT_PAYMENT" ? "Pay this debt" : "Transfer to"}<select name="destinationAccountId" defaultValue="" required><option value="" disabled>Select account</option>{(type === "DEBT_PAYMENT" ? debtAccounts : eligibleAccounts).map((account) => <option key={account.id} value={account.id}>{account.name} ({account.type.replace("_", " ")})</option>)}</select></label>}
      {type === "ACCRUED_EXPENSE" && <label>Due date<input name="dueDate" type="date" /></label>}
      {scope === "BUSINESS" && <label>Business project<select name="projectId" defaultValue="" required><option value="" disabled>Select project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>}
      {!lines.length&&(type==="EXPENSE"||type==="ACCRUED_EXPENSE")&&<div className="span-2"><button type="button" className="button" disabled={lines.length>0} onClick={()=>setLines([newLine()])}>Add item details</button></div>}
      {lines.length>0&&<ExpenseItems lines={lines} onChange={setLines} items={items} categories={categories.filter(c=>c.kind==="EXPENSE")}/>}
      {supportsClassification && <>{!lines.length&&<label>Category<select name="categoryId"><option value="">No category</option>{categories.filter(c=>c.kind===(type==="INCOME"?"INCOME":"EXPENSE")).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>}<label>Task<select name="taskId"><option value="">No task</option>{tasks.map((task) => <option key={task.id} value={task.id}>{task.name}{task.projectId ? " (project task)" : ""}</option>)}</select></label></>}
      {(type === "INCOME" || type === "EXPENSE") && <label>Paid to / received from<input name="counterparty" maxLength={140} placeholder="Optional" /></label>}
      <label className="span-2">Description<input name="description" maxLength={300} placeholder="Optional note" /></label>
      <button className="button primary qe-save" type="submit">Save {entryTypes.find((entry) => entry.value === type)?.label.toLowerCase()}</button>
    </form>;
}

