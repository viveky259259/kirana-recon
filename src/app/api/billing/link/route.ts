import { linkPaymentToInvoice } from "@/lib/billing";

// POST /api/billing/link — { paymentId, invoiceId }. Manual pairing.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.paymentId || !body?.invoiceId) {
    return Response.json({ error: "paymentId and invoiceId required" }, { status: 400 });
  }
  try {
    const payment = linkPaymentToInvoice(body.paymentId, body.invoiceId);
    return Response.json({ payment });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
