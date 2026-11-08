import { BillDraft, BillSource } from '../types';
import { parseWithProfile, ParserProfile } from './engine';
import { swiggyProfile } from './swiggy';
import { zomatoProfile } from './zomato';
import { instamartProfile } from './instamart';
import { zeptoProfile } from './zepto';
import { blinkitProfile } from './blinkit';
import { districtProfile } from './district';
import { eazydinerProfile } from './eazydiner';
import { receiptProfile } from './receipt';

export * from './engine';
export { parseSwiggy } from './swiggy';
export { parseZomato } from './zomato';
export { parseInstamart } from './instamart';
export { parseZepto } from './zepto';
export { parseBlinkit } from './blinkit';
export { parseDistrict } from './district';
export { parseEazydiner } from './eazydiner';
export { parseReceipt } from './receipt';

const PROFILES: Partial<Record<BillSource, ParserProfile>> = {
  swiggy: swiggyProfile,
  zomato: zomatoProfile,
  instamart: instamartProfile,
  zepto: zeptoProfile,
  blinkit: blinkitProfile,
  district: districtProfile,
  eazydiner: eazydinerProfile,
  receipt: receiptProfile,
};

/** Android package names of apps that share into Tabby. */
export const PLATFORM_PACKAGES: Record<string, BillSource> = {
  'in.swiggy.android': 'swiggy',
  'com.application.zomato': 'zomato',
  'com.zeptoconsumerapp': 'zepto',
  'com.grofers.customerapp': 'blinkit',
  'com.application.zomato.district': 'district',
  'com.district.app': 'district',
  'com.eazydiner': 'eazydiner',
  'com.easydiner': 'eazydiner',
  'com.google.android.gm': 'email',
};

const KEYWORDS: [BillSource, RegExp][] = [
  ['instamart', /\binstamart\b/i],
  ['swiggy', /\bswiggy\b|\bgst\s*(and|&)\s*restaurant\s+charges\b/i],
  ['zepto', /\bzepto\b/i],
  ['blinkit', /\bblinkit\b|\bgrofers\b/i],
  ['district', /\bdistrict\b.*\b(dining|booking|offer)\b|\bdistrict\s+by\s+zomato\b|^\s*district\s*$/im],
  ['eazydiner', /\beazy\s?diner\b|\beazypoints\b/i],
  ['zomato', /\bzomato\b/i],
];

/**
 * Work out which app an order came from. Swiggy and Instamart share one Android app,
 * so text that names Instamart wins over the Swiggy package name.
 */
export function detectPlatform(text: string, packageName?: string | null): BillSource {
  const fromText = KEYWORDS.find(([, re]) => re.test(text))?.[0];
  const fromPkg = packageName ? PLATFORM_PACKAGES[packageName] : undefined;
  if (fromPkg === 'swiggy' && fromText === 'instamart') return 'instamart';
  if (fromPkg && fromPkg !== 'email') return fromPkg;
  if (fromPkg === 'email' || looksLikeEmail(text)) return 'email';
  if (fromText) return fromText;
  return 'receipt';
}

function looksLikeEmail(text: string): boolean {
  const headers = text.match(/^(from|subject|to|date|sent):\s/gim)?.length ?? 0;
  return headers >= 2 || /\bunsubscribe\b|\bview\s+in\s+browser\b/i.test(text);
}

/** Parse any text (OCR, shared text or a pasted email) into a bill draft. */
export function parseOrder(
  text: string,
  opts: { packageName?: string | null; source?: BillSource; defaultCurrency?: string } = {},
): BillDraft {
  const source = opts.source ?? detectPlatform(text, opts.packageName);
  if (source === 'email') {
    // Emails usually come from one of the platforms: parse with that layout, badge as email.
    const inner = KEYWORDS.find(([, re]) => re.test(text))?.[0];
    const profile = (inner && PROFILES[inner]) || receiptProfile;
    const draft = parseWithProfile(stripEmailChrome(text), { ...profile, stopAfterTotal: true }, opts.defaultCurrency);
    return { ...draft, source: 'email' };
  }
  const profile = PROFILES[source] ?? receiptProfile;
  return parseWithProfile(text, profile, opts.defaultCurrency);
}

function stripEmailChrome(text: string): string {
  return text
    .split('\n')
    .filter((l) => !/^(from|to|cc|subject|date|sent|reply-to):\s/i.test(l.trim()))
    .filter((l) => !/^>/.test(l.trim()))
    .join('\n');
}
