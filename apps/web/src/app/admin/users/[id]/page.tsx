"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { adminDeleteUser, adminRestoreUser, adminUserAction, getAdminUser } from "../../../../lib/api";
import type { AdminUserDetails } from "../../../../lib/api";
import { ActionDialog, Badge, Button, Empty, Page, Panel, StatGrid } from "../../../../components/admin/ui";
import UserNotesTags from "../../../../components/admin/UserNotesTags";

type Action = "block" | "unblock" | "revoke-sessions" | "restore" | "delete";

const actionLabels: Record<Action, string> = {
  block: "Заблокировать пользователя",
  unblock: "Разблокировать пользователя",
  "revoke-sessions": "Отозвать активные сессии",
  restore: "Восстановить пользователя",
  delete: "Удалить пользователя",
};

export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const userId = params.id;
  const [user, setUser] = useState<AdminUserDetails | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!userId) return;
    getAdminUser(userId)
      .then(setUser)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Не удалось загрузить пользователя"));
  }, [userId]);
  useEffect(() => load(), [load]);

  const run = async (reason: string) => {
    if (!action || reason.trim().length < 3) return;
    setBusy(true);
    setError(null);
    try {
      if (action === "restore") await adminRestoreUser(userId, reason.trim());
      else if (action === "delete") await adminDeleteUser(userId, reason.trim());
      else await adminUserAction(userId, action, reason.trim());
      setAction(null);
      if (action === "delete") router.push("/admin/users");
      else load();
    } catch (reasonValue) {
      setError(reasonValue instanceof Error ? reasonValue.message : "Действие не выполнено");
    } finally {
      setBusy(false);
    }
  };

  const statusTone = user?.status === "active" ? "success" : user?.status === "blocked" ? "danger" : "neutral";

  return (
    <Page
      title={
        user
          ? user.accounts.map((account) => account.username ?? account.telegramId).join(", ") || "Пользователь"
          : "Пользователь"
      }
      description={user ? `UUID ${user.userId}` : undefined}
      backHref="/admin/users"
      backLabel="Все пользователи"
      actions={
        user && (
          <>
            <Button variant="secondary" onClick={() => setAction("revoke-sessions")}>
              Отозвать сессии
            </Button>
            {user.status === "blocked" ? (
              <Button variant="primary" onClick={() => setAction("unblock")}>
                Разблокировать
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => setAction("block")}>
                Заблокировать
              </Button>
            )}
            {user.status === "deleted" ? (
              <Button variant="primary" onClick={() => setAction("restore")}>
                Восстановить
              </Button>
            ) : (
              <Button variant="danger" onClick={() => setAction("delete")}>
                Удалить
              </Button>
            )}
          </>
        )
      }
    >
      {error && <p className="adm-modal-error">{error}</p>}
      {!user && !error && <Empty>Загрузка…</Empty>}
      {user && (
        <>
          <StatGrid
            items={[
              { label: "Статус", value: <Badge tone={statusTone}>{user.status}</Badge> },
              { label: "Активные сессии", value: user.activeSessions },
              { label: "Карты", value: user.cards.length },
              { label: "Платежи", value: user.payments.length },
              { label: "Аренды", value: user.rentalCount },
              { label: "Кошельки", value: user.wallets.length },
            ]}
          />
          <Panel title="Telegram">
            {user.accounts.length === 0 && <Empty>Аккаунты не привязаны.</Empty>}
            <div className="adm-table">
              <table>
                <thead>
                  <tr>
                    <th>Telegram ID</th>
                    <th>Username</th>
                  </tr>
                </thead>
                <tbody>
                  {user.accounts.map((account) => (
                    <tr key={account.telegramId}>
                      <td>{account.telegramId}</td>
                      <td>{account.username ? `@${account.username}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
          <Panel title="Кошельки">
            {user.wallets.length === 0 ? (
              <Empty>Кошельки отсутствуют.</Empty>
            ) : (
              <div className="adm-table">
                <table>
                  <thead>
                    <tr>
                      <th>Валюта</th>
                      <th>Доступно</th>
                    </tr>
                  </thead>
                  <tbody>
                    {user.wallets.map((wallet) => (
                      <tr key={wallet.currency}>
                        <td>{wallet.currency}</td>
                        <td>{(wallet.availableMinor / 100).toLocaleString("ru-RU")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
          <Panel
            title="Последние карты"
            actions={
              <Button href="/admin/cards" variant="secondary">
                Все карты
              </Button>
            }
          >
            <div className="adm-table">
              <table>
                <thead>
                  <tr>
                    <th>Карта</th>
                    <th>Статус</th>
                    <th>Demo</th>
                  </tr>
                </thead>
                <tbody>
                  {user.cards.map((card) => (
                    <tr key={card.cardId}>
                      <td>
                        <a className="adm-link" href={`/admin/cards/${card.cardId}`}>
                          ····{card.lastFour ?? "****"}
                        </a>
                        <span className="adm-cell-sub">{card.cardId}</span>
                      </td>
                      <td>
                        <Badge tone={card.status === "active" ? "success" : "neutral"}>{card.status}</Badge>
                      </td>
                      <td>{card.isDemo ? "Да" : "Нет"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {user.cards.length === 0 && <Empty>Карт пока нет.</Empty>}
            </div>
          </Panel>
          <Panel title="Последние платежи">
            <div className="adm-table">
              <table>
                <thead>
                  <tr>
                    <th>Платёж</th>
                    <th>Статус</th>
                    <th>Сумма</th>
                    <th>Дата</th>
                  </tr>
                </thead>
                <tbody>
                  {user.payments.map((payment) => (
                    <tr key={payment.paymentId}>
                      <td>{payment.paymentId.slice(0, 8)}</td>
                      <td>
                        <Badge tone={payment.status === "succeeded" ? "success" : "danger"}>{payment.status}</Badge>
                      </td>
                      <td>
                        {(payment.amountMinor / 100).toLocaleString("ru-RU")} {payment.currency}
                      </td>
                      <td>{new Date(payment.createdAt).toLocaleDateString("ru-RU")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {user.payments.length === 0 && <Empty>Платежей пока нет.</Empty>}
            </div>
          </Panel>
          <Panel title="Заметки и теги">
            <UserNotesTags userId={user.userId} />
          </Panel>
        </>
      )}
      <ActionDialog
        open={action !== null}
        title={action ? actionLabels[action] : ""}
        description="Действие будет записано в журнал аудита."
        fields={[
          { name: "reason", label: "Причина", type: "textarea", required: true, placeholder: "Минимум 3 символа" },
        ]}
        confirmLabel="Подтвердить"
        danger={action === "delete" || action === "block"}
        busy={busy}
        error={error}
        onCancel={() => setAction(null)}
        onConfirm={(values) => run(values.reason ?? "")}
      />
    </Page>
  );
}
