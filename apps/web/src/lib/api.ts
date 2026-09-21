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
