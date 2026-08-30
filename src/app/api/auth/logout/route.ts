import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.set(clearSessionCookie.name, clearSessionCookie.value, clearSessionCookie.options);
  return response;
}
