import type { MobileAccount, MobileDebtCashEvent, MobileTransaction } from '@faura-farmer/types';

/** Calculate one account's current balance from its locally stored transactions. */
export function currentBalance(account: MobileAccount, transactions: MobileTransaction[], debtCashEvents: MobileDebtCashEvent[] = []) {
  const transactionBalance = transactions.reduce((balance, transaction) => {
    const amount = Number(transaction.amount);
    if (transaction.type === 'income' && transaction.accountId === account.id) return balance + amount;
    if (transaction.type === 'expense' && transaction.accountId === account.id) return balance - amount;
    if (transaction.type === 'transfer') {
      if (transaction.accountId === account.id) return balance - amount;
      if (transaction.destinationAccountId === account.id) return balance + amount;
    }
    return balance;
  }, Number(account.startingBalance));
  return debtCashEvents.reduce((balance, event) => {
    if (event.accountId !== account.id) return balance;
    const amount = Number(event.amount);
    return event.direction === 'in' ? balance + amount : balance - amount;
  }, transactionBalance);
}
