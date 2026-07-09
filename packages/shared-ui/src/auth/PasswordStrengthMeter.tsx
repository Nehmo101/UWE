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

function strengthClass(level: PasswordStrengthLevel): string {
  switch (level) {
    case "strong":
      return "uwe-password-strength-strong";
    case "good":
      return "uwe-password-strength-good";
    case "fair":
      return "uwe-password-strength-fair";
    case "weak":
      return "uwe-password-strength-weak";
    default:
      return "uwe-password-strength-empty";
  }
}

export function PasswordStrengthMeter({
  password,
  showRequirements = true,
  requirementsProps,
  className = "uwe-password-strength",
}: PasswordStrengthMeterProps) {
  const { level, score } = evaluatePasswordStrength(password);
  const maxScore = 4;
  const label =
    level === "empty" ? "Passwortstärke" : PASSWORD_STRENGTH_LABELS[level];

  return (
    <div className={className}>
      <div className="uwe-password-strength-header">
        <span className="uwe-password-strength-label">{label}</span>
        {level !== "empty" ? (
          <span className="uwe-password-strength-score" aria-hidden="true">
            {score}/{maxScore}
          </span>
        ) : null}
      </div>
      <div
        className={`uwe-password-strength-bar ${strengthClass(level)}`}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={maxScore}
        aria-valuenow={score}
        aria-label={`Passwortstärke: ${label}`}
      >
        <span
          className="uwe-password-strength-fill"
          style={{ width: `${(score / maxScore) * 100}%` }}
        />
      </div>
      {showRequirements ? (
        <PasswordRequirements password={password} {...requirementsProps} />
      ) : null}
    </div>
  );
}
