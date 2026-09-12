import { convertMoney, type CurrencyPreference } from './currency';
import type { DebtStatus, DebtSummary } from './models';

type AmountRow = { amount: string | number };

export type DebtStateInput = {
  originalPrincipal: string | number;
  adjustments: AmountRow[];
  payments: AmountRow[];
  status?: DebtStatus;
};

function cents(value: string | number) {
  const match = /^(-?)(\d+)(?:\.(\d*))?$/.exec(String(value).trim());
  if (!match) return 0n;
  const fraction = (match[3] ?? '').slice(0, 2).padEnd(2, '0');
  const amount = BigInt(match[2]) * 100n + BigInt(fraction || '0');
  return match[1] === '-' ? -amount : amount;
}

export function decimal(value: bigint) {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  return `${negative ? '-' : ''}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
}

/** Immutable-ledger balance: principal plus adjustments minus payments. */
export function calculateDebtState(input: DebtStateInput): { outstandingBalance: string; status: DebtStatus } {
  const principal = cents(input.originalPrincipal);
  const adjustments = input.adjustments.reduce((sum, adjustment) => sum + cents(adjustment.amount), 0n);
  const payments = input.payments.reduce((sum, payment) => sum + cents(payment.amount), 0n);
  const outstanding = principal + adjustments - payments;
  const normalized = outstanding < 0n ? 0n : outstanding;
  if (input.status === 'written_off') return { outstandingBalance: decimal(normalized), status: 'written_off' };
  if (normalized === 0n) return { outstandingBalance: '0.00', status: 'paid' };
  return { outstandingBalance: decimal(normalized), status: payments > 0n ? 'partially_paid' : 'open' };
}

export function debtCashDirection(direction: 'receivable' | 'payable', event: 'opening' | 'payment') {
  if (event === 'opening') return direction === 'receivable' ? 'out' : 'in';
  return direction === 'receivable' ? 'in' : 'out';
}

export function summarizeDebtBalances(
  debts: Array<{ direction: 'receivable' | 'payable'; currency: string; outstandingBalance: string }>,
  preference: CurrencyPreference,
): DebtSummary {
  let owedToYou = 0n;
  let youOwe = 0n;
  for (const debt of debts) {
    const converted = cents(convertMoney(debt.outstandingBalance, debt.currency, preference.displayCurrency, preference.usdPerPhp));
    if (debt.direction === 'receivable') owedToYou += converted;
    else youOwe += converted;
  }
  return { owedToYou: decimal(owedToYou), youOwe: decimal(youOwe), netPosition: decimal(owedToYou - youOwe) };
}
