import { notFound } from "next/navigation";
import { Nav } from "@/components/nav";
import { requireSession } from "@/lib/auth";
import { familyPaymentAccounts, rows } from "@/lib/db";

export const dynamic="force-dynamic";

export default async function TransactionEditPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string}>}) {
  await requireSession();
  const {id}=await params,query=await searchParams;
  const [entry]=await rows<any>("SELECT id,type,amount,transactionDate,description,revision,owner,accountId,projectId,categoryId,taskId,scope,household FROM FinancialTransaction WHERE id=? AND status='POSTED'",[id]);
  if(!entry)notFound();
  const [lines,accounts,categories,tasks,projects]=await Promise.all([
    rows<any>("SELECT l.id,l.amount,l.quantity,l.unit,i.name FROM ExpenseLine l LEFT JOIN Item i ON i.id=l.itemId WHERE l.transactionId=? ORDER BY l.id",[id]),
    familyPaymentAccounts<any>(),
    rows<any>("SELECT id,name,kind FROM Category WHERE isActive=1 ORDER BY name"),
    rows<any>("SELECT id,name FROM Task WHERE isActive=1 ORDER BY name"),
    rows<any>("SELECT id,name FROM `Project` WHERE isActive=1 ORDER BY name"),
  ]);
  const expense=["EXPENSE","ACCRUED_EXPENSE"].includes(entry.type);
  return <><Nav/><main><div className="page-heading"><div><p className="eyebrow">Transaction history</p><h1>Edit transaction</h1><p className="muted">{entry.type.replaceAll("_"," ")}</p></div></div>
    {query.error&&<p role="alert">Unable to save. The record may have changed; reload and try again. Item amounts must equal the transaction amount.</p>}
    <section className="panel"><form className="form-grid" action={`/api/transactions/${id}`} method="post"><input name="revision" type="hidden" value={entry.revision}/><label>Amount (LKR)<input name="amount" type="number" min="0.01" max="999999999" step="0.01" defaultValue={entry.amount} required/></label><label>Date<input name="transactionDate" type="date" defaultValue={String(entry.transactionDate).slice(0,10)} required/></label>{entry.accountId&&<label>Cash account<select name="accountId" defaultValue={entry.accountId} required>{accounts.filter(account=>account.owner===entry.owner).map(account=><option key={account.id} value={account.id}>{account.name} ({account.type.replace("_"," ")})</option>)}</select></label>}<label>Category<select name="categoryId" defaultValue={entry.categoryId||""}><option value="">No category</option>{categories.filter(category=>category.kind===(entry.type==="INCOME"?"INCOME":"EXPENSE")).map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>Business project<select name="projectId" defaultValue={entry.projectId||""}><option value="">General business / no project</option>{projects.map(project=><option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label>Task<select name="taskId" defaultValue={entry.taskId||""}><option value="">No task</option>{tasks.map(task=><option key={task.id} value={task.id}>{task.name}</option>)}</select></label>{expense&&<fieldset className="expense-kind span-2"><legend>Expense type</legend><label className="expense-option"><input type="radio" name="expenseKind" value="HOUSEHOLD" defaultChecked={Boolean(entry.household)}/>Household expense</label><label className="expense-option"><input type="radio" name="expenseKind" value="BUSINESS" defaultChecked={!entry.household}/>Business expense</label></fieldset>}<label className="span-2">Description<input name="description" maxLength={300} defaultValue={entry.description||""}/></label>
      {lines.length>0&&<div className="span-2"><h2>Item amounts</h2><p className="muted">Item amounts must add up to the transaction amount.</p>{lines.map(line=><label key={line.id}>{line.name||"Item"}{line.quantity!=null?` · ${line.quantity} ${line.unit}`:""}<input name={`line:${line.id}`} type="number" min="0.01" max="999999999" step="0.01" defaultValue={line.amount} required/></label>)}</div>}
      <button className="button primary" type="submit">Save changes</button>
    </form></section>
  </main></>;
}
