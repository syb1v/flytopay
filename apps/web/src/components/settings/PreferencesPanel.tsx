"use client";

import { useEffect, useState } from "react";
import { getPreferences, type Preferences, updatePreferences } from "../../lib/api";

const fallback: Preferences = {
  language: "ru",
  display_currency: "USD",
  telegram_notifications_enabled: true,
  payment_notifications_enabled: true,
  rental_notifications_enabled: true,
};

export function PreferencesPanel() {
  const [preferences, setPreferences] = useState<Preferences>(fallback);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getPreferences().then(setPreferences).catch(() => undefined).finally(() => setLoaded(true));
  }, []);

  async function change(patch: Partial<Preferences>) {
    const previous = preferences;
    const next = { ...preferences, ...patch };
    setPreferences(next);
    setSaving(true);
    try {
      setPreferences(await updatePreferences(patch));
    } catch {
      setPreferences(previous);
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return <p className="settings-muted">Загрузка настроек…</p>;

  return (
    <section className="settings-card" aria-labelledby="settings-title">
      <div className="settings-heading"><div><p className="eyebrow">Flytopay</p><h2 id="settings-title">Настройки</h2></div>{saving && <span className="settings-muted">Сохраняем…</span>}</div>
      <div className="settings-group">
        <div className="settings-row"><div><strong>Язык интерфейса</strong><span>Язык кабинета и уведомлений</span></div><div className="segmented">{(["ru", "en"] as const).map((language) => <button key={language} className={preferences.language === language ? "active" : ""} onClick={() => change({ language })}>{language.toUpperCase()}</button>)}</div></div>
        <div className="settings-row"><div><strong>Валюта отображения</strong><span>Не меняет фактическую валюту операции</span></div><div className="segmented">{(["USD", "RUB"] as const).map((display_currency) => <button key={display_currency} className={preferences.display_currency === display_currency ? "active" : ""} onClick={() => change({ display_currency })}>{display_currency}</button>)}</div></div>
      </div>
    </section>
  );
}
