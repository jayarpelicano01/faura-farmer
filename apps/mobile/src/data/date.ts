function dateParts(year: number, month: number, day: number) {
  const date = new Date(year, month - 1, day, 12);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** Returns a device-local calendar date without converting it through UTC. */
export function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function localMonthKey(date = new Date()) {
  return localDateKey(date).slice(0, 7);
}

/**
 * Reads the calendar date assigned to a transaction without applying a timezone.
 * A timestamp's leading date is authoritative: parsing it in device time could
 * incorrectly move an August 31 transaction into September.
 */
export function transactionDateKey(value: string) {
  const datePrefix = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(value);
  if (datePrefix) {
    const year = Number(datePrefix[1]);
    const month = Number(datePrefix[2]);
    const day = Number(datePrefix[3]);
    return dateParts(year, month, day)
      ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      : null;
  }

  const flexibleDate = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  if (flexibleDate) {
    const year = Number(flexibleDate[1]);
    const month = Number(flexibleDate[2]);
    const day = Number(flexibleDate[3]);
    return dateParts(year, month, day)
      ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      : null;
  }

  return null;
}
