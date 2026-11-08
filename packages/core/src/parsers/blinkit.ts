import { parseWithProfile, ParserProfile } from './engine';

export const blinkitProfile: ParserProfile = {
  source: 'blinkit',
  chargesAfterSubtotal: true,
  rules: [
    { re: /\bhandling\s+charge\b|\bsmall\s+cart\s+charge\b|\bsurge\s+charge\b/i, kind: 'charge', type: 'platform' },
    { re: /\bfeeding\s+india\b|\bdonation\b/i, kind: 'charge', type: 'other' },
    { re: /\bsaved\b.*\bon\s+this\s+order\b/i, kind: 'ignore' },
  ],
  noise: [/^\s*blinkit\s*$/i, /\bdelivered\s+in\b/i, /\border\s+summary\b/i, /\bmrp\b/i],
};

export const parseBlinkit = (text: string) => parseWithProfile(text, blinkitProfile, 'INR');
