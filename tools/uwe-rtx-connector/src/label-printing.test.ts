import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  discoverLocalPrinters,
  enumerateHostPrinters,
  listInstalledPrinters,
  runPrinterDiscover,
} from "./label-printing";

describe("label-printing", () => {
  it("parses PRINTERS env", () => {
    assert.equal(
      discoverLocalPrinters({ UWE_CONNECTOR_PRINTERS: JSON.stringify([{ id: "p", name: "P" }]) }).length,
      1,
    );
  });

  it("discover async returns an array", async () => {
    assert.ok(Array.isArray((await runPrinterDiscover()).printers));
  });

  it("enumerateHostPrinters is offline-safe", async () => {
    // No CUPS / spooler in the test env — must resolve to an array, never throw.
    assert.ok(Array.isArray(await enumerateHostPrinters("linux")));
    assert.ok(Array.isArray(await enumerateHostPrinters("win32")));
  });

  it("listInstalledPrinters merges statically configured printers", async () => {
    const printers = await listInstalledPrinters(
      { UWE_CONNECTOR_PRINTERS: JSON.stringify([{ id: "env-p", name: "Env P" }]) },
      "linux",
    );
    assert.ok(printers.some((printer) => printer.id === "env-p"));
  });
});
