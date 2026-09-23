"use client";

import { useEffect, useState } from "react";
import { ChevronDown, LockKeyhole, ShieldCheck } from "lucide-react";
import {
  getCardProducts,
  getProductPrices,
  getIssueQuote,
  issueCardFromWallet,
  type CardProduct,
  type CardholderInput,
  type ProductPrice,
  type IssuanceApiError,
} from "../../lib/api";
import { usePreferences } from "../providers/PreferencesProvider";
import { Loader } from "../ui/loader";
import { Modal } from "../ui/modal";
import { schemeForCard, tierForProduct } from "../../lib/cardTheme";
import { productPresentation } from "../../lib/productPresentation";
import { CardVisual } from "./CardVisual";

type Field = Exclude<keyof CardholderInput, "product_code" | "amount_minor">;
const emptyForm: Record<Field, string> = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  date_of_birth: "",
  country: "US",
  address: "",
  city: "",
  state: "",
  zip_code: "",
};

const labels: Record<Field, [string, string]> = {
  first_name: ["Имя", "First name"],
  last_name: ["Фамилия", "Last name"],
  email: ["Email", "Email"],
  phone: ["Телефон", "Phone"],
  date_of_birth: ["Дата рождения", "Date of birth"],
  country: ["Страна", "Country"],
  address: ["Адрес", "Address"],
  city: ["Город", "City"],
  state: ["Регион", "State"],
  zip_code: ["Индекс", "ZIP code"],
};

function validate(form: Record<Field, string>, amount: string, ru: boolean): Partial<Record<Field | "amount", string>> {
  const errors: Partial<Record<Field | "amount", string>> = {};
  for (const field of Object.keys(form) as Field[]) {
    if (!form[field].trim()) errors[field] = ru ? "Заполните поле" : "Required field";
  }
  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
    errors.email = ru ? "Проверьте адрес почты" : "Check the email address";
  if (form.phone && !/^\+[1-9]\d{7,14}$/.test(form.phone))
    errors.phone = ru ? "Номер в формате +15551234567" : "Use format +15551234567";
  if (form.date_of_birth) {
    const birth = new Date(`${form.date_of_birth}T00:00:00`);
    const today = new Date();
    const age =
      today.getFullYear() -
      birth.getFullYear() -
      (today.getMonth() < birth.getMonth() ||
      (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
        ? 1
        : 0);
    if (!Number.isFinite(age) || age < 18 || age > 120)
      errors.date_of_birth = ru ? "Держателю должно быть от 18 до 120 лет" : "Cardholder must be 18–120 years old";
  }
  for (const field of ["address", "city", "zip_code"] as const) {
    if (form[field].trim().length === 1) errors[field] = ru ? "Минимум 2 символа" : "At least 2 characters";
  }
  const value = Number(amount.replace(",", "."));
  if (!Number.isFinite(value) || value <= 0 || !/^\d+(?:[.,]\d{1,2})?$/.test(amount))
    errors.amount = ru
      ? "Укажите сумму больше нуля (до 2 знаков после запятой)"
      : "Enter an amount above zero (up to 2 decimals)";
  return errors;
}

function errorMessage(error: unknown, ru: boolean) {
  const code = error instanceof Error ? error.message : "issue_failed";
  const messages: Record<string, [string, string]> = {
    "wallet.insufficient_balance": [
      "Недостаточно средств на балансе. Пополните баланс и повторите.",
      "Insufficient wallet balance. Top up and retry.",
    ],
    "card.product_not_issuable": [
      "Этот продукт пока не настроен для выпуска.",
      "This product is not configured for issuance yet.",
    ],
    "card.product_unknown": [
      "Продукт больше недоступен. Обновите страницу.",
      "This product is no longer available. Refresh the page.",
    ],
    "Product unavailable": [
      "Продукт больше недоступен. Обновите страницу.",
      "This product is no longer available. Refresh the page.",
    ],
    "product.not_configured": [
      "Продукт пока не настроен у провайдера. Выберите другую карту или обратитесь в поддержку.",
      "Product is not configured by the provider yet. Choose another card or contact support.",
    ],
    "Quote service unavailable": [
      "Не удалось рассчитать стоимость. Попробуйте позже.",
      "Could not calculate the price. Try again later.",
    ],
  };
  const known =
    messages[code] ??
    (code.toLowerCase().includes("product") && code.toLowerCase().includes("config")
      ? messages["product.not_configured"]
      : null);
  return (
    known?.[ru ? 0 : 1] ??
    (ru ? "Не удалось выполнить операцию. Попробуйте позже." : "The operation failed. Please try again later.")
  );
}

export function IssueCardPanel() {
  const { preferences } = usePreferences();
  const ru = preferences.language === "ru";
  const [products, setProducts] = useState<CardProduct[]>([]);
  const [prices, setPrices] = useState<Record<string, ProductPrice>>({});
  const [pricesLoaded, setPricesLoaded] = useState(false);
  const [selected, setSelected] = useState<CardProduct | null>(null);
  const [form, setForm] = useState<Record<Field, string>>({ ...emptyForm });
  const [amount, setAmount] = useState("50");
  const [errors, setErrors] = useState<Partial<Record<Field | "amount", string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<{ issuanceId: string; totalChargeMinor: number; currency: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getCardProducts(), getProductPrices().catch(() => null)])
      .then(([items, priceList]) => {
        const real = items.filter((product) => !product.code.startsWith("demo-"));
        setProducts(real.length ? real : items);
        setPricesLoaded(priceList !== null);
        setPrices(Object.fromEntries((priceList ?? []).map((price) => [price.product_code, price])));
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  const money = (minor: number, currency = "USD", scale = 2) =>
    new Intl.NumberFormat(ru ? "ru-RU" : "en-US", { style: "currency", currency }).format(minor / 10 ** scale);

  const clearQuote = () => {
    setQuote(null);
    setError(null);
  };
  const update = (field: Field, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    clearQuote();
  };
  const close = () => {
    if (busy) return;
    setSelected(null);
    setQuote(null);
    setError(null);
    setErrors({});
    setIssued(false);
  };

  const askQuote = async () => {
    if (!selected || busy) return;
    const invalid = validate(form, amount, ru);
    setErrors(invalid);
    setError(null);
    if (Object.keys(invalid).length) return;
    setBusy(true);
    try {
      const result = await getIssueQuote({
        ...form,
        product_code: selected.code,
        amount_minor: Math.round(Number(amount.replace(",", ".")) * 100),
      });
      setQuote(result.data);
    } catch (cause) {
      if (cause instanceof Error && "fields" in cause) {
        const fields = (cause as IssuanceApiError).fields;
        if (fields) {
          const fieldErrors: Partial<Record<Field | "amount", string>> = {};
          for (const [field, message] of Object.entries(fields)) {
            const key = field === "amount_minor" ? "amount" : field;
            if (key in emptyForm || key === "amount") fieldErrors[key as Field | "amount"] = message;
          }
          if (Object.keys(fieldErrors).length) setErrors(fieldErrors);
          else setError(errorMessage(cause, ru));
        } else setError(errorMessage(cause, ru));
      } else setError(errorMessage(cause, ru));
    } finally {
      setBusy(false);
    }
  };

  const issue = async () => {
    if (!quote || busy) return;
    setBusy(true);
    setError(null);
    try {
      await issueCardFromWallet(quote.issuanceId);
      setIssued(true);
    } catch (cause) {
      setError(errorMessage(cause, ru));
    } finally {
      setBusy(false);
    }
  };

  if (loading)
    return (
      <section className="issue-page">
        <Loader label={ru ? "Загружаем продукты" : "Loading products"} />
      </section>
    );

  const tier = selected ? tierForProduct(selected.code) : "default";
  const meta = selected ? productPresentation(selected, ru) : null;
  return (
    <section className="issue-page">
      <p>
        {ru
          ? "Выберите карту, чтобы посмотреть условия и оформить выпуск."
          : "Choose a card to see the details and issue it."}
      </p>
      <div className="issue-tiers">
        {products.map((product) => {
          const productTier = tierForProduct(product.code);
          const info = productPresentation(product, ru);
          const price = prices[product.code];
          const available =
            pricesLoaded &&
            price?.available === true &&
            price.total_charge_minor != null &&
            product.provider_code.startsWith("core-");
          return (
            <button
              key={product.code}
              type="button"
              disabled={!available}
              className={`issue-tier-card tier-${productTier}`}
              onClick={() => {
                setSelected(product);
                setForm({ ...emptyForm });
                setAmount("50");
                setIssued(false);
                setErrors({});
                clearQuote();
              }}
            >
              <span className="issue-tier-preview">
                <CardVisual
                  variant={productTier}
                  scheme={schemeForCard(product.scheme)}
                  holder="FLYTOPAY USER"
                  expiry="12/30"
                />
              </span>
              <span className="issue-tier-title">
                <strong>{info.name}</strong>
                <span className="usd-tag">{product.currency}</span>
              </span>
              <small className="issue-tier-desc">
                {info.format} · {info.type}. {info.description}
              </small>
              <span className="issue-tier-foot">
                <span className="issue-tier-price">
                  <strong className={!available ? "muted-capability" : ""}>
                    {available && price.total_charge_minor != null
                      ? money(price.total_charge_minor, price.currency, price.scale)
                      : ru
                        ? "Пока недоступна"
                        : "Unavailable"}
                  </strong>
                  <small>{ru ? "Ориентировочная цена при $50" : "Estimated price at $50"}</small>
                </span>
                {available && (
                  <span className="issue-tier-rate">
                    <small>{ru ? "Подробнее" : "Details"} →</small>
                  </span>
                )}
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
      <Modal
        open={selected !== null}
        onClose={close}
        eyebrow="FLYTOPAY"
        title={meta?.name ?? ""}
        description={meta?.description}
        closeLabel={ru ? "Закрыть" : "Close"}
      >
        {selected && (
          <div className="issue-dialog">
            <div className="issue-dialog-preview">
              <CardVisual
                variant={tier}
                scheme={schemeForCard(selected.scheme)}
                holder="FLYTOPAY USER"
                expiry="12/30"
              />
            </div>
            <div className="issue-dialog-note">
              <ShieldCheck size={17} />
              <span>
                {ru
                  ? "Отдельная загрузка документов здесь не требуется. Для выпуска нужны данные держателя карты."
                  : "No separate document upload is needed here. Cardholder details are required to issue the card."}
              </span>
            </div>
            {meta && (
              <div className="issue-product-facts">
                <span>{meta.format}</span>
                <span>{meta.type}</span>
                <span>
                  {meta.scheme} · {selected.currency}
                </span>
              </div>
            )}
            <div className="issue-product-conditions">
              <details>
                <summary>
                  {ru ? "Возможности карты" : "Card features"}
                  <ChevronDown size={17} />
                </summary>
                <div>
                  {meta?.features.length ? (
                    <ul>
                      {meta.features.map((feature) => (
                        <li key={feature}>{feature}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>
                      {ru
                        ? "Дополнительные возможности для этого продукта не указаны провайдером."
                        : "No additional features are listed for this product by the provider."}
                    </p>
                  )}
                </div>
              </details>
              <details>
                <summary>
                  {ru ? "Условия выпуска" : "Issuance terms"}
                  <ChevronDown size={17} />
                </summary>
                <div>
                  <p>
                    {ru
                      ? "Цена зависит от стартового баланса и комиссии. Итоговую сумму покажем до подтверждения. Выпуск обрабатывается провайдером, статус появится на главной."
                      : "The price depends on the initial balance and fee. The final amount is shown before confirmation. Issuance is processed by the provider; status appears on the home screen."}
                  </p>
                </div>
              </details>
            </div>
            {issued ? (
              <p className="quote-result" role="status">
                {ru
                  ? "Заявка на выпуск отправлена. Статус карты появится на главной странице."
                  : "Your issuance request has been sent. Check the card status on the home screen."}
              </p>
            ) : (
              <>
                <form
                  className="issue-dialog-form"
                  noValidate
                  onSubmit={(event) => {
                    event.preventDefault();
                    void askQuote();
                  }}
                >
                  <h3>{ru ? "Данные держателя" : "Cardholder details"}</h3>
                  <div className="issue-dialog-grid">
                    {(Object.keys(emptyForm) as Field[]).map((field) => (
                      <label key={field} className={`field-label issue-field issue-field-${field}`}>
                        {labels[field][ru ? 0 : 1]}
                        {field === "country" ? (
                          <select value={form.country} onChange={(event) => update(field, event.target.value)}>
                            <option value="US">United States</option>
                            <option value="GB">United Kingdom</option>
                            <option value="DE">Germany</option>
                            <option value="AE">United Arab Emirates</option>
                            <option value="TR">Türkiye</option>
                          </select>
                        ) : (
                          <input
                            value={form[field]}
                            type={
                              field === "date_of_birth"
                                ? "date"
                                : field === "email"
                                  ? "email"
                                  : field === "phone"
                                    ? "tel"
                                    : "text"
                            }
                            autoComplete={
                              {
                                first_name: "given-name",
                                last_name: "family-name",
                                email: "email",
                                phone: "tel",
                                date_of_birth: "bday",
                                address: "street-address",
                                city: "address-level2",
                                state: "address-level1",
                                zip_code: "postal-code",
                              }[field]
                            }
                            placeholder={field === "phone" ? "+15551234567" : undefined}
                            onChange={(event) => update(field, event.target.value)}
                            aria-invalid={Boolean(errors[field])}
                          />
                        )}
                        {errors[field] && <small className="issue-field-error">{errors[field]}</small>}
                      </label>
                    ))}
                  </div>
                  <label className="field-label issue-amount">
                    {ru ? "Стартовый баланс карты, USD" : "Initial card balance, USD"}
                    <input
                      inputMode="decimal"
                      value={amount}
                      onChange={(event) => {
                        setAmount(event.target.value);
                        setErrors((current) => ({ ...current, amount: undefined }));
                        clearQuote();
                      }}
                      aria-invalid={Boolean(errors.amount)}
                    />
                    {errors.amount && <small className="issue-field-error">{errors.amount}</small>}
                  </label>
                  {error && (
                    <p className="error-text" role="alert">
                      {error}
                    </p>
                  )}
                  {quote && (
                    <div className="issue-quote-summary">
                      <span>{ru ? "К списанию с баланса" : "Total from wallet"}</span>
                      <strong>{money(quote.totalChargeMinor, quote.currency)}</strong>
                    </div>
                  )}
                  {!quote && (
                    <button type="submit" className="lime-action" disabled={busy}>
                      {busy ? "…" : ru ? "Рассчитать стоимость" : "Calculate price"}
                    </button>
                  )}
                </form>
                {quote && (
                  <button type="button" className="lime-action issue-confirm" disabled={busy} onClick={issue}>
                    {busy ? "…" : ru ? "Подтвердить выпуск карты" : "Confirm card issuance"}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </Modal>
    </section>
  );
}
