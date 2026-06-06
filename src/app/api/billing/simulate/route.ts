import { getBilling, nextBillingId, resolveMatch, recomputeInvoiceStatus } from "@/lib/billing";

const APPS = ["PAYTM", "GPAY", "PHONEPE"] as const;
const STRANGERS = ["amit@oksbi", "neha@okicici", "rahul@ybl", "pooja@okhdfcbank"];

const handle = (name: string | null) =>
  name ? name.trim().toLowerCase().split(/\s+/)[0] + "@oksbi" : STRANGERS[Math.floor(Math.random() * STRANGERS.length)];

// POST /api/billing/simulate — pretend a customer just paid. Most of the time we
// pay a random unpaid bill (so it auto-matches and the entry updates); now and
// then we create a payment with no bill (so the "needs your check" flow shows).
export async function POST() {
  const store = getBilling();
  const app = APPS[Math.floor(Math.random() * APPS.length)];
  const open = store.invoices.filter((i) => i.status !== "PAID");

  // ~20% of the time, or when there are no open bills, simulate a stranger payment.
  const makeStranger = open.length === 0 || Math.random() < 0.2;

  let txnRef: string | null;
  let amount: number;
  let payerVpa: string;

  if (makeStranger) {
    txnRef = null;
    amount = [120, 250, 500, 75, 999][Math.floor(Math.random() * 5)];
    payerVpa = STRANGERS[Math.floor(Math.random() * STRANGERS.length)];
  } else {
    const bill = open[Math.floor(Math.random() * open.length)];
    txnRef = `Invoice ${bill.reconId}`;
    amount = bill.amount;
    payerVpa = handle(bill.customerName);
  }

  const outcome = resolveMatch(txnRef, amount);
  const payment = {
    id: nextBillingId("pay"),
    externalId: `SIM${Date.now()}${Math.floor(Math.random() * 1000)}`,
    txnRef,
    amount,
    paidAt: new Date().toISOString(),
    payerVpa,
    sourceApp: app,
    matchStatus: outcome.matchStatus,
    invoiceId: outcome.invoiceId,
  };
  store.payments.push(payment);
  if (outcome.invoiceId) recomputeInvoiceStatus(outcome.invoiceId);

  const matchedBill = outcome.invoiceId ? store.invoices.find((i) => i.id === outcome.invoiceId) : null;
  return Response.json({
    payment,
    matched: outcome.matchStatus === "MATCHED",
    bill: matchedBill ? { reconId: matchedBill.reconId, customerName: matchedBill.customerName } : null,
  });
}
