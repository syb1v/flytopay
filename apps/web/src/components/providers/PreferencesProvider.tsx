"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getPreferences, loginWithTelegram, type Preferences, updatePreferences } from "../../lib/api";

type PreferencesContextValue = { preferences: Preferences; authReady: boolean; setLanguage: (language: Preferences["language"]) => void; setCurrency: (currency: Preferences["display_currency"]) => void; };
const fallback: Preferences = { language: "ru", display_currency: "USD", telegram_notifications_enabled: true, payment_notifications_enabled: true, rental_notifications_enabled: true };
const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(() => {
    if (typeof window === "undefined") return fallback;
    try { return { ...fallback, ...JSON.parse(localStorage.getItem("flytopay.preferences") || "{}") }; } catch { return fallback; }
  });
  const [authReady, setAuthReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      for (let attempt = 0; attempt < 20 && !window.Telegram?.WebApp?.initData; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 100));
      }
      const initData = window.Telegram?.WebApp?.initData;
      try {
        if (initData) await loginWithTelegram(initData);
        const remote = await getPreferences();
        if (!cancelled) setPreferences(remote);
      } catch {
        // Public web pages can render without an authenticated Telegram session.
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    };
    void bootstrap();
    return () => { cancelled = true; };
  }, []);
  useEffect(() => { localStorage.setItem("flytopay.preferences", JSON.stringify(preferences)); }, [preferences]);
  const value = useMemo(() => ({ preferences, authReady, setLanguage: (language: Preferences["language"]) => { const next = { ...preferences, language }; setPreferences(next); updatePreferences({ language }).catch(() => undefined); }, setCurrency: (display_currency: Preferences["display_currency"]) => { const next = { ...preferences, display_currency }; setPreferences(next); updatePreferences({ display_currency }).catch(() => undefined); } }), [preferences, authReady]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() { const value = useContext(PreferencesContext); if (!value) throw new Error("PreferencesProvider is missing"); return value; }
