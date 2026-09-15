import { describe, expect, it } from 'vitest';
import { format } from 'date-fns';
import {
  calculatePercentageChange,
  calculateSavingsRate,
  getReportRange,
  parseReportDate,
  parseReportMonth,
} from './reporting';

describe('report period helpers', () => {
  it('creates a rolling seven-day range and the immediately preceding comparison range', () => {
    const range = getReportRange('week', new Date(2026, 7, 31, 12));

    expect(format(range.from, 'yyyy-MM-dd')).toBe('2026-08-25');
    expect(format(range.to, 'yyyy-MM-dd')).toBe('2026-08-31');
    expect(format(range.previousFrom, 'yyyy-MM-dd')).toBe('2026-08-18');
    expect(format(range.previousTo, 'yyyy-MM-dd')).toBe('2026-08-24');
  });

  it('creates a calendar-month range and previous calendar month', () => {
    const range = getReportRange('month', new Date(2026, 7, 18, 12));
    const dateKey = (date: Date) => date.toISOString().slice(0, 10);

    expect(dateKey(range.from)).toBe('2026-08-01');
    expect(dateKey(range.to)).toBe('2026-08-31');
    expect(dateKey(range.previousFrom)).toBe('2026-07-01');
    expect(dateKey(range.previousTo)).toBe('2026-07-31');
  });

  it('rejects invalid URL date values in favor of the supplied fallback', () => {
    const fallback = new Date(2026, 7, 31, 12);

    expect(parseReportDate('2026-02-30', fallback)).toBe(fallback);
    expect(parseReportMonth('2026-13', fallback)).toBe(fallback);
  });
});

describe('report metrics', () => {
  it('calculates savings rate only when the period has income', () => {
    expect(calculateSavingsRate(1000, 250)).toBe(75);
    expect(calculateSavingsRate(0, 250)).toBeNull();
  });

  it('does not create an infinite percentage change for a newly observed category', () => {
    expect(calculatePercentageChange(300, 0)).toBeNull();
    expect(calculatePercentageChange(300, 200)).toBe(50);
  });
});
