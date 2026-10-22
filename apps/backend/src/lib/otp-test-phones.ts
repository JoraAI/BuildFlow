/**
 * Numbers that must never hit MSG91/Twilio (no wallet debit).
 * Compare on last 10 digits so +91 / 91 / 0 prefixes all match.
 */
export function phoneLast10(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

export function parseOtpTestPhones(raw?: string | null): Set<string> {
  if (!raw?.trim()) return new Set();
  return new Set(
    raw
      .split(/[,\s]+/)
      .map((part) => phoneLast10(part))
      .filter((part) => part.length >= 10),
  );
}

export function isOtpTestPhone(raw: string, listRaw?: string | null): boolean {
  const key = phoneLast10(raw);
  if (key.length < 10) return false;
  return parseOtpTestPhones(listRaw).has(key);
}
