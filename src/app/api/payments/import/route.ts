import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseSettlementCsv, type NormalizedRow } from "@/lib/csv";
import { resolveMatch, recomputeInvoiceStatus } from "@/lib/match";

type ImportSummary = {
  detectedApp: string;
  total: number;
  imported: number;
  duplicates: number;
  matched: number;
  mismatch: number;
  unmatched: number;
  parseErrors: string[];
};

// POST /api/payments/import — body: { csv: string, forceApp?: string }
// Parses a settlement CSV, dedupes by externalId, auto-matches each row, and
// persists. Re-uploading the same file is a no-op (idempotent) and reported as
// duplicates — this is also how genuine duplicate payments surface.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.csv || typeof body.csv !== "string") {
    return NextResponse.json({ error: "Missing csv" }, { status: 400 });
  }

  const { rows, errors, detectedApp } = parseSettlementCsv(body.csv, body.forceApp);

  const summary: ImportSummary = {
    detectedApp,
    total: rows.length,
    imported: 0,
    duplicates: 0,
    matched: 0,
    mismatch: 0,
    unmatched: 0,
    parseErrors: errors,
  };

  // Pre-flight: which externalIds already exist?
  const ids = rows.map((r) => r.externalId);
  const existing = await prisma.payment.findMany({
    where: { externalId: { in: ids } },
    select: { externalId: true },
  });
  const existingSet = new Set(existing.map((e) => e.externalId));

  // De-dupe within the file itself too.
  const seen = new Set<string>();
  const fresh: NormalizedRow[] = [];
  for (const r of rows) {
    if (existingSet.has(r.externalId) || seen.has(r.externalId)) {
      summary.duplicates++;
      continue;
    }
    seen.add(r.externalId);
    fresh.push(r);
  }

  const touchedInvoices = new Set<string>();

  for (const r of fresh) {
    const outcome = await resolveMatch(r.txnRef, r.amount);
    const payment = await prisma.payment.create({
      data: {
        externalId: r.externalId,
        txnRef: r.txnRef,
        amount: r.amount,
        paidAt: r.paidAt,
        payerVpa: r.payerVpa,
        sourceApp: r.sourceApp,
        matchStatus: outcome.matchStatus,
        invoiceId: outcome.invoiceId,
      },
    });
    if (outcome.invoiceId) {
      await prisma.link.create({
        data: { paymentId: payment.id, invoiceId: outcome.invoiceId, linkedManually: false },
      });
      touchedInvoices.add(outcome.invoiceId);
    }
    summary.imported++;
    if (outcome.matchStatus === "MATCHED") summary.matched++;
    else if (outcome.matchStatus === "MISMATCH") summary.mismatch++;
    else summary.unmatched++;
  }

  for (const invId of touchedInvoices) {
    await recomputeInvoiceStatus(invId);
  }

  return NextResponse.json({ summary });
}
