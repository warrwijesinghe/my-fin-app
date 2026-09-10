import { z } from "zod";
import { currentOwner, relativeRedirect } from "@/lib/auth";
import { requireApiSession } from "@/lib/route-auth";
import { execute,rows } from "@/lib/db";
import { COST_GROUPS } from "@/lib/business";
import { validMonth } from "@/lib/household";
const amount=z.preprocess(v=>v===""||v==null?null:v,z.coerce.number().min(0).max(999999999).refine(n=>Math.abs(n*100-Math.round(n*100))<0.00001).nullable());
export async function POST(request:Request){
  const denied=await requireApiSession(); if(denied)return denied; const viewer=await currentOwner();
  const f=await request.formData(),month=String(f.get("month")||"");
  if(!validMonth(month))return relativeRedirect("/business?error=1");
  const back=`/business?month=${month}`;let key:string,value:unknown;
  if(f.get("intent")==="cost"){
    const id=z.string().min(1).max(80).safeParse(f.get("categoryId")),group=z.enum(COST_GROUPS).safeParse(f.get("costGroup"));
    if(!id.success||!group.success)return relativeRedirect(`${back}&error=1`);
    if(id.data!=="uncategorized"&&!(await rows("SELECT id FROM Category WHERE id=? AND kind='EXPENSE'",[id.data])).length)return relativeRedirect(`${back}&error=1`);
    key=`businessCost:${id.data}`;value=group.data;
  }else if(f.get("intent")==="targets"){
    const parsed=z.object({revenue:amount,expenses:amount,profit:amount}).safeParse({revenue:f.get("revenue"),expenses:f.get("expenses"),profit:f.get("profit")});
    if(!parsed.success)return relativeRedirect(`${back}&error=1`);
    key=`businessTargets:${month}`;value=parsed.data;
  }else return relativeRedirect(`${back}&error=1`);
  await execute("INSERT INTO AppSetting (owner,`key`,value,updatedAt) VALUES (?,?,?,NOW(3)) ON DUPLICATE KEY UPDATE value=VALUES(value),updatedAt=NOW(3)",[viewer,key,JSON.stringify(value)]);
  return relativeRedirect(`${back}&saved=1`);
}
