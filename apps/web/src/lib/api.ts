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
export type AdminUserStats = {
  totalUsers: number;
  activeUsers: number;
  blockedUsers: number;
  deletedUsers: number;
  newToday: number;
  newWeek: number;
  newMonth: number;
  usersWithCards: number;
  usersWithRentals: number;
};
export type AdminUserDetails = {
  userId: string;
  status: string;
  createdAt: string;
  accounts: Array<{ telegramId: number; username: string | null }>;
  cards: Array<{ cardId: string; status: string; lastFour: string | null; isDemo: boolean }>;
  payments: Array<{ paymentId: string; status: string; amountMinor: number; currency: string; createdAt: string }>;
  rentalCount: number;
  wallets: Array<{ currency: string; availableMinor: number }>;
  activeSessions: number;
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
export type AdminSales = {
  groupBy: string;
  days: number;
  items: Array<{ key: string; orders: number; amountMinor: number }>;
};
export type AdminProduct = {
  id: string;
  code: string;
  name: string;
  scheme: string;
  currency: string;
  enabled: boolean;
  cardType: string | null;
  maxCardsPerCardholder: number | null;
};
export type AdminPrice = {
  id: string;
  termDays: number;
  amountMinor: number;
  feeMinor: number;
  currency: string;
  scale: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
};
export type AdminSystemHealth = {
  services: Array<{ name: string; status: string }>;
  failedJobs: number;
  errorsLast24h: number;
  featureFlags: Record<string, boolean>;
  settings: Record<string, unknown>;
};
export type AdminCampaign = {
  id: string;
  name: string;
  startParameter: string;
  source: string | null;
  channel: string | null;
  isActive: boolean;
  registrations: number;
  conversions: number;
  revenueMinor: number;
};
export type AdminPromoCode = {
  id: string;
  code: string;
  discountBps: number;
  bonusMinor: number;
  currency: string;
  redemptions: number;
  maxRedemptions: number | null;
  isActive: boolean;
  expiresAt: string | null;
};
export type AdminContentDocument = {
  id: string;
  kind: string;
  slug: string;
  locale: string;
  title: string;
  body: string;
  isPublished: boolean;
};
export type AdminTemplate = {
  id: string;
  key: string;
  channel: string;
  locale: string;
  subject: string | null;
  body: string;
  isActive: boolean;
};
export type AdminPayment = {
  id: string;
  userId: string;
  provider: string;
  purpose: string;
  status: string;
  amountMinor: number;
  currency: string;
  createdAt: string;
  errorCode: string | null;
};
export type AdminRefund = {
  id: string;
  paymentAttemptId: string;
  amountMinor: number;
  currency: string;
  reason: string;
  status: string;
  createdAt: string;
};
export type AdminReferralOverview = {
  settings: { commissionBps: number; minimumPayoutMinor: number; currency: string; enabled: boolean } | null;
  links: number;
  ledgerEntries: number;
  accruedMinor: number;
  paidMinor: number;
  pendingPayouts: number;
};
async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_ORIGIN}/api/v1/admin${path}`, { credentials: "include", ...init });
  const payload = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(response.status === 403 ? "admin_forbidden" : (payload?.detail ?? "admin_load_failed"));
  return payload.data as T;
}
export const getAdminDashboard = () => adminFetch<AdminDashboard>("/dashboard/overview");
export async function getAdminUsers(params: { q?: string; status?: string; page?: number }): Promise<AdminUserPage> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => value && query.set(key, String(value)));
  return adminFetch<AdminUserPage>(`/users?${query}`);
}
export const getAdminUser = (id: string) => adminFetch<AdminUserDetails>(`/users/${id}`);
export const getAdminUserStats = () => adminFetch<AdminUserStats>("/users/stats");
export const adminRestoreUser = (id: string, reason: string) =>
  adminFetch(`/users/${id}/restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID(), ...csrfHeaders() },
    body: JSON.stringify({ reason }),
  });
export const adminDeleteUser = (id: string, reason: string) =>
  adminFetch(`/users/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID(), ...csrfHeaders() },
    body: JSON.stringify({ reason }),
  });
export const adminBulkUsers = (
  userIds: string[],
  action: "block" | "unblock" | "restore" | "delete" | "revoke-sessions",
  reason: string,
) =>
  adminFetch<{ results: Array<{ userId: string; ok: boolean; error?: string }>; succeeded: number; failed: number }>(
    "/users/bulk",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID(), ...csrfHeaders() },
      body: JSON.stringify({ user_ids: userIds, action, reason }),
    },
  );
export const getAdminActivity = (page = 1) => adminFetch<AdminActivity>(`/activity?page=${page}`);
export const getAdminSales = (days = 30) => adminFetch<AdminSales>(`/sales?days=${days}`);
export const getAdminSystemHealth = () => adminFetch<AdminSystemHealth>("/system/health");
export type AdminFeatureFlag = {
  key: string;
  description: string | null;
  enabled: boolean;
  config: Record<string, unknown>;
};
export type AdminSystemSetting = {
  key: string;
  value: Record<string, unknown>;
  description: string | null;
  isPublicBusinessSetting: boolean;
};
export type AdminErrorEvent = {
  id: string;
  source: string;
  severity: string;
  message: string;
  correlationId: string | null;
  context: Record<string, unknown>;
  createdAt: string;
};
export type AdminWebhookEvent = {
  id: string;
  provider: string;
  eventType: string;
  status: string;
  deduplicationKey: string;
  createdAt: string;
};
export const getAdminFeatureFlags = () => adminFetch<AdminFeatureFlag[]>("/system/feature-flags");
export const upsertAdminFeatureFlag = (
  key: string,
  body: { description: string | null; enabled: boolean; config: Record<string, unknown> },
) =>
  adminFetch(`/system/feature-flags/${key}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID(), ...csrfHeaders() },
    body: JSON.stringify(body),
  });
export const getAdminSettings = () => adminFetch<AdminSystemSetting[]>("/system/settings");
export const upsertAdminSetting = (
  key: string,
  body: { value: Record<string, unknown>; description: string | null; is_public_business_setting: boolean },
) =>
  adminFetch(`/system/settings/${key}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID(), ...csrfHeaders() },
    body: JSON.stringify(body),
  });
export const getAdminErrors = (page = 1, severity = "") =>
  adminPage<AdminErrorEvent>("/system/errors", { page, severity });
export const getAdminWebhooks = (status = "") => adminPage<AdminWebhookEvent>("/system/webhooks", { status });
export const requeueAdminWebhook = (id: string) =>
  adminFetch(`/system/webhooks/${id}/requeue`, {
    method: "POST",
    headers: { "Idempotency-Key": crypto.randomUUID(), ...csrfHeaders() },
  });
export const getAdminMaintenance = () =>
  adminFetch<{ enabled: boolean; message: string | null }>("/system/maintenance");
export const updateAdminMaintenance = (enabled: boolean, message: string) =>
  adminFetch<{ enabled: boolean; message: string }>("/system/maintenance", {
    method: "PUT",
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID(), ...csrfHeaders() },
    body: JSON.stringify({ enabled, message }),
  });
export const getAdminProducts = () => adminFetch<AdminProduct[]>("/catalog/products");
export const getAdminPrices = (productId: string) => adminFetch<AdminPrice[]>(`/catalog/products/${productId}/prices`);
export const updateAdminProduct = (
  id: string,
  body: { name: string; enabled: boolean; max_cards_per_cardholder: number | null },
) =>
  adminFetch<{ id: string; name: string; enabled: boolean }>(`/catalog/products/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID(), ...csrfHeaders() },
    body: JSON.stringify(body),
  });
export const updateAdminFees = (
  id: string,
  body: { issue_fee_minor: number; fund_fee_bps: number; unload_fee_bps: number; currency: string; scale: number },
) =>
  adminFetch(`/catalog/products/${id}/fees`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID(), ...csrfHeaders() },
    body: JSON.stringify(body),
  });
export const getAdminCampaigns = () => adminFetch<AdminCampaign[]>("/marketing/campaigns");
export const createAdminCampaign = (body: {
  name: string;
  start_parameter: string;
  source: string | null;
  channel: string | null;
  budget_minor: number | null;
  currency: string;
}) =>
  adminFetch<{ id: string; name: string; startParameter: string }>("/marketing/campaigns", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID(), ...csrfHeaders() },
    body: JSON.stringify(body),
  });
export const updateAdminCampaign = (
  id: string,
  body: { name: string; source: string | null; channel: string | null; is_active: boolean },
) =>
  adminFetch(`/marketing/campaigns/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID(), ...csrfHeaders() },
    body: JSON.stringify(body),
  });
export const archiveAdminCampaign = (id: string) =>
  adminFetch(`/marketing/campaigns/${id}`, {
    method: "DELETE",
    headers: { "Idempotency-Key": crypto.randomUUID(), ...csrfHeaders() },
  });
export const getAdminPromoCodes = () => adminFetch<AdminPromoCode[]>("/marketing/promo-codes");
export const createAdminPromo = (body: {
  code: string;
  discount_bps: number;
  bonus_minor: number;
  currency: string;
  max_redemptions: number | null;
}) =>
  adminFetch<{ id: string; code: string }>("/marketing/promo-codes", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID(), ...csrfHeaders() },
    body: JSON.stringify(body),
  });
export const updateAdminPromo = (
  id: string,
  body: { discount_bps: number; bonus_minor: number; max_redemptions: number | null; is_active: boolean },
) =>
  adminFetch(`/marketing/promo-codes/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID(), ...csrfHeaders() },
    body: JSON.stringify(body),
  });
export const archiveAdminPromo = (id: string) =>
  adminFetch(`/marketing/promo-codes/${id}`, {
    method: "DELETE",
    headers: { "Idempotency-Key": crypto.randomUUID(), ...csrfHeaders() },
  });
export const getAdminDocuments = () => adminFetch<AdminContentDocument[]>("/content/documents");
export const createAdminDocument = (body: {
  kind: string;
  slug: string;
  locale: string;
  title: string;
  body: string;
  is_published: boolean;
}) =>
  adminFetch<{ id: string; slug: string }>("/content/documents", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID(), ...csrfHeaders() },
    body: JSON.stringify(body),
  });
export const getAdminTemplates = () => adminFetch<AdminTemplate[]>("/content/templates");
export type AdminBroadcast = {
  id: string;
  title: string;
  channel: string;
  audience: { segment: string };
  body: string;
  status: string;
  scheduledAt: string | null;
  sentCount: number;
  failedCount: number;
  createdAt: string;
};
export type AdminBroadcastDelivery = {
  id: string;
  userId: string;
  status: string;
  error: string | null;
  createdAt: string;
};
export const getAdminBroadcasts = () => adminFetch<AdminBroadcast[]>("/content/broadcasts");
export const createAdminBroadcast = (body: {
  title: string;
  channel: "telegram";
  audience: { segment: string };
  body: string;
  scheduled_at: string | null;
}) =>
  adminFetch<AdminBroadcast>("/content/broadcasts", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID(), ...csrfHeaders() },
    body: JSON.stringify(body),
  });
export const updateAdminBroadcast = (
  id: string,
  body: {
    title: string;
    channel: "telegram";
    audience: { segment: string };
    body: string;
    scheduled_at: string | null;
  },
) =>
  adminFetch<AdminBroadcast>(`/content/broadcasts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID(), ...csrfHeaders() },
    body: JSON.stringify(body),
  });
export const previewAdminBroadcast = (id: string) =>
  adminFetch<{ title: string; body: string; audience: { segment: string }; recipients: number }>(
    `/content/broadcasts/${id}/preview`,
    { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID(), ...csrfHeaders() } },
  );
export const sendAdminBroadcast = (id: string) =>
  adminFetch<{ id: string; status: string; queued: number }>(`/content/broadcasts/${id}/send`, {
    method: "POST",
    headers: { "Idempotency-Key": crypto.randomUUID(), ...csrfHeaders() },
  });
export const getAdminBroadcastDeliveries = (id: string) =>
  adminFetch<AdminBroadcastDelivery[]>(`/content/broadcasts/${id}/deliveries`);
export const createAdminTemplate = (body: {
  key: string;
  channel: string;
  locale: string;
  subject: string | null;
  body: string;
}) =>
  adminFetch<{ id: string; key: string }>("/content/templates", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID(), ...csrfHeaders() },
    body: JSON.stringify(body),
  });
export const updateAdminDocument = (
  id: string,
  body: { kind: string; slug: string; locale: string; title: string; body: string; is_published: boolean },
) =>
  adminFetch(`/content/documents/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID(), ...csrfHeaders() },
    body: JSON.stringify(body),
  });
export const deleteAdminDocument = (id: string) =>
  adminFetch(`/content/documents/${id}`, {
    method: "DELETE",
    headers: { "Idempotency-Key": crypto.randomUUID(), ...csrfHeaders() },
  });
export const updateAdminTemplate = (
  id: string,
  body: { key: string; channel: string; locale: string; subject: string | null; body: string; is_active: boolean },
) =>
  adminFetch(`/content/templates/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID(), ...csrfHeaders() },
    body: JSON.stringify(body),
  });
export const getAdminPayments = () => adminFetch<AdminPayment[]>("/finance/payments");
export const getAdminRefunds = () => adminFetch<AdminRefund[]>("/finance/refunds");
export type AdminFinanceSummary = {
  days: number;
  groupBy: string;
  grossMinor: number;
  orders: number;
  failedPayments: number;
  knownIssuanceFeesMinor: number;
  openReconciliation: number;
  averageOrderMinor: number;
  groups: Array<{ key: string; orders: number; amountMinor: number }>;
};
export type AdminReconciliationCase = {
  id: string;
  paymentAttemptId: string;
  type: string;
  status: string;
  reason: string;
  providerStatus: string | null;
  resolvedAt: string | null;
  createdAt: string;
};
export const getAdminFinanceSummary = (days = 30, groupBy = "provider") =>
  adminFetch<AdminFinanceSummary>(`/finance/reports/summary?days=${days}&group_by=${groupBy}`);
export const getAdminReconciliation = (status = "open") =>
  adminFetch<AdminReconciliationCase[]>(`/finance/reconciliation?status=${status}`);
export const adminRefundDecision = (
  id: string,
  action: "approve" | "reject" | "process" | "complete",
  reason: string,
) =>
  adminFetch(`/finance/refunds/${id}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID(), ...csrfHeaders() },
    body: JSON.stringify({ reason }),
  });
export const adminResolveCase = (id: string, reason: string) =>
  adminFetch(`/finance/reconciliation/${id}/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID(), ...csrfHeaders() },
    body: JSON.stringify({ reason }),
  });
export async function downloadAdminPaymentsCsv(days = 30): Promise<void> {
  const response = await fetch(`${API_ORIGIN}/api/v1/admin/finance/reports/payments.csv?days=${days}`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error("csv_failed");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `payments-${days}d.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
export type AdminCardOverview = {
  total: number;
  active: number;
  frozen: number;
  closed: number;
  demo: number;
  pendingOperations: number;
  failedOperations: number;
};
export type AdminCard = {
  cardId: string;
  userId: string;
  telegramId: number | null;
  status: string;
  lastFour: string | null;
  isDemo: boolean;
  currency: string;
  balanceMinor: number | null;
  productCode: string | null;
  productName: string | null;
  createdAt: string;
};
export type AdminCardDetail = AdminCard & {
  userStatus: string | null;
  rentals: Array<{
    id: string;
    status: string;
    termDays: number;
    expiresAt: string | null;
    priceMinor: number;
    currency: string;
  }>;
  transactions: Array<{
    id: string;
    type: string;
    status: string;
    amountMinor: number;
    feeMinor: number;
    currency: string;
    merchantName: string | null;
    occurredAt: string;
  }>;
  operations: Array<{
    id: string;
    kind: string;
    status: string;
    providerOrderId: string | null;
    createdAt: string;
    error: string | null;
  }>;
};
export type AdminIssuance = {
  issuanceId: string;
  userId: string;
  telegramId: number | null;
  productCode: string;
  providerCode: string;
  termDays: number;
  status: string;
  amountMinor: number;
  totalChargeMinor: number | null;
  currency: string;
  providerOrderId: string | null;
  createdAt: string;
};
export type AdminRental = {
  id: string;
  userId: string;
  telegramId: number | null;
  cardId: string;
  status: string;
  termDays: number;
  priceMinor: number;
  currency: string;
  startsAt: string | null;
  expiresAt: string | null;
};
export type AdminTransaction = {
  id: string;
  cardId: string;
  type: string;
  status: string;
  amountMinor: number;
  feeMinor: number;
  currency: string;
  merchantName: string | null;
  declineCode: string | null;
  occurredAt: string;
};
export type AdminCaasOperation = {
  id: string;
  kind: string;
  status: string;
  providerOrderId: string | null;
  error: string | null;
  createdAt: string;
};
export type AdminPage<T> = { items: T[]; total: number; page: number; limit: number };
async function adminPage<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined> = {},
): Promise<AdminPage<T>> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(
    ([key, value]) => value !== undefined && value !== "" && query.set(key, String(value)),
  );
  return adminFetch<AdminPage<T>>(`${path}?${query}`);
}
export const getAdminCardsOverview = () => adminFetch<AdminCardOverview>("/cards/overview");
export const getAdminCards = (params: { q?: string; status?: string; is_demo?: boolean; page?: number } = {}) =>
  adminPage<AdminCard>("/cards", params);
export const getAdminCard = (id: string) => adminFetch<AdminCardDetail>(`/cards/${id}`);
export const getAdminIssuances = (params: { status?: string; page?: number } = {}) =>
  adminPage<AdminIssuance>("/issuances", params);
export const getAdminRentals = (params: { status?: string; page?: number } = {}) =>
  adminPage<AdminRental>("/rentals", params);
export const getAdminTransactions = (params: { card_id?: string; status?: string; page?: number } = {}) =>
  adminPage<AdminTransaction>("/transactions", params);
export const getAdminCaasOperations = (params: { status?: string; page?: number } = {}) =>
  adminPage<AdminCaasOperation>("/caas-operations", params);
export const adminCardAction = (
  id: string,
  action: "freeze" | "unfreeze" | "close" | "fund" | "unload",
  reason: string,
  amountMinor?: number,
) =>
  adminFetch(`/cards/${id}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID(), ...csrfHeaders() },
    body: JSON.stringify({ reason, amount_minor: amountMinor }),
  });
export const getAdminReferralOverview = () => adminFetch<AdminReferralOverview>("/referrals/overview");
export type AdminReferralPartner = {
  userId: string;
  telegramId: number | null;
  invited: number;
  accruedMinor: number;
  paidMinor: number;
};
export type AdminPayout = {
  id: string;
  userId: string;
  amountMinor: number;
  currency: string;
  status: string;
  createdAt: string;
  processedAt: string | null;
};
export type AdminReferralTreeItem = {
  linkId: string;
  referredUserId: string;
  telegramId: number | null;
  status: string;
  earnedMinor: number;
  createdAt: string;
};
export const updateAdminReferralSettings = (body: {
  commission_bps: number;
  minimum_payout_minor: number;
  currency: string;
  is_enabled: boolean;
}) =>
  adminFetch("/referrals/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID(), ...csrfHeaders() },
    body: JSON.stringify(body),
  });
export const getAdminPayouts = () => adminFetch<AdminPayout[]>("/referrals/payouts");
export const adminPayoutDecision = (id: string, action: "approve" | "reject", reason: string) =>
  adminFetch(`/referrals/payouts/${id}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID(), ...csrfHeaders() },
    body: JSON.stringify({ reason }),
  });
export const getAdminReferralPartners = () => adminFetch<AdminReferralPartner[]>("/referrals/partners");
export const getAdminReferralTree = (userId: string) =>
  adminFetch<{ userId: string; items: AdminReferralTreeItem[]; total: number }>(`/referrals/tree?user_id=${userId}`);
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
