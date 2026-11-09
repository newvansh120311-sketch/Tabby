import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { slugSchema } from '@tabby/core';
import { db } from '@/lib/db';
import { serializeTrip, tripInclude } from '@/lib/trips';
import { originOf } from '@/lib/origin';
import TripView from './TripView';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  if (!slugSchema.safeParse(slug).success) return null;
  return db.trip.findUnique({ where: { slug }, include: tripInclude });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const trip = await load((await params).slug);
  if (!trip) return { title: 'Trip not found' };
  return { title: trip.name, description: `Bills and balances for ${trip.name}.`, robots: { index: false } };
}

export default async function TripPage({ params }: Props) {
  const trip = await load((await params).slug);
  if (!trip) notFound();
  return <TripView initial={serializeTrip(trip, { deviceHash: null, userId: null }, originOf())} />;
}
