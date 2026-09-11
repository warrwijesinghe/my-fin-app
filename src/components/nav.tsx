"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type LinkItem = readonly [label:string, href:string, icon:string];
const mobileLinks:LinkItem[] = [["Dashboard","/","⌂"],["Transactions","/transactions","↔"],["Business","/business","⌁"],["Household","/household","⌂"],["Master Files","/master-data","⚙"]];
const modules:{label:string;href:string;icon:string}[] = [
  {label:"Transactions",href:"/transactions",icon:"↔"},
  {label:"Account Center",href:"/account-center",icon:"▣"},
  {label:"Analytics",href:"/analytics",icon:"◔"},
  {label:"Business",href:"/business",icon:"⌁"},
  {label:"Household",href:"/household",icon:"⌂"},
  {label:"Master Files",href:"/master-data",icon:"⚙"},
];

function isCurrent(pathname:string,href:string) { return href==="/" ? pathname===href : pathname.startsWith(href); }
function parentPage(pathname:string) {
  if(/^\/account-center\/[^/]+$/.test(pathname))return "/account-center";
  if(/^\/master-data\/(accounts|projects|categories|tasks|items|parties)$/.test(pathname))return "/master-data";
  if(/^\/transactions\/[^/]+$/.test(pathname)||pathname==="/transactions/new")return "/transactions";
  if(/^\/review\/[^/]+$/.test(pathname))return "/review";
  if(pathname==="/bills")return "/transactions";
  if(pathname.startsWith("/shared-transactions"))return "/household";
  if(pathname.startsWith("/parties/"))return "/master-data/parties";
  return "/";
}

function Sidebar({open}:{open:boolean}) {
  const pathname=usePathname();
  return <aside className={`app-sidebar ${open?"is-open":"is-collapsed"}`} aria-label="Application navigation"><nav><Link href="/" title="Dashboard" className={`sidebar-dashboard ${pathname==="/"?"active":""}`} aria-current={pathname==="/"?"page":undefined}><span className="sidebar-icon" aria-hidden="true">⌂</span><span className="sidebar-label">Dashboard</span></Link>{modules.map(module=><Link key={module.href} href={module.href} title={module.label} className={`sidebar-module ${isCurrent(pathname,module.href)?"active":""}`} aria-current={isCurrent(pathname,module.href)?"page":undefined}><span className="sidebar-icon" aria-hidden="true">{module.icon}</span><span className="sidebar-label">{module.label}</span></Link>)}</nav><div className="sidebar-footer"><span className="sidebar-label">FIN Control</span><span className="sidebar-version">Personal finance</span></div></aside>;
}

function MobileStackHeader() {
  const pathname=usePathname(),router=useRouter();
  const title=pathname==="/"?"FIN Control":pathname.startsWith("/shared-cash")?"Shared cash":pathname.startsWith("/account-center")?"Account Center":pathname.startsWith("/transactions")?"Transactions":pathname.startsWith("/parties")?"Customer / supplier ledger":pathname.startsWith("/master-data")?"Master data":pathname.startsWith("/review")?"Review":pathname.startsWith("/bills")?"Pay-later bills":pathname.startsWith("/business")?"Business":pathname.startsWith("/household")?"Household":pathname.startsWith("/analytics")?"Analytics":"Reports";
  return <div className="mobile-stack">{pathname!=="/"&&<button aria-label="Go to parent page" onClick={()=>router.push(parentPage(pathname))} type="button">‹ Back</button>}<strong>{title}</strong></div>;
}

function MobileNavigation() {
  const pathname=usePathname();
  return <nav className="mobile-nav" aria-label="Application navigation">{mobileLinks.map(([label,href])=><Link key={href} href={href} className={isCurrent(pathname,href)?"active":""} aria-current={isCurrent(pathname,href)?"page":undefined}>{label}</Link>)}</nav>;
}

export function Nav() {
  const [open,setOpen]=useState(true);
  const pathname=usePathname(),router=useRouter();
  return <><header className="site-header sidebar-header"><Link className="brand" href="/">FIN <span>Control</span></Link><button className="sidebar-toggle" type="button" onClick={()=>setOpen(value=>!value)} aria-label={open?"Collapse sidebar":"Expand sidebar"} aria-expanded={open}>☰</button>{pathname!=="/"&&<button className="global-back" type="button" onClick={()=>router.push(parentPage(pathname))}>← Back</button>}<MobileStackHeader/><form action="/api/auth/logout" method="post"><button className="link-button" type="submit">Log out</button></form></header><Sidebar open={open}/><MobileNavigation/></>;
}
