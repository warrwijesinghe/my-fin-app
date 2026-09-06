import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";

const COOKIE_NAME = "fin_session";

function getSessionValue() {
  const password = process.env.FIN_APP_PASSWORD;
  const secret = process.env.FIN_SESSION_SECRET;
  if (!password || !secret) return null;
  return crypto.createHmac("sha256", secret).update(password).digest("hex");
}

export function isCorrectPassword(password: string) {
  const expected = process.env.FIN_APP_PASSWORD;
  if (!expected) return false;
  if (password.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(password), Buffer.from(expected));
}

export async function hasSession() {
  const expected = getSessionValue();
  const received = (await cookies()).get(COOKIE_NAME)?.value;
  if (!expected || !received || received.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

export async function requireSession() {
  if (!(await hasSession())) redirect("/login");
}

export function sessionCookie() {
  const value = getSessionValue();
  if (!value) throw new Error("FIN_APP_PASSWORD and FIN_SESSION_SECRET must be configured.");
  return {
    name: COOKIE_NAME,
    value,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: 60 * 60 * 12,
    },
  };
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
