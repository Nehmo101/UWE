import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createTestFamilyClient, type FamilyPrismaClient } from "@uwe/database/test-helpers";
import {
  FAMILY_CALDAV_TOKEN_PREFIX,
  createFamilyCalDavAccountService,
  isFamilyCalDavTokenFormat,
  tokenFromBasicAuth,
  type FamilyCalDavAccountService,
} from "./caldav-account-service";

describe("isFamilyCalDavTokenFormat", () => {
  it("erkennt gültige CalDAV-Tokens", () => {
    assert.ok(isFamilyCalDavTokenFormat(`${FAMILY_CALDAV_TOKEN_PREFIX}${"a".repeat(48)}`));
  });

  it("weist fremde Präfixe und zu kurze Werte zurück", () => {
    assert.equal(isFamilyCalDavTokenFormat(`uwecal_${"a".repeat(48)}`), false);
    assert.equal(isFamilyCalDavTokenFormat(`${FAMILY_CALDAV_TOKEN_PREFIX}kurz`), false);
  });
});

describe("tokenFromBasicAuth", () => {
  it("liest das Passwort aus einem Basic-Header, Benutzername egal", () => {
    const header = `Basic ${Buffer.from("familie:uwedav_geheim123").toString("base64")}`;
    assert.equal(tokenFromBasicAuth(header), "uwedav_geheim123");
    const other = `basic ${Buffer.from("egal:uwedav_geheim123").toString("base64")}`;
    assert.equal(tokenFromBasicAuth(other), "uwedav_geheim123");
  });

  it("weist Müll, Bearer und leere Passwörter zurück", () => {
    assert.equal(tokenFromBasicAuth(null), null);
    assert.equal(tokenFromBasicAuth("Bearer abc"), null);
    assert.equal(tokenFromBasicAuth("Basic %%%"), null);
    assert.equal(tokenFromBasicAuth(`Basic ${Buffer.from("nurbenutzer").toString("base64")}`), null);
    assert.equal(tokenFromBasicAuth(`Basic ${Buffer.from("familie:").toString("base64")}`), null);
  });
});

describe("FamilyCalDavAccountService", () => {
  let db: FamilyPrismaClient;
  let service: FamilyCalDavAccountService;

  before(() => {
    db = createTestFamilyClient();
    service = createFamilyCalDavAccountService(db);
  });

  it("legt Zugänge an und speichert nur den Hash", async () => {
    const created = await service.createAccount({ label: "iPhone von Test" });
    assert.ok(created.token.startsWith(FAMILY_CALDAV_TOKEN_PREFIX));

    const row = await db.familyCalDavAccount.findUniqueOrThrow({ where: { id: created.id } });
    assert.notEqual(row.tokenHash, created.token);
    assert.ok(!row.tokenHash.includes(created.token));
    assert.ok(created.token.startsWith(row.tokenPrefix));
  });

  it("löst gültige Tokens auf — auch über den Basic-Header", async () => {
    const created = await service.createAccount({ label: "Auflösen" });
    const resolved = await service.resolveByToken(created.token);
    assert.equal(resolved?.id, created.id);

    const header = `Basic ${Buffer.from(`familie:${created.token}`).toString("base64")}`;
    const viaHeader = await service.resolveBasicAuth(header);
    assert.equal(viaHeader?.id, created.id);
  });

  it("verweigert unbekannte und widerrufene Tokens gleich (null)", async () => {
    assert.equal(await service.resolveByToken(`${FAMILY_CALDAV_TOKEN_PREFIX}${"f".repeat(48)}`), null);

    const created = await service.createAccount({ label: "Widerruf" });
    await service.revokeAccount(created.id);
    assert.equal(await service.resolveByToken(created.token), null);
  });
});
