/**
 * Wo im Portal der ausgelieferte Terra-Editor liegt (J1).
 *
 * Der Grund für dieses Modul ist eine Falle: Next.js präfixt `basePath`
 * automatisch nur bei `next/link`, `next/image` und dem Router — NICHT beim
 * `src` eines rohen `<iframe>`. Steht das Portal unter einem Pfad (siehe
 * `apps/portal/next.config.ts`, `PORTAL_PATH`), liefe ein festes
 * `/terra/index.html` also ins Leere und der Rahmen bliebe leer.
 *
 * Die Rechnung hier ist bewusst dieselbe wie in `next.config.ts` — Zeile für
 * Zeile. Läuft die eine Stelle der anderen davon, ist der Fehler ein leerer
 * Rahmen, kein Absturz; deshalb steht die Begründung hier und nicht nur dort.
 */
const rawPortalPath = process.env.PORTAL_PATH?.trim();
const basePath = rawPortalPath && rawPortalPath !== "/" ? rawPortalPath : "";

/** Gleich-origin-Pfad zum Editor. Der Lesemodus hängt seine Query selbst an. */
export const TERRA_QUELLE = `${basePath}/terra/index.html`;
