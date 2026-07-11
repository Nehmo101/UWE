"use client";

import type { ReactNode } from "react";

export interface SettingToggleRowProps {
  name: string;
  label: string;
  hint?: string;
  defaultChecked?: boolean;
  disabled?: boolean;
}

export function SettingToggleRow({
  name,
  label,
  hint,
  defaultChecked = false,
  disabled = false,
}: SettingToggleRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-[var(--uwe-border-muted)] bg-[var(--uwe-card-bg)] px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        {hint ? (
          <span className="text-xs leading-normal text-[var(--uwe-fg-subtle)]">{hint}</span>
        ) : null}
      </div>
      <label className="relative inline-flex min-h-11 shrink-0 items-center">
        <input
          type="checkbox"
          name={name}
          defaultChecked={defaultChecked}
          disabled={disabled}
          className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
        <span
          className="relative block h-6 w-11 rounded-full bg-[color-mix(in_srgb,var(--uwe-muted)_35%,transparent)] transition-colors after:absolute after:top-[0.15rem] after:left-[0.15rem] after:h-[1.2rem] after:w-[1.2rem] after:rounded-full after:bg-[var(--uwe-bg-elevated)] after:shadow-[0_1px_3px_rgba(0,0,0,0.2)] after:transition-transform peer-checked:bg-primary peer-checked:after:translate-x-5 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--uwe-focus-ring)]"
          aria-hidden="true"
        />
      </label>
    </div>
  );
}

export function SettingsToggleGroup({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-4 mb-6">
      {title ? <h3 className="mb-3 text-base">{title}</h3> : null}
      <div className="flex flex-col gap-2.5">{children}</div>
    </section>
  );
}
