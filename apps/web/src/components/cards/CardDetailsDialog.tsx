"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { LockKeyhole, X } from "lucide-react";
import { useEffect, useState } from "react";
import { getCardDetails, type Card, type CardDetails } from "../../lib/api";
import { usePreferences } from "../providers/PreferencesProvider";
import { CardVisual } from "./CardVisual";
import { schemeForCard, tierForProduct } from "../../lib/cardTheme";

function cardVariant(card: Card) {
  return tierForProduct(card.product_code);
}

export function CardDetailsDialog({ card, open, onClose }: { card: Card | null; open: boolean; onClose: () => void }) {
  const { preferences } = usePreferences();
  const ru = preferences.language === "ru";
  const [details, setDetails] = useState<CardDetails | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!open || !card) return;
    let cancelled = false;
    setState("loading");
    setDetails(null);
    setRevealed(false);
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
                  scheme={schemeForCard(card.scheme)}
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
                  {!revealed ? (
                    <button className="lime-action reveal-button" onClick={() => setRevealed(true)}>
                      {ru ? "Показать реквизиты" : "Show card details"}
                    </button>
                  ) : (
                    <>
                      <div className="copy-grid">
                        <CopyField
                          label={ru ? "Номер карты" : "Card number"}
                          value={details.masked_pan ?? "—"}
                          ru={ru}
                        />
                        <CopyField label={ru ? "Срок действия" : "Expiry"} value={expiry} ru={ru} />
                        <CopyField label="CVV" value={details.cvv ?? "—"} ru={ru} />
                        <CopyField label={ru ? "Держатель" : "Cardholder"} value={holder} ru={ru} />
                        {address && addressLine.length > 0 && (
                          <CopyField
                            label={ru ? "Биллинговый адрес" : "Billing address"}
                            value={addressLine.join(", ")}
                            ru={ru}
                          />
                        )}
                      </div>
                      <button className="secondary-action reveal-button" onClick={() => setRevealed(false)}>
                        {ru ? "Скрыть реквизиты" : "Hide card details"}
                      </button>
                    </>
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

function CopyField({ label, value, ru }: { label: string; value: string; ru: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="copy-field"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1400);
        } catch {
          setCopied(false);
        }
      }}
    >
      <span>
        <small>{label}</small>
        <b>{value}</b>
      </span>
      <em>{copied ? (ru ? "Скопировано" : "Copied") : ru ? "Копировать" : "Copy"}</em>
    </button>
  );
}
