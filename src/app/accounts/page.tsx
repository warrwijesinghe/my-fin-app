import { ACCOUNT_TYPES } from "@/lib/types";
import { Nav } from "@/components/nav";
import { requireSession } from "@/lib/auth";
import { getAccountBalances } from "@/lib/finance";
import { lkr } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  await requireSession();
  const accounts = await getAccountBalances();
  return <><Nav /><main><div className="page-heading"><div><p className="eyebrow">Foundation</p><h1>Accounts and opening balances</h1><p className="muted">Set balances once. Future changes come only from recorded transactions.</p></div></div>
    <div className="two-column">
      <section className="panel"><h2>Add account</h2><form className="form-grid" action="/api/accounts" method="post">
        <label>Name<input name="name" required placeholder="Account name" /></label>
        <label>Type<select name="type" defaultValue="BANK">{ACCOUNT_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
        <label>Scope<select name="scope" defaultValue="PERSONAL"><option value="PERSONAL">Personal</option><option value="BUSINESS">Business</option></select></label>
        <label>Holder<input name="holder" placeholder="Optional" /></label>
        <label>Credit limit<input name="creditLimit" type="number" min="0" step="0.01" placeholder="Credit cards only" /></label>
        <label>Opening balance<input name="openingBalance" type="number" min="0" step="0.01" defaultValue="0" /></label>
        <label>Opening date<input name="openingDate" type="date" /></label>
        <label>Due day <input name="dueDay" type="number" min="1" max="31" placeholder="For debt only" /></label>
        <label>Annual interest %<input name="annualInterestRate" type="number" min="0" step="0.01" placeholder="For debt only" /></label>
        <label>Minimum payment<input name="minimumPayment" type="number" min="0" step="0.01" placeholder="For debt only" /></label>
        <label className="check"><input name="includeInAvailable" type="checkbox" defaultChecked />Include in available cash</label>
        <button className="button primary" type="submit">Create account</button>
      </form></section>
      <section className="panel"><div className="section-heading"><div><p className="eyebrow">Current balances</p><h2>All accounts</h2></div></div>
        {accounts.length ? <div className="account-list">{accounts.map((account) => <div className="account-row" key={account.id}><div><strong>{account.name}</strong><span>{account.type.replace("_", " ")} · {account.scope.toLowerCase()}{account.holder ? ` · ${account.holder}` : ""}{account.type === "CREDIT_CARD" && account.creditLimit != null ? ` · Limit ${lkr(account.creditLimit)} · Available ${lkr(Math.max(account.creditLimit - account.balance, 0))}` : ""}</span></div><b>{lkr(account.balance)}</b><details className="account-manage"><summary>Manage account</summary><form action={`/api/accounts/${account.id}`} className="master-edit" method="post"><input name="intent" type="hidden" value="update" /><label>Name<input defaultValue={account.name} maxLength={120} name="name" required /></label><label>Holder<input defaultValue={account.holder || ""} maxLength={80} name="holder" /></label>{account.type === "CREDIT_CARD" && <label>Credit limit<input defaultValue={account.creditLimit ?? ""} min="0" name="creditLimit" step="0.01" type="number" /></label>}<label className="check"><input defaultChecked={Boolean(account.includeInAvailable)} name="includeInAvailable" type="checkbox" />Include in available cash</label><div className="master-actions"><button className="button primary" type="submit">Save changes</button></div></form><form action={`/api/accounts/${account.id}`} className="master-actions" method="post"><input name="intent" type="hidden" value="delete" /><button className="button danger" type="submit">Delete account</button></form></details></div>)}</div> : <div className="empty"><p>No accounts yet. Start with the cash, bank, credit card and loan accounts you want to control.</p></div>}
      </section>
    </div>
  </main></>;
}
