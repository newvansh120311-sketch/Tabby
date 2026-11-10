import {
  allocate,
  buildUpiUri,
  computeSplit,
  computeTripBalances,
  convertMinor,
  formatMoney,
  isValidVpa,
  parseMoney,
  searchCurrencies,
  simplifyDebts,
  taxLines,
  tipAmount,
  tripOwedFromBill,
  BillInput,
  UNCLAIMED,
} from '../src';

const sumShares = (r: ReturnType<typeof computeSplit>) => r.shares.reduce((a, s) => a + s.totalMinor, 0) + r.unclaimedMinor;

describe('allocate', () => {
  it('always sums to the total', () => {
    for (let total = -500; total <= 500; total += 7) {
      for (const w of [[1, 1, 1], [1, 2, 3], [0, 0], [5], [3, 0, 7, 1]]) {
        expect(allocate(total, w).reduce((a, b) => a + b, 0)).toBe(total);
      }
    }
  });
  it('gives remainders one unit at a time to the earliest', () => {
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocate(-100, [1, 1, 1])).toEqual([-34, -33, -33]);
  });
  it('falls back to an even split for zero weights', () => {
    expect(allocate(10, [0, 0])).toEqual([5, 5]);
  });
  it('rejects fractional totals', () => {
    expect(() => allocate(1.5, [1])).toThrow();
  });
});

describe('money formatting', () => {
  it('formats INR with Indian grouping', () => {
    expect(formatMoney(12345678, 'INR')).toBe('₹1,23,456.78');
    expect(formatMoney(-5000, 'INR')).toBe('-₹50.00');
  });
  it('handles zero-decimal currencies', () => {
    expect(formatMoney(1500, 'JPY')).toBe('¥1,500');
    expect(parseMoney('1,500', 'JPY')).toBe(1500);
  });
  it('handles three-decimal currencies', () => {
    expect(formatMoney(12345, 'KWD')).toBe('KD 12.345');
  });
  it('formats USD and compact mode', () => {
    expect(formatMoney(123456, 'USD')).toBe('$1,234.56');
    expect(formatMoney(5000, 'USD', { compact: true })).toBe('$50');
  });
  it('parses user input', () => {
    expect(parseMoney('₹ 1,234.5', 'INR')).toBe(123450);
    expect(parseMoney('12.345', 'INR')).toBe(1235);
    expect(parseMoney('abc', 'INR')).toBeNull();
  });
  it('pins popular currencies at the top of the list', () => {
    const list = searchCurrencies();
    expect(list.slice(0, 7).map((c) => c.code)).toEqual(['INR', 'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY']);
    expect(list.length).toBeGreaterThan(150);
    expect(searchCurrencies('rupee').map((c) => c.code)).toContain('INR');
  });
  it('converts between currencies with different decimals', () => {
    expect(convertMinor(10000, 'USD', 'INR', 83.5)).toBe(835000);
    expect(convertMinor(1000, 'JPY', 'INR', 0.56)).toBe(56000);
  });
});

const base = (over: Partial<BillInput> = {}): BillInput => ({
  currency: 'INR',
  splitMode: 'items',
  items: [
    { id: 'i1', amountMinor: 30000 },
    { id: 'i2', amountMinor: 20000 },
    { id: 'i3', amountMinor: 10000 },
  ],
  charges: [],
  participants: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
  claims: [
    { itemId: 'i1', participantId: 'a' },
    { itemId: 'i2', participantId: 'b' },
    { itemId: 'i3', participantId: 'c' },
  ],
  ...over,
});

describe('computeSplit', () => {
  it('splits shared items evenly with exact remainders', () => {
    const r = computeSplit(
      base({
        items: [{ id: 'n', amountMinor: 1000 }],
        claims: ['a', 'b', 'c'].map((p) => ({ itemId: 'n', participantId: p })),
      }),
    );
    expect(r.shares.map((s) => s.itemsMinor)).toEqual([334, 333, 333]);
    expect(sumShares(r)).toBe(1000);
  });

  it('splits delivery and platform evenly, tax proportionally by default', () => {
    const r = computeSplit(
      base({
        charges: [
          { id: 'd', type: 'delivery', amountMinor: 3000 },
          { id: 'p', type: 'platform', amountMinor: 1000 },
          { id: 't', type: 'tax', amountMinor: 6000 },
        ],
      }),
    );
    const [a, b, c] = r.shares;
    expect([a.charges.d, b.charges.d, c.charges.d]).toEqual([1000, 1000, 1000]);
    expect([a.charges.t, b.charges.t, c.charges.t]).toEqual([3000, 2000, 1000]);
    expect(sumShares(r)).toBe(r.totalMinor);
  });

  it('applies negative discounts proportionally', () => {
    const r = computeSplit(base({ charges: [{ id: 'x', type: 'coupon', amountMinor: -10000 }] }));
    expect(r.shares.map((s) => s.charges.x)).toEqual([-5000, -3333, -1667]);
    expect(sumShares(r)).toBe(50000);
  });

  it('honours a per-bill fee rule override', () => {
    const r = computeSplit(
      base({
        charges: [{ id: 't', type: 'tax', amountMinor: 900 }],
        feeRules: { tax: 'even' },
      }),
    );
    expect(r.shares.map((s) => s.charges.t)).toEqual([300, 300, 300]);
  });

  it('splits "claims" charges only between people who claimed something', () => {
    const r = computeSplit(
      base({
        participants: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'lurker' }],
        charges: [{ id: 'd', type: 'delivery', amountMinor: 900 }],
        feeRules: { delivery: 'claims' },
      }),
    );
    expect(r.shares.find((s) => s.participantId === 'lurker')!.charges.d).toBe(0);
    expect(r.shares.filter((s) => s.participantId !== 'lurker').map((s) => s.charges.d)).toEqual([300, 300, 300]);
  });

  it('keeps unclaimed items and their share of tax apart', () => {
    const r = computeSplit(
      base({
        claims: [{ itemId: 'i1', participantId: 'a' }],
        charges: [{ id: 't', type: 'tax', amountMinor: 6000 }],
      }),
    );
    expect(r.unclaimedItemIds).toEqual(['i2', 'i3']);
    expect(r.shares[0].totalMinor).toBe(33000);
    expect(r.unclaimedMinor).toBe(33000);
    expect(sumShares(r)).toBe(r.totalMinor);
  });

  it('splits evenly in even mode', () => {
    const r = computeSplit(base({ splitMode: 'even', charges: [{ id: 't', type: 'tip', amountMinor: 100 }] }));
    expect(r.shares.map((s) => s.totalMinor)).toEqual([20034, 20033, 20033]);
    expect(sumShares(r)).toBe(60100);
  });

  it('handles JPY with zero decimals', () => {
    const r = computeSplit({
      currency: 'JPY',
      splitMode: 'items',
      items: [{ id: 's', amountMinor: 1001 }],
      charges: [],
      participants: [{ id: 'a' }, { id: 'b' }],
      claims: [
        { itemId: 's', participantId: 'a' },
        { itemId: 's', participantId: 'b' },
      ],
    });
    expect(r.shares.map((s) => s.totalMinor)).toEqual([501, 500]);
  });

  it('puts everything unclaimed when nobody joined', () => {
    const r = computeSplit(base({ participants: [], claims: [] }));
    expect(r.unclaimedMinor).toBe(60000);
  });

  it('builds tax lines from a rate', () => {
    expect(taxLines(124000, 5, { currency: 'INR' })).toEqual([{ label: 'GST 5%', amountMinor: 6200 }]);
    expect(taxLines(33500, 5, { currency: 'INR', splitGst: true })).toEqual([
      { label: 'CGST 2.5%', amountMinor: 838 },
      { label: 'SGST 2.5%', amountMinor: 838 },
    ]);
    expect(taxLines(9900, 8.875, { currency: 'USD' })).toEqual([{ label: 'Tax 8.875%', amountMinor: 879 }]);
    expect(taxLines(0, 5, { currency: 'INR' })).toEqual([]);
    expect(taxLines(1000, 0)).toEqual([]);
  });

  it('computes tips', () => {
    expect(tipAmount(10000, { mode: 'percent', percent: 18 })).toBe(1800);
    expect(tipAmount(10000, { mode: 'fixed', amountMinor: 500 })).toBe(500);
  });

  it('always balances on random bills', () => {
    let seed = 42;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let t = 0; t < 300; t++) {
      const people = Array.from({ length: 1 + Math.floor(rnd() * 6) }, (_, i) => ({ id: `p${i}` }));
      const items = Array.from({ length: 1 + Math.floor(rnd() * 8) }, (_, i) => ({ id: `i${i}`, amountMinor: Math.floor(rnd() * 50000) }));
      const claims = items.flatMap((it) => people.filter(() => rnd() < 0.4).map((p) => ({ itemId: it.id, participantId: p.id })));
      const charges = (['tax', 'delivery', 'coupon', 'partner_tip', 'membership'] as const).map((type, i) => ({
        id: `c${i}`,
        type,
        amountMinor: Math.floor(rnd() * 5000) * (type === 'coupon' || type === 'membership' ? -1 : 1),
      }));
      const r = computeSplit({ currency: 'INR', splitMode: rnd() < 0.2 ? 'even' : 'items', items, charges, participants: people, claims });
      expect(sumShares(r)).toBe(r.totalMinor);
    }
  });
});

describe('trips', () => {
  it('converts foreign bills with the saved rate and balances exactly', () => {
    const balances = computeTripBalances({
      baseCurrency: 'INR',
      memberIds: ['v', 'p', 'm'],
      bills: [
        { id: 'b1', payerMemberId: 'v', currency: 'INR', fxRateToBase: 1, totalMinor: 90000, owedByMember: { v: 30000, p: 30000, m: 30000 } },
        { id: 'b2', payerMemberId: 'p', currency: 'USD', fxRateToBase: 83.33, totalMinor: 10001, owedByMember: { v: 3334, p: 3334, m: 3333 } },
      ],
    });
    expect(balances.reduce((a, b) => a + b.netMinor, 0)).toBe(0);
    const p = balances.find((b) => b.memberId === 'p')!;
    expect(p.paidMinor).toBe(convertMinor(10001, 'USD', 'INR', 83.33));
  });

  it('changes balances when a rate is edited', () => {
    const run = (rate: number) =>
      computeTripBalances({
        baseCurrency: 'INR',
        memberIds: ['a', 'b'],
        bills: [{ id: 'x', payerMemberId: 'a', currency: 'USD', fxRateToBase: rate, totalMinor: 1000, owedByMember: { a: 500, b: 500 } }],
      }).find((b) => b.memberId === 'b')!.netMinor;
    expect(run(80)).toBe(-40000);
    expect(run(90)).toBe(-45000);
  });

  it('counts confirmed settlements only', () => {
    const balances = computeTripBalances({
      baseCurrency: 'INR',
      memberIds: ['a', 'b'],
      bills: [{ id: 'x', payerMemberId: 'a', currency: 'INR', fxRateToBase: 1, totalMinor: 1000, owedByMember: { a: 500, b: 500 } }],
      settlements: [
        { fromMemberId: 'b', toMemberId: 'a', amountMinor: 200, status: 'confirmed' },
        { fromMemberId: 'b', toMemberId: 'a', amountMinor: 300, status: 'marked' },
      ],
    });
    expect(balances.find((b) => b.memberId === 'b')!.netMinor).toBe(-300);
  });

  it('turns a bill with unclaimed items into trip debts, payer keeping the rest', () => {
    const { totalMinor, owedByMember } = tripOwedFromBill(
      base({ claims: [{ itemId: 'i1', participantId: 'a' }] }),
      'payer',
      { a: 'A', b: 'B', c: 'C' },
    );
    expect(totalMinor).toBe(60000);
    expect(owedByMember.A).toBe(30000);
    expect(owedByMember.payer).toBe(30000);
    expect(Object.values(owedByMember).reduce((x, y) => x + y, 0)).toBe(60000);
  });
});

describe('simplifyDebts', () => {
  it('returns at most n-1 payments that zero every balance', () => {
    const balances = [
      { memberId: 'a', netMinor: 5000 },
      { memberId: 'b', netMinor: -2000 },
      { memberId: 'c', netMinor: -2500 },
      { memberId: 'd', netMinor: 1000 },
      { memberId: 'e', netMinor: -1500 },
    ];
    const pay = simplifyDebts(balances);
    expect(pay.length).toBeLessThanOrEqual(4);
    const net = Object.fromEntries(balances.map((b) => [b.memberId, b.netMinor]));
    for (const p of pay) {
      net[p.fromMemberId] += p.amountMinor;
      net[p.toMemberId] -= p.amountMinor;
    }
    expect(Object.values(net).every((v) => v === 0)).toBe(true);
  });
  it('returns nothing for an already balanced trip', () => {
    expect(simplifyDebts([{ memberId: 'a', netMinor: 0 }, { memberId: 'b', netMinor: 0 }])).toEqual([]);
  });
  it('rejects balances that do not sum to zero', () => {
    expect(() => simplifyDebts([{ memberId: 'a', netMinor: 1 }])).toThrow();
  });
});

describe('UPI', () => {
  it('builds an encoded upi://pay link with two decimals', () => {
    const uri = buildUpiUri({ vpa: 'vivekdemo@okaxis', name: 'Vivek Demo', amountMinor: 23400, note: 'Tabby: Friday Tacos' });
    expect(uri).toBe('upi://pay?pa=vivekdemo%40okaxis&pn=Vivek%20Demo&am=234.00&cu=INR&tn=Tabby%3A%20Friday%20Tacos');
  });
  it('formats paise correctly', () => {
    expect(buildUpiUri({ vpa: 'a.b@ybl', name: 'A', amountMinor: 5 })).toContain('am=0.05');
  });
  it('rejects malformed VPAs', () => {
    for (const bad of ['', 'no-at-sign', '@bank', 'name@', 'name@@bank', 'na me@bank', 'name@1bank', 'x@b']) {
      expect(isValidVpa(bad)).toBe(false);
      expect(() => buildUpiUri({ vpa: bad, name: 'x', amountMinor: 100 })).toThrow();
    }
    expect(isValidVpa('priya.s-99@okhdfcbank')).toBe(true);
  });
  it('rejects zero and fractional amounts', () => {
    expect(() => buildUpiUri({ vpa: 'a@ybl', name: 'A', amountMinor: 0 })).toThrow();
    expect(() => buildUpiUri({ vpa: 'a@ybl', name: 'A', amountMinor: 1.5 })).toThrow();
  });
});

test('UNCLAIMED marker is exported', () => expect(UNCLAIMED).toBeTruthy());
