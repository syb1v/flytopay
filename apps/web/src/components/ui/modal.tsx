"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  description,
  children,
  closeLabel = "Закрыть",
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  closeLabel?: string;
  className?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content
          className={`modal-content ${className ?? ""}`}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <header className="modal-header">
            <div>
              {eyebrow && <span className="dashboard-eyebrow">{eyebrow}</span>}
              <Dialog.Title asChild>
                <h2>{title}</h2>
              </Dialog.Title>
              {description && <Dialog.Description className="settings-muted">{description}</Dialog.Description>}
            </div>
          </header>
          <div className="modal-body">{children}</div>
          <footer className="modal-footer">
            <Dialog.Close className="ui-button ui-button-secondary modal-close-button">{closeLabel}</Dialog.Close>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
