/**
 * On-device trip drafting with Apple's Foundation Models (iOS 26+, Apple Intelligence on). The native
 * module returns day titles and stops as JSON; everything else (dates, length, people, budget) comes from
 * the deterministic parser, so a stated fact is never invented or dropped. Anywhere the model isn't
 * available, `templateDraft` is used instead.
 */
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import type { TripKind } from '../data/extras';
import { ACTIVITY_TYPES } from '../data/model';
import { templateDraft, type Draft, type DraftDay } from '../domain/drafter';

type NativeIntelligence = {
  isAvailable(): Promise<boolean>;
  draftDays(prompt: string, destination: string, days: number, kind: string): Promise<string>;
};
const Native = Platform.OS === 'ios' ? requireOptionalNativeModule<NativeIntelligence>('LoomIntelligence') : null;

export async function onDeviceModelAvailable(): Promise<boolean> {
  try { return !!Native && await Native.isAvailable(); } catch { return false; }
}

const isCategory = (v: unknown): v is DraftDay['stops'][number]['category'] => typeof v === 'string' && (ACTIVITY_TYPES as readonly string[]).includes(v);

/** Reads the model's JSON, keeping only well-formed days; any problem returns null (the template is used). */
function readDays(json: string, days: number): DraftDay[] | null {
  try {
    const data = JSON.parse(json) as { days?: { title?: unknown; stops?: { time?: unknown; title?: unknown; category?: unknown }[] }[] };
    const out = (data.days ?? []).slice(0, days).map((d) => ({
      title: typeof d.title === 'string' ? d.title.slice(0, 120) : '',
      stops: (d.stops ?? []).slice(0, 5).filter((s) => typeof s.title === 'string' && s.title.trim()).map((s) => ({
        time: typeof s.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s.time) ? s.time : '',
        title: (s.title as string).slice(0, 120),
        category: isCategory(s.category) ? s.category : 'Explore',
      })),
    })).filter((d) => d.title);
    return out.length ? out : null;
  } catch {
    return null;
  }
}

export async function draftWithModel(prompt: string, hints: { destination?: string; kind?: TripKind; currency?: string }): Promise<Draft | null> {
  if (!(await onDeviceModelAvailable()) || !Native) return null;
  const base = templateDraft(prompt, hints);
  const json = await Native.draftDays(prompt.slice(0, 600), base.destination, base.days, base.kind);
  const plan = readDays(json, base.days);
  if (!plan) return null;
  // Keep the template's arrival and departure framing if the model returned fewer days.
  const merged = base.plan.map((day, i) => plan[i] ?? day);
  return { ...base, plan: merged, source: 'on-device' };
}

/* ------------------------------------------------------------------ receipts */

type NativeText = { recognizeText(uri: string): Promise<string[]> };
const TextNative = Platform.OS === 'ios' ? requireOptionalNativeModule<NativeText>('LoomIntelligence') : null;
export const canScanReceipts = !!TextNative?.recognizeText;

export type ReceiptGuess = { amount: number | null; currency: string | null; merchant: string; date: string | null };

const SYMBOLS: Record<string, string> = { '€': 'EUR', '$': 'USD', '£': 'GBP', '¥': 'JPY', '₹': 'INR', '₩': 'KRW', '฿': 'THB', '₺': 'TRY', '₫': 'VND', 'CHF': 'CHF', 'R$': 'BRL', 'A$': 'AUD', 'C$': 'CAD' };

/** Reads the total, currency, shop name and date from receipt text. Everything is a suggestion the person can edit. */
export function parseReceipt(lines: string[]): ReceiptGuess {
  const num = (s: string) => {
    const m = s.replace(/\s/g, '').match(/(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})|\d+(?:[.,]\d{1,2})?)(?!.*\d)/);
    if (!m) return null;
    let v = m[1];
    // "1.234,56" or "1,234.56": the last separator before two digits is the decimal mark.
    if (/[.,]\d{1,2}$/.test(v)) { const dec = v.slice(-3).match(/[.,]/)?.[0] ?? '.'; v = v.replace(dec === ',' ? /\./g : /,/g, '').replace(',', '.'); }
    else v = v.replace(/[.,]/g, '');
    const n = Number(v);
    return Number.isFinite(n) && n > 0 && n < 1e7 ? n : null;
  };
  // A price has cents ("42,90", "1.234,50", "$12.00"); postcodes, years, times and phone numbers don't.
  const money = (s: string) => (/\d[.,]\d{2}(?!\d)/.test(s) && !/\d{1,2}:\d{2}|\d{1,2}[/.]\d{1,2}[/.]\d{2,4}/.test(s) ? num(s) : null);
  const isTotal = (l: string) => /\b(total|totale|gesamt|montant|importe|totaal|summe|amount due|to pay|balance)\b/i.test(l) && !/sub\s?-?total|tax|vat|iva|mwst|tip/i.test(l);
  let amount: number | null = null;
  const at = lines.map((l, i) => (isTotal(l) ? i : -1)).filter((i) => i >= 0).pop();
  if (at !== undefined) {
    amount = money(lines[at]) ?? num(lines[at]);
    // The text reader can split "TOTAL EUR ... 42,90" into the label and, a line or two later, the price.
    for (let i = at + 1; amount === null && i <= at + 3 && i < lines.length; i++) amount = money(lines[i]);
  }
  if (amount === null) { const all = lines.map(money).filter((n): n is number => n !== null); amount = all.length ? Math.max(...all) : null; }
  const text = lines.join(' ');
  const code = text.match(/\b(EUR|USD|GBP|JPY|INR|CHF|AUD|CAD|THB|SGD|AED|MXN|BRL|ZAR|NZD|SEK|NOK|DKK|PLN|CZK|HUF|TRY)\b/)?.[1]
    ?? Object.entries(SYMBOLS).find(([sym]) => text.includes(sym))?.[1] ?? null;
  const merchant = lines.find((l) => /[a-z]{3,}/i.test(l) && !/receipt|invoice|tax|date|time|table|order|tel|www|http/i.test(l))?.trim().slice(0, 80) ?? '';
  const d = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/) ?? text.match(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})\b/);
  let date: string | null = null;
  if (d) {
    if (d[1].length === 4) date = `${d[1]}-${d[2]}-${d[3]}`;
    else {
      const y = d[3].length === 2 ? `20${d[3]}` : d[3];
      // Day first unless that can't be a date (10/13/2026 is US month-first).
      const [day, mon] = Number(d[2]) > 12 ? [d[2], d[1]] : [d[1], d[2]];
      date = `${y}-${mon.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    if (Number.isNaN(Date.parse(date))) date = null;
  }
  return { amount, currency: code, merchant, date };
}

export async function scanReceipt(uri: string): Promise<ReceiptGuess> {
  if (!TextNative) throw new Error('Receipt scanning isn’t available on this device.');
  return parseReceipt(await TextNative.recognizeText(uri));
}
