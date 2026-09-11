"use client";

import { useRouter } from "next/navigation";
import type { AccountBalance } from "@/lib/types";

export function AccountSwitcher({accounts,selectedId}:{accounts:AccountBalance[];selectedId:string}) {
  const router=useRouter();
  return <label className="account-switcher">Account<select aria-label="Switch account statement" value={selectedId} onChange={event=>router.push(`/account-center/${event.target.value}`)}>{accounts.map(account=><option key={account.id} value={account.id}>{account.name} · {account.type.replaceAll("_"," ")}</option>)}</select></label>;
}
