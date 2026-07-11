"use client";

import { useState, type ReactNode } from "react";
import { cn } from "./components/cn";

export interface ViewEditToggleProps {
  /** Label for read-only mode (default: "Ansicht") */
  viewLabel?: string;
  /** Label for edit mode (default: "Bearbeiten") */
  editLabel?: string;
  /** Start in edit mode when true (default: false = read-only first) */
  defaultEditing?: boolean;
  view: ReactNode;
  edit: ReactNode;
  className?: string;
}

const TOGGLE_BUTTON_BASE =
  "inline-flex h-8 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)] px-3 text-xs font-medium transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";

/** Toggle between read-only view and edit UI — default is read-only. */
export function ViewEditToggle({
  viewLabel = "Ansicht",
  editLabel = "Bearbeiten",
  defaultEditing = false,
  view,
  edit,
  className,
}: ViewEditToggleProps) {
  const [editing, setEditing] = useState(defaultEditing);

  return (
    <div className={className}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={cn(
            TOGGLE_BUTTON_BASE,
            !editing ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
          )}
          aria-pressed={!editing}
          onClick={() => setEditing(false)}
        >
          {viewLabel}
        </button>
        <button
          type="button"
          className={cn(
            TOGGLE_BUTTON_BASE,
            editing ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
          )}
          aria-pressed={editing}
          onClick={() => setEditing(true)}
        >
          {editLabel}
        </button>
      </div>
      {editing ? edit : view}
    </div>
  );
}
