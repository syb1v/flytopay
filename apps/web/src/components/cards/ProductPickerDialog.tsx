"use client";

import { X } from "lucide-react";
import { IssueCardPanel } from "./IssueCardPanel";

export function ProductPickerDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="product-picker-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="product-picker-dialog" role="dialog" aria-modal="true">
        <header className="card-dialog-header">
          <div>
            <span className="dashboard-eyebrow">FLYTOPAY</span>
            <h2>Выпуск карты</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </header>
        <IssueCardPanel />
      </section>
    </div>
  );
}
