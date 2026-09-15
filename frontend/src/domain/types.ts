import type { CurrencyCode } from "./money";

export type GroupStatus = "active" | "finished";
export type SplitMethod = "equal" | "custom";
export type AccessLevel = "public" | "admin";

export interface Group {
  id: string;
  name: string;
  currency: CurrencyCode;
  status: GroupStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Participant {
  id: string;
  groupId: string;
  name: string;
  createdAt: string;
}

export interface ExpenseSplit {
  participantId: string;
  /** minor units */
  amount: number;
}

export interface Expense {
  id: string;
  groupId: string;
  description: string;
  /** minor units */
  amount: number;
  paidByParticipantId: string;
  expenseDate: string;
  splitMethod: SplitMethod;
  splits: ExpenseSplit[];
  createdAt: string;
  updatedAt: string;
}

export interface Repayment {
  id: string;
  groupId: string;
  payerParticipantId: string;
  recipientParticipantId: string;
  /** minor units */
  amount: number;
  paymentDate: string;
  createdAt: string;
}

/** Everything a screen needs for one group, resolved from a link token. */
export interface GroupSnapshot {
  group: Group;
  access: AccessLevel;
  participants: Participant[];
  expenses: Expense[];
  repayments: Repayment[];
  publicToken: string;
  /** Only present when the token is the admin token. */
  adminToken?: string;
}

export interface ExpenseInput {
  description: string;
  amount: number;
  paidByParticipantId: string;
  expenseDate: string;
  splitMethod: SplitMethod;
  splits: ExpenseSplit[];
}

export interface RepaymentInput {
  payerParticipantId: string;
  recipientParticipantId: string;
  amount: number;
  paymentDate: string;
}

export interface CreateGroupInput {
  name: string;
  currency: CurrencyCode;
  participantNames: string[];
}

export interface CreatedGroup {
  group: Group;
  publicToken: string;
  adminToken: string;
}
