import crypto from "node:crypto";

export type WhatsAppSendResult =
  { sent: false; mode: "dry_run" };

/**
 * Deliberately isolated from the rest of the application. This first phase is
 * hard-locked to dry-run: it has no outbound HTTP implementation and remains
 * unable to send even if future-looking environment variables are populated.
 */
export class PersonalAssistantWhatsAppClient {
  constructor(_env: NodeJS.ProcessEnv = process.env) {}

  isOutboundEnabled(): boolean {
    return false;
  }

  async sendText(_to: string, _body: string): Promise<WhatsAppSendResult> {
    return { sent: false, mode: "dry_run" };
  }
}

export function verifyWhatsAppSignature(
  rawBody: Buffer,
  signature: string | undefined,
  appSecret: string | undefined,
): boolean {
  if (!signature || !appSecret) return false;
  const match = /^sha256=([a-f0-9]{64})$/i.exec(signature.trim());
  if (!match) return false;
  const expected = crypto.createHmac("sha256", appSecret).update(rawBody).digest();
  const received = Buffer.from(match[1], "hex");
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

export function normalizeWhatsAppPhone(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  const digits = trimmed.replace(/[^\d]/g, "");
  if (digits.startsWith("00")) return digits.slice(2);
  return digits;
}

export function getPersonalAssistantOwnerAccountIds(
  env: NodeJS.ProcessEnv = process.env,
): Set<number> {
  const values = env.PERSONAL_ASSISTANT_OWNER_ACCOUNT_IDS?.split(",") ?? [];
  const result = new Set<number>();
  for (const value of values) {
    const normalized = value.trim();
    if (!/^\d+$/.test(normalized)) continue;
    const id = Number(normalized);
    if (Number.isSafeInteger(id) && id > 0) result.add(id);
  }
  return result;
}

export function getPersonalAssistantConfig(env: NodeJS.ProcessEnv = process.env) {
  return {
    ownerPhoneConfigured: Boolean(normalizeWhatsAppPhone(env.PERSONAL_ASSISTANT_OWNER_PHONE)),
    verificationTokenConfigured: Boolean(env.PERSONAL_ASSISTANT_WHATSAPP_VERIFY_TOKEN?.trim()),
    appSecretConfigured: Boolean(env.PERSONAL_ASSISTANT_WHATSAPP_APP_SECRET?.trim()),
    outboundEnabled: new PersonalAssistantWhatsAppClient(env).isOutboundEnabled(),
    // AI is deliberately not implemented in this module. The documented flag
    // exists for a future isolated phase but cannot activate functionality now.
    aiEnabled: false,
  };
}