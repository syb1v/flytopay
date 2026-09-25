"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  addAdminAllowlist,
  createAdminRole,
  downloadAdminAuditCsv,
  getAdminAllowlist,
  getAdminAudit,
  getAdminPermissions,
  getAdminRoles,
  seedAdminPermissions,
  updateAdminAllowlist,
  updateAdminRole,
} from "../../../lib/api";
import type { AdminAllowlistEntry, AdminAuditEntry, AdminPermission, AdminRole } from "../../../lib/api";
import { Badge, Button, Empty, Field, Page, Panel, Select, Tabs, TextInput } from "../../../components/admin/ui";
import { adminActionLabels, label } from "../../../lib/adminLabels";

const tabs = [
  { key: "audit", label: "Журнал действий" },
  { key: "roles", label: "Роли и права" },
  { key: "admins", label: "Администраторы" },
];

export default function AdminSecurityPage() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "audit";
  const [permissions, setPermissions] = useState<AdminPermission[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [allowlist, setAllowlist] = useState<AdminAllowlistEntry[]>([]);
  const [audit, setAudit] = useState<AdminAuditEntry[]>([]);
  const [auditAction, setAuditAction] = useState("");
  const [auditActor, setAuditActor] = useState("");
  const [auditDays, setAuditDays] = useState(30);
  const [roleForm, setRoleForm] = useState({ name: "", description: "", permissions: [] as string[], isActive: true });
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [adminForm, setAdminForm] = useState({ telegramId: "", roleId: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    getAdminPermissions()
      .then(setPermissions)
      .catch(() => setPermissions([]));
    getAdminRoles()
      .then(setRoles)
      .catch(() => setRoles([]));
    getAdminAllowlist()
      .then(setAllowlist)
      .catch(() => setAllowlist([]));
    getAdminAudit({ action: auditAction, actor: auditActor, days: auditDays })
      .then((page) => setAudit(page.items))
      .catch(() => setAudit([]));
  }, [auditAction, auditActor, auditDays]);
  useEffect(() => load(), [load]);

  const seed = async () => {
    setBusy(true);
    try {
      const result = await seedAdminPermissions();
      setMessage(`Создано permissions: ${result.created}`);
      load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось загрузить каталог прав");
    } finally {
      setBusy(false);
    }
  };
  const saveRole = async () => {
    if (!roleForm.name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const payload = {
        name: roleForm.name.trim(),
        description: roleForm.description.trim() || null,
        permissions: roleForm.permissions,
        is_active: roleForm.isActive,
      };
      if (editingRoleId) await updateAdminRole(editingRoleId, payload);
      else await createAdminRole(payload);
      setRoleForm({ name: "", description: "", permissions: [], isActive: true });
      setEditingRoleId(null);
      setMessage("Роль сохранена");
      load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить роль");
    } finally {
      setBusy(false);
    }
  };
  const addAdmin = async () => {
    const telegramId = Number(adminForm.telegramId);
    if (!telegramId || !adminForm.roleId) return;
    setBusy(true);
    setError(null);
    try {
      await addAdminAllowlist({ telegram_id: telegramId, role_id: adminForm.roleId, note: null });
      setAdminForm({ telegramId: "", roleId: "" });
      setMessage("Администратор добавлен");
      load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось добавить администратора");
    } finally {
      setBusy(false);
    }
  };
  const toggleAdmin = async (entry: AdminAllowlistEntry) => {
    setBusy(true);
    try {
      await updateAdminAllowlist(entry.id, { is_active: !entry.isActive });
      load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось изменить доступ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title="Безопасность" description="Аудит, роли и доступ администраторов">
      {message && <p className="adm-page-sub">{message}</p>}
      {error && <p className="adm-modal-error">{error}</p>}
      <Tabs base="/admin/security" tabs={tabs} />
      {tab === "audit" && (
        <Panel
          title="Журнал действий"
          actions={
            <div className="adm-page-actions">
              <TextInput
                value={auditAction}
                onChange={(event) => setAuditAction(event.target.value)}
                placeholder="Действие, например refund"
              />
              <TextInput
                value={auditActor}
                onChange={(event) => setAuditActor(event.target.value)}
                placeholder="UUID или Telegram ID"
              />
              <Select value={auditDays} onChange={(event) => setAuditDays(Number(event.target.value))}>
                <option value={7}>7 дней</option>
                <option value={30}>30 дней</option>
                <option value={90}>90 дней</option>
                <option value={365}>365 дней</option>
              </Select>
              <Button
                variant="secondary"
                onClick={() => downloadAdminAuditCsv(auditDays).catch(() => setError("Не удалось скачать CSV"))}
              >
                Экспорт CSV
              </Button>
            </div>
          }
        >
          <div className="adm-table">
            <table>
              <thead>
                <tr>
                  <th>Действие</th>
                  <th>Администратор</th>
                  <th>Ресурс</th>
                  <th>Причина</th>
                  <th>IP</th>
                  <th>Дата</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((entry) => (
                  <tr key={entry.id}>
                    <td>{label(adminActionLabels, entry.action)}</td>
                    <td>{entry.actorUserId ?? "—"}</td>
                    <td>
                      {entry.resource}
                      <span className="adm-cell-sub">{entry.resourceId ?? "—"}</span>
                    </td>
                    <td>{entry.reason ?? "—"}</td>
                    <td>{entry.ipAddress ?? "—"}</td>
                    <td>{new Date(entry.createdAt).toLocaleString("ru-RU")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {audit.length === 0 && <Empty>Записей нет.</Empty>}
          </div>
        </Panel>
      )}
      {tab === "roles" && (
        <>
          <Panel
            title={editingRoleId ? "Редактирование роли" : "Новая роль"}
            actions={
              <Button variant="secondary" busy={busy} onClick={seed}>
                Загрузить каталог прав
              </Button>
            }
          >
            <div className="adm-form-grid">
              <Field label="Название">
                <TextInput
                  value={roleForm.name}
                  onChange={(event) => setRoleForm({ ...roleForm, name: event.target.value })}
                />
              </Field>
              <Field label="Описание">
                <TextInput
                  value={roleForm.description}
                  onChange={(event) => setRoleForm({ ...roleForm, description: event.target.value })}
                />
              </Field>
              <Field label="Статус">
                <label className="adm-toggle">
                  <input
                    type="checkbox"
                    checked={roleForm.isActive}
                    onChange={(event) => setRoleForm({ ...roleForm, isActive: event.target.checked })}
                  />
                  Роль активна
                </label>
              </Field>
            </div>
            <div className="adm-form-grid" style={{ marginTop: 14 }}>
              {permissions.map((permission) => (
                <label className="adm-toggle" key={permission.name}>
                  <input
                    type="checkbox"
                    checked={roleForm.permissions.includes(permission.name)}
                    onChange={(event) =>
                      setRoleForm({
                        ...roleForm,
                        permissions: event.target.checked
                          ? [...roleForm.permissions, permission.name]
                          : roleForm.permissions.filter((value) => value !== permission.name),
                      })
                    }
                  />
                  <span>
                    {permission.name}
                    {permission.description && <small className="adm-cell-sub">{permission.description}</small>}
                  </span>
                </label>
              ))}
            </div>
            <div className="adm-panel-actions" style={{ marginTop: 16 }}>
              {editingRoleId && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEditingRoleId(null);
                    setRoleForm({ name: "", description: "", permissions: [], isActive: true });
                  }}
                >
                  Отмена
                </Button>
              )}
              <Button variant="primary" busy={busy} onClick={saveRole}>
                Сохранить роль
              </Button>
            </div>
          </Panel>
          <Panel title="Роли">
            <div className="adm-table">
              <table>
                <thead>
                  <tr>
                    <th>Роль</th>
                    <th>Описание</th>
                    <th>Права</th>
                    <th>Статус</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {roles.map((role) => (
                    <tr key={role.id}>
                      <td>{role.name}</td>
                      <td>{role.description ?? "—"}</td>
                      <td>{role.permissions.length}</td>
                      <td>
                        <Badge tone={role.isActive ? "success" : "neutral"}>
                          {role.isActive ? "Активна" : "Выключена"}
                        </Badge>
                      </td>
                      <td>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setEditingRoleId(role.id);
                            setRoleForm({
                              name: role.name,
                              description: role.description ?? "",
                              permissions: role.permissions,
                              isActive: role.isActive,
                            });
                          }}
                        >
                          Изменить
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {roles.length === 0 && <Empty>Ролей пока нет.</Empty>}
            </div>
          </Panel>
        </>
      )}
      {tab === "admins" && (
        <Panel title="Администраторы" actions={<Badge tone="warning">Telegram ID добавляется в allowlist</Badge>}>
          <div className="adm-form-grid">
            <Field label="Telegram ID">
              <TextInput
                inputMode="numeric"
                value={adminForm.telegramId}
                onChange={(event) => setAdminForm({ ...adminForm, telegramId: event.target.value })}
                placeholder="123456789"
              />
            </Field>
            <Field label="Роль">
              <Select
                value={adminForm.roleId}
                onChange={(event) => setAdminForm({ ...adminForm, roleId: event.target.value })}
              >
                <option value="">Выберите роль</option>
                {roles.map((role) => (
                  <option value={role.id} key={role.id}>
                    {role.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="adm-panel-actions" style={{ marginTop: 12 }}>
            <Button variant="primary" busy={busy} onClick={addAdmin}>
              Добавить администратора
            </Button>
          </div>
          <div className="adm-table" style={{ marginTop: 16 }}>
            <table>
              <thead>
                <tr>
                  <th>Telegram ID</th>
                  <th>Роль</th>
                  <th>Статус</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {allowlist.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.telegramId}</td>
                    <td>{entry.roleName ?? "—"}</td>
                    <td>
                      <Badge tone={entry.isActive ? "success" : "neutral"}>
                        {entry.isActive ? "Активен" : "Выключен"}
                      </Badge>
                    </td>
                    <td>
                      <Button variant="secondary" busy={busy} onClick={() => toggleAdmin(entry)}>
                        {entry.isActive ? "Отключить" : "Включить"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {allowlist.length === 0 && <Empty>Администраторы не добавлены.</Empty>}
          </div>
        </Panel>
      )}
    </Page>
  );
}
