const API_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN ?? "";

function csrfHeaders(extra: Record<string, string> = {}): Record<string, string> {
  if (typeof document === "undefined") return extra;
  const match = document.cookie.match(/(?:^|;\s*)flytopay_csrf=([^;]+)/);
  const token = match?.[1] ? decodeURIComponent(match[1]) : "";
  return token ? { ...extra, "X-CSRF-Token": token } : extra;
}

export async function loginWithTelegram(initData: string): Promise<void> {
  const response = await fetch(`${API_ORIGIN}/api/v1/auth/telegram`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...csrfHeaders() },
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

export async function getAdminStatus(): Promise<boolean> {
  const response = await fetch(`${API_ORIGIN}/api/v1/admin/status`, { credentials: "include" });
  if (!response.ok) return false;
  const payload = (await response.json()) as { data?: { isAdmin?: boolean } };
  return payload.data?.isAdmin === true;
}

export async function updatePreferences(patch: Partial<Preferences>): Promise<Preferences> {
  const response = await fetch(`${API_ORIGIN}/api/v1/me/preferences`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...csrfHeaders() },
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
  scheme: string | null;
  product_name: string | null;
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
  card_type: "CONSUMER" | "CORPORATE" | null;
  features: Record<string, boolean> | null;
  controls: Record<string, boolean | number | string | null> | null;
};

export async function getCardProducts(): Promise<CardProduct[]> {
  const response = await fetch(`${API_ORIGIN}/api/v1/catalog/products`, { credentials: "include" });
  if (!response.ok) throw new Error("products_load_failed");
  return response.json() as Promise<CardProduct[]>;
}

export type ProductPrice = {
  product_code: string;
  currency: string;
  scale: number;
  amount_minor: number | null;
  fee_minor: number | null;
  total_charge_minor: number | null;
  available: boolean;
};

export async function getProductPrices(): Promise<ProductPrice[]> {
  const response = await fetch(`${API_ORIGIN}/api/v1/issuance/prices`, { credentials: "include" });
  if (!response.ok) throw new Error("prices_load_failed");
  return response.json() as Promise<ProductPrice[]>;
}

export type CardDetails = {
  card_id: string;
  masked_pan: string | null;
  last_four: string | null;
  holder: string | null;
  expiry_month: string | null;
  expiry_year: string | null;
  cvv: string | null;
  currency: string;
  status: string;
  billing_address: {
    line1: string | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
    country: string | null;
  } | null;
};

export async function getCardDetails(cardId: string): Promise<CardDetails> {
  const response = await fetch(`${API_ORIGIN}/api/v1/cards/${cardId}/details`, { credentials: "include" });
  if (!response.ok) throw new Error("details_load_failed");
  return response.json() as Promise<CardDetails>;
}

export type CardLifecycleResult = {
  card_id: string;
  status: string;
  operation_status: string;
  order_id: string | null;
};

async function cardLifecycle(action: "freeze" | "unfreeze" | "close", cardId: string): Promise<CardLifecycleResult> {
  const response = await fetch(`${API_ORIGIN}/api/v1/cards/${cardId}/${action}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID(), ...csrfHeaders() },
    body: JSON.stringify({}),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.detail ?? `${action}_failed`);
  return data as CardLifecycleResult;
}

export const freezeCard = (cardId: string) => cardLifecycle("freeze", cardId);
export const unfreezeCard = (cardId: string) => cardLifecycle("unfreeze", cardId);
export const closeCard = (cardId: string) => cardLifecycle("close", cardId);

export async function fundCard(cardId: string, amountMinor: number): Promise<CardLifecycleResult> {
  const response = await fetch(`${API_ORIGIN}/api/v1/cards/${cardId}/fund`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID(), ...csrfHeaders() },
    body: JSON.stringify({ amount_minor: amountMinor }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.detail ?? "fund_failed");
  return data as CardLifecycleResult;
}

export async function unloadCard(cardId: string, amountMinor: number): Promise<CardLifecycleResult> {
  const response = await fetch(`${API_ORIGIN}/api/v1/cards/${cardId}/unload`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID(), ...csrfHeaders() },
    body: JSON.stringify({ amount_minor: amountMinor }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.detail ?? "unload_failed");
  return data as CardLifecycleResult;
}

export type CardTransaction = {
  id: string;
  type: string;
  status: string;
  amount_minor: number;
  fee_minor: number;
  currency: string;
  scale: number;
  merchant_name: string | null;
  mcc: string | null;
  mcc_description: string | null;
  merchant_country: string | null;
  decline_code: string | null;
  fee_type: string | null;
  occurred_at: string | null;
  authorization_code: string | null;
  related_authorization_code: string | null;
};

const TRANSACTIONS_TTL_MS = 60_000;
const TRANSACTIONS_FETCH_LIMIT = 100;
const transactionsCache = new Map<string, { at: number; data: CardTransaction[] }>();
const transactionsInFlight = new Map<string, Promise<CardTransaction[]>>();

async function fetchCardTransactions(cardId: string): Promise<CardTransaction[]> {
  const response = await fetch(`${API_ORIGIN}/api/v1/cards/${cardId}/transactions?limit=${TRANSACTIONS_FETCH_LIMIT}`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error("transactions_load_failed");
  return response.json() as Promise<CardTransaction[]>;
}

/**
 * Cached card history: one network request per card per TTL window, shared by
 * the home screen, history page and prefetch. Concurrent callers reuse the
 * same in-flight request.
 */
export async function getCardTransactions(cardId: string, limit = 50): Promise<CardTransaction[]> {
  const cached = transactionsCache.get(cardId);
  if (cached && Date.now() - cached.at < TRANSACTIONS_TTL_MS) return cached.data.slice(0, limit);
  let pending = transactionsInFlight.get(cardId);
  if (!pending) {
    pending = fetchCardTransactions(cardId)
      .then((data) => {
        transactionsCache.set(cardId, { at: Date.now(), data });
        return data;
      })
      .finally(() => transactionsInFlight.delete(cardId));
    transactionsInFlight.set(cardId, pending);
  }
  return (await pending).slice(0, limit);
}

export function prefetchCardTransactions(cardIds: string[]): void {
  for (const id of cardIds) void getCardTransactions(id).catch(() => undefined);
}

export function invalidateCardTransactions(cardId?: string): void {
  if (cardId) transactionsCache.delete(cardId);
  else transactionsCache.clear();
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
export type AdminDashboard = {
  totals: Record<string, number>;
  paymentAmounts: Record<string, number>;
  walletBalances: Record<string, number>;
  days: Array<{ date: string; users: number; payments: number; rentals: number }>;
};
export type AdminUser = {
  userId: string;
  telegramId: number | null;
  username: string | null;
  status: string;
  createdAt: string;
};
export type AdminUserPage = { items: AdminUser[]; total: number; page: number; limit: number };
export type AdminUserDetails = {
  userId: string;
  status: string;
  createdAt: string;
  accounts: Array<{ telegramId: number; username: string | null }>;
  cards: Array<{ cardId: string; status: string; lastFour: string | null; isDemo: boolean }>;
  payments: Array<{ paymentId: string; status: string; amountMinor: number; currency: string; createdAt: string }>;
  rentalCount: number;
  wallets: Array<{ currency: string; availableMinor: number }>;
};
export type AdminActivity = {
  items: Array<{
    actorUserId: string | null;
    action: string;
    resourceId: string | null;
    reason: string;
    createdAt: string;
  }>;
  total: number;
  page: number;
  limit: number;
};
async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_ORIGIN}/api/v1/admin${path}`, { credentials: "include", ...init });
  const payload = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(response.status === 403 ? "admin_forbidden" : (payload?.detail ?? "admin_load_failed"));
  return payload.data as T;
}
export const getAdminDashboard = () => adminFetch<AdminDashboard>("/dashboard");
export async function getAdminUsers(params: { q?: string; status?: string; page?: number }): Promise<AdminUserPage> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => value && query.set(key, String(value)));
  return adminFetch<AdminUserPage>(`/users?${query}`);
}
export const getAdminUser = (id: string) => adminFetch<AdminUserDetails>(`/users/${id}`);
export const getAdminActivity = (page = 1) => adminFetch<AdminActivity>(`/activity?page=${page}`);
export async function adminUserAction(
  id: string,
  action: "block" | "unblock" | "revoke-sessions",
  reason: string,
): Promise<void> {
  await adminFetch(`/users/${id}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID(), ...csrfHeaders() },
    body: JSON.stringify({ reason }),
  });
}
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

export class IssuanceApiError extends Error {
  constructor(
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "IssuanceApiError";
  }
}

function issuanceError(detail: unknown, fallback: string): IssuanceApiError {
  if (Array.isArray(detail)) {
    const fields: Record<string, string> = {};
    for (const item of detail) {
      if (!item || typeof item !== "object") continue;
      const entry = item as { loc?: unknown; msg?: unknown };
      const field = Array.isArray(entry.loc) ? entry.loc.at(-1) : null;
      if (typeof field === "string" && typeof entry.msg === "string") fields[field] = entry.msg;
    }
    return new IssuanceApiError("validation_failed", fields);
  }
  if (detail && typeof detail === "object") {
    const data = detail as { message?: unknown; code?: unknown; fields?: unknown };
    const fields: Record<string, string> = {};
    if (data.fields && typeof data.fields === "object") {
      for (const [key, value] of Object.entries(data.fields)) {
        if (typeof value === "string") fields[key] = value;
      }
    }
    return new IssuanceApiError(
      typeof data.code === "string" ? data.code : typeof data.message === "string" ? data.message : fallback,
      fields,
    );
  }
  return new IssuanceApiError(typeof detail === "string" ? detail : fallback);
}

export async function getIssueQuote(input: CardholderInput) {
  const response = await fetch(`${API_ORIGIN}/api/v1/issuance/quote`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...csrfHeaders() },
    body: JSON.stringify(input),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw issuanceError(data?.detail, "quote_failed");
  return data as {
    data: {
      issuanceId: string;
      amountMinor: number;
      feeMinor: number;
      totalChargeMinor: number;
      currency: string;
      planCode: string;
      planVersion: number;
    };
  };
}

export async function issueCardFromWallet(
  issuanceId: string,
): Promise<{ cardId: string; status: string; orderId: string | null }> {
  const response = await fetch(`${API_ORIGIN}/api/v1/issuance/${issuanceId}/issue`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...csrfHeaders() },
    body: "{}",
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw issuanceError(data?.detail, "issue_failed");
  return data.data;
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
    headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey, ...csrfHeaders() },
    body: JSON.stringify(input),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail ?? "checkout_failed");
  return data as { data: { paymentId: string; status: string; checkoutUrl: string | null } };
}
