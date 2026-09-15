import type {
  CreateGroupInput,
  CreatedGroup,
  ExpenseInput,
  GroupSnapshot,
  RepaymentInput,
} from "@/domain/types";

/**
 * The single boundary for every backend call in this app.
 * Screens only ever talk to a LedgerService — never to storage or fetch directly.
 */
export interface LedgerService {
  createGroup(input: CreateGroupInput): Promise<CreatedGroup>;
  getGroupByToken(token: string): Promise<GroupSnapshot>;

  addParticipant(token: string, name: string): Promise<GroupSnapshot>;
  renameParticipant(token: string, participantId: string, name: string): Promise<GroupSnapshot>;

  createExpense(token: string, input: ExpenseInput): Promise<GroupSnapshot>;
  updateExpense(token: string, expenseId: string, input: ExpenseInput): Promise<GroupSnapshot>;
  deleteExpense(token: string, expenseId: string): Promise<GroupSnapshot>;

  createRepayment(token: string, input: RepaymentInput): Promise<GroupSnapshot>;

  finishGroup(token: string): Promise<GroupSnapshot>;
  reopenGroup(token: string): Promise<GroupSnapshot>;
  deleteGroup(token: string): Promise<void>;
}

export type LedgerErrorCode =
  | "not_found"
  | "forbidden"
  | "group_locked"
  | "validation"
  | "conflict";

export class LedgerError extends Error {
  code: LedgerErrorCode;
  constructor(code: LedgerErrorCode, message: string) {
    super(message);
    this.name = "LedgerError";
    this.code = code;
  }
}
