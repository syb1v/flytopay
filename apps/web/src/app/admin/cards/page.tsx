"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  getAdminCaasOperations,
  getAdminCards,
  getAdminCardsOverview,
  getAdminIssuances,
  getAdminRentals,
  getAdminTransactions,
} from "../../../lib/api";
import type {
  AdminCaasOperation,
  AdminCard,
  AdminCardOverview,
  AdminIssuance,
  AdminRental,
  AdminTransaction,
} from "../../../lib/api";
import { Badge, Empty, Page, Pager, Panel, Select, StatGrid, Tabs, TextInput } from "../../../components/admin/ui";

const statusLabels: Record<string, string> = {
  active: "Активна",
  frozen: "Заморожена",
  closed: "Закрыта",
  closing: "Закрывается",
  issuing: "Выпускается",
  completed: "Завершена",
  processing: "В обработке",
  failed: "Ошибка",
  succeeded: "Успешно",
  quoted: "Квота",
  paid: "Оплачена",
  issued: "Выпущена",
  pending: "Ожидает",
};

const tabs = [
  { key: "cards", label: "Карты" },
  { key: "issuances", label: "Выдача" },
  { key: "rentals", label: "Аренды" },
  { key: "transactions", label: "Транзакции" },
  { key: "operations", label: "Операции CaaS" },
];

const tone = (status: string) =>
  ["active", "issued", "paid", "completed", "succeeded"].includes(status)
    ? "success"
    : ["failed", "closed"].includes(status)
      ? "danger"
      : "warning";

export default function AdminCardsPage() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "cards";
  const [overview, setOverview] = useState<AdminCardOverview | null>(null);
  const [cards, setCards] = useState<AdminCard[]>([]);
  const [cardsTotal, setCardsTotal] = useState(0);
  const [cardPage, setCardPage] = useState(1);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [issuances, setIssuances] = useState<AdminIssuance[]>([]);
  const [rentals, setRentals] = useState<AdminRental[]>([]);
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [operations, setOperations] = useState<AdminCaasOperation[]>([]);

  const load = useCallback(() => {
    if (tab === "cards")
      getAdminCards({ q: query, status, page: cardPage })
        .then((page) => {
          setCards(page.items);
          setCardsTotal(page.total);
        })
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
  }, [tab, query, status, cardPage]);

  useEffect(() => {
    getAdminCardsOverview()
      .then(setOverview)
      .catch(() => setOverview(null));
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(load, 200);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <Page title="Карты" description="Выпуск, аренды, транзакции и операции провайдера">
      {overview && (
        <StatGrid
          items={[
            { label: "Всего карт", value: overview.total },
            { label: "Активные", value: overview.active },
            { label: "Замороженные", value: overview.frozen },
            { label: "Закрытые", value: overview.closed },
            { label: "Demo", value: overview.demo },
            { label: "Операции в обработке", value: overview.pendingOperations },
            { label: "Ошибки операций", value: overview.failedOperations },
          ]}
        />
      )}
      <Tabs base="/admin/cards" tabs={tabs} />
      <Panel>
        {tab === "cards" && (
          <>
            <div className="adm-form-grid">
              <TextInput
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setCardPage(1);
                }}
                placeholder="UUID карты, Telegram ID или последние 4 цифры"
              />
              <Select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setCardPage(1);
                }}
              >
                <option value="">Все статусы</option>
                <option value="active">Активные</option>
                <option value="frozen">Замороженные</option>
                <option value="closing">Закрываются</option>
                <option value="closed">Закрытые</option>
                <option value="issuing">Выпускаются</option>
              </Select>
            </div>
            <div className="adm-table">
              <table>
                <thead>
                  <tr>
                    <th>Карта</th>
                    <th>Владелец</th>
                    <th>Статус</th>
                    <th>Баланс</th>
                    <th>Создана</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {cards.map((card) => (
                    <tr key={card.cardId}>
                      <td>
                        <Link className="adm-link" href={`/admin/cards/${card.cardId}`}>
                          {card.productName ?? card.productCode ?? "Карта"} ····{card.lastFour ?? "****"}
                        </Link>
                        <span className="adm-cell-sub">{card.cardId}</span>
                      </td>
                      <td>{card.telegramId ?? card.userId.slice(0, 8)}</td>
                      <td>
                        <Badge tone={tone(card.status)}>{statusLabels[card.status] ?? card.status}</Badge>
                      </td>
                      <td>
                        {card.balanceMinor === null
                          ? "—"
                          : `${(card.balanceMinor / 100).toLocaleString("ru-RU")} ${card.currency}`}
                      </td>
                      <td>{new Date(card.createdAt).toLocaleDateString("ru-RU")}</td>
                      <td>
                        <Link className="adm-link" href={`/admin/cards/${card.cardId}`}>
                          Открыть →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {cards.length === 0 && <Empty>Карты не найдены.</Empty>}
            </div>
            <Pager page={cardPage} total={cardsTotal} limit={20} onPage={setCardPage} />
          </>
        )}
        {tab === "issuances" && (
          <div className="adm-table">
            <table>
              <thead>
                <tr>
                  <th>Заявка</th>
                  <th>Пользователь</th>
                  <th>Продукт</th>
                  <th>Статус</th>
                  <th>Сумма</th>
                  <th>Дата</th>
                </tr>
              </thead>
              <tbody>
                {issuances.map((item) => (
                  <tr key={item.issuanceId}>
                    <td>
                      {item.issuanceId.slice(0, 8)}
                      <span className="adm-cell-sub">{item.providerOrderId ?? "—"}</span>
                    </td>
                    <td>{item.telegramId ?? item.userId.slice(0, 8)}</td>
                    <td>
                      {item.productCode}
                      <span className="adm-cell-sub">{item.termDays} дней</span>
                    </td>
                    <td>
                      <Badge tone={tone(item.status)}>{statusLabels[item.status] ?? item.status}</Badge>
                    </td>
                    <td>
                      {((item.totalChargeMinor ?? item.amountMinor) / 100).toLocaleString("ru-RU")} {item.currency}
                    </td>
                    <td>{new Date(item.createdAt).toLocaleDateString("ru-RU")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {issuances.length === 0 && <Empty>Заявок пока нет.</Empty>}
          </div>
        )}
        {tab === "rentals" && (
          <div className="adm-table">
            <table>
              <thead>
                <tr>
                  <th>Аренда</th>
                  <th>Пользователь</th>
                  <th>Карта</th>
                  <th>Статус</th>
                  <th>Истекает</th>
                  <th>Цена</th>
                </tr>
              </thead>
              <tbody>
                {rentals.map((rental) => (
                  <tr key={rental.id}>
                    <td>
                      {rental.id.slice(0, 8)}
                      <span className="adm-cell-sub">{rental.termDays} дней</span>
                    </td>
                    <td>{rental.telegramId ?? rental.userId.slice(0, 8)}</td>
                    <td>{rental.cardId.slice(0, 8)}</td>
                    <td>
                      <Badge tone={rental.status === "active" ? "success" : "neutral"}>{rental.status}</Badge>
                    </td>
                    <td>{rental.expiresAt ? new Date(rental.expiresAt).toLocaleDateString("ru-RU") : "—"}</td>
                    <td>
                      {(rental.priceMinor / 100).toLocaleString("ru-RU")} {rental.currency}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rentals.length === 0 && <Empty>Аренд пока нет.</Empty>}
          </div>
        )}
        {tab === "transactions" && (
          <div className="adm-table">
            <table>
              <thead>
                <tr>
                  <th>Тип</th>
                  <th>Карта</th>
                  <th>Статус</th>
                  <th>Сумма</th>
                  <th>Мерчант</th>
                  <th>Дата</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>
                      {transaction.type}
                      <span className="adm-cell-sub">{transaction.declineCode ?? ""}</span>
                    </td>
                    <td>{transaction.cardId.slice(0, 8)}</td>
                    <td>
                      <Badge tone={transaction.status === "completed" ? "success" : "danger"}>
                        {transaction.status}
                      </Badge>
                    </td>
                    <td>
                      {(transaction.amountMinor / 100).toLocaleString("ru-RU")} {transaction.currency}
                    </td>
                    <td>{transaction.merchantName ?? "—"}</td>
                    <td>{new Date(transaction.occurredAt).toLocaleDateString("ru-RU")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {transactions.length === 0 && <Empty>Транзакций пока нет.</Empty>}
          </div>
        )}
        {tab === "operations" && (
          <div className="adm-table">
            <table>
              <thead>
                <tr>
                  <th>Операция</th>
                  <th>Заказ провайдера</th>
                  <th>Статус</th>
                  <th>Ошибка</th>
                  <th>Дата</th>
                </tr>
              </thead>
              <tbody>
                {operations.map((operation) => (
                  <tr key={operation.id}>
                    <td>{operation.kind}</td>
                    <td>{operation.providerOrderId ?? "—"}</td>
                    <td>
                      <Badge tone={operation.status === "completed" ? "success" : "warning"}>{operation.status}</Badge>
                    </td>
                    <td>{operation.error ?? "—"}</td>
                    <td>{new Date(operation.createdAt).toLocaleString("ru-RU")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {operations.length === 0 && <Empty>Операций пока нет.</Empty>}
          </div>
        )}
      </Panel>
    </Page>
  );
}
