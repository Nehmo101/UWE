"use client";

import { useId, useState, type ReactNode } from "react";
import { cn } from "./cn";

export interface CollapsibleProps {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  variant?: "default" | "sidebar";
  className?: string;
  children: ReactNode;
}

/** Odysseus-style expandable section — settings panels and sidebar groups. */
export function Collapsible({
  title,
  summary,
  defaultOpen = true,
  open: controlledOpen,
  onOpenChange,
  variant = "default",
  className,
  children,
}: CollapsibleProps) {
  const id = useId();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;

  function toggle() {
    const next = !open;
    if (controlledOpen === undefined) {
      setUncontrolledOpen(next);
    }
    onOpenChange?.(next);
  }

  return (
    <section
      className={cn(
        "uwe-collapsible",
        variant === "sidebar" && "uwe-collapsible-sidebar",
        className,
      )}
      data-open={open ? "true" : "false"}
    >
      <button
        type="button"
        className={
          variant === "sidebar" ? "uwe-sidebar-section-trigger" : "uwe-collapsible-trigger"
        }
        aria-expanded={open}
        aria-controls={id}
        onClick={toggle}
      >
        <span className={variant === "sidebar" ? "uwe-sidebar-section-title" : "uwe-collapsible-title"}>
          {title}
        </span>
        {summary && !open && variant === "default" ? (
          <span className="uwe-collapsible-summary">{summary}</span>
        ) : null}
        <span className="uwe-collapsible-chevron" aria-hidden />
      </button>
      <div id={id} className="uwe-collapsible-body" hidden={!open}>
        {children}
      </div>
    </section>
  );
}
