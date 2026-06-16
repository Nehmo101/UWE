import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canCreateBackup,
  canDownloadBackup,
  canPreviewRestore,
  canRestoreBackup,
} from "@uwe/backup";

describe("backup permissions", () => {
  it("allows OWNER and ADMIN (dm) to create and download backups", () => {
    assert.equal(canCreateBackup("owner"), true);
    assert.equal(canCreateBackup("dm"), true);
    assert.equal(canDownloadBackup("owner"), true);
    assert.equal(canDownloadBackup("dm"), true);
  });

  it("denies PLAYER from creating or downloading backups", () => {
    assert.equal(canCreateBackup("player"), false);
    assert.equal(canDownloadBackup("player"), false);
  });

  it("allows only OWNER to preview and restore", () => {
    assert.equal(canPreviewRestore("owner"), true);
    assert.equal(canRestoreBackup("owner"), true);
    assert.equal(canPreviewRestore("dm"), false);
    assert.equal(canRestoreBackup("dm"), false);
    assert.equal(canPreviewRestore("player"), false);
    assert.equal(canRestoreBackup("player"), false);
  });
});
