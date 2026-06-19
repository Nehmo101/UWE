import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractHardwareRunbook,
  mergeHardwareRunbookMetadata,
} from "./hardware-utils";

describe("hardware runbook metadata", () => {
  it("extracts runbook text from metadata", () => {
    assert.equal(
      extractHardwareRunbook({ runbook: "Restart UWE host", other: true }),
      "Restart UWE host",
    );
    assert.equal(extractHardwareRunbook(null), "");
  });

  it("merges runbook into metadata", () => {
    const merged = mergeHardwareRunbookMetadata({ note: "x" }, "Backup weekly");
    assert.equal(merged.runbook, "Backup weekly");
    assert.equal(merged.note, "x");

    const cleared = mergeHardwareRunbookMetadata({ runbook: "old" }, "  ");
    assert.equal(cleared.runbook, undefined);
  });
});
