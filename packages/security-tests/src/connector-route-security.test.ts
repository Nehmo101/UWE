import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function read(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("connector route security regressions", () => {
  it("keeps heartbeat authenticated and independent from the queue kill switch", () => {
    const source = read("apps/studio/app/api/connectors/heartbeat/route.ts");
    const authIndex = source.indexOf("authenticateConnector(request)");
    const parseIndex = source.indexOf("parseBody(request, heartbeatSchema)");
    const heartbeatIndex = source.indexOf("service.heartbeat(auth.connector.id");

    assert.ok(authIndex >= 0, "heartbeat route must authenticate connectors");
    assert.ok(parseIndex > authIndex, "heartbeat payload must be parsed after connector auth");
    assert.ok(heartbeatIndex > parseIndex, "heartbeat must update connector status and capabilities");
    assert.doesNotMatch(
      source,
      /if\s*\(!hostConfig\.queueEnabled\)/,
      "the queue kill switch must not disable connector heartbeat",
    );
  });

  it("requires connector auth on both direct transport routes", () => {
    for (const route of ["stream", "events"]) {
      const source = read(`apps/studio/app/api/connectors/direct/${route}/route.ts`);
      assert.match(source, /authenticateConnector\(request\)/, `${route} route must authenticate`);
      assert.match(source, /auth\.connector\.id/, `${route} route must bind work to connector id`);
    }
  });

  it("checks label print document ownership before rendering", () => {
    const source = read("apps/studio/app/api/connectors/print-jobs/[jobId]/document/route.ts");
    assert.match(source, /assertConnectorPrintDocumentAccess/);
    assert.match(source, /auth\.connector\.id/);
    const accessIndex = source.indexOf("assertConnectorPrintDocumentAccess");
    const renderIndex = source.indexOf("renderDocument");
    assert.ok(accessIndex >= 0 && renderIndex > accessIndex, "ownership check must precede renderDocument");
  });

  it("requires admin auth for connector capability governance", () => {
    const source = read("apps/studio/app/api/admin/connectors/[id]/route.ts");
    assert.match(source, /set-allowed-capabilities/);
    assert.match(source, /setAllowedCapabilities/);
    assert.match(source, /requireAdminApiAuth/);
  });
});
