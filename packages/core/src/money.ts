import { getCurrency } from './currencies';

function groupDigits(intPart: string, indian: boolean): string {
  if (!indian) return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (intPart.length <= 3) return intPart;
  const last3 = intPart.slice(-3);
  const rest = intPart.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${last3}`;
}

/** Plain decimal string for an amount, e.g. 12345 INR -> "123.45", 500 JPY -> "500". */
export function toMajorString(amountMinor: number, currency: string): string {
  const { decimals } = getCurrency(currency);
  const neg = amountMinor < 0;
  const abs = Math.abs(Math.round(amountMinor));
  if (decimals === 0) return `${neg ? '-' : ''}${abs}`;
  const s = abs.toString().padStart(decimals + 1, '0');
  return `${neg ? '-' : ''}${s.slice(0, -decimals)}.${s.slice(-decimals)}`;
}

export interface FormatOptions {
  /** Drop ".00" when the amount is whole. */
  compact?: boolean;
  /** Show a leading "+" for positive amounts. */
  signed?: boolean;
}

export function formatMoney(amountMinor: number, currency: string, opts: FormatOptions = {}): string {
  const info = getCurrency(currency);
  const major = toMajorString(Math.abs(amountMinor), currency);
  let [intPart, frac] = major.split('.');
  intPart = groupDigits(intPart, info.code === 'INR');
  if (opts.compact && frac && /^0+$/.test(frac)) frac = '';
  const body = frac ? `${intPart}.${frac}` : intPart;
  const sym = info.symbol;
  const wordy = /^[A-Za-z]{2,}$/.test(sym);
  const sign = amountMinor < 0 ? '-' : opts.signed && amountMinor > 0 ? '+' : '';
  return `${sign}${sym}${wordy ? ' ' : ''}${body}`;
}

/** Parse "1,234.50", "₹ 99", "-12.5" into minor units. Returns null if unparseable. */
export function parseMoney(input: string, currency: string): number | null {
  const { decimals } = getCurrency(currency);
  const cleaned = input.replace(/[^\d.,\-]/g, '').replace(/,/g, '');
  if (!/^-?\d*(\.\d*)?$/.test(cleaned) || !/\d/.test(cleaned)) return null;
  const neg = cleaned.startsWith('-');
  const [i, f = ''] = cleaned.replace('-', '').split('.');
  const frac = (f + '0'.repeat(decimals)).slice(0, decimals);
  const roundUp = f.length > decimals && Number(f[decimals]) >= 5 ? 1 : 0;
  const value = Number(i || '0') * 10 ** decimals + Number(frac || '0') + roundUp;
  return neg ? -value : value;
}

/**
 * Split an integer total across weights so the parts sum exactly to the total.
 * Remainders go one unit at a time to the largest fractional parts, ties to the earliest index.
 * Zero or empty weights fall back to an even split.
 */
export function allocate(total: number, weights: number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];
  if (!Number.isInteger(total)) throw new Error('allocate: total must be an integer');
  const sign = total < 0 ? -1 : 1;
  const abs = Math.abs(total);
  const clean = weights.map((w) => (w > 0 && Number.isFinite(w) ? w : 0));
  let sumW = clean.reduce((a, b) => a + b, 0);
  const w = sumW > 0 ? clean : clean.map(() => 1);
  if (sumW <= 0) sumW = n;
  const raw = w.map((x) => (abs * x) / sumW);
  const parts = raw.map((r) => Math.floor(r + 1e-9));
  let remainder = abs - parts.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r + 1e-9), eligible: w[i] > 0 }))
    .filter((o) => o.eligible)
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; remainder > 0; k = (k + 1) % order.length, remainder--) parts[order[k].i] += 1;
  return parts.map((p) => p * sign);
}

/** Convert an amount between currencies using a rate where 1 unit of `from` = rate units of `to`. */
export function convertMinor(amountMinor: number, from: string, to: string, rate: number): number {
  const df = getCurrency(from).decimals;
  const dt = getCurrency(to).decimals;
  return Math.round((amountMinor / 10 ** df) * rate * 10 ** dt);
}
