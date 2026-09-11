const URL_SCHEME = /^[a-z][a-z\d+\-.]*:\/\//i;
const NON_WEB_URL_SCHEME = /^(?:mailto|tel|sms):/i;
const DOMAIN_LIKE = /^(?:www\.)?[^/\s]+\.[^/\s]+(?:[/?#]|$)/i;

/**
 * Keep text payloads as Unicode. Only add a scheme to a bare web address so
 * scanners and phones can recognize it as a link; never URL-encode the QR
 * payload itself.
 */
export function prepareQrValue(rawValue: string): string {
  if (!rawValue.trim()) return "";

  const trimmedValue = rawValue.trim();
  if (
    URL_SCHEME.test(trimmedValue) ||
    NON_WEB_URL_SCHEME.test(trimmedValue) ||
    DOMAIN_LIKE.test(trimmedValue)
  ) {
    return URL_SCHEME.test(trimmedValue) || NON_WEB_URL_SCHEME.test(trimmedValue)
      ? trimmedValue
      : `https://${trimmedValue}`;
  }

  return rawValue;
}