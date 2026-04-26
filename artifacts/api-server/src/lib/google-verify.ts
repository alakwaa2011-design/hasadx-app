import { OAuth2Client } from "google-auth-library";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

let cachedClient: OAuth2Client | null = null;
function getClient(): OAuth2Client {
  if (!CLIENT_ID) {
    throw new Error("GOOGLE_CLIENT_ID is not configured");
  }
  if (!cachedClient) {
    cachedClient = new OAuth2Client(CLIENT_ID);
  }
  return cachedClient;
}

export interface GoogleProfile {
  sub: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
  if (!idToken || typeof idToken !== "string") {
    throw new Error("Missing Google credential");
  }
  const client = getClient();
  const ticket = await client.verifyIdToken({
    idToken,
    audience: CLIENT_ID!,
  });
  const payload = ticket.getPayload();
  if (!payload || !payload.sub) {
    throw new Error("Invalid Google token");
  }
  return {
    sub: payload.sub,
    email: payload.email ?? null,
    emailVerified: Boolean(payload.email_verified),
    name: payload.name ?? null,
    picture: payload.picture ?? null,
  };
}

export function isGoogleConfigured(): boolean {
  return Boolean(CLIENT_ID);
}
