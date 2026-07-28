import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashPassword, isLegacyPasswordHash, verifyPassword } from "./password";
import {
  generateOpaqueToken,
  hashOpaqueToken,
  verifyOpaqueToken,
} from "./opaque-token";
import { toSafeUser } from "./safe-user";

describe("hashPassword / verifyPassword", () => {
  it("stores versioned scrypt hashes", async () => {
    const stored = await hashPassword("test-password-123");
    assert.match(stored, /^scrypt:v1:[a-f0-9]{32}:[a-f0-9]{128}$/);
    assert.equal(stored.includes("test-password-123"), false);
  });

  it("verifies correct passwords with timing-safe comparison", async () => {
    const stored = await hashPassword("correct-password");
    assert.equal(await verifyPassword("correct-password", stored), true);
    assert.equal(await verifyPassword("wrong-password", stored), false);
  });

  it("supports legacy salt:hash records", async () => {
    const legacy = await hashPassword("legacy-password");
    const [, , salt, hashHex] = legacy.split(":");
    const legacyStored = `${salt}:${hashHex}`;

    assert.equal(isLegacyPasswordHash(legacyStored), true);
    assert.equal(await verifyPassword("legacy-password", legacyStored), true);
    assert.equal(await verifyPassword("wrong-password", legacyStored), false);
  });

  it("rejects malformed stored hashes", async () => {
    assert.equal(await verifyPassword("password", ""), false);
    assert.equal(await verifyPassword("password", "only-one-part"), false);
    assert.equal(await verifyPassword("password", "bad:v1:salt"), false);
  });

  it("uses unique salts per password", async () => {
    const first = await hashPassword("same-password");
    const second = await hashPassword("same-password");
    assert.notEqual(first, second);
  });
});

describe("opaque invite/reset tokens", () => {
  it("hashes tokens for storage and verifies without logging plaintext", () => {
    const token = generateOpaqueToken();
    const hash = hashOpaqueToken(token);

    assert.equal(hash.length, 64);
    assert.equal(verifyOpaqueToken(token, hash), true);
    assert.equal(verifyOpaqueToken("other-token", hash), false);
  });
});

describe("toSafeUser", () => {
  it("removes password and token fields from user records", () => {
    const safe = toSafeUser({
      id: "user-1",
      displayName: "Test User",
      email: "test@example.com",
      isOwner: false,
      portalAccess: true,
      studioAccess: false,
      brainAccess: false,
      familyAccess: false,
      passwordHash: "scrypt:v1:abc:def",
      resetTokenHash: "reset-hash",
      inviteTokenHash: "invite-hash",
      twoFactorSecret: { secret: "otp" },
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      forcePasswordChange: true,
    });

    assert.deepEqual(safe, {
      id: "user-1",
      displayName: "Test User",
      email: "test@example.com",
      isOwner: false,
      access: { portal: true, studio: false, brain: false, family: false },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      forcePasswordChange: true,
      hasPassword: true,
    });

    const serialized = JSON.stringify(safe);
    assert.equal(serialized.includes("passwordHash"), false);
    assert.equal(serialized.includes("reset-hash"), false);
    assert.equal(serialized.includes("invite-hash"), false);
  });
});
