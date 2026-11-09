import type { ChargeType, PrismaClient } from '@prisma/client';
import { randomSlug } from '@tabby/core';

// Everything here is invented demo data. UPI IDs are fake and labelled as demo in the UI.
export const DEMO_UPI = 'vivekdemo@okaxis';
const MEMBERS = [
  { key: 'V', name: 'Vivek', upiId: DEMO_UPI },
  { key: 'P', name: 'Priya', upiId: 'priyademo@okicici' },
  { key: 'M', name: 'Marcus', upiId: 'marcusdemo@ybl' },
  { key: 'J', name: 'Jen', upiId: 'jendemo@okhdfcbank' },
  { key: 'T', name: 'Theo', upiId: 'theodemo@paytm' },
] as const;
type K = (typeof MEMBERS)[number]['key'];

interface DemoItem {
  name: string;
  rupees: number;
  qty?: number;
  by: K[];
}
interface DemoBill {
  title: string;
  merchant?: string;
  source: 'receipt' | 'manual' | 'zomato' | 'instamart' | 'swiggy';
  day: number;
  hour: number;
  payer: K;
  currency?: string;
  fx?: number;
  splitMode: 'items' | 'even';
  /** Who is on the bill (defaults to everyone). */
  people?: K[];
  items: DemoItem[];
  charges?: { type: ChargeType; label: string; amount: number }[];
}

const minor = (major: number, currency = 'INR') => Math.round(major * (currency === 'JPY' ? 1 : 100));

const GOA: DemoBill[] = [
  {
    title: 'Beach shack dinner',
    merchant: 'Sunset Shack, Anjuna',
    source: 'receipt',
    day: 18,
    hour: 21,
    payer: 'V',
    splitMode: 'items',
    items: [
      { name: 'Prawn Balchão', rupees: 520, by: ['V', 'P'] },
      { name: 'Fish Thali', rupees: 380, by: ['M'] },
      { name: 'Chicken Cafreal', rupees: 460, by: ['J', 'T'] },
      { name: 'Garlic Naan', rupees: 240, qty: 4, by: ['V', 'P', 'M', 'J', 'T'] },
      { name: 'Kingfisher', rupees: 720, qty: 4, by: ['V', 'M', 'T'] },
      { name: 'Fresh Lime Soda', rupees: 180, qty: 2, by: ['P', 'J'] },
    ],
    charges: [
      { type: 'tax', label: 'GST 5%', amount: 125 },
      { type: 'other', label: 'Service charge', amount: 150 },
    ],
  },
  {
    title: 'Scooter rental, 3 days',
    source: 'manual',
    day: 18,
    hour: 10,
    payer: 'M',
    splitMode: 'even',
    items: [{ name: 'Two Activas, 3 days', rupees: 2400, by: [] }],
  },
  {
    title: 'Groceries for the villa',
    source: 'instamart',
    day: 18,
    hour: 14,
    payer: 'J',
    splitMode: 'even',
    items: [
      { name: 'Bisleri 5L', rupees: 270, qty: 3, by: [] },
      { name: 'Bread and eggs', rupees: 165, by: [] },
      { name: 'Fruit platter', rupees: 349, by: [] },
      { name: 'Chips and snacks', rupees: 412, by: [] },
    ],
    charges: [
      { type: 'delivery', label: 'Delivery fee', amount: 30 },
      { type: 'platform', label: 'Handling fee', amount: 9 },
    ],
  },
  {
    title: 'Parasailing at Calangute',
    source: 'manual',
    day: 19,
    hour: 11,
    payer: 'P',
    currency: 'USD',
    fx: 84.2,
    splitMode: 'even',
    people: ['V', 'P', 'M', 'T'],
    items: [{ name: 'Parasailing, 4 people', rupees: 140, by: [] }],
  },
  {
    title: 'Cab to Palolem',
    source: 'manual',
    day: 19,
    hour: 16,
    payer: 'T',
    splitMode: 'even',
    items: [{ name: 'Innova, one way', rupees: 3200, by: [] }],
  },
  {
    title: 'Drinks at Tito’s Lane',
    merchant: 'Café Mambo',
    source: 'receipt',
    day: 19,
    hour: 23,
    payer: 'V',
    splitMode: 'items',
    items: [
      { name: 'Cocktail pitcher', rupees: 1800, by: ['V', 'P', 'J'] },
      { name: 'Beer bucket', rupees: 1500, by: ['M', 'T'] },
      { name: 'Loaded fries', rupees: 420, by: ['V', 'P', 'M', 'J', 'T'] },
    ],
    charges: [
      { type: 'tax', label: 'VAT and GST', amount: 372 },
      { type: 'other', label: 'Cover charge', amount: 500 },
    ],
  },
  {
    title: 'Zomato biryani run',
    merchant: 'Biryani by Kilo',
    source: 'zomato',
    day: 20,
    hour: 22,
    payer: 'T',
    splitMode: 'items',
    items: [
      { name: 'Hyderabadi Chicken Biryani', rupees: 898, qty: 2, by: ['V', 'M'] },
      { name: 'Paneer Biryani', rupees: 429, by: ['P'] },
      { name: 'Mutton Biryani', rupees: 549, by: ['T'] },
      { name: 'Raita', rupees: 120, qty: 2, by: ['V', 'P', 'M', 'T'] },
      { name: 'Gulab Jamun', rupees: 180, by: ['J'] },
    ],
    charges: [
      { type: 'membership', label: 'Zomato Gold discount', amount: -217 },
      { type: 'coupon', label: 'Coupon BIRYANI100', amount: -100 },
      { type: 'delivery', label: 'Delivery fee', amount: 0 },
      { type: 'platform', label: 'Platform fee', amount: 11 },
      { type: 'tax', label: 'Taxes', amount: 109 },
      { type: 'partner_tip', label: 'Delivery partner tip', amount: 40 },
    ],
  },
  {
    title: 'Breakfast at the bakery',
    merchant: 'Baba Au Rhum',
    source: 'receipt',
    day: 21,
    hour: 9,
    payer: 'P',
    splitMode: 'items',
    items: [
      { name: 'Croissant', rupees: 360, qty: 3, by: ['P', 'J', 'T'] },
      { name: 'Shakshuka', rupees: 420, by: ['V'] },
      { name: 'Cold coffee', rupees: 640, qty: 4, by: ['V', 'M', 'J', 'T'] },
      { name: 'Banana bread', rupees: 220, by: ['M'] },
    ],
    charges: [{ type: 'tax', label: 'GST 5%', amount: 82 }],
  },
  {
    title: 'Last night fish market dinner',
    source: 'receipt',
    day: 21,
    hour: 20,
    payer: 'J',
    splitMode: 'even',
    items: [
      { name: 'Grilled kingfish', rupees: 1600, by: [] },
      { name: 'Butter garlic crab', rupees: 1450, by: [] },
      { name: 'Rice and curry', rupees: 600, by: [] },
    ],
    charges: [{ type: 'tax', label: 'GST 5%', amount: 183 }],
  },
];

export async function createDemoTrip(
  db: PrismaClient,
  opts: { slug?: string; ownerId?: string | null; ownerDeviceHash?: string | null; claimVivekForDevice?: boolean } = {},
) {
  const slug = opts.slug ?? randomSlug(6);
  const trip = await db.trip.create({
    data: {
      slug,
      name: 'Goa, Dec 2026',
      baseCurrency: 'INR',
      isDemo: true,
      ownerId: opts.ownerId ?? null,
      ownerDeviceHash: opts.ownerDeviceHash ?? null,
    },
  });
  const ids = {} as Record<K, string>;
  for (const m of MEMBERS) {
    const row = await db.tripMember.create({
      data: {
        tripId: trip.id,
        name: m.name,
        upiId: m.upiId,
        isOwner: m.key === 'V',
        userId: m.key === 'V' ? opts.ownerId ?? null : null,
        deviceTokenHash: m.key === 'V' && opts.claimVivekForDevice ? opts.ownerDeviceHash ?? null : null,
      },
    });
    ids[m.key] = row.id;
  }

  for (const b of GOA) {
    const currency = b.currency ?? 'INR';
    const people = b.people ?? MEMBERS.map((m) => m.key);
    const bill = await db.bill.create({
      data: {
        slug: randomSlug(7),
        title: b.title,
        merchant: b.merchant,
        source: b.source,
        currency,
        fxRateToBase: b.fx ?? 1,
        splitMode: b.splitMode,
        date: new Date(Date.UTC(2026, 11, b.day, b.hour - 5, 30)),
        tripId: trip.id,
        payerMemberId: ids[b.payer],
        isDemo: true,
        ownerId: opts.ownerId ?? null,
        ownerDeviceHash: opts.ownerDeviceHash ?? null,
        items: {
          create: b.items.map((i, k) => ({ name: i.name, amountMinor: minor(i.rupees, currency), qty: i.qty ?? 1, position: k })),
        },
        charges: {
          create: (b.charges ?? [])
            .filter((c) => c.amount !== 0)
            .map((c, k) => ({ type: c.type, label: c.label, amountMinor: minor(c.amount, currency), position: k })),
        },
      },
      include: { items: true },
    });
    const pids = {} as Record<K, string>;
    for (const key of people) {
      const p = await db.participant.create({
        data: {
          billId: bill.id,
          memberId: ids[key],
          name: MEMBERS.find((m) => m.key === key)!.name,
          isHost: key === b.payer,
          deviceTokenHash: key === 'V' && opts.claimVivekForDevice ? opts.ownerDeviceHash ?? null : null,
        },
      });
      pids[key] = p.id;
    }
    if (b.splitMode === 'items') {
      const claims = b.items.flatMap((it, k) => it.by.map((key) => ({ itemId: bill.items[k].id, participantId: pids[key] })));
      await db.claim.createMany({ data: claims });
    }
  }
  return { tripId: trip.id, slug, memberIds: ids };
}

interface StandaloneBill {
  slug: string;
  title: string;
  merchant?: string;
  source: DemoBill['source'] | 'district';
  currency: string;
  hostName: string;
  hostUpiId?: string;
  people: string[];
  items: { name: string; amount: number; qty?: number; by: number[] }[];
  charges: { type: ChargeType; label: string; amount: number }[];
  daysAgo: number;
}

const STANDALONE: StandaloneBill[] = [
  {
    slug: 'swiggy26',
    title: 'Late-night Swiggy order',
    merchant: 'Meghna’s Biryani House',
    source: 'swiggy',
    currency: 'INR',
    hostName: 'Vivek',
    hostUpiId: DEMO_UPI,
    people: ['Vivek', 'Ananya', 'Rohan', 'Kabir'],
    items: [
      { name: 'Chicken Dum Biryani', amount: 598, qty: 2, by: [0, 2] },
      { name: 'Paneer 65', amount: 249, by: [1] },
      { name: 'Rumali Roti', amount: 135, qty: 3, by: [0, 1, 3] },
      { name: 'Double Ka Meetha', amount: 129, by: [3] },
      { name: 'Thums Up 300ml', amount: 80, qty: 2, by: [2, 3] },
      { name: 'Mirchi Ka Salan', amount: 60, by: [0, 1, 2, 3] },
    ],
    charges: [
      { type: 'delivery', label: 'Delivery fee', amount: 46 },
      { type: 'platform', label: 'Platform fee', amount: 10 },
      { type: 'packaging', label: 'Restaurant packaging charges', amount: 45 },
      { type: 'tax', label: 'GST and restaurant charges', amount: 68.95 },
      { type: 'coupon', label: 'Coupon MIDNIGHT100', amount: -100 },
      { type: 'partner_tip', label: 'Delivery partner tip', amount: 30 },
    ],
    daysAgo: 2,
  },
  {
    slug: 'district26',
    title: 'Dinner booked on District',
    merchant: 'Saffron Terrace',
    source: 'district',
    currency: 'INR',
    hostName: 'Vivek',
    hostUpiId: DEMO_UPI,
    people: ['Vivek', 'Meera', 'Arjun'],
    items: [
      { name: 'Dahi Kebab', amount: 420, by: [0, 1, 2] },
      { name: 'Laal Maas', amount: 780, by: [2] },
      { name: 'Paneer Lababdar', amount: 560, by: [1] },
      { name: 'Dal Bukhara', amount: 480, by: [0, 1] },
      { name: 'Butter Naan', amount: 300, qty: 4, by: [0, 1, 2] },
      { name: 'Mojito', amount: 760, qty: 2, by: [0, 2] },
    ],
    charges: [
      { type: 'tax', label: 'GST 5%', amount: 165 },
      { type: 'discount', label: 'Pre-booked offer, flat 20% off', amount: -660 },
      { type: 'platform', label: 'Convenience fee', amount: 29 },
    ],
    daysAgo: 5,
  },
  {
    slug: 'tacos26',
    title: 'Friday Tacos at Casa Luna',
    merchant: 'Casa Luna Taqueria',
    source: 'receipt',
    currency: 'USD',
    hostName: 'Vivek',
    people: ['Vivek', 'Sam', 'Alex', 'Jordan', 'Riley'],
    items: [
      { name: 'Carne Asada Tacos', amount: 14.5, by: [0] },
      { name: 'Al Pastor Tacos', amount: 13, by: [1] },
      { name: 'Fish Tacos', amount: 15.25, by: [2] },
      { name: 'Chicken Quesadilla', amount: 12, by: [3] },
      { name: 'Loaded Nachos', amount: 16, by: [0, 1, 2, 3] },
      { name: 'Guacamole', amount: 9.5, by: [1, 4] },
      { name: 'Horchata', amount: 8, qty: 2, by: [4] },
      { name: 'Jarritos', amount: 3.5, by: [0] },
      { name: 'Churros', amount: 7.25, by: [] },
    ],
    charges: [
      { type: 'tax', label: 'Tax 8.875%', amount: 8.79 },
      { type: 'tip', label: 'Tip 18%', amount: 17.82 },
    ],
    daysAgo: 8,
  },
  {
    slug: 'chai26',
    title: 'Chai and Samosas',
    merchant: 'The Chai Room',
    source: 'receipt',
    currency: 'INR',
    hostName: 'Vivek',
    hostUpiId: DEMO_UPI,
    people: ['Vivek', 'Nisha', 'Dev'],
    items: [
      { name: 'Masala Chai', amount: 80, qty: 2, by: [0, 1] },
      { name: 'Samosa', amount: 75, qty: 3, by: [0, 1, 2] },
      { name: 'Bun Maska', amount: 45, by: [2] },
      { name: 'Kanda Bhaji', amount: 90, by: [1, 2] },
      { name: 'Elaichi Chai', amount: 45, by: [2] },
    ],
    charges: [],
    daysAgo: 1,
  },
  {
    slug: 'sushi26',
    title: 'Sushi Night',
    merchant: 'Sushi Kaito, Shibuya',
    source: 'receipt',
    currency: 'JPY',
    hostName: 'Vivek',
    people: ['Vivek', 'Hana'],
    items: [
      { name: 'Omakase set', amount: 4800, by: [0] },
      { name: 'Salmon nigiri', amount: 1200, by: [1] },
      { name: 'Tuna roll', amount: 980, by: [0, 1] },
      { name: 'Miso soup', amount: 700, qty: 2, by: [0, 1] },
      { name: 'Edamame', amount: 450, by: [1] },
      { name: 'Sake carafe', amount: 1650, by: [0, 1] },
    ],
    charges: [],
    daysAgo: 12,
  },
];

export async function createDemoBills(db: PrismaClient, ownerId: string | null) {
  const slugs: string[] = [];
  for (const b of STANDALONE) {
    const bill = await db.bill.create({
      data: {
        slug: b.slug,
        title: b.title,
        merchant: b.merchant,
        source: b.source,
        currency: b.currency,
        splitMode: 'items',
        date: new Date(Date.now() - b.daysAgo * 86400000),
        ownerId,
        hostName: b.hostName,
        hostUpiId: b.hostUpiId ?? null,
        isDemo: true,
        items: {
          create: b.items.map((i, k) => ({ name: i.name, amountMinor: minor(i.amount, b.currency), qty: i.qty ?? 1, position: k })),
        },
        charges: {
          create: b.charges.map((c, k) => ({ type: c.type, label: c.label, amountMinor: minor(c.amount, b.currency), position: k })),
        },
      },
      include: { items: true },
    });
    const pids: string[] = [];
    for (const [k, name] of b.people.entries()) {
      const p = await db.participant.create({ data: { billId: bill.id, name, isHost: k === 0 } });
      pids.push(p.id);
    }
    await db.claim.createMany({
      data: b.items.flatMap((it, k) => it.by.map((idx) => ({ itemId: bill.items[k].id, participantId: pids[idx] }))),
    });
    slugs.push(b.slug);
  }
  return slugs;
}
