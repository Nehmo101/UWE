export type CspReviewSeverity = "info" | "warning" | "critical";

export interface CspReviewFinding {
  id: string;
  severity: CspReviewSeverity;
  title: string;
  description: string;
}

const LOOSENING_PATTERNS: Array<{
  id: string;
  pattern: RegExp;
  severity: CspReviewSeverity;
  title: string;
  description: string;
}> = [
  {
    id: "unsafe-eval",
    pattern: /unsafe-eval/i,
    severity: "critical",
    title: "unsafe-eval",
    description:
      "Erlaubt dynamische Code-Ausführung im Browser. In Produktion nur für Next.js Dev/HMR vorgesehen — nicht dauerhaft aktivieren.",
  },
  {
    id: "unsafe-inline-script",
    pattern: /script-src[^;]*unsafe-inline/i,
    severity: "warning",
    title: "unsafe-inline in script-src",
    description:
      "Inline-Skripte erleichtern XSS-Ausnutzung. UWE nutzt das nur, weil noch keine Nonce-Pipeline existiert — nicht weiter lockern.",
  },
  {
    id: "wildcard",
    pattern: /\s\*(\s|;|$)/,
    severity: "critical",
    title: "Wildcard-Quelle",
    description: "CSP-Wildcards (*) heben den Schutz für die betroffene Direktive praktisch auf.",
  },
  {
    id: "http-src",
    pattern: /(?:script|connect|img|frame|style)-src[^;]*\shttp:\/\//i,
    severity: "warning",
    title: "Unverschlüsselte http:-Quelle",
    description: "HTTP-Quellen in CSP erlauben MitM-Risiken — bevorzugt https: oder same-origin.",
  },
];

const DIRECTIVE_NAME = /^[a-z0-9-]+$/;

export function validateCspPolicyInput(input: string): string[] {
  const errors: string[] = [];
  const trimmed = input.trim();
  if (!trimmed) {
    return errors;
  }

  const directives = trimmed
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);

  if (directives.length === 0) {
    errors.push("Mindestens eine CSP-Direktive erforderlich.");
    return errors;
  }

  for (const directive of directives) {
    const [name, ...values] = directive.split(/\s+/);
    if (!name || !DIRECTIVE_NAME.test(name)) {
      errors.push(`Ungültiger Direktiven-Name: ${name ?? "(leer)"}`);
      continue;
    }
    if (values.length === 0) {
      errors.push(`Direktive ${name} hat keine Werte.`);
    }
    for (const value of values) {
      if (value.includes("<") || value.includes(">")) {
        errors.push(`Verdächtiger Wert in ${name}: ${value}`);
      }
    }
  }

  return errors;
}

export function analyzeCspLooseningRisks(policy: string): CspReviewFinding[] {
  const findings: CspReviewFinding[] = [];
  for (const rule of LOOSENING_PATTERNS) {
    if (rule.pattern.test(policy)) {
      findings.push({
        id: rule.id,
        severity: rule.severity,
        title: rule.title,
        description: rule.description,
      });
    }
  }
  return findings;
}

export function reviewCspPolicy(policy: string): {
  syntaxErrors: string[];
  findings: CspReviewFinding[];
} {
  return {
    syntaxErrors: validateCspPolicyInput(policy),
    findings: analyzeCspLooseningRisks(policy),
  };
}
