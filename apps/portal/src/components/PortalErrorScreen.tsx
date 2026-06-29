"use client";

import { Button } from "./ui/button";
import { ErrorState } from "./ui/states";

export interface PortalErrorScreenProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Player-safe Portal error screen: a calm, non-technical message plus an
 * optional reference id (digest) for support correlation. No raw error
 * messages, stack traces, or internal routes are shown to players.
 */
export function PortalErrorScreen({ error, reset }: PortalErrorScreenProps) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-stretch justify-center gap-4 p-6">
      <ErrorState
        icon="shield"
        title="Diese Seite ist gerade nicht verfügbar"
        description="Es ist ein Fehler aufgetreten. Bitte versuche es erneut. Falls das Problem bestehen bleibt, wende dich an deine Spielleitung."
        action={<Button onClick={reset}>Erneut versuchen</Button>}
      />
      {error.digest ? (
        <p className="text-center text-xs text-muted-foreground">
          Referenz: <span className="font-mono">{error.digest}</span>
        </p>
      ) : null}
    </div>
  );
}
