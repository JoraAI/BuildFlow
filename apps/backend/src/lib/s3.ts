/**
 * BuildFlow - AWS S3 client + pre-signed URL helpers.
 *
 * Multi-tenant path convention:
 *   s3://{bucket}/{company_id}/{entity_type}/{project_id}/{filename}
 *
 * Credentials resolve per company via integration.service (BYOK) with platform fallback.
 */
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { resolveS3Config, type S3Config } from '../services/integration.service';

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
  return new S3Client({
    region: config.region,
    ...(config.accessKeyId && config.secretAccessKey
      ? {
          credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          },
        }
      : {}),
  });
}

async function resolveConfig(companyId: string): Promise<S3Config> {
  const cfg = await resolveS3Config(companyId);
  if (!cfg) {
    throw new Error('S3_NOT_CONFIGURED');
  }
  return cfg;
}

export async function getPresignedUploadUrl(opts: {
  companyId: string;
  key: string;
  contentType: string;
}): Promise<string> {
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

export async function getPresignedDownloadUrl(opts: {
  companyId: string;
  key: string;
}): Promise<string> {
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
