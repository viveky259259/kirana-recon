import { getBilling, nextBillingId, resolveMatch, recomputeInvoiceStatus } from "@/lib/billing";
import { parseSettlementCsv } from "@/lib/csv";

// POST /api/billing/payments/import — { csv, forceApp? }. Parse a settlement CSV,
// dedupe by externalId (UTR/RRN), auto-match to invoices, persist.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.csv || typeof body.csv !== "string") return Response.json({ error: "Missing csv" }, { status: 400 });

  const { rows, errors, detectedApp } = parseSettlementCsv(body.csv, body.forceApp);
  const store = getBilling();
  const existing = new Set(store.payments.map((p) => p.externalId));

  const summary = {
    detectedApp, total: rows.length, imported: 0, duplicates: 0,
    matched: 0, mismatch: 0, unmatched: 0, parseErrors: errors,
  };
  const seen = new Set<string>();
  const touched = new Set<string>();

  for (const r of rows) {
    if (existing.has(r.externalId) || seen.has(r.externalId)) {
      summary.duplicates++;
      continue;
    }
    seen.add(r.externalId);
    const outcome = resolveMatch(r.txnRef, r.amount);
    store.payments.push({
      id: nextBillingId("pay"),
      externalId: r.externalId,
      txnRef: r.txnRef,
      amount: r.amount,
      paidAt: r.paidAt.toISOString(),
      payerVpa: r.payerVpa,
      sourceApp: r.sourceApp,
      matchStatus: outcome.matchStatus,
      invoiceId: outcome.invoiceId,
    });
    if (outcome.invoiceId) touched.add(outcome.invoiceId);
    summary.imported++;
    if (outcome.matchStatus === "MATCHED") summary.matched++;
    else if (outcome.matchStatus === "MISMATCH") summary.mismatch++;
    else summary.unmatched++;
  }
  touched.forEach(recomputeInvoiceStatus);
  return Response.json({ summary });
}
