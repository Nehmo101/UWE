import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const SCRYPT_SALT_LENGTH = 16;
const ENCRYPTED_MAGIC = "UWE-BACKUP-ENC-v1";

export interface EncryptedBackupPayload {
  magic: typeof ENCRYPTED_MAGIC;
  algorithm: typeof ALGORITHM;
  salt: string;
  iv: string;
  authTag: string;
  ciphertext: string;
}

export function resolveBackupEncryptionKey(password?: string): Buffer | null {
  const envKey = process.env.UWE_BACKUP_ENCRYPTION_KEY?.trim();
  if (envKey) {
    if (/^[0-9a-f]{64}$/i.test(envKey)) {
      return Buffer.from(envKey, "hex");
    }
    return createHash("sha256").update(envKey, "utf8").digest();
  }

  if (password?.trim()) {
    return null;
  }

  return null;
}

function deriveKey(password: string, salt: Buffer): Buffer {
  return scryptSync(password, salt, 32);
}

export function encryptBackupPayload(
  plaintext: Buffer,
  options?: { password?: string },
): Buffer {
  const envKey = resolveBackupEncryptionKey(options?.password);
  const password = options?.password?.trim();

  let key: Buffer;
  let salt: Buffer;

  if (envKey) {
    key = envKey;
    salt = Buffer.alloc(0);
  } else if (password) {
    salt = randomBytes(SCRYPT_SALT_LENGTH);
    key = deriveKey(password, salt);
  } else {
    throw new Error("Backup-Verschlüsselung erfordert ein Passwort oder UWE_BACKUP_ENCRYPTION_KEY.");
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const payload: EncryptedBackupPayload = {
    magic: ENCRYPTED_MAGIC,
    algorithm: ALGORITHM,
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };

  return Buffer.from(JSON.stringify(payload), "utf8");
}

export function decryptBackupPayload(
  encrypted: Buffer,
  options?: { password?: string },
): Buffer {
  let payload: EncryptedBackupPayload;
  try {
    payload = JSON.parse(encrypted.toString("utf8")) as EncryptedBackupPayload;
  } catch {
    throw new Error("Verschlüsseltes Backup hat ein ungültiges Format.");
  }

  if (payload.magic !== ENCRYPTED_MAGIC || payload.algorithm !== ALGORITHM) {
    throw new Error("Verschlüsseltes Backup hat ein unbekanntes Format.");
  }

  const envKey = resolveBackupEncryptionKey(options?.password);
  const password = options?.password?.trim();

  let key: Buffer;
  if (envKey) {
    key = envKey;
  } else if (password) {
    const salt = Buffer.from(payload.salt, "base64");
    key = deriveKey(password, salt);
  } else {
    throw new Error("Entschlüsselung erfordert ein Passwort oder UWE_BACKUP_ENCRYPTION_KEY.");
  }

  const iv = Buffer.from(payload.iv, "base64");
  const authTag = Buffer.from(payload.authTag, "base64");
  const ciphertext = Buffer.from(payload.ciphertext, "base64");

  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error("Verschlüsseltes Backup ist beschädigt.");
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new Error("Backup-Entschlüsselung fehlgeschlagen (falsches Passwort oder beschädigte Datei).");
  }
}

export function isEncryptedBackupPayload(buffer: Buffer): boolean {
  try {
    const parsed = JSON.parse(buffer.toString("utf8")) as Partial<EncryptedBackupPayload>;
    return parsed.magic === ENCRYPTED_MAGIC;
  } catch {
    return false;
  }
}

export function encryptionKeyConfigured(): boolean {
  return Boolean(process.env.UWE_BACKUP_ENCRYPTION_KEY?.trim());
}

export function keysMatch(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}
