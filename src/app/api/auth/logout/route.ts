import { clearSessionCookie, relativeRedirect } from "@/lib/auth";

export async function POST() {
  const response = relativeRedirect("/login");
  response.cookies.set(clearSessionCookie.name, clearSessionCookie.value, clearSessionCookie.options);
  return response;
}
