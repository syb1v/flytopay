"use client";

import { useCallback, useEffect, useState } from "react";
import {
  adminPayoutDecision,
  getAdminPayouts,
  getAdminReferralOverview,
  getAdminReferralPartners,
  getAdminReferralTree,
  updateAdminReferralSettings,
  type AdminPayout,
  type AdminReferralOverview,
  type AdminReferralPartner,
  type AdminReferralTreeItem,
} from "../../lib/api";

const date = (value: string | null) =>
  value ? new Date(value).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" }) : "—";
const statusLabels: Record<string, string> = {
  pending: "Ожидает",
  approved: "Одобрена",
  rejected: "Отклонена",
  active: "Активна",
  paid: "Выплачено",
};

export default function ReferralsAdmin() {
  const [overview, setOverview] = useState<AdminReferralOverview | null>(null);
  const [payouts, setPayouts] = useState<AdminPayout[]>([]);
  const [partners, setPartners] = useState<AdminReferralPartner[]>([]);
  const [commission, setCommission] = useState("0");
  const [minimum, setMinimum] = useState("0");
  const [enabled, setEnabled] = useState(false);
  const [treeUser, setTreeUser] = useState("");
  const [tree, setTree] = useState<AdminReferralTreeItem[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    getAdminReferralOverview()
      .then((data) => {
        setOverview(data);
        setCommission(String(data.settings?.commissionBps ?? 0));
        setMinimum(String(data.settings?.minimumPayoutMinor ?? 0));
        setEnabled(data.settings?.enabled ?? false);
      })
      .catch(() => setOverview(null));
    getAdminPayouts()
      .then(setPayouts)
      .catch(() => setPayouts([]));
    getAdminReferralPartners()
      .then(setPartners)
      .catch(() => setPartners([]));
  }, []);

  useEffect(() => load(), [load]);

  const saveSettings = async () => {
    setBusy(true);
    try {
      await updateAdminReferralSettings({
        commission_bps: Number(commission) || 0,
        minimum_payout_minor: Number(minimum) || 0,
        currency: "USD",
        is_enabled: enabled,
      });
      setMessage("Настройки реферальной программы сохранены");
      load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось сохранить настройки");
    } finally {
      setBusy(false);
    }
  };
  const decide = async (id: string, action: "approve" | "reject") => {
    const reason = window.prompt("Причина решения (минимум 3 символа)");
    if (!reason || reason.trim().length < 3) return;
    setBusy(true);
    try {
      await adminPayoutDecision(id, action, reason.trim());
      setMessage("Статус выплаты обновлён");
      load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось изменить выплату");
    } finally {
      setBusy(false);
    }
  };
  const loadTree = async () => {
    if (!treeUser.trim()) return;
    setBusy(true);
    try {
      const result = await getAdminReferralTree(treeUser.trim());
      setTree(result.items);
    } catch (error) {
      setTree(null);
      setMessage(error instanceof Error ? error.message : "Не удалось загрузить дерево");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {overview && (
        <div className="admin-stat-grid admin-stat-grid-small">
          <article>
            <span>Реферальные ссылки</span>
            <strong>{overview.links}</strong>
          </article>
          <article>
            <span>Начислено</span>
            <strong>{(overview.accruedMinor / 100).toLocaleString("ru-RU")}</strong>
          </article>
          <article>
            <span>Выплачено</span>
            <strong>{(overview.paidMinor / 100).toLocaleString("ru-RU")}</strong>
          </article>
          <article>
            <span>Ожидают выплаты</span>
            <strong>{overview.pendingPayouts}</strong>
          </article>
        </div>
      )}
      <section className="admin-panel">
        <h2>Настройки программы</h2>
        <div className="admin-inline-editor">
          <label>
            Комиссия, basis points
            <input inputMode="numeric" value={commission} onChange={(event) => setCommission(event.target.value)} />
          </label>
          <label>
            Минимальная выплата, minor units
            <input inputMode="numeric" value={minimum} onChange={(event) => setMinimum(event.target.value)} />
          </label>
          <label className="admin-toggle">
            <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
            Программа включена
          </label>
          <div className="admin-dialog-actions">
            <button className="ui-button ui-button-primary" disabled={busy} onClick={saveSettings}>
              Сохранить
            </button>
          </div>
        </div>
      </section>
      {message && <p className="settings-muted">{message}</p>}
      <section className="admin-panel">
        <h2>Заявки на выплату</h2>
        <div className="admin-table">
          <div className="admin-table-head content-row">
            <span>Партнёр</span>
            <span>Сумма</span>
            <span>Создана</span>
            <span>Статус</span>
            <span>Действия</span>
          </div>
          {payouts.map((payout) => (
            <div className="admin-table-row content-row" key={payout.id}>
              <span>{payout.userId.slice(0, 8)}</span>
              <span>
                {(payout.amountMinor / 100).toLocaleString("ru-RU")} {payout.currency}
              </span>
              <span>{date(payout.createdAt)}</span>
              <span>
                <em
                  className={`admin-badge ${payout.status === "approved" ? "active" : payout.status === "rejected" ? "blocked" : "pending"}`}
                >
                  {statusLabels[payout.status] ?? payout.status}
                </em>
              </span>
              <span className="admin-row-actions">
                {payout.status === "pending" && (
                  <>
                    <button
                      className="ui-button ui-button-primary"
                      disabled={busy}
                      onClick={() => decide(payout.id, "approve")}
                    >
                      Одобрить
                    </button>
                    <button
                      className="ui-button ui-button-danger"
                      disabled={busy}
                      onClick={() => decide(payout.id, "reject")}
                    >
                      Отклонить
                    </button>
                  </>
                )}
              </span>
            </div>
          ))}
          {payouts.length === 0 && <p className="settings-muted">Заявок на выплату нет.</p>}
        </div>
      </section>
      <section className="admin-panel">
        <h2>Партнёры</h2>
        <div className="admin-table">
          <div className="admin-table-head content-row">
            <span>Партнёр</span>
            <span>Приглашено</span>
            <span>Начислено</span>
            <span>Выплачено</span>
            <span />
          </div>
          {partners.map((partner) => (
            <div className="admin-table-row content-row" key={partner.userId}>
              <span>
                <b>{partner.telegramId ?? partner.userId.slice(0, 8)}</b>
                <small>{partner.userId}</small>
              </span>
              <span>{partner.invited}</span>
              <span>{(partner.accruedMinor / 100).toLocaleString("ru-RU")}</span>
              <span>{(partner.paidMinor / 100).toLocaleString("ru-RU")}</span>
              <span className="admin-row-actions">
                <button
                  className="ui-button ui-button-secondary"
                  onClick={() => {
                    setTreeUser(partner.userId);
                    void getAdminReferralTree(partner.userId)
                      .then((result) => setTree(result.items))
                      .catch(() => setTree(null));
                  }}
                >
                  Дерево
                </button>
              </span>
            </div>
          ))}
          {partners.length === 0 && <p className="settings-muted">Партнёров пока нет.</p>}
        </div>
      </section>
      <section className="admin-panel">
        <h2>Реферальное дерево</h2>
        <div className="admin-toolbar-actions">
          <label className="admin-search">
            <input
              value={treeUser}
              onChange={(event) => setTreeUser(event.target.value)}
              placeholder="UUID пользователя"
            />
          </label>
          <button className="ui-button ui-button-secondary" disabled={busy} onClick={loadTree}>
            Показать
          </button>
        </div>
        {tree && (
          <div className="admin-table">
            <div className="admin-table-head sales-row">
              <span>Приглашённый</span>
              <span>Заработано</span>
              <span>Дата</span>
            </div>
            {tree.map((item) => (
              <div className="admin-table-row sales-row" key={item.linkId}>
                <span>{item.telegramId ?? item.referredUserId.slice(0, 8)}</span>
                <span>{(item.earnedMinor / 100).toLocaleString("ru-RU")}</span>
                <span>{date(item.createdAt)}</span>
              </div>
            ))}
            {tree.length === 0 && <p className="settings-muted">Приглашённых нет.</p>}
          </div>
        )}
      </section>
    </>
  );
}
