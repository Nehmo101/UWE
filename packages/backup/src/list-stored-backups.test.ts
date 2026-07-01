import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { listStoredBackups } from "./export";

describe("listStoredBackups", () => {
  it("uses an explicit backups directory without env re-resolution", () => {
    const backupsDir = fs.mkdtempSync(path.join(os.tmpdir(), "uwe-backups-explicit-"));
    fs.writeFileSync(path.join(backupsDir, "note.txt"), "ignored");

    const listed = listStoredBackups(backupsDir);
    assert.deepEqual(listed, []);
  });

  it("skips corrupt backup files instead of failing the whole listing", () => {
    const backupsDir = fs.mkdtempSync(path.join(os.tmpdir(), "uwe-backups-corrupt-"));
    fs.writeFileSync(path.join(backupsDir, "bad.zip"), "not a zip");
    fs.writeFileSync(path.join(backupsDir, "bad.json"), "{invalid");

    assert.doesNotThrow(() => {
      const listed = listStoredBackups(backupsDir);
      assert.equal(listed.length, 0);
    });
  });

  it("returns an empty list when the directory is not readable", () => {
    if (process.platform === "win32") {
      return;
    }

    const backupsDir = fs.mkdtempSync(path.join(os.tmpdir(), "uwe-backups-unreadable-"));
    fs.chmodSync(backupsDir, 0o000);

    try {
      assert.deepEqual(listStoredBackups(backupsDir), []);
    } finally {
      fs.chmodSync(backupsDir, 0o700);
    }
  });
});
