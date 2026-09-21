"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, CircleDollarSign, Clock3, CreditCard, History, Home, Plus, UserRound, WalletCards } from "lucide-react";
import { PreferencesPanel } from "../settings/PreferencesPanel";
import { CheckoutPanel } from "../payments/CheckoutPanel";
import { getCards, getRentals, getWallet, type Card, type Rental, type Wallet } from "../../lib/api";
import { usePreferences } from "../providers/PreferencesProvider";
import { CardDetailsDialog } from "../cards/CardDetailsDialog";
import { CardVisual } from "../cards/CardVisual";
import { IssueCardPanel } from "../cards/IssueCardPanel";

type View = "home" | "cards" | "rentals" | "history" | "profile";

function ShieldIcon() { return <span className="profile-menu-icon"><CreditCard size={19} /></span>; }
function SupportIcon() { return <span className="profile-menu-icon"><CircleDollarSign size={19} /></span>; }
function DocumentIcon() { return <span className="profile-menu-icon"><History size={19} /></span>; }

const copy = {
  ru: {
    eyebrow: "ПЛАТЁЖНЫЙ КАБИНЕТ", title: "Главная", available: "Доступный баланс", wallet: "Баланс аккаунта", cardsBalance: "На картах", activeCard: "1 активная карта", topup: "Пополнить", myCards: "Мои карты", allCards: "Все карты", active: "Активна", cards: "Карты", rentals: "Выпуск карт", history: "История", profile: "Профиль", issue: "Выпустить карту", emptyRental: "Нет активных выпусков", emptyRentalHint: "Выберите продукт и срок — покажем полную стоимость до подтверждения.", start: "Выбрать срок", newCard: "Новая карта", newCardHint: "Отдельная карта для подписок, покупок и путешествий", recent: "Последние операции", noTransactions: "Операций пока нет", settings: "Настройки", support: "Поддержка", demo: "Предпросмотр", purchase: "Покупка карты", cardHint: "Виртуальная карта для зарубежных сервисов", coming: "Раздел готовится к подключению данных 2328" },
  en: {
    eyebrow: "PAYMENT CABINET", title: "Home", available: "Available balance", wallet: "Account balance", cardsBalance: "On cards", activeCard: "1 active card", topup: "Top up", myCards: "My cards", allCards: "All cards", active: "Active", cards: "Cards", rentals: "Card issuance", history: "History", profile: "Profile", issue: "Issue a card", emptyRental: "No active issuances yet", emptyRentalHint: "Choose a product and term — we show the full price before confirmation.", start: "Choose a term", newCard: "New card", newCardHint: "A separate card for subscriptions, purchases and travel", recent: "Recent activity", noTransactions: "No transactions yet", settings: "Settings", support: "Support", demo: "Preview", purchase: "Buy a card", cardHint: "Virtual card for foreign services", coming: "This section is waiting for 2328 data connection" },
} as const;

export function Dashboard() {
  const { preferences, authReady, setLanguage } = usePreferences();
  const language = preferences.language;
  const [view, setView] = useState<View>("home");
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [dataError, setDataError] = useState(false);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const t = copy[language];

  useEffect(() => {
    if (!authReady) return;
    window.Telegram?.WebApp?.ready();
    window.Telegram?.WebApp?.expand();
    const tg = window.Telegram?.WebApp as ({ requestFullscreen?: () => void; disableVerticalSwipes?: () => void } | undefined);
    try { tg?.disableVerticalSwipes?.(); tg?.requestFullscreen?.(); } catch {}
    Promise.all([getWallet(), getCards(), getRentals()]).then(([nextWallet, nextCards, nextRentals]) => {
      setWallet(nextWallet);
      setCards(nextCards);
      setRentals(nextRentals);
    }).catch(() => setDataError(true));
  }, [authReady]);

  function navigate(next: View) {
    setView(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const firstCard = cards[0];
  const firstRental = rentals.find((item) => ["active", "provisioning", "frozen_grace"].includes(item.status));
  const money = (minor: number | null | undefined, currency = "USD", scale = 2) => minor == null ? "—" : new Intl.NumberFormat(language === "ru" ? "ru-RU" : "en-US", { style: "currency", currency, minimumFractionDigits: scale }).format(minor / 10 ** scale);

    return <div className="dashboard-shell">
    <aside className="dashboard-sidebar"><a className="dashboard-brand" href="/"><img src="/logo.svg" alt="" />Flytopay</a><nav><button className={view === "home" ? "active" : ""} onClick={() => navigate("home")}><Home size={18} /> <span>{t.title}</span></button><button className={view === "cards" ? "active" : ""} onClick={() => navigate("cards")}><CreditCard size={18} /> <span>{t.cards}</span></button><button className={view === "rentals" ? "active" : ""} onClick={() => navigate("rentals")}><Clock3 size={18} /> <span>{t.rentals}</span></button><button className={view === "history" ? "active" : ""} onClick={() => navigate("history")}><History size={18} /> <span>{t.history}</span></button></nav><div className="dashboard-side-bottom"><div className="side-note"><b>↗</b><strong>Ближе к миру.<br />Без лишних границ.</strong><span>Карты для зарубежных сервисов.</span></div><button className="profile-link" onClick={() => navigate("profile")}><span className="avatar-mark">А</span><span>Flytopay<small>{t.profile}</small></span></button></div></aside>
     <main className="dashboard-main"><header className="dashboard-header"><div><span className="dashboard-eyebrow">{t.eyebrow}</span><h1>{view === "home" ? t.title : view === "cards" ? t.cards : view === "rentals" ? t.rentals : view === "history" ? t.history : t.profile}</h1></div><div className="dashboard-header-actions"><button className="language-toggle" onClick={() => setLanguage(language === "ru" ? "en" : "ru")}>{language.toUpperCase()}</button><span className="demo-badge">{t.demo}</span><button className="support-button" onClick={() => alert(t.coming)} aria-label={t.support}>?</button><span className="avatar-mark">А</span></div></header>
      {view === "home" && <><section className="balance-grid"><article className="balance-card balance-primary"><div className="balance-label"><CircleDollarSign size={18} /> {t.available}<button className="eye-button">◉</button></div><strong>{money(wallet?.available_minor, wallet?.currency, wallet?.scale)}</strong><div className="balance-footer"><small>{t.wallet}</small><button onClick={() => alert(t.coming)}>＋ {t.topup}</button></div></article><article className="balance-card balance-secondary"><div className="balance-label"><CreditCard size={18} /> {t.cardsBalance}</div><strong>{money(firstCard?.balance_minor, firstCard?.currency, firstCard?.scale)}</strong><div className="balance-footer"><small>{firstCard ? t.activeCard : t.coming}</small><button onClick={() => navigate("cards")}>{t.cards} ↗</button></div></article></section>{dataError && <div className="data-warning">{t.coming}</div>}<section className="dashboard-section"><div className="section-heading"><h2>{t.myCards}</h2><button onClick={() => navigate("cards")}>{t.allCards} ↗</button></div><div className="cards-row">{firstCard ? <button className="home-card-button" onClick={() => setSelectedCard(firstCard)}><CardVisual maskedPan={firstCard.masked_pan ?? (firstCard.last_four ? `•••• •••• •••• ${firstCard.last_four}` : null)} status={firstCard.status} balance={money(firstCard.balance_minor, firstCard.currency, firstCard.scale)} scheme="VISA" /><span className="card-details-hint"><CreditCard size={15} /> {language === "ru" ? "Открыть реквизиты" : "View card details"}</span></button> : <div className="empty-panel"><span>▣</span><div><b>{t.coming}</b><p>{t.cardHint}</p></div></div>}<button className="new-card-tile" onClick={() => navigate("rentals")}><span>＋</span><b>{t.newCard}</b><small>{t.newCardHint}</small><em>{t.start} ↗</em></button></div></section><section className="dashboard-section"><div className="section-heading"><h2>{t.recent}</h2><button onClick={() => navigate("history")}>{t.allCards} ↗</button></div><div className="empty-panel compact"><span>◎</span><div><b>{t.noTransactions}</b><p>{t.coming}</p></div></div></section></>}
      {view === "cards" && <section className="page-panel"><div className="panel-icon"><WalletCards size={40} /></div><h2>{t.myCards}</h2>{cards.length ? cards.map((card) => <button className="card-list-item" key={card.id} onClick={() => setSelectedCard(card)}><CardVisual maskedPan={card.masked_pan} status={card.status} balance={money(card.balance_minor, card.currency, card.scale)} /><ArrowUpRight size={18} /></button>) : <p>{t.coming}</p>}<button className="lime-action" onClick={() => navigate("rentals")}><Plus size={17} />{t.issue}</button></section>}
      {view === "rentals" && <IssueCardPanel />}
      {view === "history" && <section className="page-panel"><div className="panel-icon">◴</div><h2>{t.history}</h2><p>{t.noTransactions}</p></section>}
      {view === "profile" && <section className="profile-stack"><div className="profile-hero"><div className="profile-avatar">А</div><div><span className="dashboard-eyebrow">FLYTOPAY ACCOUNT</span><h2>{language === "ru" ? "Ваш профиль" : "Your profile"}</h2><p>{language === "ru" ? "Настройки кабинета, уведомления и безопасность" : "Cabinet settings, notifications and security"}</p></div></div><PreferencesPanel /><div className="profile-menu"><button><ShieldIcon /><span><b>{language === "ru" ? "Безопасность" : "Security"}</b><small>{language === "ru" ? "Telegram-сессия и доступ к картам" : "Telegram session and card access"}</small></span><ArrowUpRight size={17} /></button><button><SupportIcon /><span><b>{language === "ru" ? "Поддержка" : "Support"}</b><small>{language === "ru" ? "Помощь по платежам и выпуску карт" : "Help with payments and card issuance"}</small></span><ArrowUpRight size={17} /></button><button><DocumentIcon /><span><b>{language === "ru" ? "Документы" : "Documents"}</b><small>{language === "ru" ? "Условия использования и приватность" : "Terms and privacy"}</small></span><ArrowUpRight size={17} /></button></div><CheckoutPanel language={language} /></section>}
      <footer>Flytopay · {t.cardHint}</footer>
     </main><nav className="mobile-dashboard-nav"><button className={view === "home" ? "active" : ""} onClick={() => navigate("home")}><Home size={18}/><span>{t.title}</span></button><button className={view === "cards" ? "active" : ""} onClick={() => navigate("cards")}><CreditCard size={18}/><span>{t.cards}</span></button><button className={view === "rentals" ? "active" : ""} onClick={() => navigate("rentals")}><Clock3 size={18}/><span>{t.rentals}</span></button><button className={view === "profile" ? "active" : ""} onClick={() => navigate("profile")}><UserRound size={18}/><span>{t.profile}</span></button></nav><CardDetailsDialog card={selectedCard} open={Boolean(selectedCard)} onClose={() => setSelectedCard(null)} />
  </div>;
}
