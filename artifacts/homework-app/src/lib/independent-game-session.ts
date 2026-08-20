const CONTROL_TOKEN_PREFIX = "wameeth-independent-control:";

export function storeIndependentControlToken(pin: string, token: string): void {
  window.sessionStorage.setItem(`${CONTROL_TOKEN_PREFIX}${pin}`, token);
}

export function getIndependentControlToken(pin: string): string | null {
  try {
    return window.sessionStorage.getItem(`${CONTROL_TOKEN_PREFIX}${pin}`);
  } catch {
    return null;
  }
}

export function clearIndependentControlToken(pin: string): void {
  try {
    window.sessionStorage.removeItem(`${CONTROL_TOKEN_PREFIX}${pin}`);
  } catch {
    // The session is still safe to leave if storage is unavailable.
  }
}