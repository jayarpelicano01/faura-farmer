import { toNumber } from './format';

type GroupedTransaction = {
  type: string;
  transferRole: string | null;
  _sum: { amount: unknown };
};

type GroupedDebtCashEvent = {
  direction: string;
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

/** Compute the signed account effect of dedicated debt cash-event rows. */
export function computeDebtCashNet(rows: GroupedDebtCashEvent[]): number {
  return rows.reduce((net, row) => {
    const amount = toNumber(row._sum.amount);
    return row.direction === 'in' ? net + amount : net - amount;
  }, 0);
}
