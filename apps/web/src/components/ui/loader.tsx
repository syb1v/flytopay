"use client";

import { usePreferences } from "../providers/PreferencesProvider";

export function Loader({ label }: { label?: string }) {
  const { preferences } = usePreferences();
  const ru = preferences.language === "ru";
  const text = label ?? (ru ? "Загружаем данные" : "Loading");
  return (
    <div className="fly-loader" role="status" aria-live="polite">
      <svg className="fly-loader-logo" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="flyLoaderStroke" x1="0" y1="0" x2="48" y2="48">
            <stop offset="0%" stopColor="#b8f13d" />
            <stop offset="100%" stopColor="#7ba82c" />
          </linearGradient>
        </defs>
        <circle
          className="fly-loader-ring"
          cx="24"
          cy="24"
          r="20"
          stroke="url(#flyLoaderStroke)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="42 84"
        />
        <g className="fly-loader-mark">
          <path d="M24 10 L33 24 L24 38 L15 24 Z" stroke="#b8f13d" strokeWidth="2.4" strokeLinejoin="round" />
          <circle cx="24" cy="24" r="3" fill="#b8f13d" />
        </g>
      </svg>
      <p>{text}…</p>
    </div>
  );
}
