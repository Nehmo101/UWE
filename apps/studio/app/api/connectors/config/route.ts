import { NextResponse } from "next/server";

import { authenticateConnector } from "@/src/lib/connector-auth";
import { resolveHostConnectorConfig } from "@/src/lib/connector-config";

export async function GET(request: Request) {
  const auth = await authenticateConnector(request);
  if (!auth.ok) return auth.response;

  // Only operating parameters — no world/brain/user/admin data.
  return NextResponse.json({
    connector: { id: auth.connector.id, name: auth.connector.name },
    config: resolveHostConnectorConfig(),
  });
}
