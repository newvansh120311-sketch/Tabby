// Loads the demo data. Safe to run again: it removes earlier demo rows first.
import { PrismaClient } from '@prisma/client';
import { createDemoBills, createDemoTrip, DEMO_UPI } from '../src/lib/demo';
import { billInclude, syncBillSettlements } from '../src/lib/bills';
import { loadTrip, serializeTrip } from '../src/lib/trips';

const db = new PrismaClient();
const DEMO_TRIP_SLUG = 'goa26';

async function main() {
  await db.bill.deleteMany({ where: { isDemo: true, tripId: null, slug: { in: ['swiggy26', 'district26', 'tacos26', 'chai26', 'sushi26'] } } });
  await db.trip.deleteMany({ where: { slug: DEMO_TRIP_SLUG } });

  const user = await db.user.upsert({
    where: { email: 'vivek.demo@tabby.invalid' },
    create: {
      email: 'vivek.demo@tabby.invalid',
      name: 'Vivek Demo',
      displayName: 'Vivek Demo',
      defaultCurrency: 'INR',
      upiId: DEMO_UPI,
      isDemo: true,
    },
    update: { displayName: 'Vivek Demo', upiId: DEMO_UPI, isDemo: true },
  });

  const trip = await createDemoTrip(db, { slug: DEMO_TRIP_SLUG, ownerId: user.id });

  // Settle-up: confirm the first suggested payment and mark the second as paid.
  const before = serializeTrip(await loadTrip(trip.slug), { deviceHash: null, userId: null }, '');
  console.log(`Goa trip settle-up: ${before.payments.length} payments`);
  for (const p of before.payments) console.log(`  ${p.fromName} pays ${p.toName} ${p.amountMinor / 100}`);
  const [first, second] = before.payments;
  if (first)
    await db.settlement.create({
      data: { tripId: trip.tripId, fromId: first.fromMemberId, toId: first.toMemberId, amountMinor: first.amountMinor, currency: 'INR', status: 'confirmed' },
    });
  if (second)
    await db.settlement.create({
      data: { tripId: trip.tripId, fromId: second.fromMemberId, toId: second.toMemberId, amountMinor: second.amountMinor, currency: 'INR', status: 'marked' },
    });

  const slugs = await createDemoBills(db, user.id);
  for (const slug of slugs) {
    const bill = await db.bill.findUniqueOrThrow({ where: { slug }, include: billInclude });
    await syncBillSettlements(bill);
  }
  // One guest on the chai bill has already paid and the host confirmed.
  const chai = await db.bill.findUniqueOrThrow({ where: { slug: 'chai26' }, include: { settlements: true } });
  if (chai.settlements[0]) await db.settlement.update({ where: { id: chai.settlements[0].id }, data: { status: 'marked' } });

  const after = serializeTrip(await loadTrip(trip.slug), { deviceHash: null, userId: null }, '');
  console.log(`After seeding: ${after.payments.length} open, ${after.confirmedPayments.length} confirmed`);
  console.log(`Seeded trip /t/${trip.slug} and bills ${slugs.map((s) => '/b/' + s).join(', ')}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
