import { parseWithProfile, ParserProfile } from './engine';

export const instamartProfile: ParserProfile = {
  source: 'instamart',
  chargesAfterSubtotal: true,
  rules: [
    { re: /\bhandling\s+fee\b|\bsmall\s+cart\s+fee\b|\blate\s+night\s+fee\b|\bsurge\b/i, kind: 'charge', type: 'platform' },
    { re: /\bswiggy\s+one\b/i, kind: 'charge', type: 'membership' },
  ],
  noise: [/\binstamart\b\s*$/i, /\b\d+\s+items?\b\s*$/i, /\bdelivered\s+in\b/i],
};

export const parseInstamart = (text: string) => parseWithProfile(text, instamartProfile, 'INR');
