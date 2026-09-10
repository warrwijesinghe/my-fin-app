"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ExpenseItems, newLine, type DraftLine, type ItemOption } from "./expense-items";

type EntryType = "INCOME" | "EXPENSE" | "TRANSFER" | "DEBT_PAYMENT" | "ACCRUED_EXPENSE";
type Account = { id: string; name: string; type: string; isSharedCash?:boolean; owner?:"ME"|"WIFE" };
type Option = { id: string; name: string; projectId?: string | null; kind?:string };

const entryTypes: { value: EntryType; label: string; detail: string }[] = [
  { value: "INCOME", label: "Income", detail: "Money received" },
  { value: "EXPENSE", label: "Expense", detail: "Money spent" },
  { value: "TRANSFER", label: "Transfer", detail: "Move money between accounts" },
  { value: "DEBT_PAYMENT", label: "Debt payment", detail: "Pay a card or loan" },
  { value: "ACCRUED_EXPENSE", label: "Pay later", detail: "Record a bill you still owe" },
];

export type ReviewDraft = { id:string; type:EntryType; amount:number; description:string; transactionDate:string; scope:string; taxScope:string|null; owner:"ME"|"WIFE"; spentBy?:"ME"|"WIFE"; household:boolean; accountId:string|null; projectId:string|null; taskId:string|null; categoryId:string|null; partyId:string|null; paymentTiming:string; dueDate?:string|null; lines:DraftLine[] };
type EntryProps = { initialScope?:"PERSONAL"|"BUSINESS"; parties?: (Option & {kind:string;isCash:boolean})[]; draft?:ReviewDraft; accounts: Account[]; projects: Option[]; tasks: Option[]; categories: Option[]; today: string; items:ItemOption[]; initialOwner?:"ME"|"WIFE"; initialHousehold?:boolean };

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

  if (props.draft) return <section className="panel"><EntryForm {...props} type={props.draft.type}/></section>;
  const selected = entryTypes.find(entry => entry.value === type);
  return <div className="qe-stack">
    <div hidden={Boolean(type)}>
      <div className="page-heading"><div><p className="eyebrow">Transactions · Step 1 of 2</p><h1>Add a financial record</h1><p className="muted">Choose what you want to record.</p></div><a className="button" href="/bills">Pay-later bills</a></div>
      <section className="panel entry-panel qe-chooser" aria-label="Choose an entry type">
        <div className="section-heading"><div><h2>What are you recording?</h2><p className="muted">Select a type to open its details.</p></div></div>
        <div className="entry-type-grid">
          {entryTypes.map((entry, index) => <button ref={element => { buttons.current[entry.value] = element; }} className="entry-type qe-type" key={entry.value} onClick={() => openEntry(entry.value)} type="button"><span className={`qe-type-icon qe-icon-${entry.value.toLowerCase()}`} aria-hidden="true">{["↙", "↗", "⇄", "✓", "◷"][index]}</span><span className="qe-type-copy"><strong>{entry.label}</strong><span>{entry.detail}</span></span><span className="qe-chevron" aria-hidden="true">›</span></button>)}
        </div>
      </section>
    </div>
    {selected && <div className="qe-layer-heading"><button className="qe-back" type="button" onClick={goBack}><span aria-hidden="true">←</span> Entry types</button><p className="eyebrow">Transactions · Step 2 of 2</p><h1 ref={heading} tabIndex={-1}>{selected.label}</h1><p className="muted">{selected.detail}. Complete the details below.</p></div>}
    {visited.map(entryType => <section hidden={type !== entryType} className="panel entry-panel qe-form-layer" key={entryType} aria-label={`${entryTypes.find(entry => entry.value === entryType)?.label} details`}><EntryForm {...props} type={entryType} /><p className="qe-draft-note">Going back keeps your details until you leave or refresh this page.</p></section>)}
  </div>;
}

function EntryForm({ type, accounts, projects, tasks, categories, today, items, initialOwner="ME", initialHousehold=false, parties=[], draft, initialScope="PERSONAL" }: EntryProps & { type: EntryType }) {
  const router=useRouter();
  const [scope, setScope] = useState((draft?.household ?? initialHousehold) ? "PERSONAL" : (draft?.scope ?? initialScope));
  const [spentBy,setSpentBy]=useState<"ME"|"WIFE">(draft?.spentBy??initialOwner);
  const [expenseKind,setExpenseKind]=useState<""|"HOUSEHOLD"|"BUSINESS">("");
  const [lines,setLines]=useState<DraftLine[]>(()=>draft?.lines ?? (type==="EXPENSE"||type==="ACCRUED_EXPENSE"?[newLine()]:[]));
  const [accountId,setAccountId]=useState(draft?.accountId ?? "");
  const [paymentTiming,setPaymentTiming]=useState(draft?.paymentTiming ?? (type==="ACCRUED_EXPENSE"?"CREDIT":"PAID"));
  const [taxScope, setTaxScope] = useState<string | null>(draft?.taxScope ?? null);
  const itemTotalCents=lines.reduce((sum,l)=>sum+Math.round(Number(l.amount||0)*100),0);
  const incompleteItems=!!draft&&lines.length>0&&itemTotalCents!==Math.round(Number(draft.amount)*100);
  const eligibleAccounts=accounts.filter(a=>(a.owner??"ME")===spentBy);
  const debtAccounts = eligibleAccounts.filter((account) => ["CREDIT_CARD", "LOAN"].includes(account.type));
  const needsAccount = type !== "ACCRUED_EXPENSE" && paymentTiming !== "CREDIT";
  const needsDestination = type === "TRANSFER" || type === "DEBT_PAYMENT";
  const supportsClassification = type === "INCOME" || type === "EXPENSE" || type === "ACCRUED_EXPENSE";
  return <form className="form-grid quick-entry-form" action="/api/transactions" method="post">
      <input name="type" type="hidden" value={type} />
      {draft&&<input type="hidden" name="draftId" value={draft.id}/>} 
      <div className="amount-date"><label>Amount<input name="amount" defaultValue={draft?.amount} readOnly={!!draft} type="number" min="0.01" step="0.01" required /></label><label>Date<input name="transactionDate" type="date" defaultValue={draft?.transactionDate ?? today} required /></label></div>
      {supportsClassification&&<label>Payment<select name="paymentTiming" value={paymentTiming} onChange={e=>setPaymentTiming(e.target.value)} disabled={type==="ACCRUED_EXPENSE"}><option value="PAID">Paid / received now</option><option value="CREDIT">On credit — settle later</option></select></label>}
      <label>Description<input name="description" defaultValue={draft?.description} maxLength={300} placeholder="Optional note" /></label>
      {(type==="EXPENSE"||type==="ACCRUED_EXPENSE")&&<div className="payer-account"><label>Who will pay?<select name="spentBy" value={spentBy} onChange={e=>{setSpentBy(e.target.value as "ME"|"WIFE");setAccountId("");}}><option value="ME">WARR Wijesinghe</option><option value="WIFE">JAD Buddhika</option></select></label>{needsAccount&&<label>Paid from<select name="accountId" value={accountId} onChange={e=>setAccountId(e.target.value)} required><option value="" disabled>Select account</option>{eligibleAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} ({account.type.replace("_", " ")})</option>)}</select></label>}<input name="returnTo" type="hidden" value={initialHousehold?"household":""}/></div>}
      {(type==="EXPENSE"||type==="ACCRUED_EXPENSE")&&<div className="expense-kind"><span>Expense type</span><label className="expense-option"><input type="radio" name="expenseKind" value="HOUSEHOLD" checked={expenseKind==="HOUSEHOLD"} required onChange={()=>{setExpenseKind("HOUSEHOLD");setScope("PERSONAL");}}/>Household expense</label><label className="expense-option"><input type="radio" name="expenseKind" value="BUSINESS" checked={expenseKind==="BUSINESS"} onChange={()=>{setExpenseKind("BUSINESS");setScope("BUSINESS");setTaxScope("BUSINESS");}}/>Business expense</label></div>}
      {needsAccount && type!=="EXPENSE" && <label>{type === "INCOME" ? "Received into" : type === "TRANSFER" || type === "DEBT_PAYMENT" ? "Pay from" : "Paid from"}<select name="accountId" value={accountId} onChange={e=>setAccountId(e.target.value)} required><option value="" disabled>Select account</option>{eligibleAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} ({account.type.replace("_", " ")})</option>)}</select></label>}
      {needsAccount&&!eligibleAccounts.length&&<p className="span-2">No payment account available. <a href="/master-data?section=ACCOUNT">Create an account in Master Data.</a></p>}
      {needsDestination && <label>{type === "DEBT_PAYMENT" ? "Pay this debt" : "Transfer to"}<select name="destinationAccountId" defaultValue="" required><option value="" disabled>Select account</option>{(type === "DEBT_PAYMENT" ? debtAccounts : eligibleAccounts).map((account) => <option key={account.id} value={account.id}>{account.name} ({account.type.replace("_", " ")})</option>)}</select></label>}
      {paymentTiming === "CREDIT" && <label>Due date<input name="dueDate" type="date" defaultValue={draft?.dueDate?.slice(0,10) ?? ""}/></label>}
      {supportsClassification&&<div className="span-2 form-grid entry-more-grid">
        {expenseKind ? <><input name="scope" type="hidden" value={expenseKind==="HOUSEHOLD"?"PERSONAL":"BUSINESS"}/><div className="actual-tax"><label>Actual label<select name="scope" value={expenseKind==="HOUSEHOLD"?"PERSONAL":"BUSINESS"} disabled><option>{expenseKind==="HOUSEHOLD"?"Personal":"Business"}</option></select>{expenseKind==="HOUSEHOLD"&&<small>Household expenses are personal.</small>}</label>{expenseKind==="BUSINESS" ? <><input name="taxScope" type="hidden" value="BUSINESS"/><label>Tax label<select name="taxScope" value="BUSINESS" disabled><option>Business</option></select></label></> : <label>Tax label<select name="taxScope" value={taxScope ?? "PERSONAL"} onChange={(event) => setTaxScope(event.target.value)}><option value="PERSONAL">Personal</option><option value="BUSINESS">Business</option></select><small>Choose the tax label for this household expense.</small></label>}</div></> : <div className="actual-tax"><label>Actual label<select name="scope" value="" disabled><option>Choose expense type first</option></select></label><label>Tax label<select name="taxScope" value="" disabled><option>Choose expense type first</option></select></label></div>}
        <div className="project-task"><label>Business project<select name="projectId" defaultValue={draft?.projectId ?? ""} disabled={scope!=="BUSINESS"}><option value="">General business / no project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label>Task<select name="taskId" defaultValue={draft?.taskId ?? ""}><option value="">No task</option>{tasks.map((task) => <option key={task.id} value={task.id}>{task.name}{task.projectId ? " (project task)" : ""}</option>)}</select></label></div>
        <div className="category-party"><label>Category<select name="categoryId" defaultValue={draft?.categoryId ?? ""}><option value="">No category</option>{categories.filter(c=>c.kind===(type==="INCOME"?"INCOME":"EXPENSE")).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><span className="field-actions"><a href="/master-data?section=CATEGORY" target="_blank" rel="noreferrer" aria-label="Manage categories" title="Manage categories">⚙</a><button type="button" onClick={()=>router.refresh()} aria-label="Refresh category list" title="Refresh list">↻</button></span></label><label>Paid to / received from<select name="partyId" defaultValue={draft?.partyId ?? ""} required={paymentTiming==="CREDIT"}><option value="">Select customer / supplier{paymentTiming!=="CREDIT"?" (optional)":""}</option>{parties.filter(p=>(p.kind==="BOTH"||p.kind===(type==="INCOME"?"CUSTOMER":"SUPPLIER"))&&(paymentTiming!=="CREDIT"||!p.isCash)).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><span className="party-actions"><a href="/master-data/parties" target="_blank" rel="noreferrer" aria-label="Manage customers and suppliers" title="Manage customers and suppliers">⚙</a><button type="button" onClick={()=>router.refresh()} aria-label="Refresh customer and supplier list" title="Refresh list">↻</button></span></label></div>
        {!lines.length&&(type==="EXPENSE"||type==="ACCRUED_EXPENSE")&&<div className="span-2"><button type="button" className="button" onClick={()=>setLines([newLine()])}>Add item details</button></div>}
        {lines.length>0&&<ExpenseItems lines={lines} onChange={setLines} items={items} categories={categories.filter(c=>c.kind==="EXPENSE")}/>}
      </div>}
      {draft && lines.length>0 && <p className="span-2" role="status">Remaining to itemize: LKR {(Number(draft.amount)-lines.reduce((sum,l)=>sum+Math.round(Number(l.amount||0)*100)/100,0)).toFixed(2)}</p>}
      <div className="span-2 entry-actions">{draft&&<button className="button" name="intent" value="saveDraft" formNoValidate>Save progress in Review</button>}<button className="button primary qe-save" title={incompleteItems?"The remaining amount will be added to the selected main category after confirmation.":undefined} onClick={e=>{if(incompleteItems&&!window.confirm("The remaining amount will be added to the selected main category. Continue?"))e.preventDefault();}} name="intent" value="post" type="submit">{draft?"Post reviewed transaction":"Save transaction"}</button></div>
    </form>;
}
