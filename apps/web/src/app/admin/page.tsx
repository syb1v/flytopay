"use client";

import { useEffect, useState } from "react";
import { getAdminDashboard, getAdminFinanceSummary, getAdminSystemHealth } from "../../lib/api";
import type { AdminDashboard, AdminFinanceSummary, AdminSystemHealth } from "../../lib/api";
import { BarChart, Badge, Button, Empty, Page, Panel, StatGrid } from "../../components/admin/ui";

export default function AdminDashboardPage() {
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [finance, setFinance] = useState<AdminFinanceSummary | null>(null);
  const [health, setHealth] = useState<AdminSystemHealth | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAdminDashboard()
      .then(setDashboard)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Не удалось загрузить статистику"));
    getAdminFinanceSummary(30)
      .then(setFinance)
      .catch(() => setFinance(null));
    getAdminSystemHealth()
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  const totals = dashboard?.totals;
  return (
    <Page
      title="Обзор"
      description="Реальные показатели продукта, продаж и инфраструктуры"
      actions={
        <Button href="/admin/finance" variant="secondary">
          Финансовые отчёты
        </Button>
      }
    >
      {error && <p className="adm-modal-error">{error}</p>}
      {totals && (
        <StatGrid
          items={[
            { label: "Пользователи", value: totals.users, hint: `${totals.activeUsers} активных` },
            { label: "Новые за 30 дней", value: totals.newMonth, hint: `${totals.newToday} сегодня` },
            { label: "Карты", value: totals.cards, hint: `${totals.demoCards} demo` },
            { label: "Активные аренды", value: totals.activeRentals },
            { label: "Успешные платежи", value: totals.successfulPayments, hint: `${totals.failedPayments} ошибок` },
            { label: "Открытые сверки", value: totals.openReconciliation },
            { label: "Кошельки", value: totals.wallets },
            { label: "Выдача карт", value: totals.issuances },
          ]}
        />
      )}
      <Panel title="Динамика за 30 дней" actions={<Badge tone="success">Данные из базы</Badge>}>
        {dashboard ? (
          <BarChart
            points={dashboard.days.map((day) => ({ label: day.date, value: day.users, secondary: day.payments }))}
            label="Зелёный — пользователи, серый — платежи"
          />
        ) : (
          <Empty>Загрузка…</Empty>
        )}
      </Panel>
      <Panel
        title="Финансы за 30 дней"
        actions={
          <Button href="/admin/finance" variant="secondary">
            Подробнее
          </Button>
        }
      >
        {finance ? (
          <StatGrid
            items={[
              { label: "Оборот", value: `${(finance.grossMinor / 100).toLocaleString("ru-RU")} USD` },
              { label: "Успешные платежи", value: finance.orders },
              { label: "Средний чек", value: `${(finance.averageOrderMinor / 100).toLocaleString("ru-RU")} USD` },
              { label: "Ошибки", value: finance.failedPayments },
            ]}
          />
        ) : (
          <Empty>Загрузка…</Empty>
        )}
      </Panel>
      <Panel
        title="Состояние системы"
        actions={
          <Button href="/admin/system" variant="secondary">
            Открыть контроль
          </Button>
        }
      >
        {health ? (
          <div className="adm-stats">
            {health.services.map((service) => (
              <article className="adm-stat" key={service.name}>
                <span>{service.name}</span>
                <strong>{service.status === "available" ? "Доступен" : "Настроен"}</strong>
              </article>
            ))}
            <article className="adm-stat">
              <span>Ошибки за 24 часа</span>
              <strong>{health.errorsLast24h}</strong>
            </article>
            <article className="adm-stat">
              <span>Неудачные задачи</span>
              <strong>{health.failedJobs}</strong>
            </article>
          </div>
        ) : (
          <Empty>Состояние недоступно.</Empty>
        )}
      </Panel>
    </Page>
  );
}
