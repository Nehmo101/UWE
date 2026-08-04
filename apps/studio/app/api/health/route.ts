import { NextResponse } from "next/server";
import {
  databaseHealthCheck,
  UWE_PRODUCT_NAME,
  UWE_VERSION,
} from "@uwe/database/server";

/**
 * Öffentlicher Healthcheck — bewusst wortkarg.
 *
 * Diese Route ist unauthentifiziert; früher gab sie `trust`
 * (u. a. `authSecretLooksWeak`), Migrations- und Proxy-Details heraus — eine
 * Einladung, gezielt schwach konfigurierte Installationen zu finden. Übrig
 * bleibt, was ein Uptime-Check und das Command Center brauchen: Status,
 * Identität (`app.name` — daran erkennt der Host seinen eigenen Prozess auf
 * einem belegten Port), Version, Zeitstempel.
 *
 * Alles Weitere gibt es hinter Token-Auth unter `/api/health/private`
 * (`requirePrivateHealthAuth`).
 */
export async function GET() {
  const db = await databaseHealthCheck();
  const status = db.status === "ok" ? "ok" : "degraded";

  return NextResponse.json(
    {
      status,
      app: {
        name: "UWE Studio",
        product: UWE_PRODUCT_NAME,
        version: UWE_VERSION,
      },
      timestamp: new Date().toISOString(),
    },
    { status: status === "ok" ? 200 : 503 },
  );
}
