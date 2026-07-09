export const PASSWORD_MIN_LENGTH = 8;

export interface PasswordRule {
  id: string;
  label: string;
  required: boolean;
  test: (password: string) => boolean;
}

export const PASSWORD_REQUIREMENTS: readonly PasswordRule[] = [
  {
    id: "length",
    label: `Mindestens ${PASSWORD_MIN_LENGTH} Zeichen`,
    required: true,
    test: (password) => password.length >= PASSWORD_MIN_LENGTH,
  },
  {
    id: "lower",
    label: "Ein Kleinbuchstabe",
    required: false,
    test: (password) => /[a-z]/.test(password),
  },
  {
    id: "upper",
    label: "Ein Großbuchstabe",
    required: false,
    test: (password) => /[A-Z]/.test(password),
  },
  {
    id: "digit",
    label: "Eine Ziffer",
    required: false,
    test: (password) => /\d/.test(password),
  },
  {
    id: "special",
    label: "Ein Sonderzeichen",
    required: false,
    test: (password) => /[^A-Za-z0-9]/.test(password),
  },
] as const;

export type PasswordStrengthLevel = "empty" | "weak" | "fair" | "good" | "strong";

export interface PasswordStrengthResult {
  level: PasswordStrengthLevel;
  score: number;
  metRuleIds: string[];
}

export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  if (!password) {
    return { level: "empty", score: 0, metRuleIds: [] };
  }

  const metRuleIds = PASSWORD_REQUIREMENTS.filter((rule) => rule.test(password)).map(
    (rule) => rule.id,
  );

  const hasLength = metRuleIds.includes("length");
  const optionalMet = metRuleIds.filter((id) => id !== "length").length;

  if (!hasLength) {
    return { level: "weak", score: Math.min(optionalMet, 2), metRuleIds };
  }

  if (optionalMet >= 3) {
    return { level: "strong", score: 4, metRuleIds };
  }

  if (optionalMet >= 2) {
    return { level: "good", score: 3, metRuleIds };
  }

  if (optionalMet >= 1) {
    return { level: "fair", score: 2, metRuleIds };
  }

  return { level: "weak", score: 1, metRuleIds };
}

export const PASSWORD_STRENGTH_LABELS: Record<Exclude<PasswordStrengthLevel, "empty">, string> = {
  weak: "Schwach",
  fair: "Ausreichend",
  good: "Gut",
  strong: "Stark",
};
