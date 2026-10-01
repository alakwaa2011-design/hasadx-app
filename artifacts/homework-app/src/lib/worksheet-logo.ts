/** Only replace our own opaque brand assets; never alter a school's uploaded logo. */
export function worksheetLogoUrl(value?: string): string | undefined {
  if (!value) return value;
  const base = import.meta.env.BASE_URL || "/";
  try {
    const url = new URL(value, window.location.href);
    if (url.origin !== window.location.origin) return value;
    if (url.pathname === `${base}images/logo-hasaad.png`) {
      return `${base}images/logo-hasaad-transparent.png`;
    }
    if ([`${base}images/logo-icon.png`, `${base}images/logo-mark.png`].includes(url.pathname)) {
      return `${base}images/logo-mark-transparent.png`;
    }
  } catch {
    return value;
  }
  return value;
}