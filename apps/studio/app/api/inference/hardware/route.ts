import { guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { NextResponse } from "next/server";

/**
 * Deprecated: this endpoint used to call the legacy inbound RTX Agent
 * (`${RTX_AGENT_URL}/api/hardware`) directly. That inbound path is removed.
 * Hardware/system info now comes from the outbound RTX Host Connector
 * (`connector_refresh_models` / `system_info`) via the connector queue. See the
 * cookbook runner in `tools/uwe-rtx-connector` and `docs/rtx-connector.md`.
 */
export async function GET(request: Request) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  return NextResponse.json(
    {
      available: false,
      error: "gone",
      message:
        "Dieser Endpunkt ist entfernt. Der inbound RTX Agent (RTX_AGENT_URL) wird nicht mehr direkt aufgerufen. " +
        "Hardware-Infos liefert der outbound RTX Host Connector (tools/uwe-rtx-connector, system_info). " +
        "Siehe docs/rtx-connector.md.",
    },
    { status: 410 },
  );
}
