"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getAdminCampaigns, getAdminPromoCodes } from "../../../lib/api";
import type { AdminCampaign, AdminPromoCode } from "../../../lib/api";
import { Badge, Button, Empty, Page, Panel, StatGrid } from "../../../components/admin/ui";

export default function AdminMarketingPage() {
  const [campaigns, setCampaigns] = useState<AdminCampaign[]>([]);
  const [promos, setPromos] = useState<AdminPromoCode[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAdminCampaigns()
      .then(setCampaigns)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Не удалось загрузить кампании"));
    getAdminPromoCodes()
      .then(setPromos)
      .catch(() => setPromos([]));
  }, []);

  const totals = campaigns.reduce(
    (accumulator, campaign) => ({
      registrations: accumulator.registrations + campaign.registrations,
      conversions: accumulator.conversions + campaign.conversions,
      revenue: accumulator.revenue + campaign.revenueMinor,
    }),
    { registrations: 0, conversions: 0, revenue: 0 },
  );

  return (
    <Page
      title="Маркетинг"
      description="Рекламные кампании, атрибуция и промокоды"
      actions={
        <Button href="/admin/marketing/new" variant="primary">
          Создать кампанию
        </Button>
      }
    >
      {error && <p className="adm-modal-error">{error}</p>}
      <StatGrid
        items={[
          { label: "Кампании", value: campaigns.length },
          { label: "Регистрации", value: totals.registrations },
          { label: "Конверсии", value: totals.conversions },
          { label: "Выручка", value: `${(totals.revenue / 100).toLocaleString("ru-RU")} USD` },
          { label: "Промокоды", value: promos.length },
        ]}
      />
      <Panel title="Кампании">
        <div className="adm-table">
          <table>
            <thead>
              <tr>
                <th>Кампания</th>
                <th>Источник</th>
                <th>Регистрации</th>
                <th>Конверсии</th>
                <th>Выручка</th>
                <th>Статус</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign.id}>
                  <td>
                    <Link className="adm-link" href={`/admin/marketing/${campaign.id}`}>
                      {campaign.name}
                    </Link>
                    <span className="adm-cell-sub">{campaign.startParameter}</span>
                  </td>
                  <td>{campaign.source ?? "—"}</td>
                  <td>{campaign.registrations}</td>
                  <td>{campaign.conversions}</td>
                  <td>{(campaign.revenueMinor / 100).toLocaleString("ru-RU")}</td>
                  <td>
                    <Badge tone={campaign.isActive ? "success" : "neutral"}>
                      {campaign.isActive ? "Активна" : "Архив"}
                    </Badge>
                  </td>
                  <td>
                    <Link className="adm-link" href={`/admin/marketing/${campaign.id}`}>
                      Редактировать →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {campaigns.length === 0 && <Empty>Кампании пока не созданы.</Empty>}
        </div>
      </Panel>
      <Panel
        title="Промокоды"
        actions={
          <Button href="/admin/marketing/promocodes/new" variant="secondary">
            Создать промокод
          </Button>
        }
      >
        <div className="adm-table">
          <table>
            <thead>
              <tr>
                <th>Код</th>
                <th>Скидка</th>
                <th>Бонус</th>
                <th>Использований</th>
                <th>Статус</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {promos.map((promo) => (
                <tr key={promo.id}>
                  <td>
                    <Link className="adm-link" href={`/admin/marketing/promocodes/${promo.id}`}>
                      {promo.code}
                    </Link>
                  </td>
                  <td>{promo.discountBps / 100}%</td>
                  <td>
                    {(promo.bonusMinor / 100).toLocaleString("ru-RU")} {promo.currency}
                  </td>
                  <td>
                    {promo.redemptions}
                    {promo.maxRedemptions ? ` / ${promo.maxRedemptions}` : ""}
                  </td>
                  <td>
                    <Badge tone={promo.isActive ? "success" : "neutral"}>
                      {promo.isActive ? "Активен" : "Выключен"}
                    </Badge>
                  </td>
                  <td>
                    <Link className="adm-link" href={`/admin/marketing/promocodes/${promo.id}`}>
                      Редактировать →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {promos.length === 0 && <Empty>Промокоды пока не созданы.</Empty>}
        </div>
      </Panel>
    </Page>
  );
}
