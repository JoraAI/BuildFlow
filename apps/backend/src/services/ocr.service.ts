/**
 * BuildFlow - Server-side OCR (INVENTORY_HORIZONTAL_PLATFORM Phase 8.1).
 *
 * Tesseract.js (eng) turns scanned invoice images (JPG/PNG/WebP) into text that
 * the Phase 7 `extractInvoiceDraft` pipeline can run through the content LLM.
 * The worker + language data are downloaded lazily on first use; never throws —
 * returns the extracted text or an empty string on failure. Exported as a
 * function so tests can mock it (jest.mock) without spinning up Tesseract.
 */
import { logger } from '../config/logger';

export async function ocrImageToText(buffer: Buffer): Promise<string> {
  try {
    const Tesseract = (await import('tesseract.js')).default;
    const { data } = await Tesseract.recognize(buffer, 'eng', {
      logger: (m: { status?: string }) => {
        if (m.status === 'recognizing text') logger.debug('OCR progress');
      },
    });
    return (data.text ?? '').trim();
  } catch (err) {
    logger.warn('OCR failed (non-fatal)', { error: String(err) });
    return '';
  }
}
