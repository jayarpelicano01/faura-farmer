import type { MobileAccount, MobileTransaction } from '@faura-farmer/types';

/** Calculate one account's current balance from its locally stored transactions. */
export function currentBalance(account: MobileAccount, transactions: MobileTransaction[]) {
  return transactions.reduce((balance, transaction) => {
    const amount = Number(transaction.amount);
    if (transaction.type === 'income' && transaction.accountId === account.id) return balance + amount;
    if (transaction.type === 'expense' && transaction.accountId === account.id) return balance - amount;
    if (transaction.type === 'transfer') {
      if (transaction.accountId === account.id) return balance - amount;
      if (transaction.destinationAccountId === account.id) return balance + amount;
    }
    return balance;
  }, Number(account.startingBalance));
}
