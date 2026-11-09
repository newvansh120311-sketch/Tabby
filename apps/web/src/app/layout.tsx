import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Tabby', template: '%s · Tabby' },
  description: 'Split restaurant bills, delivery orders and whole trips with friends, then settle up over UPI.',
  metadataBase: new URL(process.env.PUBLIC_BASE_URL ?? 'http://localhost:3000'),
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf7f2' },
    { media: '(prefers-color-scheme: dark)', color: '#16130f' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <header className="border-b border-line bg-surface/80 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span aria-hidden className="grid h-7 w-7 place-items-center rounded-lg bg-brand text-sm font-bold text-brand-ink">
                T
              </span>
              Tabby
            </Link>
            <Link href="/download" className="rounded-full border border-line px-3 py-1.5 text-sm hover:bg-surface-2">
              Get the app
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 pb-16 pt-6">{children}</main>
      </body>
    </html>
  );
}
