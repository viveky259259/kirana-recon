import QRCode from "qrcode";
import { getBilling } from "@/lib/billing";
import { buildUpiDeeplink } from "@/lib/upi";

// GET /api/billing/invoices/:id — full detail: fields, linked payments, QR.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const store = getBilling();
  const inv = store.invoices.find((i) => i.id === id);
  if (!inv) return Response.json({ error: "Not found" }, { status: 404 });

  const payments = store.payments
    .filter((p) => p.invoiceId === id)
    .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());
  const paidTotal = payments.reduce((s, p) => s + p.amount, 0);

  const deeplink = buildUpiDeeplink({
    vpa: store.upiVpa,
    payeeName: store.storeName,
    amount: inv.amount,
    reconId: inv.reconId,
  });
  const qrDataUrl = await QRCode.toDataURL(deeplink, { width: 320, margin: 1 });

  return Response.json({ invoice: { ...inv, payments }, deeplink, qrDataUrl, paidTotal });
}
