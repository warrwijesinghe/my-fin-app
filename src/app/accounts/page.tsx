import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function AccountsPage() { redirect("/master-data?section=ACCOUNT"); }
