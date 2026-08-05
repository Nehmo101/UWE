import type { MetadataRoute } from "next";

/**
 * Web-App-Manifest von Family — macht die App am Handy installierbar
 * (Muster: Portal). Family läuft ohne Unterpfad, das Manifest ist trotzdem
 * zur Laufzeit erzeugt, damit es dieselbe Route-Konvention wie Portal nutzt.
 *
 * Kein Service Worker: den Offline-Fall der Einkaufsliste deckt
 * `FamilyShoppingOffline` clientseitig ab. Die Verknüpfungen führen dorthin,
 * wo das Handy im Alltag gebraucht wird — Einkauf, Wochenplan, Beleg-Scan
 * (die Rückkamera öffnet direkt aus dem Scan-Eingang).
 */
export const dynamic = "force-dynamic";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "UWE Family",
    short_name: "Family",
    description: "Universeller Welten-Editor — der gemeinsame Haushalt",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#100e16",
    theme_color: "#100e16",
    orientation: "any",
    lang: "de",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
    shortcuts: [
      {
        name: "Einkaufsliste",
        short_name: "Einkauf",
        description: "Die offene Einkaufsliste — funktioniert im Laden auch offline",
        url: "/kitchen/shopping",
      },
      {
        name: "Wochenplan",
        short_name: "Plan",
        description: "Essensplan der Woche",
        url: "/kitchen/plan",
      },
      {
        name: "Beleg scannen",
        short_name: "Scan",
        description: "Kassenbon oder Brief mit der Kamera erfassen",
        url: "/scan-inbox",
      },
    ],
  };
}
