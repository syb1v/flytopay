import { Radio, CreditCard } from "lucide-react";
import { usePreferences } from "../providers/PreferencesProvider";

export function CardVisual({ maskedPan, status, balance, scheme = "VISA", holder = "Flytopay user", expiry = "MM/YY" }: { maskedPan?: string | null; status?: string; balance?: string; scheme?: string; holder?: string; expiry?: string }) {
  const { preferences } = usePreferences();
  const ru = preferences.language === "ru";
  const frozen = status === "frozen";
  return <article className={`bank-card-fly ${frozen ? "is-frozen" : ""}`}>
    <span className="bank-card-edge" /><span className="bank-card-shine" />
    <div className="bank-card-top"><strong><i>F</i>LYTOPAY</strong><Radio className="contactless-mark" aria-hidden="true" /></div>
    <div className="bank-card-hardware"><span className="bank-chip"><span /></span>{frozen && <span className="frozen-pill">{ru ? "Заморожена" : "Frozen"}</span>}<CreditCard size={20} className="card-circuit" /></div>
    <div className="bank-card-number">{maskedPan ?? "••••  ••••  ••••  ••••"}</div>
    <div className="bank-card-bottom"><span><small>{ru ? "Держатель" : "Cardholder"}</small>{holder}</span><span><small>{ru ? "Срок" : "Valid thru"}</small>{expiry}</span><strong>{scheme.toUpperCase()}</strong></div>
    {balance && <div className="bank-card-balance">{balance}</div>}
  </article>;
}
