"use client";

import { useMemo, useState } from "react";
import type { CspReviewFinding } from "@uwe/auth";
import { reviewCspPolicy } from "@uwe/auth";

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

export function CspReviewPanel({ effectivePolicy, effectiveFindings, isProduction }: Props) {
  const [draftPolicy, setDraftPolicy] = useState("");

  const draftReview = useMemo(() => reviewCspPolicy(draftPolicy), [draftPolicy]);

  return (
    <div className="flex flex-col gap-4">
      <section>
        <h3 className="text-sm font-semibold">Aktive Studio-CSP</h3>
        <p className="uwe-dashboard-muted">
          Umgebung: {isProduction ? "Produktion" : "Entwicklung"} — die Policy wird zentral in{" "}
          <code>packages/auth/src/security-headers.ts</code> gebaut.
        </p>
        <pre className="uwe-homelab-command" style={{ whiteSpace: "pre-wrap", marginTop: "0.75rem" }}>
          {effectivePolicy}
        </pre>
      </section>

      {effectiveFindings.length > 0 ? (
        <section>
          <h3 className="text-sm font-semibold">Bekannte Lockerungen in der aktiven Policy</h3>
          <ul className="uwe-dashboard-list">
            {effectiveFindings.map((finding) => (
              <li key={finding.id}>
                <strong>{finding.title}</strong>
                <span className="uwe-badge">{SEVERITY_LABEL[finding.severity]}</span>
                <p>{finding.description}</p>
              </li>
            ))}
          </ul>
          {effectiveFindings.some((finding) => finding.id === "unsafe-eval") && !isProduction ? (
            <p className="uwe-dashboard-muted">
              <code>unsafe-eval</code> ist in der Entwicklung erwartet (Next.js HMR). In Produktion
              bleibt es deaktiviert.
            </p>
          ) : null}
        </section>
      ) : (
        <p className="uwe-dashboard-muted">Keine zusätzlichen Lockerungs-Muster in der aktiven Policy.</p>
      )}

      <section>
        <h3 className="text-sm font-semibold">Policy-Entwurf prüfen</h3>
        <p className="uwe-dashboard-muted">
          Simuliert eine CSP-Zeichenkette — Änderungen werden hier nicht übernommen. Vor jeder
          Lockerung in Produktion Security-Review durchführen.
        </p>
        <textarea
          value={draftPolicy}
          onChange={(event) => setDraftPolicy(event.target.value)}
          rows={6}
          placeholder="default-src 'self'; script-src 'self' ..."
          className="uwe-form-input"
          style={{ width: "100%", fontFamily: "var(--font-mono, monospace)" }}
        />
        {draftPolicy.trim() ? (
          <>
            {draftReview.syntaxErrors.length > 0 && (
              <ul className="uwe-form-error" role="alert">
                {draftReview.syntaxErrors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            )}
            {draftReview.findings.length > 0 ? (
              <ul className="uwe-dashboard-list">
                {draftReview.findings.map((finding) => (
                  <li key={finding.id}>
                    <strong>{finding.title}</strong>
                    <span className="uwe-badge">{SEVERITY_LABEL[finding.severity]}</span>
                    <p>{finding.description}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="uwe-dashboard-muted">Keine bekannten Lockerungs-Muster im Entwurf.</p>
            )}
          </>
        ) : null}
      </section>
    </div>
  );
}
