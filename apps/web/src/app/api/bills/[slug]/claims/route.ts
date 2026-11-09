import { claimSchema } from '@tabby/core';
import { db } from '@/lib/db';
import { body, Ctx, HttpError, json, route } from '@/lib/http';
import { identify } from '@/lib/identity';
import { billInclude, bumpBill, isBillHost, loadBill, serializeBill, syncBillSettlements } from '@/lib/bills';
import { originOf } from '@/lib/origin';

/** Claim or unclaim an item. Guests change their own claims; the host can change anyone's. */
export const POST = route(async (req, { params }: Ctx<{ slug: string }>) => {
  const { slug } = await params;
  const who = await identify(req);
  const input = await body(req, claimSchema);
  const bill = await loadBill(slug);

  const participant = bill.participants.find((p) => p.id === input.participantId);
  if (!participant) throw new HttpError(404, 'That person isn’t on this bill any more.');
  const own = !!who.deviceHash && participant.deviceTokenHash === who.deviceHash;
  if (!own && !isBillHost(bill, who)) throw new HttpError(403, 'You can only claim items for yourself.');
  if (!bill.items.some((i) => i.id === input.itemId)) throw new HttpError(404, 'That item was removed from the bill.');

  if (input.claimed) {
    await db.claim.upsert({
      where: { itemId_participantId: { itemId: input.itemId, participantId: input.participantId } },
      create: { itemId: input.itemId, participantId: input.participantId },
      update: {},
    });
  } else {
    await db.claim.deleteMany({ where: { itemId: input.itemId, participantId: input.participantId } });
  }
  await bumpBill(bill.id);
  const fresh = await db.bill.findUniqueOrThrow({ where: { id: bill.id }, include: billInclude });
  await syncBillSettlements(fresh);
  const out = await db.bill.findUniqueOrThrow({ where: { id: bill.id }, include: billInclude });
  return json({ bill: serializeBill(out, who, originOf(req)) });
});
