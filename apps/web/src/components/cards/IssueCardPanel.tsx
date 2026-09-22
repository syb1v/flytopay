"use client";

import { useEffect, useState } from "react";
import { Apple, Check, CreditCard, Globe2, LockKeyhole, Smartphone, X } from "lucide-react";
import { getCardProducts, getIssueQuote, type CardProduct, type CardholderInput } from "../../lib/api";
import { usePreferences } from "../providers/PreferencesProvider";

const terms = [30, 90, 180, 365] as const;

export function IssueCardPanel() {
  const { preferences } = usePreferences();
  const ru = preferences.language === "ru";
  const [products, setProducts] = useState<CardProduct[]>([]);
  const [selected, setSelected] = useState<CardProduct | null>(null);
  const [detailsProduct, setDetailsProduct] = useState<CardProduct | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [term, setTerm] = useState<number>(30);
  const [country, setCountry] = useState("US");
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "+",
    date_of_birth: "",
    address: "",
    city: "",
    state: "",
    zip_code: "",
  });
  const [quote, setQuote] = useState<{ totalChargeMinor: number; feeMinor: number; currency: string } | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    getCardProducts()
      .then((items) => {
        setProducts(items);
        setSelected(items[0] ?? null);
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);
  const setting = (key: string) => selected?.provider_settings?.find((item) => item.key === key)?.value;
  if (loading)
    return (
      <section className="page-panel">
        <div className="panel-icon">
          <CreditCard size={38} />
        </div>
        <h2>{ru ? "Загружаем продукты" : "Loading products"}</h2>
      </section>
    );
  const update = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const askQuote = async () => {
    if (!selected) return;
    setQuoteError(null);
    setQuote(null);
    try {
      const input: CardholderInput = { ...form, product_code: selected.code, amount_minor: 5000, country };
      const result = await getIssueQuote(input);
      setQuote({
        totalChargeMinor: result.data.totalChargeMinor,
        feeMinor: result.data.feeMinor,
        currency: result.data.currency,
      });
    } catch (error) {
      setQuoteError(error instanceof Error ? error.message : "quote_failed");
    }
  };
  return (
    <section className="issue-layout">
      <div className="issue-main">
        <div className="panel-icon">
          <CreditCard size={38} />
        </div>
        <h2>{ru ? "Выпуск карты" : "Issue a card"}</h2>
        <p>
          {ru
            ? "Выберите реальный продукт и заполните данные держателя."
            : "Choose a real product and enter the cardholder details."}
        </p>
        <div className="product-grid issue-product-grid">
          {products.map((product, index) => (
            <button
              className={`product-option issue-tier issue-tier-${index % 3} ${selected?.code === product.code ? "selected" : ""}`}
              key={product.code}
              onClick={() => setDetailsProduct(product)}
            >
              <span className="issue-tier-top">
                <span className="issue-tier-info">
                  <span className="badges">
                    <span className="badge">
                      <CreditCard size={13} /> {product.scheme.toUpperCase()}
                    </span>
                    <span className="badge">{product.currency}</span>
                  </span>
                  <strong className="issue-tier-name">{product.name}</strong>
                  <small className="issue-tier-desc">
                    {ru
                      ? "Для зарубежных сервисов, покупок и подписок"
                      : "For international services, purchases, and subscriptions"}
                  </small>
                </span>
                <span className="issue-tier-visual" aria-hidden="true">
                  <span className="issue-tier-logo">
                    <img src="/logo.svg" alt="" />
                    FLYTOPAY
                  </span>
                  <span className="issue-tier-art">{index % 3 === 0 ? "◌" : index % 3 === 1 ? "✦" : "◒"}</span>
                  <img className="issue-tier-chip" src="/chip.svg" alt="" />
                </span>
              </span>
              <span className="issue-tier-foot">
                <span>
                  <strong>{index % 3 === 0 ? "9 990 ₽" : index % 3 === 1 ? "990 ₽" : "490 ₽"}</strong>
                  <small>{ru ? "Цена выпуска" : "Issuance price"}</small>
                </span>
                <span className="issue-tier-rate">
                  <strong>{selected?.code === product.code ? "Выбрано" : "Выбрать"}</strong>
                  {selected?.code === product.code && <Check size={16} />}
                </span>
              </span>
            </button>
          ))}
        </div>
        {!products.length && (
          <div className="unavailable-note">
            <LockKeyhole size={18} />
            {ru ? "Каталог 2328 пока недоступен." : "2328 catalog is unavailable."}
          </div>
        )}
        {showForm && (
          <>
            <div className="issue-form-heading">{ru ? "Данные держателя" : "Cardholder details"}</div>
            <label className="field-label">
              {ru ? "Имя" : "First name"}
              <input value={form.first_name} onChange={(event) => update("first_name", event.target.value)} />
            </label>
            <label className="field-label">
              {ru ? "Фамилия" : "Last name"}
              <input value={form.last_name} onChange={(event) => update("last_name", event.target.value)} />
            </label>
            <label className="field-label">
              Email
              <input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} />
            </label>
            <label className="field-label">
              {ru ? "Телефон E.164" : "Phone E.164"}
              <input
                value={form.phone}
                onChange={(event) => update("phone", event.target.value)}
                placeholder="+15551234567"
              />
            </label>
            <label className="field-label">
              {ru ? "Дата рождения" : "Date of birth"}
              <input
                type="date"
                value={form.date_of_birth}
                onChange={(event) => update("date_of_birth", event.target.value)}
              />
            </label>
            <label className="field-label">
              {ru ? "Страна держателя" : "Cardholder country"}
              <select value={country} onChange={(event) => setCountry(event.target.value)}>
                <option value="US">United States</option>
                <option value="GB">United Kingdom</option>
                <option value="DE">Germany</option>
                <option value="AE">United Arab Emirates</option>
                <option value="TR">Türkiye</option>
              </select>
            </label>
            <label className="field-label">
              {ru ? "Адрес" : "Address"}
              <input value={form.address} onChange={(event) => update("address", event.target.value)} />
            </label>
            <div className="form-grid">
              <label className="field-label">
                {ru ? "Город" : "City"}
                <input value={form.city} onChange={(event) => update("city", event.target.value)} />
              </label>
              <label className="field-label">
                {ru ? "Регион" : "State"}
                <input value={form.state} onChange={(event) => update("state", event.target.value)} />
              </label>
            </div>
            <label className="field-label">
              {ru ? "Индекс" : "ZIP code"}
              <input value={form.zip_code} onChange={(event) => update("zip_code", event.target.value)} />
            </label>
            <div className="term-picker">
              <span>{ru ? "Срок выпуска" : "Issue term"}</span>
              <div>
                {terms.map((value) => (
                  <button className={term === value ? "selected" : ""} key={value} onClick={() => setTerm(value)}>
                    {value} <small>{ru ? "дн." : "days"}</small>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      <aside className="issue-summary">
        <div className="summary-heading">
          <Globe2 size={18} />
          {ru ? "Возможности продукта" : "Product capabilities"}
        </div>
        <div className="capability-list">
          <Capability label="3DS" value={setting("three_ds")} />
          <Capability label="Apple Pay" icon={<Apple size={15} />} value={setting("apple_pay")} />
          <Capability label="Google Pay" icon={<Smartphone size={15} />} value={setting("google_pay")} />
          <Capability
            label={ru ? "Лимит карт на держателя" : "Cards per cardholder"}
            value={selected?.max_cards_per_cardholder}
          />
        </div>
        <div className="summary-divider" />
        {quote ? (
          <p className="quote-result">
            {ru ? "Итого с комиссией" : "Total with fee"}:{" "}
            <strong>
              {(quote.totalChargeMinor / 100).toFixed(2)} {quote.currency}
            </strong>
          </p>
        ) : (
          <p className="settings-muted">
            {ru
              ? "Заполните данные — сервер запросит точный quote 2328."
              : "Fill in the details — the server will request an exact 2328 quote."}
          </p>
        )}
        {quoteError && <p className="error-text">{quoteError}</p>}
        <button className="lime-action" disabled={!selected || !showForm} onClick={askQuote}>
          {ru ? "Рассчитать стоимость" : "Calculate price"}
        </button>
      </aside>
      {detailsProduct && (
        <div
          className="issue-product-overlay"
          onMouseDown={(event) => event.target === event.currentTarget && setDetailsProduct(null)}
        >
          <section
            className={`issue-product-dialog ${detailsProduct.code.toLowerCase()}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="issue-product-title"
          >
            <button
              className="icon-button issue-product-close"
              onClick={() => setDetailsProduct(null)}
              aria-label={ru ? "Закрыть" : "Close"}
            >
              <X size={18} />
            </button>
            <div className="issue-product-card-preview">
              <img src="/chip.svg" alt="" aria-hidden="true" />
              <span>FLYTOPAY</span>
            </div>
            <div className="badges">
              <span className="badge">{detailsProduct.scheme.toUpperCase()}</span>
              <span className="badge">{detailsProduct.currency}</span>
            </div>
            <h3 id="issue-product-title">{detailsProduct.name}</h3>
            <p>
              {ru
                ? "Виртуальная карта для зарубежных сервисов, подписок и покупок."
                : "A virtual card for international services, subscriptions, and purchases."}
            </p>
            <div className="issue-product-price">
              <strong>{selected?.code === detailsProduct.code ? "990 ₽" : "490 ₽"}</strong>
              <small>{ru ? "стоимость выпуска" : "issuance price"}</small>
            </div>
            <button
              className="lime-action"
              onClick={() => {
                setSelected(detailsProduct);
                setShowForm(true);
                setDetailsProduct(null);
              }}
            >
              {ru ? "Выбрать карту" : "Choose card"}
            </button>
          </section>
        </div>
      )}
    </section>
  );
}

function Capability({
  label,
  value,
  icon,
}: {
  label: string;
  value: boolean | number | string | null | undefined;
  icon?: React.ReactNode;
}) {
  const available =
    value === true || (typeof value === "number" && value > 0) || (typeof value === "string" && value.length > 0);
  return (
    <div className="capability-row">
      <span>
        {icon}
        {label}
      </span>
      <b className={available ? "available" : "muted-capability"}>
        {typeof value === "boolean" ? (value ? "✓" : "—") : (value ?? "—")}
      </b>
    </div>
  );
}
