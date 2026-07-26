import { NextResponse } from "next/server";

/**
 * Öffentliche Liveness-Probe der Startseite. Bewusst minimal — der Apex-Origin
 * ist die einzige völlig ungeschützte Fläche von UWE und verrät hier nichts
 * über Datenbank, Migrationen oder Konfiguration. Das Command Center wartet
 * beim Start auf genau diesen Endpunkt (`waitForHealth`).
 */
export async function GET() {
  return NextResponse.json(
    { status: "ok", app: "UWE Landing", timestamp: new Date().toISOString() },
    { status: 200 },
  );
}
