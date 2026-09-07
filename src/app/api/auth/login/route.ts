import { isCorrectPassword, relativeRedirect, sessionCookie } from "@/lib/auth";
//login
export async function POST(request: Request) {
  const formData = await request.formData();
  const password = String(formData.get("password") ?? "");
  if (!isCorrectPassword(password)) return relativeRedirect("/login?error=invalid");
  const response = relativeRedirect("/");
  const cookie = sessionCookie();
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
