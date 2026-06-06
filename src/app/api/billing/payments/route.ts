import { getBilling } from "@/lib/billing";

// GET /api/billing/payments?status=MATCHED|MISMATCH|UNMATCHED — list payments
// with their linked invoice (if any).
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const store = getBilling();

  const payments = store.payments
    .filter((p) => (status ? p.matchStatus === status : true))
    .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())
    .map((p) => ({
      ...p,
      invoice: p.invoiceId
        ? (() => {
            const i = store.invoices.find((x) => x.id === p.invoiceId);
            return i ? { id: i.id, reconId: i.reconId, amount: i.amount, customerName: i.customerName } : null;
          })()
        : null,
    }));
  return Response.json({ payments });
}
