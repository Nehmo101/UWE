import "dotenv/config";
import { createAuthService } from "../packages/database/src/auth";
import { prisma } from "../packages/database/src/client";

/**
 * Gibt dem Seed-DM für den E2E-Lauf zusätzlich die Häkchen Brain und Family.
 *
 * Warum nicht im Seed selbst: der Dev-Seed vergibt bewusst nur Portal und
 * Studio (CLAUDE.md, „Lokale DB einrichten"). Wer Brain oder Family will,
 * setzt das Häkchen in der Kommandozentrale — genau diese Handbewegung soll
 * ein Entwickler einmal machen, damit das Zugangsmodell nicht zur Kulisse
 * wird. Der E2E-Lauf braucht die beiden Bereiche trotzdem, und er arbeitet auf
 * einer weggeworfenen Datenbank im Temp-Verzeichnis. Deshalb steht die
 * Erweiterung hier und nicht dort.
 *
 * Brain und Family haben kein eigenes Anmeldeformular — sie teilen sich das
 * UWE-Sitzungs-Cookie mit Studio (siehe `apps/brain/app/login/page.tsx`).
 * Für die Tests heißt das: auf der Studio-Origin anmelden, dann auf die
 * Brain- bzw. Family-Origin wechseln. Cookies sind host-, nicht port-gebunden,
 * also trägt dieselbe Sitzung über die vier Ports.
 *
 * Aufruf: `node --import tsx scripts/e2e-grant-areas.ts` mit gesetztem
 * `DATABASE_URL` — `scripts/e2e-servers.mjs` tut das nach dem Seed.
 */

const EMAIL = "dm@uwe.local";

async function main() {
  const auth = createAuthService(prisma);
  const user = await prisma.user.findFirst({
    where: { email: EMAIL },
    select: { id: true },
  });

  if (!user) {
    // Ohne den Seed-Nutzer läuft kein einziger angemeldeter Test — das still
    // durchgehen zu lassen hieße, die Ursache erst im Testreport zu suchen.
    throw new Error(`[e2e] Seed-Nutzer ${EMAIL} nicht gefunden — lief der Seed?`);
  }

  await auth.updateUser(user.id, { brainAccess: true, familyAccess: true });
  console.log(`[e2e] ${EMAIL} hat jetzt alle vier Häkchen.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
