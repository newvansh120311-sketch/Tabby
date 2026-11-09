// Lets the currency modal hand its choice back to whichever screen opened it.
let handler: ((code: string) => void) | null = null;

export const currencyPick = {
  open(onPick: (code: string) => void) {
    handler = onPick;
  },
  choose(code: string) {
    handler?.(code);
    handler = null;
  },
};
