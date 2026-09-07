"use client";

import { useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const desktopLinks = [["Dashboard", "/"], ["Account Center", "/account-center"], ["Transactions", "/transactions/new"], ["Review", "/review"], ["Master data", "/master-data"], ["Analytics", "/analytics"], ["Household", "/household"], ["Business", "/business"], ["Reports", "/reports"]] as const;
const mobileLinks = [["Home", "/"], ["Transactions", "/transactions/new"], ["Review", "/review"]] as const;
const moreLinks = [["Pay-later bills", "/bills"], ["Account Center", "/account-center"], ["Business", "/business"], ["Household", "/household"], ["Analytics", "/analytics"], ["Master data", "/master-data"], ["Customers & suppliers", "/master-data/parties"], ["Reports", "/reports"]] as const;

function isCurrent(pathname: string, href: string) { return href === "/" ? pathname === href : pathname.startsWith(href); }

function AppLinks({ links, className }: { links: readonly (readonly [string, string])[]; className: string }) {
  const pathname = usePathname();
  return <nav aria-label="Main navigation" className={className} style={className === "mobile-nav" ? { gridTemplateColumns: `repeat(${links.length}, minmax(0, 1fr))` } : undefined}>{links.map(([label, href]) => <Link aria-current={isCurrent(pathname, href) ? "page" : undefined} className={isCurrent(pathname, href) ? "active" : undefined} key={href} href={href}>{label}</Link>)}</nav>;
}

function MobileStackHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const title = pathname === "/" ? "FIN Control" : pathname.startsWith("/account-center") ? "Account Center" : pathname.startsWith("/transactions") ? "Transactions" : pathname.startsWith("/parties") ? "Customer / supplier ledger" : pathname.startsWith("/master-data") ? "Master data" : pathname.startsWith("/review") ? "Review" : pathname.startsWith("/bills") ? "Pay-later bills" : pathname.startsWith("/business") ? "Business" : pathname.startsWith("/household") ? "Household" : pathname.startsWith("/analytics") ? "Analytics" : "Reports";
  return <div className="mobile-stack">{pathname !== "/" && <button aria-label="Go back" onClick={() => window.history.length > 1 ? router.back() : router.push("/")} type="button">‹ Back</button>}<strong>{title}</strong></div>;
}

function MobileNavigation() {
  const pathname=usePathname(),dialog=useRef<HTMLDialogElement>(null);
  const inMore=!mobileLinks.some(([,href])=>isCurrent(pathname,href));
  return <><nav className="mobile-nav" aria-label="Mobile navigation" style={{gridTemplateColumns:"repeat(4,minmax(0,1fr))"}}>
    {mobileLinks.map(([label,href])=><Link key={href} href={href} className={isCurrent(pathname,href)?"active":undefined} aria-current={isCurrent(pathname,href)?"page":undefined}>{label}</Link>)}
    <button type="button" className={inMore?"active":undefined} aria-haspopup="dialog" onClick={()=>dialog.current?.showModal()}>More</button>
  </nav><dialog ref={dialog} className="mobile-more-dialog" aria-labelledby="more-title"><div className="section-heading"><h2 id="more-title">More</h2><button type="button" className="button" onClick={()=>dialog.current?.close()}>Close</button></div><nav aria-label="More pages">{moreLinks.map(([label,href])=><Link key={href} href={href} aria-current={pathname===href?"page":undefined} onClick={()=>dialog.current?.close()}>{label}<span aria-hidden="true">›</span></Link>)}</nav></dialog></>;
}

export function Nav() {
  return <><header className="site-header"><Link className="brand" href="/">FIN <span>Control</span></Link><AppLinks className="desktop-nav" links={desktopLinks} /><MobileStackHeader /><form action="/api/auth/logout" method="post"><button className="link-button" type="submit">Log out</button></form></header><MobileNavigation /></>;
}


