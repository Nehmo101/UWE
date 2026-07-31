"use client";

import { usePathname } from "next/navigation";
import { ErrorState } from "@uwe/shared-ui";

/**
 * Brain hatte bisher gar keine Fehlergrenze — bei einem Fehler in einer
 * Serverkomponente zeigte Next die eigene, unformatierte Standardseite: weißer
 * Grund, englischer Text, kein Weg zurück. Studio und Portal haben so eine
 * Grenze seit Langem; hier fehlte sie.
 *
 * Die Route steht dabei bewusst dabei, die Fehlermeldung nicht: Brain ist der
 * owner-private Bereich, und eine durchgereichte Meldung aus einer
 * Serverkomponente kann Dateipfade oder Feldnamen enthalten. `digest` genügt,
 * um den Eintrag im Server-Log zu finden.
 */
export default function BrainError({
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
          <button type="button" className="brain-btn" onClick={reset}>
            Erneut versuchen
          </button>
        }
      />
    </main>
  );
}
