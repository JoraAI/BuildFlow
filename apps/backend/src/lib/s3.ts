/**
 * BuildFlow - AWS S3 client + pre-signed URL helpers.
 *
 * Multi-tenant path convention:
 *   s3://{bucket}/{company_id}/{entity_type}/{project_id}/{filename}
 *
 * Credentials resolve per company via integration.service (BYOK) with platform fallback.
 * Platform fallback honours AWS_S3_ENDPOINT for Cloudflare R2 and other compatible stores.
 */
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { resolveS3Config, type S3Config } from '../services/integration.service';
import { buildS3ClientConfig } from './s3-client';

export function buildS3Key(parts: {
  companyId: string;
  entityType: string;
  projectId?: string;
  filename: string;
}): string {
  const segs = [parts.companyId, parts.entityType];
  if (parts.projectId) segs.push(parts.projectId);
  segs.push(parts.filename);
  return segs.join('/');
}

function clientFor(config: S3Config): S3Client {
  return new S3Client(
    buildS3ClientConfig({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    }),
  );
}

async function resolveConfig(companyId: string): Promise<S3Config> {
  const cfg = await resolveS3Config(companyId);
  if (!cfg) {
    throw new Error('S3_NOT_CONFIGURED');
  }
  return cfg;
}

/** True when the object key is under this tenant's prefix and has no path traversal. */
export function isTenantObjectKey(companyId: string, key: string): boolean {
  const normalized = key.replace(/^\/+/, '').replace(/\\/g, '/');
  if (!normalized || normalized.includes('..') || normalized.includes('\0')) return false;
  return normalized === companyId || normalized.startsWith(`${companyId}/`);
}

function assertTenantObjectKey(companyId: string, key: string): void {
  if (!isTenantObjectKey(companyId, key)) {
    throw new Error('S3_KEY_FORBIDDEN');
  }
}

export async function getPresignedUploadUrl(opts: {
  companyId: string;
  key: string;
  contentType: string;
}): Promise<string> {
  assertTenantObjectKey(opts.companyId, opts.key);
  const config = await resolveConfig(opts.companyId);
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: opts.key,
    ContentType: opts.contentType,
  });
  return getSignedUrl(clientFor(config), command, {
    expiresIn: env.S3_PRESIGN_EXPIRY_SECONDS,
  });
}

/** Write bytes with the same tenant client used for presigned URLs. */
export async function putTenantObject(opts: {
  companyId: string;
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<void> {
  assertTenantObjectKey(opts.companyId, opts.key);
  const config = await resolveConfig(opts.companyId);
  await clientFor(config).send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: opts.key,
      Body: opts.body,
      ContentType: opts.contentType,
    }),
  );
}

export async function getPresignedDownloadUrl(opts: {
  companyId: string;
  key: string;
}): Promise<string> {
  assertTenantObjectKey(opts.companyId, opts.key);
  const config = await resolveConfig(opts.companyId);
  const command = new GetObjectCommand({
    Bucket: config.bucket,
    Key: opts.key,
  });
  return getSignedUrl(clientFor(config), command, {
    expiresIn: env.S3_PRESIGN_EXPIRY_SECONDS,
  });
}

export function keyToLogicalUrl(bucket: string, key: string): string {
  return `s3://${bucket}/${key}`;
}

export async function keyToLogicalUrlForCompany(companyId: string, key: string): Promise<string> {
  const config = await resolveConfig(companyId);
  return keyToLogicalUrl(config.bucket, key);
}

/** Parse s3://bucket/key logical URLs (supports any tenant bucket). */
export function logicalUrlToKey(url: string): { bucket: string; key: string } | null {
  if (!url.startsWith('s3://')) {
    logger.warn('Unrecognised file URL format', { url });
    return null;
  }
  const rest = url.slice('s3://'.length);
  const slash = rest.indexOf('/');
  if (slash <= 0) return null;
  return { bucket: rest.slice(0, slash), key: rest.slice(slash + 1) };
}

export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
] as const;

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
