"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  createAdminBroadcast,
  getAdminBroadcast,
  getAdminBroadcastDeliveries,
  previewAdminBroadcast,
  sendAdminBroadcast,
  updateAdminBroadcast,
} from "../../../../lib/api";
import type { AdminBroadcastDelivery } from "../../../../lib/api";
import { broadcastStatusLabels, label } from "../../../../lib/adminLabels";
import {
  ActionDialog,
  Badge,
  Button,
  Empty,
  Field,
  Page,
  Panel,
  Select,
  StatGrid,
  TextArea,
  TextInput,
} from "../../../../components/admin/ui";

export default function AdminBroadcastEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const broadcastId = params.id;
  const isNew = broadcastId === "new";
  const [title, setTitle] = useState("");
  const [segment, setSegment] = useState("all");
  const [body, setBody] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [status, setStatus] = useState("draft");
  const [preview, setPreview] = useState<{ recipients: number; body: string } | null>(null);
  const [deliveries, setDeliveries] = useState<AdminBroadcastDelivery[] | null>(null);
  const [confirmSend, setConfirmSend] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (isNew || !broadcastId) return;
    getAdminBroadcast(broadcastId)
      .then((broadcast) => {
        setTitle(broadcast.title);
        setSegment(broadcast.audience.segment);
        setBody(broadcast.body);
        setScheduledAt(broadcast.scheduledAt ? broadcast.scheduledAt.slice(0, 16) : "");
        setStatus(broadcast.status);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Не удалось загрузить рассылку"));
  }, [broadcastId, isNew]);
  useEffect(() => load(), [load]);

  const save = async () => {
    if (!title.trim() || !body.trim()) {
      setError("Заполните заголовок и текст");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = {
        title: title.trim(),
        channel: "telegram" as const,
        audience: { segment },
        body,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      };
      if (isNew) {
        await createAdminBroadcast(payload);
        router.push("/admin/broadcasts");
        return;
      }
      await updateAdminBroadcast(broadcastId, payload);
      setMessage("Рассылка сохранена");
      load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить рассылку");
    } finally {
      setBusy(false);
    }
  };
  const runPreview = async () => {
    if (isNew) {
      setError("Сохраните рассылку перед предпросмотром");
      return;
    }
    setBusy(true);
    try {
      const result = await previewAdminBroadcast(broadcastId);
      setPreview({ recipients: result.recipients, body: result.body });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось построить предпросмотр");
    } finally {
      setBusy(false);
    }
  };
  const runSend = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await sendAdminBroadcast(broadcastId);
      setConfirmSend(false);
      setMessage(`В очередь поставлено: ${result.queued}`);
      load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось отправить рассылку");
    } finally {
      setBusy(false);
    }
  };
  const loadDeliveries = async () => {
    setBusy(true);
    try {
      setDeliveries(await getAdminBroadcastDeliveries(broadcastId));
    } catch {
      setDeliveries([]);
    } finally {
      setBusy(false);
    }
  };

  const editable = isNew || status === "draft" || status === "scheduled";

  return (
    <Page
      title={isNew ? "Новая рассылка" : title || "Рассылка"}
      description={
        isNew
          ? "Сегмент all/active/blocked отправляется через Telegram"
          : `Статус: ${label(broadcastStatusLabels, status)}`
      }
      backHref="/admin/broadcasts"
      backLabel="Рассылки"
      actions={
        !isNew && (
          <>
            <Button variant="secondary" busy={busy} onClick={runPreview}>
              Предпросмотр
            </Button>
            {editable && (
              <Button variant="primary" onClick={() => setConfirmSend(true)}>
                Отправить
              </Button>
            )}
            {status !== "draft" && status !== "scheduled" && (
              <Button variant="secondary" busy={busy} onClick={loadDeliveries}>
                История доставки
              </Button>
            )}
          </>
        )
      }
    >
      {error && <p className="adm-modal-error">{error}</p>}
      {message && <p className="adm-page-sub">{message}</p>}
      <Panel title="Содержание">
        <div className="adm-form-grid">
          <Field label="Заголовок">
            <TextInput value={title} onChange={(event) => setTitle(event.target.value)} disabled={!editable} />
          </Field>
          <Field label="Сегмент">
            <Select value={segment} onChange={(event) => setSegment(event.target.value)} disabled={!editable}>
              <option value="all">Все пользователи</option>
              <option value="active">Только активные</option>
              <option value="blocked">Только заблокированные</option>
            </Select>
          </Field>
          <Field label="Запланировать (необязательно)">
            <TextInput
              type="datetime-local"
              value={scheduledAt}
              onChange={(event) => setScheduledAt(event.target.value)}
              disabled={!editable}
            />
          </Field>
        </div>
        <div style={{ marginTop: 14 }}>
          <Field label="Текст">
            <TextArea value={body} onChange={(event) => setBody(event.target.value)} rows={10} disabled={!editable} />
          </Field>
        </div>
        {editable && (
          <div className="adm-panel-actions" style={{ marginTop: 16 }}>
            <Button variant="primary" busy={busy} onClick={save}>
              {isNew ? "Создать рассылку" : "Сохранить"}
            </Button>
          </div>
        )}
      </Panel>
      {preview && (
        <Panel title="Предпросмотр" actions={<Badge tone="info">Получателей: {preview.recipients}</Badge>}>
          <p style={{ whiteSpace: "pre-wrap" }}>{preview.body}</p>
          <div className="adm-panel-actions" style={{ marginTop: 12 }}>
            <Button variant="secondary" onClick={() => setPreview(null)}>
              Закрыть
            </Button>
          </div>
        </Panel>
      )}
      {deliveries && (
        <Panel title="История доставки">
          <div className="adm-table">
            <table>
              <thead>
                <tr>
                  <th>Пользователь</th>
                  <th>Статус</th>
                  <th>Ошибка</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((delivery) => (
                  <tr key={delivery.id}>
                    <td>{delivery.userId.slice(0, 8)}</td>
                    <td>
                      <Badge tone={delivery.status === "sent" ? "success" : "danger"}>
                        {label(broadcastStatusLabels, delivery.status)}
                      </Badge>
                    </td>
                    <td>{delivery.error ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {deliveries.length === 0 && <Empty>Доставок нет.</Empty>}
          </div>
        </Panel>
      )}
      <ActionDialog
        open={confirmSend}
        title="Отправить рассылку"
        description="Сообщение уйдёт выбранному сегменту через Telegram. Действие подтверждается причиной и фиксируется в аудите."
        fields={[{ name: "reason", label: "Причина", type: "textarea", required: true }]}
        confirmLabel="Отправить"
        busy={busy}
        error={error}
        onCancel={() => setConfirmSend(false)}
        onConfirm={runSend}
      />
    </Page>
  );
}
