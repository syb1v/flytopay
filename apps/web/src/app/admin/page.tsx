"use client";

import { useEffect, useState } from "react";
import { Activity, BarChart3, LayoutDashboard, Package, Search, ServerCog, ShieldCheck, Users } from "lucide-react";
import {
  adminUserAction,
  getAdminActivity,
  getAdminDashboard,
  getAdminUser,
  getAdminUsers,
  getAdminSales,
  getAdminProducts,
  getAdminPrices,
  getAdminSystemHealth,
  type AdminActivity,
  type AdminDashboard,
  type AdminUser,
  type AdminUserDetails,
  type AdminSales,
  type AdminProduct,
  type AdminPrice,
  type AdminSystemHealth,
} from "../../lib/api";

const sections = [
  ["Обзор", LayoutDashboard],
  ["Пользователи", Users],
  ["Продажи", BarChart3],
  ["Цены и продукты", Package],
  ["Журнал действий", Activity],
  ["Система", ServerCog],
] as const;
const labels: Record<string, string> = {
  "user.block": "Блокировка пользователя",
  "user.unblock": "Разблокировка пользователя",
  "user.revoke_sessions": "Отзыв сессий",
};
const date = (value: string) => new Date(value).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" });

export default function AdminPage() {
  const [active, setActive] = useState("Обзор");
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [activity, setActivity] = useState<AdminActivity | null>(null);
  const [sales, setSales] = useState<AdminSales | null>(null);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [prices, setPrices] = useState<AdminPrice[]>([]);
  const [system, setSystem] = useState<AdminSystemHealth | null>(null);
  const [selected, setSelected] = useState<AdminUserDetails | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const result = await getAdminUsers({ q: query, status, page });
      setUsers(result.items);
      setUsersTotal(result.total);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось загрузить пользователей");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    getAdminDashboard()
      .then(setDashboard)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Не удалось загрузить статистику"));
  }, []);
  useEffect(() => {
    if (active === "Пользователи") void loadUsers();
    if (active === "Журнал действий")
      getAdminActivity()
        .then(setActivity)
        .catch(() => setActivity(null));
    if (active === "Продажи")
      getAdminSales()
        .then(setSales)
        .catch(() => setSales(null));
    if (active === "Цены и продукты")
      getAdminProducts()
        .then(setProducts)
        .catch(() => setProducts([]));
    if (active === "Система")
      getAdminSystemHealth()
        .then(setSystem)
        .catch(() => setSystem(null));
  }, [active, page]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (active === "Пользователи") {
        setPage(1);
        void loadUsers();
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, status]);

  if (error)
    return (
      <main className="admin-standalone-error">
        <ShieldCheck size={42} />
        <h1>{error === "admin_forbidden" ? "Доступ запрещён" : "Не удалось загрузить панель"}</h1>
        <p>
          {error === "admin_forbidden"
            ? "Для просмотра панели необходимы права администратора."
            : "Попробуйте обновить страницу или обратитесь к владельцу системы."}
        </p>
      </main>
    );
  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <a className="dashboard-brand" href="/">
          <img src="/logo.svg" alt="" />
          Flytopay
        </a>
        <p className="admin-kicker">УПРАВЛЕНИЕ</p>
        <nav>
          {sections.map(([label, Icon]) => (
            <button className={active === label ? "active" : ""} key={label} onClick={() => setActive(label)}>
              <Icon size={17} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </aside>
      <section className="admin-content">
        <header className="admin-header">
          <div>
            <span className="dashboard-eyebrow">ЦЕНТР УПРАВЛЕНИЯ FLYTOPAY</span>
            <h1>{active}</h1>
          </div>
          {active === "Пользователи" && (
            <label className="admin-search">
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Поиск по ID, username или UUID"
              />
            </label>
          )}
        </header>
        {active === "Обзор" && dashboard && <Dashboard dashboard={dashboard} />}
        {active === "Пользователи" && (
          <UsersView
            users={users}
            total={usersTotal}
            page={page}
            onPageChange={setPage}
            status={status}
            setStatus={setStatus}
            loading={loading}
            onOpen={(id) => getAdminUser(id).then(setSelected)}
          />
        )}
        {active === "Журнал действий" && <ActivityView activity={activity} />}
        {active === "Продажи" && <SalesView sales={sales} />}
        {active === "Цены и продукты" && <CatalogView products={products} prices={prices} setPrices={setPrices} />}
        {active === "Система" && <SystemView system={system} />}
      </section>
      {selected && (
        <UserDialog
          user={selected}
          onClose={() => setSelected(null)}
          onAction={async (action, reason) => {
            await adminUserAction(selected.userId, action, reason);
            setSelected(null);
            void loadUsers();
          }}
        />
      )}
    </main>
  );
}

function SalesView({ sales }: { sales: AdminSales | null }) {
  const total = sales?.items.reduce((sum, item) => sum + item.amountMinor, 0) ?? 0;
  const orders = sales?.items.reduce((sum, item) => sum + item.orders, 0) ?? 0;
  return (
    <section className="admin-panel">
      <div className="admin-stat-grid admin-stat-grid-small">
        <article>
          <span>Выручка за 30 дней</span>
          <strong>{(total / 100).toLocaleString("ru-RU")} USD</strong>
        </article>
        <article>
          <span>Успешные заказы</span>
          <strong>{orders}</strong>
        </article>
        <article>
          <span>Средний чек</span>
          <strong>{orders ? Math.round(total / orders / 100).toLocaleString("ru-RU") : 0} USD</strong>
        </article>
      </div>
      <h2>Продажи по дням</h2>
      <div className="admin-table">
        <div className="admin-table-head">
          <span>Период</span>
          <span>Заказы</span>
          <span>Сумма</span>
        </div>
        {sales?.items.map((item) => (
          <div className="admin-table-row sales-row" key={item.key}>
            <span>{item.key}</span>
            <span>{item.orders}</span>
            <span>{(item.amountMinor / 100).toLocaleString("ru-RU")} USD</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function CatalogView({
  products,
  prices,
  setPrices,
}: {
  products: AdminProduct[];
  prices: AdminPrice[];
  setPrices: (prices: AdminPrice[]) => void;
}) {
  return (
    <section className="admin-panel">
      <div className="admin-toolbar">
        <div>
          <h2>Карточные продукты и цены</h2>
          <p className="settings-muted">Реальные продукты из каталога 2328 и активные версии цен</p>
        </div>
      </div>
      <div className="admin-table">
        <div className="admin-table-head">
          <span>Продукт</span>
          <span>Схема</span>
          <span>Валюта</span>
          <span>Статус</span>
          <span>Цены</span>
        </div>
        {products.map((product) => (
          <button
            className="admin-table-row"
            key={product.id}
            onClick={() => getAdminPrices(product.id).then(setPrices)}
          >
            <span>
              <b>{product.name}</b>
              <small>{product.code}</small>
            </span>
            <span>{product.scheme}</span>
            <span>{product.currency}</span>
            <span>
              <em className={`admin-badge ${product.enabled ? "active" : "blocked"}`}>
                {product.enabled ? "Включён" : "Выключен"}
              </em>
            </span>
            <span>Открыть →</span>
          </button>
        ))}
      </div>
      {prices.length > 0 && (
        <div className="admin-price-panel">
          <h3>История цен</h3>
          {prices.map((price) => (
            <div className="admin-price-row" key={price.id}>
              <span>{price.termDays} дней</span>
              <b>
                {(price.amountMinor / 100).toLocaleString("ru-RU")} {price.currency}
              </b>
              <small>{price.isActive ? "Активна" : "Архив"}</small>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SystemView({ system }: { system: AdminSystemHealth | null }) {
  return (
    <section className="admin-panel">
      <div className="section-heading">
        <h2>Контроль API и системы</h2>
        <span className="status-dot">
          <i />
          Без секретов в браузере
        </span>
      </div>
      <div className="admin-system-grid">
        {system?.services.map((service) => (
          <article key={service.name}>
            <span>{service.name}</span>
            <b>{service.status === "available" ? "Доступен" : "Настроен"}</b>
          </article>
        ))}
      </div>
      <div className="admin-status-row">
        <span>Ошибки за 24 часа</span>
        <b>{system?.errorsLast24h ?? "—"}</b>
        <small>Из журнала backend</small>
      </div>
      <div className="admin-status-row">
        <span>Неудачные задачи</span>
        <b>{system?.failedJobs ?? "—"}</b>
        <small>Celery/admin jobs</small>
      </div>
    </section>
  );
}

function Dashboard({ dashboard }: { dashboard: AdminDashboard }) {
  const t = dashboard.totals;
  const cards = [
    ["Пользователи", t.users],
    ["Активные пользователи", t.activeUsers],
    ["Новые за 30 дней", t.newMonth],
    ["Карты", t.cards],
    ["Активные аренды", t.activeRentals],
    ["Платежи", t.payments],
    ["Успешные платежи", t.successfulPayments],
    ["Кошельки", t.wallets],
  ];
  return (
    <>
      <div className="admin-stat-grid">
        {cards.map(([label, value]) => (
          <article key={label as string}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
      <section className="admin-panel">
        <div className="section-heading">
          <h2>Динамика за 30 дней</h2>
          <span className="status-dot">
            <i />
            Данные из базы
          </span>
        </div>
        <div className="admin-chart">
          {dashboard.days.map((day) => (
            <div
              className="admin-chart-column"
              key={day.date}
              title={`${day.date}: ${day.users} пользователей, ${day.payments} платежей`}
            >
              <i style={{ height: `${Math.max(4, Math.min(100, day.users * 8 + day.payments * 3))}%` }} />
            </div>
          ))}
        </div>
        <div className="admin-chart-legend">
          <span>
            <i className="users-legend" />
            Пользователи
          </span>
          <span>
            <i className="payments-legend" />
            Платежи и выпуск
          </span>
        </div>
      </section>
    </>
  );
}

function UsersView({
  users,
  total,
  page,
  onPageChange,
  status,
  setStatus,
  loading,
  onOpen,
}: {
  users: AdminUser[];
  total: number;
  page: number;
  onPageChange: (value: number) => void;
  status: string;
  setStatus: (value: string) => void;
  loading: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <section className="admin-panel">
      <div className="admin-toolbar">
        <div>
          <h2>Пользователи</h2>
          <p className="settings-muted">Поиск и управление доступом</p>
        </div>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">Все статусы</option>
          <option value="active">Активные</option>
          <option value="blocked">Заблокированные</option>
        </select>
      </div>
      <div className="admin-table admin-users-table">
        <div className="admin-table-head">
          <span>Пользователь</span>
          <span>Telegram</span>
          <span>Статус</span>
          <span>Регистрация</span>
          <span />
        </div>
        {loading && <p className="settings-muted">Загрузка...</p>}
        {!loading &&
          users.map((user) => (
            <button className="admin-table-row" key={user.userId} onClick={() => onOpen(user.userId)}>
              <span>
                <b>{user.username ? `@${user.username}` : "Без username"}</b>
                <small>{user.userId}</small>
              </span>
              <span>{user.telegramId ?? "—"}</span>
              <span>
                <em className={`admin-badge ${user.status}`}>
                  {user.status === "active" ? "Активен" : user.status === "blocked" ? "Заблокирован" : user.status}
                </em>
              </span>
              <span>{date(user.createdAt)}</span>
              <span>→</span>
            </button>
          ))}
        {!loading && users.length === 0 && <p className="settings-muted">Пользователи не найдены.</p>}
      </div>
      {total > 20 && (
        <div className="admin-pagination">
          <button disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            ← Назад
          </button>
          <span>
            Страница {page} из {Math.ceil(total / 20)}
          </span>
          <button disabled={page >= Math.ceil(total / 20)} onClick={() => onPageChange(page + 1)}>
            Вперёд →
          </button>
        </div>
      )}
    </section>
  );
}

function ActivityView({ activity }: { activity: AdminActivity | null }) {
  return (
    <section className="admin-panel">
      <h2>Журнал действий</h2>
      <div className="admin-table admin-users-table">
        <div className="admin-table-head">
          <span>Действие</span>
          <span>Пользователь</span>
          <span>Причина</span>
          <span>Дата</span>
        </div>
        {activity?.items.map((event, index) => (
          <div className="admin-table-row" key={`${event.createdAt}-${index}`}>
            <span>
              <b>{labels[event.action] ?? event.action}</b>
              <small>{event.resourceId ?? "—"}</small>
            </span>
            <span>{event.actorUserId ?? "—"}</span>
            <span>{event.reason || "—"}</span>
            <span>{date(event.createdAt)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function UserDialog({
  user,
  onClose,
  onAction,
}: {
  user: AdminUserDetails;
  onClose: () => void;
  onAction: (action: "block" | "unblock" | "revoke-sessions", reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const action = async (name: "block" | "unblock" | "revoke-sessions") => {
    if (reason.trim().length < 3) return;
    setBusy(true);
    try {
      await onAction(name, reason);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="admin-dialog-backdrop" onClick={onClose}>
      <section className="admin-dialog" onClick={(event) => event.stopPropagation()}>
        <button className="admin-dialog-close" onClick={onClose}>
          ×
        </button>
        <span className={`admin-badge ${user.status}`}>{user.status === "active" ? "Активен" : "Заблокирован"}</span>
        <h2>Профиль пользователя</h2>
        <p className="settings-muted">{user.userId}</p>
        <div className="admin-detail-grid">
          <div>
            <small>Telegram</small>
            <b>{user.accounts.map((account) => `@${account.username ?? account.telegramId}`).join(", ") || "—"}</b>
          </div>
          <div>
            <small>Карты</small>
            <b>{user.cards.length}</b>
          </div>
          <div>
            <small>Платежи</small>
            <b>{user.payments.length}</b>
          </div>
          <div>
            <small>Аренды</small>
            <b>{user.rentalCount}</b>
          </div>
        </div>
        <label className="admin-reason">
          Причина действия
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Укажите причину (минимум 3 символа)"
          />
        </label>
        <div className="admin-dialog-actions">
          <button
            className="ui-button ui-button-secondary"
            disabled={busy || reason.trim().length < 3}
            onClick={() => action("revoke-sessions")}
          >
            Отозвать сессии
          </button>
          {user.status === "blocked" ? (
            <button
              className="ui-button ui-button-primary"
              disabled={busy || reason.trim().length < 3}
              onClick={() => action("unblock")}
            >
              Разблокировать
            </button>
          ) : (
            <button
              className="ui-button ui-button-danger"
              disabled={busy || reason.trim().length < 3}
              onClick={() => action("block")}
            >
              Заблокировать
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
