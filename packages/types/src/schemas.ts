import { z } from 'zod';
import {
  ACCOUNT_TYPES,
  CATEGORY_TYPES,
  TRANSACTION_TYPES,
  FREQUENCIES,
} from './models';

export const registerSchema = z.object({
  email: z.string().trim().email('Enter a valid email address').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

export const loginSchema = registerSchema;

export const accountSchema = z.object({
  label: z.string().trim().min(1, 'Label is required').max(120),
  type: z.enum(ACCOUNT_TYPES),
  institution: z.string().trim().max(120).optional().nullable(),
  currency: z.string().trim().min(3).max(8).default('PHP'),
  startingBalance: z.coerce.number().min(-999999999999).max(999999999999).default(0),
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
});

export const createCategorySchema = categorySchema;
export const updateCategorySchema = categorySchema.partial();

export const transactionSchema = z.object({
  accountId: z.string().uuid('Account is required'),
  categoryId: z.string().uuid().optional().nullable(),
  amount: z.coerce.number().positive('Amount must be positive').max(999999999999),
  type: z.enum(TRANSACTION_TYPES),
  date: z.coerce.date(),
  note: z.string().trim().max(500).optional().nullable(),
});

export const createTransactionSchema = transactionSchema;
export const updateTransactionSchema = transactionSchema.partial();

export const transactionListQuerySchema = z.object({
  accountId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  type: z.enum(TRANSACTION_TYPES).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  q: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().uuid().optional(),
});

export const accountType = z.enum(ACCOUNT_TYPES);
export const categoryType = z.enum(CATEGORY_TYPES);
export const transactionType = z.enum(TRANSACTION_TYPES);
export const frequency = z.enum(FREQUENCIES);

export type RegisterInput = z.infer<typeof registerSchema>;
export type AccountInput = z.infer<typeof accountSchema>;
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type TransactionListQuery = z.infer<typeof transactionListQuerySchema>;