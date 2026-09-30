import { Resend } from "resend";
import { ReplitConnectors } from "@replit/connectors-sdk";

export const EMAIL_FROM = "حصاد | HasaadX <noreply@hasaadx.com>";

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
  try {
    const message = {
      from: EMAIL_FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    };

    // A directly configured key remains supported, but connected credentials
    // are intentionally not exposed through the integration's settings object.
    if (process.env.RESEND_API_KEY) {
      const { data, error } = await new Resend(process.env.RESEND_API_KEY).emails.send(message);
      if (error) return { delivered: false, reason: error.message };
      return data?.id
        ? { delivered: true }
        : { delivered: false, reason: "resend_missing_message_id" };
    }

    const response = await new ReplitConnectors().proxy("resend", "/emails", {
      method: "POST",
      body: message,
    });
    if (!response.ok) {
      return { delivered: false, reason: `resend_proxy_http_${response.status}` };
    }
    const data = await response.json() as { id?: unknown };
    if (typeof data?.id !== "string" || !data.id) {
      return { delivered: false, reason: "resend_missing_message_id" };
    }
    return { delivered: true };
  } catch (err) {
    // Avoid recording connector exceptions, which may include request details.
    return { delivered: false, reason: "resend_send_failed" };
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
