"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  CircleDollarSign,
  CreditCard,
  History,
  Home,
  Send,
  Snowflake,
  WalletCards,
  XCircle,
  UserRound,
  Wrench,
} from "lucide-react";
import { PreferencesPanel } from "../settings/PreferencesPanel";
import { getCards, getRentals, getWallet, type Card, type Rental, type Wallet } from "../../lib/api";
import { usePreferences } from "../providers/PreferencesProvider";
import { CardDetailsDialog } from "../cards/CardDetailsDialog";
import { CardVisual } from "../cards/CardVisual";
import { IssueCardPanel } from "../cards/IssueCardPanel";

type View = "home" | "issue" | "services" | "history" | "profile";

function ShieldIcon() {
  return (
    <span className="profile-menu-icon">
      <CreditCard size={19} />
    </span>
  );
}
function SupportIcon() {
  return (
    <span className="profile-menu-icon">
      <CircleDollarSign size={19} />
    </span>
  );
}
function DocumentIcon() {
  return (
    <span className="profile-menu-icon">
      <History size={19} />
    </span>
  );
}

const copy = {
  ru: {
    eyebrow: "ПЛАТЁЖНЫЙ КАБИНЕТ",
    title: "Главная",
    available: "Доступный баланс",
    wallet: "Баланс аккаунта",
    cardsBalance: "На картах",
    activeCard: "1 активная карта",
    topup: "Пополнить",
    myCards: "Мои карты",
    allCards: "Все карты",
    history: "История",
    profile: "Профиль",
    issue: "Выпустить карту",
    newCard: "Новая карта",
    newCardHint: "Отдельная карта для подписок, покупок и путешествий",
    start: "Выбрать срок",
    recent: "Последние операции",
    noTransactions: "Операций пока нет",
    support: "Поддержка",
    demo: "Предпросмотр",
    cardHint: "Виртуальная карта для зарубежных сервисов",
    coming: "Раздел готовится к подключению данных 2328",
  },
  en: {
    eyebrow: "PAYMENT CABINET",
    title: "Home",
    available: "Available balance",
    wallet: "Account balance",
    cardsBalance: "On cards",
    activeCard: "1 active card",
    topup: "Top up",
    myCards: "My cards",
    allCards: "All cards",
    history: "History",
    profile: "Profile",
    issue: "Issue a card",
    newCard: "New card",
    newCardHint: "A separate card for subscriptions, purchases and travel",
    start: "Choose a term",
    recent: "Recent activity",
    noTransactions: "No transactions yet",
    support: "Support",
    demo: "Preview",
    cardHint: "Virtual card for foreign services",
    coming: "This section is waiting for 2328 data connection",
  },
} as const;

export function Dashboard() {
  const { preferences, authReady, setLanguage } = usePreferences();
  const language = preferences.language;
  const t = copy[language];
  const [view, setView] = useState<View>("home");
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [dataError, setDataError] = useState(false);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const cardsScroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authReady) return;
    window.Telegram?.WebApp?.ready();
    window.Telegram?.WebApp?.expand();
    Promise.all([getWallet(), getCards(), getRentals()])
      .then(([nextWallet, nextCards, nextRentals]) => {
        setWallet(nextWallet);
        setCards(nextCards);
        setRentals(nextRentals);
      })
      .catch(() => setDataError(true));
  }, [authReady]);

  function navigate(next: View) {
    setView(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function money(minor: number | null | undefined, currency = "USD", scale = 2) {
    return minor == null
      ? "—"
      : new Intl.NumberFormat(language === "ru" ? "ru-RU" : "en-US", {
          style: "currency",
          currency,
          minimumFractionDigits: scale,
        }).format(minor / 10 ** scale);
  }
  function masked(card: Card) {
    return card.masked_pan ?? (card.last_four ? `•••• •••• •••• ${card.last_four}` : null);
  }
  function cardAction(action: "topup" | "transfer" | "freeze" | "close", card: Card) {
    if (action === "freeze") {
      setCards((current) =>
        current.map((item) =>
          item.id === card.id ? { ...item, status: item.status === "frozen" ? "active" : "frozen" } : item,
        ),
      );
      return;
    }
    if (action === "close") {
      setCards((current) => current.filter((item) => item.id !== card.id));
      setActiveIndex((current) => Math.max(0, Math.min(current, cards.length - 2)));
      return;
    }
    alert(
      language === "ru"
        ? `${action === "topup" ? "Пополнение" : "Перевод"} карты пока недоступно в демо-режиме`
        : `${action === "topup" ? "Top up" : "Transfer"} is not available in demo mode`,
    );
  }
  function syncActiveCard() {
    const element = cardsScroller.current;
    if (!element || !cards.length) return;
    const center = element.scrollLeft + element.clientWidth / 2;
    let closest = 0;
    let distance = Number.POSITIVE_INFINITY;
    Array.from(element.children).forEach((child, index) => {
      const item = child as HTMLElement;
      const itemCenter = item.offsetLeft + item.offsetWidth / 2;
      if (Math.abs(itemCenter - center) < distance) {
        distance = Math.abs(itemCenter - center);
        closest = index;
      }
    });
    setActiveIndex(Math.min(closest, cards.length - 1));
  }

  const activeCard = cards[Math.min(activeIndex, Math.max(cards.length - 1, 0))];
  const renderCard = (card: Card) => (
    <CardVisual
      maskedPan={masked(card)}
      status={card.status}
      balance={money(card.balance_minor, card.currency, card.scale)}
      scheme="VISA"
    />
  );

  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <a className="dashboard-brand" href="/">
          <img src="/logo.svg" alt="" />
          Flytopay
        </a>
        <nav>
          <button className={view === "home" ? "active" : ""} onClick={() => navigate("home")}>
            <Home size={18} />
            <span>{t.title}</span>
          </button>
          <button className={view === "services" ? "active" : ""} onClick={() => navigate("services")}>
            <Wrench size={18} />
            <span>Сервисы</span>
          </button>
          <button className={view === "history" ? "active" : ""} onClick={() => navigate("history")}>
            <History size={18} />
            <span>{t.history}</span>
          </button>
        </nav>
        <div className="dashboard-side-bottom">
          <div className="side-note">
            <b>↗</b>
            <strong>
              Ближе к миру.
              <br />
              Без лишних границ.
            </strong>
            <span>Карты для зарубежных сервисов.</span>
          </div>
          <button className="profile-link" onClick={() => navigate("profile")}>
            <span className="avatar-mark">А</span>
            <span>
              Flytopay<small>{t.profile}</small>
            </span>
          </button>
        </div>
      </aside>
      <main className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <span className="dashboard-eyebrow">{t.eyebrow}</span>
            <h1>
              {view === "home"
                ? t.title
                : view === "issue"
                  ? t.issue
                  : view === "services"
                    ? "Сервисы"
                    : view === "history"
                      ? t.history
                      : t.profile}
            </h1>
          </div>
          <div className="dashboard-header-actions">
            <button className="language-toggle" onClick={() => setLanguage(language === "ru" ? "en" : "ru")}>
              {language.toUpperCase()}
            </button>
            <span className="demo-badge">{t.demo}</span>
            <button className="support-button" onClick={() => alert(t.coming)} aria-label={t.support}>
              ?
            </button>
            <span className="avatar-mark">А</span>
          </div>
        </header>
        {view === "home" && (
          <>
            <section className="balance-grid">
              <article className="balance-card balance-primary">
                <div className="balance-label">
                  <CircleDollarSign size={18} /> {t.available}
                  <button className="eye-button">◉</button>
                </div>
                <strong>{money(wallet?.available_minor, wallet?.currency, wallet?.scale)}</strong>
                <div className="balance-footer">
                  <small>{t.wallet}</small>
                  <button onClick={() => alert(t.coming)}>＋ {t.topup}</button>
                </div>
              </article>
              <article className="balance-card balance-secondary">
                <div className="balance-label">
                  <CreditCard size={18} /> {t.cardsBalance}
                </div>
                <strong>{money(activeCard?.balance_minor, activeCard?.currency, activeCard?.scale)}</strong>
                <div className="balance-footer">
                  <small>{activeCard ? `${t.activeCard} · •••• ${activeCard.last_four ?? "—"}` : t.coming}</small>
                  <button onClick={() => navigate("issue")}>{t.issue} ↗</button>
                </div>
              </article>
            </section>
            {dataError && <div className="data-warning">{t.coming}</div>}
            <section className="dashboard-section">
              <div className="section-heading">
                <h2>{t.myCards}</h2>
                <button onClick={() => navigate("issue")}>{t.issue} ↗</button>
              </div>
              <div className="cards-scrollwrap">
                {cards.length ? (
                  <>
                    <div ref={cardsScroller} onScroll={syncActiveCard} className="cards-row cards-snap">
                      {cards.map((card, index) => (
                        <button
                          className="home-card-slide"
                          key={card.id}
                          onClick={() => setSelectedCard(card)}
                          data-active={index === activeIndex ? "true" : "false"}
                        >
                          {renderCard(card)}
                        </button>
                      ))}
                      <button className="new-card-tile new-card-size" onClick={() => navigate("issue")}>
                        <span>＋</span>
                        <b>{t.newCard}</b>
                        <small>{t.newCardHint}</small>
                        <em>{t.start} ↗</em>
                      </button>
                    </div>
                    <div className="card-scroll-hint">
                      {language === "ru" ? "Листайте карты" : "Swipe cards"}
                      <span>← →</span>
                    </div>
                    <div className="card-dots">
                      {cards.map((card, index) => (
                        <i key={card.id} className={index === activeIndex ? "on" : ""} />
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="empty-panel">
                    <span>▣</span>
                    <div>
                      <b>{t.coming}</b>
                      <p>{t.cardHint}</p>
                    </div>
                  </div>
                )}
              </div>
            </section>
            {activeCard && (
              <section className="card-action-grid" aria-label={language === "ru" ? "Действия карты" : "Card actions"}>
                <button onClick={() => cardAction("topup", activeCard)}>
                  <WalletCards size={21} />
                  <span>{t.topup}</span>
                </button>
                <button onClick={() => cardAction("transfer", activeCard)}>
                  <Send size={21} />
                  <span>{language === "ru" ? "Перевести" : "Transfer"}</span>
                </button>
                <button onClick={() => cardAction("freeze", activeCard)}>
                  <Snowflake size={21} />
                  <span>
                    {activeCard.status === "frozen"
                      ? language === "ru"
                        ? "Разморозить"
                        : "Unfreeze"
                      : language === "ru"
                        ? "Заморозить"
                        : "Freeze"}
                  </span>
                </button>
                <button className="danger" onClick={() => cardAction("close", activeCard)}>
                  <XCircle size={21} />
                  <span>{language === "ru" ? "Закрыть" : "Close"}</span>
                </button>
              </section>
            )}
            <section className="dashboard-section selected-card-summary">
              <div className="section-heading">
                <h2>{t.recent}</h2>
                <span className="selected-card-label">{activeCard ? `•••• ${activeCard.last_four ?? "—"}` : "—"}</span>
              </div>
              <div className="history-empty-row">{activeCard ? t.noTransactions : t.coming}</div>
            </section>
          </>
        )}
        {view === "issue" && <IssueCardPanel />}
        {view === "services" && (
          <section className="page-panel">
            <div className="panel-icon">
              <Wrench size={40} />
            </div>
            <h2>Сервисы</h2>
            <p>Раздел в разработке.</p>
          </section>
        )}
        {view === "history" && (
          <section className="history-panel">
            <div className="history-filters">
              <button className="selected">{language === "ru" ? "Все операции" : "All"}</button>
              <button>{language === "ru" ? "Пополнения" : "Top-ups"}</button>
              <button>{language === "ru" ? "Покупки" : "Purchases"}</button>
            </div>
            {cards.length ? (
              <div className="history-grouped">
                {cards.map((card) => (
                  <div className="history-card-block" key={card.id}>
                    <div className="history-card-title">
                      <CreditCard size={15} /> •••• {card.last_four ?? "—"} · {card.status}
                    </div>
                    <div className="history-empty-row">{t.noTransactions}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="history-empty-row">{t.noTransactions}</div>
            )}
          </section>
        )}
        {view === "profile" && (
          <section className="profile-stack">
            <div className="profile-hero">
              <div className="profile-avatar">А</div>
              <div>
                <span className="dashboard-eyebrow">FLYTOPAY ACCOUNT</span>
                <h2>{language === "ru" ? "Ваш профиль" : "Your profile"}</h2>
                <p>
                  {language === "ru"
                    ? "Настройки кабинета, уведомления и безопасность"
                    : "Cabinet settings, notifications and security"}
                </p>
              </div>
            </div>
            <PreferencesPanel />
            <div className="profile-menu">
              <button>
                <ShieldIcon />
                <span>
                  <b>{language === "ru" ? "Безопасность" : "Security"}</b>
                  <small>
                    {language === "ru" ? "Telegram-сессия и доступ к картам" : "Telegram session and card access"}
                  </small>
                </span>
                <ArrowUpRight size={17} />
              </button>
              <button>
                <SupportIcon />
                <span>
                  <b>{t.support}</b>
                  <small>
                    {language === "ru" ? "Помощь по платежам и выпуску карт" : "Help with payments and card issuance"}
                  </small>
                </span>
                <ArrowUpRight size={17} />
              </button>
              <button>
                <DocumentIcon />
                <span>
                  <b>{language === "ru" ? "Документы" : "Documents"}</b>
                  <small>{language === "ru" ? "Условия использования и приватность" : "Terms and privacy"}</small>
                </span>
                <ArrowUpRight size={17} />
              </button>
            </div>
          </section>
        )}
        <footer>Flytopay · {t.cardHint}</footer>
      </main>
      <nav className="mobile-dashboard-nav">
        <button className={view === "home" ? "active" : ""} onClick={() => navigate("home")}>
          <Home size={18} />
          <span>{t.title}</span>
        </button>
        <button className={view === "history" ? "active" : ""} onClick={() => navigate("history")}>
          <History size={18} />
          <span>{t.history}</span>
        </button>
        <button className={view === "services" ? "active" : ""} onClick={() => navigate("services")}>
          <Wrench size={18} />
          <span>Сервисы</span>
        </button>
        <button className={view === "profile" ? "active" : ""} onClick={() => navigate("profile")}>
          <UserRound size={18} />
          <span>{t.profile}</span>
        </button>
      </nav>
      <CardDetailsDialog card={selectedCard} open={Boolean(selectedCard)} onClose={() => setSelectedCard(null)} />
    </div>
  );
}
