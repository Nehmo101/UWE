import { NextResponse } from "next/server";

import { parseConnectorBearer } from "@uwe/connector";
import { type Connector, createConnectorService, prisma } from "@uwe/database/server";
import { enforceRateLimit } from "@uwe/security";

/**
 * Connector API authentication.
 *
 * RTX Host Connectors authenticate exclusively with their connector token
 * (Authorization: Bearer uwec_…). This is deliberately separate from the user
 * session / Studio API token flow — a connector is a worker, never a user, and
 * must not be able to read admin or user data. Only the token hash is stored,
 * lookup is by hash, and every call is rate limited.
 */

export type ConnectorAuthResult =
  | { ok: true; connector: Connector }
  | { ok: false; response: NextResponse };

export async function authenticateConnector(request: Request): Promise<ConnectorAuthResult> {
  const limited = enforceRateLimit(request, "connector", "connector");
  if (limited) {
    return { ok: false, response: limited as NextResponse };
  }

  const token = parseConnectorBearer(request.headers.get("authorization"));
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Connector-Token erforderlich (Authorization: Bearer uwec_…)." },
        { status: 401 },
      ),
    };
  }

  const service = createConnectorService(prisma);
  const connector = await service.authenticate(token);
  if (!connector) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Ungültiges Connector-Token." }, { status: 401 }),
    };
  }
  if (connector.disabled) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Connector ist deaktiviert. Im Studio unter System → RTX Connector reaktivieren." },
        { status: 403 },
      ),
    };
  }

  return { ok: true, connector };
}
