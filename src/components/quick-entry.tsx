"use client";

import { useState } from "react";

type EntryType = "INCOME" | "EXPENSE" | "TRANSFER" | "DEBT_PAYMENT" | "ACCRUED_EXPENSE";
type Account = { id: string; name: string; type: string };
type Option = { id: string; name: string; projectId?: string | null };

const entryTypes: { value: EntryType; label: string; detail: string }[] = [
  { value: "INCOME", label: "Income", detail: "Money received" },
  { value: "EXPENSE", label: "Expense", detail: "Money spent" },
  { value: "TRANSFER", label: "Transfer", detail: "Move money between accounts" },
  { value: "DEBT_PAYMENT", label: "Debt payment", detail: "Pay a card or loan" },
  { value: "ACCRUED_EXPENSE", label: "Pay later", detail: "Record a bill you still owe" },
];

export function QuickEntry({ accounts, projects, tasks, categories, today }: { accounts: Account[]; projects: Option[]; tasks: Option[]; categories: Option[]; today: string }) {
  const [type, setType] = useState<EntryType | null>(null);
  const [scope, setScope] = useState("PERSONAL");
  const debtAccounts = accounts.filter((account) => ["CREDIT_CARD", "LOAN"].includes(account.type));
  const needsAccount = type !== "ACCRUED_EXPENSE";
  const needsDestination = type === "TRANSFER" || type === "DEBT_PAYMENT";
  const supportsClassification = type === "INCOME" || type === "EXPENSE" || type === "ACCRUED_EXPENSE";

  return <section className="panel entry-panel">
    <div className="section-heading"><div><p className="eyebrow">Choose an entry</p><h2>What are you recording?</h2></div></div>
    <div className="entry-type-grid">
      {entryTypes.map((entry) => <button className={`entry-type ${type === entry.value ? "selected" : ""}`} key={entry.value} onClick={() => setType(entry.value)} type="button"><strong>{entry.label}</strong><span>{entry.detail}</span></button>)}
    </div>
    {type && <form className="form-grid quick-entry-form" action="/api/transactions" method="post">
      <input name="type" type="hidden" value={type} />
      <label>Amount<input name="amount" type="number" min="0.01" step="0.01" required autoFocus /></label>
      <label>Date<input name="transactionDate" type="date" defaultValue={today} required /></label>
      <label>Scope<select name="scope" value={scope} onChange={(event) => setScope(event.target.value)}><option value="PERSONAL">Personal</option><option value="BUSINESS">Business</option></select></label>
      {needsAccount && <label>{type === "INCOME" ? "Received into" : type === "TRANSFER" || type === "DEBT_PAYMENT" ? "Pay from" : "Paid from"}<select name="accountId" defaultValue="" required><option value="" disabled>Select account</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} ({account.type.replace("_", " ")})</option>)}</select></label>}
      {needsDestination && <label>{type === "DEBT_PAYMENT" ? "Pay this debt" : "Transfer to"}<select name="destinationAccountId" defaultValue="" required><option value="" disabled>Select account</option>{(type === "DEBT_PAYMENT" ? debtAccounts : accounts).map((account) => <option key={account.id} value={account.id}>{account.name} ({account.type.replace("_", " ")})</option>)}</select></label>}
      {type === "ACCRUED_EXPENSE" && <label>Due date<input name="dueDate" type="date" /></label>}
      {scope === "BUSINESS" && <label>Business project<select name="projectId" defaultValue="" required><option value="" disabled>Select project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>}
      {supportsClassification && <><label>Category<select name="categoryId"><option value="">No category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>Task<select name="taskId"><option value="">No task</option>{tasks.map((task) => <option key={task.id} value={task.id}>{task.name}{task.projectId ? " (project task)" : ""}</option>)}</select></label></>}
      {(type === "INCOME" || type === "EXPENSE") && <label>Paid to / received from<input name="counterparty" maxLength={140} placeholder="Optional" /></label>}
      <label className="span-2">Description<input name="description" maxLength={300} placeholder="Optional note" /></label>
      <button className="button primary" type="submit">Save {entryTypes.find((entry) => entry.value === type)?.label.toLowerCase()}</button>
    </form>}
  </section>;
}
