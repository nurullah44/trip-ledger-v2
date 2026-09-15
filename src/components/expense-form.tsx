import { useMemo, useState } from "react";

import { Money } from "@/components/money";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { minorToInput, parseAmountToMinor, sum, type CurrencyCode } from "@/domain/money";
import { buildEqualSplits } from "@/services/mock-ledger-service";
import type { Expense, ExpenseInput, ExpenseSplit, Participant, SplitMethod } from "@/domain/types";
import { cn } from "@/lib/utils";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ExpenseForm({
  participants,
  currency,
  initial,
  submitLabel,
  pending,
  onSubmit,
  onCancel,
}: {
  participants: Participant[];
  currency: CurrencyCode;
  initial?: Expense;
  submitLabel: string;
  pending?: boolean;
  onSubmit: (input: ExpenseInput) => void;
  onCancel: () => void;
}) {
  const [description, setDescription] = useState(initial?.description ?? "");
  const [amountStr, setAmountStr] = useState(initial ? minorToInput(initial.amount, currency) : "");
  const [date, setDate] = useState(initial?.expenseDate?.slice(0, 10) ?? todayIso());
  const [payerId, setPayerId] = useState(initial?.paidByParticipantId ?? participants[0]?.id ?? "");
  const [splitMethod, setSplitMethod] = useState<SplitMethod>(initial?.splitMethod ?? "equal");
  const [selected, setSelected] = useState<Set<string>>(
    () =>
      new Set(initial ? initial.splits.map((s) => s.participantId) : participants.map((p) => p.id)),
  );
  const [customStr, setCustomStr] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    if (initial) {
      for (const s of initial.splits) map[s.participantId] = minorToInput(s.amount, currency);
    }
    return map;
  });

  const amount = parseAmountToMinor(amountStr, currency);
  const selectedIds = participants.map((p) => p.id).filter((id) => selected.has(id));

  const equalPreview = useMemo(() => {
    if (amount == null || selectedIds.length === 0) return new Map<string, number>();
    const splits = buildEqualSplits(amount, selectedIds);
    return new Map(splits.map((s) => [s.participantId, s.amount]));
  }, [amount, selectedIds]);

  const customTotal = useMemo(
    () => sum(selectedIds.map((id) => parseAmountToMinor(customStr[id] ?? "", currency) ?? 0)),
    [selectedIds, customStr, currency],
  );
  const remaining = amount == null ? null : amount - customTotal;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const errors: string[] = [];
  if (!description.trim()) errors.push("Add a description.");
  if (amount == null || amount <= 0) errors.push("Enter an amount greater than zero.");
  if (!payerId) errors.push("Choose who paid.");
  if (selectedIds.length === 0) errors.push("Include at least one person.");
  if (splitMethod === "custom" && amount != null && remaining !== 0) {
    errors.push("Custom amounts must add up to the total.");
  }
  const valid = errors.length === 0;

  const handleSubmit = () => {
    if (!valid || amount == null) return;
    const splits: ExpenseSplit[] =
      splitMethod === "equal"
        ? buildEqualSplits(amount, selectedIds).map((s) => ({
            participantId: s.participantId,
            amount: s.amount ?? 0,
          }))
        : selectedIds.map((id) => ({
            participantId: id,
            amount: parseAmountToMinor(customStr[id] ?? "", currency) ?? 0,
          }));
    onSubmit({
      description: description.trim(),
      amount,
      paidByParticipantId: payerId,
      expenseDate: date,
      splitMethod,
      splits,
    });
  };

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="expense-description">Description</Label>
        <Input
          id="expense-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Dinner, taxi, hotel…"
          autoFocus
          className="h-11"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="expense-amount">Amount</Label>
          <Input
            id="expense-amount"
            inputMode="decimal"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            placeholder="0.00"
            className="figure h-11"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="expense-date">Date</Label>
          <Input
            id="expense-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-11"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="expense-payer">Paid by</Label>
        <Select value={payerId} onValueChange={setPayerId}>
          <SelectTrigger id="expense-payer" className="h-11">
            <SelectValue placeholder="Choose who paid" />
          </SelectTrigger>
          <SelectContent>
            {participants.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label>Split</Label>
          <div className="inline-flex rounded-lg border border-border bg-background/60 p-1">
            {(["equal", "custom"] as const).map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => setSplitMethod(method)}
                className={cn(
                  "rounded-md px-3 py-1 text-sm font-medium capitalize transition-colors",
                  splitMethod === method
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {method === "equal" ? "Equal" : "Custom"}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-border-soft overflow-hidden rounded-xl border border-border">
          {participants.map((p) => {
            const isIn = selected.has(p.id);
            return (
              <div key={p.id} className="flex items-center gap-3 bg-card/40 px-3 py-2.5">
                <Checkbox id={`inc-${p.id}`} checked={isIn} onCheckedChange={() => toggle(p.id)} />
                <Label htmlFor={`inc-${p.id}`} className="flex-1 cursor-pointer font-normal">
                  {p.name}
                </Label>
                {isIn && splitMethod === "equal" && (
                  <Money
                    minor={equalPreview.get(p.id) ?? 0}
                    currency={currency}
                    className="text-sm text-muted-foreground"
                  />
                )}
                {isIn && splitMethod === "custom" && (
                  <Input
                    inputMode="decimal"
                    value={customStr[p.id] ?? ""}
                    onChange={(e) => setCustomStr((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    placeholder="0.00"
                    className="figure h-9 w-28 text-right"
                  />
                )}
              </div>
            );
          })}
        </div>

        {splitMethod === "custom" && remaining !== null && (
          <div className="flex items-center justify-between rounded-lg bg-secondary/60 px-3 py-2 text-sm">
            <span className="text-muted-foreground">
              {remaining === 0 ? "Adds up" : remaining > 0 ? "Left to assign" : "Over by"}
            </span>
            <Money
              minor={Math.abs(remaining)}
              currency={currency}
              className={cn(
                "text-sm font-semibold",
                remaining === 0 ? "text-success" : "text-destructive",
              )}
            />
          </div>
        )}
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onCancel} className="sm:w-32">
          Cancel
        </Button>
        <Button type="submit" disabled={!valid || pending} className="sm:w-40">
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
