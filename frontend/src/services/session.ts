/**
 * The admin session token, kept in localStorage so a refresh doesn't force a
 * new sign-in. Falls back to memory outside the browser (SSR, tests).
 */

const STORAGE_KEY = "trip-ledger.admin-session";

let memoryToken: string | null = null;

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function getSessionToken(): string | null {
  return storage()?.getItem(STORAGE_KEY) ?? memoryToken;
}

export function setSessionToken(token: string): void {
  memoryToken = token;
  storage()?.setItem(STORAGE_KEY, token);
}

export function clearSessionToken(): void {
  memoryToken = null;
  storage()?.removeItem(STORAGE_KEY);
}

export function hasSession(): boolean {
  return Boolean(getSessionToken());
}
