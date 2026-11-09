// Same output on the server and in every browser, so pages hydrate cleanly.
// Dates show in India time, which is where nearly all Tabby bills happen.
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const IST_OFFSET_MS = 330 * 60 * 1000;

export function formatDate(iso: string, opts: { weekday?: boolean; year?: boolean } = {}): string {
  const d = new Date(new Date(iso).getTime() + IST_OFFSET_MS);
  const parts = [`${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`];
  if (opts.year) parts[0] += ` ${d.getUTCFullYear()}`;
  return opts.weekday ? `${DAYS[d.getUTCDay()]}, ${parts[0]}` : parts[0];
}
