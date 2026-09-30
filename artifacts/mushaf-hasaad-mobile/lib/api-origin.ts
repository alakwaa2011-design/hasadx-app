// Native release builds must be configured with the published API origin.
// The Replit development domain is deliberately never baked into a release build.
export const quranApiOrigin = process.env.EXPO_PUBLIC_QURAN_API_ORIGIN
  ?? (__DEV__ && process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : null);
export const privacyUrl = process.env.EXPO_PUBLIC_PRIVACY_URL
  ?? (__DEV__ && process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/privacy` : null);