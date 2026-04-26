import { UAParser } from "ua-parser-js";

export type DeviceType = "mobile" | "tablet" | "desktop";

export interface ParsedUserAgent {
  browser: string | null;
  os: string | null;
  deviceType: DeviceType | null;
  deviceModel: string | null;
}

export function parseUserAgent(ua: string | null | undefined): ParsedUserAgent {
  if (!ua || ua === "unknown") {
    return { browser: null, os: null, deviceType: null, deviceModel: null };
  }
  const parser = new UAParser(ua);
  const result = parser.getResult();

  const browserName = result.browser?.name || null;
  const osName = result.os?.name || null;

  const rawType = result.device?.type;
  let deviceType: DeviceType;
  if (rawType === "mobile" || rawType === "wearable") deviceType = "mobile";
  else if (rawType === "tablet") deviceType = "tablet";
  else deviceType = "desktop";

  const vendor = result.device?.vendor;
  const model = result.device?.model;
  let deviceModel: string | null = null;
  if (vendor && model) deviceModel = `${vendor} ${model}`;
  else if (model) deviceModel = model;
  else if (vendor) deviceModel = vendor;

  // Default model labels for desktop platforms when UA doesn't expose one.
  if (!deviceModel) {
    if (deviceType === "desktop") {
      if (osName === "Mac OS" || osName === "macOS") deviceModel = "Mac";
      else if (osName === "Windows") deviceModel = "PC";
    } else if (deviceType === "mobile") {
      if (osName === "iOS") deviceModel = "iPhone";
      else if (osName === "Android") deviceModel = "Android phone";
    } else if (deviceType === "tablet") {
      if (osName === "iOS") deviceModel = "iPad";
    }
  }

  return {
    browser: browserName,
    os: osName,
    deviceType,
    deviceModel,
  };
}

interface GeoCacheEntry {
  location: string | null;
  expiresAt: number;
}

const GEO_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const GEO_NEGATIVE_TTL_MS = 10 * 60 * 1000; // 10m for failures
const GEO_LOOKUP_TIMEOUT_MS = 1500;
const geoCache = new Map<string, GeoCacheEntry>();

function normalizeIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = String(raw).replace(/%.*$/, "").replace(/^::ffff:/i, "").trim();
  if (!cleaned) return null;
  return cleaned;
}

function isPrivateOrLocalIp(ip: string): boolean {
  if (ip === "unknown" || ip === "::1" || ip === "127.0.0.1") return true;
  // IPv4 private/reserved ranges
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  }
  // IPv6 unique-local / link-local
  const lower = ip.toLowerCase();
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  if (lower.startsWith("fe80")) return true;
  return false;
}

export async function lookupIpLocation(
  rawIp: string | null | undefined,
): Promise<string | null> {
  const ip = normalizeIp(rawIp);
  if (!ip) return null;
  if (isPrivateOrLocalIp(ip)) return null;

  const cached = geoCache.get(ip);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.location;
  }

  let location: string | null = null;
  let ttl = GEO_NEGATIVE_TTL_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEO_LOOKUP_TIMEOUT_MS);
  try {
    const url = `https://ipapi.co/${encodeURIComponent(ip)}/json/`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "hasad-platform/1.0 (sessions)" },
    });
    if (res.ok) {
      const raw: unknown = await res.json();
      const data = (raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null);
      const hasError = data ? data.error === true || typeof data.error === "string" : false;
      if (data && !hasError) {
        const cityRaw = data.city;
        const countryRaw = data.country_name;
        const city = typeof cityRaw === "string" ? cityRaw.trim() : "";
        const country = typeof countryRaw === "string" ? countryRaw.trim() : "";
        if (city && country) location = `${city}, ${country}`;
        else if (country) location = country;
        else if (city) location = city;
        if (location) ttl = GEO_TTL_MS;
      }
    }
  } catch {
    location = null;
  } finally {
    clearTimeout(timer);
  }

  geoCache.set(ip, { location, expiresAt: Date.now() + ttl });
  return location;
}

export async function lookupIpLocations(
  ips: Array<string | null | undefined>,
): Promise<Map<string, string | null>> {
  const unique = Array.from(
    new Set(
      ips
        .map((ip) => normalizeIp(ip))
        .filter((ip): ip is string => !!ip),
    ),
  );
  const entries = await Promise.all(
    unique.map(async (ip) => [ip, await lookupIpLocation(ip)] as const),
  );
  return new Map(entries);
}
