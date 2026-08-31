import { addMonths, addWeeks, addYears } from 'date-fns';
import { prisma, type Prisma } from '@faura-farmer/database';
import type {
  CreateRecurringRuleInput,
  Frequency,
  RecurringRule,
  UpdateRecurringRuleInput,
} from '@faura-farmer/types';

type RuleWithRelations = Prisma.RecurringRuleGetPayload<{
  include: { account: true; category: true };
}>;

function calendarDate(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function dateKey(date: Date) {
  return calendarDate(date).toISOString().slice(0, 10);
}

export function advanceRecurringDate(date: Date, frequency: Frequency) {
  const scheduled = calendarDate(date);
  if (frequency === 'weekly') return addWeeks(scheduled, 1);
  if (frequency === 'monthly') return addMonths(scheduled, 1);
  return addYears(scheduled, 1);
}

export function serializeRecurringRule(rule: RuleWithRelations): RecurringRule & {
  account: RuleWithRelations['account'];
  category: RuleWithRelations['category'];
} {
  return {
    ...rule,
    amount: String(rule.amount),
    type: rule.type as RecurringRule['type'],
  };
}

async function validateDependencies(
  userId: string,
  input: Pick<CreateRecurringRuleInput, 'accountId' | 'categoryId' | 'type'>,
) {
  const [account, category] = await Promise.all([
    prisma.account.findFirst({
      where: { id: input.accountId, userId },
      select: { id: true },
    }),
    input.categoryId
      ? prisma.category.findFirst({
          where: { id: input.categoryId, userId },
          select: { id: true, type: true },
        })
      : null,
  ]);

  if (!account) return { status: 'account_not_found' as const };
  if (input.categoryId && !category) return { status: 'category_not_found' as const };
  if (category && category.type !== input.type) return { status: 'category_type_mismatch' as const };
  return { status: 'valid' as const };
}

export async function listRecurringRules(userId: string) {
  const today = calendarDate(new Date());
  const [rules, due] = await Promise.all([
    prisma.recurringRule.findMany({
      where: { userId },
      include: { account: true, category: true },
      orderBy: [{ isActive: 'desc' }, { nextDueDate: 'asc' }, { id: 'asc' }],
    }),
    prisma.recurringRule.findMany({
      where: { userId, isActive: true, nextDueDate: { lte: today } },
      include: { account: true, category: true },
      orderBy: [{ nextDueDate: 'asc' }, { id: 'asc' }],
    }),
  ]);
  return { items: rules.map(serializeRecurringRule), dueItems: due.map(serializeRecurringRule) };
}

export async function createRecurringRule(userId: string, input: CreateRecurringRuleInput) {
  const validation = await validateDependencies(userId, input);
  if (validation.status !== 'valid') return validation;

  const rule = await prisma.recurringRule.create({
    data: {
      userId,
      accountId: input.accountId,
      categoryId: input.categoryId ?? null,
      label: input.label ?? null,
      amount: input.amount,
      type: input.type,
      frequency: input.frequency,
      nextDueDate: calendarDate(input.nextDueDate),
      isActive: input.isActive ?? true,
    },
    include: { account: true, category: true },
  });
  return { status: 'created' as const, rule: serializeRecurringRule(rule) };
}

export async function updateRecurringRule(
  userId: string,
  id: string,
  input: UpdateRecurringRuleInput,
) {
  const existing = await prisma.recurringRule.findFirst({ where: { id, userId } });
  if (!existing) return { status: 'not_found' as const };

  const effective = {
    accountId: input.accountId ?? existing.accountId,
    categoryId: input.categoryId !== undefined ? input.categoryId : existing.categoryId,
    type: input.type ?? existing.type,
  } as Pick<CreateRecurringRuleInput, 'accountId' | 'categoryId' | 'type'>;
  const validation = await validateDependencies(userId, effective);
  if (validation.status !== 'valid') return validation;

  const updated = await prisma.recurringRule.update({
    where: { id: existing.id },
    data: {
      ...(input.accountId !== undefined ? { accountId: input.accountId } : {}),
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.label !== undefined ? { label: input.label } : {}),
      ...(input.amount !== undefined ? { amount: input.amount } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.frequency !== undefined ? { frequency: input.frequency } : {}),
      ...(input.nextDueDate !== undefined
        ? { nextDueDate: calendarDate(input.nextDueDate) }
        : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
    include: { account: true, category: true },
  });
  return { status: 'updated' as const, rule: serializeRecurringRule(updated) };
}

type OccurrenceResult =
  | { status: 'approved'; transactionId: string; nextDueDate: Date }
  | { status: 'skipped'; nextDueDate: Date }
  | { status: 'not_found' | 'inactive' | 'not_due' | 'stale' | 'invalid_rule' };

async function processOccurrence(
  userId: string,
  ruleId: string,
  expectedDueDate: Date,
  action: 'approve' | 'skip',
): Promise<OccurrenceResult> {
  const expected = calendarDate(expectedDueDate);
  const today = calendarDate(new Date());

  return prisma.$transaction(async (tx) => {
    const rule = await tx.recurringRule.findFirst({
      where: { id: ruleId, userId },
      include: { account: true, category: true },
    });
    if (!rule) return { status: 'not_found' as const };
    if (!rule.isActive) return { status: 'inactive' as const };
    if (dateKey(rule.nextDueDate) !== dateKey(expected)) return { status: 'stale' as const };
    if (rule.nextDueDate > today) return { status: 'not_due' as const };
    if (!rule.account || rule.account.userId !== userId) return { status: 'invalid_rule' as const };
    if (
      (rule.type !== 'income' && rule.type !== 'expense') ||
      (rule.category && (rule.category.userId !== userId || rule.category.type !== rule.type))
    ) {
      return { status: 'invalid_rule' as const };
    }

    const nextDueDate = advanceRecurringDate(rule.nextDueDate, rule.frequency);
    const advanced = await tx.recurringRule.updateMany({
      where: {
        id: rule.id,
        userId,
        isActive: true,
        nextDueDate: rule.nextDueDate,
      },
      data: { nextDueDate },
    });
    if (advanced.count !== 1) return { status: 'stale' as const };

    if (action === 'skip') return { status: 'skipped' as const, nextDueDate };

    const transaction = await tx.transaction.create({
      data: {
        accountId: rule.accountId,
        userId,
        categoryId: rule.categoryId,
        amount: rule.amount,
        type: rule.type,
        date: rule.nextDueDate,
        note: rule.label ?? null,
        source: 'recurring',
        recurringRuleId: rule.id,
      },
      select: { id: true },
    });
    return { status: 'approved' as const, transactionId: transaction.id, nextDueDate };
  });
}

export function approveRecurringOccurrence(userId: string, ruleId: string, expectedDueDate: Date) {
  return processOccurrence(userId, ruleId, expectedDueDate, 'approve');
}

export function skipRecurringOccurrence(userId: string, ruleId: string, expectedDueDate: Date) {
  return processOccurrence(userId, ruleId, expectedDueDate, 'skip');
}
