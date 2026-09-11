"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type LinkItem = readonly [label:string, href:string, icon:string];
const mobileLinks:LinkItem[] = [["Home","/","⌂"],["Transactions","/transactions/new","↔"],["Review","/review","✓"]];
const moreLinks:LinkItem[] = [["Pay-later bills","/bills","◷"],["Account Center","/account-center","▣"],["Business","/business","⌁"],["Household","/household","⌂"],["Shared cash","/shared-cash","⇄"],["Analytics","/analytics","◔"],["Master data","/master-data","⚙"],["Customers & suppliers","/master-data/parties","♙"],["Reports","/reports","▤"]];
const groups:{label:string;icon:string;links:LinkItem[]}[] = [
  {label:"Insights",icon:"◔",links:[["Account Center","/account-center","▣"],["Analytics","/analytics","◔"],["Reports","/reports","▤"]]},
  {label:"Money",icon:"↔",links:[["Transactions","/transactions/new","↔"],["Review queue","/review","✓"],["Pay-later bills","/bills","◷"]]},
  {label:"Household",icon:"⌂",links:[["Household","/household","⌂"],["Shared cash","/shared-cash","⇄"]]},
  {label:"Management",icon:"⚙",links:[["Business","/business","⌁"],["Master data","/master-data","⚙"],["Customers & suppliers","/master-data/parties","♙"]]},
];

function isCurrent(pathname:string,href:string) { return href==="/" ? pathname===href : pathname.startsWith(href); }

function Sidebar({open}:{open:boolean}) {
  const pathname=usePathname();
  return <aside className={`app-sidebar ${open?"is-open":"is-collapsed"}`} aria-label="Application navigation"><nav><Link href="/" title="Dashboard" className={`sidebar-dashboard ${pathname==="/"?"active":""}`} aria-current={pathname==="/"?"page":undefined}><span className="sidebar-icon" aria-hidden="true">⌂</span><span className="sidebar-label">Dashboard</span></Link>{groups.map(group=>{
    const selected=group.links.some(([,href])=>isCurrent(pathname,href));
    return <details key={group.label} open={selected}><summary title={group.label}><span className="sidebar-icon" aria-hidden="true">{group.icon}</span><span className="sidebar-label">{group.label}</span><span className="sidebar-caret" aria-hidden="true">⌄</span></summary><div className="sidebar-links">{group.links.map(([label,href,icon])=><Link key={href} href={href} title={label} className={isCurrent(pathname,href)?"active":""} aria-current={isCurrent(pathname,href)?"page":undefined}><span className="sidebar-icon" aria-hidden="true">{icon}</span><span className="sidebar-label">{label}</span></Link>)}</div></details>;
  })}</nav><div className="sidebar-footer"><span className="sidebar-label">FIN Control</span><span className="sidebar-version">Personal finance</span></div></aside>;
}

function MobileStackHeader() {
  const pathname=usePathname(),router=useRouter();
  const title=pathname==="/"?"FIN Control":pathname.startsWith("/shared-cash")?"Shared cash":pathname.startsWith("/account-center")?"Account Center":pathname.startsWith("/transactions")?"Transactions":pathname.startsWith("/parties")?"Customer / supplier ledger":pathname.startsWith("/master-data")?"Master data":pathname.startsWith("/review")?"Review":pathname.startsWith("/bills")?"Pay-later bills":pathname.startsWith("/business")?"Business":pathname.startsWith("/household")?"Household":pathname.startsWith("/analytics")?"Analytics":"Reports";
  return <div className="mobile-stack">{pathname!=="/"&&<button aria-label="Go back" onClick={()=>window.history.length>1?router.back():router.push("/")} type="button">‹ Back</button>}<strong>{title}</strong></div>;
}

function MobileNavigation() {
  const pathname=usePathname(),dialog=useRef<HTMLDialogElement>(null);
  const inMore=!mobileLinks.some(([,href])=>isCurrent(pathname,href));
  return <><nav className="mobile-nav" aria-label="Mobile navigation" style={{gridTemplateColumns:"repeat(4,minmax(0,1fr))"}}>{mobileLinks.map(([label,href])=><Link key={href} href={href} className={isCurrent(pathname,href)?"active":""} aria-current={isCurrent(pathname,href)?"page":undefined}>{label}</Link>)}<button type="button" className={inMore?"active":""} aria-haspopup="dialog" onClick={()=>dialog.current?.showModal()}>More</button></nav><dialog ref={dialog} className="mobile-more-dialog" aria-labelledby="more-title"><div className="section-heading"><h2 id="more-title">More</h2><button type="button" className="button" onClick={()=>dialog.current?.close()}>Close</button></div><nav aria-label="More pages">{moreLinks.map(([label,href])=><Link key={href} href={href} aria-current={isCurrent(pathname,href)?"page":undefined} onClick={()=>dialog.current?.close()}>{label}<span aria-hidden="true">›</span></Link>)}</nav></dialog></>;
}

export function Nav() {
  const [open,setOpen]=useState(true);
  return <><header className="site-header sidebar-header"><Link className="brand" href="/">FIN <span>Control</span></Link><button className="sidebar-toggle" type="button" onClick={()=>setOpen(value=>!value)} aria-label={open?"Collapse sidebar":"Expand sidebar"} aria-expanded={open}>☰</button><MobileStackHeader/><form action="/api/auth/logout" method="post"><button className="link-button" type="submit">Log out</button></form></header><Sidebar open={open}/><MobileNavigation/></>;
}
