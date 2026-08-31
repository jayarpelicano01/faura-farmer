import { z } from 'zod';
import {
  ACCOUNT_TYPES,
  BUDGET_BUCKETS,
  CATEGORY_TYPES,
  TRANSACTION_TYPES,
  FREQUENCIES,
} from './models';

const emailField = z.string().trim().email('Enter a valid email address').max(255);

const strongPassword = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[a-z]/, 'Password must include a lowercase letter')
  .regex(/[A-Z]/, 'Password must include an uppercase letter')
  .regex(/[0-9]/, 'Password must include a number')
  .regex(/[^A-Za-z0-9]/, 'Password must include a special character');

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Password is required').max(128),
});

export const registerSchema = z
  .object({
    email: emailField,
    password: strongPassword,
    passwordConfirm: z.string(),
    name: z.string().trim().max(120).optional(),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: 'Passwords do not match',
    path: ['passwordConfirm'],
  });

export const updateProfileSchema = z.object({
  name: z.string().trim().max(120).optional().nullable(),
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Username can only contain letters, numbers, dots, dashes and underscores')
    .optional()
    .nullable(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: strongPassword,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const accountSchema = z.object({
  label: z.string().trim().min(1, 'Label is required').max(120),
  type: z.enum(ACCOUNT_TYPES),
  institution: z.string().trim().max(120).optional().nullable(),
  currency: z.string().trim().min(3).max(8).default('PHP'),
  startingBalance: z
    .coerce
    .number()
    .min(0, 'Starting balance cannot be negative')
    .max(999999999999)
    .default(0),
  color: z.string().trim().max(40).optional().nullable(),
  icon: z.string().trim().max(40).optional().nullable(),
});

export const createAccountSchema = accountSchema;
export const updateAccountSchema = accountSchema.partial().extend({
  isArchived: z.boolean().optional(),
});

export const categorySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  type: z.enum(CATEGORY_TYPES),
  parentId: z.string().uuid().optional().nullable(),
  icon: z.string().trim().max(40).optional().nullable(),
  color: z.string().trim().max(40).optional().nullable(),
  bucket: z.enum(BUDGET_BUCKETS).optional().nullable(),
});

export const createCategorySchema = categorySchema;
export const updateCategorySchema = categorySchema.partial();

export const budgetSchema = z.object({
  categoryId: z.string().uuid('Category is required'),
  monthlyLimit: z.coerce.number().positive('Monthly limit must be positive').max(999999999999),
});

export const createBudgetSchema = budgetSchema;
export const updateBudgetSchema = budgetSchema.partial();

export const monthlyBudgetSchema = z.object({
  amount: z.coerce.number().positive('Monthly budget must be positive').max(999999999999),
});

const transactionFields = {
  accountId: z.string().uuid('Account is required'),
  amount: z.coerce.number().positive('Amount must be positive').max(999999999999),
  date: z.coerce.date(),
  note: z.string().trim().max(500).optional().nullable(),
};

const ordinaryTransactionSchema = z
  .object({
    ...transactionFields,
    type: z.enum(['income', 'expense']),
    categoryId: z.string().uuid().optional().nullable(),
    bucket: z.enum(BUDGET_BUCKETS).optional().nullable(),
    destinationAccountId: z.never().optional(),
  })
  .strict();

const transferTransactionSchema = z
  .object({
    ...transactionFields,
    type: z.literal('transfer'),
    destinationAccountId: z.string().uuid('Destination account is required'),
    categoryId: z.never().optional(),
    bucket: z.never().optional(),
  })
  .strict();

export const transactionSchema = z
  .discriminatedUnion('type', [ordinaryTransactionSchema, transferTransactionSchema])
  .refine(
    (data) => data.type !== 'transfer' || data.accountId !== data.destinationAccountId,
    {
      message: 'Source and destination accounts must be different',
      path: ['destinationAccountId'],
    },
  );

export const createTransactionSchema = transactionSchema;
export const updateTransactionSchema = z
  .object({
    accountId: transactionFields.accountId.optional(),
    destinationAccountId: z.string().uuid('Destination account is required').optional(),
    categoryId: z.string().uuid().optional().nullable(),
    bucket: z.enum(BUDGET_BUCKETS).optional().nullable(),
    amount: transactionFields.amount.optional(),
    type: z.enum(TRANSACTION_TYPES).optional(),
    date: transactionFields.date.optional(),
    note: transactionFields.note,
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, 'At least one field is required');

export const transactionListQuerySchema = z.object({
  accountId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  type: z.enum(TRANSACTION_TYPES).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(10),
});

export const accountType = z.enum(ACCOUNT_TYPES);
export const categoryType = z.enum(CATEGORY_TYPES);
export const transactionType = z.enum(TRANSACTION_TYPES);
export const frequency = z.enum(FREQUENCIES);

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type AccountInput = z.infer<typeof accountSchema>;
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;
export type MonthlyBudgetInput = z.infer<typeof monthlyBudgetSchema>;
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type TransactionListQuery = z.infer<typeof transactionListQuerySchema>;
