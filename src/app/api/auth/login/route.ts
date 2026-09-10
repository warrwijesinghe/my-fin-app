import { isCorrectPassword, relativeRedirect, sessionCookie } from "@/lib/auth";

export async function POST(request: Request) {
  const formData = await request.formData();
  const owner = formData.get("owner") === "WIFE" ? "WIFE" : "ME";
  const password = String(formData.get("password") ?? "");
  if (!isCorrectPassword(password, owner)) return relativeRedirect("/login?error=invalid");
  const response = relativeRedirect("/");
  const cookie = sessionCookie(owner);
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
