import { loadEnvFromRoot } from "./cli-env";

/**
 * Nebenwirkungs-Modul: lädt die Root-`.env`, **bevor** die übrigen Imports einer
 * CLI ausgewertet werden. Muss deshalb als allererster Import stehen.
 *
 * Hintergrund: `@uwe/database` legt seine Clients beim Laden des Moduls an
 * (`export const prisma = getSharedPrismaClient()` in `client.ts`, dazu
 * `brainPrisma` und `familyPrisma`). ESM wertet alle Importe vor dem Rumpf des
 * importierenden Moduls aus — ein `loadEnvFromRoot()` im Rumpf kommt für diese
 * Singletons also immer zu spät. Ohne `DATABASE_URL` / `BRAIN_DATABASE_URL`
 * fällt `resolve*DatabaseUrl` auf `packages/database/data/*.db` zurück, das auf
 * einem Host mit Daten unter `%LOCALAPPDATA%` nicht existiert: die Secrets-
 * Ansicht der Kommandozentrale scheiterte so an
 * `ConnectionFailed("… uwe-brain.db: 14")` (SQLITE_CANTOPEN).
 *
 * Ein eigenes Modul statt eines Aufrufs im Rumpf, weil nur die Importreihenfolge
 * diese Garantie gibt — und `cli-env-preload.test.ts` sie festhält.
 */
loadEnvFromRoot();
