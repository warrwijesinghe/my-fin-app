"use client";

import { incomeTaxCsv, TaxTransaction } from "@/lib/tax-report";
import { MoneyScope } from "@/lib/types";

export function ExportTaxReport({ transactions, scope, start, end, owner }: { owner: "ME"|"WIFE"; transactions: TaxTransaction[]; scope: MoneyScope; start: string; end: string }) {
  function download() {
    const url = URL.createObjectURL(new Blob([incomeTaxCsv(transactions, scope, start, end, owner)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${scope.toLowerCase()}-income-tax-${start}-to-${end}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <button className="button" type="button" onClick={download}>Download tax CSV</button>;
}
