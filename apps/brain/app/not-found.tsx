import Link from "next/link";
import { EmptyState } from "@uwe/shared-ui";

/**
 * Ohne diese Datei beantwortet Next einen Tippfehler in der Adresse mit seiner
 * eigenen 404-Seite — außerhalb des Themes und ohne Weg zurück.
 */
export default function BrainNotFound() {
  return (
    <main className="uwe-main" id="uwe-main">
      <EmptyState
        icon="◌"
        title="Seite nicht gefunden"
        description="Diese Adresse gibt es im Brain nicht (mehr). Prüfe den Link oder fang wieder am Anfang an."
        action={
          <Link className="brain-btn" href="/">
            Zur Brain-Startseite
          </Link>
        }
      />
    </main>
  );
}
