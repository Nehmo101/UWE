"use client";

import { useState, type ReactNode } from "react";

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
      <div className="uwe-inline-actions" style={{ marginBottom: "0.75rem" }}>
        <button
          type="button"
          className={`uwe-v2-btn uwe-v2-btn-sm ${!editing ? "uwe-v2-btn-primary" : "uwe-v2-btn-secondary"}`}
          aria-pressed={!editing}
          onClick={() => setEditing(false)}
        >
          {viewLabel}
        </button>
        <button
          type="button"
          className={`uwe-v2-btn uwe-v2-btn-sm ${editing ? "uwe-v2-btn-primary" : "uwe-v2-btn-secondary"}`}
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
