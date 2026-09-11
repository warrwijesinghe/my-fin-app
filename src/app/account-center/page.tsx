import { Nav } from "@/components/nav";
import { AccountCenter } from "@/components/account-center";
import { requireSession } from "@/lib/auth";
import { rows } from "@/lib/db";
import type { AccountBalance } from "@/lib/types";
import type { RowDataPacket } from "mysql2";
import "./account-center.css";
import "./account-balance-colors.css";

export const dynamic = "force-dynamic";

export default async function AccountCenterPage() {
  await requireSession();
  const result = await rows<RowDataPacket & AccountBalance>(`
    SELECT a.owner,a.id,a.name,a.type,a.scope,a.holder,a.creditLimit,a.includeInAvailable,a.isActive,
      COALESCE(SUM(e.amount),0) AS balance
    FROM Account a LEFT JOIN AccountEntry e ON e.accountId=a.id
    WHERE 1=1 GROUP BY a.id ORDER BY a.isActive DESC,a.scope,a.name
  `);
  const accounts = result.map(a => ({ ...a, balance: Number(a.balance), creditLimit: a.creditLimit == null ? null : Number(a.creditLimit), isActive: Boolean(a.isActive), includeInAvailable: Boolean(a.includeInAvailable) }));
  return <><Nav /><main className="ac-page"><AccountCenter accounts={accounts} entries={[]} /></main></>;
}
