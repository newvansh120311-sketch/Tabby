import { NEGATIVE_CHARGE_TYPES, billWriteSchema } from '@tabby/core';
import { db } from '@/lib/db';
import { body, Ctx, json, route } from '@/lib/http';
import { identify } from '@/lib/identity';
import { billInclude, loadBill, requireHost, serializeBill, syncBillSettlements } from '@/lib/bills';
import { originOf } from '@/lib/origin';

export const GET = route(async (req, { params }: Ctx<{ slug: string }>) => {
  const { slug } = await params;
  const who = await identify(req);
  const bill = await loadBill(slug);
  return json({ bill: serializeBill(bill, who, originOf(req)) });
});

/** Replace a bill's contents. Items keep their claims when their id is sent back. */
export const PUT = route(async (req, { params }: Ctx<{ slug: string }>) => {
  const { slug } = await params;
  const who = await identify(req);
  const bill = await loadBill(slug);
  requireHost(bill, who);
  const input = await body(req, billWriteSchema);
  const keepIds = new Set(input.items.map((i) => i.id).filter(Boolean) as string[]);

  await db.$transaction([
    db.item.deleteMany({ where: { billId: bill.id, id: { notIn: [...keepIds] } } }),
    ...input.items.map((i, k) =>
      i.id && bill.items.some((x) => x.id === i.id)
        ? db.item.update({ where: { id: i.id }, data: { name: i.name, amountMinor: i.amountMinor, qty: i.qty, position: k } })
        : db.item.create({ data: { billId: bill.id, name: i.name, amountMinor: i.amountMinor, qty: i.qty, position: k } }),
    ),
    db.charge.deleteMany({ where: { billId: bill.id } }),
    db.charge.createMany({
      data: input.charges.map((c, k) => ({
        billId: bill.id,
        type: c.type,
        label: c.label || c.type,
        amountMinor: NEGATIVE_CHARGE_TYPES.includes(c.type) ? -Math.abs(c.amountMinor) : c.amountMinor,
        position: k,
      })),
    }),
    db.bill.update({
      where: { id: bill.id },
      data: {
        title: input.title,
        merchant: input.merchant,
        currency: input.currency,
        splitMode: input.splitMode,
        feeRules: input.feeRules,
        date: input.date ? new Date(input.date) : undefined,
        payerMemberId: bill.tripId ? input.payerMemberId ?? bill.payerMemberId : undefined,
        fxRateToBase: input.fxRateToBase ?? bill.fxRateToBase,
        hostUpiId: bill.tripId ? undefined : input.hostUpiId || bill.hostUpiId,
        hostName: bill.tripId ? undefined : input.hostName ?? bill.hostName,
        detectedTotalMinor: input.detectedTotalMinor ?? null,
        version: { increment: 1 },
      },
    }),
  ]);
  const fresh = await db.bill.findUniqueOrThrow({ where: { id: bill.id }, include: billInclude });
  await syncBillSettlements(fresh);
  const out = await db.bill.findUniqueOrThrow({ where: { id: bill.id }, include: billInclude });
  return json({ bill: serializeBill(out, who, originOf(req)) });
});

export const DELETE = route(async (req, { params }: Ctx<{ slug: string }>) => {
  const { slug } = await params;
  const who = await identify(req);
  const bill = await loadBill(slug);
  requireHost(bill, who);
  await db.bill.delete({ where: { id: bill.id } });
  return json({ ok: true });
});
