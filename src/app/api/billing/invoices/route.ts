import QRCode from "qrcode";
import { getBilling, nextBillingId } from "@/lib/billing";
import { generateReconId, buildUpiDeeplink } from "@/lib/upi";

// GET /api/billing/invoices — list invoices (newest first) with payment count.
export async function GET() {
  const store = getBilling();
  const invoices = [...store.invoices]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((inv) => ({
      ...inv,
      payments: store.payments.filter((p) => p.invoiceId === inv.id).map((p) => ({ id: p.id })),
    }));
  return Response.json({ invoices });
}

// POST /api/billing/invoices — create invoice, mint reconId, return deeplink + QR.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const amount = Number(body?.amount);
  if (!amount || amount <= 0) return Response.json({ error: "Amount must be greater than 0" }, { status: 400 });

  const store = getBilling();
  const reconId = generateReconId();
  const invoice = {
    id: nextBillingId("inv"),
    reconId,
    amount,
    customerName: body.customerName?.trim() || null,
    note: body.note?.trim() || null,
    isCredit: Boolean(body.isCredit),
    status: "PENDING" as const,
    createdAt: new Date().toISOString(),
  };
  store.invoices.push(invoice);

  const deeplink = buildUpiDeeplink({ vpa: store.upiVpa, payeeName: store.storeName, amount, reconId });
  const qrDataUrl = await QRCode.toDataURL(deeplink, { width: 320, margin: 1 });
  return Response.json({ invoice, deeplink, qrDataUrl }, { status: 201 });
}
