import { z } from 'zod';
import { ACCOUNT_TYPES, BUDGET_BUCKETS, CATEGORY_TYPES, TRANSACTION_TYPES } from './models';

const uuid = z.string().uuid();
const decimalString = z.string().regex(/^\d+(?:\.\d{1,2})?$/, 'Amount must be a decimal string');
const positiveDecimalString = decimalString.refine((value) => Number(value) > 0, 'Amount must be positive');
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');
const cursor = z.string().regex(/^\d+$/, 'Cursor must be an unsigned integer');

export const mobileAccountSchema = z.object({
  id: uuid,
  label: z.string().trim().min(1).max(120),
  type: z.enum(ACCOUNT_TYPES),
  institution: z.string().trim().max(120).nullable(),
  currency: z.string().trim().min(3).max(8),
  startingBalance: decimalString,
  color: z.string().trim().max(40).nullable(),
  icon: z.string().trim().max(40).nullable(),
  isArchived: z.boolean(),
  updatedAt: z.string().datetime(),
});

export const mobileCategorySchema = z.object({
  id: uuid,
  name: z.string().trim().min(1).max(120),
  type: z.enum(CATEGORY_TYPES),
  parentId: uuid.nullable(),
  icon: z.string().trim().max(40).nullable(),
  color: z.string().trim().max(40).nullable(),
  bucket: z.enum(BUDGET_BUCKETS).nullable(),
  updatedAt: z.string().datetime(),
});

export const mobileTransactionSchema = z
  .object({
    id: uuid,
    accountId: uuid,
    categoryId: uuid.nullable(),
    bucket: z.enum(BUDGET_BUCKETS).nullable(),
    amount: positiveDecimalString,
    type: z.enum(TRANSACTION_TYPES),
    destinationAccountId: uuid.nullable(),
    date: dateString,
    note: z.string().max(500).nullable(),
    updatedAt: z.string().datetime(),
  })
  .superRefine((record, context) => {
    if (record.type === 'transfer') {
      if (!record.destinationAccountId || record.destinationAccountId === record.accountId) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: 'Transfer needs a different destination account' });
      }
      if (record.categoryId || record.bucket) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: 'Transfers cannot have a category or budget bucket' });
      }
    }
  });

export const mobileEntitySchema = z.discriminatedUnion('entity', [
  z.object({ entity: z.literal('account'), record: mobileAccountSchema }),
  z.object({ entity: z.literal('category'), record: mobileCategorySchema }),
  z.object({ entity: z.literal('transaction'), record: mobileTransactionSchema }),
]);

export const mobileSyncMutationSchema = z.discriminatedUnion('operation', [
  z.object({
    mutationId: uuid,
    entity: z.enum(['account', 'category', 'transaction']),
    recordId: uuid,
    operation: z.literal('upsert'),
    baseCursor: cursor.nullable(),
    record: z.union([mobileAccountSchema, mobileCategorySchema, mobileTransactionSchema]),
  }),
  z.object({
    mutationId: uuid,
    entity: z.enum(['account', 'category', 'transaction']),
    recordId: uuid,
    operation: z.literal('delete'),
    baseCursor: cursor.nullable(),
  }),
]);

export const mobileSyncPushSchema = z.object({
  baseCursor: cursor.nullable(),
  mutations: z.array(mobileSyncMutationSchema).min(1).max(100),
});

export const mobileSyncPullSchema = z.object({ cursor: cursor.default('0') });

export type MobileAccount = z.infer<typeof mobileAccountSchema>;
export type MobileCategory = z.infer<typeof mobileCategorySchema>;
export type MobileTransaction = z.infer<typeof mobileTransactionSchema>;
export type MobileSyncMutation = z.infer<typeof mobileSyncMutationSchema>;
export type MobileSyncPush = z.infer<typeof mobileSyncPushSchema>;

export type MobileAuthResponse = {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  user: { id: string; email: string; name: string | null };
};

export type MobileSyncChange = {
  cursor: string;
  entity: 'account' | 'category' | 'transaction';
  recordId: string;
  operation: 'upsert' | 'delete';
  record: MobileAccount | MobileCategory | MobileTransaction | null;
};

export type MobileApiError = { error: string; code: string };
