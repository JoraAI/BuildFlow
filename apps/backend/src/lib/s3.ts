/**
 * BuildFlow — AWS S3 client + pre-signed URL helpers.
 *
 * Multi-tenant path convention:
 *   s3://{bucket}/{company_id}/{entity_type}/{project_id}/{filename}
 */
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env';
import { logger } from '../config/logger';

export const s3Client = new S3Client({
  region: env.AWS_REGION,
  ...(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
    ? {
        credentials: {
          accessKeyId: env.AWS_ACCESS_KEY_ID,
          secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        },
      }
    : {}),
});

/**
 * Build the canonical S3 key for a tenant-scoped upload.
 */
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

/**
 * Generate a short-lived pre-signed PUT URL for a client-side upload.
 * Expires in S3_PRESIGN_EXPIRY_SECONDS (default 15 minutes).
 */
export async function getPresignedUploadUrl(opts: {
  key: string;
  contentType: string;
}): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: env.AWS_S3_BUCKET,
    Key: opts.key,
    ContentType: opts.contentType,
  });
  return getSignedUrl(s3Client, command, {
    expiresIn: env.S3_PRESIGN_EXPIRY_SECONDS,
  });
}

/**
 * Generate a short-lived pre-signed GET URL for downloads/viewing.
 */
export async function getPresignedDownloadUrl(opts: { key: string }): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: env.AWS_S3_BUCKET,
    Key: opts.key,
  });
  return getSignedUrl(s3Client, command, {
    expiresIn: env.S3_PRESIGN_EXPIRY_SECONDS,
  });
}

/**
 * Convert an S3 key to a stable logical URL stored in DB.
 * We store keys (not signed URLs) because signed URLs expire.
 * The frontend resolves keys to signed GET URLs via the API.
 */
export function keyToLogicalUrl(key: string): string {
  return `s3://${env.AWS_S3_BUCKET}/${key}`;
}

export function logicalUrlToKey(url: string): string | null {
  const prefix = `s3://${env.AWS_S3_BUCKET}/`;
  if (!url.startsWith(prefix)) {
    logger.warn('Unrecognised file URL format', { url });
    return null;
  }
  return url.slice(prefix.length);
}

/**
 * Allowed MIME types for uploads.
 */
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
] as const;

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB