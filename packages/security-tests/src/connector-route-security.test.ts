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
  it("requires connector auth before returning host config on heartbeat when queue is paused", () => {
    const source = read("apps/studio/app/api/connectors/heartbeat/route.ts");
    const authIndex = source.indexOf("authenticateConnector(request)");
    const queueDisabledReturn = source.indexOf("if (!hostConfig.queueEnabled)");

    assert.ok(authIndex >= 0, "heartbeat route must authenticate connectors");
    assert.ok(queueDisabledReturn >= 0, "heartbeat route must handle paused host queue");
    assert.ok(
      authIndex < queueDisabledReturn,
      "authenticateConnector must run before the paused-queue response that includes host config",
    );
    assert.doesNotMatch(
      source,
      /id:\s*"host-queue-paused"/,
      "paused heartbeat must not fabricate an unauthenticated connector identity",
    );
  });

  it("checks label print document ownership before rendering", () => {
    const source = read("apps/studio/app/api/connectors/print-jobs/[jobId]/document/route.ts");
    assert.match(source, /assertConnectorPrintDocumentAccess/);
    assert.match(source, /auth\.connector\.id/);
    const accessIndex = source.indexOf("assertConnectorPrintDocumentAccess");
    const renderIndex = source.indexOf("renderDocument");
    assert.ok(accessIndex >= 0 && renderIndex > accessIndex, "ownership check must precede renderDocument");
  });
});
