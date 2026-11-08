import { parseWithProfile, ParserProfile } from './engine';

export const swiggyProfile: ParserProfile = {
  source: 'swiggy',
  chargesAfterSubtotal: true,
  rules: [
    { re: /\bgst\s*(and|&)\s*restaurant\s+charges\b/i, kind: 'charge', type: 'tax' },
    { re: /\bextra\s+discount\s+for\s+you\b|\bitem\s+discount\b/i, kind: 'charge', type: 'discount' },
    { re: /\bswiggy\s+one\b|\bone\s+(free\s+)?delivery\b/i, kind: 'charge', type: 'membership' },
    { re: /\bdiscount\s+applied\b/i, kind: 'charge', type: 'coupon' },
  ],
  noise: [/\bswiggy\b\s*$/i, /\border\s+(was\s+)?delivered\b/i, /\bbill\s+details\b/i, /\bview\s+(details|bill)\b/i, /\breorder\b/i],
};

export const parseSwiggy = (text: string) => parseWithProfile(text, swiggyProfile, 'INR');
