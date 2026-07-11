"use client";

import { useMemo, useState } from "react";
import type { CspReviewFinding } from "@uwe/auth";
import { reviewCspPolicy } from "@uwe/auth";
import { Alert, Badge, type BadgeProps, Textarea } from "@/src/components/ui";

interface Props {
  effectivePolicy: string;
  effectiveFindings: CspReviewFinding[];
  isProduction: boolean;
}

const SEVERITY_LABEL: Record<CspReviewFinding["severity"], string> = {
  info: "Info",
  warning: "Warnung",
  critical: "Kritisch",
};

function severityBadgeVariant(severity: CspReviewFinding["severity"]): BadgeProps["variant"] {
  switch (severity) {
    case "critical":
      return "danger";
    case "warning":
      return "warning";
    default:
      return "info";
  }
}

export function CspReviewPanel({ effectivePolicy, effectiveFindings, isProduction }: Props) {
  const [draftPolicy, setDraftPolicy] = useState("");

  const draftReview = useMemo(() => reviewCspPolicy(draftPolicy), [draftPolicy]);

  return (
    <div className="flex flex-col gap-4">
      <section>
        <h3 className="text-sm font-semibold">Aktive Studio-CSP</h3>
        <p className="text-sm text-muted-foreground">
          Umgebung: {isProduction ? "Produktion" : "Entwicklung"} — die Policy wird zentral in{" "}
          <code>packages/auth/src/security-headers.ts</code> gebaut.
        </p>
        <pre className="mt-3 whitespace-pre-wrap rounded-[var(--radius)] bg-muted p-3 text-xs">
          {effectivePolicy}
        </pre>
      </section>

      {effectiveFindings.length > 0 ? (
        <section>
          <h3 className="text-sm font-semibold">Bekannte Lockerungen in der aktiven Policy</h3>
          <ul className="flex flex-col gap-2">
            {effectiveFindings.map((finding) => (
              <li key={finding.id} className="flex flex-col gap-1">
                <span className="flex items-center gap-2">
                  <strong>{finding.title}</strong>
                  <Badge variant={severityBadgeVariant(finding.severity)}>
                    {SEVERITY_LABEL[finding.severity]}
                  </Badge>
                </span>
                <p className="text-sm text-muted-foreground">{finding.description}</p>
              </li>
            ))}
          </ul>
          {effectiveFindings.some((finding) => finding.id === "unsafe-eval") && !isProduction ? (
            <p className="text-sm text-muted-foreground">
              <code>unsafe-eval</code> ist in der Entwicklung erwartet (Next.js HMR). In Produktion
              bleibt es deaktiviert.
            </p>
          ) : null}
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">Keine zusätzlichen Lockerungs-Muster in der aktiven Policy.</p>
      )}

      <section>
        <h3 className="text-sm font-semibold">Policy-Entwurf prüfen</h3>
        <p className="text-sm text-muted-foreground">
          Simuliert eine CSP-Zeichenkette — Änderungen werden hier nicht übernommen. Vor jeder
          Lockerung in Produktion Security-Review durchführen.
        </p>
        <Textarea
          value={draftPolicy}
          onChange={(event) => setDraftPolicy(event.target.value)}
          rows={6}
          placeholder="default-src 'self'; script-src 'self' ..."
          className="font-mono"
        />
        {draftPolicy.trim() ? (
          <>
            {draftReview.syntaxErrors.length > 0 && (
              <Alert tone="danger" role="alert">
                <ul className="list-disc pl-4">
                  {draftReview.syntaxErrors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </Alert>
            )}
            {draftReview.findings.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {draftReview.findings.map((finding) => (
                  <li key={finding.id} className="flex flex-col gap-1">
                    <span className="flex items-center gap-2">
                      <strong>{finding.title}</strong>
                      <Badge variant={severityBadgeVariant(finding.severity)}>
                        {SEVERITY_LABEL[finding.severity]}
                      </Badge>
                    </span>
                    <p className="text-sm text-muted-foreground">{finding.description}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Keine bekannten Lockerungs-Muster im Entwurf.</p>
            )}
          </>
        ) : null}
      </section>
    </div>
  );
}
