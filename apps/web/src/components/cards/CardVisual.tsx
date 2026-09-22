import { Nfc } from "lucide-react";
import { usePreferences } from "../providers/PreferencesProvider";

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
  return (
    <article className={`bank-card-fly card-variant-${variant} ${frozen ? "is-frozen" : ""}`}>
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
        <strong>{scheme.toUpperCase()}</strong>
      </div>
      {balance && <div className="bank-card-balance">{balance}</div>}
    </article>
  );
}
