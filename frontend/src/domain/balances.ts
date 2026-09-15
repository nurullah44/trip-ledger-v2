import type { Expense, Participant, Repayment } from "./types";

export interface Balance {
  participantId: string;
  name: string;
  /** minor units. > 0 is owed money, < 0 owes money, 0 settled. */
  net: number;
}

export interface Transfer {
  fromParticipantId: string;
  toParticipantId: string;
  amount: number;
}

/**
 * net = paid on behalf of others - own share + repayments sent - repayments received
 */
export function computeBalances(
  participants: Participant[],
  expenses: Expense[],
  repayments: Repayment[],
): Balance[] {
  const net = new Map<string, number>();
  for (const p of participants) net.set(p.id, 0);
  const bump = (id: string, delta: number) => {
    if (!net.has(id)) return;
    net.set(id, (net.get(id) ?? 0) + delta);
  };

  for (const e of expenses) {
    bump(e.paidByParticipantId, e.amount);
    for (const s of e.splits) bump(s.participantId, -s.amount);
  }
  for (const r of repayments) {
    bump(r.payerParticipantId, r.amount);
    bump(r.recipientParticipantId, -r.amount);
  }

  return participants.map((p) => ({
    participantId: p.id,
    name: p.name,
    net: net.get(p.id) ?? 0,
  }));
}

export function totalPaid(expenses: Expense[]): number {
  return expenses.reduce((a, e) => a + e.amount, 0);
}

export function isSettled(balances: Balance[]): boolean {
  return balances.every((b) => b.net === 0);
}

/**
 * Greedy debtor/creditor matching: minimal-ish number of transfers,
 * always driving every balance to zero.
 */
export function settlementPlan(balances: Balance[]): Transfer[] {
  const debtors = balances
    .filter((b) => b.net < 0)
    .map((b) => ({ id: b.participantId, amount: -b.net }))
    .sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id));
  const creditors = balances
    .filter((b) => b.net > 0)
    .map((b) => ({ id: b.participantId, amount: b.net }))
    .sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id));

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i];
    const c = creditors[j];
    if (!d || !c) break; // the loop condition guarantees both; this narrows the types
    const amount = Math.min(d.amount, c.amount);
    if (amount > 0) {
      transfers.push({ fromParticipantId: d.id, toParticipantId: c.id, amount });
      d.amount -= amount;
      c.amount -= amount;
    }
    if (d.amount === 0) i++;
    if (c.amount === 0) j++;
  }
  return transfers;
}
