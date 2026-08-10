# Faura-Farmer — Phase 1 Implementation Spec (MVP Web)

> **Goal:** Scaffold monorepo, set up Prisma + Supabase, Next.js web app with Auth.js, core API routes, and dashboard UI. Deploy to Vercel.
> **Stack:** pnpm workspaces, Prisma, Next.js 15 (App Router), Auth.js (NextAuth), Tailwind CSS, Shadcn/UI, TypeScript
> **Database:** Supabase (PostgreSQL)
> **Deploy:** Vercel (web + API routes)

---

## 📦 Phase 1 Scope (MVP Web)

| Feature | Status |
|---------|--------|
| Monorepo scaffold (pnpm workspaces) | ☐ |
| Supabase project + connection string | ☐ |
| Prisma schema (from faura-farmer spec) + first migration | ☐ |
| Next.js web app (apps/web) | ☐ |
| Shared config package (packages/config) — Tailwind theme, fonts | ☐ |
| Shared types package (packages/types) | ☐ |
| Auth.js setup (email/password + Google + Facebook OAuth) | ☐ |
| API routes: Auth, Accounts CRUD, Transactions CRUD, Categories CRUD | ☐ |
| Dashboard UI (balances, income vs expense, recent transactions) | ☐ |
| Transaction entry form | ☐ |
| Accounts management page | ☐ |
| Categories management page | ☐ |
| Basic reports (spending by category, monthly trend) | ☐ |
| Search & filter transactions | ☐ |
| Deploy to Vercel | ☐ |

---

## 🏗️ Step-by-Step Implementation Plan

### **Step 1: Monorepo Scaffold**
- Create `faura-farmer/` root folder
- `package.json` with pnpm workspaces config
- `pnpm-workspace.yaml` defining workspaces
- `tsconfig.json` (root, references packages)
- `.gitignore`, `.env.example`
- Folder structure:
  ```
  faura-farmer/
  ├── apps/
  │   └── web/
  ├── packages/
  │   ├── config/
  │   ├── database/
  │   └── types/
  ├── package.json
  ├── pnpm-workspace.yaml
  ├── tsconfig.json
  └── .env.example
  ```

### **Step 2: Shared Config Package (packages/config)**
- Tailwind theme matching faura-farmer spec exactly:
  - Colors: `bright_snow` through `carbon_black` (100-900 each)
  - Added: `income` (`#0f6e56`), `expense` (`#c0392b`), `primary` (`#4a4de7`)
  - Fonts: `font-display` (Unbounded), `font-body` (Albert Sans)
  - Dark mode: `class` strategy
- Export as `tailwind.config.ts` + CSS variables for shadcn/ui
- `next/font/google` config for Unbounded + Albert Sans (variable weights)
- Build: `pnpm --filter @faura-farmer/config build`

### **Step 3: Shared Types Package (packages/types)**
- TypeScript types mirroring Prisma schema:
  - `User`, `Account`, `Category`, `Transaction`, `RecurringRule`, `Budget`, `Goal`
  - API request/response types
  - Enum types: `AccountType`, `CategoryType`, `TransactionType`, `Frequency`, `AuthProvider`
- Build: `pnpm --filter @faura-farmer/types build`

### **Step 4: Database Package (packages/database)**
- Prisma schema (`prisma/schema.prisma`) — **exact match** to faura-farmer spec Section 5
- Models: `User`, `Account`, `Category`, `Transaction`, `RecurringRule`, `Budget`, `Goal`
- Indexes: `idx_transactions_account`, `idx_transactions_date`
- Relations: proper `@relation` and `@@index`
- `pnpm --filter @faura-farmer/database db:generate` → `db:push` (or migrate)
- Supabase connection string in `.env` (DATABASE_URL)

### **Step 5: Next.js Web App (apps/web)**
- `next.config.ts` — transpilePackages for `@faura-farmer/*`
- `tsconfig.json` — extends root, path aliases for packages
- App Router structure:
  ```
  apps/web/
  ├── src/
  │   ├── app/
  │   │   ├── (auth)/
  │   │   │   ├── login/
  │   │   │   ├── register/
  │   │   │   └── layout.tsx
  │   │   ├── (dashboard)/
  │   │   │   ├── layout.tsx
  │   │   │   ├── page.tsx (dashboard)
  │   │   │   ├── accounts/
  │   │   │   ├── transactions/
  │   │   │   ├── categories/
  │   │   │   └── reports/
  │   │   ├── api/
  │   │   │   ├── auth/[...nextauth]/
  │   │   │   ├── accounts/
  │   │   │   ├── transactions/
  │   │   │   └── categories/
  │   │   ├── globals.css (Tailwind + shadcn/ui CSS variables)
  │   │   └── layout.tsx
  │   ├── components/
  │   │   ├── ui/ (shadcn/ui primitives)
  │   │   ├── dashboard/
  │   │   ├── accounts/
  │   │   ├── transactions/
  │   │   └── categories/
  │   ├── lib/
  │   │   ├── auth.ts (Auth.js config)
  │   │   ├── prisma.ts (Prisma client singleton)
  │   │   └── utils.ts
  │   └── hooks/
  ├── package.json
  └── .env.local
  ```

### **Step 6: Auth.js Setup (apps/web/src/lib/auth.ts)**
- Providers: `Credentials` (email/password), `Google`, `Facebook`
- `session` strategy: `jwt` (for mobile compatibility)
- Callbacks: `jwt`, `session` — include `user.id` in token
- Pages: `/login`, `/register`, `/auth/error`
- Environment variables: `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET`
- **Note:** OAuth apps need to be created in Google Cloud Console + Facebook Developers (can use placeholder values for now)

### **Step 7: API Routes (apps/web/src/app/api/)**
All routes **must filter by `session.user.id`** — never trust client-supplied user ID.

| Route | Methods | Description |
|-------|---------|-------------|
| `/api/auth/[...nextauth]` | GET, POST | Auth.js handler |
| `/api/accounts` | GET, POST | List/create accounts (scoped to user) |
| `/api/accounts/[id]` | GET, PATCH, DELETE | Single account CRUD |
| `/api/transactions` | GET, POST | List/create transactions (with filters: account, category, date range, search) |
| `/api/transactions/[id]` | GET, PATCH, DELETE | Single transaction CRUD |
| `/api/categories` | GET, POST | List/create categories (scoped to user) |
| `/api/categories/[id]` | GET, PATCH, DELETE | Single category CRUD |

- Validation: Zod schemas for request bodies
- Error handling: consistent format `{ error: string, code?: string }`
- Pagination: `cursor` + `limit` for lists

### **Step 8: Dashboard UI (apps/web/src/app/(dashboard)/page.tsx)**
- **Header**: User avatar, logout, "Add Transaction" button
- **Balance Cards**: Total balance, Income (month), Expense (month) — using `income`/`expense` colors
- **Recent Transactions**: Table (date, account, category, amount, type badge)
- **Quick Actions**: Add account, Add category, Add transaction
- Responsive: mobile-first, Tailwind breakpoints

### **Step 9: Transaction Entry (apps/web/src/app/(dashboard)/transactions/)**
- List page: filterable, searchable, paginated table
- Create/Edit modal or page: form with account select, category select, amount, type, date, note
- Shadcn/ui: `Dialog`, `Form`, `Select`, `Input`, `DatePicker`, `Textarea`

### **Step 10: Accounts Page (apps/web/src/app/(dashboard)/accounts/)**
- Grid of account cards: label, type badge, balance, institution
- Create/Edit: label, type (select), institution, currency, starting balance, color picker, icon picker
- Archive toggle

### **Step 11: Categories Page (apps/web/src/app/(dashboard)/categories/)**
- Hierarchical tree view (income/expense sections)
- Create/Edit: name, type (income/expense), parent (select), color, icon
- Drag-drop for reordering (optional, can defer)

### **Step 12: Reports Page (apps/web/src/app/(dashboard)/reports/)**
- **Spending by Category**: Bar chart (Recharts) — expense categories, current month
- **Monthly Trend**: Line chart (Recharts) — income vs expense, last 6 months
- **Filters**: Month selector, Account filter

### **Step 13: Search & Filter Transactions**
- Global search bar (note, category, account)
- Filters: Date range, Account, Category, Type (income/expense/transfer), Amount range
- URL-based state (shareable links)

### **Step 14: Deploy to Vercel**
- Connect GitHub repo
- Environment variables in Vercel dashboard
- Build command: `pnpm build` (runs all workspace builds)
- Output: `apps/web` deployed
- Verify: auth works, API routes respond, dashboard loads

---

## 🔧 Technical Requirements

### **Dependencies (per package)**
| Package | Key Dependencies |
|---------|------------------|
| `@faura-farmer/config` | `tailwindcss`, `@tailwindcss/typography`, `tailwindcss-animate`, `class-variance-authority`, `clsx`, `tailwind-merge` |
| `@faura-farmer/types` | `zod` (for validation schemas), `date-fns` |
| `@faura-farmer/database` | `@prisma/client`, `prisma` (dev) |
| `apps/web` | `next@15`, `react@19`, `next-auth@5` (Auth.js v5), `@prisma/client`, `@faura-farmer/config`, `@faura-farmer/types`, `@faura-farmer/database`, `zod`, `recharts`, `date-fns`, `lucide-react`, `@radix-ui/*` (shadcn/ui primitives) |

### **Shadcn/UI Components Needed**
- `button`, `input`, `label`, `select`, `dialog`, `table`, `badge`, `card`, `tabs`, `dropdown-menu`, `avatar`, `tooltip`, `separator`, `scroll-area`, `form`, `date-picker` (or `input[type=date]`), `textarea`, `checkbox`, `switch`, `popover`, `hover-card`

### **Environment Variables (.env.example)**
```env
# Database
DATABASE_URL="postgresql://user:pass@host:5432/db?schema=public"

# Auth.js
AUTH_SECRET="generate-with-openssl-rand-base64-32"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
FACEBOOK_CLIENT_ID=""
FACEBOOK_CLIENT_SECRET=""

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

---

## ✅ Acceptance Criteria (Phase 1 Complete)

1. **Monorepo builds**: `pnpm build` succeeds (all packages)
2. **Database**: Prisma generates client, migration runs against Supabase
3. **Auth works**: Sign up (email/password), login, logout, session persists
4. **API routes**: All CRUD endpoints return 200/201, filter by `session.user.id`
5. **Dashboard loads**: Shows balances, recent transactions, no console errors
6. **Transaction entry**: Can create/edit/delete transactions
7. **Accounts page**: Can create/edit/archive accounts
8. **Categories page**: Can create/edit categories (hierarchical)
8. **Reports page**: Charts render (Recharts), data accurate
9. **Search/Filter**: Works on transactions list
10. **Deployed**: Live on Vercel, all features work in production

---

## 📝 Notes for OpenCode

- **Use Shadcn/UI primitives** for all components — no raw `<button>`, `<input>`, `<select>`, `<dialog>`, `<table>` etc.
- **Tailwind config** must match faura-farmer spec Section 2 exactly (colors, fonts, dark mode)
- **Auth.js v5** (next-auth@5) — use App Router patterns
- **Prisma client** as singleton in `apps/web/src/lib/prisma.ts`
- **API routes** use `getServerSession` from `next-auth` (not `auth()` helper)
- **All user-scoped queries** must include `where: { userId: session.user.id }` or equivalent FK chain
- **TypeScript strict mode** — no `any`, proper types from `@faura-farmer/types`
- **Recharts** for charts — responsive containers, tooltips, legends
- **Mobile-first responsive** — test at 375px, 768px, 1024px, 1440px