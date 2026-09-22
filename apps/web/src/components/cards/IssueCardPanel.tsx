"use client";

import { useEffect, useState } from "react";
import {
  Car,
  Check,
  ChevronDown,
  CreditCard,
  Crown,
  LockKeyhole,
  Plane,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
} from "lucide-react";
import {
  getCardProducts,
  getProductPrices,
  getIssueQuote,
  type CardProduct,
  type CardholderInput,
  type ProductPrice,
} from "../../lib/api";
import { usePreferences } from "../providers/PreferencesProvider";
import { Loader } from "../ui/loader";
import { Modal } from "../ui/modal";
import { CardVisual } from "./CardVisual";

const terms = [30, 90, 180, 365] as const;

import { schemeForCard, tierForProduct, tierMeta, type CardTier } from "../../lib/cardTheme";

type Tier = CardTier;

export function IssueCardPanel() {
  const { preferences } = usePreferences();
  const ru = preferences.language === "ru";
  const [products, setProducts] = useState<CardProduct[]>([]);
  const [prices, setPrices] = useState<Record<string, ProductPrice>>({});
  const [selected, setSelected] = useState<CardProduct | null>(null);
  const [detailsProduct, setDetailsProduct] = useState<{
    product: CardProduct;
    tier: Tier;
    price?: ProductPrice;
  } | null>(null);
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
    Promise.all([getCardProducts(), getProductPrices().catch(() => [])])
      .then(([items, priceList]) => {
        // The issuance showcase presents typed tiers only; raw provider
        // products without a recognized type stay off the storefront.
        setProducts(items.filter((product) => tierForProduct(product.code) !== "default"));
        setSelected(null);
        setPrices(Object.fromEntries(priceList.map((price) => [price.product_code, price])));
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <section className="issue-page">
        <Loader label={ru ? "Загружаем продукты" : "Loading products"} />
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

  const money = (minor: number | null | undefined, currency = "USD", scale = 2) =>
    minor == null
      ? "—"
      : new Intl.NumberFormat(ru ? "ru-RU" : "en-US", {
          style: "currency",
          currency,
          minimumFractionDigits: scale,
        }).format(minor / 10 ** scale);

  return (
    <section className="issue-page">
      <div className="panel-icon">
        <CreditCard size={38} />
      </div>
      <h2>{ru ? "Выпуск карты" : "Issue a card"}</h2>
      <p>
        {ru
          ? "Выберите тип карты — детали и цена на следующем экране."
          : "Choose a card type — details and price on the next screen."}
      </p>
      <div className="issue-tiers">
        {products.map((product) => {
          const tier = tierForProduct(product.code);
          const meta = tierMeta[tier];
          const price = prices[product.code];
          return (
            <button
              key={product.code}
              className={`issue-tier-card tier-${tier}`}
              onClick={() => setDetailsProduct({ product, tier, price })}
            >
              <span className="issue-tier-preview">
                <CardVisual
                  variant={tier}
                  scheme={schemeForCard(product.scheme)}
                  holder="FLYTOPAY USER"
                  expiry="12/30"
                />
              </span>
              <span className="issue-tier-title">
                <strong>{ru ? meta.ru : meta.en}</strong>
                <span className="usd-tag">{product.currency}</span>
              </span>
              <small className="issue-tier-desc">{ru ? meta.ruDesc : meta.enDesc}</small>
              <span className="issue-tier-foot">
                <span className="issue-tier-price">
                  {price?.total_charge_minor != null ? (
                    <strong>{money(price.total_charge_minor, price.currency, price.scale)}</strong>
                  ) : (
                    <strong className="muted-capability">{ru ? "Цена по запросу" : "Price on quote"}</strong>
                  )}
                  <small>{ru ? "Цена выпуска" : "Issuance price"}</small>
                </span>
                <span className="issue-tier-rate">
                  {price?.available ? <Crown size={15} className="crown" /> : null}
                  <small>{ru ? "Подробнее" : "Details"} →</small>
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {!products.length && (
        <div className="unavailable-note">
          <LockKeyhole size={18} />
          {ru ? "Каталог 2328 пока недоступен." : "2328 catalog is unavailable."}
        </div>
      )}

      {showForm && selected && (
        <div className="issue-form">
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
          {quote && (
            <p className="quote-result">
              {ru ? "Итого с комиссией" : "Total with fee"}:{" "}
              <strong>
                {(quote.totalChargeMinor / 100).toFixed(2)} {quote.currency}
              </strong>
            </p>
          )}
          {quoteError && <p className="error-text">{quoteError}</p>}
          <button className="lime-action" onClick={askQuote}>
            {ru ? "Рассчитать стоимость" : "Calculate price"}
          </button>
        </div>
      )}

      {detailsProduct && (
        <ProductDetailsScreen
          ru={ru}
          product={detailsProduct.product}
          tier={detailsProduct.tier}
          price={detailsProduct.price}
          money={money}
          onClose={() => setDetailsProduct(null)}
          onIssue={(product) => {
            setSelected(product);
            setShowForm(true);
            setDetailsProduct(null);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      )}
    </section>
  );
}

function ProductDetailsScreen({
  ru,
  product,
  tier,
  price,
  money,
  onClose,
  onIssue,
}: {
  ru: boolean;
  product: CardProduct;
  tier: Tier;
  price?: ProductPrice;
  money: (minor: number | null | undefined, currency?: string, scale?: number) => string;
  onClose: () => void;
  onIssue: (product: CardProduct) => void;
}) {
  const [openConditions, setOpenConditions] = useState(true);
  const [openWhyPasses, setOpenWhyPasses] = useState(false);
  const [openForbidden, setOpenForbidden] = useState(false);
  const meta = tierMeta[tier];
  return (
    <Modal
      open
      onClose={onClose}
      eyebrow="FLYTOPAY"
      title={ru ? `${meta.ru} карта` : `${meta.en} card`}
      description={ru ? meta.ruDesc : meta.enDesc}
      closeLabel={ru ? "Закрыть" : "Close"}
    >
      <div className="modal-body">
        <div className="product-modal-card">
          <CardVisual variant={tier} scheme={schemeForCard(product.scheme)} expiry="12/30" holder="FLYTOPAY USER" />
        </div>

        <div className="product-feature-grid">
          <Feature
            ru={ru}
            title="Пополнение через СБП"
            desc={ru ? "Карта пополняется рублями" : "Top up in RUB via SBP"}
            icon={<span className="feature-sbp">СБП</span>}
          />
          <Feature
            ru={ru}
            title={ru ? "Плати картой оффлайн" : "Pay offline"}
            desc="Apple Pay, Google Pay, Alipay"
            icon={<Smartphone size={18} />}
          />
          <Feature
            ru={ru}
            title={ru ? "Оплата такси и доставки" : "Rideshare & delivery"}
            desc="Uber, Grab, Bolt"
            icon={<Car size={18} />}
          />
          <Feature
            ru={ru}
            title={ru ? "Маркетплейсы" : "Marketplaces"}
            desc="Amazon, AliExpress, eBay"
            icon={<ShoppingBag size={18} />}
          />
          <Feature
            ru={ru}
            title={ru ? "Отели и авиабилеты" : "Hotels & flights"}
            desc="Booking, Airbnb, Skyscanner"
            icon={<Plane size={18} />}
          />
          <Feature
            ru={ru}
            title="3DS"
            desc={ru ? "Безопасность онлайн-платежей" : "Secure online payments"}
            icon={<Check size={18} />}
          />
        </div>

        <div className="product-accordion">
          <Accordion
            ru={ru}
            title={ru ? "Условия" : "Conditions"}
            open={openConditions}
            onToggle={() => setOpenConditions(!openConditions)}
          >
            <div className="accordion-row">
              <span>{ru ? "Выпуск карты" : "Card issuance"}</span>
              <b>
                {price?.total_charge_minor != null ? money(price.total_charge_minor, price.currency, price.scale) : "—"}
              </b>
            </div>
            <div className="accordion-row">
              <span>{ru ? "Обслуживание" : "Maintenance"}</span>
              <b className="accent">0 ₽/{ru ? "мес" : "mo"}</b>
            </div>
            <div className="accordion-row">
              <span>{ru ? "Верификация" : "Verification"}</span>
              <b>{ru ? "базовый KYC · 1 раз" : "basic KYC · once"}</b>
            </div>
            <div className="accordion-row">
              <span>{ru ? "Комиссия за деклайн" : "Decline fee"}</span>
              <b className="accent">0 ₽</b>
            </div>
          </Accordion>
          <Accordion
            ru={ru}
            title={ru ? "Почему карта проходит" : "Why it works"}
            open={openWhyPasses}
            onToggle={() => setOpenWhyPasses(!openWhyPasses)}
          >
            {ru
              ? "Трастовый BIN США — принимают рекламные кабинеты и маркетплейсы. Если оплата не пройдёт — перевыпустим карту на другом BIN бесплатно, комиссия за деклайн всегда 0 ₽."
              : "Trusted US BIN — accepted by ad platforms and marketplaces. If a payment fails we reissue on another BIN for free; decline fee is always 0."}
          </Accordion>
          <Accordion
            ru={ru}
            title={ru ? "Запрещённые операции" : "Forbidden operations"}
            open={openForbidden}
            onToggle={() => setOpenForbidden(!openForbidden)}
          >
            {ru
              ? "Азартные игры и казино, криптобиржи, P2P-переводы физлицам, снятие наличных. Такие операции отклоняются эмитентом автоматически."
              : "Gambling, crypto exchanges, P2P transfers to individuals, cash withdrawals. These are declined by the issuer automatically."}
          </Accordion>
        </div>

        <div className="product-kyc">
          <span className="product-kyc-icon">
            <ShieldCheck size={17} />
          </span>
          <div>
            <b>{ru ? "Нужна базовая верификация" : "Basic verification required"}</b>
            <p>
              {ru
                ? "После оформления попросим паспорт и селфи (≈2 минуты), затем пополните карту — и она активируется."
                : "After checkout we will ask for a passport and a selfie (≈2 minutes); then top up the card to activate it."}
            </p>
          </div>
        </div>

        <button className="lime-action product-buy" onClick={() => onIssue(product)}>
          <Sparkles size={16} />
          {price?.total_charge_minor != null
            ? `${ru ? "Купить за" : "Buy for"} ${money(price.total_charge_minor, price.currency, price.scale)}`
            : ru
              ? "Оформить выпуск"
              : "Proceed"}
        </button>
      </div>
    </Modal>
  );
}

function Feature({ ru, title, desc, icon }: { ru: boolean; title: string; desc: string; icon: React.ReactNode }) {
  return (
    <div className="product-feature">
      <div>
        <b>{title}</b>
        <p>{desc}</p>
      </div>
      <span className="product-feature-icon">{icon}</span>
    </div>
  );
}

function Accordion({
  ru,
  title,
  open,
  onToggle,
  children,
}: {
  ru: boolean;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="product-accordion-item">
      <button onClick={onToggle} aria-expanded={open}>
        <span>{title}</span>
        <ChevronDown size={16} className={open ? "chev-up" : ""} />
      </button>
      {open && <div className="product-accordion-content">{children}</div>}
    </div>
  );
}
