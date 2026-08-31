import type { ReportPeriod } from '@faura-farmer/types';
import {
  endOfDay,
  endOfMonth,
  format,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths,
} from 'date-fns';

export interface ReportRange {
  period: ReportPeriod;
  from: Date;
  to: Date;
  previousFrom: Date;
  previousTo: Date;
  label: string;
  comparisonLabel: string;
}

function validCalendarDate(year: number, month: number, day: number) {
  const date = new Date(year, month - 1, day, 12);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** Parse a date-only URL value without shifting it across time zones. */
export function parseReportDate(value: string | undefined, fallback = new Date()): Date {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;

  const [year, month, day] = value.split('-').map(Number);
  if (!validCalendarDate(year, month, day)) return fallback;
  return new Date(year, month - 1, day, 12);
}

export function parseReportMonth(value: string | undefined, fallback = new Date()): Date {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return fallback;

  const [year, month] = value.split('-').map(Number);
  if (!validCalendarDate(year, month, 1)) return fallback;
  return new Date(year, month - 1, 1, 12);
}

export function getReportRange(period: ReportPeriod, anchor: Date): ReportRange {
  if (period === 'week') {
    const to = endOfDay(anchor);
    const from = startOfDay(subDays(to, 6));
    const previousTo = endOfDay(subDays(from, 1));
    const previousFrom = startOfDay(subDays(previousTo, 6));

    return {
      period,
      from,
      to,
      previousFrom,
      previousTo,
      label: `${format(from, 'MMM d')} – ${format(to, 'MMM d, yyyy')}`,
      comparisonLabel: `${format(previousFrom, 'MMM d')} – ${format(previousTo, 'MMM d, yyyy')}`,
    };
  }

  const from = startOfMonth(anchor);
  const to = endOfMonth(anchor);
  const previousAnchor = subMonths(anchor, 1);
  const previousFrom = startOfMonth(previousAnchor);
  const previousTo = endOfMonth(previousAnchor);

  return {
    period,
    from,
    to,
    previousFrom,
    previousTo,
    label: format(anchor, 'MMMM yyyy'),
    comparisonLabel: format(previousAnchor, 'MMMM yyyy'),
  };
}

export function calculateSavingsRate(income: number, expense: number): number | null {
  return income > 0 ? ((income - expense) / income) * 100 : null;
}

export function calculatePercentageChange(current: number, previous: number): number | null {
  return previous > 0 ? ((current - previous) / previous) * 100 : null;
}
