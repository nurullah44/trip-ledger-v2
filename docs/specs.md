# Trip Ledger — Product Scope

Product scope for Trip Ledger. Stack and architecture: [architecture.md](architecture.md).

## Product Goal

Build a lightweight expense-splitting web app for trips and groups.

The product should use the fewest features possible while still supporting the complete workflow:

**Create group → add expenses → see balances → settle up → finish group**

The product is a **shared ledger**, not a payments platform.

---

## Core Product Decisions

### 1. Primary use case

The tool is designed for **trips and groups** where multiple people incur shared expenses over time and settle at the end.

It is not primarily optimized for one-off restaurant bills.

---

### 2. Accounts and identity

- No user accounts.

- No sign-in.

- No participant profiles.

- No persistent personal identity.

- Participants exist only as names inside a group.

- Visitors do not choose or claim an identity such as “I’m Alex.”

Access is entirely link-based.

---

### 3. Group access

Each group has two links:

#### Shared group link

Anyone with the link can:

- View the group.

- Add expenses.

- Edit expenses.

- Delete expenses.

- Add participants.

- Rename participants.

- Record repayments.

#### Private admin link

The creator receives a separate private admin link.

The admin can:

- Do everything available through the shared link.

- Lock/finish the group.

- Reopen the group.

- Delete the group.

There is:

- No password.

- No PIN.

- No account-based ownership.

Both links should use long, unguessable tokens.

---

## Group Model

A group contains:

- Group name.

- Currency.

- Participants.

- Expenses.

- Repayments.

- Current balances.

- Group status.

### Group status

A group has two states:

- **Active**

- **Finished / Locked**

When finished:

- The group becomes read-only.

- Existing information remains visible.

- Settlement information remains visible.

- The admin can reopen the group.

Groups remain available until explicitly deleted.

There is no automatic expiry.

---

## Currency

Each group uses exactly **one currency**.

Example:

- EUR

- USD

- TRY

All expenses and repayments inside the group use that currency.

No:

- Multi-currency expenses.

- Exchange rates.

- Currency conversion.

---

## Participants

Participants are simple names.

Example:

- Alex

- Sam

- Maya

- Jordan

Supported actions:

- Add participant.

- Rename participant.

A participant does not need to be linked to a real user.

The system should prevent destructive changes that would make historical ledger entries invalid. For example, a participant referenced by existing expenses should not simply disappear without resolving those entries.

---

## Expenses

Each expense has:

- Description.

- Amount.

- Date.

- One payer.

- Included participants.

- Split method.

- Split values.

### Payer

Each expense has exactly **one payer**.

Multiple payers are not supported.

If two people jointly paid for something, the user can create two expenses instead.

---

## Split Methods

Two split methods are supported.

### Equal split

The amount is divided equally among the selected participants.

Example:

Dinner: $90

Participants:

- Alex

- Sam

- Maya

Each owes:

- $30

---

### Custom amounts

The creator manually specifies exactly how much each selected participant owes.

Example:

Hotel: $300

- Alex: $100

- Sam: $80

- Maya: $120

The custom amounts must add up to the total expense.

---

## Participant Selection Per Expense

Each expense may involve:

- Everyone in the group.

- Any subset of participants.

Example:

A taxi used only by Alex and Sam should not affect Maya.

---

## Balances

Balances update automatically whenever an expense or repayment is added, edited, or deleted.

The system calculates each participant's **net balance**.

Conceptually:

**Net balance = amount paid on behalf of others − amount personally owed + repayments received − repayments sent**

The UI should make it easy to understand:

- Who is owed money.

- Who owes money.

- Whether the group is fully settled.

---

## Settlement Optimization

The app should calculate a settlement plan that minimizes the number of transfers needed.

Settlement optimization is based entirely on each participant's **net balance**.

The optimizer does not preserve the original debtor-creditor relationships.

Example:

Even if Alex never directly owed Sam for a specific expense, the system may suggest:

> Alex pays Sam $42

if that reduces the total number of transfers.

---

## Repayments

Repayments are ledger events.

A repayment contains:

- Payer.

- Recipient.

- Amount.

- Date.

Example:

> Alex paid Sam $30

Repayments immediately update balances.

Users may record:

- Full settlements.

- Partial repayments.

- Payments that differ from the suggested settlement plan.

The system does not restrict repayments to suggested transfers.

---

## Settle Up Flow

Settling up has a dedicated screen.

It should show:

- Current net balances.

- Minimum-transfer settlement suggestions.

- Ability to record a repayment.

Example:

### Suggested payments

- Alex → Sam: $42

- Maya → Jordan: $18

After a repayment is recorded, the settlement plan recalculates.

When all balances are zero, the group is settled.

---

## Main Group Screen

The product is **expense-first**.

The main group screen should prioritize:

1. Group name and status.

2. Primary **Add expense** action.

3. Recent expenses.

4. Current balance summary.

5. Access to **Settle up**.

Balances should remain easy to reach but should not dominate the primary workflow.

---

## Collaboration Model

The app supports shared editing through the group link.

However, **real-time collaboration is not required**.

Changes made by another user may become visible after:

- Refreshing the page.

- Reopening the group.

- Navigating back to the group.

No WebSocket or live-presence infrastructure is required for v1.

Conflicting simultaneous edits can be handled using a simple last-write-wins approach or basic optimistic concurrency safeguards.

---

## Platform

The product is a **responsive web application only**.

It should work well on:

- Mobile browsers.

- Tablets.

- Desktop browsers.

No native:

- iOS app.

- Android app.

---

## Payments

The product does **not move money**.

It only:

- Calculates balances.

- Suggests settlements.

- Records repayments that happened elsewhere.

No integrations with:

- Banks.

- Cards.

- PayPal.

- Venmo.

- Revolut.

- Wise.

- Other payment providers.

---

## Explicitly Out of Scope for V1

The following features should not be built initially:

- User accounts.

- Authentication.

- User profiles.

- Friends or contacts.

- Native mobile apps.

- Multi-currency groups.

- Exchange rates.

- Multiple payers per expense.

- Percentage splits.

- Weighted shares.

- Receipt uploads.

- Receipt scanning / OCR.

- Expense categories.

- Budgets.

- Spending analytics.

- Charts.

- Comments.

- Reactions.

- Notifications.

- Email invites.

- Push notifications.

- Activity feed.

- Edit history.

- Audit log.

- Real-time collaboration.

- Offline mode.

- Exports.

- CSV export.

- PDF reports.

- Payment integrations.

- Bank integrations.

- Recurring expenses.

- Templates.

- Search.

- Advanced filtering.

- Participant accounts.

- Permissions per participant.

These should only be added later if real usage clearly demonstrates the need.

---

## Minimum Screens

The entire product can likely be implemented with approximately five core views.

### 1. Home / Create Group

Fields:

- Group name.

- Currency.

- Initial participant names.

Action:

- Create group.

After creation, show:

- Shared group link.

- Private admin link.

The admin link should be clearly described as something the creator should keep private.

---

### 2. Group Screen

Shows:

- Group name.

- Status.

- Participants.

- Recent expenses.

- Add expense button.

- Balance summary.

- Settle up entry point.

Admin users additionally see:

- Finish / lock group.

- Delete group.

---

### 3. Add / Edit Expense

Fields:

- Description.

- Amount.

- Date.

- Payer.

- Participants included.

- Split method:

  - Equal.

  - Custom amounts.

For custom splits, validate that participant amounts equal the total.

---

### 4. Settle Up

Shows:

- Net balance per participant.

- Optimized payment suggestions.

- Record repayment action.

---

### 5. Record Repayment

Fields:

- Payer.

- Recipient.

- Amount.

- Date.

After submission, return to the settlement screen with recalculated balances.

---

## Core Data Model

A deliberately small schema could look like this.

### Group

- id

- name

- currency

- public_token

- admin_token

- status

- created_at

- updated_at

### Participant

- id

- group_id

- name

- created_at

### Expense

- id

- group_id

- description

- amount

- paid_by_participant_id

- expense_date

- created_at

- updated_at

### ExpenseSplit

- id

- expense_id

- participant_id

- amount

Even equal splits can be stored as explicit split amounts after calculation. This keeps downstream balance calculations simple.

### Repayment

- id

- group_id

- payer_participant_id

- recipient_participant_id

- amount

- payment_date

- created_at

---

## Important Validation Rules

The product should enforce a small number of strong rules.

### Expense rules

- Amount must be greater than zero.

- A payer must be selected.

- At least one participant must be included.

- Every included participant must belong to the group.

- Split amounts must sum exactly to the expense total.

### Repayment rules

- Amount must be greater than zero.

- Payer and recipient must be different.

- Both must belong to the group.

### Currency precision

Store money using integer minor units where possible.

Example:

- $10.25 → 1025 cents.

Avoid floating-point arithmetic for financial calculations.

For currencies without standard decimal minor units, the currency definition should determine the precision.

---

## Equal-Split Rounding

Equal division may produce fractions smaller than the currency allows.

Example:

$10 / 3 = $3.333...

The system should:

1. Calculate in integer minor units.

2. Divide as evenly as possible.

3. Distribute remaining minor units deterministically.

Example:

$10.00 among three people:

- $3.34

- $3.33

- $3.33

The result must always sum exactly to the original expense.

---

## Settlement Algorithm

Settlement calculation can work from net balances.

Example:

- Alex: -$40

- Maya: -$20

- Sam: +$35

- Jordan: +$25

The system matches debtors and creditors until balances reach zero.

One valid optimized result:

- Alex → Sam: $35

- Alex → Jordan: $5

- Maya → Jordan: $20

The exact ordering does not matter as long as:

- Every balance reaches zero.

- No unnecessary transfers are created.

For typical small travel groups, a greedy debtor-creditor matching algorithm is sufficient and easy to reason about.

---

## UX Principles

### Optimize for speed

Adding an expense should take only a few interactions.

Default sensible values whenever possible:

- Date defaults to today.

- All participants can initially be selected.

- Equal split can be the default.

- Last-used payer may optionally be remembered locally in the browser if useful.

### Avoid configuration

The product should not ask users to configure things they can reasonably change later.

### Keep financial state obvious

Every important screen should make it clear whether:

- Someone owes money.

- Someone is owed money.

- Everyone is settled.

### Make destructive actions deliberate

Deleting:

- Expenses.

- Groups.

should require a clear confirmation.

---

## V1 Success Criterion

The product is successful if a group of friends can:

1. Open the website.

2. Create a trip.

3. Add participant names.

4. Share one link.

5. Add expenses throughout the trip.

6. See accurate balances.

7. Get a minimal settlement plan.

8. Record payments.

9. Reach a zero balance.

10. Finish the group.

They should be able to do all of this **without creating an account, installing an app, configuring permissions, or connecting a payment service**.

---

## Product Definition in One Sentence

> A no-account, link-based shared expense ledger for trips that tracks expenses, calculates net balances, and generates the fewest transfers needed to settle the group.

---

## Scope Decision

There are no unresolved questions that block an initial implementation.

Remaining choices are mostly implementation and UX details rather than product-direction decisions, so they can be decided during design and development without expanding the product scope.
