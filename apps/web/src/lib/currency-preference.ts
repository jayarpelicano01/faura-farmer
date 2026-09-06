import { Prisma, prisma } from '@faura-farmer/database';
import type { CurrencyPreference, DisplayCurrency } from '@faura-farmer/types';

export const currencyPreferenceSelect = {
  displayCurrency: true,
  usdPerPhp: true,
  rateDate: true,
  rateRefreshedAt: true,
} as const;

type StoredPreference = {
  displayCurrency: string;
  usdPerPhp: Prisma.Decimal | null;
  rateDate: Date | null;
  rateRefreshedAt: Date | null;
};

export function serializeCurrencyPreference(value: StoredPreference): CurrencyPreference {
  return {
    displayCurrency: value.displayCurrency === 'USD' ? 'USD' : 'PHP',
    usdPerPhp: value.usdPerPhp?.toString() ?? null,
    rateDate: value.rateDate?.toISOString().slice(0, 10) ?? null,
    rateRefreshedAt: value.rateRefreshedAt?.toISOString() ?? null,
  };
}

export async function refreshUsdPerPhp(userId: string): Promise<CurrencyPreference> {
  let response: Response;
  try {
    response = await fetch('https://api.frankfurter.dev/v2/rate/PHP/USD', {
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    throw new Error('Unable to reach the exchange-rate service.');
  }
  if (!response.ok) throw new Error('Unable to refresh the exchange rate.');
  const data = await response.json() as { rate?: unknown; date?: unknown; base?: unknown; quote?: unknown };
  const rate = typeof data.rate === 'number' || typeof data.rate === 'string' ? String(data.rate) : '';
  const rateDate = typeof data.date === 'string' ? data.date : '';
  if (data.base !== 'PHP' || data.quote !== 'USD' || !/^\d+(?:\.\d+)?$/.test(rate) || Number(rate) <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(rateDate)) {
    throw new Error('The exchange-rate service returned invalid data.');
  }
  const user = await prisma.user.update({
    where: { id: userId },
    data: { usdPerPhp: new Prisma.Decimal(rate), rateDate: new Date(`${rateDate}T00:00:00.000Z`), rateRefreshedAt: new Date() },
    select: currencyPreferenceSelect,
  });
  return serializeCurrencyPreference(user);
}

export function displayCurrencyData(displayCurrency: DisplayCurrency) {
  return { displayCurrency };
}
