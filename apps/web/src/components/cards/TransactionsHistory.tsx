"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ChevronDown, CreditCard, Info } from "lucide-react";
import { getCardTransactions, type Card, type CardTransaction } from "../../lib/api";
import { usePreferences } from "../providers/PreferencesProvider";
import { Loader } from "../ui/loader";
import { Modal } from "../ui/modal";

const statusLabels = {
  ru: {
    success: "Успешно",
    canceled: "Отменено",
    declined: "Отклонено",
    pending: "В обработке",
    completed: "Успешно",
    processing: "В обработке",
  },
  en: {
    success: "Success",
    canceled: "Canceled",
    declined: "Declined",
    pending: "Pending",
    completed: "Success",
    processing: "Pending",
  },
} as const;

const typeLabels = {
  ru: { settlement: "Покупка", refund: "Возврат", fee: "Комиссия", topup: "Пополнение", fund: "Пополнение карты" },
  en: { settlement: "Purchase", refund: "Refund", fee: "Fee", topup: "Top-up", fund: "Card top-up" },
} as const;

const declineReasons = {
  ru: { insufficient_funds: "Недостаточно средств", do_not_honor: "Отклонено банком-эмитентом" },
  en: { insufficient_funds: "Insufficient funds", do_not_honor: "Do not honor" },
} as const;

function formatAmount(minor: number, currency: string, scale: number, positive: boolean) {
  const value = new Intl.NumberFormat("ru-RU", { style: "currency", currency, minimumFractionDigits: scale }).format(
    minor / 10 ** scale,
  );
  return positive ? `+ ${value}` : `− ${value}`;
}

function dateGroupLabel(date: Date, ru: boolean) {
  return new Intl.DateTimeFormat(ru ? "ru-RU" : "en-US", { day: "numeric", month: "long" }).format(date);
}

export function TransactionsHistory({ cards }: { cards: Card[] }) {
  const { preferences } = usePreferences();
  const ru: boolean = preferences.language === "ru";
  const lang: "ru" | "en" = ru ? "ru" : "en";
  const [filter, setFilter] = useState<"all" | "card" | "type">("all");
  const [filterCard, setFilterCard] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [cardPickerOpen, setCardPickerOpen] = useState(false);
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [transactions, setTransactions] = useState<CardTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedTx, setSelectedTx] = useState<CardTransaction | null>(null);

  const cardByNothing = useMemo(() => new Map<string, Card>(), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    Promise.all(
      cards.map((card) =>
        getCardTransactions(card.id, 50)
          .then((txs) => txs.map((tx) => ({ ...tx, cardId: card.id })))
          .catch(() => []),
      ),
    )
      .then((results) => {
        if (cancelled) return;
        setTransactions(results.flat() as CardTransaction[]);
      })
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [cards]);

  const cardOf = (tx: CardTransaction): Card | undefined =>
    cards.find((card) => card.id === (tx as CardTransaction & { cardId?: string }).cardId);

  const filtered = useMemo(
    () =>
      transactions.filter((tx) => {
        if (filter === "card" && filterCard !== "all") {
          const card = cardOf(tx);
          if (card?.last_four !== filterCard) return false;
        }
        if (filter === "type" && filterType !== "all" && tx.type !== filterType) return false;
        return true;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, filter, filterCard, filterType, cards],
  );

  const grouped = useMemo(() => {
    const groups = new Map<string, CardTransaction[]>();
    for (const tx of filtered) {
      const key = tx.occurred_at ? dateGroupLabel(new Date(tx.occurred_at), ru) : ru ? "Без даты" : "No date";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(tx);
    }
    return Array.from(groups.entries());
  }, [filtered, ru]);

  const typeOptions = Array.from(new Set(transactions.map((tx) => tx.type)));

  return (
    <div className="transactions-history">
      <div className="tx-filters">
        <button className={`tx-chip ${filter === "all" ? "selected" : ""}`} onClick={() => setFilter("all")}>
          {ru ? "Все" : "All"}
        </button>
        <button
          className={`tx-chip ${filter === "card" ? "selected" : ""}`}
          onClick={() => {
            setFilter("card");
            setCardPickerOpen((open) => !open);
            setTypePickerOpen(false);
          }}
        >
          <span>{filterCard === "all" ? (ru ? "Карты" : "Cards") : `•••• ${filterCard}`}</span>
          <ChevronDown size={13} />
        </button>
        <button
          className={`tx-chip ${filter === "type" ? "selected" : ""}`}
          onClick={() => {
            setFilter("type");
            setTypePickerOpen((open) => !open);
            setCardPickerOpen(false);
          }}
        >
          <span>
            {filterType === "all"
              ? ru
                ? "Тип"
                : "Type"
              : ((typeLabels[lang] as Record<string, string>)[filterType] ?? filterType)}
          </span>
          <ChevronDown size={13} />
        </button>
        {cardPickerOpen && (
          <div className="tx-picker">
            <button
              className={filterCard === "all" ? "selected" : ""}
              onClick={() => {
                setFilterCard("all");
                setCardPickerOpen(false);
              }}
            >
              {ru ? "Все карты" : "All cards"}
            </button>
            {cards.map((card) => (
              <button
                key={card.id}
                className={filterCard === card.last_four ? "selected" : ""}
                onClick={() => {
                  setFilterCard(card.last_four ?? "all");
                  setCardPickerOpen(false);
                }}
              >
                •••• {card.last_four ?? "—"} · {card.product_name ?? card.product_code ?? ""}
              </button>
            ))}
          </div>
        )}
        {typePickerOpen && (
          <div className="tx-picker">
            <button
              className={filterType === "all" ? "selected" : ""}
              onClick={() => {
                setFilterType("all");
                setTypePickerOpen(false);
              }}
            >
              {ru ? "Все типы" : "All types"}
            </button>
            {typeOptions.map((type) => (
              <button
                key={type}
                className={filterType === type ? "selected" : ""}
                onClick={() => {
                  setFilterType(type);
                  setTypePickerOpen(false);
                }}
              >
                {(typeLabels[lang] as Record<string, string>)[type] ?? type}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && <Loader label={ru ? "Загружаем операции" : "Loading transactions"} />}
      {error && <div className="tx-empty">{ru ? "Не удалось загрузить историю" : "Failed to load history"}</div>}
      {!loading && !error && !transactions.length && (
        <div className="tx-empty">{ru ? "Операций пока нет" : "No transactions yet"}</div>
      )}

      <div className="tx-list">
        {grouped.map(([label, items]) => (
          <div key={label} className="tx-group">
            <h3>{label}</h3>
            {items.map((tx) => {
              const isDeclined = tx.status === "declined" || tx.status === "canceled";
              const isPositive = tx.type === "refund" || tx.type === "topup" || tx.type === "fund";
              const statusText = (statusLabels[lang] as Record<string, string>)[tx.status] ?? tx.status;
              const typeText = (typeLabels[lang] as Record<string, string>)[tx.type] ?? tx.type;
              const card = cardOf(tx);
              return (
                <button
                  className={`tx-row ${isDeclined ? "declined" : ""}`}
                  key={tx.id}
                  onClick={() => setSelectedTx(tx)}
                >
                  <span className={`tx-icon ${isPositive && !isDeclined ? "positive" : ""}`}>
                    {isPositive ? <ArrowDownLeft size={16} /> : <CreditCard size={16} />}
                  </span>
                  <div className="tx-info">
                    <p className="tx-title">
                      {tx.merchant_name ?? typeText}
                      {card?.last_four && <span className="tx-card-tag">· ••{card.last_four}</span>}
                    </p>
                    <p className="tx-meta">
                      {tx.occurred_at
                        ? new Intl.DateTimeFormat(lang === "ru" ? "ru-RU" : "en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          }).format(new Date(tx.occurred_at))
                        : ""}
                      <span className={isDeclined ? "negative" : "positive-status"}>• {statusText}</span>
                    </p>
                    {tx.fee_minor > 0 && (
                      <p className="tx-extra">
                        {ru ? "Комиссия" : "Fee"} {formatAmount(tx.fee_minor, tx.currency, tx.scale, false).slice(2)}
                      </p>
                    )}
                    {isDeclined && tx.decline_code && (
                      <p className="tx-decline">
                        <Info size={12} />{" "}
                        {(declineReasons[lang] as Record<string, string>)[tx.decline_code] ?? tx.decline_code}
                      </p>
                    )}
                  </div>
                  <span
                    className={`tx-amount ${isPositive ? (isDeclined ? "muted" : "positive") : isDeclined ? "muted" : "negative"}`}
                  >
                    {formatAmount(tx.amount_minor, tx.currency, tx.scale, isPositive)}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {selectedTx && (
        <TransactionModal tx={selectedTx} card={cardOf(selectedTx)} ru={ru} onClose={() => setSelectedTx(null)} />
      )}
    </div>
  );
}

function TransactionModal({
  tx,
  card,
  ru,
  onClose,
}: {
  tx: CardTransaction;
  card?: Card;
  ru: boolean;
  onClose: () => void;
}) {
  const isDeclined = tx.status === "declined" || tx.status === "canceled";
  const isPositive = tx.type === "refund" || tx.type === "topup" || tx.type === "fund";
  const statusText = (statusLabels[ru ? "ru" : "en"] as Record<string, string>)[tx.status] ?? tx.status;
  const typeText = (typeLabels[ru ? "ru" : "en"] as Record<string, string>)[tx.type] ?? tx.type;
  return (
    <Modal
      open
      onClose={onClose}
      eyebrow="FLYTOPAY"
      title={tx.merchant_name ?? typeText}
      closeLabel={ru ? "Закрыть" : "Close"}
    >
      <div className="modal-body">
        <div
          className={`tx-modal-amount ${isPositive ? (isDeclined ? "muted" : "positive") : isDeclined ? "muted" : "negative"}`}
        >
          {formatAmount(tx.amount_minor, tx.currency, tx.scale, isPositive)}
        </div>
        <dl className="details-section">
          <div className="detail-row">
            <dt>{ru ? "Статус" : "Status"}</dt>
            <dd>{statusText}</dd>
          </div>
          <div className="detail-row">
            <dt>{ru ? "Тип" : "Type"}</dt>
            <dd>{typeText}</dd>
          </div>
          {card && (
            <div className="detail-row">
              <dt>{ru ? "Карта" : "Card"}</dt>
              <dd>
                •••• {card.last_four ?? "—"} · {card.product_name ?? card.product_code ?? ""}
              </dd>
            </div>
          )}
          {tx.merchant_country && (
            <div className="detail-row">
              <dt>{ru ? "Страна" : "Country"}</dt>
              <dd>{tx.merchant_country}</dd>
            </div>
          )}
          {tx.mcc && (
            <div className="detail-row">
              <dt>MCC</dt>
              <dd>
                {tx.mcc}
                {tx.mcc_description ? ` · ${tx.mcc_description}` : ""}
              </dd>
            </div>
          )}
          {tx.fee_minor > 0 && (
            <div className="detail-row">
              <dt>{ru ? "Комиссия" : "Fee"}</dt>
              <dd>{formatAmount(tx.fee_minor, tx.currency, tx.scale, false).slice(2)}</dd>
            </div>
          )}
          {tx.decline_code && (
            <div className="detail-row">
              <dt>{ru ? "Причина отклонения" : "Decline reason"}</dt>
              <dd>
                {(declineReasons[ru ? "ru" : "en"] as Record<string, string>)[tx.decline_code] ?? tx.decline_code}
              </dd>
            </div>
          )}
          {tx.occurred_at && (
            <div className="detail-row">
              <dt>{ru ? "Дата и время" : "Date & time"}</dt>
              <dd>
                {new Intl.DateTimeFormat(ru ? "ru-RU" : "en-US", {
                  dateStyle: "long",
                  timeStyle: "short",
                }).format(new Date(tx.occurred_at))}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </Modal>
  );
}
