"use client";

import { useEffect, useState } from "react";
import { createCheckout } from "../../lib/api";
import { getDictionary, type Language } from "../../i18n/dictionaries";

export function CheckoutPanel({ language = "ru" }: { language?: Language }) {
  const [provider, setProvider] = useState<"platega" | "pay2328" | "telegram_stars">("platega");
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

  async function start() {
    setBusy(true);
    setStatus(null);
    try {
      const result = await createCheckout({ provider, purpose: "wallet_deposit", amount_minor: 1000, currency: "USD", scale: 2, return_url: window.location.href }, crypto.randomUUID());
      setStatus(result.data.checkoutUrl ? t.paymentCreated : `Payment ${result.data.status}`);
      if (result.data.checkoutUrl) window.location.assign(result.data.checkoutUrl);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t.paymentUnavailable);
    } finally {
      setBusy(false);
    }
  }

  return <section className="settings-card" aria-labelledby="checkout-title"><div className="settings-heading"><div><p className="eyebrow">{t.topUp}</p><h2 id="checkout-title">{t.topUp}</h2></div></div><div className="settings-row"><div><strong>{t.amount}</strong><span>{t.demoAmount}</span></div><div className="segmented"><button className={provider === "platega" ? "active" : ""} onClick={() => setProvider("platega")}>Platega</button><button className={provider === "pay2328" ? "active" : ""} onClick={() => setProvider("pay2328")}>2328</button><button className={provider === "telegram_stars" ? "active" : ""} onClick={() => setProvider("telegram_stars")}>Stars</button></div></div><button className="button" disabled={busy} onClick={start}>{busy ? t.creating : t.continue}</button>{status && <p className="settings-muted" role="status">{status}</p>}</section>;
}
