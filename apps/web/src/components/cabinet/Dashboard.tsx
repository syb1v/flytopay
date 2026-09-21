"use client";

import { useEffect, useState } from "react";
import { PreferencesPanel } from "../settings/PreferencesPanel";
import { CheckoutPanel } from "../payments/CheckoutPanel";
import { getCards, getRentals, getWallet, type Card, type Rental, type Wallet } from "../../lib/api";

type View = "home" | "cards" | "rentals" | "history" | "profile";

const copy = {
  ru: {
    eyebrow: "ПЛАТЁЖНЫЙ КАБИНЕТ", title: "Главная", available: "Доступный баланс", wallet: "Баланс аккаунта", cardsBalance: "На картах", activeCard: "1 активная карта", topup: "Пополнить", myCards: "Мои карты", allCards: "Все карты", active: "Активна", cards: "Карты", rentals: "Аренда", history: "История", profile: "Профиль", issue: "Выпустить карту", emptyRental: "Пока нет активных аренд", emptyRentalHint: "Выберите карту и срок — мы покажем полную стоимость до подтверждения.", start: "Выбрать срок", newCard: "Новая карта", newCardHint: "Отдельная карта для подписок, покупок и путешествий", recent: "Последние операции", noTransactions: "Операций пока нет", settings: "Настройки", support: "Поддержка", demo: "Предпросмотр", purchase: "Покупка карты", cardHint: "Виртуальная карта для зарубежных сервисов", coming: "Раздел готовится к подключению данных 2328" },
  en: {
    eyebrow: "PAYMENT CABINET", title: "Home", available: "Available balance", wallet: "Account balance", cardsBalance: "On cards", activeCard: "1 active card", topup: "Top up", myCards: "My cards", allCards: "All cards", active: "Active", cards: "Cards", rentals: "Rentals", history: "History", profile: "Profile", issue: "Issue a card", emptyRental: "No active rentals yet", emptyRentalHint: "Choose a card and term — we show the full price before confirmation.", start: "Choose a term", newCard: "New card", newCardHint: "A separate card for subscriptions, purchases and travel", recent: "Recent activity", noTransactions: "No transactions yet", settings: "Settings", support: "Support", demo: "Preview", purchase: "Buy a card", cardHint: "Virtual card for foreign services", coming: "This section is waiting for 2328 data connection" },
} as const;

export function Dashboard() {
  const [language, setLanguage] = useState<"ru" | "en">("ru");
  const [view, setView] = useState<View>("home");
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [dataError, setDataError] = useState(false);
  const t = copy[language];

  useEffect(() => {
    Promise.all([getWallet(), getCards(), getRentals()]).then(([nextWallet, nextCards, nextRentals]) => {
      setWallet(nextWallet);
      setCards(nextCards);
      setRentals(nextRentals);
    }).catch(() => setDataError(true));
  }, []);

  function navigate(next: View) {
    setView(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const firstCard = cards[0];
  const firstRental = rentals.find((item) => ["active", "provisioning", "frozen_grace"].includes(item.status));
  const money = (minor: number | null | undefined, currency = "USD", scale = 2) => minor == null ? "—" : new Intl.NumberFormat(language === "ru" ? "ru-RU" : "en-US", { style: "currency", currency, minimumFractionDigits: scale }).format(minor / 10 ** scale);

    return <div className="dashboard-shell">
    <aside className="dashboard-sidebar"><a className="dashboard-brand" href="/"><img src="/mark.png" alt="" />Flytopay</a><nav><button className={view === "home" ? "active" : ""} onClick={() => navigate("home")}>⌂ <span>{t.title}</span></button><button className={view === "cards" ? "active" : ""} onClick={() => navigate("cards")}>▣ <span>{t.cards}</span></button><button className={view === "rentals" ? "active" : ""} onClick={() => navigate("rentals")}>◷ <span>{t.rentals}</span></button><button className={view === "history" ? "active" : ""} onClick={() => navigate("history")}>◴ <span>{t.history}</span></button></nav><div className="dashboard-side-bottom"><div className="side-note"><b>↗</b><strong>Ближе к миру.<br />Без лишних границ.</strong><span>Карты для зарубежных сервисов.</span></div><button className="profile-link" onClick={() => navigate("profile")}><span className="avatar-mark">А</span><span>Flytopay<small>{t.profile}</small></span></button></div></aside>
    <main className="dashboard-main"><header className="dashboard-header"><div><span className="dashboard-eyebrow">{t.eyebrow}</span><h1>{view === "home" ? t.title : view === "cards" ? t.cards : view === "rentals" ? t.rentals : view === "history" ? t.history : t.profile}</h1></div><div className="dashboard-header-actions"><button className="language-toggle" onClick={() => setLanguage(language === "ru" ? "en" : "ru")}>{language.toUpperCase()}</button><span className="demo-badge">{t.demo}</span><button className="support-button" onClick={() => alert(t.coming)} aria-label={t.support}>?</button><span className="avatar-mark">А</span></div></header>
      {view === "home" && <><section className="balance-grid"><article className="balance-card balance-primary"><div className="balance-label">◈ {t.available}<button className="eye-button">◉</button></div><strong>{money(wallet?.available_minor, wallet?.currency, wallet?.scale)}</strong><div className="balance-footer"><small>{t.wallet}</small><button onClick={() => alert(t.coming)}>＋ {t.topup}</button></div></article><article className="balance-card balance-secondary"><div className="balance-label">▣ {t.cardsBalance}</div><strong>{money(firstCard?.balance_minor, firstCard?.currency, firstCard?.scale)}</strong><div className="balance-footer"><small>{firstCard ? t.activeCard : t.coming}</small><button onClick={() => navigate("cards")}>{t.cards} ↗</button></div></article></section>{dataError && <div className="data-warning">{t.coming}</div>}<div className="quick-actions"><button onClick={() => alert(t.coming)}>＋<span>{t.topup}</span></button><button onClick={() => navigate("cards")}>▣<span>{t.issue}</span></button><button onClick={() => navigate("rentals")}>◷<span>{t.rentals}</span></button></div><section className="dashboard-section"><div className="section-heading"><h2>{t.myCards}</h2><button onClick={() => navigate("cards")}>{t.allCards} ↗</button></div><div className="cards-row">{firstCard ? <article className="virtual-card"><div className="card-top"><b>Flytopay</b><span>{firstCard.status}</span></div><div className="card-symbol">↗</div><div className="card-chip" /><div className="card-number">{firstCard.masked_pan ?? `••••　••••　••••　${firstCard.last_four ?? "—"}`}</div><div className="card-bottom"><strong>{money(firstCard.balance_minor, firstCard.currency, firstCard.scale)}</strong><b>VISA</b></div></article> : <div className="empty-panel"><span>▣</span><div><b>{t.coming}</b><p>{t.cardHint}</p></div></div>}<button className="new-card-tile" onClick={() => navigate("rentals")}><span>＋</span><b>{t.newCard}</b><small>{t.newCardHint}</small><em>{t.start} ↗</em></button></div></section><section className="dashboard-section"><div className="section-heading"><h2>{t.rentals}</h2><button onClick={() => navigate("rentals")}>{t.allCards} ↗</button></div>{firstRental ? <div className="empty-panel"><span>◷</span><div><b>{firstRental.status}</b><p>{firstRental.expires_at}</p></div></div> : <div className="empty-panel"><span>◷</span><div><b>{t.emptyRental}</b><p>{t.emptyRentalHint}</p></div><button onClick={() => navigate("rentals")}>{t.start}</button></div>}</section><section className="dashboard-section"><div className="section-heading"><h2>{t.recent}</h2><button onClick={() => navigate("history")}>{t.allCards} ↗</button></div><div className="empty-panel compact"><span>◎</span><div><b>{t.noTransactions}</b><p>{t.coming}</p></div></div></section></>}
      {view === "cards" && <section className="page-panel"><div className="panel-icon">▣</div><h2>{t.myCards}</h2>{cards.length ? cards.map((card) => <p key={card.id}>{card.masked_pan ?? card.last_four ?? card.status} · {money(card.balance_minor, card.currency, card.scale)}</p>) : <p>{t.coming}</p>}<button className="lime-action" onClick={() => navigate("rentals")}>{t.issue}</button></section>}
      {view === "rentals" && <section className="page-panel"><div className="panel-icon">◷</div><h2>{t.rentals}</h2><p>{t.emptyRentalHint}</p><div className="term-grid">{[30, 90, 180, 365].map((term) => <button key={term} onClick={() => alert(t.coming)}><strong>{term}</strong><span>{language === "ru" ? "дней" : "days"}</span><em>от $5.00</em></button>)}</div></section>}
      {view === "history" && <section className="page-panel"><div className="panel-icon">◴</div><h2>{t.history}</h2><p>{t.noTransactions}</p></section>}
      {view === "profile" && <section className="profile-stack"><PreferencesPanel /><CheckoutPanel language={language} /></section>}
      <footer>Flytopay · {t.cardHint}</footer>
    </main><nav className="mobile-dashboard-nav"><button className={view === "home" ? "active" : ""} onClick={() => navigate("home")}>⌂<span>{t.title}</span></button><button className={view === "cards" ? "active" : ""} onClick={() => navigate("cards")}>▣<span>{t.cards}</span></button><button className={view === "rentals" ? "active" : ""} onClick={() => navigate("rentals")}>◷<span>{t.rentals}</span></button><button className={view === "profile" ? "active" : ""} onClick={() => navigate("profile")}>◯<span>{t.profile}</span></button></nav>
  </div>;
}
