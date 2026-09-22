"use client";

import { usePreferences } from "../providers/PreferencesProvider";

export function Loader({ label }: { label?: string }) {
  const { preferences } = usePreferences();
  const ru = preferences.language === "ru";
  const text = label ?? (ru ? "Загружаем данные" : "Loading");
  return (
    <div className="fly-loader" role="status" aria-live="polite">
      <span className="fly-loader-mark" aria-hidden="true">
        <img src="/logo.svg" alt="" />
      </span>
      <p>{text}…</p>
    </div>
  );
}
