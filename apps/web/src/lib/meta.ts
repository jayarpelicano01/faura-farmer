import type { Account, BudgetBucket, Category, Transaction, TransactionType } from '@faura-farmer/types';
import { formatMoney } from '@/lib/format';

export const BUCKET_META: Record<BudgetBucket, { label: string; description: string; color: string }> = {
  needs: { label: 'Needs', description: 'Housing, food, bills', color: '#0d9488' },
  wants: { label: 'Wants', description: 'Dining out, travel, fun', color: '#f59e0b' },
  savings: { label: 'Savings', description: 'Emergency fund, goals', color: '#6366f1' },
};

export const BUCKET_BADGE_COLOR: Record<BudgetBucket, string> = {
  needs: '#a5b4fc',
  wants: '#3730a3',
  savings: '#c7d2fe',
};

export const ACCOUNT_TYPE_META: Record<AccountTypeLabel, { label: string }> = {
  bank: { label: 'Bank' },
  e_wallet: { label: 'E-wallet' },
  cash: { label: 'Cash' },
  credit_card: { label: 'Credit card' },
  investment: { label: 'Investment' },
};

type AccountTypeLabel = 'bank' | 'e_wallet' | 'cash' | 'credit_card' | 'investment';

export type SelectAccount = Pick<Account, 'id' | 'label' | 'currency'>;

export function resolveCategoryBucket(categories: Category[], category: Category): BudgetBucket | null {
  let current: Category | undefined = category;
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    if (current.bucket) return current.bucket;
    seen.add(current.id);
    current = categories.find((c) => c.id === current?.parentId);
  }
  return null;
}

export function resolveTransactionBucket(
  categories: Category[],
  tx: Pick<Transaction, 'bucket' | 'categoryId'> & { category?: Category | null },
): BudgetBucket | null {
  if (tx.bucket) return tx.bucket;
  const category = tx.category ?? categories.find((c) => c.id === tx.categoryId) ?? null;
  return category ? resolveCategoryBucket(categories, category) : null;
}

export function toAccountOptions(accounts: Account[]): SelectAccount[] {
  return accounts.map((a) => ({
    id: a.id,
    label: a.label,
    currency: a.currency,
  }));
}

export function moneyForAccount(amount: string | number, account?: Pick<Account, 'currency'> | null) {
  return formatMoney(amount, account?.currency ?? 'PHP');
}

export const TYPE_BADGE_VARIANT: Record<
  TransactionType,
  'income' | 'expense' | 'muted'
> = {
  income: 'income',
  expense: 'expense',
  transfer: 'muted',
};

export function categoriesByType(categories: Category[], type: TransactionType): Category[] {
  if (type === 'income') return categories.filter((c) => c.type === 'income');
  return categories.filter((c) => c.type === 'expense');
}