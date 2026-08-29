import { describe, expect, it } from "vitest";
import { outlineProviderRequestOptions } from "../routes/ai-presentations";

describe("professional presentation outline request budget", () => {
  it("disables SDK retries and stays below the 120s proxy deadline", () => {
    expect(outlineProviderRequestOptions(100_000)).toEqual({
      timeout: 95_000,
      maxRetries: 0,
    });
  });

  it("preserves a shorter remaining request budget", () => {
    expect(outlineProviderRequestOptions(24_500)).toEqual({
      timeout: 24_500,
      maxRetries: 0,
    });
  });
});