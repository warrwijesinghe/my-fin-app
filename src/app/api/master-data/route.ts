import crypto from "node:crypto";
import { relativeRedirect } from "@/lib/auth";
import { z } from "zod";
import { execute, rows } from "@/lib/db";
import { requireApiSession } from "@/lib/route-auth";

const entitySchema = z.enum(["PROJECT", "CATEGORY", "TASK"]);
const baseSchema = z.object({ entity: entitySchema, intent: z.enum(["create", "update", "delete"]), id: z.string().uuid().optional() });
const nameSchema = z.string().trim().min(2).max(140);
const scopeSchema = z.enum(["PERSONAL", "BUSINESS"]);

function redirect(result: string, entity?: string) { const query = new URLSearchParams({ [result]: "1" }); if (entity) query.set("section", entity); return relativeRedirect(`/master-data?${query}`); }

export async function POST(request: Request) {
  const denied = await requireApiSession();
  if (denied) return denied;
  const form = await request.formData();
  const base = baseSchema.safeParse({ entity: form.get("entity"), intent: form.get("intent"), id: form.get("id") || undefined });
  if (!base.success || ((base.data.intent === "update" || base.data.intent === "delete") && !base.data.id)) return redirect("error");
  const { entity, intent, id } = base.data;
  if (intent === "delete") {
    const table = entity === "PROJECT" ? "Project" : entity === "CATEGORY" ? "Category" : "Task";
    const [used] = await rows<any>(entity==="CATEGORY" ? "SELECT (SELECT COUNT(*) FROM FinancialTransaction WHERE categoryId=?) + (SELECT COUNT(*) FROM Item WHERE categoryId=?) + (SELECT COUNT(*) FROM ExpenseLine WHERE categoryId=?) count" : entity==="PROJECT" ? "SELECT COUNT(*) count FROM FinancialTransaction WHERE projectId=?" : "SELECT COUNT(*) count FROM FinancialTransaction WHERE taskId=?",entity==="CATEGORY"?[id,id,id]:[id]);
    if(Number(used?.count)>0)return redirect("error",entity);
    await execute(`DELETE FROM \`${table}\` WHERE id=?`, [id]);
    return redirect("deleted", entity);
  }
  const active = form.get("isActive") === "on";
  const name = nameSchema.safeParse(form.get("name"));
  if (!name.success) return redirect("error", entity);
  if (entity === "PROJECT") {
    if (intent === "create") await execute("INSERT INTO `Project` (id,name,isActive) VALUES (?,?,?)", [crypto.randomUUID(), name.data, active]);
    else await execute("UPDATE `Project` SET name=?,isActive=? WHERE id=?", [name.data, active, id]);
  }
  if (entity === "CATEGORY") {
    const rawScope = String(form.get("scope") || "");
    const scope = rawScope ? scopeSchema.safeParse(rawScope) : null;
    if (scope && !scope.success) return redirect("error", entity);
    const value = scope ? scope.data : null;
    const kind=z.enum(["INCOME","EXPENSE"]).safeParse(form.get("kind")||"EXPENSE");
    if(!kind.success || name.data.length>100) return redirect("error",entity);
    if(intent==="update") { const [used]=await rows<any>("SELECT (SELECT COUNT(*) FROM FinancialTransaction WHERE categoryId=?) + (SELECT COUNT(*) FROM Item WHERE categoryId=?) + (SELECT COUNT(*) FROM ExpenseLine WHERE categoryId=?) count",[id,id,id]); const [existing]=await rows<any>("SELECT kind FROM Category WHERE id=?",[id]); if(Number(used?.count)>0 && existing?.kind!==kind.data)return redirect("error",entity); }
    if (intent === "create") await execute("INSERT INTO `Category` (id,name,scope,kind,isActive) VALUES (?,?,?,?,?)", [crypto.randomUUID(), name.data, value, kind.data, active]);
    else await execute("UPDATE `Category` SET name=?,scope=?,kind=?,isActive=? WHERE id=?", [name.data, value, kind.data, active, id]);
  }
  if (entity === "TASK") {
    const scope = scopeSchema.safeParse(form.get("scope"));
    const projectId = String(form.get("projectId") || "") || null;
    if (!scope.success || (projectId && !z.string().uuid().safeParse(projectId).success)) return redirect("error", entity);
    if (intent === "create") await execute("INSERT INTO `Task` (id,name,scope,projectId,isActive) VALUES (?,?,?,?,?)", [crypto.randomUUID(), name.data, scope.data, projectId, active]);
    else await execute("UPDATE `Task` SET name=?,scope=?,projectId=?,isActive=? WHERE id=?", [name.data, scope.data, projectId, active, id]);
  }
  return redirect(intent === "create" ? "created" : "updated", entity);
}
