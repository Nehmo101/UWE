"use client";

import {
  PASSWORD_REQUIREMENTS,
  type PasswordRule,
} from "./password-strength";

export interface PasswordRequirementsProps {
  password: string;
  rules?: readonly PasswordRule[];
  className?: string;
}

export function PasswordRequirements({
  password,
  rules = PASSWORD_REQUIREMENTS,
  className = "uwe-password-requirements",
}: PasswordRequirementsProps) {
  return (
    <ul className={className} aria-label="Passwortanforderungen">
      {rules.map((rule) => {
        const met = rule.test(password);
        return (
          <li
            key={rule.id}
            className={met ? "uwe-password-requirement uwe-password-requirement-met" : "uwe-password-requirement"}
            data-required={rule.required ? "true" : "false"}
          >
            <span className="uwe-password-requirement-marker" aria-hidden="true">
              {met ? "✓" : "○"}
            </span>
            <span>
              {rule.label}
              {rule.required ? " (erforderlich)" : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
