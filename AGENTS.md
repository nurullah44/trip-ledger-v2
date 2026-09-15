# Trip Ledger — agent notes

A responsive expense-splitting app built on TanStack Start + React 19 + Tailwind v4,
with shadcn/ui components. No backend: all data goes through a single service layer.

## Architecture

- `src/domain/` — pure logic, fully unit-tested. Money is integer minor units
  (`money.ts`), balances and greedy settlement live in `balances.ts`, and shared
  types in `types.ts`. Never do financial math with floats.
- `src/services/` — the one boundary for data access. Screens only ever call
  `ledgerService` (`services/index.ts`); today it's a localStorage-backed mock
  (`mock-ledger-service.ts`). Swap the singleton for a real backend later and no
  screen changes.
- `src/lib/use-ledger.ts` — React Query hooks wrapping the service. Group queries
  are client-gated because the mock reads localStorage.
- `src/routes/` — file-based routes: `/` (create), `/g/$token` (group),
  `/g/$token/expense/new` + `/g/$token/expense/$expenseId`, `/g/$token/settle`.
  Access (public vs. admin) is derived from which token resolves the group.
- `src/styles.css` — the "Clay receipt" design system. The `:root` block is the
  single source of truth for colour; don't hard-code hex in components.

## Conventions

- Keep the domain and service layers backend-agnostic and covered by tests
  (`npx vitest run`).
- Run `npm run lint` and `npm run build` before shipping.
