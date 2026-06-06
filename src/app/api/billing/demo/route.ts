import { getBilling, nextBillingId, resolveMatch, recomputeInvoiceStatus } from "@/lib/billing";
import { buildReport, rangeFor } from "@/lib/billingReport";

// POST /api/billing/demo — load a realistic set of demo payments so the report
// is populated without manually importing CSVs. Idempotent: clears existing
// payments first, then seeds a spread across all three apps covering every
// match outcome (matched / amount-mismatch / unmatched). Dated "now" so they
// land in today's report.
export async function POST() {
  const store = getBilling();
  store.payments = [];

  const now = Date.now();
  // [reconId-or-null, amount, app, payerVpa, minutesAgo]
  const rows: Array<[string | null, number, "PAYTM" | "GPAY" | "PHONEPE", string, number]> = [
    ["KR-DEMO0001", 450, "PAYTM", "ramesh@oksbi", 320], // matched
    ["KR-DEMO0002", 1100, "PAYTM", "sunita@okhdfcbank", 280], // mismatch (invoice is 1200)
    [null, 250, "PAYTM", "unknown@okaxis", 240], // unmatched
    ["KR-DEMO0003", 85, "GPAY", "walkin@oksbi", 200], // matched
    [null, 500, "GPAY", "priya@okicici", 150], // unmatched
    ["KR-DEMO0004", 640, "PHONEPE", "imran@ybl", 90], // matched
    ["KR-DEMO0005", 300, "PHONEPE", "lakshmi@ybl", 30], // matched (udhaar settled)
  ];

  let n = 1;
  const touched = new Set<string>();
  for (const [reconId, amount, app, vpa, minsAgo] of rows) {
    const txnRef = reconId ? `Invoice ${reconId}` : "UPI payment";
    const outcome = resolveMatch(txnRef, amount);
    store.payments.push({
      id: nextBillingId("pay"),
      externalId: `DEMO${String(n++).padStart(4, "0")}`,
      txnRef,
      amount,
      paidAt: new Date(now - minsAgo * 60_000).toISOString(),
      payerVpa: vpa,
      sourceApp: app,
      matchStatus: outcome.matchStatus,
      invoiceId: outcome.invoiceId,
    });
    if (outcome.invoiceId) touched.add(outcome.invoiceId);
  }
  touched.forEach(recomputeInvoiceStatus);

  const { from, to, label } = rangeFor("day");
  return Response.json({ seeded: store.payments.length, report: buildReport(from, to, label) });
}
