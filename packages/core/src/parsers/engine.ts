import { getCurrency } from '../currencies';
import { BillDraft, BillSource, ChargeType, CHARGE_LABELS, NEGATIVE_CHARGE_TYPES } from '../types';

/** One rule that recognises a charge or total line by its label. */
export interface LabelRule {
  re: RegExp;
  kind: 'subtotal' | 'total' | 'charge' | 'ignore';
  type?: ChargeType;
}

export interface ParserProfile {
  source: BillSource;
  /** Most specific rules first. Checked before the shared rules. */
  rules: LabelRule[];
  /** Lines to skip entirely (headers, order ids, addresses). */
  noise?: RegExp[];
  /** After the subtotal line, unknown priced lines count as "other" charges instead of items. */
  chargesAfterSubtotal?: boolean;
  /** Lines that end the useful part of the text, e.g. "Paid via UPI". */
  stopAfterTotal?: boolean;
  defaultCurrency?: string;
}

const CUR = String.raw`(?:₹|rs\.?|inr|\$|us\$|usd|€|eur|£|gbp|¥|jpy)`;
const NUM = String.raw`(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,3})?|\d+(?:[.,]\d{1,3})?)`;
const AMOUNT_AT_END = new RegExp(
  String.raw`(\(-\)|[-–−])?\s*${CUR}?\s*(\(-\)|[-–−])?\s*${NUM}\s*(?:${CUR})?\s*(cr|dr)?\s*$`,
  'i',
);
const FREE_AT_END = /\b(free|waived)\s*$/i;

export const SHARED_RULES: LabelRule[] = [
  { re: /\b(sub\s*-?\s*total|item\s*s?\s*total|items?\s+total|food\s+total|bill\s+amount|total\s+before\s+tax)\b/i, kind: 'subtotal' },
  { re: /\b(grand\s+total|to\s+pay|amount\s+(paid|payable|to\s+pay|due)|total\s+(paid|payable|due|amount)|bill\s+total|net\s+(amount|payable|total)|paid\s+(via|by|using|with)|you\s+paid|order\s+total|^total)\b/i, kind: 'total' },
  { re: /\b(round\s*(ed)?\s*off|rounding)\b/i, kind: 'charge', type: 'other' },
  { re: /\b(delivery\s+partner\s+tip|tip\s+for\s+(your\s+)?delivery|rider\s+tip|partner\s+tip)\b/i, kind: 'charge', type: 'partner_tip' },
  { re: /\b(tip|gratuity)\b/i, kind: 'charge', type: 'tip' },
  { re: /\b(delivery\s+(fee|charges?)|shipping)\b/i, kind: 'charge', type: 'delivery' },
  { re: /\b(platform\s+fee|convenience\s+fee|handling\s+(fee|charges?)|small\s+cart\s+(fee|charges?)|late\s+night\s+(fee|charges?)|surge\s+fee|rain\s+fee|booking\s+fee)\b/i, kind: 'charge', type: 'platform' },
  { re: /\b(packag(ing|e)\s+(fee|charges?)|packing\s+charges?|container\s+charges?|bag\s+charges?)\b/i, kind: 'charge', type: 'packaging' },
  { re: /\b(swiggy\s+one|one\s+(benefit|member|savings)|zomato\s+gold|gold\s+(discount|savings|benefit)|zepto\s+pass|pass\s+savings|prime\s+(discount|savings)|membership|eazypoints|loyalty)\b/i, kind: 'charge', type: 'membership' },
  { re: /\b(coupon|promo|voucher|code\s+applied|offer\s+code)\b/i, kind: 'charge', type: 'coupon' },
  { re: /\b(discount|savings?|off\b|offer|pre-?book(ed|ing)?\s+(offer|discount)|cashback|deal)\b/i, kind: 'charge', type: 'discount' },
  { re: /\b(gst|cgst|sgst|igst|vat|tax(es)?|service\s+tax|restaurant\s+charges|cess)\b/i, kind: 'charge', type: 'tax' },
  { re: /\b(service\s+charge|cover\s+charge|donation|feeding\s+india|insurance)\b/i, kind: 'charge', type: 'other' },
  { re: /\b(cash|change\s+due|change|card\s+payment|visa|mastercard|amex|upi\s+ref|balance)\b/i, kind: 'ignore' },
];

const SHARED_NOISE: RegExp[] = [
  /\b\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\b/,
  /\b\d{1,2}:\d{2}\b/,
  /\b(order\s*(id|no|number|#)|invoice\s*(no|#)|bill\s*(no|#)|receipt\s*(no|#)|txn|transaction|ref(erence)?\s*(no|#|id))\b/i,
  /\b(gstin|fssai|pan\s*no|cin\s*no|hsn|sac)\b/i,
  /\b(table|covers?|guests?|pax|server|cashier|steward|token)\s*(no\.?|#|:)?\s*\d+\s*$/i,
  /\b(phone|tel|mobile|call|whatsapp)\b/i,
  /\b(thank\s*you|visit\s+again|rate\s+(your|this)|help|support|get\s+help)\b/i,
  /\b(qty|quantity)\s+(rate|price)/i,
  /^\s*(item|description|particulars)\s+(qty|amount|price)/i,
  /\b\d{1,2}[:.]\d{2}\s*(am|pm)?\b.*\b\d{4}\b/i,
];

export interface Line {
  text: string;
  amountMinor?: number;
  label: string;
  free?: boolean;
}

export function splitLines(text: string): string[] {
  return text
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.replace(/[•·●▪■□◦]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

export function detectCurrency(text: string, fallback = 'INR'): string {
  if (/₹|\brs\.?\s*\d|\binr\b/i.test(text)) return 'INR';
  if (/€|\beur\b/i.test(text)) return 'EUR';
  if (/£|\bgbp\b/i.test(text)) return 'GBP';
  if (/¥|\bjpy\b|円/i.test(text)) return 'JPY';
  if (/\bc\$|\bcad\b/i.test(text)) return 'CAD';
  if (/\ba\$|\baud\b/i.test(text)) return 'AUD';
  if (/\$|\busd\b/i.test(text)) return 'USD';
  return fallback;
}

function toMinor(numStr: string, decimals: number): number {
  let s = numStr;
  // "1.234,50" never shows up on English receipts, but "120,50" from OCR does: treat a lone comma
  // followed by exactly two digits as the decimal point.
  if (/^\d+,\d{2}$/.test(s)) s = s.replace(',', '.');
  s = s.replace(/,/g, '');
  const [i, f = ''] = s.split('.');
  if (f.length > decimals && decimals === 0) return Math.round(Number(s));
  const frac = (f + '0'.repeat(decimals)).slice(0, decimals);
  return Number(i) * 10 ** decimals + (decimals ? Number(frac) : 0);
}

export function readLine(raw: string, decimals: number): Line {
  if (FREE_AT_END.test(raw)) {
    const label = raw.replace(FREE_AT_END, '').replace(AMOUNT_AT_END, '').trim();
    return { text: raw, label, amountMinor: 0, free: true };
  }
  const m = raw.match(AMOUNT_AT_END);
  if (!m || m.index === undefined) return { text: raw, label: raw };
  const before = raw.slice(0, m.index);
  // A bare number glued to a word ("500ml", "Table12") isn't a price.
  if (/[a-z]$/i.test(before) && !/^\s/.test(m[0]) && !/(₹|rs\.?|\$|€|£|¥)/i.test(m[0])) return { text: raw, label: raw };
  const neg = !!(m[1] || m[2]) || m[4]?.toLowerCase() === 'cr';
  const value = toMinor(m[3], decimals);
  const label = before.replace(/[:|\-–—=]+\s*$/, '').replace(/[\s.]+$/, '').trim();
  return { text: raw, label, amountMinor: neg ? -value : value };
}

/** Pull quantity out of "2 x Paneer Tikka", "Paneer Tikka x2", "Paneer Tikka (2)", "2 Paneer Tikka 2 x 140". */
export function extractQty(label: string, amountMinor: number, decimals: number): { name: string; qty: number } {
  let name = label;
  let qty = 1;
  const lead = name.match(/^(\d{1,2})\s*(?:x|×|\*|nos?\.?|pcs?)\s+(.+)$/i) ?? name.match(/^(\d{1,2})\s+(?=[a-z])(.+)$/i);
  const trail = name.match(/^(.+?)\s*(?:\(|\[)?\s*(?:x|×|qty:?)\s*(\d{1,2})\s*(?:\)|\])?$/i);
  const paren = name.match(/^(.+?)\s*\((\d{1,2})\)$/);
  // Column layout: "Butter Naan 2 40.00" where qty x rate = amount.
  const cols = name.match(/^(.+?)\s+(\d{1,2})\s+(?:x\s*)?(\d+(?:\.\d{1,2})?)$/i);
  if (cols && Math.abs(Number(cols[2]) * toMinor(cols[3], decimals) - amountMinor) <= 1) {
    return { name: cols[1].trim(), qty: Number(cols[2]) };
  }
  const colsQtyOnly = name.match(/^(.+?)\s+(\d{1,2})$/);
  if (lead) {
    qty = Number(lead[1]);
    name = lead[2];
  } else if (trail) {
    name = trail[1];
    qty = Number(trail[2]);
  } else if (paren) {
    name = paren[1];
    qty = Number(paren[2]);
  } else if (colsQtyOnly && Number(colsQtyOnly[2]) <= 20 && !/\b(pc|pcs|ml|g|kg|l|inch|in)\s*$/i.test(colsQtyOnly[1])) {
    name = colsQtyOnly[1];
    qty = Number(colsQtyOnly[2]);
  }
  name = name
    .replace(/^[\s\-–*#.]+/, '')
    .replace(/\s*[@]\s*\d+(\.\d+)?\s*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return { name, qty: qty > 0 ? qty : 1 };
}

const PRICE_ONLY = new RegExp(String.raw`^(\(-\)|[-–−])?\s*${CUR}?\s*${NUM}\s*$`, 'i');

/** OCR often puts a price on its own line under the label. Glue them back together. */
export function joinOrphanPrices(lines: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const cur = lines[i];
    const next = lines[i + 1];
    // "Pizza x 2" ends in a number, but a price below it with a symbol or decimals is the real price.
    const SYM = /(₹|rs\.?\s*\d|\$|€|£|¥)|[.,]\d{2}\s*$/i;
    const nextIsPrice = !!next && PRICE_ONLY.test(next);
    const curHasPrice = AMOUNT_AT_END.test(cur) && (SYM.test(cur) || !(nextIsPrice && SYM.test(next)));
    if (!curHasPrice && /[a-z]{2,}/i.test(cur) && next && (PRICE_ONLY.test(next) || /^free$/i.test(next))) {
      out.push(`${cur} ${next}`);
      i++;
    } else out.push(cur);
  }
  return out;
}

function classify(label: string, profile: ParserProfile): LabelRule | null {
  for (const r of profile.rules) if (r.re.test(label)) return r;
  for (const r of SHARED_RULES) if (r.re.test(label)) return r;
  return null;
}

const DATE_RES = [
  /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/,
  /\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*,?\s+(\d{4})\b/i,
  /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})\b/i,
];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export function detectDate(text: string): string | undefined {
  for (const re of DATE_RES) {
    const m = text.match(re);
    if (!m) continue;
    let d: number, mo: number, y: number;
    if (/^\d/.test(m[1]) && /^\d/.test(m[2])) {
      d = Number(m[1]);
      mo = Number(m[2]);
      y = Number(m[3]);
    } else if (/^\d/.test(m[1])) {
      d = Number(m[1]);
      mo = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1;
      y = Number(m[3]);
    } else {
      mo = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1;
      d = Number(m[2]);
      y = Number(m[3]);
    }
    if (y < 100) y += 2000;
    if (mo > 12 && d <= 12) [d, mo] = [mo, d];
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) continue;
    return new Date(Date.UTC(y, mo - 1, d, 12)).toISOString();
  }
  return undefined;
}

export function parseWithProfile(text: string, profile: ParserProfile, defaultCurrency?: string): BillDraft {
  const currency = detectCurrency(text, defaultCurrency ?? profile.defaultCurrency ?? 'INR');
  const { decimals } = getCurrency(currency);
  const lines = joinOrphanPrices(splitLines(text));
  const noise = [...SHARED_NOISE, ...(profile.noise ?? [])];

  const draft: BillDraft = {
    source: profile.source,
    currency,
    date: detectDate(text),
    items: [],
    charges: [],
    warnings: [],
    confidence: 0,
  };

  let seenSubtotal = false;
  let seenTotal = false;
  let merchant: string | undefined;

  for (const raw of lines) {
    if (noise.some((n) => n.test(raw))) continue;
    const line = readLine(raw, decimals);
    if (line.amountMinor === undefined) {
      if (!merchant && !seenSubtotal && draft.items.length === 0 && /[a-z]{3,}/i.test(raw) && raw.length <= 48) {
        if (!profile.rules.some((r) => r.kind === 'ignore' && r.re.test(raw))) merchant = raw;
      }
      continue;
    }
    if (seenTotal && profile.stopAfterTotal) break;
    if (!/[a-z]{2,}/i.test(line.label)) continue;

    const rule = classify(line.label, profile);
    if (rule?.kind === 'ignore') continue;
    if (rule?.kind === 'subtotal') {
      if (draft.detectedSubtotalMinor === undefined) draft.detectedSubtotalMinor = Math.abs(line.amountMinor);
      seenSubtotal = true;
      continue;
    }
    if (rule?.kind === 'total') {
      // Keep the first grand total; later "Paid via UPI" lines usually repeat it.
      if (draft.detectedTotalMinor === undefined) draft.detectedTotalMinor = Math.abs(line.amountMinor);
      seenTotal = true;
      continue;
    }
    if (seenTotal) continue;
    if (rule?.kind === 'charge' && rule.type) {
      if (line.free || line.amountMinor === 0) continue;
      let amt = line.amountMinor;
      if (NEGATIVE_CHARGE_TYPES.includes(rule.type)) amt = -Math.abs(amt);
      draft.charges.push({ type: rule.type, label: cleanLabel(line.label) || CHARGE_LABELS[rule.type], amountMinor: amt });
      continue;
    }
    if (seenSubtotal && profile.chargesAfterSubtotal) {
      if (line.amountMinor !== 0) {
        draft.charges.push({ type: 'other', label: cleanLabel(line.label), amountMinor: line.amountMinor });
      }
      continue;
    }
    if (line.amountMinor <= 0) {
      if (line.amountMinor < 0) draft.charges.push({ type: 'discount', label: cleanLabel(line.label), amountMinor: line.amountMinor });
      continue;
    }
    const { name, qty } = extractQty(line.label, line.amountMinor, decimals);
    if (!/[a-z]{2,}/i.test(name)) continue;
    draft.items.push({ name: titleCase(name), amountMinor: line.amountMinor, qty });
  }

  draft.merchant = merchant ? titleCase(merchant) : undefined;

  if (draft.items.length === 0 && draft.detectedSubtotalMinor) {
    draft.items.push({ name: 'Items', amountMinor: draft.detectedSubtotalMinor, qty: 1 });
    draft.warnings.push('Couldn’t read individual items, so the item total is one line. Split it up if you need to.');
  }

  const itemSum = draft.items.reduce((a, i) => a + i.amountMinor, 0);
  const chargeSum = draft.charges.reduce((a, c) => a + c.amountMinor, 0);
  let score = draft.items.length > 0 ? 0.5 : 0.1;
  if (draft.detectedSubtotalMinor !== undefined) {
    if (Math.abs(itemSum - draft.detectedSubtotalMinor) <= 1) score += 0.2;
    else draft.warnings.push('Items don’t add up to the item total on the receipt. Check for a misread line.');
  }
  if (draft.detectedTotalMinor !== undefined) {
    if (Math.abs(itemSum + chargeSum - draft.detectedTotalMinor) <= 1) score += 0.3;
    else if (draft.detectedSubtotalMinor === undefined || Math.abs(itemSum - draft.detectedSubtotalMinor) <= 1)
      draft.warnings.push('Items and charges don’t match the total. A fee or discount may be missing.');
  }
  draft.confidence = Math.min(1, score);
  return draft;
}

function cleanLabel(s: string): string {
  return s
    .replace(/\(\s*\)/g, '')
    .replace(/\s*[|]\s*[\d.]+\s*kms?\b/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function titleCase(s: string): string {
  if (/[a-z]/.test(s)) return s.trim();
  return s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()).trim();
}
