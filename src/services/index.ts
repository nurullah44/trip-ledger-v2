import { createMockLedgerService } from "./mock-ledger-service";
import type { LedgerService } from "./ledger-service";

/**
 * The app's single service instance. Swap this for a real backend
 * implementation later — no screen needs to change.
 */
export const ledgerService: LedgerService = createMockLedgerService();

export { LedgerError } from "./ledger-service";
export type { LedgerService } from "./ledger-service";

export const groupQueryKey = (token: string) => ["group", token] as const;
