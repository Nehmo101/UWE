"use client";

import { usePathname } from "next/navigation";
import { ErrorState } from "@uwe/shared-ui";

/**
 * Family hatte bisher gar keine Fehlergrenze — bei einem Fehler in einer
 * Serverkomponente zeigte Next die eigene, unformatierte Standardseite: weißer
 * Grund, englischer Text, kein Weg zurück.
 *
 * Die Fehlermeldung selbst wird nicht durchgereicht: Family ist ein
 * gemeinsamer Bereich, und eine Meldung aus einer Serverkomponente kann
 * Dateipfade oder Feldnamen enthalten. Die Kennung genügt, um den Eintrag im
 * Server-Log zu finden.
 */
export default function FamilyError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname() ?? "—";

  return (
    <main className="uwe-main" id="uwe-main">
      <ErrorState
        title="Etwas ist schiefgelaufen"
        description="Diese Seite konnte nicht geladen werden. Ein erneuter Versuch hilft oft; sonst stehen die Einzelheiten im Server-Log."
        detail={`Route: ${pathname}\nKennung: ${error.digest ?? "—"}`}
        action={
          <button type="button" className="family-btn" onClick={reset}>
            Erneut versuchen
          </button>
        }
      />
    </main>
  );
}
