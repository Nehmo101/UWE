import { guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { NextResponse } from "next/server";

/**
 * Deprecated: this endpoint used to call the legacy inbound Maschinenraum-Agent
 * (`${ENGINE_AGENT_URL}/api/hardware`) directly. That inbound path is removed.
 * Hardware/system info now comes from the outbound Maschinenraum
 * (`connector_refresh_models` / `system_info`) via the connector queue. See the
 * cookbook runner in `tools/uwe-engine-connector` and `docs/engine-connector.md`.
 */
export async function GET(request: Request) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  return NextResponse.json(
    {
      available: false,
      error: "gone",
      message:
        "Dieser Endpunkt ist entfernt. Der inbound Maschinenraum-Agent (ENGINE_AGENT_URL) wird nicht mehr direkt aufgerufen. " +
        "Hardware-Infos liefert der outbound Maschinenraum (tools/uwe-engine-connector, system_info). " +
        "Siehe docs/engine-connector.md.",
    },
    { status: 410 },
  );
}
