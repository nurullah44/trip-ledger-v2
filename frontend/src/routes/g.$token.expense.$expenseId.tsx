import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { Eyebrow, PageShell } from "@/components/layout";
import { ExpenseForm } from "@/components/expense-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ledgerErrorMessage, useGroup, useGroupMutations } from "@/lib/use-ledger";

export const Route = createFileRoute("/g/$token/expense/$expenseId")({
  component: EditExpense,
});

function EditExpense() {
  const { token, expenseId } = Route.useParams();
  const router = useRouter();
  const { data, isError, error } = useGroup(token);
  const { updateExpense } = useGroupMutations(token);

  const back = () => router.navigate({ to: "/g/$token", params: { token } });
  const expense = data?.expenses.find((e) => e.id === expenseId);
  const finished = data?.group.status === "finished";

  return (
    <PageShell>
      <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
        <Link to="/g/$token" params={{ token }}>
          <ArrowLeft className="size-4" /> Back to group
        </Link>
      </Button>

      <div className="mt-4">
        <Eyebrow>Edit expense</Eyebrow>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Edit expense</h1>
      </div>

      <Card className="clay-raised mt-6">
        <CardContent className="p-5 sm:p-6">
          {!data && !isError && <p className="text-sm text-muted-foreground">Loading group…</p>}
          {isError && <p className="text-sm text-muted-foreground">{ledgerErrorMessage(error)}</p>}
          {data && !expense && (
            <p className="text-sm text-muted-foreground">This expense no longer exists.</p>
          )}
          {data && expense && finished && (
            <p className="text-sm text-muted-foreground">
              This group is finished. Reopen it to edit expenses.
            </p>
          )}
          {data && expense && !finished && (
            <ExpenseForm
              participants={data.participants}
              currency={data.group.currency}
              initial={expense}
              submitLabel="Save changes"
              pending={updateExpense.isPending}
              onCancel={back}
              onSubmit={(input) =>
                updateExpense.mutate(
                  { expenseId, input },
                  {
                    onSuccess: () => {
                      toast.success("Expense updated");
                      back();
                    },
                    onError: (e) => toast.error(ledgerErrorMessage(e)),
                  },
                )
              }
            />
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
