import type { Metadata } from 'next';
import QRCode from 'qrcode';

export const metadata: Metadata = { title: 'Download for Android' };
export const revalidate = 300;

type Release = { tag: string; url: string; size: number; date: string } | null;

async function latestRelease(): Promise<Release> {
  const repo = process.env.GITHUB_REPO ?? 'newvansh120311-sketch/Tabby';
  try {
    const r = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: { accept: 'application/vnd.github+json', 'user-agent': 'tabby-web' },
      next: { revalidate: 300 },
    });
    if (!r.ok) return null;
    const j = (await r.json()) as {
      tag_name: string;
      published_at: string;
      assets: { name: string; browser_download_url: string; size: number }[];
    };
    const apk = j.assets.find((a) => a.name.endsWith('.apk'));
    return apk ? { tag: j.tag_name, url: apk.browser_download_url, size: apk.size, date: j.published_at } : null;
  } catch {
    return null;
  }
}

export default async function Download() {
  const rel = await latestRelease();
  const apkUrl = process.env.APK_URL ?? rel?.url ?? null;
  const base = process.env.PUBLIC_BASE_URL ?? '';
  const qr = await QRCode.toDataURL(apkUrl ?? `${base}/download`, { width: 440, margin: 1 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Tabby for Android</h1>
        <p className="mt-2 text-muted">Android 10 or newer. The app is free and doesn’t show ads.</p>
      </div>

      <div className="flex flex-col gap-6 rounded-2xl border border-line bg-surface p-5 sm:flex-row sm:items-center">
        <div className="shrink-0 self-start rounded-xl bg-white p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} width={220} height={220} alt="QR code that downloads the Tabby APK" />
        </div>
        <div className="space-y-3">
          <p className="text-sm text-muted">On a computer? Scan this with your phone’s camera to download straight to it.</p>
          {apkUrl ? (
            <a href={apkUrl} className="inline-flex min-h-11 items-center rounded-xl bg-brand px-5 font-medium text-brand-ink">
              Download the APK{rel ? ` (${rel.tag}, ${(rel.size / 1e6).toFixed(0)} MB)` : ''}
            </a>
          ) : (
            <p className="text-sm">The first build is on its way. Check back in a little while.</p>
          )}
        </div>
      </div>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-semibold">Installing it</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted">
          <li>Download the APK on your phone and open it from your notifications or the Downloads app.</li>
          <li>
            Android will ask whether your browser can install apps. Turn on <em>Allow from this source</em>, then go back.
          </li>
          <li>Tap Install. Tabby updates small fixes by itself, and new versions show up on this page.</li>
        </ol>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-semibold">Splitting a Swiggy or Zomato order</h2>
        <p className="mt-2 text-sm text-muted">
          Open the order in the delivery app and take a screenshot of the bill details, or copy the order text. Tap Share,
          choose Tabby, and the bill opens with items, fees and discounts already filled in.
        </p>
      </section>
    </div>
  );
}
