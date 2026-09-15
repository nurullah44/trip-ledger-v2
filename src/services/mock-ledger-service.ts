import { splitEqually, sum } from "@/domain/money";
import type {
  CreateGroupInput,
  CreatedGroup,
  Expense,
  ExpenseInput,
  Group,
  GroupSnapshot,
  Participant,
  Repayment,
  RepaymentInput,
} from "@/domain/types";
import { CURRENCIES } from "@/domain/money";
import { LedgerError, type LedgerService } from "./ledger-service";

interface GroupRecord {
  group: Group;
  publicToken: string;
  adminToken: string;
  participants: Participant[];
  expenses: Expense[];
  repayments: Repayment[];
}

interface Db {
  groups: GroupRecord[];
}

export interface MockStorage {
  read(): string | null;
  write(value: string): void;
}

/** Browser localStorage, with a memory fallback for SSR and tests. */
export function createDefaultStorage(): MockStorage {
  const key = "ravel.ledger.v1";
  let memory: string | null = null;
  const available = () => {
    try {
      return typeof window !== "undefined" && !!window.localStorage;
    } catch {
      return false;
    }
  };
  return {
    read() {
      if (!available()) return memory;
      try {
        return window.localStorage.getItem(key);
      } catch {
        return memory;
      }
    },
    write(value) {
      memory = value;
      if (!available()) return;
      try {
        window.localStorage.setItem(key, value);
      } catch {
        /* ignore quota / privacy-mode errors */
      }
    },
  };
}

export function createMemoryStorage(): MockStorage {
  let memory: string | null = null;
  return {
    read: () => memory,
    write: (v) => {
      memory = v;
    },
  };
}

const ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

function randomToken(length = 32): string {
  const bytes = new Uint8Array(length);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = "";
  for (const b of bytes) out += ID_ALPHABET[b % ID_ALPHABET.length];
  return out;
}

function id(): string {
  return randomToken(16);
}

function today(): string {
  return new Date().toISOString();
}

export function createMockLedgerService(
  storage: MockStorage = createDefaultStorage(),
  options: { latencyMs?: number } = {},
): LedgerService {
  const latency = options.latencyMs ?? 0;

  const load = (): Db => {
    const raw = storage.read();
    if (!raw) return { groups: [] };
    try {
      const parsed = JSON.parse(raw) as Db;
      return parsed?.groups ? parsed : { groups: [] };
    } catch {
      return { groups: [] };
    }
  };

  const save = (db: Db) => storage.write(JSON.stringify(db));

  const wait = () =>
    latency > 0 ? new Promise<void>((r) => setTimeout(r, latency)) : Promise.resolve();

  function resolve(db: Db, token: string) {
    const record = db.groups.find((g) => g.publicToken === token || g.adminToken === token);
    if (!record) throw new LedgerError("not_found", "This group link is not valid.");
    return {
      record,
      access: record.adminToken === token ? ("admin" as const) : ("public" as const),
    };
  }

  function snapshot(record: GroupRecord, access: "public" | "admin"): GroupSnapshot {
    return {
      group: { ...record.group },
      access,
      participants: record.participants.map((p) => ({ ...p })),
      expenses: record.expenses
        .map((e) => ({ ...e, splits: e.splits.map((s) => ({ ...s })) }))
        .sort(
          (a, b) =>
            b.expenseDate.localeCompare(a.expenseDate) || b.createdAt.localeCompare(a.createdAt),
        ),
      repayments: record.repayments
        .map((r) => ({ ...r }))
        .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate)),
      publicToken: record.publicToken,
      adminToken: access === "admin" ? record.adminToken : undefined,
    };
  }

  function assertActive(record: GroupRecord) {
    if (record.group.status === "finished") {
      throw new LedgerError("group_locked", "This group is finished. Reopen it to make changes.");
    }
  }

  function validateExpense(record: GroupRecord, input: ExpenseInput) {
    if (!input.description.trim()) {
      throw new LedgerError("validation", "Add a short description.");
    }
    if (!Number.isInteger(input.amount) || input.amount <= 0) {
      throw new LedgerError("validation", "Amount must be greater than zero.");
    }
    const ids = new Set(record.participants.map((p) => p.id));
    if (!input.paidByParticipantId || !ids.has(input.paidByParticipantId)) {
      throw new LedgerError("validation", "Choose who paid.");
    }
    if (input.splits.length === 0) {
      throw new LedgerError("validation", "Include at least one person.");
    }
    const seen = new Set<string>();
    for (const s of input.splits) {
      if (!ids.has(s.participantId)) {
        throw new LedgerError("validation", "Everyone included must be in this group.");
      }
      if (seen.has(s.participantId)) {
        throw new LedgerError("validation", "Someone is included twice.");
      }
      seen.add(s.participantId);
      if (!Number.isInteger(s.amount) || s.amount < 0) {
        throw new LedgerError("validation", "Split amounts must be zero or more.");
      }
    }
    if (sum(input.splits.map((s) => s.amount)) !== input.amount) {
      throw new LedgerError("validation", "The split amounts must add up to the total.");
    }
    if (!input.expenseDate) {
      throw new LedgerError("validation", "Pick a date.");
    }
  }

  function validateRepayment(record: GroupRecord, input: RepaymentInput) {
    if (!Number.isInteger(input.amount) || input.amount <= 0) {
      throw new LedgerError("validation", "Amount must be greater than zero.");
    }
    if (input.payerParticipantId === input.recipientParticipantId) {
      throw new LedgerError("validation", "Payer and recipient must be different people.");
    }
    const ids = new Set(record.participants.map((p) => p.id));
    if (!ids.has(input.payerParticipantId) || !ids.has(input.recipientParticipantId)) {
      throw new LedgerError("validation", "Both people must be in this group.");
    }
    if (!input.paymentDate) {
      throw new LedgerError("validation", "Pick a date.");
    }
  }

  function mutate(
    token: string,
    fn: (record: GroupRecord) => void,
    opts: { adminOnly?: boolean; allowFinished?: boolean } = {},
  ): GroupSnapshot {
    const db = load();
    const { record, access } = resolve(db, token);
    if (opts.adminOnly && access !== "admin") {
      throw new LedgerError("forbidden", "Only the group admin can do this.");
    }
    if (!opts.allowFinished) assertActive(record);
    fn(record);
    record.group.updatedAt = today();
    save(db);
    return snapshot(record, access);
  }

  return {
    async createGroup(input: CreateGroupInput): Promise<CreatedGroup> {
      await wait();
      const name = input.name.trim();
      if (!name) throw new LedgerError("validation", "Give the group a name.");
      if (!CURRENCIES[input.currency]) {
        throw new LedgerError("validation", "Pick a currency.");
      }
      const names = input.participantNames.map((n) => n.trim()).filter(Boolean);
      if (names.length < 2) {
        throw new LedgerError("validation", "Add at least two people.");
      }
      const now = today();
      const groupId = id();
      const record: GroupRecord = {
        group: {
          id: groupId,
          name,
          currency: input.currency,
          status: "active",
          createdAt: now,
          updatedAt: now,
        },
        publicToken: randomToken(),
        adminToken: randomToken(40),
        participants: names.map((n) => ({
          id: id(),
          groupId,
          name: n,
          createdAt: now,
        })),
        expenses: [],
        repayments: [],
      };
      const db = load();
      db.groups.push(record);
      save(db);
      return {
        group: { ...record.group },
        publicToken: record.publicToken,
        adminToken: record.adminToken,
      };
    },

    async getGroupByToken(token: string) {
      await wait();
      const db = load();
      const { record, access } = resolve(db, token);
      return snapshot(record, access);
    },

    async addParticipant(token, name) {
      await wait();
      return mutate(token, (record) => {
        const clean = name.trim();
        if (!clean) throw new LedgerError("validation", "Enter a name.");
        if (record.participants.some((p) => p.name.toLowerCase() === clean.toLowerCase())) {
          throw new LedgerError("conflict", "Someone with that name is already in the group.");
        }
        record.participants.push({
          id: id(),
          groupId: record.group.id,
          name: clean,
          createdAt: today(),
        });
      });
    },

    async renameParticipant(token, participantId, name) {
      await wait();
      return mutate(token, (record) => {
        const clean = name.trim();
        if (!clean) throw new LedgerError("validation", "Enter a name.");
        const participant = record.participants.find((p) => p.id === participantId);
        if (!participant) throw new LedgerError("not_found", "That person is not in this group.");
        if (
          record.participants.some(
            (p) => p.id !== participantId && p.name.toLowerCase() === clean.toLowerCase(),
          )
        ) {
          throw new LedgerError("conflict", "Someone with that name is already in the group.");
        }
        participant.name = clean;
      });
    },

    async createExpense(token, input) {
      await wait();
      return mutate(token, (record) => {
        validateExpense(record, input);
        const now = today();
        record.expenses.push({
          id: id(),
          groupId: record.group.id,
          description: input.description.trim(),
          amount: input.amount,
          paidByParticipantId: input.paidByParticipantId,
          expenseDate: input.expenseDate,
          splitMethod: input.splitMethod,
          splits: input.splits.map((s) => ({ ...s })),
          createdAt: now,
          updatedAt: now,
        });
      });
    },

    async updateExpense(token, expenseId, input) {
      await wait();
      return mutate(token, (record) => {
        const expense = record.expenses.find((e) => e.id === expenseId);
        if (!expense) throw new LedgerError("not_found", "That expense no longer exists.");
        validateExpense(record, input);
        expense.description = input.description.trim();
        expense.amount = input.amount;
        expense.paidByParticipantId = input.paidByParticipantId;
        expense.expenseDate = input.expenseDate;
        expense.splitMethod = input.splitMethod;
        expense.splits = input.splits.map((s) => ({ ...s }));
        expense.updatedAt = today();
      });
    },

    async deleteExpense(token, expenseId) {
      await wait();
      return mutate(token, (record) => {
        const index = record.expenses.findIndex((e) => e.id === expenseId);
        if (index === -1) throw new LedgerError("not_found", "That expense no longer exists.");
        record.expenses.splice(index, 1);
      });
    },

    async createRepayment(token, input) {
      await wait();
      return mutate(token, (record) => {
        validateRepayment(record, input);
        record.repayments.push({
          id: id(),
          groupId: record.group.id,
          payerParticipantId: input.payerParticipantId,
          recipientParticipantId: input.recipientParticipantId,
          amount: input.amount,
          paymentDate: input.paymentDate,
          createdAt: today(),
        });
      });
    },

    async finishGroup(token) {
      await wait();
      return mutate(
        token,
        (record) => {
          record.group.status = "finished";
        },
        { adminOnly: true },
      );
    },

    async reopenGroup(token) {
      await wait();
      return mutate(
        token,
        (record) => {
          record.group.status = "active";
        },
        { adminOnly: true, allowFinished: true },
      );
    },

    async deleteGroup(token) {
      await wait();
      const db = load();
      const { record, access } = resolve(db, token);
      if (access !== "admin") {
        throw new LedgerError("forbidden", "Only the group admin can delete the group.");
      }
      db.groups = db.groups.filter((g) => g !== record);
      save(db);
    },
  };
}

/** Helper shared by the add-expense screen: build equal splits for selected people. */
export function buildEqualSplits(total: number, participantIds: string[]) {
  const amounts = splitEqually(total, participantIds.length);
  return participantIds.map((participantId, i) => ({ participantId, amount: amounts[i] }));
}
