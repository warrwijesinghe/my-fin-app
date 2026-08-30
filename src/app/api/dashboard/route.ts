import { NextRequest, NextResponse } from "next/server";
import { MoneyScope } from "@/lib/types";
import { getDashboardData } from "@/lib/finance";
import { hasSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  if (!(await hasSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const value = request.nextUrl.searchParams.get("scope");
  const scope = value === "PERSONAL" || value === "BUSINESS" ? value as MoneyScope : undefined;
  return NextResponse.json(await getDashboardData(scope));
}
