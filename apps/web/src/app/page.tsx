import Link from 'next/link';

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="pt-4">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">Whoever paid scans the bill. Everyone else taps what they had.</h1>
        <p className="mt-4 max-w-xl text-lg text-muted">
          Tabby reads restaurant receipts and Swiggy or Zomato orders, works out each person’s share with fees and
          discounts spread fairly, and gives everyone a UPI button for the exact amount.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/download" className="inline-flex min-h-11 items-center rounded-xl bg-brand px-5 font-medium text-brand-ink">
            Download for Android
          </Link>
          {process.env.DEMO_TRIP_SLUG && (
            <Link
              href={`/t/${process.env.DEMO_TRIP_SLUG}`}
              className="inline-flex min-h-11 items-center rounded-xl border border-line px-5 font-medium hover:bg-surface-2"
            >
              See a demo trip
            </Link>
          )}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="font-semibold">Got a link from a friend?</h2>
          <p className="mt-2 text-sm text-muted">
            Open it on your phone. You don’t need the app or an account to claim your items and see what you owe.
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="font-semibold">Going on a trip?</h2>
          <p className="mt-2 text-sm text-muted">
            Put every bill in one place, even ones paid in another currency, and Tabby finds the fewest payments that
            square everyone up at the end.
          </p>
        </div>
      </section>
    </div>
  );
}
