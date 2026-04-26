import { Resend } from "resend";

const RESEND_CONNECTOR = "resend";

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
      `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=${RESEND_CONNECTOR}`,
      { headers: { Accept: "application/json", X_REPLIT_TOKEN: xReplitToken } },
    );
    if (!response.ok) return null;
    const data = (await response.json()) as {
      items?: Array<{ settings?: { api_key?: string } }>;
    };
    const apiKey = data.items?.[0]?.settings?.api_key;
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

  const from =
    process.env.RESEND_FROM_EMAIL || "Hassad <onboarding@resend.dev>";

  try {
    const { error } = await client.emails.send({
      from,
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
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, "");
  const domains = process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();
  if (domains) return `https://${domains}`;
  const dev = process.env.REPLIT_DEV_DOMAIN;
  if (dev) return `https://${dev}`;
  return "http://localhost:5000";
}
