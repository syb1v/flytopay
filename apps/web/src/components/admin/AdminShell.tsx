"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  BarChart3,
  CreditCard,
  FileText,
  LayoutDashboard,
  Megaphone,
  Package,
  SendHorizontal,
  ServerCog,
  ShieldCheck,
  Users,
  WalletCards,
} from "lucide-react";
import { getAdminSession } from "../../lib/api";

const nav = [
  { href: "/admin", label: "Обзор", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", label: "Пользователи", icon: Users },
  { href: "/admin/cards", label: "Карты", icon: CreditCard },
  { href: "/admin/catalog", label: "Цены и продукты", icon: Package },
  { href: "/admin/finance", label: "Платежи и возвраты", icon: WalletCards },
  { href: "/admin/marketing", label: "Маркетинг", icon: Megaphone },
  { href: "/admin/referrals", label: "Рефералы", icon: BarChart3 },
  { href: "/admin/content", label: "Контент", icon: FileText },
  { href: "/admin/broadcasts", label: "Рассылки", icon: SendHorizontal },
  { href: "/admin/system", label: "Система", icon: ServerCog },
  { href: "/admin/security", label: "Безопасность", icon: ShieldCheck },
];

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [state, setState] = useState<"loading" | "ok" | "forbidden" | "anonymous">("loading");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    getAdminSession()
      .then((session) => setState(session === "admin" ? "ok" : session))
      .catch(() => setState("anonymous"));
  }, []);

  const isActive = (item: (typeof nav)[number]) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  if (state === "loading") {
    return (
      <main className="adm-gate">
        <p>Проверка доступа…</p>
      </main>
    );
  }
  if (state === "forbidden") {
    return (
      <main className="adm-gate">
        <ShieldCheck size={42} />
        <h1>Доступ запрещён</h1>
        <p>Для просмотра панели необходимы права администратора.</p>
        <Link className="adm-btn adm-btn-secondary" href="/cabinet">
          Вернуться в кабинет
        </Link>
      </main>
    );
  }
  if (state === "anonymous") {
    return (
      <main className="adm-gate">
        <ShieldCheck size={42} />
        <h1>Требуется вход</h1>
        <p>Откройте кабинет Flytopay через Telegram, чтобы войти, затем вернитесь в админ-панель.</p>
        <Link className="adm-btn adm-btn-primary" href="/cabinet">
          Открыть кабинет
        </Link>
      </main>
    );
  }

  return (
    <div className="adm-shell">
      <aside className="adm-sidebar">
        <Link className="adm-brand" href="/admin">
          <img src="/logo.svg" alt="" width={34} height={34} />
          <span>Flytopay</span>
        </Link>
        <p className="adm-kicker">Управление</p>
        <nav className="adm-nav">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} className={`adm-nav-link ${isActive(item) ? "active" : ""}`} href={item.href}>
                <Icon size={17} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <Link className="adm-nav-link adm-nav-exit" href="/cabinet">
          ← В кабинет
        </Link>
      </aside>
      <div className="adm-body">
        <header className="adm-mobile-bar">
          <Link className="adm-mobile-brand" href="/admin">
            <img src="/logo.svg" alt="" width={28} height={28} />
            <span>{nav.find((item) => isActive(item))?.label ?? "Админка"}</span>
          </Link>
          <button
            className="adm-mobile-toggle"
            onClick={() => setMenuOpen((value) => !value)}
            aria-expanded={menuOpen}
            aria-label="Меню разделов"
          >
            {menuOpen ? "Закрыть" : "Разделы"}
          </button>
        </header>
        {menuOpen && (
          <nav className="adm-mobile-menu" aria-label="Навигация админки">
            {nav.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  className={`adm-nav-link ${isActive(item) ? "active" : ""}`}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                >
                  <Icon size={17} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <Link className="adm-nav-link" href="/cabinet">
              ← В кабинет
            </Link>
          </nav>
        )}
        <main className="adm-content">{children}</main>
      </div>
    </div>
  );
}
