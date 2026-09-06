"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const desktopLinks = [["Dashboard", "/"], ["Quick entry", "/transactions/new"], ["Review", "/review"], ["Accounts", "/accounts"], ["Master data", "/master-data"], ["Analytics", "/analytics"], ["Reports", "/reports"]] as const;
const mobileLinks = [["Home", "/"], ["Add", "/transactions/new"], ["Analytics", "/analytics"], ["Review", "/review"], ["Accounts", "/accounts"], ["More", "/master-data"]] as const;

function isCurrent(pathname: string, href: string) { return href === "/" ? pathname === href : pathname.startsWith(href); }

function AppLinks({ links, className }: { links: readonly (readonly [string, string])[]; className: string }) {
  const pathname = usePathname();
  return <nav aria-label="Main navigation" className={className}>{links.map(([label, href]) => <Link aria-current={isCurrent(pathname, href) ? "page" : undefined} className={isCurrent(pathname, href) ? "active" : undefined} key={href} href={href}>{label}</Link>)}</nav>;
}

function MobileStackHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const title = pathname === "/" ? "FIN Control" : pathname.startsWith("/transactions") ? "Quick entry" : pathname.startsWith("/master-data") ? "Master data" : pathname.startsWith("/accounts") ? "Accounts" : pathname.startsWith("/review") ? "Review" : pathname.startsWith("/analytics") ? "Analytics" : "Reports";
  return <div className="mobile-stack">{pathname !== "/" && <button aria-label="Go back" onClick={() => window.history.length > 1 ? router.back() : router.push("/")} type="button">‹ Back</button>}<strong>{title}</strong></div>;
}

export function Nav() {
  return <><header className="site-header"><Link className="brand" href="/">FIN <span>Control</span></Link><AppLinks className="desktop-nav" links={desktopLinks} /><MobileStackHeader /><form action="/api/auth/logout" method="post"><button className="link-button" type="submit">Log out</button></form></header><AppLinks className="mobile-nav" links={mobileLinks} /></>;
}


