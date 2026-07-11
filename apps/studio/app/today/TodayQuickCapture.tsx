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
    <details className="rounded-[var(--radius)] border border-border bg-card p-6 text-card-foreground shadow-sm">
      {/* TODO(design-kit): Card hat kein natives <details>-Äquivalent; Radix Collapsible wäre die
          kit-konforme Lösung für aufklappbare Sections, siehe gleiches Muster in admin/migrations/page.tsx. */}
      <summary className="cursor-pointer list-none font-semibold leading-none tracking-tight">
        ➕ Schnell erfassen
      </summary>
      <div className="mt-4">
        <QuickCaptureForm returnTo="/today" compact />
      </div>
    </details>
  );
}
