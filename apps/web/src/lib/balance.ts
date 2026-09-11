import { toNumber } from './format';

type GroupedTransaction = {
  type: string;
  transferRole: string | null;
  _sum: { amount: unknown };
};

/** Compute net transaction flow from Prisma groupBy rows. */
export function computeNetFromGrouped(rows: GroupedTransaction[]): number {
  return rows.reduce((net, row) => {
    const amount = toNumber(row._sum.amount);
    return row.type === 'income' || (row.type === 'transfer' && row.transferRole === 'incoming')
      ? net + amount
      : net - amount;
  }, 0);
}

/** Compute an account balance from its opening balance and net transaction flow. */
export function accountBalance(startingBalance: unknown, net: number): number {
  return toNumber(startingBalance) + net;
}
