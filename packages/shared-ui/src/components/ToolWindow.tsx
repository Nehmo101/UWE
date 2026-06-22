"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "./cn";

export type ToolWindowSize = "sm" | "md" | "lg" | "fullscreen";

export interface ToolWindowProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: ToolWindowSize;
  className?: string;
}

/** Workspace overlay for generators, media tools, and AI previews. */
export function ToolWindow({
  open,
  onClose,
  title,
  children,
  footer,
  size = "lg",
  className,
}: ToolWindowProps) {
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
    <div className="uwe-toolwindow-backdrop" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn("uwe-toolwindow", `uwe-toolwindow-${size}`, className)}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="uwe-toolwindow-header">
          <h2 id={titleId} className="uwe-toolwindow-title">
            {title}
          </h2>
          <button
            type="button"
            className="uwe-toolwindow-close"
            aria-label="Schließen"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="uwe-toolwindow-body">{children}</div>
        {footer && <footer className="uwe-toolwindow-footer">{footer}</footer>}
      </div>
    </div>
  );
}
