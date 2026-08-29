import { Resend } from "resend";

const RESEND_CONNECTOR = "resend";
export const EMAIL_FROM = "حصاد | HasaadX <noreply@hasaadx.com>";

let cachedClient: { client: Resend; expiresAt: number } | null = null;

async function fetchConnectorCredentials(): Promise<{ apiKey: string } | null> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken =
    process.env.REPL_IDENTITY
      ? `repl ${process.env.REPL_IDENTITY}`
      : process.env.WEB_REPL_RENEWAL
      ? `depl ${process.env.WEB_REPL_RENEWAL}`
      : null;

  if (!hostname || !xReplitToken) return null;

  try {
    const response = await fetch(
      `https://${hostname}/api/v2/connection?include_secrets=true`,
      { headers: { Accept: "application/json", X_REPLIT_TOKEN: xReplitToken } },
    );
    if (!response.ok) return null;
    const data = (await response.json()) as {
      items?: Array<{
        connector_name?: string;
        id?: string;
        settings?: { api_key?: string; from_email?: string };
      }>;
    };
    const item = data.items?.find(
      (i) =>
        i.connector_name === RESEND_CONNECTOR ||
        i.id?.startsWith("conn_resend_"),
    );
    const apiKey = item?.settings?.api_key;
    return apiKey ? { apiKey } : null;
  } catch {
    return null;
  }
}

async function getResendClient(): Promise<Resend | null> {
  const envKey = process.env.RESEND_API_KEY;
  if (envKey) return new Resend(envKey);

  if (cachedClient && cachedClient.expiresAt > Date.now()) {
    return cachedClient.client;
  }

  const creds = await fetchConnectorCredentials();
  if (!creds) return null;

  const client = new Resend(creds.apiKey);
  cachedClient = { client, expiresAt: Date.now() + 5 * 60 * 1000 };
  return client;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  delivered: boolean;
  reason?: string;
}

export async function sendEmail(
  params: SendEmailParams,
): Promise<SendEmailResult> {
  const client = await getResendClient();
  if (!client) {
    return { delivered: false, reason: "resend_not_configured" };
  }

  try {
    const { error } = await client.emails.send({
      from: EMAIL_FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
    if (error) return { delivered: false, reason: error.message };
    return { delivered: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "send_failed";
    return { delivered: false, reason: msg };
  }
}

export function getAppBaseUrl(): string {
  const canonicalUrl = "https://hasaadx.com";
  const stripTrailingSlash = (value: string) => value.replace(/\/$/, "");
  const isReplitHost = (value: string) => {
    try {
      const hostname = new URL(value).hostname.toLowerCase();
      return hostname === "replit.app" ||
        hostname.endsWith(".replit.app") ||
        hostname === "replit.dev" ||
        hostname.endsWith(".replit.dev");
    } catch {
      return false;
    }
  };

  if (process.env.APP_BASE_URL) {
    const configured = stripTrailingSlash(process.env.APP_BASE_URL.trim());
    return isReplitHost(configured) ? canonicalUrl : configured;
  }
  const domains = process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();
  if (domains) {
    const configured = `https://${domains}`;
    return isReplitHost(configured) ? canonicalUrl : stripTrailingSlash(configured);
  }
  const dev = process.env.REPLIT_DEV_DOMAIN;
  if (dev) return `https://${dev}`;
  return "http://localhost:5000";
}
