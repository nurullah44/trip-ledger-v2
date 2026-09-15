/**
 * The fetch wrapper every API call goes through: JSON in, `{code, message}`
 * errors out, bearer token attached when there is a session.
 */

import { LedgerError, type LedgerErrorCode } from "./ledger-service";
import { clearSessionToken, getSessionToken, setSessionToken } from "./session";

const ERROR_CODES: LedgerErrorCode[] = [
  "validation",
  "unauthorized",
  "forbidden",
  "not_found",
  "conflict",
  "group_locked",
];

const CODE_BY_STATUS: Record<number, LedgerErrorCode> = {
  400: "validation",
  401: "unauthorized",
  403: "forbidden",
  404: "not_found",
  409: "conflict",
};

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

function isLedgerErrorCode(value: unknown): value is LedgerErrorCode {
  return typeof value === "string" && (ERROR_CODES as string[]).includes(value);
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const token = getSessionToken();
  if (token) headers.set("authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch {
    throw new Error("Can't reach the Trip Ledger API. Is the backend running?");
  }

  if (!response.ok) {
    if (response.status === 401) clearSessionToken();
    const body = (await response.json().catch(() => null)) as {
      code?: unknown;
      message?: unknown;
    } | null;
    const code = isLedgerErrorCode(body?.code)
      ? body.code
      : (CODE_BY_STATUS[response.status] ?? "validation");
    const message =
      typeof body?.message === "string" && body.message
        ? body.message
        : "Something went wrong. Please try again.";
    throw new LedgerError(code, message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Exchange the operator credentials for a bearer session the client keeps. */
export async function signIn(username: string, password: string): Promise<void> {
  const session = await apiRequest<{ accessToken: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  setSessionToken(session.accessToken);
}

export function signOut(): void {
  clearSessionToken();
}
