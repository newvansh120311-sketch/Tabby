import { parseWithProfile, ParserProfile } from './engine';

export const zomatoProfile: ParserProfile = {
  source: 'zomato',
  chargesAfterSubtotal: true,
  rules: [
    { re: /\bgold\b/i, kind: 'charge', type: 'membership' },
    { re: /\btaxes?\s*(and|&)\s*charges\b|\bgst\b/i, kind: 'charge', type: 'tax' },
    { re: /\bcoupon\b|\bpromo\b/i, kind: 'charge', type: 'coupon' },
    { re: /\bfeeding\s+india\b|\bdonation\b/i, kind: 'charge', type: 'other' },
  ],
  noise: [/^\s*zomato\s*$/i, /\border\s+summary\b/i, /\bdelivered\s+(to|on|by)\b/i, /\bbill\s+summary\b/i],
};

export const parseZomato = (text: string) => parseWithProfile(text, zomatoProfile, 'INR');
