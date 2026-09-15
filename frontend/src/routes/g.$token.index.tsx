import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import {
  ArrowLeftRight,
  Check,
  Lock,
  LockOpen,
  Pencil,
  Plus,
  Share2,
  Trash2,
  Users,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Brand, Eyebrow, PageShell } from "@/components/layout";
import { CopyField } from "@/components/copy-field";
import { Money } from "@/components/money";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { computeBalances, isSettled } from "@/domain/balances";
import type { Expense, GroupSnapshot, Participant } from "@/domain/types";
import { ledgerErrorMessage, useGroup, useGroupMutations } from "@/lib/use-ledger";
import { hasSession, LedgerError, requiresSignIn, signIn } from "@/services";

export const Route = createFileRoute("/g/$token/")({
  component: GroupScreen,
});

function GroupScreen() {
  const { token } = Route.useParams();
  const { data, isError, error } = useGroup(token);

  // Data is undefined during SSR / first paint (the query is client-gated) as
  // well as while fetching — show the skeleton until it resolves or errors.
  if (isError) return <InvalidLink message={ledgerErrorMessage(error)} />;
  if (!data) return <LoadingState />;
  return <GroupView token={token} snapshot={data} />;
}

function GroupView({ token, snapshot }: { token: string; snapshot: GroupSnapshot }) {
  const { group, participants, expenses, repayments, access } = snapshot;
  const finished = group.status === "finished";
  const isAdmin = access === "admin";
  const nameOf = (id: string) => participants.find((p) => p.id === id)?.name ?? "Someone";
  const balances = computeBalances(participants, expenses, repayments);
  const settled = isSettled(balances);

  return (
    <PageShell>
      <header className="flex items-center justify-between">
        <Brand />
        <ShareDialog snapshot={snapshot} />
      </header>

      <div className="mt-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <StatusPill finished={finished} settled={settled} />
            <h1 className="mt-2 text-3xl font-bold tracking-tight">{group.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {participants.length} people · {group.currency}
            </p>
          </div>
          {isAdmin && <AdminControls token={token} finished={finished} />}
        </div>
      </div>

      {finished && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-secondary/50 px-4 py-3 text-sm">
          <Lock className="size-4 text-meta" />
          <span>
            This group is finished and read-only.{" "}
            {isAdmin ? "Reopen it to make changes." : "Ask the admin to reopen it."}
          </span>
        </div>
      )}

      {!finished && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Button asChild size="lg">
            <Link to="/g/$token/expense/new" params={{ token }}>
              <Plus className="size-4" />
              Add expense
            </Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link to="/g/$token/settle" params={{ token }}>
              <ArrowLeftRight className="size-4" />
              Settle up
            </Link>
          </Button>
        </div>
      )}

      <BalancesCard
        balances={balances}
        currency={group.currency}
        settled={settled}
        token={token}
        finished={finished}
      />

      <ExpensesCard
        token={token}
        expenses={expenses}
        currency={group.currency}
        nameOf={nameOf}
        finished={finished}
      />

      <ParticipantsCard token={token} participants={participants} finished={finished} />
    </PageShell>
  );
}

function StatusPill({ finished, settled }: { finished: boolean; settled: boolean }) {
  if (finished) {
    return (
      <span className="eyebrow inline-flex items-center gap-1.5 text-muted-foreground">
        <Lock className="size-3" /> Finished
      </span>
    );
  }
  return (
    <span className="eyebrow inline-flex items-center gap-1.5">
      <span
        className={`size-2 rounded-full ${settled ? "bg-success" : "bg-warning"}`}
        aria-hidden
      />
      {settled ? "Active · settled" : "Active"}
    </span>
  );
}

function BalancesCard({
  balances,
  currency,
  settled,
  token,
  finished,
}: {
  balances: ReturnType<typeof computeBalances>;
  currency: GroupSnapshot["group"]["currency"];
  settled: boolean;
  token: string;
  finished: boolean;
}) {
  return (
    <Card className="clay-raised mt-6">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <Eyebrow>Balances</Eyebrow>
          {!finished && (
            <Link
              to="/g/$token/settle"
              params={{ token }}
              className="text-sm font-medium text-meta hover:underline"
            >
              Settle up →
            </Link>
          )}
        </div>

        {settled ? (
          <div className="mt-4 flex items-center gap-2 text-sm">
            <span className="grid size-6 place-items-center rounded-full bg-success/15 text-success">
              <Check className="size-4" />
            </span>
            <span className="font-medium">Everyone's settled up.</span>
          </div>
        ) : (
          <ul className="mt-4 space-y-1">
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
                    currency={currency}
                    signed
                    showPlus
                    className="text-sm font-semibold"
                  />
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ExpensesCard({
  token,
  expenses,
  currency,
  nameOf,
  finished,
}: {
  token: string;
  expenses: Expense[];
  currency: GroupSnapshot["group"]["currency"];
  nameOf: (id: string) => string;
  finished: boolean;
}) {
  const { deleteExpense } = useGroupMutations(token);

  return (
    <Card className="mt-6">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <Eyebrow>Expenses</Eyebrow>
          {!finished && (
            <Button asChild variant="ghost" size="sm" className="text-meta">
              <Link to="/g/$token/expense/new" params={{ token }}>
                <Plus className="size-4" /> Add
              </Link>
            </Button>
          )}
        </div>

        {expenses.length === 0 ? (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            No expenses yet.{finished ? "" : " Add the first one to get started."}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border-soft">
            {expenses.map((expense) => (
              <li key={expense.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{expense.description}</p>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>{nameOf(expense.paidByParticipantId)} paid</span>
                    <span aria-hidden>·</span>
                    <span>{format(parseISO(expense.expenseDate), "MMM d")}</span>
                    <Badge variant="secondary" className="ml-1 font-normal">
                      {expense.splitMethod === "equal" ? "equal" : "custom"} ·{" "}
                      {expense.splits.length}
                    </Badge>
                  </div>
                </div>
                <Money
                  minor={expense.amount}
                  currency={currency}
                  className="text-sm font-semibold"
                />
                {!finished && (
                  <div className="flex shrink-0 items-center">
                    <Button asChild variant="ghost" size="icon" className="text-muted-foreground">
                      <Link
                        to="/g/$token/expense/$expenseId"
                        params={{ token, expenseId: expense.id }}
                        aria-label={`Edit ${expense.description}`}
                      >
                        <Pencil className="size-4" />
                      </Link>
                    </Button>
                    <DeleteExpenseButton
                      label={expense.description}
                      pending={deleteExpense.isPending}
                      onConfirm={() =>
                        deleteExpense.mutate(expense.id, {
                          onSuccess: () => toast.success("Expense deleted"),
                          onError: (e) => toast.error(ledgerErrorMessage(e)),
                        })
                      }
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function DeleteExpenseButton({
  label,
  onConfirm,
  pending,
}: {
  label: string;
  onConfirm: () => void;
  pending: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{label}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the expense and recalculates everyone's balances. It can't be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={pending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ParticipantsCard({
  token,
  participants,
  finished,
}: {
  token: string;
  participants: Participant[];
  finished: boolean;
}) {
  const { addParticipant, renameParticipant } = useGroupMutations(token);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const submitAdd = () => {
    const name = newName.trim();
    if (!name) return;
    addParticipant.mutate(name, {
      onSuccess: () => setNewName(""),
      onError: (e) => toast.error(ledgerErrorMessage(e)),
    });
  };

  const submitRename = (participantId: string) => {
    const name = draft.trim();
    if (!name) return setEditingId(null);
    renameParticipant.mutate(
      { participantId, name },
      {
        onSuccess: () => setEditingId(null),
        onError: (e) => toast.error(ledgerErrorMessage(e)),
      },
    );
  };

  return (
    <Card className="mt-6">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-meta" />
          <Eyebrow>People</Eyebrow>
        </div>

        <ul className="mt-3 divide-y divide-border-soft">
          {participants.map((p) => (
            <li key={p.id} className="flex items-center gap-2 py-2">
              {editingId === p.id ? (
                <>
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitRename(p.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    autoFocus
                    className="h-9"
                  />
                  <Button
                    size="sm"
                    onClick={() => submitRename(p.id)}
                    disabled={renameParticipant.isPending}
                  >
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 font-medium">{p.name}</span>
                  {!finished && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground"
                      onClick={() => {
                        setEditingId(p.id);
                        setDraft(p.name);
                      }}
                      aria-label={`Rename ${p.name}`}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>

        {!finished && (
          <div className="mt-3 flex items-center gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitAdd()}
              placeholder="Add a person"
              className="h-10"
            />
            <Button onClick={submitAdd} disabled={!newName.trim() || addParticipant.isPending}>
              <Plus className="size-4" /> Add
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AdminControls({ token, finished }: { token: string; finished: boolean }) {
  const router = useRouter();
  const { finishGroup, reopenGroup, deleteGroup } = useGroupMutations(token);
  const [signInOpen, setSignInOpen] = useState(false);
  const pendingAction = useRef<(() => void) | null>(null);

  // The API answers 401 for finish/reopen/delete without a bearer session, so
  // ask for the operator account first and run the button's action afterwards.
  const runAsAdmin = (action: () => void) => {
    if (!requiresSignIn || hasSession()) {
      action();
      return;
    }
    pendingAction.current = action;
    setSignInOpen(true);
  };

  const handleError = (error: unknown) => {
    if (requiresSignIn && error instanceof LedgerError && error.code === "unauthorized") {
      setSignInOpen(true);
      toast.error("Sign in again to manage this group.");
      return;
    }
    toast.error(ledgerErrorMessage(error));
  };

  const runPendingAction = () => {
    const action = pendingAction.current;
    pendingAction.current = null;
    action?.();
  };

  return (
    <>
      <div className="flex shrink-0 items-center gap-2">
        {finished ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              runAsAdmin(() =>
                reopenGroup.mutate(undefined, {
                  onSuccess: () => toast.success("Group reopened"),
                  onError: handleError,
                }),
              )
            }
            disabled={reopenGroup.isPending}
          >
            <LockOpen className="size-4" /> Reopen
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              runAsAdmin(() =>
                finishGroup.mutate(undefined, {
                  onSuccess: () => toast.success("Group finished"),
                  onError: handleError,
                }),
              )
            }
            disabled={finishGroup.isPending}
          >
            <Lock className="size-4" /> Finish
          </Button>
        )}

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive"
              aria-label="Delete group"
            >
              <Trash2 className="size-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this group?</AlertDialogTitle>
              <AlertDialogDescription>
                Every expense, repayment, and balance is permanently removed. Both links stop
                working. This can't be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep group</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() =>
                  runAsAdmin(() =>
                    deleteGroup.mutate(undefined, {
                      onSuccess: () => {
                        toast.success("Group deleted");
                        router.navigate({ to: "/" });
                      },
                      onError: handleError,
                    }),
                  )
                }
              >
                Delete group
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <SignInDialog open={signInOpen} onOpenChange={setSignInOpen} onSignedIn={runPendingAction} />
    </>
  );
}

function SignInDialog({
  open,
  onOpenChange,
  onSignedIn,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSignedIn: () => void;
}) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!username.trim() || !password || busy) return;
    setBusy(true);
    try {
      await signIn(username.trim(), password);
      setPassword("");
      toast.success("Signed in");
      onSignedIn();
      onOpenChange(false);
    } catch (error) {
      toast.error(ledgerErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Admin sign-in</DialogTitle>
          <DialogDescription>
            Finishing, reopening, or deleting a group needs the operator account.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="admin-username">Username</Label>
            <Input
              id="admin-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-password">Password</Label>
            <Input
              id="admin-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy || !username.trim() || !password}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ShareDialog({ snapshot }: { snapshot: GroupSnapshot }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const sharedUrl = `${origin}/g/${snapshot.publicToken}`;
  const adminUrl = snapshot.adminToken ? `${origin}/g/${snapshot.adminToken}` : null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <Share2 className="size-4" /> Share
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share this group</DialogTitle>
          <DialogDescription>
            Send the shared link to the group. Everyone with it can add and edit expenses.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Shared group link</p>
            <CopyField value={sharedUrl} label="Shared link" />
          </div>
          {adminUrl && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Private admin link</p>
              <p className="text-xs text-muted-foreground">
                Keep this to yourself — it can finish, reopen, or delete the group.
              </p>
              <CopyField value={adminUrl} label="Admin link" />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LoadingState() {
  return (
    <PageShell>
      <header className="flex items-center justify-between">
        <Brand />
      </header>
      <div className="mt-10 space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-secondary" />
        <div className="h-40 animate-pulse rounded-xl bg-secondary/70" />
        <div className="h-56 animate-pulse rounded-xl bg-secondary/50" />
      </div>
    </PageShell>
  );
}

function InvalidLink({ message }: { message: string }) {
  return (
    <PageShell>
      <header className="flex items-center justify-between">
        <Brand />
      </header>
      <div className="mt-20 text-center">
        <Eyebrow>Broken link</Eyebrow>
        <h1 className="mt-2 text-2xl font-bold">This group link isn't valid</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <Button asChild className="mt-6">
          <Link to="/">Start a new group</Link>
        </Button>
      </div>
    </PageShell>
  );
}
