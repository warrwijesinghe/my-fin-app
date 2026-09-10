import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";

const COOKIE_NAME = "fin_session";

export type SessionOwner = "ME" | "WIFE";
function credential(owner: SessionOwner) {
  return owner === "ME" ? process.env.FIN_APP_PASSWORD_HASH : process.env.FIN_WIFE_PASSWORD_HASH;
}
function getSessionValue(owner: SessionOwner) {
  const value = credential(owner), secret = process.env.FIN_SESSION_SECRET;
  if (!value || !secret) return null;
  return crypto.createHmac("sha256", secret).update("v2:"+owner+":"+value).digest("hex");
}
export function isCorrectPassword(password: string, owner: SessionOwner = "ME") {
  const expected = credential(owner);
  if (!expected) return false;
  const [salt, hash] = expected.split(":");
  if (!salt || !hash || !/^[a-f0-9]{128}$/.test(hash)) return false;
  return crypto.timingSafeEqual(crypto.scryptSync(password, salt, 64), Buffer.from(hash, "hex"));
}
export async function sessionOwner(): Promise<SessionOwner | null> {
  const received = (await cookies()).get(COOKIE_NAME)?.value;
  if (!received) return null;
  for (const owner of ["ME", "WIFE"] as const) {
    const expected = getSessionValue(owner);
    const value = expected ? owner+"."+expected : "";
    if (value && Buffer.byteLength(received) === Buffer.byteLength(value) && crypto.timingSafeEqual(Buffer.from(received), Buffer.from(value))) return owner;
  }
  return null;
}
export async function currentOwner(): Promise<SessionOwner> {
  const owner=await sessionOwner();
  if (!owner) throw new Error("Unauthorized");
  return owner;
}
export async function hasSession() { return (await sessionOwner()) !== null; }
export async function requireSession() {
  const owner=await sessionOwner();
  if (!owner) redirect("/login");
  return owner;
}
export function sessionCookie(owner: SessionOwner = "ME") {
  const value=getSessionValue(owner);
  if (!value) throw new Error("Login credentials and FIN_SESSION_SECRET must be configured.");
  return { name:COOKIE_NAME, value:owner+"."+value, options:{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax" as const,path:"/",maxAge:60*60*12} };
}

export function relativeRedirect(path: string) {
  // Keep form redirects on the browser's origin behind a reverse proxy.
  // A 303 follows the POST with a GET instead of submitting the form again.
  return new NextResponse(null, { status: 303, headers: { Location: path } });
}

export const clearSessionCookie = {
  name: COOKIE_NAME,
  value: "",
  options: { httpOnly: true, path: "/", maxAge: 0 },
};
