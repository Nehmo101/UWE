import assert from "node:assert/strict";
import AdmZip from "adm-zip";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { resolveAssetFilePath } from "@uwe/assets";
import { BACKUP_ASSETS_DIR, BACKUP_DATA_FILE, BACKUP_MANIFEST_FILE } from "./paths";
import { extractBackupAssets } from "./archive";

describe("backup zip slip protection", () => {
  it("resolveAssetFilePath rejects traversal keys", () => {
    const uploadsRoot = fs.mkdtempSync(path.join(os.tmpdir(), "uwe-zip-slip-"));
    assert.throws(
      () => resolveAssetFilePath("../../../etc/passwd", uploadsRoot),
      /Invalid storage key/,
    );
  });

  it("extractBackupAssets only writes under uploads root", () => {
    const uploadsRoot = fs.mkdtempSync(path.join(os.tmpdir(), "uwe-zip-slip-safe-"));
    const worldId = "world-test";
    const storageKey = `${worldId}/map-abc123.png`;

    const manifest = {
      version: "1.0",
      uweVersion: "test",
      schemaVersion: "test",
      type: "full",
      createdAt: new Date().toISOString(),
      includesUsers: false,
      includesAuthSessions: false,
      stats: {
        worlds: 1,
        campaigns: 0,
        pages: 0,
        contentBlocks: 0,
        pageLinks: 0,
        assets: 1,
        gameSessions: 0,
        labels: 0,
        labelTemplates: 0,
        printLists: 0,
        soundboardButtons: 0,
        pageTemplates: 0,
        worldMemberships: 0,
        shareLinks: 0,
        playerNotes: 0,
      },
      assetFiles: [`${BACKUP_ASSETS_DIR}/${storageKey}`],
    };

    const data = {
      assets: [
        {
          id: "asset-1",
          worldId,
          storageKey,
          title: "map",
          type: "image",
          mimeType: "image/png",
          size: 3,
          visibility: "dm_only",
        },
      ],
    };

    const zip = new AdmZip();
    zip.addFile(BACKUP_MANIFEST_FILE, Buffer.from(JSON.stringify(manifest), "utf8"));
    zip.addFile(BACKUP_DATA_FILE, Buffer.from(JSON.stringify(data), "utf8"));
    zip.addFile(`${BACKUP_ASSETS_DIR}/${storageKey}`, Buffer.from("png"));

    const copied = extractBackupAssets(zip.toBuffer(), uploadsRoot);
    assert.equal(copied.length, 1);
    const target = resolveAssetFilePath(copied[0]!, uploadsRoot);
    assert.ok(target.startsWith(path.resolve(uploadsRoot)));
  });
});
