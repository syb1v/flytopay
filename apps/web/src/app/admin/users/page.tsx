"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { adminBulkUsers, getAdminUserStats, getAdminUsers } from "../../../lib/api";
import type { AdminUser, AdminUserStats } from "../../../lib/api";
import { label, userStatusLabels } from "../../../lib/adminLabels";
import {
  ActionDialog,
  Badge,
  Button,
  Empty,
  Page,
  Pager,
  Panel,
  Select,
  StatGrid,
  TextInput,
} from "../../../components/admin/ui";

const fullName = (user: AdminUser) =>
  [user.firstName, user.lastName].filter(Boolean).join(" ") || (user.username ? `@${user.username}` : "Без имени");

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [stats, setStats] = useState<AdminUserStats | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [pendingAction, setPendingAction] = useState<
    "block" | "unblock" | "restore" | "delete" | "revoke-sessions" | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    getAdminUsers({ q: query, status, page })
      .then((result) => {
        setUsers(result.items);
        setTotal(result.total);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Не удалось загрузить пользователей"));
  }, [query, status, page]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (query) setPage(1);
      load();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, load]);
  useEffect(() => {
    getAdminUserStats()
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  const allChecked = users.length > 0 && selected.length === users.length;
  const toggle = (id: string) =>
    setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));

  const runAction = async (reason: string) => {
    if (!pendingAction || reason.trim().length < 3) return;
    setBusy(true);
    setError(null);
    try {
      const result = await adminBulkUsers(selected, pendingAction, reason.trim());
      setMessage(`Выполнено: ${result.succeeded}, ошибок: ${result.failed}`);
      setSelected([]);
      setPendingAction(null);
      load();
    } catch (reasonValue) {
      setError(reasonValue instanceof Error ? reasonValue.message : "Массовое действие не выполнено");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page
      title="Пользователи"
      description="Поиск, статусы и массовые действия"
      actions={selected.length > 0 ? <Badge tone="info">Выбрано: {selected.length}</Badge> : undefined}
    >
      {stats && (
        <StatGrid
          items={[
            { label: "Всего", value: stats.totalUsers },
            { label: "Активные", value: stats.activeUsers },
            { label: "Заблокированные", value: stats.blockedUsers },
            { label: "Новые за месяц", value: stats.newMonth },
          ]}
        />
      )}
      <Panel>
        <div className="adm-form-grid">
          <TextInput
            placeholder="Поиск: UUID, Telegram ID, username или имя"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Все статусы</option>
            <option value="active">Активные</option>
            <option value="blocked">Заблокированные</option>
            <option value="deleted">Удалённые</option>
          </Select>
        </div>
        {selected.length > 0 && (
          <div className="adm-page-actions" style={{ marginTop: 14 }}>
            <Button variant="secondary" onClick={() => setPendingAction("revoke-sessions")}>
              Отозвать сессии
            </Button>
            <Button variant="secondary" onClick={() => setPendingAction("block")}>
              Заблокировать
            </Button>
            <Button variant="secondary" onClick={() => setPendingAction("unblock")}>
              Разблокировать
            </Button>
            <Button variant="primary" onClick={() => setPendingAction("restore")}>
              Восстановить
            </Button>
            <Button variant="danger" onClick={() => setPendingAction("delete")}>
              Удалить
            </Button>
            <Button variant="ghost" onClick={() => setSelected([])}>
              Сбросить
            </Button>
          </div>
        )}
        {message && <p className="adm-page-sub">{message}</p>}
        {error && <p className="adm-modal-error">{error}</p>}
        <div className="adm-table">
          <table>
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={(event) => setSelected(event.target.checked ? users.map((user) => user.userId) : [])}
                    aria-label="Выбрать всех"
                  />
                </th>
                <th>Пользователь</th>
                <th>Telegram</th>
                <th>Статус</th>
                <th>Регистрация</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.userId}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.includes(user.userId)}
                      onChange={() => toggle(user.userId)}
                      aria-label={`Выбрать ${user.userId}`}
                    />
                  </td>
                  <td>
                    <Link className="adm-link" href={`/admin/users/${user.userId}`}>
                      {fullName(user)}
                    </Link>
                    <span className="adm-cell-sub">
                      {user.username ? `@${user.username} · ` : ""}
                      {user.userId}
                    </span>
                  </td>
                  <td>{user.telegramId ?? "—"}</td>
                  <td>
                    <Badge
                      tone={user.status === "active" ? "success" : user.status === "blocked" ? "danger" : "neutral"}
                    >
                      {label(userStatusLabels, user.status)}
                    </Badge>
                  </td>
                  <td>{new Date(user.createdAt).toLocaleDateString("ru-RU")}</td>
                  <td>
                    <Link className="adm-link" href={`/admin/users/${user.userId}`}>
                      Открыть →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && <Empty>Пользователи не найдены.</Empty>}
        </div>
        <Pager page={page} total={total} limit={20} onPage={setPage} />
      </Panel>
      <ActionDialog
        open={pendingAction !== null}
        title="Массовое действие"
        description={`Будет обработано пользователей: ${selected.length}`}
        fields={[
          { name: "reason", label: "Причина", type: "textarea", required: true, placeholder: "Минимум 3 символа" },
        ]}
        confirmLabel="Выполнить"
        danger={pendingAction === "delete"}
        busy={busy}
        error={error}
        onCancel={() => setPendingAction(null)}
        onConfirm={(values) => runAction(values.reason ?? "")}
      />
    </Page>
  );
}
