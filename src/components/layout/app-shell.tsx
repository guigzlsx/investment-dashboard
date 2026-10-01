"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { Asset } from "../../lib/market-data/models";
import { Icon } from "./icon";
import { UserMenu } from "./user-menu";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" as const },
  { href: "/portfolio", label: "Portfolio", icon: "portfolio" as const },
  { href: "/health", label: "Health", icon: "health" as const },
  { href: "/watchlist", label: "Watchlist", icon: "watchlist" as const },
  { href: "/discover", label: "Discover", icon: "discover" as const },
  { href: "/assistant", label: "Assistant", icon: "assistant" as const },
  { href: "/analysis", label: "Analysis", icon: "analysis" as const },
];

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
}

export function AppShell({
  children,
  title,
  eyebrow = "Personal investment workspace",
  description,
  action,
}: {
  children: ReactNode;
  title: string;
  eyebrow?: string;
  description?: string;
  action?: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Asset[]>([]);
  const [searchMessage, setSearchMessage] = useState("");

  useEffect(() => {
    if (query.trim().length < 2) {
      return;
    }
    const timer = window.setTimeout(() => {
      setResults([]);
      setSearchMessage("Searching…");
      void fetch(`/api/market/search?q=${encodeURIComponent(query.trim())}`).then(async (response) => {
        const body = await response.json() as { data?: Asset[]; error?: { message?: string } };
        if (!response.ok) throw new Error(body.error?.message ?? "Search unavailable");
        setResults(body.data ?? []);
        setSearchMessage("");
      }).catch((error: unknown) => {
        setResults([]);
        setSearchMessage(error instanceof Error ? error.message : "Search unavailable");
      });
    }, 280);
    return () => window.clearTimeout(timer);
  }, [query]);

  function openAsset(symbol: string) {
    setQuery("");
    setResults([]);
    router.push(`/assets/${encodeURIComponent(symbol)}`);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/dashboard">
          <span className="brand-mark" />
          <span><span className="brand-name">Investment Dashboard</span><span className="brand-caption">Private workspace</span></span>
        </Link>
        <div className="nav-label">Workspace</div>
        <nav className="nav-list" aria-label="Primary navigation">
          {navigation.map((item) => <Link className={`nav-link ${isActive(pathname, item.href) ? "active" : ""}`} href={item.href} key={item.href}><span className="nav-icon"><Icon name={item.icon} /></span>{item.label}</Link>)}
        </nav>
        <div className="nav-label" style={{ marginTop: 26 }}>Personal</div>
        <nav className="nav-list" aria-label="Personal navigation">
          <Link className={`nav-link ${isActive(pathname, "/settings") ? "active" : ""}`} href="/settings"><span className="nav-icon"><Icon name="settings" /></span>Settings</Link>
        </nav>
        <div className="sidebar-footer"><UserMenu /><div className="data-status"><span className="status-dot" /><span><span className="status-title">Data source not connected</span><span className="status-subtitle">Your numbers stay private</span></span></div></div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark" /><span className="brand-name">Investment Dashboard</span></div>
          <div className="search-wrap"><label className="topbar-search"><Icon name="search" size={15} /><input aria-label="Search stocks and ETFs" onChange={(event) => setQuery(event.target.value)} value={query} placeholder="Search stocks, ETFs, or ask a question" /><span className="shortcut">⌘ K</span></label>{query.trim().length >= 2 ? <div className="search-results" role="listbox">{searchMessage ? <div className="search-message">{searchMessage}</div> : results.length ? results.map((asset) => <button className="search-result" key={`${asset.symbol}-${asset.exchange ?? ""}`} onClick={() => openAsset(asset.symbol)} type="button"><span className="search-result-logo">{asset.symbol.slice(0, 1)}</span><span><strong>{asset.symbol}</strong><small>{asset.name} · {asset.exchange ?? "Exchange unknown"}</small></span><span className="search-result-meta">{asset.currency ?? "—"}<br />{asset.assetType ?? "—"}</span></button>) : <div className="search-message">No matching asset found.</div>}</div> : null}</div>
          <label className="topbar-search"><Icon name="search" size={15} /><input aria-label="Search stocks and ETFs" placeholder="Search stocks, ETFs, or ask a question" /><span className="shortcut">⌘ K</span></label>
          <div className="topbar-meta"><div className="market-state"><span className="status-dot" /> Market status unavailable</div><UserMenu compact /></div>
        </header>
        <main className="content">
          <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1 className="page-title">{title}</h1>{description ? <p className="page-description">{description}</p> : null}</div>{action}</div>
          {children}
        </main>
        <nav className="mobile-nav" aria-label="Mobile navigation">
          {navigation.map((item) => <Link className={isActive(pathname, item.href) ? "active" : ""} href={item.href} key={item.href}><Icon name={item.icon} size={17} />{item.label}</Link>)}
        </nav>
      </div>
    </div>
  );
}
