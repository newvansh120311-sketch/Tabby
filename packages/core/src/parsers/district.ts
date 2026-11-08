import { parseWithProfile, ParserProfile } from './engine';

/** District dining: the restaurant bill is scanned, and the payment screen gives the booking discount. */
export const districtProfile: ParserProfile = {
  source: 'district',
  rules: [
    { re: /\b(pre-?book(ed|ing)?|table\s+booking)\s+(offer|discount)\b|\bflat\s+\d+%\s+off\b|\bwalk-?in\s+offer\b/i, kind: 'charge', type: 'discount' },
    { re: /\bcover\s+charge\b/i, kind: 'charge', type: 'other' },
    { re: /\bconvenience\s+fee\b/i, kind: 'charge', type: 'platform' },
    { re: /\bbank\s+offer\b/i, kind: 'charge', type: 'coupon' },
  ],
  noise: [/^\s*district\s*$/i, /\bbooking\s+(id|confirmed)\b/i, /\bguests?\b/i],
};

export const parseDistrict = (text: string) => parseWithProfile(text, districtProfile, 'INR');
