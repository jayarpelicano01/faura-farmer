'use client';

import { useState } from 'react';
import { ChevronDown, Pencil, Trash2 } from 'lucide-react';
import type { BudgetBucket, Transaction } from '@faura-farmer/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatDate, formatMoney } from '@/lib/format';
import { BUCKET_BADGE_COLOR, BUCKET_META, TYPE_BADGE_VARIANT } from '@/lib/meta';
import { Skeleton } from '@/components/ui/skeleton';

interface TransactionListProps {
  transactions: Transaction[];
  variant?: 'recent' | 'full';
  onEdit?: (tx: Transaction) => void;
  onDelete?: (tx: Transaction) => void;
  loading?: boolean;
  emptyMessage?: string;
  getBucket?: (tx: Transaction) => BudgetBucket | null;
}

function BucketTag({ bucket }: { bucket: BudgetBucket | null }) {
  if (!bucket) return null;
  const meta = BUCKET_META[bucket];
  return (
    <span className="ml-2 inline-flex items-center gap-1 align-middle text-xs text-muted-foreground">
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: BUCKET_BADGE_COLOR[bucket] }}
      />
      {meta.label}
    </span>
  );
}

function sign(type: Transaction['type']): string {
  if (type === 'income') return '+';
  if (type === 'expense') return '−';
  return '';
}

function amountClass(type: Transaction['type']): string {
  if (type === 'income') return 'text-income';
  if (type === 'expense') return 'text-expense';
  return 'text-foreground';
}

function amount(tx: Transaction): string {
  return formatMoney(tx.amount, tx.account?.currency ?? 'PHP');
}

function MobileItem({
  tx,
  variant,
  onEdit,
  onDelete,
  bucket,
}: {
  tx: Transaction;
  variant: 'recent' | 'full';
  onEdit?: (tx: Transaction) => void;
  onDelete?: (tx: Transaction) => void;
  bucket: BudgetBucket | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-md border border-border bg-background">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: tx.account?.color ?? '#adb5bd' }}
          >
            {(tx.account?.label ?? '?').charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {tx.account?.label ?? '—'}
            </p>
            <p className="truncate text-xs text-muted-foreground">{formatDate(tx.date)}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={cn('text-sm font-semibold', amountClass(tx.type))}>
            {sign(tx.type)}
            {amount(tx)}
          </span>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform',
              open && 'rotate-180',
            )}
          />
        </div>
      </button>

      {open && (
        <div className="border-t border-border px-3 py-3">
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Type</dt>
              <dd>
                <Badge variant={TYPE_BADGE_VARIANT[tx.type]}>{tx.type}</Badge>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Category</dt>
              <dd className="flex items-center gap-1 text-foreground">
                {tx.category?.name ?? '—'}
                <BucketTag bucket={bucket} />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Date</dt>
              <dd className="text-foreground">{formatDate(tx.date)}</dd>
            </div>
            {variant === 'full' && (
              <div className="flex items-start justify-between gap-4">
                <dt className="text-muted-foreground">Note</dt>
                <dd className="text-right text-foreground">{tx.note || '—'}</dd>
              </div>
            )}
          </dl>
          {(onEdit || onDelete) && (
            <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
              {onEdit && (
                <Button variant="outline" size="sm" onClick={() => onEdit(tx)}>
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-expense"
                  onClick={() => onDelete(tx)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function TransactionList({
  transactions,
  variant = 'recent',
  onEdit,
  onDelete,
  loading,
  emptyMessage = 'No transactions.',
  getBucket,
}: TransactionListProps) {
  const actionCols = variant === 'full' && (onEdit || onDelete);
  const colSpan = (variant === 'full' ? 6 : 5) + (actionCols ? 1 : 0);

  if (loading && transactions.length === 0) {
    const rows = Array.from({ length: 5 });
    return (
      <>
        <div className="space-y-2 p-3 md:hidden">
          {rows.map((_, index) => (
            <div
              key={index}
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2.5"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Category</TableHead>
                {variant === 'full' && <TableHead>Note</TableHead>}
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                {actionCols && <TableHead className="w-[1%]"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((_, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  {variant === 'full' && (
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                  )}
                  <TableCell>
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end">
                      <Skeleton className="h-4 w-20" />
                    </div>
                  </TableCell>
                  {actionCols && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Skeleton className="h-8 w-8 rounded-md" />
                        <Skeleton className="h-8 w-8 rounded-md" />
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </>
    );
  }

  const bucketOf = (tx: Transaction): BudgetBucket | null =>
    getBucket?.(tx) ?? tx.bucket ?? tx.category?.bucket ?? null;

  return (
    <>
      <div className="space-y-2 p-3 md:hidden">
        {transactions.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          transactions.map((tx) => (
            <MobileItem
              key={tx.id}
              tx={tx}
              variant={variant}
              onEdit={onEdit}
              onDelete={onDelete}
              bucket={bucketOf(tx)}
            />
          ))
        )}
      </div>

      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Category</TableHead>
              {variant === 'full' && <TableHead>Note</TableHead>}
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              {actionCols && <TableHead className="w-[1%]"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colSpan} className="py-10 text-center text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="text-muted-foreground">{formatDate(tx.date)}</TableCell>
                  <TableCell className="font-medium text-foreground">
                    {tx.account?.label}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {tx.category?.name ?? '—'}
                    <BucketTag bucket={bucketOf(tx)} />
                  </TableCell>
                  {variant === 'full' && (
                    <TableCell className="max-w-[160px] truncate text-muted-foreground">
                      {tx.note || '—'}
                    </TableCell>
                  )}
                  <TableCell>
                    <Badge variant={TYPE_BADGE_VARIANT[tx.type]}>{tx.type}</Badge>
                  </TableCell>
                  <TableCell className={cn('text-right font-semibold', amountClass(tx.type))}>
                    {sign(tx.type)}
                    {amount(tx)}
                  </TableCell>
                  {actionCols && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {onEdit && (
                          <Button variant="ghost" size="icon" onClick={() => onEdit(tx)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {onDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-expense"
                            onClick={() => onDelete(tx)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}