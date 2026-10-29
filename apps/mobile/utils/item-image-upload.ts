const ITEM_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const;
export type ItemImageType = (typeof ITEM_IMAGE_TYPES)[number];

export function normalizeItemImageType(mime: string | undefined): ItemImageType {
  const value = (mime ?? '').toLowerCase().split(';')[0].trim();
  if (value === 'image/jpg' || value === 'image/pjpeg') return 'image/jpeg';
  if (value === 'image/heif') return 'image/heic';
  if ((ITEM_IMAGE_TYPES as readonly string[]).includes(value)) return value as ItemImageType;
  return 'image/jpeg';
}

/**
 * Web gallery picks are data URLs. Using the URL as a filename exceeds the
 * 255-character upload limit and the request is rejected before storage.
 */
export function itemImageUploadBody(
  uri: string,
  hintedType?: string,
): { contentType: ItemImageType; dataBase64: string } | null {
  const match = /^data:([^;,]+);base64,([\s\S]*)$/i.exec(uri);
  if (!match) return null;
  return {
    contentType: normalizeItemImageType(match[1] || hintedType),
    dataBase64: match[2].replace(/\s/g, ''),
  };
}
