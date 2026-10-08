"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useRef, useState } from "react";
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
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const startY = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);

  const reset = () => {
    setDragY(0);
    setDragging(false);
    startY.current = null;
  };
  const onTouchStart = (event: React.TouchEvent) => {
    if ((bodyRef.current?.scrollTop ?? 0) > 0) return;
    startY.current = event.touches[0]?.clientY ?? null;
  };
  const onTouchMove = (event: React.TouchEvent) => {
    if (startY.current === null) return;
    const delta = (event.touches[0]?.clientY ?? 0) - startY.current;
    if (delta <= 0) {
      setDragY(0);
      return;
    }
    setDragging(true);
    setDragY(Math.min(delta, 160));
  };
  const onTouchEnd = () => {
    const shouldClose = dragY > 90;
    reset();
    if (shouldClose) onClose();
  };

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content
          className={`modal-content ${dragging ? "modal-content-dragging" : ""} ${className ?? ""}`}
          style={{ "--modal-drag": `${dragY}px` } as React.CSSProperties}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={reset}
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
          <div className="modal-body" ref={bodyRef}>
            {children}
          </div>
          <footer className="modal-footer">
            <Dialog.Close className="ui-button ui-button-secondary modal-close-button">{closeLabel}</Dialog.Close>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
