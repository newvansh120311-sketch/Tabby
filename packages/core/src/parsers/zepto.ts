import { parseWithProfile, ParserProfile } from './engine';

export const zeptoProfile: ParserProfile = {
  source: 'zepto',
  chargesAfterSubtotal: true,
  rules: [
    { re: /\bzepto\s+pass\b|\bpass\s+(savings|benefit)\b/i, kind: 'charge', type: 'membership' },
    { re: /\bhandling\s+charge\b|\bsmall\s+cart\s+fee\b|\bconvenience\b/i, kind: 'charge', type: 'platform' },
    { re: /\bzepto\s+cash\b/i, kind: 'charge', type: 'discount' },
  ],
  noise: [/^\s*zepto\s*$/i, /\bdelivered\s+in\b/i, /\bbill\s+summary\b/i],
};

export const parseZepto = (text: string) => parseWithProfile(text, zeptoProfile, 'INR');
