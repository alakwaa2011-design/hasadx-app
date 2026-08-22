export interface InsufficientCreditsDetail {
  required?: number;
  balance?: number;
}

interface InsufficientCreditsResponseBody {
  code?: unknown;
  required?: unknown;
  balance?: unknown;
}

export const INSUFFICIENT_CREDITS_EVENT = "hasad:insufficient-credits";

const insufficientCreditResponses = new WeakSet<Response>();

function trustedCreditValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

function parseInsufficientCredits(body: unknown): InsufficientCreditsDetail | null {
  if (!body || typeof body !== "object") return null;

  const { code, required, balance } = body as InsufficientCreditsResponseBody;
  if (code !== "INSUFFICIENT_CREDITS") return null;

  return {
    required: trustedCreditValue(required),
    balance: trustedCreditValue(balance),
  };
}

/**
 * Runs a known paid AI request without changing its Response contract.
 *
 * Only the server's explicit 402 + INSUFFICIENT_CREDITS response opens the
 * shared purchase dialog. Callers retain their normal parsing, retries, and
 * handling for every other response.
 */
export async function creditAwareFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(input, init);

  if (response.status !== 402) return response;

  const detail = parseInsufficientCredits(
    await response.clone().json().catch(() => null),
  );
  if (!detail) return response;

  insufficientCreditResponses.add(response);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<InsufficientCreditsDetail>(INSUFFICIENT_CREDITS_EVENT, {
        detail,
      }),
    );
  }

  return response;
}

/** True only for a response already verified by creditAwareFetch. */
export function isInsufficientCreditsResponse(response: Response): boolean {
  return insufficientCreditResponses.has(response);
}