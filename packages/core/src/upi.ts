import { toMajorString } from './money';

const VPA_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{1,255}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/;

export function isValidVpa(vpa: string): boolean {
  return VPA_RE.test(vpa.trim());
}

export interface UpiParams {
  vpa: string;
  name: string;
  amountMinor: number;
  note?: string;
}

/** Build a upi://pay link. Amount is INR with exactly two decimals. */
export function buildUpiUri({ vpa, name, amountMinor, note }: UpiParams): string {
  const pa = vpa.trim();
  if (!isValidVpa(pa)) throw new Error(`Invalid UPI ID: ${vpa}`);
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) throw new Error('UPI amount must be a positive integer');
  const params: [string, string][] = [
    ['pa', pa],
    ['pn', name.trim() || pa],
    ['am', toMajorString(amountMinor, 'INR')],
    ['cu', 'INR'],
  ];
  if (note) params.push(['tn', note.slice(0, 80)]);
  return 'upi://pay?' + params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
}

export function upiNote(title: string): string {
  return `Tabby: ${title}`.slice(0, 80);
}
