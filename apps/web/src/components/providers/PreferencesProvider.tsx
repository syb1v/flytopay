"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getPreferences, type Preferences, updatePreferences } from "../../lib/api";

type PreferencesContextValue = { preferences: Preferences; setLanguage: (language: Preferences["language"]) => void; setCurrency: (currency: Preferences["display_currency"]) => void; };
const fallback: Preferences = { language: "ru", display_currency: "USD", telegram_notifications_enabled: true, payment_notifications_enabled: true, rental_notifications_enabled: true };
const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(() => {
    if (typeof window === "undefined") return fallback;
    try { return { ...fallback, ...JSON.parse(localStorage.getItem("flytopay.preferences") || "{}") }; } catch { return fallback; }
  });
  useEffect(() => { getPreferences().then((remote) => setPreferences(remote)).catch(() => undefined); }, []);
  useEffect(() => { localStorage.setItem("flytopay.preferences", JSON.stringify(preferences)); }, [preferences]);
  const value = useMemo(() => ({ preferences, setLanguage: (language: Preferences["language"]) => { const next = { ...preferences, language }; setPreferences(next); updatePreferences({ language }).catch(() => undefined); }, setCurrency: (display_currency: Preferences["display_currency"]) => { const next = { ...preferences, display_currency }; setPreferences(next); updatePreferences({ display_currency }).catch(() => undefined); } }), [preferences]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() { const value = useContext(PreferencesContext); if (!value) throw new Error("PreferencesProvider is missing"); return value; }
