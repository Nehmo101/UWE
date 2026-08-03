import { clearOfflineData } from "./offline-store";

/**
 * Räumt beim Abmelden alles weg, was der Tischmodus lokal hält.
 *
 * Ein Portal-Gerät wird herumgereicht — das Telefon liegt am Tisch, der
 * nächste Spieler tippt darauf. Was die vorige Person mitgenommen hat, darf
 * nach dem Abmelden nicht mehr auffindbar sein: weder der Abzug in IndexedDB
 * noch die Hülle im Service-Worker-Cache.
 */
export async function resetOfflineState(): Promise<void> {
  try {
    await clearOfflineData();
  } catch {
    /* Kein Grund, das Abmelden scheitern zu lassen. */
  }

  if (typeof navigator !== "undefined" && navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({ type: "uwe-offline-clear" });
  }
}
