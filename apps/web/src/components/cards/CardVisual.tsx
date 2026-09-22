"use client";

import { Nfc } from "lucide-react";
import { useState } from "react";
import { usePreferences } from "../providers/PreferencesProvider";

const SCHEMES = new Set(["VISA", "MASTERCARD", "MC"]);

function SchemeMark({ scheme }: { scheme: string }) {
  const normalized = scheme.toUpperCase();
  if (normalized === "MASTERCARD" || normalized === "MC") {
    return (
      <span className="scheme-mark scheme-mark-mc" aria-label="Mastercard">
        <i />
        <i />
      </span>
    );
  }
  return <strong className="scheme-mark scheme-mark-visa">{normalized}</strong>;
}

export function CardVisual({
  maskedPan,
  status,
  balance,
  scheme = "VISA",
  holder = "Flytopay user",
  expiry = "MM/YY",
  variant = "default",
  cvv,
  flippable = false,
}: {
  maskedPan?: string | null;
  status?: string;
  balance?: string;
  scheme?: string;
  holder?: string;
  expiry?: string;
  variant?: string;
  cvv?: string;
  flippable?: boolean;
}) {
  const { preferences } = usePreferences();
  const ru = preferences.language === "ru";
  const frozen = status === "frozen";
  const [flipped, setFlipped] = useState(false);
  const normalizedScheme = SCHEMES.has(scheme.toUpperCase()) ? scheme.toUpperCase() : "VISA";
  const safeVariant = ["default", "travel", "subs", "premium"].includes(variant) ? variant : "default";

  const flip = () => flippable && setFlipped((current) => !current);
  const onSwipe = (event: React.PointerEvent) => {
    if (!flippable) return;
    const startX = (event.currentTarget as HTMLElement).dataset.swipeX;
    if (event.type === "pointerdown") {
      (event.currentTarget as HTMLElement).dataset.swipeX = String(event.clientX);
      return;
    }
    if (startX == null) return;
    const delta = event.clientX - Number(startX);
    if (Math.abs(delta) > 40) {
      setFlipped(delta < 0 !== flipped ? true : delta > 0 === false ? false : !flipped);
      setFlipped(delta < 0);
    }
    delete (event.currentTarget as HTMLElement).dataset.swipeX;
  };

  return (
    <div
      className={`card-flip-scene ${flippable ? "is-flippable" : ""}`}
      onClick={flip}
      onPointerDown={onSwipe}
      onPointerUp={onSwipe}
      role={flippable ? "button" : undefined}
      tabIndex={flippable ? 0 : undefined}
      onKeyDown={
        flippable
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                flip();
              }
            }
          : undefined
      }
      aria-label={
        flippable ? (ru ? "Нажмите или смахните, чтобы перевернуть карту" : "Tap or swipe to flip the card") : undefined
      }
    >
      <div className={`card-flip-inner ${flipped ? "is-flipped" : ""}`}>
        <article className={`bank-card-fly card-variant-${safeVariant} ${frozen ? "is-frozen" : ""}`}>
          <span className="bank-card-edge" />
          <span className="bank-card-shine" />
          <div className="bank-card-top">
            <strong>
              <img src="/logo.svg" alt="" />{" "}
              <span>
                <i>F</i>LYTOPAY
              </span>
            </strong>
            <Nfc className="contactless-mark" aria-hidden="true" />
          </div>
          <div className="bank-card-hardware">
            <img className="bank-chip" src="/chip.svg" alt="" aria-hidden="true" />
            {frozen && <span className="frozen-pill">{ru ? "Заморожена" : "Frozen"}</span>}
          </div>
          <div className="bank-card-number">{maskedPan ?? "••••  ••••  ••••  ••••"}</div>
          <div className="bank-card-bottom">
            <span>
              <small>{ru ? "Держатель" : "Cardholder"}</small>
              {holder}
            </span>
            <span>
              <small>{ru ? "Срок" : "Valid thru"}</small>
              {expiry}
            </span>
            <SchemeMark scheme={normalizedScheme} />
          </div>
          {balance && <div className="bank-card-balance">{balance}</div>}
        </article>
        {flippable && (
          <article
            className={`bank-card-fly bank-card-back card-variant-${safeVariant} ${frozen ? "is-frozen" : ""}`}
            aria-hidden="true"
          >
            <span className="bank-card-edge" />
            <div className="card-back-magstripe" />
            <div className="card-back-signature">
              <span className="card-back-signature-line" />
              <span className="card-back-cvv">
                <small>CVV</small>
                <b>{cvv ?? "•••"}</b>
              </span>
            </div>
            <div className="card-back-note">
              {ru
                ? "Карта предназначена только для онлайн-платежей. Не передавайте реквизиты третьим лицам."
                : "For online payments only. Never share card details with third parties."}
            </div>
            <div className="bank-card-top">
              <strong>
                <img src="/logo.svg" alt="" />{" "}
                <span>
                  <i>F</i>LYTOPAY
                </span>
              </strong>
              <SchemeMark scheme={normalizedScheme} />
            </div>
          </article>
        )}
      </div>
    </div>
  );
}
