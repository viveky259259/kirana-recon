import { getDashboardState, processPayment } from "@/lib/ingest";
import type { IncomingPayment } from "@/lib/types";

// Payment-ingest endpoint. The customer paid "somewhere else"; that system (or
// the demo's simulator panel) POSTs the event here. We run validation/recon and
// return the resulting payment plus a fresh dashboard snapshot.
export async function POST(request: Request) {
  let body: Partial<IncomingPayment>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return Response.json({ error: "A positive `amount` is required." }, { status: 400 });
  }

  const incoming: IncomingPayment = {
    payerName: typeof body.payerName === "string" ? body.payerName.trim() : "",
    payerUpiId: typeof body.payerUpiId === "string" ? body.payerUpiId.trim() : "",
    invoiceId:
      typeof body.invoiceId === "string" && body.invoiceId.trim()
        ? body.invoiceId.trim()
        : undefined,
    amount,
  };

  if (!incoming.payerName && !incoming.payerUpiId && !incoming.invoiceId) {
    return Response.json(
      { error: "At least one of `invoiceId`, `payerUpiId`, or `payerName` is required." },
      { status: 400 },
    );
  }

  const payment = await processPayment(incoming);
  return Response.json({ payment, state: getDashboardState() }, { status: 201 });
}

// Convenience: list payments (newest first).
export async function GET() {
  return Response.json({ payments: getDashboardState().payments });
}
