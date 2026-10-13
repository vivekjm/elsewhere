import { useEffect, useState } from 'react';
import { money } from '../domain/format';
import { CURRENCY_NAMES } from './currencyNames';
import { cached, getJSON } from './net';

/** Rates relative to `base` (1 base = rate units), from open.er-api.com (free, no key). Refreshed every 12 hours. */
export async function rates(base: string): Promise<Record<string, number> | null> {
  if (!/^[A-Z]{3}$/.test(base)) return null;
  return cached(`rates.${base}`, 12 * 3600000, async () => {
    const data = await getJSON<{ result?: string; rates?: Record<string, number> }>(`https://open.er-api.com/v6/latest/${base}`);
    if (data?.result !== 'success' || !data.rates) return null;
    const clean: Record<string, number> = {};
    // A zero or nonsense rate would wipe every converted amount.
    for (const [code, value] of Object.entries(data.rates)) if (Number.isFinite(value) && value > 0) clean[code] = value;
    return Object.keys(clean).length ? clean : null;
  });
}

export function useRates(base: string): Record<string, number> | null {
  const [value, setValue] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    let active = true;
    void rates(base).then((r) => { if (active) setValue(r); });
    return () => { active = false; };
  }, [base]);
  return value;
}

/** Currencies offered first in pickers. */
export const COMMON_CURRENCIES = ['EUR', 'USD', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'SGD', 'HKD', 'AED', 'SEK', 'NOK', 'DKK', 'MXN', 'BRL', 'ZAR', 'THB', 'INR', 'CNY', 'KRW', 'TRY'];

export function currencyName(code: string): string {
  return CURRENCY_NAMES[code] ?? code;
}

/** "≈ ¥2,300": an amount in `from` shown in `to`, with rates based on `to` (1 to = rate from). Empty when a rate is missing. */
export function convertLabel(amount: number, from: string, to: string, ratesForTo: Record<string, number> | null): string {
  if (from === to) return '';
  const rate = ratesForTo?.[from];
  if (!rate) return 'rate unavailable offline';
  return `≈ ${money(amount / rate, to)}`;
}
