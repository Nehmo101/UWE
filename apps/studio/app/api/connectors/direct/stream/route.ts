import { NextResponse } from "next/server";

import { normalizeCapabilities } from "@uwe/connector";
import { getDirectConnectorRegistry } from "@uwe/connector/direct";

import { authenticateConnector } from "@/src/lib/connector-auth";
import { resolveHostConnectorConfig } from "@/src/lib/connector-config";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticateConnector(request);
  if (!auth.ok) return auth.response;

  const registry = getDirectConnectorRegistry();
  if (!resolveHostConnectorConfig().directEnabled) {
    registry.disconnect(auth.connector.id, "Direct transport is disabled by the host.");
    return NextResponse.json(
      { error: "Direct Connector transport is disabled by the host." },
      { status: 503 },
    );
  }

  const rawCapabilities = Array.isArray(auth.connector.capabilities)
    ? auth.connector.capabilities
    : [];
  const session = registry.openSession({
    connectorId: auth.connector.id,
    capabilities: normalizeCapabilities(rawCapabilities),
    signal: request.signal,
  });

  return new Response(session.stream, {
    headers: {
      "Cache-Control": "no-cache, no-store, no-transform",
      Connection: "keep-alive",
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
