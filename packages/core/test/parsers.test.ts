import { detectPlatform, parseOrder, ChargeType } from '../src';
import { ORDER_FIXTURES } from '../src/fixtures';

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

describe.each(ORDER_FIXTURES)('$name', (fx) => {
  const draft = parseOrder(fx.text, { packageName: fx.packageName });

  it('detects the platform', () => {
    expect(draft.source).toBe(fx.source);
  });

  it('reads the items', () => {
    expect(draft.items.map((i) => [norm(i.name), i.amountMinor])).toEqual(
      fx.expect.items.map((i) => [norm(i.name), i.amountMinor]),
    );
    fx.expect.items.forEach((e, k) => {
      if (e.qty) expect(draft.items[k].qty).toBe(e.qty);
    });
  });

  it('reads fees, taxes, discounts and tips', () => {
    const byType: Partial<Record<ChargeType, number>> = {};
    for (const c of draft.charges) byType[c.type] = (byType[c.type] ?? 0) + c.amountMinor;
    expect(byType).toEqual(fx.expect.charges);
  });

  it('reads the total and adds up', () => {
    expect(draft.detectedTotalMinor).toBe(fx.expect.totalMinor);
    const sum = [...draft.items, ...draft.charges].reduce((a, x) => a + x.amountMinor, 0);
    expect(Math.abs(sum - fx.expect.totalMinor)).toBeLessThanOrEqual(1);
  });
});

describe('detectPlatform', () => {
  it('prefers Instamart text over the shared Swiggy package', () => {
    expect(detectPlatform('Swiggy Instamart order', 'in.swiggy.android')).toBe('instamart');
  });
  it('uses the package name when the text is generic', () => {
    expect(detectPlatform('Item total 100', 'com.zeptoconsumerapp')).toBe('zepto');
  });
  it('falls back to receipt', () => {
    expect(detectPlatform('Masala chai 20')).toBe('receipt');
  });
});
