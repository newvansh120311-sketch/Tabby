import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { slugSchema } from '@tabby/core';
import { db } from '@/lib/db';
import { billInclude, serializeBill } from '@/lib/bills';
import { originOf } from '@/lib/origin';
import BillClaim from './BillClaim';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  if (!slugSchema.safeParse(slug).success) return null;
  return db.bill.findUnique({ where: { slug }, include: billInclude });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const bill = await load((await params).slug);
  if (!bill) return { title: 'Bill not found' };
  return {
    title: bill.title,
    description: `Tap what you had on ${bill.title} and Tabby works out your share.`,
    robots: { index: false },
  };
}

export default async function BillPage({ params }: Props) {
  const bill = await load((await params).slug);
  if (!bill) notFound();
  const initial = serializeBill(bill, { deviceHash: null, userId: null }, originOf());
  return <BillClaim initial={initial} />;
}
