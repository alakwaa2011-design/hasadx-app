import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const proxy = vi.fn();
const directSend = vi.fn();

vi.mock("@replit/connectors-sdk", () => ({
  ReplitConnectors: class {
    proxy = proxy;
  },
}));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: directSend };
  },
}));

import { EMAIL_FROM, sendEmail } from "../lib/email";

const message = {
  to: "recipient@example.test",
  subject: "Verification",
  html: "<p>Code</p>",
  text: "Code",
};

describe("sendEmail", () => {
  beforeEach(() => {
    vi.stubEnv("RESEND_API_KEY", "");
    proxy.mockReset();
    directSend.mockReset();
  });

  afterEach(() => vi.unstubAllEnvs());

  it("sends through the connected Resend proxy when no direct key exists", async () => {
    proxy.mockResolvedValue({ ok: true, json: async () => ({ id: "email_123" }) });
    expect(await sendEmail(message)).toEqual({ delivered: true });
    expect(proxy).toHaveBeenCalledWith("resend", "/emails", {
      method: "POST",
      body: { ...message, from: EMAIL_FROM },
    });
    expect(directSend).not.toHaveBeenCalled();
  });

  it("fails closed on a rejected proxy request or missing provider receipt", async () => {
    proxy.mockResolvedValueOnce({ ok: false, status: 401 });
    expect(await sendEmail(message)).toEqual({
      delivered: false,
      reason: "resend_proxy_http_401",
    });
    proxy.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    expect(await sendEmail(message)).toEqual({
      delivered: false,
      reason: "resend_missing_message_id",
    });
  });

  it("does not log exception details from the connector", async () => {
    proxy.mockRejectedValue(new Error("sensitive request details"));
    expect(await sendEmail(message)).toEqual({
      delivered: false,
      reason: "resend_send_failed",
    });
  });

  it("continues supporting a directly configured key", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    directSend.mockResolvedValue({ data: { id: "email_123" }, error: null });
    expect(await sendEmail(message)).toEqual({ delivered: true });
    expect(proxy).not.toHaveBeenCalled();
  });
});