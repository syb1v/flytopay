"use client";

import { useCallback, useEffect, useState } from "react";
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
  type AdminAllowlistEntry,
  type AdminAuditEntry,
  type AdminPermission,
  type AdminRole,
} from "../../lib/api";

const date = (value: string) => new Date(value).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" });

type Tab = "roles" | "admins" | "audit";

export default function SecurityAdmin() {
  const [tab, setTab] = useState<Tab>("audit");
  const [permissions, setPermissions] = useState<AdminPermission[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [allowlist, setAllowlist] = useState<AdminAllowlistEntry[]>([]);
  const [audit, setAudit] = useState<AdminAuditEntry[]>([]);
  const [auditAction, setAuditAction] = useState("");
  const [auditActor, setAuditActor] = useState("");
  const [auditDays, setAuditDays] = useState(30);
  const [roleForm, setRoleForm] = useState({ name: "", description: "", permissions: [] as string[], is_active: true });
  const [editingRole, setEditingRole] = useState<AdminRole | null>(null);
  const [adminForm, setAdminForm] = useState({ telegramId: "", roleId: "" });
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось загрузить каталог прав");
    } finally {
      setBusy(false);
    }
  };
  const saveRole = async () => {
    if (!roleForm.name.trim()) return;
    setBusy(true);
    try {
      const payload = {
        name: roleForm.name.trim(),
        description: roleForm.description.trim() || null,
        permissions: roleForm.permissions,
        is_active: roleForm.is_active,
      };
      if (editingRole) await updateAdminRole(editingRole.id, payload);
      else await createAdminRole(payload);
      setRoleForm({ name: "", description: "", permissions: [], is_active: true });
      setEditingRole(null);
      setMessage("Роль сохранена");
      load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось сохранить роль");
    } finally {
      setBusy(false);
    }
  };
  const addAdmin = async () => {
    const telegramId = Number(adminForm.telegramId);
    if (!telegramId || !adminForm.roleId) return;
    setBusy(true);
    try {
      await addAdminAllowlist({ telegram_id: telegramId, role_id: adminForm.roleId, note: null });
      setAdminForm({ telegramId: "", roleId: "" });
      setMessage("Администратор добавлен");
      load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось добавить администратора");
    } finally {
      setBusy(false);
    }
  };
  const toggleAdmin = async (entry: AdminAllowlistEntry) => {
    setBusy(true);
    try {
      await updateAdminAllowlist(entry.id, { is_active: !entry.isActive });
      load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось изменить доступ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="admin-panel">
      <div className="admin-tabs">
        {(
          [
            ["audit", "Журнал действий"],
            ["roles", "Роли и права"],
            ["admins", "Администраторы"],
          ] as const
        ).map(([key, label]) => (
          <button key={key} className={`admin-tab ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>
      {message && <p className="settings-muted">{message}</p>}
      {tab === "audit" && (
        <>
          <div className="admin-toolbar-actions">
            <label className="admin-search">
              <input
                value={auditAction}
                onChange={(event) => setAuditAction(event.target.value)}
                placeholder="Фильтр по действию, например refund"
              />
            </label>
            <label className="admin-search">
              <input
                value={auditActor}
                onChange={(event) => setAuditActor(event.target.value)}
                placeholder="UUID или Telegram ID администратора"
              />
            </label>
            <select value={auditDays} onChange={(event) => setAuditDays(Number(event.target.value))}>
              <option value={7}>7 дней</option>
              <option value={30}>30 дней</option>
              <option value={90}>90 дней</option>
              <option value={365}>365 дней</option>
            </select>
            <button
              className="ui-button ui-button-secondary"
              onClick={() => downloadAdminAuditCsv(auditDays).catch(() => setMessage("Не удалось скачать CSV"))}
            >
              Экспорт CSV
            </button>
          </div>
          <div className="admin-table">
            <div className="admin-table-head content-row">
              <span>Действие</span>
              <span>Администратор</span>
              <span>Ресурс</span>
              <span>Причина</span>
              <span>Дата</span>
            </div>
            {audit.map((entry) => (
              <div className="admin-table-row content-row" key={entry.id}>
                <span>
                  <b>{entry.action}</b>
                  <small>{entry.ipAddress ?? "—"}</small>
                </span>
                <span>{entry.actorUserId ?? "—"}</span>
                <span>
                  {entry.resource}
                  <small>{entry.resourceId ?? "—"}</small>
                </span>
                <span>{entry.reason ?? "—"}</span>
                <span>{date(entry.createdAt)}</span>
              </div>
            ))}
            {audit.length === 0 && <p className="settings-muted">Записей нет.</p>}
          </div>
        </>
      )}
      {tab === "roles" && (
        <>
          <div className="admin-toolbar-actions">
            <button className="ui-button ui-button-secondary" disabled={busy} onClick={seed}>
              Загрузить каталог прав
            </button>
          </div>
          <div className="admin-inline-editor">
            <h3>{editingRole ? `Роль: ${editingRole.name}` : "Новая роль"}</h3>
            <label>
              Название
              <input
                value={roleForm.name}
                onChange={(event) => setRoleForm({ ...roleForm, name: event.target.value })}
              />
            </label>
            <label>
              Описание
              <input
                value={roleForm.description}
                onChange={(event) => setRoleForm({ ...roleForm, description: event.target.value })}
              />
            </label>
            <div className="admin-permission-grid">
              {permissions.map((permission) => (
                <label className="admin-toggle" key={permission.name}>
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
                  {permission.name}
                </label>
              ))}
            </div>
            <div className="admin-dialog-actions">
              {editingRole && (
                <button
                  className="ui-button ui-button-secondary"
                  onClick={() => {
                    setEditingRole(null);
                    setRoleForm({ name: "", description: "", permissions: [], is_active: true });
                  }}
                >
                  Отмена
                </button>
              )}
              <button className="ui-button ui-button-primary" disabled={busy} onClick={saveRole}>
                Сохранить роль
              </button>
            </div>
          </div>
          <div className="admin-table">
            <div className="admin-table-head sales-row">
              <span>Роль</span>
              <span>Права</span>
              <span>Действие</span>
            </div>
            {roles.map((role) => (
              <div className="admin-table-row sales-row" key={role.id}>
                <span>
                  <b>{role.name}</b>
                  <small>{role.description ?? "—"}</small>
                </span>
                <span>{role.permissions.length}</span>
                <span className="admin-row-actions">
                  <button
                    className="ui-button ui-button-secondary"
                    onClick={() => {
                      setEditingRole(role);
                      setRoleForm({
                        name: role.name,
                        description: role.description ?? "",
                        permissions: role.permissions,
                        is_active: role.isActive,
                      });
                    }}
                  >
                    Изменить
                  </button>
                </span>
              </div>
            ))}
            {roles.length === 0 && <p className="settings-muted">Ролей пока нет.</p>}
          </div>
        </>
      )}
      {tab === "admins" && (
        <>
          <div className="admin-toolbar-actions">
            <label className="admin-search">
              <input
                value={adminForm.telegramId}
                onChange={(event) => setAdminForm({ ...adminForm, telegramId: event.target.value })}
                placeholder="Telegram ID"
              />
            </label>
            <select
              value={adminForm.roleId}
              onChange={(event) => setAdminForm({ ...adminForm, roleId: event.target.value })}
            >
              <option value="">Выберите роль</option>
              {roles.map((role) => (
                <option value={role.id} key={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
            <button className="ui-button ui-button-primary" disabled={busy} onClick={addAdmin}>
              Добавить администратора
            </button>
          </div>
          <div className="admin-table">
            <div className="admin-table-head sales-row">
              <span>Telegram ID</span>
              <span>Роль</span>
              <span>Статус</span>
            </div>
            {allowlist.map((entry) => (
              <div className="admin-table-row sales-row" key={entry.id}>
                <span>{entry.telegramId}</span>
                <span>{entry.roleName ?? "—"}</span>
                <span className="admin-row-actions">
                  <button className="ui-button ui-button-secondary" disabled={busy} onClick={() => toggleAdmin(entry)}>
                    {entry.isActive ? "Отключить" : "Включить"}
                  </button>
                </span>
              </div>
            ))}
            {allowlist.length === 0 && <p className="settings-muted">Администраторы не добавлены.</p>}
          </div>
        </>
      )}
    </section>
  );
}
