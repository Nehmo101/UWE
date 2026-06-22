import type { ReactNode } from "react";

export interface ContextActionsProps {
  /** Primary actions (create, save, edit) — shown first. */
  primary?: ReactNode;
  /** Secondary actions (preview, export, duplicate). */
  secondary?: ReactNode;
  /** Destructive actions (delete) — visually separated. */
  danger?: ReactNode;
  className?: string;
}

/**
 * Groups page-level actions: primary/secondary on the left cluster,
 * destructive actions separated on the right.
 */
export function ContextActions({
  primary,
  secondary,
  danger,
  className,
}: ContextActionsProps) {
  const hasPrimary = Boolean(primary);
  const hasSecondary = Boolean(secondary);
  const hasDanger = Boolean(danger);

  if (!hasPrimary && !hasSecondary && !hasDanger) return null;

  return (
    <div className={className ?? "uwe-context-actions"}>
      {(hasPrimary || hasSecondary) && (
        <div className="uwe-context-actions-main">
          {primary}
          {secondary}
        </div>
      )}
      {hasDanger && <div className="uwe-context-actions-danger">{danger}</div>}
    </div>
  );
}
