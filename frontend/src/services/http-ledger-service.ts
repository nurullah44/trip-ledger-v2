/**
 * The real backend client: one method per endpoint in ../../openapi.yaml.
 * Used by default; see `index.ts` for the `VITE_USE_MOCK` escape hatch.
 */

import type {
  CreateGroupInput,
  CreatedGroup,
  ExpenseInput,
  GroupSnapshot,
  RepaymentInput,
} from "@/domain/types";

import { apiRequest } from "./api";
import type { LedgerService } from "./ledger-service";

const tokenPath = (token: string, suffix = "") => `/groups/${encodeURIComponent(token)}${suffix}`;
const json = (body: unknown) => JSON.stringify(body);

export function createHttpLedgerService(): LedgerService {
  return {
    createGroup: (input: CreateGroupInput) =>
      apiRequest<CreatedGroup>("/groups", { method: "POST", body: json(input) }),

    getGroupByToken: (token: string) => apiRequest<GroupSnapshot>(tokenPath(token)),

    addParticipant: (token: string, name: string) =>
      apiRequest<GroupSnapshot>(tokenPath(token, "/participants"), {
        method: "POST",
        body: json({ name }),
      }),

    renameParticipant: (token: string, participantId: string, name: string) =>
      apiRequest<GroupSnapshot>(
        tokenPath(token, `/participants/${encodeURIComponent(participantId)}`),
        {
          method: "PATCH",
          body: json({ name }),
        },
      ),

    createExpense: (token: string, input: ExpenseInput) =>
      apiRequest<GroupSnapshot>(tokenPath(token, "/expenses"), {
        method: "POST",
        body: json(input),
      }),

    updateExpense: (token: string, expenseId: string, input: ExpenseInput) =>
      apiRequest<GroupSnapshot>(tokenPath(token, `/expenses/${encodeURIComponent(expenseId)}`), {
        method: "PUT",
        body: json(input),
      }),

    deleteExpense: (token: string, expenseId: string) =>
      apiRequest<GroupSnapshot>(tokenPath(token, `/expenses/${encodeURIComponent(expenseId)}`), {
        method: "DELETE",
      }),

    createRepayment: (token: string, input: RepaymentInput) =>
      apiRequest<GroupSnapshot>(tokenPath(token, "/repayments"), {
        method: "POST",
        body: json(input),
      }),

    finishGroup: (token: string) =>
      apiRequest<GroupSnapshot>(tokenPath(token, "/finish"), { method: "POST" }),

    reopenGroup: (token: string) =>
      apiRequest<GroupSnapshot>(tokenPath(token, "/reopen"), { method: "POST" }),

    deleteGroup: (token: string) => apiRequest<void>(tokenPath(token), { method: "DELETE" }),
  };
}
