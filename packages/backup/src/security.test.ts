import assert from "node:assert/strict";
import AdmZip from "adm-zip";
import { describe, it } from "node:test";
import { assertSafeZipEntryName, ZipSecurityError } from "@uwe/assets";
import { extractBackupAssets } from "./archive";
import { assetZipPath, BACKUP_DATA_FILE, BACKUP_MANIFEST_FILE } from "./paths";
import { BackupValidationError, validateBackupBundle } from "./validate";

describe("backup security", () => {
  it("blocks Zip Slip path traversal entries", () => {
    assert.throws(
      () => assertSafeZipEntryName("../etc/passwd"),
      ZipSecurityError,
    );
    assert.throws(
      () => assertSafeZipEntryName("assets/../../secret.txt"),
      ZipSecurityError,
    );
    assert.throws(
      () => assertSafeZipEntryName("/etc/passwd"),
      ZipSecurityError,
    );
  });

  it("allows valid backup archive entries", () => {
    assert.doesNotThrow(() => assertSafeZipEntryName(BACKUP_MANIFEST_FILE));
    assert.doesNotThrow(() => assertSafeZipEntryName(BACKUP_DATA_FILE));
    assert.doesNotThrow(() => assertSafeZipEntryName("assets/world-id/map.png"));
  });

  it("rejects zip archives with traversal entries during asset extraction", () => {
    const zip = new AdmZip();
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
      assetFiles: [],
    };
    const data = {
      assets: [
        {
          id: "asset-1",
          worldId: "world-test",
          storageKey: "../../../etc/passwd",
          title: "evil",
          type: "image",
          mimeType: "image/png",
          size: 3,
        },
      ],
    };
    zip.addFile(BACKUP_MANIFEST_FILE, Buffer.from(JSON.stringify(manifest), "utf8"));
    zip.addFile(BACKUP_DATA_FILE, Buffer.from(JSON.stringify(data), "utf8"));

    assert.throws(
      () => extractBackupAssets(zip.toBuffer(), "/tmp/uwe-backup-test"),
      /Invalid storage key|Unsafe ZIP|ZipSecurityError/,
    );
  });

  it("rejects backups whose asset payload is HTML/SVG (restore-path XSS)", () => {
    const zip = new AdmZip();
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
      assetFiles: [],
    };
    // Storage key + declared mimeType look like a harmless PNG, but the packaged
    // bytes are HTML — the upload path blocks this; the restore path must too.
    const storageKey = "world-test/evil.png";
    const data = {
      assets: [
        {
          id: "asset-1",
          worldId: "world-test",
          storageKey,
          title: "evil",
          type: "image",
          mimeType: "image/png",
          size: 40,
        },
      ],
    };
    zip.addFile(BACKUP_MANIFEST_FILE, Buffer.from(JSON.stringify(manifest), "utf8"));
    zip.addFile(BACKUP_DATA_FILE, Buffer.from(JSON.stringify(data), "utf8"));
    zip.addFile(
      assetZipPath(storageKey),
      Buffer.from("<html><body><script>alert(1)</script></body></html>", "utf8"),
    );

    assert.throws(
      () => extractBackupAssets(zip.toBuffer(), "/tmp/uwe-backup-xss-test"),
      (error: unknown) =>
        error instanceof ZipSecurityError && /disallowed content/.test((error as Error).message),
    );
  });

  it("rejects manipulated backups containing secrets", () => {
    const tampered = {
      manifest: {
        version: "1.0",
        uweVersion: "0.1.0",
        schemaVersion: "test",
        type: "full",
        createdAt: new Date().toISOString(),
        includesUsers: false,
        includesAuthSessions: false,
        includesSettings: false,
        stats: {
          worlds: 0,
          campaigns: 0,
          pages: 0,
          contentBlocks: 0,
          pageLinks: 0,
          assets: 0,
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
        assetFiles: [],
      },
      data: {
        worlds: [],
        campaigns: [],
        pages: [],
        contentBlocks: [],
        pageLinks: [],
        assets: [],
        assetPageLinks: [],
        gameSessions: [],
        gameSessionPageLinks: [],
        labelTemplates: [],
        labels: [],
        printLists: [],
        printListItems: [],
        soundboardButtons: [],
        soundboardButtonPageLinks: [],
        worldMemberships: [],
        pagePlayerAccess: [],
        sessionUnlocks: [],
        users: [{ id: "1", displayName: "Hacker", email: null, isOwner: true, access: { portal: true, studio: true, brain: true, family: true }, passwordHash: "x" }],
      },
    };

    assert.throws(
      () => validateBackupBundle(tampered),
      (error: unknown) => error instanceof BackupValidationError,
    );
  });

  it("rejects backups with unsupported manifest versions", () => {
    const invalid = {
      manifest: {
        version: "99.0",
        type: "full",
        createdAt: new Date().toISOString(),
        stats: {},
      },
      data: {
        worlds: [],
        campaigns: [],
        pages: [],
        contentBlocks: [],
        assets: [],
      },
    };

    assert.throws(
      () => validateBackupBundle(invalid),
      (error: unknown) => error instanceof BackupValidationError,
    );
  });
});
