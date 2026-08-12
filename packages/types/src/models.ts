export const ACCOUNT_TYPES = ['bank', 'e_wallet', 'cash', 'credit_card', 'investment'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const CATEGORY_TYPES = ['income', 'expense'] as const;
export type CategoryType = (typeof CATEGORY_TYPES)[number];

export const BUDGET_BUCKETS = ['needs', 'wants', 'savings'] as const;
export type BudgetBucket = (typeof BUDGET_BUCKETS)[number];

export const TRANSACTION_TYPES = ['income', 'expense', 'transfer'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const FREQUENCIES = ['weekly', 'monthly', 'yearly'] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const AUTH_PROVIDERS = ['email', 'google', 'facebook'] as const;
export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

export const TRANSACTION_SOURCES = ['manual', 'bank_sync'] as const;
export type TransactionSource = (typeof TRANSACTION_SOURCES)[number];

export interface User {
  id: string;
  email: string;
  passwordHash?: string | null;
  authProvider: AuthProvider;
  providerId?: string | null;
  name?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
  createdAt: Date;
}

export interface Account {
  id: string;
  userId: string;
  label: string;
  type: AccountType;
  institution?: string | null;
  externalAccountId?: string | null;
  currency: string;
  startingBalance: string;
  color?: string | null;
  icon?: string | null;
  isArchived: boolean;
  createdAt: Date;
}

export interface AccountWithBalance extends Account {
  balance: string;
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  type: CategoryType;
  parentId?: string | null;
  icon?: string | null;
  color?: string | null;
  bucket?: BudgetBucket | null;
  children?: Category[];
}

export interface Transaction {
  id: string;
  accountId: string;
  categoryId?: string | null;
  bucket?: BudgetBucket | null;
  amount: string;
  type: TransactionType;
  date: Date;
  note?: string | null;
  source: TransactionSource;
  externalTransactionId?: string | null;
  recurringRuleId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  account?: Account;
  category?: Category | null;
}

export interface RecurringRule {
  id: string;
  accountId: string;
  categoryId?: string | null;
  label?: string | null;
  amount: string;
  frequency: Frequency;
  nextDueDate: Date;
  isActive: boolean;
}

export interface Budget {
  id: string;
  userId: string;
  categoryId: string;
  monthlyLimit: string;
  createdAt: Date;
}

export interface BudgetWithCategory extends Budget {
  category: {
    id: string;
    name: string;
    color?: string | null;
    type: CategoryType;
  };
  spent: string;
  remaining: string;
  progress: number;
  over: boolean;
}

export interface MonthlyBudget {
  id: string;
  userId: string;
  amount: string;
}

export interface BucketPoint {
  bucket: BudgetBucket;
  target: string;
  spent: string;
  remaining: string;
  progress: number;
  over: boolean;
}

export interface BucketAllocation {
  amount: string;
  persisted: boolean;
  buckets: BucketPoint[];
  unallocated: string;
}

export interface Goal {
  id: string;
  userId: string;
  name: string;
  targetAmount: string;
  currentAmount: string;
  targetDate?: Date | null;
}

export interface Paginated<T> {
  items: T[];
  nextCursor?: string | null;
}

export interface ApiError {
  error: string;
  code?: string;
}

export interface MonthTotals {
  income: string;
  expense: string;
  balance: string;
}

export interface SpendingByCategory {
  categoryName: string;
  amount: string;
  color?: string | null;
}

export interface MonthlyTrendPoint {
  month: string;
  income: string;
  expense: string;
}