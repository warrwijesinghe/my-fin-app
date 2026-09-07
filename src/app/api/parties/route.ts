import crypto from "node:crypto";
import { z } from "zod";
import { relativeRedirect } from "@/lib/auth";
import { requireApiSession } from "@/lib/route-auth";
import { transaction } from "@/lib/db";
const schema=z.object({id:z.string().uuid().optional(),name:z.string().trim().min(2).max(140),kind:z.enum(["CUSTOMER","SUPPLIER","BOTH"]),contactNo:z.string().trim().max(40)});
export async function POST(request:Request){
  const denied=await requireApiSession();if(denied)return denied;
  const f=await request.formData(),parsed=schema.safeParse({id:f.get("id")||undefined,name:f.get("name"),kind:f.get("kind"),contactNo:f.get("contactNo")||""});
  if(!parsed.success)return relativeRedirect("/master-data/parties?error=1");
  const d=parsed.data,isCash=f.get("isCash")==="on",active=f.get("isActive")==="on";
  try{await transaction(async c=>{
    if(d.id){
      const [found]=await c.execute<any[]>("SELECT * FROM Party WHERE id=? FOR UPDATE",[d.id]);
      if(!found.length)throw new Error("missing");
      const [used]=await c.execute<any[]>("SELECT id FROM FinancialTransaction WHERE partyId=? LIMIT 1",[d.id]);
      if(used.length&&(found[0].kind!==d.kind||Boolean(found[0].isCash)!==isCash))throw new Error("history");
      await c.execute("UPDATE Party SET name=?,kind=?,contactNo=?,isCash=?,isActive=? WHERE id=?",[d.name,d.kind,d.contactNo||null,isCash,active,d.id]);
    }else await c.execute("INSERT INTO Party (id,name,kind,contactNo,isCash,isActive) VALUES (?,?,?,?,?,?)",[crypto.randomUUID(),d.name,d.kind,d.contactNo||null,isCash,active]);
  });}catch{return relativeRedirect("/master-data/parties?error=1")}
  return relativeRedirect("/master-data/parties?saved=1");
}
