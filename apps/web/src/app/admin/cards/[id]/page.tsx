"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { adminCardAction, getAdminCard } from "../../../../lib/api";
import type { AdminCardDetail } from "../../../../lib/api";
import { ActionDialog, Badge, Button, Empty, Page, Panel, StatGrid } from "../../../../components/admin/ui";

type CardAction = "freeze" | "unfreeze" | "fund" | "unload" | "close";

const actionLabels: Record<CardAction, string> = {
  freeze: "Заморозить карту",
  unfreeze: "Разморозить карту",
  fund: "Пополнить карту",
  unload: "Выгрузить с карты",
  close: "Закрыть карту",
};
const needsAmount = (action: CardAction) => action === "fund" || action === "unload";

export default function AdminCardDetailPage() {
  const params = useParams<{ id: string }>();
  const cardId = params.id;
  const [card, setCard] = useState<AdminCardDetail | null>(null);
  const [action, setAction] = useState<CardAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!cardId) return;
    getAdminCard(cardId)
      .then(setCard)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Не удалось загрузить карту"));
  }, [cardId]);
  useEffect(() => load(), [load]);

  const run = async (values: Record<string, string>) => {
    if (!action || (values.reason ?? "").trim().length < 3) return;
    setBusy(true);
    setError(null);
    try {
      const amount = needsAmount(action) ? Number(values.amount) : undefined;
      if (needsAmount(action) && !amount) {
        setError("Укажите сумму в minor units");
        return;
      }
      const result = (await adminCardAction(cardId, action, (values.reason ?? "").trim(), amount)) as {
        operationStatus?: string;
      };
      setMessage(`Операция отправлена: ${result?.operationStatus ?? "processing"}`);
      setAction(null);
      load();
    } catch (reasonValue) {
      setError(reasonValue instanceof Error ? reasonValue.message : "Операция не выполнена");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page
      title={card ? `${card.productName ?? card.productCode ?? "Карта"} ····${card.lastFour ?? "****"}` : "Карта"}
      description={card ? `${card.isDemo ? "demo" : "real"} · ${card.currency} · UUID ${card.cardId}` : undefined}
      backHref="/admin/cards"
      backLabel="Все карты"
      actions={
        card && (
          <>
            <Button variant="secondary" onClick={() => setAction("freeze")}>
              Заморозить
            </Button>
            <Button variant="secondary" onClick={() => setAction("unfreeze")}>
              Разморозить
            </Button>
            <Button variant="secondary" onClick={() => setAction("fund")}>
              Пополнить
            </Button>
            <Button variant="secondary" onClick={() => setAction("unload")}>
              Выгрузить
            </Button>
            <Button variant="danger" onClick={() => setAction("close")}>
              Закрыть
            </Button>
          </>
        )
      }
    >
      {message && <p className="adm-page-sub">{message}</p>}
      {error && !action && <p className="adm-modal-error">{error}</p>}
      {!card && !error && <Empty>Загрузка…</Empty>}
      {card && (
        <>
          <StatGrid
            items={[
              {
                label: "Статус",
                value: <Badge tone={card.status === "active" ? "success" : "neutral"}>{card.status}</Badge>,
              },
              {
                label: "Баланс",
                value:
                  card.balanceMinor === null
                    ? "—"
                    : `${(card.balanceMinor / 100).toLocaleString("ru-RU")} ${card.currency}`,
              },
              {
                label: "Пользователь",
                value: card.telegramId ?? card.userId.slice(0, 8),
                hint: `Статус: ${card.userStatus ?? "—"}`,
              },
              { label: "Аренды", value: card.rentals.length },
              { label: "Транзакции", value: card.transactions.length },
              { label: "Операции", value: card.operations.length },
            ]}
          />
          <Panel title="Аренды">
            <div className="adm-table">
              <table>
                <thead>
                  <tr>
                    <th>Аренда</th>
                    <th>Статус</th>
                    <th>Срок</th>
                    <th>Истекает</th>
                    <th>Цена</th>
                  </tr>
                </thead>
                <tbody>
                  {card.rentals.map((rental) => (
                    <tr key={rental.id}>
                      <td>{rental.id.slice(0, 8)}</td>
                      <td>
                        <Badge tone={rental.status === "active" ? "success" : "neutral"}>{rental.status}</Badge>
                      </td>
                      <td>{rental.termDays} дней</td>
                      <td>{rental.expiresAt ? new Date(rental.expiresAt).toLocaleDateString("ru-RU") : "—"}</td>
                      <td>
                        {(rental.priceMinor / 100).toLocaleString("ru-RU")} {rental.currency}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {card.rentals.length === 0 && <Empty>Аренд нет.</Empty>}
            </div>
          </Panel>
          <Panel title="Транзакции">
            <div className="adm-table">
              <table>
                <thead>
                  <tr>
                    <th>Тип</th>
                    <th>Статус</th>
                    <th>Сумма</th>
                    <th>Мерчант</th>
                    <th>Дата</th>
                  </tr>
                </thead>
                <tbody>
                  {card.transactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td>{transaction.type}</td>
                      <td>
                        <Badge tone={transaction.status === "completed" ? "success" : "danger"}>
                          {transaction.status}
                        </Badge>
                      </td>
                      <td>
                        {(transaction.amountMinor / 100).toLocaleString("ru-RU")} {transaction.currency}
                      </td>
                      <td>{transaction.merchantName ?? "—"}</td>
                      <td>{new Date(transaction.occurredAt).toLocaleString("ru-RU")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {card.transactions.length === 0 && <Empty>Транзакций нет.</Empty>}
            </div>
          </Panel>
          <Panel title="Операции CaaS">
            <div className="adm-table">
              <table>
                <thead>
                  <tr>
                    <th>Операция</th>
                    <th>Статус</th>
                    <th>Заказ</th>
                    <th>Ошибка</th>
                    <th>Дата</th>
                  </tr>
                </thead>
                <tbody>
                  {card.operations.map((operation) => (
                    <tr key={operation.id}>
                      <td>{operation.kind}</td>
                      <td>
                        <Badge tone={operation.status === "completed" ? "success" : "warning"}>
                          {operation.status}
                        </Badge>
                      </td>
                      <td>{operation.providerOrderId ?? "—"}</td>
                      <td>{operation.error ?? "—"}</td>
                      <td>{new Date(operation.createdAt).toLocaleString("ru-RU")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {card.operations.length === 0 && <Empty>Операций нет.</Empty>}
            </div>
          </Panel>
        </>
      )}
      <ActionDialog
        open={action !== null}
        title={action ? actionLabels[action] : ""}
        description="Операция асинхронная: результат появится в списке операций CaaS."
        fields={[
          ...(action && needsAmount(action)
            ? [
                {
                  name: "amount",
                  label: "Сумма в minor units",
                  type: "number" as const,
                  required: true,
                  placeholder: "1000",
                },
              ]
            : []),
          {
            name: "reason",
            label: "Причина",
            type: "textarea" as const,
            required: true,
            placeholder: "Минимум 3 символа",
          },
        ]}
        confirmLabel="Отправить"
        danger={action === "close"}
        busy={busy}
        error={error}
        onCancel={() => setAction(null)}
        onConfirm={run}
      />
    </Page>
  );
}
