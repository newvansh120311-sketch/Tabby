import { parseWithProfile, ParserProfile } from './engine';

export const eazydinerProfile: ParserProfile = {
  source: 'eazydiner',
  rules: [
    { re: /\beazydiner\s+(prime\s+)?(discount|offer)\b|\bprime\s+(discount|offer)\b/i, kind: 'charge', type: 'membership' },
    { re: /\beazypoints\b/i, kind: 'charge', type: 'membership' },
    { re: /\b(pre-?book(ed|ing)?|deal)\s+(offer|discount)\b|\b\d+%\s+off\b/i, kind: 'charge', type: 'discount' },
    { re: /\bcover\s+charge\b/i, kind: 'charge', type: 'other' },
  ],
  noise: [/^\s*eazydiner\s*$/i, /\bbooking\s+(id|confirmed)\b/i, /\bpax\b/i],
};

export const parseEazydiner = (text: string) => parseWithProfile(text, eazydinerProfile, 'INR');
