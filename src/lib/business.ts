import { monthEnd, monthOffset, validMonth } from "./household";
export const COST_GROUPS = ["DIRECT", "OVERHEAD", "FINANCE", "TAX", "UNCLASSIFIED"] as const;
export type CostGroup = typeof COST_GROUPS[number];
export const costLabels: Record<CostGroup,string> = {DIRECT:"Direct costs",OVERHEAD:"Operating overhead",FINANCE:"Finance costs",TAX:"Business tax expense",UNCLASSIFIED:"Unclassified costs"};
export type BusinessLine = {id:string;activityId:string;transactionDate:string;type:string;status:string;owner:string;scope:string;amount:number|string;categoryId:string|null;category:string;projectId:string|null;project:string;description?:string|null};
export function businessPeriod(month:string,today:string){
  if(!validMonth(month)||month>today.slice(0,7))return null;
  const current=month===today.slice(0,7),end=current?today:monthEnd(month),previousMonth=monthOffset(month,-1);
  const previousEnd=current?`${previousMonth}-${String(Math.min(Number(today.slice(8)),Number(monthEnd(previousMonth).slice(8)))).padStart(2,"0")}`:monthEnd(previousMonth);
  return {month,start:`${month}-01`,end,previousStart:`${previousMonth}-01`,previousEnd,trendStart:`${monthOffset(month,-5)}-01`,current};
}
export function businessSummary(lines:BusinessLine[],start:string,end:string,costs:Record<string,CostGroup>={},owner:"ME"|"WIFE"="ME"){
  const selected=lines.filter(l=>l.owner===owner&&l.scope==="BUSINESS"&&l.status==="POSTED"&&["INCOME","EXPENSE","ACCRUED_EXPENSE"].includes(l.type)&&l.transactionDate>=start&&l.transactionDate<=end);
  let revenue=0,expenses=0;
  const groups:Record<CostGroup,number>={DIRECT:0,OVERHEAD:0,FINANCE:0,TAX:0,UNCLASSIFIED:0};
  const categories=new Map<string,{id:string;name:string;group:CostGroup;amount:number}>();
  const projects=new Map<string,{id:string;name:string;revenue:number;cost:number}>();
  for(const l of selected){
    const cents=Math.round(Number(l.amount)*100),projectKey=l.projectId??"";
    const project=projects.get(projectKey)??{id:projectKey,name:l.projectId?l.project:"General business / no project",revenue:0,cost:0};
    if(l.type==="INCOME"){revenue+=cents;project.revenue+=cents;}else{
      expenses+=cents;project.cost+=cents;
      const id=l.categoryId??"uncategorized",configured=costs[id],group=COST_GROUPS.includes(configured)?configured:"UNCLASSIFIED";
      groups[group]+=cents;
      const category=categories.get(id)??{id,name:l.category,group,amount:0};category.amount+=cents;categories.set(id,category);
    }
    projects.set(projectKey,project);
  }
  const profit=revenue-expenses,classified=groups.UNCLASSIFIED===0;
  return {revenue:revenue/100,expenses:expenses/100,profit:profit/100,margin:revenue>0?profit/revenue*100:null,count:new Set(selected.map(l=>l.id)).size,
    groups:Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,v/100])) as Record<CostGroup,number>,
    grossProfit:classified?(revenue-groups.DIRECT)/100:null,
    operatingProfit:classified?(revenue-groups.DIRECT-groups.OVERHEAD)/100:null,
    beforeTax:classified?(revenue-groups.DIRECT-groups.OVERHEAD-groups.FINANCE)/100:null,
    categories:[...categories.values()].map(c=>({...c,amount:c.amount/100,share:expenses?c.amount/expenses*100:0})).sort((a,b)=>b.amount-a.amount),
    projects:[...projects.values()].map(p=>({...p,revenue:p.revenue/100,cost:p.cost/100,result:(p.revenue-p.cost)/100,margin:p.revenue>0?(p.revenue-p.cost)/p.revenue*100:null})).sort((a,b)=>b.result-a.result)};
}
export function costChanges(current:ReturnType<typeof businessSummary>,previous:ReturnType<typeof businessSummary>){
  return current.categories.map(c=>({...c,previous:previous.categories.find(p=>p.id===c.id)?.amount??0})).map(c=>({...c,increase:Math.round((c.amount-c.previous)*100)/100})).filter(c=>c.increase>0).sort((a,b)=>b.increase-a.increase);
}
export function dueBucket(dueDate:string|null,today:string){
  if(!dueDate)return "No due date";
  if(dueDate>=today)return "Not overdue";
  const days=Math.round((Date.parse(today)-Date.parse(dueDate))/86400000);
  return days<=30?"1–30 days overdue":days<=60?"31–60 days overdue":"61+ days overdue";
}
