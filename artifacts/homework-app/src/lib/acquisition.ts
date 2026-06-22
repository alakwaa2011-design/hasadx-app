const STORAGE_KEY = "_acq";

interface AcquisitionData {
  source: string;
  medium: string;
  campaign: string;
  referrer: string;
}

function detectSourceFromReferrer(referrer: string): { source: string; medium: string } {
  if (!referrer) return { source: "direct", medium: "direct" };
  try {
    const url = new URL(referrer);
    const host = url.hostname.replace(/^www\./, "");
    if (host.includes("google")) return { source: "google", medium: "organic" };
    if (host.includes("facebook") || host.includes("fb.com")) return { source: "facebook", medium: "social" };
    if (host.includes("instagram")) return { source: "instagram", medium: "social" };
    if (host.includes("twitter") || host.includes("t.co") || host.includes("x.com")) return { source: "twitter", medium: "social" };
    if (host.includes("whatsapp") || host.includes("wa.me")) return { source: "whatsapp", medium: "social" };
    if (host.includes("youtube")) return { source: "youtube", medium: "social" };
    if (host.includes("tiktok")) return { source: "tiktok", medium: "social" };
    if (host.includes("snapchat")) return { source: "snapchat", medium: "social" };
    if (host.includes("telegram")) return { source: "telegram", medium: "social" };
    if (host.includes("linkedin")) return { source: "linkedin", medium: "social" };
    return { source: host, medium: "referral" };
  } catch {
    return { source: "direct", medium: "direct" };
  }
}

export function captureAcquisition(): void {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(STORAGE_KEY)) return;
    const params = new URLSearchParams(window.location.search);
    const utmSource = params.get("utm_source") ?? "";
    const utmMedium = params.get("utm_medium") ?? "";
    const utmCampaign = params.get("utm_campaign") ?? "";
    const referrer = document.referrer ?? "";
    let source = utmSource;
    let medium = utmMedium;
    if (!source) {
      const detected = detectSourceFromReferrer(referrer);
      source = detected.source;
      medium = medium || detected.medium;
    }
    const data: AcquisitionData = { source, medium, campaign: utmCampaign, referrer };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

export function getAcquisition(): AcquisitionData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AcquisitionData) : null;
  } catch {
    return null;
  }
}

export function clearAcquisition(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
