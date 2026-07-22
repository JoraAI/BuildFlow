/**
 * BuildFlow - Application-layer encryption (AES-256-GCM)
 *
 * Used by `lib/storage.ts` to encrypt file bytes before they reach the storage
 * provider (Drive / S3 / local), so the provider only ever stores ciphertext.
 *
 * Key model:
 *   - A single env-supplied MASTER_KEY (32 bytes, base64) is the root of trust.
 *   - Per-company data keys are HKDF-derived from the master + companyId salt.
 *     This gives tenant isolation without managing many keys, and centralizes
 *     rotation (rotate the master + re-derive; old ciphertext stays readable
 *     as long as the derivation stays deterministic — see "Rotation" below).
 *
 * Ciphertext layout (Buffer):
 *   [ 1 byte version | 12-byte IV | N-byte ciphertext | 16-byte GCM tag ]
 *
 * Versioning lets us evolve the format without breaking stored files.
 *
 * Rotation strategy (if the master key is ever changed):
 *   - Re-encrypt affected files with the new derived key. Because the format
 *     is provider-agnostic, this is a batch job: read → decrypt(old) →
 *     encrypt(new) → overwrite. No provider migration needed.
 */
import { createCipheriv, createDecipheriv } from 'crypto';
import { env } from '../config/env';
import { logger } from '../config/logger';

const VERSION = 0x01;
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32; // AES-256

// HKDF parameters (RFC 5869) implemented via Node's crypto (hkdf added in 17.0).
// We use a domain-separation info string so derived keys can't be confused with
// keys derived for other purposes from the same master.
const HKDF_INFO = Buffer.from('buildflow/file-encryption/v1', 'utf8');
const HKDF_SALT = Buffer.from('buildflow', 'utf8');

let cachedMasterKey: Buffer | null = null;

/**
 * Resolve the 32-byte master key from env.
 * - Production: requires FILE_ENCRYPTION_MASTER_KEY (base64, 32 bytes).
 * - Dev/test: if absent, derives a deterministic dev key from a fixed seed so
 *   that local ciphertext survives restarts (NOT for production use).
 */
function getMasterKey(): Buffer {
  if (cachedMasterKey) return cachedMasterKey;

  const fromEnv = env.FILE_ENCRYPTION_MASTER_KEY;
  if (fromEnv) {
    const decoded = Buffer.from(fromEnv, 'base64');
    if (decoded.length !== KEY_LEN) {
      throw new Error(
        `FILE_ENCRYPTION_MASTER_KEY must decode to ${KEY_LEN} bytes (got ${decoded.length}). Generate with: openssl rand -base64 32`,
      );
    }
    cachedMasterKey = decoded;
    return cachedMasterKey;
  }

  if (env.NODE_ENV === 'production') {
    throw new Error(
      'FILE_ENCRYPTION_MASTER_KEY is required in production. Generate with: openssl rand -base64 32',
    );
  }

  // Dev/test fallback: deterministic so local files stay readable across restarts.
  logger.warn(
    'FILE_ENCRYPTION_MASTER_KEY not set — using insecure deterministic dev key. Set the env var before production.',
  );
  const seed = Buffer.from('buildflow-dev-master-key-do-not-use-in-prod', 'utf8').subarray(
    0,
    KEY_LEN,
  );
  cachedMasterKey = seed.length === KEY_LEN ? seed : Buffer.concat([seed]).subarray(0, KEY_LEN);
  return cachedMasterKey;
}

/**
 * Derive a per-company AES-256 key from the master via HKDF-SHA256.
 * The same companyId always yields the same key (deterministic), so stored
 * ciphertext stays decryptable across restarts and across nodes.
 */
async function deriveCompanyKey(companyId: string): Promise<Buffer> {
  const master = getMasterKey();
  // Node's hkdf.expand is sync but the Web Crypto-like `crypto.hkdf` is callback-
  // based; use the imperative form via createDiffieHellman-free approach:
  // We use the sync `crypto.hkdf`-equivalent below.
  const { hkdf } = await import('crypto');
  return new Promise<Buffer>((resolve, reject) => {
    hkdf('sha256', master, HKDF_SALT, Buffer.concat([HKDF_INFO, Buffer.from(companyId, 'utf8')]), KEY_LEN, (err, okm) => {
      if (err) return reject(err);
      resolve(Buffer.from(okm));
    });
  });
}

/**
 * Encrypt a plaintext Buffer for a given company. Returns the versioned
 * envelope Buffer (version | iv | ciphertext | tag). Safe to store anywhere.
 */
export async function encryptForCompany(companyId: string, plaintext: Buffer): Promise<Buffer> {
  const key = await deriveCompanyKey(companyId);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from([VERSION]), iv, ct, tag]);
}

/**
 * Decrypt a versioned envelope Buffer for a given company.
 * Throws if the version is unknown or the auth tag is invalid (tamper/​wrong key).
 */
export async function decryptForCompany(companyId: string, envelope: Buffer): Promise<Buffer> {
  if (envelope.length < 1 + IV_LEN + TAG_LEN) {
    throw new Error('Ciphertext too short — corrupted or not a BuildFlow file envelope');
  }
  const version = envelope[0];
  if (version !== VERSION) {
    throw new Error(`Unsupported ciphertext version: ${version}`);
  }
  const iv = envelope.subarray(1, 1 + IV_LEN);
  const tag = envelope.subarray(envelope.length - TAG_LEN);
  const ct = envelope.subarray(1 + IV_LEN, envelope.length - TAG_LEN);

  const key = await deriveCompanyKey(companyId);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

/**
 * Returns true if the master key is configured (not using the dev fallback).
 * Useful for surfacing a banner in the admin UI.
 */
export function isEncryptionConfigured(): boolean {
  return Boolean(env.FILE_ENCRYPTION_MASTER_KEY);
}

// ── internal: tiny randomBytes shim so tests can stub deterministically if needed
function randomBytes(n: number): Buffer {
  const { randomFillSync } = require('crypto') as { randomFillSync: (b: Buffer) => Buffer };
  const buf = Buffer.alloc(n);
  return randomFillSync(buf);
}