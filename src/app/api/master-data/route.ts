import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { execute } from "@/lib/db";
import { requireApiSession } from "@/lib/route-auth";

const entitySchema = z.enum(["PROJECT", "CATEGORY", "TASK"]);
const baseSchema = z.object({ entity: entitySchema, intent: z.enum(["create", "update", "delete"]), id: z.string().uuid().optional() });
const nameSchema = z.string().trim().min(2).max(140);
const scopeSchema = z.enum(["PERSONAL", "BUSINESS"]);

function redirect(request: Request, result: string) { return NextResponse.redirect(new URL(`/master-data?${result}=1`, request.url)); }

export async function POST(request: Request) {
  const denied = await requireApiSession();
  if (denied) return denied;
  const form = await request.formData();
  const base = baseSchema.safeParse({ entity: form.get("entity"), intent: form.get("intent"), id: form.get("id") || undefined });
  if (!base.success || ((base.data.intent === "update" || base.data.intent === "delete") && !base.data.id)) return redirect(request, "error");
  const { entity, intent, id } = base.data;
  if (intent === "delete") {
    const table = entity === "PROJECT" ? "Project" : entity === "CATEGORY" ? "Category" : "Task";
    await execute(`DELETE FROM \`${table}\` WHERE id=?`, [id]);
    return redirect(request, "deleted");
  }
  const active = form.get("isActive") === "on";
  const name = nameSchema.safeParse(form.get("name"));
  if (!name.success) return redirect(request, "error");
  if (entity === "PROJECT") {
    if (intent === "create") await execute("INSERT INTO `Project` (id,name,isActive) VALUES (?,?,?)", [crypto.randomUUID(), name.data, active]);
    else await execute("UPDATE `Project` SET name=?,isActive=? WHERE id=?", [name.data, active, id]);
  }
  if (entity === "CATEGORY") {
    const rawScope = String(form.get("scope") || "");
    const scope = rawScope ? scopeSchema.safeParse(rawScope) : null;
    if (scope && !scope.success) return redirect(request, "error");
    const value = scope ? scope.data : null;
    if (intent === "create") await execute("INSERT INTO `Category` (id,name,scope,isActive) VALUES (?,?,?,?)", [crypto.randomUUID(), name.data, value, active]);
    else await execute("UPDATE `Category` SET name=?,scope=?,isActive=? WHERE id=?", [name.data, value, active, id]);
  }
  if (entity === "TASK") {
    const scope = scopeSchema.safeParse(form.get("scope"));
    const projectId = String(form.get("projectId") || "") || null;
    if (!scope.success || (projectId && !z.string().uuid().safeParse(projectId).success)) return redirect(request, "error");
    if (intent === "create") await execute("INSERT INTO `Task` (id,name,scope,projectId,isActive) VALUES (?,?,?,?,?)", [crypto.randomUUID(), name.data, scope.data, projectId, active]);
    else await execute("UPDATE `Task` SET name=?,scope=?,projectId=?,isActive=? WHERE id=?", [name.data, scope.data, projectId, active, id]);
  }
  return redirect(request, intent === "create" ? "created" : "updated");
}
