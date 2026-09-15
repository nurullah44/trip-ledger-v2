import { beforeEach, describe, expect, it } from "vitest";
import { computeBalances, isSettled, settlementPlan } from "@/domain/balances";
import { LedgerError } from "./ledger-service";
import {
  buildEqualSplits,
  createMemoryStorage,
  createMockLedgerService,
} from "./mock-ledger-service";

let service = createMockLedgerService(createMemoryStorage());

async function newGroup() {
  const created = await service.createGroup({
    name: "Iceland in a Week",
    currency: "USD",
    participantNames: ["Alex", "Sam", "Maya"],
  });
  const snapshot = await service.getGroupByToken(created.adminToken);
  return { created, snapshot };
}

beforeEach(() => {
  service = createMockLedgerService(createMemoryStorage());
});

describe("createGroup", () => {
  it("returns two distinct long tokens", async () => {
    const { created } = await newGroup();
    expect(created.publicToken).not.toBe(created.adminToken);
    expect(created.publicToken.length).toBeGreaterThanOrEqual(32);
    expect(created.adminToken.length).toBeGreaterThanOrEqual(32);
  });

  it("requires a name and two people", async () => {
    await expect(
      service.createGroup({ name: " ", currency: "USD", participantNames: ["A", "B"] }),
    ).rejects.toBeInstanceOf(LedgerError);
    await expect(
      service.createGroup({ name: "Trip", currency: "USD", participantNames: ["A"] }),
    ).rejects.toBeInstanceOf(LedgerError);
  });

  it("grants admin rights only to the admin token", async () => {
    const { created } = await newGroup();
    expect((await service.getGroupByToken(created.publicToken)).access).toBe("public");
    expect((await service.getGroupByToken(created.publicToken)).adminToken).toBeUndefined();
    expect((await service.getGroupByToken(created.adminToken)).access).toBe("admin");
  });

  it("rejects unknown tokens", async () => {
    await expect(service.getGroupByToken("nope")).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("expenses", () => {
  it("records an equal split and updates balances", async () => {
    const { created, snapshot } = await newGroup();
    const ids = snapshot.participants.map((p) => p.id);
    const next = await service.createExpense(created.publicToken, {
      description: "Dinner",
      amount: 1000,
      paidByParticipantId: ids[0],
      expenseDate: "2026-05-01",
      splitMethod: "equal",
      splits: buildEqualSplits(1000, ids),
    });
    expect(next.expenses).toHaveLength(1);
    const balances = computeBalances(next.participants, next.expenses, next.repayments);
    expect(balances.map((b) => b.net)).toEqual([666, -333, -333]);
  });

  it("validates amount, payer, people and split totals", async () => {
    const { created, snapshot } = await newGroup();
    const ids = snapshot.participants.map((p) => p.id);
    const base = {
      description: "Taxi",
      amount: 1000,
      paidByParticipantId: ids[0],
      expenseDate: "2026-05-01",
      splitMethod: "custom" as const,
      splits: [{ participantId: ids[0], amount: 1000 }],
    };
    await expect(
      service.createExpense(created.publicToken, { ...base, amount: 0 }),
    ).rejects.toMatchObject({ code: "validation" });
    await expect(
      service.createExpense(created.publicToken, { ...base, paidByParticipantId: "ghost" }),
    ).rejects.toMatchObject({ code: "validation" });
    await expect(
      service.createExpense(created.publicToken, { ...base, splits: [] }),
    ).rejects.toMatchObject({ code: "validation" });
    await expect(
      service.createExpense(created.publicToken, {
        ...base,
        splits: [{ participantId: "ghost", amount: 1000 }],
      }),
    ).rejects.toMatchObject({ code: "validation" });
    await expect(
      service.createExpense(created.publicToken, {
        ...base,
        splits: [{ participantId: ids[0], amount: 900 }],
      }),
    ).rejects.toMatchObject({ code: "validation" });
  });

  it("edits and deletes expenses", async () => {
    const { created, snapshot } = await newGroup();
    const ids = snapshot.participants.map((p) => p.id);
    const withExpense = await service.createExpense(created.publicToken, {
      description: "Hotel",
      amount: 30000,
      paidByParticipantId: ids[0],
      expenseDate: "2026-05-01",
      splitMethod: "custom",
      splits: [
        { participantId: ids[0], amount: 10000 },
        { participantId: ids[1], amount: 8000 },
        { participantId: ids[2], amount: 12000 },
      ],
    });
    const expenseId = withExpense.expenses[0].id;

    const edited = await service.updateExpense(created.publicToken, expenseId, {
      description: "Hotel + breakfast",
      amount: 30000,
      paidByParticipantId: ids[1],
      expenseDate: "2026-05-02",
      splitMethod: "equal",
      splits: buildEqualSplits(30000, ids),
    });
    expect(edited.expenses[0].description).toBe("Hotel + breakfast");
    expect(edited.expenses[0].paidByParticipantId).toBe(ids[1]);

    const deleted = await service.deleteExpense(created.publicToken, expenseId);
    expect(deleted.expenses).toHaveLength(0);
  });
});

describe("participants", () => {
  it("adds and renames without losing history", async () => {
    const { created, snapshot } = await newGroup();
    const ids = snapshot.participants.map((p) => p.id);
    await service.createExpense(created.publicToken, {
      description: "Ferry",
      amount: 600,
      paidByParticipantId: ids[0],
      expenseDate: "2026-05-01",
      splitMethod: "equal",
      splits: buildEqualSplits(600, ids),
    });
    const added = await service.addParticipant(created.publicToken, "Jordan");
    expect(added.participants).toHaveLength(4);
    const renamed = await service.renameParticipant(created.publicToken, ids[0], "Alexandra");
    expect(renamed.participants[0].name).toBe("Alexandra");
    expect(renamed.expenses[0].paidByParticipantId).toBe(ids[0]);
  });

  it("rejects duplicate names", async () => {
    const { created } = await newGroup();
    await expect(service.addParticipant(created.publicToken, "sam")).rejects.toMatchObject({
      code: "conflict",
    });
  });
});

describe("repayments and settling up", () => {
  it("recalculates the plan until the group is settled", async () => {
    const { created, snapshot } = await newGroup();
    const [alex, sam, maya] = snapshot.participants.map((p) => p.id);
    let state = await service.createExpense(created.publicToken, {
      description: "Cabin",
      amount: 9000,
      paidByParticipantId: alex,
      expenseDate: "2026-05-01",
      splitMethod: "equal",
      splits: buildEqualSplits(9000, [alex, sam, maya]),
    });

    const plan = settlementPlan(
      computeBalances(state.participants, state.expenses, state.repayments),
    );
    expect(plan).toHaveLength(2);

    for (const transfer of plan) {
      state = await service.createRepayment(created.publicToken, {
        payerParticipantId: transfer.fromParticipantId,
        recipientParticipantId: transfer.toParticipantId,
        amount: transfer.amount,
        paymentDate: "2026-05-05",
      });
    }
    const balances = computeBalances(state.participants, state.expenses, state.repayments);
    expect(isSettled(balances)).toBe(true);
    expect(settlementPlan(balances)).toEqual([]);
  });

  it("allows partial repayments that differ from the plan", async () => {
    const { created, snapshot } = await newGroup();
    const [alex, sam] = snapshot.participants.map((p) => p.id);
    const state = await service.createRepayment(created.publicToken, {
      payerParticipantId: sam,
      recipientParticipantId: alex,
      amount: 500,
      paymentDate: "2026-05-05",
    });
    expect(state.repayments).toHaveLength(1);
  });

  it("rejects self-payments, zero amounts and outsiders", async () => {
    const { created, snapshot } = await newGroup();
    const [alex] = snapshot.participants.map((p) => p.id);
    await expect(
      service.createRepayment(created.publicToken, {
        payerParticipantId: alex,
        recipientParticipantId: alex,
        amount: 100,
        paymentDate: "2026-05-05",
      }),
    ).rejects.toMatchObject({ code: "validation" });
    await expect(
      service.createRepayment(created.publicToken, {
        payerParticipantId: alex,
        recipientParticipantId: "ghost",
        amount: 100,
        paymentDate: "2026-05-05",
      }),
    ).rejects.toMatchObject({ code: "validation" });
    await expect(
      service.createRepayment(created.publicToken, {
        payerParticipantId: alex,
        recipientParticipantId: "ghost",
        amount: 0,
        paymentDate: "2026-05-05",
      }),
    ).rejects.toMatchObject({ code: "validation" });
  });
});

describe("group lifecycle", () => {
  it("locks the group for everyone and reopens for the admin", async () => {
    const { created, snapshot } = await newGroup();
    const ids = snapshot.participants.map((p) => p.id);
    await expect(service.finishGroup(created.publicToken)).rejects.toMatchObject({
      code: "forbidden",
    });

    const finished = await service.finishGroup(created.adminToken);
    expect(finished.group.status).toBe("finished");

    await expect(
      service.createExpense(created.publicToken, {
        description: "Late night",
        amount: 100,
        paidByParticipantId: ids[0],
        expenseDate: "2026-05-09",
        splitMethod: "equal",
        splits: buildEqualSplits(100, ids),
      }),
    ).rejects.toMatchObject({ code: "group_locked" });

    const reopened = await service.reopenGroup(created.adminToken);
    expect(reopened.group.status).toBe("active");
  });

  it("deletes only with the admin link", async () => {
    const { created } = await newGroup();
    await expect(service.deleteGroup(created.publicToken)).rejects.toMatchObject({
      code: "forbidden",
    });
    await service.deleteGroup(created.adminToken);
    await expect(service.getGroupByToken(created.publicToken)).rejects.toMatchObject({
      code: "not_found",
    });
  });
});

describe("persistence", () => {
  it("keeps groups across service instances sharing storage", async () => {
    const storage = createMemoryStorage();
    const first = createMockLedgerService(storage);
    const created = await first.createGroup({
      name: "Algarve",
      currency: "EUR",
      participantNames: ["Alex", "Sam"],
    });
    const second = createMockLedgerService(storage);
    const snapshot = await second.getGroupByToken(created.publicToken);
    expect(snapshot.group.name).toBe("Algarve");
    expect(snapshot.group.currency).toBe("EUR");
  });
});
