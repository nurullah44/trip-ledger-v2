import { createHttpLedgerService } from "./http-ledger-service";
import { createMockLedgerService } from "./mock-ledger-service";
import type { LedgerService } from "./ledger-service";

/**
 * Screens only ever see this singleton, so swapping the backend is a change
 * here and nowhere else. The FastAPI API is the default; `VITE_USE_MOCK=1`
 * puts the localStorage mock back for frontend-only work.
 */
const useMock = import.meta.env.VITE_USE_MOCK === "1";

export const ledgerService: LedgerService = useMock
  ? createMockLedgerService()
  : createHttpLedgerService();

/** The API protects finish/reopen/delete with a bearer session; the mock has no auth. */
export const requiresSignIn = !useMock;

export { LedgerError } from "./ledger-service";
export type { LedgerErrorCode, LedgerService } from "./ledger-service";
export { signIn, signOut } from "./api";
export { hasSession } from "./session";

export const groupQueryKey = (token: string) => ["group", token] as const;
