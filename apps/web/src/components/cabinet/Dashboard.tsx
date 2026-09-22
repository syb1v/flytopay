"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDownLeft,
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
import {
  getCards,
  getCardTransactions,
  getAdminStatus,
  getRentals,
  getWallet,
  fundCard,
  unloadCard,
  unfreezeCard,
  freezeCard,
  closeCard,
  createCheckout,
  type Card,
  type Rental,
  type Wallet,
} from "../../lib/api";
import { usePreferences } from "../providers/PreferencesProvider";
import { CardDetailsDialog } from "../cards/CardDetailsDialog";
import { CardVisual } from "../cards/CardVisual";
import { IssueCardPanel } from "../cards/IssueCardPanel";
import { TransactionsHistory } from "../cards/TransactionsHistory";
import { Modal } from "../ui/modal";
import { Loader } from "../ui/loader";
import { schemeForCard, tierForProduct } from "../../lib/cardTheme";

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
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const [telegramUser, setTelegramUser] = useState<{ name: string; id: string; initial: string }>({
    name: "Flytopay",
    id: "—",
    initial: "F",
  });

  useEffect(() => {
    const readUser = () => {
      const user = window.Telegram?.WebApp?.initDataUnsafe?.user;
      if (user?.id) {
        const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username || "Flytopay";
        setTelegramUser({
          name,
          id: String(user.id),
          initial: (user.first_name || user.username || "F").charAt(0).toUpperCase(),
        });
      }
    };
    readUser();
    const timer = window.setTimeout(readUser, 500);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!authReady) return;
    const webApp = window.Telegram?.WebApp;
    if (!webApp) return;
    const forceFullscreen = () => {
      try {
        webApp.ready();
        webApp.disableVerticalSwipes?.();
        webApp.requestFullscreen?.();
        webApp.expand();
      } catch {
        // Older Telegram clients can reject fullscreen calls; expand remains the fallback.
      }
    };
    forceFullscreen();
    webApp.onEvent?.("viewportChanged", forceFullscreen);
    const retryTimer = window.setTimeout(forceFullscreen, 300);
    Promise.all([getWallet(), getCards(), getRentals(), getAdminStatus()])
      .then(([nextWallet, nextCards, nextRentals, nextIsAdmin]) => {
        setWallet(nextWallet);
        setCards(nextCards);
        setRentals(nextRentals);
        setIsAdmin(nextIsAdmin);
      })
      .catch(() => setDataError(true));
    return () => {
      window.clearTimeout(retryTimer);
      webApp.offEvent?.("viewportChanged", forceFullscreen);
    };
  }, [authReady]);

  // The home view unmounts when navigating away; on return the carousel renders
  // at scrollLeft=0 while activeIndex keeps the previously selected card, leaving
  // the first card greyed out. Restore the scroll position to the active card.
  useEffect(() => {
    if (view !== "home") return;
    const element = cardsScroller.current;
    if (!element) return;
    const target = element.children[activeIndexRef.current] as HTMLElement | undefined;
    if (!target) return;
    const offset = target.offsetLeft - (element.clientWidth - target.offsetWidth) / 2;
    if (Math.abs(element.scrollLeft - offset) > 4) {
      element.scrollLeft = offset;
    }
  }, [view, cards.length]);

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
  function cardVariant(card: Card) {
    return tierForProduct(card.product_code);
  }
  const [actionError, setActionError] = useState<string | null>(null);
  const [infoModal, setInfoModal] = useState<string | null>(null);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [amountDialog, setAmountDialog] = useState<{ action: "topup" | "transfer"; card: Card } | null>(null);

  async function submitAmount(amountMinor: number) {
    if (!amountDialog) return;
    const { action, card } = amountDialog;
    setActionError(null);
    setActionPending(`${action}:${card.id}`);
    try {
      if (action === "topup") {
        await fundCard(card.id, amountMinor);
      } else {
        await unloadCard(card.id, amountMinor);
      }
      setAmountDialog(null);
      const [nextWallet, nextCards] = await Promise.all([getWallet(), getCards()]);
      setWallet(nextWallet);
      setCards(nextCards);
    } catch {
      setActionError(
        language === "ru"
          ? "Операция временно недоступна — попробуйте позже"
          : "Operation is temporarily unavailable — try again later",
      );
    } finally {
      setActionPending(null);
    }
  }

  async function cardAction(action: "topup" | "transfer" | "freeze" | "close", card: Card) {
    if (action === "topup" || action === "transfer") {
      setAmountDialog({ action, card });
      return;
    }
    setActionError(null);
    setActionPending(`${action}:${card.id}`);
    try {
      if (action === "freeze") {
        const frozen = card.status === "frozen";
        const result = frozen ? await unfreezeCard(card.id) : await freezeCard(card.id);
        setCards((current) => current.map((item) => (item.id === card.id ? { ...item, status: result.status } : item)));
      } else {
        await closeCard(card.id);
        setCards((current) => current.filter((item) => item.id !== card.id));
        setActiveIndex((current) => Math.max(0, Math.min(current, cards.length - 2)));
      }
    } catch {
      setActionError(
        language === "ru"
          ? "Операция временно недоступна — попробуйте позже"
          : "Operation is temporarily unavailable — try again later",
      );
    } finally {
      setActionPending(null);
    }
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
      scheme={schemeForCard(card.scheme)}
      variant={cardVariant(card)}
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
            <span className="avatar-mark">{telegramUser.initial}</span>
            <span>
              {telegramUser.name}
              <small>{t.profile}</small>
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
                    ? language === "ru"
                      ? "Сервисы"
                      : "Services"
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
            <button className="support-button" onClick={() => setInfoModal(t.coming)} aria-label={t.support}>
              ?
            </button>
            <span className="avatar-mark">{telegramUser.initial}</span>
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
                  <button onClick={() => setTopUpOpen(true)}>＋ {t.topup}</button>
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
            {isAdmin && (
              <section className="admin-entry-card">
                <div>
                  <span className="dashboard-eyebrow">ADMIN ACCESS</span>
                  <strong>{language === "ru" ? "Админ-панель" : "Admin panel"}</strong>
                  <small>
                    {language === "ru"
                      ? "Пользователи, карты, платежи и выпуск"
                      : "Users, cards, payments and issuance"}
                  </small>
                </div>
                <a href="/admin">{language === "ru" ? "Открыть" : "Open"} ↗</a>
              </section>
            )}
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
                <button
                  disabled={actionPending === `freeze:${activeCard.id}`}
                  onClick={() => cardAction("freeze", activeCard)}
                >
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
                <button
                  className="danger"
                  disabled={actionPending === `close:${activeCard.id}`}
                  onClick={() => cardAction("close", activeCard)}
                >
                  <XCircle size={21} />
                  <span>{language === "ru" ? "Закрыть" : "Close"}</span>
                </button>
              </section>
            )}
            {actionError && <div className="data-warning">{actionError}</div>}
            <section className="dashboard-section selected-card-summary">
              <div className="section-heading">
                <h2>{t.recent}</h2>
                <span className="selected-card-label">{activeCard ? `•••• ${activeCard.last_four ?? "—"}` : "—"}</span>
              </div>
              {activeCard ? (
                <RecentTransactions cardId={activeCard.id} emptyLabel={t.noTransactions} errorLabel={t.coming} />
              ) : (
                <div className="history-empty-row">{t.coming}</div>
              )}
            </section>
          </>
        )}
        {view === "issue" && <IssueCardPanel />}
        {view === "services" && (
          <section className="services-panel">
            <p className="services-intro">
              {language === "ru"
                ? "Всё для работы с картами Flytopay в одном месте."
                : "Everything you need to manage Flytopay cards in one place."}
            </p>
            <div className="services-grid">
              <button className="service-tile" onClick={() => navigate("issue")}>
                <span className="service-icon">
                  <CreditCard size={22} />
                </span>
                <b>{language === "ru" ? "Выпуск карты" : "Issue a card"}</b>
                <small>
                  {language === "ru" ? "Премиум, путешествия и подписки" : "Premium, travel and subscriptions"}
                </small>
              </button>
              <button className="service-tile" onClick={() => navigate("history")}>
                <span className="service-icon">
                  <History size={22} />
                </span>
                <b>{language === "ru" ? "История операций" : "Transactions"}</b>
                <small>{language === "ru" ? "Фильтры по картам и типам" : "Filter by card and type"}</small>
              </button>
              <div className="service-tile disabled" aria-disabled="true">
                <span className="service-icon">
                  <WalletCards size={22} />
                </span>
                <b>{language === "ru" ? "Пополнение баланса" : "Wallet top-up"}</b>
                <small>{language === "ru" ? "Скоро: СБП, карта, крипта" : "Soon: SBP, card, crypto"}</small>
              </div>
              <div className="service-tile disabled" aria-disabled="true">
                <span className="service-icon">
                  <CircleDollarSign size={22} />
                </span>
                <b>{language === "ru" ? "Обмен валюты" : "Currency exchange"}</b>
                <small>{language === "ru" ? "Скоро: выгодные курсы" : "Soon: favourable rates"}</small>
              </div>
            </div>
          </section>
        )}
        {view === "history" && (
          <section className="history-panel">
            <TransactionsHistory cards={cards} />
          </section>
        )}
        {view === "profile" && (
          <section className="profile-stack">
            <div className="profile-hero">
              <div className="profile-avatar">{telegramUser.initial}</div>
              <div>
                <span className="dashboard-eyebrow">FLYTOPAY · {telegramUser.id}</span>
                <h2>{telegramUser.name}</h2>
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
      <Modal
        open={infoModal !== null}
        onClose={() => setInfoModal(null)}
        eyebrow="FLYTOPAY"
        title={t.support}
        closeLabel={language === "ru" ? "Закрыть" : "Close"}
      >
        <p className="settings-muted">{infoModal}</p>
      </Modal>
      <TopUpModal
        open={topUpOpen}
        ru={language === "ru"}
        onClose={() => setTopUpOpen(false)}
        onSuccess={async () => {
          setTopUpOpen(false);
          setWallet(await getWallet());
        }}
      />
      {amountDialog && (
        <AmountDialog
          title={
            amountDialog.action === "topup"
              ? language === "ru"
                ? "Пополнить карту"
                : "Fund card"
              : language === "ru"
                ? "Перевести с карты"
                : "Transfer from card"
          }
          cardLabel={`•••• ${amountDialog.card.last_four ?? "—"}`}
          currency={amountDialog.card.currency}
          maxMinor={amountDialog.action === "transfer" ? (amountDialog.card.balance_minor ?? 0) : null}
          pending={actionPending === `${amountDialog.action}:${amountDialog.card.id}`}
          submitLabel={
            amountDialog.action === "topup"
              ? language === "ru"
                ? "Пополнить"
                : "Fund"
              : language === "ru"
                ? "Перевести"
                : "Transfer"
          }
          ru={language === "ru"}
          onClose={() => setAmountDialog(null)}
          onSubmit={(minor) => void submitAmount(minor)}
        />
      )}
    </div>
  );
}

function RecentTransactions({
  cardId,
  emptyLabel,
  errorLabel,
}: {
  cardId: string;
  emptyLabel: string;
  errorLabel: string;
}) {
  const [items, setItems] = useState<
    Array<{
      id: string;
      title: string;
      amount: string;
      positive: boolean;
      declined: boolean;
      time: string;
      isPositiveType: boolean;
    }>
  >([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    getCardTransactions(cardId, 5)
      .then((transactions) => {
        if (cancelled) return;
        setItems(
          transactions.slice(0, 5).map((tx) => {
            const positive = tx.type === "refund" || tx.type === "topup" || tx.type === "fund";
            const declined = tx.status === "declined" || tx.status === "canceled";
            const value = new Intl.NumberFormat("ru-RU", { style: "currency", currency: tx.currency }).format(
              tx.amount_minor / 10 ** tx.scale,
            );
            return {
              id: tx.id,
              title: tx.merchant_name ?? tx.type,
              amount: positive ? `+ ${value}` : `− ${value}`,
              positive,
              declined,
              isPositiveType: positive,
              time: tx.occurred_at
                ? new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(
                    new Date(tx.occurred_at),
                  )
                : "",
            };
          }),
        );
        setState("ready");
      })
      .catch(() => !cancelled && setState("error"));
    return () => {
      cancelled = true;
    };
  }, [cardId]);

  if (state === "loading")
    return (
      <div className="recent-tx-list">
        <Loader />
      </div>
    );
  if (state === "error") return <div className="history-empty-row">{errorLabel}</div>;
  if (!items.length) return <div className="history-empty-row">{emptyLabel}</div>;
  return (
    <div className="tx-list recent-tx-list">
      {items.map((item) => (
        <div className={`tx-row ${item.declined ? "declined" : ""}`} key={item.id}>
          <span className={`tx-icon ${item.isPositiveType && !item.declined ? "positive" : ""}`}>
            {item.isPositiveType ? <ArrowDownLeft size={16} /> : <CreditCard size={16} />}
          </span>
          <div className="tx-info">
            <p className="tx-title">{item.title}</p>
            <p className="tx-meta">
              {item.time}
              <span className={item.declined ? "negative" : "positive-status"}>
                • {item.declined ? "Отменено" : "Успешно"}
              </span>
            </p>
          </div>
          <span
            className={`tx-amount ${item.positive ? (item.declined ? "muted" : "positive") : item.declined ? "muted" : "negative"}`}
          >
            {item.amount}
          </span>
        </div>
      ))}
    </div>
  );
}

function AmountDialog({
  title,
  cardLabel,
  currency,
  maxMinor,
  pending,
  submitLabel,
  ru,
  onClose,
  onSubmit,
}: {
  title: string;
  cardLabel: string;
  currency: string;
  maxMinor: number | null;
  pending: boolean;
  submitLabel: string;
  ru: boolean;
  onClose: () => void;
  onSubmit: (amountMinor: number) => void;
}) {
  const [value, setValue] = useState("");
  const parsed = Number.parseFloat(value.replace(",", "."));
  const amountMinor = Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : 0;
  const overMax = maxMinor != null && amountMinor > maxMinor;
  const valid = amountMinor > 0 && !overMax;
  return (
    <Modal
      open
      onClose={onClose}
      eyebrow="FLYTOPAY"
      title={title}
      description={`${cardLabel} · ${currency}`}
      closeLabel={ru ? "Закрыть" : "Close"}
    >
      <label className="field-label">
        {ru ? "Сумма" : "Amount"} ({currency})
        <input
          inputMode="decimal"
          value={value}
          onChange={(event) => setValue(event.target.value.replace(/[^\d.,]/g, ""))}
          placeholder={maxMinor != null ? `${(maxMinor / 100).toFixed(2)}` : "10.00"}
        />
      </label>
      {overMax && <p className="error-text">{ru ? "Недостаточно средств на карте" : "Amount exceeds card balance"}</p>}
      <button className="lime-action" disabled={!valid || pending} onClick={() => onSubmit(amountMinor)}>
        {pending ? "…" : submitLabel}
      </button>
    </Modal>
  );
}

function TopUpModal({
  open,
  ru,
  onClose,
  onSuccess,
}: {
  open: boolean;
  ru: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}) {
  const [amount, setAmount] = useState("10");
  const [provider, setProvider] = useState<"telegram_stars" | "platega" | "pay2328">("telegram_stars");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const numeric = Number.parseFloat(amount.replace(",", "."));
    if (!Number.isFinite(numeric) || numeric <= 0) return;
    setBusy(true);
    setError(null);
    try {
      const result = await createCheckout(
        {
          provider,
          purpose: "wallet_deposit",
          amount_minor: Math.round(numeric * 100),
          currency: "USD",
          scale: 2,
          return_url: window.location.href,
        },
        crypto.randomUUID(),
      );
      const url = result.data.checkoutUrl;
      if (!url) throw new Error("checkout_url_missing");
      if (provider === "telegram_stars" && window.Telegram?.WebApp?.openInvoice) {
        window.Telegram.WebApp.openInvoice(url, (status) => {
          if (status === "paid") void onSuccess();
          setBusy(false);
        });
      } else {
        window.location.assign(url);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : ru ? "Платёж недоступен" : "Payment unavailable");
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="FLYTOPAY"
      title={ru ? "Пополнить баланс" : "Top up balance"}
      description={ru ? "Telegram Stars: 1 ⭐ = 1 USD в демо-режиме" : "Telegram Stars: 1 ⭐ = 1 USD in demo mode"}
      closeLabel={ru ? "Закрыть" : "Close"}
    >
      <label className="field-label">
        {ru ? "Сумма" : "Amount"} (USD)
        <input
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value.replace(/[^\d.,]/g, ""))}
        />
      </label>
      <div className="topup-providers">
        <button
          className={provider === "telegram_stars" ? "selected" : ""}
          onClick={() => setProvider("telegram_stars")}
        >
          <b>⭐ Telegram Stars</b>
          <small>{ru ? "Доступно" : "Available"}</small>
        </button>
        <button className="disabled" disabled>
          <b>Platega</b>
          <small>{ru ? "Не настроено" : "Not configured"}</small>
        </button>
        <button className="disabled" disabled>
          <b>2328 Pay</b>
          <small>{ru ? "Не настроено" : "Not configured"}</small>
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
      <button
        className="lime-action"
        disabled={busy || Number.parseFloat(amount.replace(",", ".")) <= 0}
        onClick={() => void submit()}
      >
        {busy ? "…" : ru ? "Перейти к оплате" : "Continue to payment"}
      </button>
    </Modal>
  );
}
