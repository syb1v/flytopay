"use client";

import { useCallback, useEffect, useState } from "react";
import {
  adminCardAction,
  getAdminCard,
  getAdminCards,
  getAdminCardsOverview,
  getAdminCaasOperations,
  getAdminIssuances,
  getAdminRentals,
  getAdminTransactions,
  type AdminCard,
  type AdminCardDetail,
  type AdminCardOverview,
  type AdminCaasOperation,
  type AdminIssuance,
  type AdminRental,
  type AdminTransaction,
} from "../../lib/api";

const date = (value: string | null) =>
  value ? new Date(value).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" }) : "—";
const money = (value: number, currency: string) => `${(value / 100).toLocaleString("ru-RU")} ${currency}`;

const statusLabels: Record<string, string> = {
  active: "Активна",
  frozen: "Заморожена",
  closed: "Закрыта",
  closing: "Закрывается",
  issuing: "Выпускается",
  pending: "В обработке",
  processing: "В обработке",
  completed: "Завершена",
  failed: "Ошибка",
  succeeded: "Успешно",
  quoted: "Квота",
  paid: "Оплачена",
  issued: "Выпущена",
};

export default function CardsAdmin() {
  const [tab, setTab] = useState<"cards" | "issuances" | "rentals" | "transactions" | "operations">("cards");
  const [overview, setOverview] = useState<AdminCardOverview | null>(null);
  const [cards, setCards] = useState<AdminCard[]>([]);
  const [issuances, setIssuances] = useState<AdminIssuance[]>([]);
  const [rentals, setRentals] = useState<AdminRental[]>([]);
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [operations, setOperations] = useState<AdminCaasOperation[]>([]);
  const [query, setQuery] = useState("");
  const [cardStatus, setCardStatus] = useState("");
  const [detail, setDetail] = useState<AdminCardDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback(() => {
    getAdminCardsOverview()
      .then(setOverview)
      .catch(() => setOverview(null));
  }, []);
  const loadTab = useCallback(() => {
    if (tab === "cards")
      getAdminCards({ q: query, status: cardStatus })
        .then((page) => setCards(page.items))
        .catch(() => setCards([]));
    if (tab === "issuances")
      getAdminIssuances()
        .then((page) => setIssuances(page.items))
        .catch(() => setIssuances([]));
    if (tab === "rentals")
      getAdminRentals()
        .then((page) => setRentals(page.items))
        .catch(() => setRentals([]));
    if (tab === "transactions")
      getAdminTransactions()
        .then((page) => setTransactions(page.items))
        .catch(() => setTransactions([]));
    if (tab === "operations")
      getAdminCaasOperations()
        .then((page) => setOperations(page.items))
        .catch(() => setOperations([]));
  }, [tab, query, cardStatus]);

  useEffect(() => loadOverview(), [loadOverview]);
  useEffect(() => {
    const timer = window.setTimeout(loadTab, 250);
    return () => window.clearTimeout(timer);
  }, [loadTab]);

  const openCard = (id: string) =>
    getAdminCard(id)
      .then(setDetail)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Не удалось открыть карту"));

  return (
    <>
      {overview && (
        <div className="admin-stat-grid admin-stat-grid-small">
          <article>
            <span>Всего карт</span>
            <strong>{overview.total}</strong>
          </article>
          <article>
            <span>Активные</span>
            <strong>{overview.active}</strong>
          </article>
          <article>
            <span>Замороженные</span>
            <strong>{overview.frozen}</strong>
          </article>
          <article>
            <span>Закрытые</span>
            <strong>{overview.closed}</strong>
          </article>
          <article>
            <span>Demo</span>
            <strong>{overview.demo}</strong>
          </article>
          <article>
            <span>Операции в обработке</span>
            <strong>{overview.pendingOperations}</strong>
          </article>
          <article>
            <span>Ошибки операций</span>
            <strong>{overview.failedOperations}</strong>
          </article>
        </div>
      )}
      <section className="admin-panel">
        <div className="admin-toolbar">
          <div className="admin-tabs">
            {(
              [
                ["cards", "Карты"],
                ["issuances", "Выдача"],
                ["rentals", "Аренды"],
                ["transactions", "Транзакции"],
                ["operations", "Операции CaaS"],
              ] as const
            ).map(([key, label]) => (
              <button key={key} className={`admin-tab ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}>
                {label}
              </button>
            ))}
          </div>
          {tab === "cards" && (
            <div className="admin-toolbar-actions">
              <label className="admin-search">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="UUID карты, Telegram ID или последние 4 цифры"
                />
              </label>
              <select value={cardStatus} onChange={(event) => setCardStatus(event.target.value)}>
                <option value="">Все статусы</option>
                <option value="active">Активные</option>
                <option value="frozen">Замороженные</option>
                <option value="closing">Закрываются</option>
                <option value="closed">Закрытые</option>
                <option value="issuing">Выпускаются</option>
              </select>
            </div>
          )}
        </div>
        {error && <p className="admin-error">{error}</p>}
        {tab === "cards" && (
          <div className="admin-table">
            <div className="admin-table-head cards-grid">
              <span>Карта</span>
              <span>Владелец</span>
              <span>Статус</span>
              <span>Баланс</span>
              <span>Создана</span>
              <span />
            </div>
            {cards.map((card) => (
              <button className="admin-table-row cards-grid" key={card.cardId} onClick={() => openCard(card.cardId)}>
                <span>
                  <b>{card.productName ?? card.productCode ?? "Карта"}</b>
                  <small>
                    ••{card.lastFour ?? "****"}
                    {card.isDemo ? " · demo" : ""}
                  </small>
                </span>
                <span>
                  <b>{card.telegramId ?? "—"}</b>
                  <small>{card.userId}</small>
                </span>
                <span>
                  <em className={`admin-badge ${card.status === "active" ? "active" : "blocked"}`}>
                    {statusLabels[card.status] ?? card.status}
                  </em>
                </span>
                <span>{card.balanceMinor === null ? "—" : money(card.balanceMinor, card.currency)}</span>
                <span>{date(card.createdAt)}</span>
                <span>→</span>
              </button>
            ))}
            {cards.length === 0 && <p className="settings-muted">Карты не найдены.</p>}
          </div>
        )}
        {tab === "issuances" && (
          <div className="admin-table">
            <div className="admin-table-head cards-grid">
              <span>Заявка</span>
              <span>Пользователь</span>
              <span>Продукт</span>
              <span>Статус</span>
              <span>Сумма</span>
              <span>Дата</span>
            </div>
            {issuances.map((item) => (
              <div className="admin-table-row cards-grid" key={item.issuanceId}>
                <span>
                  <b>{item.issuanceId.slice(0, 8)}</b>
                  <small>{item.providerOrderId ?? "—"}</small>
                </span>
                <span>{item.telegramId ?? item.userId}</span>
                <span>
                  <b>{item.productCode}</b>
                  <small>
                    {item.providerCode} · {item.termDays} дн.
                  </small>
                </span>
                <span>
                  <em
                    className={`admin-badge ${item.status === "issued" || item.status === "paid" ? "active" : item.status === "failed" ? "blocked" : "pending"}`}
                  >
                    {statusLabels[item.status] ?? item.status}
                  </em>
                </span>
                <span>{money(item.totalChargeMinor ?? item.amountMinor, item.currency)}</span>
                <span>{date(item.createdAt)}</span>
              </div>
            ))}
            {issuances.length === 0 && <p className="settings-muted">Заявок пока нет.</p>}
          </div>
        )}
        {tab === "rentals" && (
          <div className="admin-table">
            <div className="admin-table-head cards-grid">
              <span>Аренда</span>
              <span>Пользователь</span>
              <span>Карта</span>
              <span>Статус</span>
              <span>Срок</span>
              <span>Цена</span>
            </div>
            {rentals.map((rental) => (
              <div className="admin-table-row cards-grid" key={rental.id}>
                <span>
                  <b>{rental.id.slice(0, 8)}</b>
                  <small>{rental.termDays} дн.</small>
                </span>
                <span>{rental.telegramId ?? rental.userId}</span>
                <span>{rental.cardId.slice(0, 8)}</span>
                <span>
                  <em className={`admin-badge ${rental.status === "active" ? "active" : "blocked"}`}>
                    {statusLabels[rental.status] ?? rental.status}
                  </em>
                </span>
                <span>{date(rental.expiresAt)}</span>
                <span>{money(rental.priceMinor, rental.currency)}</span>
              </div>
            ))}
            {rentals.length === 0 && <p className="settings-muted">Аренд пока нет.</p>}
          </div>
        )}
        {tab === "transactions" && (
          <div className="admin-table">
            <div className="admin-table-head cards-grid">
              <span>Тип</span>
              <span>Карта</span>
              <span>Статус</span>
              <span>Сумма</span>
              <span>Мерчант</span>
              <span>Дата</span>
            </div>
            {transactions.map((transaction) => (
              <div className="admin-table-row cards-grid" key={transaction.id}>
                <span>
                  <b>{transaction.type}</b>
                  <small>{transaction.declineCode ?? ""}</small>
                </span>
                <span>{transaction.cardId.slice(0, 8)}</span>
                <span>
                  <em className={`admin-badge ${transaction.status === "completed" ? "active" : "blocked"}`}>
                    {statusLabels[transaction.status] ?? transaction.status}
                  </em>
                </span>
                <span>{money(transaction.amountMinor, transaction.currency)}</span>
                <span>{transaction.merchantName ?? "—"}</span>
                <span>{date(transaction.occurredAt)}</span>
              </div>
            ))}
            {transactions.length === 0 && <p className="settings-muted">Транзакций пока нет.</p>}
          </div>
        )}
        {tab === "operations" && (
          <div className="admin-table">
            <div className="admin-table-head cards-grid">
              <span>Операция</span>
              <span>Заказ</span>
              <span>Статус</span>
              <span>Ошибка</span>
              <span>Дата</span>
              <span />
            </div>
            {operations.map((operation) => (
              <div className="admin-table-row cards-grid" key={operation.id}>
                <span>
                  <b>{operation.kind}</b>
                  <small>{operation.id.slice(0, 8)}</small>
                </span>
                <span>{operation.providerOrderId ?? "—"}</span>
                <span>
                  <em className={`admin-badge ${operation.status === "completed" ? "active" : "blocked"}`}>
                    {statusLabels[operation.status] ?? operation.status}
                  </em>
                </span>
                <span>{operation.error ?? "—"}</span>
                <span>{date(operation.createdAt)}</span>
                <span />
              </div>
            ))}
            {operations.length === 0 && <p className="settings-muted">Операций пока нет.</p>}
          </div>
        )}
      </section>
      {detail && (
        <CardDialog
          card={detail}
          onClose={() => setDetail(null)}
          onDone={() => {
            setDetail(null);
            loadOverview();
            loadTab();
          }}
        />
      )}
    </>
  );
}

function CardDialog({ card, onClose, onDone }: { card: AdminCardDetail; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const ready = reason.trim().length >= 3;
  const run = async (action: "freeze" | "unfreeze" | "close" | "fund" | "unload") => {
    if (!ready) return;
    if ((action === "fund" || action === "unload") && !Number(amount)) {
      setMessage("Укажите сумму в minor units");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const result = (await adminCardAction(card.cardId, action, reason.trim(), Number(amount) || undefined)) as {
        operationStatus?: string;
      };
      setMessage(`Операция отправлена: ${result?.operationStatus ?? "processing"}`);
      onDone();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Операция не выполнена");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="admin-dialog-backdrop" onClick={onClose}>
      <section className="admin-dialog" onClick={(event) => event.stopPropagation()}>
        <button className="admin-dialog-close" onClick={onClose}>
          ×
        </button>
        <span className={`admin-badge ${card.status === "active" ? "active" : "blocked"}`}>
          {statusLabels[card.status] ?? card.status}
        </span>
        <h2>
          {card.productName ?? card.productCode ?? "Карта"} ····{card.lastFour ?? "****"}
        </h2>
        <p className="settings-muted">
          {card.cardId} · {card.isDemo ? "demo" : "real"} · {card.currency}
        </p>
        <div className="admin-detail-grid">
          <div>
            <small>Владелец</small>
            <b>{card.telegramId ?? card.userId}</b>
          </div>
          <div>
            <small>Баланс</small>
            <b>{card.balanceMinor === null ? "—" : money(card.balanceMinor, card.currency)}</b>
          </div>
          <div>
            <small>Аренды</small>
            <b>{card.rentals.length}</b>
          </div>
          <div>
            <small>Транзакции</small>
            <b>{card.transactions.length}</b>
          </div>
        </div>
        {card.operations.length > 0 && (
          <div className="admin-card-operations">
            {card.operations.map((operation) => (
              <div className="admin-price-row" key={operation.id}>
                <span>{operation.kind}</span>
                <b>{statusLabels[operation.status] ?? operation.status}</b>
                <small>{operation.error ?? date(operation.createdAt)}</small>
              </div>
            ))}
          </div>
        )}
        <label className="admin-reason">
          Причина действия
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Минимум 3 символа"
          />
        </label>
        <label className="admin-reason">
          Сумма в minor units (для пополнения или выгрузки)
          <input
            inputMode="numeric"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="1000"
          />
        </label>
        {message && <p className="settings-muted">{message}</p>}
        <div className="admin-dialog-actions">
          <button className="ui-button ui-button-secondary" disabled={busy || !ready} onClick={() => run("freeze")}>
            Заморозить
          </button>
          <button className="ui-button ui-button-secondary" disabled={busy || !ready} onClick={() => run("unfreeze")}>
            Разморозить
          </button>
          <button className="ui-button ui-button-secondary" disabled={busy || !ready} onClick={() => run("fund")}>
            Пополнить
          </button>
          <button className="ui-button ui-button-secondary" disabled={busy || !ready} onClick={() => run("unload")}>
            Выгрузить
          </button>
          <button className="ui-button ui-button-danger" disabled={busy || !ready} onClick={() => run("close")}>
            Закрыть карту
          </button>
        </div>
      </section>
    </div>
  );
}
