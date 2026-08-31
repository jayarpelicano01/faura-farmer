# Faura-Farmer Architecture & Data Flow

## Current State Summary

The app is a live Phase 1 MVP. Every page works, auth is wired, and the budget system is functional. This document describes the **existing patterns** and identifies the **clean abstractions** that make the architecture easy to extend for Phase 2 features.

---

## 1. Architecture Layers

```
┌─────────────────────────────────────────────────────┐
│                   LAYOUT / ROUTES                    │
│  Root layout → SessionProvider + ThemeProvider       │
│  (auth) layout → login/register/forgot-password      │
│  (dashboard) layout → auth guard + sidebar + FAB     │
├─────────────────────────────────────────────────────┤
│              SERVER COMPONENTS (pages)                │
│  Dashboard, Accounts, Categories, Budgets, Reports   │
│  → call lib/queries.ts directly                      │
│  → pass serialized data as props to client widgets   │
├─────────────────────────────────────────────────────┤
│              CLIENT COMPONENTS (widgets)              │
│  TransactionForm, AccountsManager, BudgetManager,    │
│  CategoriesManager, Charts, etc.                     │
│  → read data via props (from server parent)          │
│  → mutate via apiFetch() → API routes                │
├─────────────────────────────────────────────────────┤
│            API ROUTE HANDLERS (app/api/*)             │
│  auth guard → Zod validation → Prisma call → JSON    │
│  lib/http.ts for consistent responses                │
├─────────────────────────────────────────────────────┤
│              QUERY LAYER (lib/queries.ts)             │
│  Reusable server-side Prisma queries with            │
│  Decimal→string serialization + category tree utils  │
├─────────────────────────────────────────────────────┤
│           DATABASE (Prisma 6 + Supabase Postgres)     │
│  User, Account, Category, Transaction,               │
│  RecurringRule, Budget, Goal, MonthlyBudget          │
└─────────────────────────────────────────────────────┘
```

### The Two Data Paths

**Read path (server → client one-way):**

```
Page (server component)
  → lib/queries.ts getXxx(userId)
    → prisma.model.findMany(...)
    → serializes Decimal to string
    → returns plain objects
  → passes as props to <ClientWidget data={...} />
  → ClientWidget renders (no client-side fetch for reads)
```

This is the **primary read pattern** — server components own data fetching, client components just render. It works because:

- Every dashboard page already has the session, so it can call `auth()` and `queries.*` in the same function
- No waterfall, no loading spinners for initial data
- Data is serialized at the boundary (Prisma Decimal → string) exactly once

**Mutation path (form → API → DB → refresh):**

```
Client form (e.g. TransactionForm)
  → apiFetch('/api/transactions', { method: 'POST', body })
    → fetch() with JSON
  → API Route Handler
    → auth() guard
    → Zod schema validation (createTransactionSchema)
    → ownership check (account belongs to user)
    → prisma.transaction.create(...)
    → returns 201 JSON
  → Client: toast + call onSaved() callback
    → onSaved() triggers load() → re-fetches list via apiFetch(GET)
```

Mutations always go through the API so the client can be anywhere (web, future mobile). Reads skip the API on the web (server component + Prisma direct) for performance, but the API routes exist for the mobile client and for client-side re-fetch after mutations.

---

## 2. Key Files & Their Responsibilities

### `/apps/web/src/lib/`

| File | Responsibility | Pattern |
|------|---------------|--------|
| `auth.ts` | NextAuth config + providers | Singleton export |
| `auth.config.ts` | Callbacks (jwt, session) | Separated from providers |
| `queries.ts` | All server-side Prisma reads | Pure functions, userId scoped |
| `validations.ts` | Re-exports from `@faura-farmer/types` | Thin re-export layer |
| `http.ts` | Response helpers (ok, created, fail, etc.) | Stateless functions |
| `api.ts` | Client-side fetch wrapper | `apiFetch<T>(url, init)` |
| `meta.ts` | Budget bucket resolution, type metadata | Pure functions, no DB |
| `format.ts` | Money formatting, number utils | Pure functions |
| `utils.ts` | `cn()` (tailwind-merge + clsx) | Utility |

### `/apps/web/src/components/`

| Pattern | Description | Example |
|---------|-------------|---------|
| `ui/*` | shadcn-style primitives | button, input, dialog, select |
| `dashboard/*` | Layout chrome | sidebar, floating-actions, user-menu, widgets |
| `transactions/*` | Transaction feature | transaction-form, transaction-list, transactions-manager |
| `accounts/*` | Account feature | account-form, accounts-manager |
| `categories/*` | Category feature | category-form, categories-manager |
| `budgets/*` | Budget feature | budget-form, budgets-manager, bucket-breakdown |
| `reports/*` | Charts | spending-bar-chart, trend-line-chart |
| `providers/*` | React context | session-provider, theme-provider |

### `/packages/`

| Package | Responsibility |
|---------|---------------|
| `database` | Prisma schema + client singleton |
| `types` | TypeScript types, Zod schemas, enum constants |
| `config` | Tailwind theme, design tokens |

---

## 3. Data Flow for Each Feature

### Dashboard

```
DashboardPage (server component)
  ├── auth() → get userId
  ├── getAccountsWithBalance(userId)
  │   ├── prisma.account.findMany({ where: { userId }})
  │   └── prisma.transaction.groupBy({ accountId, type, _sum })
  ├── getMonthTotals(userId, now)
  │   └── prisma.transaction.groupBy({ type, _sum })
  ├── getRecentTransactions(userId, 5)
  │   └── prisma.transaction.findMany({ include: { account, category }})
  ├── getBudgetsWithProgress(userId, now)
  │   └── prisma.budget.findMany + prisma.transaction.groupBy
  └── getBucketAllocation(userId, now)
      └── monthlyBudget + prisma.transaction.groupBy({ categoryId, bucket })
      │
      ▼ (passes as props)
      ├── <BalanceCards totalBalance monthTotals />
      ├── <RecentTransactions transactions />
      ├── <AccountSummary accounts />
      ├── <MonthlyBudgetOverview allocation />
      └── <BudgetOverview budgets />
```

### Transactions List

```
TransactionsPage (server component)
  ├── auth() → get userId
  ├── prisma.account.findMany({ where: { userId }})
  └── prisma.category.findMany({ where: { userId }})
      │
      ▼ (passes as props)
      <TransactionsManager accounts categories />
          │
          ├── Renders filters + TransactionList
          ├── On mount: apiFetch(GET /api/transactions?page=1&perPage=5)
          ├── On filter change: apiFetch(GET /api/transactions?q=...&type=...)
          ├── "+ New transaction" → opens <TransactionForm>
          │   └── On submit: apiFetch(POST /api/transactions) → refresh list
          └── Edit → opens <TransactionForm initial={...}>
              └── On submit: apiFetch(PATCH /api/transactions/[id]) → refresh list
```

### Reports

```
ReportsPage (server component)
  ├── auth() → get userId
  ├── getSpendingByCategory(userId, currentMonth)
  └── getMonthlyTrend(userId, 6)
      │
      ▼ (passes as props)
      └── <SpendingBarChart data /> + <TrendLineChart data />
```

---

## 4. The Query Layer Pattern (lib/queries.ts)

This is the most important architectural decision. Every server component read goes through this file. Each function:

1. Takes `userId` as the first parameter (enforced data isolation)
2. Calls Prisma directly
3. Serializes `Decimal` → `string` before returning
4. Returns plain typed objects (not Prisma model instances)

```typescript
// Pattern template
export async function getXxx(userId: string, ...args): Promise<XxxType[]> {
  const rows = await prisma.model.findMany({
    where: { userId },
    include: { ... },
    orderBy: { ... },
  });

  // Transform Decimal → string, compute derived fields
  return rows.map(row => ({
    ...row,
    amount: String(row.amount),  // Decimal → string
    computed: row.value * 2,     // derived field
  }));
}
```

**Why this matters:** When you add a new feature (e.g. Goals, Recurring Transactions), you add one function here per read operation. The API route handlers for the mobile client can call the same functions. This avoids duplicating Prisma query logic.

### Current query functions (reference for adding new ones):

| Function | Returns | What it does |
|----------|---------|-------------|
| `getAccountsWithBalance` | `AccountWithBalance[]` | Accounts + computed balance from transactions |
| `getMonthTotals` | `MonthTotals` | Income/expense sum for a month |
| `getRecentTransactions` | `Transaction[]` | Last N transactions with relations |
| `getSpendingByCategory` | `SpendingByCategory[]` | Expense grouped by root category |
| `getBudgetsWithProgress` | `BudgetWithCategory[]` | Budgets + computed spent/remaining |
| `getMonthlyTrend` | `MonthlyTrendPoint[]` | Income/expense per month, last N months |
| `getCategoryTree` | `{ income, expense }` | Category tree with children |
| `getMonthlyBudgetWithDefault` | `MonthlyBudget` | Either persisted or defaults to income |
| `setMonthlyBudget` | `MonthlyBudget` | Upsert the monthly budget amount |
| `getBucketAllocation` | `BucketAllocation` | 50/30/20 breakdown with spent |
| `findConflictingBudget` | `{ id, categoryName } \| null` | Budget overlap check |

---

## 5. API Route Handler Pattern

Every route handler follows this exact shape:

```typescript
// app/api/[resource]/route.ts
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  const userId = session.user.id;

  // Parse query params with Zod
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message);

  // Verify user owns referenced resources (for POST/PATCH)
  const account = await prisma.account.findFirst({
    where: { id: parsed.data.accountId, userId },
  });
  if (!account) return fail('Account not found', 404);

  // Execute
  const result = await prisma.model.create({ data: { ...parsed.data, userId } });
  return created(result);
}
```

### Response helpers (lib/http.ts):

| Helper | Status | Use case |
|--------|--------|----------|
| `ok(data)` | 200 | GET list/single |
| `created(data)` | 201 | POST create |
| `fail(msg, status, code?)` | 4xx | Validation / business errors |
| `unauthorized()` | 401 | No session |
| `notFound(msg?)` | 404 | Resource doesn't exist |
| `badRequest(msg?)` | 400 | Zod parse failure |

---

## 6. Client Component Data Flow

### Read pattern (props from server parent):

```
Server Page
  ├── fetches data (queries.ts)
  └── <ClientComponent data={data} />

ClientComponent (e.g. TransactionsManager)
  ├── State: filter values, page, items[]
  ├── Effect on mount: load() via apiFetch(GET)
  ├── Effect on filter change: load() with new params
  │   └── Also updates URL search params via router.replace()
  └── Renders: TransactionList, filters, pagination
```

### Mutation pattern (form → API → refresh):

```
Form component (e.g. TransactionForm)
  ├── useForm + zodResolver
  ├── onSubmit:
  │   ├── apiFetch(POST /api/transactions, { body })
  │   ├── toast.success()
  │   ├── onOpenChange(false)
  │   └── onSaved() → parent load() refreshes list
  └── on error: setSubmitError(error.message)
```

### URL-based state pattern:

The transactions page keeps filter state in URL search params, so filters survive page refreshes and are shareable:

```typescript
// On filter change:
router.replace(`/transactions?q=${q}&type=${type}`, { scroll: false });

// On mount:
const searchParams = useSearchParams();
const [q, setQ] = useState(() => searchParams.get('q') ?? '');
```

---

## 7. Data Serialization Boundary

Prisma returns `Decimal` objects for `NUMERIC` columns. These cannot be passed to client components or serialized to JSON. The serialization happens at **two points**:

### Server component path (queries.ts):
```typescript
// Each query function converts Decimal → string
return rows.map(row => ({
  ...row,
  amount: String(row.amount),
  startingBalance: String(row.startingBalance),
}));
```

### API route path:
```typescript
// NextResponse.json() automatically serializes Prisma Decimal
// because Prisma Decimal has a toJSON() method
return ok(transaction);  // Just works
```

**This is a subtle inconsistency.** The query layer returns `string` amounts, but the API routes return Prisma models that JSON-serialize to `string` via `toJSON()`. Both end up as strings on the client, but the types differ:

- `queries.ts` returns `{ amount: string }` (explicit cast)
- `api/transactions/route.ts` returns raw Prisma model (Decimal → string via `toJSON()`)

When adding new features, be consistent: **always convert Decimal to string in queries.ts, and let the API route handle it naturally via JSON serialization.**

---

## 8. Adding a New Feature — Step-by-Step Recipe

Using **Goals** as an example (schema exists, no UI yet):

### Step 1: Query functions (lib/queries.ts)
```typescript
export async function getGoals(userId: string): Promise<Goal[]> {
  return prisma.goal.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getGoalProgress(userId: string) {
  const goals = await getGoals(userId);
  return goals.map(g => ({
    ...g,
    targetAmount: String(g.targetAmount),
    currentAmount: String(g.currentAmount),
    progress: toNumber(g.targetAmount) > 0
      ? (toNumber(g.currentAmount) / toNumber(g.targetAmount)) * 100
      : 0,
  }));
}
```

### Step 2: API routes (app/api/goals/)
```typescript
// app/api/goals/route.ts — GET (list), POST (create)
// app/api/goals/[id]/route.ts — GET (single), PATCH, DELETE

// Follow the exact pattern:
// 1. auth() guard
// 2. Zod validation
// 3. Ownership check (goal.userId === session.user.id)
// 4. Prisma operation
// 5. Consistent response via http.ts helpers
```

### Step 3: Zod schemas (packages/types/src/schemas.ts)
```typescript
export const createGoalSchema = z.object({
  name: z.string().min(1).max(100),
  targetAmount: z.number().positive(),
  currentAmount: z.number().min(0).default(0),
  targetDate: z.string().date().optional(),
});
```

### Step 4: Server component page
```typescript
// app/(dashboard)/goals/page.tsx
export default async function GoalsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const goals = await getGoalProgress(session.user.id);
  return <GoalsManager goals={goals} />;
}
```

### Step 5: Client component
```typescript
// components/goals/goals-manager.tsx
'use client';
// Same pattern as TransactionsManager:
// - Props: initial data from server
// - State: items, dialogOpen, editing
// - Mutations via apiFetch()
// - Refresh via load() callback
```

### Step 6: Add to sidebar + dashboard
- Add `{ href: '/goals', label: 'Goals', icon: Target }` to sidebar nav items
- Add a goals summary widget to the dashboard

---

## 9. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Server components own reads** | No client-side fetch waterfall for initial page load. Data is ready before React hydrates. |
| **API routes exist for all CRUD** | The mobile app (Phase 3) needs API endpoints. Auth-guarded, Zod-validated endpoints are the contract. |
| **Client mutations use apiFetch** | Thin wrapper around fetch — no React Query/SWR dependency. Simple enough for a personal finance app. |
| **Query functions in lib/queries.ts** | Single source of truth for Prisma read patterns. API routes and server components call the same functions. |
| **Decimal → string in queries.ts** | Prisma Decimal is not serializable. Converting at the boundary keeps the rest of the app type-safe. |
| **URL-based filter state** | Filters survive page refresh, are shareable, and play well with browser back/forward. |
| **No service layer** | The query layer + API routes are thin enough that a dedicated service layer would add indirection without value. If business logic grows (e.g. recurring transaction engine), extract it into `lib/services/`. |
| **Category tree traversal in-memory** | Finance trackers have small category sets (< 200). In-memory tree ops are faster than recursive CTEs. |

---

## 10. Future-Proofing

### Adding a service layer (when needed)

If a feature has complex business logic (e.g. recurring transactions that create new transactions on a schedule), extract it into `lib/services/`:

```typescript
// lib/services/recurring-transactions.ts
export async function processDueRecurringRules(userId: string) {
  const due = await prisma.recurringRule.findMany({
    where: { isActive: true, nextDueDate: { lte: new Date() } },
  });

  for (const rule of due) {
    await prisma.transaction.create({
      data: {
        accountId: rule.accountId,
        categoryId: rule.categoryId,
        amount: rule.amount,
        type: 'expense',
        date: new Date(),
        note: `[Recurring] ${rule.label}`,
        source: 'manual',
      },
    });

    // Advance nextDueDate based on frequency
    const next = advanceDate(rule.nextDueDate, rule.frequency);
    await prisma.recurringRule.update({
      where: { id: rule.id },
      data: { nextDueDate: next },
    });
  }
}
```

### Adding a cron job for recurring transactions

The processing loop above would run on a schedule. Options:
- **Vercel Cron Jobs** (pro plan) — hit a `/api/cron/process-recurring` route
- **Client-side check** — on app load, check for due recurring rules
- **User-managed cron job** — schedule a script that calls the API

### Mobile API client

The existing API routes are already designed for mobile consumption:
- Auth via `Authorization: Bearer <token>` (JWT strategy is already configured)
- Standard JSON responses
- Pagination via `page` + `perPage` query params
- All routes scoped by `session.user.id`

---

## 11. Current Gaps & Pain Points

| Issue | Impact | Suggestion |
|-------|--------|-----------|
| `queries.ts` Decimal → string repetition | Every query function manually converts. Easy to forget. | In Phase 2, consider a `serialize` helper that maps Decimal fields. |
| Server + client bucket resolution duplicated | `queries.ts` has `bucketOf()`, `meta.ts` has `resolveCategoryBucket()` | Acceptable — server needs it for reports, client needs it for forms. Document the duplication. |
| No pagination for accounts/categories lists | Fine for small datasets, but needs adding if users have 100+ accounts | Add `page`/`perPage` style pagination to GET routes |
| `Record<string, unknown>` in API routes | TypeScript loses type safety on nested `where` objects | Extract typed builders for complex queries |
| No error boundary per page | One error in any dashboard widget crashes the whole page | Add `error.tsx` per route group (already done at dashboard level) |
