import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-semibold">We couldn’t find that page</h1>
      <p className="mt-2 text-muted">If someone sent you a link, check it wasn’t cut off when it was copied.</p>
      <Link href="/" className="mt-6 inline-block underline">
        Go to the Tabby home page
      </Link>
    </div>
  );
}
