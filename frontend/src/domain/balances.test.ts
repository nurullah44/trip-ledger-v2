import { describe, expect, it } from "vitest";
import { computeBalances, isSettled, settlementPlan, type Balance } from "./balances";
import type { Expense, Participant, Repayment } from "./types";

const people: Participant[] = ["alex", "sam", "maya", "jordan"].map((name) => ({
  id: name,
  groupId: "g",
  name,
  createdAt: "2026-01-01",
}));

function expense(partial: Partial<Expense>): Expense {
  return {
    id: "e",
    groupId: "g",
    description: "x",
    amount: 0,
    paidByParticipantId: "alex",
    expenseDate: "2026-01-01",
    splitMethod: "equal",
    splits: [],
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    ...partial,
  };
}

function repayment(partial: Partial<Repayment>): Repayment {
  return {
    id: "r",
    groupId: "g",
    payerParticipantId: "sam",
    recipientParticipantId: "alex",
    amount: 0,
    paymentDate: "2026-01-02",
    createdAt: "2026-01-02",
    ...partial,
  };
}

describe("computeBalances", () => {
  it("credits the payer and debits each included person", () => {
    const balances = computeBalances(
      people,
      [
        expense({
          amount: 9000,
          paidByParticipantId: "alex",
          splits: [
            { participantId: "alex", amount: 3000 },
            { participantId: "sam", amount: 3000 },
            { participantId: "maya", amount: 3000 },
          ],
        }),
      ],
      [],
    );
    const map = Object.fromEntries(balances.map((b) => [b.participantId, b.net]));
    expect(map).toEqual({ alex: 6000, sam: -3000, maya: -3000, jordan: 0 });
  });

  it("excludes people not in the split", () => {
    const balances = computeBalances(
      people,
      [
        expense({
          amount: 2000,
          paidByParticipantId: "alex",
          splits: [
            { participantId: "alex", amount: 1000 },
            { participantId: "sam", amount: 1000 },
          ],
        }),
      ],
      [],
    );
    expect(balances.find((b) => b.participantId === "maya")?.net).toBe(0);
  });

  it("applies repayments and reaches a settled ledger", () => {
    const expenses = [
      expense({
        amount: 6000,
        paidByParticipantId: "alex",
        splits: [
          { participantId: "alex", amount: 3000 },
          { participantId: "sam", amount: 3000 },
        ],
      }),
    ];
    const partly = computeBalances(people, expenses, [repayment({ amount: 1000 })]);
    expect(partly.find((b) => b.participantId === "sam")?.net).toBe(-2000);
    expect(isSettled(partly)).toBe(false);

    const full = computeBalances(people, expenses, [repayment({ amount: 3000 })]);
    expect(isSettled(full)).toBe(true);
  });

  it("always nets to zero across the group", () => {
    const balances = computeBalances(
      people,
      [
        expense({
          amount: 1000,
          paidByParticipantId: "maya",
          splits: [
            { participantId: "alex", amount: 334 },
            { participantId: "sam", amount: 333 },
            { participantId: "maya", amount: 333 },
          ],
        }),
      ],
      [repayment({ amount: 100, payerParticipantId: "jordan", recipientParticipantId: "maya" })],
    );
    expect(balances.reduce((a, b) => a + b.net, 0)).toBe(0);
  });
});

describe("settlementPlan", () => {
  const balances: Balance[] = [
    { participantId: "alex", name: "alex", net: -4000 },
    { participantId: "maya", name: "maya", net: -2000 },
    { participantId: "sam", name: "sam", net: 3500 },
    { participantId: "jordan", name: "jordan", net: 2500 },
  ];

  it("clears every balance with no wasted transfers", () => {
    const plan = settlementPlan(balances);
    expect(plan.length).toBe(3);
    const net = new Map(balances.map((b) => [b.participantId, b.net]));
    for (const t of plan) {
      expect(t.amount).toBeGreaterThan(0);
      net.set(t.fromParticipantId, (net.get(t.fromParticipantId) ?? 0) + t.amount);
      net.set(t.toParticipantId, (net.get(t.toParticipantId) ?? 0) - t.amount);
    }
    for (const value of net.values()) expect(value).toBe(0);
  });

  it("returns nothing when the group is settled", () => {
    expect(settlementPlan([{ participantId: "a", name: "a", net: 0 }])).toEqual([]);
  });

  it("needs at most participants-1 transfers on random ledgers", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const nets = [seed * 137, -seed * 11, seed * 3, -seed * 129];
      const rest = -nets.reduce((a, b) => a + b, 0);
      const rows: Balance[] = [...nets, rest].map((net, i) => ({
        participantId: `p${i}`,
        name: `p${i}`,
        net,
      }));
      const plan = settlementPlan(rows);
      expect(plan.length).toBeLessThanOrEqual(rows.length - 1);
    }
  });
});
