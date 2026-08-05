import type { MetadataRoute } from "next";
import { portalBasePath } from "@/src/lib/base-path";

/**
 * Web-App-Manifest des Portals.
 *
 * Früher lag es als feste Datei unter `public/manifest.webmanifest`. Es muss
 * erzeugt werden, weil das Portal unter einem Unterpfad laufen kann
 * (`PORTAL_PATH`): dieser Präfix gehört in `start_url`, `scope` und Icon-Pfad —
 * eine statische Datei kann das nicht.
 *
 * `scope` deckt das ganze Portal ab; der Einstieg ist die Weltenübersicht.
 */
/**
 * Zur Laufzeit erzeugt, nicht beim Bauen: `PORTAL_PATH` steht erst auf dem
 * Host fest — dasselbe Prinzip wie bei den Produkt-Origins im Layout. Ein
 * eingebackener Pfad wäre auf jeder Installation mit Unterpfad falsch.
 */
export const dynamic = "force-dynamic";

export default function manifest(): MetadataRoute.Manifest {
  const base = portalBasePath();

  return {
    name: "UWE Portal",
    short_name: "UWE Portal",
    description: "Universeller Welten-Editor — Spieler-Portal",
    id: `${base}/auth/worlds`,
    start_url: `${base}/auth/worlds`,
    scope: `${base}/`,
    display: "standalone",
    background_color: "#0f0a2e",
    theme_color: "#7c3aed",
    orientation: "any",
    lang: "de",
    icons: [
      {
        src: `${base}/icon.svg`,
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
