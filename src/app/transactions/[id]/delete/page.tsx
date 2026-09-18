import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/nav";
import { requireSession } from "@/lib/auth";
import { sharedRows } from "@/lib/db";
import { lkr } from "@/lib/format";

export const dynamic = "force-dynamic";
export default async function DeleteTransactionPage({params, searchParams}: {params: Promise<{id: string}>; searchParams: Promise<{error?: string}>}) {
  await requireSession();
  const {id} = await params, query = await searchParams;
  const [entry] = await sharedRows<any>("SELECT id,type,amount,transactionDate,description,revision,settlesTransactionId FROM FinancialTransaction WHERE id=? AND status='POSTED'", [id]);
  if (!entry) notFound();
  return <><Nav/><main>
    <div className="page-heading"><div><p className="eyebrow">Transaction history</p><h1>Delete transaction?</h1></div></div>
    {query.error && <p role="alert">Unable to delete. The transaction may have changed. Review the details below and try again.</p>}
    <section className="panel">
      <h2>{entry.description || entry.type.replaceAll("_", " ")}</h2>
      <p>{String(entry.transactionDate).slice(0,10)} · {lkr(entry.amount)} · {entry.type.replaceAll("_", " ")}</p>
      <p>This removes the transaction from your history and reports and reverses its effect on balances. Any linked payments will also be deleted and reversed. An audit record is retained.</p>
      {entry.settlesTransactionId && <p>Deleting this payment restores the amount owed on the original bill or invoice.</p>}
      <form action={`/api/transactions/${id}/delete`} method="post">
        <input type="hidden" name="revision" value={entry.revision}/>
        <Link className="button" href="/transactions/new#transaction-history">Cancel</Link>{" "}
        <button className="button danger" name="confirm" value="delete" type="submit">Delete transaction</button>
      </form>
    </section>
  </main></>;
}
