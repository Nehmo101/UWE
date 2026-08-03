/**
 * Basispfad des Portals.
 *
 * Läuft das Portal unter einem Unterpfad (`PORTAL_PATH=/portal`), müssen
 * Manifest, Service Worker und deren Registrierung denselben Präfix tragen —
 * sonst registriert der Browser einen Worker mit falschem Geltungsbereich und
 * der Tischmodus bleibt offline leer.
 *
 * Bewusst dieselbe Ableitung wie in `next.config.ts`: die Konfiguration wird
 * von Node vor dem Alias-Setup geladen und kann diese Datei nicht importieren.
 * Wer die eine Stelle ändert, ändert die andere mit.
 */
export function portalBasePath(): string {
  const raw = process.env.PORTAL_PATH?.trim();
  if (!raw || raw === "/") return "";
  return raw.startsWith("/") ? raw.replace(/\/$/, "") : `/${raw.replace(/\/$/, "")}`;
}
