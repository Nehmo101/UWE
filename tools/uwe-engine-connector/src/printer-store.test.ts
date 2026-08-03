import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  defaultPrinterStore,
  enabledPrinters,
  loadPrinterStore,
  mergeDiscoveredPrinters,
  parsePrinterStore,
  savePrinterStore,
  toLocalPrinterInfo,
} from "./printer-store";

describe("printer-store — parse", () => {
  it("returns the empty default for null/undefined", () => {
    assert.deepEqual(parsePrinterStore(null), defaultPrinterStore());
    assert.deepEqual(parsePrinterStore(undefined), defaultPrinterStore());
  });

  it("throws only when the top-level value is not an object", () => {
    assert.throws(() => parsePrinterStore("nope"));
    assert.throws(() => parsePrinterStore([]));
  });

  it("keeps the enable flag and drops malformed entries", () => {
    const store = parsePrinterStore({
      printers: [
        { id: "p1", name: "Printer 1", enabledForUwe: true },
        { id: "p2", name: "Printer 2" },
        { id: "", name: "no id" },
        "garbage",
      ],
    });
    assert.equal(store.printers.length, 2);
    assert.equal(store.printers[0].enabledForUwe, true);
    assert.equal(store.printers[1].enabledForUwe, false);
  });

  it("de-duplicates by id, first wins", () => {
    const store = parsePrinterStore({
      printers: [
        { id: "p1", name: "First", enabledForUwe: true },
        { id: "p1", name: "Second" },
      ],
    });
    assert.equal(store.printers.length, 1);
    assert.equal(store.printers[0].name, "First");
  });
});

describe("printer-store — merge discovered", () => {
  it("adds new printers disabled and preserves existing selections", () => {
    const store = {
      version: 1,
      printers: [{ id: "p1", name: "Printer 1", enabledForUwe: true }],
    };
    const merged = mergeDiscoveredPrinters(store, [
      { id: "p1", name: "Printer 1 (renamed)", state: "idle" },
      { id: "p2", name: "Printer 2" },
    ]);

    const p1 = merged.printers.find((p) => p.id === "p1");
    const p2 = merged.printers.find((p) => p.id === "p2");
    // Existing selection preserved, metadata refreshed.
    assert.equal(p1?.enabledForUwe, true);
    assert.equal(p1?.name, "Printer 1 (renamed)");
    assert.equal(p1?.state, "idle");
    // New printer added, disabled by default.
    assert.equal(p2?.enabledForUwe, false);
  });

  it("keeps a selected printer that is no longer discovered", () => {
    const store = {
      version: 1,
      printers: [{ id: "p1", name: "Offline Printer", enabledForUwe: true }],
    };
    const merged = mergeDiscoveredPrinters(store, []);
    assert.equal(merged.printers.length, 1);
    assert.equal(merged.printers[0].enabledForUwe, true);
  });
});

describe("printer-store — helpers", () => {
  it("enabledPrinters filters to the selection", () => {
    const store = {
      version: 1,
      printers: [
        { id: "p1", name: "P1", enabledForUwe: true },
        { id: "p2", name: "P2", enabledForUwe: false },
      ],
    };
    assert.deepEqual(
      enabledPrinters(store).map((p) => p.id),
      ["p1"],
    );
  });

  it("toLocalPrinterInfo strips the enable flag and omits empty fields", () => {
    const info = toLocalPrinterInfo({
      id: "p1",
      name: "P1",
      enabledForUwe: true,
      isDefault: true,
      state: "idle",
    });
    assert.deepEqual(info, { id: "p1", name: "P1", isDefault: true, state: "idle" });
    assert.equal("enabledForUwe" in info, false);
  });
});

describe("printer-store — persistence", () => {
  it("round-trips through disk and returns the default for a missing file", () => {
    const dir = mkdtempSync(join(tmpdir(), "uwe-printer-store-"));
    try {
      assert.deepEqual(loadPrinterStore(dir), defaultPrinterStore());

      const store = {
        version: 1,
        printers: [{ id: "p1", name: "P1", enabledForUwe: true }],
      };
      savePrinterStore(dir, store);
      const loaded = loadPrinterStore(dir);
      assert.equal(loaded.printers.length, 1);
      assert.equal(loaded.printers[0].enabledForUwe, true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
