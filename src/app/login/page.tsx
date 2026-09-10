import { hasSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  if (await hasSession()) redirect("/");
  return <main className="login-wrap"><form className="login-card" action="/api/auth/login" method="post"><p className="eyebrow">Private system</p><h1>FIN Control</h1><p>Sign in to view your financial records.</p><label>Account<select name="owner"><option value="ME">WARR Wijesinghe</option><option value="WIFE">JAD Buddhika</option></select></label><label>Password<input name="password" type="password" autoFocus required /></label><button className="button primary" type="submit">Sign in</button></form></main>;
}
