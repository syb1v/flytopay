const API_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:8000";

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

export type Wallet = { currency: string; scale: number; available_minor: number; reserved_minor: number; total_minor: number };

export async function getWallet(): Promise<Wallet> {
  const response = await fetch(`${API_ORIGIN}/api/v1/wallet`, { credentials: "include" });
  if (!response.ok) throw new Error("wallet_load_failed");
  return response.json() as Promise<Wallet>;
}

export type Card = { id: string; status: string; masked_pan: string | null; last_four: string | null; balance_minor: number | null; currency: string; scale: number; rental_expires_at: string | null };
export type Rental = { id: string; card_id: string; term_days: number; status: string; starts_at: string | null; expires_at: string | null; grace_expires_at: string | null; price_minor: number; currency: string; scale: number };

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

export async function createCheckout(input: { provider: "platega" | "pay2328" | "telegram_stars"; purpose: string; amount_minor: number; currency: string; scale: number; return_url: string }, idempotencyKey: string) {
  const response = await fetch(`${API_ORIGIN}/api/v1/payments/checkout`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey }, body: JSON.stringify(input) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail ?? "checkout_failed");
  return data as { data: { paymentId: string; status: string; checkoutUrl: string | null } };
}
