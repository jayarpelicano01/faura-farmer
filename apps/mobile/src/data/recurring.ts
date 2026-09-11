import type { Frequency, MobileRecurringRule } from '@faura-farmer/types';

function parts(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function key(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Advances one calendar occurrence, preserving month-end schedules where possible. */
export function advanceRecurringDueDate(value: string, frequency: Frequency) {
  const current = parts(value);
  if (!current) throw new Error('Recurring due date must be YYYY-MM-DD');
  if (frequency === 'weekly') {
    const date = new Date(Date.UTC(current.year, current.month - 1, current.day + 7));
    return key(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }
  const year = frequency === 'yearly' ? current.year + 1 : current.year + Math.floor(current.month / 12);
  const month = frequency === 'yearly' ? current.month : (current.month % 12) + 1;
  return key(year, month, Math.min(current.day, daysInMonth(year, month)));
}

export function recurringSections(rules: MobileRecurringRule[], today: string) {
  const due = rules.filter((rule) => rule.isActive && rule.nextDueDate <= today).sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate));
  const active = rules.filter((rule) => rule.isActive && rule.nextDueDate > today).sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate));
  const inactive = rules.filter((rule) => !rule.isActive).sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate));
  return { due, active, inactive };
}
