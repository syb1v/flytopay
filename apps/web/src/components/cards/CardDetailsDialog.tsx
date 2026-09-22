"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { LockKeyhole, MapPin, X } from "lucide-react";
import { useEffect, useState } from "react";
import { getCardDetails, type Card, type CardDetails } from "../../lib/api";
import { usePreferences } from "../providers/PreferencesProvider";
import { CardVisual } from "./CardVisual";

function cardVariant(card: Card) {
  const value = (card.product_code ?? "").toLowerCase();
  if (value.includes("travel") || value.includes("trip") || value.includes("journey")) return "travel";
  if (value.includes("sub") || value.includes("subscription")) return "subs";
  if (value.includes("premium") || value.includes("black") || value.includes("metal")) return "premium";
  return "default";
}

export function CardDetailsDialog({ card, open, onClose }: { card: Card | null; open: boolean; onClose: () => void }) {
  const { preferences } = usePreferences();
  const ru = preferences.language === "ru";
  const [details, setDetails] = useState<CardDetails | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!open || !card) return;
    let cancelled = false;
    setState("loading");
    setDetails(null);
    getCardDetails(card.id)
      .then((payload) => {
        if (cancelled) return;
        setDetails(payload);
        setState("ready");
      })
      .catch(() => !cancelled && setState("error"));
    return () => {
      cancelled = true;
    };
  }, [open, card]);

  const expiry =
    details?.expiry_month && details?.expiry_year ? `${details.expiry_month}/${details.expiry_year}` : "MM/YY";
  const holder = details?.holder ?? "FLYTOPAY USER";
  const address = details?.billing_address;
  const addressLine = address
    ? [
        address.line1,
        [address.city, address.state].filter(Boolean).join(", "),
        [address.postal_code, address.country].filter(Boolean).join(" "),
      ].filter(Boolean)
    : [];

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="details-overlay" />
        <Dialog.Content className="details-dialog">
          <header className="card-dialog-header">
            <Dialog.Title>{ru ? "Реквизиты карты" : "Card details"}</Dialog.Title>
            <Dialog.Close className="icon-button" aria-label={ru ? "Закрыть окно" : "Close dialog"}>
              <X size={18} />
            </Dialog.Close>
          </header>
          <Dialog.Description className="settings-muted">
            {ru
              ? "Нажмите на карту или смахните, чтобы увидеть обратную сторону"
              : "Tap or swipe the card to see the back side"}
          </Dialog.Description>
          {card && (
            <>
              <div className="details-card-area">
                <CardVisual
                  maskedPan={card.masked_pan ?? (card.last_four ? `•••• •••• •••• ${card.last_four}` : null)}
                  status={card.status}
                  scheme="VISA"
                  holder={holder}
                  expiry={expiry}
                  cvv={details?.cvv ?? undefined}
                  variant={cardVariant(card)}
                  flippable
                />
              </div>
              {state === "loading" && <p className="settings-muted">…</p>}
              {state === "error" && (
                <p className="unavailable-note">
                  <LockKeyhole size={18} aria-hidden="true" />
                  {ru ? "Не удалось загрузить реквизиты" : "Failed to load card details"}
                </p>
              )}
              {state === "ready" && details && (
                <>
                  <dl className="details-section">
                    <div className="detail-row">
                      <dt>{ru ? "Номер карты" : "Card number"}</dt>
                      <dd>{details.masked_pan ?? "•••• •••• •••• ••••"}</dd>
                    </div>
                    <div className="details-split">
                      <div className="detail-row">
                        <dt>{ru ? "Срок действия" : "Expiry"}</dt>
                        <dd>{expiry}</dd>
                      </div>
                      <div className="detail-row">
                        <dt>CVV</dt>
                        <dd>{details.cvv ?? "•••"}</dd>
                      </div>
                    </div>
                    <div className="detail-row">
                      <dt>{ru ? "Держатель" : "Cardholder"}</dt>
                      <dd>{holder}</dd>
                    </div>
                  </dl>
                  {address && addressLine.length > 0 && (
                    <div className="details-section">
                      <div className="detail-row detail-row-address">
                        <dt>{ru ? "Биллинговый адрес" : "Billing address"}</dt>
                        <dd>
                          {addressLine.map((line) => (
                            <span key={line}>{line}</span>
                          ))}
                        </dd>
                      </div>
                    </div>
                  )}
                  <p className="secure-note">
                    <LockKeyhole size={18} aria-hidden="true" />
                    {ru
                      ? "Реквизиты видны только вам. Не передавайте их третьим лицам."
                      : "These details are visible only to you. Never share them."}
                  </p>
                </>
              )}
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
