const API_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN ?? "";

export async function loginWithTelegram(initData: string): Promise<void> {
  const response = await fetch(`${API_ORIGIN}/api/v1/auth/telegram`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ init_data: initData }),
  });
  if (!response.ok) throw new Error("telegram_auth_failed");
}

export type Preferences = {
  language: "ru" | "en";
  display_currency: "USD" | "RUB";
  telegram_notifications_enabled: boolean;
  payment_notifications_enabled: boolean;
  rental_notifications_enabled: boolean;
};

export async function getPreferences(): Promise<Preferences> {
  const response = await fetch(`${API_ORIGIN}/api/v1/me/preferences`, { credentials: "include" });
  if (!response.ok) throw new Error("preferences_load_failed");
  return response.json() as Promise<Preferences>;
}

export async function updatePreferences(patch: Partial<Preferences>): Promise<Preferences> {
  const response = await fetch(`${API_ORIGIN}/api/v1/me/preferences`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!response.ok) throw new Error("preferences_update_failed");
  return response.json() as Promise<Preferences>;
}

export type Wallet = {
  currency: string;
  scale: number;
  available_minor: number;
  reserved_minor: number;
  total_minor: number;
};

export async function getWallet(): Promise<Wallet> {
  const response = await fetch(`${API_ORIGIN}/api/v1/wallet`, { credentials: "include" });
  if (!response.ok) throw new Error("wallet_load_failed");
  return response.json() as Promise<Wallet>;
}

export type Card = {
  id: string;
  status: string;
  masked_pan: string | null;
  last_four: string | null;
  balance_minor: number | null;
  currency: string;
  scale: number;
  rental_expires_at: string | null;
  product_code: string | null;
};
export type Rental = {
  id: string;
  card_id: string;
  term_days: number;
  status: string;
  starts_at: string | null;
  expires_at: string | null;
  grace_expires_at: string | null;
  price_minor: number;
  currency: string;
  scale: number;
};
export type CardProduct = {
  code: string;
  name: string;
  scheme: string;
  currency: string;
  provider_code: string;
  enabled: boolean;
  max_cards_per_cardholder: number | null;
  provider_settings: Array<{ key: string; type: string; value: boolean | number | string | null }> | null;
};

export async function getCardProducts(): Promise<CardProduct[]> {
  const response = await fetch(`${API_ORIGIN}/api/v1/catalog/products`, { credentials: "include" });
  if (!response.ok) throw new Error("products_load_failed");
  return response.json() as Promise<CardProduct[]>;
}

export type AdminOverview = {
  users: number;
  telegramAccounts: number;
  cards: number;
  demoCards: number;
  rentals: number;
  payments: number;
  wallets: number;
};
export async function getAdminOverview(): Promise<AdminOverview> {
  const response = await fetch(`${API_ORIGIN}/api/v1/admin/overview`, { credentials: "include" });
  if (!response.ok) throw new Error(response.status === 403 ? "admin_forbidden" : "admin_load_failed");
  const payload = await response.json();
  return payload.data as AdminOverview;
}
export async function getAdminCollection(path: "users" | "cards" | "payments" | "issuances") {
  const response = await fetch(`${API_ORIGIN}/api/v1/admin/${path}`, { credentials: "include" });
  if (!response.ok) throw new Error(response.status === 403 ? "admin_forbidden" : "admin_load_failed");
  const payload = await response.json();
  return payload.data as Array<Record<string, string | number | boolean | null>>;
}

export type CardholderInput = {
  product_code: string;
  amount_minor: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  country: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
};

export async function getIssueQuote(input: CardholderInput) {
  const response = await fetch(`${API_ORIGIN}/api/v1/issuance/quote`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail ?? "quote_failed");
  return data as {
    data: {
      amountMinor: number;
      feeMinor: number;
      totalChargeMinor: number;
      currency: string;
      planCode: string;
      planVersion: number;
    };
  };
}

export async function getCards(): Promise<Card[]> {
  const response = await fetch(`${API_ORIGIN}/api/v1/cards`, { credentials: "include" });
  if (!response.ok) throw new Error("cards_load_failed");
  return response.json() as Promise<Card[]>;
}

export async function getRentals(): Promise<Rental[]> {
  const response = await fetch(`${API_ORIGIN}/api/v1/rentals`, { credentials: "include" });
  if (!response.ok) throw new Error("rentals_load_failed");
  return response.json() as Promise<Rental[]>;
}

export async function createCheckout(
  input: {
    provider: "platega" | "pay2328" | "telegram_stars";
    purpose: string;
    amount_minor: number;
    currency: string;
    scale: number;
    return_url: string;
  },
  idempotencyKey: string,
) {
  const response = await fetch(`${API_ORIGIN}/api/v1/payments/checkout`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(input),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail ?? "checkout_failed");
  return data as { data: { paymentId: string; status: string; checkoutUrl: string | null } };
}
