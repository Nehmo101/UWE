"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "./cn";

export type DialogSize = "sm" | "md" | "lg";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: DialogSize;
  className?: string;
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
  className,
}: DialogProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    panelRef.current?.focus();

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="uwe-dialog-backdrop" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn("uwe-dialog", `uwe-dialog-${size}`, className)}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="uwe-dialog-header">
          <h2 id={titleId} className="uwe-dialog-title">
            {title}
          </h2>
          <button
            type="button"
            className="uwe-dialog-close"
            aria-label="Schließen"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="uwe-dialog-body">{children}</div>
        {footer && <footer className="uwe-dialog-footer">{footer}</footer>}
      </div>
    </div>
  );
}
