"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  adminRefundDecision,
  adminResolveCase,
  downloadAdminPaymentsCsv,
  getAdminFinanceSummary,
  getAdminPayments,
  getAdminReconciliation,
  getAdminRefunds,
} from "../../../lib/api";
import type { AdminFinanceSummary, AdminPayment, AdminReconciliationCase, AdminRefund } from "../../../lib/api";
import { ActionDialog, Badge, Button, Empty, Page, Panel, Select, StatGrid, Tabs } from "../../../components/admin/ui";
import { label, paymentStatusLabels, reconciliationStatusLabels, refundStatusLabels } from "../../../lib/adminLabels";

const tabs = [
  { key: "summary", label: "Сводка" },
  { key: "payments", label: "Платежи" },
  { key: "refunds", label: "Возвраты" },
  { key: "reconciliation", label: "Сверки" },
];

const tone = (status: string) =>
  ["succeeded", "completed", "approved", "resolved"].includes(status)
    ? "success"
    : ["failed", "rejected", "closed"].includes(status)
      ? "danger"
      : "warning";

type RefundAction = "approve" | "reject" | "process" | "complete";

const refundLabels: Record<RefundAction, string> = {
  approve: "Одобрить возврат",
  reject: "Отклонить возврат",
  process: "Отправить в обработку",
  complete: "Завершить возврат",
};

export default function AdminFinancePage() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "summary";
  const [summary, setSummary] = useState<AdminFinanceSummary | null>(null);
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [refunds, setRefunds] = useState<AdminRefund[]>([]);
  const [cases, setCases] = useState<AdminReconciliationCase[]>([]);
  const [paymentStatus, setPaymentStatus] = useState("");
  const [days, setDays] = useState(30);
  const [refundAction, setRefundAction] = useState<{ id: string; action: RefundAction } | null>(null);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    getAdminReconciliation("")
      .then(setCases)
      .catch(() => setCases([]));
  }, [days]);
  useEffect(() => load(), [load]);

  const runRefund = async (reason: string) => {
    if (!refundAction || reason.trim().length < 3) return;
    setBusy(true);
    setError(null);
    try {
      await adminRefundDecision(refundAction.id, refundAction.action, reason.trim());
      setMessage("Статус возврата обновлён");
      setRefundAction(null);
      load();
    } catch (reasonValue) {
      setError(reasonValue instanceof Error ? reasonValue.message : "Не удалось обновить возврат");
    } finally {
      setBusy(false);
    }
  };
  const runResolve = async (reason: string) => {
    if (!caseId || reason.trim().length < 3) return;
    setBusy(true);
    setError(null);
    try {
      await adminResolveCase(caseId, reason.trim());
      setMessage("Кейс закрыт");
      setCaseId(null);
      load();
    } catch (reasonValue) {
      setError(reasonValue instanceof Error ? reasonValue.message : "Не удалось закрыть кейс");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page
      title="Платежи и возвраты"
      description="Обороты, возвраты и сверки с провайдерами"
      actions={
        <>
          <Select value={days} onChange={(event) => setDays(Number(event.target.value))}>
            <option value={7}>7 дней</option>
            <option value={30}>30 дней</option>
            <option value={90}>90 дней</option>
            <option value={365}>365 дней</option>
          </Select>
          <Button
            variant="secondary"
            onClick={() => downloadAdminPaymentsCsv(days).catch(() => setError("Не удалось скачать CSV"))}
          >
            Экспорт CSV
          </Button>
        </>
      }
    >
      {message && <p className="adm-page-sub">{message}</p>}
      {error && !refundAction && !caseId && <p className="adm-modal-error">{error}</p>}
      <Tabs base="/admin/finance" tabs={tabs} />
      {tab === "summary" && (
        <Panel title={`Финансовая сводка за ${days} дней`}>
          {summary ? (
            <>
              <StatGrid
                items={[
                  { label: "Оборот", value: `${(summary.grossMinor / 100).toLocaleString("ru-RU")} USD` },
                  { label: "Успешные платежи", value: summary.orders },
                  { label: "Средний чек", value: `${(summary.averageOrderMinor / 100).toLocaleString("ru-RU")} USD` },
                  { label: "Ошибки", value: summary.failedPayments },
                  {
                    label: "Комиссии выпуска",
                    value: `${(summary.knownIssuanceFeesMinor / 100).toLocaleString("ru-RU")} USD`,
                  },
                  { label: "Открытые сверки", value: summary.openReconciliation },
                ]}
              />
              <div className="adm-table">
                <table>
                  <thead>
                    <tr>
                      <th>Группа</th>
                      <th>Платежи</th>
                      <th>Сумма</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.groups.map((group) => (
                      <tr key={group.key}>
                        <td>{group.key}</td>
                        <td>{group.orders}</td>
                        <td>{(group.amountMinor / 100).toLocaleString("ru-RU")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <Empty>Загрузка…</Empty>
          )}
        </Panel>
      )}
      {tab === "payments" && (
        <Panel
          title="Платежи"
          actions={
            <Select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)}>
              <option value="">Все статусы</option>
              <option value="succeeded">Успешные</option>
              <option value="pending">Ожидают</option>
              <option value="failed">Ошибки</option>
            </Select>
          }
        >
          <div className="adm-table">
            <table>
              <thead>
                <tr>
                  <th>Провайдер</th>
                  <th>Назначение</th>
                  <th>Статус</th>
                  <th>Сумма</th>
                  <th>Дата</th>
                </tr>
              </thead>
              <tbody>
                {payments
                  .filter((payment) => !paymentStatus || payment.status === paymentStatus)
                  .map((payment) => (
                    <tr key={payment.id}>
                      <td>
                        {payment.provider}
                        <span className="adm-cell-sub">{payment.id.slice(0, 8)}</span>
                      </td>
                      <td>{payment.purpose}</td>
                      <td>
                        <Badge tone={tone(payment.status)}>{label(paymentStatusLabels, payment.status)}</Badge>
                      </td>
                      <td>
                        {(payment.amountMinor / 100).toLocaleString("ru-RU")} {payment.currency}
                      </td>
                      <td>{new Date(payment.createdAt).toLocaleDateString("ru-RU")}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {payments.length === 0 && <Empty>Платежей пока нет.</Empty>}
          </div>
        </Panel>
      )}
      {tab === "refunds" && (
        <Panel title="Возвраты">
          <div className="adm-table">
            <table>
              <thead>
                <tr>
                  <th>Платёж</th>
                  <th>Сумма</th>
                  <th>Причина</th>
                  <th>Статус</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {refunds.map((refund) => (
                  <tr key={refund.id}>
                    <td>{refund.paymentAttemptId.slice(0, 8)}</td>
                    <td>
                      {(refund.amountMinor / 100).toLocaleString("ru-RU")} {refund.currency}
                    </td>
                    <td>{refund.reason}</td>
                    <td>
                      <Badge tone={tone(refund.status)}>{label(refundStatusLabels, refund.status)}</Badge>
                    </td>
                    <td>
                      <div className="adm-cell-actions">
                        {refund.status === "pending" && (
                          <>
                            <Button
                              variant="primary"
                              onClick={() => setRefundAction({ id: refund.id, action: "approve" })}
                            >
                              Одобрить
                            </Button>
                            <Button
                              variant="danger"
                              onClick={() => setRefundAction({ id: refund.id, action: "reject" })}
                            >
                              Отклонить
                            </Button>
                          </>
                        )}
                        {refund.status === "approved" && (
                          <Button
                            variant="secondary"
                            onClick={() => setRefundAction({ id: refund.id, action: "process" })}
                          >
                            В обработку
                          </Button>
                        )}
                        {refund.status === "processing" && (
                          <Button
                            variant="primary"
                            onClick={() => setRefundAction({ id: refund.id, action: "complete" })}
                          >
                            Завершить
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {refunds.length === 0 && <Empty>Возвратов пока нет.</Empty>}
          </div>
        </Panel>
      )}
      {tab === "reconciliation" && (
        <Panel title="Сверки">
          <div className="adm-table">
            <table>
              <thead>
                <tr>
                  <th>Платёж</th>
                  <th>Тип</th>
                  <th>Причина</th>
                  <th>Статус</th>
                  <th>Действие</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((item) => (
                  <tr key={item.id}>
                    <td>{item.paymentAttemptId.slice(0, 8)}</td>
                    <td>{item.type}</td>
                    <td>{item.reason}</td>
                    <td>
                      <Badge tone={tone(item.status)}>{label(reconciliationStatusLabels, item.status)}</Badge>
                    </td>
                    <td>
                      {item.status === "open" && (
                        <Button variant="secondary" onClick={() => setCaseId(item.id)}>
                          Закрыть кейс
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {cases.length === 0 && <Empty>Открытых сверок нет.</Empty>}
          </div>
        </Panel>
      )}
      <ActionDialog
        open={refundAction !== null}
        title={refundAction ? refundLabels[refundAction.action] : ""}
        description="Решение фиксируется в журнале аудита."
        fields={[{ name: "reason", label: "Причина", type: "textarea", required: true }]}
        confirmLabel="Подтвердить"
        danger={refundAction?.action === "reject"}
        busy={busy}
        error={error}
        onCancel={() => setRefundAction(null)}
        onConfirm={(values) => runRefund(values.reason ?? "")}
      />
      <ActionDialog
        open={caseId !== null}
        title="Закрыть кейс сверки"
        fields={[{ name: "reason", label: "Причина", type: "textarea", required: true }]}
        confirmLabel="Закрыть"
        busy={busy}
        error={error}
        onCancel={() => setCaseId(null)}
        onConfirm={(values) => runResolve(values.reason ?? "")}
      />
    </Page>
  );
}
