import { Nav } from "@/components/nav";
import { AccountCenter } from "@/components/account-center";
import { requireSession } from "@/lib/auth";
import { rows } from "@/lib/db";
import type { AccountBalance } from "@/lib/types";
import type { AccountEntry } from "@/lib/account-center";
import type { RowDataPacket } from "mysql2";
import "./account-center.css";
import "./account-balance-colors.css";

export const dynamic = "force-dynamic";

export default async function AccountCenterPage({ searchParams }: { searchParams: Promise<{ account?: string }> }) {
  await requireSession();
  const { account: requested } = await searchParams;
  const result = await rows<RowDataPacket & AccountBalance>(`
    SELECT a.owner,a.id,a.name,a.type,a.scope,a.holder,a.creditLimit,a.includeInAvailable,a.isActive,
      COALESCE(SUM(e.amount),0) AS balance
    FROM Account a LEFT JOIN AccountEntry e ON e.accountId=a.id
    WHERE 1=1 GROUP BY a.id ORDER BY a.isActive DESC,a.scope,a.name
  `);
  const accounts = result.map(a => ({ ...a, balance: Number(a.balance), creditLimit: a.creditLimit == null ? null : Number(a.creditLimit), isActive: Boolean(a.isActive), includeInAvailable: Boolean(a.includeInAvailable) }));
  const selected = requested ? accounts.find(a => a.id === requested) : accounts[0];
  const entries = selected ? await rows<RowDataPacket & AccountEntry>(`
    SELECT e.id,e.transactionId,e.entryDate,e.createdAt,e.amount,t.type,t.status,t.description,
      t.counterparty,t.scope,c.name AS category,p.name AS project,k.name AS task,
      a.name AS source,d.name AS destination,
      (SELECT JSON_ARRAYAGG(JSON_OBJECT('category',lc.name,'amount',l.amount)) FROM ExpenseLine l JOIN Category lc ON lc.id=l.categoryId WHERE l.transactionId=t.id) expenseBreakdown
    FROM AccountEntry e JOIN FinancialTransaction t ON t.id=e.transactionId
    LEFT JOIN Category c ON c.id=t.categoryId LEFT JOIN Project p ON p.id=t.projectId
    LEFT JOIN Task k ON k.id=t.taskId LEFT JOIN Account a ON a.id=t.accountId
    LEFT JOIN Account d ON d.id=t.destinationAccountId
    WHERE e.accountId=? ORDER BY e.entryDate,e.createdAt,e.id
  `, [selected.id]) : [];
  return <><Nav /><main className="ac-page"><AccountCenter key={selected?.id ?? "empty"} accounts={accounts} selectedId={selected?.id} entries={entries.map(e => ({ ...e, expenseBreakdown: typeof e.expenseBreakdown === "string" ? JSON.parse(e.expenseBreakdown) : e.expenseBreakdown, amount: Number(e.amount), entryDate: String(e.entryDate).slice(0, 10), createdAt: String(e.createdAt) }))} /></main></>;
}
