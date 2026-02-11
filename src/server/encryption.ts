import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ENCRYPTION_KEY_HEX = process.env.ENCRYPTION_KEY;

function getValidatedKey(): Buffer {
  if (!ENCRYPTION_KEY_HEX) {
    throw new Error("ENCRYPTION_KEY is not set.");
  }

  if (!/^[0-9a-fA-F]{64}$/.test(ENCRYPTION_KEY_HEX)) {
    throw new Error(
      "ENCRYPTION_KEY must be a 64-character hex string (32 bytes for AES-256-GCM).",
    );
  }

  return Buffer.from(ENCRYPTION_KEY_HEX, "hex");
}

const ENCRYPTION_KEY = getValidatedKey();
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const HEADER_LENGTH = IV_LENGTH + AUTH_TAG_LENGTH;

export function encryptTokenPayload(plaintext: string): Buffer {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, ciphertext]);
}

export function decryptTokenPayload(payload: Buffer): string {
  if (!Buffer.isBuffer(payload) || payload.length < HEADER_LENGTH) {
    throw new Error("Encrypted token payload is invalid.");
  }

  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(IV_LENGTH, HEADER_LENGTH);
  const ciphertext = payload.subarray(HEADER_LENGTH);

  const decipher = createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}
