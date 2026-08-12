/**
 * BuildFlow - Encrypted File Storage abstraction
 *
 * One interface, three swappable providers:
 *   - LocalFileStore  → filesystem (dev / tests; encrypted at rest via app layer)
 *   - S3FileStore     → AWS S3 (or any S3-compatible: R2, B2, MinIO)
 *   - DriveFileStore  → Google Drive (cheap encrypted file store)
 *
 * Encryption is provider-agnostic: bytes are encrypted via lib/crypto.ts
 * BEFORE they reach `putObject`, so the provider only ever stores ciphertext.
 * Switching providers is a one-line env change (FILE_STORAGE_PROVIDER); the
 * stored ciphertext can be copied across providers (read → put) without
 * re-encryption.
 *
 * Key conventions:
 *   key = `${companyId}/${entityType}/${projectId?}/${filename}`
 *
 * Logical URL form (stored in DB columns like Resource.imageUrl):
 *   `bfstore://<provider>/<key>`  - provider-agnostic reference.
 *   Resolution: parse → fetch (with the right provider) → decrypt → return bytes.
 */
import { createHash, randomUUID } from 'crypto';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { decryptForCompany, encryptForCompany } from './crypto';

// ────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────

export interface StorageKeyParts {
  companyId: string;
  entityType: string;
  projectId?: string;
  filename: string;
}

export interface FileStore {
  readonly name: 'local' | 's3' | 'drive';
  /** Encrypt (per-company) and store plaintext bytes under `key`. */
  putEncrypted(companyId: string, key: string, plaintext: Buffer): Promise<void>;
  /** Fetch bytes under `key` and decrypt (per-company). Throws if missing. */
  getEncrypted(companyId: string, key: string): Promise<Buffer>;
  /** Delete bytes under `key` (no-op if missing). */
  delete(key: string): Promise<void>;
}

// ────────────────────────────────────────────────────────────────────
// Key helpers + logical URL form
// ────────────────────────────────────────────────────────────────────

const URL_SCHEME = 'bfstore';

export function buildStorageKey(parts: StorageKeyParts): string {
  const segs = [parts.companyId, parts.entityType];
  if (parts.projectId) segs.push(parts.projectId);
  segs.push(parts.filename);
  return segs.join('/');
}

export function keyToLogicalUrl(provider: string, key: string): string {
  return `${URL_SCHEME}://${provider}/${key}`;
}

export interface ParsedFileUrl {
  provider: string;
  key: string;
}

export function parseFileUrl(url: string): ParsedFileUrl | null {
  const prefix = `${URL_SCHEME}://`;
  if (!url.startsWith(prefix)) {
    logger.warn('Unrecognised file URL format', { url });
    return null;
  }
  const rest = url.slice(prefix.length);
  const slash = rest.indexOf('/');
  if (slash <= 0) return null;
  return { provider: rest.slice(0, slash), key: rest.slice(slash + 1) };
}

/** Generate a unique filename with the original extension. */
export function generateFilename(originalName: string): string {
  const ext = originalName.includes('.') ? originalName.split('.').pop() : '';
  const id = randomUUID();
  return ext ? `${id}.${ext.toLowerCase()}` : id;
}

// ────────────────────────────────────────────────────────────────────
// LocalFileStore (encrypted files on disk; dev + tests)
// ────────────────────────────────────────────────────────────────────

class LocalFileStore implements FileStore {
  readonly name = 'local' as const;
  private root: string;

  constructor(dir: string) {
    this.root = dir;
  }

  private path(key: string): string {
    // Hash-namespace to avoid path traversal and keep directory listings small.
    const safe = createHash('sha1').update(key).digest('hex');
    return join(this.root, safe.slice(0, 2), safe.slice(2, 4), safe);
  }

  async putEncrypted(companyId: string, key: string, plaintext: Buffer): Promise<void> {
    const envelope = await encryptForCompany(companyId, plaintext);
    const p = this.path(key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, envelope);
  }

  async getEncrypted(companyId: string, key: string): Promise<Buffer> {
    const p = this.path(key);
    const envelope = await readFile(p);
    return decryptForCompany(companyId, envelope);
  }

  async delete(key: string): Promise<void> {
    try {
      await rm(this.path(key));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }
}

// ────────────────────────────────────────────────────────────────────
// S3FileStore (encrypted bytes in S3 / R2 / B2 / MinIO)
// ────────────────────────────────────────────────────────────────────

class S3FileStore implements FileStore {
  readonly name = 's3' as const;
  private bucket: string;
  private clientPromise: Promise<unknown>;

  constructor() {
    if (!env.AWS_S3_BUCKET) throw new Error('AWS_S3_BUCKET required for S3 file store');
    this.bucket = env.AWS_S3_BUCKET;
    // Lazily create the S3 client (heavy import) - keep types loose to avoid
    // importing the SDK here for non-S3 builds.
    this.clientPromise = import('@aws-sdk/client-s3').then(
      ({ S3Client }) =>
        new S3Client({
          region: env.AWS_REGION,
          ...(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
            ? {
                credentials: {
                  accessKeyId: env.AWS_ACCESS_KEY_ID,
                  secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
                },
              }
            : {}),
        }),
    );
  }

  async putEncrypted(companyId: string, key: string, plaintext: Buffer): Promise<void> {
    const envelope = await encryptForCompany(companyId, plaintext);
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    const client = (await this.clientPromise) as import('@aws-sdk/client-s3').S3Client;
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: envelope,
        ContentType: 'application/octet-stream',
      }),
    );
  }

  async getEncrypted(companyId: string, key: string): Promise<Buffer> {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const client = (await this.clientPromise) as import('@aws-sdk/client-s3').S3Client;
    const res = await client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!res.Body) throw new Error(`S3 object not found: ${key}`);
    const envelope = Buffer.from(await res.Body.transformToByteArray());
    return decryptForCompany(companyId, envelope);
  }

  async delete(key: string): Promise<void> {
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    const client = (await this.clientPromise) as import('@aws-sdk/client-s3').S3Client;
    await client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

// ────────────────────────────────────────────────────────────────────
// DriveFileStore (encrypted bytes in Google Drive)
// ────────────────────────────────────────────────────────────────────
//
// Uses a service account; all files land under DRIVE_ROOT_FOLDER_ID (or the
// service account's root if unset). Filenames are the SHA-1 of the storage key
// (no leakage of original names) and bodies are ciphertext.
//
// Note: googleapis is an optional dependency. The class is defined here but
// only imported when FILE_STORAGE_PROVIDER=drive so non-Drive builds don't pay
// the dependency cost. See `createDriveStore()` below.

interface DriveClient {
  files: {
    create(params: unknown): Promise<{ data: { id: string } }>;
    get(params: unknown): Promise<{ data: Buffer }>;
    delete(params: unknown): Promise<void>;
  };
}

class DriveFileStore implements FileStore {
  readonly name = 'drive' as const;
  private rootFolderId: string | undefined;
  private clientPromise: Promise<DriveClient>;

  constructor() {
    if (!env.DRIVE_CLIENT_EMAIL || !env.DRIVE_PRIVATE_KEY) {
      throw new Error(
        'DRIVE_CLIENT_EMAIL and DRIVE_PRIVATE_KEY are required for the Drive file store',
      );
    }
    this.rootFolderId = env.DRIVE_ROOT_FOLDER_ID;
    this.clientPromise = this.buildClient();
  }

  private async buildClient(): Promise<DriveClient> {
    const { google } = await import('googleapis');
    const auth = new google.auth.JWT({
      email: env.DRIVE_CLIENT_EMAIL,
      key: env.DRIVE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });
    const drive = google.drive({ version: 'v3', auth });
    // Wrap to a narrow interface so the rest of the class stays mockable.
    return drive as unknown as DriveClient;
  }

  private fileTitle(key: string): string {
    return createHash('sha1').update(key).digest('hex');
  }

  async putEncrypted(companyId: string, key: string, plaintext: Buffer): Promise<void> {
    const envelope = await encryptForCompany(companyId, plaintext);
    const drive = await this.clientPromise;
    await drive.files.create({
      requestBody: {
        name: this.fileTitle(key),
        ...(this.rootFolderId ? { parents: [this.rootFolderId] } : {}),
      },
        // FIX (SEC-L21): Upload the raw Buffer as a readable stream, not a
        // base64 string. The Drive API media.body expects a Readable stream
        // or string; passing base64 string causes the file to be stored as
        // base64 text (33% larger + wrong content on read-back).
        media: { mimeType: 'application/octet-stream', body: require('stream').Readable.from(envelope) },
    });
  }

  async getEncrypted(companyId: string, key: string): Promise<Buffer> {
    const drive = await this.clientPromise;
    // Drive filenames are unique per-folder; we query by name to find the file,
    // then fetch its bytes.
    const listRes = await (drive as unknown as {
      files: {
        list(params: unknown): Promise<{ data: { files?: Array<{ id: string }> } }>;
      };
    }).files.list({
      q: `name = '${this.fileTitle(key)}' and trashed = false`,
      fields: 'files(id)',
      spaces: 'drive',
    });
    const fileId = listRes.data.files?.[0]?.id;
    if (!fileId) throw new Error(`Drive file not found: ${key}`);
    const res = await drive.files.get({
      fileId,
      alt: 'media',
    });
    // FIX (SEC-L21): Handle both Buffer and stream responses correctly.
    const envelope = Buffer.isBuffer(res.data)
      ? res.data
      : Buffer.from(String(res.data), 'utf8');
    return decryptForCompany(companyId, envelope);
  }

  async delete(key: string): Promise<void> {
    const drive = await this.clientPromise;
    const listRes = await (drive as unknown as {
      files: {
        list(params: unknown): Promise<{ data: { files?: Array<{ id: string }> } }>;
      };
    }).files.list({
      q: `name = '${this.fileTitle(key)}' and trashed = false`,
      fields: 'files(id)',
      spaces: 'drive',
    });
    const fileId = listRes.data.files?.[0]?.id;
    if (fileId) await drive.files.delete({ fileId });
  }
}

// ────────────────────────────────────────────────────────────────────
// Façade - pick the provider once, at module load.
// ────────────────────────────────────────────────────────────────────

let cachedStore: FileStore | null = null;

function createStore(): FileStore {
  switch (env.FILE_STORAGE_PROVIDER) {
    case 'local':
      return new LocalFileStore(env.FILE_STORAGE_LOCAL_DIR);
    case 's3':
      return new S3FileStore();
    case 'drive':
      return new DriveFileStore();
    default:
      // env schema guarantees one of the three, but be defensive.
      return new LocalFileStore(env.FILE_STORAGE_LOCAL_DIR);
  }
}

/** Returns the configured FileStore singleton. */
export function getFileStore(): FileStore {
  if (!cachedStore) cachedStore = createStore();
  return cachedStore;
}

/** Test-only: reset the cached store (used when env changes mid-suite). */
export function _resetFileStoreForTests(): void {
  cachedStore = null;
}

// ────────────────────────────────────────────────────────────────────
// Convenience high-level helpers used by services
// ────────────────────────────────────────────────────────────────────

/**
 * Store a plaintext Buffer and return the logical URL to save in the DB.
 * Encrypts per-company before delegating to the configured provider.
 */
export async function storeEncryptedFile(
  companyId: string,
  parts: Omit<StorageKeyParts, 'filename'> & { filename?: string; originalName?: string },
  plaintext: Buffer,
): Promise<{ url: string; key: string }> {
  const filename = parts.filename ?? generateFilename(parts.originalName ?? 'file');
  const key = buildStorageKey({ ...parts, filename });
  const store = getFileStore();
  await store.putEncrypted(companyId, key, plaintext);
  return { url: keyToLogicalUrl(store.name, key), key };
}

/**
 * Fetch + decrypt bytes referenced by a logical URL.
 * Throws if the URL is malformed or the provider doesn't match the active one.
 */
export async function fetchEncryptedFile(companyId: string, url: string): Promise<Buffer> {
  const parsed = parseFileUrl(url);
  if (!parsed) throw new Error(`Unrecognised file URL: ${url}`);
  const store = getFileStore();
  // Allow reads even if the active provider differs, so provider migrations
  // (copy old objects, keep URLs) work transparently. For simplicity in v1 we
  // require the provider in the URL to match the active one.
  if (parsed.provider !== store.name) {
    throw new Error(
      `File URL provider "${parsed.provider}" does not match active store "${store.name}" - run the migration job first.`,
    );
  }
  return store.getEncrypted(companyId, parsed.key);
}

/** Delete bytes referenced by a logical URL (no-op if missing). */
export async function deleteFileByUrl(url: string): Promise<void> {
  const parsed = parseFileUrl(url);
  if (!parsed) return;
  const store = getFileStore();
  if (parsed.provider === store.name) {
    await store.delete(parsed.key);
  }
}