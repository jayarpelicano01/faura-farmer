# Faura-Farmer Mobile Feature Parity Specification

> **Status:** Spec created; implementation pending.
> **Scope:** Four features to bring mobile app to parity with web: FAB, Profile, Budgets, Reports.
> **Reference:** `COMPONENT_STYLE_PARITY_SPEC.md` (completed), web screens at `apps/web/src/app/(dashboard)/`.

## 1. Objective

Bring the Expo mobile app to feature parity with the Next.js web application by implementing the missing screens and interactions: a global floating action button, profile editing, offline-synced budgets, and API-backed reports with charts.

## 2. Scope and Non-goals

### In scope

- Global floating action button (FAB) matching the web's `FloatingActions` component.
- Profile editing via the existing "More" screen (view-first, then editable).
- Budgets screen with per-category budgets, monthly household budget, and 50/30/20 bucket breakdown.
- Reports screen with cash flow charts, budget variance, category comparison, and account spending.
- Offline-first sync for budgets (per-category and monthly) via the existing mobile sync system.
- API routes for reports (mobile-specific, reusing web query functions).

### Out of scope

- Recurring transactions (separate future work).
- CSV import/export (separate future work).
- Receipt photo attachments (separate future work).
- OAuth login on mobile (email/password only for now).
- Changing desktop web layout or navigation behavior.
- Chart library installation until Phase 4.

## 3. Implementation Order

| Phase | Feature | Effort | New Files | Modified Files |
|---|---|---|---|---|
| 1 | FAB | Small | 1 | 3 |
| 2 | Profile (enhance More) | Medium | 0 | 2 |
| 3 | Budgets (offline-first) | Large | 1 | 7 |
| 4 | Reports (API-only) | Large | 5 | 3 |

**Total: 7 new files, 15 modified files**

## 4. Phase 1: Floating Action Button

### 4.1 Goal

Add a global FAB matching the web's `FloatingActions` component — a 56px circle at bottom-right that expands into a slide-up menu with quick-create actions.

### 4.2 Files

| Action | File | Purpose |
|---|---|---|
| Create | `apps/mobile/src/ui/floating-actions.tsx` | FAB component with slide-up menu |
| Modify | `apps/mobile/src/ui/app-shell.tsx` | Render `<FloatingActions />` over content |
| Modify | `apps/mobile/app/(tabs)/transactions.tsx` | Read `?type=` query param, auto-open modal |
| Modify | `apps/mobile/app/(tabs)/accounts.tsx` | Read `?new=1` query param, auto-open modal |

### 4.3 FAB Actions

| Action | Icon (lucide-react-native) | Navigation Target |
|---|---|---|
| Log income | `ArrowUpFromLine` | `/transactions?type=income` |
| Log expense | `ArrowDownToLine` | `/transactions?type=expense` |
| Log transfer | `ArrowLeftRight` | `/transactions?type=transfer` |
| Add account | `PiggyBank` | `/accounts?new=1` |
| Add category | `PieChart` | `/categories` |

### 4.4 Behavior

- Hidden on `/more` route (checked via `usePathname()`).
- Route change auto-closes the menu.
- Tapping "+" opens the slide-up menu.
- Tapping an action navigates to the target screen and closes the menu.
- Tapping "X" or backdrop dismisses the menu.

### 4.5 Animation

- Button icon: swaps between `Plus` (rest) and `X` (open).
- Menu items: translate from Y +20 to Y 0 with opacity 0 to 1, staggered by 30ms per item.
- Duration: 200ms for the container, staggered for items.

### 4.6 Styling

| Property | Value |
|---|---|
| Button size | 56px × 56px |
| Button radius | 28px (full circle) |
| Button rest color | `theme.primarySolid` |
| Button open color | `theme.danger` |
| Button icon color | White |
| Menu background | `theme.card` |
| Menu border | 1px `theme.border` |
| Menu radius | 12px |
| Menu shadow | `theme.shadow` |
| Menu item padding | 12px 16px |
| Menu item icon | 16px, `theme.primary` color |
| Menu item label | 14px, `theme.foreground`, weight 500 |
| Menu position | Fixed bottom-right, 24px from edges |
| Z-index | 50 |
| Minimum touch target | 44px |

### 4.7 AppShell Integration

In `app-shell.tsx`, add `<FloatingActions />` as a sibling to the content `View`, positioned absolutely:

```tsx
<View style={styles.content}>{children}</View>
<FloatingActions />
```

The FAB sits inside the `SafeAreaView` but floats above content. It must not overlap the sync status bar or the header.

### 4.8 Transaction Screen Changes

Currently `transactions.tsx` opens the modal via `setEditing(blankTransaction(...))`. Add query param reading:

- On mount, check `useLocalSearchParams()` for `type` param.
- If `type` is `income`, `expense`, or `transfer`, auto-call `begin()` with that type pre-selected.
- The `blankTransaction()` function already accepts an `accountId` — modify to also accept an optional `type` override.

### 4.9 Account Screen Changes

Currently `accounts.tsx` opens the modal via `setEditing(blankAccount())`. Add query param reading:

- On mount, check `useLocalSearchParams()` for `new` param.
- If `new === '1'`, auto-call `setEditing(blankAccount())`.

### 4.10 Verification

- FAB visible on dashboard, transactions, accounts, categories.
- FAB hidden on more page.
- Tapping "+" opens slide-up menu with 5 actions.
- Each action navigates to correct screen and opens the modal.
- "X" or backdrop closes menu.
- Route change closes menu.
- Works in light and dark themes.
- 44px minimum touch targets maintained.

---

## 5. Phase 2: Profile (Enhance More Screen)

### 5.1 Goal

Enhance the existing "More" screen to include profile editing, password management, and OAuth connection management. The screen starts in read-only mode with an "Edit Profile" button to enable editing.

### 5.2 Files

| Action | File | Purpose |
|---|---|---|
| Modify | `apps/mobile/app/(tabs)/more.tsx` | Add view/edit modes, password card, OAuth connections |
| Modify | `apps/web/src/app/api/profile/route.ts` | Add GET handler (currently only PATCH exists) |

### 5.3 Screen Layout

```
[Card: Personal Information]
  Read-only mode:
    - Name: displayed as text
    - Email: displayed as text (read-only, disabled style)
    - Username: displayed as text
    - "Edit Profile" button (outline variant)

  Edit mode:
    - Name: editable text field
    - Email: disabled text field (same as web)
    - Username: editable text field
    - "Save changes" button (default variant)
    - "Cancel" button (outline variant)

[Card: Change Password] (only if user has password)
  Read-only mode:
    - "Your password is set and secure"
    - "Change Password" button (outline variant)

  Edit mode:
    - Current password field (secure entry)
    - New password field (secure entry)
    - Confirm password field (secure entry)
    - Password requirements text:
      - Minimum 8 characters
      - At least one uppercase letter
      - At least one lowercase letter
      - At least one digit
      - At least one special character
    - "Update Password" button (default variant)
    - "Cancel" button (outline variant)

[Card: Connected Accounts]
  - Google: Connected/Not connected status + Connect/Disconnect button
  - Facebook: Connected/Not connected status + Connect/Disconnect button
  - Security note: "You must have at least one sign-in method"

[Card: Theme]
  - Light/Dark toggle (existing, unchanged)

[Footer: Logout button] (existing, unchanged)
```

### 5.4 API Calls

| Action | Endpoint | Method | Notes |
|---|---|---|---|
| Fetch profile | `/api/profile` | GET | New endpoint needed |
| Update profile | `/api/profile` | PATCH | Existing |
| Change password | `/api/profile/password` | POST | Existing |
| Connect OAuth | `/api/profile/connections/[provider]` | POST | Existing |
| Disconnect OAuth | `/api/profile/connections/[provider]` | DELETE | Existing |

### 5.5 Behavior

- Fields start read-only.
- "Edit Profile" toggles to edit mode, preserving original values for cancel.
- "Cancel" reverts to read-only with original values.
- "Save" calls `PATCH /api/profile` and updates local state.
- Password change calls `POST /api/profile/password`, then signs out.
- OAuth connect uses same flow as web (opens browser for OAuth callback).
- OAuth disconnect requires confirmation, then signs out.

### 5.6 Validation

- Name: max 120 characters, optional.
- Username: 3-30 characters, alphanumeric + `_.-`, unique across users, lowercased on save.
- New password: 8-128 characters, at least one lowercase, one uppercase, one digit, one special character.
- Current password required for password change.

### 5.7 Verification

- Profile loads with current user data.
- Read-only mode shows all fields correctly.
- "Edit Profile" toggles to edit mode.
- Save updates profile via API.
- Cancel reverts changes.
- Password card only shown if user has password.
- Password change signs out after success.
- OAuth connections show correct status.
- Works in light and dark themes.

---

## 6. Phase 3: Budgets (Offline-First)

### 6.1 Goal

Add a budgets screen with per-category budgets, monthly household budget, and 50/30/20 bucket breakdown. Budgets must be offline-first, synced via the existing mobile sync system.

### 6.2 Files

| Action | File | Purpose |
|---|---|---|
| Create | `apps/mobile/app/(tabs)/budgets.tsx` | Budgets screen |
| Modify | `packages/types/src/mobile.ts` | Add `MobileBudget` + `MobileMonthlyBudget` schemas, update entity unions |
| Modify | `apps/mobile/src/data/db.ts` | Add `budgets` + `monthly_budgets` tables, update Entity type |
| Modify | `apps/mobile/src/sync/sync.ts` | Handle budget + monthly_budget entities in pull |
| Modify | `apps/web/src/lib/mobile/sync.ts` | Add budget + monthly_budget upsert/delete handlers, serialization |
| Modify | `apps/mobile/src/ui/app-shell.tsx` | Add "Budgets" to navigation items |
| Modify | `apps/mobile/app/(tabs)/_layout.tsx` | Add `<Stack.Screen name="budgets" />` |
| Modify | `apps/mobile/src/ui/floating-actions.tsx` | Add "New budget" action |

### 6.3 Schema Changes

#### 6.3.1 `packages/types/src/mobile.ts`

Add new schemas:

```ts
export const mobileBudgetSchema = z.object({
  id: uuid,
  categoryId: uuid,
  monthlyLimit: positiveDecimalString,
  updatedAt: z.string().datetime(),
});

export const mobileMonthlyBudgetSchema = z.object({
  id: uuid,
  amount: positiveDecimalString,
  updatedAt: z.string().datetime(),
});

export type MobileBudget = z.infer<typeof mobileBudgetSchema>;
export type MobileMonthlyBudget = z.infer<typeof mobileMonthlyBudgetSchema>;
```

Update entity discriminated unions:

- `mobileEntitySchema`: add `{ entity: z.literal('budget'), record: mobileBudgetSchema }` and `{ entity: z.literal('monthly_budget'), record: mobileMonthlyBudgetSchema }`.
- `mobileSyncMutationSchema`: add `budget` + `monthly_budget` to entity enum, add schemas to record union.
- `MobileSyncChange`: add `budget` + `monthly_budget` to entity type, add types to record type.

#### 6.3.2 `apps/mobile/src/data/db.ts`

Add tables:

```sql
CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY NOT NULL,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS monthly_budgets (
  id TEXT PRIMARY KEY NOT NULL,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
```

Update type definitions:

```ts
type Entity = 'account' | 'category' | 'transaction' | 'budget' | 'monthly_budget';
type RecordFor<E extends Entity> =
  E extends 'account' ? MobileAccount
  : E extends 'category' ? MobileCategory
  : E extends 'transaction' ? MobileTransaction
  : E extends 'budget' ? MobileBudget
  : MobileMonthlyBudget;
type LocalRecord = MobileAccount | MobileCategory | MobileTransaction | MobileBudget | MobileMonthlyBudget;
```

Update `tableByEntity`:

```ts
const tableByEntity: Record<Entity, string> = {
  account: 'accounts',
  category: 'categories',
  transaction: 'transactions',
  budget: 'budgets',
  monthly_budget: 'monthly_budgets',
};
```

#### 6.3.3 `apps/web/src/lib/mobile/sync.ts`

Add serialization functions:

```ts
function serializeBudget(budget: Budget): MobileBudget {
  return {
    id: budget.id,
    categoryId: budget.categoryId,
    monthlyLimit: budget.monthlyLimit.toString(),
    updatedAt: budget.createdAt.toISOString(),
  };
}

function serializeMonthlyBudget(monthlyBudget: MonthlyBudget): MobileMonthlyBudget {
  return {
    id: monthlyBudget.id,
    amount: monthlyBudget.amount.toString(),
    updatedAt: new Date().toISOString(),
  };
}
```

Add upsert/delete handlers:

```ts
async function upsertBudget(tx: Tx, userId: string, mutation: UpsertMutation) {
  const record = mutation.record as MobileBudget;
  if (await tombstoneAfter(tx, userId, 'budget', record.id, mutation.baseCursor)) {
    throw new SyncRejection('TOMBSTONED', 'This budget was deleted on another device');
  }
  const category = await tx.category.findFirst({ where: { id: record.categoryId, userId }, select: { id: true, type: true } });
  if (!category) throw new SyncRejection('CATEGORY_NOT_FOUND', 'Budget category was not found');
  if (category.type !== 'expense') throw new SyncRejection('INVALID_CATEGORY', 'Budgets can only be set on expense categories');

  const existing = await tx.budget.findFirst({ where: { userId, categoryId: record.categoryId }, select: { id: true } });
  const data = { monthlyLimit: new Prisma.Decimal(record.monthlyLimit) };

  const saved = existing
    ? await tx.budget.update({ where: { id: existing.id }, data })
    : await tx.budget.create({ data: { userId, categoryId: record.categoryId, ...data } });

  await appendChange(tx, userId, 'budget', saved.id, 'upsert', serializeBudget(saved));
}

async function deleteBudget(tx: Tx, userId: string, recordId: string) {
  const budget = await tx.budget.findFirst({ where: { id: recordId, userId }, select: { id: true } });
  if (!budget) return;
  await tx.budget.delete({ where: { id: recordId } });
  await appendChange(tx, userId, 'budget', recordId, 'delete', null);
}

async function upsertMonthlyBudget(tx: Tx, userId: string, mutation: UpsertMutation) {
  const record = mutation.record as MobileMonthlyBudget;
  if (await tombstoneAfter(tx, userId, 'monthly_budget', record.id, mutation.baseCursor)) {
    throw new SyncRejection('TOMBSTONED', 'This monthly budget was deleted on another device');
  }
  const existing = await tx.monthlyBudget.findFirst({ where: { userId }, select: { id: true } });
  const data = { amount: new Prisma.Decimal(record.amount) };

  const saved = existing
    ? await tx.monthlyBudget.update({ where: { id: existing.id }, data })
    : await tx.monthlyBudget.create({ data: { userId, ...data } });

  await appendChange(tx, userId, 'monthly_budget', saved.id, 'upsert', serializeMonthlyBudget(saved));
}

async function deleteMonthlyBudget(tx: Tx, userId: string, recordId: string) {
  const existing = await tx.monthlyBudget.findFirst({ where: { id: recordId, userId }, select: { id: true } });
  if (!existing) return;
  await tx.monthlyBudget.delete({ where: { id: recordId } });
  await appendChange(tx, userId, 'monthly_budget', recordId, 'delete', null);
}
```

Update `processMobileMutation()`:

```ts
if (mutation.entity === 'budget' && mutation.operation === 'upsert') await upsertBudget(tx, userId, mutation);
if (mutation.entity === 'budget' && mutation.operation === 'delete') await deleteBudget(tx, userId, mutation.recordId);
if (mutation.entity === 'monthly_budget' && mutation.operation === 'upsert') await upsertMonthlyBudget(tx, userId, mutation);
if (mutation.entity === 'monthly_budget' && mutation.operation === 'delete') await deleteMonthlyBudget(tx, userId, mutation.recordId);
```

Update `recordCanonicalMobileUpsert()`:

```ts
if (entity === 'budget') {
  const record = await tx.budget.findFirst({ where: { id: recordId, userId }, select: { id: true, categoryId: true, monthlyLimit: true, createdAt: true } });
  if (record) await appendChange(tx, userId, entity, record.id, 'upsert', serializeBudget(record));
}
if (entity === 'monthly_budget') {
  const record = await tx.monthlyBudget.findFirst({ where: { id: recordId, userId }, select: { id: true, amount: true } });
  if (record) await appendChange(tx, userId, entity, record.id, 'upsert', serializeMonthlyBudget(record));
}
```

#### 6.3.4 `apps/mobile/src/sync/sync.ts`

Update the pull handler to apply budget and monthly_budget changes:

```ts
if (change.entity === 'budget' || change.entity === 'monthly_budget') {
  const entity = change.entity as Entity;
  if (change.operation === 'delete') {
    await db.runAsync(`UPDATE ${table(entity)} SET deleted_at = ? WHERE id = ?`, [new Date().toISOString(), change.recordId]);
  } else if (change.record) {
    await upsertRecord(db, entity, change.record);
  }
}
```

### 6.4 Budget Sync Behavior

- Budgets sync like accounts, categories, and transactions.
- Monthly budget syncs as a single-record entity (one per user).
- CRUD operations go through `queueUpsert` / `queueDelete` → outbox → push.
- Pull receives budget changes and applies them to local SQLite.
- Offline: budgets work normally from local SQLite.
- Online: changes sync bidirectionally.

### 6.5 Screen Layout

```
[Header: "Budgets" + subtitle + "New" button]

[MonthlyBudgetGuide card]
  - Total monthly budget in large text (e.g. "PHP 50,000")
  - "Defaulted to this month's income" or "You set this" label
  - Three bucket cards (Needs, Wants, Savings):
    - Each: colored dot (teal/amber/indigo) + label
    - Description (e.g. "Housing, food, bills")
    - Progress bar (green when under, red when over)
    - "PHP X,XXX of PHP X,XXX" + "PHP X,XXX remaining" or "PHP X,XXX over"
  - Unallocated spending card (if any): dashed border, shows amount
  - Warning banner: "Total budget limits exceed your monthly budget" (orange)

[Budget cards (2-column grid on tablet, 1-column on phone)]
  Each card:
    - Category circle (colored) + category name
    - "PHP 3,200 of PHP 5,000 spent"
    - Progress bar (green when under, red when over)
    - "64% used" + "PHP 1,800 left" or "PHP 200 over"
    - Over-budget badge (red, warning icon) if over
    - Edit (pencil) + Delete (trash) ghost icon buttons

[Empty state]
  - "Set budgets to track your spending limits."

[New/Edit Budget modal]
  - Category selector (expense categories only, as ChoiceChips)
  - Monthly limit input (number, decimal-pad keyboard)
  - "Add budget" or "Save changes" button
  - "Cancel" button

[Monthly Budget modal]
  - Single number input for total monthly amount
  - "Save" button
  - "Cancel" button
```

### 6.6 Business Rules

- Budgets only on expense categories (enforced on upsert).
- One budget per category per user (unique constraint).
- One monthly budget per user (unique constraint).
- Spending = this category + all descendants (current month).
- Conflict detection: no overlapping ancestor/descendant budgets.
- Monthly budget defaults to current month's income if not set.
- Bucket allocation: 50% needs, 30% wants, 20% savings (computed from monthly budget).

### 6.7 Verification

- Budgets screen loads from local SQLite (offline-first).
- Creating a budget saves locally and queues for sync.
- Editing a budget updates locally and queues for sync.
- Deleting a budget removes locally and queues for sync.
- Monthly budget saves locally and queues for sync.
- Sync pushes budget changes to server.
- Sync pulls budget changes from server.
- Budgets work when offline.
- Progress bars show correct spent/limit ratios.
- Over-budget badges appear when spending exceeds limit.
- Category selector only shows expense categories.
- Works in light and dark themes.

---

## 7. Phase 4: Reports (API-Only)

### 7.1 Goal

Add a reports screen with cash flow charts, budget variance, category comparison, and account spending. Reports are API-only (not offline-synced) because the web's report queries are server-side Prisma calls with no existing API routes.

### 7.2 Files

| Action | File | Purpose |
|---|---|---|
| Create | `apps/mobile/app/(tabs)/reports.tsx` | Reports screen |
| Create | `apps/web/src/app/api/mobile/v1/reports/cash-flow/route.ts` | Cash flow report API |
| Create | `apps/web/src/app/api/mobile/v1/reports/budget-variance/route.ts` | Budget variance API |
| Create | `apps/web/src/app/api/mobile/v1/reports/category-comparison/route.ts` | Category comparison API |
| Create | `apps/web/src/app/api/mobile/v1/reports/account-spending/route.ts` | Account spending API |
| Modify | `apps/mobile/src/ui/app-shell.tsx` | Add "Reports" to navigation items |
| Modify | `apps/mobile/app/(tabs)/_layout.tsx` | Add `<Stack.Screen name="reports" />` |
| Modify | `apps/mobile/package.json` | Install `react-native-gifted-charts` |

### 7.3 API Route Structure

Each route follows the same pattern:

```ts
import { auth } from '@/lib/auth';
import { badRequest, ok, unauthorized } from '@/lib/http';
import { mobileApiDisabledResponse, mobileApiIsEnabled } from '@/lib/mobile/availability';
import { authenticateMobileRequest } from '@/lib/mobile/auth';
import { getCashFlowReport } from '@/lib/queries';
import { getReportRange, parseReportDate, parseReportMonth } from '@/lib/reporting';

export async function GET(request: Request) {
  if (!mobileApiIsEnabled()) return mobileApiDisabledResponse();
  const user = await authenticateMobileRequest(request);
  if (!user) return unauthorized();

  const params = new URL(request.url).searchParams;
  const period = params.get('period') ?? 'month';
  const currency = params.get('currency') ?? 'PHP';
  const anchor = period === 'week' ? parseReportDate(params.get('end')) : parseReportMonth(params.get('month'));
  const range = getReportRange(period, anchor);

  const data = await getCashFlowReport(user.id, currency, range);
  return ok(data);
}
```

### 7.4 API Endpoints

| Endpoint | Query Function | Parameters |
|---|---|---|
| `GET /api/mobile/v1/reports/cash-flow` | `getCashFlowReport()` | `period`, `currency`, `month` or `end` |
| `GET /api/mobile/v1/reports/budget-variance` | `getBudgetVarianceReport()` | `period`, `currency`, `month` or `end` |
| `GET /api/mobile/v1/reports/category-comparison` | `getCategoryComparisonReport()` | `period`, `currency`, `month` or `end` |
| `GET /api/mobile/v1/reports/account-spending` | `getAccountSpendingReport()` | `period`, `currency`, `month` or `end` |

### 7.5 Screen Layout

```
[Header: "Reports" + subtitle]

[Period toggle: "Rolling 7 days" | "Monthly"]
  - Pill switch, same as web

[Date picker]
  - Date input (week mode) or month input (month mode)

[Currency selector]
  - Dropdown or ChoiceChips for multi-currency users

[Card: Cash Flow]
  - 4 metric boxes in 2x2 grid:
    - Income (green, +icon)
    - Expenses (red, -icon)
    - Net cash flow (primary)
    - Savings rate (percentage)
  - Line chart (react-native-gifted-charts):
    - 3 lines: Income (green), Expenses (red), Net (primary)
    - X-axis: date labels
    - Y-axis: currency amounts
    - Tooltips on tap

[Card: Budget vs Actual]
  - Table rows:
    - Category (colored dot + name)
    - Budget limit
    - Spent
    - Remaining (or "over")
    - Progress bar (green/red)
  - "Unbudgeted spending" row (if any)
  - "Uncategorized spending" row (if any)
  - Empty state: "Set budgets to see variance."

[Card: Spending Comparison]
  - Table rows:
    - Category (colored dot + name)
    - Current period amount
    - Previous period amount
    - Change (signed amount + percentage)
  - Sorted by current spending descending

[Card: Spending by Account]
  - Account rows:
    - Account name + type
    - Horizontal progress bar (primary color fill)
    - Amount + percentage share
  - Archived accounts labeled
```

### 7.6 Chart Library

Install `react-native-gifted-charts` in this phase:

```bash
cd apps/mobile && npx expo install react-native-gifted-charts react-native-linear-gradient react-native-svg
```

Use `LineChart` component for the cash flow visualization:

```tsx
import { LineChart } from 'react-native-gifted-charts';

<LineChart
  data={incomeData}
  data2={expenseData}
  data3={netData}
  width={300}
  height={200}
  color={theme.income}
  color2={theme.expense}
  color3={theme.primary}
  // ... additional props
/>
```

### 7.7 Data Flow

1. Mobile app calls API route with Bearer token.
2. API route authenticates via `authenticateMobileRequest()`.
3. API route calls query function from `lib/queries.ts` (same as web).
4. Query function runs Prisma query against database.
5. API route returns JSON response.
6. Mobile app renders charts and tables.

### 7.8 Verification

- Reports screen loads with default period (monthly).
- Period toggle switches between weekly and monthly.
- Date picker changes the anchor date.
- Currency selector filters transactions by currency.
- Cash flow chart renders with 3 lines.
- Budget variance table shows correct spent/limit ratios.
- Category comparison shows current vs previous period.
- Account spending shows correct percentages.
- Empty states appear when no data.
- Works in light and dark themes.
- Charts are responsive and scrollable.

---

## 8. Navigation Items (Final)

After all phases, the drawer will have:

1. Dashboard
2. Accounts
3. Transactions
4. Categories
5. Budgets
6. Reports
7. More (profile + theme + logout)

Drawer button sizes can be adjusted later to fit all 7 items. The current drawer uses 60px minimum height per item, which may need to be reduced to fit 7 items on smaller screens.

---

## 9. Files Changed Summary

### New Files (7)

| File | Phase | Purpose |
|---|---|---|
| `apps/mobile/src/ui/floating-actions.tsx` | 1 | FAB component |
| `apps/mobile/app/(tabs)/budgets.tsx` | 3 | Budgets screen |
| `apps/mobile/app/(tabs)/reports.tsx` | 4 | Reports screen |
| `apps/web/src/app/api/mobile/v1/reports/cash-flow/route.ts` | 4 | Cash flow API |
| `apps/web/src/app/api/mobile/v1/reports/budget-variance/route.ts` | 4 | Budget variance API |
| `apps/web/src/app/api/mobile/v1/reports/category-comparison/route.ts` | 4 | Category comparison API |
| `apps/web/src/app/api/mobile/v1/reports/account-spending/route.ts` | 4 | Account spending API |

### Modified Files (12)

| File | Phase | Changes |
|---|---|---|
| `apps/mobile/src/ui/app-shell.tsx` | 1, 3, 4 | Add FAB, navigation items |
| `apps/mobile/app/(tabs)/transactions.tsx` | 1 | Read `?type=` query param |
| `apps/mobile/app/(tabs)/accounts.tsx` | 1 | Read `?new=1` query param |
| `apps/mobile/app/(tabs)/more.tsx` | 2 | Add profile edit, password, OAuth |
| `apps/web/src/app/api/profile/route.ts` | 2 | Add GET handler |
| `packages/types/src/mobile.ts` | 3 | Add budget + monthly_budget schemas |
| `apps/mobile/src/data/db.ts` | 3 | Add budget + monthly_budget tables |
| `apps/mobile/src/sync/sync.ts` | 3 | Handle budget entities in pull |
| `apps/web/src/lib/mobile/sync.ts` | 3 | Add budget sync handlers |
| `apps/mobile/app/(tabs)/_layout.tsx` | 3, 4 | Add screens |
| `apps/mobile/src/ui/floating-actions.tsx` | 3 | Add budget action |
| `apps/mobile/package.json` | 4 | Install chart library |

---

## 10. Risks and Rollback

| Risk | Mitigation |
|---|---|
| FAB overlaps with bottom tab bar or safe area | Position above safe area inset, test on multiple device sizes |
| Budget sync conflicts when editing on multiple devices | Use existing tombstone + conflict detection mechanism |
| Reports API routes expose sensitive financial data | Require Bearer token authentication, rate limit requests |
| Chart library increases bundle size | Defer installation to Phase 4, evaluate alternatives if needed |
| 7 drawer items overflow on small screens | Adjust drawer item height, consider collapsible sections |
| Monthly budget sync creates orphaned records | Validate category exists on upsert, handle tombstones correctly |

Rollback for each phase:
- Phase 1: Remove `<FloatingActions />` from app-shell, revert query param changes.
- Phase 2: Revert more.tsx to original, remove GET handler from profile API.
- Phase 3: Remove budget tables from SQLite, revert schema changes, remove sync handlers.
- Phase 4: Remove API routes, remove reports screen, uninstall chart library.

---

## 11. Acceptance Criteria

### Static and automated checks

- `pnpm typecheck` passes with no errors.
- `pnpm lint` passes with no errors.
- `pnpm build` succeeds for both web and mobile.
- Mobile sync schema includes budget and monthly_budget entities.
- SQLite schema includes budgets and monthly_budgets tables.
- All API routes authenticate via Bearer token.
- All API routes return JSON responses.

### Visual acceptance

- FAB appears on all screens except More.
- FAB menu slides up with staggered animation.
- Profile screen shows read-only fields with "Edit Profile" button.
- Profile edit mode shows editable fields with Save/Cancel.
- Budgets screen shows monthly budget guide and budget cards.
- Budget progress bars show correct colors (green/red).
- Reports screen shows cash flow chart with 3 lines.
- Reports tables show correct data.
- All screens work in light and dark themes.
- All screens work on Android and iOS.

### Functional acceptance

- FAB actions navigate to correct screens and open modals.
- Profile save updates user data via API.
- Password change signs out after success.
- Budget CRUD operations work offline.
- Budget sync pushes changes to server.
- Budget sync pulls changes from server.
- Reports load data from API.
- Reports update when period/date/currency changes.
