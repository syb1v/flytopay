"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  adminPayoutDecision,
  getAdminPayouts,
  getAdminReferralOverview,
  getAdminReferralPartners,
  getAdminReferralTree,
  updateAdminReferralSettings,
} from "../../../lib/api";
import type { AdminPayout, AdminReferralOverview, AdminReferralPartner, AdminReferralTreeItem } from "../../../lib/api";
import {
  ActionDialog,
  Badge,
  Button,
  Empty,
  Field,
  Page,
  Panel,
  StatGrid,
  Tabs,
  TextInput,
} from "../../../components/admin/ui";

const tabs = [
  { key: "settings", label: "Настройки" },
  { key: "payouts", label: "Выплаты" },
  { key: "partners", label: "Партнёры" },
  { key: "tree", label: "Дерево" },
];

export default function AdminReferralsPage() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "settings";
  const [overview, setOverview] = useState<AdminReferralOverview | null>(null);
  const [payouts, setPayouts] = useState<AdminPayout[]>([]);
  const [partners, setPartners] = useState<AdminReferralPartner[]>([]);
  const [commission, setCommission] = useState("0");
  const [minimum, setMinimum] = useState("0");
  const [enabled, setEnabled] = useState(false);
  const [decision, setDecision] = useState<{ id: string; action: "approve" | "reject" } | null>(null);
  const [treeUser, setTreeUser] = useState("");
  const [tree, setTree] = useState<AdminReferralTreeItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
    try {
      await updateAdminReferralSettings({
        commission_bps: Number(commission) || 0,
        minimum_payout_minor: Number(minimum) || 0,
        currency: "USD",
        is_enabled: enabled,
      });
      setMessage("Настройки сохранены");
      load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить настройки");
    } finally {
      setBusy(false);
    }
  };
  const runDecision = async (reason: string) => {
    if (!decision || reason.trim().length < 3) return;
    setBusy(true);
    setError(null);
    try {
      await adminPayoutDecision(decision.id, decision.action, reason.trim());
      setDecision(null);
      setMessage("Статус выплаты обновлён");
      load();
    } catch (reasonValue) {
      setError(reasonValue instanceof Error ? reasonValue.message : "Не удалось обновить выплату");
    } finally {
      setBusy(false);
    }
  };
  const loadTree = async (userId: string) => {
    if (!userId.trim()) return;
    setBusy(true);
    try {
      const result = await getAdminReferralTree(userId.trim());
      setTree(result.items);
    } catch (reason) {
      setTree(null);
      setError(reason instanceof Error ? reason.message : "Не удалось загрузить дерево");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title="Рефералы" description="Программа, выплаты и партнёрская статистика">
      {message && <p className="adm-page-sub">{message}</p>}
      {error && !decision && <p className="adm-modal-error">{error}</p>}
      {overview && (
        <StatGrid
          items={[
            { label: "Ссылки", value: overview.links },
            { label: "Начислено", value: `${(overview.accruedMinor / 100).toLocaleString("ru-RU")} USD` },
            { label: "Выплачено", value: `${(overview.paidMinor / 100).toLocaleString("ru-RU")} USD` },
            { label: "Ожидают выплаты", value: overview.pendingPayouts },
          ]}
        />
      )}
      <Tabs base="/admin/referrals" tabs={tabs} />
      {tab === "settings" && (
        <Panel title="Настройки программы">
          <div className="adm-form-grid">
            <Field label="Комиссия, basis points" hint="1000 = 10%">
              <TextInput
                inputMode="numeric"
                value={commission}
                onChange={(event) => setCommission(event.target.value)}
              />
            </Field>
            <Field label="Минимальная выплата, minor units">
              <TextInput inputMode="numeric" value={minimum} onChange={(event) => setMinimum(event.target.value)} />
            </Field>
            <Field label="Статус">
              <label className="adm-toggle">
                <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
                Программа включена
              </label>
            </Field>
          </div>
          <div className="adm-panel-actions" style={{ marginTop: 16 }}>
            <Button variant="primary" busy={busy} onClick={saveSettings}>
              Сохранить
            </Button>
          </div>
        </Panel>
      )}
      {tab === "payouts" && (
        <Panel title="Заявки на выплату">
          <div className="adm-table">
            <table>
              <thead>
                <tr>
                  <th>Партнёр</th>
                  <th>Сумма</th>
                  <th>Создана</th>
                  <th>Статус</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((payout) => (
                  <tr key={payout.id}>
                    <td>{payout.userId.slice(0, 8)}</td>
                    <td>
                      {(payout.amountMinor / 100).toLocaleString("ru-RU")} {payout.currency}
                    </td>
                    <td>{new Date(payout.createdAt).toLocaleDateString("ru-RU")}</td>
                    <td>
                      <Badge
                        tone={
                          payout.status === "approved" ? "success" : payout.status === "rejected" ? "danger" : "warning"
                        }
                      >
                        {payout.status}
                      </Badge>
                    </td>
                    <td>
                      <div className="adm-cell-actions">
                        {payout.status === "pending" && (
                          <>
                            <Button variant="primary" onClick={() => setDecision({ id: payout.id, action: "approve" })}>
                              Одобрить
                            </Button>
                            <Button variant="danger" onClick={() => setDecision({ id: payout.id, action: "reject" })}>
                              Отклонить
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {payouts.length === 0 && <Empty>Заявок на выплату нет.</Empty>}
          </div>
        </Panel>
      )}
      {tab === "partners" && (
        <Panel title="Партнёры">
          <div className="adm-table">
            <table>
              <thead>
                <tr>
                  <th>Партнёр</th>
                  <th>Приглашено</th>
                  <th>Начислено</th>
                  <th>Выплачено</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {partners.map((partner) => (
                  <tr key={partner.userId}>
                    <td>
                      {partner.telegramId ?? partner.userId.slice(0, 8)}
                      <span className="adm-cell-sub">{partner.userId}</span>
                    </td>
                    <td>{partner.invited}</td>
                    <td>{(partner.accruedMinor / 100).toLocaleString("ru-RU")}</td>
                    <td>{(partner.paidMinor / 100).toLocaleString("ru-RU")}</td>
                    <td>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setTreeUser(partner.userId);
                          void loadTree(partner.userId);
                        }}
                      >
                        Дерево
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {partners.length === 0 && <Empty>Партнёров пока нет.</Empty>}
          </div>
        </Panel>
      )}
      {tab === "tree" && (
        <Panel title="Реферальное дерево">
          <div className="adm-form-grid">
            <Field label="UUID партнёра">
              <TextInput value={treeUser} onChange={(event) => setTreeUser(event.target.value)} placeholder="UUID" />
            </Field>
          </div>
          <div className="adm-panel-actions" style={{ marginTop: 12 }}>
            <Button variant="secondary" busy={busy} onClick={() => loadTree(treeUser)}>
              Показать
            </Button>
          </div>
          {tree && (
            <div className="adm-table" style={{ marginTop: 16 }}>
              <table>
                <thead>
                  <tr>
                    <th>Приглашённый</th>
                    <th>Заработано</th>
                    <th>Дата</th>
                  </tr>
                </thead>
                <tbody>
                  {tree.map((item) => (
                    <tr key={item.linkId}>
                      <td>{item.telegramId ?? item.referredUserId.slice(0, 8)}</td>
                      <td>{(item.earnedMinor / 100).toLocaleString("ru-RU")}</td>
                      <td>{new Date(item.createdAt).toLocaleDateString("ru-RU")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {tree.length === 0 && <Empty>Приглашённых нет.</Empty>}
            </div>
          )}
        </Panel>
      )}
      <ActionDialog
        open={decision !== null}
        title={decision?.action === "approve" ? "Одобрить выплату" : "Отклонить выплату"}
        fields={[{ name: "reason", label: "Причина", type: "textarea", required: true }]}
        confirmLabel="Подтвердить"
        danger={decision?.action === "reject"}
        busy={busy}
        error={error}
        onCancel={() => setDecision(null)}
        onConfirm={(values) => runDecision(values.reason ?? "")}
      />
    </Page>
  );
}
