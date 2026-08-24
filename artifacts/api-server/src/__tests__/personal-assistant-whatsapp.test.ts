import crypto from "node:crypto";
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@workspace/db";
import router from "../routes/personal-assistant";
import {
  getPersonalAssistantConfig,
  getPersonalAssistantOwnerAccountIds,
  normalizeWhatsAppPhone,
  PersonalAssistantWhatsAppClient,
  verifyWhatsAppSignature,
} from "../lib/personal-assistant-whatsapp";
import { unauthorizedAccessActivityLogger } from "../lib/unauthorized-access-logger";

const TEST_SECRET = "personal-assistant-test-secret";
const OWNER_PHONE = "+966 500 000 000";

function signedHeader(body: string): string {
  return `sha256=${crypto.createHmac("sha256", TEST_SECRET).update(body).digest("hex")}`;
}

function createWebhookApp() {
  const app = express();
  app.use("/api/webhooks/whatsapp", express.raw({ type: "*/*" }));
  app.use("/api", router);
  return app;
}

describe("personal assistant WhatsApp isolation", () => {
  beforeEach(() => {
    process.env.PERSONAL_ASSISTANT_WHATSAPP_VERIFY_TOKEN = "verify-test-token";
    process.env.PERSONAL_ASSISTANT_WHATSAPP_APP_SECRET = TEST_SECRET;
    process.env.PERSONAL_ASSISTANT_OWNER_PHONE = OWNER_PHONE;
    process.env.PERSONAL_ASSISTANT_OWNER_ACCOUNT_IDS = " 12, 14, not-an-id ";
    vi.restoreAllMocks();
  });

  it("returns the Meta challenge only when verification values match", async () => {
    const app = createWebhookApp();
    const valid = await request(app)
      .get("/api/webhooks/whatsapp")
      .query({ "hub.mode": "subscribe", "hub.verify_token": "verify-test-token", "hub.challenge": "safe-challenge" });
    expect(valid.status).toBe(200);
    expect(valid.text).toBe("safe-challenge");

    const invalid = await request(app)
      .get("/api/webhooks/whatsapp")
      .query({ "hub.mode": "subscribe", "hub.verify_token": "wrong", "hub.challenge": "must-not-return" });
    expect(invalid.status).toBe(403);
    expect(invalid.text).not.toContain("must-not-return");
  });

  it("never logs a rejected verification URL that carries a token", async () => {
    const recordActivity = vi.fn();
    const app = express();
    app.use(unauthorizedAccessActivityLogger(recordActivity));
    app.get("/api/webhooks/whatsapp", (_req, res) => {
      res.status(403).json({ message: "التحقق مرفوض" });
    });

    const response = await request(app)
      .get("/api/webhooks/whatsapp")
      .query({ "hub.mode": "wrong-mode", "hub.verify_token": "must-never-be-recorded" });

    expect(response.status).toBe(403);
    await new Promise((resolve) => setImmediate(resolve));
    expect(recordActivity).not.toHaveBeenCalled();
  });

  it("rejects an invalid signature before the database transaction begins", async () => {
    const transaction = vi.spyOn(db, "transaction");
    const body = JSON.stringify({ entry: [] });
    const response = await request(createWebhookApp())
      .post("/api/webhooks/whatsapp")
      .set("Content-Type", "application/json")
      .set("X-Hub-Signature-256", "sha256=" + "0".repeat(64))
      .send(body);
    expect(response.status).toBe(401);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("ignores a signed message from another number without a database transaction", async () => {
    const transaction = vi.spyOn(db, "transaction");
    const body = JSON.stringify({
      entry: [{
        changes: [{
          value: {
            messages: [{
              id: "message-from-other-owner",
              from: "966511111111",
              type: "text",
              text: { body: "should be ignored" },
              timestamp: "1760000000",
            }],
          },
        }],
      }],
    });
    const response = await request(createWebhookApp())
      .post("/api/webhooks/whatsapp")
      .set("Content-Type", "application/json")
      .set("X-Hub-Signature-256", signedHeader(body))
      .send(body);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ignored" });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("normalizes only valid owner IDs and phone digits", () => {
    expect([...getPersonalAssistantOwnerAccountIds()]).toEqual([12, 14]);
    expect(normalizeWhatsAppPhone(OWNER_PHONE)).toBe("966500000000");
    expect(normalizeWhatsAppPhone("0044 20 0000 0000")).toBe("442000000000");
    expect(normalizeWhatsAppPhone(null)).toBe("");
  });

  it("hard-locks outbound WhatsApp to dry-run with no fetch call for any configuration", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const client = new PersonalAssistantWhatsAppClient({
      PERSONAL_ASSISTANT_OUTBOUND_ENABLED: "true",
      PERSONAL_ASSISTANT_WHATSAPP_ACCESS_TOKEN: "must-never-be-used",
      PERSONAL_ASSISTANT_WHATSAPP_PHONE_NUMBER_ID: "must-never-be-used",
    });
    await expect(client.sendText("966500000000", "لا ترسل")).resolves.toEqual({
      sent: false,
      mode: "dry_run",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("uses a timing-safe valid signature and never exposes enabled AI", () => {
    const body = Buffer.from('{"event":"test"}');
    const signature = `sha256=${crypto.createHmac("sha256", TEST_SECRET).update(body).digest("hex")}`;
    expect(verifyWhatsAppSignature(body, signature, TEST_SECRET)).toBe(true);
    expect(verifyWhatsAppSignature(body, "sha256=" + "a".repeat(64), TEST_SECRET)).toBe(false);
    expect(getPersonalAssistantConfig({
      PERSONAL_ASSISTANT_OWNER_PHONE: OWNER_PHONE,
      PERSONAL_ASSISTANT_WHATSAPP_VERIFY_TOKEN: "token",
      PERSONAL_ASSISTANT_WHATSAPP_APP_SECRET: TEST_SECRET,
      PERSONAL_ASSISTANT_OUTBOUND_ENABLED: "true",
      PERSONAL_ASSISTANT_AI_ENABLED: "true",
    })).toMatchObject({ outboundEnabled: false, aiEnabled: false });
  });
});