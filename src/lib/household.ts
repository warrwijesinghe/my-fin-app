import { moneyCents, normalizedQuantity } from "./expenses";
export type HouseholdLine = {
  id:string; transactionId:string; transactionDate:string; description:string|null; owner:"ME"|"WIFE";
  type:string; status:string; household:number|boolean; amount:number|string;
  categoryId:string|null; category:string; itemId:string|null; item:string|null;
  quantity:number|string|null; unit:string|null; account:string|null;
};
export type Budget = {month:string;categoryKey:string;amount:number|string};
export const validMonth=(value:string)=>/^\d{4}-(0[1-9]|1[0-2])$/.test(value)&&Number(value.slice(0,4))>=1900&&Number(value.slice(0,4))<=9998;
export const monthOffset=(month:string,offset:number)=>{const d=new Date(`${month}-01T00:00:00Z`);d.setUTCMonth(d.getUTCMonth()+offset);return d.toISOString().slice(0,7)};
export const monthEnd=(month:string)=>new Date(Date.parse(`${monthOffset(month,1)}-01T00:00:00Z`)-86400000).toISOString().slice(0,10);
export function householdTotals(lines:HouseholdLine[]) {
  const paid=lines.filter(l=>l.household&&l.status==="POSTED"&&l.type==="EXPENSE");
  const sum=(rows:HouseholdLine[])=>rows.reduce((s,r)=>s+moneyCents(r.amount),0)/100;
  return {total:sum(paid),me:sum(paid.filter(l=>l.owner==="ME")),wife:sum(paid.filter(l=>l.owner==="WIFE")),count:new Set(paid.map(l=>l.transactionId)).size};
}
export function itemPurchases(lines:HouseholdLine[]) {
  const groups=new Map<string,{id:string;name:string;unit:string;quantity:number;spend:number;pricedSpend:number;missing:number;entries:number}>();
  for(const l of lines.filter(l=>l.household&&l.status==="POSTED"&&l.type==="EXPENSE"&&l.itemId)) {
    const q=l.quantity!=null&&l.unit?normalizedQuantity(Number(l.quantity),l.unit):null;
    const unit=q?.unit??(l.unit?normalizedQuantity(1,l.unit).unit:"unspecified");
    const key=`${l.itemId}:${unit}`;
    const g=groups.get(key)??{id:l.itemId!,name:l.item||"Item",unit,quantity:0,spend:0,pricedSpend:0,missing:0,entries:0};
    g.spend+=moneyCents(l.amount);g.entries++;
    if(q){g.quantity+=q.quantity;g.pricedSpend+=moneyCents(l.amount)}else g.missing++;
    groups.set(key,g);
  }
  return [...groups.values()].map(g=>({...g,quantity:Math.round(g.quantity*1000000)/1000000,spend:g.spend/100,unitCost:g.quantity>0?g.pricedSpend/100/g.quantity:null})).sort((a,b)=>b.spend-a.spend);
}
export function categorySpending(lines:HouseholdLine[]) {
  const groups=new Map<string,{id:string;name:string;me:number;wife:number;total:number}>();
  for(const l of lines.filter(l=>l.household&&l.status==="POSTED"&&l.type==="EXPENSE")) {
    const key=l.categoryId??"uncategorized",g=groups.get(key)??{id:key,name:l.category,me:0,wife:0,total:0};
    g[l.owner==="ME"?"me":"wife"]+=moneyCents(l.amount);g.total+=moneyCents(l.amount);groups.set(key,g);
  }
  return [...groups.values()].map(g=>({...g,me:g.me/100,wife:g.wife/100,total:g.total/100})).sort((a,b)=>b.total-a.total);
}
export function shoppingPlan(lines:HouseholdLine[],month:string) {
  const from=`${monthOffset(month,-3)}-01`, to=`${month}-01`;
  return itemPurchases(lines.filter(l=>l.transactionDate>=from&&l.transactionDate<to)).filter(g=>g.quantity>0).map(g=>({...g,monthlyQuantity:Math.round(g.quantity/3*1000)/1000}));
}
export function csvText(data:unknown[][]) {
  return "\uFEFF"+data.map(row=>row.map(value=>{const text=String(value??"");return '"'+(/^[\s]*[=+@-]|^[\t\r\n]/.test(text)?"'":"")+text.replaceAll('"','""')+'"'}).join(",")).join("\r\n");
}
