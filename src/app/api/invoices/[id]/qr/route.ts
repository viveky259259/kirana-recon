import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { getStore } from "@/lib/store";
import { buildUpiDeeplink } from "@/lib/upi";

// GET /api/invoices/:id/qr — rebuild the deeplink + QR for an existing invoice.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const store = await getStore();
  const deeplink = buildUpiDeeplink({
    vpa: store.upiVpa,
    payeeName: store.name,
    amount: invoice.amount,
    reconId: invoice.reconId,
  });
  const qrDataUrl = await QRCode.toDataURL(deeplink, { width: 320, margin: 1 });
  return NextResponse.json({ invoice, deeplink, qrDataUrl });
}
