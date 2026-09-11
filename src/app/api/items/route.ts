import crypto from "node:crypto";
import { z } from "zod";
import { rows, execute } from "@/lib/db";
import { requireApiSession } from "@/lib/route-auth";
import { relativeRedirect } from "@/lib/auth";
import { UNITS, normalizeItem } from "@/lib/expenses";

export async function POST(request: Request) {
  const denied = await requireApiSession(); if (denied) return denied;
  const form = await request.formData();
  const back="/master-data/items";
  if(form.get("intent")==="delete") { const id=z.string().uuid().safeParse(form.get("id")); if(!id.success||(await rows<any>("SELECT COUNT(*) count FROM ExpenseLine WHERE itemId=?",[id.data]))[0]?.count)return relativeRedirect(`${back}?error=1`); await execute("DELETE FROM Item WHERE id=?",[id.data]); return relativeRedirect(`${back}?deleted=1`); }
  const p = z.object({ id:z.string().uuid().optional(), name:z.string().trim().min(1).max(140),categoryId:z.string().min(1),defaultUnit:z.enum(UNITS).optional() }).safeParse(Object.fromEntries([...form].map(([k,v])=>[k,String(v)||undefined])));
  if (!p.success) return relativeRedirect("/master-data/items?error=1");
  const d=p.data;
  if(d.id && !(await rows<any>("SELECT id FROM Item WHERE id=?",[d.id])).length)return relativeRedirect("/master-data/items?error=1");
  const [category]=await rows<any>("SELECT id FROM Category WHERE id=? AND kind='EXPENSE' AND isActive=1",[d.categoryId]);
  if(!category)return relativeRedirect("/master-data/items?error=1");
  try {
    if(d.id) await execute("UPDATE Item SET name=?,normalizedName=?,categoryId=?,defaultUnit=?,isActive=? WHERE id=?",[d.name,normalizeItem(d.name),d.categoryId,d.defaultUnit||null,form.get("isActive")==="on",d.id]);
    else await execute("INSERT INTO Item (id,name,normalizedName,categoryId,defaultUnit,isActive) VALUES (?,?,?,?,?,?)",[crypto.randomUUID(),d.name,normalizeItem(d.name),d.categoryId,d.defaultUnit||null,form.get("isActive")==="on"]);
  } catch(error) { if((error as {code?:string}).code==="ER_DUP_ENTRY")return relativeRedirect("/master-data/items?error=duplicate"); throw error; }
  return relativeRedirect("/master-data/items?saved=1");
}
