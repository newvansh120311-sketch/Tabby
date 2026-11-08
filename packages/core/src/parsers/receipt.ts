import { parseWithProfile, ParserProfile } from './engine';

/** Fallback for paper receipts and anything we don't recognise. */
export const receiptProfile: ParserProfile = {
  source: 'receipt',
  stopAfterTotal: true,
  rules: [],
};

export const parseReceipt = (text: string, defaultCurrency?: string) =>
  parseWithProfile(text, receiptProfile, defaultCurrency);
