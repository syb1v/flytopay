"use client";

import { useState } from "react";
import { createCheckout } from "../../lib/api";

export function CheckoutPanel() {
  const [provider, setProvider] = useState<"platega" | "pay2328" | "telegram_stars">("platega");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    setStatus(null);
    try {
      const result = await createCheckout({ provider, purpose: "wallet_deposit", amount_minor: 1000, currency: "USD", scale: 2, return_url: window.location.href }, crypto.randomUUID());
      setStatus(result.data.checkoutUrl ? "Платёж создан. Открываем страницу оплаты…" : `Платёж ${result.data.status}`);
      if (result.data.checkoutUrl) window.location.assign(result.data.checkoutUrl);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Платёж недоступен");
    } finally {
      setBusy(false);
    }
  }

  return <section className="settings-card" aria-labelledby="checkout-title"><div className="settings-heading"><div><p className="eyebrow">Пополнение</p><h2 id="checkout-title">Пополнить баланс</h2></div></div><div className="settings-row"><div><strong>Сумма</strong><span>10.00 USD · тестовый размер заказа</span></div><div className="segmented"><button className={provider === "platega" ? "active" : ""} onClick={() => setProvider("platega")}>Platega</button><button className={provider === "pay2328" ? "active" : ""} onClick={() => setProvider("pay2328")}>2328</button><button className={provider === "telegram_stars" ? "active" : ""} onClick={() => setProvider("telegram_stars")}>Stars</button></div></div><button className="button" disabled={busy} onClick={start}>{busy ? "Создаём…" : "Продолжить"}</button>{status && <p className="settings-muted" role="status">{status}</p>}</section>;
}
