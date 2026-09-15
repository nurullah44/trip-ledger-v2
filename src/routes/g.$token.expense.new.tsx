import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { Eyebrow, PageShell } from "@/components/layout";
import { ExpenseForm } from "@/components/expense-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ledgerErrorMessage, useGroup, useGroupMutations } from "@/lib/use-ledger";

export const Route = createFileRoute("/g/$token/expense/new")({
  component: NewExpense,
});

function NewExpense() {
  const { token } = Route.useParams();
  const router = useRouter();
  const { data, isError, error } = useGroup(token);
  const { createExpense } = useGroupMutations(token);

  const back = () => router.navigate({ to: "/g/$token", params: { token } });

  return (
    <PageShell>
      <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
        <Link to="/g/$token" params={{ token }}>
          <ArrowLeft className="size-4" /> Back to group
        </Link>
      </Button>

      <div className="mt-4">
        <Eyebrow>New expense</Eyebrow>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Add an expense</h1>
      </div>

      <Card className="clay-raised mt-6">
        <CardContent className="p-5 sm:p-6">
          {!data && !isError && <p className="text-sm text-muted-foreground">Loading group…</p>}
          {(isError || (data && data.group.status === "finished")) && (
            <p className="text-sm text-muted-foreground">
              {isError
                ? ledgerErrorMessage(error)
                : "This group is finished. Reopen it to add expenses."}
            </p>
          )}
          {data && data.group.status === "active" && (
            <ExpenseForm
              participants={data.participants}
              currency={data.group.currency}
              submitLabel="Add expense"
              pending={createExpense.isPending}
              onCancel={back}
              onSubmit={(input) =>
                createExpense.mutate(input, {
                  onSuccess: () => {
                    toast.success("Expense added");
                    back();
                  },
                  onError: (e) => toast.error(ledgerErrorMessage(e)),
                })
              }
            />
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
