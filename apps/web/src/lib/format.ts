export function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function formatMoney(
  value: string | number | null | undefined,
  currency = 'PHP',
): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency,
  }).format(toNumber(value));
}

export function formatDate(value: Date | string, pattern = 'MMM d, yyyy'): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}