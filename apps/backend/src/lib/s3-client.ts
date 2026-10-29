/**
 * Shared S3 client options for AWS S3 and S3-compatible stores (Neon Object
 * Storage, Cloudflare R2, MinIO, Backblaze B2). A custom endpoint switches on
 * the checksum behaviour those stores need for browser presigned uploads.
 * Neon accepts path-style URLs only.
 */
import type { S3ClientConfig } from '@aws-sdk/client-s3';

export interface S3ClientSettings {
  region: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  /** Overrides the Neon auto-detection below. */
  forcePathStyle?: boolean;
}

function endpointHostname(endpoint: string | undefined): string | null {
  if (!endpoint) return null;
  try {
    return new URL(endpoint).hostname;
  } catch {
    return null;
  }
}

export function shouldForcePathStyle(config: S3ClientSettings): boolean {
  if (config.forcePathStyle !== undefined) return config.forcePathStyle;
  const host = endpointHostname(config.endpoint);
  return Boolean(host && (host === 'neon.tech' || host.endsWith('.neon.tech')));
}

export function buildS3ClientConfig(config: S3ClientSettings): S3ClientConfig {
  const customEndpoint = Boolean(config.endpoint);
  const forcePathStyle = shouldForcePathStyle(config);
  return {
    region: config.region,
    ...(config.endpoint ? { endpoint: config.endpoint } : {}),
    ...(forcePathStyle ? { forcePathStyle: true } : {}),
    ...(config.accessKeyId && config.secretAccessKey
      ? {
          credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          },
        }
      : {}),
    // AWS SDK v3 adds checksum headers by default. Neon, R2, and other
    // compatible stores reject browser PUTs that cannot echo those headers.
    // Ask for a checksum only when the service requires one.
    ...(customEndpoint
      ? {
          requestChecksumCalculation: 'WHEN_REQUIRED' as const,
          responseChecksumValidation: 'WHEN_REQUIRED' as const,
        }
      : {}),
  };
}
