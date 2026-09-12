import { Prisma, prisma } from '@faura-farmer/database';
import type {
  CreateDebtAdjustmentInput,
  CreateDebtInput,
  CreateDebtPaymentInput,
  CreatePersonInput,
  UpdateDebtInput,
  UpdatePersonInput,
} from '@faura-farmer/types';
import { calculateDebtState, debtCashDirection } from '@/lib/debt-ledger';

type Tx = Prisma.TransactionClient;

export class DebtLedgerError extends Error {
  constructor(readonly code: string, message: string, readonly status = 400) {
    super(message);
  }
}

const debtDetails = {
  person: true,
  adjustments: { orderBy: [{ date: 'asc' }, { createdAt: 'asc' }] },
  payments: { orderBy: [{ date: 'asc' }, { createdAt: 'asc' }], include: { cashEvent: true } },
  cashEvents: { orderBy: [{ date: 'asc' }, { createdAt: 'asc' }], include: { account: { select: { id: true, label: true, currency: true } } }, },
} satisfies Prisma.DebtInclude;

export type DebtDetails = Prisma.DebtGetPayload<{ include: typeof debtDetails }>;

function dateOnly(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function statusFor(debt: Pick<DebtDetails, 'originalPrincipal' | 'status' | 'adjustments' | 'payments'>) {
  return calculateDebtState({
    originalPrincipal: String(debt.originalPrincipal),
    adjustments: debt.adjustments.map((adjustment) => ({ amount: String(adjustment.amount) })),
    payments: debt.payments.map((payment) => ({ amount: String(payment.amount) })),
    status: debt.status,
  });
}

async function debtForUser(tx: Tx, userId: string, debtId: string) {
  const debt = await tx.debt.findFirst({ where: { id: debtId, userId }, include: debtDetails });
  if (!debt) throw new DebtLedgerError('DEBT_NOT_FOUND', 'Debt not found', 404);
  return debt;
}

function requireActiveDebt(debt: DebtDetails) {
  if (debt.status !== 'open' && debt.status !== 'partially_paid') {
    throw new DebtLedgerError('DEBT_CLOSED', 'Only open debts can receive payments or adjustments');
  }
}

async function updateCalculatedStatus(tx: Tx, debt: DebtDetails) {
  const state = statusFor(debt);
  if (state.status !== debt.status) {
    await tx.debt.update({ where: { id: debt.id }, data: { status: state.status } });
  }
  return state;
}

function requireSameCurrency(account: { currency: string } | null, currency: string) {
  if (!account) throw new DebtLedgerError('ACCOUNT_NOT_FOUND', 'Account not found', 404);
  if (account.currency.toUpperCase() !== currency.toUpperCase()) {
    throw new DebtLedgerError('CURRENCY_MISMATCH', 'The selected account must use the debt currency');
  }
}

export async function listPersons(userId: string) {
  return prisma.person.findMany({ where: { userId }, orderBy: [{ displayName: 'asc' }, { id: 'asc' }] });
}

export async function createPerson(userId: string, input: CreatePersonInput) {
  return prisma.person.create({ data: { userId, ...input } });
}

export async function updatePerson(userId: string, personId: string, input: UpdatePersonInput) {
  const person = await prisma.person.findFirst({ where: { id: personId, userId }, select: { id: true } });
  if (!person) throw new DebtLedgerError('PERSON_NOT_FOUND', 'Person not found', 404);
  return prisma.person.update({ where: { id: person.id }, data: input });
}

export async function deletePerson(userId: string, personId: string) {
  return prisma.$transaction(async (tx) => {
    const person = await tx.person.findFirst({ where: { id: personId, userId }, select: { id: true } });
    if (!person) throw new DebtLedgerError('PERSON_NOT_FOUND', 'Person not found', 404);
    const debt = await tx.debt.findFirst({ where: { personId: person.id }, select: { id: true } });
    if (debt) throw new DebtLedgerError('PERSON_HAS_DEBTS', 'A person with debt history cannot be deleted');
    await tx.person.delete({ where: { id: person.id } });
  });
}

export async function listDebts(userId: string): Promise<DebtDetails[]> {
  return prisma.debt.findMany({
    where: { userId },
    include: debtDetails,
    orderBy: [{ person: { displayName: 'asc' } }, { openedAt: 'desc' }, { id: 'desc' }],
  });
}

export async function getDebt(userId: string, debtId: string) {
  return prisma.$transaction((tx) => debtForUser(tx, userId, debtId));
}

export async function createDebt(userId: string, input: CreateDebtInput) {
  return prisma.$transaction(async (tx) => {
    const person = await tx.person.findFirst({ where: { id: input.personId, userId }, select: { id: true } });
    if (!person) throw new DebtLedgerError('PERSON_NOT_FOUND', 'Person not found', 404);

    let openingAccount: { id: string; currency: string } | null = null;
    if (input.openingAccountId) {
      openingAccount = await tx.account.findFirst({ where: { id: input.openingAccountId, userId }, select: { id: true, currency: true } });
      requireSameCurrency(openingAccount, input.currency);
    }

    const debt = await tx.debt.create({
      data: {
        userId,
        personId: person.id,
        direction: input.direction,
        originalPrincipal: new Prisma.Decimal(input.originalPrincipal),
        currency: input.currency,
        openedAt: dateOnly(input.openedAt),
        dueDate: input.dueDate ? dateOnly(input.dueDate) : null,
        note: input.note ?? null,
      },
    });

    if (openingAccount) {
      await tx.debtCashEvent.create({
        data: {
          debtId: debt.id,
          accountId: openingAccount.id,
          amount: debt.originalPrincipal,
          direction: debtCashDirection(input.direction, 'opening'),
          date: debt.openedAt,
        },
      });
    }
    return debtForUser(tx, userId, debt.id);
  });
}

export async function updateDebt(userId: string, debtId: string, input: UpdateDebtInput) {
  return prisma.$transaction(async (tx) => {
    const debt = await debtForUser(tx, userId, debtId);
    await tx.debt.update({
      where: { id: debt.id },
      data: {
        ...(Object.hasOwn(input, 'dueDate') ? { dueDate: input.dueDate ? dateOnly(input.dueDate) : null } : {}),
        ...(Object.hasOwn(input, 'note') ? { note: input.note ?? null } : {}),
      },
    });
    return debtForUser(tx, userId, debt.id);
  });
}

export async function createDebtPayment(userId: string, debtId: string, input: CreateDebtPaymentInput) {
  return prisma.$transaction(async (tx) => {
    const debt = await debtForUser(tx, userId, debtId);
    requireActiveDebt(debt);
    const before = statusFor(debt);
    if (new Prisma.Decimal(input.amount).gt(before.outstandingBalance)) {
      throw new DebtLedgerError('PAYMENT_EXCEEDS_BALANCE', 'Payment cannot exceed the outstanding balance');
    }
    let account: { id: string; currency: string } | null = null;
    if (input.accountId) {
      account = await tx.account.findFirst({ where: { id: input.accountId, userId }, select: { id: true, currency: true } });
      requireSameCurrency(account, debt.currency);
    }
    const payment = await tx.debtPayment.create({
      data: { debtId: debt.id, amount: new Prisma.Decimal(input.amount), date: dateOnly(input.date), note: input.note ?? null },
    });
    if (account) {
      await tx.debtCashEvent.create({
        data: {
          debtId: debt.id,
          paymentId: payment.id,
          accountId: account.id,
          amount: payment.amount,
          direction: debtCashDirection(debt.direction, 'payment'),
          date: payment.date,
        },
      });
    }
    const updated = await debtForUser(tx, userId, debt.id);
    await updateCalculatedStatus(tx, updated);
    return debtForUser(tx, userId, debt.id);
  });
}

export async function createDebtAdjustment(userId: string, debtId: string, input: CreateDebtAdjustmentInput) {
  return prisma.$transaction(async (tx) => {
    const debt = await debtForUser(tx, userId, debtId);
    requireActiveDebt(debt);
    const before = statusFor(debt);
    const resulting = new Prisma.Decimal(before.outstandingBalance).plus(input.amount);
    if (resulting.isNegative()) {
      throw new DebtLedgerError('ADJUSTMENT_EXCEEDS_BALANCE', 'Adjustment cannot reduce the outstanding balance below zero');
    }
    const reason = input.reason === 'other' ? `other: ${input.otherReason}` : input.reason;
    await tx.debtAdjustment.create({
      data: { debtId: debt.id, amount: new Prisma.Decimal(input.amount), reason, date: dateOnly(input.date) },
    });
    const updated = await debtForUser(tx, userId, debt.id);
    await updateCalculatedStatus(tx, updated);
    return debtForUser(tx, userId, debt.id);
  });
}

export async function changeDebtStatus(userId: string, debtId: string, action: 'reopen' | 'write_off') {
  return prisma.$transaction(async (tx) => {
    const debt = await debtForUser(tx, userId, debtId);
    if (action === 'write_off') {
      requireActiveDebt(debt);
      await tx.debt.update({ where: { id: debt.id }, data: { status: 'written_off' } });
    } else {
      if (debt.status !== 'paid' && debt.status !== 'written_off') {
        throw new DebtLedgerError('DEBT_NOT_CLOSED', 'Only paid or written-off debts can be reopened');
      }
      await tx.debt.update({ where: { id: debt.id }, data: { status: 'open' } });
    }
    return debtForUser(tx, userId, debt.id);
  });
}

/** Lists integrity mismatches for operator review before a database migration is applied. */
export async function listDebtCashEventReconciliationIssues(userId: string) {
  const events = await prisma.debtCashEvent.findMany({
    where: { debt: { userId } },
    include: { debt: { select: { id: true, direction: true, currency: true, originalPrincipal: true } }, payment: { select: { id: true, amount: true } }, account: { select: { id: true, currency: true } } },
  });
  return events.flatMap((event) => {
    const expectedAmount = event.payment?.amount ?? event.debt.originalPrincipal;
    const expectedDirection = debtCashDirection(event.debt.direction, event.payment ? 'payment' : 'opening');
    const issues: Array<{ cashEventId: string; debtId: string; code: string; message: string }> = [];
    if (!event.amount.equals(expectedAmount)) issues.push({ cashEventId: event.id, debtId: event.debtId, code: 'AMOUNT_MISMATCH', message: 'Cash-event amount does not match its debt entry' });
    if (event.direction !== expectedDirection) issues.push({ cashEventId: event.id, debtId: event.debtId, code: 'DIRECTION_MISMATCH', message: 'Cash-event direction does not match its debt entry' });
    if (event.account.currency.toUpperCase() !== event.debt.currency.toUpperCase()) issues.push({ cashEventId: event.id, debtId: event.debtId, code: 'CURRENCY_MISMATCH', message: 'Cash-event account currency does not match the debt' });
    return issues;
  });
}

export function serializeDebt(debt: DebtDetails) {
  const state = statusFor(debt);
  return {
    ...debt,
    originalPrincipal: String(debt.originalPrincipal),
    openedAt: debt.openedAt.toISOString().slice(0, 10),
    dueDate: debt.dueDate?.toISOString().slice(0, 10) ?? null,
    createdAt: debt.createdAt.toISOString(),
    updatedAt: debt.updatedAt.toISOString(),
    status: debt.status,
    outstandingBalance: state.outstandingBalance,
    person: {
      ...debt.person,
      createdAt: debt.person.createdAt.toISOString(),
      updatedAt: debt.person.updatedAt.toISOString(),
    },
    adjustments: debt.adjustments.map((adjustment) => ({
      ...adjustment,
      amount: String(adjustment.amount),
      date: adjustment.date.toISOString().slice(0, 10),
      createdAt: adjustment.createdAt.toISOString(),
      updatedAt: adjustment.updatedAt.toISOString(),
    })),
    payments: debt.payments.map((payment) => ({
      ...payment,
      amount: String(payment.amount),
      date: payment.date.toISOString().slice(0, 10),
      createdAt: payment.createdAt.toISOString(),
      updatedAt: payment.updatedAt.toISOString(),
      cashEvent: payment.cashEvent ? {
        ...payment.cashEvent,
        amount: String(payment.cashEvent.amount),
        date: payment.cashEvent.date.toISOString().slice(0, 10),
        createdAt: payment.cashEvent.createdAt.toISOString(),
        updatedAt: payment.cashEvent.updatedAt.toISOString(),
      } : null,
    })),
    cashEvents: debt.cashEvents.map((event) => ({
      ...event,
      amount: String(event.amount),
      date: event.date.toISOString().slice(0, 10),
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    })),
  };
}
