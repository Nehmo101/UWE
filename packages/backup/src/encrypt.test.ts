import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  decryptBackupPayload,
  encryptBackupPayload,
  encryptionKeyConfigured,
  isEncryptedBackupPayload,
  keysMatch,
  resolveBackupEncryptionKey,
  type EncryptedBackupPayload,
} from "./encrypt";

const ENV_KEY = "UWE_BACKUP_ENCRYPTION_KEY";
// Valid 64-hex key -> used verbatim as 32-byte AES key.
const HEX_KEY_A = "a".repeat(64);
const HEX_KEY_B = "b".repeat(64);
// Non-hex value -> derived via sha256("...").
const STRING_KEY = "correct horse battery staple";

function setEnvKey(value: string): void {
  process.env[ENV_KEY] = value;
}

function parsePayload(buffer: Buffer): EncryptedBackupPayload {
  return JSON.parse(buffer.toString("utf8")) as EncryptedBackupPayload;
}

function serializePayload(payload: EncryptedBackupPayload): Buffer {
  return Buffer.from(JSON.stringify(payload), "utf8");
}

/** Flip the first byte while preserving buffer length. */
function flipFirstByte(base64: string): string {
  const buf = Buffer.from(base64, "base64");
  buf.writeUInt8(buf.readUInt8(0) ^ 0xff, 0);
  return buf.toString("base64");
}

afterEach(() => {
  delete process.env[ENV_KEY];
});

describe("resolveBackupEncryptionKey", () => {
  it("returns the raw 32 bytes for a 64-hex env key", () => {
    setEnvKey(HEX_KEY_A);
    const key = resolveBackupEncryptionKey();
    assert.ok(key);
    assert.equal(key.length, 32);
    assert.deepEqual(key, Buffer.from(HEX_KEY_A, "hex"));
  });

  it("sha256-derives a 32-byte key for a non-hex env value", () => {
    setEnvKey(STRING_KEY);
    const key = resolveBackupEncryptionKey();
    assert.ok(key);
    assert.equal(key.length, 32);
    // Not equal to a naive hex interpretation; it is a hash of the string.
    assert.notDeepEqual(key, Buffer.from(STRING_KEY, "utf8"));
  });

  it("returns null when no env key is set, even if a password is supplied", () => {
    assert.equal(resolveBackupEncryptionKey(), null);
    assert.equal(resolveBackupEncryptionKey("some-password"), null);
  });
});

describe("encryptionKeyConfigured", () => {
  it("reflects presence of the env key", () => {
    assert.equal(encryptionKeyConfigured(), false);
    setEnvKey(HEX_KEY_A);
    assert.equal(encryptionKeyConfigured(), true);
  });

  it("treats whitespace-only env values as unconfigured", () => {
    setEnvKey("   ");
    assert.equal(encryptionKeyConfigured(), false);
  });
});

describe("keysMatch", () => {
  it("is true for identical buffers and false otherwise", () => {
    assert.equal(keysMatch(Buffer.from("abcd"), Buffer.from("abcd")), true);
    assert.equal(keysMatch(Buffer.from("abcd"), Buffer.from("abce")), false);
    assert.equal(keysMatch(Buffer.from("abcd"), Buffer.from("abc")), false);
  });
});

describe("encrypt/decrypt round-trip with env key", () => {
  it("round-trips using a 64-hex UWE_BACKUP_ENCRYPTION_KEY", () => {
    setEnvKey(HEX_KEY_A);
    const plaintext = Buffer.from("geheime Weltdaten \u{1F409}", "utf8");

    const encrypted = encryptBackupPayload(plaintext);
    const payload = parsePayload(encrypted);
    // Env-key path uses no scrypt salt.
    assert.equal(payload.salt, "");
    assert.equal(payload.magic, "UWE-BACKUP-ENC-v1");
    assert.equal(payload.algorithm, "aes-256-gcm");

    const decrypted = decryptBackupPayload(encrypted);
    assert.deepEqual(decrypted, plaintext);
  });

  it("round-trips using a non-hex (sha256-derived) string env key", () => {
    setEnvKey(STRING_KEY);
    const plaintext = Buffer.from("string-key payload", "utf8");

    const encrypted = encryptBackupPayload(plaintext);
    assert.equal(parsePayload(encrypted).salt, "");

    const decrypted = decryptBackupPayload(encrypted);
    assert.deepEqual(decrypted, plaintext);
  });

  it("produces a fresh IV per call (different ciphertext for same input)", () => {
    setEnvKey(HEX_KEY_A);
    const plaintext = Buffer.from("repeatable", "utf8");
    const a = parsePayload(encryptBackupPayload(plaintext));
    const b = parsePayload(encryptBackupPayload(plaintext));
    assert.notEqual(a.iv, b.iv);
    assert.notEqual(a.ciphertext, b.ciphertext);
  });
});

describe("encrypt/decrypt round-trip with password (scrypt)", () => {
  it("round-trips using a password and embeds a scrypt salt", () => {
    const plaintext = Buffer.from("passwort-geschuetzt", "utf8");
    const encrypted = encryptBackupPayload(plaintext, { password: "hunter2-pw" });

    const payload = parsePayload(encrypted);
    // scrypt path -> non-empty 16-byte salt embedded.
    assert.notEqual(payload.salt, "");
    assert.equal(Buffer.from(payload.salt, "base64").length, 16);

    const decrypted = decryptBackupPayload(encrypted, { password: "hunter2-pw" });
    assert.deepEqual(decrypted, plaintext);
  });

  it("uses a fresh salt per encryption", () => {
    const plaintext = Buffer.from("salted", "utf8");
    const a = parsePayload(encryptBackupPayload(plaintext, { password: "pw" }));
    const b = parsePayload(encryptBackupPayload(plaintext, { password: "pw" }));
    assert.notEqual(a.salt, b.salt);
  });

  it("throws when neither env key nor password is available (encrypt)", () => {
    assert.throws(
      () => encryptBackupPayload(Buffer.from("x")),
      /Backup-Verschl(ü|u)sselung erfordert ein Passwort oder UWE_BACKUP_ENCRYPTION_KEY\./,
    );
  });

  it("throws when neither env key nor password is available (decrypt)", () => {
    // Build a valid password-encrypted payload, then attempt to decrypt with nothing.
    const encrypted = encryptBackupPayload(Buffer.from("x"), { password: "pw" });
    assert.throws(
      () => decryptBackupPayload(encrypted),
      /Entschl(ü|u)sselung erfordert ein Passwort oder UWE_BACKUP_ENCRYPTION_KEY\./,
    );
  });
});

describe("env key precedence over password", () => {
  it("uses the env key even when a password is also supplied", () => {
    setEnvKey(HEX_KEY_A);
    const plaintext = Buffer.from("precedence", "utf8");

    // Both env key and password provided -> env key wins (no scrypt salt).
    const encrypted = encryptBackupPayload(plaintext, { password: "ignored-pw" });
    assert.equal(parsePayload(encrypted).salt, "");

    // Decrypt succeeds with a *wrong* password because the env key takes precedence.
    const decrypted = decryptBackupPayload(encrypted, { password: "totally-wrong" });
    assert.deepEqual(decrypted, plaintext);
  });
});

describe("wrong key / wrong password throws", () => {
  it("wrong hex env key fails decryption", () => {
    setEnvKey(HEX_KEY_A);
    const encrypted = encryptBackupPayload(Buffer.from("secret", "utf8"));

    setEnvKey(HEX_KEY_B);
    assert.throws(
      () => decryptBackupPayload(encrypted),
      /Backup-Entschl(ü|u)sselung fehlgeschlagen/,
    );
  });

  it("wrong password fails decryption", () => {
    const encrypted = encryptBackupPayload(Buffer.from("secret", "utf8"), {
      password: "right-pw",
    });
    assert.throws(
      () => decryptBackupPayload(encrypted, { password: "wrong-pw" }),
      /Backup-Entschl(ü|u)sselung fehlgeschlagen/,
    );
  });
});

describe("tampered payload throws", () => {
  it("throws when the authTag content is altered", () => {
    setEnvKey(HEX_KEY_A);
    const payload = parsePayload(encryptBackupPayload(Buffer.from("tamper-tag", "utf8")));
    payload.authTag = flipFirstByte(payload.authTag);
    assert.throws(
      () => decryptBackupPayload(serializePayload(payload)),
      /Backup-Entschl(ü|u)sselung fehlgeschlagen/,
    );
  });

  it("throws when the IV content is altered", () => {
    setEnvKey(HEX_KEY_A);
    const payload = parsePayload(encryptBackupPayload(Buffer.from("tamper-iv", "utf8")));
    payload.iv = flipFirstByte(payload.iv);
    assert.throws(
      () => decryptBackupPayload(serializePayload(payload)),
      /Backup-Entschl(ü|u)sselung fehlgeschlagen/,
    );
  });

  it("throws 'beschädigt' when the authTag length is wrong", () => {
    setEnvKey(HEX_KEY_A);
    const payload = parsePayload(encryptBackupPayload(Buffer.from("short-tag", "utf8")));
    payload.authTag = Buffer.alloc(8).toString("base64");
    assert.throws(
      () => decryptBackupPayload(serializePayload(payload)),
      /Verschl(ü|u)sseltes Backup ist besch(ä|a)digt\./,
    );
  });

  it("throws 'beschädigt' when the IV length is wrong", () => {
    setEnvKey(HEX_KEY_A);
    const payload = parsePayload(encryptBackupPayload(Buffer.from("short-iv", "utf8")));
    payload.iv = Buffer.alloc(6).toString("base64");
    assert.throws(
      () => decryptBackupPayload(serializePayload(payload)),
      /Verschl(ü|u)sseltes Backup ist besch(ä|a)digt\./,
    );
  });

  it("throws on non-JSON input", () => {
    setEnvKey(HEX_KEY_A);
    assert.throws(
      () => decryptBackupPayload(Buffer.from("not json at all", "utf8")),
      /Verschl(ü|u)sseltes Backup hat ein ung(ü|u)ltiges Format\./,
    );
  });

  it("throws on a JSON payload with an unknown magic/algorithm", () => {
    setEnvKey(HEX_KEY_A);
    const bogus = Buffer.from(
      JSON.stringify({ magic: "nope", algorithm: "aes-256-gcm" }),
      "utf8",
    );
    assert.throws(
      () => decryptBackupPayload(bogus),
      /Verschl(ü|u)sseltes Backup hat ein unbekanntes Format\./,
    );
  });
});

describe("isEncryptedBackupPayload", () => {
  it("returns true for an encrypted payload", () => {
    setEnvKey(HEX_KEY_A);
    const encrypted = encryptBackupPayload(Buffer.from("hello", "utf8"));
    assert.equal(isEncryptedBackupPayload(encrypted), true);
  });

  it("returns false for plaintext bytes", () => {
    assert.equal(isEncryptedBackupPayload(Buffer.from("just some text", "utf8")), false);
  });

  it("returns false for unrelated JSON", () => {
    const json = Buffer.from(JSON.stringify({ hello: "world", magic: "other" }), "utf8");
    assert.equal(isEncryptedBackupPayload(json), false);
  });
});
