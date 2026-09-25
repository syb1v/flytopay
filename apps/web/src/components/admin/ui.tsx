"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useId, type ReactNode } from "react";

export function Page({
  title,
  description,
  actions,
  backHref,
  backLabel,
  children,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className="adm-page">
      <header className="adm-page-head">
        <div className="adm-page-title">
          {backHref && (
            <Link className="adm-back" href={backHref}>
              ← {backLabel ?? "Назад"}
            </Link>
          )}
          <h1>{title}</h1>
          {description && <p className="adm-page-sub">{description}</p>}
        </div>
        {actions && <div className="adm-page-actions">{actions}</div>}
      </header>
      {children}
    </div>
  );
}

export function Panel({
  title,
  actions,
  children,
  className = "",
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`adm-panel ${className}`}>
      {(title || actions) && (
        <div className="adm-panel-head">
          {title && <h2>{title}</h2>}
          {actions && <div className="adm-panel-actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatGrid({ items }: { items: Array<{ label: string; value: ReactNode; hint?: string }> }) {
  return (
    <div className="adm-stats">
      {items.map((item) => (
        <article className="adm-stat" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.hint && <small>{item.hint}</small>}
        </article>
      ))}
    </div>
  );
}

const badgeTones: Record<string, string> = {
  success: "adm-badge-success",
  danger: "adm-badge-danger",
  warning: "adm-badge-warning",
  neutral: "adm-badge-neutral",
  info: "adm-badge-info",
};

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof badgeTones; children: ReactNode }) {
  return <span className={`adm-badge ${badgeTones[tone] ?? badgeTones.neutral}`}>{children}</span>;
}

export function Button({
  children,
  onClick,
  href,
  type = "button",
  variant = "secondary",
  disabled,
  busy,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  busy?: boolean;
}) {
  const className = `adm-btn adm-btn-${variant}`;
  if (href) {
    return (
      <Link className={className} href={href} aria-disabled={disabled}>
        {children}
      </Link>
    );
  }
  return (
    <button className={className} type={type} onClick={onClick} disabled={disabled || busy}>
      {busy ? "…" : children}
    </button>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="adm-field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className="adm-input" {...props} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="adm-textarea" {...props} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="adm-select" {...props} />;
}

export function Tabs({ base, tabs }: { base: string; tabs: Array<{ key: string; label: string }> }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("tab") ?? tabs[0]?.key;
  return (
    <nav className="adm-tabs" aria-label="Разделы">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          className={`adm-tab ${current === tab.key ? "active" : ""}`}
          href={`${base}?tab=${tab.key}`}
          aria-current={current === tab.key ? "page" : undefined}
          data-path={pathname}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="adm-empty">{children}</p>;
}

export function Pager({
  page,
  total,
  limit,
  onPage,
}: {
  page: number;
  total: number;
  limit: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;
  return (
    <div className="adm-pager">
      <Button variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        ← Назад
      </Button>
      <span>
        Страница {page} из {pages} · всего {total}
      </span>
      <Button variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Вперёд →
      </Button>
    </div>
  );
}

export type DialogField = {
  name: string;
  label: string;
  type?: "text" | "number" | "textarea";
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
};

export function ActionDialog({
  open,
  title,
  description,
  fields = [],
  confirmLabel = "Подтвердить",
  danger,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  fields?: DialogField[];
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: (values: Record<string, string>) => void;
}) {
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div className="adm-modal-backdrop" role="presentation" onClick={onCancel}>
      <section className="adm-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <h2>{title}</h2>
        {description && <div className="adm-modal-sub">{description}</div>}
        <form
          className="adm-modal-form"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const values: Record<string, string> = {};
            fields.forEach((field) => (values[field.name] = String(data.get(field.name) ?? "")));
            onConfirm(values);
          }}
        >
          {fields.map((field) => (
            <Field key={field.name} label={field.label}>
              {field.type === "textarea" ? (
                <TextArea
                  id={`${id}-${field.name}`}
                  name={field.name}
                  placeholder={field.placeholder}
                  required={field.required}
                  defaultValue={field.defaultValue}
                  rows={3}
                />
              ) : (
                <TextInput
                  id={`${id}-${field.name}`}
                  name={field.name}
                  type={field.type === "number" ? "number" : "text"}
                  inputMode={field.type === "number" ? "numeric" : undefined}
                  placeholder={field.placeholder}
                  required={field.required}
                  defaultValue={field.defaultValue}
                />
              )}
            </Field>
          ))}
          {error && <p className="adm-modal-error">{error}</p>}
          <div className="adm-modal-actions">
            <Button variant="secondary" onClick={onCancel}>
              Отмена
            </Button>
            <Button type="submit" variant={danger ? "danger" : "primary"} busy={busy}>
              {confirmLabel}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function BarChart({
  points,
  label,
}: {
  points: Array<{ label: string; value: number; secondary?: number }>;
  label?: string;
}) {
  const max = Math.max(1, ...points.map((point) => Math.max(point.value, point.secondary ?? 0)));
  return (
    <div className="adm-chart">
      <div className="adm-chart-bars">
        {points.map((point) => (
          <div className="adm-chart-col" key={point.label} title={`${point.label}: ${point.value}`}>
            <i className="adm-chart-primary" style={{ height: `${Math.max(3, (point.value / max) * 100)}%` }} />
            {point.secondary !== undefined && (
              <i className="adm-chart-secondary" style={{ height: `${Math.max(2, (point.secondary / max) * 100)}%` }} />
            )}
          </div>
        ))}
      </div>
      {label && <div className="adm-chart-label">{label}</div>}
    </div>
  );
}
