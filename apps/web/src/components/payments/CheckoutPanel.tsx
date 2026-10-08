"use client";

import { useEffect, useState } from "react";
import { createCheckout, getPaymentProviders, type PaymentProviderOption } from "../../lib/api";
import { getDictionary, type Language } from "../../i18n/dictionaries";

const fallbackProviders: PaymentProviderOption[] = [
  { key: "platega", title: "Platega", description: "Оплата картой и СБП" },
  { key: "pay2328", title: "2328", description: "Платёжный шлюз 2328" },
  { key: "telegram_stars", title: "Stars", description: "Telegram Stars" },
];

const knownKeys = ["platega", "pay2328", "telegram_stars"] as const;
type ProviderKey = (typeof knownKeys)[number];

export function CheckoutPanel({ language = "ru" }: { language?: Language }) {
  const [provider, setProvider] = useState<ProviderKey>("platega");
  const [providers, setProviders] = useState<PaymentProviderOption[]>(fallbackProviders);
  const [currentLanguage, setCurrentLanguage] = useState(language);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const t = getDictionary(currentLanguage);

  useEffect(() => {
    const listener = (event: Event) => {
      const next = (event as CustomEvent<{ language?: Language }>).detail.language;
      if (next) setCurrentLanguage(next);
    };
    window.addEventListener("flytopay:preferences", listener);
    return () => window.removeEventListener("flytopay:preferences", listener);
  }, []);
  useEffect(() => {
    getPaymentProviders()
      .then((items) => {
        const options = items.filter((item): item is PaymentProviderOption & { key: ProviderKey } =>
          (knownKeys as readonly string[]).includes(item.key),
        );
        if (options.length > 0) {
          setProviders(options);
          setProvider((current) => (options.some((option) => option.key === current) ? current : options[0].key));
        }
      })
      .catch(() => setProviders(fallbackProviders));
  }, []);

  async function start() {
    setBusy(true);
    setStatus(null);
    try {
      const result = await createCheckout(
        {
          provider,
          purpose: "wallet_deposit",
          amount_minor: 1000,
          currency: "USD",
          scale: 2,
          return_url: window.location.href,
        },
        crypto.randomUUID(),
      );
      setStatus(result.data.checkoutUrl ? t.paymentCreated : `Payment ${result.data.status}`);
      if (result.data.checkoutUrl) window.location.assign(result.data.checkoutUrl);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t.paymentUnavailable);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="settings-card" aria-labelledby="checkout-title">
      <div className="settings-heading">
        <div>
          <p className="eyebrow">{t.topUp}</p>
          <h2 id="checkout-title">{t.topUp}</h2>
        </div>
      </div>
      <div className="settings-row">
        <div>
          <strong>{t.amount}</strong>
          <span>{t.demoAmount}</span>
        </div>
        <div className="segmented">
          {providers.map((option) => (
            <button
              key={option.key}
              className={provider === option.key ? "active" : ""}
              onClick={() => setProvider(option.key as ProviderKey)}
              title={option.description}
            >
              {option.title}
            </button>
          ))}
        </div>
      </div>
      <button className="button" disabled={busy} onClick={start}>
        {busy ? t.creating : t.continue}
      </button>
      {status && (
        <p className="settings-muted" role="status">
          {status}
        </p>
      )}
    </section>
  );
}
