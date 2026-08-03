import { NextResponse } from "next/server";
import { canUseEngineAi } from "@uwe/auth";
import { createAuthService, createPrismaClient } from "@uwe/database/server";
import { getSessionToken } from "@/src/lib/auth";
import { canEnterBrain } from "@/src/lib/owner";

/**
 * Brain needs the `brain` checkbox: every Brain route, API and server action
 * requires an authenticated session whose address holds it. Anyone else
 * receives 401/403.
 *
 * `options.requireAi` verlangt zusätzlich das KI-Flag (G-KI) — für die Routen,
 * die den Maschinenraum-Host beschäftigen. Das Brain-Häkchen bringt jemanden in den
 * Bereich; ob er darin Inferenz auslösen darf, ist die zweite Frage. Der Owner
 * geht über `canUseEngineAi` durch.
 */
export async function requireBrainOwnerAuth(
  options: { requireAi?: boolean } = {},
): Promise<NextResponse | null> {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Anmeldung erforderlich." }, { status: 401 });
  }

  const db = createPrismaClient();
  try {
    const auth = createAuthService(db);
    const session = await auth.getSessionByToken(token);
    if (!session?.user || !canEnterBrain(session.user)) {
      return NextResponse.json(
        { error: "Kein Zugang zum Bereich Brain." },
        { status: 403 },
      );
    }
    if (options.requireAi && !canUseEngineAi(auth.toAuthUser(session.user))) {
      return NextResponse.json(
        {
          error:
            "Für dieses Konto ist die Maschinenraum-KI nicht freigeschaltet. Der Owner richtet das im Command Center ein.",
        },
        { status: 403 },
      );
    }
    return null;
  } finally {
    await db.$disconnect();
  }
}
