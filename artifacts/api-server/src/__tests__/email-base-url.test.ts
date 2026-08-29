import { afterEach, describe, expect, it } from "vitest";
import { EMAIL_FROM, getAppBaseUrl } from "../lib/email";

const originalEnv = {
  appBaseUrl: process.env.APP_BASE_URL,
  replitDomains: process.env.REPLIT_DOMAINS,
  replitDevDomain: process.env.REPLIT_DEV_DOMAIN,
};

afterEach(() => {
  if (originalEnv.appBaseUrl === undefined) delete process.env.APP_BASE_URL;
  else process.env.APP_BASE_URL = originalEnv.appBaseUrl;

  if (originalEnv.replitDomains === undefined) delete process.env.REPLIT_DOMAINS;
  else process.env.REPLIT_DOMAINS = originalEnv.replitDomains;

  if (originalEnv.replitDevDomain === undefined) delete process.env.REPLIT_DEV_DOMAIN;
  else process.env.REPLIT_DEV_DOMAIN = originalEnv.replitDevDomain;
});

describe("getAppBaseUrl", () => {
  it("uses the canonical Hasad domain instead of a Replit deployment URL", () => {
    process.env.APP_BASE_URL = "https://mn-s-h-sd.replit.app/";
    delete process.env.REPLIT_DOMAINS;
    delete process.env.REPLIT_DEV_DOMAIN;

    expect(getAppBaseUrl()).toBe("https://hasaadx.com");
  });

  it("preserves an explicitly configured custom domain", () => {
    process.env.APP_BASE_URL = "https://mail.example.test/";
    delete process.env.REPLIT_DOMAINS;
    delete process.env.REPLIT_DEV_DOMAIN;

    expect(getAppBaseUrl()).toBe("https://mail.example.test");
  });

  it("uses the canonical domain when the deployment domain comes from Replit", () => {
    delete process.env.APP_BASE_URL;
    process.env.REPLIT_DOMAINS = "mn-s-h-sd.replit.app";
    delete process.env.REPLIT_DEV_DOMAIN;

    expect(getAppBaseUrl()).toBe("https://hasaadx.com");
  });
});

describe("EMAIL_FROM", () => {
  it("uses the unified HasaadX sender name and unchanged address", () => {
    expect(EMAIL_FROM).toBe("حصاد | HasaadX <noreply@hasaadx.com>");
  });
});