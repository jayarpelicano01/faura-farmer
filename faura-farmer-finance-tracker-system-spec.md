# Faura-Farmer — Personal Finance Tracker System Specification

Faura-Farmer is a personal finance tracker built for multiple users — anyone can sign up and log in with their own account, and each user's data is completely separate from everyone else's. It's manual-entry first, built to scale into automatic bank sync later. Two clients (web, mobile) share one backend and one Postgres database, so data stays consistent regardless of where it's entered. The mobile app works fully offline via a local SQLite database that syncs when connectivity returns.

---

## 1. Overview

- **Users:** multi-user from the start — anyone can create an account (email/password, Google, or Facebook) and log in on either client. Every user only ever sees their own accounts, transactions, and budgets; there's no sharing or cross-user visibility.
- **Accounts:** fully customizable — label anything as "GCash", "Maribank Save Up", "Cash wallet", etc. A hidden `type` field groups them for reporting without limiting what you can call them.
- **Entry method:** manual for now, schema-ready for automatic bank sync later without any structural changes.
- **Platforms:** web now, mobile later, sharing one backend from day one.
- **Mobile offline:** full offline support via local SQLite + background sync — not just cached pages.

---

## 2. Design system

### Colors

Your palette is a neutral grayscale (light → dark). It's missing accent colors for financial signaling (income vs. expense, warnings) — suggested additions are included below, swap them for whatever fits your taste.

| Token | Hex | Role |
|---|---|---|
| `bright_snow` | `#f8f9fa` | Page background (light mode) |
| `platinum` | `#e9ecef` | Card / surface background |
| `alabaster_grey` | `#dee2e6` | Card borders, dividers |
| `pale_slate` | `#ced4da` | Input borders, disabled fills |
| `pale_slate_deep` | `#adb5bd` | Placeholder text, inactive icons |
| `slate_grey` | `#6c757d` | Secondary / muted text |
| `iron_grey` | `#495057` | Body text (secondary headings) |
| `gunmetal` | `#343a40` | Headings |
| `carbon_black` | `#212529` | Primary text, high-emphasis |

> **Note:** your original palette had two entries both named `pale_slate` (`#ced4da` and `#adb5bd`). Since object keys must be unique, the second would silently overwrite the first if pasted directly into a Tailwind config — renamed the second to `pale_slate_deep` above. Rename it to whatever you prefer before using it.

**Dark mode:** each color's ramp already runs light-to-dark within itself (e.g. `bright_snow-100` is near-black, `bright_snow-900` is near-white). For dark mode, swap `bright_snow` (bg) for `carbon_black`, and generally use each token's `100`–`300` shades instead of its `700`–`900` shades.

**Recommended additions** (not in your palette — a finance app needs these):
- Positive / income: a teal or green, e.g. `#0f6e56`
- Negative / expense: a coral or red, e.g. `#c0392b`
- Primary action / brand accent: one color for buttons and links, e.g. a muted indigo `#4a4de7`

```js
// tailwind.config.js (web) — also usable on mobile via NativeWind
theme: {
  extend: {
    fontFamily: {
      display: ['Unbounded', 'sans-serif'],
      body: ['Albert Sans', 'sans-serif'],
    },
    colors: {
      bright_snow: { DEFAULT: '#f8f9fa', 100: '#29323a', 200: '#536475', 300: '#8496a8', 400: '#bfc8d1', 500: '#f8f9fa', 600: '#fafbfc', 700: '#fbfcfc', 800: '#fdfdfd', 900: '#fefefe' },
      platinum: { DEFAULT: '#e9ecef', 100: '#282f37', 200: '#505f6e', 300: '#7c8ea0', 400: '#b3bec8', 500: '#e9ecef', 600: '#eef1f3', 700: '#f3f4f6', 800: '#f7f8f9', 900: '#fbfbfc' },
      alabaster_grey: { DEFAULT: '#dee2e6', 100: '#272d34', 200: '#4e5b67', 300: '#788899', 400: '#abb6c0', 500: '#dee2e6', 600: '#e5e9ec', 700: '#eceef1', 800: '#f2f4f5', 900: '#f9f9fa' },
      pale_slate: { DEFAULT: '#ced4da', 100: '#242a30', 200: '#495561', 300: '#6d7f91', 400: '#9da9b5', 500: '#ced4da', 600: '#d7dce1', 700: '#e1e5e9', 800: '#ebeef0', 900: '#f5f6f8' },
      pale_slate_deep: { DEFAULT: '#adb5bd', 100: '#202428', 200: '#404850', 300: '#616d79', 400: '#85919d', 500: '#adb5bd', 600: '#bdc4ca', 700: '#ced3d8', 800: '#dee1e5', 900: '#eff0f2' },
      slate_grey: { DEFAULT: '#6c757d', 100: '#161819', 200: '#2c2f32', 300: '#41474b', 400: '#575e64', 500: '#6c757d', 600: '#899199', 700: '#a7adb2', 800: '#c4c8cc', 900: '#e2e4e5' },
      iron_grey: { DEFAULT: '#495057', 100: '#0e1011', 200: '#1d2022', 300: '#2b2f34', 400: '#3a3f45', 500: '#495057', 600: '#68727d', 700: '#8c959f', 800: '#b2b9bf', 900: '#d9dcdf' },
      gunmetal: { DEFAULT: '#343a40', 100: '#0b0c0d', 200: '#15171a', 300: '#202327', 400: '#2a2f34', 500: '#343a40', 600: '#58626c', 700: '#7d8995', 800: '#a9b0b8', 900: '#d4d8dc' },
      carbon_black: { DEFAULT: '#212529', 100: '#070808', 200: '#0e0f11', 300: '#141719', 400: '#1b1f22', 500: '#212529', 600: '#49525b', 700: '#6f7d8b', 800: '#9fa8b2', 900: '#cfd4d8' },
    },
  },
}
```

### Typography — Unbounded + Albert Sans

- **Unbounded** — geometric, rounded, high personality. Use for the app logo/wordmark, page headings (`h1`/`h2`), and large numeric displays (account balances, dashboard totals). Weights 500–700. Avoid using it for body copy — it gets fatiguing at small sizes.
- **Albert Sans** — clean, neutral grotesk. Use for body text, form labels, table/list data, buttons, and navigation. Weights 400 (body) and 500 (emphasis/labels).

Both are Google Fonts — import via `next/font/google` on web, and `expo-font` + `@expo-google-fonts/unbounded` / `@expo-google-fonts/albert-sans` on mobile, so the same type system renders identically on both platforms.

**Tip:** install [NativeWind](https://www.nativewind.dev/) in the mobile app. It lets React Native read this exact same Tailwind config, so you write `className="bg-bright_snow text-carbon_black font-display"` on both web and mobile — one design system, zero duplicated styling logic.

---

## 3. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Web frontend + API | Next.js (App Router) | One codebase for UI and backend API routes |
| Auth | Auth.js (NextAuth) with Google & Facebook OAuth providers | Handles OAuth + session tokens for both web and mobile |
| Database | Postgres | Relational, mature, works with every hosting option |
| ORM | Prisma or Drizzle | Type-safe schema + migrations shared by the web API |
| Web styling | Tailwind CSS | Matches the color-object format directly |
| Mobile | React Native (Expo) | Shares React/JS knowledge with Next.js; Expo simplifies builds |
| Mobile local DB | SQLite (`expo-sqlite` or Drizzle's SQLite driver) | Enables true offline use |
| Mobile styling | NativeWind | Reuses the same Tailwind tokens as web |
| Hosting (web + API) | Vercel | Native Next.js support |
| Hosting (DB) | Neon, Supabase, or Railway | Managed Postgres, generous free tiers |

**Authentication:** the backend uses [Auth.js](https://authjs.dev/) (formerly NextAuth) configured with the Google and Facebook OAuth providers, plus a standard email/password option. New users can either sign up with an email and password or continue with Google/Facebook — either way, a row is created in `users` on first login. Auth.js issues a session token after login, which the web app stores in a cookie. The mobile app authenticates through the same backend via `expo-auth-session` — it opens the provider's login screen in a secure in-app browser, then exchanges the resulting code with the API for a session token, which it stores securely on-device (`expo-secure-store`). Both clients hit the same `users` table, so it doesn't matter which method or which device someone signs up or logs in from.

**Data isolation:** every table that stores user data (`accounts`, `categories`, `transactions`, `budgets`, `goals`) is scoped by `user_id`, either directly or through a foreign key chain (e.g. `transactions` → `accounts` → `user_id`). The important rule to enforce in code: **every API route must filter by `session.user.id`**, never trust a client-supplied user ID. This is what actually keeps one user's finances invisible to another — the schema alone doesn't guarantee it.

---

## 4. Architecture

Both clients call the same backend, which is the only thing that talks to the database:

```
   Web app              Mobile app
 (Next.js UI)          (React Native)
       \                    /
        \                  /
         v                v
         Backend API (Next.js API routes)
                  |
                  v
              Postgres
                  ^
                  |  (optional, added later)
           Bank sync service
```

The mobile app also keeps a local SQLite database in front of the API for offline support (see Section 7). A future bank-sync provider plugs into the same API without changing this shape — it just becomes another writer of `transactions` rows.

---

## 5. Database schema

```sql
-- Users (multi-user: every account, transaction, etc. is scoped to a user_id)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,                -- null for accounts created via Google/Facebook
  auth_provider TEXT DEFAULT 'email', -- 'email' | 'google' | 'facebook'
  provider_id TEXT,                  -- the user's unique ID from Google/Facebook, null for email accounts
  avatar_url TEXT,                   -- pulled from provider profile, if available
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (auth_provider, provider_id)
);

-- Accounts: fully customizable labels, typed for reporting
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  label TEXT NOT NULL,               -- "GCash", "Maribank Save Up", "Cash wallet"
  type TEXT NOT NULL,                -- 'bank' | 'e_wallet' | 'cash' | 'credit_card' | 'investment'
  institution TEXT,                  -- "GCash", "Maribank", "BPI" — free text now
  external_account_id TEXT,          -- filled in later by bank sync, null for now
  currency TEXT DEFAULT 'PHP',
  starting_balance NUMERIC(14,2) DEFAULT 0,
  color TEXT,
  icon TEXT,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Categories
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL,                -- 'income' | 'expense'
  parent_id UUID REFERENCES categories(id),
  icon TEXT,
  color TEXT
);

-- Transactions
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id),
  category_id UUID REFERENCES categories(id),
  amount NUMERIC(14,2) NOT NULL,
  type TEXT NOT NULL,                -- 'income' | 'expense' | 'transfer'
  date DATE NOT NULL,
  note TEXT,
  source TEXT DEFAULT 'manual',      -- 'manual' | 'bank_sync' — ready for phase 4
  external_transaction_id TEXT,      -- null until bank sync exists
  recurring_rule_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_transactions_account ON transactions(account_id);
CREATE INDEX idx_transactions_date ON transactions(date);

-- Recurring rules
CREATE TABLE recurring_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id),
  category_id UUID REFERENCES categories(id),
  label TEXT,
  amount NUMERIC(14,2) NOT NULL,
  frequency TEXT NOT NULL,           -- 'weekly' | 'monthly' | 'yearly'
  next_due_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true
);

-- Budgets
CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  category_id UUID REFERENCES categories(id),
  monthly_limit NUMERIC(14,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Goals (phase 3)
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  name TEXT NOT NULL,
  target_amount NUMERIC(14,2) NOT NULL,
  current_amount NUMERIC(14,2) DEFAULT 0,
  target_date DATE
);
```

The mobile app mirrors this schema locally in SQLite, plus one extra column per table: `synced BOOLEAN DEFAULT false`, used only on-device to track what still needs to push to the server.

---

## 6. Feature roadmap

**Phase 1 — MVP (web)**
- [ ] Auth (sign up + log in via email/password, Google, or Facebook)
- [ ] Customizable accounts (label, type, institution)
- [ ] Manual transaction entry
- [ ] Categories & tags
- [ ] Dashboard (balances, income vs. expense, recent transactions)
- [ ] Basic reports (spending by category, monthly trend)
- [ ] Search & filter transactions

**Phase 2 — Web enhancements**
- [ ] Budgets per category with progress/alerts
- [ ] Recurring transactions
- [ ] Bill reminders
- [ ] CSV import/export
- [ ] Receipt photo attachments

**Phase 3 — Mobile**
- [ ] Expo app scaffold + auth
- [ ] Local SQLite schema + offline read/write
- [ ] Background sync engine
- [ ] Mobile UI (NativeWind, shared design tokens)
- [ ] Savings goals / debt payoff tracking

**Phase 4 — Automation**
- [ ] Automatic bank sync (Plaid or regional equivalent)
- [ ] Multi-currency support
- [ ] Push notifications
- [ ] Net worth over time

---

## 7. Offline sync strategy (mobile)

1. All reads/writes on the phone hit local SQLite first — instant, no network needed.
2. Each local row has `synced` and `updated_at` columns.
3. On app foreground or reconnect, a sync job pushes unsynced local rows to the API, then pulls any server rows newer than the last sync timestamp.
4. Conflicts resolve by `updated_at` — last write wins. Each device only ever syncs the data belonging to its logged-in user, so this is sufficient without needing cross-user merge logic.

---

## 8. Suggested repo structure

```
faura-farmer/
├── apps/
│   ├── web/              # Next.js app (UI + API routes)
│   └── mobile/            # Expo React Native app
├── packages/
│   ├── database/           # Prisma/Drizzle schema + migrations
│   ├── types/                # Shared TypeScript types
│   └── config/                 # Shared Tailwind theme (colors, fonts)
├── package.json             # pnpm/yarn workspaces
└── turbo.json                  # optional, if using Turborepo
```

---

## 9. Build order

1. Set up the monorepo (pnpm workspaces or Turborepo).
2. Provision Postgres (Neon or Supabase free tier).
3. Define the schema above in Prisma/Drizzle, run the first migration.
4. Build API routes: auth (Auth.js with Google & Facebook OAuth apps registered on each platform's developer console), accounts CRUD, transactions CRUD, categories CRUD.
5. Build the web UI: dashboard, transaction entry, accounts page, reports — apply the Tailwind theme (palette + fonts) from Section 2.
6. Deploy the web MVP to Vercel — Phase 1 live and usable.
7. Add budgets, recurring transactions, bill reminders, CSV import/export (Phase 2).
8. Scaffold the Expo app, set up navigation and auth screens (email/password plus Google & Facebook login via `expo-auth-session`).
9. Set up the local SQLite schema and sync engine.
10. Build the mobile UI with NativeWind, reusing the same design tokens.
11. Add goals and receipt attachments (Phase 3).
12. When ready, integrate a bank-sync provider — it writes into the existing schema via `source = 'bank_sync'`, no architecture changes needed.
