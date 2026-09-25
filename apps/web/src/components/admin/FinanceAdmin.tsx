"use client";

import { useCallback, useEffect, useState } from "react";
import {
  adminRefundDecision,
  adminResolveCase,
  downloadAdminPaymentsCsv,
  getAdminFinanceSummary,
  getAdminPayments,
  getAdminReconciliation,
  getAdminRefunds,
  type AdminFinanceSummary,
  type AdminPayment,
  type AdminReconciliationCase,
  type AdminRefund,
} from "../../lib/api";

const date = (value: string | null) =>
  value ? new Date(value).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" }) : "—";
const money = (value: number, currency: string) => `${(value / 100).toLocaleString("ru-RU")} ${currency}`;
const statusLabels: Record<string, string> = {
  succeeded: "Успешно",
  failed: "Ошибка",
  pending: "Ожидает",
  approved: "Одобрен",
  rejected: "Отклонён",
  processing: "В обработке",
  completed: "Завершён",
  open: "Открыт",
  resolved: "Решён",
};

export default function FinanceAdmin() {
  const [summary, setSummary] = useState<AdminFinanceSummary | null>(null);
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [refunds, setRefunds] = useState<AdminRefund[]>([]);
  const [cases, setCases] = useState<AdminReconciliationCase[]>([]);
  const [paymentStatus, setPaymentStatus] = useState("");
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    getAdminFinanceSummary(days)
      .then(setSummary)
      .catch(() => setSummary(null));
    getAdminPayments()
      .then(setPayments)
      .catch(() => setPayments([]));
    getAdminRefunds()
      .then(setRefunds)
      .catch(() => setRefunds([]));
    getAdminReconciliation("open")
      .then(setCases)
      .catch(() => setCases([]));
  }, [days]);

  useEffect(() => load(), [load]);

  const refundAction = async (id: string, action: "approve" | "reject" | "process" | "complete") => {
    const reason = window.prompt("Причина действия (минимум 3 символа)");
    if (!reason || reason.trim().length < 3) return;
    setBusy(true);
    try {
      await adminRefundDecision(id, action, reason.trim());
      setMessage("Статус возврата обновлён");
      load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось изменить возврат");
    } finally {
      setBusy(false);
    }
  };
  const resolveCase = async (id: string) => {
    const reason = window.prompt("Причина закрытия кейса (минимум 3 символа)");
    if (!reason || reason.trim().length < 3) return;
    setBusy(true);
    try {
      await adminResolveCase(id, reason.trim());
      setMessage("Кейс закрыт");
      load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось закрыть кейс");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="admin-panel">
        <div className="admin-toolbar">
          <div>
            <h2>Финансовая сводка</h2>
            <p className="settings-muted">Реальные данные по платежам за период</p>
          </div>
          <div className="admin-toolbar-actions">
            <select value={days} onChange={(event) => setDays(Number(event.target.value))}>
              <option value={7}>7 дней</option>
              <option value={30}>30 дней</option>
              <option value={90}>90 дней</option>
              <option value={365}>365 дней</option>
            </select>
            <button
              className="ui-button ui-button-secondary"
              disabled={busy}
              onClick={() => downloadAdminPaymentsCsv(days).catch(() => setMessage("Не удалось скачать CSV"))}
            >
              Скачать CSV
            </button>
          </div>
        </div>
        {summary && (
          <div className="admin-stat-grid admin-stat-grid-small">
            <article>
              <span>Оборот</span>
              <strong>{(summary.grossMinor / 100).toLocaleString("ru-RU")}</strong>
            </article>
            <article>
              <span>Успешные платежи</span>
              <strong>{summary.orders}</strong>
            </article>
            <article>
              <span>Средний чек</span>
              <strong>{(summary.averageOrderMinor / 100).toLocaleString("ru-RU")}</strong>
            </article>
            <article>
              <span>Ошибки платежей</span>
              <strong>{summary.failedPayments}</strong>
            </article>
            <article>
              <span>Известные комиссии выпуска</span>
              <strong>{(summary.knownIssuanceFeesMinor / 100).toLocaleString("ru-RU")}</strong>
            </article>
            <article>
              <span>Открытые сверки</span>
              <strong>{summary.openReconciliation}</strong>
            </article>
          </div>
        )}
        {summary && summary.groups.length > 0 && (
          <div className="admin-table">
            <div className="admin-table-head sales-row">
              <span>Группа</span>
              <span>Платежи</span>
              <span>Сумма</span>
            </div>
            {summary.groups.map((group) => (
              <div className="admin-table-row sales-row" key={group.key}>
                <span>{group.key}</span>
                <span>{group.orders}</span>
                <span>{(group.amountMinor / 100).toLocaleString("ru-RU")}</span>
              </div>
            ))}
          </div>
        )}
      </section>
      {message && <p className="settings-muted">{message}</p>}
      <section className="admin-panel">
        <div className="admin-toolbar">
          <h2>Платежи</h2>
          <select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)}>
            <option value="">Все статусы</option>
            <option value="succeeded">Успешные</option>
            <option value="pending">Ожидают</option>
            <option value="failed">Ошибки</option>
          </select>
        </div>
        <div className="admin-table">
          <div className="admin-table-head">
            <span>Провайдер</span>
            <span>Назначение</span>
            <span>Статус</span>
            <span>Сумма</span>
            <span>Дата</span>
          </div>
          {payments
            .filter((payment) => !paymentStatus || payment.status === paymentStatus)
            .map((payment) => (
              <div className="admin-table-row" key={payment.id}>
                <span>
                  <b>{payment.provider}</b>
                  <small>{payment.id.slice(0, 8)}</small>
                </span>
                <span>{payment.purpose}</span>
                <span>
                  <em className={`admin-badge ${payment.status === "succeeded" ? "active" : "blocked"}`}>
                    {statusLabels[payment.status] ?? payment.status}
                  </em>
                </span>
                <span>{money(payment.amountMinor, payment.currency)}</span>
                <span>{date(payment.createdAt)}</span>
              </div>
            ))}
        </div>
      </section>
      <section className="admin-panel">
        <h2>Возвраты</h2>
        <div className="admin-table">
          <div className="admin-table-head content-row">
            <span>Платёж</span>
            <span>Сумма</span>
            <span>Причина</span>
            <span>Статус</span>
            <span>Действия</span>
          </div>
          {refunds.map((refund) => (
            <div className="admin-table-row content-row" key={refund.id}>
              <span>{refund.paymentAttemptId.slice(0, 8)}</span>
              <span>{money(refund.amountMinor, refund.currency)}</span>
              <span>{refund.reason}</span>
              <span>
                <em
                  className={`admin-badge ${refund.status === "completed" ? "active" : refund.status === "rejected" ? "blocked" : "pending"}`}
                >
                  {statusLabels[refund.status] ?? refund.status}
                </em>
              </span>
              <span className="admin-row-actions">
                {refund.status === "pending" && (
                  <>
                    <button
                      className="ui-button ui-button-primary"
                      disabled={busy}
                      onClick={() => refundAction(refund.id, "approve")}
                    >
                      Одобрить
                    </button>
                    <button
                      className="ui-button ui-button-danger"
                      disabled={busy}
                      onClick={() => refundAction(refund.id, "reject")}
                    >
                      Отклонить
                    </button>
                  </>
                )}
                {refund.status === "approved" && (
                  <button
                    className="ui-button ui-button-secondary"
                    disabled={busy}
                    onClick={() => refundAction(refund.id, "process")}
                  >
                    В обработку
                  </button>
                )}
                {refund.status === "processing" && (
                  <button
                    className="ui-button ui-button-primary"
                    disabled={busy}
                    onClick={() => refundAction(refund.id, "complete")}
                  >
                    Завершить
                  </button>
                )}
              </span>
            </div>
          ))}
          {refunds.length === 0 && <p className="settings-muted">Возвратов пока нет.</p>}
        </div>
      </section>
      <section className="admin-panel">
        <h2>Открытые сверки</h2>
        <div className="admin-table">
          <div className="admin-table-head content-row">
            <span>Платёж</span>
            <span>Тип</span>
            <span>Причина</span>
            <span>Статус</span>
            <span>Действие</span>
          </div>
          {cases.map((item) => (
            <div className="admin-table-row content-row" key={item.id}>
              <span>{item.paymentAttemptId.slice(0, 8)}</span>
              <span>{item.type}</span>
              <span>{item.reason}</span>
              <span>
                <em className={`admin-badge ${item.status === "open" ? "pending" : "active"}`}>
                  {statusLabels[item.status] ?? item.status}
                </em>
              </span>
              <span className="admin-row-actions">
                <button className="ui-button ui-button-secondary" disabled={busy} onClick={() => resolveCase(item.id)}>
                  Закрыть кейс
                </button>
              </span>
            </div>
          ))}
          {cases.length === 0 && <p className="settings-muted">Открытых сверок нет.</p>}
        </div>
      </section>
    </>
  );
}
