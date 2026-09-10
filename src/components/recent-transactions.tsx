import Link from "next/link";
import { RowDataPacket } from "mysql2";
import { rows } from "@/lib/db";

type RecentTransaction = RowDataPacket & {
  id: string; type: string; status: string; amount: number | string;
  transactionDate: string; description: string | null; counterparty: string | null;
  scope: string; accountName: string | null; destinationName: string | null;
  categoryName: string | null; outstanding:number|null;
};
const labels: Record<string, string> = {
  PARTY_PAYMENT: "Customer / supplier payment", INCOME: "Income", EXPENSE: "Expense", TRANSFER: "Transfer", DEBT_PAYMENT: "Debt payment",
  ACCRUED_EXPENSE: "Pay later", OPENING_BALANCE: "Opening balance",
};
const transactionVisuals: Record<string, { symbol: string; tone: string }> = {
  PARTY_PAYMENT: { symbol: "✓", tone: "debt" },
  INCOME: { symbol: "↙", tone: "income" },
  EXPENSE: { symbol: "↗", tone: "expense" },
  TRANSFER: { symbol: "⇄", tone: "transfer" },
  DEBT_PAYMENT: { symbol: "✓", tone: "debt" },
  ACCRUED_EXPENSE: { symbol: "◷", tone: "accrued" },
  OPENING_BALANCE: { symbol: "◎", tone: "opening" },
  ADJUSTMENT: { symbol: "±", tone: "adjustment" },
};
const money = new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export async function RecentTransactions({ selectedAccount, limit = 20 }: { selectedAccount?: { id: string; name: string }; limit?: number }) {
  const results = await rows<RecentTransaction>(`
    SELECT t.id,t.type,t.status,t.amount,t.transactionDate,t.description,t.counterparty,t.scope,
      a.name AS accountName,d.name AS destinationName,c.name AS categoryName,CASE WHEN bill.status IN ('OPEN','PARTIALLY_PAID') THEN GREATEST(bill.amount-bill.paidAmount,0) ELSE 0 END outstanding
    FROM FinancialTransaction t
    LEFT JOIN AccruedExpense bill ON bill.id=t.accrualId
    LEFT JOIN Account a ON a.id=t.accountId
    LEFT JOIN Account d ON d.id=t.destinationAccountId
    LEFT JOIN Category c ON c.id=t.categoryId
    WHERE 1=1 ${selectedAccount ? "AND (t.accountId=? OR t.destinationAccountId=?)" : ""}
    ORDER BY t.createdAt DESC,t.id DESC LIMIT ${limit + 1}
  `, selectedAccount ? [selectedAccount.id, selectedAccount.id] : []);
  const hasMore = results.length > limit;
  const transactions = results.slice(0, limit);
  const moreParams = new URLSearchParams({ recent: String(limit + 20) });
  if (selectedAccount) moreParams.set("account", selectedAccount.id);
  return <section className="panel recent-transactions" id="recent-transactions" aria-labelledby="recent-transactions-title">
    <div className="recent-compact-header"><div><p className="eyebrow">Latest activity</p><h2 id="recent-transactions-title">Recent transactions</h2></div><div className="recent-account-filter"><div><span>Account</span><strong>{selectedAccount?.name ?? "All accounts"}</strong></div>{selectedAccount && <Link className="button" href="/#recent-transactions" aria-label="Reset account filter and view all accounts">Reset</Link>}</div></div>
    {transactions.length ? <ul className="recent-list">{transactions.map(item => {
      const label = labels[item.type] ?? item.type.replaceAll("_", " ");
      const pending = item.status === "PENDING_REVIEW";
      const direction = item.type === "INCOME" ? "income" : item.type === "EXPENSE" ? "expense" : "neutral";
      const visual = transactionVisuals[item.type] ?? { symbol: "•", tone: "neutral" };
      const account = item.destinationName ? `${item.accountName ?? "No account"} → ${item.destinationName}` : item.accountName ?? (item.type === "ACCRUED_EXPENSE" ? "Unpaid bill" : "No account selected");
      return <li className="recent-row" key={item.id}>
        <span className={`recent-icon ${visual.tone}`} aria-hidden="true">{visual.symbol}</span>
        <div className="recent-detail"><strong>{item.description || item.counterparty || label}</strong><span>{label} · {item.scope === "BUSINESS" ? "Business" : "Personal"}{item.categoryName ? ` · ${item.categoryName}` : ""}</span><small>{account}</small></div>
        <div className="recent-value"><strong className={direction}>{item.type === "INCOME" ? "+ " : item.type === "EXPENSE" ? "− " : ""}{money.format(Number(item.amount))}</strong><time dateTime={item.transactionDate.slice(0,10)}>{date.format(new Date(`${item.transactionDate.slice(0,10)}T00:00:00Z`))}</time>{pending ? <Link className="recent-pending" href={`/review/${item.id}`}>Needs review</Link> : <span className="recent-status">{item.status === "POSTED" ? "Confirmed" : item.status.replaceAll("_", " ").toLowerCase()}</span>}{item.type==="ACCRUED_EXPENSE"&&item.status==="POSTED"&&<Link className="recent-pending" href={`/bills?bill=${item.id}#payment`}>{Number(item.outstanding)>0?"Pay bill":"View payments"}</Link>}</div>
      </li>;
    })}</ul> : <div className="empty"><p>{selectedAccount ? `No transactions recorded for ${selectedAccount.name} yet.` : "No transactions yet. Add your first record to see your recent activity."}</p><Link className="button primary" href="/transactions/new">Add transaction</Link></div>}
    {hasMore && <div className="recent-more"><Link className="button" href={`/?${moreParams.toString()}#recent-transactions`}>Show 20 more</Link><span>Showing {transactions.length} transactions</span></div>}
  </section>;
}
