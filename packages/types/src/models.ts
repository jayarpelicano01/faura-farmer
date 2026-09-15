import type { AccountCurrency } from './currency';

export const ACCOUNT_TYPES = ['bank', 'e_wallet', 'cash', 'credit_card', 'investment'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const CATEGORY_TYPES = ['income', 'expense'] as const;
export type CategoryType = (typeof CATEGORY_TYPES)[number];

export const BUDGET_BUCKETS = ['needs', 'wants', 'savings'] as const;
export type BudgetBucket = (typeof BUDGET_BUCKETS)[number];

export const TRANSACTION_TYPES = ['income', 'expense', 'transfer'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const TRANSFER_ROLES = ['outgoing', 'incoming'] as const;
export type TransferRole = (typeof TRANSFER_ROLES)[number];

export const FREQUENCIES = ['weekly', 'monthly', 'yearly'] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const DEBT_DIRECTIONS = ['receivable', 'payable'] as const;
export type DebtDirection = (typeof DEBT_DIRECTIONS)[number];

export const DEBT_STATUSES = ['open', 'partially_paid', 'paid', 'written_off'] as const;
export type DebtStatus = (typeof DEBT_STATUSES)[number];

export const DEBT_ADJUSTMENT_REASONS = ['correction', 'agreed_reduction', 'partial_forgiveness', 'other'] as const;
export type DebtAdjustmentReason = (typeof DEBT_ADJUSTMENT_REASONS)[number];

export const DEBT_CASH_DIRECTIONS = ['in', 'out'] as const;
export type DebtCashDirection = (typeof DEBT_CASH_DIRECTIONS)[number];

export const AUTH_PROVIDERS = ['email', 'google', 'facebook'] as const;
export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

export const TRANSACTION_SOURCES = ['manual', 'bank_sync', 'recurring', 'csv_import'] as const;
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
  sessionVersion: number;
  createdAt: Date;
}

export interface Account {
  id: string;
  userId: string;
  label: string;
  type: AccountType;
  institution?: string | null;
  externalAccountId?: string | null;
  currency: AccountCurrency;
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
  icon?: string | null;
  color?: string | null;
  bucket?: BudgetBucket | null;
}

export interface Transaction {
  id: string;
  accountId: string;
  categoryId?: string | null;
  bucket?: BudgetBucket | null;
  amount: string;
  type: TransactionType;
  transferGroupId?: string | null;
  transferRole?: TransferRole | null;
  destinationAccountId?: string | null;
  date: Date;
  note?: string | null;
  source: TransactionSource;
  externalTransactionId?: string | null;
  recurringRuleId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  account?: Account;
  destinationAccount?: Account | null;
  category?: Category | null;
}

export interface RecurringRule {
  id: string;
  accountId: string;
  userId: string;
  categoryId?: string | null;
  label?: string | null;
  amount: string;
  type: Exclude<TransactionType, 'transfer'>;
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

export interface Person {
  id: string;
  userId: string;
  displayName: string;
  contact?: string | null;
  note?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DebtAdjustment {
  id: string;
  debtId: string;
  amount: string;
  reason: DebtAdjustmentReason;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface DebtPayment {
  id: string;
  debtId: string;
  amount: string;
  date: Date;
  note?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DebtCashEvent {
  id: string;
  debtId: string;
  paymentId?: string | null;
  accountId: string;
  amount: string;
  direction: DebtCashDirection;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Debt {
  id: string;
  userId: string;
  personId: string;
  direction: DebtDirection;
  originalPrincipal: string;
  currency: AccountCurrency;
  status: DebtStatus;
  openedAt: Date;
  dueDate?: Date | null;
  note?: string | null;
  isHidden: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DebtWithDetails extends Debt {
  person: Person;
  adjustments: DebtAdjustment[];
  payments: DebtPayment[];
  cashEvents: DebtCashEvent[];
  outstandingBalance: string;
}

export interface DebtSummary {
  owedToYou: string;
  youOwe: string;
  netPosition: string;
}

export const REPORT_PERIODS = ['week', 'month'] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];

export interface BudgetVarianceRow {
  id: string;
  categoryName: string;
  color?: string | null;
  limit: string;
  spent: string;
  remaining: string;
  progress: number;
  over: boolean;
  kind: 'budget' | 'unbudgeted' | 'uncategorized';
}

export interface CategoryComparisonRow {
  categoryName: string;
  color?: string | null;
  current: string;
  previous: string;
  change: string;
  percentageChange: number | null;
}
