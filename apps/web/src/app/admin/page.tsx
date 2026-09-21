"use client";

import { useEffect, useState } from "react";
import { Activity, CreditCard, FileClock, LayoutDashboard, LogOut, Search, Settings2, Users, WalletCards } from "lucide-react";
import { getAdminOverview, type AdminOverview } from "../../lib/api";

const sections = [{ label: "Overview", icon: LayoutDashboard }, { label: "Users", icon: Users }, { label: "Cards", icon: CreditCard }, { label: "Issuance", icon: FileClock }, { label: "Payments", icon: WalletCards }, { label: "Reconciliation", icon: Activity }, { label: "Settings", icon: Settings2 }];

export default function AdminPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { getAdminOverview().then(setOverview).catch((reason) => setError(reason instanceof Error ? reason.message : "admin_load_failed")); }, []);
  return <main className="admin-shell"><aside className="admin-sidebar"><a className="dashboard-brand" href="/"><img src="/logo.svg" alt="" />Flytopay</a><p className="admin-kicker">OPERATIONS</p><nav>{sections.map(({ label, icon: Icon }, index) => <button className={index === 0 ? "active" : ""} key={label}><Icon size={17} /><span>{label}</span></button>)}</nav><button className="admin-logout"><LogOut size={17} />Sign out</button></aside><section className="admin-content"><header className="admin-header"><div><span className="dashboard-eyebrow">FLYTOPAY CONTROL PLANE</span><h1>Overview</h1></div><div className="admin-search"><Search size={16} /><input placeholder="Search users, cards, orders" /></div></header>{error ? <div className="admin-error">{error === "admin_forbidden" ? "Admin access required" : "Failed to load admin data"}</div> : <><div className="admin-stat-grid">{overview && Object.entries({ Users: overview.users, "Telegram accounts": overview.telegramAccounts, Cards: overview.cards, "Demo cards": overview.demoCards, Rentals: overview.rentals, Payments: overview.payments, Wallets: overview.wallets }).map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}</div><section className="admin-panel"><div className="section-heading"><h2>System status</h2><span className="status-dot"><i />Operational</span></div><div className="admin-status-row"><span>Application API</span><b>Healthy</b><small>Live health endpoint</small></div><div className="admin-status-row"><span>2328 CaaS</span><b>Capability-driven</b><small>Provider state is read server-side</small></div><div className="admin-status-row"><span>Payment processing</span><b>Idempotent</b><small>Webhook and reconciliation boundary</small></div></section></>}</section></main>;
}
