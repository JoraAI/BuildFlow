import { buildS3ClientConfig } from '../../lib/s3-client';

describe('buildS3ClientConfig', () => {
  it('keeps real AWS on the default endpoint', () => {
    const cfg = buildS3ClientConfig({
      region: 'ap-south-1',
      accessKeyId: 'AKIA',
      secretAccessKey: 'secret',
    });
    expect(cfg.region).toBe('ap-south-1');
    expect(cfg.endpoint).toBeUndefined();
    expect(cfg.requestChecksumCalculation).toBeUndefined();
    expect(cfg.responseChecksumValidation).toBeUndefined();
    expect(cfg.credentials).toEqual({ accessKeyId: 'AKIA', secretAccessKey: 'secret' });
  });

  it('points a compatible store at a custom endpoint and relaxes checksums', () => {
    const cfg = buildS3ClientConfig({
      region: 'auto',
      endpoint: 'https://abc.r2.cloudflarestorage.com',
      accessKeyId: 'key',
      secretAccessKey: 'secret',
    });
    expect(cfg.endpoint).toBe('https://abc.r2.cloudflarestorage.com');
    expect(cfg.requestChecksumCalculation).toBe('WHEN_REQUIRED');
    expect(cfg.responseChecksumValidation).toBe('WHEN_REQUIRED');
  });
});
