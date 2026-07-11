"use client";

import {
  evaluatePasswordStrength,
  PASSWORD_STRENGTH_LABELS,
  type PasswordStrengthLevel,
} from "./password-strength";
import { PasswordRequirements, type PasswordRequirementsProps } from "./PasswordRequirements";

export interface PasswordStrengthMeterProps {
  password: string;
  showRequirements?: boolean;
  requirementsProps?: Omit<PasswordRequirementsProps, "password">;
  className?: string;
}

/** Füllfarbe pro Stärke-Stufe (Hex-Werte aus dem früheren uwe-components.css). */
function strengthFillClass(level: PasswordStrengthLevel): string {
  switch (level) {
    case "strong":
      return "bg-[#1f7a3f]";
    case "good":
      return "bg-[#2f8f4e]";
    case "fair":
      return "bg-[#c27b1d]";
    case "weak":
      return "bg-[#c24141]";
    default:
      return "bg-transparent";
  }
}

export function PasswordStrengthMeter({
  password,
  showRequirements = true,
  requirementsProps,
  className = "grid gap-2",
}: PasswordStrengthMeterProps) {
  const { level, score } = evaluatePasswordStrength(password);
  const maxScore = 4;
  const label =
    level === "empty" ? "Passwortstärke" : PASSWORD_STRENGTH_LABELS[level];

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-2 text-[0.8125rem] text-muted-foreground">
        <span>{label}</span>
        {level !== "empty" ? (
          <span aria-hidden="true">
            {score}/{maxScore}
          </span>
        ) : null}
      </div>
      <div
        className="relative h-[0.35rem] overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--uwe-border-muted)_70%,transparent)]"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={maxScore}
        aria-valuenow={score}
        aria-label={`Passwortstärke: ${label}`}
      >
        <span
          className={`block h-full rounded-[inherit] transition-[width,background-color] duration-200 ${strengthFillClass(level)}`}
          style={{ width: `${(score / maxScore) * 100}%` }}
        />
      </div>
      {showRequirements ? (
        <PasswordRequirements password={password} {...requirementsProps} />
      ) : null}
    </div>
  );
}
