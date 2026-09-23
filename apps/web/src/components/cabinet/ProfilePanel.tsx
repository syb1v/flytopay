"use client";

import { useState } from "react";
import { ArrowUpRight, Check, CircleHelp, Copy, CreditCard, Wallet } from "lucide-react";
import { PreferencesPanel } from "../settings/PreferencesPanel";

export function ProfilePanel({
  language,
  user,
  balance,
  cardCount,
  onCards,
  onHelp,
}: {
  language: "ru" | "en";
  user: { name: string; id: string; initial: string; username?: string };
  balance: string;
  cardCount: number;
  onCards: () => void;
  onHelp: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const ru = language === "ru";

  async function copyId() {
    if (user.id === "—") return;
    try {
      await navigator.clipboard.writeText(user.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be blocked in embedded browsers.
    }
  }

  return (
    <section className="account-page">
      <div className="account-identity">
        <div className="account-person">
          <div className="account-avatar" aria-hidden="true">
            {user.initial}
          </div>
          <div className="account-person-details">
            <span className="account-kicker">FLYTOPAY / ACCOUNT</span>
            <h2>{user.name}</h2>
            <div className="account-chips">
              {user.username && <span className="account-chip">@{user.username}</span>}
              <button
                className="account-chip account-copy"
                onClick={() => void copyId()}
                disabled={user.id === "—"}
                aria-label={ru ? "Скопировать Telegram ID" : "Copy Telegram ID"}
              >
                ID {user.id} {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        </div>
        <div className="account-stats">
          <div className="account-stat">
            <Wallet size={18} />
            <span>{ru ? "Баланс аккаунта" : "Account balance"}</span>
            <strong>{balance}</strong>
          </div>
          <button className="account-stat" onClick={onCards}>
            <CreditCard size={18} />
            <span>{ru ? "Мои карты" : "My cards"}</span>
            <strong>{cardCount}</strong>
          </button>
        </div>
      </div>

      <div className="account-group-label">{ru ? "НАСТРОЙКИ" : "PREFERENCES"}</div>
      <PreferencesPanel />

      <div className="account-group-label">{ru ? "ПОДДЕРЖКА" : "SUPPORT"}</div>
      <button className="account-help-link" onClick={onHelp}>
        <span className="account-help-icon">
          <CircleHelp size={21} />
        </span>
        <span>
          <strong>{ru ? "Помощь и ответы" : "Help & answers"}</strong>
          <small>{ru ? "Частые вопросы и связь с поддержкой" : "FAQs and support contact"}</small>
        </span>
        <ArrowUpRight size={18} />
      </button>
    </section>
  );
}
