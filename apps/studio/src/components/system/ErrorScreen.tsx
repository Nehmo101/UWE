"use client";

import Link from "next/link";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Button } from "../ui/button";
import { ErrorState } from "../ui/states";

export interface ErrorScreenProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Central Studio error screen (owner/admin context): shows actionable
 * diagnostics (route, message, digest, timestamp, log hint) instead of a raw
 * generic error box, plus retry / back-to-start actions.
 */
export function ErrorScreen({ error, reset }: ErrorScreenProps) {
  const pathname = usePathname() ?? "—";
  const timestamp = React.useMemo(() => new Date().toISOString(), []);

  const rows: { label: string; value: string }[] = [
    { label: "Route", value: pathname },
    { label: "Fehler", value: error.message || "Unbekannter Fehler" },
    { label: "Digest", value: error.digest ?? "—" },
    { label: "Zeitpunkt", value: timestamp },
  ];

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-stretch justify-center gap-4 p-6">
      <ErrorState
        icon="shield"
        title="Etwas ist schiefgelaufen"
        description="Beim Laden dieser Seite ist ein Fehler aufgetreten. Die Diagnosedaten unten helfen bei der Analyse; Details stehen in den Server-Logs."
        action={
          <div className="flex justify-center gap-2">
            <Button onClick={reset}>Erneut versuchen</Button>
            <Link
              href="/worlds"
              className="inline-flex h-9 items-center rounded-[var(--radius)] border border-border px-4 text-sm hover:bg-muted"
            >
              Zum Start
            </Link>
          </div>
        }
      />
      <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-1 rounded-[var(--radius)] border border-border p-4 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="contents">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="font-mono break-all">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
