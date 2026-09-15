import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, Plus, ShieldCheck, Sparkles, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Brand, Eyebrow, PageShell } from "@/components/layout";
import { CopyField } from "@/components/copy-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CURRENCY_LIST, type CurrencyCode } from "@/domain/money";
import type { CreatedGroup } from "@/domain/types";
import { ledgerService } from "@/services";
import { ledgerErrorMessage } from "@/lib/use-ledger";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const [created, setCreated] = useState<CreatedGroup | null>(null);
  return (
    <PageShell>
      <header className="flex items-center justify-between">
        <Brand />
      </header>
      {created ? <Created result={created} /> : <CreateForm onCreated={setCreated} />}
    </PageShell>
  );
}

function CreateForm({ onCreated }: { onCreated: (group: CreatedGroup) => void }) {
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>("USD");
  const [people, setPeople] = useState<string[]>(["", ""]);

  const create = useMutation({
    mutationFn: () => ledgerService.createGroup({ name, currency, participantNames: people }),
    onSuccess: onCreated,
    onError: (error) => toast.error(ledgerErrorMessage(error)),
  });

  const setPerson = (index: number, value: string) =>
    setPeople((prev) => prev.map((p, i) => (i === index ? value : p)));
  const addPerson = () => setPeople((prev) => [...prev, ""]);
  const removePerson = (index: number) =>
    setPeople((prev) => (prev.length <= 2 ? prev : prev.filter((_, i) => i !== index)));

  const filled = people.map((p) => p.trim()).filter(Boolean).length;
  const canSubmit = name.trim().length > 0 && filled >= 2;

  return (
    <div className="mt-8">
      <Eyebrow>New group</Eyebrow>
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Start a trip ledger</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        Add everyone once, then log expenses as you go. No accounts — you'll get a link to share and
        a private admin link to keep.
      </p>

      <Card className="clay-raised mt-6">
        <CardContent className="p-5 sm:p-6">
          <form
            className="space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit) create.mutate();
            }}
          >
            <div className="grid gap-5 sm:grid-cols-[1fr_auto]">
              <div className="space-y-2">
                <Label htmlFor="group-name">Group name</Label>
                <Input
                  id="group-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Lisbon 2026"
                  autoFocus
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select value={currency} onValueChange={(v) => setCurrency(v as CurrencyCode)}>
                  <SelectTrigger id="currency" className="h-11 sm:w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCY_LIST.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        <span className="figure mr-2">{c.symbol}</span>
                        {c.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-muted-foreground" />
                <Label>Who's in?</Label>
              </div>
              <div className="space-y-2">
                {people.map((person, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={person}
                      onChange={(e) => setPerson(index, e.target.value)}
                      placeholder={`Person ${index + 1}`}
                      className="h-11"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground disabled:opacity-30"
                      disabled={people.length <= 2}
                      onClick={() => removePerson(index)}
                      aria-label="Remove person"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={addPerson}>
                <Plus className="size-4" />
                Add person
              </Button>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={!canSubmit || create.isPending}
            >
              {create.isPending ? "Creating…" : "Create group"}
              {!create.isPending && <ArrowRight className="size-4" />}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="mt-6 flex items-start gap-3 rounded-xl border border-border-soft bg-card/50 p-4 text-sm text-muted-foreground">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-meta" />
        <p>
          Equal splits, custom amounts, and a minimal settle-up plan are all built in. Everything is
          saved in your browser — no sign-up required.
        </p>
      </div>
    </div>
  );
}

function Created({ result }: { result: CreatedGroup }) {
  const router = useRouter();
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const sharedUrl = `${origin}/g/${result.publicToken}`;
  const adminUrl = `${origin}/g/${result.adminToken}`;

  return (
    <div className="mt-8">
      <Eyebrow>Group ready</Eyebrow>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">“{result.group.name}” is live</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        Two links, two jobs. Share the first with the group; keep the second to yourself.
      </p>

      <Card className="clay-raised mt-6">
        <CardContent className="space-y-6 p-5 sm:p-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-meta" />
              <p className="font-semibold">Shared group link</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Anyone with this link can view, add expenses, and record repayments.
            </p>
            <CopyField value={sharedUrl} label="Shared link" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-meta" />
              <p className="font-semibold">Private admin link</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Keep this one to yourself. It can do everything above, plus finish, reopen, or delete
              the group. Anyone with it has full control — there's no password.
            </p>
            <CopyField value={adminUrl} label="Admin link" />
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button
          size="lg"
          className="flex-1"
          onClick={() => router.navigate({ to: "/g/$token", params: { token: result.adminToken } })}
        >
          Open group
          <ArrowRight className="size-4" />
        </Button>
        <Button asChild size="lg" variant="secondary" className="flex-1">
          <Link to="/">Start another</Link>
        </Button>
      </div>
    </div>
  );
}
