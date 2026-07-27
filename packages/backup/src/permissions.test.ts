import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canCreateBackup,
  canDownloadBackup,
  canPreviewRestore,
  canRestoreBackup,
} from "@uwe/backup";

const owner = {
  isOwner: true,
  access: { portal: true, studio: true, brain: true, family: true },
};
const dm = {
  isOwner: false,
  access: { portal: true, studio: true, brain: false, family: false },
};
const player = {
  isOwner: false,
  access: { portal: true, studio: false, brain: false, family: false },
};

describe("backup permissions", () => {
  it("lets the Studio checkbox create and download backups", () => {
    assert.equal(canCreateBackup(owner), true);
    assert.equal(canCreateBackup(dm), true);
    assert.equal(canDownloadBackup(owner), true);
    assert.equal(canDownloadBackup(dm), true);
  });

  it("denies a Portal-only account and an anonymous caller", () => {
    assert.equal(canCreateBackup(player), false);
    assert.equal(canDownloadBackup(player), false);
    assert.equal(canCreateBackup(null), false);
    assert.equal(canDownloadBackup(null), false);
  });

  it("allows only the owner to preview and restore", () => {
    assert.equal(canPreviewRestore(owner), true);
    assert.equal(canRestoreBackup(owner), true);
    assert.equal(canPreviewRestore(dm), false);
    assert.equal(canRestoreBackup(dm), false);
    assert.equal(canPreviewRestore(player), false);
    assert.equal(canRestoreBackup(player), false);
    assert.equal(canRestoreBackup(null), false);
  });
});
