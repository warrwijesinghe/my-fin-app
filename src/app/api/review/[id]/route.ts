import { relativeRedirect } from "@/lib/auth";
import { requireApiSession } from "@/lib/route-auth";
// Legacy forms must open the full review editor; posting is centralized and locked.
export async function POST(_request:Request,{params}:{params:Promise<{id:string}>}) {
  const denied=await requireApiSession();if(denied)return denied;
  const {id}=await params;return relativeRedirect(`/review/${encodeURIComponent(id)}`);
}
