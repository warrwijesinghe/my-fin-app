import crypto from "node:crypto";
import { currentOwner, relativeRedirect } from "@/lib/auth";
import { z } from "zod";
import { execute, rows, masterRecordInUse } from "@/lib/db";
import { requireApiSession } from "@/lib/route-auth";

const entitySchema = z.enum(["PROJECT", "CATEGORY", "TASK"]);
const baseSchema = z.object({ entity: entitySchema, intent: z.enum(["create", "update", "delete"]), id: z.string().uuid().optional() });
const nameSchema = z.string().trim().min(2).max(140);
const scopeSchema = z.enum(["PERSONAL", "BUSINESS"]);

function redirect(result: string, entity?: string, returnTo?: string) { const query = new URLSearchParams({ [result]: "1" }); if (entity) query.set("section", entity); const target=returnTo&&/^\/master-data\/(projects|categories|tasks)$/.test(returnTo)?returnTo:"/master-data"; return relativeRedirect(`${target}?${query}`); }

export async function POST(request: Request) {
  const denied=await requireApiSession(); if(denied)return denied; const viewer=await currentOwner();
  const form = await request.formData();
  const returnTo=String(form.get("returnTo")||"");
  const base = baseSchema.safeParse({ entity: form.get("entity"), intent: form.get("intent"), id: form.get("id") || undefined });
  if (!base.success || ((base.data.intent === "update" || base.data.intent === "delete") && !base.data.id)) return redirect("error",undefined,returnTo);
  const { entity, intent, id } = base.data;
  const targetTable = entity === "PROJECT" ? "Project" : entity === "CATEGORY" ? "Category" : "Task";
  if (id && !(await rows<any>("SELECT id FROM "+targetTable+" WHERE id=?",[id])).length) return redirect("error",entity,returnTo);
  if (intent === "delete") {
    const table = entity === "PROJECT" ? "Project" : entity === "CATEGORY" ? "Category" : "Task";
    if(await masterRecordInUse(entity,id!))return redirect("error",entity,returnTo);
    await execute(`DELETE FROM \`${table}\` WHERE id=?`, [id]);
    return redirect("deleted", entity,returnTo);
  }
  const active = form.get("isActive") === "on";
  const name = nameSchema.safeParse(form.get("name"));
  if (!name.success) return redirect("error", entity,returnTo);
  if (entity === "PROJECT") {
    if (intent === "create") await execute("INSERT INTO `Project` (owner,id,name,isActive) VALUES (?,?,?,?)", [viewer, crypto.randomUUID(), name.data, active]);
    else await execute("UPDATE `Project` SET name=?,isActive=? WHERE id=?", [name.data, active, id]);
  }
  if (entity === "CATEGORY") {
    const rawScope = String(form.get("scope") || "");
    const scope = rawScope ? scopeSchema.safeParse(rawScope) : null;
    if (scope && !scope.success) return redirect("error", entity,returnTo);
    const value = scope ? scope.data : null;
    const kind=z.enum(["INCOME","EXPENSE"]).safeParse(form.get("kind")||"EXPENSE");
    if(!kind.success || name.data.length>100) return redirect("error",entity,returnTo);
    if(intent==="update") { const [existing]=await rows<any>("SELECT kind FROM Category WHERE id=?",[id]); if(await masterRecordInUse("CATEGORY",id!) && existing?.kind!==kind.data)return redirect("error",entity,returnTo); }
    if (intent === "create") await execute("INSERT INTO `Category` (owner,id,name,scope,kind,isActive) VALUES (?,?,?,?,?,?)", [viewer, crypto.randomUUID(), name.data, value, kind.data, active]);
    else await execute("UPDATE `Category` SET name=?,scope=?,kind=?,isActive=? WHERE id=?", [name.data, value, kind.data, active, id]);
  }
  if (entity === "TASK") {
    const scope = scopeSchema.safeParse(form.get("scope"));
    const projectId = String(form.get("projectId") || "") || null;
    if (!scope.success || (projectId && !z.string().uuid().safeParse(projectId).success)) return redirect("error", entity,returnTo);
    if (projectId && !(await rows<any>("SELECT id FROM Project WHERE id=?",[projectId])).length) return redirect("error",entity,returnTo);
    if(intent === "update") {
      const [existing] = await rows<any>("SELECT owner FROM Task WHERE id=?",[id]);
      if(existing?.owner !== viewer) {
        await execute("UPDATE Task SET name=?,scope=?,isActive=? WHERE id=?",[name.data,scope.data,active,id]);
        return redirect("updated",entity,returnTo);
      }
    }
    if (intent === "create") await execute("INSERT INTO `Task` (owner,id,name,scope,projectId,isActive) VALUES (?,?,?,?,?,?)", [viewer, crypto.randomUUID(), name.data, scope.data, projectId, active]);
    else await execute("UPDATE `Task` SET name=?,scope=?,projectId=?,isActive=? WHERE id=?", [name.data, scope.data, projectId, active, id]);
  }
  return redirect(intent === "create" ? "created" : "updated", entity, returnTo);
}
