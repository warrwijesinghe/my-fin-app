import { NextResponse } from "next/server";
import { isCorrectPassword, sessionCookie } from "@/lib/auth";

export async function POST(request: Request) {
  const formData = await request.formData();
  const password = String(formData.get("password") ?? "");
  if (!isCorrectPassword(password)) return NextResponse.redirect(new URL("/login?error=invalid", request.url));
  const response = NextResponse.redirect(new URL("/", request.url));
  const cookie = sessionCookie();
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
