import type { Account, Category, TransactionType } from '@faura-farmer/types';
import { formatMoney } from '@/lib/format';

export const ACCOUNT_TYPE_META: Record<AccountTypeLabel, { label: string }> = {
  bank: { label: 'Bank' },
  e_wallet: { label: 'E-wallet' },
  cash: { label: 'Cash' },
  credit_card: { label: 'Credit card' },
  investment: { label: 'Investment' },
};

type AccountTypeLabel = 'bank' | 'e_wallet' | 'cash' | 'credit_card' | 'investment';

export type SelectAccount = Pick<Account, 'id' | 'label' | 'currency'>;

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