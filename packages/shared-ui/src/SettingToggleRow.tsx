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
    <div className="uwe-setting-toggle-row">
      <div className="uwe-setting-toggle-copy">
        <span className="uwe-setting-toggle-label">{label}</span>
        {hint ? <span className="uwe-setting-toggle-hint">{hint}</span> : null}
      </div>
      <label className="uwe-setting-toggle-control">
        <input
          type="checkbox"
          name={name}
          defaultChecked={defaultChecked}
          disabled={disabled}
        />
        <span className="uwe-setting-toggle-track" aria-hidden="true" />
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
    <section className="uwe-settings-toggle-group">
      {title ? <h3 className="uwe-settings-toggle-group-title">{title}</h3> : null}
      <div className="uwe-settings-toggle-list">{children}</div>
    </section>
  );
}
