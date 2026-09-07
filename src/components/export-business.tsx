"use client";
import { csvText } from "@/lib/household";
export function ExportBusiness({data,month}:{data:(string|number)[][];month:string}){
  function download(){const url=URL.createObjectURL(new Blob([csvText(data)],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download=`business-report-${month}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  return <button className="button" type="button" onClick={download}>Export report</button>;
}
