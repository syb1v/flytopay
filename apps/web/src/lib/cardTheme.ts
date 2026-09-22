export type CardTier = "premium" | "travel" | "subs" | "default";

export type TierMeta = {
  art: string;
  ru: string;
  en: string;
  ruDesc: string;
  enDesc: string;
};

export const tierMeta: Record<CardTier, TierMeta> = {
  premium: {
    art: "\u{1F310}",
    ru: "Премиальная",
    en: "Premium",
    ruDesc: "Для тех, кто совершает много покупок за границей",
    enDesc: "For frequent international purchases",
  },
  travel: {
    art: "\u{1F9F3}",
    ru: "Для путешествий",
    en: "Travel",
    ruDesc: "Карта в долларах для оплаты за границей",
    enDesc: "A USD card for payments abroad",
  },
  subs: {
    art: "\u{1F3A7}",
    ru: "Для подписок",
    en: "Subscriptions",
    ruDesc: "Карта в долларах для оплаты сервисов",
    enDesc: "A USD card for online services",
  },
  default: {
    art: "\u{1F310}",
    ru: "Базовая",
    en: "Standard",
    ruDesc: "Виртуальная карта для зарубежных сервисов",
    enDesc: "A virtual card for international services",
  },
};

/**
 * Single source of truth for card tier resolution.
 * The same product code MUST resolve to the same tier on every screen:
 * home carousel, card details dialog, catalog, and transaction modals.
 */
export function tierForProduct(productCode: string | null | undefined): CardTier {
  const value = (productCode ?? "").toLowerCase();
  if (value.includes("premium") || value.includes("black") || value.includes("metal")) return "premium";
  if (value.includes("travel") || value.includes("trip") || value.includes("journey")) return "travel";
  if (value.includes("sub") || value.includes("subscription")) return "subs";
  return "default";
}

/** Normalize provider scheme strings for rendering; unknown values fall back to VISA. */
export function schemeForCard(scheme: string | null | undefined): string {
  const value = (scheme ?? "").toLowerCase();
  if (value === "mastercard" || value === "mc" || value === "maestro")
    return value === "maestro" ? "MAESTRO" : "MASTERCARD";
  return "VISA";
}
