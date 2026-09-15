import { createFileRoute, Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { ArrowLeft, ArrowRight, Check, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Brand, Eyebrow, PageShell } from "@/components/layout";
import { Money } from "@/components/money";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { computeBalances, isSettled, settlementPlan, type Transfer } from "@/domain/balances";
import { minorToInput, parseAmountToMinor, type CurrencyCode } from "@/domain/money";
import type { GroupSnapshot, Participant } from "@/domain/types";
import { ledgerErrorMessage, useGroup, useGroupMutations } from "@/lib/use-ledger";

export const Route = createFileRoute("/g/$token/settle")({
  component: SettleScreen,
});

function SettleScreen() {
  const { token } = Route.useParams();
  const { data, isError, error } = useGroup(token);

  return (
    <PageShell>
      <header className="flex items-center justify-between">
        <Brand />
      </header>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mt-4 text-muted-foreground">
        <Link to="/g/$token" params={{ token }}>
          <ArrowLeft className="size-4" /> Back to group
        </Link>
      </Button>

      {isError ? (
        <p className="mt-6 text-sm text-muted-foreground">{ledgerErrorMessage(error)}</p>
      ) : !data ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
      ) : (
        <Settle token={token} snapshot={data} />
      )}
    </PageShell>
  );
}

function Settle({ token, snapshot }: { token: string; snapshot: GroupSnapshot }) {
  const { participants, expenses, repayments, group } = snapshot;
  const finished = group.status === "finished";
  const balances = computeBalances(participants, expenses, repayments);
  const settled = isSettled(balances);
  const plan = settlementPlan(balances);
  const nameOf = (id: string) => participants.find((p) => p.id === id)?.name ?? "Someone";

  const [prefill, setPrefill] = useState<Transfer | null>(null);
  const [open, setOpen] = useState(false);

  const openRepayment = (transfer?: Transfer) => {
    setPrefill(transfer ?? null);
    setOpen(true);
  };

  return (
    <div className="mt-4">
      <Eyebrow>Settle up</Eyebrow>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">{group.name}</h1>

      {settled ? (
        <Card className="clay-raised mt-6">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-success/15 text-success">
              <Check className="size-6" />
            </span>
            <p className="text-lg font-semibold">Everyone's settled up</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              All balances are zero. Nothing left to pay.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="clay-raised mt-6">
            <CardContent className="p-5 sm:p-6">
              <Eyebrow>Net balances</Eyebrow>
              <ul className="mt-3 space-y-1">
                {balances.map((b) => (
                  <li
                    key={b.participantId}
                    className="flex items-center justify-between border-b border-border-soft py-2 last:border-0"
                  >
                    <span className="font-medium">{b.name}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {b.net > 0 ? "is owed" : b.net < 0 ? "owes" : "settled"}
                      </span>
                      <Money
                        minor={b.net}
                        currency={group.currency}
                        signed
                        showPlus
                        className="text-sm font-semibold"
                      />
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardContent className="p-5 sm:p-6">
              <Eyebrow>Suggested payments</Eyebrow>
              <p className="mt-1 text-sm text-muted-foreground">
                The fewest transfers to clear every balance.
              </p>
              <ul className="mt-4 space-y-2">
                {plan.map((t, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border-soft bg-card/50 px-4 py-3"
                  >
                    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-medium">
                      {nameOf(t.fromParticipantId)}
                      <ArrowRight className="size-3.5 shrink-0 text-meta" />
                      {nameOf(t.toParticipantId)}
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <Money
                        minor={t.amount}
                        currency={group.currency}
                        className="text-sm font-semibold"
                      />
                      {!finished && (
                        <Button size="sm" variant="secondary" onClick={() => openRepayment(t)}>
                          Record
                        </Button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}

      {!finished && (
        <Button size="lg" className="mt-6 w-full" onClick={() => openRepayment()}>
          <Plus className="size-4" /> Record a payment
        </Button>
      )}

      {repayments.length > 0 && (
        <Card className="mt-6">
          <CardContent className="p-5 sm:p-6">
            <Eyebrow>Repayments</Eyebrow>
            <ul className="mt-3 divide-y divide-border-soft">
              {repayments.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="flex flex-wrap items-center gap-x-2 font-medium">
                    {nameOf(r.payerParticipantId)}
                    <ArrowRight className="size-3.5 text-meta" />
                    {nameOf(r.recipientParticipantId)}
                    <span className="text-xs font-normal text-muted-foreground">
                      {format(parseISO(r.paymentDate), "MMM d")}
                    </span>
                  </span>
                  <Money
                    minor={r.amount}
                    currency={group.currency}
                    className="text-sm font-semibold"
                  />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <RepaymentDialog
        key={
          open
            ? prefill
              ? `${prefill.fromParticipantId}-${prefill.toParticipantId}`
              : "blank"
            : "closed"
        }
        token={token}
        open={open}
        onOpenChange={setOpen}
        participants={participants}
        currency={group.currency}
        prefill={prefill}
      />
    </div>
  );
}

function RepaymentDialog({
  token,
  open,
  onOpenChange,
  participants,
  currency,
  prefill,
}: {
  token: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  participants: Participant[];
  currency: CurrencyCode;
  prefill: Transfer | null;
}) {
  const { createRepayment } = useGroupMutations(token);
  const [payerId, setPayerId] = useState(prefill?.fromParticipantId ?? participants[0]?.id ?? "");
  const [recipientId, setRecipientId] = useState(
    prefill?.toParticipantId ?? participants[1]?.id ?? "",
  );
  const [amountStr, setAmountStr] = useState(() =>
    prefill ? minorToInput(prefill.amount, currency) : "",
  );
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const amount = parseAmountToMinor(amountStr, currency);
  const valid =
    amount != null && amount > 0 && !!payerId && !!recipientId && payerId !== recipientId;

  const submit = () => {
    if (!valid || amount == null) return;
    createRepayment.mutate(
      {
        payerParticipantId: payerId,
        recipientParticipantId: recipientId,
        amount,
        paymentDate: date,
      },
      {
        onSuccess: () => {
          toast.success("Repayment recorded");
          onOpenChange(false);
        },
        onError: (e) => toast.error(ledgerErrorMessage(e)),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a payment</DialogTitle>
          <DialogDescription>
            Log a payment that already happened. Balances update immediately.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>From (payer)</Label>
              <Select value={payerId} onValueChange={setPayerId}>
                <SelectTrigger>
                  <SelectValue />
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
            <div className="space-y-2">
              <Label>To (recipient)</Label>
              <Select value={recipientId} onValueChange={setRecipientId}>
                <SelectTrigger>
                  <SelectValue />
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
          </div>

          {payerId === recipientId && (
            <p className="text-xs text-destructive">
              Payer and recipient must be different people.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="repay-amount">Amount</Label>
              <Input
                id="repay-amount"
                inputMode="decimal"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="0.00"
                className="figure"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="repay-date">Date</Label>
              <Input
                id="repay-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!valid || createRepayment.isPending}>
              {createRepayment.isPending ? "Recording…" : "Record payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
