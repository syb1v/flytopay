"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  CreditCard,
  FileText,
  LayoutDashboard,
  Megaphone,
  Package,
  Search,
  ServerCog,
  SendHorizonal,
  ShieldCheck,
  Users,
  WalletCards,
} from "lucide-react";
import {
  adminUserAction,
  getAdminDashboard,
  getAdminUser,
  getAdminUsers,
  getAdminSales,
  getAdminProducts,
  getAdminPrices,
  getAdminCampaigns,
  getAdminPromoCodes,
  getAdminDocuments,
  getAdminTemplates,
  updateAdminPromo,
  archiveAdminPromo,
  updateAdminDocument,
  deleteAdminDocument,
  updateAdminTemplate,
  adminRestoreUser,
  adminDeleteUser,
  adminBulkUsers,
  getAdminUserStats,
  updateAdminProduct,
  updateAdminFees,
  updateAdminCampaign,
  archiveAdminCampaign,
  createAdminCampaign,
  createAdminPromo,
  createAdminDocument,
  createAdminTemplate,
  type AdminDashboard,
  type AdminUser,
  type AdminUserDetails,
  type AdminSales,
  type AdminProduct,
  type AdminPrice,
  type AdminCampaign,
  type AdminPromoCode,
  type AdminContentDocument,
  type AdminTemplate,
  type AdminUserStats,
} from "../../lib/api";
import CardsAdmin from "../../components/admin/CardsAdmin";
import FinanceAdmin from "../../components/admin/FinanceAdmin";
import ReferralsAdmin from "../../components/admin/ReferralsAdmin";
import BroadcastsAdmin from "../../components/admin/BroadcastsAdmin";
import SystemAdmin from "../../components/admin/SystemAdmin";
import SecurityAdmin from "../../components/admin/SecurityAdmin";

const sections = [
  ["Обзор", LayoutDashboard],
  ["Пользователи", Users],
  ["Продажи", BarChart3],
  ["Карты", CreditCard],
  ["Платежи и возвраты", WalletCards],
  ["Цены и продукты", Package],
  ["Маркетинг", Megaphone],
  ["Рефералы", Users],
  ["Контент и рассылки", FileText],
  ["Рассылки", SendHorizonal],
  ["Безопасность", ShieldCheck],
  ["Система", ServerCog],
] as const;
const date = (value: string) => new Date(value).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" });

export default function AdminPage() {
  const [active, setActive] = useState("Обзор");
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [sales, setSales] = useState<AdminSales | null>(null);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [prices, setPrices] = useState<AdminPrice[]>([]);
  const [campaigns, setCampaigns] = useState<AdminCampaign[]>([]);
  const [promos, setPromos] = useState<AdminPromoCode[]>([]);
  const [documents, setDocuments] = useState<AdminContentDocument[]>([]);
  const [templates, setTemplates] = useState<AdminTemplate[]>([]);
  const [userStats, setUserStats] = useState<AdminUserStats | null>(null);
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
  const loadMarketing = async () => {
    getAdminCampaigns()
      .then(setCampaigns)
      .catch(() => setCampaigns([]));
    getAdminPromoCodes()
      .then(setPromos)
      .catch(() => setPromos([]));
  };
  const loadContent = async () => {
    getAdminDocuments()
      .then(setDocuments)
      .catch(() => setDocuments([]));
    getAdminTemplates()
      .then(setTemplates)
      .catch(() => setTemplates([]));
  };
  useEffect(() => {
    getAdminDashboard()
      .then(setDashboard)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Не удалось загрузить статистику"));
  }, []);
  useEffect(() => {
    if (active === "Пользователи") void loadUsers();
    if (active === "Пользователи")
      getAdminUserStats()
        .then(setUserStats)
        .catch(() => setUserStats(null));
    if (active === "Продажи")
      getAdminSales()
        .then(setSales)
        .catch(() => setSales(null));
    if (active === "Цены и продукты")
      getAdminProducts()
        .then(setProducts)
        .catch(() => setProducts([]));
    if (active === "Маркетинг") void loadMarketing();
    if (active === "Контент и рассылки") void loadContent();
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
            userStats={userStats}
            total={usersTotal}
            page={page}
            onPageChange={setPage}
            status={status}
            setStatus={setStatus}
            loading={loading}
            onOpen={(id) => getAdminUser(id).then(setSelected)}
            onBulkDone={() => void loadUsers()}
          />
        )}
        {active === "Безопасность" && <SecurityAdmin />} {active === "Продажи" && <SalesView sales={sales} />}
        {active === "Карты" && <CardsAdmin />}
        {active === "Цены и продукты" && <CatalogView products={products} prices={prices} setPrices={setPrices} />}
        {active === "Система" && <SystemAdmin />}
        {active === "Маркетинг" && <MarketingView campaigns={campaigns} promos={promos} onChanged={loadMarketing} />}
        {active === "Контент и рассылки" && (
          <ContentView documents={documents} templates={templates} onChanged={loadContent} />
        )}
        {active === "Платежи и возвраты" && <FinanceAdmin />}
        {active === "Рефералы" && <ReferralsAdmin />}
        {active === "Рассылки" && <BroadcastsAdmin />}
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
          onRestore={async (reason) => {
            await adminRestoreUser(selected.userId, reason);
            setSelected(null);
            void loadUsers();
          }}
          onDelete={async (reason) => {
            await adminDeleteUser(selected.userId, reason);
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
  const [editing, setEditing] = useState<AdminProduct | null>(null);
  const [name, setName] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [fee, setFee] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!editing || !name.trim()) return;
    setSaving(true);
    try {
      await updateAdminProduct(editing.id, {
        name: name.trim(),
        enabled,
        max_cards_per_cardholder: editing.maxCardsPerCardholder,
      });
      if (fee.trim())
        await updateAdminFees(editing.id, {
          issue_fee_minor: Number(fee),
          fund_fee_bps: 0,
          unload_fee_bps: 0,
          currency: editing.currency,
          scale: 2,
        });
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };
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
            onClick={() => {
              getAdminPrices(product.id).then(setPrices);
              setEditing(product);
              setName(product.name);
              setEnabled(product.enabled);
              setFee("");
            }}
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
      {editing && (
        <div className="admin-inline-editor">
          <h3>Редактировать продукт</h3>
          <label>
            Название
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="admin-toggle">
            <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Продукт
            доступен пользователям
          </label>
          <label>
            Комиссия выпуска, minor units
            <input inputMode="numeric" value={fee} onChange={(event) => setFee(event.target.value)} placeholder="0" />
          </label>
          <div className="admin-dialog-actions">
            <button className="ui-button ui-button-secondary" onClick={() => setEditing(null)}>
              Отмена
            </button>
            <button className="ui-button ui-button-primary" disabled={saving} onClick={save}>
              {saving ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function MarketingView({
  campaigns,
  promos,
  onChanged,
}: {
  campaigns: AdminCampaign[];
  promos: AdminPromoCode[];
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<AdminCampaign | null>(null);
  const [name, setName] = useState("");
  const [promoEditing, setPromoEditing] = useState<AdminPromoCode | null>(null);
  const [creating, setCreating] = useState<"campaign" | "promo" | null>(null);
  const [form, setForm] = useState({ name: "", startParameter: "", source: "", code: "", discount: "10", bonus: "0" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const create = async () => {
    setBusy(true);
    setMessage(null);
    try {
      if (creating === "campaign") {
        if (!form.name.trim() || !form.startParameter.trim()) return;
        await createAdminCampaign({
          name: form.name.trim(),
          start_parameter: form.startParameter.trim(),
          source: form.source.trim() || null,
          channel: null,
          budget_minor: null,
          currency: "USD",
        });
      } else {
        if (!form.code.trim()) return;
        await createAdminPromo({
          code: form.code.trim().toUpperCase(),
          discount_bps: Number(form.discount) || 0,
          bonus_minor: Number(form.bonus) || 0,
          currency: "USD",
          max_redemptions: null,
        });
      }
      setCreating(null);
      setForm({ name: "", startParameter: "", source: "", code: "", discount: "10", bonus: "0" });
      onChanged();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Не удалось создать запись");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <section className="admin-panel">
        <div className="admin-toolbar">
          <div className="section-heading">
            <h2>Рекламные кампании</h2>
            <span className="status-dot">
              <i />
              Атрибуция
            </span>
          </div>
          <button
            className="ui-button ui-button-primary"
            onClick={() => setCreating(creating === "campaign" ? null : "campaign")}
          >
            Создать кампанию
          </button>
        </div>
        {creating === "campaign" && (
          <div className="admin-inline-editor">
            <h3>Новая кампания</h3>
            <label>
              Название
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </label>
            <label>
              Start parameter
              <input
                value={form.startParameter}
                onChange={(event) => setForm({ ...form, startParameter: event.target.value })}
                placeholder="spring_sale"
              />
            </label>
            <label>
              Источник
              <input
                value={form.source}
                onChange={(event) => setForm({ ...form, source: event.target.value })}
                placeholder="telegram"
              />
            </label>
            <div className="admin-dialog-actions">
              <button className="ui-button ui-button-secondary" onClick={() => setCreating(null)}>
                Отмена
              </button>
              <button className="ui-button ui-button-primary" disabled={busy} onClick={create}>
                Создать
              </button>
            </div>
          </div>
        )}
        <div className="admin-table">
          <div className="admin-table-head">
            <span>Кампания</span>
            <span>Источник</span>
            <span>Регистрации</span>
            <span>Конверсии</span>
            <span>Выручка</span>
          </div>
          {campaigns.map((campaign) => (
            <button
              className="admin-table-row"
              key={campaign.id}
              onClick={() => {
                setEditing(campaign);
                setName(campaign.name);
              }}
            >
              <span>
                <b>{campaign.name}</b>
                <small>{campaign.startParameter}</small>
              </span>
              <span>{campaign.source ?? "—"}</span>
              <span>{campaign.registrations}</span>
              <span>{campaign.conversions}</span>
              <span>
                {(campaign.revenueMinor / 100).toLocaleString("ru-RU")} {campaign.source ? "USD" : ""}
              </span>
            </button>
          ))}
        </div>
        {campaigns.length === 0 && <p className="settings-muted">Кампании пока не созданы.</p>}
      </section>
      {editing && (
        <div className="admin-inline-editor">
          <h3>Кампания: {editing.startParameter}</h3>
          <label>
            Название
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <div className="admin-dialog-actions">
            <button className="ui-button ui-button-secondary" onClick={() => setEditing(null)}>
              Отмена
            </button>
            <button
              className="ui-button ui-button-primary"
              onClick={async () => {
                await updateAdminCampaign(editing.id, {
                  name,
                  source: editing.source,
                  channel: editing.channel,
                  is_active: editing.isActive,
                });
                setEditing(null);
                onChanged();
              }}
            >
              Сохранить
            </button>
            <button
              className="ui-button ui-button-danger"
              onClick={async () => {
                await archiveAdminCampaign(editing.id);
                setEditing(null);
                onChanged();
              }}
            >
              Архивировать
            </button>
          </div>
        </div>
      )}
      <section className="admin-panel">
        <div className="admin-toolbar">
          <h2>Промокоды</h2>
          <button
            className="ui-button ui-button-primary"
            onClick={() => setCreating(creating === "promo" ? null : "promo")}
          >
            Создать промокод
          </button>
        </div>
        {creating === "promo" && (
          <div className="admin-inline-editor">
            <h3>Новый промокод</h3>
            <label>
              Код
              <input
                value={form.code}
                onChange={(event) => setForm({ ...form, code: event.target.value })}
                placeholder="WELCOME10"
              />
            </label>
            <label>
              Скидка, basis points
              <input
                inputMode="numeric"
                value={form.discount}
                onChange={(event) => setForm({ ...form, discount: event.target.value })}
              />
            </label>
            <label>
              Бонус, minor units
              <input
                inputMode="numeric"
                value={form.bonus}
                onChange={(event) => setForm({ ...form, bonus: event.target.value })}
              />
            </label>
            <div className="admin-dialog-actions">
              <button className="ui-button ui-button-secondary" onClick={() => setCreating(null)}>
                Отмена
              </button>
              <button className="ui-button ui-button-primary" disabled={busy} onClick={create}>
                Создать
              </button>
            </div>
          </div>
        )}
        <div className="admin-table">
          <div className="admin-table-head">
            <span>Код</span>
            <span>Скидка</span>
            <span>Бонус</span>
            <span>Использований</span>
            <span>Статус</span>
          </div>
          {promos.map((promo) => (
            <button className="admin-table-row" key={promo.id} onClick={() => setPromoEditing(promo)}>
              <span>
                <b>{promo.code}</b>
              </span>
              <span>{promo.discountBps / 100}%</span>
              <span>
                {promo.bonusMinor / 100} {promo.currency}
              </span>
              <span>
                {promo.redemptions}
                {promo.maxRedemptions ? ` / ${promo.maxRedemptions}` : ""}
              </span>
              <span>
                <em className={`admin-badge ${promo.isActive ? "active" : "blocked"}`}>
                  {promo.isActive ? "Активен" : "Выключен"}
                </em>
              </span>
            </button>
          ))}
        </div>
      </section>
      {message && <p className="settings-muted">{message}</p>}
      {promoEditing && (
        <PromoEditor
          promo={promoEditing}
          onClose={() => {
            setPromoEditing(null);
            onChanged();
          }}
        />
      )}
    </>
  );
}

function ContentView({
  documents,
  templates,
  onChanged,
}: {
  documents: AdminContentDocument[];
  templates: AdminTemplate[];
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<AdminContentDocument | null>(null);
  const [templateEditing, setTemplateEditing] = useState<AdminTemplate | null>(null);
  const [creating, setCreating] = useState<"document" | "template" | null>(null);
  const [form, setForm] = useState({ kind: "faq", slug: "", title: "", body: "", key: "", channel: "telegram" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const create = async () => {
    setBusy(true);
    setMessage(null);
    try {
      if (creating === "document") {
        if (!form.slug.trim() || !form.title.trim() || !form.body.trim()) return;
        await createAdminDocument({
          kind: form.kind,
          slug: form.slug.trim(),
          locale: "ru",
          title: form.title.trim(),
          body: form.body,
          is_published: false,
        });
      } else {
        if (!form.key.trim() || !form.body.trim()) return;
        await createAdminTemplate({
          key: form.key.trim(),
          channel: form.channel,
          locale: "ru",
          subject: null,
          body: form.body,
        });
      }
      setCreating(null);
      setForm({ kind: "faq", slug: "", title: "", body: "", key: "", channel: "telegram" });
      onChanged();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Не удалось создать запись");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <section className="admin-panel">
        <div className="admin-toolbar">
          <h2>FAQ, новости и документы</h2>
          <button
            className="ui-button ui-button-primary"
            onClick={() => setCreating(creating === "document" ? null : "document")}
          >
            Создать документ
          </button>
        </div>
        {creating === "document" && (
          <div className="admin-inline-editor">
            <h3>Новый документ</h3>
            <label>
              Тип
              <select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })}>
                <option value="faq">FAQ</option>
                <option value="news">Новость</option>
                <option value="legal">Юридический документ</option>
              </select>
            </label>
            <label>
              Slug
              <input
                value={form.slug}
                onChange={(event) => setForm({ ...form, slug: event.target.value })}
                placeholder="faq-payments"
              />
            </label>
            <label>
              Название
              <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
            </label>
            <label>
              Текст
              <textarea
                value={form.body}
                onChange={(event) => setForm({ ...form, body: event.target.value })}
                rows={5}
              />
            </label>
            <div className="admin-dialog-actions">
              <button className="ui-button ui-button-secondary" onClick={() => setCreating(null)}>
                Отмена
              </button>
              <button className="ui-button ui-button-primary" disabled={busy} onClick={create}>
                Создать
              </button>
            </div>
          </div>
        )}
        <div className="admin-table">
          <div className="admin-table-head">
            <span>Тип</span>
            <span>Название</span>
            <span>Язык</span>
            <span>Статус</span>
          </div>
          {documents.map((document) => (
            <button className="admin-table-row content-row" key={document.id} onClick={() => setEditing(document)}>
              <span>{document.kind}</span>
              <span>
                <b>{document.title}</b>
                <small>{document.slug}</small>
              </span>
              <span>{document.locale.toUpperCase()}</span>
              <span>{document.isPublished ? "Опубликован" : "Черновик"}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="admin-panel">
        <div className="admin-toolbar">
          <h2>Шаблоны сообщений</h2>
          <button
            className="ui-button ui-button-primary"
            onClick={() => setCreating(creating === "template" ? null : "template")}
          >
            Создать шаблон
          </button>
        </div>
        {creating === "template" && (
          <div className="admin-inline-editor">
            <h3>Новый шаблон</h3>
            <label>
              Ключ
              <input
                value={form.key}
                onChange={(event) => setForm({ ...form, key: event.target.value })}
                placeholder="payment_success"
              />
            </label>
            <label>
              Канал
              <select value={form.channel} onChange={(event) => setForm({ ...form, channel: event.target.value })}>
                <option value="telegram">Telegram</option>
                <option value="email">Email</option>
              </select>
            </label>
            <label>
              Текст
              <textarea
                value={form.body}
                onChange={(event) => setForm({ ...form, body: event.target.value })}
                rows={5}
              />
            </label>
            <div className="admin-dialog-actions">
              <button className="ui-button ui-button-secondary" onClick={() => setCreating(null)}>
                Отмена
              </button>
              <button className="ui-button ui-button-primary" disabled={busy} onClick={create}>
                Создать
              </button>
            </div>
          </div>
        )}
        <div className="admin-table">
          <div className="admin-table-head">
            <span>Ключ</span>
            <span>Канал</span>
            <span>Язык</span>
            <span>Статус</span>
          </div>
          {templates.map((template) => (
            <button
              className="admin-table-row content-row"
              key={template.id}
              onClick={() => setTemplateEditing(template)}
            >
              <span>
                <b>{template.key}</b>
              </span>
              <span>{template.channel}</span>
              <span>{template.locale.toUpperCase()}</span>
              <span>{template.isActive ? "Активен" : "Выключен"}</span>
            </button>
          ))}
        </div>
      </section>
      {message && <p className="settings-muted">{message}</p>}
      {editing && (
        <ContentEditor
          document={editing}
          onClose={() => {
            setEditing(null);
            onChanged();
          }}
        />
      )}
      {templateEditing && (
        <TemplateEditor
          template={templateEditing}
          onClose={() => {
            setTemplateEditing(null);
            onChanged();
          }}
        />
      )}
    </>
  );
}

function PromoEditor({ promo, onClose }: { promo: AdminPromoCode; onClose: () => void }) {
  const [discount, setDiscount] = useState(String(promo.discountBps));
  const [bonus, setBonus] = useState(String(promo.bonusMinor));
  const [active, setActive] = useState(promo.isActive);
  return (
    <div className="admin-dialog-backdrop" onClick={onClose}>
      <section className="admin-dialog" onClick={(event) => event.stopPropagation()}>
        <h2>Промокод {promo.code}</h2>
        <label className="admin-reason">
          Скидка, basis points
          <input value={discount} onChange={(event) => setDiscount(event.target.value)} />
        </label>
        <label className="admin-reason">
          Бонус, minor units
          <input value={bonus} onChange={(event) => setBonus(event.target.value)} />
        </label>
        <label className="admin-toggle">
          <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> Активен
        </label>
        <div className="admin-dialog-actions">
          <button className="ui-button ui-button-secondary" onClick={onClose}>
            Отмена
          </button>
          <button
            className="ui-button ui-button-primary"
            onClick={async () => {
              await updateAdminPromo(promo.id, {
                discount_bps: Number(discount),
                bonus_minor: Number(bonus),
                max_redemptions: promo.maxRedemptions,
                is_active: active,
              });
              onClose();
            }}
          >
            Сохранить
          </button>
          <button
            className="ui-button ui-button-danger"
            onClick={async () => {
              await archiveAdminPromo(promo.id);
              onClose();
            }}
          >
            Архивировать
          </button>
        </div>
      </section>
    </div>
  );
}

function ContentEditor({ document, onClose }: { document: AdminContentDocument; onClose: () => void }) {
  const [title, setTitle] = useState(document.title);
  const [body, setBody] = useState(document.body);
  const [published, setPublished] = useState(document.isPublished);
  return (
    <div className="admin-dialog-backdrop" onClick={onClose}>
      <section className="admin-dialog" onClick={(event) => event.stopPropagation()}>
        <h2>Документ: {document.slug}</h2>
        <label className="admin-reason">
          Название
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="admin-reason">
          Текст
          <textarea value={body} onChange={(event) => setBody(event.target.value)} />
        </label>
        <label className="admin-toggle">
          <input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} />{" "}
          Опубликован
        </label>
        <div className="admin-dialog-actions">
          <button className="ui-button ui-button-secondary" onClick={onClose}>
            Отмена
          </button>
          <button
            className="ui-button ui-button-primary"
            onClick={async () => {
              await updateAdminDocument(document.id, {
                kind: document.kind,
                slug: document.slug,
                locale: document.locale,
                title,
                body,
                is_published: published,
              });
              onClose();
            }}
          >
            Сохранить
          </button>
          <button
            className="ui-button ui-button-danger"
            onClick={async () => {
              await deleteAdminDocument(document.id);
              onClose();
            }}
          >
            Удалить
          </button>
        </div>
      </section>
    </div>
  );
}

function TemplateEditor({ template, onClose }: { template: AdminTemplate; onClose: () => void }) {
  const [body, setBody] = useState(template.body);
  const [active, setActive] = useState(template.isActive);
  return (
    <div className="admin-dialog-backdrop" onClick={onClose}>
      <section className="admin-dialog" onClick={(event) => event.stopPropagation()}>
        <h2>Шаблон: {template.key}</h2>
        <label className="admin-reason">
          Текст
          <textarea value={body} onChange={(event) => setBody(event.target.value)} />
        </label>
        <label className="admin-toggle">
          <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> Активен
        </label>
        <div className="admin-dialog-actions">
          <button className="ui-button ui-button-secondary" onClick={onClose}>
            Отмена
          </button>
          <button
            className="ui-button ui-button-primary"
            onClick={async () => {
              await updateAdminTemplate(template.id, {
                key: template.key,
                channel: template.channel,
                locale: template.locale,
                subject: template.subject,
                body,
                is_active: active,
              });
              onClose();
            }}
          >
            Сохранить
          </button>
        </div>
      </section>
    </div>
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
  userStats,
  total,
  page,
  onPageChange,
  status,
  setStatus,
  loading,
  onOpen,
  onBulkDone,
}: {
  users: AdminUser[];
  userStats: AdminUserStats | null;
  total: number;
  page: number;
  onPageChange: (value: number) => void;
  status: string;
  setStatus: (value: string) => void;
  loading: boolean;
  onOpen: (id: string) => void;
  onBulkDone: () => void;
}) {
  const [checked, setChecked] = useState<string[]>([]);
  const [bulkReason, setBulkReason] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const allChecked = users.length > 0 && checked.length === users.length;
  const toggle = (id: string) =>
    setChecked((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  const run = async (action: "block" | "unblock" | "restore" | "delete" | "revoke-sessions") => {
    if (checked.length === 0 || bulkReason.trim().length < 3) return;
    setBulkBusy(true);
    setBulkMessage(null);
    try {
      const result = await adminBulkUsers(checked, action, bulkReason.trim());
      setBulkMessage(`Выполнено: ${result.succeeded}, ошибок: ${result.failed}`);
      setChecked([]);
      setBulkReason("");
      onBulkDone();
    } catch (reason) {
      setBulkMessage(reason instanceof Error ? reason.message : "Массовое действие не выполнено");
    } finally {
      setBulkBusy(false);
    }
  };
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
          <option value="deleted">Удалённые</option>
        </select>
      </div>
      {userStats && (
        <div className="admin-stat-grid admin-stat-grid-small">
          <article>
            <span>Всего</span>
            <strong>{userStats.totalUsers}</strong>
          </article>
          <article>
            <span>Активные</span>
            <strong>{userStats.activeUsers}</strong>
          </article>
          <article>
            <span>Новые за месяц</span>
            <strong>{userStats.newMonth}</strong>
          </article>
          <article>
            <span>С картами</span>
            <strong>{userStats.usersWithCards}</strong>
          </article>
        </div>
      )}
      {checked.length > 0 && (
        <div className="admin-bulk-bar">
          <strong>Выбрано: {checked.length}</strong>
          <input
            value={bulkReason}
            onChange={(event) => setBulkReason(event.target.value)}
            placeholder="Причина массового действия"
          />
          <button
            className="ui-button ui-button-secondary"
            disabled={bulkBusy || bulkReason.trim().length < 3}
            onClick={() => run("revoke-sessions")}
          >
            Отозвать сессии
          </button>
          <button
            className="ui-button ui-button-secondary"
            disabled={bulkBusy || bulkReason.trim().length < 3}
            onClick={() => run("block")}
          >
            Заблокировать
          </button>
          <button
            className="ui-button ui-button-secondary"
            disabled={bulkBusy || bulkReason.trim().length < 3}
            onClick={() => run("unblock")}
          >
            Разблокировать
          </button>
          <button
            className="ui-button ui-button-primary"
            disabled={bulkBusy || bulkReason.trim().length < 3}
            onClick={() => run("restore")}
          >
            Восстановить
          </button>
          <button
            className="ui-button ui-button-danger"
            disabled={bulkBusy || bulkReason.trim().length < 3}
            onClick={() => run("delete")}
          >
            Удалить
          </button>
          <button className="ui-button ui-button-ghost" onClick={() => setChecked([])}>
            Сбросить
          </button>
          {bulkMessage && <small className="settings-muted">{bulkMessage}</small>}
        </div>
      )}
      <div className="admin-table admin-users-table">
        <div className="admin-table-head">
          <span>
            <input
              type="checkbox"
              checked={allChecked}
              onChange={(event) => setChecked(event.target.checked ? users.map((user) => user.userId) : [])}
              aria-label="Выбрать всех"
            />
          </span>
          <span>Пользователь</span>
          <span>Telegram</span>
          <span>Статус</span>
          <span>Регистрация</span>
          <span />
        </div>
        {loading && <p className="settings-muted">Загрузка...</p>}
        {!loading &&
          users.map((user) => (
            <div className="admin-table-row" key={user.userId}>
              <span>
                <input
                  type="checkbox"
                  checked={checked.includes(user.userId)}
                  onChange={() => toggle(user.userId)}
                  aria-label={`Выбрать ${user.userId}`}
                />
              </span>
              <button className="admin-row-open" onClick={() => onOpen(user.userId)}>
                <span>
                  <b>{user.username ? `@${user.username}` : "Без username"}</b>
                  <small>{user.userId}</small>
                </span>
              </button>
              <span>{user.telegramId ?? "—"}</span>
              <span>
                <em className={`admin-badge ${user.status}`}>
                  {user.status === "active" ? "Активен" : user.status === "blocked" ? "Заблокирован" : user.status}
                </em>
              </span>
              <span>{date(user.createdAt)}</span>
              <button className="admin-row-arrow" onClick={() => onOpen(user.userId)}>
                →
              </button>
            </div>
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

function UserDialog({
  user,
  onClose,
  onAction,
  onRestore,
  onDelete,
}: {
  user: AdminUserDetails;
  onClose: () => void;
  onAction: (action: "block" | "unblock" | "revoke-sessions", reason: string) => Promise<void>;
  onRestore: (reason: string) => Promise<void>;
  onDelete: (reason: string) => Promise<void>;
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
          <div>
            <small>Активные сессии</small>
            <b>{user.activeSessions}</b>
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
          {user.status === "deleted" && (
            <button
              className="ui-button ui-button-primary"
              disabled={busy || reason.trim().length < 3}
              onClick={async () => {
                setBusy(true);
                try {
                  await onRestore(reason);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Восстановить
            </button>
          )}
          {user.status !== "deleted" && (
            <button
              className="ui-button ui-button-danger"
              disabled={busy || reason.trim().length < 3}
              onClick={async () => {
                setBusy(true);
                try {
                  await onDelete(reason);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Удалить
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
