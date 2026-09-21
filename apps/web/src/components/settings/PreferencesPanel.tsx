"use client";

import { useEffect, useState } from "react";
import { type Preferences } from "../../lib/api";
import { getDictionary, type Language } from "../../i18n/dictionaries";
import { usePreferences } from "../providers/PreferencesProvider";

const fallback: Preferences = {
  language: "ru",
  display_currency: "USD",
  telegram_notifications_enabled: true,
  payment_notifications_enabled: true,
  rental_notifications_enabled: true,
};

export function PreferencesPanel() {
  const { preferences, setLanguage, setCurrency } = usePreferences();
  const [loaded] = useState(true);
  const t = getDictionary(preferences.language as Language);

  if (!loaded) return <p className="settings-muted">Загрузка настроек…</p>;

  return (
    <section className="settings-card" aria-labelledby="settings-title">
      <div className="settings-heading">
        <div>
          <p className="eyebrow">Flytopay</p>
          <h2 id="settings-title">{t.settings}</h2>
        </div>
      </div>
      <div className="settings-group">
        <div className="settings-row">
          <div>
            <strong>{t.interfaceLanguage}</strong>
            <span>{t.languageHint}</span>
          </div>
          <div className="segmented">
            {(["ru", "en"] as const).map((language) => (
              <button
                key={language}
                className={preferences.language === language ? "active" : ""}
                onClick={() => setLanguage(language)}
              >
                {language.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="settings-row">
          <div>
            <strong>{t.displayCurrency}</strong>
            <span>{t.currencyHint}</span>
          </div>
          <div className="segmented">
            {(["USD", "RUB"] as const).map((display_currency) => (
              <button
                key={display_currency}
                className={preferences.display_currency === display_currency ? "active" : ""}
                onClick={() => setCurrency(display_currency)}
              >
                {display_currency}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
