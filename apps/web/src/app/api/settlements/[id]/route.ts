import { paymentStatusSchema } from '@tabby/core';
import { db } from '@/lib/db';
import { body, Ctx, HttpError, json, route } from '@/lib/http';
import { identify } from '@/lib/identity';
import { bumpBill, isBillHost, loadBill } from '@/lib/bills';
import { tripRole } from '@/lib/trips';

/**
 * Move a payment through Unpaid -> Marked paid -> Confirmed.
 * The payer of the debt marks it; the person being paid (or the host) confirms or resets it.
 */
export const PATCH = route(async (req, { params }: Ctx<{ id: string }>) => {
  const { id } = await params;
  const who = await identify(req);
  const { status } = await body(req, paymentStatusSchema);
  const s = await db.settlement.findUnique({ where: { id } });
  if (!s) throw new HttpError(404, 'That payment no longer exists.');

  let isDebtor = false;
  let isCreditor = false;
  if (s.billId) {
    const bill = await db.bill.findUniqueOrThrow({ where: { id: s.billId }, select: { slug: true } });
    const full = await loadBill(bill.slug);
    const from = full.participants.find((p) => p.id === s.fromId);
    isDebtor = !!who.deviceHash && from?.deviceTokenHash === who.deviceHash;
    isCreditor = isBillHost(full, who);
  } else if (s.tripId) {
    const role = await tripRole(s.tripId, who);
    isDebtor = role.memberId === s.fromId;
    isCreditor = role.memberId === s.toId || role.isOwner;
  }

  const allowed =
    (status === 'marked' && (isDebtor || isCreditor)) ||
    (status === 'confirmed' && isCreditor) ||
    (status === 'unpaid' && (isCreditor || (isDebtor && s.status === 'marked')));
  if (!allowed) {
    throw new HttpError(
      403,
      status === 'confirmed' ? 'Only the person being paid can confirm this.' : 'You can’t change this payment.',
    );
  }
  const updated = await db.settlement.update({ where: { id }, data: { status } });
  if (s.billId) await bumpBill(s.billId);
  if (s.tripId) await db.trip.update({ where: { id: s.tripId }, data: { updatedAt: new Date() } });
  return json({ settlement: updated });
});
