import { NextResponse } from "next/server";
import { linkPaymentToInvoice } from "@/lib/match";

// POST /api/link — body: { paymentId, invoiceId }
// Manually pair an unmatched payment with an invoice. Persisted as an auditable
// Link and reflected in all future reports.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.paymentId || !body?.invoiceId) {
    return NextResponse.json({ error: "paymentId and invoiceId required" }, { status: 400 });
  }
  try {
    const payment = await linkPaymentToInvoice(body.paymentId, body.invoiceId);
    return NextResponse.json({ payment });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
