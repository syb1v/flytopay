"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createAdminBroadcast,
  getAdminBroadcastDeliveries,
  getAdminBroadcasts,
  previewAdminBroadcast,
  sendAdminBroadcast,
  updateAdminBroadcast,
  type AdminBroadcast,
  type AdminBroadcastDelivery,
} from "../../lib/api";

const date = (value: string | null) =>
  value ? new Date(value).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" }) : "—";
const statusLabels: Record<string, string> = {
  draft: "Черновик",
  scheduled: "Запланирована",
  queued: "В очереди",
  sending: "Отправляется",
  sent: "Отправлена",
  sent_with_errors: "Отправлена с ошибками",
  pending: "Ожидает",
  failed: "Ошибка",
};

export default function BroadcastsAdmin() {
  const [broadcasts, setBroadcasts] = useState<AdminBroadcast[]>([]);
  const [editing, setEditing] = useState<AdminBroadcast | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", segment: "all", body: "", scheduledAt: "" });
  const [preview, setPreview] = useState<{ recipients: number; body: string } | null>(null);
  const [deliveries, setDeliveries] = useState<AdminBroadcastDelivery[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    getAdminBroadcasts()
      .then(setBroadcasts)
      .catch(() => setBroadcasts([]));
  }, []);
  useEffect(() => load(), [load]);

  const reset = () => {
    setCreating(false);
    setEditing(null);
    setForm({ title: "", segment: "all", body: "", scheduledAt: "" });
  };
  const save = async () => {
    if (!form.title.trim() || !form.body.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const payload = {
        title: form.title.trim(),
        channel: "telegram" as const,
        audience: { segment: form.segment },
        body: form.body,
        scheduled_at: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
      };
      if (editing) await updateAdminBroadcast(editing.id, payload);
      else await createAdminBroadcast(payload);
      reset();
      load();
      setMessage("Рассылка сохранена");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось сохранить рассылку");
    } finally {
      setBusy(false);
    }
  };
  const runPreview = async (item: AdminBroadcast) => {
    setBusy(true);
    try {
      const result = await previewAdminBroadcast(item.id);
      setPreview({ recipients: result.recipients, body: result.body });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось построить preview");
    } finally {
      setBusy(false);
    }
  };
  const runSend = async (item: AdminBroadcast) => {
    if (!window.confirm(`Отправить рассылку «${item.title}» выбранному сегменту?`)) return;
    setBusy(true);
    try {
      const result = await sendAdminBroadcast(item.id);
      setMessage(`В очередь поставлено: ${result.queued}`);
      load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось отправить рассылку");
    } finally {
      setBusy(false);
    }
  };
  const openDeliveries = async (item: AdminBroadcast) => {
    setBusy(true);
    try {
      setDeliveries(await getAdminBroadcastDeliveries(item.id));
    } catch {
      setDeliveries([]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="admin-panel">
      <div className="admin-toolbar">
        <div>
          <h2>Рассылки</h2>
          <p className="settings-muted">Черновики, сегменты, preview и очередь доставки</p>
        </div>
        <button className="ui-button ui-button-primary" onClick={() => setCreating(true)}>
          Создать рассылку
        </button>
      </div>
      {(creating || editing) && (
        <div className="admin-inline-editor">
          <h3>{editing ? `Редактирование: ${editing.title}` : "Новая рассылка"}</h3>
          <label>
            Заголовок
            <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          </label>
          <label>
            Сегмент
            <select value={form.segment} onChange={(event) => setForm({ ...form, segment: event.target.value })}>
              <option value="all">Все пользователи</option>
              <option value="active">Только активные</option>
              <option value="blocked">Только заблокированные</option>
            </select>
          </label>
          <label>
            Текст
            <textarea value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} rows={5} />
          </label>
          <label>
            Запланировать (необязательно)
            <input
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(event) => setForm({ ...form, scheduledAt: event.target.value })}
            />
          </label>
          <div className="admin-dialog-actions">
            <button className="ui-button ui-button-secondary" onClick={reset}>
              Отмена
            </button>
            <button className="ui-button ui-button-primary" disabled={busy} onClick={save}>
              Сохранить
            </button>
          </div>
        </div>
      )}
      {message && <p className="settings-muted">{message}</p>}
      {preview && (
        <div className="admin-inline-editor">
          <h3>Preview</h3>
          <p className="settings-muted">Получателей: {preview.recipients}</p>
          <p>{preview.body}</p>
          <div className="admin-dialog-actions">
            <button className="ui-button ui-button-secondary" onClick={() => setPreview(null)}>
              Закрыть
            </button>
          </div>
        </div>
      )}
      <div className="admin-table">
        <div className="admin-table-head content-row">
          <span>Рассылка</span>
          <span>Сегмент</span>
          <span>Статус</span>
          <span>Доставлено</span>
          <span>Действия</span>
        </div>
        {broadcasts.map((item) => (
          <div className="admin-table-row content-row" key={item.id}>
            <span>
              <b>{item.title}</b>
              <small>{date(item.scheduledAt ?? item.createdAt)}</small>
            </span>
            <span>{item.audience.segment}</span>
            <span>
              <em
                className={`admin-badge ${item.status === "sent" ? "active" : item.status === "queued" ? "pending" : item.status === "sent_with_errors" ? "blocked" : ""}`}
              >
                {statusLabels[item.status] ?? item.status}
              </em>
            </span>
            <span>
              {item.sentCount} отправлено / {item.failedCount} ошибок
            </span>
            <span className="admin-row-actions">
              {(item.status === "draft" || item.status === "scheduled") && (
                <>
                  <button
                    className="ui-button ui-button-secondary"
                    onClick={() => {
                      setEditing(item);
                      setCreating(false);
                      setForm({
                        title: item.title,
                        segment: item.audience.segment,
                        body: item.body,
                        scheduledAt: item.scheduledAt ? item.scheduledAt.slice(0, 16) : "",
                      });
                    }}
                  >
                    Изменить
                  </button>
                  <button className="ui-button ui-button-secondary" disabled={busy} onClick={() => runPreview(item)}>
                    Preview
                  </button>
                  <button className="ui-button ui-button-primary" disabled={busy} onClick={() => runSend(item)}>
                    Отправить
                  </button>
                </>
              )}
              {item.status !== "draft" && item.status !== "scheduled" && (
                <button className="ui-button ui-button-secondary" disabled={busy} onClick={() => openDeliveries(item)}>
                  Доставка
                </button>
              )}
            </span>
          </div>
        ))}
        {broadcasts.length === 0 && <p className="settings-muted">Рассылок пока нет.</p>}
      </div>
      {deliveries && (
        <div className="admin-table">
          <div className="admin-table-head sales-row">
            <span>Пользователь</span>
            <span>Статус</span>
            <span>Ошибка</span>
          </div>
          {deliveries.map((delivery) => (
            <div className="admin-table-row sales-row" key={delivery.id}>
              <span>{delivery.userId.slice(0, 8)}</span>
              <span>{statusLabels[delivery.status] ?? delivery.status}</span>
              <span>{delivery.error ?? "—"}</span>
            </div>
          ))}
          <div className="admin-dialog-actions">
            <button className="ui-button ui-button-secondary" onClick={() => setDeliveries(null)}>
              Закрыть
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
