export const DISPLAY_CURRENCIES = ['PHP', 'USD'] as const;

export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];

export type CurrencyPreference = {
  displayCurrency: DisplayCurrency;
  /** USD received for one Philippine peso. */
  usdPerPhp: string | null;
  rateDate: string | null;
  rateRefreshedAt: string | null;
};

export const defaultCurrencyPreference: CurrencyPreference = {
  displayCurrency: 'PHP',
  usdPerPhp: null,
  rateDate: null,
  rateRefreshedAt: null,
};

function cents(value: string | number): bigint {
  const source = String(value).trim();
  const match = /^(-?)(\d+)(?:\.(\d{0,2}))?$/.exec(source);
  if (!match) return 0n;
  const fraction = (match[3] ?? '').padEnd(2, '0');
  const amount = BigInt(match[2]) * 100n + BigInt(fraction || '0');
  return match[1] === '-' ? -amount : amount;
}

function decimal(value: bigint): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  return `${negative ? '-' : ''}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
}

function rateUnits(rate: string): bigint | null {
  const match = /^(\d+)(?:\.(\d{0,8}))?$/.exec(rate.trim());
  if (!match) return null;
  const units = BigInt(match[1]) * 100000000n + BigInt((match[2] ?? '').padEnd(8, '0'));
  return units > 0n ? units : null;
}

function roundedDivide(value: bigint, divisor: bigint) {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const rounded = (absolute + divisor / 2n) / divisor;
  return negative ? -rounded : rounded;
}

/** Converts a two-decimal stored amount without using floating-point arithmetic. */
export function convertMoney(value: string | number, fromCurrency: string, toCurrency: string, usdPerPhp: string | null): string {
  const from = fromCurrency.toUpperCase();
  if (from === toCurrency || !usdPerPhp) return decimal(cents(value));
  const rate = rateUnits(usdPerPhp);
  if (!rate || !DISPLAY_CURRENCIES.includes(from as DisplayCurrency) || !DISPLAY_CURRENCIES.includes(toCurrency as DisplayCurrency)) return decimal(cents(value));
  const amount = cents(value);
  return from === 'PHP'
    ? decimal(roundedDivide(amount * rate, 100000000n))
    : decimal(roundedDivide(amount * 100000000n, rate));
}

export function formatDisplayMoney(value: string | number, fromCurrency: string, preference: CurrencyPreference) {
  const converted = Number(convertMoney(value, fromCurrency, preference.displayCurrency, preference.usdPerPhp));
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: preference.displayCurrency, maximumFractionDigits: 2 }).format(Number.isFinite(converted) ? converted : 0);
  } catch {
    return `${preference.displayCurrency} ${(Number.isFinite(converted) ? converted : 0).toFixed(2)}`;
  }
}
