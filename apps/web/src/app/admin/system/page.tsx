"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  getAdminErrors,
  getAdminFeatureFlags,
  getAdminMaintenance,
  getAdminProvider,
  getAdminSettings,
  getAdminSystemHealth,
  getAdminWebhooks,
  requeueAdminWebhook,
  updateAdminMaintenance,
  upsertAdminFeatureFlag,
  upsertAdminSetting,
} from "../../../lib/api";
import type {
  AdminErrorEvent,
  AdminFeatureFlag,
  AdminProviderStatus,
  AdminSystemHealth,
  AdminSystemSetting,
  AdminWebhookEvent,
} from "../../../lib/api";
import { Badge, Button, Empty, Field, Page, Panel, StatGrid, Tabs, TextInput } from "../../../components/admin/ui";

const tabs = [
  { key: "health", label: "Состояние" },
  { key: "provider", label: "Провайдер 2328" },
  { key: "flags", label: "Feature flags" },
  { key: "settings", label: "Настройки" },
  { key: "errors", label: "Ошибки" },
  { key: "webhooks", label: "Webhooks" },
  { key: "maintenance", label: "Maintenance" },
];

export default function AdminSystemPage() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "health";
  const [health, setHealth] = useState<AdminSystemHealth | null>(null);
  const [flags, setFlags] = useState<AdminFeatureFlag[]>([]);
  const [settings, setSettings] = useState<AdminSystemSetting[]>([]);
  const [errors, setErrors] = useState<AdminErrorEvent[]>([]);
  const [webhooks, setWebhooks] = useState<AdminWebhookEvent[]>([]);
  const [maintenance, setMaintenance] = useState<{ enabled: boolean; message: string | null } | null>(null);
  const [provider, setProvider] = useState<AdminProviderStatus | null>(null);
  const [newFlag, setNewFlag] = useState("");
  const [settingKey, setSettingKey] = useState("");
  const [settingValue, setSettingValue] = useState("{}");
  const [maintenanceMessage, setMaintenanceMessage] = useState("Технические работы");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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
    getAdminProvider()
      .then(setProvider)
      .catch(() => setProvider(null));
  }, []);
  useEffect(() => load(), [load]);

  const createFlag = async () => {
    if (!newFlag.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await upsertAdminFeatureFlag(newFlag.trim(), { description: null, enabled: false, config: {} });
      setNewFlag("");
      setMessage("Флаг создан");
      load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось создать флаг");
    } finally {
      setBusy(false);
    }
  };
  const toggleFlag = async (flag: AdminFeatureFlag) => {
    setBusy(true);
    try {
      await upsertAdminFeatureFlag(flag.key, {
        description: flag.description,
        enabled: !flag.enabled,
        config: flag.config,
      });
      load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось изменить флаг");
    } finally {
      setBusy(false);
    }
  };
  const saveSetting = async () => {
    if (!settingKey.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await upsertAdminSetting(settingKey.trim(), {
        value: JSON.parse(settingValue || "{}") as Record<string, unknown>,
        description: null,
        is_public_business_setting: false,
      });
      setSettingKey("");
      setSettingValue("{}");
      setMessage("Настройка сохранена");
      load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить настройку");
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
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось переобработать webhook");
    } finally {
      setBusy(false);
    }
  };
  const saveMaintenance = async (enabled: boolean) => {
    setBusy(true);
    try {
      await updateAdminMaintenance(enabled, maintenanceMessage);
      setMessage(enabled ? "Maintenance включён" : "Maintenance выключен");
      load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось изменить режим");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title="Система" description="Интеграции, флаги, настройки и контроль ошибок">
      {message && <p className="adm-page-sub">{message}</p>}
      {error && <p className="adm-modal-error">{error}</p>}
      <Tabs base="/admin/system" tabs={tabs} />
      {tab === "health" && (
        <Panel title="Состояние сервисов">
          {health ? (
            <StatGrid
              items={[
                ...health.services.map((service) => ({
                  label: service.name,
                  value: service.status === "available" ? "Доступен" : "Настроен",
                })),
                { label: "Ошибки за 24 часа", value: health.errorsLast24h },
                { label: "Неудачные задачи", value: health.failedJobs },
              ]}
            />
          ) : (
            <Empty>Состояние недоступно.</Empty>
          )}
        </Panel>
      )}
      {tab === "provider" && (
        <Panel
          title="2328 CaaS"
          actions={
            <Badge tone={provider?.status === "ok" ? "success" : provider?.configured ? "danger" : "neutral"}>
              {provider?.status === "ok" ? "API отвечает" : provider?.configured ? "Недоступен" : "Не настроен"}
            </Badge>
          }
        >
          {provider ? (
            <>
              <StatGrid
                items={[
                  {
                    label: "Latency",
                    value: provider.ping ? `${provider.ping.latencyMs} мс` : "—",
                    hint: provider.ping?.error ?? provider.ping?.api,
                  },
                  {
                    label: "Статус аккаунта",
                    value: provider.account?.status ?? "—",
                    hint: provider.account?.environment,
                  },
                  { label: "Account ID", value: provider.account?.accountId?.slice(0, 8) ?? "—" },
                ]}
              />
              {(provider.accountError || provider.walletError || provider.pricingError) && (
                <p className="adm-modal-error">
                  {provider.accountError ?? provider.walletError ?? provider.pricingError}
                </p>
              )}
              <h3>Баланс кошелька</h3>
              <div className="adm-table">
                <table>
                  <thead>
                    <tr>
                      <th>Программа</th>
                      <th>Доступно</th>
                      <th>Резерв</th>
                      <th>На картах</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(provider.wallet?.items ?? []).map((item, index) => (
                      <tr key={`${item.providerCode}-${index}`}>
                        <td>{item.providerCode ?? "—"}</td>
                        <td>
                          {(item.availableMinor ?? 0) / 10 ** (item.scale ?? 6)} {item.currency ?? "USDT"}
                          {item.availableUsd ? ` · $${item.availableUsd}` : ""}
                        </td>
                        <td>
                          {(item.reservedMinor ?? 0) / 10 ** (item.scale ?? 6)} {item.currency ?? "USDT"}
                        </td>
                        <td>
                          {(item.onCardsMinor ?? 0) / 10 ** (item.onCardsScale ?? 2)} {item.onCardsCurrency ?? ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(provider.wallet?.items ?? []).length === 0 && <Empty>Баланс недоступен.</Empty>}
              </div>
              <h3 style={{ marginTop: 20 }}>Тарифная сетка провайдера</h3>
              <div className="adm-table">
                <table>
                  <thead>
                    <tr>
                      <th>Статья</th>
                      <th>Списание</th>
                      <th>Flat</th>
                      <th>Bps</th>
                      <th>Период</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(provider.pricing?.fees ?? []).map((fee, index) => (
                      <tr key={`${fee.feeItem}-${index}`}>
                        <td>{fee.feeItem}</td>
                        <td>
                          {fee.collection} · {fee.chargedFrom}
                        </td>
                        <td>{(fee.flatMinor ?? 0) / 10 ** (provider.pricing?.scale ?? 2)}</td>
                        <td>{((fee.bps ?? 0) / 100).toFixed(2)}%</td>
                        <td>{fee.period ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(provider.pricing?.fees ?? []).length === 0 && <Empty>Прайс недоступен.</Empty>}
              </div>
              <h3 style={{ marginTop: 20 }}>Последние движения по кошельку</h3>
              <div className="adm-table">
                <table>
                  <thead>
                    <tr>
                      <th>Тип</th>
                      <th>Сумма</th>
                      <th>Баланс после</th>
                      <th>Дата</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(provider.transactions ?? []).slice(0, 10).map((movement, index) => (
                      <tr key={String(movement.id ?? index)}>
                        <td>{String(movement.type ?? "—")}</td>
                        <td>{String(movement.amountMinor ?? movement.amount ?? "—")}</td>
                        <td>{String(movement.balanceAfterMinor ?? "—")}</td>
                        <td>{String(movement.occurredAt ?? "—")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(provider.transactions ?? []).length === 0 && <Empty>Движений нет.</Empty>}
              </div>
            </>
          ) : (
            <Empty>Провайдер не отвечает или ключ не настроен.</Empty>
          )}
        </Panel>
      )}
      {tab === "flags" && (
        <Panel
          title="Feature flags"
          actions={
            <div className="adm-page-actions">
              <TextInput
                value={newFlag}
                onChange={(event) => setNewFlag(event.target.value)}
                placeholder="cards.demo"
              />
              <Button variant="primary" busy={busy} onClick={createFlag}>
                Добавить
              </Button>
            </div>
          }
        >
          <div className="adm-table">
            <table>
              <thead>
                <tr>
                  <th>Флаг</th>
                  <th>Описание</th>
                  <th>Статус</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {flags.map((flag) => (
                  <tr key={flag.key}>
                    <td>{flag.key}</td>
                    <td>{flag.description ?? "—"}</td>
                    <td>
                      <Badge tone={flag.enabled ? "success" : "neutral"}>{flag.enabled ? "Включён" : "Выключен"}</Badge>
                    </td>
                    <td>
                      <Button variant="secondary" busy={busy} onClick={() => toggleFlag(flag)}>
                        {flag.enabled ? "Выключить" : "Включить"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {flags.length === 0 && <Empty>Флагов пока нет.</Empty>}
          </div>
        </Panel>
      )}
      {tab === "settings" && (
        <Panel title="Настройки">
          <div className="adm-form-grid">
            <Field label="Ключ" hint="Secret-like ключи запрещены">
              <TextInput
                value={settingKey}
                onChange={(event) => setSettingKey(event.target.value)}
                placeholder="default_currency"
              />
            </Field>
            <Field label="Значение (JSON)">
              <TextInput
                value={settingValue}
                onChange={(event) => setSettingValue(event.target.value)}
                placeholder='{"value": true}'
              />
            </Field>
          </div>
          <div className="adm-panel-actions" style={{ marginTop: 12 }}>
            <Button variant="primary" busy={busy} onClick={saveSetting}>
              Сохранить
            </Button>
          </div>
          <div className="adm-table" style={{ marginTop: 16 }}>
            <table>
              <thead>
                <tr>
                  <th>Ключ</th>
                  <th>Значение</th>
                  <th>Публичная</th>
                </tr>
              </thead>
              <tbody>
                {settings.map((setting) => (
                  <tr key={setting.key}>
                    <td>{setting.key}</td>
                    <td>{JSON.stringify(setting.value)}</td>
                    <td>{setting.isPublicBusinessSetting ? "Да" : "Нет"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {settings.length === 0 && <Empty>Настроек пока нет.</Empty>}
          </div>
        </Panel>
      )}
      {tab === "errors" && (
        <Panel title="Журнал ошибок">
          <div className="adm-table">
            <table>
              <thead>
                <tr>
                  <th>Источник</th>
                  <th>Сообщение</th>
                  <th>Correlation</th>
                  <th>Важность</th>
                  <th>Дата</th>
                </tr>
              </thead>
              <tbody>
                {errors.map((event) => (
                  <tr key={event.id}>
                    <td>{event.source}</td>
                    <td>{event.message}</td>
                    <td>{event.correlationId ?? "—"}</td>
                    <td>
                      <Badge tone={event.severity === "error" ? "danger" : "warning"}>{event.severity}</Badge>
                    </td>
                    <td>{new Date(event.createdAt).toLocaleString("ru-RU")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {errors.length === 0 && <Empty>Ошибок не зафиксировано.</Empty>}
          </div>
        </Panel>
      )}
      {tab === "webhooks" && (
        <Panel title="Webhook-события">
          <div className="adm-table">
            <table>
              <thead>
                <tr>
                  <th>Провайдер</th>
                  <th>Событие</th>
                  <th>Статус</th>
                  <th>Дата</th>
                  <th>Действие</th>
                </tr>
              </thead>
              <tbody>
                {webhooks.map((event) => (
                  <tr key={event.id}>
                    <td>{event.provider}</td>
                    <td>
                      {event.eventType}
                      <span className="adm-cell-sub">{event.deduplicationKey}…</span>
                    </td>
                    <td>
                      <Badge
                        tone={
                          event.status === "processed"
                            ? "success"
                            : event.status === "finalize_failed"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {event.status}
                      </Badge>
                    </td>
                    <td>{new Date(event.createdAt).toLocaleString("ru-RU")}</td>
                    <td>
                      {(event.status === "finalize_failed" || event.status === "received") && (
                        <Button variant="secondary" busy={busy} onClick={() => requeue(event)}>
                          Переобработать
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {webhooks.length === 0 && <Empty>Webhook-событий нет.</Empty>}
          </div>
        </Panel>
      )}
      {tab === "maintenance" && (
        <Panel title="Режим технических работ">
          <p className="adm-page-sub">
            Текущее состояние: {maintenance?.enabled ? "включён" : "выключен"}. При включении клиентские API отвечают
            503, кроме health, auth, admin и webhooks.
          </p>
          <div className="adm-form-grid">
            <Field label="Сообщение для пользователей">
              <TextInput value={maintenanceMessage} onChange={(event) => setMaintenanceMessage(event.target.value)} />
            </Field>
          </div>
          <div className="adm-panel-actions" style={{ marginTop: 14 }}>
            <Button variant="danger" busy={busy} onClick={() => saveMaintenance(true)}>
              Включить
            </Button>
            <Button variant="primary" busy={busy} onClick={() => saveMaintenance(false)}>
              Выключить
            </Button>
          </div>
        </Panel>
      )}
    </Page>
  );
}
