import twilio from "twilio";

let cachedClient: ReturnType<typeof twilio> | null = null;
let cachedAccountSid: string | null = null;

function getCredentials(): {
  accountSid: string;
  authToken: string;
  fromNumber: string;
} | null {
  const accountSid =
    process.env.TWILIO_ACCOUNT_SID || process.env.CONNECTOR_TWILIO_ACCOUNT_SID;
  const authToken =
    process.env.TWILIO_AUTH_TOKEN || process.env.CONNECTOR_TWILIO_AUTH_TOKEN;
  const fromNumber =
    process.env.TWILIO_PHONE_NUMBER ||
    process.env.CONNECTOR_TWILIO_PHONE_NUMBER ||
    process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) return null;
  return { accountSid, authToken, fromNumber };
}

export function isSmsConfigured(): boolean {
  return getCredentials() !== null;
}

function getClient(creds: { accountSid: string; authToken: string }) {
  if (cachedClient && cachedAccountSid === creds.accountSid) return cachedClient;
  cachedClient = twilio(creds.accountSid, creds.authToken);
  cachedAccountSid = creds.accountSid;
  return cachedClient;
}

export async function sendSms(toPhone: string, body: string): Promise<void> {
  const creds = getCredentials();
  if (!creds) {
    throw new Error("SMS provider is not configured");
  }
  const client = getClient(creds);
  await client.messages.create({
    to: toPhone,
    from: creds.fromNumber,
    body,
  });
}
