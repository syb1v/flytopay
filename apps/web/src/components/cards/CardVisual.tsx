import { Nfc } from "lucide-react";
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
}: {
  maskedPan?: string | null;
  status?: string;
  balance?: string;
  scheme?: string;
  holder?: string;
  expiry?: string;
  variant?: string;
}) {
  const { preferences } = usePreferences();
  const ru = preferences.language === "ru";
  const frozen = status === "frozen";
  const normalizedScheme = SCHEMES.has(scheme.toUpperCase()) ? scheme.toUpperCase() : "VISA";
  const safeVariant = ["default", "travel", "subs", "premium"].includes(variant) ? variant : "default";
  return (
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
  );
}
