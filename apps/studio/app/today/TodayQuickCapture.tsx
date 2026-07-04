"use client";

import { QuickCaptureForm } from "@/components/capture/QuickCaptureForm";

/**
 * Immer erreichbare Schnell-Erfassung direkt auf /today: ein aufklappbarer
 * Streifen über dem Widget-Grid. Nutzt die bestehende QuickCaptureForm und
 * kehrt nach dem Speichern per returnTo hierher zurück (aktualisiert das
 * Cockpit). Zettel-los erfassen, ohne die Seite zu wechseln.
 */
export function TodayQuickCapture() {
  return (
    <details className="uwe-v2-card uwe-v2-card-padded uwe-today-quick-capture">
      <summary className="uwe-v2-section-title">➕ Schnell erfassen</summary>
      <QuickCaptureForm returnTo="/today" compact />
    </details>
  );
}
