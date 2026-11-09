export interface OcrLine {
  text: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface P extends OcrLine {
  cx: number;
  cy: number;
  h: number;
}

/**
 * ML Kit returns text in blocks, and on receipts the item names and the prices often land in
 * separate blocks. Rebuild visual rows: lines whose vertical centres line up sit on one row,
 * read left to right. Photos are rarely straight, and on a tilted receipt the price at the far
 * right sits a whole row above or below its name, so first find the tilt that lines rows up best.
 */
export function linesToText(lines: OcrLine[]): string {
  const pts: P[] = lines
    .filter((l) => l.text.trim())
    .map((l) => ({ ...l, cx: (l.left + l.right) / 2, cy: (l.top + l.bottom) / 2, h: Math.max(1, l.bottom - l.top) }));
  if (pts.length === 0) return '';

  let best = { rows: group(pts, 0), score: -Infinity };
  for (let deg = -10; deg <= 10; deg += 0.5) {
    const rows = group(pts, (deg * Math.PI) / 180);
    const s = score(rows);
    // Prefer the straight reading when scores tie.
    if (s > best.score + 1e-9 || (Math.abs(s - best.score) < 1e-9 && deg === 0)) best = { rows, score: s };
  }
  return best.rows.map((r) => r.map((l) => l.text.trim()).join('  ')).join('\n');
}

/** Group lines into rows after undoing a rotation of `theta` radians. */
function group(pts: P[], theta: number): P[][] {
  const sin = Math.sin(theta);
  const cos = Math.cos(theta);
  const items = pts
    .map((p) => ({ p, y: p.cy * cos - p.cx * sin }))
    .sort((a, b) => a.y - b.y || a.p.left - b.p.left);
  const rows: { y: number; h: number; members: P[] }[] = [];
  for (const { p, y } of items) {
    let target: (typeof rows)[number] | null = null;
    let bestGap = Infinity;
    for (const row of rows.slice(-4)) {
      const gap = Math.abs(row.y - y);
      const tol = Math.min(row.h, p.h) * 0.55;
      const overlapsX = row.members.some((r) => p.left < r.right - 4 && r.left < p.right - 4);
      if (gap <= tol && !overlapsX && gap < bestGap) {
        target = row;
        bestGap = gap;
      }
    }
    if (target) {
      target.members.push(p);
      target.y = (target.y * (target.members.length - 1) + y) / target.members.length;
    } else rows.push({ y, h: p.h, members: [p] });
  }
  return rows.map((r) => r.members.sort((a, b) => a.left - b.left));
}

/**
 * Good alignment pairs a text line with a price on the same row. Reward rows that end in a
 * number and also carry words, and penalise lone prices or lone labels left on their own row.
 */
function score(rows: P[][]): number {
  let s = 0;
  for (const r of rows) {
    const hasWords = r.some((l) => /[a-z]{2,}/i.test(l.text));
    const endsInNumber = /\d[\d.,]*\s*$/.test(r[r.length - 1].text);
    const priceOnly = r.every((l) => !/[a-z]{2,}/i.test(l.text));
    if (r.length > 1 && hasWords && endsInNumber) s += 2;
    if (priceOnly) s -= 1;
  }
  return s - rows.length * 0.01;
}
