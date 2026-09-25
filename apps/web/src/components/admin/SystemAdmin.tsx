"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getAdminErrors,
  getAdminFeatureFlags,
  getAdminMaintenance,
  getAdminSettings,
  getAdminSystemHealth,
  getAdminWebhooks,
  requeueAdminWebhook,
  updateAdminMaintenance,
  upsertAdminFeatureFlag,
  upsertAdminSetting,
  type AdminErrorEvent,
  type AdminFeatureFlag,
  type AdminSystemHealth,
  type AdminSystemSetting,
  type AdminWebhookEvent,
} from "../../lib/api";

const date = (value: string) => new Date(value).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" });

type Tab = "health" | "flags" | "settings" | "errors" | "webhooks" | "maintenance";

export default function SystemAdmin() {
  const [tab, setTab] = useState<Tab>("health");
  const [health, setHealth] = useState<AdminSystemHealth | null>(null);
  const [flags, setFlags] = useState<AdminFeatureFlag[]>([]);
  const [settings, setSettings] = useState<AdminSystemSetting[]>([]);
  const [errors, setErrors] = useState<AdminErrorEvent[]>([]);
  const [webhooks, setWebhooks] = useState<AdminWebhookEvent[]>([]);
  const [maintenance, setMaintenance] = useState<{ enabled: boolean; message: string | null } | null>(null);
  const [maintenanceMessage, setMaintenanceMessage] = useState("Технические работы");
  const [newFlag, setNewFlag] = useState({ key: "", enabled: false });
  const [newSetting, setNewSetting] = useState({ key: "", value: "{}" });
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    getAdminSystemHealth()
      .then(setHealth)
      .catch(() => setHealth(null));
    getAdminFeatureFlags()
      .then(setFlags)
      .catch(() => setFlags([]));
    getAdminSettings()
      .then(setSettings)
      .catch(() => setSettings([]));
    getAdminErrors()
      .then((page) => setErrors(page.items))
      .catch(() => setErrors([]));
    getAdminWebhooks()
      .then((page) => setWebhooks(page.items))
      .catch(() => setWebhooks([]));
    getAdminMaintenance()
      .then((state) => {
        setMaintenance(state);
        if (state.message) setMaintenanceMessage(state.message);
      })
      .catch(() => setMaintenance(null));
  }, []);
  useEffect(() => load(), [load]);

  const toggleFlag = async (flag: AdminFeatureFlag) => {
    setBusy(true);
    try {
      await upsertAdminFeatureFlag(flag.key, {
        description: flag.description,
        enabled: !flag.enabled,
        config: flag.config,
      });
      load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось изменить флаг");
    } finally {
      setBusy(false);
    }
  };
  const createFlag = async () => {
    if (!newFlag.key.trim()) return;
    setBusy(true);
    try {
      await upsertAdminFeatureFlag(newFlag.key.trim(), {
        description: null,
        enabled: newFlag.enabled,
        config: {},
      });
      setNewFlag({ key: "", enabled: false });
      load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось создать флаг");
    } finally {
      setBusy(false);
    }
  };
  const saveSetting = async () => {
    if (!newSetting.key.trim()) return;
    setBusy(true);
    try {
      await upsertAdminSetting(newSetting.key.trim(), {
        value: JSON.parse(newSetting.value || "{}") as Record<string, unknown>,
        description: null,
        is_public_business_setting: false,
      });
      setNewSetting({ key: "", value: "{}" });
      setMessage("Настройка сохранена");
      load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось сохранить настройку");
    } finally {
      setBusy(false);
    }
  };
  const requeue = async (event: AdminWebhookEvent) => {
    setBusy(true);
    try {
      await requeueAdminWebhook(event.id);
      setMessage("Webhook поставлен на повторную сверку");
      load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось переобработать webhook");
    } finally {
      setBusy(false);
    }
  };
  const saveMaintenance = async (enabled: boolean) => {
    setBusy(true);
    try {
      await updateAdminMaintenance(enabled, maintenanceMessage);
      setMessage(enabled ? "Maintenance mode включён" : "Maintenance mode выключен");
      load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось изменить режим");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="admin-panel">
      <div className="admin-tabs">
        {(
          [
            ["health", "Состояние"],
            ["flags", "Feature flags"],
            ["settings", "Настройки"],
            ["errors", "Ошибки"],
            ["webhooks", "Webhooks"],
            ["maintenance", "Maintenance"],
          ] as const
        ).map(([key, label]) => (
          <button key={key} className={`admin-tab ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>
      {message && <p className="settings-muted">{message}</p>}
      {tab === "health" && (
        <>
          <div className="admin-system-grid">
            {health?.services.map((service) => (
              <article key={service.name}>
                <span>{service.name}</span>
                <b>{service.status === "available" ? "Доступен" : "Настроен"}</b>
              </article>
            ))}
          </div>
          <div className="admin-status-row">
            <span>Ошибки за 24 часа</span>
            <b>{health?.errorsLast24h ?? "—"}</b>
            <small>Из журнала backend</small>
          </div>
          <div className="admin-status-row">
            <span>Неудачные задачи</span>
            <b>{health?.failedJobs ?? "—"}</b>
            <small>Celery/admin jobs</small>
          </div>
        </>
      )}
      {tab === "flags" && (
        <>
          <div className="admin-toolbar-actions">
            <label className="admin-search">
              <input
                value={newFlag.key}
                onChange={(event) => setNewFlag({ ...newFlag, key: event.target.value })}
                placeholder="Ключ флага, например cards.demo"
              />
            </label>
            <button className="ui-button ui-button-primary" disabled={busy} onClick={createFlag}>
              Добавить флаг
            </button>
          </div>
          <div className="admin-table">
            <div className="admin-table-head sales-row">
              <span>Флаг</span>
              <span>Статус</span>
              <span>Действие</span>
            </div>
            {flags.map((flag) => (
              <div className="admin-table-row sales-row" key={flag.key}>
                <span>
                  <b>{flag.key}</b>
                  <small>{flag.description ?? "—"}</small>
                </span>
                <span>
                  <em className={`admin-badge ${flag.enabled ? "active" : "blocked"}`}>
                    {flag.enabled ? "Включён" : "Выключен"}
                  </em>
                </span>
                <span className="admin-row-actions">
                  <button className="ui-button ui-button-secondary" disabled={busy} onClick={() => toggleFlag(flag)}>
                    {flag.enabled ? "Выключить" : "Включить"}
                  </button>
                </span>
              </div>
            ))}
            {flags.length === 0 && <p className="settings-muted">Флагов пока нет.</p>}
          </div>
        </>
      )}
      {tab === "settings" && (
        <>
          <div className="admin-toolbar-actions">
            <label className="admin-search">
              <input
                value={newSetting.key}
                onChange={(event) => setNewSetting({ ...newSetting, key: event.target.value })}
                placeholder="Ключ настройки"
              />
            </label>
            <input
              className="admin-setting-value"
              value={newSetting.value}
              onChange={(event) => setNewSetting({ ...newSetting, value: event.target.value })}
              placeholder='{"value": true}'
            />
            <button className="ui-button ui-button-primary" disabled={busy} onClick={saveSetting}>
              Сохранить
            </button>
          </div>
          <div className="admin-table">
            <div className="admin-table-head sales-row">
              <span>Ключ</span>
              <span>Значение</span>
              <span>Публичная</span>
            </div>
            {settings.map((setting) => (
              <div className="admin-table-row sales-row" key={setting.key}>
                <span>
                  <b>{setting.key}</b>
                  <small>{setting.description ?? "—"}</small>
                </span>
                <span>{JSON.stringify(setting.value)}</span>
                <span>{setting.isPublicBusinessSetting ? "Да" : "Нет"}</span>
              </div>
            ))}
            {settings.length === 0 && <p className="settings-muted">Настроек пока нет.</p>}
          </div>
        </>
      )}
      {tab === "errors" && (
        <div className="admin-table">
          <div className="admin-table-head content-row">
            <span>Источник</span>
            <span>Сообщение</span>
            <span>Correlation</span>
            <span>Важность</span>
            <span>Дата</span>
          </div>
          {errors.map((event) => (
            <div className="admin-table-row content-row" key={event.id}>
              <span>{event.source}</span>
              <span>{event.message}</span>
              <span>{event.correlationId ?? "—"}</span>
              <span>
                <em className={`admin-badge ${event.severity === "error" ? "blocked" : "pending"}`}>
                  {event.severity}
                </em>
              </span>
              <span>{date(event.createdAt)}</span>
            </div>
          ))}
          {errors.length === 0 && <p className="settings-muted">Ошибок не зафиксировано.</p>}
        </div>
      )}
      {tab === "webhooks" && (
        <div className="admin-table">
          <div className="admin-table-head content-row">
            <span>Провайдер</span>
            <span>Событие</span>
            <span>Статус</span>
            <span>Дата</span>
            <span>Действие</span>
          </div>
          {webhooks.map((event) => (
            <div className="admin-table-row content-row" key={event.id}>
              <span>{event.provider}</span>
              <span>
                <b>{event.eventType}</b>
                <small>{event.deduplicationKey}…</small>
              </span>
              <span>
                <em
                  className={`admin-badge ${event.status === "processed" ? "active" : event.status === "finalize_failed" ? "blocked" : "pending"}`}
                >
                  {event.status}
                </em>
              </span>
              <span>{date(event.createdAt)}</span>
              <span className="admin-row-actions">
                {(event.status === "finalize_failed" || event.status === "received") && (
                  <button className="ui-button ui-button-secondary" disabled={busy} onClick={() => requeue(event)}>
                    Переобработать
                  </button>
                )}
              </span>
            </div>
          ))}
          {webhooks.length === 0 && <p className="settings-muted">Webhook-событий нет.</p>}
        </div>
      )}
      {tab === "maintenance" && (
        <div className="admin-inline-editor">
          <h3>Режим технических работ</h3>
          <p className="settings-muted">
            Текущее состояние: {maintenance?.enabled ? "включён" : "выключен"}. При включении все клиентские API
            отвечают 503, кроме health, auth, admin и webhooks.
          </p>
          <label>
            Сообщение для пользователей
            <input value={maintenanceMessage} onChange={(event) => setMaintenanceMessage(event.target.value)} />
          </label>
          <div className="admin-dialog-actions">
            <button className="ui-button ui-button-danger" disabled={busy} onClick={() => saveMaintenance(true)}>
              Включить
            </button>
            <button className="ui-button ui-button-primary" disabled={busy} onClick={() => saveMaintenance(false)}>
              Выключить
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
