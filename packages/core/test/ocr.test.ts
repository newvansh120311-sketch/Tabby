import { linesToText, parseReceipt, OcrLine } from '../src';

const L = (text: string, left: number, top: number, width = 200, height = 20): OcrLine => ({
  text,
  left,
  top,
  right: left + width,
  bottom: top + height,
});

describe('linesToText', () => {
  it('rejoins names and prices that came back as separate columns', () => {
    const lines = [
      L('Masala Dosa', 10, 100),
      L('Filter Coffee', 10, 130),
      L('Total', 10, 160),
      L('120.00', 400, 102, 80),
      L('60.00', 400, 131, 80),
      L('180.00', 400, 161, 80),
    ];
    expect(linesToText(lines)).toBe('Masala Dosa  120.00\nFilter Coffee  60.00\nTotal  180.00');
  });

  it('copes with a slightly skewed photo', () => {
    const lines = [L('Veg Puff', 10, 100), L('30', 400, 108, 40), L('Cold Coffee', 12, 131), L('120', 402, 139, 40)];
    const draft = parseReceipt(linesToText(lines), 'INR');
    expect(draft.items.map((i) => [i.name, i.amountMinor])).toEqual([
      ['Veg Puff', 3000],
      ['Cold Coffee', 12000],
    ]);
  });

  it('straightens a receipt photographed at an angle', () => {
    // Rotate a straight two-column layout by -4 degrees around its centre, like a tilted phone.
    const names = ['Carne Asada Tacos', 'Al Pastor Tacos', 'Fish Tacos', 'Churros', 'Total'];
    const prices = ['$14.50', '$13.00', '$15.25', '$7.25', '$50.00'];
    const t = (-4 * Math.PI) / 180;
    const rot = (x: number, y: number) => ({ x: 360 + (x - 360) * Math.cos(t) - (y - 300) * Math.sin(t), y: 300 + (x - 360) * Math.sin(t) + (y - 300) * Math.cos(t) });
    const lines: OcrLine[] = [];
    names.forEach((n, i) => {
      const a = rot(60 + 150, 100 + i * 44);
      lines.push({ text: n, left: a.x - 150, right: a.x + 150, top: a.y - 14, bottom: a.y + 14 });
      const b = rot(620, 100 + i * 44);
      lines.push({ text: prices[i], left: b.x - 50, right: b.x + 50, top: b.y - 14, bottom: b.y + 14 });
    });
    const text = linesToText(lines.sort(() => 0.5 - Math.random()));
    expect(text.split('\n')).toEqual(names.map((n, i) => `${n}  ${prices[i]}`));
  });

  it('keeps stacked lines on separate rows', () => {
    expect(linesToText([L('A', 10, 100), L('B', 10, 125)])).toBe('A\nB');
  });
});
