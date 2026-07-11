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
  className = "m-0 grid list-none gap-1 p-0 text-[0.8125rem] text-muted-foreground",
}: PasswordRequirementsProps) {
  return (
    <ul className={className} aria-label="Passwortanforderungen">
      {rules.map((rule) => {
        const met = rule.test(password);
        return (
          <li
            key={rule.id}
            className={met ? "flex items-start gap-1.5 text-foreground" : "flex items-start gap-1.5"}
            data-required={rule.required ? "true" : "false"}
          >
            <span className="w-4 flex-none text-center font-semibold" aria-hidden="true">
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
