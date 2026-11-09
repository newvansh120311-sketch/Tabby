import { joinSchema } from '@tabby/core';
import { db } from '@/lib/db';
import { body, Ctx, json, route } from '@/lib/http';
import { hashToken, identify } from '@/lib/identity';
import { billInclude, bumpBill, loadBill, serializeBill, syncBillSettlements } from '@/lib/bills';
import { originOf } from '@/lib/origin';

/**
 * Join a bill as a guest. If a participant was already added by name (for example by
 * the host, or as a trip member), pass participantId to take over that seat.
 */
export const POST = route(async (req, { params }: Ctx<{ slug: string }>) => {
  const { slug } = await params;
  const who = await identify(req);
  const input = await body(req, joinSchema.extend({ participantId: joinSchema.shape.name.optional() }));
  const tokenHash = hashToken(input.deviceToken);
  const bill = await loadBill(slug);

  const mine = bill.participants.find((p) => p.deviceTokenHash === tokenHash);
  if (mine) {
    if (mine.name !== input.name) await db.participant.update({ where: { id: mine.id }, data: { name: input.name } });
  } else {
    const seat = input.participantId ? bill.participants.find((p) => p.id === input.participantId && !p.deviceTokenHash) : undefined;
    if (seat) await db.participant.update({ where: { id: seat.id }, data: { deviceTokenHash: tokenHash, name: input.name } });
    else await db.participant.create({ data: { billId: bill.id, name: input.name, deviceTokenHash: tokenHash } });
  }
  await bumpBill(bill.id);
  const fresh = await db.bill.findUniqueOrThrow({ where: { id: bill.id }, include: billInclude });
  await syncBillSettlements(fresh);
  const out = await db.bill.findUniqueOrThrow({ where: { id: bill.id }, include: billInclude });
  return json({ bill: serializeBill(out, { ...who, deviceHash: tokenHash }, originOf(req)) });
});
