/**
 * Unit tests for the encrypted file-store abstraction.
 *
 * Covers:
 *  - AES-256-GCM encrypt/decrypt round-trip (same companyId).
 *  - Tenant isolation: a file encrypted for company A cannot be decrypted
 *    with company B's derived key.
 *  - Tamper detection (flipping a ciphertext byte throws on decrypt).
 *  - LocalFileStore end-to-end: storeEncryptedFile → fetchEncryptedFile.
 */
import { encryptForCompany, decryptForCompany } from '../../lib/crypto';
import {
  buildStorageKey,
  fetchEncryptedFile,
  storeEncryptedFile,
  parseFileUrl,
  keyToLogicalUrl,
  getFileStore,
  _resetFileStoreForTests,
} from '../../lib/storage';

const COMPANY_A = '00000000-0000-0000-0000-000000000001';
const COMPANY_B = '00000000-0000-0000-0000-000000000002';

describe('encryption (lib/crypto)', () => {
  it('round-trips plaintext for the same company', async () => {
    const plaintext = Buffer.from('BuildFlow tender document - confidential', 'utf8');
    const envelope = await encryptForCompany(COMPANY_A, plaintext);
    // Envelope must be larger than plaintext (version + iv + tag overhead).
    expect(envelope.length).toBeGreaterThan(plaintext.length);
    const recovered = await decryptForCompany(COMPANY_A, envelope);
    expect(recovered.equals(plaintext)).toBe(true);
  });

  it('produces a different envelope each time (random IV)', async () => {
    const plaintext = Buffer.from('same input', 'utf8');
    const [e1, e2] = await Promise.all([
      encryptForCompany(COMPANY_A, plaintext),
      encryptForCompany(COMPANY_A, plaintext),
    ]);
    expect(e1.equals(e2)).toBe(false);
    // ...but both decrypt to the same plaintext.
    expect((await decryptForCompany(COMPANY_A, e1)).equals(plaintext)).toBe(true);
    expect((await decryptForCompany(COMPANY_A, e2)).equals(plaintext)).toBe(true);
  });

  it('isolates tenants: company B cannot decrypt company A file', async () => {
    const plaintext = Buffer.from('secret for A', 'utf8');
    const envelope = await encryptForCompany(COMPANY_A, plaintext);
    await expect(decryptForCompany(COMPANY_B, envelope)).rejects.toThrow();
  });

  it('detects tampering (auth tag failure)', async () => {
    const plaintext = Buffer.from('original', 'utf8');
    const envelope = await encryptForCompany(COMPANY_A, plaintext);
    // Flip a byte in the ciphertext region (after version+iv).
    const tampered = Buffer.from(envelope);
    tampered[tampered.length - 17] ^= 0x01; // flip a byte just before the tag
    await expect(decryptForCompany(COMPANY_A, tampered)).rejects.toThrow();
  });

  it('rejects an unsupported envelope version', async () => {
    const envelope = await encryptForCompany(COMPANY_A, Buffer.from('x'));
    envelope[0] = 0xff; // unknown version
    await expect(decryptForCompany(COMPANY_A, envelope)).rejects.toThrow(/version/i);
  });
});

describe('LocalFileStore (lib/storage)', () => {
  beforeAll(() => {
    // The LocalFileStore uses env.FILE_STORAGE_LOCAL_DIR at construction time
    // (defaults to `./.filestore`). We can't easily swap env here, so we
    // exercise the store via its public helpers using the configured provider
    // (local by default in tests) and reset the cached singleton first.
    _resetFileStoreForTests();
  });

  it('stores and retrieves an encrypted file end-to-end', async () => {
    const plaintext = Buffer.from('tender-v1.pdf bytes', 'utf8');
    const { url, key } = await storeEncryptedFile(
      COMPANY_A,
      { companyId: COMPANY_A, entityType: 'tender', projectId: 'p1', originalName: 'tender.pdf' },
      plaintext,
    );

    // URL form is provider-agnostic
    expect(url.startsWith('bfstore://')).toBe(true);
    const parsed = parseFileUrl(url);
    expect(parsed?.provider).toBe(getFileStore().name);
    expect(parsed?.key).toBe(key);
    expect(key).toContain(COMPANY_A);
    expect(key).toContain('tender');

    const recovered = await fetchEncryptedFile(COMPANY_A, url);
    expect(recovered.equals(plaintext)).toBe(true);
  });

  it('isolation: a file stored under company A cannot be read as company B', async () => {
    const plaintext = Buffer.from('private to A', 'utf8');
    const { url } = await storeEncryptedFile(
      COMPANY_A,
      { companyId: COMPANY_A, entityType: 'bill', originalName: 'b.pdf' },
      plaintext,
    );
    await expect(fetchEncryptedFile(COMPANY_B, url)).rejects.toThrow();
  });

  it('deleteFileByUrl removes the object (idempotent)', async () => {
    const { url } = await storeEncryptedFile(
      COMPANY_A,
      { companyId: COMPANY_A, entityType: 'tmp', originalName: 'x.bin' },
      Buffer.from('bye'),
    );
    // Deleting twice must not throw.
    const { deleteFileByUrl } = await import('../../lib/storage');
    await deleteFileByUrl(url);
    await expect(deleteFileByUrl(url)).resolves.toBeUndefined();
    await expect(fetchEncryptedFile(COMPANY_A, url)).rejects.toThrow();
  });

  it('keyToLogicalUrl + parseFileUrl round-trip', () => {
    const key = buildStorageKey({
      companyId: COMPANY_A,
      entityType: 'bill',
      projectId: 'p',
      filename: 'abc.pdf',
    });
    const url = keyToLogicalUrl('drive', key);
    const parsed = parseFileUrl(url);
    expect(parsed?.provider).toBe('drive');
    expect(parsed?.key).toBe(key);
  });

  it('parseFileUrl returns null for foreign/​malformed URLs', () => {
    expect(parseFileUrl('https://example.com/x')).toBeNull();
    expect(parseFileUrl('bfstore://nomatch')).toBeNull();
  });
});