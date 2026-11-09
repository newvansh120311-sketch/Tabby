import { z } from 'zod';
import { db } from '@/lib/db';
import { body, Ctx, HttpError, json, route } from '@/lib/http';
import { identify } from '@/lib/identity';
import { billInclude, bumpBill, loadBill, requireHost, serializeBill, syncBillSettlements } from '@/lib/bills';
import { originOf } from '@/lib/origin';

const schema = z.object({
  add: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  remove: z.array(z.string()).max(30).default([]),
});

/** Host adds people by name (for even splits or friends without phones) or removes them. */
export const POST = route(async (req, { params }: Ctx<{ slug: string }>) => {
  const { slug } = await params;
  const who = await identify(req);
  const bill = await loadBill(slug);
  requireHost(bill, who);
  const input = await body(req, schema);
  if (input.remove.some((id) => bill.participants.find((p) => p.id === id)?.isHost))
    throw new HttpError(422, 'The host stays on the bill.');
  await db.$transaction([
    db.participant.deleteMany({ where: { billId: bill.id, id: { in: input.remove } } }),
    db.settlement.deleteMany({ where: { billId: bill.id, fromId: { in: input.remove } } }),
    db.participant.createMany({ data: input.add.map((name) => ({ billId: bill.id, name })) }),
  ]);
  await bumpBill(bill.id);
  const fresh = await db.bill.findUniqueOrThrow({ where: { id: bill.id }, include: billInclude });
  await syncBillSettlements(fresh);
  const out = await db.bill.findUniqueOrThrow({ where: { id: bill.id }, include: billInclude });
  return json({ bill: serializeBill(out, who, originOf(req)) });
});
